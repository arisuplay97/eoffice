import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Export terbatas hanya untuk role yang punya kewenangan arsip.
  if (!["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT"].includes(session.role)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Anda tidak memiliki akses export" }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }
  const { searchParams } = new URL(req.url);
  const jenis = searchParams.get("jenis") || "masuk";
  const tahun = Number(searchParams.get("tahun") || new Date().getFullYear());
  if (!Number.isFinite(tahun) || tahun < 2000 || tahun > 2200) {
    return unauthorized();
  }

  let rows: Record<string, any>[] = [];
  let sheetName = "Surat";
  if (jenis === "masuk") {
    const items = await prisma.suratMasuk.findMany({
      where: {
        deletedAt: null,
        tanggalSurat: { gte: new Date(tahun, 0, 1), lt: new Date(tahun + 1, 0, 1) },
      },
      orderBy: { createdAt: "desc" },
      include: { unitTujuan: true },
    });
    sheetName = "Surat Masuk";
    rows = items.map((s) => ({
      "No. Agenda": s.nomorAgenda,
      "No. Surat": s.nomorSurat,
      "Tgl. Surat": s.tanggalSurat.toISOString().slice(0, 10),
      "Tgl. Terima": s.tanggalDiterima.toISOString().slice(0, 10),
      "Asal Surat": s.asalSurat,
      Perihal: s.perihal,
      Prioritas: s.prioritas,
      Status: s.status,
      "Unit Tujuan": s.unitTujuan?.nama || "-",
      "Kode Verifikasi": s.kodeVerifikasi,
    }));
  } else {
    const items = await prisma.suratKeluar.findMany({
      where: {
        deletedAt: null,
        tanggalSurat: { gte: new Date(tahun, 0, 1), lt: new Date(tahun + 1, 0, 1) },
      },
      orderBy: { createdAt: "desc" },
      include: { unitPembuat: true },
    });
    sheetName = "Surat Keluar";
    rows = items.map((s) => ({
      "No. Surat": s.nomorSurat,
      "Tgl. Surat": s.tanggalSurat.toISOString().slice(0, 10),
      Tujuan: s.tujuan,
      Perihal: s.perihal,
      Penandatangan: s.penandatangan,
      Status: s.status,
      "Unit Pembuat": s.unitPembuat?.nama || "-",
      "Kode Verifikasi": s.kodeVerifikasi,
    }));
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeYear = Math.floor(tahun);
  const safeJenis = jenis === "masuk" ? "masuk" : "keluar";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arsip-${safeJenis}-${safeYear}.xlsx"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
