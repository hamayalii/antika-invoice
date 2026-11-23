import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleHelp, Copy, FileDown, Loader2, Printer, X } from "lucide-react";
import { amountInWords, type DigitsMode, type Language, type VoucherDto, type VoucherPage } from "@antika/shared";
import { api } from "../lib/api";
import { useSettingsQuery } from "../lib/useSettings";
import { buildPrintCss, type PrintLayout } from "../lib/printLayout";
import { usePrintPage, waitForPrintReady } from "../lib/usePrintPage";
import { PrintNotice, hasSeenPrintNotice, markPrintNoticeSeen } from "../components/PrintNotice";
import { VoucherDocument } from "../features/vouchers/VoucherDocument";
import "../features/vouchers/voucher-document.css";

function resolveLayout(voucherPage: VoucherPage, twoUp: boolean, safeMarginMm: number): PrintLayout {
  if (twoUp) {
    // Two A5 sheets (210 × 148 mm each) stacked on one A4 portrait sheet.
    return {
      sheetWidthMm: 210,
      sheetHeightMm: 148,
      pageWidthMm: 210,
      pageHeightMm: 297,
      safeMarginMm,
      twoUp: true,
    };
  }
  if (voucherPage === "A4_landscape") {
    return {
      sheetWidthMm: 297,
      sheetHeightMm: 210,
      pageWidthMm: 297,
      pageHeightMm: 210,
      safeMarginMm,
    };
  }
  return {
    sheetWidthMm: 210,
    sheetHeightMm: 148,
    pageWidthMm: 210,
    pageHeightMm: 148,
    safeMarginMm,
  };
}

export function VoucherPrintPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const voucherId = Number(id);
  const autoPrint = params.get("autoprint") === "1";

  const voucherQuery = useQuery({
    queryKey: ["voucher", voucherId],
    queryFn: () => api.get<{ voucher: VoucherDto }>(`/vouchers/${voucherId}`),
    enabled: Number.isInteger(voucherId) && voucherId > 0,
    retry: false,
  });

  const settingsQuery = useSettingsQuery();
  const voucher = voucherQuery.data?.voucher;
  const settings = settingsQuery.data?.settings;

  const langOverride = params.get("lang");
  const lang: Language =
    langOverride === "ar" || langOverride === "ku" ? langOverride : (voucher?.lang ?? "ar");
  const digitsMode: DigitsMode = voucher?.digitsMode ?? settings?.defaults.voucherDigits ?? "latin";
  // The amount in words follows the language being printed. A language override
  // therefore regenerates it instead of showing text in the other language.
  const displayVoucher =
    voucher && lang !== voucher.lang
      ? { ...voucher, amountWords: amountInWords(voucher.amount, lang) }
      : voucher;

  const voucherPage = settings?.defaults.voucherPage ?? "A5_landscape";
  const safeMarginMm = settings?.defaults.safeMarginMm ?? 5;
  const twoUp = params.get("imposition") === "2up" && voucherPage === "A5_landscape";
  const layout = useMemo(
    () => resolveLayout(voucherPage, twoUp, safeMarginMm),
    [voucherPage, twoUp, safeMarginMm],
  );
  const printCss = useMemo(() => buildPrintCss(layout), [layout]);

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
    document.title = voucher
      ? `${t("vouchers.title")} #${voucher.number} | ${t("app.name")}`
      : `${t("print.preparing")} | ${t("app.name")}`;
    return () => {
      document.title = previousTitle;
    };
  }, [voucher, t]);

  useEffect(() => {
    if (!voucher || !settings) return;
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
  }, [voucher, settings, lang]);

  const loading = voucherQuery.isLoading || settingsQuery.isLoading;
  const error = voucherQuery.error ?? settingsQuery.error;
  const ready = Boolean(voucher && settings);

  // DRAFT vouchers become ISSUED (read-only) the moment they are printed.
  const issueDocument = useCallback(async () => {
    if (!voucher || voucher.status !== "DRAFT") return;
    try {
      await api.post(`/vouchers/${voucher.id}/issue`);
    } catch {
      // The print dialog must open even if the lock call fails.
    }
  }, [voucher]);

  useEffect(() => {
    const onBeforePrint = () => {
      void issueDocument();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [issueDocument]);

  const backTo = voucher ? `/vouchers/${voucher.id}/edit` : "/vouchers";
  const { closeBlocked, closeWindow, goBack } = usePrintPage({ ready, autoPrint, backTo });

  const querySuffix = `${langOverride ? `&lang=${lang}` : ""}${autoPrint ? "&autoprint=1" : ""}`;
  const hintText = twoUp
    ? "A4 · 2 × A5 · 210 × 297 mm"
    : voucherPage === "A4_landscape"
      ? "A4 landscape · 297 × 210 mm"
      : "A5 landscape · 210 × 148 mm";
  const paperLabel = twoUp
    ? "A4 · 210 × 297 mm"
    : voucherPage === "A4_landscape"
      ? "A4 landscape · 297 × 210 mm"
      : "A5 landscape · 210 × 148 mm";
  const safeStyle = { "--print-safe-margin": `${safeMarginMm}mm` } as React.CSSProperties;

  const sheet = (
    <div
      className="print-sheet-wrap"
      data-print-ready="true"
      data-page-size={`${layout.pageWidthMm}x${layout.pageHeightMm}`}
      style={safeStyle}
    >
      <VoucherDocument voucher={displayVoucher!} settings={settings!} lang={lang} digitsMode={digitsMode} />
    </div>
  );

  return (
    <div className="print-route" data-print-route="voucher">
      <style>{printCss}</style>
      {!autoPrint ? (
        <PrintNotice
          open={noticeOpen}
          paper={paperLabel}
          twoUp={twoUp}
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
                {voucher ? `${t("vouchers.title")} #${voucher.number}` : t("print.preparing")}
              </span>
              <span className="hint">{hintText}</span>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={goBack} data-testid="print-back">
                <ArrowLeft className="h-4 w-4" />
                {t("print.back")}
              </button>
              {voucher ? (
                <>
                  {voucherPage === "A5_landscape" ? (
                    <a
                      href={`/print/voucher/${voucher.id}?${twoUp ? "" : "imposition=2up"}${querySuffix}`}
                      className="secondary"
                    >
                      <Copy className="h-4 w-4" />
                      {twoUp ? t("print.singleUp") : t("print.twoUp")}
                    </a>
                  ) : null}
                  <a
                    href={`/api/vouchers/${voucher.id}/pdf${twoUp ? "?imposition=2up" : ""}`}
                    target="_blank"
                    rel="noopener"
                    className="secondary"
                  >
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
        ) : twoUp ? (
          <div
            className="print-two-up"
            data-print-ready="true"
            data-page-size="210x297"
            style={safeStyle}
          >
            <div className="print-sheet-wrap">
              <VoucherDocument voucher={displayVoucher!} settings={settings!} lang={lang} digitsMode={digitsMode} />
            </div>
            <div className="print-cutline" aria-hidden="true" />
            <div className="print-sheet-wrap" aria-hidden="true">
              <VoucherDocument voucher={displayVoucher!} settings={settings!} lang={lang} digitsMode={digitsMode} />
            </div>
          </div>
        ) : (
          sheet
        )}
      </div>
    </div>
  );
}
