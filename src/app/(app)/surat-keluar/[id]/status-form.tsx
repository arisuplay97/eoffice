"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { SURAT_KELUAR_STATUS_LABEL } from "@/lib/constants";

export default function StatusForm({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/surat-keluar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: current }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal update");
        return;
      }
      toast.success("Status diperbarui");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <select
        className="select"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      >
        {Object.entries(SURAT_KELUAR_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button className="btn-primary w-full" onClick={save} disabled={loading || current === status}>
        {loading ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </div>
  );
}
