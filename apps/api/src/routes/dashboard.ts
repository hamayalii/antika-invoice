import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePasswordChanged } from "../auth/middleware";
import { serializeInvoice, serializeVoucher } from "../lib/serialize";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePasswordChanged);

dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [invoiceCount, voucherCount, customerCount, invoices, vouchers] = await Promise.all([
      prisma.invoice.count({ where: { deletedAt: null } }),
      prisma.voucher.count({ where: { deletedAt: null } }),
      prisma.customer.count(),
      prisma.invoice.findMany({
        where: { deletedAt: null },
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: [{ date: "desc" }, { number: "desc" }],
        take: 5,
      }),
      prisma.voucher.findMany({
        where: { deletedAt: null },
        orderBy: [{ date: "desc" }, { number: "desc" }],
        take: 5,
      }),
    ]);

    res.json({
      counts: { invoices: invoiceCount, vouchers: voucherCount, customers: customerCount },
      invoices: invoices.map(serializeInvoice),
      vouchers: vouchers.map(serializeVoucher),
    });
  }),
);
