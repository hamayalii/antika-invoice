import {
  amountInWords,
  todayInBaghdad,
  type Paginated,
  type Role,
  type VoucherDto,
  type VoucherInput,
  type VoucherQuery,
} from "@antika/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../lib/http";
import { serializeVoucher } from "../lib/serialize";
import { audit } from "../lib/audit";
import { allocateNumber, raiseCounter } from "./counters";
import { getSettings } from "./settings";
import { computeVoucherIntegrity } from "./authenticity";
import { allocateVerifyCode } from "./verifyCodes";

type RoleName = Role;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function resolvedWords(input: VoucherInput): string {
  if (input.wordsManuallyEdited && input.amountWords.trim()) return input.amountWords.trim();
  return amountInWords(input.amount, input.lang);
}

async function assertInvoiceExists(invoiceId: number | null | undefined): Promise<void> {
  if (!invoiceId) return;
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.deletedAt) {
    throw new HttpError(400, "INVOICE_NOT_FOUND", "Linked invoice was not found");
  }
}

export async function createVoucher(
  input: VoucherInput,
  userId: number,
  role: RoleName,
): Promise<VoucherDto> {
  const settings = await getSettings();
  const manualNumber = role === "admin" ? input.number : undefined;
  await assertInvoiceExists(input.invoiceId);
  const verifyCode = await allocateVerifyCode();

  const voucher = await prisma.$transaction(
    async (tx) => {
      const number = manualNumber ?? (await allocateNumber(tx, "voucher", settings.defaults.voucherStart));
      const created = await tx.voucher.create({
        data: {
          number,
          verifyCode,
          watermarkEnabled: role === "admin" ? input.watermarkEnabled : null,
          date: toDate(input.date),
          invoiceId: input.invoiceId ?? null,
          receivedFrom: input.receivedFrom,
          amount: BigInt(input.amount),
          amountWords: resolvedWords(input),
          paymentFor: input.paymentFor,
          paymentMethod: input.paymentMethod,
          preparedBy: input.preparedBy,
          receivedByName: input.receivedByName,
          approvedBy: input.approvedBy,
          lang: input.lang,
          digitsMode: input.digitsMode,
          createdBy: userId,
        },
      });
      if (manualNumber !== undefined) await raiseCounter(tx, "voucher", manualNumber);
      const integrityHash = computeVoucherIntegrity(created);
      await tx.voucher.update({ where: { id: created.id }, data: { integrityHash } });
      return { ...created, integrityHash };
    },
    { timeout: 20_000 },
  );

  await audit(userId, "create", "voucher", voucher.id);
  return serializeVoucher(voucher);
}

export async function updateVoucher(
  id: number,
  input: VoucherInput,
  userId: number,
  role: RoleName,
): Promise<VoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");
  if (existing.status !== "DRAFT") {
    throw new HttpError(423, "DOCUMENT_LOCKED", "Document is locked. An administrator can unlock it.");
  }
  await assertInvoiceExists(input.invoiceId);

  const manualNumber = role === "admin" ? input.number : undefined;

  const voucher = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.voucher.update({
        where: { id },
        data: {
          number: manualNumber ?? existing.number,
          watermarkEnabled: role === "admin" ? input.watermarkEnabled : existing.watermarkEnabled,
          date: toDate(input.date),
          invoiceId: input.invoiceId ?? null,
          receivedFrom: input.receivedFrom,
          amount: BigInt(input.amount),
          amountWords: resolvedWords(input),
          paymentFor: input.paymentFor,
          paymentMethod: input.paymentMethod,
          preparedBy: input.preparedBy,
          receivedByName: input.receivedByName,
          approvedBy: input.approvedBy,
          lang: input.lang,
          digitsMode: input.digitsMode,
        },
      });
      if (manualNumber !== undefined) await raiseCounter(tx, "voucher", manualNumber);
      const integrityHash = computeVoucherIntegrity(updated);
      await tx.voucher.update({ where: { id }, data: { integrityHash } });
      return { ...updated, integrityHash };
    },
    { timeout: 20_000 },
  );

  await audit(userId, "update", "voucher", id);
  return serializeVoucher(voucher);
}

export async function getVoucher(id: number): Promise<VoucherDto> {
  const voucher = await prisma.voucher.findUnique({ where: { id } });
  if (!voucher) throw new HttpError(404, "NOT_FOUND", "Voucher not found");
  return serializeVoucher(voucher);
}

export async function listVouchers(query: VoucherQuery): Promise<Paginated<VoucherDto>> {
  const where: Prisma.VoucherWhereInput = {
    deletedAt: query.includeDeleted ? undefined : null,
  };
  if (query.q) {
    const numeric = Number(query.q);
    const search: Prisma.VoucherWhereInput[] = [
      { receivedFrom: { contains: query.q, mode: "insensitive" } },
      { paymentFor: { contains: query.q, mode: "insensitive" } },
      { amountWords: { contains: query.q, mode: "insensitive" } },
      { preparedBy: { contains: query.q, mode: "insensitive" } },
      { receivedByName: { contains: query.q, mode: "insensitive" } },
    ];
    if (Number.isInteger(numeric) && numeric > 0) search.push({ number: numeric });
    where.OR = search;
  }
  if (query.from || query.to) {
    where.date = {
      gte: query.from ? toDate(query.from) : undefined,
      lte: query.to ? toDate(query.to) : undefined,
    };
  }

  const [total, rows] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(serializeVoucher),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function duplicateVoucher(id: number, userId: number, role: RoleName): Promise<VoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");

  const input: VoucherInput = {
    date: todayInBaghdad(),
    invoiceId: existing.invoiceId,
    receivedFrom: existing.receivedFrom,
    amount: Number(existing.amount),
    amountWords: "",
    wordsManuallyEdited: false,
    paymentFor: existing.paymentFor,
    paymentMethod: existing.paymentMethod as VoucherInput["paymentMethod"],
    preparedBy: existing.preparedBy,
    receivedByName: existing.receivedByName,
    approvedBy: existing.approvedBy,
    lang: existing.lang as VoucherInput["lang"],
    digitsMode: existing.digitsMode as VoucherInput["digitsMode"],
    watermarkEnabled: null,
  };
  return createVoucher(input, userId, role);
}

export async function softDeleteVoucher(id: number, userId: number): Promise<void> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");
  await prisma.voucher.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(userId, "delete", "voucher", id);
}

/** DRAFT → ISSUED on first print/PDF. Cancelled documents stay cancelled. */
export async function issueVoucher(id: number, userId: number): Promise<VoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");
  if (existing.status !== "DRAFT") return serializeVoucher(existing);

  const updated = await prisma.voucher.update({
    where: { id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      integrityHash: computeVoucherIntegrity(existing),
    },
  });
  await audit(userId, "issue", "voucher", id);
  return serializeVoucher(updated);
}

/** Admin-only: reopen a locked document for editing. */
export async function unlockVoucher(id: number, userId: number): Promise<VoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");

  const updated = await prisma.voucher.update({
    where: { id },
    data: { status: "DRAFT", issuedAt: null, cancelledAt: null, cancelReason: "" },
  });
  await audit(userId, "unlock", "voucher", id);
  return serializeVoucher(updated);
}

/** Admin-only: the document remains in the database with a cancelled stamp. */
export async function cancelVoucher(id: number, reason: string, userId: number): Promise<VoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Voucher not found");
  if (existing.status === "CANCELLED") return serializeVoucher(existing);

  const updated = await prisma.voucher.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  await audit(userId, "cancel", "voucher", id);
  return serializeVoucher(updated);
}
