"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import {
  IconCheck,
  IconArrowRight,
  IconUpload,
  IconX,
} from "@/components/ui/Icons";
import { INSTRUKSI_OPTIONS, DISPOSISI_STATUS_LABEL } from "@/lib/constants";
import type { DisposisiStatus } from "@prisma/client";

type User = {
  id: string;
  nama: string;
  jabatan: string | null;
  unit: { id: string; nama: string } | null;
};
type Unit = { id: string; nama: string };

export default function DisposisiActions({
  id,
  status,
  isRecipient,
  isCreator,
  suratMasukId,
  users,
  units,
}: {
  id: string;
  status: DisposisiStatus;
  isRecipient: boolean;
  isCreator: boolean;
  suratMasukId: string;
  users: User[];
  units: Unit[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [openForward, setOpenForward] = useState(false);
  const [openFinish, setOpenFinish] = useState(false);

  const canProcess = isRecipient && !["SELESAI", "DITOLAK"].includes(status);
  const canFinish = isRecipient && !["SELESAI", "DITOLAK"].includes(status);
  const canForward = isRecipient || isCreator;

  const updateStatus = async (newStatus: DisposisiStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/disposisi/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal memperbarui status");
        return;
      }
      toast.success(`Status diperbarui ke ${DISPOSISI_STATUS_LABEL[newStatus]}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-800 mb-3">Tindakan</h3>

        <div className="space-y-2">
          {canProcess && status !== "DIPROSES" && status !== "DITINDAKLANJUTI" && (
            <button
              onClick={() => updateStatus("DIPROSES")}
              className="btn-secondary w-full justify-start"
              disabled={saving}
            >
              <IconCheck className="h-4 w-4 text-brand-700" /> Tandai Sedang Diproses
            </button>
          )}

          {canForward && (
            <button
              onClick={() => setOpenForward(true)}
              className="btn-secondary w-full justify-start"
            >
              <IconArrowRight className="h-4 w-4 text-brand-700" /> Teruskan Disposisi
            </button>
          )}

          {canFinish && (
            <button
              onClick={() => setOpenFinish(true)}
              className="btn-success w-full justify-start"
            >
              <IconCheck className="h-4 w-4" /> Selesaikan & Upload Bukti
            </button>
          )}

          {isRecipient && status === "BARU" && (
            <button
              onClick={() => updateStatus("DITOLAK")}
              className="btn-secondary w-full justify-start text-red-600"
              disabled={saving}
            >
              <IconX className="h-4 w-4" /> Tolak Disposisi
            </button>
          )}
        </div>

        {!canAnyAction(status, isRecipient, isCreator) && (
          <p className="text-xs text-ink-500 italic">
            Tidak ada tindakan lanjutan untuk disposisi ini.
          </p>
        )}
      </div>

      <ForwardModal
        open={openForward}
        onClose={() => setOpenForward(false)}
        suratMasukId={suratMasukId}
        parentId={id}
        users={users}
        units={units}
        onDone={() => {
          setOpenForward(false);
          toast.success("Disposisi diteruskan");
          router.refresh();
        }}
      />
      <FinishModal
        open={openFinish}
        onClose={() => setOpenFinish(false)}
        id={id}
        onDone={() => {
          setOpenFinish(false);
          toast.success("Disposisi diselesaikan");
          router.refresh();
        }}
      />
    </>
  );
}

function canAnyAction(
  status: DisposisiStatus,
  isRecipient: boolean,
  isCreator: boolean
) {
  if (!isRecipient && !isCreator) return false;
  if (isCreator) return true;
  return !["SELESAI", "DITOLAK"].includes(status);
}

function ForwardModal({
  open,
  onClose,
  suratMasukId,
  parentId,
  users,
  units,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  suratMasukId: string;
  parentId: string;
  users: User[];
  units: Unit[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"user" | "unit">("user");
  const [toUserId, setToUserId] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [instruksi, setInstruksi] = useState(INSTRUKSI_OPTIONS[1].value);
  const [catatan, setCatatan] = useState("");
  const [deadline, setDeadline] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "user" && !toUserId) return toast.error("Pilih penerima");
    if (mode === "unit" && !toUnitId) return toast.error("Pilih unit");
    setSaving(true);
    try {
      const res = await fetch("/api/disposisi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suratMasukId,
          parentId,
          toUserId: mode === "user" ? toUserId : null,
          toUnitId: mode === "user" ? null : toUnitId,
          instruksi,
          catatan,
          deadline: deadline || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal meneruskan");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Teruskan Disposisi"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="forward-form" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Mengirim..." : "Teruskan"}
          </button>
        </>
      }
    >
      <form id="forward-form" onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
          <button
            type="button"
            onClick={() => setMode("user")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md ${
              mode === "user" ? "bg-white shadow-sm" : "text-ink-600"
            }`}
          >
            Ke Pengguna
          </button>
          <button
            type="button"
            onClick={() => setMode("unit")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md ${
              mode === "unit" ? "bg-white shadow-sm" : "text-ink-600"
            }`}
          >
            Ke Unit
          </button>
        </div>

        {mode === "user" ? (
          <div>
            <label className="label">Pengguna</label>
            <select className="select" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
              <option value="">-- Pilih --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama} {u.jabatan ? `- ${u.jabatan}` : ""}{" "}
                  {u.unit ? `(${u.unit.nama})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Unit</label>
            <select className="select" value={toUnitId} onChange={(e) => setToUnitId(e.target.value)}>
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
            rows={3}
            className="textarea"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
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
      </form>
    </Modal>
  );
}

function FinishModal({
  open,
  onClose,
  id,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("status", "SELESAI");
      if (catatan) fd.append("buktiCatatan", catatan);
      if (files) Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/disposisi/${id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal menyelesaikan");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Selesaikan Disposisi"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="finish-form" type="submit" className="btn-success" disabled={saving}>
            {saving ? "Menyimpan..." : "Selesaikan"}
          </button>
        </>
      }
    >
      <form id="finish-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Catatan Tindak Lanjut</label>
          <textarea
            rows={4}
            className="textarea"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Ringkasan tindak lanjut yang telah dilakukan..."
          />
        </div>
        <div>
          <label className="label">Upload Bukti (opsional)</label>
          <input
            type="file"
            multiple
            accept=".pdf,image/*,.doc,.docx"
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          <p className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
            <IconUpload className="h-3.5 w-3.5" /> Foto, scan, atau dokumen bukti tindak lanjut
          </p>
        </div>
      </form>
    </Modal>
  );
}
