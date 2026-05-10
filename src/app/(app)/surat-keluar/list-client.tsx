"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconDownload, IconSearch } from "@/components/ui/Icons";
import {
  SURAT_KELUAR_STATUS_COLOR,
  SURAT_KELUAR_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type Unit = { id: string; nama: string; kode: string };

export default function SuratKeluarListClient({
  canInput,
  items,
  units,
  initialFilters,
  defaultUnitId,
}: {
  canInput: boolean;
  items: any[];
  units: Unit[];
  initialFilters: Record<string, string | undefined>;
  defaultUnitId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [q, setQ] = useState(initialFilters.q || "");
  const [status, setStatus] = useState(initialFilters.status || "");
  const [unitId, setUnitId] = useState(initialFilters.unitId || "");
  const [tahun, setTahun] = useState(initialFilters.tahun || "");
  const [bulan, setBulan] = useState(initialFilters.bulan || "");

  const applyFilter = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (unitId) params.set("unitId", unitId);
    if (tahun) params.set("tahun", tahun);
    if (bulan) params.set("bulan", bulan);
    router.push(`/surat-keluar?${params.toString()}`);
  };
  const clear = () => {
    setQ("");
    setStatus("");
    setUnitId("");
    setTahun("");
    setBulan("");
    router.push("/surat-keluar");
  };

  return (
    <>
      <PageHeader
        title="Surat Keluar"
        subtitle="Kelola draft, paraf, tanda tangan, dan pengiriman surat keluar."
        action={
          <>
            <Link
              href={`/api/arsip/export?jenis=keluar&tahun=${tahun || new Date().getFullYear()}`}
              className="btn-secondary"
            >
              <IconDownload className="h-4 w-4" /> Export
            </Link>
            {canInput && (
              <button className="btn-primary" onClick={() => setOpenCreate(true)}>
                <IconPlus className="h-4 w-4" /> Buat Surat Keluar
              </button>
            )}
          </>
        }
      />

      <form
        onSubmit={applyFilter}
        className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Cari nomor / tujuan / perihal..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(SURAT_KELUAR_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Semua Unit Pembuat</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
          <button type="submit" className="btn-primary flex-1">
            Filter
          </button>
          <button type="button" onClick={clear} className="btn-secondary">
            Reset
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <Empty
          title="Belum ada surat keluar"
          description="Surat keluar yang dibuat akan muncul di sini."
          action={
            canInput && (
              <button className="btn-primary" onClick={() => setOpenCreate(true)}>
                <IconPlus className="h-4 w-4" /> Buat Surat Keluar
              </button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>No. Surat</TH>
              <TH>Tujuan / Perihal</TH>
              <TH>Unit Pembuat</TH>
              <TH>Penandatangan</TH>
              <TH>Status</TH>
              <TH>Tgl. Surat</TH>
              <TH className="text-right">Aksi</TH>
            </tr>
          </THead>
          <tbody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs">{r.nomorSurat}</TD>
                <TD>
                  <div className="max-w-md">
                    <p className="font-medium text-ink-900 line-clamp-1">{r.perihal}</p>
                    <p className="text-xs text-ink-500 line-clamp-1">{r.tujuan}</p>
                  </div>
                </TD>
                <TD className="text-xs">{r.unitPembuat?.nama || "-"}</TD>
                <TD className="text-xs">{r.penandatangan}</TD>
                <TD>
                  <span className={`chip ${SURAT_KELUAR_STATUS_COLOR[r.status as keyof typeof SURAT_KELUAR_STATUS_COLOR]}`}>
                    {SURAT_KELUAR_STATUS_LABEL[r.status as keyof typeof SURAT_KELUAR_STATUS_LABEL]}
                  </span>
                </TD>
                <TD className="text-xs text-ink-500">{formatDate(r.tanggalSurat)}</TD>
                <TD className="text-right">
                  <Link
                    href={`/surat-keluar/${r.id}`}
                    className="text-brand-700 hover:text-brand-800 text-xs font-medium"
                  >
                    Detail →
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <CreateModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        units={units}
        defaultUnitId={defaultUnitId}
        onCreated={() => {
          setOpenCreate(false);
          toast.success("Surat keluar berhasil dibuat");
          router.refresh();
        }}
      />
    </>
  );
}

function CreateModal({
  open,
  onClose,
  units,
  defaultUnitId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  defaultUnitId: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tujuan: "",
    perihal: "",
    ringkasan: "",
    tanggalSurat: new Date().toISOString().slice(0, 10),
    penandatangan: "Direktur Utama",
    unitPembuatId: defaultUnitId,
    status: "DRAFT",
    catatan: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitPembuatId) {
      toast.error("Unit pembuat wajib dipilih");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (files) Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/surat-keluar", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal menyimpan");
        return;
      }
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buat Surat Keluar"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="form-sk" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </>
      }
    >
      <form id="form-sk" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Unit Pembuat</label>
            <select
              className="select"
              value={form.unitPembuatId}
              onChange={(e) => setForm({ ...form, unitPembuatId: e.target.value })}
              required
            >
              <option value="">-- Pilih Unit --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-1">
              Nomor TAR/UNIT/YYYY/MM/0001 dibuat otomatis
            </p>
          </div>
          <div>
            <label className="label">Tanggal Surat</label>
            <input
              type="date"
              className="input"
              required
              value={form.tanggalSurat}
              onChange={(e) => setForm({ ...form, tanggalSurat: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Tujuan Surat</label>
            <input
              className="input"
              required
              value={form.tujuan}
              onChange={(e) => setForm({ ...form, tujuan: e.target.value })}
              placeholder="Instansi / pihak tujuan"
            />
          </div>
          <div>
            <label className="label">Penandatangan</label>
            <input
              className="input"
              required
              value={form.penandatangan}
              onChange={(e) => setForm({ ...form, penandatangan: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Perihal</label>
            <input
              className="input"
              required
              value={form.perihal}
              onChange={(e) => setForm({ ...form, perihal: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ringkasan Isi</label>
            <textarea
              rows={3}
              className="textarea"
              value={form.ringkasan}
              onChange={(e) => setForm({ ...form, ringkasan: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status Awal</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(SURAT_KELUAR_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input
              className="input"
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Upload Draft / Final (PDF / doc / gambar)</label>
            <input
              type="file"
              multiple
              accept=".pdf,image/*,.doc,.docx"
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full text-sm text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
