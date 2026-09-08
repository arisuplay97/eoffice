import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calculateSlaInfo } from "@/lib/sla";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const aduan = await prisma.aduan.findUnique({
      where: { id },
      include: {
        cabang: true,
        statusLogs: {
          orderBy: { waktu: "asc" },
          include: { user: true },
        },
        dokumentasi: {
          orderBy: { createdAt: "desc" },
        },
        penugasan: {
          include: { petugas: true },
        },
      },
    });

    if (!aduan) {
      return NextResponse.json({ ok: false, error: "Aduan tidak ditemukan." }, { status: 404 });
    }

    // Branch scoping check
    if (!user.canSeeAll && user.cabangId && aduan.cabangId !== user.cabangId) {
      return NextResponse.json({ ok: false, error: "Anda tidak memiliki akses ke aduan cabang ini." }, { status: 403 });
    }

    const sla = calculateSlaInfo(aduan);

    return NextResponse.json({
      ok: true,
      aduan: {
        ...aduan,
        sla,
      },
    });
  } catch (err: any) {
    console.error("Get aduan detail error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Gagal memuat detail aduan." },
      { status: 500 }
    );
  }
}
