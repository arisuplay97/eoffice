"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export function BsreSignModal({
  open,
  onClose,
  attachmentId,
}: {
  open: boolean;
  onClose: () => void;
  attachmentId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nik: "",
    passphrase: "",
    isVisual: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nik || !form.passphrase) {
      toast.error("NIK dan Passphrase wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bsre/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          ...form,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal melakukan tanda tangan elektronik");
      }

      toast.success(data.data?.message || "Tanda tangan berhasil");
      onClose();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tanda Tangan Elektronik (BSrE)"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Batal
          </button>
          <button type="submit" form="bsre-sign-form" className="btn-primary" disabled={loading}>
            {loading ? "Memproses..." : "Tanda Tangani Dokumen"}
          </button>
        </>
      }
    >
      <form id="bsre-sign-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-600 mb-4 leading-relaxed">
          Masukkan <strong>NIK</strong> dan <strong>Passphrase</strong> Anda yang terdaftar pada Balai Sertifikasi Elektronik (BSrE) BSSN untuk menandatangani dokumen ini.
        </p>

        <div>
          <label className="label">Nomor Induk Kependudukan (NIK)</label>
          <input
            type="text"
            className="input font-mono"
            required
            value={form.nik}
            onChange={(e) => setForm({ ...form, nik: e.target.value })}
            placeholder="16 digit NIK"
            maxLength={16}
          />
        </div>

        <div>
          <label className="label">Passphrase</label>
          <input
            type="password"
            className="input"
            required
            value={form.passphrase}
            onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
            placeholder="Masukkan passphrase BSrE"
          />
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm text-ink-800 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={form.isVisual}
            onChange={(e) => setForm({ ...form, isVisual: e.target.checked })}
          />
          Tampilkan Tanda Tangan Visual pada dokumen
        </label>
      </form>
    </Modal>
  );
}
