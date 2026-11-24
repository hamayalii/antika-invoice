import { useTranslation } from "react-i18next";
import type { Language } from "@antika/shared";
import "./document-layers.css";

export interface WatermarkProps {
  widthMm: number;
  opacity: number;
}

/**
 * The single shared watermark used by invoices, vouchers, PNG export and PDF.
 * Inline SVG only, so it renders with no network access.
 */
export function Watermark({ widthMm, opacity }: WatermarkProps) {
  return (
    <svg
      className="doc-watermark"
      data-doc-part="watermark"
      style={{ width: `${widthMm}mm`, height: `${widthMm * 0.64}mm`, opacity }}
      viewBox="0 0 1000 640"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(320 55) scale(2.3377)">
        <rect
          width="154"
          height="87"
          fill="none"
          stroke="#8d97a3"
          strokeWidth="4.9"
        />
        <polygon points="25,13 106,13 25,60" fill="#8d97a3" />
        <polygon points="130,16 83,42.5 130,69" fill="#8d97a3" />
        <polygon points="69,49 28,72.5 107,72.5" fill="#8d97a3" />
      </g>
      <text
        x="500"
        y="430"
        textAnchor="middle"
        fontFamily="Arkan, Inter, Tahoma, sans-serif"
        fontSize="150"
        fontWeight="700"
        letterSpacing="8"
      >
        <tspan fill="#ff5a00">A</tspan>
        <tspan fill="#b6bcc5">NTIKA</tspan>
      </text>
      <text
        x="506"
        y="516"
        textAnchor="middle"
        fill="#ff5a00"
        fontFamily="Arkan, Inter, Tahoma, sans-serif"
        fontSize="44"
        fontWeight="700"
        letterSpacing="26"
      >
        FACTORY
      </text>
    </svg>
  );
}

export interface GuillocheProps {
  id: string;
  opacity: number;
}

/** Fine-line security background generated locally as SVG. */
export function Guilloche({ id, opacity }: GuillocheProps) {
  return (
    <svg className="doc-guilloche" data-doc-part="guilloche" style={{ opacity }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M0 14 Q7 1 14 14 T28 14"
            fill="none"
            stroke="#1e56a0"
            strokeWidth="0.35"
          />
          <path
            d="M0 0 Q7 13 14 0 T28 0"
            fill="none"
            stroke="#ff5a00"
            strokeWidth="0.25"
          />
          <path
            d="M-7 21 Q0 34 7 21 T21 21"
            fill="none"
            stroke="#1e56a0"
            strokeWidth="0.2"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function Microtext({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`doc-microtext${className ? ` ${className}` : ""}`} data-doc-part="microtext" aria-hidden="true">
      {text}
    </div>
  );
}

export interface VerificationStripProps {
  code: string;
  qrEnabled: boolean;
  qrSide: "left" | "right";
  variant: "a4" | "a5";
  lang: Language;
}

/** QR code + tiny verify code, placed in the free space above the footer. */
export function VerificationStrip({ code, qrEnabled, qrSide, variant, lang }: VerificationStripProps) {
  const { t } = useTranslation();
  const scanText = String(t("documents.scanToVerify", { lng: lang }));
  const verifyText = String(t("documents.verify", { lng: lang }));

  const qr = qrEnabled ? (
    <img
      className="doc-auth-qr"
      src={`/api/qr/${encodeURIComponent(code)}`}
      alt=""
      aria-hidden="true"
    />
  ) : null;

  const text = (
    <div className="doc-auth-text">
      <span className="doc-auth-verify">
        {verifyText}: <b dir="ltr">{code}</b>
      </span>
      {qrEnabled ? <span className="doc-auth-caption">{scanText}</span> : null}
    </div>
  );

  return (
    <section className={`doc-auth doc-auth--${variant} doc-auth--qr-${qrSide}`} data-doc-part="qr" dir="ltr">
      {qrSide === "left" ? (
        <>
          {qr}
          {text}
        </>
      ) : (
        <>
          {text}
          {qr}
        </>
      )}
    </section>
  );
}

export interface CancelledStampProps {
  reason?: string;
}

/**
 * Bilingual stamp mandated by the specification: the wording is identical on
 * every document language so a cancelled paper always reads the same.
 */
export function CancelledStamp({ reason }: CancelledStampProps) {
  return (
    <div className="doc-cancelled" aria-hidden="true">
      <div className="doc-cancelled-stamp">
        <span className="doc-cancelled-main" dir="ltr">
          CANCELLED / <span className="doc-cancelled-ku">هەڵوەشێنراوە</span>
        </span>
        {reason ? <span className="doc-cancelled-reason">{reason}</span> : null}
      </div>
    </div>
  );
}
