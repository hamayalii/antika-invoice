import type { AppSettings, DigitsMode, VoucherPage, SecuritySettings } from "@antika/shared";

export interface SettingsFormValues {
  company: {
    phones: string[];
    addressKu: string[];
    addressAr: string[];
    taglineKu: string;
    taglineAr: string;
  };
  assets: {
    logo: string;
    brandKu: string;
    brandAr: string;
    watermark: string;
  };
  defaults: {
    invoiceStart: number;
    voucherStart: number;
    advancePercent: number;
    finalPercent: number;
    invoiceDigits: DigitsMode;
    voucherDigits: DigitsMode;
    voucherPage: VoucherPage;
    safeMarginMm: number;
  };
  security: SecuritySettings;
}

export function toFormValues(settings: AppSettings): SettingsFormValues {
  const pad = (arr: string[], length = 3) => {
    const copy = [...arr];
    while (copy.length < length) copy.push("");
    return copy.slice(0, Math.max(length, copy.length));
  };
  return {
    company: {
      phones: pad(settings.company.phones, 3),
      addressKu: pad(settings.company.addressKu, 3),
      addressAr: pad(settings.company.addressAr, 3),
      taglineKu: settings.company.taglineKu,
      taglineAr: settings.company.taglineAr,
    },
    assets: { ...settings.assets },
    defaults: { ...settings.defaults },
    security: { ...settings.security },
  };
}
