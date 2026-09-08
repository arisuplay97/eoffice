import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatusAduan, Prioritas, JenisGangguan, SumberAduan } from "@prisma/client";

function generateAduanId(kodeCabang: string): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${kodeCabang}${yy}${mm}${dd}${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const cabangId = searchParams.get("cabangId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!user.canSeeAll && user.cabangId) {
      where.cabangId = user.cabangId;
    } else if (cabangId && cabangId !== "Semua") {
      where.cabangId = cabangId;
    }

    if (status && status !== "Semua") {
      where.status = status as StatusAduan;
    }

    if (query.trim()) {
      const q = query.trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { namaPelanggan: { contains: q, mode: "insensitive" } },
        { noPelanggan: { contains: q, mode: "insensitive" } },
        { noHp: { contains: q, mode: "insensitive" } },
        { wilayah: { contains: q, mode: "insensitive" } },
        { keterangan: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.aduan.findMany({
        where,
        include: {
          cabang: true,
          dokumentasi: {
            where: { isValid: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { waktuMasuk: "desc" },
        skip,
        take: limit,
      }),
      prisma.aduan.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("Get aduan error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memuat aduan." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      cabangId,
      namaPelanggan,
      noPelanggan,
      noHp,
      jenisGangguan,
      prioritas,
      unit,
      keterangan,
      catatan,
      wilayah,
      desa,
      lokasiDetail,
      linkMaps,
      sumberAduan,
    } = body;

    if (!cabangId || !namaPelanggan || !noHp || !jenisGangguan) {
      return NextResponse.json(
        { ok: false, error: "Cabang, nama pelanggan, no telepon/WA, dan jenis gangguan wajib diisi." },
        { status: 400 }
      );
    }

    // Determine target cabang flexibly by ID, kode, or name
    const targetCabangId = !user.canSeeAll && user.cabangId ? user.cabangId : String(cabangId || "").trim();
    const normalizedKode = targetCabangId.replace(/^cabang_/i, "").toUpperCase();
    const cleanCabangName = targetCabangId.replace(/^cabang\s*/i, "").trim();

    const cabang = await prisma.cabang.findFirst({
      where: {
        OR: [
          { id: targetCabangId },
          { kode: targetCabangId.toUpperCase() },
          { kode: normalizedKode },
          { nama: { equals: targetCabangId, mode: "insensitive" } },
          { nama: { equals: cleanCabangName, mode: "insensitive" } },
          { nama: { contains: cleanCabangName, mode: "insensitive" } },
        ],
      },
    });

    if (!cabang) {
      return NextResponse.json({ ok: false, error: "Cabang yang dipilih tidak valid." }, { status: 400 });
    }

    // Format noPelanggan as string to preserve leading zeros
    const cleanNoPelanggan = String(noPelanggan || "").trim();

    let newId = generateAduanId(cabang.kode);
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.aduan.findUnique({ where: { id: newId } });
      if (!exists) break;
      newId = generateAduanId(cabang.kode);
      attempts++;
    }

    const aduan = await prisma.aduan.create({
      data: {
        id: newId,
        cabangId: cabang.id,
        wilayah: wilayah || cabang.wilayah,
        desa: desa || null,
        noPelanggan: cleanNoPelanggan,
        namaPelanggan: String(namaPelanggan).trim(),
        noHp: String(noHp).trim(),
        jenisGangguan: (jenisGangguan as JenisGangguan) || JenisGangguan.LAINNYA,
        prioritas: (prioritas as Prioritas) || Prioritas.SEDANG,
        status: StatusAduan.BARU,
        sumberAduan: (sumberAduan as SumberAduan) || SumberAduan.DASHBOARD,
        unit: unit || "Cabang",
        keterangan: keterangan || null,
        catatan: catatan || null,
        lokasiDetail: lokasiDetail || null,
        linkMaps: linkMaps || null,
        waktuMasuk: new Date(),
        slaJam: 24,
      },
      include: { cabang: true },
    });

    // Create initial StatusLog
    await prisma.statusLog.create({
      data: {
        aduanId: aduan.id,
        statusSebelumnya: null,
        statusBaru: StatusAduan.BARU,
        waktu: new Date(),
        userId: user.id,
        actorNama: `${user.nama} (${user.role === "ADMIN_PUSAT" ? "Admin Pusat" : cabang.nama})`,
        keterangan: `Aduan manual dibuat melalui dashboard web (${aduan.sumberAduan})`,
      },
    });

    return NextResponse.json({
      ok: true,
      aduan,
      message: `Aduan ${aduan.id} berhasil dicatat.`,
    });
  } catch (err: any) {
    console.error("Create aduan error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal membuat aduan." },
      { status: 500 }
    );
  }
}
