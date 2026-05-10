import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratKeluar } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden } from "@/lib/api";
import { generateNomorSuratKeluar, generateVerifikasiKode, generateSignatureHash } from "@/lib/codes";
import { saveUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const q = cleanText(searchParams.get("q"), { max: 100 });
  const status = searchParams.get("status");
  const unitId = searchParams.get("unitId");
  const tahun = searchParams.get("tahun");
  const bulan = searchParams.get("bulan");
  const take = Math.min(Number(searchParams.get("take") || 50), 200);
  const skip = Math.max(Number(searchParams.get("skip") || 0), 0);

  const where: any = { deletedAt: null };
  if (q) {
    where.OR = [
      { nomorSurat: { contains: q, mode: "insensitive" } },
      { tujuan: { contains: q, mode: "insensitive" } },
      { perihal: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status as any;
  if (unitId) where.unitPembuatId = unitId;
  if (tahun || bulan) {
    const y = Number(tahun || new Date().getFullYear());
    const m = bulan ? Number(bulan) - 1 : 0;
    const start = bulan ? new Date(y, m, 1) : new Date(y, 0, 1);
    const end = bulan ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
    where.tanggalSurat = { gte: start, lt: end };
  }

  // Scope untuk non-admin/direksi/sekretariat
  if (!["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(session.role)) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { createdById: session.id },
          ...(session.unitId ? [{ unitPembuatId: session.unitId }] : []),
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.suratKeluar.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        unitPembuat: true,
        createdBy: { select: { id: true, nama: true } },
        _count: { select: { attachments: true } },
      },
      take,
      skip,
    }),
    prisma.suratKeluar.count({ where }),
  ]);

  return ok({ items, total });
}

const createSchema = z.object({
  tujuan: z.string().min(1).max(200),
  perihal: z.string().min(1).max(500),
  ringkasan: z.string().max(4000).optional().nullable(),
  tanggalSurat: z.string().min(1),
  penandatangan: z.string().min(1).max(200),
  unitPembuatId: z.string().min(1, "Unit pembuat wajib dipilih").max(50),
  status: z
    .enum(["DRAFT", "MENUNGGU_PARAF", "MENUNGGU_TTD", "TERKIRIM", "DIARSIPKAN"])
    .optional(),
  catatan: z.string().max(2000).optional().nullable(),
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
  if (!canInputSuratKeluar(session.role)) return forbidden();

  try {
    const ct = req.headers.get("content-type") || "";
    let rawBody: any;
    let files: File[] = [];
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      rawBody = {
        tujuan: form.get("tujuan"),
        perihal: form.get("perihal"),
        ringkasan: form.get("ringkasan") || null,
        tanggalSurat: form.get("tanggalSurat"),
        penandatangan: form.get("penandatangan"),
        unitPembuatId: form.get("unitPembuatId"),
        status: form.get("status") || "DRAFT",
        catatan: form.get("catatan") || null,
      };
      files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length > 10) return fail("Maksimal 10 file sekaligus");
    } else {
      rawBody = await req.json();
    }

    const parsed = createSchema.safeParse(rawBody);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");

    const d = {
      tujuan: cleanText(parsed.data.tujuan, { max: 200 }),
      perihal: cleanText(parsed.data.perihal, { max: 500 }),
      ringkasan: cleanText(parsed.data.ringkasan, { max: 4000, allowNewline: true }) || null,
      tanggalSurat: parsed.data.tanggalSurat,
      penandatangan: cleanText(parsed.data.penandatangan, { max: 200 }),
      unitPembuatId: parsed.data.unitPembuatId,
      status: parsed.data.status || "DRAFT",
      catatan: cleanText(parsed.data.catatan, { max: 2000, allowNewline: true }) || null,
    };

    // Ownership: non-admin harus dari unit sendiri
    if (!["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(session.role)) {
      if (!session.unitId || session.unitId !== d.unitPembuatId) {
        return forbidden("Anda hanya dapat membuat surat untuk unit Anda sendiri");
      }
    }

    const unit = await prisma.unit.findUnique({ where: { id: d.unitPembuatId } });
    if (!unit || !unit.aktif) return fail("Unit pembuat tidak valid");

    const nomorSurat = await generateNomorSuratKeluar(unit.kode);
    const kodeVerifikasi = generateVerifikasiKode();
    const signatureHash = generateSignatureHash(`${nomorSurat}|${kodeVerifikasi}`);

    const sk = await prisma.suratKeluar.create({
      data: {
        nomorSurat,
        tujuan: d.tujuan,
        perihal: d.perihal,
        ringkasan: d.ringkasan,
        tanggalSurat: new Date(d.tanggalSurat),
        penandatangan: d.penandatangan,
        unitPembuatId: unit.id,
        status: d.status,
        catatan: d.catatan,
        kodeVerifikasi,
        signatureHash,
        createdById: session.id,
      },
    });

    for (const f of files) {
      try {
        const saved = await saveUpload(f);
        await prisma.attachment.create({
          data: {
            nama: saved.nama,
            storageKey: saved.storageKey,
            url: saved.url,
            mime: saved.mime,
            ukuran: saved.ukuran,
            checksum: saved.checksum,
            private: true,
            jenis: "draft",
            uploadedById: session.id,
            suratKeluarId: sk.id,
          },
        });
        await audit({
          userId: session.id,
          action: "FILE_UPLOADED",
          entityType: "SuratKeluar",
          entityId: sk.id,
        });
      } catch (e: any) {
        await audit({
          userId: session.id,
          action: "FILE_UPLOADED",
          entityType: "SuratKeluar",
          entityId: sk.id,
          description: `Gagal upload: ${e?.message || "error"}`,
        });
      }
    }

    await prisma.trackingLog.create({
      data: {
        event: "SURAT_DIBUAT",
        judul: "Surat keluar dibuat",
        keterangan: `Nomor surat ${nomorSurat}`,
        petugasId: session.id,
        suratKeluarId: sk.id,
      },
    });

    await audit({
      userId: session.id,
      action: "SURAT_KELUAR_CREATED",
      entityType: "SuratKeluar",
      entityId: sk.id,
      description: `Nomor ${nomorSurat}`,
    });

    return ok({ surat: sk });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal membuat surat keluar", 500);
  }
}
