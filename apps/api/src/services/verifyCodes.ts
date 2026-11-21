import { prisma } from "../db";
import { generateVerifyCode } from "./authenticity";

/** Codes are unique across both document tables. */
export async function allocateVerifyCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateVerifyCode();
    const [invoice, voucher] = await Promise.all([
      prisma.invoice.findUnique({ where: { verifyCode: code }, select: { id: true } }),
      prisma.voucher.findUnique({ where: { verifyCode: code }, select: { id: true } }),
    ]);
    if (!invoice && !voucher) return code;
  }
  throw new Error("Could not allocate a unique verification code");
}
