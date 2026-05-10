import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const s = await getSession();
  if (!s) return unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: s.id },
    include: { unit: true },
  });
  if (!user) return unauthorized();
  return ok({
    id: user.id,
    username: user.username,
    nama: user.nama,
    email: user.email,
    jabatan: user.jabatan,
    role: user.role,
    unit: user.unit ? { id: user.unit.id, nama: user.unit.nama, kode: user.unit.kode } : null,
  });
}
