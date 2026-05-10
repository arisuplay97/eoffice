import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "tiara_session";
const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET tidak dikonfigurasi dengan aman. Isi JWT_SECRET di .env dengan minimal 32 karakter (direkomendasikan 48+)."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  username: string;
  nama: string;
  role: Role;
  unitId: string | null;
  jabatan: string | null;
};

export type SessionPayload = JWTPayload & { user: SessionUser };

export async function signSession(user: SessionUser, maxAgeSeconds = 60 * 60 * 8) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds)
    .setIssuer("eoffice-tiara")
    .setAudience("eoffice-tiara")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "eoffice-tiara",
      audience: "eoffice-tiara",
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 8) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  return payload?.user ?? null;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export const SESSION_COOKIE = COOKIE_NAME;

// Role helpers
export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  DIREKSI: "Direksi",
  SEKRETARIAT: "Sekretariat",
  KEPALA_BAGIAN: "Kepala Bagian",
  STAF: "Staf",
  VIEWER: "Viewer",
};

export function canManageUsers(role: Role) {
  return role === "SUPER_ADMIN";
}
export function canInputSuratMasuk(role: Role) {
  return role === "SUPER_ADMIN" || role === "SEKRETARIAT";
}
export function canInputSuratKeluar(role: Role) {
  return (
    role === "SUPER_ADMIN" ||
    role === "SEKRETARIAT" ||
    role === "KEPALA_BAGIAN" ||
    role === "DIREKSI"
  );
}
export function canCreateDisposisi(role: Role) {
  return role === "SUPER_ADMIN" || role === "SEKRETARIAT" || role === "DIREKSI" || role === "KEPALA_BAGIAN";
}
export function canViewAllDisposisi(role: Role) {
  return role === "SUPER_ADMIN";
}
