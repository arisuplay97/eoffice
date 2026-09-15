import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { StatusAduan, Prioritas, JenisGangguan, SumberAduan, TipeDokumentasi } from "@prisma/client";
import { generateAduanId } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

// GET: Healthcheck OR Check Aduan Status (Mobile Tracking)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const noHp = searchParams.get("noHp");
    const noPelanggan = searchParams.get("noPelanggan");

    // If query params are provided, act as tracking API for Mobile App
    if (id || noHp || noPelanggan) {
      const where: any = {};
      if (id) where.id = id.trim();
      else if (noHp) where.noHp = { contains: noHp.replace(/[^0-9]/g, "").trim() };
      else if (noPelanggan) where.noPelanggan = noPelanggan.trim();

      const aduanList = await prisma.aduan.findMany({
        where,
        include: {
          cabang: { select: { nama: true, kode: true, kontak: true } },
          statusLogs: {
            orderBy: { waktu: "desc" },
            take: 5,
            select: { statusBaru: true, waktu: true, actorNama: true, keterangan: true },
          },
          penugasan: {
            include: {
              petugas: { select: { nama: true, role: true, noHp: true } },
            },
          },
          dokumentasi: {
            select: { id: true, fotoUrl: true, tipeFoto: true, caption: true, createdAt: true },
          },
        },
        orderBy: { waktuMasuk: "desc" },
        take: 10,
      });

      return NextResponse.json({
        ok: true,
        count: aduanList.length,
        items: aduanList,
      });
    }

    // Default: Healthcheck & Mobile Webhook documentation
    return NextResponse.json({
      ok: true,
      service: "SIAGA TIARA Webhook & Mobile Gateway",
      name: "SIAGA_TIARA_GATEWAY",
      status: "active",
      endpoint: "/api/webhook/aduan",
      description: "Endpoint webhook & REST API untuk menerima aduan masuk dari Aplikasi Mobile, WhatsApp, Call Center",
      supported_methods: ["GET", "POST"],
      payload_documentation: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          namaPelanggan: "Nama Pengadu / Warga (wajib)",
          noHp: "Nomor WhatsApp / HP (wajib)",
          noPelanggan: "Nomor ID Pelanggan / Meter (opsional)",
          jenisGangguan: "AIR_MATI | PIPA_BOCOR | AIR_KERUH | TEKANAN_RENDAH | METER_BERMASALAH | TAGIHAN | LAINNYA",
          prioritas: "DARURAT | TINGGI | SEDANG | RENDAH",
          keterangan: "Deskripsi detail keluhan / laporan warga",
          cabang: "Kode/Nama cabang (cth: Praya, Jonggat, PRY, dll) (opsional)",
          wilayah: "Nama dusun/desa/kecamatan atau alamat (opsional)",
          lokasiDetail: "Patokan lokasi / RT / RW (opsional)",
          latitude: -8.7042, // GPS mobile (opsional)
          longitude: 116.2731, // GPS mobile (opsional)
          fotoUrl: "URL foto aduan dari kamera HP (opsional)",
          sumber: "APLIKASI" // Sumber: APLIKASI | WHATSAPP | TELEPON
        }
      },
      version: "2.1.0",
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memproses permintaan." }, { status: 500 });
  }
}

// POST: Process incoming complaint webhook (Mobile App / WhatsApp / Webhook)
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
      "Pelanggan Mobile";

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

    // Parse GPS Coordinates from Mobile App if provided
    const rawLat = body.latitude ?? body.lat;
    const rawLng = body.longitude ?? body.lng ?? body.long;
    const parsedLat = rawLat !== undefined && rawLat !== null && rawLat !== "" ? parseFloat(String(rawLat)) : null;
    const parsedLng = rawLng !== undefined && rawLng !== null && rawLng !== "" ? parseFloat(String(rawLng)) : null;
    const latitude = parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null;
    const longitude = parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null;

    let linkMaps = body.linkMaps || null;
    if (!linkMaps && latitude !== null && longitude !== null) {
      linkMaps = `https://www.google.com/maps?q=${latitude},${longitude}`;
    }

    // Detect Source (Mobile App / WhatsApp / Call Center)
    const rawSumber = String(body.sumber || body.sumberAduan || body.source || "").toUpperCase();
    const isMobile = rawSumber.includes("MOBILE") || rawSumber.includes("APLIKASI") || rawSumber.includes("APP");
    const isTelepon = rawSumber.includes("TELEPON") || rawSumber.includes("PHONE") || rawSumber.includes("CALL");
    const isLangsung = rawSumber.includes("LANGSUNG") || rawSumber.includes("WALKIN");

    let sumberAduanEnum: SumberAduan = SumberAduan.WHATSAPP;
    if (isTelepon) sumberAduanEnum = SumberAduan.TELEPON;
    else if (isLangsung) sumberAduanEnum = SumberAduan.LANGSUNG;
    else if (rawSumber.includes("DASHBOARD")) sumberAduanEnum = SumberAduan.DASHBOARD;

    // Generate unique ID (e.g. BKU123C, PRY7K2A)
    let newId = generateAduanId(cabang.kode);
    let attempts = 0;
    while (attempts < 10) {
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
        sumberAduan: sumberAduanEnum,
        unit: isMobile ? "Aplikasi Mobile" : (body.unit || "Cabang"),
        keterangan: rawKeterangan
          ? String(rawKeterangan).trim()
          : (isMobile ? "Laporan masuk via Aplikasi Mobile Pelanggan." : "Laporan aduan via Webhook WhatsApp API."),
        catatan: body.catatan
          ? String(body.catatan).trim()
          : (isMobile ? "Dilaporkan via Aplikasi Mobile Pelanggan" : null),
        lokasiDetail: body.lokasiDetail || body.alamat || null,
        latitude,
        longitude,
        linkMaps,
        waktuMasuk: now,
        slaJam: 24,
      },
      include: {
        cabang: { select: { nama: true, kode: true } },
      },
    });

    // Save photo documentation if provided by mobile app
    const photoUrls: string[] = [];
    if (typeof body.fotoUrl === "string" && body.fotoUrl.trim()) photoUrls.push(body.fotoUrl.trim());
    if (typeof body.foto === "string" && body.foto.trim()) photoUrls.push(body.foto.trim());
    if (typeof body.gambar === "string" && body.gambar.trim()) photoUrls.push(body.gambar.trim());
    if (typeof body.image === "string" && body.image.trim()) photoUrls.push(body.image.trim());
    if (Array.isArray(body.dokumentasi)) {
      body.dokumentasi.forEach((p: any) => {
        if (typeof p === "string" && p.trim()) photoUrls.push(p.trim());
        else if (p && typeof p.fotoUrl === "string" && p.fotoUrl.trim()) photoUrls.push(p.fotoUrl.trim());
        else if (p && typeof p.url === "string" && p.url.trim()) photoUrls.push(p.url.trim());
      });
    }

    if (photoUrls.length > 0) {
      for (const pUrl of photoUrls) {
        try {
          await prisma.dokumentasiAduan.create({
            data: {
              aduanId: newId,
              tipeFoto: TipeDokumentasi.FOTO_SEBELUM,
              fotoUrl: pUrl,
              caption: isMobile ? "Foto keluhan dari Aplikasi Mobile" : "Foto aduan masuk",
              uploadedBy: String(rawNama).trim() || "Pelanggan",
              isValid: true,
            },
          });
        } catch (photoErr) {
          console.warn("Gagal menyimpan foto dokumentasi:", photoErr);
        }
      }
    }

    // Create audit status log
    const actor = isMobile ? "Aplikasi Mobile" : "Sistem Webhook";
    const logDesc = isMobile
      ? "Aduan otomatis diterima dari Aplikasi Mobile Pelanggan"
      : `Aduan otomatis diterima dari Webhook ${body.sumber || "WhatsApp/Call Center"}`;

    await prisma.statusLog.create({
      data: {
        aduanId: newId,
        statusBaru: StatusAduan.BARU,
        actorNama: actor,
        keterangan: logDesc,
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
        latitude: aduan.latitude,
        longitude: aduan.longitude,
        linkMaps: aduan.linkMaps,
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
