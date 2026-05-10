import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText, isAdmin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const units = await prisma.unit.findMany({ orderBy: { nama: "asc" } });
  return ok({ items: units });
}

const createSchema = z.object({
  kode: z.string().max(30).optional(),
  nama: z.string().min(1).max(200),
  tipe: z.string().max(50).optional().nullable(),
  deskripsi: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;
    const nama = cleanText(d.nama, { max: 200 });
    const kode = cleanText(d.kode || slugify(nama), { max: 30 }).toUpperCase();
    const u = await prisma.unit.create({
      data: {
        kode,
        nama,
        tipe: cleanText(d.tipe || "", { max: 50 }) || null,
        deskripsi: cleanText(d.deskripsi || "", { max: 2000, allowNewline: true }) || null,
      },
    });
    await audit({
      userId: session.id,
      action: "UNIT_CREATED",
      entityType: "Unit",
      entityId: u.id,
      description: `${u.kode} - ${u.nama}`,
    });
    return ok({ id: u.id });
  } catch (e: any) {
    if (e?.code === "P2002") return fail("Kode unit sudah digunakan");
    return fail(e?.message || "Gagal membuat unit", 500);
  }
}
