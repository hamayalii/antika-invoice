import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/http";
import { getPublicVerification } from "../services/verification";

export const verifyRouter = Router();

/** 30 lookups per minute per IP; malformed and unknown codes share one 404 shape. */
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Too many verification attempts. Try again later." },
  },
});

verifyRouter.get(
  "/:code",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const verification = await getPublicVerification(req.params.code);
    res.setHeader("Cache-Control", "no-store");
    res.json({ verification });
  }),
);
