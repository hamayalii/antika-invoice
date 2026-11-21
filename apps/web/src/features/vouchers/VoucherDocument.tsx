import { useTranslation } from "react-i18next";
import {
  formatDocumentDate,
  formatMoney,
  toDigits,
  type AppSettings,
  type DigitsMode,
  type Language,
  type VoucherDto,
} from "@antika/shared";
import { MapPin, Phone } from "lucide-react";
import {
  CancelledStamp,
  Guilloche,
  Microtext,
  VerificationStrip,
  Watermark,
} from "../../components/DocumentLayers";
import "./voucher-document.css";

export interface VoucherDocumentProps {
  voucher: VoucherDto;
  settings: AppSettings;
  lang: Language;
  digitsMode: DigitsMode;
}

export function VoucherDocument({ voucher, settings, lang, digitsMode }: VoucherDocumentProps) {
  const { t } = useTranslation();
  const tr = (key: string): string => String(t(`documents.voucher.${key}`, { lng: lang }));

  const digits = digitsMode;
  const dateText = formatDocumentDate(voucher.date, "slash", digits);
  const numberText = toDigits(voucher.number, digits);
  const amountText = formatMoney(voucher.amount, digits);
  const logo = settings.assets.logo || "/assets/logo.svg";
  const security = settings.security;
  const watermarkOn = voucher.watermarkEnabled ?? security.watermarkEnabled;
  const microtext = `${"ANTIKA FACTORY • ".repeat(6)}${voucher.verifyCode} • ${"ANTIKA FACTORY • ".repeat(14)}`;
  const addressLines = (lang === "ar" ? settings.company.addressAr : settings.company.addressKu) ?? [];
  const phones = settings.company.phones ?? [];

  const methods: Array<{ key: VoucherDto["paymentMethod"]; label: string }> = [
    { key: "cash", label: tr("cash") },
    { key: "bank_transfer", label: tr("bankTransfer") },
    { key: "cheque", label: tr("cheque") },
  ];

  return (
    <div className="voucher-sheet" dir="rtl" lang={lang}>
      {security.guillocheEnabled ? <Guilloche id="guilloche-voucher" opacity={0.05} /> : null}
      {watermarkOn ? (
        <Watermark widthMm={150 * security.watermarkScale} opacity={security.watermarkOpacity} />
      ) : null}
      {voucher.status === "CANCELLED" ? (
        <CancelledStamp reason={voucher.cancelReason || undefined} />
      ) : null}

      <header className="vch-header">
        <div className="vch-brand">
          <img className="vch-logo" src={logo} alt="Antikeh Factory" />
          <div className="vch-wordmark">
            <div className="name">
              <span className="a">A</span>NTIKEH
            </div>
            <div className="factory">FACTORY</div>
          </div>
        </div>

        <div className="vch-title">
          <span className="main">{tr("title")}</span>
          <span className="rule" />
        </div>

        <div className="vch-meta">
          <div className="meta-row">
            <span className="label">{tr("voucherNo")}</span>
            <span className="value number" dir="ltr">
              {numberText}
            </span>
          </div>
          <div className="meta-row">
            <span className="label">{tr("date")}</span>
            <span className="value" dir="ltr">
              {dateText}
            </span>
          </div>
        </div>
      </header>
      {security.microtextEnabled ? (
        <Microtext text={microtext} className="vch-microtext vch-microtext-top" />
      ) : null}

      <div className="vch-topline">
        <div className="vch-field grow">
          <span className="label">{tr("receivedFrom")}</span>
          <span className="value">{voucher.receivedFrom || "\u00A0"}</span>
        </div>
        <div className="vch-field amount">
          <span className="label">{tr("amount")}</span>
          <span className="value amount-value" dir="ltr">
            {amountText}
          </span>
        </div>
      </div>

      <div className="vch-words">
        <span className="label">{tr("amountWords")}</span>
        <span className="value">{voucher.amountWords || "\u00A0"}</span>
      </div>

      <div className="vch-mid">
        <div className="vch-payfor">
          <span className="label">{tr("paymentFor")}</span>
          <span className="value">{voucher.paymentFor || "\u00A0"}</span>
        </div>
        <div className="vch-method">
          <span className="label">{tr("paymentMethod")}</span>
          <div className="methods">
            {methods.map((method) => {
              const checked = voucher.paymentMethod === method.key;
              return (
                <span key={method.key} className="method">
                  <span className={`box${checked ? " checked" : ""}`} aria-hidden="true">
                    {checked ? (
                      <svg className="box-check" viewBox="0 0 10 10">
                        <path
                          d="M2 5.2 4.2 7.4 8 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="text">{method.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="vch-signatures">
        {[
          { label: tr("preparedBy"), name: voucher.preparedBy },
          { label: tr("receivedBy"), name: voucher.receivedByName },
          { label: tr("approvedBy"), name: voucher.approvedBy },
        ].map((item) => (
          <div key={item.label} className="vch-sign">
            <span className="role">{item.label}</span>
            <span className="name-line">{item.name || "\u00A0"}</span>
            <span className="sig-label">{tr("signature")}</span>
          </div>
        ))}
      </div>

      <div className="vch-bottom">
        <VerificationStrip
          code={voucher.verifyCode}
          qrEnabled={security.qrEnabled}
          qrSide="right"
          variant="a5"
          lang={lang}
        />
        {security.microtextEnabled ? (
          <Microtext text={microtext} className="vch-microtext vch-microtext-bottom" />
        ) : null}
        <footer className="vch-footer">
          <div className="address-block">
            <span className="circle">
              <MapPin />
            </span>
            <div className="address-lines">
              <span className="label">{tr("addressLabel")}</span>
              {addressLines.map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </div>
          </div>
          <div className="divider" />
          <div className="phones">
            <span className="circle">
              <Phone />
            </span>
            <div className="phone-list">
              {phones.slice(0, 3).map((phone, index) => (
                <span key={index}>{toDigits(phone, digits)}</span>
              ))}
            </div>
          </div>
        </footer>

        <div className="vch-rule">
          <div className="blue" />
          <div className="orange" />
        </div>
      </div>
    </div>
  );
}
