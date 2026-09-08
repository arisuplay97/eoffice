import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canManageSettings } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [settings, users, announcements, branches] = await Promise.all([
      prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
      prisma.user.findMany({
        include: { cabang: true },
        orderBy: { username: "asc" },
      }),
      prisma.pengumumanLayanan.findMany({
        orderBy: { createdAt: "desc" },
        include: { cabang: true },
      }),
      prisma.cabang.findMany({
        orderBy: { kode: "asc" },
      }),
    ]);

    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      nama: u.nama,
      role: u.role,
      cabangNama: u.cabang?.nama || "Pusat",
      aktif: u.aktif,
      pin: u.pin ? "Tersedia" : "-",
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toLocaleString("id-ID") : "-",
    }));

    return NextResponse.json({
      ok: true,
      settings,
      users: sanitizedUsers,
      announcements,
      branches,
    });
  } catch (err: any) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memuat pengaturan." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user || !canManageSettings(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Hanya Administrator Pusat yang memiliki wewenang mengubah pengaturan." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "update_setting") {
      const { key, value } = body;
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedAt: new Date() },
        create: { key, value, updatedAt: new Date() },
      });
      return NextResponse.json({ ok: true, message: `Pengaturan ${key} berhasil diperbarui.` });
    }

    if (action === "reset_pin") {
      const { userId, newPin } = body;
      if (!/^\d{4,8}$/.test(String(newPin).trim())) {
        return NextResponse.json({ ok: false, error: "PIN baru harus berupa 4-8 digit angka." }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { pin: String(newPin).trim() },
      });
      return NextResponse.json({ ok: true, message: "PIN akun berhasil diubah." });
    }

    if (action === "toggle_user") {
      const { userId, aktif } = body;
      await prisma.user.update({
        where: { id: userId },
        data: { aktif: Boolean(aktif) },
      });
      return NextResponse.json({ ok: true, message: "Status akun berhasil diperbarui." });
    }

    if (action === "create_announcement") {
      const { judul, isi, mulai, selesai, cabangId, wilayahTerdampak, jenisDicegah, cegahAduan } = body;
      const created = await prisma.pengumumanLayanan.create({
        data: {
          judul,
          isi,
          status: "AKTIF",
          mulai: new Date(mulai),
          selesai: new Date(selesai),
          cabangId: cabangId || null,
          wilayahTerdampak: wilayahTerdampak || null,
          jenisDicegah: jenisDicegah || null,
          cegahAduan: Boolean(cegahAduan),
        },
      });
      return NextResponse.json({ ok: true, announcement: created, message: "Pengumuman berhasil diterbitkan." });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: any) {
    console.error("Settings POST error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memproses pengaturan." }, { status: 500 });
  }
}
