"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  IconPlus,
  IconDownload,
  IconFile,
  IconDisposisi,
  IconSearch,
} from "@/components/ui/Icons";
import {
  PRIORITAS_OPTIONS,
  PRIORITAS_COLOR,
  SURAT_MASUK_STATUS_COLOR,
  SURAT_MASUK_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Role } from "@prisma/client";

type Item = any;
type Unit = { id: string; nama: string; kode: string };

export default function SuratMasukListClient({
  role,
  canInput,
  items,
  units,
  initialFilters,
}: {
  role: Role;
  canInput: boolean;
  items: Item[];
  units: Unit[];
  initialFilters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [q, setQ] = useState(initialFilters.q || "");
  const [status, setStatus] = useState(initialFilters.status || "");
  const [prioritas, setPrioritas] = useState(initialFilters.prioritas || "");
  const [unitId, setUnitId] = useState(initialFilters.unitId || "");
  const [tahun, setTahun] = useState(initialFilters.tahun || "");
  const [bulan, setBulan] = useState(initialFilters.bulan || "");

  const applyFilter = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (prioritas) params.set("prioritas", prioritas);
    if (unitId) params.set("unitId", unitId);
    if (tahun) params.set("tahun", tahun);
    if (bulan) params.set("bulan", bulan);
    router.push(`/surat-masuk?${params.toString()}`);
  };

  const clearFilter = () => {
    setQ("");
    setStatus("");
    setPrioritas("");
    setUnitId("");
    setTahun("");
    setBulan("");
    router.push("/surat-masuk");
  };

  return (
    <>
      <PageHeader
        title="Surat Masuk"
        subtitle="Kelola surat masuk, agenda, disposisi, dan tindak lanjut."
        action={
          <>
            <Link
              href={`/api/arsip/export?jenis=masuk&tahun=${tahun || new Date().getFullYear()}`}
              className="btn-secondary"
            >
              <IconDownload className="h-4 w-4" /> Export
            </Link>
            {canInput && (
              <button className="btn-primary" onClick={() => setOpenCreate(true)}>
                <IconPlus className="h-4 w-4" /> Input Surat Masuk
              </button>
            )}
          </>
        }
      />

      {/* Filter Bar */}
      <form
        onSubmit={applyFilter}
        className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Cari nomor / perihal / asal..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.keys(SURAT_MASUK_STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {SURAT_MASUK_STATUS_LABEL[s as keyof typeof SURAT_MASUK_STATUS_LABEL]}
            </option>
          ))}
        </select>
        <select className="select" value={prioritas} onChange={(e) => setPrioritas(e.target.value)}>
          <option value="">Semua Prioritas</option>
          {PRIORITAS_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Semua Unit Tujuan</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            Filter
          </button>
          <button type="button" onClick={clearFilter} className="btn-secondary">
            Reset
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <Empty
          title="Belum ada surat masuk"
          description="Surat masuk yang diinput akan muncul di sini."
          action={
            canInput && (
              <button className="btn-primary" onClick={() => setOpenCreate(true)}>
                <IconPlus className="h-4 w-4" /> Input Surat Masuk
              </button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>No. Agenda</TH>
              <TH>No. Surat</TH>
              <TH>Asal / Perihal</TH>
              <TH>Prioritas</TH>
              <TH>Unit Tujuan</TH>
              <TH>Status</TH>
              <TH>Tgl. Surat</TH>
              <TH className="text-right">Aksi</TH>
            </tr>
          </THead>
          <tbody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs">{r.nomorAgenda}</TD>
                <TD className="text-xs text-ink-600">{r.nomorSurat}</TD>
                <TD>
                  <div className="max-w-md">
                    <p className="font-medium text-ink-900 line-clamp-1">{r.perihal}</p>
                    <p className="text-xs text-ink-500 line-clamp-1">{r.asalSurat}</p>
                  </div>
                </TD>
                <TD>
                  <span className={`chip ${PRIORITAS_COLOR[r.prioritas as keyof typeof PRIORITAS_COLOR]}`}>
                    {r.prioritas}
                  </span>
                </TD>
                <TD className="text-xs">{r.unitTujuan?.nama || "-"}</TD>
                <TD>
                  <span className={`chip ${SURAT_MASUK_STATUS_COLOR[r.status as keyof typeof SURAT_MASUK_STATUS_COLOR]}`}>
                    {SURAT_MASUK_STATUS_LABEL[r.status as keyof typeof SURAT_MASUK_STATUS_LABEL]}
                  </span>
                </TD>
                <TD className="text-xs text-ink-500">{formatDate(r.tanggalSurat)}</TD>
                <TD className="text-right">
                  <Link
                    href={`/surat-masuk/${r.id}`}
                    className="inline-flex items-center gap-1.5 text-brand-700 hover:text-brand-800 text-xs font-medium"
                  >
                    Detail
                    <span className="h-1 w-1 rounded-full bg-brand-400" />
                    <span className="text-ink-500">
                      {r._count.disposisi} disposisi
                    </span>
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <CreateSuratMasukModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        units={units}
        onCreated={() => {
          setOpenCreate(false);
          toast.success("Surat masuk berhasil dibuat");
          router.refresh();
        }}
      />
    </>
  );
}

function CreateSuratMasukModal({
  open,
  onClose,
  units,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nomorSurat: "",
    tanggalSurat: new Date().toISOString().slice(0, 10),
    tanggalDiterima: new Date().toISOString().slice(0, 10),
    asalSurat: "",
    perihal: "",
    ringkasan: "",
    prioritas: "BIASA",
    unitTujuanId: "",
    catatan: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (files) Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/surat-masuk", { method: "POST", body: fd });
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
      title="Input Surat Masuk"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="form-sm" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </>
      }
    >
      <form id="form-sm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nomor Surat</label>
            <input
              className="input"
              required
              value={form.nomorSurat}
              onChange={(e) => setForm({ ...form, nomorSurat: e.target.value })}
              placeholder="mis. 001/ABC/I/2026"
            />
          </div>
          <div>
            <label className="label">Asal Surat</label>
            <input
              className="input"
              required
              value={form.asalSurat}
              onChange={(e) => setForm({ ...form, asalSurat: e.target.value })}
              placeholder="Instansi pengirim"
            />
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
            <label className="label">Tanggal Diterima</label>
            <input
              type="date"
              className="input"
              value={form.tanggalDiterima}
              onChange={(e) => setForm({ ...form, tanggalDiterima: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Prioritas</label>
            <select
              className="select"
              value={form.prioritas}
              onChange={(e) => setForm({ ...form, prioritas: e.target.value })}
            >
              {PRIORITAS_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit Tujuan</label>
            <select
              className="select"
              value={form.unitTujuanId}
              onChange={(e) => setForm({ ...form, unitTujuanId: e.target.value })}
            >
              <option value="">-- Pilih Unit --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Perihal</label>
          <input
            className="input"
            required
            value={form.perihal}
            onChange={(e) => setForm({ ...form, perihal: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Ringkasan Isi</label>
          <textarea
            rows={3}
            className="textarea"
            value={form.ringkasan}
            onChange={(e) => setForm({ ...form, ringkasan: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Catatan Sekretariat</label>
          <textarea
            rows={2}
            className="textarea"
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Upload Dokumen (PDF / gambar)</label>
          <input
            type="file"
            multiple
            accept=".pdf,image/*,.doc,.docx"
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          <p className="text-xs text-ink-500 mt-1">
            Nomor agenda (AGD/YYYY/MM/0001) dan kode verifikasi akan dibuat otomatis.
          </p>
        </div>
      </form>
    </Modal>
  );
}
