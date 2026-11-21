/**
 * Bootstrap the initial admin user from environment variables.
 *
 * Reads ADMIN_USERNAME (default "admin"), ADMIN_PASSWORD (required, min 8
 * characters) and ADMIN_FULL_NAME (default "Antika Administrator"). If no user
 * with that username exists, it is created with the admin role. If the user
 * already exists, nothing is changed and the existing password is never
 * overwritten, so this script is safe to run on every deploy.
 *
 * Plain CommonJS so it runs with `node` without a build step:
 *   node apps/api/scripts/bootstrap-admin.js
 */
"use strict";

const path = require("node:path");
const fs = require("node:fs");

// Load a local .env if present (same lookup as src/config.ts). Variables that
// are already set in the environment are never overridden.
try {
  const dotenv = require("dotenv");
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
} catch (_err) {
  // dotenv is optional here; production relies on real environment variables.
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

// Must match BCRYPT_ROUNDS in src/auth/tokens.ts.
const BCRYPT_ROUNDS = 12;

async function main() {
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME || "Antika Administrator";

  if (!username) {
    console.error("bootstrap-admin: ADMIN_USERNAME must not be empty.");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("bootstrap-admin: ADMIN_PASSWORD is missing or shorter than 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ log: ["error"] });
  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.log(`bootstrap-admin: user "${username}" already exists, nothing to do.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.create({
      data: {
        username,
        fullName,
        role: "admin",
        passwordHash,
        active: true,
        mustChangePassword: false,
      },
    });
    console.log(`bootstrap-admin: created admin user "${username}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    const message = err && err.message ? err.message : String(err);
    console.error(`bootstrap-admin: failed: ${message}`);
    process.exit(1);
  });
