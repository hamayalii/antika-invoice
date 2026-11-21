import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanLine, Search, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { formatMoney } from "@antika/shared";
import { api, ApiError } from "../lib/api";

interface PublicVerification {
  type: "invoice" | "voucher";
  number: number;
  date: string;
  customer: string;
  total: number;
  status: "VALID" | "CANCELLED";
  integrity: "OK" | "MODIFIED";
  companyName: string;
}

type VerifyLang = "ku" | "ar" | "en";

const COPY: Record<VerifyLang, Record<string, string>> = {
  ku: {
    service: "پشکنینی ڕەسەنایەتی بەڵگەنامە",
    title: "پشکنینی بەڵگەنامە",
    codeLabel: "کۆدی پشکنین",
    lookup: "پشکنین",
    valid: "ئەم بەڵگەنامەیە ڕەسەنە",
    cancelled: "ئەم بەڵگەنامەیە هەڵوەشێنراوە",
    notFound: "بەڵگەنامە نەدۆزرایەوە",
    notFoundHint: "کۆدەکە هەڵەیە یان بەڵگەنامەکە سڕاوەتەوە. کۆدەکە بە وردی بنووسە و دووبارە هەوڵ بدەرەوە.",
    tooMany: "هەوڵی زۆر دراوە. تکایە دواتر هەوڵ بدەرەوە.",
    error: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.",
    type: "جۆر",
    invoice: "وەسڵ",
    voucher: "سەند",
    number: "ژمارە",
    date: "بەروار",
    customer: "کڕیار",
    total: "کۆی گشتی",
    status: "دۆخ",
    integrity: "ڕەسەنایەتی",
    company: "کۆمپانیا",
    modified: "دەستکاریکراو",
    modifiedHint: "داتاکانی تۆمارەکە لەگەڵ بەڵگەنامە دەرچووەکە ناگونجێت. وەک نادروست مامەڵەی لەگەڵ بکە.",
    footer:
      "ئەم پەیجە تەنها پوختەیەکی سنووردار نیشان دەدات؛ ناونیشان، ژمارەی مۆبایل و بابەتەکان هەرگیز نیشان نادرێن.",
    verifying: "پشکنین دەکرێت…",
    scanHint: "کۆدی QR ی سەر بەڵگەنامەکە بسکان بکە بۆ ئەنجامی خێرا.",
  },
  ar: {
    service: "التحقق من أصالة المستند",
    title: "التحقق من المستند",
    codeLabel: "رمز التحقق",
    lookup: "تحقق",
    valid: "هذا المستند أصلي",
    cancelled: "تم إلغاء هذا المستند",
    notFound: "المستند غير موجود",
    notFoundHint: "الرمز غير صحيح أو تم حذف المستند. تحقق من الرمز وحاول مرة أخرى.",
    tooMany: "محاولات كثيرة. يرجى المحاولة لاحقاً.",
    error: "حدث خطأ. يرجى المحاولة مرة أخرى.",
    type: "النوع",
    invoice: "فاتورة",
    voucher: "سند قبض",
    number: "الرقم",
    date: "التاريخ",
    customer: "العميل",
    total: "الإجمالي",
    status: "الحالة",
    integrity: "السلامة",
    company: "الشركة",
    modified: "معدّل",
    modifiedHint: "بيانات المستند لا تطابق النسخة الصادرة. اعتبره غير صالح.",
    footer:
      "تعرض هذه الصفحة ملخصاً محدوداً فقط؛ لا يتم إظهار العنوان أو الهاتف أو بنود الفاتورة.",
    verifying: "جارٍ التحقق…",
    scanHint: "امسح رمز QR المطبوع على المستند للحصول على نتيجة فورية.",
  },
  en: {
    service: "Document authenticity check",
    title: "Verify document",
    codeLabel: "Verify code",
    lookup: "Verify",
    valid: "This document is authentic",
    cancelled: "This document has been cancelled",
    notFound: "Document not found",
    notFoundHint: "The code is incorrect or the document was deleted. Check the code and try again.",
    tooMany: "Too many attempts. Please try again later.",
    error: "Something went wrong. Please try again.",
    type: "Type",
    invoice: "Invoice",
    voucher: "Voucher",
    number: "Number",
    date: "Date",
    customer: "Customer",
    total: "Total",
    status: "Status",
    integrity: "Integrity",
    company: "Company",
    modified: "MODIFIED",
    modifiedHint: "The stored data does not match the issued document. Treat it as invalid.",
    footer:
      "This page shows a limited summary only; address, phone and line items are never revealed.",
    verifying: "Verifying…",
    scanHint: "Scan the QR code printed on the document for an instant result.",
  },
};

export function VerifyPage() {
  const { code: rawCode } = useParams();
  const navigate = useNavigate();
  const code = (rawCode ?? "").trim().toUpperCase();
  const [lang, setLang] = useState<VerifyLang>("ku");
  const [lookup, setLookup] = useState("");
  const copy = COPY[lang];
  const rtl = lang !== "en";

  useEffect(() => {
    document.title = `${copy.title} | ANTIKA FACTORY`;
    const root = document.documentElement;
    const prevDir = root.getAttribute("dir");
    const prevLang = root.getAttribute("lang");
    root.setAttribute("dir", rtl ? "rtl" : "ltr");
    root.setAttribute("lang", lang);
    return () => {
      if (prevDir) root.setAttribute("dir", prevDir);
      if (prevLang) root.setAttribute("lang", prevLang);
    };
  }, [copy.title, lang, rtl]);

  const query = useQuery({
    queryKey: ["verify", code],
    queryFn: () => api.get<{ verification: PublicVerification }>(`/verify/${encodeURIComponent(code)}`),
    enabled: code.length > 0,
    retry: false,
    staleTime: 0,
  });

  const notFound = !code || (query.error instanceof ApiError && query.error.status === 404);
  const tooMany = query.error instanceof ApiError && query.error.status === 429;
  const failed = Boolean(query.error) && !notFound && !tooMany;
  const verification = query.data?.verification;

  const submitLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const next = lookup.trim().toUpperCase();
    if (next) navigate(`/verify/${encodeURIComponent(next)}`);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6] px-4 py-8 sm:py-12" dir={rtl ? "rtl" : "ltr"} lang={lang}>
      <div className="mx-auto w-full max-w-md">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.svg" alt="Antika Factory" className="w-16" />
            <div>
              <p className="text-sm font-extrabold text-slate-800">ANTIKA FACTORY</p>
              <p className="text-[11px] font-semibold text-slate-400">{copy.service}</p>
            </div>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(
              [
                ["ku", "کوردی"],
                ["ar", "العربية"],
                ["en", "English"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                className={
                  lang === value
                    ? "rounded-lg bg-brand-orange px-2.5 py-1.5 text-[11px] font-extrabold text-white"
                    : "rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-slate-500 hover:text-slate-800"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          {query.isLoading && code ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
              <p className="text-sm font-semibold">{copy.verifying}</p>
            </div>
          ) : verification ? (
            <>
              <div
                className={
                  verification.status === "VALID"
                    ? "flex items-center gap-3 bg-emerald-600 px-5 py-4 text-white"
                    : "flex items-center gap-3 bg-red-600 px-5 py-4 text-white"
                }
              >
                {verification.status === "VALID" ? (
                  <ShieldCheck className="h-8 w-8 shrink-0" />
                ) : (
                  <ShieldX className="h-8 w-8 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-lg font-extrabold leading-tight">
                    {verification.status === "VALID" ? "VALID" : "CANCELLED"}
                  </p>
                  <p className="text-xs font-semibold text-white/85">
                    {verification.status === "VALID" ? copy.valid : copy.cancelled}
                  </p>
                </div>
                <span className="ms-auto shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-extrabold">
                  {verification.integrity === "OK" ? "OK" : "MODIFIED"}
                </span>
              </div>

              <dl className="divide-y divide-slate-100 px-5">
                <Row label={copy.type}>
                  {verification.type === "invoice" ? copy.invoice : copy.voucher}
                </Row>
                <Row label={copy.number} latin>
                  #{verification.number}
                </Row>
                <Row label={copy.date} latin>
                  {verification.date}
                </Row>
                <Row label={copy.customer}>{verification.customer}</Row>
                <Row label={copy.total} latin>
                  {formatMoney(verification.total, "latin")} IQD
                </Row>
                <Row label={copy.integrity}>
                  <span
                    className={
                      verification.integrity === "OK"
                        ? "font-extrabold text-emerald-600"
                        : "font-extrabold text-red-600"
                    }
                  >
                    {verification.integrity}
                  </span>
                </Row>
                <Row label={copy.company}>{verification.companyName}</Row>
              </dl>

              {verification.integrity === "MODIFIED" ? (
                <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <b className="font-extrabold">{copy.modified}</b> — {copy.modifiedHint}
                  </span>
                </div>
              ) : null}
            </>
          ) : notFound ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-lg font-extrabold text-slate-900">{copy.notFound}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">
                {copy.notFoundHint}
              </p>
            </div>
          ) : tooMany ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-slate-700">{copy.tooMany}</p>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-slate-700">{copy.error}</p>
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
            <form onSubmit={submitLookup} className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input ps-9"
                  dir="ltr"
                  value={lookup}
                  placeholder="XXXX-XXXX-XXXX"
                  aria-label={copy.codeLabel}
                  onChange={(event) => setLookup(event.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary shrink-0 !px-4 !py-2.5 text-xs" disabled={!lookup.trim()}>
                {copy.lookup}
              </button>
            </form>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">{copy.scanHint}</p>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-md px-2 text-center text-[11px] font-semibold leading-5 text-slate-400">
          {copy.footer}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  latin,
}: {
  label: string;
  children: React.ReactNode;
  latin?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="shrink-0 text-xs font-extrabold text-slate-400">{label}</dt>
      <dd
        className="min-w-0 truncate text-end text-sm font-bold text-slate-800"
        dir={latin ? "ltr" : undefined}
      >
        {children}
      </dd>
    </div>
  );
}
