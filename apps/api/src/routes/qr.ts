import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http";
import { isValidVerifyCode, normalizeVerifyCode } from "../services/authenticity";
import { renderVerificationQrSvg } from "../services/qr";

export const qrRouter = Router();

qrRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = normalizeVerifyCode(req.params.code);
    if (!isValidVerifyCode(code)) throw new HttpError(404, "NOT_FOUND", "QR code not found");

    const svg = await renderVerificationQrSvg(code);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(svg);
  }),
);
