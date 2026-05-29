import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratMasuk } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden } from "@/lib/api";
import { generateNomorAgenda, generateVerifikasiKode, generateSignatureHash } from "@/lib/codes";
import { saveUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText, isAdmin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = cleanText(searchParams.get("q"), { max: 100 });
  const status = searchParams.get("status");
  const prioritas = searchParams.get("prioritas");
  const unitId = searchParams.get("unitId");
  const tahun = searchParams.get("tahun");
  const bulan = searchParams.get("bulan");
  const take = Math.min(Number(searchParams.get("take") || 50), 200);
  const skip = Math.max(Number(searchParams.get("skip") || 0), 0);

  const where: any = { deletedAt: null };
  if (q) {
    where.OR = [
      { nomorAgenda: { contains: q, mode: "insensitive" } },
      { nomorSurat: { contains: q, mode: "insensitive" } },
      { asalSurat: { contains: q, mode: "insensitive" } },
      { perihal: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status as any;
  if (prioritas) where.prioritas = prioritas as any;
  if (unitId) where.unitTujuanId = unitId;
  if (tahun || bulan) {
    const y = Number(tahun || new Date().getFullYear());
    const m = bulan ? Number(bulan) - 1 : 0;
    const start = bulan ? new Date(y, m, 1) : new Date(y, 0, 1);
    const end = bulan ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
    where.tanggalSurat = { gte: start, lt: end };
  }

  // Scope: non-admin/direksi/sekretariat hanya melihat yang relevan
  if (!["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(session.role)) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { createdById: session.id },
          ...(session.unitId ? [{ unitTujuanId: session.unitId }] : []),
          { disposisi: { some: { toUserId: session.id } } },
          ...(session.unitId ? [{ disposisi: { some: { toUnitId: session.unitId } } }] : []),
          { disposisi: { some: { fromUserId: session.id } } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.suratMasuk.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        unitTujuan: true,
        createdBy: { select: { id: true, nama: true } },
        _count: { select: { disposisi: true, attachments: true } },
      },
      take,
      skip,
    }),
    prisma.suratMasuk.count({ where }),
  ]);

  return ok({ items, total });
}

const createSchema = z.object({
  nomorSurat: z.string().min(1).max(100),
  tanggalSurat: z.string().min(1),
  tanggalDiterima: z.string().optional(),
  asalSurat: z.string().min(1).max(200),
  perihal: z.string().min(1).max(500),
  ringkasan: z.string().max(4000).optional().nullable(),
  prioritas: z.enum(["BIASA", "PENTING", "SEGERA", "RAHASIA"]).default("BIASA"),
  unitTujuanId: z.string().max(50).optional().nullable(),
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
  if (!canInputSuratMasuk(session.role)) return forbidden();

  try {
    const ct = req.headers.get("content-type") || "";
    let rawBody: any;
    let files: File[] = [];
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      rawBody = {
        nomorSurat: form.get("nomorSurat"),
        tanggalSurat: form.get("tanggalSurat"),
        tanggalDiterima: form.get("tanggalDiterima") || undefined,
        asalSurat: form.get("asalSurat"),
        perihal: form.get("perihal"),
        ringkasan: form.get("ringkasan") || null,
        prioritas: form.get("prioritas") || "BIASA",
        unitTujuanId: form.get("unitTujuanId") || null,
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
      nomorSurat: cleanText(parsed.data.nomorSurat, { max: 100 }),
      tanggalSurat: parsed.data.tanggalSurat,
      tanggalDiterima: parsed.data.tanggalDiterima,
      asalSurat: cleanText(parsed.data.asalSurat, { max: 200 }),
      perihal: cleanText(parsed.data.perihal, { max: 500 }),
      ringkasan: cleanText(parsed.data.ringkasan, { max: 4000, allowNewline: true }) || null,
      prioritas: parsed.data.prioritas,
      unitTujuanId: parsed.data.unitTujuanId || null,
      catatan: cleanText(parsed.data.catatan, { max: 2000, allowNewline: true }) || null,
    };

    if (d.unitTujuanId) {
      const u = await prisma.unit.findUnique({ where: { id: d.unitTujuanId } });
      if (!u || !u.aktif) return fail("Unit tujuan tidak valid");
    }

    // 1. Upload files first and fail fast if any invalid
    const uploadedAttachments = [];
    for (const f of files) {
      try {
        const saved = await saveUpload(f);
        uploadedAttachments.push(saved);
      } catch (e: any) {
        return fail(`Gagal mengunggah berkas "${f.name}": ${e?.message || "error"}`);
      }
    }

    const nomorAgenda = await generateNomorAgenda();
    const kodeVerifikasi = generateVerifikasiKode();
    const signatureHash = generateSignatureHash(`${nomorAgenda}|${kodeVerifikasi}`);

    const surat = await prisma.suratMasuk.create({
      data: {
        nomorAgenda,
        nomorSurat: d.nomorSurat,
        tanggalSurat: new Date(d.tanggalSurat),
        tanggalDiterima: d.tanggalDiterima ? new Date(d.tanggalDiterima) : new Date(),
        asalSurat: d.asalSurat,
        perihal: d.perihal,
        ringkasan: d.ringkasan,
        prioritas: d.prioritas,
        unitTujuanId: d.unitTujuanId,
        catatan: d.catatan,
        kodeVerifikasi,
        signatureHash,
        createdById: session.id,
        attachments: {
          create: uploadedAttachments.map((saved) => ({
            nama: saved.nama,
            storageKey: saved.storageKey,
            url: saved.url,
            mime: saved.mime,
            ukuran: saved.ukuran,
            checksum: saved.checksum,
            private: true,
            jenis: "pokok",
            uploadedById: session.id,
          })),
        },
        trackingLogs: {
          create: [
            {
              event: "SURAT_DITERIMA",
              judul: "Surat diterima Sekretariat",
              keterangan: `Diterima dari ${d.asalSurat}`,
              petugasId: session.id,
            },
            {
              event: "SURAT_DICATAT",
              judul: "Surat dicatat dalam agenda",
              keterangan: `Nomor agenda ${nomorAgenda}`,
              petugasId: session.id,
            },
          ],
        },
      },
    });

    for (const saved of uploadedAttachments) {
      await audit({
        userId: session.id,
        action: "FILE_UPLOADED",
        entityType: "SuratMasuk",
        entityId: surat.id,
        description: `Upload ${saved.nama}`,
      });
    }

    await audit({
      userId: session.id,
      action: "SURAT_MASUK_CREATED",
      entityType: "SuratMasuk",
      entityId: surat.id,
      description: `Agenda ${nomorAgenda}`,
    });

    return ok({ surat });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal membuat surat masuk", 500);
  }
}
