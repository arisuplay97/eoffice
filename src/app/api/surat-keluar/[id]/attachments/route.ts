import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratKeluar } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";
import { saveUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { assertSameOrigin, canViewSuratKeluar } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const session = await getSession();
  if (!session) return unauthorized();
  if (!canInputSuratKeluar(session.role)) return forbidden();

  try {
    const existing = await prisma.suratKeluar.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) return notFound();
    if (!canViewSuratKeluar(session, existing))
      return forbidden("Anda tidak memiliki akses ke surat ini");

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return fail("Tidak ada file yang diunggah");
    }

    // Upload all files first (fail-fast)
    const uploadedAttachments = [];
    for (const f of files) {
      try {
        const saved = await saveUpload(f);
        uploadedAttachments.push(saved);
      } catch (e: any) {
        return fail(`Gagal mengunggah berkas "${f.name}": ${e?.message || "error"}`);
      }
    }

    // Create attachment records
    const created = [];
    for (const saved of uploadedAttachments) {
      const att = await prisma.attachment.create({
        data: {
          nama: saved.nama,
          storageKey: saved.storageKey,
          url: saved.url,
          mime: saved.mime,
          ukuran: saved.ukuran,
          checksum: saved.checksum,
          private: true,
          jenis: "pokok",
          uploadedById: session.id,
          suratKeluarId: params.id,
        },
      });
      created.push(att);

      await audit({
        userId: session.id,
        action: "FILE_UPLOADED",
        entityType: "SuratKeluar",
        entityId: params.id,
        description: `Upload lampiran ${saved.nama}`,
      });
    }

    return ok({ attachments: created });
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Gagal mengunggah lampiran", 500);
  }
}
