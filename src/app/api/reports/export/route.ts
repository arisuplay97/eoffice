import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calculateSlaInfo } from "@/lib/sla";
import QRCode from "qrcode";
import { StatusAduan } from "@prisma/client";

export const dynamic = "force-dynamic";

const JENIS_MAP: Record<string, string> = {
  AIR_MATI: "Air Mati",
  PIPA_BOCOR: "Pipa Bocor",
  AIR_KERUH: "Air Keruh",
  TEKANAN_RENDAH: "Tekanan Rendah",
  METER_BERMASALAH: "Meter Bermasalah",
  TAGIHAN: "Tagihan",
  SAMBUNGAN_BARU: "Sambungan Baru",
  LAINNYA: "Lainnya",
};

const STATUS_MAP: Record<string, string> = {
  BARU: "Baru",
  DIRESPONS: "Direspons",
  PROSES: "Proses",
  DALAM_PENGERJAAN: "Dalam Pengerjaan",
  KENDALA: "Kendala",
  SELESAI: "Selesai",
  DITUNDA: "Ditunda",
  BATAL: "Batal",
};

function formatSumberAduan(sumber: string): string {
  if (!sumber) return "Call Center";
  const s = String(sumber).toUpperCase();
  if (s === "TELEPON") return "Call Center";
  if (s === "LANGSUNG") return "Langsung";
  if (s === "WHATSAPP") return "WhatsApp";
  if (s === "APLIKASI" || s === "MOBILE") return "Aplikasi Mobile";
  if (s === "DASHBOARD") return "Input Manual";
  return sumber;
}

function formatAduanTime(date: Date): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cabangParam = searchParams.get("cabangId");
    const period = searchParams.get("period") || "this_month";

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (period === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    const where: any = {};
    let resolvedCabangName: string | null = null;

    if (!user.canSeeAll && user.cabangId) {
      where.cabangId = user.cabangId;
      resolvedCabangName = user.cabangNama ? user.cabangNama.replace(/^Cabang\s*/i, "") : null;
    } else if (cabangParam && cabangParam !== "Semua") {
      const targetCabang = await prisma.cabang.findFirst({
        where: {
          OR: [
            { id: cabangParam },
            { kode: cabangParam.toUpperCase() },
            { nama: { contains: cabangParam.replace(/^Cabang\s*/i, ""), mode: "insensitive" } },
          ],
        },
      });
      if (targetCabang) {
        where.cabangId = targetCabang.id;
        resolvedCabangName = targetCabang.nama.replace(/^Cabang\s*/i, "");
      }
    }

    if (startDate && endDate) {
      where.waktuMasuk = { gte: startDate, lte: endDate };
    }

    const aduanList = await prisma.aduan.findMany({
      where,
      include: {
        cabang: true,
        penugasan: {
          include: { petugas: true },
          orderBy: { assignedAt: "desc" },
          take: 1,
        },
        dokumentasi: {
          where: { isValid: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { waktuMasuk: "asc" },
    });

    let totalAduan = aduanList.length;
    let totalSelesai = 0;
    let totalTelatRespon = 0;
    let selesaiTepatWaktu = 0;

    const rows = aduanList.map((a, idx) => {
      const sla = calculateSlaInfo(a, now.getTime());
      const isSelesai = a.status === StatusAduan.SELESAI;
      const isBatal = a.status === StatusAduan.BATAL;

      if (isSelesai) totalSelesai++;
      if (sla.lateHours > 0) totalTelatRespon++;
      if (isSelesai && sla.lateHours === 0) selesaiTepatWaktu++;

      let slaStatus = "Tepat waktu";
      if (isBatal) {
        slaStatus = "Batal";
      } else if (sla.lateHours > 0) {
        slaStatus = "Terlambat";
      }

      const cleanCabang = a.cabang.nama.replace(/^Cabang\s*/i, "");
      const namaPetugas = a.penugasan?.[0]?.petugas?.nama || `Cabang ${cleanCabang}`;

      return {
        no: idx + 1,
        id: a.id,
        waktu: formatAduanTime(a.waktuMasuk),
        cabang: cleanCabang,
        pelanggan: a.namaPelanggan,
        noHp: a.noHp,
        jenis: JENIS_MAP[a.jenisGangguan] || a.jenisGangguan,
        sumberAduan: formatSumberAduan(a.sumberAduan),
        noPelanggan: a.noPelanggan || "-",
        status: STATUS_MAP[a.status] || a.status,
        petugas: namaPetugas,
        sla: slaStatus,
        keterangan: a.keterangan || "-",
        // Detailed SLA fields for system/preview
        rawStatus: a.status,
        waktuRespons: sla.waktuResponsText,
        waktuSelesai: sla.waktuSelesaiText,
        durasiRespons: sla.durasiText,
      };
    });

    // Format Period Label e.g. "Bulan Lalu (08/2026)" or "Bulan Ini (09/2026)"
    let periodLabel = "Semua Periode";
    if (period === "today") {
      const d = String(now.getDate()).padStart(2, "0");
      const m = String(now.getMonth() + 1).padStart(2, "0");
      periodLabel = `Hari Ini (${d}/${m}/${now.getFullYear()})`;
    } else if (period === "this_month") {
      const m = String(now.getMonth() + 1).padStart(2, "0");
      periodLabel = `Bulan Ini (${m}/${now.getFullYear()})`;
    } else if (period === "last_month") {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const m = String(prevDate.getMonth() + 1).padStart(2, "0");
      periodLabel = `Bulan Lalu (${m}/${prevDate.getFullYear()})`;
    }

    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const tanggalCetak = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;

    const cabangLabel = resolvedCabangName || (user.canSeeAll ? "Semua Cabang" : (user.cabangNama ? user.cabangNama.replace(/^Cabang\s*/i, "") : "Semua Cabang"));

    const reportCode = `LAP-${yyyy}${mm}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify?code=${reportCode}`;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 140 });

    return NextResponse.json({
      ok: true,
      meta: {
        reportCode,
        verificationUrl,
        qrDataUrl,
        tanggalCetak,
        generatedAt: now.toLocaleString("id-ID"),
        generatedBy: user.nama,
        periodLabel,
        cabangLabel,
      },
      stats: {
        totalAduan,
        totalSelesai,
        totalTelatRespon,
        selesaiTepatWaktu,
        persenSelesai: totalAduan > 0 ? Math.round((totalSelesai / totalAduan) * 100) : 0,
      },
      rows,
    });
  } catch (err: any) {
    console.error("Export report error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal menyiapkan laporan." }, { status: 500 });
  }
}
