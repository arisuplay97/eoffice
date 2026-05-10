import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canCreateDisposisi } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden } from "@/lib/api";
import { notifyMany } from "@/lib/notify";
import { audit } from "@/lib/audit";
import {
  assertSameOrigin,
  canMutateDisposisi,
  canViewSuratMasuk,
  cleanText,
} from "@/lib/security";

export const runtime = "nodejs";

const INSTRUKSI = [
  "UNTUK_DIKETAHUI",
  "UNTUK_DITINDAKLANJUTI",
  "UNTUK_DIPELAJARI",
  "UNTUK_DIKOORDINASIKAN",
  "UNTUK_DIJAWAB",
  "UNTUK_DIARSIPKAN",
  "HADIRI_WAKILI",
  "SIAPKAN_BAHAN",
  "BUAT_LAPORAN",
] as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "inbox";
  const status = searchParams.get("status");
  const q = cleanText(searchParams.get("q"), { max: 100 });
  const take = Math.min(Number(searchParams.get("take") || 50), 200);
  const skip = Math.max(Number(searchParams.get("skip") || 0), 0);

  const where: any = {};
  if (scope === "inbox") {
    where.OR = [
      { toUserId: session.id },
      ...(session.unitId ? [{ toUnitId: session.unitId, toUserId: null }] : []),
    ];
  } else if (scope === "outbox") {
    where.fromUserId = session.id;
  } else if (scope === "all") {
    if (session.role !== "SUPER_ADMIN" && session.role !== "DIREKSI") return forbidden();
  } else {
    return fail("Scope tidak valid");
  }
  if (status) where.status = status as any;
  if (q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { catatan: { contains: q, mode: "insensitive" } },
          { suratMasuk: { perihal: { contains: q, mode: "insensitive" } } },
          { suratMasuk: { nomorAgenda: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.disposisi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        suratMasuk: {
          select: {
            id: true,
            nomorAgenda: true,
            nomorSurat: true,
            perihal: true,
            prioritas: true,
            asalSurat: true,
          },
        },
        fromUser: { select: { id: true, nama: true, jabatan: true } },
        toUser: { select: { id: true, nama: true, jabatan: true } },
        toUnit: true,
      },
      take,
      skip,
    }),
    prisma.disposisi.count({ where }),
  ]);

  return ok({ items, total });
}

const createSchema = z.object({
  suratMasukId: z.string().min(1).max(50),
  parentId: z.string().max(50).optional().nullable(),
  toUserId: z.string().max(50).optional().nullable(),
  toUnitId: z.string().max(50).optional().nullable(),
  instruksi: z.enum(INSTRUKSI),
  catatan: z.string().max(2000).optional().nullable(),
  deadline: z.string().optional().nullable(),
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
  if (!canCreateDisposisi(session.role)) return forbidden();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;

    if (!d.toUserId && !d.toUnitId) return fail("Tujuan user atau unit wajib dipilih");

    // Pastikan user punya akses ke surat masuk sumber
    const allowedView = await canViewSuratMasuk(session, d.suratMasukId);
    if (!allowedView) return forbidden("Anda tidak memiliki akses ke surat tersebut");

    const sm = await prisma.suratMasuk.findFirst({
      where: { id: d.suratMasukId, deletedAt: null },
    });
    if (!sm) return fail("Surat masuk tidak ditemukan");

    // Jika parentId diberikan, pastikan user boleh forward dari parent tsb.
    if (d.parentId) {
      const parent = await prisma.disposisi.findUnique({ where: { id: d.parentId } });
      if (!parent || parent.suratMasukId !== d.suratMasukId) {
        return fail("Disposisi parent tidak valid");
      }
      if (!canMutateDisposisi(session, parent)) {
        return forbidden("Anda tidak dapat meneruskan disposisi ini");
      }
    }

    // Validasi toUser / toUnit harus ada & aktif
    if (d.toUserId) {
      const u = await prisma.user.findUnique({ where: { id: d.toUserId } });
      if (!u || !u.aktif) return fail("Pengguna tujuan tidak valid");
    }
    if (d.toUnitId) {
      const u = await prisma.unit.findUnique({ where: { id: d.toUnitId } });
      if (!u || !u.aktif) return fail("Unit tujuan tidak valid");
    }

    const disposisi = await prisma.disposisi.create({
      data: {
        suratMasukId: d.suratMasukId,
        parentId: d.parentId || null,
        fromUserId: session.id,
        toUserId: d.toUserId || null,
        toUnitId: d.toUnitId || null,
        instruksi: d.instruksi,
        catatan: cleanText(d.catatan, { max: 2000, allowNewline: true }) || null,
        deadline: d.deadline ? new Date(d.deadline) : null,
        status: "BARU",
      },
      include: {
        toUser: { select: { id: true, nama: true } },
        toUnit: true,
      },
    });

    if (sm.status === "DITERIMA") {
      await prisma.suratMasuk.update({
        where: { id: sm.id },
        data: { status: "DIDISPOSISIKAN" },
      });
    }

    await prisma.trackingLog.create({
      data: {
        event: d.parentId ? "DISPOSISI_DITERUSKAN" : "DISPOSISI_DIBUAT",
        judul: d.parentId ? "Disposisi diteruskan" : "Disposisi dibuat",
        keterangan: `Kepada ${disposisi.toUser?.nama || disposisi.toUnit?.nama || "-"}`,
        petugasId: session.id,
        suratMasukId: sm.id,
        disposisiId: disposisi.id,
      },
    });

    const targetIds: string[] = [];
    if (disposisi.toUserId) targetIds.push(disposisi.toUserId);
    if (!disposisi.toUserId && disposisi.toUnitId) {
      const unitUsers = await prisma.user.findMany({
        where: { unitId: disposisi.toUnitId, aktif: true },
        select: { id: true },
      });
      targetIds.push(...unitUsers.map((u) => u.id));
    }
    await notifyMany(targetIds, {
      tipe: "DISPOSISI_BARU",
      judul: "Disposisi baru untuk Anda",
      pesan: `Surat ${sm.nomorAgenda} - ${sm.perihal}`,
      link: `/disposisi/${disposisi.id}`,
    });

    await audit({
      userId: session.id,
      action: d.parentId ? "DISPOSISI_FORWARDED" : "DISPOSISI_CREATED",
      entityType: "Disposisi",
      entityId: disposisi.id,
      description: `Disposisi ${d.parentId ? "diteruskan" : "dibuat"} untuk surat ${sm.nomorAgenda}`,
    });

    return ok({ disposisi });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal membuat disposisi", 500);
  }
}
