import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { config } from "../config";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  sub: number;
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: `${config.JWT_EXPIRES_DAYS}d`,
    issuer: "antika-docs",
    audience: "antika-docs-web",
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET, {
    issuer: "antika-docs",
    audience: "antika-docs-web",
  });
  if (typeof decoded === "string" || typeof decoded.sub !== "number") {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub };
}

export function getCookieOptions() {
  const sameSite = config.COOKIE_SAME_SITE;
  const isSecure = sameSite === "none" ? true : config.COOKIE_SECURE;
  return {
    httpOnly: true,
    sameSite,
    secure: isSecure,
    path: "/",
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    ...getCookieOptions(),
    maxAge: config.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookieName, getCookieOptions());
}
