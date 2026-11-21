import { describe, expect, it } from "vitest";
import {
  VERIFY_CODE_PATTERN,
  computeInvoiceIntegrity,
  computeVoucherIntegrity,
  generateVerifyCode,
  integrityMatches,
  isValidVerifyCode,
  maskCustomerName,
  normalizeVerifyCode,
} from "../../apps/api/src/services/authenticity";

const invoiceRecord = {
  number: 1010,
  date: new Date("2026-11-20T00:00:00.000Z"),
  customerName: "Slemani Cement Company",
  total: 4_750_000n,
  verifyCode: "ABCD-EFGH-JKLM",
  items: [
    {
      position: 1,
      name: "Cement",
      code: "CEM-01",
      qty: 100,
      price: 40_000n,
      discount: 0n,
      lineTotal: 4_000_000n,
    },
    {
      position: 2,
      name: "Delivery",
      code: "DLV-01",
      qty: 1,
      price: 750_000n,
      discount: 0n,
      lineTotal: 750_000n,
    },
  ],
};

describe("verify codes", () => {
  it("generates 10,000 unique codes with no confusable characters", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 10_000; index += 1) {
      const code = generateVerifyCode();
      expect(code).toMatch(VERIFY_CODE_PATTERN);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[O0I1]/);
      seen.add(code);
    }
    expect(seen.size).toBe(10_000);
  });

  it("normalizes case and whitespace before validation", () => {
    expect(normalizeVerifyCode(" abcd-efgh-jklm ")).toBe("ABCD-EFGH-JKLM");
    expect(isValidVerifyCode("abcd-efgh-jklm")).toBe(true);
    expect(isValidVerifyCode("ABCD-EFGH-JKL0")).toBe(false);
    expect(isValidVerifyCode("ABCD-EFGH")).toBe(false);
  });
});

describe("customer masking", () => {
  it("keeps a short prefix of every word and hides the rest", () => {
    expect(maskCustomerName("Slemani Cement")).toBe("Sle*** Ce***");
    expect(maskCustomerName("Karwan")).toBe("Kar***");
    expect(maskCustomerName("  ")).toBe("—");
  });
});

describe("HMAC integrity", () => {
  it("is stable for the same record and item order", () => {
    const first = computeInvoiceIntegrity(invoiceRecord);
    const reordered = computeInvoiceIntegrity({
      ...invoiceRecord,
      items: [...invoiceRecord.items].reverse(),
    });
    expect(reordered).toBe(first);
    expect(integrityMatches(first, computeInvoiceIntegrity(invoiceRecord))).toBe(true);
  });

  it("detects a changed total, customer, number, item or code", () => {
    const stored = computeInvoiceIntegrity(invoiceRecord);
    expect(integrityMatches(stored, computeInvoiceIntegrity({ ...invoiceRecord, total: 4_750_001n }))).toBe(false);
    expect(integrityMatches(stored, computeInvoiceIntegrity({ ...invoiceRecord, customerName: "Other" }))).toBe(false);
    expect(integrityMatches(stored, computeInvoiceIntegrity({ ...invoiceRecord, number: 1011 }))).toBe(false);
    expect(integrityMatches(stored, computeInvoiceIntegrity({ ...invoiceRecord, verifyCode: "ABCD-EFGH-JKLN" }))).toBe(false);
    expect(
      integrityMatches(
        stored,
        computeInvoiceIntegrity({
          ...invoiceRecord,
          items: [{ ...invoiceRecord.items[0], price: 41_000n }, invoiceRecord.items[1]],
        }),
      ),
    ).toBe(false);
  });

  it("rejects missing and truncated hashes without throwing", () => {
    const stored = computeInvoiceIntegrity(invoiceRecord);
    expect(integrityMatches(null, stored)).toBe(false);
    expect(integrityMatches("", stored)).toBe(false);
    expect(integrityMatches(stored.slice(0, 16), stored)).toBe(false);
  });

  it("signs vouchers over their own fields", () => {
    const voucher = {
      number: 1,
      date: new Date("2026-11-20T00:00:00.000Z"),
      receivedFrom: "Slemani Cement",
      amount: 250_000n,
      verifyCode: "ABCD-EFGH-JKLM",
    };
    const stored = computeVoucherIntegrity(voucher);
    expect(integrityMatches(stored, computeVoucherIntegrity(voucher))).toBe(true);
    expect(integrityMatches(stored, computeVoucherIntegrity({ ...voucher, amount: 250_001n }))).toBe(false);
    expect(integrityMatches(stored, computeVoucherIntegrity({ ...voucher, receivedFrom: "Other" }))).toBe(false);
  });
});
