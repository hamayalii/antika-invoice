import crypto from "node:crypto";
import { config } from "../config";

/** Uppercase letters and digits without the confusable O, 0, I and 1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const VERIFY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export function generateVerifyCode(): string {
  const bytes = crypto.randomBytes(12);
  let raw = "";
  for (let index = 0; index < 12; index += 1) {
    raw += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeVerifyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidVerifyCode(value: string): boolean {
  return VERIFY_CODE_PATTERN.test(normalizeVerifyCode(value));
}

export function verificationUrl(code: string): string {
  return `${config.PUBLIC_BASE_URL.replace(/\/+$/, "")}/verify/${normalizeVerifyCode(code)}`;
}

export function maskCustomerName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .map((word, index) => {
      const visible = index === 0 ? 3 : 2;
      return `${Array.from(word).slice(0, visible).join("")}***`;
    })
    .join(" ");
}

function isoDate(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function amount(value: bigint | number): string {
  return typeof value === "bigint" ? value.toString() : String(Math.trunc(value));
}

export interface InvoiceIntegrityRecord {
  number: number;
  date: Date | string;
  customerName: string;
  total: bigint | number;
  verifyCode: string;
  items: Array<{
    position: number;
    name: string;
    code: string;
    qty: number;
    price: bigint | number;
    discount: bigint | number;
    lineTotal: bigint | number;
  }>;
}

export interface VoucherIntegrityRecord {
  number: number;
  date: Date | string;
  receivedFrom: string;
  amount: bigint | number;
  verifyCode: string;
}

function sign(payload: unknown): string {
  return crypto
    .createHmac("sha256", config.DOC_HMAC_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function computeInvoiceIntegrity(record: InvoiceIntegrityRecord): string {
  return sign({
    type: "invoice",
    number: record.number,
    date: isoDate(record.date),
    customer: record.customerName,
    total: amount(record.total),
    items: [...record.items]
      .sort((left, right) => left.position - right.position)
      .map((item) => [
        item.name,
        item.code,
        item.qty,
        amount(item.price),
        amount(item.discount),
        amount(item.lineTotal),
      ]),
    verifyCode: record.verifyCode,
  });
}

export function computeVoucherIntegrity(record: VoucherIntegrityRecord): string {
  return sign({
    type: "voucher",
    number: record.number,
    date: isoDate(record.date),
    customer: record.receivedFrom,
    total: amount(record.amount),
    items: [],
    verifyCode: record.verifyCode,
  });
}

export function integrityMatches(stored: string | null, computed: string): boolean {
  if (!stored) return false;
  const left = Buffer.from(stored, "utf8");
  const right = Buffer.from(computed, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
