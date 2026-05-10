import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "1";

  const items = await prisma.notification.findMany({
    where: {
      userId: session.id,
      ...(unreadOnly && { dibaca: false }),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: session.id, dibaca: false },
  });
  return ok({ items, unreadCount });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (body?.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.id, dibaca: false },
      data: { dibaca: true },
    });
    return ok({ markedAllRead: true });
  }
  if (body?.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: session.id },
      data: { dibaca: true },
    });
    return ok({ markedRead: true });
  }
  return ok({});
}
