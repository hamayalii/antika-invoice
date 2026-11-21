import { useTranslation } from "react-i18next";
import {
  formatDocumentDate,
  formatMoney,
  formatPercent,
  toDigits,
  type AppSettings,
  type DigitsMode,
  type InvoiceDto,
  type Language,
} from "@antika/shared";
import { MapPin, Phone } from "lucide-react";
import {
  CancelledStamp,
  Guilloche,
  Microtext,
  VerificationStrip,
  Watermark,
} from "../../components/DocumentLayers";
import "./invoice-document.css";

export interface InvoiceDocumentProps {
  invoice: InvoiceDto;
  settings: AppSettings;
  lang: Language;
  digitsMode: DigitsMode;
}

export function InvoiceDocument({ invoice, settings, lang, digitsMode }: InvoiceDocumentProps) {
  const { t } = useTranslation();
  const tr = (key: string, options?: Record<string, unknown>): string =>
    String(t(`documents.invoice.${key}`, { lng: lang, ...(options ?? {}) }));

  const digits = digitsMode;
  const money = (value: number) => formatMoney(value, digits);
  const moneyOrBlank = (value: number) => (value ? formatMoney(value, digits) : "");
  const dateText = formatDocumentDate(invoice.date, "dash", digits);
  const numberText = toDigits(invoice.number, digits);
  const advanceLabel = tr("advance", { percent: formatPercent(invoice.advancePercent, digits) });
  const finalLabel = tr("final", { percent: formatPercent(invoice.finalPercent, digits) });

  const logo = settings.assets.logo || "/assets/logo.svg";
  const brand = lang === "ar" ? settings.assets.brandAr : settings.assets.brandKu;
  // The bundled calligraphy is set in Arkan like the rest of the sheet;
  // a custom uploaded brand image is still used as-is.
  const brandIsBundled =
    !brand || brand === "/assets/brand-ku.svg" || brand === "/assets/brand-ar.svg";
  const security = settings.security;
  const watermarkOn = invoice.watermarkEnabled ?? security.watermarkEnabled;
  const microtext = `${"ANTIKA FACTORY • ".repeat(6)}${invoice.verifyCode} • ${"ANTIKA FACTORY • ".repeat(14)}`;
  const tagline =
    (lang === "ar" ? settings.company.taglineAr : settings.company.taglineKu) || tr("tagline");
  const addressLines =
    (lang === "ar" ? settings.company.addressAr : settings.company.addressKu) ?? [];
  const phones = settings.company.phones ?? [];

  const rows =
    invoice.items.length > 0
      ? invoice.items
      : [
          {
            id: 0,
            position: 0,
            name: "",
            code: "",
            qty: 0,
            price: 0,
            discount: 0,
            notes: "",
            lineTotal: 0,
          },
        ];

  return (
    <div className="invoice-sheet" dir="rtl" lang={lang}>
      {security.guillocheEnabled ? <Guilloche id="guilloche-invoice" opacity={0.05} /> : null}
      {watermarkOn ? (
        <Watermark widthMm={140 * security.watermarkScale} opacity={security.watermarkOpacity} />
      ) : null}
      {invoice.status === "CANCELLED" ? (
        <CancelledStamp reason={invoice.cancelReason || undefined} />
      ) : null}
      <header className="inv-header">
        <div className="inv-header-band">
          <div className="inv-brand-calligraphy">
            {brandIsBundled ? (
              <span className="brand-name">{lang === "ar" ? "انتيكه" : "ئەنتیکە"}</span>
            ) : (
              <img src={brand} alt="" />
            )}
            <span className="tagline">{tagline}</span>
          </div>
          <div className="inv-brand-logo">
            <img className="inv-logo-img" src={logo} alt="Antika Factory" />
            <div className="inv-wordmark">
              <div className="name">
                <span className="a">A</span>NTIKA
              </div>
              <div className="factory">FACTORY</div>
            </div>
          </div>
        </div>
        <div className="inv-header-line" />
      </header>
      {security.microtextEnabled ? <Microtext text={microtext} /> : null}

      <div className="inv-meta">
        <div className="inv-date">
          <span className="label">{tr("date")}</span>
          <span className="value" dir="ltr">
            {dateText}
          </span>
        </div>
        <div className="inv-number-box">
          <span>{tr("number")}</span>
          <span className="value">{numberText}</span>
        </div>
      </div>

      <section className="inv-customer">
        <div className="cell">
          <span className="label">{tr("customer")}</span>
          <span className="value">{invoice.customerName || "\u00A0"}</span>
        </div>
        <div className="cell">
          <span className="label">{tr("phone")}</span>
          <span className="value" dir="ltr">
            {invoice.customerPhone || "\u00A0"}
          </span>
        </div>
        <div className="cell">
          <span className="label">{tr("address")}</span>
          <span className="value">{invoice.customerAddress || "\u00A0"}</span>
        </div>
      </section>

      <table className="inv-table">
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>{tr("item")}</th>
            <th>{tr("code")}</th>
            <th>{tr("qty")}</th>
            <th>{tr("price")}</th>
            <th>{tr("discount")}</th>
            <th>{tr("notes")}</th>
            <th>{tr("total")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.id || `row-${index}`}>
              <td className="cell-name">{item.name}</td>
              <td>{item.code}</td>
              <td>{item.qty ? toDigits(item.qty, digits) : ""}</td>
              <td>{moneyOrBlank(item.price)}</td>
              <td>{moneyOrBlank(item.discount)}</td>
              <td className="cell-notes">{item.notes}</td>
              <td className="cell-total">{moneyOrBlank(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="inv-info">
        <tbody>
          <tr className="row-info">
            <td className="label">{tr("itemInfo")}</td>
            <td className="content">{invoice.itemInfo}</td>
          </tr>
          <tr className="row-materials">
            <td className="label">{tr("materials")}</td>
            <td className="content">{invoice.materialsText}</td>
          </tr>
          <tr className="row-offer">
            <td className="label">{tr("specialOffer")}</td>
            <td className="content">{invoice.specialOffer}</td>
          </tr>
        </tbody>
      </table>

      <section className="inv-totals">
        <div className="inv-total-item">
          <span className="label">{tr("grandTotal")}</span>
          <span className="box">{money(invoice.total)}</span>
        </div>
        <div className="inv-total-item">
          <span className="label">{advanceLabel}</span>
          <span className="box">{money(invoice.advanceAmount)}</span>
        </div>
        <div className="inv-total-item">
          <span className="label">{finalLabel}</span>
          <span className="box">{money(invoice.finalAmount)}</span>
        </div>
      </section>

      <footer className="inv-footer-wrap">
        <VerificationStrip
          code={invoice.verifyCode}
          qrEnabled={security.qrEnabled}
          qrSide="left"
          variant="a4"
          lang={lang}
        />
        {security.microtextEnabled ? <Microtext text={microtext} /> : null}
        <div className="inv-footer">
          <div className="address-block">
            <span className="circle">
              <MapPin />
            </span>
            <div className="address-lines">
              <div className="label">{tr("address")}</div>
              {addressLines.map((line, index) => (
                <div key={index}>{line}</div>
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
        </div>
        <div className="inv-rule">
          <div className="blue" />
          <div className="orange" />
        </div>
      </footer>
    </div>
  );
}
