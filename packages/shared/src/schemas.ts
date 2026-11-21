import { z } from "zod";

export const LANGUAGES = ["ku", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];
export const langSchema = z.enum(LANGUAGES);

export const DIGITS_MODES = ["eastern", "latin"] as const;
export type DigitsMode = (typeof DIGITS_MODES)[number];
export const digitsModeSchema = z.enum(DIGITS_MODES);

export const ROLES = ["admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const VOUCHER_PAGES = ["A5_landscape", "A4_landscape"] as const;
export type VoucherPage = (typeof VOUCHER_PAGES)[number];

export const DOCUMENT_STATUSES = ["DRAFT", "ISSUED", "CANCELLED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");

/** IQD amounts are integers. The API converts them to BigInt for PostgreSQL. */
export const moneySchema = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .int("Amount must be a whole number")
  .min(0, "Amount cannot be negative")
  .max(9_000_000_000_000, "Amount is too large")
  .default(0);

export const itemInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().max(300).default(""),
  code: z.string().trim().max(100).default(""),
  qty: z.coerce.number().int().min(0).max(1_000_000).default(0),
  price: moneySchema,
  discount: moneySchema,
  notes: z.string().trim().max(300).default(""),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const invoiceInputSchema = z
  .object({
    number: z.coerce.number().int().positive().max(2_000_000_000).optional(),
    date: isoDateSchema,
    customerId: z.coerce.number().int().positive().nullable().optional(),
    customerName: z.string().trim().max(200).default(""),
    customerPhone: z.string().trim().max(60).default(""),
    customerAddress: z.string().trim().max(300).default(""),
    lang: langSchema.default("ku"),
    digitsMode: digitsModeSchema.default("eastern"),
    itemInfo: z.string().max(5000).default(""),
    materialsText: z.string().max(5000).default(""),
    specialOffer: z.string().max(5000).default(""),
    advancePercent: z.coerce.number().int().min(0).max(100).default(60),
    finalPercent: z.coerce.number().int().min(0).max(100).default(40),
    items: z.array(itemInputSchema).max(30).default([]),
    saveCustomer: z.boolean().optional().default(true),
    watermarkEnabled: z.union([z.boolean(), z.null()]).optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.advancePercent + value.finalPercent !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finalPercent"],
        message: "PERCENTAGES_MUST_TOTAL_100",
      });
    }
  });
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const invoiceQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeDeleted: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
});
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;

export const voucherInputSchema = z.object({
  number: z.coerce.number().int().positive().max(2_000_000_000).optional(),
  date: isoDateSchema,
  invoiceId: z.coerce.number().int().positive().nullable().optional(),
  receivedFrom: z.string().trim().max(200).default(""),
  amount: moneySchema,
  amountWords: z.string().trim().max(2000).default(""),
  wordsManuallyEdited: z.boolean().optional().default(false),
  paymentFor: z.string().trim().max(500).default(""),
  paymentMethod: paymentMethodSchema.default("cash"),
  preparedBy: z.string().trim().max(200).default(""),
  receivedByName: z.string().trim().max(200).default(""),
  approvedBy: z.string().trim().max(200).default(""),
  lang: langSchema.default("ar"),
  digitsMode: digitsModeSchema.default("latin"),
  watermarkEnabled: z.union([z.boolean(), z.null()]).optional().default(null),
});
export type VoucherInput = z.infer<typeof voucherInputSchema>;

export const voucherQuerySchema = invoiceQuerySchema;
export type VoucherQuery = z.infer<typeof voucherQuerySchema>;

export const cancelDocumentSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});
export type CancelDocumentInput = z.infer<typeof cancelDocumentSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "REQUIRED").max(60),
  password: z.string().min(1, "REQUIRED").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "REQUIRED").max(200),
    newPassword: z
      .string()
      .min(8, "PASSWORD_TOO_SHORT")
      .max(200)
      .regex(/[A-Za-z]/, "PASSWORD_NEEDS_LETTER")
      .regex(/[0-9]/, "PASSWORD_NEEDS_NUMBER"),
    confirmPassword: z.string().min(1, "REQUIRED"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "PASSWORDS_DO_NOT_MATCH",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "USERNAME_TOO_SHORT")
    .max(60)
    .regex(/^[A-Za-z0-9_.-]+$/, "USERNAME_INVALID"),
  fullName: z.string().trim().max(120).default(""),
  role: z.enum(ROLES).default("staff"),
  password: z.string().min(8, "PASSWORD_TOO_SHORT").max(200),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  mustChangePassword: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "PASSWORD_TOO_SHORT").max(200),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const settingsSchema = z.object({
  company: z
    .object({
      phones: z.array(z.string().trim().max(30)).min(1).max(5),
      addressKu: z.array(z.string().trim().max(160)).max(6),
      addressAr: z.array(z.string().trim().max(160)).max(6),
      taglineKu: z.string().trim().max(160),
      taglineAr: z.string().trim().max(160),
    })
    .partial()
    .optional(),
  assets: z
    .object({
      logo: z.string().max(500),
      brandKu: z.string().max(500),
      brandAr: z.string().max(500),
      watermark: z.string().max(500),
    })
    .partial()
    .optional(),
  defaults: z
    .object({
      invoiceStart: z.coerce.number().int().min(1).max(2_000_000_000),
      voucherStart: z.coerce.number().int().min(1).max(2_000_000_000),
      advancePercent: z.coerce.number().int().min(0).max(100),
      finalPercent: z.coerce.number().int().min(0).max(100),
      invoiceDigits: digitsModeSchema,
      voucherDigits: digitsModeSchema,
      voucherPage: z.enum(VOUCHER_PAGES),
      safeMarginMm: z.coerce.number().min(0).max(10),
    })
    .partial()
    .optional(),
  security: z
    .object({
      watermarkEnabled: z.boolean(),
      watermarkOpacity: z.coerce.number().min(0.05).max(0.3),
      watermarkScale: z.coerce.number().min(0.5).max(2),
      guillocheEnabled: z.boolean(),
      microtextEnabled: z.boolean(),
      qrEnabled: z.boolean(),
    })
    .partial()
    .optional(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export interface CompanySettings {
  phones: string[];
  addressKu: string[];
  addressAr: string[];
  taglineKu: string;
  taglineAr: string;
}

export interface AssetSettings {
  logo: string;
  brandKu: string;
  brandAr: string;
  watermark: string;
}

export interface DefaultSettings {
  invoiceStart: number;
  voucherStart: number;
  advancePercent: number;
  finalPercent: number;
  invoiceDigits: DigitsMode;
  voucherDigits: DigitsMode;
  voucherPage: VoucherPage;
  safeMarginMm: number;
}

export interface SecuritySettings {
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkScale: number;
  guillocheEnabled: boolean;
  microtextEnabled: boolean;
  qrEnabled: boolean;
}

export interface AppSettings {
  company: CompanySettings;
  assets: AssetSettings;
  defaults: DefaultSettings;
  security: SecuritySettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  company: {
    phones: ["07701243724", "07501559445", "07804108381"],
    addressKu: [
      "کارگەی پێشەسازی دوو (کارگە)",
      "سلێمانی-ژاڵە (شۆڕووم)",
      "سلێمانی – ژاڵە (نۆفیس)",
    ],
    addressAr: [
      "السليمانية – المنطقة الصناعية 2 – (المصنع)",
      "السليمانية – منطقة زلە – (المعرض)",
      "السليمانية – منطقة زالە – (المكتب)",
    ],
    taglineKu: "بۆکاری ئەندازیاری و هونەری",
    taglineAr: "للاعمال الهندسية والفنية",
  },
  assets: {
    logo: "/assets/logo.svg",
    brandKu: "/assets/brand-ku.svg",
    brandAr: "/assets/brand-ar.svg",
    watermark: "/assets/watermark.svg",
  },
  defaults: {
    invoiceStart: 1001,
    voucherStart: 1,
    advancePercent: 60,
    finalPercent: 40,
    invoiceDigits: "eastern",
    voucherDigits: "latin",
    voucherPage: "A5_landscape",
    safeMarginMm: 5,
  },
  security: {
    watermarkEnabled: true,
    watermarkOpacity: 0.11,
    watermarkScale: 1,
    guillocheEnabled: true,
    microtextEnabled: true,
    qrEnabled: true,
  },
};
