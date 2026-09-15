import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canManageSettings } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [settings, users, announcements, branches, petugas] = await Promise.all([
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
      prisma.petugas.findMany({
        where: !user.canSeeAll && user.cabangId ? { cabangId: user.cabangId } : {},
        include: { cabang: true },
        orderBy: [{ cabang: { kode: "asc" } }, { nama: "asc" }],
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
      petugas,
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

    // PETUGAS WHATSAPP MANAGEMENT
    if (action === "create_petugas") {
      const { nama, noHp, role, cabangId, notifAduanBaru, notifDarurat } = body;
      if (!nama || !noHp || !cabangId) {
        return NextResponse.json({ ok: false, error: "Nama, No WhatsApp, dan Cabang penugasan wajib diisi." }, { status: 400 });
      }

      const cleanPhone = String(noHp).replace(/[^0-9+]/g, "").trim();

      // Check duplicate phone
      const existing = await prisma.petugas.findFirst({
        where: {
          OR: [
            { noHp: cleanPhone },
            { noHp: `0${cleanPhone.replace(/^62/, "")}` },
            { noHp: `62${cleanPhone.replace(/^0/, "")}` },
          ],
        },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `Nomor WhatsApp ${cleanPhone} sudah terdaftar atas nama ${existing.nama}.` },
          { status: 400 }
        );
      }

      const created = await prisma.petugas.create({
        data: {
          nama: String(nama).trim(),
          noHp: cleanPhone,
          role: String(role || "Teknisi Lapangan").trim(),
          cabangId,
          notifAduanBaru: notifAduanBaru !== undefined ? Boolean(notifAduanBaru) : true,
          notifDarurat: notifDarurat !== undefined ? Boolean(notifDarurat) : true,
          aktif: true,
        },
        include: { cabang: true },
      });

      return NextResponse.json({
        ok: true,
        message: `Akun petugas ${created.nama} berhasil didaftarkan untuk WhatsApp.`,
        petugas: created,
      });
    }

    if (action === "update_petugas") {
      const { petugasId, nama, noHp, role, cabangId, notifAduanBaru, notifDarurat, aktif } = body;
      if (!petugasId) {
        return NextResponse.json({ ok: false, error: "ID Petugas tidak valid." }, { status: 400 });
      }

      const dataToUpdate: any = {};
      if (nama) dataToUpdate.nama = String(nama).trim();
      if (noHp) dataToUpdate.noHp = String(noHp).replace(/[^0-9+]/g, "").trim();
      if (role) dataToUpdate.role = String(role).trim();
      if (cabangId) dataToUpdate.cabangId = cabangId;
      if (notifAduanBaru !== undefined) dataToUpdate.notifAduanBaru = Boolean(notifAduanBaru);
      if (notifDarurat !== undefined) dataToUpdate.notifDarurat = Boolean(notifDarurat);
      if (aktif !== undefined) dataToUpdate.aktif = Boolean(aktif);

      const updated = await prisma.petugas.update({
        where: { id: petugasId },
        data: dataToUpdate,
        include: { cabang: true },
      });

      return NextResponse.json({
        ok: true,
        message: `Data petugas ${updated.nama} berhasil diperbarui.`,
        petugas: updated,
      });
    }

    if (action === "toggle_petugas") {
      const { petugasId, aktif } = body;
      const updated = await prisma.petugas.update({
        where: { id: petugasId },
        data: { aktif: Boolean(aktif) },
      });
      return NextResponse.json({
        ok: true,
        message: `Status WhatsApp petugas ${updated.nama} berhasil diubah ke ${updated.aktif ? "Aktif" : "Nonaktif"}.`,
      });
    }

    if (action === "delete_petugas") {
      const { petugasId } = body;
      const target = await prisma.petugas.findUnique({ where: { id: petugasId } });
      if (!target) {
        return NextResponse.json({ ok: false, error: "Petugas tidak ditemukan." }, { status: 404 });
      }

      await prisma.petugas.delete({
        where: { id: petugasId },
      });
      return NextResponse.json({ ok: true, message: `Akun petugas ${target.nama} berhasil dihapus dari WhatsApp.` });
    }

    return NextResponse.json({ ok: false, error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: any) {
    console.error("Settings POST error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memproses pengaturan." }, { status: 500 });
  }
}
