import { prisma } from "@/lib/prisma";
import { getSession, canViewAllDisposisi } from "@/lib/auth";
import DisposisiListClient from "./list-client";

export const dynamic = "force-dynamic";

export default async function DisposisiPage({
  searchParams,
}: {
  searchParams?: { scope?: string; status?: string; q?: string };
}) {
  const session = (await getSession())!;
  const scope = (searchParams?.scope as "inbox" | "outbox" | "all") || "inbox";

  const where: any = {};
  if (scope === "inbox") {
    const conditions: any[] = [{ toUserId: session.id }];
    if (session.unitId) conditions.push({ toUnitId: session.unitId, toUserId: null });
    where.OR = conditions;
  } else if (scope === "outbox") {
    where.fromUserId = session.id;
  }
  if (searchParams?.status) where.status = searchParams.status as any;
  if (searchParams?.q) {
    const q = searchParams.q;
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { catatan: { contains: q, mode: "insensitive" } },
          { suratMasuk: { perihal: { contains: q, mode: "insensitive" } } },
          { suratMasuk: { nomorAgenda: { contains: q, mode: "insensitive" } } },
          { suratMasuk: { asalSurat: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  // Count badges
  const [inboxCount, outboxCount, allCount] = await Promise.all([
    prisma.disposisi.count({
      where: {
        OR: [
          { toUserId: session.id },
          ...(session.unitId ? [{ toUnitId: session.unitId, toUserId: null }] : []),
        ],
        status: { in: ["BARU", "DIBACA"] },
      },
    }),
    prisma.disposisi.count({
      where: { fromUserId: session.id, status: { notIn: ["SELESAI"] } },
    }),
    canViewAllDisposisi(session.role) ? prisma.disposisi.count() : Promise.resolve(0),
  ]);

  const items = await prisma.disposisi.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      suratMasuk: {
        select: {
          id: true,
          nomorAgenda: true,
          perihal: true,
          prioritas: true,
          asalSurat: true,
        },
      },
      fromUser: { select: { nama: true, jabatan: true } },
      toUser: { select: { nama: true, jabatan: true } },
      toUnit: { select: { nama: true } },
    },
  });

  return (
    <DisposisiListClient
      scope={scope}
      canViewAll={canViewAllDisposisi(session.role)}
      items={JSON.parse(JSON.stringify(items))}
      badges={{ inbox: inboxCount, outbox: outboxCount, all: allCount }}
      initialFilters={searchParams || {}}
    />
  );
}
