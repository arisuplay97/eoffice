import { NextRequest } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

const KODE_PATTERN = /^[A-Z0-9\-]{8,64}$/;

export async function GET(req: NextRequest, { params }: { params: { kode: string } }) {
  const kode = decodeURIComponent(params.kode).toUpperCase();
  if (!KODE_PATTERN.test(kode)) {
    return new Response("Bad Request", { status: 400 });
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const url = `${base.replace(/\/$/, "")}/verify/${encodeURIComponent(kode)}`;
  const png = await QRCode.toBuffer(url, {
    width: 320,
    margin: 1,
    color: { dark: "#1e3a8a", light: "#ffffff" },
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
