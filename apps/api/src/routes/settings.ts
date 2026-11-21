import { Router } from "express";
import { settingsSchema } from "@antika/shared";
import { audit } from "../lib/audit";
import { asyncHandler, parseBody } from "../lib/http";
import { requireAdmin, requireAuth, requirePasswordChanged } from "../auth/middleware";
import { getSettings, updateSettings } from "../services/settings";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

settingsRouter.put(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = parseBody(settingsSchema, req.body);
    const settings = await updateSettings(input);
    await audit(req.user!.id, "update", "settings", "global");
    res.json({ settings });
  }),
);
