import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { StatusAduan, Prioritas, JenisGangguan, SumberAduan } from "@prisma/client";

export const dynamic = "force-dynamic";

function generateAduanId(kodeCabang: string): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${kodeCabang}${yy}${mm}${dd}${rand}`;
}

function normalizeJenisGangguan(input?: string): JenisGangguan {
  if (!input) return JenisGangguan.LAINNYA;
  const str = input.toUpperCase().replace(/\s+/g, "_");
  if (str.includes("AIR_MATI") || str.includes("MATI")) return JenisGangguan.AIR_MATI;
  if (str.includes("BOCOR") || str.includes("PIPA")) return JenisGangguan.PIPA_BOCOR;
  if (str.includes("KERUH") || str.includes("KOTOR")) return JenisGangguan.AIR_KERUH;
  if (str.includes("KECIL") || str.includes("RENDAH") || str.includes("TEKANAN"))
    return JenisGangguan.TEKANAN_RENDAH;
  if (str.includes("METER") || str.includes("RUSAK")) return JenisGangguan.METER_BERMASALAH;
  if (str.includes("TAGIHAN") || str.includes("REKENING") || str.includes("BIAYA"))
    return JenisGangguan.TAGIHAN;
  if (str.includes("SAMBUNGAN") || str.includes("PASANG") || str.includes("BARU"))
    return JenisGangguan.SAMBUNGAN_BARU;
  return JenisGangguan.LAINNYA;
}

function normalizePrioritas(input?: string, keteranganText?: string): Prioritas {
  if (input) {
    const p = input.toUpperCase().trim();
    if (p === "DARURAT" || p === "EMERGENCY" || p === "CRITICAL") return Prioritas.DARURAT;
    if (p === "TINGGI" || p === "HIGH") return Prioritas.TINGGI;
    if (p === "SEDANG" || p === "MEDIUM") return Prioritas.SEDANG;
    if (p === "RENDAH" || p === "LOW") return Prioritas.RENDAH;
  }
  // Auto-detect high priority keywords in text
  const text = (keteranganText || "").toLowerCase();
  if (
    text.includes("darurat") ||
    text.includes("bocor besar") ||
    text.includes("pipa induk") ||
    text.includes("banjir")
  ) {
    return Prioritas.DARURAT;
  }
  if (
    text.includes("segera") ||
    text.includes("urgent") ||
    text.includes("mati total") ||
    text.includes("rumah sakit")
  ) {
    return Prioritas.TINGGI;
  }
  return Prioritas.SEDANG;
}

// GET: Healthcheck / Webhook URL verification endpoint
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "SIAGA TIARA Webhook Receiver",
    name: "SIAGA_TIARA_INCOMING",
    status: "active",
    endpoint: "/api/webhook/aduan",
    description: "Endpoint webhook untuk menerima aduan masuk dari WhatsApp / Call Center / Google Script",
    version: "2.0.0",
  });
}

// POST: Process incoming complaint webhook
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      formData.forEach((val, key) => {
        body[key] = val.toString();
      });
    } else {
      const raw = await req.text();
      try {
        body = JSON.parse(raw);
      } catch {
        body = { message: raw };
      }
    }

    // Extract fields flexibly
    const rawNama =
      body.namaPelanggan ||
      body.nama ||
      body.name ||
      body.senderName ||
      body.pushName ||
      body.sender ||
      "Pelanggan WhatsApp";

    const rawNoHp =
      body.noHp ||
      body.telepon ||
      body.phone ||
      body.sender ||
      body.nomor_hp ||
      body.from ||
      "-";

    const cleanNoHp = String(rawNoHp).replace(/[^0-9+]/g, "").trim();

    const cleanNoPelanggan = String(
      body.noPelanggan || body.nomor_pelanggan || body.no_meter || body.idPelanggan || "-"
    ).trim();

    const rawKeterangan =
      body.keterangan ||
      body.keluhan ||
      body.pesan ||
      body.message ||
      body.deskripsi ||
      body.text ||
      "";

    const rawCabang = String(body.cabangId || body.cabang || body.unit || "").trim();
    const rawWilayah = String(body.wilayah || body.lokasi || body.alamat || "").trim();

    // Find target cabang
    let cabang = null;
    if (rawCabang) {
      const cleanCabang = rawCabang.replace(/^cabang\s*/i, "").trim();
      cabang = await prisma.cabang.findFirst({
        where: {
          OR: [
            { id: rawCabang },
            { kode: { equals: rawCabang.toUpperCase() } },
            { nama: { contains: cleanCabang, mode: "insensitive" } },
          ],
        },
      });
    }

    // Fallback: match by wilayah
    if (!cabang && rawWilayah) {
      cabang = await prisma.cabang.findFirst({
        where: {
          wilayah: { contains: rawWilayah, mode: "insensitive" },
        },
      });
    }

    // Default to Cabang Praya or first active cabang if not resolved
    if (!cabang) {
      cabang = await prisma.cabang.findFirst({
        where: {
          OR: [{ kode: "PRY" }, { nama: { contains: "Praya", mode: "insensitive" } }],
        },
      });
      if (!cabang) {
        cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
      }
    }

    if (!cabang) {
      return NextResponse.json(
        { ok: false, error: "Tidak ada cabang operasional aktif di sistem." },
        { status: 500 }
      );
    }

    const jenisGangguan = normalizeJenisGangguan(body.jenisGangguan || rawKeterangan);
    const prioritas = normalizePrioritas(body.prioritas, rawKeterangan);

    // Generate unique ID
    let newId = generateAduanId(cabang.kode);
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.aduan.findUnique({ where: { id: newId } });
      if (!exists) break;
      newId = generateAduanId(cabang.kode);
      attempts++;
    }

    const now = new Date();

    const aduan = await prisma.aduan.create({
      data: {
        id: newId,
        cabangId: cabang.id,
        wilayah: rawWilayah || cabang.wilayah,
        desa: body.desa || null,
        noPelanggan: cleanNoPelanggan,
        namaPelanggan: String(rawNama).trim(),
        noHp: cleanNoHp || "-",
        jenisGangguan,
        prioritas,
        status: StatusAduan.BARU,
        sumberAduan: SumberAduan.WHATSAPP,
        unit: body.unit || "Cabang",
        keterangan: rawKeterangan ? String(rawKeterangan).trim() : "Laporan aduan via Webhook WhatsApp API.",
        catatan: body.catatan ? String(body.catatan).trim() : null,
        lokasiDetail: body.lokasiDetail || body.alamat || null,
        linkMaps: body.linkMaps || null,
        waktuMasuk: now,
        slaJam: 24,
      },
      include: {
        cabang: { select: { nama: true, kode: true } },
      },
    });

    // Create audit status log
    await prisma.statusLog.create({
      data: {
        aduanId: newId,
        statusBaru: StatusAduan.BARU,
        actorNama: "Sistem Webhook",
        keterangan: `Aduan otomatis diterima dari Webhook ${body.sumber || "WhatsApp/Call Center"}`,
        waktu: now,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Aduan berhasil diterima dan dicatat ke SIAGA TIARA.",
      id: newId,
      aduan: {
        id: aduan.id,
        namaPelanggan: aduan.namaPelanggan,
        noHp: aduan.noHp,
        cabangNama: aduan.cabang?.nama,
        jenisGangguan: aduan.jenisGangguan,
        prioritas: aduan.prioritas,
        status: aduan.status,
        waktuMasuk: aduan.waktuMasuk.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Webhook Aduan Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal memproses webhook aduan." },
      { status: 500 }
    );
  }
}
