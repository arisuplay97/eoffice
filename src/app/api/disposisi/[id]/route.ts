import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, unauthorized, notFound, forbidden } from "@/lib/api";
import { saveUpload } from "@/lib/storage";
import { notifyMany } from "@/lib/notify";
import { audit } from "@/lib/audit";
import {
  assertSameOrigin,
  canMutateDisposisi,
  canViewDisposisi,
  cleanText,
} from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const item = await prisma.disposisi.findUnique({
    where: { id: params.id },
    include: {
      suratMasuk: {
        include: {
          unitTujuan: true,
          createdBy: { select: { id: true, nama: true } },
          attachments: { where: { deletedAt: null } },
        },
      },
      fromUser: { select: { id: true, nama: true, jabatan: true, unit: true } },
      toUser: { select: { id: true, nama: true, jabatan: true, unit: true } },
      toUnit: true,
      parent: {
        include: {
          fromUser: { select: { id: true, nama: true, jabatan: true } },
          toUser: { select: { id: true, nama: true, jabatan: true } },
          toUnit: true,
        },
      },
      children: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { id: true, nama: true, jabatan: true } },
          toUser: { select: { id: true, nama: true, jabatan: true } },
          toUnit: true,
        },
      },
      attachments: { where: { deletedAt: null } },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: { petugas: { select: { id: true, nama: true, jabatan: true } } },
      },
    },
  });
  if (!item) return notFound();

  if (!canViewDisposisi(session, item)) {
    await audit({
      userId: session.id,
      action: "ACCESS_DENIED",
      entityType: "Disposisi",
      entityId: item.id,
    });
    return forbidden("Anda tidak memiliki akses ke disposisi ini");
  }

  if (item.toUserId === session.id && item.status === "BARU") {
    await prisma.disposisi.update({
      where: { id: params.id },
      data: { status: "DIBACA", dibacaPada: new Date() },
    });
    await prisma.trackingLog.create({
      data: {
        event: "DISPOSISI_DIBACA",
        judul: "Disposisi dibaca",
        petugasId: session.id,
        suratMasukId: item.suratMasukId,
        disposisiId: item.id,
      },
    });
  }

  return ok({ item });
}

const updateSchema = z.object({
  status: z
    .enum(["BARU", "DIBACA", "DIPROSES", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"])
    .optional(),
  buktiCatatan: z.string().max(4000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const ct = req.headers.get("content-type") || "";
    let rawBody: any;
    let files: File[] = [];
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      rawBody = {
        status: form.get("status") || undefined,
        buktiCatatan: form.get("buktiCatatan") || undefined,
      };
      files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length > 10) return fail("Maksimal 10 file sekaligus");
    } else {
      rawBody = await req.json();
    }

    const parsed = updateSchema.safeParse(rawBody);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;

    const existing = await prisma.disposisi.findUnique({
      where: { id: params.id },
      include: { suratMasuk: true },
    });
    if (!existing) return notFound();

    if (!canMutateDisposisi(session, existing)) {
      await audit({
        userId: session.id,
        action: "ACCESS_DENIED",
        entityType: "Disposisi",
        entityId: existing.id,
      });
      return forbidden("Anda tidak memiliki akses untuk mengubah disposisi ini");
    }

    const updated = await prisma.disposisi.update({
      where: { id: params.id },
      data: {
        ...(d.status && { status: d.status }),
        ...(d.buktiCatatan !== undefined && {
          buktiCatatan: cleanText(d.buktiCatatan, { max: 4000, allowNewline: true }) || null,
        }),
        ...(d.status === "SELESAI" && { selesaiPada: new Date() }),
      },
    });

    for (const f of files) {
      try {
        const saved = await saveUpload(f);
        await prisma.attachment.create({
          data: {
            nama: saved.nama,
            storageKey: saved.storageKey,
            url: saved.url,
            mime: saved.mime,
            ukuran: saved.ukuran,
            checksum: saved.checksum,
            private: true,
            jenis: "bukti",
            uploadedById: session.id,
            disposisiId: params.id,
          },
        });
        await prisma.trackingLog.create({
          data: {
            event: "BUKTI_DIUPLOAD",
            judul: "Bukti tindak lanjut diunggah",
            keterangan: saved.nama,
            petugasId: session.id,
            suratMasukId: existing.suratMasukId,
            disposisiId: existing.id,
          },
        });
        await audit({
          userId: session.id,
          action: "FILE_UPLOADED",
          entityType: "Disposisi",
          entityId: existing.id,
        });
      } catch (e: any) {
        await audit({
          userId: session.id,
          action: "FILE_UPLOADED",
          entityType: "Disposisi",
          entityId: existing.id,
          description: `Gagal upload: ${e?.message || "error"}`,
        });
      }
    }

    if (d.status && d.status !== existing.status) {
      const map: Record<string, { event: any; judul: string; audit: any }> = {
        DIBACA: { event: "DISPOSISI_DIBACA", judul: "Disposisi dibaca", audit: "DISPOSISI_UPDATED" },
        DIPROSES: { event: "DISPOSISI_DIPROSES", judul: "Disposisi sedang diproses", audit: "DISPOSISI_UPDATED" },
        DITINDAKLANJUTI: {
          event: "DISPOSISI_DIPROSES",
          judul: "Disposisi ditindaklanjuti",
          audit: "DISPOSISI_UPDATED",
        },
        SELESAI: { event: "DISPOSISI_SELESAI", judul: "Disposisi diselesaikan", audit: "DISPOSISI_FINISHED" },
        DITOLAK: { event: "STATUS_BERUBAH", judul: "Disposisi ditolak", audit: "DISPOSISI_REJECTED" },
        BARU: { event: "STATUS_BERUBAH", judul: "Disposisi dibuka ulang", audit: "DISPOSISI_UPDATED" },
      };
      const t = map[d.status];
      await prisma.trackingLog.create({
        data: {
          event: t.event,
          judul: t.judul,
          petugasId: session.id,
          suratMasukId: existing.suratMasukId,
          disposisiId: existing.id,
        },
      });
      await audit({
        userId: session.id,
        action: t.audit,
        entityType: "Disposisi",
        entityId: existing.id,
        description: `Status → ${d.status}`,
      });

      if (d.status === "SELESAI") {
        await notifyMany([existing.fromUserId], {
          tipe: "DISPOSISI_SELESAI",
          judul: "Disposisi selesai",
          pesan: `Disposisi Anda telah diselesaikan oleh ${session.nama}`,
          link: `/disposisi/${existing.id}`,
        });

        const openCount = await prisma.disposisi.count({
          where: {
            suratMasukId: existing.suratMasukId,
            status: { notIn: ["SELESAI", "DITOLAK"] },
          },
        });
        if (openCount === 0) {
          await prisma.suratMasuk.update({
            where: { id: existing.suratMasukId },
            data: { status: "SELESAI" },
          });
        }
      }
    }

    return ok({ item: updated });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal memperbarui", 500);
  }
}
