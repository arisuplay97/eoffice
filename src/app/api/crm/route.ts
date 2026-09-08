import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queueId = searchParams.get("queueId");

    if (queueId) {
      const messages = await prisma.crmMessage.findMany({
        where: { queueId },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ ok: true, messages });
    }

    const queues = await prisma.chatAdminQueue.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ ok: true, queues });
  } catch (err: any) {
    console.error("CRM GET error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memuat data CRM." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { queueId, message, status } = body;

    if (!queueId) {
      return NextResponse.json({ ok: false, error: "ID antrean chat wajib disertakan." }, { status: 400 });
    }

    const now = new Date();

    if (message && String(message).trim()) {
      await prisma.crmMessage.create({
        data: {
          queueId,
          sender: "ADMIN",
          message: String(message).trim(),
          createdAt: now,
        },
      });

      await prisma.chatAdminQueue.update({
        where: { id: queueId },
        data: {
          lastAdminMessage: String(message).trim(),
          lastAdminAt: now,
          status: status || "IN_PROGRESS",
          updatedAt: now,
        },
      });
    } else if (status) {
      await prisma.chatAdminQueue.update({
        where: { id: queueId },
        data: {
          status,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({ ok: true, message: "Pesan berhasil dikirim / status diperbarui." });
  } catch (err: any) {
    console.error("CRM POST error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Gagal memproses pesan CRM." }, { status: 500 });
  }
}
