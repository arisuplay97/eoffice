import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { verifySignatureHash } from "@/lib/codes";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const KODE_PATTERN = /^TIARA-\d{8}-[A-F0-9]{6}$/;

export async function GET(_req: NextRequest, { params }: { params: { kode: string } }) {
  const kode = decodeURIComponent(params.kode).toUpperCase();
  if (!KODE_PATTERN.test(kode)) {
    await audit({
      action: "QR_VERIFY_OPENED",
      description: "Format kode tidak valid",
      metadata: { kode: kode.slice(0, 32) },
    });
    return fail("Kode tidak valid", 400);
  }

  const sm = await prisma.suratMasuk.findFirst({
    where: { kodeVerifikasi: kode, deletedAt: null },
    include: {
      unitTujuan: { select: { nama: true } },
      trackingLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { judul: true, createdAt: true },
      },
    },
  });
  if (sm) {
    const valid = verifySignatureHash(
      `${sm.nomorAgenda}|${sm.kodeVerifikasi}`,
      sm.signatureHash
    );
    if (!valid) {
      await audit({ action: "QR_VERIFY_OPENED", description: "Signature invalid", metadata: { kode } });
      return fail("Signature tidak valid", 400);
    }
    const isRahasia = sm.prioritas === "RAHASIA";
    await audit({ action: "QR_VERIFY_OPENED", description: "OK", metadata: { kode, jenis: "masuk" } });
    return ok({
      valid: true,
      jenis: "Surat Masuk",
      nomor: sm.nomorAgenda,
      nomorSurat: isRahasia ? null : sm.nomorSurat,
      tanggal: sm.tanggalSurat,
      perihal: isRahasia ? "[Dirahasiakan]" : sm.perihal,
      unit: sm.unitTujuan?.nama || null,
      status: sm.status,
      kode: sm.kodeVerifikasi,
      trackingTerakhir: sm.trackingLogs[0] || null,
    });
  }

  const sk = await prisma.suratKeluar.findFirst({
    where: { kodeVerifikasi: kode, deletedAt: null },
    include: {
      unitPembuat: { select: { nama: true } },
      trackingLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { judul: true, createdAt: true },
      },
    },
  });
  if (sk) {
    const valid = verifySignatureHash(
      `${sk.nomorSurat}|${sk.kodeVerifikasi}`,
      sk.signatureHash
    );
    const isFinal = sk.status === "TERKIRIM" || sk.status === "DIARSIPKAN";
    if (!valid || !isFinal) {
      await audit({
        action: "QR_VERIFY_OPENED",
        description: !valid ? "Signature invalid" : "Belum final",
        metadata: { kode, status: sk.status },
      });
      return fail("Dokumen belum sah atau signature tidak valid", 400);
    }
    await audit({ action: "QR_VERIFY_OPENED", description: "OK", metadata: { kode, jenis: "keluar" } });
    return ok({
      valid: true,
      jenis: "Surat Keluar",
      nomor: sk.nomorSurat,
      tanggal: sk.tanggalSurat,
      perihal: sk.perihal,
      unit: sk.unitPembuat?.nama || null,
      status: sk.status,
      kode: sk.kodeVerifikasi,
      trackingTerakhir: sk.trackingLogs[0] || null,
    });
  }

  await audit({ action: "QR_VERIFY_OPENED", description: "Not found", metadata: { kode } });
  return fail("Dokumen tidak terdaftar di sistem E-Office TIARA", 404);
}
