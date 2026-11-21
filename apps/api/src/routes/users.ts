import { Router } from "express";
import {
  adminResetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@antika/shared";
import { prisma } from "../db";
import { audit } from "../lib/audit";
import { asyncHandler, HttpError, parseBody } from "../lib/http";
import { hashPassword } from "../auth/tokens";
import { requireAdmin, requireAuth, requirePasswordChanged } from "../auth/middleware";

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePasswordChanged, requireAdmin);

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  mustChangePassword: true,
  active: true,
  createdAt: true,
} as const;

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ active: "desc" }, { username: "asc" }],
    });
    res.json({ users });
  }),
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(userCreateSchema, req.body);
    const exists = await prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw new HttpError(409, "USERNAME_TAKEN", "Username already exists");

    const user = await prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        mustChangePassword: true,
      },
      select: userSelect,
    });
    await audit(req.user!.id, "create", "user", user.id);
    res.status(201).json({ user });
  }),
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid user id");
    const input = parseBody(userUpdateSchema, req.body);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "NOT_FOUND", "User not found");

    const removingAdmin =
      target.role === "admin" &&
      ((input.role !== undefined && input.role !== "admin") || input.active === false);
    if (removingAdmin) {
      const otherAdmins = await prisma.user.count({
        where: { role: "admin", active: true, id: { not: id } },
      });
      if (otherAdmins === 0) {
        throw new HttpError(400, "LAST_ADMIN", "The last active administrator cannot be changed");
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        role: input.role,
        mustChangePassword: input.mustChangePassword,
        active: input.active,
      },
      select: userSelect,
    });
    await audit(req.user!.id, "update", "user", user.id);
    res.json({ user });
  }),
);

usersRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid user id");
    const input = parseBody(adminResetPasswordSchema, req.body);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "NOT_FOUND", "User not found");

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: true,
        active: true,
      },
    });
    await audit(req.user!.id, "reset_password", "user", id);
    res.json({ ok: true });
  }),
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "INVALID_ID", "Invalid user id");
    if (id === req.user!.id) throw new HttpError(400, "CANNOT_DELETE_SELF", "You cannot deactivate yourself");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "NOT_FOUND", "User not found");
    if (target.role === "admin") {
      const otherAdmins = await prisma.user.count({
        where: { role: "admin", active: true, id: { not: id } },
      });
      if (otherAdmins === 0) throw new HttpError(400, "LAST_ADMIN", "The last active administrator cannot be deactivated");
    }

    await prisma.user.update({ where: { id }, data: { active: false } });
    await audit(req.user!.id, "deactivate", "user", id);
    res.json({ ok: true });
  }),
);
