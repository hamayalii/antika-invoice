import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useWatch, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import type { AppSettings, DigitsMode, Language, SecuritySettings } from "@antika/shared";
import { ScaledSheet } from "../../components/ScaledSheet";
import { sampleInvoice, sampleVoucher } from "./previewData";
import { useHighlightedPart, type DocPart } from "./highlight";
import type { SettingsFormValues } from "./types";
import "./preview.css";

/**
 * The two printed documents are only needed on this route, so they are loaded
 * on demand (their CSS is pulled in with them).
 */
const LazyInvoiceDocument = lazy(async () => {
  const module = await import("../invoices/InvoiceDocument");
  return { default: module.InvoiceDocument };
});

const LazyVoucherDocument = lazy(async () => {
  const module = await import("../vouchers/VoucherDocument");
  return { default: module.VoucherDocument };
});

type DocKind = "invoice" | "voucher";
type DocChoice = DocKind | "both";

const DOC_STORAGE_KEY = "antika.settings.preview.document";

const PAPER: Record<DocKind, { widthMm: number; heightMm: number }> = {
  invoice: { widthMm: 210, heightMm: 297 },
  voucher: { widthMm: 210, heightMm: 148 },
};

/**
 * Where each protected layer sits inside the sheet, in mm (measured from the
 * real documents). Used to draw the dashed placeholder when the layer is off.
 */
const PART_REGION: Record<DocKind, Record<DocPart, { x: number; y: number; w: number; h: number }>> = {
  invoice: {
    watermark: { x: 35, y: 103.7, w: 140, h: 89.6 },
    guilloche: { x: 0, y: 0, w: 210, h: 297 },
    microtext: { x: 10, y: 270.9, w: 190, h: 2.1 },
    qr: { x: 10, y: 252.2, w: 17.5, h: 17.5 },
  },
  voucher: {
    watermark: { x: 30, y: 26, w: 150, h: 96 },
    guilloche: { x: 0, y: 0, w: 210, h: 148 },
    microtext: { x: 6, y: 31.2, w: 198, h: 1.7 },
    qr: { x: 157.5, y: 105.2, w: 14, h: 14 },
  },
};

function readStoredDoc(): DocChoice {
  try {
    const stored = window.localStorage.getItem(DOC_STORAGE_KEY);
    if (stored === "invoice" || stored === "voucher" || stored === "both") return stored;
  } catch {
    // Private mode / storage disabled — fall through to the default.
  }
  return "invoice";
}

/**
 * The microtext band is only ~2 mm tall, which is too thin to read as a box.
 * Give short regions some breathing room so the dashed placeholder is visible.
 */
function ghostRect(rect: { x: number; y: number; w: number; h: number }) {
  const pad = Math.max(0, (6 - rect.h) / 2);
  return { x: rect.x, y: rect.y - pad, w: rect.w, h: rect.h + pad * 2 };
}

function partEnabled(part: DocPart, security: SecuritySettings): boolean {
  if (part === "watermark") return Boolean(security.watermarkEnabled);
  if (part === "guilloche") return Boolean(security.guillocheEnabled);
  if (part === "microtext") return Boolean(security.microtextEnabled);
  return Boolean(security.qrEnabled);
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function Segmented<T extends string>({
  label,
  testid,
  value,
  options,
  onChange,
}: {
  label: string;
  testid: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
      <div
        className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`${testid}-${option.value}`}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors ${
                active ? "bg-brand-orange text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface OverviewSheetProps {
  kind: DocKind;
  settings: AppSettings;
  lang: Language;
  digits: DigitsMode;
  safeMarginMm: number;
  highlight: DocPart | null;
}

/**
 * One live overview of the real document with all four protected layers on.
 * Pointing at a security control outlines the matching layer in place.
 */
function OverviewSheet({
  kind,
  settings,
  lang,
  digits,
  safeMarginMm,
  highlight,
}: OverviewSheetProps) {
  const { t } = useTranslation();
  const invoice = useMemo(() => sampleInvoice(lang), [lang]);
  const voucher = useMemo(() => sampleVoucher(lang), [lang]);
  const size = PAPER[kind];
  const active = highlight ? partEnabled(highlight, settings.security) : true;
  const ghost = highlight && !active ? ghostRect(PART_REGION[kind][highlight]) : null;

  return (
    <div
      className="preview-overview"
      data-testid={`preview-overview-${kind}`}
      data-doc-kind={kind}
      data-highlight={highlight ?? ""}
      data-highlight-active={active ? "true" : "false"}
      style={{ "--print-safe-margin": `${safeMarginMm}mm` } as CSSProperties}
    >
      <ScaledSheet widthMm={size.widthMm} heightMm={size.heightMm}>
        <div className="preview-overview-sheet">
          <Suspense
            fallback={
              <div
                className="preview-overview-loading"
                style={{ width: `${size.widthMm}mm`, height: `${size.heightMm}mm` }}
              >
                {t("settings.preview.loading")}
              </div>
            }
          >
            {kind === "invoice" ? (
              <LazyInvoiceDocument
                invoice={invoice}
                settings={settings}
                lang={lang}
                digitsMode={digits}
              />
            ) : (
              <LazyVoucherDocument
                voucher={voucher}
                settings={settings}
                lang={lang}
                digitsMode={digits}
              />
            )}
          </Suspense>
        </div>

        {ghost ? (
          <span
            className="doc-ghost"
            data-part={highlight}
            data-testid={`preview-ghost-${kind}`}
            aria-hidden="true"
            style={{
              left: `${ghost.x}mm`,
              top: `${ghost.y}mm`,
              width: `${ghost.w}mm`,
              height: `${ghost.h}mm`,
            }}
          />
        ) : null}
      </ScaledSheet>
    </div>
  );
}

export interface SecurityPreviewProps {
  control: Control<SettingsFormValues>;
  saved: AppSettings;
}

export function SecurityPreview({ control, saved }: SecurityPreviewProps) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<DocChoice>(readStoredDoc);
  const [lang, setLang] = useState<Language>("ku");
  const [digits, setDigits] = useState<DigitsMode>(() => saved.defaults.invoiceDigits);

  const watchedSecurity = useWatch({ control, name: "security" });
  const watchedMargin = useWatch({ control, name: "defaults.safeMarginMm" });

  const security: SecuritySettings = {
    watermarkEnabled: watchedSecurity?.watermarkEnabled ?? saved.security.watermarkEnabled,
    watermarkOpacity: watchedSecurity?.watermarkOpacity ?? saved.security.watermarkOpacity,
    watermarkScale: watchedSecurity?.watermarkScale ?? saved.security.watermarkScale,
    guillocheEnabled: watchedSecurity?.guillocheEnabled ?? saved.security.guillocheEnabled,
    microtextEnabled: watchedSecurity?.microtextEnabled ?? saved.security.microtextEnabled,
    qrEnabled: watchedSecurity?.qrEnabled ?? saved.security.qrEnabled,
  };

  const marginNumber = Number(watchedMargin);
  const safeMarginMm = Number.isFinite(marginNumber)
    ? marginNumber
    : saved.defaults.safeMarginMm;

  const highlight = useHighlightedPart();
  const docs: DocKind[] = doc === "both" ? ["invoice", "voucher"] : [doc];
  const previewSettings = useMemo<AppSettings>(
    () => ({ ...saved, security }),
    [saved, security],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(DOC_STORAGE_KEY, doc);
    } catch {
      // Ignore unavailable storage.
    }
  }, [doc]);

  return (
    <section className="card p-3 sm:p-5" data-testid="settings-preview">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
            <Eye className="h-4 w-4" />
            {t("settings.preview.title")}
          </span>
          <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-400">
            {t("settings.preview.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented<DocChoice>
            label={t("settings.preview.documents")}
            testid="preview-doc"
            value={doc}
            onChange={setDoc}
            options={[
              { value: "invoice", label: t("settings.preview.invoice") },
              { value: "voucher", label: t("settings.preview.voucher") },
              { value: "both", label: t("settings.preview.both") },
            ]}
          />
          <Segmented<Language>
            label={t("settings.preview.language")}
            testid="preview-lang"
            value={lang}
            onChange={setLang}
            options={[
              { value: "ku", label: t("settings.preview.kurdish") },
              { value: "ar", label: t("settings.preview.arabic") },
            ]}
          />
          <Segmented<DigitsMode>
            label={t("settings.preview.digits")}
            testid="preview-digits"
            value={digits}
            onChange={setDigits}
            options={[
              { value: "eastern", label: "٠١٢٣" },
              { value: "latin", label: "0123" },
            ]}
          />
        </div>
      </div>

      {highlight ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="preview-bubble" data-testid="preview-highlight-label" role="status">
            {t(`settings.preview.parts.${highlight}`)}
            <span
              className={partEnabled(highlight, security) ? "on" : "off"}
              data-testid="preview-highlight-state"
            >
              {partEnabled(highlight, security)
                ? t("settings.preview.active")
                : t("settings.preview.inactive")}
            </span>
          </span>
        </div>
      ) : null}

      <div className="space-y-4">
        {docs.map((kind) => (
          <div key={kind}>
            {doc === "both" ? (
              <h3 className="mb-2 text-xs font-extrabold text-slate-500">
                {kind === "invoice"
                  ? t("settings.preview.invoice")
                  : t("settings.preview.voucher")}
              </h3>
            ) : null}
            <OverviewSheet
              kind={kind}
              settings={previewSettings}
              lang={lang}
              digits={digits}
              safeMarginMm={safeMarginMm}
              highlight={highlight}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
