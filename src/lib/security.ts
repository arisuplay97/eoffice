import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

/**
 * CSRF same-origin enforcement untuk state-changing request.
 *
 * Karena kita pakai cookie-based session (httpOnly, SameSite=Lax),
 * SameSite=Lax sudah memblokir CSRF dari cross-site form submit untuk POST.
 * Tambahan lapis kedua: cek Origin / Referer header pada mutation.
 */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  const allowed = new Set<string>();
  const envOrigins = process.env.ALLOWED_ORIGINS || "";
  for (const o of envOrigins.split(",").map((s) => s.trim()).filter(Boolean)) {
    allowed.add(stripTrailingSlash(o));
  }
  if (process.env.NEXT_PUBLIC_APP_URL)
    allowed.add(stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL));
  if (host) {
    // Accept same host over http/https (dev)
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }

  const check = (value: string | null) => {
    if (!value) return false;
    try {
      const u = new URL(value);
      return allowed.has(`${u.protocol}//${u.host}`);
    } catch {
      return false;
    }
  };

  if (origin && check(origin)) return;
  if (!origin && referer && check(referer)) return;

  throw new Response(
    JSON.stringify({ ok: false, error: "Origin tidak diizinkan" }),
    { status: 403, headers: { "content-type": "application/json" } }
  );
}

function stripTrailingSlash(s: string) {
  return s.replace(/\/$/, "");
}

/**
 * Sanitasi input text untuk disimpan ke DB.
 * Tidak strip semua HTML (user boleh pakai tanda < >), tapi:
 *  - trim
 *  - batasi panjang
 *  - hapus kontrol karakter
 * React sudah auto-escape saat render; cukup pastikan tidak ada null byte
 * atau karakter berbahaya untuk storage.
 */
export function cleanText(
  v: unknown,
  opts: { max?: number; allowNewline?: boolean } = {}
): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  let out = s.replace(/\u0000/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (!opts.allowNewline) out = out.replace(/[\r\n]+/g, " ");
  out = out.trim();
  if (opts.max && out.length > opts.max) out = out.slice(0, opts.max);
  return out;
}

/**
 * Ownership helpers untuk mutation di API.
 */
export type DisposisiOwnershipCheck = {
  id: string;
  fromUserId: string;
  toUserId: string | null;
  toUnitId: string | null;
};

export function canViewDisposisi(user: SessionUser, d: DisposisiOwnershipCheck): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "DIREKSI") return true;
  if (d.fromUserId === user.id) return true;
  if (d.toUserId && d.toUserId === user.id) return true;
  if (!d.toUserId && d.toUnitId && user.unitId && d.toUnitId === user.unitId) return true;
  return false;
}

export function canMutateDisposisi(user: SessionUser, d: DisposisiOwnershipCheck): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  // Penerima (atau anggota unit penerima) boleh update status.
  if (d.toUserId === user.id) return true;
  if (!d.toUserId && d.toUnitId && user.unitId && d.toUnitId === user.unitId) return true;
  // Pengirim boleh teruskan/cancel.
  if (d.fromUserId === user.id) return true;
  return false;
}

export type SuratMasukOwnershipCheck = {
  id: string;
  createdById: string;
  unitTujuanId: string | null;
};

/**
 * View surat masuk diperbolehkan kalau:
 *  - Admin / Direksi / Sekretariat (scope luas).
 *  - Unit user = unit tujuan.
 *  - User adalah pembuat.
 *  - User adalah penerima/pengirim disposisi dari surat tsb (dicek terpisah saat perlu).
 */
export function canViewSuratMasukBasic(user: SessionUser, s: SuratMasukOwnershipCheck): boolean {
  if (["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(user.role)) return true;
  if (s.createdById === user.id) return true;
  if (s.unitTujuanId && user.unitId && s.unitTujuanId === user.unitId) return true;
  return false;
}

export async function canViewSuratMasuk(user: SessionUser, suratMasukId: string): Promise<boolean> {
  const s = await prisma.suratMasuk.findUnique({
    where: { id: suratMasukId },
    select: { id: true, createdById: true, unitTujuanId: true },
  });
  if (!s) return false;
  if (canViewSuratMasukBasic(user, s)) return true;
  // Cek relasi disposisi (user atau unit user jadi penerima / pengirim)
  const related = await prisma.disposisi.count({
    where: {
      suratMasukId,
      OR: [
        { fromUserId: user.id },
        { toUserId: user.id },
        ...(user.unitId ? [{ toUnitId: user.unitId }] : []),
      ],
    },
  });
  return related > 0;
}

export type SuratKeluarOwnershipCheck = {
  id: string;
  createdById: string;
  unitPembuatId: string | null;
};

export function canViewSuratKeluar(user: SessionUser, s: SuratKeluarOwnershipCheck): boolean {
  if (["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(user.role)) return true;
  if (s.createdById === user.id) return true;
  if (s.unitPembuatId && user.unitId && s.unitPembuatId === user.unitId) return true;
  return false;
}

/**
 * Role helpers (central — jangan duplikasi logic di route).
 */
export const ROLES = ["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT", "KEPALA_BAGIAN", "STAF", "VIEWER"] as const;

export function hasRole(user: SessionUser, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN";
}
