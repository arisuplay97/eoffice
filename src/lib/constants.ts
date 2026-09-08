import { StatusAduan, Prioritas, JenisGangguan, SumberAduan, Role } from "@prisma/client";

export const APP_NAME = "SIAGA TIARA";
export const APP_SUBTITLE = "Sistem Informasi Gangguan Air Terpadu";
export const COMPANY_NAME = "PERUMDAM Tirta Ardhia Rinjani";
export const REGION_NAME = "Lombok Tengah";

export const SLA_RESPONS_DEFAULT_HOURS = 24;

export const CABANG_LIST = [
  { kode: "PRY", nama: "Cabang Praya", wilayah: "Praya" },
  { kode: "PTE", nama: "Cabang Praya Tengah", wilayah: "Praya Tengah" },
  { kode: "PRB", nama: "Cabang Praya Barat", wilayah: "Praya Barat" },
  { kode: "PBD", nama: "Cabang Praya Barat Daya", wilayah: "Praya Barat Daya" },
  { kode: "PRT", nama: "Cabang Praya Timur", wilayah: "Praya Timur" },
  { kode: "PJT", nama: "Cabang Pujut", wilayah: "Pujut" },
  { kode: "JGT", nama: "Cabang Jonggat", wilayah: "Jonggat" },
  { kode: "BTK", nama: "Cabang Batukliang", wilayah: "Batukliang" },
  { kode: "BKU", nama: "Cabang Batukliang Utara", wilayah: "Batukliang Utara" },
  { kode: "KPG", nama: "Cabang Kopang", wilayah: "Kopang" },
  { kode: "JNP", nama: "Cabang Janapria", wilayah: "Janapria" },
  { kode: "PGR", nama: "Cabang Pringgarata", wilayah: "Pringgarata" },
];

export const WILAYAH_LIST = [
  "Praya",
  "Praya Tengah",
  "Praya Barat",
  "Praya Barat Daya",
  "Praya Timur",
  "Pujut",
  "Jonggat",
  "Batukliang",
  "Batukliang Utara",
  "Kopang",
  "Janapria",
  "Pringgarata",
];

export const UNIT_LIST = [
  "Cabang",
  "Hublang",
  "Teknik",
  "Distribusi",
  "Produksi",
  "IT",
  "Lainnya",
];

export const STATUS_LABELS: Record<StatusAduan, string> = {
  [StatusAduan.BARU]: "Baru",
  [StatusAduan.DIRESPONS]: "Direspons",
  [StatusAduan.PROSES]: "Proses",
  [StatusAduan.DALAM_PENGERJAAN]: "Dalam Pengerjaan",
  [StatusAduan.KENDALA]: "Kendala",
  [StatusAduan.SELESAI]: "Selesai",
  [StatusAduan.DITUNDA]: "Ditunda",
  [StatusAduan.BATAL]: "Batal",
};

export const PRIORITAS_LABELS: Record<Prioritas, string> = {
  [Prioritas.RENDAH]: "Rendah",
  [Prioritas.SEDANG]: "Sedang",
  [Prioritas.TINGGI]: "Tinggi",
  [Prioritas.DARURAT]: "Darurat",
};

export const JENIS_GANGGUAN_LABELS: Record<JenisGangguan, string> = {
  [JenisGangguan.AIR_MATI]: "Air Mati",
  [JenisGangguan.TEKANAN_RENDAH]: "Tekanan Rendah",
  [JenisGangguan.AIR_KERUH]: "Air Keruh",
  [JenisGangguan.PIPA_BOCOR]: "Pipa Bocor",
  [JenisGangguan.METER_BERMASALAH]: "Meter Bermasalah",
  [JenisGangguan.TAGIHAN]: "Tagihan",
  [JenisGangguan.SAMBUNGAN_BARU]: "Sambungan Baru",
  [JenisGangguan.LAINNYA]: "Lainnya",
};

export const SUMBER_ADUAN_LABELS: Record<SumberAduan, string> = {
  [SumberAduan.WHATSAPP]: "WhatsApp",
  [SumberAduan.DASHBOARD]: "Input Manual",
  [SumberAduan.TELEPON]: "Telepon",
  [SumberAduan.LANGSUNG]: "Datang Langsung",
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN_PUSAT]: "Admin Pusat",
  [Role.ADMIN_CABANG]: "Staf Cabang",
  [Role.DIREKSI]: "Direksi",
  [Role.PETUGAS]: "Petugas Lapangan",
  [Role.SUPER_ADMIN]: "Super Admin",
  [Role.SEKRETARIAT]: "Sekretariat",
  [Role.KEPALA_BAGIAN]: "Kepala Bagian",
  [Role.STAF]: "Staf",
  [Role.VIEWER]: "Viewer",
};
