import { Router } from "express";
import { cancelDocumentSchema, voucherInputSchema, voucherQuerySchema } from "@antika/shared";
import { asyncHandler, HttpError, parseBody } from "../lib/http";
import { requireAdmin, requireAuth, requirePasswordChanged } from "../auth/middleware";
import { audit } from "../lib/audit";
import {
  cancelVoucher,
  createVoucher,
  duplicateVoucher,
  getVoucher,
  issueVoucher,
  listVouchers,
  softDeleteVoucher,
  unlockVoucher,
  updateVoucher,
} from "../services/vouchers";
import { peekNextNumber } from "../services/counters";
import { renderPdf } from "../services/pdf";
import { getSettings } from "../services/settings";
import { config } from "../config";

export const vouchersRouter = Router();

vouchersRouter.use(requireAuth, requirePasswordChanged);

function voucherId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid voucher id");
  return id;
}

vouchersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parseBody(voucherQuerySchema, req.query);
    res.json(await listVouchers(query));
  }),
);

vouchersRouter.get(
  "/next-number",
  asyncHandler(async (_req, res) => {
    res.json({ number: await peekNextNumber("voucher") });
  }),
);

vouchersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ voucher: await getVoucher(voucherId(req.params.id)) });
  }),
);

vouchersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(voucherInputSchema, req.body);
    const voucher = await createVoucher(input, req.user!.id, req.user!.role);
    res.status(201).json({ voucher });
  }),
);

vouchersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(voucherInputSchema, req.body);
    const voucher = await updateVoucher(voucherId(req.params.id), input, req.user!.id, req.user!.role);
    res.json({ voucher });
  }),
);

vouchersRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const voucher = await duplicateVoucher(voucherId(req.params.id), req.user!.id, req.user!.role);
    res.status(201).json({ voucher });
  }),
);

vouchersRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await softDeleteVoucher(voucherId(req.params.id), req.user!.id);
    res.json({ ok: true });
  }),
);

vouchersRouter.post(
  "/:id/issue",
  asyncHandler(async (req, res) => {
    res.json({ voucher: await issueVoucher(voucherId(req.params.id), req.user!.id) });
  }),
);

vouchersRouter.post(
  "/:id/unlock",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ voucher: await unlockVoucher(voucherId(req.params.id), req.user!.id) });
  }),
);

vouchersRouter.post(
  "/:id/cancel",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = parseBody(cancelDocumentSchema, req.body);
    res.json({ voucher: await cancelVoucher(voucherId(req.params.id), input.reason, req.user!.id) });
  }),
);

vouchersRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const id = voucherId(req.params.id);
    const voucher = await issueVoucher(id, req.user!.id);
    const token = (req.cookies as Record<string, string | undefined>)[config.cookieName];
    if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

    const settings = await getSettings();
    const twoUp =
      req.query.imposition === "2up" && settings.defaults.voucherPage === "A5_landscape";
    const page = twoUp
      ? { pageWidthMm: 210, pageHeightMm: 297 }
      : settings.defaults.voucherPage === "A4_landscape"
        ? { pageWidthMm: 297, pageHeightMm: 210 }
        : { pageWidthMm: 210, pageHeightMm: 148 };
    const query = twoUp ? "?pdf=1&imposition=2up" : "?pdf=1";

    const pdf = await renderPdf(`/print/voucher/${id}${query}`, token, page);
    await audit(req.user!.id, "pdf", "voucher", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="voucher-${voucher.number}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(pdf);
  }),
);
