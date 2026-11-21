import { Router } from "express";
import { cancelDocumentSchema, invoiceInputSchema, invoiceQuerySchema } from "@antika/shared";
import { asyncHandler, HttpError, parseBody } from "../lib/http";
import { requireAdmin, requireAuth, requirePasswordChanged } from "../auth/middleware";
import { audit } from "../lib/audit";
import {
  cancelInvoice,
  createInvoice,
  duplicateInvoice,
  getInvoice,
  issueInvoice,
  listInvoices,
  softDeleteInvoice,
  unlockInvoice,
  updateInvoice,
} from "../services/invoices";
import { peekNextNumber } from "../services/counters";
import { renderPdf } from "../services/pdf";
import { config } from "../config";

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requirePasswordChanged);

invoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parseBody(invoiceQuerySchema, req.query);
    res.json(await listInvoices(query));
  }),
);

invoicesRouter.get(
  "/next-number",
  asyncHandler(async (_req, res) => {
    res.json({ number: await peekNextNumber("invoice") });
  }),
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    res.json({ invoice: await getInvoice(id) });
  }),
);

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(invoiceInputSchema, req.body);
    const invoice = await createInvoice(input, req.user!.id, req.user!.role);
    res.status(201).json({ invoice });
  }),
);

invoicesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    const input = parseBody(invoiceInputSchema, req.body);
    const invoice = await updateInvoice(id, input, req.user!.id, req.user!.role);
    res.json({ invoice });
  }),
);

invoicesRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    const invoice = await duplicateInvoice(id, req.user!.id, req.user!.role);
    res.status(201).json({ invoice });
  }),
);

invoicesRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    await softDeleteInvoice(id, req.user!.id);
    res.json({ ok: true });
  }),
);

invoicesRouter.post(
  "/:id/issue",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    res.json({ invoice: await issueInvoice(id, req.user!.id) });
  }),
);

invoicesRouter.post(
  "/:id/unlock",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    res.json({ invoice: await unlockInvoice(id, req.user!.id) });
  }),
);

invoicesRouter.post(
  "/:id/cancel",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    const input = parseBody(cancelDocumentSchema, req.body);
    res.json({ invoice: await cancelInvoice(id, input.reason, req.user!.id) });
  }),
);

invoicesRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid invoice id");
    const invoice = await issueInvoice(id, req.user!.id);
    const token = (req.cookies as Record<string, string | undefined>)[config.cookieName];
    if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

    const pdf = await renderPdf(`/print/invoice/${id}?pdf=1`, token, {
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    await audit(req.user!.id, "pdf", "invoice", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.number}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(pdf);
  }),
);
