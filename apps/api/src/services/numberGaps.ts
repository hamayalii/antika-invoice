import { prisma } from "../db";
import { getSettings } from "./settings";

export interface NumberGapsReport {
  start: number;
  end: number;
  issued: number;
  gaps: number[];
  missingCount: number;
}

async function buildReport(
  name: "invoice" | "voucher",
  configuredStart: number,
): Promise<NumberGapsReport> {
  const [counter, rows] = await Promise.all([
    prisma.counter.findUnique({ where: { name } }),
    name === "invoice"
      ? prisma.invoice.findMany({ select: { number: true } })
      : prisma.voucher.findMany({ select: { number: true } }),
  ]);

  if (rows.length === 0) {
    return { start: configuredStart, end: configuredStart - 1, issued: 0, gaps: [], missingCount: 0 };
  }

  const numbers = rows.map((row) => row.number);
  const start = Math.min(...numbers);
  const end = Math.max(counter?.value ?? 0, ...numbers);
  const present = new Set(numbers);
  const gaps: number[] = [];
  for (let value = start; value <= end; value += 1) {
    if (!present.has(value)) gaps.push(value);
  }

  return { start, end, issued: numbers.length, gaps, missingCount: gaps.length };
}

export async function getNumberGaps(): Promise<{
  invoices: NumberGapsReport;
  vouchers: NumberGapsReport;
}> {
  const settings = await getSettings();
  const [invoices, vouchers] = await Promise.all([
    buildReport("invoice", settings.defaults.invoiceStart),
    buildReport("voucher", settings.defaults.voucherStart),
  ]);
  return { invoices, vouchers };
}
