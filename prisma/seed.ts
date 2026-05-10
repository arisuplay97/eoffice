import { PrismaClient, Prioritas, SuratMasukStatus, DisposisiStatus, InstruksiDisposisi, TrackingEvent, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const UNITS: Array<{ kode: string; nama: string; tipe: string }> = [
  { kode: "DIR", nama: "Direksi", tipe: "DIREKSI" },
  { kode: "SEK", nama: "Sekretariat Perusahaan", tipe: "SEKRETARIAT" },
  { kode: "SPI", nama: "Satuan Pengawas Internal", tipe: "BIDANG" },
  { kode: "HL", nama: "Hubungan Langganan", tipe: "BIDANG" },
  { kode: "TEK", nama: "Teknik", tipe: "BIDANG" },
  { kode: "DIS", nama: "Distribusi", tipe: "BIDANG" },
  { kode: "PRD", nama: "Produksi", tipe: "BIDANG" },
  { kode: "KEU", nama: "Keuangan", tipe: "BIDANG" },
  { kode: "UMM", nama: "Umum", tipe: "BIDANG" },
  { kode: "CB-PRY", nama: "Cabang Praya", tipe: "CABANG" },
  { kode: "CB-PJT", nama: "Cabang Pujut", tipe: "CABANG" },
  { kode: "CB-JGT", nama: "Cabang Jonggat", tipe: "CABANG" },
  { kode: "CB-KPG", nama: "Cabang Kopang", tipe: "CABANG" },
  { kode: "CB-BTK", nama: "Cabang Batukliang", tipe: "CABANG" },
  { kode: "CB-BTU", nama: "Cabang Batukliang Utara", tipe: "CABANG" },
  { kode: "CB-PRG", nama: "Cabang Pringgarata", tipe: "CABANG" },
  { kode: "CB-JNP", nama: "Cabang Janapria", tipe: "CABANG" },
  { kode: "CB-PRT", nama: "Cabang Praya Tengah", tipe: "CABANG" },
  { kode: "CB-PRB", nama: "Cabang Praya Barat", tipe: "CABANG" },
  { kode: "CB-PBD", nama: "Cabang Praya Barat Daya", tipe: "CABANG" },
  { kode: "CB-PRY-TMR", nama: "Cabang Praya Timur", tipe: "CABANG" },
];

function makeVerifCode(prefix = "TIARA") {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function hashSig(payload: string) {
  const secret = process.env.JWT_SECRET || "tiara-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

async function main() {
  // Production safeguard: jangan seed di production kecuali explicit opt-in.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    console.error(
      "❌ Seed dimatikan di production. Set ALLOW_PROD_SEED=1 untuk memaksa (tidak disarankan)."
    );
    process.exit(1);
  }

  console.log("Seeding units...");
  for (const u of UNITS) {
    await prisma.unit.upsert({
      where: { kode: u.kode },
      update: { nama: u.nama, tipe: u.tipe },
      create: u,
    });
  }

  const direksi = await prisma.unit.findUnique({ where: { kode: "DIR" } });
  const sek = await prisma.unit.findUnique({ where: { kode: "SEK" } });
  const teknik = await prisma.unit.findUnique({ where: { kode: "TEK" } });
  const keuangan = await prisma.unit.findUnique({ where: { kode: "KEU" } });

  console.log("Seeding default users...");
  const pwdAdmin = await bcrypt.hash("admin123", 12);
  const pwdDefault = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: pwdAdmin,
      nama: "Administrator TIARA",
      email: "admin@tiara.co.id",
      jabatan: "Super Administrator",
      role: Role.SUPER_ADMIN,
      unitId: sek?.id,
      // Admin default wajib ganti password setelah login pertama.
      mustChangePassword: true,
    },
  });

  const direktur = await prisma.user.upsert({
    where: { username: "direktur" },
    update: {},
    create: {
      username: "direktur",
      password: pwdDefault,
      nama: "Ir. Direktur Utama",
      jabatan: "Direktur Utama",
      role: Role.DIREKSI,
      unitId: direksi?.id,
    },
  });

  const sekretariat = await prisma.user.upsert({
    where: { username: "sekretariat" },
    update: {},
    create: {
      username: "sekretariat",
      password: pwdDefault,
      nama: "Staf Sekretariat",
      jabatan: "Sekretariat Perusahaan",
      role: Role.SEKRETARIAT,
      unitId: sek?.id,
    },
  });

  const kabagTeknik = await prisma.user.upsert({
    where: { username: "kabag.teknik" },
    update: {},
    create: {
      username: "kabag.teknik",
      password: pwdDefault,
      nama: "Kepala Bagian Teknik",
      jabatan: "Kepala Bagian Teknik",
      role: Role.KEPALA_BAGIAN,
      unitId: teknik?.id,
    },
  });

  const staf = await prisma.user.upsert({
    where: { username: "staf.teknik" },
    update: {},
    create: {
      username: "staf.teknik",
      password: pwdDefault,
      nama: "Staf Teknik",
      jabatan: "Staf Teknik",
      role: Role.STAF,
      unitId: teknik?.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "kabag.keuangan" },
    update: {},
    create: {
      username: "kabag.keuangan",
      password: pwdDefault,
      nama: "Kepala Bagian Keuangan",
      jabatan: "Kepala Bagian Keuangan",
      role: Role.KEPALA_BAGIAN,
      unitId: keuangan?.id,
    },
  });

  console.log("Seeding counters...");
  for (const key of ["agenda", "surat-keluar"]) {
    await prisma.counter.upsert({
      where: { key },
      update: {},
      create: { key, value: 0 },
    });
  }

  console.log("Seeding settings...");
  for (const s of [
    { key: "company.name", value: "PERUMDAM Tirta Ardhia Rinjani" },
    { key: "company.short", value: "TIARA" },
    { key: "company.region", value: "Kabupaten Lombok Tengah" },
    { key: "app.name", value: "E-Office TIARA" },
  ]) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // Sample Surat Masuk
  const existingSurat = await prisma.suratMasuk.count();
  if (existingSurat === 0) {
    console.log("Seeding contoh surat masuk & disposisi...");
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");

    const nomorAgenda1 = `AGD/${y}/${m}/0001`;
    const kode1 = makeVerifCode();
    const sig1 = hashSig(`${nomorAgenda1}|${kode1}`);
    const sm1 = await prisma.suratMasuk.create({
      data: {
        nomorAgenda: nomorAgenda1,
        nomorSurat: "001/PEMKAB-LT/III/2026",
        tanggalSurat: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
        tanggalDiterima: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
        asalSurat: "Pemerintah Kabupaten Lombok Tengah",
        perihal: "Undangan Rapat Koordinasi Penyediaan Air Bersih",
        ringkasan:
          "Mengundang Direktur Utama PERUMDAM Tirta Ardhia Rinjani untuk menghadiri rapat koordinasi penyediaan air bersih wilayah Lombok Tengah.",
        prioritas: Prioritas.PENTING,
        status: SuratMasukStatus.DIDISPOSISIKAN,
        catatan: "Surat resmi, mohon segera ditindaklanjuti.",
        kodeVerifikasi: kode1,
        signatureHash: sig1,
        unitTujuanId: direksi?.id,
        createdById: sekretariat.id,
      },
    });

    await prisma.trackingLog.createMany({
      data: [
        {
          event: TrackingEvent.SURAT_DITERIMA,
          judul: "Surat diterima Sekretariat",
          keterangan: "Fisik surat diterima oleh petugas sekretariat",
          petugasId: sekretariat.id,
          suratMasukId: sm1.id,
        },
        {
          event: TrackingEvent.SURAT_DICATAT,
          judul: "Surat dicatat dalam agenda",
          keterangan: `Nomor agenda ${nomorAgenda1}`,
          petugasId: sekretariat.id,
          suratMasukId: sm1.id,
        },
      ],
    });

    const disp1 = await prisma.disposisi.create({
      data: {
        suratMasukId: sm1.id,
        fromUserId: sekretariat.id,
        toUserId: direktur.id,
        toUnitId: direksi?.id,
        instruksi: InstruksiDisposisi.UNTUK_DITINDAKLANJUTI,
        catatan: "Mohon arahan lebih lanjut untuk dihadiri.",
        deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5),
        status: DisposisiStatus.DIPROSES,
      },
    });

    await prisma.trackingLog.create({
      data: {
        event: TrackingEvent.DISPOSISI_DIBUAT,
        judul: "Disposisi dibuat oleh Sekretariat",
        keterangan: "Ditujukan ke Direktur Utama",
        petugasId: sekretariat.id,
        suratMasukId: sm1.id,
        disposisiId: disp1.id,
      },
    });

    // Direksi meneruskan ke Kabag
    const disp2 = await prisma.disposisi.create({
      data: {
        suratMasukId: sm1.id,
        parentId: disp1.id,
        fromUserId: direktur.id,
        toUserId: kabagTeknik.id,
        toUnitId: teknik?.id,
        instruksi: InstruksiDisposisi.SIAPKAN_BAHAN,
        catatan: "Siapkan bahan presentasi dan data teknis distribusi.",
        deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3),
        status: DisposisiStatus.DIPROSES,
      },
    });

    await prisma.trackingLog.create({
      data: {
        event: TrackingEvent.DISPOSISI_DITERUSKAN,
        judul: "Disposisi diteruskan Direksi ke Kabag Teknik",
        petugasId: direktur.id,
        suratMasukId: sm1.id,
        disposisiId: disp2.id,
      },
    });

    // Kabag meneruskan ke Staf
    await prisma.disposisi.create({
      data: {
        suratMasukId: sm1.id,
        parentId: disp2.id,
        fromUserId: kabagTeknik.id,
        toUserId: staf.id,
        toUnitId: teknik?.id,
        instruksi: InstruksiDisposisi.BUAT_LAPORAN,
        catatan: "Tolong buat ringkasan data distribusi 3 bulan terakhir.",
        deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 2),
        status: DisposisiStatus.BARU,
      },
    });

    // Surat masuk kedua
    const nomorAgenda2 = `AGD/${y}/${m}/0002`;
    const kode2 = makeVerifCode();
    const sig2 = hashSig(`${nomorAgenda2}|${kode2}`);
    const sm2 = await prisma.suratMasuk.create({
      data: {
        nomorAgenda: nomorAgenda2,
        nomorSurat: "045/BPK-RI/IV/2026",
        tanggalSurat: now,
        asalSurat: "BPK Perwakilan NTB",
        perihal: "Pemberitahuan Pemeriksaan Laporan Keuangan",
        ringkasan: "Pemeriksaan laporan keuangan tahun buku 2025.",
        prioritas: Prioritas.SEGERA,
        status: SuratMasukStatus.DITERIMA,
        kodeVerifikasi: kode2,
        signatureHash: sig2,
        unitTujuanId: keuangan?.id,
        createdById: sekretariat.id,
      },
    });

    await prisma.trackingLog.create({
      data: {
        event: TrackingEvent.SURAT_DITERIMA,
        judul: "Surat diterima Sekretariat",
        petugasId: sekretariat.id,
        suratMasukId: sm2.id,
      },
    });

    // Update counter
    const monthKey = `agenda-${y}-${m}`;
    await prisma.counter.upsert({
      where: { key: monthKey },
      update: { value: 2 },
      create: { key: monthKey, value: 2 },
    });
    await prisma.counter.upsert({
      where: { key: "agenda" },
      update: { value: 2 },
      create: { key: "agenda", value: 2 },
    });

    // Contoh surat keluar
    const nomorSK = `TAR/SEK/${y}/${m}/0001`;
    const kodeSK = makeVerifCode();
    const sigSK = hashSig(`${nomorSK}|${kodeSK}`);
    await prisma.suratKeluar.create({
      data: {
        nomorSurat: nomorSK,
        tujuan: "Pemerintah Kabupaten Lombok Tengah",
        perihal: "Laporan Progress Program Air Bersih TW1",
        ringkasan: "Laporan progress program penyediaan air bersih triwulan pertama.",
        tanggalSurat: now,
        penandatangan: "Direktur Utama",
        unitPembuatId: sek?.id,
        createdById: sekretariat.id,
        kodeVerifikasi: kodeSK,
        signatureHash: sigSK,
      },
    });

    const skMonthKey = `sk-SEK-${y}-${m}`;
    await prisma.counter.upsert({
      where: { key: skMonthKey },
      update: { value: 1 },
      create: { key: skMonthKey, value: 1 },
    });
    await prisma.counter.upsert({
      where: { key: "surat-keluar" },
      update: { value: 1 },
      create: { key: "surat-keluar", value: 1 },
    });
  }

  console.log("Seed selesai.");
  console.log("\n========================================");
  console.log("⚠️  PERINGATAN KEAMANAN");
  console.log("========================================");
  console.log("Akun default telah dibuat. WAJIB ganti");
  console.log("password segera setelah login pertama!");
  console.log("========================================\n");
  console.log("Akun default:");
  console.log("  admin / admin123  (SUPER_ADMIN)");
  console.log("  direktur / password123 (DIREKSI)");
  console.log("  sekretariat / password123 (SEKRETARIAT)");
  console.log("  kabag.teknik / password123 (KEPALA_BAGIAN)");
  console.log("  staf.teknik / password123 (STAF)");
  console.log("\nJangan jalankan seed ini di production tanpa");
  console.log("mengganti password default di env atau langsung di DB.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
