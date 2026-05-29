"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { IconUpload } from "@/components/ui/Icons";

export function AttachmentUpload({
  suratId,
  suratType,
}: {
  suratId: string;
  suratType: "surat-masuk" | "surat-keluar";
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch(`/api/${suratType}/${suratId}/attachments`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal mengunggah lampiran");
      }

      toast.success(`${files.length} berkas berhasil diunggah`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleUpload}
        className="hidden"
        id={`upload-${suratId}`}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        className="btn-secondary w-full justify-center text-sm"
      >
        <IconUpload className="h-4 w-4 mr-1.5" />
        {loading ? "Mengunggah..." : "Unggah Lampiran"}
      </button>
    </div>
  );
}
