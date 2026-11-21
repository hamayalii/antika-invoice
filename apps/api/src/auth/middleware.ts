import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { HttpError } from "../lib/http";
import { verifyToken } from "./tokens";
import { config } from "../config";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[config.cookieName];
    if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

    let userId: number;
    try {
      userId = verifyToken(token).sub;
    } catch {
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid or expired session");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        mustChangePassword: true,
        active: true,
      },
    });
    if (!user || !user.active) {
      throw new HttpError(401, "UNAUTHENTICATED", "Account is not available");
    }
    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** Blocks every API feature until the first-login password change has been completed. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new HttpError(401, "UNAUTHENTICATED", "Authentication required"));
  if (req.user.mustChangePassword) {
    return next(
      new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "You must change your password first"),
    );
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new HttpError(401, "UNAUTHENTICATED", "Authentication required"));
  if (req.user.role !== "admin") {
    return next(new HttpError(403, "FORBIDDEN", "Administrator access required"));
  }
  next();
}
