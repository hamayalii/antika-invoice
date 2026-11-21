import { describe, expect, it } from "vitest";
import { amountInWords, numberToWords } from "@antika/shared";

const ARABIC: Array<[number, string]> = [
  [0, "صفر"],
  [1, "واحد"],
  [2, "اثنان"],
  [10, "عشرة"],
  [11, "أحد عشر"],
  [21, "واحد وعشرون"],
  [100, "مئة"],
  [250000, "مئتان وخمسون ألف"],
  [1500000, "مليون و خمسمئة ألف"],
  [400000, "أربعمئة ألف"],
  [2750500, "مليونان و سبعمئة وخمسون ألف و خمسمئة"],
];

const KURDISH: Array<[number, string]> = [
  [0, "سفر"],
  [1, "یەک"],
  [2, "دوو"],
  [10, "دە"],
  [11, "یازدە"],
  [21, "بیست و یەک"],
  [100, "سەد"],
  [250000, "دوو سەد و پەنجا هەزار"],
  [1500000, "یەک ملیۆن و پێنج سەد هەزار"],
  [400000, "چوار سەد هەزار"],
  [2750500, "دوو ملیۆن و حەوت سەد و پەنجا هەزار و پێنج سەد"],
];

describe("numberToWords — Arabic", () => {
  it.each(ARABIC)("converts %i", (value, expected) => {
    expect(numberToWords(value, "ar")).toBe(expected);
  });

  it("appends the Arabic currency suffix", () => {
    expect(amountInWords(2750500, "ar")).toBe(
      "مليونان و سبعمئة وخمسون ألف و خمسمئة دينار عراقي فقط لا غير",
    );
  });
});

describe("numberToWords — Kurdish", () => {
  it.each(KURDISH)("converts %i", (value, expected) => {
    expect(numberToWords(value, "ku")).toBe(expected);
  });

  it("appends the Kurdish currency suffix", () => {
    expect(amountInWords(2750500, "ku")).toBe(
      "دوو ملیۆن و حەوت سەد و پەنجا هەزار و پێنج سەد دیناری عێراقی تەنها",
    );
  });
});

describe("numberToWords — boundaries", () => {
  it("supports the documented maximum", () => {
    expect(numberToWords(999_999_999_999, "ar")).toContain("تسعمئة");
    expect(numberToWords(999_999_999_999, "ku")).toContain("نۆ سەد");
  });

  it("rejects negative, fractional and oversized values", () => {
    expect(() => numberToWords(-1, "ar")).toThrow();
    expect(() => numberToWords(1.5, "ar")).toThrow();
    expect(() => numberToWords(1_000_000_000_000, "ar")).toThrow();
  });
});
