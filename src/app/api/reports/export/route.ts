import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calculateSlaInfo } from "@/lib/sla";
import QRCode from "qrcode";
import { StatusAduan } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cabangId = searchParams.get("cabangId");
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
    if (!user.canSeeAll && user.cabangId) {
      where.cabangId = user.cabangId;
    } else if (cabangId && cabangId !== "Semua") {
      where.cabangId = cabangId;
    }

    if (startDate && endDate) {
      where.waktuMasuk = { gte: startDate, lte: endDate };
    }

    const aduanList = await prisma.aduan.findMany({
      where,
      include: {
        cabang: true,
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
      if (isSelesai) totalSelesai++;
      if (sla.lateHours > 0) totalTelatRespon++;
      if (isSelesai && sla.lateHours === 0) selesaiTepatWaktu++;

      return {
        no: idx + 1,
        id: a.id,
        waktuMasuk: a.waktuMasuk.toISOString().replace("T", " ").slice(0, 19),
        waktuRespons: sla.waktuResponsText,
        waktuSelesai: sla.waktuSelesaiText,
        cabang: a.cabang.nama,
        wilayah: a.wilayah,
        desa: a.desa || "-",
        noPelanggan: a.noPelanggan,
        namaPelanggan: a.namaPelanggan,
        noHp: a.noHp,
        jenisGangguan: a.jenisGangguan,
        prioritas: a.prioritas,
        status: a.status,
        unit: a.unit,
        lamaPengerjaan: sla.lamaPengerjaanText,
        durasiRespons: sla.durasiText,
        statusSla: sla.statusLabel,
        selisihSla: sla.selisihText,
        keterangan: a.keterangan || "-",
        catatan: a.catatan || "-",
      };
    });

    const reportCode = `LAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify?code=${reportCode}`;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 140 });

    return NextResponse.json({
      ok: true,
      meta: {
        reportCode,
        verificationUrl,
        qrDataUrl,
        generatedAt: now.toLocaleString("id-ID"),
        generatedBy: user.nama,
        periodLabel:
          period === "today"
            ? "Hari Ini"
            : period === "this_month"
            ? "Bulan Ini"
            : period === "last_month"
            ? "Bulan Sebelumnya"
            : "Semua Periode",
        cabangLabel: user.canSeeAll ? (cabangId && cabangId !== "Semua" ? "Cabang Terpilih" : "Semua Cabang") : user.cabangNama,
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
