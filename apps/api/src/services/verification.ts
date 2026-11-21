import { prisma } from "../db";
import { HttpError } from "../lib/http";
import {
  computeInvoiceIntegrity,
  computeVoucherIntegrity,
  integrityMatches,
  maskCustomerName,
  normalizeVerifyCode,
} from "./authenticity";

export interface PublicVerificationDto {
  type: "invoice" | "voucher";
  number: number;
  date: string;
  customer: string;
  total: number;
  status: "VALID" | "CANCELLED";
  integrity: "OK" | "MODIFIED";
  companyName: string;
}

const COMPANY_NAME = "Antika Factory";

export async function getPublicVerification(rawCode: string): Promise<PublicVerificationDto> {
  const code = normalizeVerifyCode(rawCode);

  const invoice = await prisma.invoice.findFirst({
    where: { verifyCode: code, deletedAt: null },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (invoice) {
    const integrity = integrityMatches(invoice.integrityHash, computeInvoiceIntegrity(invoice));
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { verifyCount: { increment: 1 }, lastVerifiedAt: new Date() },
    });
    return {
      type: "invoice",
      number: invoice.number,
      date: invoice.date.toISOString().slice(0, 10),
      customer: maskCustomerName(invoice.customerName),
      total: Number(invoice.total),
      status: invoice.status === "CANCELLED" ? "CANCELLED" : "VALID",
      integrity: integrity ? "OK" : "MODIFIED",
      companyName: COMPANY_NAME,
    };
  }

  const voucher = await prisma.voucher.findFirst({
    where: { verifyCode: code, deletedAt: null },
  });

  if (voucher) {
    const integrity = integrityMatches(voucher.integrityHash, computeVoucherIntegrity(voucher));
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { verifyCount: { increment: 1 }, lastVerifiedAt: new Date() },
    });
    return {
      type: "voucher",
      number: voucher.number,
      date: voucher.date.toISOString().slice(0, 10),
      customer: maskCustomerName(voucher.receivedFrom),
      total: Number(voucher.amount),
      status: voucher.status === "CANCELLED" ? "CANCELLED" : "VALID",
      integrity: integrity ? "OK" : "MODIFIED",
      companyName: COMPANY_NAME,
    };
  }

  // Identical response for malformed and unknown codes: no information leak.
  throw new HttpError(404, "NOT_FOUND", "Document not found");
}
