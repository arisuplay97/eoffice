import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import UnitsClient from "./units-client";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const session = (await getSession())!;
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const units = await prisma.unit.findMany({
    orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    include: { _count: { select: { users: true, suratMasuk: true, suratKeluar: true } } },
  });
  return <UnitsClient units={JSON.parse(JSON.stringify(units))} />;
}
