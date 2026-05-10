import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/verify", "/api/auth/login", "/api/verify"];
const SESSION_COOKIE = "tiara_session";

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/assets")) return true;
  // /uploads dibiarkan di middleware-level tapi di-redirect force lewat /api/files untuk akses berhak.
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.length > 500) return null;
  if (raw.includes("..")) return null; // defense-in-depth
  return raw;
}

async function verifyToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "eoffice-tiara",
      audience: "eoffice-tiara",
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Path traversal defense (selain Next sudah menormalisasi, tetap reject).
  if (pathname.includes("..") || pathname.includes("%2e%2e")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // BLOCK akses langsung ke storage dir dari browser — paksa lewat /api/files/[id]
  // supaya RBAC terjaga. File produksi di-Blob, jadi ini cuma bentengi dev/fallback.
  if (pathname.startsWith("/uploads/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isPublic(pathname)) {
    if (pathname === "/login") {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (token && (await verifyToken(token))) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const url = new URL("/login", req.url);
    // Preserve intended destination — tapi sanitize dulu.
    const nextPath = safeNextPath(pathname);
    if (nextPath && nextPath !== "/") url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
