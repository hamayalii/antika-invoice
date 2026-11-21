import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, parseBody } from "../lib/http";
import { requireAuth, requirePasswordChanged } from "../auth/middleware";

export const customersRouter = Router();

customersRouter.use(requireAuth, requirePasswordChanged);

const querySchema = z.object({
  q: z.string().trim().max(120).default(""),
});

customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q } = parseBody(querySchema, req.query);
    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, phone: true, address: true },
    });
    res.json({ customers });
  }),
);
