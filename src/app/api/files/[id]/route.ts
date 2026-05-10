import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fail, unauthorized, notFound, forbidden } from "@/lib/api";
import { streamFileForDownload } from "@/lib/storage";
import {
  canViewSuratMasuk,
  canViewSuratKeluar,
  canViewDisposisi,
  isAdmin,
} from "@/lib/security";
import { audit, getClientInfo } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Akses dokumen dengan RBAC.
 *  - Wajib login.
 *  - Ownership check sesuai attachment parent (surat masuk / surat keluar / disposisi).
 *  - Stream file inline. Force download via ?download=1.
 *  - Tidak pernah mengekspos storage URL langsung.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const att = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: {
      suratMasuk: { select: { id: true, createdById: true, unitTujuanId: true, kodeVerifikasi: true } },
      suratKeluar: { select: { id: true, createdById: true, unitPembuatId: true, kodeVerifikasi: true } },
      disposisi: {
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          toUnitId: true,
          suratMasukId: true,
        },
      },
    },
  });

  if (!att || att.deletedAt) return notFound("File tidak ditemukan");

  let allowed = isAdmin(session);
  let entityType = "Attachment";
  let entityId = att.id;

  if (!allowed && att.suratMasuk) {
    allowed = await canViewSuratMasuk(session, att.suratMasuk.id);
    entityType = "SuratMasuk";
    entityId = att.suratMasuk.id;
  }
  if (!allowed && att.suratKeluar) {
    allowed = canViewSuratKeluar(session, att.suratKeluar);
    entityType = "SuratKeluar";
    entityId = att.suratKeluar.id;
  }
  if (!allowed && att.disposisi) {
    allowed = canViewDisposisi(session, att.disposisi);
    if (!allowed) {
      // Allow juga jika user bisa akses surat masuk terkait disposisi tsb
      allowed = await canViewSuratMasuk(session, att.disposisi.suratMasukId);
    }
    entityType = "Disposisi";
    entityId = att.disposisi.id;
  }

  if (!allowed) {
    const { ip, ua } = getClientInfo();
    await audit({
      userId: session.id,
      action: "ACCESS_DENIED",
      entityType: "Attachment",
      entityId: att.id,
      description: `Akses file ditolak`,
      ip,
      ua,
    });
    return forbidden("Anda tidak memiliki akses ke dokumen ini");
  }

  let buf: Buffer;
  try {
    buf = await streamFileForDownload(att.url, att.storageKey);
  } catch (e: any) {
    return fail("Gagal membaca file", 500);
  }

  await audit({
    userId: session.id,
    action: "FILE_DOWNLOADED",
    entityType,
    entityId,
    description: `Download ${att.nama}`,
  });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = att.nama.replace(/[\r\n";\\]/g, "_");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
