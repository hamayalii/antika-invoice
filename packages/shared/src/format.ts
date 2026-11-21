import type { DigitsMode } from "./schemas";
import { formatInteger, numberToEasternDigits } from "./numberToWords";

export function toDigits(input: string | number, mode: DigitsMode): string {
  const text = String(input);
  return mode === "eastern" ? numberToEasternDigits(text) : text;
}

/** Thousands-separated integer in the requested digit system. */
export function formatNumber(value: number, mode: DigitsMode = "latin"): string {
  return toDigits(formatInteger(Math.round(value)), mode);
}

/** IQD amount with thousands separators, without a currency suffix. */
export function formatMoney(value: number, mode: DigitsMode = "latin"): string {
  return formatNumber(value, mode);
}

export function formatPercent(value: number, mode: DigitsMode = "latin"): string {
  return `${toDigits(Math.round(value), mode)}٪`;
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Date-only ISO string (YYYY-MM-DD) without timezone drift. */
export function isoDateFrom(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today in Asia/Baghdad as YYYY-MM-DD. */
export function todayInBaghdad(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Formats a date for the documents.
 * dash: DD-MM-YYYY (document A), slash: DD / MM / YYYY (document B).
 */
export function formatDocumentDate(
  iso: string,
  style: "dash" | "slash",
  mode: DigitsMode,
): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  const separator = style === "dash" ? "-" : " / ";
  return toDigits(`${d}${separator}${m}${separator}${y}`, mode);
}

/** e.g. 7 -> "٧" or "7" */
export function digit(value: number, mode: DigitsMode): string {
  return toDigits(value, mode);
}

/** Safely convert an arbitrary amount to a whole IQD number. */
export function toIqd(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}
