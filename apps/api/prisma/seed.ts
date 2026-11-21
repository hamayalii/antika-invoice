import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS, todayInBaghdad } from "@antika/shared";
import {
  computeInvoiceIntegrity,
  computeVoucherIntegrity,
  generateVerifyCode,
} from "../src/services/authenticity";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!1234";
  const fullName = process.env.ADMIN_FULL_NAME ?? "Antika Administrator";

  const existingAdmin = await prisma.user.findUnique({ where: { username } });
  const admin =
    existingAdmin ??
    (await prisma.user.create({
      data: {
        username,
        fullName,
        role: "admin",
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
      },
    }));
  console.log(`[seed] admin user: ${admin.username} (${existingAdmin ? "existing" : "created"})`);

  const defaults = {
    ...DEFAULT_SETTINGS.defaults,
    voucherPage: process.env.VOUCHER_PAGE === "A4_landscape" ? "A4_landscape" : "A5_landscape",
  };

  await prisma.setting.createMany({
    data: [
      { key: "company", value: DEFAULT_SETTINGS.company as unknown as object },
      { key: "assets", value: DEFAULT_SETTINGS.assets as unknown as object },
      { key: "defaults", value: defaults as unknown as object },
      { key: "security", value: DEFAULT_SETTINGS.security as unknown as object },
    ],
    skipDuplicates: true,
  });

  await prisma.$executeRaw`
    INSERT INTO counters (name, value) VALUES ('invoice', 1000)
    ON CONFLICT (name) DO NOTHING
  `;
  await prisma.$executeRaw`
    INSERT INTO counters (name, value) VALUES ('voucher', 0)
    ON CONFLICT (name) DO NOTHING
  `;

  let customer = await prisma.customer.findFirst({ where: { name: "Slemani cement" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: "Slemani cement", phone: "", address: "سلێمانی" },
    });
  }

  const sampleInvoice = await prisma.invoice.findUnique({ where: { number: 1010 } });
  if (!sampleInvoice) {
    const date = new Date("2026-10-27T00:00:00.000Z");
    const verifyCode = generateVerifyCode();
    const integrityHash = computeInvoiceIntegrity({
      number: 1010,
      date,
      customerName: "Slemani cement",
      total: 4_750_000n,
      verifyCode,
      items: [
        {
          position: 0,
          name: "دیزاین و جێبەجێکردنی کەپری واجیهە",
          code: "ANT-1010",
          qty: 1,
          price: 4_750_000n,
          discount: 0n,
          lineTotal: 4_750_000n,
        },
      ],
    });
    const invoice = await prisma.invoice.create({
      data: {
        number: 1010,
        date,
        verifyCode,
        integrityHash,
        customerId: customer.id,
        customerName: "Slemani cement",
        customerPhone: "",
        customerAddress: "سلێمانی",
        lang: "ku",
        digitsMode: "eastern",
        itemInfo:
          "دیزاین و جێبەجێکردنی کەپری واجیهە بە ستایلی مۆدێرن (Modern Façade Canopy).",
        materialsText:
          "بەکارهێنانی هایەکەڵی ناسنی (Steel Structure) و (Laminated Glass) و بەکارهێنانی (stainless Steel) وەهەروەها تەخلیفکردنی بەشی ژێرەوەی بە دیۆکری تەختە.",
        specialOffer: "",
        advancePercent: 60,
        finalPercent: 40,
        subtotal: 4_750_000n,
        total: 4_750_000n,
        advanceAmount: 2_850_000n,
        finalAmount: 1_900_000n,
        createdBy: admin.id,
        items: {
          create: [
            {
              position: 0,
              name: "دیزاین و جێبەجێکردنی کەپری واجیهە",
              code: "ANT-1010",
              qty: 1,
              price: 4_750_000n,
              discount: 0n,
              notes: "Modern Façade Canopy",
              lineTotal: 4_750_000n,
            },
          ],
        },
      },
    });
    console.log(`[seed] sample invoice #${invoice.number}`);
  } else {
    if (!sampleInvoice.integrityHash) {
      const items = await prisma.invoiceItem.findMany({
        where: { invoiceId: sampleInvoice.id },
        orderBy: { position: "asc" },
      });
      const verifyCode = sampleInvoice.verifyCode || generateVerifyCode();
      await prisma.invoice.update({
        where: { id: sampleInvoice.id },
        data: {
          verifyCode,
          integrityHash: computeInvoiceIntegrity({ ...sampleInvoice, verifyCode, items }),
        },
      });
    }
    console.log("[seed] sample invoice #1010 already exists");
  }

  const sampleVoucher = await prisma.voucher.findUnique({ where: { number: 1 } });
  if (!sampleVoucher) {
    const date = new Date(`${todayInBaghdad()}T00:00:00.000Z`);
    const verifyCode = generateVerifyCode();
    const voucher = await prisma.voucher.create({
      data: {
        number: 1,
        date,
        verifyCode,
        integrityHash: computeVoucherIntegrity({
          number: 1,
          date,
          receivedFrom: "",
          amount: 0n,
          verifyCode,
        }),
        receivedFrom: "",
        amount: 0n,
        amountWords: "",
        paymentFor: "",
        paymentMethod: "cash",
        preparedBy: "",
        receivedByName: "",
        approvedBy: "",
        lang: "ar",
        digitsMode: "latin",
        createdBy: admin.id,
      },
    });
    console.log(`[seed] sample voucher #${voucher.number}`);
  } else {
    if (!sampleVoucher.integrityHash) {
      const verifyCode = sampleVoucher.verifyCode || generateVerifyCode();
      await prisma.voucher.update({
        where: { id: sampleVoucher.id },
        data: {
          verifyCode,
          integrityHash: computeVoucherIntegrity({ ...sampleVoucher, verifyCode }),
        },
      });
    }
    console.log("[seed] sample voucher #1 already exists");
  }

  await prisma.$executeRaw`
    INSERT INTO counters (name, value) VALUES ('invoice', 1010)
    ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, 1010)
  `;
  await prisma.$executeRaw`
    INSERT INTO counters (name, value) VALUES ('voucher', 1)
    ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, 1)
  `;

  console.log("[seed] done");
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
