import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../.env"),
];
for (const file of candidates) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  APP_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  PUBLIC_BASE_URL: z.string().url().optional(),
  WEB_BASE_URL: z.string().min(1).optional(),
  DOC_HMAC_SECRET: z.string().min(32).optional(),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? process.env.NODE_ENV === "production" : v === "true")),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  VOUCHER_PAGE: z.enum(["A5_landscape", "A4_landscape"]).default("A5_landscape"),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe!1234"),
  ADMIN_FULL_NAME: z.string().default("Antika Administrator"),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PDF_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(45000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${message}`);
}

const env = parsed.data;

export const config = {
  ...env,
  WEB_BASE_URL: env.WEB_BASE_URL ?? env.APP_ORIGIN,
  PUBLIC_BASE_URL: env.PUBLIC_BASE_URL ?? env.APP_ORIGIN,
  DOC_HMAC_SECRET: env.DOC_HMAC_SECRET ?? env.JWT_SECRET,
  isProduction: env.NODE_ENV === "production",
  cookieName: "antika_token",
  uploadsDir: path.resolve(process.cwd(), "uploads"),
};

export type AppConfig = typeof config;
