import {
  computeInvoiceTotals,
  todayInBaghdad,
  type InvoiceDto,
  type InvoiceInput,
  type InvoiceQuery,
  type InvoiceListItem,
  type Paginated,
  type Role,
} from "@antika/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../lib/http";
import { serializeInvoice } from "../lib/serialize";
import { audit } from "../lib/audit";
import { allocateNumber, raiseCounter } from "./counters";
import { getSettings } from "./settings";
import { computeInvoiceIntegrity } from "./authenticity";
import { allocateVerifyCode } from "./verifyCodes";

type Tx = Prisma.TransactionClient;
type RoleName = Role;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function resolveCustomer(
  tx: Tx,
  input: InvoiceInput,
): Promise<{ customerId: number | null; name: string; phone: string; address: string }> {
  let customer = input.customerId
    ? await tx.customer.findUnique({ where: { id: input.customerId } })
    : null;

  if (!customer && input.customerName) {
    customer = await tx.customer.findFirst({
      where: { name: { equals: input.customerName, mode: "insensitive" } },
    });
  }

  if (!customer && input.customerName && input.saveCustomer !== false) {
    customer = await tx.customer.create({
      data: {
        name: input.customerName,
        phone: input.customerPhone,
        address: input.customerAddress,
      },
    });
  }

  if (customer && input.saveCustomer !== false) {
    const nextPhone = input.customerPhone || customer.phone;
    const nextAddress = input.customerAddress || customer.address;
    if (nextPhone !== customer.phone || nextAddress !== customer.address) {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: { phone: nextPhone, address: nextAddress },
      });
    }
  }

  return {
    customerId: customer?.id ?? null,
    name: input.customerName || customer?.name || "",
    phone: input.customerPhone || customer?.phone || "",
    address: input.customerAddress || customer?.address || "",
  };
}

function itemsCreateData(items: InvoiceInput["items"]) {
  return items.map((item, index) => {
    const lineTotal = Math.max(
      0,
      Math.trunc(Number(item.qty) || 0) * Math.trunc(Number(item.price) || 0) -
        Math.min(Math.trunc(Number(item.discount) || 0), Math.trunc(Number(item.qty) || 0) * Math.trunc(Number(item.price) || 0)),
    );
    return {
      position: index,
      name: item.name,
      code: item.code,
      qty: Math.trunc(Number(item.qty) || 0),
      price: BigInt(Math.trunc(Number(item.price) || 0)),
      discount: BigInt(Math.trunc(Number(item.discount) || 0)),
      notes: item.notes,
      lineTotal: BigInt(lineTotal),
    };
  });
}

export async function createInvoice(
  input: InvoiceInput,
  userId: number,
  role: RoleName,
): Promise<InvoiceDto> {
  const settings = await getSettings();
  const totals = computeInvoiceTotals(input.items, input.advancePercent, input.finalPercent);
  const manualNumber = role === "admin" ? input.number : undefined;
  const verifyCode = await allocateVerifyCode();

  const invoice = await prisma.$transaction(
    async (tx) => {
      const customer = await resolveCustomer(tx, input);
      const number = manualNumber ?? (await allocateNumber(tx, "invoice", settings.defaults.invoiceStart));

      const created = await tx.invoice.create({
        data: {
          number,
          verifyCode,
          watermarkEnabled: role === "admin" ? input.watermarkEnabled : null,
          date: toDate(input.date),
          customerId: customer.customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          lang: input.lang,
          digitsMode: input.digitsMode,
          itemInfo: input.itemInfo,
          materialsText: input.materialsText,
          specialOffer: input.specialOffer,
          advancePercent: input.advancePercent,
          finalPercent: input.finalPercent,
          subtotal: BigInt(totals.subtotal),
          total: BigInt(totals.total),
          advanceAmount: BigInt(totals.advanceAmount),
          finalAmount: BigInt(totals.finalAmount),
          createdBy: userId,
          items: { create: itemsCreateData(input.items) },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (manualNumber !== undefined) await raiseCounter(tx, "invoice", manualNumber);
      const integrityHash = computeInvoiceIntegrity(created);
      await tx.invoice.update({ where: { id: created.id }, data: { integrityHash } });
      return { ...created, integrityHash };
    },
    { timeout: 20_000 },
  );

  await audit(userId, "create", "invoice", invoice.id);
  return serializeInvoice(invoice);
}

export async function updateInvoice(
  id: number,
  input: InvoiceInput,
  userId: number,
  role: RoleName,
): Promise<InvoiceDto> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (existing.status !== "DRAFT") {
    throw new HttpError(423, "DOCUMENT_LOCKED", "Document is locked. An administrator can unlock it.");
  }

  const totals = computeInvoiceTotals(input.items, input.advancePercent, input.finalPercent);
  const manualNumber = role === "admin" ? input.number : undefined;

  const invoice = await prisma.$transaction(
    async (tx) => {
      const customer = await resolveCustomer(tx, input);
      const number = manualNumber ?? existing.number;

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          number,
          watermarkEnabled: role === "admin" ? input.watermarkEnabled : existing.watermarkEnabled,
          date: toDate(input.date),
          customerId: customer.customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          lang: input.lang,
          digitsMode: input.digitsMode,
          itemInfo: input.itemInfo,
          materialsText: input.materialsText,
          specialOffer: input.specialOffer,
          advancePercent: input.advancePercent,
          finalPercent: input.finalPercent,
          subtotal: BigInt(totals.subtotal),
          total: BigInt(totals.total),
          advanceAmount: BigInt(totals.advanceAmount),
          finalAmount: BigInt(totals.finalAmount),
          items: { create: itemsCreateData(input.items) },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (manualNumber !== undefined) await raiseCounter(tx, "invoice", manualNumber);
      const integrityHash = computeInvoiceIntegrity(updated);
      await tx.invoice.update({ where: { id }, data: { integrityHash } });
      return { ...updated, integrityHash };
    },
    { timeout: 20_000 },
  );

  await audit(userId, "update", "invoice", id);
  return serializeInvoice(invoice);
}

export async function getInvoice(id: number): Promise<InvoiceDto> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  return serializeInvoice(invoice);
}

export async function listInvoices(query: InvoiceQuery): Promise<Paginated<InvoiceListItem>> {
  const where: Prisma.InvoiceWhereInput = {
    deletedAt: query.includeDeleted ? undefined : null,
  };
  if (query.q) {
    const numeric = Number(query.q);
    const search: Prisma.InvoiceWhereInput[] = [
      { customerName: { contains: query.q, mode: "insensitive" } },
      { customerPhone: { contains: query.q, mode: "insensitive" } },
      { itemInfo: { contains: query.q, mode: "insensitive" } },
      { materialsText: { contains: query.q, mode: "insensitive" } },
      { specialOffer: { contains: query.q, mode: "insensitive" } },
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
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const items = rows.map((row) => {
    const dto = serializeInvoice(row);
    const { items: rowItems, ...rest } = dto;
    return { ...rest, itemCount: rowItems.length } satisfies InvoiceListItem;
  });

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function duplicateInvoice(id: number, userId: number, role: RoleName): Promise<InvoiceDto> {
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");

  const input: InvoiceInput = {
    date: todayInBaghdad(),
    customerId: existing.customerId,
    customerName: existing.customerName,
    customerPhone: existing.customerPhone,
    customerAddress: existing.customerAddress,
    lang: existing.lang as InvoiceInput["lang"],
    digitsMode: existing.digitsMode as InvoiceInput["digitsMode"],
    itemInfo: existing.itemInfo,
    materialsText: existing.materialsText,
    specialOffer: existing.specialOffer,
    advancePercent: existing.advancePercent,
    finalPercent: existing.finalPercent,
    items: existing.items.map((item) => ({
      name: item.name,
      code: item.code,
      qty: item.qty,
      price: Number(item.price),
      discount: Number(item.discount),
      notes: item.notes,
    })),
    saveCustomer: false,
    watermarkEnabled: null,
  };
  return createInvoice(input, userId, role);
}

export async function softDeleteInvoice(id: number, userId: number): Promise<void> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(userId, "delete", "invoice", id);
}

const WITH_ITEMS = { items: { orderBy: { position: "asc" } } } as const;

/** DRAFT → ISSUED on first print/PDF. Cancelled documents stay cancelled. */
export async function issueInvoice(id: number, userId: number): Promise<InvoiceDto> {
  const existing = await prisma.invoice.findUnique({ where: { id }, include: WITH_ITEMS });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (existing.status !== "DRAFT") return serializeInvoice(existing);

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      integrityHash: computeInvoiceIntegrity(existing),
    },
    include: WITH_ITEMS,
  });
  await audit(userId, "issue", "invoice", id);
  return serializeInvoice(updated);
}

/** Admin-only: reopen a locked document for editing. */
export async function unlockInvoice(id: number, userId: number): Promise<InvoiceDto> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "DRAFT", issuedAt: null, cancelledAt: null, cancelReason: "" },
    include: WITH_ITEMS,
  });
  await audit(userId, "unlock", "invoice", id);
  return serializeInvoice(updated);
}

/** Admin-only: the document remains in the database with a cancelled stamp. */
export async function cancelInvoice(id: number, reason: string, userId: number): Promise<InvoiceDto> {
  const existing = await prisma.invoice.findUnique({ where: { id }, include: WITH_ITEMS });
  if (!existing || existing.deletedAt) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (existing.status === "CANCELLED") return serializeInvoice(existing);

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    include: WITH_ITEMS,
  });
  await audit(userId, "cancel", "invoice", id);
  return serializeInvoice(updated);
}
