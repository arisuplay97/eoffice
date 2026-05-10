import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAIL"
  | "LOGIN_LOCKED"
  | "LOGOUT"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "ROLE_CHANGED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "UNIT_CREATED"
  | "UNIT_UPDATED"
  | "UNIT_DEACTIVATED"
  | "SURAT_MASUK_CREATED"
  | "SURAT_MASUK_UPDATED"
  | "SURAT_MASUK_DELETED"
  | "SURAT_MASUK_ARCHIVED"
  | "SURAT_KELUAR_CREATED"
  | "SURAT_KELUAR_UPDATED"
  | "SURAT_KELUAR_DELETED"
  | "DISPOSISI_CREATED"
  | "DISPOSISI_FORWARDED"
  | "DISPOSISI_UPDATED"
  | "DISPOSISI_FINISHED"
  | "DISPOSISI_REJECTED"
  | "FILE_UPLOADED"
  | "FILE_DOWNLOADED"
  | "QR_VERIFY_OPENED"
  | "ACCESS_DENIED"
  | "RATE_LIMITED";

export function getClientInfo() {
  try {
    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    const ua = h.get("user-agent") || null;
    return { ip, ua };
  } catch {
    return { ip: null as string | null, ua: null as string | null };
  }
}

export async function audit(args: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  ua?: string | null;
}) {
  try {
    const ctx = args.ip || args.ua ? { ip: args.ip ?? null, ua: args.ua ?? null } : getClientInfo();
    await prisma.auditLog.create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        ipAddress: (args.ip ?? ctx.ip) || null,
        userAgent: ((args.ua ?? ctx.ua) || "").slice(0, 500) || null,
        description: args.description ?? null,
        metadata: args.metadata
          ? JSON.stringify(args.metadata).slice(0, 2000)
          : null,
      },
    });
  } catch (e) {
    // Never fail the request because audit failed
    console.error("[audit] failed", e);
  }
}
