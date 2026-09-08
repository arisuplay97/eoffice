import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie, type SessionUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, pin } = body;

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "Username atau cabang wajib diisi." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        username: { equals: String(username).trim(), mode: "insensitive" },
      },
      include: { cabang: true },
    });

    if (!user || !user.aktif) {
      return NextResponse.json(
        { ok: false, error: "Akun tidak ditemukan atau status nonaktif." },
        { status: 401 }
      );
    }

    let isValid = false;
    // Check PIN first, or if password matches PIN (for 6-digit access), or bcrypt password
    const enteredSecret = String(pin || password || "").trim();
    if (user.pin && enteredSecret === user.pin) {
      isValid = true;
    } else if (user.password) {
      isValid = await bcrypt.compare(enteredSecret, user.password);
      if (!isValid && user.password === enteredSecret) {
        isValid = true;
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Kata sandi atau PIN tidak sesuai." },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
      cabangId: user.cabangId,
      cabangNama: user.cabang?.nama ?? null,
      canSeeAll: user.role === Role.ADMIN_PUSAT || user.role === Role.DIREKSI,
    };

    const token = await signSession(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: sessionUser,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Terjadi kesalahan pada server saat login." },
      { status: 500 }
    );
  }
}
