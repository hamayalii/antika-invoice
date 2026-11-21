import { toIqd } from "./format";
import type { ItemInput } from "./schemas";

export interface CalculatedItem extends ItemInput {
  lineTotal: number;
}

export interface InvoiceTotals {
  items: CalculatedItem[];
  subtotal: number;
  total: number;
  advancePercent: number;
  finalPercent: number;
  advanceAmount: number;
  finalAmount: number;
}

export function computeLineTotal(item: Pick<ItemInput, "qty" | "price" | "discount">): number {
  const qty = Math.max(0, Math.trunc(Number(item.qty) || 0));
  const price = toIqd(item.price);
  const discount = Math.min(toIqd(item.discount), qty * price);
  return Math.max(0, qty * price - discount);
}

export function computeInvoiceTotals(
  items: ItemInput[],
  advancePercent = 60,
  finalPercent = 40,
): InvoiceTotals {
  const calculated = items.map((item) => ({ ...item, lineTotal: computeLineTotal(item) }));
  const subtotal = calculated.reduce((sum, item) => sum + item.lineTotal, 0);
  const advance = Math.round((subtotal * advancePercent) / 100);
  return {
    items: calculated,
    subtotal,
    total: subtotal,
    advancePercent,
    finalPercent,
    advanceAmount: advance,
    finalAmount: subtotal - advance,
  };
}

/** Recalculates a totals preview while the user edits the percentage fields. */
export function computePercentages(total: number, advancePercent: number) {
  const safeAdvance = Math.min(100, Math.max(0, Math.round(advancePercent)));
  const advanceAmount = Math.round((total * safeAdvance) / 100);
  return {
    advancePercent: safeAdvance,
    finalPercent: 100 - safeAdvance,
    advanceAmount,
    finalAmount: total - advanceAmount,
  };
}
