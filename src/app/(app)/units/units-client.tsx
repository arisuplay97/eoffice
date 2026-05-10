"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconPlus } from "@/components/ui/Icons";

type Unit = {
  id: string;
  kode: string;
  nama: string;
  tipe: string | null;
  deskripsi: string | null;
  aktif: boolean;
  _count: { users: number; suratMasuk: number; suratKeluar: number };
};

export default function UnitsClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const toast = useToast();
  const [openForm, setOpenForm] = useState<null | { mode: "create" } | { mode: "edit"; unit: Unit }>(null);

  const toggle = async (u: Unit) => {
    const res = await fetch(`/api/units/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: !u.aktif }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(u.aktif ? "Unit dinonaktifkan" : "Unit diaktifkan");
      router.refresh();
    } else toast.error(data.error || "Gagal");
  };

  return (
    <>
      <PageHeader
        title="Unit / Bidang"
        subtitle="Master data unit, bidang, dan cabang PERUMDAM Tirta Ardhia Rinjani."
        action={
          <button className="btn-primary" onClick={() => setOpenForm({ mode: "create" })}>
            <IconPlus className="h-4 w-4" /> Tambah Unit
          </button>
        }
      />

      {units.length === 0 ? (
        <Empty title="Belum ada unit" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Kode</TH>
              <TH>Nama Unit</TH>
              <TH>Tipe</TH>
              <TH>Pengguna</TH>
              <TH>Surat Masuk</TH>
              <TH>Surat Keluar</TH>
              <TH>Status</TH>
              <TH className="text-right">Aksi</TH>
            </tr>
          </THead>
          <tbody>
            {units.map((u) => (
              <TR key={u.id}>
                <TD className="font-mono text-xs">{u.kode}</TD>
                <TD>
                  <p className="font-medium text-ink-900">{u.nama}</p>
                  {u.deskripsi && (
                    <p className="text-xs text-ink-500 line-clamp-1 max-w-xs">
                      {u.deskripsi}
                    </p>
                  )}
                </TD>
                <TD>
                  {u.tipe ? (
                    <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                      {u.tipe}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-400">-</span>
                  )}
                </TD>
                <TD className="text-xs tabular-nums">{u._count.users}</TD>
                <TD className="text-xs tabular-nums">{u._count.suratMasuk}</TD>
                <TD className="text-xs tabular-nums">{u._count.suratKeluar}</TD>
                <TD>
                  <span
                    className={`chip ${
                      u.aktif
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-red-50 text-red-700 ring-red-200"
                    }`}
                  >
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </TD>
                <TD className="text-right text-xs">
                  <button
                    className="text-brand-700 hover:text-brand-800 font-medium px-2 py-1"
                    onClick={() => setOpenForm({ mode: "edit", unit: u })}
                  >
                    Edit
                  </button>
                  <button
                    className={`font-medium px-2 py-1 ${
                      u.aktif ? "text-red-600" : "text-emerald-600"
                    }`}
                    onClick={() => toggle(u)}
                  >
                    {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {openForm && (
        <UnitFormModal
          mode={openForm.mode}
          unit={openForm.mode === "edit" ? openForm.unit : undefined}
          onClose={() => setOpenForm(null)}
          onDone={() => {
            setOpenForm(null);
            toast.success(openForm.mode === "edit" ? "Unit diperbarui" : "Unit ditambahkan");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function UnitFormModal({
  mode,
  unit,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  unit?: Unit;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nama: unit?.nama || "",
    kode: unit?.kode || "",
    tipe: unit?.tipe || "",
    deskripsi: unit?.deskripsi || "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/units", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            })
          : await fetch(`/api/units/${unit!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Tambah Unit" : `Edit Unit - ${unit!.nama}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="unit-form" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </>
      }
    >
      <form id="unit-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nama Unit</label>
          <input
            className="input"
            required
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Kode</label>
            <input
              className="input font-mono uppercase"
              value={form.kode}
              onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })}
              placeholder="Otomatis jika kosong"
            />
          </div>
          <div>
            <label className="label">Tipe</label>
            <select
              className="select"
              value={form.tipe}
              onChange={(e) => setForm({ ...form, tipe: e.target.value })}
            >
              <option value="">-- Pilih --</option>
              <option value="DIREKSI">Direksi</option>
              <option value="SEKRETARIAT">Sekretariat</option>
              <option value="BIDANG">Bidang</option>
              <option value="CABANG">Cabang</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Deskripsi</label>
          <textarea
            rows={3}
            className="textarea"
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
