import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canReassignBranch } from "@/lib/auth";
import { StatusAduan } from "@prisma/client";
import { generateAduanId } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canReassignBranch(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Hanya Admin Pusat yang memiliki wewenang untuk mengalihkan cabang aduan." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { targetCabangId, alasan } = body;

    if (!targetCabangId) {
      return NextResponse.json({ ok: false, error: "Cabang tujuan pengalihan wajib dipilih." }, { status: 400 });
    }

    const oldAduan = await prisma.aduan.findUnique({
      where: { id },
      include: { cabang: true },
    });

    if (!oldAduan) {
      return NextResponse.json({ ok: false, error: "Aduan tidak ditemukan." }, { status: 404 });
    }

    const targetCabang = await prisma.cabang.findUnique({
      where: { id: targetCabangId },
    });

    if (!targetCabang) {
      return NextResponse.json({ ok: false, error: "Cabang tujuan tidak valid." }, { status: 400 });
    }

    if (targetCabang.id === oldAduan.cabangId) {
      return NextResponse.json(
        { ok: false, error: "Cabang tujuan tidak boleh sama dengan cabang saat ini." },
        { status: 400 }
      );
    }

    const now = new Date();
    let newId = generateAduanId(targetCabang.kode);
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.aduan.findUnique({ where: { id: newId } });
      if (!exists) break;
      newId = generateAduanId(targetCabang.kode);
      attempts++;
    }

    // 1. Buat aduan baru di cabang tujuan
    const newAduan = await prisma.aduan.create({
      data: {
        id: newId,
        cabangId: targetCabang.id,
        wilayah: targetCabang.wilayah,
        desa: oldAduan.desa,
        noPelanggan: oldAduan.noPelanggan,
        namaPelanggan: oldAduan.namaPelanggan,
        noHp: oldAduan.noHp,
        jenisGangguan: oldAduan.jenisGangguan,
        prioritas: oldAduan.prioritas,
        status: StatusAduan.BARU,
        sumberAduan: oldAduan.sumberAduan,
        unit: oldAduan.unit,
        keterangan: oldAduan.keterangan,
        catatan: `Dialihkan dari tiket ${oldAduan.id} (${oldAduan.cabang.nama}). Alasan: ${alasan || "Salah pilih cabang"}`,
        waktuMasuk: now,
        slaJam: 24,
        latitude: oldAduan.latitude,
        longitude: oldAduan.longitude,
        linkMaps: oldAduan.linkMaps,
        lokasiDetail: oldAduan.lokasiDetail,
        idAduanLama: oldAduan.id,
        alasanAlih: alasan || "Pengalihan cabang oleh Admin Pusat",
      },
    });

    // 2. Tandai aduan lama sebagai BATAL dengan referensi ke aduan baru
    await prisma.aduan.update({
      where: { id: oldAduan.id },
      data: {
        status: StatusAduan.BATAL,
        catatan: `Tiket dibatalkan dan dialihkan ke ${targetCabang.nama} dengan ID baru ${newId}. Alasan: ${alasan || "Salah cabang"}`,
        alasanAlih: alasan || "Dialihkan ke cabang lain",
        updatedAt: now,
      },
    });

    // 3. Log di tiket lama
    await prisma.statusLog.create({
      data: {
        aduanId: oldAduan.id,
        statusSebelumnya: oldAduan.status,
        statusBaru: StatusAduan.BATAL,
        waktu: now,
        userId: user.id,
        actorNama: `${user.nama} (Admin Pusat)`,
        keterangan: `Aduan dialihkan ke ${targetCabang.nama}. Nomor tiket baru: ${newId}. Alasan: ${alasan || "-"}`,
      },
    });

    // 4. Log di tiket baru
    await prisma.statusLog.create({
      data: {
        aduanId: newAduan.id,
        statusSebelumnya: null,
        statusBaru: StatusAduan.BARU,
        waktu: now,
        userId: user.id,
        actorNama: `${user.nama} (Admin Pusat)`,
        keterangan: `Tiket baru dibuat hasil pengalihan dari tiket ${oldAduan.id} (${oldAduan.cabang.nama})`,
      },
    });

    return NextResponse.json({
      ok: true,
      oldId: oldAduan.id,
      newId: newAduan.id,
      message: `Aduan berhasil dialihkan ke ${targetCabang.nama} dengan ID ${newId}.`,
    });
  } catch (err: any) {
    console.error("Alihkan cabang error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal mengalihkan cabang aduan." },
      { status: 500 }
    );
  }
}
