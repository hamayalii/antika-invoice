import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getSettings } from "./settings";

type Tx = Prisma.TransactionClient;

/**
 * Atomically increments a document counter. Counter rows are created on first use
 * from the configured start value (invoice 1001, voucher 1 by default).
 */
export async function allocateNumber(tx: Tx, name: "invoice" | "voucher", start: number): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO counters (name, value)
    VALUES (${name}, ${start})
    ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
    RETURNING value
  `;
  const value = rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error(`Could not allocate ${name} number`);
  }
  return value;
}

/** Reads the next number without reserving it (used only to prefill the editor). */
export async function peekNextNumber(name: "invoice" | "voucher"): Promise<number> {
  const settings = await getSettings();
  const row = await prisma.counter.findUnique({ where: { name } });
  if (!row) return name === "invoice" ? settings.defaults.invoiceStart : settings.defaults.voucherStart;
  return row.value + 1;
}

/** Adds one to a counter after an admin manually used a higher number. */
export async function raiseCounter(tx: Tx, name: "invoice" | "voucher", used: number): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO counters (name, value) VALUES (${name}, ${used})
    ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, ${used})
  `;
}
