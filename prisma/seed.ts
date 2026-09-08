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
