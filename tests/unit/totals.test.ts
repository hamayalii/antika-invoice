import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, computeLineTotal } from "@antika/shared";

describe("invoice totals", () => {
  it("computes line totals with discounts", () => {
    expect(computeLineTotal({ qty: 3, price: 10_000, discount: 5_000 })).toBe(25_000);
    expect(computeLineTotal({ qty: 0, price: 10_000, discount: 0 })).toBe(0);
    expect(computeLineTotal({ qty: 2, price: 1_000, discount: 9_999 })).toBe(0);
  });

  it("sums items and splits the advance/final amounts", () => {
    const totals = computeInvoiceTotals(
      [
        { name: "A", code: "", qty: 1, price: 1_000_000, discount: 0, notes: "" },
        { name: "B", code: "", qty: 2, price: 250_000, discount: 100_000, notes: "" },
      ],
      60,
      40,
    );
    expect(totals.subtotal).toBe(1_400_000);
    expect(totals.total).toBe(1_400_000);
    expect(totals.advanceAmount).toBe(840_000);
    expect(totals.finalAmount).toBe(560_000);
    expect(totals.items.map((item) => item.lineTotal)).toEqual([1_000_000, 400_000]);
  });

  it("rounds the advance and keeps the final amount exact", () => {
    const totals = computeInvoiceTotals(
      [{ name: "A", code: "", qty: 1, price: 999, discount: 0, notes: "" }],
      50,
      50,
    );
    expect(totals.advanceAmount).toBe(500);
    expect(totals.finalAmount).toBe(499);
    expect(totals.advanceAmount + totals.finalAmount).toBe(totals.total);
  });

  it("handles an empty invoice", () => {
    const totals = computeInvoiceTotals([], 60, 40);
    expect(totals.total).toBe(0);
    expect(totals.advanceAmount).toBe(0);
    expect(totals.finalAmount).toBe(0);
  });
});
