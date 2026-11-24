import { amountInWords, type InvoiceDto, type Language, type VoucherDto } from "@antika/shared";

/**
 * Sample documents for the live security preview. They are deliberately
 * static and fully populated so the preview never depends on the database and
 * every protected layer (watermark, guilloche, microtext, QR + verify code)
 * has a place to show up.
 */
export const PREVIEW_VERIFY_CODE = "ABCD-EFGH-JKLM";
const PREVIEW_DATE = "2026-11-20";

export function sampleInvoice(lang: Language): InvoiceDto {
  return {
    id: 1010,
    number: 1010,
    date: PREVIEW_DATE,
    customerId: 1,
    customerName: "Slemani cement",
    customerPhone: "0770 123 4567",
    customerAddress: "سلێمانی – ژاڵە",
    lang,
    digitsMode: "eastern",
    itemInfo: "دیزاین و جێبەجێکردنی کەپری واجەهە (Modern Facade Canopy)",
    materialsText:
      "بەکارهێنانی هابەکانی ناسی (Steel Structure) و (Laminated Glass) و بەکارهێنانی (stainless Steel) وەهەروەها تەختیفرکردنی بەشی ژێرەوەی بە دیۆکری تەختە.",
    specialOffer: "",
    advancePercent: 60,
    finalPercent: 40,
    subtotal: 4_750_000,
    total: 4_750_000,
    advanceAmount: 2_850_000,
    finalAmount: 1_900_000,
    createdBy: 1,
    createdAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    updatedAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    deletedAt: null,
    verifyCode: PREVIEW_VERIFY_CODE,
    status: "ISSUED",
    issuedAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    cancelledAt: null,
    cancelReason: "",
    verifyCount: 0,
    lastVerifiedAt: null,
    watermarkEnabled: null,
    items: [
      {
        id: 1,
        position: 0,
        name: "دیزاین و جێبەجێکردنی کەپری واجەهە (Modern Facade Canopy)",
        code: "ANT-1010",
        qty: 1,
        price: 3_450_000,
        discount: 0,
        notes: "",
        lineTotal: 3_450_000,
      },
      {
        id: 2,
        position: 1,
        name: "هەڵکۆڵین و ئامادەکردنی شوێن",
        code: "ANT-1002",
        qty: 2,
        price: 650_000,
        discount: 0,
        notes: "بەپێی ڕەسمی پێشکەشکراو",
        lineTotal: 1_300_000,
      },
    ],
  };
}

export function sampleVoucher(lang: Language): VoucherDto {
  const amount = 1_250_000;
  return {
    id: 1010,
    number: 1010,
    date: PREVIEW_DATE,
    invoiceId: null,
    receivedFrom: "بەڕێز کاک کارزان محەمەد",
    amount,
    amountWords: amountInWords(amount, lang),
    paymentFor: "پارەی پێشینەی سندوقی ئەنتیکە",
    paymentMethod: "cash",
    preparedBy: "Antika Administrator",
    receivedByName: "",
    approvedBy: "",
    lang,
    digitsMode: "latin",
    createdBy: 1,
    createdAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    updatedAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    deletedAt: null,
    verifyCode: PREVIEW_VERIFY_CODE,
    status: "ISSUED",
    issuedAt: `${PREVIEW_DATE}T09:00:00.000Z`,
    cancelledAt: null,
    cancelReason: "",
    verifyCount: 0,
    lastVerifiedAt: null,
    watermarkEnabled: null,
  };
}
