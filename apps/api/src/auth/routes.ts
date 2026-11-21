import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { changePasswordSchema, loginSchema } from "@antika/shared";
import { prisma } from "../db";
import { audit } from "../lib/audit";
import { asyncHandler, HttpError, parseBody } from "../lib/http";
import { requireAuth } from "./middleware";
import { clearAuthCookie, hashPassword, setAuthCookie, signToken, verifyPassword } from "./tokens";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many login attempts. Try again later." } },
});

const dummyHash = bcrypt.hashSync("not-a-real-password", 10);

function publicUser(user: {
  id: number;
  username: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid || !user.active) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }
    setAuthCookie(res, signToken(user.id));
    await audit(user.id, "login", "user", user.id);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.user) await audit(req.user.id, "logout", "user", req.user.id);
    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user!) });
  }),
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = parseBody(changePasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw new HttpError(400, "PASSWORD_UNCHANGED", "New password must be different");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
      },
    });
    await audit(user.id, "change_password", "user", user.id);
    setAuthCookie(res, signToken(user.id));
    res.json({ ok: true, user: publicUser({ ...user, mustChangePassword: false }) });
  }),
);
