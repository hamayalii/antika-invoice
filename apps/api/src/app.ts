import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config";
import { prisma } from "./db";
import { authRouter } from "./auth/routes";
import { usersRouter } from "./routes/users";
import { settingsRouter } from "./routes/settings";
import { invoicesRouter } from "./routes/invoices";
import { vouchersRouter } from "./routes/vouchers";
import { customersRouter } from "./routes/customers";
import { dashboardRouter } from "./routes/dashboard";
import { verifyRouter } from "./routes/verify";
import { qrRouter } from "./routes/qr";
import { reportsRouter } from "./routes/reports";
import { errorHandler, notFoundHandler } from "./lib/http";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const allowedOrigins = new Set<string>();
  const registerOrigins = (raw?: string) => {
    if (!raw) return;
    for (const item of raw.split(",")) {
      const normalized = item.trim().replace(/\/+$/, "");
      if (normalized) allowedOrigins.add(normalized);
    }
  };

  registerOrigins(config.APP_ORIGIN);
  registerOrigins(config.CORS_ALLOWED_ORIGINS);
  registerOrigins("https://antika-invoice.netlify.app");
  registerOrigins("http://localhost:5173");
  registerOrigins("http://127.0.0.1:5173");
  registerOrigins("http://localhost:4173");
  registerOrigins("http://127.0.0.1:4173");
  registerOrigins("http://localhost:3000");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalized = origin.trim().replace(/\/+$/, "");
        if (allowedOrigins.has(normalized)) {
          return callback(null, true);
        }
        if (/^https:\/\/[a-z0-9-]+--antika-invoice\.netlify\.app$/.test(normalized)) {
          return callback(null, true);
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  const healthHandler = async (_req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        time: new Date().toISOString(),
        version: "1.0.0",
        services: { database: "connected" },
      });
    } catch {
      res.status(503).json({
        status: "unavailable",
        time: new Date().toISOString(),
        services: { database: "disconnected" },
      });
    }
  };

  app.get("/", (_req, res) => {
    res.json({
      name: "antika-api",
      status: "ok",
      version: "1.0.0",
      description: "Antika Invoice & Voucher API",
      health: "/api/health",
    });
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/vouchers", vouchersRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/verify", verifyRouter);
  app.use("/api/qr", qrRouter);
  app.use("/api/reports", reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
