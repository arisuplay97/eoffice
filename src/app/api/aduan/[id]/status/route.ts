import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatusAduan, Prioritas, TipeDokumentasi } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const {
      status,
      prioritas,
      unit,
      catatan,
      petugasId,
      fotoUrl,
      fotoCaption,
      tipeFoto,
      keteranganAksi,
    } = body;

    const aduan = await prisma.aduan.findUnique({
      where: { id },
      include: { cabang: true },
    });

    if (!aduan) {
      return NextResponse.json({ ok: false, error: "Aduan tidak ditemukan." }, { status: 404 });
    }

    if (!user.canSeeAll && user.cabangId && aduan.cabangId !== user.cabangId) {
      return NextResponse.json({ ok: false, error: "Tidak memiliki hak akses pada aduan cabang ini." }, { status: 403 });
    }

    const prevStatus = aduan.status;
    const newStatus = (status as StatusAduan) || prevStatus;
    const now = new Date();

    const updateData: any = {
      updatedAt: now,
    };

    if (newStatus !== prevStatus) {
      updateData.status = newStatus;
    }

    if (prioritas) {
      updateData.prioritas = prioritas as Prioritas;
    }

    if (unit) {
      updateData.unit = unit;
    }

    if (catatan !== undefined) {
      updateData.catatan = catatan;
    }

    // PRD V11.10.6: Waktu Respons Terkunci (Locked Response Time)
    // Jika status awal adalah BARU dan status berubah ke status tindak lanjut,
    // kunci waktuRespons ke waktu saat ini jika belum pernah diisi.
    if (prevStatus === StatusAduan.BARU && newStatus !== StatusAduan.BARU && !aduan.waktuRespons) {
      updateData.waktuRespons = now;
    }

    // Jika status diubah menjadi SELESAI, catat waktuSelesai
    if (newStatus === StatusAduan.SELESAI && !aduan.waktuSelesai) {
      updateData.waktuSelesai = now;
    } else if (newStatus !== StatusAduan.SELESAI && aduan.status === StatusAduan.SELESAI) {
      // Jika status dibuka kembali dari Selesai
      updateData.waktuSelesai = null;
    }

    const updatedAduan = await prisma.aduan.update({
      where: { id },
      data: updateData,
    });

    // Catat ke StatusLog jika status berubah atau ada keterangan aksi
    if (newStatus !== prevStatus || keteranganAksi || catatan) {
      await prisma.statusLog.create({
        data: {
          aduanId: id,
          statusSebelumnya: prevStatus,
          statusBaru: newStatus,
          waktu: now,
          userId: user.id,
          actorNama: `${user.nama} (${user.role === "ADMIN_PUSAT" ? "Admin Pusat" : aduan.cabang.nama})`,
          keterangan: keteranganAksi || catatan || `Status diubah dari ${prevStatus} menjadi ${newStatus}`,
        },
      });
    }

    // Tambah dokumentasi foto jika ada
    if (fotoUrl && String(fotoUrl).trim()) {
      await prisma.dokumentasiAduan.create({
        data: {
          aduanId: id,
          tipeFoto: (tipeFoto as TipeDokumentasi) || (newStatus === StatusAduan.SELESAI ? TipeDokumentasi.FOTO_SELESAI : TipeDokumentasi.FOTO_PROSES),
          fotoUrl: String(fotoUrl).trim(),
          caption: fotoCaption || null,
          uploadedBy: user.nama,
          isValid: true,
          createdAt: now,
        },
      });
    }

    // Penugasan petugas jika ada
    if (petugasId && String(petugasId).trim()) {
      await prisma.penugasanAduan.create({
        data: {
          aduanId: id,
          petugasId: String(petugasId).trim(),
          assignedAt: now,
          assignedBy: user.nama,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      aduan: updatedAduan,
      message: `Status aduan ${id} berhasil diperbarui.`,
    });
  } catch (err: any) {
    console.error("Update status aduan error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal memperbarui status aduan." },
      { status: 500 }
    );
  }
}
