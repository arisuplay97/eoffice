# PRD — SIAGA TIARA
### Sistem Informasi Gangguan Air Terpadu — PERUMDAM Tirta Ardhia Rinjani

| | |
|---|---|
| **Versi Dokumen** | 1.0 |
| **Versi Sistem** | V11.10.10 |
| **Tanggal** | 8 September 2026 |
| **Platform** | Google Apps Script + Google Sheets + WhatsApp Cloud API |
| **Status** | Aktif — produksi |

---

## 1. Ringkasan Eksekutif

SIAGA TIARA adalah sistem pelaporan dan monitoring gangguan air berbasis WhatsApp dan dashboard web, dibangun di atas Google Apps Script dengan Google Sheets sebagai basis data. Sistem ini menggantikan proses pelaporan gangguan manual (telepon/datang langsung) dengan alur digital end-to-end: pelanggan melapor lewat WhatsApp → aduan otomatis tercatat & diteruskan ke petugas cabang terkait → petugas menangani dan mendokumentasikan lewat WhatsApp → progres dan penyelesaian termonitor real-time lewat dashboard web multi-cabang.

Sistem melayani **beberapa cabang** (Praya, Jonggat, Batukliang, Pringgarata, Janapria, dll — di bawah 1 unit usaha PERUMDAM Tirta Ardhia Rinjani), dengan **1 nomor WhatsApp Business terpusat** untuk seluruh interaksi (pelanggan maupun petugas).

---

## 2. Latar Belakang & Tujuan

**Masalah yang diselesaikan:**
- Pelaporan gangguan air manual lambat dan sulit dilacak statusnya.
- Tidak ada visibilitas terpusat: manajemen tidak tahu berapa banyak gangguan aktif, mana yang sudah lewat batas waktu respons, cabang mana yang paling responsif.
- Tidak ada data historis terstruktur untuk evaluasi kinerja per cabang/per petugas.

**Tujuan produk:**
1. Mempercepat pelaporan gangguan dari pelanggan (cukup chat WhatsApp, tanpa aplikasi terpisah).
2. Memberi visibilitas real-time ke manajemen pusat dan tiap cabang atas status seluruh gangguan.
3. Mengukur kecepatan respons petugas secara objektif (SLA) untuk mendorong akuntabilitas.
4. Menyediakan laporan bulanan otomatis (Excel/Word/PDF) untuk keperluan pelaporan ke direksi/pemerintah daerah.
5. Menjaga biaya operasional WhatsApp API tetap efisien menyusul kebijakan tarif baru Meta.

---

## 3. Lingkup Sistem

**Termasuk dalam sistem ini:**
- Bot WhatsApp untuk pelanggan (lapor aduan, cek status, tanya jawab dasar).
- Bot WhatsApp untuk petugas lapangan (terima notifikasi tugas, update status, kirim dokumentasi foto).
- Dashboard web (Admin Pusat & Admin/Staff Cabang) untuk monitoring, input manual, dan laporan.
- Sistem SLA & tracking waktu respons berbasis log status.
- Modul arsip & backup data untuk menjaga performa spreadsheet.
- Integrasi CRM eksternal (opsional, via outbox pattern ke server Node.js terpisah).
- Asisten AI (opsional) untuk pelanggan dan direksi.

**Di luar lingkup:**
- Aplikasi mobile native (semua akses lewat WhatsApp + browser web).
- Pembayaran/tagihan online (sistem ini murni pelaporan gangguan, bukan billing pelanggan).
- Manajemen inventaris suku cadang/material perbaikan.

---

## 4. Pengguna & Peran

| Peran | Kanal Akses | Kemampuan Utama |
|---|---|---|
| **Pelanggan** | WhatsApp | Lapor gangguan baru, cek status aduan, terima notifikasi update status |
| **Petugas Lapangan/Teknisi** | WhatsApp | Terima notifikasi tugas, lihat daftar aduan aktif miliknya, update status, unggah foto dokumentasi (dengan deteksi otomatis nama pelanggan dari caption) |
| **Admin/Staff Cabang** | Dashboard Web (login scoped ke 1 cabang) | Lihat & kelola aduan cabang sendiri, input aduan manual, export laporan cabang sendiri |
| **Admin Pusat** | Dashboard Web (akses semua cabang) | Semua kemampuan Admin Cabang + lintas cabang, alihkan aduan ke cabang lain, kelola pengaturan sistem, akses CRM Inbox & Asisten AI Direksi |
| **Direksi/Manajemen** | Dashboard Web + Asisten AI | Lihat ringkasan kinerja, tanya jawab insight via AI, mode TV untuk display kantor |

---

## 5. Arsitektur Teknis

### 5.1 Komponen
```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Pelanggan/     │────▶│  WhatsApp Cloud API   │────▶│  Webhook Handler     │
│   Petugas (WA)   │◀────│  (1 nomor terpusat)   │◀────│  (Apps Script)       │
└─────────────────┘     └──────────────────────┘     └──────────┬───────────┘
                                                                  │
                                                                  ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Dashboard Web   │◀───▶│  Apps Script Backend  │◀───▶│  Google Sheets (DB)  │
│  (Index.html)    │     │  (13 file .gs)        │     │  ADUAN + CABANG_* +  │
└─────────────────┘     └──────────┬───────────┘     │  LOG_* + arsip       │
                                    │                  └─────────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  CRM Eksternal        │
                         │  (Node.js, opsional)  │
                         └──────────────────────┘
```

### 5.2 Struktur Kode Backend (Apps Script)

| File | Tanggung Jawab |
|---|---|
| `Code.gs` | Konfigurasi global (`CONFIG`), setup awal spreadsheet, menu kustom, trigger `onOpen`/`onEdit` |
| `01_Dashboard_WebApp_Auth_Manual.gs` | Autentikasi login dashboard, input aduan manual dari dashboard, alihkan cabang |
| `02_Dashboard_Report_Data.gs` | Penyedia data laporan (export Excel/Word/PDF), perhitungan statistik laporan |
| `03_Archive_Cabang_Sync.gs` | Sinkronisasi sheet mirror per cabang, pengarsipan data lama/selesai |
| `04_WhatsApp_Core_ChatAdmin_Billing.gs` | Inti routing pesan WhatsApp, rate limiting, sesi chat |
| `05_Pelanggan_Menu_Aduan.gs` | Alur menu pelanggan, pembuatan aduan baru, `onEdit` trigger sheet |
| `06_AsistenVirtual_Direksi_AI.gs` | Asisten AI untuk pelanggan & direksi, normalisasi teks dialek Sasak Lombok Tengah |
| `07_Petugas_Flow_Dokumentasi.gs` | Alur kerja petugas, deteksi otomatis aduan dari foto/caption |
| `08_Admin_Petugas_Notifikasi.gs` | Notifikasi status ke pelanggan, notifikasi tugas ke petugas |
| `09_WhatsApp_Webhook_Kirimin_Tracking.gs` | Webhook masuk WhatsApp, pengiriman pesan, tracking pengumuman |
| `10_CRM_Integration.gs` | Integrasi outbox ke CRM eksternal (opsional) |
| `11_Backup_Performa.gs` | Backup data bulanan ke spreadsheet arsip terpisah |
| `ZZ_Final_Dashboard_Settings_Overrides.gs` | Logika inti dashboard (KPI, tabel Fokus/Terbaru/Selesai, SLA) |
| `Index.html` | Dashboard web single-page (~11.700 baris: HTML+CSS+JS) |

### 5.3 Struktur Data (Google Sheets)

| Sheet | Isi |
|---|---|
| `ADUAN` | Sheet utama — seluruh data aduan semua cabang |
| `CABANG_<Nama>` | Mirror per cabang (mis. `CABANG_Praya`) — untuk tampilan & input cepat per cabang |
| `LOG_STATUS_ADUAN` | Log setiap perubahan status per aduan (sumber kebenaran untuk waktu respons pertama) |
| `LOG_WHATSAPP` | Log setiap pesan WhatsApp terkirim (audit + basis hitung biaya) |
| `PETUGAS_CABANG` | Data petugas per cabang & nomor WA |
| `WHATSAPP_SESSION` | Status sesi chat aktif per nomor (untuk alur bertahap seperti input aduan) |
| `DOKUMENTASI_ADUAN` | Foto/dokumentasi pengerjaan per aduan |
| `PENUGASAN_ADUAN` | Penugasan aduan ke petugas tertentu |
| `ARSIP_LOG` | Log kegiatan pengarsipan |
| Spreadsheet Arsip (terpisah) | Backup data lama, dipindah otomatis untuk jaga performa sheet utama |

**Kolom kunci sheet ADUAN** (ringkas): ID, Waktu Masuk, Cabang, Nama Pelanggan, No Pelanggan, No HP, Jenis Gangguan, Sumber Aduan, Prioritas, Status, Unit/Petugas, Waktu Selesai, Updated At, Latitude, Longitude, Link Maps, Lokasi Detail, Keterangan.

> ⚠️ **Catatan penting:** Kolom **No Pelanggan** wajib berformat *Plain Text* (`@`) di semua sheet (ADUAN + seluruh CABANG_*). Jika format kembali ke Automatic/Number, angka nol di depan (mis. `0891234`) akan hilang secara permanen saat data ditulis — ini bukan bug logika, melainkan perilaku bawaan Google Sheets. Sistem memiliki beberapa lapis proteksi otomatis untuk ini (lihat §11 Changelog).

---

## 6. Alur Proses Utama

### 6.1 Alur Pelanggan Melapor Gangguan (WhatsApp)
1. Pelanggan chat ke nomor WhatsApp bot.
2. Bot menampilkan menu utama (lapor gangguan / cek status / lainnya).
3. Pelanggan pilih "Lapor Gangguan" → bot memandu input bertahap: nama, No Pelanggan, jenis gangguan, deskripsi, lokasi (opsional share lokasi WA).
4. Sistem validasi No Pelanggan (harus angka 5–20 digit, ditolak jika teks seperti "tidak tahu").
5. Aduan tersimpan ke sheet `ADUAN` + di-mirror ke `CABANG_<nama>` sesuai cabang pelanggan.
6. ID aduan unik (format `<KODECABANG><random>`, mis. `PRY7K2A`) dikirim balik ke pelanggan.
7. Notifikasi tugas otomatis terkirim ke petugas cabang terkait.

### 6.2 Alur Petugas Menangani Aduan (WhatsApp)
1. Petugas menerima notifikasi WA berisi ringkasan aduan baru.
2. Petugas bisa balas dengan perintah untuk melihat daftar aduan aktifnya, atau langsung update status.
3. Update status dapat dilakukan lewat teks maupun dengan mengirim **foto dokumentasi** — sistem otomatis mendeteksi aduan yang dimaksud dari nama pelanggan/cabang di caption foto.
4. Setiap perubahan status dicatat ke `LOG_STATUS_ADUAN` (dasar perhitungan SLA).
5. Saat status berubah, pelanggan menerima notifikasi otomatis.
6. Saat status "Selesai", aduan berhenti dihitung sebagai aktif di seluruh metrik dashboard.

### 6.3 Alur Admin/Cabang di Dashboard
1. Login (dashboard mendeteksi peran: Admin Pusat vs Cabang, otomatis membatasi data yang terlihat untuk akun Cabang).
2. Lihat kartu KPI (Aduan Masuk, Aduan Aktif, Lewat Respons, Aduan Selesai, dll — lihat §7).
3. Filter berdasarkan Cabang / Wilayah / Periode.
4. Tinjau tabel **Fokus Penanganan** (yang butuh perhatian segera) dan **Aduan Terbaru**.
5. Input aduan manual (untuk laporan yang masuk lewat telepon/datang langsung, bukan WA).
6. **Alihkan Cabang** bila pelanggan salah pilih cabang tujuan (khusus Admin Pusat).
7. Export **Laporan Bulanan** (Excel/Word/PDF) per cabang atau semua cabang.

### 6.4 Alur Pengarsipan & Backup
- Data yang sudah "Selesai"/"Batal" dan sudah melewati periode tertentu dipindahkan ke spreadsheet arsip terpisah (manual via menu, per bulan/per nomor HP/semua data lama) — menjaga performa sheet utama tetap cepat.

---

## 7. Metrik & Definisi Dashboard

| Kartu/Metrik | Definisi | Terikat Filter Periode? |
|---|---|---|
| **Aduan Masuk** | Jumlah aduan yang **masuk** pada periode terpilih | Ya |
| **Aduan Aktif** | Aduan berstatus Direspons/Proses/Dalam Pengerjaan/Kendala/Ditunda — **tidak termasuk status "Baru"** | Ya |
| **Lewat Respons** | Aduan yang **belum direspons** dan sudah > 24 jam sejak masuk | Ya |
| **Aduan Selesai** | Aduan berstatus Selesai pada periode terpilih; punya toggle Bulan Ini/Bulan Sebelumnya yang **otomatis sinkron** dengan filter Periode utama | Ya |
| **Cabang Respons Terbaik** | % aduan yang direspons tepat waktu per cabang, dihitung dari **waktu respons pertama yang terkunci** (tidak bergeser walau aduan diedit lagi setelahnya) | Ya |
| **Respons Awal** | % aduan yang sudah mendapat respons awal (belum tentu selesai) | Ya |
| **Respons Tepat Waktu** | % dari yang direspons, yang responsnya tepat waktu | Ya |
| **Fokus Penanganan** | Aduan aktif yang **sudah lewat** atau **mendekati** batas SLA respons — murni berdasarkan status SLA, bukan prioritas | Ya |
| **Aduan Terbaru** | Aduan aktif yang **belum** memenuhi kriteria Fokus (saling eksklusif dengan Fokus, tidak ada duplikasi) | Ya |
| **Lama Pengerjaan** | Kolom per baris: durasi sejak **respons pertama (terkunci)** sampai sekarang; berhenti tampil begitu status "Selesai" | Ya |

**Prinsip kunci "waktu respons terkunci":** Waktu respons pertama sebuah aduan diambil dari `LOG_STATUS_ADUAN` (waktu paling awal status berubah dari "Baru"), bukan dari "kapan baris terakhir diedit". Ini memastikan skor kecepatan respons cabang tidak berubah-ubah hanya karena aduan lama disentuh/diedit lagi di kemudian hari.

---

## 8. Fitur Rinci per Modul

### 8.1 Bot WhatsApp Pelanggan
- Menu utama interaktif (tombol pilihan).
- Lapor gangguan baru (alur bertahap dengan validasi input).
- Cek status aduan (berdasarkan ID atau No Pelanggan).
- Rate limiting harian per nomor (mencegah spam).
- Asisten AI opsional untuk pertanyaan bebas, dengan normalisasi typo & dialek lokal (Sasak/Lombok Tengah).

### 8.2 Bot WhatsApp Petugas
- Notifikasi tugas otomatis.
- Daftar aduan aktif milik petugas.
- Update status via teks atau foto (dengan pencocokan otomatis nama pelanggan dari caption).
- Validasi: aduan yang sudah "Selesai"/"Batal" tidak bisa diedit lagi.

### 8.3 Dashboard Web
- KPI cards real-time (auto-refresh berkala).
- Grafik tren aduan 7 hari, distribusi status (donut chart), jenis gangguan dominan (bar chart).
- Tabel Fokus Penanganan, Aduan Terbaru, Aduan Selesai — dengan pagination penuh (tidak ada lagi data yang terpotong diam-diam).
- Search aduan & audit trail (cari berdasarkan ID/nama/No HP/No Pelanggan/cabang/jenis/status).
- Filter Cabang, Wilayah, Periode (Hari Ini/7 Hari/Bulan Ini/Bulan Sebelumnya/Semua Data).
- Input Aduan manual.
- Alihkan Cabang (khusus Admin Pusat) — membuat ID baru di cabang tujuan, menutup ID lama sebagai "Batal" dengan referensi silang, notifikasi otomatis ke petugas cabang baru & ke pelanggan.
- Export Laporan Bulanan (Excel `.xlsx`, Word/HTML, PDF) — termasuk ringkasan "Jumlah Aduan / Selesai / Telat Respon" di setiap format.
- Mode TV (tampilan disederhanakan untuk layar display kantor).
- Sidebar navigasi responsif (mobile: tombol hamburger + backdrop; desktop: selalu tampil, bisa di-scroll).
- CRM Inbox (jika integrasi CRM eksternal aktif).
- Asisten AI Direksi (insight berbasis data, khusus Admin Pusat).

### 8.4 Sistem Backup & Arsip
- Backup performa: memindahkan data lama ke spreadsheet arsip terpisah per bulan, untuk menjaga sheet utama tetap ringan/cepat.
- Arsip data selesai: per bulan pilihan, per nomor HP, atau semua data lama sekaligus — dengan opsi kecualikan yang masih dalam proses.

### 8.5 Integrasi CRM (Opsional)
- Pola *outbox*: setiap interaksi WhatsApp di-antrekan lalu dikirim (flush) ke server CRM eksternal (Node.js + SQL) secara berkala via trigger.
- Konfigurasi Base URL & API Key dari dashboard, dengan validasi & tombol tes koneksi.

---

## 9. Kebijakan & Keterbatasan yang Diketahui

### 9.1 Filter periode & backlog lintas bulan *(belum diputuskan final)*
Secara default, dashboard memfilter berdasarkan **waktu masuk** aduan terhadap periode terpilih (default: Bulan Ini). Konsekuensinya: aduan lama yang **belum selesai** dari bulan sebelumnya **tidak akan muncul** di Aduan Aktif/Fokus Penanganan/Aduan Terbaru kecuali filter periode sengaja dipindah ke bulan yang bersangkutan. Dua opsi solusi sudah dibahas dan sedang dipertimbangkan:
- **Opsi A:** Jadikan "Aduan Aktif"/"Fokus Penanganan" lintas-bulan (selalu tampilkan semua yang belum selesai, apa pun bulan masuknya), sementara "Aduan Masuk"/"Aduan Selesai" tetap per-periode.
- **Opsi B:** Biarkan kartu lama tetap per-periode, tambahkan kartu baru khusus "Backlog Lama" untuk visibilitas tambahan.
> Status: **menunggu keputusan final dari pemilik produk.**

### 9.2 Skala data & payload dashboard
Tabel dashboard (Fokus/Terbaru/Selesai) mengirim seluruh data yang relevan ke client (dibatasi pengaman teknis 500 baris per tabel, dinaikkan dari batas lama 30/40/60 yang sempat menyebabkan data hilang tanpa pemberitahuan). Solusi ini valid untuk volume operasional saat ini (~150–200 aduan/bulan). Jika volume naik drastis ke ribuan per bulan, diperlukan paginasi sungguhan sisi server (client meminta halaman tertentu, bukan menerima semua data sekaligus).

### 9.3 Data historis No Pelanggan
Aduan lama yang nomor pelanggannya sudah kehilangan angka nol di depan (akibat bug format sel sebelum V11.10.1) **tidak dapat dipulihkan otomatis** — harus dikoreksi manual satu per satu bila diperlukan.

---

## 10. Risiko & Mitigasi

### 10.1 Kebijakan Tarif WhatsApp Meta (berlaku 1 Oktober 2026)

Meta menghentikan gratis-tarif untuk **Service Message** (balasan bebas teks dalam jendela layanan 24 jam) dan **Utility Template dalam-window**, efektif 1 Oktober 2026. Sebagai kompensasi, Meta memperkenalkan **jatah gratis 1.000 Service Message per bulan, per nomor WhatsApp Business** (di-refresh tiap bulan, tidak bisa ditabung/dibawa ke bulan berikutnya).

**Implikasi untuk SIAGA TIARA:**
- SIAGA TIARA menggunakan **1 nomor WhatsApp untuk seluruh cabang** → jatah 1.000 pesan/bulan itu **dibagi bersama** oleh semua cabang, bukan per cabang.
- Setiap **pesan balasan** (per bubble chat yang dikirim bot, bukan per percakapan/per sesi) dihitung sebagai 1 unit dari jatah tersebut.
- Dengan volume ~150–200 aduan/bulan, dan asumsi rata-rata beberapa balasan bot per aduan (ditambah trafik non-aduan: menu, cek status, notifikasi petugas), **volume pesan bulanan berpotensi mendekati atau melewati 1.000**, tergantung seberapa banyak pesan terpisah yang dikirim bot per interaksi.

**Mitigasi yang direkomendasikan:**
1. Gabungkan pesan-pesan bot yang berurutan untuk satu aksi pelanggan menjadi **satu bubble**, bukan dipecah 2–3 pesan (mengurangi jumlah pesan tanpa mengurangi informasi).
2. Kurangi pesan konfirmasi yang tidak esensial (mis. pesan "mohon tunggu" yang berdiri sendiri).
3. Batasi notifikasi status ke pelanggan hanya untuk perubahan status yang penting, bukan setiap perubahan kecil.
4. Ukur volume pesan aktual bulanan dari sheet `LOG_WHATSAPP` sebagai dasar keputusan (belum diimplementasikan sebagai laporan otomatis — lihat Roadmap).
5. Pertimbangkan batas balasan otomatis harian per nomor pelanggan (mis. maksimal 10 balasan/hari, lalu dialihkan ke penanganan manual admin) untuk kasus obrolan berulang yang tidak produktif — **dengan pengecualian** notifikasi status resmi (aduan selesai/update petugas) yang tetap harus selalu terkirim.

### 10.2 Ketergantungan pada format sel Google Sheets
Karena basis data adalah Google Sheets (bukan database sungguhan), perilaku auto-format Sheets (mengubah teks angka jadi Number) adalah risiko struktural berulang. Sistem sudah memiliki lapis proteksi otomatis (saat spreadsheet dibuka, saat sheet dibuat, saat baris diedit, saat aduan baru masuk), tetapi risiko ini **tidak bisa dihilangkan 100%** selama basis data tetap Google Sheets — hanya bisa diminimalkan.

---

## 11. Riwayat Perbaikan (Changelog V11.10.1 – V11.10.10)

| Versi | Perbaikan |
|---|---|
| V11.10.1 | Perbaikan utama bug No Pelanggan berawalan 0 hilang: dead code di `setupAduanSheet`, cache yang menyebabkan tombol "Update Kolom No Pelanggan" bisa silent no-op, format kolom di sheet mirror cabang |
| V11.10.2 | Kolom SLA di laporan bulanan sekarang menampilkan keterangan durasi ("Lewat 2 hari 3 jam") untuk aduan aktif yang lewat SLA, bukan cuma kata "Lewat" polos — berlaku di Excel/Word/PDF |
| V11.10.3 | Proteksi tambahan No Pelanggan untuk skenario edit langsung di Google Sheets (`onOpen`, `onEdit`) |
| V11.10.4 | Tambahan ringkasan "Jumlah Aduan / Selesai" di bawah judul "Detail Aduan Gangguan" pada semua format export |
| V11.10.5 | Perbaikan kartu "Aduan Aktif" yang salah menghitung status "Baru" sebagai aktif; tambahan "Telat Respon" di ringkasan laporan |
| V11.10.6 | Waktu respons dikunci ke log status pertama (tidak lagi bergeser akibat edit berikutnya); fitur baru "Lama Pengerjaan" per baris aduan |
| V11.10.7 | Fokus Penanganan dan Aduan Terbaru dipisah tegas (tidak lagi duplikat); keanggotaan Fokus murni berdasarkan SLA, bukan prioritas |
| V11.10.8 | Perbaikan data tersembunyi: batas potong 30/40/60 baris per tabel dashboard (sejak lama, demi performa) dinaikkan ke 500 — mencegah aduan hilang diam-diam dari tampilan |
| V11.10.9 | Sidebar dashboard mobile: tombol hamburger, backdrop, perbaikan overflow/scroll yang sebelumnya terpotong |
| V11.10.10 | Sinkronisasi toggle "Bulan Ini/Bulan Sebelumnya" tabel Aduan Selesai dengan filter Periode utama (sebelumnya berjalan sendiri, menyebabkan tabel tampak kosong) |

---

## 12. Roadmap / Rencana Selanjutnya

1. **Keputusan final** soal penanganan backlog lintas-bulan (Opsi A vs B, §9.1).
2. **Audit & optimasi jumlah pesan WhatsApp** di seluruh modul (`04_`, `05_`, `08_`, `09_`) untuk menekan biaya pasca 1 Oktober 2026.
3. **Laporan pemakaian pesan WhatsApp bulanan otomatis** dari `LOG_WHATSAPP`, agar tim bisa memantau kedekatan dengan batas 1.000/bulan tanpa audit manual.
4. Evaluasi kebutuhan **paginasi sisi server sungguhan** jika volume aduan bulanan naik signifikan.
5. Evaluasi apakah perlu memisahkan nomor WhatsApp per fungsi (pelanggan vs petugas) atau tetap 1 nomor, mempertimbangkan trade-off biaya vs kompleksitas operasional.

---

## 13. Lampiran — Ringkasan Fungsi Kunci

| Fungsi | Lokasi | Peran |
|---|---|---|
| `getWhatsAppMenuResponse_` | `04_...gs` | Router utama seluruh pesan WhatsApp masuk |
| `createAduanFromWhatsApp_` | `05_...gs` | Membuat aduan baru dari alur WhatsApp pelanggan |
| `createAduanFromDashboardManual_` | `01_...gs` | Membuat aduan baru dari input manual dashboard |
| `ensureNoPelangganColumnHeader_` | `Code.gs` | Memaksa format Plain Text kolom No Pelanggan |
| `siagaDashTables_` | `ZZ_Final...gs` | Membangun data tabel Fokus/Terbaru/Selesai untuk dashboard |
| `siagaDashSlaInfo_` | `ZZ_Final...gs` | Menghitung status & durasi SLA per aduan |
| `getAduanResponseAt_` | `ZZ_Final...gs` | Mengambil waktu respons pertama yang terkunci dari log status |
| `clientGetPdfReportData` | `02_...gs` | Menyiapkan data untuk export laporan bulanan |
| `handleAduanStatusEditTrigger` | `08_...gs` | Menangani perubahan status via edit sheet, memicu notifikasi |
| `crmFlushOutbox` | `10_...gs` | Mengirim antrean data ke CRM eksternal |

---

*Dokumen ini merangkum kondisi sistem SIAGA TIARA per 8 September 2026, berdasarkan basis kode V11.10.10. Dokumen perlu diperbarui setiap ada perubahan arsitektur atau kebijakan signifikan.*
