import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

const COOKIE_NAME = "tiara_session";
const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "siaga_tiara_perumdam_lombok_tengah_super_secret_jwt_key_9482750172348912";
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  username: string;
  nama: string;
  role: Role;
  cabangId: string | null;
  cabangNama?: string | null;
  canSeeAll: boolean;
};

export type SessionPayload = JWTPayload & { user: SessionUser };

export async function signSession(user: SessionUser, maxAgeSeconds = 60 * 60 * 12) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds)
    .setIssuer("siaga-tiara")
    .setAudience("siaga-tiara")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "siaga-tiara",
      audience: "siaga-tiara",
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 12) {
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

export function canManageSettings(role: Role): boolean {
  return role === Role.ADMIN_PUSAT || role === Role.SUPER_ADMIN;
}

export function canReassignBranch(role: Role): boolean {
  return role === Role.ADMIN_PUSAT || role === Role.SUPER_ADMIN;
}

export function canAccessCrmInbox(role: Role): boolean {
  return role === Role.ADMIN_PUSAT || role === Role.DIREKSI || role === Role.SUPER_ADMIN;
}
