import { Router } from "express";
import { requireAdmin, requireAuth, requirePasswordChanged } from "../auth/middleware";
import { asyncHandler } from "../lib/http";
import { getNumberGaps } from "../services/numberGaps";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePasswordChanged, requireAdmin);

reportsRouter.get(
  "/number-gaps",
  asyncHandler(async (_req, res) => {
    res.json(await getNumberGaps());
  }),
);
