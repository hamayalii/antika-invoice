import type { InvoiceDto, InvoiceItemDto, VoucherDto } from "@antika/shared";

export function isoDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

type InvoiceWithItems = {
  id: number;
  number: number;
  date: Date;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  lang: string;
  digitsMode: string;
  itemInfo: string;
  materialsText: string;
  specialOffer: string;
  advancePercent: number;
  finalPercent: number;
  subtotal: bigint;
  total: bigint;
  advanceAmount: bigint;
  finalAmount: bigint;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  verifyCode: string;
  status: string;
  issuedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string;
  verifyCount: number;
  lastVerifiedAt: Date | null;
  watermarkEnabled: boolean | null;
  items: Array<{
    id: number;
    position: number;
    name: string;
    code: string;
    qty: number;
    price: bigint;
    discount: bigint;
    notes: string;
    lineTotal: bigint;
  }>;
};

export function serializeInvoice(invoice: InvoiceWithItems): InvoiceDto {
  return {
    id: invoice.id,
    number: invoice.number,
    date: isoDate(invoice.date),
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    lang: invoice.lang as InvoiceDto["lang"],
    digitsMode: invoice.digitsMode as InvoiceDto["digitsMode"],
    itemInfo: invoice.itemInfo,
    materialsText: invoice.materialsText,
    specialOffer: invoice.specialOffer,
    advancePercent: invoice.advancePercent,
    finalPercent: invoice.finalPercent,
    subtotal: toNumber(invoice.subtotal),
    total: toNumber(invoice.total),
    advanceAmount: toNumber(invoice.advanceAmount),
    finalAmount: toNumber(invoice.finalAmount),
    createdBy: invoice.createdBy,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    deletedAt: invoice.deletedAt ? invoice.deletedAt.toISOString() : null,
    verifyCode: invoice.verifyCode,
    status: invoice.status as InvoiceDto["status"],
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
    cancelledAt: invoice.cancelledAt ? invoice.cancelledAt.toISOString() : null,
    cancelReason: invoice.cancelReason,
    verifyCount: invoice.verifyCount,
    lastVerifiedAt: invoice.lastVerifiedAt ? invoice.lastVerifiedAt.toISOString() : null,
    watermarkEnabled: invoice.watermarkEnabled,
    items: invoice.items.map(
      (item): InvoiceItemDto => ({
        id: item.id,
        position: item.position,
        name: item.name,
        code: item.code,
        qty: item.qty,
        price: toNumber(item.price),
        discount: toNumber(item.discount),
        notes: item.notes,
        lineTotal: toNumber(item.lineTotal),
      }),
    ),
  };
}

type VoucherRecord = {
  id: number;
  number: number;
  date: Date;
  invoiceId: number | null;
  receivedFrom: string;
  amount: bigint;
  amountWords: string;
  paymentFor: string;
  paymentMethod: string;
  preparedBy: string;
  receivedByName: string;
  approvedBy: string;
  lang: string;
  digitsMode: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  verifyCode: string;
  status: string;
  issuedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string;
  verifyCount: number;
  lastVerifiedAt: Date | null;
  watermarkEnabled: boolean | null;
};

export function serializeVoucher(voucher: VoucherRecord): VoucherDto {
  return {
    id: voucher.id,
    number: voucher.number,
    date: isoDate(voucher.date),
    invoiceId: voucher.invoiceId,
    receivedFrom: voucher.receivedFrom,
    amount: toNumber(voucher.amount),
    amountWords: voucher.amountWords,
    paymentFor: voucher.paymentFor,
    paymentMethod: voucher.paymentMethod as VoucherDto["paymentMethod"],
    preparedBy: voucher.preparedBy,
    receivedByName: voucher.receivedByName,
    approvedBy: voucher.approvedBy,
    lang: voucher.lang as VoucherDto["lang"],
    digitsMode: voucher.digitsMode as VoucherDto["digitsMode"],
    createdBy: voucher.createdBy,
    createdAt: voucher.createdAt.toISOString(),
    updatedAt: voucher.updatedAt.toISOString(),
    deletedAt: voucher.deletedAt ? voucher.deletedAt.toISOString() : null,
    verifyCode: voucher.verifyCode,
    status: voucher.status as VoucherDto["status"],
    issuedAt: voucher.issuedAt ? voucher.issuedAt.toISOString() : null,
    cancelledAt: voucher.cancelledAt ? voucher.cancelledAt.toISOString() : null,
    cancelReason: voucher.cancelReason,
    verifyCount: voucher.verifyCount,
    lastVerifiedAt: voucher.lastVerifiedAt ? voucher.lastVerifiedAt.toISOString() : null,
    watermarkEnabled: voucher.watermarkEnabled,
  };
}
