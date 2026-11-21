import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { prisma } from "../../apps/api/src/db";
import {
  computeVoucherIntegrity,
  generateVerifyCode,
} from "../../apps/api/src/services/authenticity";

const app = createApp();
// Give each test its own per-IP rate-limit bucket through X-Forwarded-For.
app.set("trust proxy", 1);
let server!: Server;
let baseUrl!: string;
let userId!: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  const admin = await prisma.user.findFirstOrThrow({ orderBy: { id: "asc" } });
  userId = admin.id;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await prisma.$disconnect();
});

async function verify(code: string, ip = "10.1.0.1") {
  const response = await fetch(`${baseUrl}/api/verify/${encodeURIComponent(code)}`, {
    headers: { "X-Forwarded-For": ip },
  });
  const body = await response.json();
  return { status: response.status, body };
}

describe("public verification endpoint", () => {
  // This test runs first so the per-IP counter starts at zero in this worker.
  it("allows 30 lookups per minute and then answers 429", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      const result = await verify("AAAA-BBBB-CCCC", "10.9.9.9");
      statuses.push(result.status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 404)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it("returns an identical 404 body for unknown and malformed codes", async () => {
    const unknown = await verify("ZZZZ-ZZZZ-ZZZZ");
    const malformed = await verify("not-a-code");
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
    expect(unknown.body).toEqual(malformed.body);
    expect(unknown.body).toEqual({ error: { code: "NOT_FOUND", message: "Document not found" } });
  });

  it("verifies a real document, hides personal data, counts the lookup and detects tampering", async () => {
    const verifyCode = generateVerifyCode();
    const record = {
      number: 990_001,
      date: new Date(Date.UTC(2026, 10, 20)),
      receivedFrom: "Slemani Cement Company",
      amount: 250_000n,
      verifyCode,
    };
    const created = await prisma.voucher.create({
      data: {
        number: record.number,
        date: record.date,
        receivedFrom: record.receivedFrom,
        amount: record.amount,
        amountWords: "two hundred fifty thousand",
        paymentFor: "test",
        preparedBy: "test",
        createdBy: userId,
        verifyCode,
        status: "ISSUED",
        issuedAt: new Date(),
        integrityHash: computeVoucherIntegrity(record),
      },
    });

    try {
      const ok = await verify(verifyCode);
      expect(ok.status).toBe(200);
      expect(Object.keys(ok.body.verification).sort()).toEqual(
        ["companyName", "customer", "date", "integrity", "number", "status", "total", "type"].sort(),
      );
      expect(ok.body.verification).toMatchObject({
        type: "voucher",
        number: 990_001,
        date: "2026-11-20",
        customer: "Sle*** Ce*** Co***",
        total: 250_000,
        status: "VALID",
        integrity: "OK",
      });
      expect(JSON.stringify(ok.body)).not.toContain("250000000");
      expect(JSON.stringify(ok.body)).not.toContain("test");

      const counted = await prisma.voucher.findUniqueOrThrow({ where: { id: created.id } });
      expect(counted.verifyCount).toBe(1);
      expect(counted.lastVerifiedAt).not.toBeNull();

      // Directly editing the row must flip the public integrity result.
      await prisma.voucher.update({ where: { id: created.id }, data: { amount: 999_999n } });
      const tampered = await verify(verifyCode);
      expect(tampered.status).toBe(200);
      expect(tampered.body.verification.integrity).toBe("MODIFIED");
      expect(tampered.body.verification.status).toBe("VALID");
    } finally {
      await prisma.voucher.delete({ where: { id: created.id } });
    }
  });

  it("reports a cancelled document without leaking personal data", async () => {
    const verifyCode = generateVerifyCode();
    const record = {
      number: 990_002,
      date: new Date(Date.UTC(2026, 10, 20)),
      receivedFrom: "Karwan Ahmed",
      amount: 100_000n,
      verifyCode,
    };
    const created = await prisma.voucher.create({
      data: {
        number: record.number,
        date: record.date,
        receivedFrom: record.receivedFrom,
        amount: record.amount,
        amountWords: "one hundred thousand",
        preparedBy: "test",
        createdBy: userId,
        verifyCode,
        status: "CANCELLED",
        issuedAt: new Date(),
        cancelledAt: new Date(),
        cancelReason: "duplicate",
        integrityHash: computeVoucherIntegrity(record),
      },
    });

    try {
      const result = await verify(verifyCode);
      expect(result.status).toBe(200);
      expect(result.body.verification.status).toBe("CANCELLED");
      expect(result.body.verification.customer).toBe("Kar*** Ah***");
      expect(JSON.stringify(result.body)).not.toContain("duplicate");
    } finally {
      await prisma.voucher.delete({ where: { id: created.id } });
    }
  });
});
