import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../apps/api/src/db";
import { allocateNumber } from "../../apps/api/src/services/counters";

const COUNTER = "vitest_concurrent_counter";

describe("atomic document counters", () => {
  beforeAll(async () => {
    await prisma.counter.deleteMany({ where: { name: COUNTER } });
  });

  afterAll(async () => {
    await prisma.counter.deleteMany({ where: { name: COUNTER } });
    await prisma.$disconnect();
  });

  it("gives 50 parallel requests 50 unique consecutive numbers", async () => {
    const requests = Array.from({ length: 50 }, () =>
      prisma.$transaction((tx) => allocateNumber(tx, COUNTER as "voucher", 1), {
        maxWait: 30_000,
        timeout: 30_000,
      }),
    );

    const numbers = await Promise.all(requests);
    const unique = new Set(numbers);

    expect(numbers).toHaveLength(50);
    expect(unique.size).toBe(50);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(50);

    const sorted = [...numbers].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));

    const stored = await prisma.counter.findUnique({ where: { name: COUNTER } });
    expect(stored?.value).toBe(50);
  });
});
