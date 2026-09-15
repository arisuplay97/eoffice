import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatusAduan, Prioritas, JenisGangguan } from "@prisma/client";

export const dynamic = "force-dynamic";
import {
  calculateSlaInfo,
  formatDurasi,
  isStatusAktif,
  isStatusAktifDitangani,
  isStatusResponded,
} from "@/lib/sla";
import { CABANG_LIST } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterCabang = searchParams.get("cabang") || "Semua";
    const filterWilayah = searchParams.get("wilayah") || "Semua";
    const filterPeriod = searchParams.get("period") || "this_month";
    const filterSelesaiPeriod = searchParams.get("selesaiPeriod") || "bulan_ini";

    const now = new Date();
    const nowMs = now.getTime();

    // Determine date range for incoming complaints
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filterPeriod === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (filterPeriod === "last_7_days") {
      startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      endDate = now;
    } else if (filterPeriod === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterPeriod === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    // Build database where clause
    const where: any = {};

    // Branch scoping
    if (!user.canSeeAll && user.cabangId) {
      where.cabangId = user.cabangId;
    } else if (filterCabang !== "Semua") {
      const matchedCabang = await prisma.cabang.findFirst({
        where: {
          OR: [{ nama: filterCabang }, { kode: filterCabang }],
        },
      });
      if (matchedCabang) {
        where.cabangId = matchedCabang.id;
      }
    }

    if (filterWilayah !== "Semua") {
      where.wilayah = filterWilayah;
    }

    // Backlog lintas-bulan (Opsi A PRD §9.1):
    // Jika ada filter periode, kita ambil:
    // 1. Aduan yang masuk pada periode terpilih (untuk metrik Aduan Masuk dan Selesai)
    // 2. ATAU seluruh aduan yang masih AKTIF (agar tidak ada tunggakan backlog yang hilang dari Fokus Penanganan)
    let aduanList: any[] = [];

    if (startDate && endDate) {
      aduanList = await prisma.aduan.findMany({
        where: {
          ...where,
          OR: [
            {
              waktuMasuk: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              status: {
                notIn: [StatusAduan.SELESAI, StatusAduan.BATAL],
              },
            },
          ],
        },
        include: {
          cabang: true,
          statusLogs: {
            orderBy: { waktu: "asc" },
            take: 1,
          },
          dokumentasi: {
            where: { isValid: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { waktuMasuk: "desc" },
      });
    } else {
      aduanList = await prisma.aduan.findMany({
        where,
        include: {
          cabang: true,
          statusLogs: {
            orderBy: { waktu: "asc" },
            take: 1,
          },
          dokumentasi: {
            where: { isValid: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { waktuMasuk: "desc" },
      });
    }

    // Separate into categories & calculate SLA
    let aduanMasukPeriodCount = 0;
    let aduanAktifCount = 0;
    let lewatSlaCount = 0;
    let selesaiPeriodCount = 0;
    let prioritasTinggiCount = 0;

    let wajibResponsTotal = 0;
    let sudahResponsTotal = 0;
    let dinilaiResponsTotal = 0;
    let tepatWaktuTotal = 0;

    const fokusRows: any[] = [];
    const terbaruRows: any[] = [];
    const aduanBaruRows: any[] = [];
    const aduanProsesRows: any[] = [];
    const selesaiRows: any[] = [];

    const startMonthThis = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startMonthPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const endMonthPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();

    // Map for branch speed ranking
    const cabangStatMap: Record<
      string,
      {
        nama: string;
        kode: string;
        total: number;
        responded: number;
        onTime: number;
        totalHours: number;
      }
    > = {};

    CABANG_LIST.forEach((c) => {
      cabangStatMap[c.kode] = {
        nama: c.nama,
        kode: c.kode,
        total: 0,
        responded: 0,
        onTime: 0,
        totalHours: 0,
      };
    });

    for (const d of aduanList) {
      const masukMs = new Date(d.waktuMasuk).getTime();
      const inPeriod =
        !startDate || !endDate || (masukMs >= startDate.getTime() && masukMs <= endDate.getTime());

      if (inPeriod) {
        aduanMasukPeriodCount++;
        if (d.prioritas === Prioritas.TINGGI || d.prioritas === Prioritas.DARURAT) {
          prioritasTinggiCount++;
        }
      }

      const sla = calculateSlaInfo(d, nowMs);

      // Track branch stats
      const cKode = d.cabang?.kode || "LNY";
      if (!cabangStatMap[cKode]) {
        cabangStatMap[cKode] = {
          nama: d.cabang?.nama || "Cabang Lainnya",
          kode: cKode,
          total: 0,
          responded: 0,
          onTime: 0,
          totalHours: 0,
        };
      }
      cabangStatMap[cKode].total++;

      if (d.status !== StatusAduan.BATAL) {
        wajibResponsTotal++;
        if (sla.responded) {
          sudahResponsTotal++;
          dinilaiResponsTotal++;
          cabangStatMap[cKode].responded++;
          cabangStatMap[cKode].totalHours += sla.responseHours;
          if (sla.statusCode === "RESPONDED_ONTIME") {
            tepatWaktuTotal++;
            cabangStatMap[cKode].onTime++;
          }
        } else if (sla.statusCode === "ACTIVE_LATE") {
          dinilaiResponsTotal++;
        }
      }

      // Summary object for table rendering
      const summaryItem = {
        id: d.id,
        waktuMasuk: d.waktuMasuk,
        waktuMasukText: sla.waktuMasukText,
        waktuResponsText: sla.waktuResponsText,
        waktuSelesaiText: sla.waktuSelesaiText,
        cabangId: d.cabangId,
        cabangNama: d.cabang?.nama || "-",
        cabangKode: d.cabang?.kode || "-",
        wilayah: d.wilayah,
        desa: d.desa || "-",
        noPelanggan: d.noPelanggan,
        namaPelanggan: d.namaPelanggan,
        noHp: d.noHp,
        jenisGangguan: d.jenisGangguan,
        prioritas: d.prioritas,
        status: d.status,
        sumberAduan: d.sumberAduan,
        unit: d.unit,
        keterangan: d.keterangan || "-",
        catatan: d.catatan || "-",
        lokasiDetail: d.lokasiDetail || "-",
        linkMaps: d.linkMaps,
        sla,
        fotoSelesaiUrl: d.dokumentasi?.[0]?.fotoUrl || null,
        alasanFokus:
          sla.statusCode === "ACTIVE_LATE"
            ? d.prioritas === Prioritas.DARURAT
              ? "Darurat & lewat respons"
              : "Lewat batas respons"
            : sla.statusCode === "ACTIVE_NEAR"
            ? d.prioritas === Prioritas.DARURAT
              ? "Darurat & hampir lewat"
              : "Hampir lewat respons"
            : "Perlu perhatian",
      };

      if (isStatusAktif(d.status)) {
        if (d.status === StatusAduan.BARU) {
          aduanBaruRows.push(summaryItem);
        }
        if (isStatusAktifDitangani(d.status)) {
          aduanAktifCount++;
          aduanProsesRows.push(summaryItem);
        }
        if (!sla.responded && sla.statusCode === "ACTIVE_LATE") {
          lewatSlaCount++;
        }

        // Strict table separation (PRD V11.10.7)
        if (sla.statusCode === "ACTIVE_LATE" || sla.statusCode === "ACTIVE_NEAR") {
          fokusRows.push(summaryItem);
        } else {
          terbaruRows.push(summaryItem);
        }
      } else if (d.status === StatusAduan.SELESAI) {
        const selesaiMs = d.waktuSelesai ? new Date(d.waktuSelesai).getTime() : masukMs;
        if (inPeriod) {
          selesaiPeriodCount++;
        }

        if (filterSelesaiPeriod === "bulan_ini") {
          if (selesaiMs >= startMonthThis) {
            selesaiRows.push(summaryItem);
          }
        } else if (filterSelesaiPeriod === "bulan_lalu") {
          if (selesaiMs >= startMonthPrev && selesaiMs <= endMonthPrev) {
            selesaiRows.push(summaryItem);
          }
        } else {
          selesaiRows.push(summaryItem);
        }
      }
    }

    // Sort tables
    fokusRows.sort((a, b) => new Date(a.waktuMasuk).getTime() - new Date(b.waktuMasuk).getTime());
    terbaruRows.sort((a, b) => new Date(b.waktuMasuk).getTime() - new Date(a.waktuMasuk).getTime());
    aduanBaruRows.sort((a, b) => new Date(b.waktuMasuk).getTime() - new Date(a.waktuMasuk).getTime());
    aduanProsesRows.sort((a, b) => new Date(b.waktuMasuk).getTime() - new Date(a.waktuMasuk).getTime());
    selesaiRows.sort((a, b) => new Date(b.waktuMasuk).getTime() - new Date(a.waktuMasuk).getTime());

    // Branch ranking calculation
    const cabangRanking = Object.values(cabangStatMap)
      .map((c) => {
        const percent = c.total > 0 ? Math.round((c.onTime / c.total) * 100) : 0;
        const avgHours = c.responded > 0 ? Math.round((c.totalHours / c.responded) * 10) / 10 : 0;
        return {
          nama: c.nama,
          kode: c.kode,
          total: c.total,
          responded: c.responded,
          onTime: c.onTime,
          onTimePercent: percent,
          avgResponseHours: avgHours,
          avgResponseText: formatDurasi(avgHours),
        };
      })
      .sort((a, b) => {
        if (b.onTimePercent !== a.onTimePercent) return b.onTimePercent - a.onTimePercent;
        if (a.avgResponseHours !== b.avgResponseHours) return a.avgResponseHours - b.avgResponseHours;
        return b.total - a.total;
      });

    const topBranch = cabangRanking.length > 0 && cabangRanking[0].total > 0 ? cabangRanking[0] : null;

    // 7 Days Trend Calculation
    const trend7Days: { label: string; dateKey: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const dayName = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
      const dayCount = aduanList.filter((item) => {
        const itemMs = new Date(item.waktuMasuk).getTime();
        return itemMs >= dayStart.getTime() && itemMs <= dayEnd.getTime();
      }).length;

      trend7Days.push({
        label: dayName,
        dateKey: dayStart.toISOString().slice(0, 10),
        count: dayCount,
      });
    }

    // Status Count
    const statusCounts: Record<string, number> = {};
    Object.values(StatusAduan).forEach((s) => {
      statusCounts[s] = 0;
    });
    aduanList.forEach((a) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    // Dominant Disturbance
    const gangguanMap: Record<string, number> = {};
    aduanList.forEach((a) => {
      gangguanMap[a.jenisGangguan] = (gangguanMap[a.jenisGangguan] || 0) + 1;
    });
    const dominantDisturbances = Object.entries(gangguanMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // Open Chat Admin Queue Count
    const openChatCount = await prisma.chatAdminQueue.count({
      where: { status: "OPEN" },
    });

    return NextResponse.json({
      ok: true,
      lastUpdate: now.toLocaleString("id-ID"),
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        cabangNama: user.cabangNama,
        canSeeAll: user.canSeeAll,
      },
      cards: {
        aduanMasuk: aduanMasukPeriodCount,
        aduanAktif: aduanAktifCount,
        lewatSLA: lewatSlaCount,
        selesai: selesaiPeriodCount,
        prioritasTinggi: prioritasTinggiCount,
        cabangTerbaik: topBranch
          ? {
              nama: topBranch.nama,
              persen: `${topBranch.onTimePercent}%`,
              durasi: topBranch.avgResponseText,
              total: topBranch.total,
            }
          : {
              nama: "Belum ada data",
              persen: "0%",
              durasi: "-",
              total: 0,
            },
        responsAwal: wajibResponsTotal > 0 ? Math.round((sudahResponsTotal / wajibResponsTotal) * 100) : 0,
        responsTepatWaktu: dinilaiResponsTotal > 0 ? Math.round((tepatWaktuTotal / dinilaiResponsTotal) * 100) : 0,
      },
      charts: {
        trend7Days,
        statusCounts,
        dominantDisturbances,
        cabangRanking,
      },
      tables: {
        fokus: fokusRows,
        terbaru: terbaruRows,
        aduanBaru: aduanBaruRows,
        aduanProses: aduanProsesRows,
        selesai: selesaiRows,
      },
      chatAdmin: {
        openCount: openChatCount,
      },
      pulseSignature: `${aduanList.length}~${aduanAktifCount}~${lewatSlaCount}~${openChatCount}~${now.getMinutes()}`,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
