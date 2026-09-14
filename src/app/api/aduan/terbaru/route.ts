import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatusAduan, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const ELIGIBLE_ROLES: Role[] = [
  Role.ADMIN_PUSAT,
  Role.SUPER_ADMIN,
  Role.ADMIN_CABANG,
];

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only eligible roles receive new aduan notifications
    if (!ELIGIBLE_ROLES.includes(user.role)) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const where: any = {
      status: StatusAduan.BARU,
    };

    // Branch scoping: ADMIN_CABANG only sees their own branch
    if (user.role === Role.ADMIN_CABANG && user.cabangId) {
      where.cabangId = user.cabangId;
    }

    const items = await prisma.aduan.findMany({
      where,
      select: {
        id: true,
        namaPelanggan: true,
        noPelanggan: true,
        noHp: true,
        jenisGangguan: true,
        prioritas: true,
        wilayah: true,
        waktuMasuk: true,
        sumberAduan: true,
        keterangan: true,
        cabang: {
          select: { nama: true },
        },
      },
      orderBy: { waktuMasuk: "desc" },
      take: 15,
    });

    const mapped = items.map((item) => ({
      id: item.id,
      namaPelanggan: item.namaPelanggan,
      noPelanggan: item.noPelanggan || "-",
      noHp: item.noHp || "-",
      jenisGangguan: item.jenisGangguan,
      prioritas: item.prioritas,
      cabangNama: item.cabang?.nama || "-",
      wilayah: item.wilayah,
      waktuMasuk: item.waktuMasuk.toISOString(),
      sumberAduan: item.sumberAduan,
      keterangan: item.keterangan || "",
    }));

    return NextResponse.json({ ok: true, items: mapped });
  } catch (err: any) {
    console.error("Aduan terbaru error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal memuat aduan terbaru." },
      { status: 500 }
    );
  }
}
