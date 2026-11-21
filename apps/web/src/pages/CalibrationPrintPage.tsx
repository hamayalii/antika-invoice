import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Printer } from "lucide-react";
import { useSettingsQuery } from "../lib/useSettings";
import { buildPrintCss, type PrintLayout } from "../lib/printLayout";
import { PrintNotice, hasSeenPrintNotice, markPrintNoticeSeen } from "../components/PrintNotice";

const calibrationCss = `
  .cal-sheet {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
    color: #0f172a;
    font-family: "Arkan", "Noto Naskh Arabic", Tahoma, sans-serif;
    direction: ltr;
  }
  .cal-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(30, 86, 160, 0.16) 0 0.15mm, transparent 0.15mm),
      linear-gradient(to bottom, rgba(30, 86, 160, 0.16) 0 0.15mm, transparent 0.15mm);
    background-size: 10mm 10mm;
  }
  .cal-edge {
    position: absolute;
    inset: 5mm;
    border: 0.35mm dashed #0f172a;
  }
  .cal-edge .tag {
    position: absolute;
    font-size: 2.6mm;
    font-weight: 800;
    background: #fff;
    padding: 0 1.2mm;
    white-space: nowrap;
  }
  .cal-edge .tag.top {
    top: -1.6mm;
    left: 50%;
    transform: translateX(-50%);
  }
  .cal-edge .tag.bottom {
    bottom: -1.6mm;
    left: 50%;
    transform: translateX(-50%);
  }
  .cal-edge .tag.side {
    top: 50%;
    transform: translateY(-50%);
    writing-mode: vertical-rl;
  }
  .cal-edge .tag.side.left {
    left: -1.6mm;
  }
  .cal-edge .tag.side.right {
    right: -1.6mm;
  }
  .cal-safe {
    position: absolute;
    inset: max(5mm, var(--print-safe-margin, 5mm));
    border: 0.3mm dashed #ff5a00;
    pointer-events: none;
  }
  .cal-safe .tag {
    position: absolute;
    top: 1mm;
    left: 1mm;
    font-size: 2.4mm;
    font-weight: 800;
    color: #ff5a00;
    background: #fff;
    padding: 0 1mm;
  }
  .cal-ruler-top {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 12mm;
    border-bottom: 0.2mm solid #0f172a;
    background-image:
      repeating-linear-gradient(90deg, #0f172a 0 0.12mm, transparent 0.12mm 1mm),
      repeating-linear-gradient(90deg, #0f172a 0 0.18mm, transparent 0.18mm 5mm),
      repeating-linear-gradient(90deg, #0f172a 0 0.22mm, transparent 0.22mm 10mm);
    background-size: 100% 2mm, 100% 4mm, 100% 7mm;
    background-position: bottom left;
    background-repeat: repeat-x;
  }
  .cal-ruler-top .num {
    position: absolute;
    top: 0.4mm;
    transform: translateX(-50%);
    font-size: 2.4mm;
    font-weight: 800;
    background: #fff;
    padding: 0 0.4mm;
  }
  .cal-ruler-top .unit {
    position: absolute;
    top: 0.4mm;
    right: 1.2mm;
    font-size: 2.4mm;
    font-weight: 900;
  }
  .cal-ruler-left {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 12mm;
    border-right: 0.2mm solid #0f172a;
    background-image:
      repeating-linear-gradient(180deg, #0f172a 0 0.12mm, transparent 0.12mm 1mm),
      repeating-linear-gradient(180deg, #0f172a 0 0.18mm, transparent 0.18mm 5mm),
      repeating-linear-gradient(180deg, #0f172a 0 0.22mm, transparent 0.22mm 10mm);
    background-size: 2mm 100%, 4mm 100%, 7mm 100%;
    background-position: top right;
    background-repeat: repeat-y;
  }
  .cal-ruler-left .num {
    position: absolute;
    left: 0.5mm;
    transform: translateY(-50%);
    font-size: 2.4mm;
    font-weight: 800;
    background: #fff;
    padding: 0 0.4mm;
  }
  .cal-info {
    position: absolute;
    inset: 35mm 30mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5mm;
    text-align: center;
  }
  .cal-info .size {
    font-size: 8mm;
    font-weight: 900;
    letter-spacing: 0.2mm;
  }
  .cal-info .mode {
    font-size: 4.2mm;
    font-weight: 800;
    color: #1e56a0;
  }
  .cal-info .checks {
    display: flex;
    flex-direction: column;
    gap: 2.2mm;
    font-size: 3.5mm;
    font-weight: 700;
    line-height: 1.55;
    color: #334155;
    max-width: 140mm;
  }
  .cal-info .checks b {
    color: #0f172a;
  }
  .cal-info .warn {
    border: 0.3mm solid #fed7aa;
    background: #fff7ed;
    color: #9a3412;
    border-radius: 2mm;
    padding: 2.5mm 4mm;
    font-size: 3.4mm;
    font-weight: 800;
  }
`;

type SizeKey = "a4" | "a5";

export function CalibrationPrintPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const sizeKey: SizeKey = params.get("size") === "a5" ? "a5" : "a4";
  const settingsQuery = useSettingsQuery();
  const safeMarginMm = settingsQuery.data?.settings.defaults.safeMarginMm ?? 5;

  const layout: PrintLayout = useMemo(
    () =>
      sizeKey === "a5"
        ? { sheetWidthMm: 210, sheetHeightMm: 148, pageWidthMm: 210, pageHeightMm: 148, safeMarginMm }
        : { sheetWidthMm: 210, sheetHeightMm: 297, pageWidthMm: 210, pageHeightMm: 297, safeMarginMm },
    [sizeKey, safeMarginMm],
  );
  const printCss = useMemo(() => buildPrintCss(layout), [layout]);

  const [noticeOpen, setNoticeOpen] = useState(false);
  const requestPrint = () => {
    if (hasSeenPrintNotice()) window.print();
    else setNoticeOpen(true);
  };
  const startPrint = () => {
    markPrintNoticeSeen();
    setNoticeOpen(false);
    window.print();
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t("help.calibrationTitle")} · ${sizeKey.toUpperCase()} | ${t("app.name")}`;
    return () => {
      document.title = previousTitle;
    };
  }, [sizeKey, t]);

  const horizontalLabels = Math.floor(layout.sheetWidthMm / 10);
  const verticalLabels = Math.floor(layout.sheetHeightMm / 20) + 1;
  const pageLabel = sizeKey === "a5" ? "A5 landscape · 210 × 148 mm" : "A4 portrait · 210 × 297 mm";

  return (
    <>
      <style>{printCss}</style>
      <style>{calibrationCss}</style>
      <PrintNotice
        open={noticeOpen}
        paper={sizeKey === "a5" ? "A5 landscape · 210 × 148 mm" : "A4 · 210 × 297 mm"}
        onClose={() => setNoticeOpen(false)}
        onPrint={startPrint}
      />
      <div className="print-page">
        <div className="print-toolbar">
          <div className="meta">
            <span className="title">{t("help.calibrationTitle")}</span>
            <span className="hint">{pageLabel}</span>
          </div>
          <div className="actions">
            <Link to="/help" className="secondary">
              <ArrowLeft className="h-4 w-4" />
              {t("help.back")}
            </Link>
            <button type="button" className="primary" data-testid="print-button" onClick={requestPrint}>
              <Printer className="h-4 w-4" />
              {t("print.printButton")}
            </button>
          </div>
        </div>

        <div
          className="print-sheet-wrap"
          data-print-ready="true"
          data-page-size={`${layout.pageWidthMm}x${layout.pageHeightMm}`}
          style={{ "--print-safe-margin": `${safeMarginMm}mm` } as React.CSSProperties}
        >
          <div className="cal-sheet">
            <div className="cal-grid" />
            <div className="cal-ruler-top">
              {Array.from({ length: horizontalLabels }, (_, index) => (
                <span key={index} className="num" style={{ left: `${index * 10}mm` }}>
                  {index * 10}
                </span>
              ))}
              <span className="unit">mm</span>
            </div>
            <div className="cal-ruler-left">
              {Array.from({ length: verticalLabels }, (_, index) => (
                <span key={index} className="num" style={{ top: `${index * 20}mm` }}>
                  {index * 20}
                </span>
              ))}
            </div>
            <div className="cal-edge">
              <span className="tag top">5 mm</span>
              <span className="tag bottom">5 mm</span>
              <span className="tag side left">5 mm</span>
              <span className="tag side right">5 mm</span>
            </div>
            {safeMarginMm > 5 ? (
              <div className="cal-safe">
                <span className="tag">{safeMarginMm} mm</span>
              </div>
            ) : null}
            <div className="cal-info">
              <span className="size">{sizeKey === "a5" ? "A5 · 210 × 148 mm" : "A4 · 210 × 297 mm"}</span>
              <span className="mode">100% · Actual size · Background graphics ON</span>
              <div className="checks">
                <span>
                  Grid lines must be <b>10 mm</b> apart (one small square = 1 cm).
                </span>
                <span>
                  The dashed rectangle must stay <b>5 mm</b> from every paper edge.
                </span>
                <span>Printed page must not be scaled, cropped or shifted.</span>
              </div>
              <span className="warn">If it fails: turn off “Fit to page”, set scale 100% / Actual size, reprint.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
