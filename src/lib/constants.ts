import type {
  Role,
  Prioritas,
  SuratMasukStatus,
  SuratKeluarStatus,
  DisposisiStatus,
  InstruksiDisposisi,
} from "@prisma/client";

export const PRIORITAS_OPTIONS: { value: Prioritas; label: string }[] = [
  { value: "BIASA", label: "Biasa" },
  { value: "PENTING", label: "Penting" },
  { value: "SEGERA", label: "Segera" },
  { value: "RAHASIA", label: "Rahasia" },
];

export const PRIORITAS_COLOR: Record<Prioritas, string> = {
  BIASA: "bg-slate-100 text-slate-700 ring-slate-200",
  PENTING: "bg-amber-50 text-amber-700 ring-amber-200",
  SEGERA: "bg-red-50 text-red-700 ring-red-200",
  RAHASIA: "bg-purple-50 text-purple-700 ring-purple-200",
};

export const SURAT_MASUK_STATUS_LABEL: Record<SuratMasukStatus, string> = {
  DITERIMA: "Diterima",
  DIDISPOSISIKAN: "Didisposisikan",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DIARSIPKAN: "Diarsipkan",
};

export const SURAT_MASUK_STATUS_COLOR: Record<SuratMasukStatus, string> = {
  DITERIMA: "bg-blue-50 text-blue-700 ring-blue-200",
  DIDISPOSISIKAN: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  DIPROSES: "bg-amber-50 text-amber-700 ring-amber-200",
  SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DIARSIPKAN: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const SURAT_KELUAR_STATUS_LABEL: Record<SuratKeluarStatus, string> = {
  DRAFT: "Draft",
  MENUNGGU_PARAF: "Menunggu Paraf",
  MENUNGGU_TTD: "Menunggu Tanda Tangan",
  TERKIRIM: "Terkirim",
  DIARSIPKAN: "Diarsipkan",
};

export const SURAT_KELUAR_STATUS_COLOR: Record<SuratKeluarStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  MENUNGGU_PARAF: "bg-amber-50 text-amber-700 ring-amber-200",
  MENUNGGU_TTD: "bg-orange-50 text-orange-700 ring-orange-200",
  TERKIRIM: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DIARSIPKAN: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const DISPOSISI_STATUS_LABEL: Record<DisposisiStatus, string> = {
  BARU: "Baru",
  DIBACA: "Dibaca",
  DIPROSES: "Diproses",
  DITINDAKLANJUTI: "Ditindaklanjuti",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
};

export const DISPOSISI_STATUS_COLOR: Record<DisposisiStatus, string> = {
  BARU: "bg-blue-50 text-blue-700 ring-blue-200",
  DIBACA: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  DIPROSES: "bg-amber-50 text-amber-700 ring-amber-200",
  DITINDAKLANJUTI: "bg-sky-50 text-sky-700 ring-sky-200",
  SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DITOLAK: "bg-red-50 text-red-700 ring-red-200",
};

export const INSTRUKSI_LABEL: Record<InstruksiDisposisi, string> = {
  UNTUK_DIKETAHUI: "Untuk Diketahui",
  UNTUK_DITINDAKLANJUTI: "Untuk Ditindaklanjuti",
  UNTUK_DIPELAJARI: "Untuk Dipelajari",
  UNTUK_DIKOORDINASIKAN: "Untuk Dikoordinasikan",
  UNTUK_DIJAWAB: "Untuk Dijawab",
  UNTUK_DIARSIPKAN: "Untuk Diarsipkan",
  HADIRI_WAKILI: "Hadiri / Wakili",
  SIAPKAN_BAHAN: "Siapkan Bahan",
  BUAT_LAPORAN: "Buat Laporan",
};

export const INSTRUKSI_OPTIONS: { value: InstruksiDisposisi; label: string }[] =
  (Object.keys(INSTRUKSI_LABEL) as InstruksiDisposisi[]).map((value) => ({
    value,
    label: INSTRUKSI_LABEL[value],
  }));

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  DIREKSI: "Direksi",
  SEKRETARIAT: "Sekretariat",
  KEPALA_BAGIAN: "Kepala Bagian",
  STAF: "Staf",
  VIEWER: "Viewer",
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = (
  Object.keys(ROLE_LABEL) as Role[]
).map((value) => ({ value, label: ROLE_LABEL[value] }));

export const APP_NAME = "E-Office TIARA";
export const COMPANY_NAME = "PERUMDAM Tirta Ardhia Rinjani";
export const COMPANY_REGION = "Kabupaten Lombok Tengah";
