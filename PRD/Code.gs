// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: Code.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

// V10.9.212 - TIARA Asisten Virtual pelanggan + API AI bersama pelanggan/direksi
// V10.9.177 - Fix: Direspons tetap aktif; Selesai hanya status Selesai
// V10.9.174 - ANTI SPAM PETUGAS + PELANGGAN 3 DETIK
// - Debounce tidak hanya menu pembuka pelanggan, tapi juga prompt/menu petugas:
//   Daftar Aduan, Cari Aduan, Detail Aduan, Update Status, Upload Foto, tunggu foto, dan konfirmasi Ya/Tidak.
// - Chat ngasal dikunci sebelum proses + setelah hasil reply agar menu tidak dobel saat webhook paralel.
// - Perintah valid/foto valid tetap diproses sesuai alur.
// V10.9.169 - FIX PARSER ADUAN WA: AIR KELUAR SEDIKIT AUTO TEKANAN RENDAH
// V10.9.166 - DASHBOARD CLEAN: HIDE WILAYAH COLUMN + RANKING CABANG RAPI
// Base tetap V10.9.165 realtime 1 menit + polling ringan 10 detik.
// Perubahan: Cache session dashboard, hapus 3 duplikasi clientGetDashboardData,
// kurangi payload tabel (250 -> 130 baris) untuk loading lebih cepat.
// V10.9.163 - ID TANPA STRIP + ADMIN TOLAK FOTO (base)
// V10.9.133 - TIARA Asisten Virtual Prompt Natural
// - Format jawaban TIARA Asisten Virtual tidak lagi dikunci Kesimpulan/Alasan/Saran.
// - Pertanyaan keputusan memakai Jawaban singkat, Dasar data, Catatan, Rekomendasi.
// - Data rendah wajib diberi catatan agar AI tidak terlalu percaya diri.
// PERUBAHAN V10.9.143:
// - Menu Cek Status Aduan sekarang menampilkan aduan aktif dan aduan selesai terbaru dari nomor WhatsApp pelanggan.
// - Tujuannya agar pelanggan tetap bisa melihat status selesai bila notifikasi selesai tidak masuk/terlewat.
// - Aduan aktif tetap diurutkan paling atas; tiket lama tetap bisa dicek manual lewat ID Aduan.


// V10.9.102:
// - Fix perintah "selesai" pada sesi Tanya Asisten Virtual Direksi yang kadang tidak membalas.
// - Perintah selesai/keluar/stop/akhiri sekarang diproses lebih awal dan tidak tertahan rate limit.
// - Perintah direksi dinormalisasi agar tetap terbaca walaupun ada tanda * atau spasi.


// PERUBAHAN V10.9.115:
// V10.9.206 - Fix salah pilih cabang: tidak lagi menampilkan menu Buat Aduan saat masih di tahap pilih cabang.
// - Menu WhatsApp disederhanakan: Buat Aduan Baru dihapus dari menu pelanggan.
// - Aduan Cepat diganti nama menjadi Buat Aduan.
// - Alur Buat Aduan sekarang memakai format satu pesan: nama, No Pelanggan, keluhan, dan lokasi/patokan.
// - Nomor menu pelanggan menjadi: 1 Buat Aduan, 2 Cek Status Aduan, 3 Cek Tagihan, 4 Info Layanan.

// PERUBAHAN V10.9.116:
// - Pilih cabang untuk Buat Aduan tidak lagi memakai list/tombol interaktif.
// - Bot menampilkan 12 cabang dalam satu daftar teks, pelanggan cukup balas angka 1-12.
// - Input nama/kode cabang tetap diterima sebagai cadangan.

// PERUBAHAN V10.9.117:
// - Menu Petugas: pilihan status Selesai tidak langsung menutup aduan.
// - Petugas wajib kirim Foto Selesai terlebih dahulu. Setelah foto diterima, status otomatis menjadi Selesai.
// - Menghapus langkah konfirmasi tambahan Selesaikan/Tetap Proses pada jalur cepat selesai.

// PERUBAHAN V10.9.118:
// - Menu Petugas > Upload Foto > Foto Selesai disamakan dengan jalur Update Status > Selesai.
// - Setelah Foto Selesai diterima, status otomatis menjadi Selesai tanpa tombol Selesaikan/Tetap Proses.
// - Foto Sebelum/Proses/Lainnya tetap hanya menyimpan dokumentasi dan tidak mengubah status.


// PERUBAHAN V10.9.130:
// - Alur Buat Aduan WA setelah pilih cabang kembali menjadi satu pesan.
// - Pelanggan wajib mencantumkan Nama, No Pelanggan, keluhan, dan lokasi/patokan dalam satu input.
// - Parser dibuat fleksibel: mendukung format koma, per baris, atau satu kalimat.

// PERUBAHAN V10.9.123:
// - Notifikasi dokumentasi selesai ke pelanggan diringkas.
// - Baris Jenis Foto dan Cabang dihapus dari caption pelanggan.
// - Petugas di notifikasi pelanggan ditampilkan sebagai Tim Teknis.
// - Nama petugas yang dicentang tetap muncul untuk internal/detail/export laporan.
// ============================================================
// SIAGA TIARA - Sistem Informasi Aduan Gangguan Air
// PERUMDAM Tirta Ardhia Rinjani - Lombok Tengah
// Versi: 10.9.107 - PETUGAS OTOMATIS DI EXPORT LAPORAN
//
// PERUBAHAN V10.9.68:
// - Fix: Hapus duplikasi fungsi cekPetugasCabangAktif (bug lama sejak v1)
// - Optimasi: getLastInboundChatAt_ pakai CacheService sebagai primary
//   Sebelumnya: scan 600 baris LOG_WHATSAPP setiap cek notifikasi 24 jam
//   Sesudahnya: baca cache ~20ms, scan LOG hanya kalau cache miss
// - Optimasi: handleWhatsAppWebhook_ simpan timestamp pesan masuk ke cache
//   otomatis sehingga scan LOG tidak pernah diperlukan lagi untuk pesan baru
//
// PERUBAHAN V10.9.69:
// - Safe fix: batas TTL CacheService dikunci maksimal 21600 detik.
// - Safe fix: cache LAST_INBOUND tidak lagi memakai 86400 detik.
// - Tidak menambah fitur baru agar patch tetap ringan dan aman.
//
// PERUBAHAN V10.9.70:
// - Timeout input aduan (Buat Aduan Baru dan Aduan Cepat) diturunkan menjadi 15 menit.
// - FAST_* disamakan dengan NEW_* sebagai session input aduan.
// - Ditambahkan reminder opsional: pengingat 10 menit dan penutupan otomatis 15 menit jika pelanggan tidak merespon.
// - Reminder otomatis baru aktif jika trigger diaktifkan dari menu WhatsApp.
//
// PERUBAHAN V10.9.71:
// - Session non-aduan yang menunggu input pelanggan dibuat 10 menit.
// - Reminder non-aduan dikirim sekitar menit ke-5.
// - Session non-aduan ditutup sekitar menit ke-10.
// - Cakupan non-aduan: Cek Tagihan, Cek Status menunggu ID, dan pilih Aduan Aktif.
//
// PERUBAHAN V10.9.72:
// - Paket digabung dengan Index.html dari versi web dashboard sebelumnya.
// - Code.gs tetap memakai base V10.9.71: reminder non-aduan 10 menit dan aduan 15 menit.
// - Tidak mengubah logic dashboard/login; hanya mengembalikan file HTML dashboard ke paket ZIP.
//
// PERUBAHAN V10.9.73:
// - Fix tombol Aksi/Update di Index.html.
// - Penyebab: onclick memakai kutip ganda di dalam kutip ganda sehingga browser tidak menjalankan fungsi update.
// - Tidak mengubah logic backend.
//
// PERUBAHAN V10.9.75:
// - Saat status berubah menjadi Selesai dan Foto Selesai tersedia,
//   bot mengirim notifikasi selesai lalu mengirim foto dokumentasi langsung.
// - Jika kirim foto gagal, tombol Lihat Foto tetap tersedia sebagai fallback.
// - Foto yang dikirim memakai URL thumbnail Drive ukuran w1280 agar lebih ringan.
// - Upload dokumentasi dari dashboard dikompres di browser sebelum dikirim ke Apps Script.
//
// PERUBAHAN V10.9.76:
// - Foto Sesudah disamakan menjadi Foto Selesai.
// - Jika upload Foto Selesai baru, dokumentasi final lama untuk ID aduan yang sama
//   dihapus dari daftar aktif sehingga pelanggan hanya melihat 1 foto selesai terbaru.
// - File Drive lama tidak dihapus permanen agar aman sebagai arsip internal.
//
// PERUBAHAN V10.9.77:
// - Modal Aksi Index diberi scroll internal agar tombol Simpan/Upload tetap bisa dijangkau tanpa zoom out.
// - Pengiriman foto selesai ke pelanggan dibuat lebih kuat:
//   mencoba beberapa URL Drive dan beberapa format payload media Kirimin.
// - Response 200 tetapi berisi status/success false tidak lagi dianggap berhasil.
//
// PERUBAHAN V10.9.78:
// - Tambah format URL gambar Google Drive lh3.googleusercontent.com.
// - Tambah variasi payload media: message, content object, attachment, url.
// - Tambah ringkasan error media agar penyebab GAGAL lebih mudah dibaca di LOG_WHATSAPP.
//
// PERUBAHAN V10.9.79:
// - Berdasarkan error Kirimin: "media_url is required for media messages".
// - Payload kirim foto sekarang memprioritaskan field media_url di level utama.
// - Mengurangi percobaan payload yang jelas ditolak agar kirim foto lebih cepat.
//
// PERUBAHAN V10.9.80:
// - Tambah menu arsip LOG_WHATSAPP lama.
// - LOG_WHATSAPP utama hanya perlu menyimpan log aktif/terbaru.
// - Log lebih lama dari 30 hari dipindahkan ke ARSIP_LOG_WHATSAPP_YYYY_MM.
// - Sistem tetap menjaga log 24 jam terakhir agar notifikasi status pelanggan aman.
//
// PERUBAHAN V10.9.93:
// - Fix WA Petugas: setelah update status, tombol Upload Foto tetap membawa ID aduan terakhir.
// - Fix input manual dashboard: post-processing dibuat aman agar aduan yang sudah tersimpan tidak dianggap gagal.
// - Fix dashboard: notifikasi aduan baru dibuat sticky dengan tombol close, dan input manual menampilkan popup ID aduan.
//
// PERUBAHAN V10.9.81:
// - Tambah fitur Executive Insight / Menu Direksi via WhatsApp.
// - Tambah sheet DIREKSI_ACCESS untuk membatasi nomor WA direksi.
// - Tambah Tanya Asisten Virtual khusus direksi dengan alur chat berkelanjutan.
// - Session DIREKSI_AI_CHAT tidak langsung selesai setelah 1 pertanyaan.
// - Gemini API dipanggil hanya dari Code.gs, memakai data ringkas SIAGA.
// - Jika API Gemini belum diset, sistem tetap memberi jawaban fallback berbasis data.
//
// PERUBAHAN V10.9.82:
// - Akses direksi dipindah ke sheet PETUGAS_CABANG agar tidak menambah sheet akses baru.
// - Nomor direksi cukup diisi pada PETUGAS_CABANG dengan Role: Direksi/Manajemen/Direktur.
// - LOG_AI tidak lagi membuat sheet baru; riwayat AI dicatat ke LOG_WHATSAPP dengan jenis AI_DIREKSI.
// - Model default diubah ke gemini-3.1-flash-lite untuk TIARA Asisten Virtual yang lebih cepat dan hemat.
//
// PERUBAHAN V10.9.83:
// - SLA tidak hilang setelah status aduan diubah menjadi Selesai.
// - Sistem sekarang menghitung riwayat Selesai terlambat berdasarkan Waktu Masuk + SLA Jam vs Waktu Selesai.
// - Menu Direksi dan Tanya Asisten Virtual membedakan: lewat SLA aktif dan selesai terlambat.
// - Balasan cek status pelanggan juga bisa menampilkan ringkasan SLA penanganan setelah selesai.
//
// PERUBAHAN V10.9.84:
// - SLA terlambat tetap dihitung untuk Direksi/AI/internal.
// - Balasan Cek Status pelanggan tidak menampilkan telat SLA agar bahasa ke pelanggan tetap aman dan tidak memancing komplain.
//
// PERUBAHAN V10.9.85:
// - Tambah menu setup akses direksi tanpa membuat sheet baru.
// - Setup direksi tetap memakai PETUGAS_CABANG.
// - Menu setup menyiapkan baris contoh Direksi/Manajemen jika belum ada.
//
// PERUBAHAN V10.9.86:
// - Error teknis Gemini tidak lagi ditampilkan mentah ke WhatsApp direksi.
// - Jika Gemini 503/high demand/rate limit, bot memakai Mode Data Sistem dengan bahasa aman.
// - Pertanyaan sensitif SDM seperti pecat/copot/ganti/mutasi kepala cabang dijawab sebagai evaluasi manajemen, bukan keputusan personal.
//
// PERUBAHAN V10.9.87:
// - Jawaban TIARA Asisten Virtual dirapikan agar tidak menampilkan Markdown mentah seperti **teks**.
// - Output Gemini dikonversi ke format WhatsApp: *bold* dan bullet •.
// - Jika jawaban terlalu panjang, sistem memotong di batas kalimat aman dan menyimpan lanjutan.
// - Direksi bisa ketik lanjut untuk membaca sambungan jawaban.
// - Prompt Gemini dibuat lebih singkat, natural, dan tidak mengulang salam di setiap jawaban.
//
// PERUBAHAN V10.9.88:
// - Tambah ulang dropdown dan conditional formatting utama ADUAN.
// - Input manual dari Index sekarang langsung memanggil refresh validasi/warna baris.
// - Tambah menu perbaikan untuk Refresh Dropdown & Warna ADUAN.
// - Menegaskan CABANG_* adalah mirror; hapus baris di sheet cabang tidak otomatis menghapus ADUAN.
//
// PERUBAHAN V10.9.89:
// - Jika data di ADUAN sudah dihapus, sheet CABANG_* bisa dibersihkan otomatis/ manual dari ID yang sudah tidak ada.
// - Tambah menu Bersihkan Sheet Cabang dari ADUAN.
//
// PERUBAHAN V10.9.99:
// - Anti duplicate webhook untuk mencegah bot membalas retry/status webhook ganda.
// - Skip webhook status outbound/read/delivered dan echo pesan bot sendiri.
//
// PERUBAHAN V10.9.100:
// - Model Asisten Virtual/Direksi diubah ke gemini-3.1-flash-lite.
// - doPost diberi ScriptLock ringan untuk mengurangi risiko race condition saat webhook retry bersamaan.
// - Tambah trigger onChange untuk mendeteksi hapus baris di ADUAN lalu membersihkan mirror cabang.
// - Hapus baris di CABANG_* tetap tidak menghapus data ADUAN demi keamanan data pusat.
//
// PERUBAHAN V10.9.90:
// - Reminder otomatis WhatsApp hanya dikirim untuk sesi input aduan: NEW_* dan FAST_*.
// - Sesi non-aduan seperti Cek Status, Riwayat, dan Cek Tagihan tidak lagi dikirimi reminder/no-response.
// - Non-aduan tetap dibersihkan otomatis saat timeout agar SESSION_WHATSAPP tidak menumpuk.
//
// // PERUBAHAN V10.9.74:
// - Tombol Aksi dashboard ditambah Dokumentasi Proses/Selesai.
// - Cabang/petugas bisa upload foto bukti dari modal Aksi.
// - Dokumentasi tersimpan ke Drive dan sheet DOKUMENTASI_ADUAN.
// - Akses tetap difilter sesuai cabang login.
// Versi: 10.9.66 - WEB INPUT ADUAN MANUAL
// ============================================================
//
// PERUBAHAN V10.9.11:
// - Session WhatsApp -> CacheService (RAM) sebagai primary, Spreadsheet backup
// V10.9.136: Tambah Kirimin typing indicator dan Menu Petugas semi AI (2 menu + perintah natural).
// V10.9.138: Rapikan kalimat menu petugas; contoh semi AI dan caption foto selesai tampil di menu utama.
// V10.9.139: Respons / Cek Awal wajib Foto Respons agar petugas tidak bisa klaim cek lokasi tanpa bukti foto.
// V10.9.156: Foto caption tanpa ID untuk respons/proses didukung. Format: sudah di respon, (nama pelanggan). Status otomatis menjadi Dalam Pengerjaan/Proses.
// V10.9.157: Foto Respons dan Foto Selesai wajib konfirmasi Ya/Tidak sebelum status diubah.
// V10.9.161: Jika petugas tekan Tidak, foto terbaru ikut dibatalkan/dihapus dari dokumentasi aktif.
// V10.9.163: ID aduan baru tanpa strip dan admin pusat bisa menolak dokumentasi foto tidak valid.
// V10.9.158: Frasa "selesai dicek/selesai di cek" dianggap Respons/Proses, bukan Selesai.
// - Caption selesai tanpa ID disederhanakan: "sudah selesai, (nama pelanggan)".
// V10.9.137: Foto petugas + caption tanpa ID bisa dicocokkan dari nama pelanggan + cabang.
// V10.9.170: Anti-spam menu WA - balasan menu/list yang sama dari nomor yang sama ditahan beberapa detik agar spam chat tidak membuat bot membalas berulang.
// - Contoh: "sudah selesai, (nama pelanggan)".
// - Pencarian hanya memakai aduan aktif; aduan Selesai/Batal tidak dimunculkan.
//   Estimasi hemat: 1-2 detik per pesan masuk
// - shouldUseInteractiveMenu_ di-cache per eksekusi (sebelumnya dipanggil 5x)
//   Estimasi hemat: ~1 detik per pesan
// - PropertiesService di-cache global per eksekusi, tidak buka koneksi ulang
//   Estimasi hemat: ~0.5 detik per pesan
// - Total estimasi percepatan: 2-4 detik per pesan
// ============================================================
//
// Hak Cipta / Copyright © 2026
// Dibuat dan dikembangkan oleh:
// Muh Sofiyan Hawari
//
// Sistem ini dibuat sebagai inovasi internal untuk mendukung
// monitoring, pencatatan, pelaporan, dan verifikasi aduan gangguan
// pada PERUMDAM Tirta Ardhia Rinjani.
//
// Dilarang menyalin, mengubah, mendistribusikan, atau menggunakan
// sistem ini di luar kebutuhan internal tanpa izin pembuat.
//
// ============================================================

// ============================================================
// KONFIGURASI SISTEM
// ============================================================
var CONFIG = {
  SHEET_NAME: 'ADUAN',
  SETTINGS_SHEET: 'SETTINGS',
  EXPORT_LOG_SHEET: 'LOG_EXPORT_PDF',
  EXPORT_DETAIL_SHEET: 'LOG_EXPORT_DETAIL',
  ARCHIVE_LOG_SHEET: 'LOG_ARSIP',
  APP_NAME: 'SIAGA TIARA',
  INPUT_SHEET_PREFIX: 'INPUT_',
  INPUT_LOG_SHEET: 'LOG_INPUT_CABANG',
  WHATSAPP_LOG_SHEET: 'LOG_WHATSAPP',
  WHATSAPP_SESSION_SHEET: 'SESSION_WHATSAPP',
  PENGUMUMAN_SHEET: 'PENGUMUMAN',
  STATUS_NOTIF_LOG_SHEET: 'LOG_NOTIF_STATUS',
  PETUGAS_CABANG_SHEET: 'PETUGAS_CABANG',
  DOKUMENTASI_ADUAN_SHEET: 'DOKUMENTASI_ADUAN',
  LOG_STATUS_ADUAN_SHEET: 'LOG_STATUS_ADUAN',
  PENUGASAN_ADUAN_SHEET: 'PENUGASAN_ADUAN',
  GEMINI_MODEL_DIREKSI: 'gemini-3.1-flash-lite',

  // V10.9.212 - AI bersama untuk pelanggan + direksi.
  // Key disimpan via Script Properties, bukan ditulis di Code.gs.
  SHARED_AI_BASE_URL: 'https://capi.aerolink.lat',
  SHARED_AI_MODEL: 'claude-opus-4-6',
  SHARED_AI_TIMEOUT_SECONDS: 10,
  SHARED_AI_CUSTOMER_ENABLED: 'YA',
  SHARED_AI_DIREKSI_ENABLED: 'YA',

  // V10.9.49 - Anti spam WhatsApp.
  RATE_LIMIT_ENABLED: 'YA',
  RATE_LIMIT_PER_MINUTE: 10,
  RATE_LIMIT_CUSTOMER_DAILY: 50,
  RATE_LIMIT_PETUGAS_DAILY: 150,
  RATE_LIMIT_ADMIN_DAILY: 300,
  RATE_LIMIT_BLOCK_MINUTES: 3,
  RATE_LIMIT_WARN_COOLDOWN_MINUTES: 5,
  WHATSAPP_DEFAULT_REPLY_MODE: 'AUTO',
  WHATSAPP_PROVIDER: 'KIRIMIN_ID',
  WHATSAPP_DEVICE_ID: '',
  WHATSAPP_CUSTOMER_ID_FIELD: 'customer_id',
  WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT: 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}',
  WHATSAPP_INTERACTIVE_ENDPOINT: 'https://apiapp.kirimin.id/api/v1/public/messages/send',
  WHATSAPP_USE_INTERACTIVE_MENU: 'YA',
  // Mode cepat untuk webhook pelanggan; indikator ketik AI Direksi tetap dipertahankan.
  WHATSAPP_FAST_REPLY_ENABLED: 'YA',
  WHATSAPP_DEBOUNCE_LOCK_WAIT_MS: 120,
  WHATSAPP_TYPING_ENABLED: 'YA',
  WHATSAPP_TYPING_MODE: 'SELECTIVE',
  WHATSAPP_TYPING_ENDPOINT: 'https://apiapp.kirimin.id/api/v1/public/conversations/{customerIdentifier}/typing',
  WHATSAPP_TYPING_DELAY_MS: 600,
  WHATSAPP_TYPING_COOLDOWN_SECONDS: 3,

  // V10.9.57 - API cek tagihan pelanggan.
  BILLING_API_BASE_URL: 'http://loteng.homeip.net/webapi/pelanggan',
  BILLING_API_TOKEN: '',
  BILLING_MASK_CUSTOMER_DATA: 'YA',
  BILLING_MAX_DETAIL_ROWS: 6,

  BUSINESS_HOURS_ENABLED: 'YA',
  BUSINESS_HOURS_START: '08:00',
  BUSINESS_HOURS_END: '16:00',
  BUSINESS_HOURS_DAYS: '1,2,3,4,5', // 1=Senin ... 5=Jumat
  BUSINESS_HOURS_TIMEZONE: 'Asia/Makassar',
  CREATOR: 'Muh Sofiyan Hawari',
  COPYRIGHT: '© 2026 Muh Sofiyan Hawari',

  // Aduan masuk Fokus Penanganan jika sisa SLA Respons <= 25% dari SLA.
  // SLA utama sekarang adalah waktu respons 1x24 jam untuk semua prioritas.
  FOCUS_SLA_PERCENT: 0.25,

  // WhatsApp customer service window untuk notifikasi status gratis/free-form
  STATUS_NOTIF_WINDOW_HOURS: 24,

  // Batas aduan aktif pelanggan per nomor WhatsApp
  MAX_ACTIVE_ADUAN_PER_PHONE: 1,

  // Timeout session WhatsApp
  SESSION_TIMEOUT_MAIN_MINUTES: 15,
  SESSION_TIMEOUT_INPUT_MINUTES: 15,      // NEW_* / FAST_* aduan
  SESSION_TIMEOUT_WAITING_MINUTES: 10,    // Cek Tagihan / Cek Status / Riwayat menunggu input, ditutup diam-diam tanpa reminder
  SESSION_REMINDER_WAITING_MINUTES: 5,      // Legacy, V10.9.90 tidak dipakai untuk kirim reminder non-aduan

  // Pengumuman Layanan
  // Ubah angka ini saja untuk mengatur jeda tampil ulang pengumuman per nomor WhatsApp.
  // Contoh: 1 = 1 jam, 6 = 6 jam, 24 = 24 jam.
  // Isi 0 jika pengumuman ingin muncul setiap kali pelanggan membuka Menu Utama.
  PENGUMUMAN_REPEAT_HOURS: 6,

  // Jika YA, pengumuman yang tanggal SELESAI-nya sudah lewat akan otomatis diubah menjadi NONAKTIF.
  // Kalau TIDAK, pengumuman hanya tidak tampil, tetapi STATUS di sheet tetap AKTIF.
  PENGUMUMAN_AUTO_NONAKTIF_EXPIRED: 'YA',

  // Sinkron otomatis INPUT cabang ke ADUAN.
  // Ubah angka ini saja untuk mengatur jeda sync.
  // Aman dipakai: 1, 5, 10, 15, atau 30 menit.
  // Default sekarang: 5 menit.
  SYNC_INPUT_INTERVAL_MINUTES: 5,

  // Kolom (1-indexed)
  COL: {
    ID: 1,
    WAKTU_MASUK: 2,
    CABANG: 3,
    WILAYAH: 4,
    DESA: 5, // Dipakai sebagai No Pelanggan mulai V10.9.4
    NO_PELANGGAN: 5,
    NAMA_PELANGGAN: 6,
    NO_HP: 7,
    JENIS_GANGGUAN: 8,
    PRIORITAS: 9,
    STATUS: 10,
    UNIT: 11,
    KETERANGAN: 12,
    CATATAN: 13,
    WAKTU_SELESAI: 14,
    SLA_JAM: 15,       // HIDDEN
    UPDATED_AT: 16,    // HIDDEN
    LATITUDE: 17,
    LONGITUDE: 18,
    LINK_MAPS: 19,
    LOKASI_DETAIL: 20
  },

  // SLA Respons 1x24 jam untuk semua prioritas.
  // Prioritas tetap dipakai untuk urgensi/urutan penanganan, bukan batas SLA.
  SLA_RESPONS_JAM: 24,
  SLA: {
    'Darurat': 24,
    'Tinggi': 24,
    'Sedang': 24,
    'Rendah': 24
  },

  // Dropdown options
  CABANG: [
    'Cabang Praya',
    'Cabang Praya Tengah',
    'Cabang Praya Barat',
    'Cabang Praya Barat Daya',
    'Cabang Praya Timur',
    'Cabang Pujut',
    'Cabang Jonggat',
    'Cabang Batukliang',
    'Cabang Batukliang Utara',
    'Cabang Kopang',
    'Cabang Janapria',
    'Cabang Pringgarata'
  ],

  WILAYAH: [
    'Praya', 'Praya Tengah', 'Praya Barat', 'Praya Barat Daya',
    'Praya Timur', 'Pujut', 'Jonggat', 'Batukliang',
    'Batukliang Utara', 'Kopang', 'Janapria', 'Pringgarata', 'Lainnya'
  ],

  JENIS_GANGGUAN: [
    'Air Mati', 'Tekanan Rendah', 'Air Keruh', 'Pipa Bocor',
    'Meter Bermasalah', 'Tagihan', 'Sambungan Baru', 'Lainnya'
  ],

  PRIORITAS: ['Rendah', 'Sedang', 'Tinggi', 'Darurat'],
  STATUS: ['Baru', 'Direspons', 'Proses', 'Dalam Pengerjaan', 'Kendala', 'Selesai', 'Ditunda', 'Batal'],
  UNIT: ['Cabang', 'Hublang', 'Teknik', 'Distribusi', 'Produksi', 'IT', 'Lainnya']
};

// Mapping kode cabang untuk ID aduan.
// Format ID: KODECABANG-YYYYMMDD-0001
var CABANG_CODE = {
  'Cabang Praya': 'PRY',
  'Cabang Pujut': 'PJT',
  'Cabang Jonggat': 'JGT',
  'Cabang Kopang': 'KPG',
  'Cabang Janapria': 'JNP',
  'Cabang Batukliang': 'BTK',
  'Cabang Batukliang Utara': 'BKU',
  'Cabang Pringgarata': 'PGR',
  'Cabang Praya Barat': 'PRB',
  'Cabang Praya Barat Daya': 'PBD',
  'Cabang Praya Timur': 'PRT',
  'Cabang Praya Tengah': 'PTE',
  'Cabang Lainnya': 'LNY'
};

// V10.9.40:
// Sheet INPUT_* tidak dipakai lagi agar spreadsheet tidak terlalu banyak sheet.
// Manual input sekarang dilakukan langsung dari sheet CABANG_*.
// Daftar lama disimpan hanya untuk fitur pembersihan/hapus sheet INPUT lama.
var LEGACY_CABANG_INPUT_SHEETS = [
  { cabang: 'Cabang Praya', sheet: 'INPUT_PRAYA', code: 'PRY' },
  { cabang: 'Cabang Pujut', sheet: 'INPUT_PUJUT', code: 'PJT' },
  { cabang: 'Cabang Jonggat', sheet: 'INPUT_JONGGAT', code: 'JGT' },
  { cabang: 'Cabang Kopang', sheet: 'INPUT_KOPANG', code: 'KPG' },
  { cabang: 'Cabang Janapria', sheet: 'INPUT_JANAPRIA', code: 'JNP' },
  { cabang: 'Cabang Batukliang', sheet: 'INPUT_BATUKLIANG', code: 'BTK' },
  { cabang: 'Cabang Batukliang Utara', sheet: 'INPUT_BATUKLIANG_UTARA', code: 'BKU' },
  { cabang: 'Cabang Pringgarata', sheet: 'INPUT_PRINGGARATA', code: 'PGR' },
  { cabang: 'Cabang Praya Barat', sheet: 'INPUT_PRAYA_BARAT', code: 'PRB' },
  { cabang: 'Cabang Praya Barat Daya', sheet: 'INPUT_PRAYA_BARAT_DAYA', code: 'PBD' },
  { cabang: 'Cabang Praya Timur', sheet: 'INPUT_PRAYA_TIMUR', code: 'PRT' },
  { cabang: 'Cabang Praya Tengah', sheet: 'INPUT_PRAYA_TENGAH', code: 'PTE' }
];

var CABANG_INPUT_SHEETS = [];


// ============================================================
// MENU CUSTOM
// ============================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // BUGFIX V11.10.3: staf sering ketik aduan LANGSUNG di sheet CABANG_* (mis.
  // CABANG_Praya), bukan lewat WhatsApp/dashboard. Jalur onEdit() untuk sheet
  // ini TIDAK PERNAH memanggil pemaksaan format Plain Text ('@') pada kolom
  // No Pelanggan -- fungsi itu ('ensureNoPelangganColumnHeader_') sebelumnya
  // HANYA jalan lewat menu manual atau saat sheet pertama kali dibuat. Kalau
  // kolomnya sempat balik ke format "Automatic" (mis. sheet lama sebelum fix
  // ini ada), setiap staf ketik No Pelanggan berawalan 0 langsung ke sheet,
  // nolnya hilang SAAT ITU JUGA -- sebelum skrip apa pun sempat jalan, dan
  // tidak bisa diperbaiki lagi lewat kode setelahnya. Satu-satunya cara efektif
  // adalah PENCEGAHAN: paksa ulang format kolom setiap kali spreadsheet
  // dibuka, sebelum staf mulai mengetik hari itu.
  try { ensureNoPelangganColumnHeader_(true); } catch (eNoPelOnOpen) {}

  var whatsappMenu = ui.createMenu('📲 WhatsApp')
    .addItem('🔑 Simpan Konfigurasi API', 'setWhatsAppApiConfig')
    .addItem('Simpan API Cek Tagihan', 'setBillingApiConfig')
    .addItem('Tes API Cek Tagihan', 'testBillingApiByNoPelanggan')
    .addItem('🕒 Atur Jam Kerja Admin', 'setBusinessHoursConfig')
    .addItem('🧪 Tes Jam Kerja Admin', 'testBusinessHoursMessage')
    .addItem('🧪 Tes Kirim Pesan', 'testKiriminSendMessage')
    .addItem('🧪 Tes List Menu', 'testKiriminInteractiveMenu')
    .addSeparator()
    .addItem('📢 Setup Sheet Pengumuman', 'setupPengumumanSheet')
    .addItem('📢 Buka Sheet Pengumuman', 'openPengumumanSheet')
    .addSeparator()
    .addItem('🔔 Aktifkan Notif Status Pelanggan', 'installStatusNotificationTrigger')
    .addItem('⚙️ Atur Batas Aduan Aktif', 'setMaxActiveAduanPerPhone')
    .addItem('🧪 Cek Aduan Aktif by No WA', 'cekAduanAktifByPhone')
    .addItem('🧪 Tes Notif Status Pelanggan', 'testCustomerStatusNotificationById')
    .addItem('🧪 Cek Window 24 Jam by ID', 'cekWindow24JamPelangganById')
    .addSeparator()
    .addItem('📑 Buka Log WhatsApp', 'openWhatsAppLog')
    .addItem('🗄️ Arsipkan LOG WhatsApp >30 Hari', 'archiveWhatsAppLogOlderThan30Days')
    .addItem('🧹 Cek Ringkasan LOG WhatsApp Lama', 'previewOldWhatsAppLogSummary')
    .addItem('🔔 Buka Log Notif Status', 'openStatusNotifLogSheet')
    .addItem('🧾 Buka Session WhatsApp', 'openWhatsAppSessionSheet')
    .addSeparator()
    .addItem('⏱️ Aktifkan Reminder Session', 'installWhatsAppSessionReminderTrigger')
    .addItem('🛑 Matikan Reminder Session', 'uninstallWhatsAppSessionReminderTrigger');

  var petugasMenu = ui.createMenu('👷 Petugas')
    .addItem('Setup Petugas Cabang', 'setupPetugasCabangSheet')
    .addItem('Buka Petugas Cabang', 'openPetugasCabangSheet')
    .addSeparator()
    .addItem('Setup Dokumentasi Aduan', 'setupDokumentasiAduanSheet')
    .addItem('Buka Dokumentasi Aduan', 'openDokumentasiAduanSheet')
    .addItem('Buka Log Status Aduan', 'openLogStatusAduanSheet')
    .addSeparator()
    .addItem('🔎 Cek Petugas Cabang Aktif', 'cekPetugasCabangAktif')
    .addItem('🧪 Tes Notifikasi Petugas', 'testDirectNotifikasiPetugasByCabang');

  var aiMenu = ui.createMenu('🤖 Asisten Virtual')
    .addItem('🔑 Masukkan API AI Bersama', 'setSharedAiConfig')
    .addItem('🧪 Tes API AI Bersama', 'testSharedAiConfig')
    .addSeparator()
    .addItem('✅ Aktifkan AI Pelanggan & Direksi', 'enableSharedAiAll')
    .addItem('🛑 Matikan AI Pelanggan', 'disableCustomerAiAssistant')
    .addItem('🛑 Matikan AI Direksi', 'disableDireksiAiAssistant');

  var direksiMenu = ui.createMenu('🏢 Direksi')
    .addItem('Setup Akses Direksi', 'setupDireksiAccessSheet')
    .addItem('Buka PETUGAS_CABANG', 'openPetugasCabangSheet')
    .addSeparator()
    .addItem('🤖 Masukkan API AI Bersama', 'setSharedAiConfig')
    .addItem('🧪 Tes Ringkasan Direksi', 'testDireksiRingkasanLayanan');

  var cabangMenu = ui.createMenu('🏢 Cabang')
    .addItem('Setup Sheet Aduan Cabang', 'setupCabangMirrorSheets')
    .addItem('Refresh Dropdown Status/Unit Cabang', 'refreshAllCabangMirrorDropdowns')
    .addItem('Sinkron ADUAN ke Sheet Cabang', 'syncAllAduanToCabangMirror')
    .addItem('Bersihkan Sheet Cabang dari ADUAN', 'cleanupCabangMirrorRowsMissingInAduan')
    .addItem('Aktifkan Sinkron Hapus ADUAN', 'enableAduanDeleteMirrorSyncTrigger')
    .addItem('Sinkron Manual Sheet Cabang ke ADUAN', 'syncAllCabangInputs')
    .addItem('Hapus Sheet INPUT Lama', 'deleteLegacyInputCabangSheets')
    .addItem('Perbaiki Cabang PBD dari LNY', 'fixPrayaBaratDayaFromLny')
    .addItem('🧪 Tes Copy Aduan ke Sheet Cabang', 'testMirrorAduanToCabangSheet');

  var perbaikanMenu = ui.createMenu('🛠️ Perbaikan Data')
    .addItem('Refresh Dropdown & Warna ADUAN', 'refreshMainAduanDropdownsAndColors')
    .addItem('Perbaiki Share Location Lama', 'fixExistingShareLocationRows')
    .addItem('Perbaiki Prioritas / Status / Unit', 'fixExistingPriorityStatusUnitRows')
    .addItem('Update Kolom No Pelanggan', 'updateKolomNoPelanggan')
    .addSeparator()
    .addItem('Reset Fast Mode / Cache', 'resetSiagaFastCache')
    .addItem('Rebuild Counter ID Hari Ini', 'rebuildAduanIdCounterToday')
    .addItem('Bersihkan Baris Kosong', 'bersihkanBarisKosong')
    .addItem('Rapikan Sheet', 'formatSheet');

  var arsipMenu = ui.createMenu('🗄️ Arsip')
    .addItem('Bersihkan Pilih Bulan (Kecuali Baru/Proses)', 'archiveChooseMonthExceptNewProcess')
    .addItem('Bersihkan Bulan Lalu (Kecuali Baru/Proses)', 'archiveLastMonthExceptNewProcess')
    .addItem('Bersihkan Semua Bulan Lama (Kecuali Baru/Proses)', 'archiveAllOldExceptNewProcess')
    .addSeparator()
    .addItem('Arsip Dokumentasi Bulan Lalu', 'archiveDokumentasiLastMonth')
    .addItem('Arsip Dokumentasi Semua yang Tidak Aktif', 'archiveDokumentasiNonActive')
    .addSeparator()
    .addItem('Arsipkan Pilih Bulan', 'archiveChooseMonth')
    .addItem('Arsipkan Bulan Lalu', 'archiveLastMonth')
    .addItem('Arsipkan Semua Selesai/Batal', 'archiveAllClosedData')
    .addItem('Arsipkan Selesai/Batal per No WA', 'archiveClosedDataByPhone')
    .addSeparator()
    .addItem('Buka Log Arsip', 'openArchiveLog');

  var lanjutanMenu = ui.createMenu('⚙️ Lanjutan')
    .addItem('Tambah Data Contoh', 'addSampleData')
    .addItem('Urutkan Data', 'sortSheet')
    .addSeparator()
    .addItem('Aktifkan Sinkron Otomatis Sheet Cabang', 'enableAutoSyncCabang1Minute')
    .addItem('Matikan Sinkron Otomatis Sheet Cabang', 'disableAutoSyncCabangTriggers')
    .addItem('Buka Log Manual Cabang', 'openInputCabangLog')
    .addSeparator()
    .addItem('Setup WhatsApp Tracking', 'setupWhatsAppTracking')
    .addItem('Setup Menu Chat WhatsApp', 'setupWhatsAppMenuBot')
    .addItem('Tes Balasan Status WhatsApp', 'testWhatsAppStatusReply')
    .addItem('Tes Menu WhatsApp', 'testWhatsAppMenuReply')
    .addItem('Tes Cari Customer by Phone', 'testKiriminResolveCustomerByPhone')
    .addItem('Tes Notifikasi Petugas by ID', 'testNotifikasiPetugasCabang')
    .addSeparator()
    .addItem('Buka Log Export PDF', 'openExportLogSheet')
    .addItem('Arsipkan Semua Data Lama', 'archiveAllOldClosedData');

  ui.createMenu('⚡ SIAGA TIARA')
    .addItem('🚀 Setup Spreadsheet Baru Lengkap', 'setupSpreadsheetBaruSiagaTiara')
    .addItem('🔧 Setup Aman', 'setupSystem')
    .addItem('🖥️ Buka Dashboard', 'openDashboard')
    .addSeparator()
    .addSubMenu(whatsappMenu)
    .addSubMenu(petugasMenu)
    .addSubMenu(aiMenu)
    .addSubMenu(direksiMenu)
    .addSubMenu(cabangMenu)
    .addSubMenu(perbaikanMenu)
    .addSubMenu(arsipMenu)
    .addSeparator()
    .addSubMenu(lanjutanMenu)
    .addToUi();
}



// ============================================================
// V10.9.4 - NO PELANGGAN / RIWAYAT ADUAN
// ============================================================



// ============================================================
// V10.9.6 - FAST LOADING / PERFORMANCE HOTFIX
// ============================================================

// V10.9.12 - Runtime property cache.
// WAJIB ADA karena V10.9.11 memakai getRuntimeProp_() dan _interactiveMenuFlag.
var _runtimePropsCache = null;
var _interactiveMenuFlag = null;

function getRuntimeProp_(key) {
  key = String(key || '').trim();
  if (!key) return '';

  if (_runtimePropsCache === null) {
    try {
      _runtimePropsCache = PropertiesService.getScriptProperties().getProperties() || {};
    } catch (e) {
      _runtimePropsCache = {};
    }
  }

  return _runtimePropsCache[key] || '';
}

function clearRuntimePropCache_() {
  _runtimePropsCache = null;
  _interactiveMenuFlag = null;
}


function isSiagaFastMode_() {
  var props = PropertiesService.getScriptProperties();
  return String(props.getProperty('SIAGA_FAST_MODE') || 'YA').toUpperCase() !== 'TIDAK';
}

function getRuntimeCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (e) {
    return null;
  }
}

function getSiagaCacheVersion_() {
  var v = '';
  try { v = String(getRuntimeProp_('SIAGA_CACHE_VERSION') || '').trim(); } catch(e) { v = ''; }
  if (!v) {
    v = '1';
    try {
      PropertiesService.getScriptProperties().setProperty('SIAGA_CACHE_VERSION', v);
      clearRuntimePropCache_();
    } catch(e2) {}
  }
  return v;
}

function buildSiagaCacheKey_(key) {
  key = String(key || '').trim();
  if (!key) return '';
  return 'SIAGA_' + getSiagaCacheVersion_() + '_' + key;
}

function cacheGet_(key) {
  var cache = getRuntimeCache_();
  var finalKey = buildSiagaCacheKey_(key);
  if (!cache || !finalKey) return '';
  try { return cache.get(finalKey) || ''; } catch(e) { return ''; }
}

function safeCacheExpirationSeconds_(seconds) {
  var n = Number(seconds || 21600);
  if (!n || isNaN(n) || n < 1) n = 21600;
  // Apps Script CacheService aman dipakai dengan TTL maksimal 21600 detik.
  // Jika ada kode lama mengirim 86400, tetap dipotong agar cache tidak gagal.
  return Math.min(n, 21600);
}

function cachePut_(key, value, seconds) {
  var cache = getRuntimeCache_();
  var finalKey = buildSiagaCacheKey_(key);
  if (!cache || !finalKey) return;
  try { cache.put(finalKey, String(value || '1'), safeCacheExpirationSeconds_(seconds)); } catch(e) {}
}

function cacheRemove_(key) {
  var cache = getRuntimeCache_();
  var finalKey = buildSiagaCacheKey_(key);
  if (!cache || !finalKey) return;
  try { cache.remove(finalKey); } catch(e) {}
}

// V10.9.101 - refresh cache akses petugas/direksi setelah admin mengubah nomor/role dari Index.
function bumpSiagaCacheVersion_(reason) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SIAGA_CACHE_VERSION', String(new Date().getTime()));
    props.setProperty('SIAGA_CACHE_VERSION_REASON', String(reason || 'manual_refresh').substring(0, 120));
    clearRuntimePropCache_();
  } catch(e) {}
}

function invalidatePetugasAccessCache_(reason, phones) {
  try {
    cacheRemove_('PETUGAS_ROWS');
  } catch(e0) {}

  (phones || []).forEach(function(phone) {
    var p = normalizePhone_(phone || '');
    if (!p) return;
    try { cacheRemove_('PETUGAS_BY_PHONE_' + p); } catch(e1) {}
    try { cacheRemove_('DIREKSI_BY_PHONE_' + p); } catch(e2) {}
    try { clearWhatsAppSession_(p); } catch(e3) {}
  });

  // CacheService tidak mendukung hapus by prefix. Bump versi cache agar cache PETUGAS_BY_PHONE/DIREKSI_BY_PHONE lama tidak dipakai lagi.
  bumpSiagaCacheVersion_(reason || 'petugas_access_updated');
}

function getSheetRuntimeKey_(prefix, sheet) {
  try {
    return prefix + '_' + String(sheet.getSheetId());
  } catch(e) {
    return prefix + '_default';
  }
}

function ensureRuntimeHeadersFast_(sheet) {
  if (!sheet) return;

  // BUGFIX V11.10.1: format Plain Text ('@') untuk kolom No Pelanggan sekarang
  // SELALU dijalankan (operasinya ringan), TIDAK lagi ikut di-skip oleh cache
  // "SIAGA_RUNTIME_HEADERS_V1096" di bawah. Sebelumnya, jika cache ini pernah
  // ke-set 'true' oleh versi kode LAMA (sebelum fix No Pelanggan ini ada),
  // maka setiap sheet ADUAN dibuka lagi dalam 6 jam ke depan, blok fix ini
  // tidak pernah tereksekusi -- nol di depan No Pelanggan terus hilang walau
  // kode sudah diperbarui, sampai cache kedaluwarsa/di-reset manual. Ini
  // persis skenario "sudah update tapi bug belum teratasi".
  try {
    var noPelangganCol = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
    sheet.getRange(2, noPelangganCol, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('@');
  } catch (eFormatNoPel) {}

  var key = getSheetRuntimeKey_('SIAGA_RUNTIME_HEADERS_V1096', sheet);
  if (isSiagaFastMode_() && cacheGet_(key)) return;

  try {
    var noPelangganCol2 = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
    var headerNoPel = String(sheet.getRange(1, noPelangganCol2).getValue() || '').trim();
    if (headerNoPel !== 'No Pelanggan') sheet.getRange(1, noPelangganCol2).setValue('No Pelanggan');

    var headers = [
      { col: CONFIG.COL.LATITUDE || 17, name: 'Latitude' },
      { col: CONFIG.COL.LONGITUDE || 18, name: 'Longitude' },
      { col: CONFIG.COL.LINK_MAPS || 19, name: 'Link Maps' },
      { col: CONFIG.COL.LOKASI_DETAIL || 20, name: 'Lokasi Detail' }
    ];

    headers.forEach(function(h) {
      var current = String(sheet.getRange(1, h.col).getValue() || '').trim();
      if (!current) sheet.getRange(1, h.col).setValue(h.name);
    });

    cachePut_(key, '1', 21600);
  } catch(e) {}
}

function truncateForLog_(value, maxLength) {
  value = String(value || '');
  maxLength = Number(maxLength || 1200);
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '... [dipotong agar webhook lebih cepat]';
}

function resetSiagaFastCache() {
  var ui = SpreadsheetApp.getUi();

  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SIAGA_FAST_MODE', 'YA');
    props.setProperty('SIAGA_CACHE_VERSION', String(new Date().getTime()));
    clearRuntimePropCache_();
  } catch(e) {}

  ui.alert(
    '✅ Fast Mode / Cache di-reset',
    'Cache runtime sudah diganti versi, jadi data lama tidak dipakai lagi.\n\n' +
    'Gunakan ini kalau setelah update kode masih terasa membaca data lama.',
    ui.ButtonSet.OK
  );
}

function rebuildAduanIdCounterToday() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) {
    ui.alert('Belum ada data ADUAN.');
    return;
  }

  var today = new Date();
  var datePart = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var props = PropertiesService.getScriptProperties();
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var maxByCode = {};

  values.forEach(function(row) {
    var id = String(row[0] || '').trim();
    var m = id.match(/^([A-Z]+)-(\d{8})-(\d{4,})$/);
    if (!m || m[2] !== datePart) return;
    var code = m[1];
    var num = Number(m[3] || 0);
    if (!maxByCode[code] || num > maxByCode[code]) maxByCode[code] = num;
  });

  Object.keys(maxByCode).forEach(function(code) {
    props.setProperty('SEQ_' + code + '_' + datePart, String(maxByCode[code]));
  });

  ui.alert(
    '✅ Counter ID diperbarui',
    'Counter ID hari ini sudah disesuaikan dari sheet ADUAN.\n\n' + JSON.stringify(maxByCode, null, 2),
    ui.ButtonSet.OK
  );
}


function ensureNoPelangganColumnHeader_(force) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) return;

  // BUGFIX V11.10.1: sebelumnya, jika cache "fast mode" masih aktif (sampai 6 jam),
  // fungsi ini langsung berhenti TANPA memformat ulang kolom No Pelanggan ke
  // Plain Text ('@') -- padahal tombol menu "Update Kolom No Pelanggan" tetap
  // menampilkan alert "berhasil". Sekarang parameter force=true (dipakai saat
  // dipanggil dari menu manual & saat sheet ADUAN baru dibuat) akan selalu
  // melewati cache supaya perbaikan format benar-benar dijalankan.
  var __fastKey = getSheetRuntimeKey_('NOPEL_SETUP_FAST_V1096', sh);
  if (!force && isSiagaFastMode_() && cacheGet_(__fastKey)) return;

  var col = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
  sh.getRange(1, col).setValue('No Pelanggan');
  try { sh.setColumnWidth(col, 130); } catch(e) {}

  // FIX: paksa juga format Plain Text ('@') di sini, supaya tombol menu
  // "Update Kolom No Pelanggan" bisa dipakai sebagai perbaikan cepat kapan
  // saja tanpa harus menunggu/klik "Reset Fast Mode / Cache" dulu.
  try { sh.getRange(2, col, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch(eFormatMain) {}

  // Mirror cabang juga ikut dirapikan jika sheet sudah ada.
  Object.keys(CABANG_CODE || {}).forEach(function(cabang) {
    var sheetName = getCabangMirrorSheetName_(cabang);
    var csh = ss.getSheetByName(sheetName);
    if (csh) {
      csh.getRange(1, col).setValue('No Pelanggan');
      try { csh.setColumnWidth(col, 130); } catch(e) {}
      try { csh.getRange(2, col, Math.max(1, csh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch(eFormatMirror) {}
    }
  });
  cachePut_(__fastKey, '1', 21600);

}

function updateKolomNoPelanggan() {
  var ui = SpreadsheetApp.getUi();
  ensureNoPelangganColumnHeader_(true); // force = true, jangan pernah di-skip oleh cache
  ui.alert(
    '✅ Kolom diperbarui',
    'Kolom ke-5 pada ADUAN dan sheet cabang sudah diganti menjadi: No Pelanggan.\n\n' +
    'Format kolom juga dipaksa jadi Plain Text, supaya No Pelanggan yang berawalan 0 tidak hilang nolnya untuk aduan BARU ke depannya.\n\n' +
    'Data lama tidak dihapus dan posisi kolom tidak digeser. Catatan: baris lama yang nolnya sudah terlanjur hilang sebelum ini TIDAK bisa dipulihkan otomatis.',
    ui.ButtonSet.OK
  );
}

function getNoPelangganFromAduan_(d) {
  d = d || {};
  return String(d.noPelanggan || d.desa || '').trim();
}


function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    setupAduanSheet(ss);
    setupSettingsSheet(ss);
    setupExportLogSheet(ss);
    setupExportDetailSheet(ss);
    setupArchiveLogSheet(ss);
    setupInputCabangLogSheet(ss);
    setupWhatsAppLogSheet(ss);
    setupWhatsAppSessionSheet(ss);
    setupPetugasCabangSheet(ss);
    setupDokumentasiAduanSheet_(ss);
    setupLogStatusAduanSheet_(ss);
    setupPenugasanAduanSheet_(ss);
    setupCabangMirrorSheets(ss);
    ensureNoPelangganColumnHeader_(true);

    ui.alert(
      '✅ Setup Berhasil!',
      'Setup aman selesai. Data lama tidak dihapus. Sheet ADUAN, SETTINGS, WhatsApp, petugas, dan kolom lokasi telah dicek.\n\n' +
      'Langkah selanjutnya:\n' +
      '1. Klik "Deploy" → "New Deployment" di Apps Script\n' +
      '2. Pilih type "Web App"\n' +
      '3. Set Execute as: Me, Who has access: Anyone\n' +
      '4. Copy URL deploy ke sheet SETTINGS\n' +
      '5. Gunakan menu "Buka Dashboard" untuk membuka dashboard',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('❌ Error: ' + e.message);
  }
}


/**
 * V10.9.51
 * Setup untuk spreadsheet baru / spreadsheet berbeda.
 *
 * Tujuan:
 * - Membuat semua sheet utama SIAGA TIARA dalam sekali klik.
 * - Aman untuk data lama: tidak menghapus ADUAN, CABANG_*, log, dokumentasi, atau arsip.
 * - SETTINGS dibuat/dirapikan, tapi nilai API yang sudah ada tidak dipaksa kosong.
 * - Trigger dasar dipasang ulang: notifikasi status dan sinkron cabang otomatis.
 *
 * Cara pakai:
 * 1. Buka spreadsheet tujuan.
 * 2. Extensions > Apps Script, tempel Code.gs ini.
 * 3. Reload spreadsheet.
 * 4. Menu ⚡ SIAGA TIARA > 🚀 Setup Spreadsheet Baru Lengkap.
 */
function setupSpreadsheetBaruSiagaTiara() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var confirm = ui.alert(
    'Setup Spreadsheet Baru SIAGA TIARA',
    'Fitur ini akan membuat/merapikan semua sheet utama SIAGA TIARA di spreadsheet ini.\n\n' +
    'Data yang sudah ada tidak dihapus. Namun untuk spreadsheet baru, ini akan menyiapkan struktur lengkap: ADUAN, CABANG_*, petugas, log, dokumentasi, pengumuman, arsip, export, dan session.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var report = [];
  var failed = [];

  function step(label, fn) {
    try {
      fn();
      report.push('✅ ' + label);
    } catch (e) {
      failed.push('❌ ' + label + ': ' + (e && e.message ? e.message : e));
    }
  }

  step('Sheet ADUAN dan kolom utama', function() {
    setupAduanSheet(ss);
    ensureNoPelangganColumnHeader_(true);
  });

  step('Sheet SETTINGS aman', function() {
    setupSettingsSheetSafe_(ss);
  });

  step('Log Export PDF dan Detail Verify', function() {
    setupExportLogSheet(ss);
    setupExportDetailSheet(ss);
  });

  step('Log Arsip dan Log Manual Cabang', function() {
    setupArchiveLogSheet(ss);
    setupInputCabangLogSheet(ss);
  });

  step('Log WhatsApp dan Session WhatsApp', function() {
    setupWhatsAppLogSheet(ss);
    setupWhatsAppSessionSheet(ss);
    setupStatusNotifLogSheet_(ss);
  });

  step('Sheet Petugas Cabang', function() {
    setupPetugasCabangSheet(ss);
  });

  step('Akses Direksi di PETUGAS_CABANG', function() {
    setupDireksiAccessSheet(ss);
  });


  step('Sheet Dokumentasi dan Log Status Aduan', function() {
    setupDokumentasiAduanSheet_(ss);
    setupLogStatusAduanSheet_(ss);
  });

  step('Sheet Pengumuman', function() {
    setupPengumumanSheetSilent_(ss);
  });

  step('Sheet CABANG_* untuk semua cabang', function() {
    (CONFIG.CABANG || []).forEach(function(cabang) {
      setupSingleCabangMirrorSheet_(ss, cabang);
    });
  });

  step('Dropdown Status/Prioritas/Unit/Jenis Gangguan', function() {
    (CONFIG.CABANG || []).forEach(function(cabang) {
      var sh = setupSingleCabangMirrorSheet_(ss, cabang);
      if (sh && typeof applyCabangMirrorDropdowns_ === 'function') {
        applyCabangMirrorDropdowns_(sh);
      }
    });

    var main = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (main && typeof addDropdownValidations === 'function') addDropdownValidations(main);
    if (main && typeof addConditionalFormatting === 'function') addConditionalFormatting(main);
  });

  step('Trigger notifikasi status pelanggan', function() {
    installStatusNotificationTriggerSilent_(ss);
  });

  step('Trigger sinkron otomatis sheet cabang', function() {
    installAutoSyncCabangTriggerSilent_();
  });

  step('Trigger sinkron hapus ADUAN ke sheet cabang', function() {
    installAduanDeleteMirrorSyncTrigger_();
  });

  step('Fast Mode dan cache sistem', function() {
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('WHATSAPP_REPLY_MODE')) props.setProperty('WHATSAPP_REPLY_MODE', CONFIG.WHATSAPP_DEFAULT_REPLY_MODE || 'AUTO');
    if (!props.getProperty('WHATSAPP_USE_INTERACTIVE_MENU')) props.setProperty('WHATSAPP_USE_INTERACTIVE_MENU', 'YA');
    props.setProperty('SIAGA_FAST_MODE', 'YA');
    props.setProperty('SIAGA_CACHE_VERSION', String(new Date().getTime()));
    if (typeof clearRuntimePropCache_ === 'function') clearRuntimePropCache_();
  });

  // Rapikan posisi sheet utama agar mudah dibaca.
  step('Urutan sheet utama', function() {
    reorderSiagaSheets_(ss);
  });

  var msg = [
    'Setup spreadsheet selesai.',
    '',
    report.join('\n')
  ];

  if (failed.length) {
    msg.push('');
    msg.push('Ada bagian yang perlu dicek:');
    msg.push(failed.join('\n'));
  }

  msg.push('');
  msg.push('Langkah berikutnya:');
  msg.push('1. Isi nomor admin/petugas di sheet PETUGAS_CABANG.');
  msg.push('2. Jalankan menu WhatsApp > Simpan Konfigurasi API.');
  msg.push('3. Deploy Apps Script sebagai Web App versi baru.');
  msg.push('4. Pasang URL /exec ke webhook Kirimin.ID.');
  msg.push('5. Tes chat dari nomor admin dan pelanggan.');

  ui.alert(
    failed.length ? '⚠️ Setup Selesai dengan Catatan' : '✅ Setup Lengkap Berhasil',
    msg.join('\n'),
    ui.ButtonSet.OK
  );

  try {
    var mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (mainSheet) ss.setActiveSheet(mainSheet);
  } catch(e) {}
}

function setupSettingsSheetSafe_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);

  var existing = {};
  var last = safeGetLastRow_(sheet);
  if (last >= 1) {
    var vals = sheet.getRange(1, 1, last, Math.min(2, Math.max(sheet.getLastColumn(), 2))).getValues();
    vals.forEach(function(r) {
      var key = String(r[0] || '').trim();
      if (key) existing[key] = r[1];
    });
  }

  var rows = [
    ['SIAGA TIARA - Pengaturan Sistem', ''],
    ['', ''],
    ['Parameter', 'Nilai'],
    ['URL Dashboard', existing['URL Dashboard'] || ''],
    ['Nama Sistem', existing['Nama Sistem'] || 'SIAGA TIARA'],
    ['Instansi', existing['Instansi'] || 'PERUMDAM Tirta Ardhia Rinjani'],
    ['Versi', '10.9.51'],
    ['Dibuat', existing['Dibuat'] || new Date().toLocaleDateString('id-ID')],
    ['Catatan', 'Spreadsheet ini sudah disiapkan melalui Setup Spreadsheet Baru Lengkap.']
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor('#1e3a5f');
  sheet.getRange(3, 1, 1, 2).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 480);
  try { sheet.setFrozenRows(3); } catch(e) {}
  return sheet;
}

function setupPengumumanSheetSilent_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = ['STATUS', 'JUDUL', 'ISI', 'MULAI', 'SELESAI', 'URUTAN'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 520);
  sh.setColumnWidth(4, 140);
  sh.setColumnWidth(5, 140);
  sh.setColumnWidth(6, 80);

  if (safeGetLastRow_(sh) < 2) {
    sh.getRange(2, 1, 1, 6).setValues([[
      'NONAKTIF',
      'Contoh Pengumuman',
      'Isi pengumuman ditulis di sini. Ubah STATUS menjadi AKTIF agar tampil sebelum menu utama.',
      '',
      '',
      1
    ]]);
  }

  try {
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['AKTIF', 'NONAKTIF'], true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(statusRule);
  } catch(e) {}

  return sh;
}

function installStatusNotificationTriggerSilent_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  setupStatusNotifLogSheet_(ss);

  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'handleAduanStatusEditTrigger') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('handleAduanStatusEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
}

function installAutoSyncCabangTriggerSilent_() {
  var minutes = 5;
  try {
    if (typeof getAutoSyncCabangIntervalMinutes_ === 'function') {
      minutes = getAutoSyncCabangIntervalMinutes_();
    } else if (CONFIG && CONFIG.SYNC_INPUT_INTERVAL_MINUTES) {
      minutes = Number(CONFIG.SYNC_INPUT_INTERVAL_MINUTES) || 5;
    }
  } catch(e) {
    minutes = 5;
  }

  // Apps Script hanya menerima interval tertentu untuk everyMinutes.
  if ([1, 5, 10, 15, 30].indexOf(minutes) === -1) minutes = 5;

  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'autoSyncCabangInputsEveryMinute') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('autoSyncCabangInputsEveryMinute')
    .timeBased()
    .everyMinutes(minutes)
    .create();
}

function reorderSiagaSheets_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var order = [
    CONFIG.SHEET_NAME,
    'SETTINGS',
    'PENGUMUMAN',
    'PETUGAS_CABANG',
    'DOKUMENTASI_ADUAN',
    'LOG_STATUS_ADUAN',
    'LOG_WHATSAPP',
    'LOG_NOTIF_STATUS',
    'SESSION_WHATSAPP'
  ];

  (CONFIG.CABANG || []).forEach(function(cabang) {
    var name = getCabangMirrorSheetName_(cabang);
    if (name) order.push(name);
  });

  order.push('LOG_INPUT_CABANG');
  order.push('LOG_EXPORT_PDF');
  order.push('EXPORT_DETAIL');
  order.push('LOG_ARSIP');

  var index = 1;
  order.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(index);
    index++;
  });
}


function setupAduanSheet(ss) {
  // SAFE SETUP V9.6:
  // Jangan pernah clear sheet ADUAN karena bisa menghapus data operasional.
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  var headers = [
    'ID Aduan', 'Waktu Masuk', 'Cabang', 'Wilayah/Kecamatan',
    'No Pelanggan', 'Nama Pelanggan', 'No HP', 'Jenis Gangguan', 'Prioritas',
    'Status', 'Unit/Petugas', 'Keterangan Aduan', 'Catatan Tindak Lanjut',
    'Waktu Selesai', 'SLA Respons Jam', 'Updated At',
    'Latitude', 'Longitude', 'Link Maps', 'Lokasi Detail'
  ];

  // Pastikan kolom cukup.
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  // Set header saja, data baris 2 dst tetap aman.
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  headerRange
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  var colWidths = [130, 140, 140, 130, 130, 140, 120, 120, 80, 80, 100, 200, 200, 140, 70, 130, 100, 100, 220, 220];
  for (var i = 0; i < colWidths.length; i++) {
    try { sheet.setColumnWidth(i + 1, colWidths[i]); } catch(e) {}
  }

  // Sembunyikan kolom teknis (SLA Jam & Updated At)
  try {
    sheet.showColumns(1, Math.min(sheet.getMaxColumns(), headers.length));
    sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);
  } catch(e) {}

  // Aktifkan ulang filter tanpa menghapus data.
  try {
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, Math.max(safeGetLastRow_(sheet), 2), 14).createFilter();
  } catch(e) {}

  // Dropdown & formatting: jangan dipaksa jika sheet sedang memakai Google Sheets Table/typed columns.
  // Typed columns dapat menolak operasi Apps Script seperti setDataValidation/setValue tertentu.
  try {
    if (typeof addDropdownValidations === 'function') addDropdownValidations(sheet);
  } catch(e) {}
  try {
    if (typeof addConditionalFormatting === 'function') addConditionalFormatting(sheet);
  } catch(e) {}

  // Pastikan kolom lokasi tersedia tanpa clear data.
  setupLocationColumns_(sheet);

  // BUGFIX V11.10.1: baris ini sebelumnya diletakkan SETELAH "return sheet;"
  // sehingga TIDAK PERNAH dieksekusi (dead code). Akibatnya kolom "No Pelanggan"
  // tidak pernah dipaksa ke format Plain Text ('@') saat sheet ADUAN dibuat
  // otomatis (mis. saat aduan WhatsApp pertama masuk dan sheet belum ada),
  // sehingga Google Sheets mengubah No Pelanggan yang berawalan angka 0
  // menjadi angka biasa dan nol di depan hilang -> data tidak muncul/cocok
  // saat dicari di dashboard.
  ensureNoPelangganColumnHeader_(true);

  ss.setActiveSheet(sheet);
  return sheet;
}


function setupSettingsSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    ss.setActiveSheet(ss.getSheetByName(CONFIG.SHEET_NAME));
  }

  sheet.clear();

  var settingsData = [
    ['SIAGA TIARA - Pengaturan Sistem', ''],
    ['', ''],
    ['Parameter', 'Nilai'],
    ['URL Dashboard', ''],
    ['Nama Sistem', 'SIAGA TIARA'],
    ['Instansi', 'PERUMDAM Tirta Ardhia Rinjani'],
    ['Versi', '1.0.0'],
    ['Dibuat', new Date().toLocaleDateString('id-ID')]
  ];

  sheet.getRange(1, 1, settingsData.length, 2).setValues(settingsData);

  // Style
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor('#1e3a5f');
  sheet.getRange(3, 1, 1, 2).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);
}


function setupExportLogSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.EXPORT_LOG_SHEET);
  }

  var headers = [
    'Report ID',
    'Tanggal Export',
    'Periode',
    'Cabang',
    'Wilayah',
    'Total Aduan',
    'Aduan Aktif',
    'Selesai',
    'Lewat SLA',
    'Verification URL',
    'PDF File Name',
    'Aduan IDs'
  ];

  // Jangan clear isi log, supaya data verifikasi lama tidak hilang.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function setupExportDetailSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.EXPORT_DETAIL_SHEET);
  }

  var headers = [
    'Report ID',
    'No',
    'ID Aduan',
    'Waktu',
    'Cabang',
    'Wilayah',
    'Pelanggan',
    'No HP',
    'Jenis',
    'Sumber Aduan',
    'Prioritas',
    'Status',
    'Unit',
    'SLA',
    'Keterangan'
  ];

  // Jangan clear isi detail, supaya halaman verify selalu membaca snapshot saat PDF dibuat.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function openExportLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupExportLogSheet(ss);
  setupExportDetailSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET));
}


// ============================================================
// onEdit TRIGGER - Otomasi data
// ============================================================
// ============================================================
// [REMOVED V10.9.44] Duplikasi onEdit lama dihapus.
// onEdit aktif hanya satu, yaitu versi bawah yang sudah handle:
// - ADUAN utama
// - CABANG_* mirror
// - input manual cabang
// - sync dua arah ADUAN <-> CABANG
// ============================================================

// ============================================================
// GENERATE ID ADUAN
// ============================================================
function generateId(sheet) {
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = 'ADU-' + dateStr + '-';

  var lastRow = sheet.getLastRow();
  var maxNum = 0;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, CONFIG.COL.ID, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = row[0] ? String(row[0]) : '';
      if (id.startsWith(prefix)) {
        var num = parseInt(id.split('-')[3], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }

  var newNum = String(maxNum + 1).padStart(4, '0');
  return prefix + newNum;
}

// ============================================================
// WEB APP - doGet
// ============================================================
function doGet(e) {
  if (e && e.parameter && e.parameter.wa_ping) {
    return jsonOutput_({ success: true, app: CONFIG.APP_NAME, module: 'WHATSAPP_TRACKING', time: new Date().toISOString() });
  }

  if (e && e.parameter && e.parameter.track) {
    return jsonOutput_(getAduanTrackingResponse_(String(e.parameter.track || ''), String(e.parameter.phone || '')));
  }

  if (e && e.parameter && e.parameter.verify) {
    var template = HtmlService.createTemplateFromFile('Verify');
    template.report = getVerificationReport_(e.parameter.verify);

    return template.evaluate()
      .setTitle('Verifikasi Laporan - SIAGA TIARA')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SIAGA TIARA - Dashboard Monitoring')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}
