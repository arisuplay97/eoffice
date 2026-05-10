import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canManageUsers } from "@/lib/auth";
import UsersClient from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = (await getSession())!;
  if (!canManageUsers(session.role)) redirect("/dashboard");

  const [users, units] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ aktif: "desc" }, { nama: "asc" }],
      include: { unit: { select: { id: true, nama: true, kode: true } } },
    }),
    prisma.unit.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, kode: true },
    }),
  ]);

  return (
    <UsersClient
      currentUserId={session.id}
      users={JSON.parse(
        JSON.stringify(
          users.map((u) => ({
            id: u.id,
            username: u.username,
            nama: u.nama,
            email: u.email,
            jabatan: u.jabatan,
            nip: u.nip,
            role: u.role,
            aktif: u.aktif,
            unit: u.unit,
            createdAt: u.createdAt,
          }))
        )
      )}
      units={units}
    />
  );
}
