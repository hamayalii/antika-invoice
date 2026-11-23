import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleHelp, FileDown, Loader2, Printer, X } from "lucide-react";
import type { DigitsMode, InvoiceDto, Language } from "@antika/shared";
import { api } from "../lib/api";
import { useSettingsQuery } from "../lib/useSettings";
import { buildPrintCss } from "../lib/printLayout";
import { usePrintPage, waitForPrintReady } from "../lib/usePrintPage";
import { PrintNotice, hasSeenPrintNotice, markPrintNoticeSeen } from "../components/PrintNotice";
import { InvoiceDocument } from "../features/invoices/InvoiceDocument";
import "../features/invoices/invoice-document.css";

const PAPER = { widthMm: 210, heightMm: 297 };

export function InvoicePrintPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const invoiceId = Number(id);
  const autoPrint = params.get("autoprint") === "1";

  const invoiceQuery = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => api.get<{ invoice: InvoiceDto }>(`/invoices/${invoiceId}`),
    enabled: Number.isInteger(invoiceId) && invoiceId > 0,
    retry: false,
  });

  const settingsQuery = useSettingsQuery();
  const invoice = invoiceQuery.data?.invoice;
  const settings = settingsQuery.data?.settings;

  const langOverride = params.get("lang");
  const lang: Language =
    langOverride === "ar" || langOverride === "ku" ? langOverride : (invoice?.lang ?? "ku");
  const digitsMode: DigitsMode = invoice?.digitsMode ?? settings?.defaults.invoiceDigits ?? "eastern";
  const safeMarginMm = settings?.defaults.safeMarginMm ?? 5;

  const printCss = useMemo(
    () =>
      buildPrintCss({
        sheetWidthMm: PAPER.widthMm,
        sheetHeightMm: PAPER.heightMm,
        pageWidthMm: PAPER.widthMm,
        pageHeightMm: PAPER.heightMm,
        safeMarginMm,
      }),
    [safeMarginMm],
  );

  const [noticeOpen, setNoticeOpen] = useState(false);
  const requestPrint = async () => {
    if (!hasSeenPrintNotice()) {
      setNoticeOpen(true);
      return;
    }
    await waitForPrintReady();
    window.print();
  };
  const startPrint = async () => {
    markPrintNoticeSeen();
    setNoticeOpen(false);
    await waitForPrintReady();
    window.print();
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = invoice
      ? `${t("invoices.title")} #${invoice.number} | ${t("app.name")}`
      : `${t("print.preparing")} | ${t("app.name")}`;
    return () => {
      document.title = previousTitle;
    };
  }, [invoice, t]);

  useEffect(() => {
    if (!invoice || !settings) return;
    const root = document.documentElement;
    const previousDir = root.getAttribute("dir");
    const previousLang = root.getAttribute("lang");
    root.setAttribute("dir", "rtl");
    root.setAttribute("lang", lang);
    return () => {
      if (previousDir === null) root.removeAttribute("dir");
      else root.setAttribute("dir", previousDir);
      if (previousLang === null) root.removeAttribute("lang");
      else root.setAttribute("lang", previousLang);
    };
  }, [invoice, settings, lang]);

  const loading = invoiceQuery.isLoading || settingsQuery.isLoading;
  const error = invoiceQuery.error ?? settingsQuery.error;
  const ready = Boolean(invoice && settings);

  // DRAFT documents become ISSUED (read-only) the moment they are printed.
  const issueDocument = useCallback(async () => {
    if (!invoice || invoice.status !== "DRAFT") return;
    try {
      await api.post(`/invoices/${invoice.id}/issue`);
    } catch {
      // The print dialog must open even if the lock call fails.
    }
  }, [invoice]);

  useEffect(() => {
    const onBeforePrint = () => {
      void issueDocument();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [issueDocument]);

  const backTo = invoice ? `/invoices/${invoice.id}/edit` : "/invoices";
  const { closeBlocked, closeWindow, goBack } = usePrintPage({ ready, autoPrint, backTo });

  return (
    <div className="print-route" data-print-route="invoice">
      <style>{printCss}</style>
      {!autoPrint ? (
        <PrintNotice
          open={noticeOpen}
          paper="A4 · 210 × 297 mm"
          onClose={() => setNoticeOpen(false)}
          onPrint={startPrint}
        />
      ) : null}
      {closeBlocked ? (
        <div className="print-close-bar" role="alert">
          <span>{t("print.closeWindowHint")}</span>
          <button type="button" onClick={closeWindow} data-testid="print-close">
            <X className="h-4 w-4" />
            {t("print.closeWindow")}
          </button>
        </div>
      ) : null}
      <div className="print-page">
        {!autoPrint ? (
          <div className="print-toolbar">
            <div className="meta">
              <span className="title">
                {invoice ? `${t("invoices.title")} #${invoice.number}` : t("print.preparing")}
              </span>
              <span className="hint">A4 · 210 × 297 mm</span>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={goBack} data-testid="print-back">
                <ArrowLeft className="h-4 w-4" />
                {t("print.back")}
              </button>
              {invoice ? (
                <>
                  <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" className="secondary">
                    <FileDown className="h-4 w-4" />
                    {t("print.downloadPdf")}
                  </a>
                  <button
                    type="button"
                    className="primary"
                    data-testid="print-button"
                    onClick={requestPrint}
                  >
                    <Printer className="h-4 w-4" />
                    {t("print.printButton")}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    aria-label={t("print.noticeTitle")}
                    title={t("print.noticeTitle")}
                    onClick={() => setNoticeOpen(true)}
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="print-sheet-wrap flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
              <p className="text-sm font-semibold">{t("print.preparing")}</p>
            </div>
          </div>
        ) : error || !ready ? (
          <div className="print-sheet-wrap flex items-center justify-center bg-white">
            <div className="max-w-sm px-8 text-center">
              <p className="text-lg font-extrabold text-red-600">{t("print.notFound")}</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">{t("print.unauthorized")}</p>
            </div>
          </div>
        ) : (
          <div
            className="print-sheet-wrap"
            data-print-ready="true"
            data-page-size="210x297"
            style={{ "--print-safe-margin": `${safeMarginMm}mm` } as React.CSSProperties}
          >
            <InvoiceDocument invoice={invoice!} settings={settings!} lang={lang} digitsMode={digitsMode} />
          </div>
        )}
      </div>
    </div>
  );
}
