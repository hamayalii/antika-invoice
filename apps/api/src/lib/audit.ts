import { prisma } from "../db";

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId === undefined || entityId === null ? null : String(entityId),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}
