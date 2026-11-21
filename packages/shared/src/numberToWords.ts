import type { Language } from "./schemas";

export const NUMBER_WORDS_MAX = 999_999_999_999;

const AR_UNITS = [
  "صفر",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
];
const AR_TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const AR_TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];
const AR_HUNDREDS = [
  "",
  "مئة",
  "مئتان",
  "ثلاثمئة",
  "أربعمئة",
  "خمسمئة",
  "ستمئة",
  "سبعمئة",
  "ثمانمئة",
  "تسعمئة",
];

const KU_UNITS = [
  "سفر",
  "یەک",
  "دوو",
  "سێ",
  "چوار",
  "پێنج",
  "شەش",
  "حەوت",
  "هەشت",
  "نۆ",
];
const KU_TEENS = [
  "دە",
  "یازدە",
  "دوازدە",
  "سێزدە",
  "چواردە",
  "پازدە",
  "شازدە",
  "حەڤدە",
  "هەژدە",
  "نۆزدە",
];
const KU_TENS = [
  "",
  "",
  "بیست",
  "سی",
  "چل",
  "پەنجا",
  "شەست",
  "حەفتا",
  "هەشتا",
  "نەوەد",
];
const KU_HUNDREDS = [
  "",
  "سەد",
  "دوو سەد",
  "سێ سەد",
  "چوار سەد",
  "پێنج سەد",
  "شەش سەد",
  "حەوت سەد",
  "هەشت سەد",
  "نۆ سەد",
];

function arabicBelow1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(AR_HUNDREDS[hundreds]);
  if (rest > 0) {
    if (rest < 10) {
      parts.push(AR_UNITS[rest]);
    } else if (rest < 20) {
      parts.push(AR_TEENS[rest - 10]);
    } else {
      const tens = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(unit === 0 ? AR_TENS[tens] : `${AR_UNITS[unit]} و${AR_TENS[tens]}`);
    }
  }
  return parts.join(" و");
}

function kurdishBelow1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(KU_HUNDREDS[hundreds]);
  if (rest > 0) {
    if (rest < 10) {
      parts.push(KU_UNITS[rest]);
    } else if (rest < 20) {
      parts.push(KU_TEENS[rest - 10]);
    } else {
      const tens = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(unit === 0 ? KU_TENS[tens] : `${KU_TENS[tens]} و ${KU_UNITS[unit]}`);
    }
  }
  return parts.join(" و ");
}

interface Scale {
  value: number;
  arabic: { one: string; two: string; few: string; many: string };
  kurdish: string;
}

const SCALES: Scale[] = [
  {
    value: 1_000_000_000,
    arabic: { one: "مليار", two: "ملياران", few: "مليارات", many: "مليار" },
    kurdish: "ملیار",
  },
  {
    value: 1_000_000,
    arabic: { one: "مليون", two: "مليونان", few: "ملايين", many: "مليون" },
    kurdish: "ملیۆن",
  },
  {
    value: 1_000,
    arabic: { one: "ألف", two: "ألفان", few: "آلاف", many: "ألف" },
    kurdish: "هەزار",
  },
];

function arabicScale(count: number, scale: Scale): string {
  if (count === 1) return scale.arabic.one;
  if (count === 2) return scale.arabic.two;
  const countWords = arabicBelow1000(count);
  if (count >= 3 && count <= 10) return `${countWords} ${scale.arabic.few}`;
  return `${countWords} ${scale.arabic.many}`;
}

function kurdishScale(count: number, scale: Scale): string {
  return `${kurdishBelow1000(count)} ${scale.kurdish}`;
}

/**
 * Converts an integer amount (0 .. 999,999,999,999) to Arabic or Kurdish Sorani words.
 * The currency suffix is appended by `amountInWords`.
 */
export function numberToWords(n: number, lang: Language): string {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error("numberToWords expects a finite integer");
  }
  if (n < 0) throw new Error("numberToWords does not support negative numbers");
  if (n > NUMBER_WORDS_MAX) throw new Error("numberToWords supports up to 999,999,999,999");

  if (n === 0) return lang === "ar" ? AR_UNITS[0] : KU_UNITS[0];

  const parts: string[] = [];
  let rest = n;
  for (const scale of SCALES) {
    const count = Math.floor(rest / scale.value);
    if (count > 0) {
      parts.push(lang === "ar" ? arabicScale(count, scale) : kurdishScale(count, scale));
      rest %= scale.value;
    }
  }
  if (rest > 0) {
    parts.push(lang === "ar" ? arabicBelow1000(rest) : kurdishBelow1000(rest));
  }
  return parts.join(" و ");
}

export function amountInWords(n: number, lang: Language): string {
  const words = numberToWords(n, lang);
  return lang === "ar" ? `${words} دينار عراقي فقط لا غير` : `${words} دیناری عێراقی تەنها`;
}

export function numberToEasternDigits(input: string | number): string {
  const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(input).replace(/[0-9]/g, (d) => map[Number(d)]);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
