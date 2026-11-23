import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./db";
import { closePdfRenderer, warmUpPdfRenderer } from "./services/pdf";

const app = createApp();

const port = Number(process.env.PORT || config.PORT || config.API_PORT || 4000);
const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`[antika-api] listening on http://${host}:${port} (${config.NODE_ENV})`);
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
