import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";

export function PrintNotice({
  open,
  paper,
  twoUp = false,
  onClose,
  onPrint,
}: {
  open: boolean;
  paper: string;
  twoUp?: boolean;
  onClose: () => void;
  onPrint: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="print-notice-backdrop" role="dialog" aria-modal="true" aria-label={t("print.noticeTitle")}>
      <div className="print-notice">
        <h2>{t("print.noticeTitle")}</h2>
        <p className="lead">{t("print.noticeIntro")}</p>
        <ul>
          <li>
            <span>{t("print.noticePaper")}</span>
            <b>{paper}</b>
          </li>
          {twoUp ? (
            <li>
              <span>{t("print.noticeImposition")}</span>
              <b>2 × A5</b>
            </li>
          ) : null}
          <li>
            <span>{t("print.noticeScale")}</span>
            <b>100%</b>
          </li>
          <li>
            <span>{t("print.noticeMargins")}</span>
            <b>None</b>
          </li>
          <li>
            <span>{t("print.noticeBackground")}</span>
            <b>ON</b>
          </li>
          <li>
            <span>{t("print.noticeHeaders")}</span>
            <b>OFF</b>
          </li>
        </ul>
        <p className="warn">{t("print.noticeDoNotFit")}</p>
        <div className="notice-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t("print.noticeCancel")}
          </button>
          <button type="button" className="primary" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            {t("print.noticePrintNow")}
          </button>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "antika.printNotice.v1";

export function hasSeenPrintNotice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPrintNoticeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage can be blocked; the notice will simply show again.
  }
}
