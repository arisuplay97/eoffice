import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fail, ok, unauthorized, forbidden } from "@/lib/api";
import { streamFileForDownload, saveUpload } from "@/lib/storage";
import { signPdf } from "@/lib/bsre";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!["DIREKSI", "KEPALA_BAGIAN", "SUPER_ADMIN"].includes(session.role)) {
      return forbidden("Anda tidak berhak menandatangani dokumen");
    }

    const d = await req.json();
    const {
      attachmentId,
      nik,
      passphrase,
      isVisual = false,
      page = 1,
      xAxis = 10,
      yAxis = 10,
      width = 150,
      height = 50,
    } = d;

    if (!attachmentId || !nik || !passphrase) {
      return fail("Attachment ID, NIK, dan Passphrase wajib diisi");
    }

    const att = await prisma.attachment.findUnique({
      where: { id: attachmentId, deletedAt: null },
      include: {
        suratKeluar: true,
      },
    });

    if (!att || !att.suratKeluar) {
      return fail("Dokumen surat keluar tidak ditemukan");
    }

    if (att.mime !== "application/pdf") {
      return fail("Hanya dokumen PDF yang dapat ditandatangani");
    }

    // if (att.suratKeluar.status !== "MENUNGGU_TTD") {
    //   return fail("Surat keluar ini tidak sedang menunggu tanda tangan");
    // }

    // 1. Ambil buffer asli
    const originalBuf = await streamFileForDownload(att.url, att.storageKey);

    // 2. Lakukan penandatanganan dengan BSrE
    const signedBuf = await signPdf({
      nik,
      passphrase,
      fileBuffer: originalBuf,
      isVisual,
      page,
      xAxis,
      yAxis,
      width,
      height,
    });

    // 3. Simpan PDF baru yang telah di TTE
    // Kita buat object File dummy agar bisa pakai saveUpload (karena saveUpload butuh File interface)
    const fileObj = new File([new Uint8Array(signedBuf)], att.nama, { type: "application/pdf" });
    const saved = await saveUpload(fileObj);

    // 4. Update data attachment dan surat keluar
    await prisma.$transaction([
      prisma.attachment.update({
        where: { id: att.id },
        data: {
          storageKey: saved.storageKey,
          url: saved.url,
          ukuran: saved.ukuran,
          checksum: saved.checksum,
          jenis: "final", // Ubah tipe jadi final
        },
      }),
      prisma.suratKeluar.update({
        where: { id: att.suratKeluar.id },
        data: {
          status: "TERKIRIM",
        },
      }),
      prisma.trackingLog.create({
        data: {
          event: "STATUS_BERUBAH",
          judul: "Surat Selesai Ditandatangani (TTE BSrE)",
          keterangan: `Ditandatangani secara digital oleh ${session.nama}`,
          petugasId: session.id,
          suratKeluarId: att.suratKeluar.id,
        },
      }),
    ]);

    await audit({
      userId: session.id,
      action: "BSRE_SIGN_SUCCESS",
      entityType: "SuratKeluar",
      entityId: att.suratKeluar.id,
      description: `TTE berhasil untuk file ${att.nama}`,
    });

    return ok({ message: "Dokumen berhasil ditandatangani secara elektronik" });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal melakukan tanda tangan elektronik", 500);
  }
}
