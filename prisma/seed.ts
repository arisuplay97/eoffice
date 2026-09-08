import { PrismaClient, Role, StatusAduan, Prioritas, JenisGangguan, SumberAduan, TipeDokumentasi } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CABANG_DATA = [
  { kode: "PRY", nama: "Cabang Praya", wilayah: "Praya", alamat: "Jl. Diponegoro No. 12, Praya", kontak: "0370-654123" },
  { kode: "PTE", nama: "Cabang Praya Tengah", wilayah: "Praya Tengah", alamat: "Jl. Basuki Rahmat, Praya Tengah", kontak: "0370-654124" },
  { kode: "PRB", nama: "Cabang Praya Barat", wilayah: "Praya Barat", alamat: "Jl. Penujak, Praya Barat", kontak: "0370-654125" },
  { kode: "PBD", nama: "Cabang Praya Barat Daya", wilayah: "Praya Barat Daya", alamat: "Jl. Darek, Praya Barat Daya", kontak: "0370-654126" },
  { kode: "PRT", nama: "Cabang Praya Timur", wilayah: "Praya Timur", alamat: "Jl. Mujur, Praya Timur", kontak: "0370-654127" },
  { kode: "PJT", nama: "Cabang Pujut", wilayah: "Pujut", alamat: "Jl. Sengkol, Pujut", kontak: "0370-654128" },
  { kode: "JGT", nama: "Cabang Jonggat", wilayah: "Jonggat", alamat: "Jl. Puyung, Jonggat", kontak: "0370-654129" },
  { kode: "BTK", nama: "Cabang Batukliang", wilayah: "Batukliang", alamat: "Jl. Mantang, Batukliang", kontak: "0370-654130" },
  { kode: "BKU", nama: "Cabang Batukliang Utara", wilayah: "Batukliang Utara", alamat: "Jl. Teratak, Batukliang Utara", kontak: "0370-654131" },
  { kode: "KPG", nama: "Cabang Kopang", wilayah: "Kopang", alamat: "Jl. Raya Kopang No. 8, Kopang", kontak: "0370-654132" },
  { kode: "JNP", nama: "Cabang Janapria", wilayah: "Janapria", alamat: "Jl. Janapria Raya, Janapria", kontak: "0370-654133" },
  { kode: "PGR", nama: "Cabang Pringgarata", wilayah: "Pringgarata", alamat: "Jl. Pringgarata, Pringgarata", kontak: "0370-654134" },
];

async function main() {
  console.log("Memulai seeding database SIAGA TIARA...");

  // Bersihkan tabel transaksi jika ada
  await prisma.crmMessage.deleteMany();
  await prisma.chatAdminQueue.deleteMany();
  await prisma.dokumentasiAduan.deleteMany();
  await prisma.penugasanAduan.deleteMany();
  await prisma.statusLog.deleteMany();
  await prisma.aduan.deleteMany();
  await prisma.petugas.deleteMany();
  await prisma.pengumumanLayanan.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cabang.deleteMany();
  await prisma.systemSetting.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Seed Cabang
  console.log("Seeding data cabang...");
  const cabangMap: Record<string, string> = {};
  for (const c of CABANG_DATA) {
    const created = await prisma.cabang.create({
      data: c,
    });
    cabangMap[c.kode] = created.id;
  }

  // 2. Seed Users
  console.log("Seeding akun pengguna...");
  // Admin Pusat
  await prisma.user.create({
    data: {
      username: "admin",
      password: passwordHash,
      nama: "Administrator Pusat",
      email: "admin@tiara.co.id",
      role: Role.ADMIN_PUSAT,
      pin: "123456",
      aktif: true,
    },
  });

  // Direksi
  await prisma.user.create({
    data: {
      username: "direksi",
      password: passwordHash,
      nama: "Direksi Operasional",
      email: "direksi@tiara.co.id",
      role: Role.DIREKSI,
      pin: "123456",
      aktif: true,
    },
  });

  // Staf/Admin Cabang untuk setiap cabang
  for (const c of CABANG_DATA) {
    const uname = `cabang_${c.kode.toLowerCase()}`;
    await prisma.user.create({
      data: {
        username: uname,
        password: passwordHash,
        nama: `Staf Administrasi ${c.nama}`,
        email: `${uname}@tiara.co.id`,
        role: Role.ADMIN_CABANG,
        cabangId: cabangMap[c.kode],
        pin: "123456",
        aktif: true,
      },
    });
  }

  // 3. Seed Petugas Lapangan
  console.log("Seeding petugas lapangan...");
  const petugasMap: Record<string, string[]> = {};
  for (const c of CABANG_DATA) {
    petugasMap[c.kode] = [];
    const p1 = await prisma.petugas.create({
      data: {
        nama: `Ahmad ${c.wilayah}`,
        noHp: `6281907${Math.floor(100000 + Math.random() * 900000)}`,
        role: "Koordinator Lapangan",
        cabangId: cabangMap[c.kode],
      },
    });
    const p2 = await prisma.petugas.create({
      data: {
        nama: `Rian Teknisi ${c.wilayah}`,
        noHp: `6287865${Math.floor(100000 + Math.random() * 900000)}`,
        role: "Teknisi Jaringan",
        cabangId: cabangMap[c.kode],
      },
    });
    petugasMap[c.kode].push(p1.id, p2.id);
  }

  // 4. Seed Pengumuman Layanan
  console.log("Seeding pengumuman layanan...");
  const now = new Date();
  await prisma.pengumumanLayanan.create({
    data: {
      judul: "Pemeliharaan Pipa Induk Distribusi Jalur Praya - Jonggat",
      isi: "Akan dilakukan perbaikan kebocoran pipa transmisi utama diameter 300mm di wilayah perbatasan Praya dan Jonggat. Suplai air berpotensi mengecil sementara waktu.",
      status: "AKTIF",
      mulai: new Date(now.getTime() - 4 * 3600 * 1000),
      selesai: new Date(now.getTime() + 20 * 3600 * 1000),
      cabangId: cabangMap["PRY"],
      wilayahTerdampak: "Praya dan Jonggat",
      jenisDicegah: "Pipa Bocor",
      cegahAduan: true,
    },
  });

  // 5. Seed System Settings
  console.log("Seeding konfigurasi sistem...");
  const settings = [
    { key: "SLA_RESPONS_JAM", value: "24", description: "Batas waktu respons pertama semua tiket gangguan" },
    { key: "JAM_KERJA_START", value: "08:00", description: "Jam mulai pelayanan" },
    { key: "JAM_KERJA_END", value: "16:00", description: "Jam selesai pelayanan" },
    { key: "RATE_LIMIT_DAILY", value: "50", description: "Batas aduan harian per nomor WA" },
    { key: "PENGUMUMAN_REPEAT_HOURS", value: "6", description: "Jeda pengulangan banner pengumuman" },
  ];
  for (const s of settings) {
    await prisma.systemSetting.create({ data: s });
  }

  // 6. Seed Aduan Realistis
  console.log("Seeding data aduan gangguan air...");
  const mockTickets = [
    {
      id: "PRY26090801",
      kode: "PRY",
      nama: "H. Mustofa Kamal",
      noPelanggan: "08912345",
      noHp: "6281912345678",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.DARURAT,
      status: StatusAduan.BARU,
      hoursAgo: 26, // Overdue (> 24 hours without response)
      keterangan: "Air tidak mengalir sejak kemarin sore di seluruh blok A perumahan.",
      wilayah: "Praya",
      desa: "Tiwinggalih",
      unit: "Teknik",
    },
    {
      id: "JGT26090802",
      kode: "JGT",
      nama: "Siti Rahmawati",
      noPelanggan: "08923456",
      noHp: "6287890123456",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.BARU,
      hoursAgo: 21, // Near SLA (sisa 3 jam lagi)
      keterangan: "Pipa tersier di depan musholla bocor menyembur ke jalan raya.",
      wilayah: "Jonggat",
      desa: "Puyung",
      unit: "Distribusi",
    },
    {
      id: "BTK26090803",
      kode: "BTK",
      nama: "Lalu Suparlan",
      noPelanggan: "08934567",
      noHp: "6285234567890",
      jenis: JenisGangguan.AIR_KERUH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.PROSES,
      hoursAgo: 8,
      responseHoursAgo: 6, // Responded 2 jam setelah masuk
      keterangan: "Air berwarna kecokelatan dan berpasir.",
      wilayah: "Batukliang",
      desa: "Mantang",
      unit: "Produksi",
    },
    {
      id: "PJT26090804",
      kode: "PJT",
      nama: "Baiq Nurhayati",
      noPelanggan: "08945678",
      noHp: "6281809876543",
      jenis: JenisGangguan.TEKANAN_RENDAH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.DALAM_PENGERJAAN,
      hoursAgo: 14,
      responseHoursAgo: 12,
      keterangan: "Debit air sangat kecil hanya menetes di malam hari.",
      wilayah: "Pujut",
      desa: "Sengkol",
      unit: "Teknik",
    },
    {
      id: "PRY26090805",
      kode: "PRY",
      nama: "I Wayan Sudarma",
      noPelanggan: "08956789",
      noHp: "6287765432109",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.SELESAI,
      hoursAgo: 30,
      responseHoursAgo: 28,
      doneHoursAgo: 4,
      keterangan: "Pipa meteran patah tertabrak kendaraan roda dua.",
      wilayah: "Praya",
      desa: "Leneng",
      unit: "Distribusi",
    },
    {
      id: "KPG26090806",
      kode: "KPG",
      nama: "Ahmad Zaini",
      noPelanggan: "08967890",
      noHp: "6281987654321",
      jenis: JenisGangguan.METER_BERMASALAH,
      prioritas: Prioritas.RENDAH,
      status: StatusAduan.SELESAI,
      hoursAgo: 48,
      responseHoursAgo: 46,
      doneHoursAgo: 24,
      keterangan: "Kaca meteran buram dan jarum putaran tidak berputar saat kran dibuka.",
      wilayah: "Kopang",
      desa: "Darmaji",
      unit: "Hublang",
    },
    {
      id: "JNP26090807",
      kode: "JNP",
      nama: "Mahsun Subki",
      noPelanggan: "08978901",
      noHp: "6285321098765",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.DIRESPONS,
      hoursAgo: 3,
      responseHoursAgo: 2,
      keterangan: "Aliran air mati total sejak pagi tanpa pemberitahuan.",
      wilayah: "Janapria",
      desa: "Saba",
      unit: "Cabang",
    },
    {
      id: "PGR26090808",
      kode: "PGR",
      nama: "Endang Sulastri",
      noPelanggan: "08989012",
      noHp: "6287812340987",
      jenis: JenisGangguan.TEKANAN_RENDAH,
      prioritas: Prioritas.RENDAH,
      status: StatusAduan.KENDALA,
      hoursAgo: 18,
      responseHoursAgo: 16,
      keterangan: "Debit mengecil karena elevasi rumah tinggi di perbukitan.",
      wilayah: "Pringgarata",
      desa: "Menemeng",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0101",
      kode: "PRY",
      nama: "Hj. Siti Rohmah",
      noPelanggan: "PLG-00101",
      noHp: "6281912345601",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.DARURAT,
      status: StatusAduan.BARU,
      hoursAgo: 2,
      keterangan: "Air mati total sejak pukul 05:00 pagi menjelang persiapan wudhu masjid.",
      wilayah: "Praya",
      desa: "Jl. Diponegoro No. 45, Praya",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0102",
      kode: "PTE",
      nama: "Lalu Agus Jayadi",
      noPelanggan: "PLG-00102",
      noHp: "6281912345602",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.PROSES,
      hoursAgo: 6,
      responseHoursAgo: 4,
      keterangan: "Pipa distribusi pecah di bahu jalan, air meluap ke pekarangan warga.",
      wilayah: "Praya Tengah",
      desa: "Jl. Basuki Rahmat, Praya Tengah",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0103",
      kode: "JGT",
      nama: "Baiq Nurul Hidayah",
      noPelanggan: "PLG-00103",
      noHp: "6281912345603",
      jenis: JenisGangguan.AIR_KERUH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.DIRESPONS,
      hoursAgo: 5,
      responseHoursAgo: 3,
      keterangan: "Air mengalir berwarna kecoklatan dan berbau lumpur sejak sore kemarin.",
      wilayah: "Jonggat",
      desa: "Dusun Puyung Timur, Jonggat",
      unit: "Produksi",
    },
    {
      id: "ADU-2026-0104",
      kode: "PJT",
      nama: "I Wayan Darma",
      noPelanggan: "PLG-00104",
      noHp: "6281912345604",
      jenis: JenisGangguan.TEKANAN_RENDAH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.BARU,
      hoursAgo: 1,
      keterangan: "Debit air sangat kecil hanya menetes, tidak cukup untuk mengisi tandon penampung.",
      wilayah: "Pujut",
      desa: "Jl. Pariwisata Sengkol, Pujut",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0105",
      kode: "KPG",
      nama: "Ahmad Suhaimi",
      noPelanggan: "PLG-00105",
      noHp: "6281912345605",
      jenis: JenisGangguan.METER_BERMASALAH,
      prioritas: Prioritas.RENDAH,
      status: StatusAduan.PROSES,
      hoursAgo: 10,
      responseHoursAgo: 8,
      keterangan: "Kaca meteran buram dan jarum putaran macet tidak bergerak.",
      wilayah: "Kopang",
      desa: "Jl. Raya Kopang KM 4, Kopang",
      unit: "Hublang",
    },
    {
      id: "ADU-2026-0106",
      kode: "PRB",
      nama: "M. Zulkifli",
      noPelanggan: "PLG-00106",
      noHp: "6281912345606",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.DARURAT,
      status: StatusAduan.SELESAI,
      hoursAgo: 20,
      responseHoursAgo: 18,
      doneHoursAgo: 2,
      keterangan: "Pasokan air terhenti total 2 hari di permukiman padat.",
      wilayah: "Praya Barat",
      desa: "Dusun Penujak Barat, Praya Barat",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0107",
      kode: "BTK",
      nama: "Ni Ketut Suartini",
      noPelanggan: "PLG-00107",
      noHp: "6281912345607",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.BARU,
      hoursAgo: 3,
      keterangan: "Bocoran pipa sekunder di saluran irigasi pinggir jalan raya Mantang.",
      wilayah: "Batukliang",
      desa: "Jl. Raya Mantang No. 23, Batukliang",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0108",
      kode: "PGR",
      nama: "H. Mustamin",
      noPelanggan: "PLG-00108",
      noHp: "6281912345608",
      jenis: JenisGangguan.AIR_KERUH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.PROSES,
      hoursAgo: 12,
      responseHoursAgo: 9,
      keterangan: "Air bercampur endapan pasir halus, filter air tersumbat cepat.",
      wilayah: "Pringgarata",
      desa: "Kompleks Perum Graha Tiara, Pringgarata",
      unit: "Produksi",
    },
    {
      id: "ADU-2026-0109",
      kode: "PRT",
      nama: "Lalu Hendra Irawan",
      noPelanggan: "PLG-00109",
      noHp: "6281912345609",
      jenis: JenisGangguan.TAGIHAN,
      prioritas: Prioritas.RENDAH,
      status: StatusAduan.SELESAI,
      hoursAgo: 24,
      responseHoursAgo: 22,
      doneHoursAgo: 6,
      keterangan: "Lonjakan nominal tagihan yang tidak wajar pada pemakaian normal.",
      wilayah: "Praya Timur",
      desa: "Jl. Mujur Raya RT 05, Praya Timur",
      unit: "Hublang",
    },
    {
      id: "ADU-2026-0110",
      kode: "JNP",
      nama: "Siti Fatimah",
      noPelanggan: "PLG-00110",
      noHp: "6281912345610",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.BARU,
      hoursAgo: 4,
      keterangan: "Aliran air mati mendadak saat jam sibuk sore hari.",
      wilayah: "Janapria",
      desa: "Dusun Janapria Lauk, Janapria",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0111",
      kode: "BKU",
      nama: "Khaeruddin",
      noPelanggan: "PLG-00111",
      noHp: "6281912345611",
      jenis: JenisGangguan.TEKANAN_RENDAH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.DIRESPONS,
      hoursAgo: 7,
      responseHoursAgo: 5,
      keterangan: "Air hanya mengalir tengah malam antara jam 01:00 - 04:00 dini hari.",
      wilayah: "Batukliang Utara",
      desa: "Desa Teratak Atas, Batukliang Utara",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0112",
      kode: "PBD",
      nama: "Baiq Ratna Juwita",
      noPelanggan: "PLG-00112",
      noHp: "6281912345612",
      jenis: JenisGangguan.SAMBUNGAN_BARU,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.PROSES,
      hoursAgo: 16,
      responseHoursAgo: 14,
      keterangan: "Permohonan percepatan instalasi sambungan baru yang telah diverifikasi.",
      wilayah: "Praya Barat Daya",
      desa: "Jl. Darek RT 02, Praya Barat Daya",
      unit: "Hublang",
    },
    {
      id: "ADU-2026-0113",
      kode: "PRY",
      nama: "Drs. H. M. Zainuri",
      noPelanggan: "PLG-00113",
      noHp: "6281912345613",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.DARURAT,
      status: StatusAduan.PROSES,
      hoursAgo: 8,
      responseHoursAgo: 6,
      keterangan: "Pipa induk diameter 4 inch pecah terhantam alat berat galian kabel.",
      wilayah: "Praya",
      desa: "Jl. Gajah Mada No. 10, Praya",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0114",
      kode: "PTE",
      nama: "Yuliana Wardani",
      noPelanggan: "PLG-00114",
      noHp: "6281912345614",
      jenis: JenisGangguan.AIR_KERUH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.BARU,
      hoursAgo: 2,
      keterangan: "Air kotor kecoklatan setelah perbaikan pipa dinas kemarin sore.",
      wilayah: "Praya Tengah",
      desa: "Lingkungan Gerunung Indah, Praya Tengah",
      unit: "Produksi",
    },
    {
      id: "ADU-2026-0115",
      kode: "PJT",
      nama: "Lalu Samsul Hadi",
      noPelanggan: "PLG-00115",
      noHp: "6281912345615",
      jenis: JenisGangguan.METER_BERMASALAH,
      prioritas: Prioritas.RENDAH,
      status: StatusAduan.SELESAI,
      hoursAgo: 32,
      responseHoursAgo: 30,
      doneHoursAgo: 8,
      keterangan: "Kran stop meter bocor halus menetes terus-menerus.",
      wilayah: "Pujut",
      desa: "Dusun Rembitan RT 03, Pujut",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0116",
      kode: "JGT",
      nama: "Endang Suprihatin",
      noPelanggan: "PLG-00116",
      noHp: "6281912345616",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.KENDALA,
      hoursAgo: 36,
      responseHoursAgo: 32,
      keterangan: "Air mati total 3 hari berturut-turut, petugas sebelumnya belum bisa temukan sumbatan.",
      wilayah: "Jonggat",
      desa: "Jl. Raya Barebali No. 78, Jonggat",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0117",
      kode: "KPG",
      nama: "Budi Santoso",
      noPelanggan: "PLG-00117",
      noHp: "6281912345617",
      jenis: JenisGangguan.TEKANAN_RENDAH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.BARU,
      hoursAgo: 4,
      keterangan: "Debit air kecil, tidak kuat naik ke lantai 2 rumah ruko.",
      wilayah: "Kopang",
      desa: "Jl. Pasar Jelojok No. 15, Kopang",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0118",
      kode: "BTK",
      nama: "Baiq Mariam",
      noPelanggan: "PLG-00118",
      noHp: "6281912345618",
      jenis: JenisGangguan.PIPA_BOCOR,
      prioritas: Prioritas.TINGGI,
      status: StatusAduan.SELESAI,
      hoursAgo: 28,
      responseHoursAgo: 26,
      doneHoursAgo: 4,
      keterangan: "Bocoran pipa tersier di halaman rumah telah selesai diperbaiki teknisi.",
      wilayah: "Batukliang",
      desa: "Dusun Aik Bukak RT 02, Batukliang",
      unit: "Teknik",
    },
    {
      id: "ADU-2026-0119",
      kode: "PRB",
      nama: "Mahsun, S.Pd.",
      noPelanggan: "PLG-00119",
      noHp: "6281912345619",
      jenis: JenisGangguan.AIR_MATI,
      prioritas: Prioritas.DARURAT,
      status: StatusAduan.PROSES,
      hoursAgo: 9,
      responseHoursAgo: 7,
      keterangan: "Pasokan terputus sejak tadi malam, butuh pengiriman tangki air darurat.",
      wilayah: "Praya Barat",
      desa: "Dusun Selong Belanak, Praya Barat",
      unit: "Distribusi",
    },
    {
      id: "ADU-2026-0120",
      kode: "PRY",
      nama: "Lalu Suparlan",
      noPelanggan: "PLG-00120",
      noHp: "6281912345620",
      jenis: JenisGangguan.AIR_KERUH,
      prioritas: Prioritas.SEDANG,
      status: StatusAduan.BARU,
      hoursAgo: 3,
      keterangan: "Air keruh dan berbusa ringan saat pertama kali dialirkan.",
      wilayah: "Praya",
      desa: "Jl. Sudirman No. 89, Praya",
      unit: "Produksi",
    },
  ];

  for (const t of mockTickets) {
    const masukTime = new Date(now.getTime() - t.hoursAgo * 3600 * 1000);
    const respTime = t.responseHoursAgo ? new Date(now.getTime() - t.responseHoursAgo * 3600 * 1000) : null;
    const selesaiTime = t.doneHoursAgo ? new Date(now.getTime() - t.doneHoursAgo * 3600 * 1000) : null;

    const aduan = await prisma.aduan.create({
      data: {
        id: t.id,
        cabangId: cabangMap[t.kode],
        wilayah: t.wilayah,
        desa: t.desa,
        noPelanggan: t.noPelanggan,
        namaPelanggan: t.nama,
        noHp: t.noHp,
        jenisGangguan: t.jenis,
        prioritas: t.prioritas,
        status: t.status,
        sumberAduan: SumberAduan.WHATSAPP,
        unit: t.unit,
        keterangan: t.keterangan,
        waktuMasuk: masukTime,
        waktuRespons: respTime,
        waktuSelesai: selesaiTime,
        slaJam: 24,
        lokasiDetail: `Dekat gapura desa ${t.desa}, ${t.wilayah}`,
        linkMaps: "https://maps.google.com/?q=-8.7056,116.2706",
      },
    });

    // Log Masuk
    await prisma.statusLog.create({
      data: {
        aduanId: aduan.id,
        statusSebelumnya: null,
        statusBaru: StatusAduan.BARU,
        waktu: masukTime,
        actorNama: "Sistem Bot WhatsApp",
        keterangan: "Aduan diterima dari WhatsApp pelanggan",
      },
    });

    // Log Respons jika ada
    if (respTime) {
      await prisma.statusLog.create({
        data: {
          aduanId: aduan.id,
          statusSebelumnya: StatusAduan.BARU,
          statusBaru: StatusAduan.DIRESPONS,
          waktu: respTime,
          actorNama: "Petugas Lapangan",
          keterangan: "Petugas telah menerima tugas dan menuju lokasi pemeriksaan",
        },
      });
    }

    // Log Selesai & Dokumentasi jika status selesai
    if (selesaiTime) {
      await prisma.statusLog.create({
        data: {
          aduanId: aduan.id,
          statusSebelumnya: StatusAduan.PROSES,
          statusBaru: StatusAduan.SELESAI,
          waktu: selesaiTime,
          actorNama: "Ahmad Koordinator",
          keterangan: "Penyambungan pipa selesai dan air mengalir normal",
        },
      });

      await prisma.dokumentasiAduan.create({
        data: {
          aduanId: aduan.id,
          tipeFoto: TipeDokumentasi.FOTO_SELESAI,
          fotoUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop",
          caption: "Perbaikan pipa tuntas, pengujian tekanan air 1.5 bar normal.",
          uploadedBy: "Petugas Lapangan",
          isValid: true,
          createdAt: selesaiTime,
        },
      });
    }
  }

  // 7. Seed Chat Admin Queue
  console.log("Seeding antrean live chat...");
  const q1 = await prisma.chatAdminQueue.create({
    data: {
      phone: "6281999888777",
      nama: "Pak Rudi Tiwinggalih",
      aduanId: "PRY26090801",
      status: "OPEN",
      context: "Menanyakan perkembangan tindak lanjut air mati",
      lastCustomerMessage: "Halo admin, kapan teknisi tiba di lokasi perumahan?",
      lastCustomerAt: new Date(now.getTime() - 25 * 60 * 1000),
      windowExpiresAt: new Date(now.getTime() + 23 * 3600 * 1000),
    },
  });

  await prisma.crmMessage.create({
    data: {
      queueId: q1.id,
      sender: "CUSTOMER",
      message: "Halo admin, kapan teknisi tiba di lokasi perumahan?",
      createdAt: new Date(now.getTime() - 25 * 60 * 1000),
    },
  });

  console.log("Seeding database SIAGA TIARA selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("Gagal melakukan seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
