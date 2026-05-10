"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { INSTRUKSI_OPTIONS } from "@/lib/constants";
import { IconArrowRight } from "@/components/ui/Icons";
import type { SuratMasukStatus } from "@prisma/client";

type User = {
  id: string;
  nama: string;
  jabatan: string | null;
  role: string;
  unit: { id: string; nama: string } | null;
};
type Unit = { id: string; nama: string };

export default function SuratMasukDetailActions({
  suratId,
  users,
  units,
  canArchive,
  currentStatus,
  kode,
}: {
  suratId: string;
  users: User[];
  units: Unit[];
  canArchive: boolean;
  currentStatus: SuratMasukStatus;
  kode: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"user" | "unit">("user");
  const [toUserId, setToUserId] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [instruksi, setInstruksi] = useState(INSTRUKSI_OPTIONS[1].value);
  const [catatan, setCatatan] = useState("");
  const [deadline, setDeadline] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "user" && !toUserId) {
      toast.error("Pilih penerima disposisi");
      return;
    }
    if (mode === "unit" && !toUnitId) {
      toast.error("Pilih unit tujuan");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/disposisi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suratMasukId: suratId,
          toUserId: mode === "user" ? toUserId : null,
          toUnitId: mode === "user" ? null : toUnitId,
          instruksi,
          catatan,
          deadline: deadline || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal membuat disposisi");
        return;
      }
      toast.success("Disposisi berhasil dibuat");
      setToUserId("");
      setToUnitId("");
      setCatatan("");
      setDeadline("");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat disposisi");
    } finally {
      setLoading(false);
    }
  };

  const archive = async () => {
    if (!confirm("Arsipkan surat ini?")) return;
    const res = await fetch(`/api/surat-masuk/${suratId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DIARSIPKAN" }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success("Surat diarsipkan");
      router.refresh();
    } else {
      toast.error(data.error || "Gagal");
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
          <button
            type="button"
            onClick={() => setMode("user")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition ${
              mode === "user" ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
            }`}
          >
            Ke Pengguna
          </button>
          <button
            type="button"
            onClick={() => setMode("unit")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition ${
              mode === "unit" ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
            }`}
          >
            Ke Unit
          </button>
        </div>

        {mode === "user" ? (
          <div>
            <label className="label">Pengguna Tujuan</label>
            <select
              className="select"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              required
            >
              <option value="">-- Pilih --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                  {u.jabatan ? ` - ${u.jabatan}` : ""}
                  {u.unit ? ` (${u.unit.nama})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Unit Tujuan</label>
            <select
              className="select"
              value={toUnitId}
              onChange={(e) => setToUnitId(e.target.value)}
              required
            >
              <option value="">-- Pilih --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Instruksi</label>
          <select
            className="select"
            value={instruksi}
            onChange={(e) => setInstruksi(e.target.value as any)}
          >
            {INSTRUKSI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Catatan</label>
          <textarea
            rows={2}
            className="textarea"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan atau instruksi tambahan"
          />
        </div>

        <div>
          <label className="label">Deadline (opsional)</label>
          <input
            type="date"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Mengirim..." : (
            <>
              Kirim Disposisi <IconArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {canArchive && currentStatus !== "DIARSIPKAN" && (
        <>
          <hr className="my-4 border-ink-200" />
          <button onClick={archive} className="btn-secondary w-full text-sm">
            Arsipkan Surat
          </button>
        </>
      )}
    </>
  );
}
