import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/tv", "/api/auth/login"];
const SESSION_COOKIE = "tiara_session";

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/assets")) return true;
  if (pathname.startsWith("/logo")) return true;
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$/i.test(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function verifyToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "siaga_tiara_perumdam_lombok_tengah_super_secret_jwt_key_9482750172348912";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "siaga-tiara",
      audience: "siaga-tiara",
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.includes("..") || pathname.includes("%2e%2e")) {
    return new NextResponse("Bad Request", { status: 400 });
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
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
