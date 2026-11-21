import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./db";
import { closePdfRenderer, warmUpPdfRenderer } from "./services/pdf";

const app = createApp();

const server = app.listen(config.API_PORT, () => {
  console.log(`[antika-api] listening on http://localhost:${config.API_PORT} (${config.NODE_ENV})`);
  warmUpPdfRenderer();
});

async function shutdown(signal: string) {
  console.log(`[antika-api] ${signal} received, shutting down`);
  server.close(async () => {
    await closePdfRenderer();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
