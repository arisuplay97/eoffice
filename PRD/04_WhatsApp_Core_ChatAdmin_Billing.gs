// ============================================================
// SIAGA TIARA V10.9.278 - HOTFIX CEK TAGIHAN / MODUL: 04_WhatsApp_Core_ChatAdmin_Billing.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================



// ============================================================
// WHATSAPP MENU BOT - LAYANAN PELANGGAN
// ============================================================
function setupWhatsAppMenuBot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  setupWhatsAppSessionSheet(ss);

  SpreadsheetApp.getUi().alert(
    '✅ Menu Chat WhatsApp siap',
    'Pelanggan bisa chat: halo / menu\n\n' +
    'Menu yang tersedia:\n' +
    '1. Buat aduan baru\n' +
    '2. Cek status aduan\n' +
    '3. Lihat aduan saya\n' +
    '4. Hubungi admin\n\n' +
    'Catatan: jika provider WhatsApp belum mendukung tombol/list message, sistem memakai balas angka.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupWhatsAppSessionSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.WHATSAPP_SESSION_SHEET);

  var __fastKey = sh ? getSheetRuntimeKey_('SESSION_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 5).setValues([[
      'No HP', 'State', 'Data JSON', 'Updated At', 'Catatan'
    ]]);
  }

  sh.getRange(1, 1, 1, 5)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 5);
  if (__fastKey) cachePut_(__fastKey, '1', 21600);

}

function openWhatsAppSessionSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppSessionSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET));
}


// ============================================================
// V10.9.49 - RATE LIMIT WHATSAPP ANTI SPAM
// ============================================================

function isRateLimitEnabled_() {
  return String(getSiagaRuntimeSetting_('RATE_LIMIT_ENABLED', CONFIG.RATE_LIMIT_ENABLED || 'YA')).toUpperCase() !== 'TIDAK';
}

function getRateLimitDateKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
}

function getRateLimitRole_(petugas) {
  if (!petugas) return 'CUSTOMER';
  if (petugas.isAdmin) return 'ADMIN';
  return 'PETUGAS';
}

function getRateLimitDailyLimit_(role) {
  role = String(role || 'CUSTOMER').toUpperCase();
  if (role === 'ADMIN') return Number(getSiagaRuntimeSetting_('RATE_LIMIT_ADMIN_DAILY', CONFIG.RATE_LIMIT_ADMIN_DAILY || 300));
  if (role === 'PETUGAS') return Number(getSiagaRuntimeSetting_('RATE_LIMIT_PETUGAS_DAILY', CONFIG.RATE_LIMIT_PETUGAS_DAILY || 150));
  return Number(getSiagaRuntimeSetting_('RATE_LIMIT_CUSTOMER_DAILY', CONFIG.RATE_LIMIT_CUSTOMER_DAILY || 50));
}

function checkWhatsAppRateLimit_(phone, petugas) {
  if (!isRateLimitEnabled_()) return { allowed: true };

  phone = normalizePhone_(phone || '');
  if (!phone) return { allowed: true };

  var role = getRateLimitRole_(petugas);
  var now = new Date();
  var minuteLimit = Number(getSiagaRuntimeSetting_('RATE_LIMIT_PER_MINUTE', CONFIG.RATE_LIMIT_PER_MINUTE || 10));
  var dailyLimit = getRateLimitDailyLimit_(role);
  var blockSeconds = Number(getSiagaRuntimeSetting_('RATE_LIMIT_BLOCK_MINUTES', CONFIG.RATE_LIMIT_BLOCK_MINUTES || 3)) * 60;
  var warnSeconds = Number(getSiagaRuntimeSetting_('RATE_LIMIT_WARN_COOLDOWN_MINUTES', CONFIG.RATE_LIMIT_WARN_COOLDOWN_MINUTES || 5)) * 60;

  var minuteKey = 'RL_MIN_' + phone + '_' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmm');
  var blockKey = 'RL_BLOCK_' + phone;
  var warnKey = 'RL_WARN_' + phone;
  var dailyKey = 'RL_DAY_' + getRateLimitDateKey_() + '_' + role + '_' + phone;

  var blocked = cacheGet_(blockKey);
  if (blocked) {
    // Jangan balas terus-terusan ketika spammer masih kirim pesan.
    if (cacheGet_(warnKey)) {
      return { allowed: false, silent: true, reason: 'blocked_cooldown' };
    }

    cachePut_(warnKey, '1', warnSeconds);
    return {
      allowed: false,
      reason: 'blocked',
      reply: 'Mohon maaf, aktivitas dari nomor ini terlalu banyak dalam waktu singkat.\n\nUntuk menjaga layanan tetap stabil, silakan coba kembali beberapa menit lagi.'
    };
  }

  var minuteCount = Number(cacheGet_(minuteKey) || '0') + 1;
  cachePut_(minuteKey, String(minuteCount), 90);

  if (minuteCount > minuteLimit) {
    cachePut_(blockKey, '1', blockSeconds);

    if (cacheGet_(warnKey)) {
      return { allowed: false, silent: true, reason: 'minute_limit' };
    }

    cachePut_(warnKey, '1', warnSeconds);
    return {
      allowed: false,
      reason: 'minute_limit',
      reply: 'Mohon maaf, pesan dari nomor ini terlalu banyak dalam waktu singkat.\n\nSilakan coba kembali beberapa menit lagi.'
    };
  }

  var props = PropertiesService.getScriptProperties();
  var dailyCount = Number(props.getProperty(dailyKey) || '0') + 1;
  props.setProperty(dailyKey, String(dailyCount));

  if (dailyCount > dailyLimit) {
    if (cacheGet_(warnKey)) {
      return { allowed: false, silent: true, reason: 'daily_limit' };
    }

    cachePut_(warnKey, '1', warnSeconds);
    return {
      allowed: false,
      reason: 'daily_limit',
      reply: 'Mohon maaf, batas penggunaan layanan WhatsApp hari ini sudah tercapai.\n\nSilakan coba kembali besok, atau hubungi admin pada jam layanan.'
    };
  }

  return {
    allowed: true,
    role: role,
    minuteCount: minuteCount,
    dailyCount: dailyCount,
    dailyLimit: dailyLimit
  };
}

function resetRateLimitByPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return false;

  var props = PropertiesService.getScriptProperties();
  var roles = ['CUSTOMER', 'PETUGAS', 'ADMIN'];
  var dayKey = getRateLimitDateKey_();

  roles.forEach(function(role) {
    try { props.deleteProperty('RL_DAY_' + dayKey + '_' + role + '_' + phone); } catch(e) {}
  });

  try { cacheRemove_('RL_BLOCK_' + phone); } catch(e2) {}
  try { cacheRemove_('RL_WARN_' + phone); } catch(e3) {}

  return true;
}

function resetRateLimitPrompt() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Reset Rate Limit Nomor WA',
    'Masukkan nomor WA format 628xxx yang ingin dibuka limitnya:',
    ui.ButtonSet.OK_CANCEL
  );

  if (res.getSelectedButton() !== ui.Button.OK) return;

  var phone = normalizePhone_(res.getResponseText() || '');
  if (!phone) {
    ui.alert('Nomor tidak valid.');
    return;
  }

  resetRateLimitByPhone_(phone);
  ui.alert('✅ Rate limit untuk ' + phone + ' sudah direset.');
}




function collectIncomingInteractiveCandidates_(message, payload) {
  payload = payload || {};
  var raw = payload.rawObject || {};
  var data = raw.data || {};
  var candidates = [];

  function add(v) {
    if (v === undefined || v === null) return;
    if (typeof v === 'object') return;
    var str = String(v || '').trim();
    if (str) candidates.push(str);
  }

  // Pesan yang sudah diparse/mapped oleh webhook.
  add(message);

  // Metadata hasil klik list/button yang sudah dinormalisasi oleh parseIncomingPayload_.
  add(payload.interactiveId);
  add(payload.interactiveTitle);
  add(payload.selected_id);
  add(payload.selected_title);
  add(payload.reply_id);
  add(payload.reply_title);
  add(payload.button_reply_id);
  add(payload.button_reply_title);
  add(payload.list_reply_id);
  add(payload.list_reply_title);

  // Field umum dari Kirimin / WhatsApp interactive reply.
  add(data.list_reply_id);
  add(data.list_reply_title);
  add(data.button_reply_id);
  add(data.button_reply_title);
  add(data.reply_id);
  add(data.reply_title);
  add(data.selected_id);
  add(data.selected_title);
  add(data.interactive_id);
  add(data.interactive_title);
  add(data.id);
  add(data.title);

  if (data.content) {
    add(data.content.id);
    add(data.content.title);
    add(data.content.text);
    add(data.content.body);
    if (data.content.reply) {
      add(data.content.reply.id);
      add(data.content.reply.title);
    }
  }

  if (data.interactive) {
    if (data.interactive.list_reply) {
      add(data.interactive.list_reply.id);
      add(data.interactive.list_reply.title);
      add(data.interactive.list_reply.description);
    }
    if (data.interactive.button_reply) {
      add(data.interactive.button_reply.id);
      add(data.interactive.button_reply.title);
    }
  }

  if (data.list_reply) {
    add(data.list_reply.id);
    add(data.list_reply.title);
    add(data.list_reply.description);
  }
  if (data.button_reply) {
    add(data.button_reply.id);
    add(data.button_reply.title);
  }

  // Beberapa payload hanya mengirim isi bubble hijau sebagai text/content.
  add(data.content);
  add(data.text);
  add(data.body);
  add(data.message);
  add(raw.content);
  add(raw.text);
  add(raw.body);
  add(raw.message);

  return candidates;
}

function isExplicitMainCekTagihanSelection_(message, payload) {
  var candidates = collectIncomingInteractiveCandidates_(message, payload);

  for (var i = 0; i < candidates.length; i++) {
    var rawText = String(candidates[i] || '').trim();
    var norm = rawText.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    var upper = rawText.toUpperCase().trim();

    if (!norm) continue;

    // ID tombol/list resmi. Ini yang paling aman untuk membedakan klik menu dari angka cabang 3.
    if (upper === 'MENU_4_CEK_TAGIHAN' || upper === 'MENU_CEK_TAGIHAN' ||
        upper === 'CEK_TAGIHAN' || upper === 'ROW_TAGIHAN') {
      return true;
    }

    if (upper.indexOf('MENU_4_CEK_TAGIHAN') !== -1 || upper.indexOf('CEK_TAGIHAN') !== -1) {
      return true;
    }

    var looksLikeSelectedTagihanText = (
      norm.indexOf('cek tagihan') !== -1 ||
      norm.indexOf('tagihan berdasarkan no pelanggan') !== -1 ||
      norm.indexOf('tagihan pelanggan') !== -1 ||
      norm.indexOf('cek rekening') !== -1
    );

    // Jangan ambil teks body menu lengkap yang berisi semua pilihan sekaligus.
    // Yang diambil hanya selected row / teks pelanggan / metadata pilihan Cek Tagihan.
    var alsoContainsOtherMainRows = (
      norm.indexOf('buat aduan') !== -1 ||
      norm.indexOf('cek status') !== -1 ||
      norm.indexOf('info layanan') !== -1
    );

    if (looksLikeSelectedTagihanText && !alsoContainsOtherMainRows) {
      return true;
    }
  }

  // Kalau hanya angka 3 tanpa metadata, jangan dianggap eksplisit.
  // Angka 3 di tahap pilih cabang harus tetap berarti Cabang ke-3.
  return false;
}


function isFastAduanConfirmationButtonSelection_(message, payload) {
  payload = payload || {};

  var id = String(payload.interactiveId || payload.selected_id || payload.reply_id || '').toUpperCase().trim();
  var title = String(payload.interactiveTitle || payload.selected_title || '').toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  var msg = String(message || '').toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();

  if (id === 'FAST_CONFIRM_YES') return true;
  if (title === 'ya, buat aduan' || title === 'ya buat aduan' || title === 'fast confirm yes' || title === 'buat aduan sekarang') return true;
  if (msg === 'ya, buat aduan' || msg === 'ya buat aduan' || msg === 'fast confirm yes' || msg === 'buat aduan sekarang') return true;
  if (title.indexOf('ya, buat aduan') !== -1 || title.indexOf('ya buat aduan') !== -1 || title.indexOf('fast confirm yes') !== -1) return true;
  if (msg.indexOf('ya, buat aduan') !== -1 || msg.indexOf('ya buat aduan') !== -1 || msg.indexOf('fast confirm yes') !== -1) return true;

  var candidates = collectIncomingInteractiveCandidates_(message, payload);
  for (var i = 0; i < candidates.length; i++) {
    var rawText = String(candidates[i] || '').trim();
    var norm = rawText.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    var upper = rawText.toUpperCase().trim();
    if (upper === 'FAST_CONFIRM_YES') return true;
    if (norm === 'ya, buat aduan' || norm === 'ya buat aduan' || norm === 'fast confirm yes' || norm === 'buat aduan sekarang') return true;
    if (norm.indexOf('ya, buat aduan') !== -1 || norm.indexOf('ya buat aduan') !== -1 || norm.indexOf('fast confirm yes') !== -1) return true;
  }

  return false;
}

function isExplicitMainBuatAduanSelection_(message, payload) {
  payload = payload || {};

  // V10.9.280:
  // Tombol konfirmasi di akhir form berjudul "Ya, Buat Aduan".
  // Jangan dianggap sebagai tombol menu utama "Buat Aduan", karena harus lanjut membuat tiket,
  // bukan mengulang lagi ke daftar cabang.
  if (isFastAduanConfirmationButtonSelection_(message, payload)) return false;

  var id = String(payload.interactiveId || payload.selected_id || payload.reply_id || '').toUpperCase().trim();
  var title = String(payload.interactiveTitle || payload.selected_title || '').toLowerCase().trim();
  var msg = String(message || '').toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();

  // Klik list/menu utama dari WhatsApp harus selalu memulai alur aduan dari pilih cabang.
  // Ini dibedakan dari angka cabang biasa karena payload membawa interactiveId/interactiveTitle.
  if (id === 'MENU_2_ADUAN_CEPAT' || id === 'MENU_ADUAN_CEPAT' || id === 'ADUAN_CEPAT' ||
      id === 'ROW_ADUAN_CEPAT' || id === 'MENU_1_ADUAN' || id === 'MENU_ADUAN_BARU' ||
      id === 'BUAT_ADUAN' || id === 'ADUAN_BARU' || id === 'ROW_ADUAN' || id === 'BUAT_ADUAN_BARU') {
    return true;
  }

  if (title.indexOf('buat aduan') !== -1 || title.indexOf('aduan baru') !== -1 ||
      title.indexOf('laporkan gangguan') !== -1 || title.indexOf('lapor gangguan') !== -1) {
    return true;
  }

  // Sebagian provider mengirim title+deskripsi sebagai teks biasa.
  if (msg.indexOf('buat aduan') !== -1 || msg.indexOf('aduan cepat') !== -1 ||
      msg.indexOf('laporkan gangguan') !== -1 || msg.indexOf('lapor gangguan') !== -1) {
    return true;
  }

  return false;
}

function getWhatsAppMenuResponse_(message, phone, payload) {
  payload = payload || {};
  message = String(message || '').trim();

  // V10.9.279/280:
  // Simpan teks asli sebelum dinormalisasi menjadi angka menu.
  // Ini penting agar klik "Buat Aduan" / "Cek Tagihan" tetap bisa dibedakan
  // dari balasan angka cabang 1/3 ketika pelanggan sedang di tahap pilih cabang.
  var originalIncomingMessage = message;

  // FIX V9.5:
  // Kirimin kadang mengirim hasil klik List Menu sebagai teks judul/deskripsi,
  // misalnya "Buat Aduan Baru\nLaporkan gangguan air".
  // Teks itu harus dianggap sebagai angka menu.
  var mappedMenuChoice = normalizeIncomingListMenuChoice_(message);
  if (mappedMenuChoice) message = mappedMenuChoice;

  phone = normalizePhone_(phone || '');
  var lower = message.toLowerCase();

  // V10.9.45:
  // Jika nomor terdaftar sebagai petugas aktif, tampilkan menu petugas.
  // Pelanggan biasa tetap memakai menu pelanggan lama.
  var activePetugas = getPetugasByPhone_(phone);

  // V10.9.81:
  // Nomor direksi/manajemen diprioritaskan sebelum menu petugas/admin biasa.
  // Akses bisa dari sheet DIREKSI_ACCESS atau role Direksi/Manajemen di PETUGAS_CABANG.
  var activeDireksi = getDireksiByPhone_(phone, activePetugas);

  // V10.9.102: perintah tutup sesi AI Direksi harus tetap diproses walau role/cache/rate limit sedang bermasalah.
  var earlySession = getWhatsAppSession_(phone);
  if (earlySession && earlySession.state === 'DIREKSI_AI_CHAT' && isDireksiAiEndCommand_(message)) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'DIREKSI_AI_END',
      reply: buildDireksiAiEndReply_(activeDireksi || { nama: 'Bapak/Ibu', role: 'Direksi' })
    };
  }

  // V10.9.49 - Anti spam / rate limit.
  // Petugas dan admin punya limit lebih longgar daripada pelanggan.
  var rate = checkWhatsAppRateLimit_(phone, activeDireksi || activePetugas);
  if (rate && !rate.allowed) {
    return {
      success: false,
      type: 'RATE_LIMIT_' + String(rate.reason || 'blocked').toUpperCase(),
      reply: rate.silent ? '' : (rate.reply || '')
    };
  }

  if (activeDireksi) {
    var direksiResult = handleDireksiWhatsAppMessage_(message, phone, payload, activeDireksi);
    if (direksiResult) return direksiResult;
  }

  if (activePetugas) {
    var petugasResult = handlePetugasWhatsAppMessage_(message, phone, payload, activePetugas);
    if (petugasResult) return petugasResult;
  }

  // Tombol pelanggan untuk melihat dokumentasi foto aduan.
  if (lower === 'lihat foto' || lower.indexOf('lihat foto') === 0 || lower.indexOf('foto aduan') !== -1) {
    return handleCustomerLihatFoto_(phone, message);
  }

  // V10.9.31:
  // Kalau provider hanya mengirim title tombol "Kembali" tanpa id PAY_INFO,
  // pakai session halaman info untuk kembali ke List Info Layanan, bukan Menu Utama.
  if (lower === 'kembali') {
    var backSession = getWhatsAppSession_(phone);
    if (backSession && (
      backSession.state === 'INFO_LAYANAN_DETAIL' ||
      backSession.state === 'INFO_LAYANAN_MENU'
    )) {
      return handleInfoPembayaranChoice_('info pembayaran', phone);
    }
  }

  // V10.9.18:
  // Fix tombol "Cek Tiket Ini" yang pada sebagian provider terkirim sebagai title tombol,
  // bukan sebagai id CEK_TIKET_<ID>.
  if (lower === 'cek tiket ini' || lower.indexOf('cek tiket') !== -1 || lower.indexOf('tiket ini') !== -1) {
    return handleCekTiketIni_(phone);
  }

  if (
    lower === 'hubungi admin' ||
    lower === 'admin' ||
    lower === 'cs' ||
    lower === 'operator' ||
    lower.indexOf('hubungi admin') !== -1 ||
    lower.indexOf('chat admin') !== -1 ||
    lower.indexOf('butuh admin') !== -1 ||
    lower.indexOf('minta admin') !== -1 ||
    lower.indexOf('bicara admin') !== -1 ||
    lower.indexOf('admin pembayaran') !== -1 ||
    lower.indexOf('customer service') !== -1 ||
    lower.indexOf('chat cs') !== -1 ||
    lower.indexOf('mau cs') !== -1 ||
    lower.indexOf('orangnya') !== -1 ||
    lower.indexOf('manusia') !== -1
  ) {
    return handleAdminHandoff_(phone, 'Chat Admin');
  }


  // V10.9.278 - HOTFIX CEK TAGIHAN TERTABRAK SESSION ADUAN
  // Jika pelanggan klik menu/list *Cek Tagihan*, proses sebagai menu global dulu,
  // walaupun sebelumnya masih tersangkut di FAST_CABANG/FAST_TEXT dari Buat Aduan.
  // Angka polos "3" tanpa metadata button/list tetap aman dipakai sebagai pilihan cabang.
  if (isExplicitMainCekTagihanSelection_(originalIncomingMessage, payload) ||
      isExplicitMainCekTagihanSelection_(message, payload)) {
    clearWhatsAppSession_(phone);
    return handleMainMenuChoice_('3', phone);
  }

  // V10.9.279 - HOTFIX BUAT ADUAN TIDAK LONCAT KE FORM DATA
  // Klik menu/list resmi *Buat Aduan* harus selalu restart dari daftar cabang,
  // meskipun session lama masih FAST_CABANG. Kalau tidak, ID menu yang dipetakan
  // menjadi angka "1" bisa kebaca sebagai Cabang Praya lalu langsung minta data aduan.
  // Aman untuk pilihan cabang biasa, karena teks angka 1-12 tanpa payload/title
  // tidak dianggap explicit main selection oleh isExplicitMainBuatAduanSelection_().
  if (isExplicitMainBuatAduanSelection_(originalIncomingMessage, payload) ||
      isExplicitMainBuatAduanSelection_(message, payload)) {
    clearWhatsAppSession_(phone);
    return handleMainMenuChoice_('aduan cepat', phone);
  }

  // V10.9.266 - FIX pilihan cabang 1-12 tidak boleh tertabrak menu utama.
  // Sebelumnya angka 3 bisa masuk Cek Tagihan dan angka 6 masuk Info Layanan,
  // padahal pelanggan sedang berada di tahap pilih cabang aduan.
  // Jadi pilihan cabang diprioritaskan sebelum perintah global Cek Tagihan/Info Layanan.
  var aduanPrioritySession = getWhatsAppSession_(phone);
  if (aduanPrioritySession && aduanPrioritySession.state) {
    var aduanPriorityState = String(aduanPrioritySession.state || '');

    if (aduanPriorityState === 'FAST_CABANG' || aduanPriorityState === 'NEW_CABANG') {
      var priorityCabangChoice = normalizeIncomingCabangChoice_(message, (aduanPrioritySession.data && aduanPrioritySession.data.cabangPage) || 1);
      if (priorityCabangChoice) {
        return aduanPriorityState === 'FAST_CABANG'
          ? handleFastAduanFlow_(message, phone, aduanPrioritySession, payload)
          : handleNewAduanFlow_(message, phone, aduanPrioritySession, payload);
      }
    }

    // Tombol Kembali pada proses aduan harus diproses oleh flow aduan,
    // bukan jatuh ke fallback "tidak memahami".
    if ((aduanPriorityState.indexOf('FAST_') === 0 || aduanPriorityState.indexOf('NEW_') === 0) &&
        isNewAduanBackCommand_(message)) {
      return aduanPriorityState.indexOf('FAST_') === 0
        ? handleFastAduanFlow_(message, phone, aduanPrioritySession, payload)
        : handleNewAduanFlow_(message, phone, aduanPrioritySession, payload);
    }
  }

  // V10.9.269 - pengaman terakhir: jika session hilang tetapi log terakhir bot
  // adalah daftar cabang aduan, angka 1-12 tetap dipaksa masuk alur pilih cabang.
  var forcedCabangSession = buildForcedAduanCabangSessionFromRecentPrompt_(phone, message, payload);
  if (forcedCabangSession) {
    return handleFastAduanFlow_(message, phone, forcedCabangSession, payload);
  }

  // V10.9.275/278: setelah prioritas sesi pilih cabang dan fallback prompt diproses di atas,
  // teks Cek Tagihan tetap diproses sebagai menu global.
  // Angka 3 polos tetap diprioritaskan sebagai cabang jika sedang berada di FAST_CABANG.
  if (isCekTagihanCommand_(lower)) {
    clearWhatsAppSession_(phone);
    return handleMainMenuChoice_('3', phone);
  }

  if (
    lower === 'info pembayaran' ||
    lower === 'info layanan' ||
    lower.indexOf('info bayar') !== -1 ||
    lower.indexOf('info pembayaran') !== -1 ||
    lower.indexOf('info layanan') !== -1 ||
    lower.indexOf('pembayaran') !== -1 ||
    lower.indexOf('cara bayar') !== -1 ||
    lower.indexOf('kendala bayar') !== -1 ||
    lower.indexOf('kendala pembayaran') !== -1 ||
    lower.indexOf('air tangki') !== -1 ||
    lower.indexOf('balik nama') !== -1 ||
    lower.indexOf('pindah meter') !== -1 ||
    lower.indexOf('sambung kembali') !== -1 ||
    lower.indexOf('sambungan pindah') !== -1 ||
    lower.indexOf('sambungan pemindahan') !== -1 ||
    lower.indexOf('pemindahan meter') !== -1
  ) {
    return handleInfoPembayaranChoice_(lower, phone);
  }

  if (lower === 'menu' || lower === 'menu utama' || lower === 'home') {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
    };
  }


  // Perintah Aduan Cepat boleh dipanggil langsung dari teks.
  // V11.9 FIX: sebelumnya cek ini jalan duluan SEBELUM tahu session pelanggan,
  // jadi kalau pelanggan sedang di tengah proses isi form aduan (state FAST_/NEW_,
  // misalnya baru saja pilih cabang lalu kirim teks aduan) dan teks aduannya sendiri
  // memuat kata seperti "keluhan"/"lapor"/"aduan" (wajar, karena itu memang format
  // yang kita ajarkan), isFastAduanCommand_() salah mengira ini perintah GLOBAL
  // "mulai aduan baru" dan me-reset seluruh proses balik ke pilih cabang -
  // cabang yang sudah dipilih dan data yang sudah diketik pelanggan hilang semua.
  // Sekarang: kalau pelanggan memang sedang aktif di alur isi aduan (FAST_/NEW_),
  // jangan potong di sini - biarkan teksnya diproses sebagai isi form oleh alur
  // aduan yang sedang berjalan (lihat routing session.state di bawah).
  if (isFastAduanCommand_(lower) && !isAduanInputFlowState_(earlySession && earlySession.state)) {
    return handleMainMenuChoice_('aduan cepat', phone);
  }

  // V10.9.228 - FIX MENU AWAL SETELAH CHAT ADMIN DIAKHIRI
  // Sapaan singkat seperti "halo" jangan masuk AI, tetapi langsung tampilkan menu awal SIAGA TIARA
  // seperti pelanggan baru membuka layanan.
  var sessionBeforeGlobalMenu = getWhatsAppSession_(phone);
  if ((!sessionBeforeGlobalMenu || !sessionBeforeGlobalMenu.state || sessionBeforeGlobalMenu.state === 'MAIN') && isMainMenuOpeningText_(lower)) {
    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: true,
      type: 'MAIN_MENU_GREETING',
      reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
    };
  }

  // V10.9.212 - TIARA Asisten Virtual hanya untuk teks bebas di menu awal.
  // Perintah admin tetap langsung masuk Chat Admin manusia.
  if (shouldInvokeCustomerVirtualAssistant_(message, phone, payload, sessionBeforeGlobalMenu)) {
    var virtualAssistantResult = handleCustomerVirtualAssistantFreeText_(message, phone, payload, sessionBeforeGlobalMenu);
    if (virtualAssistantResult) return virtualAssistantResult;
  }

  // Perintah global.
  // V10.9.62: jangan paksa kembali ke menu jika pelanggan sedang mengisi form,
  // karena kalimat aduan bisa saja mengandung kata "aduan".
  if ((!sessionBeforeGlobalMenu || !sessionBeforeGlobalMenu.state || sessionBeforeGlobalMenu.state === 'MAIN') && isMenuCommand_(lower)) {
    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
    };
  }

  if (['batal', 'cancel', 'reset', 'ulang'].indexOf(lower) !== -1) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'SESSION_CANCEL',
      reply: 'Baik, proses sebelumnya dibatalkan.',
      navButtons: buildNavButtons_('main')
    };
  }

  // Jika pelanggan langsung kirim ID aduan, langsung tracking.
  var directId = extractAduanId_(message);
  if (directId) {
    var aduan = findAduanById_(directId);
    if (aduan) {
      clearWhatsAppSession_(phone);
      setLastCheckedAduanIdForPhone_(phone, aduan.id);
      return { success: true, type: 'STATUS_BY_ID', id: aduan.id, reply: buildWhatsAppTrackingReply_(aduan),
      navButtons: buildStatusNavButtonsForAduan_(aduan) };
    }
    return { success: false, type: 'NOT_FOUND_ID', id: directId, reply: buildNotFoundReply_(directId, phone),
      navButtons: buildNavButtons_('not_found') };
  }

  var session = getWhatsAppSession_(phone);
  if (!session || !session.state) {
    // V10.9.270: jika session kosong tapi sebelumnya bot baru kirim daftar cabang,
    // angka 1-12 tetap diproses sebagai cabang.
    var noSessionForcedCabang = buildForcedAduanCabangSessionFromRecentPrompt_(phone, message, payload);
    if (noSessionForcedCabang) {
      return handleFastAduanFlow_(message, phone, noSessionForcedCabang, payload);
    }

    // V10.9.17:
    // Setelah tombol Batal ditekan, session dikosongkan.
    // Tombol seperti Buat Aduan / Cek Status / Riwayat tetap mengirim ID menu 1/2/3.
    // Jadi numeric choice harus tetap diproses meski session kosong.
    if (lower === '1' || lower === '2' || lower === '3' || lower === '4' || lower === '5' || lower === '6') {
      return handleMainMenuChoice_(message, phone);
    }

    // Kalau klik/ketik "status", cari aduan terakhir berdasarkan nomor WA.
    if (lower === 'status' || lower === 'cek' || lower === 'cek status' || lower === 'cek status aduan') {
      return handleCekStatusAduan_(phone);
    }

    if (lower === 'lihat' || lower === 'riwayat' || lower === 'aduan aktif' || lower === 'aduan aktif saya') {
      return handleCekStatusAduan_(phone);
    }

    var noSessionAiResult = handleCustomerVirtualAssistantFreeText_(message, phone, payload, { state: 'MAIN', data: {} });
    if (noSessionAiResult) return noSessionAiResult;

    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
    };
  }

  // V10.9.31 - Pilihan di List Info Layanan.
  if (session.state === 'INFO_LAYANAN_MENU') {
    return handleInfoPembayaranChoice_(message, phone);
  }

  // Pilihan menu utama
  if (session.state === 'MAIN') {
    return handleMainMenuChoice_(message, phone);
  }

  // Mode hubungi admin / Chat Agent: bot diam agar percakapan bisa ditangani manual oleh admin/petugas.
  // Pelanggan bisa ketik "menu" untuk kembali ke layanan otomatis.
  if (session.state === 'ADMIN_HANDOFF') {
    return handleAgentHandoffInbound_(phone, message, session);
  }

  if (session.state === 'AWAIT_ID') {
    // V10.9.227:
    // Setelah AI mengarahkan ke Cek Status Aduan, pelanggan boleh langsung kirim
    // ID Aduan atau No Pelanggan tanpa harus menekan tombol Cek Status dulu.
    // Kalau user berubah pikiran dan memilih menu lain, jangan dikunci di mode cek status.
    if (lower === '1' || lower === '2' || lower === '3' || lower === '4' || lower === '5' || isFastAduanCommand_(lower) || isCekTagihanCommand_(lower)) {
      return handleMainMenuChoice_(message, phone);
    }
    return handleCekStatusInput_(message, phone);
  }

  if (session.state === 'BILLING_AWAIT_NOPEL') {
    return handleBillingNoPelangganInput_(message, phone, session);
  }

  if (session.state === 'PICK_ADUAN') {
    return handlePickAduan_(message, phone, session);
  }

  if (session.state.indexOf('FAST_') === 0) {
    return handleFastAduanFlow_(message, phone, session, payload);
  }

  if (session.state.indexOf('NEW_') === 0) {
    return handleNewAduanFlow_(message, phone, session, payload);
  }

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU',
    reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
  };
}

function isMainMenuOpeningText_(lower) {
  lower = String(lower || '').trim().toLowerCase();
  lower = lower.replace(/[!?.]/g, '').replace(/\s+/g, ' ').trim();

  // Hanya sapaan/perintah pembuka yang benar-benar singkat.
  // Kalimat layanan seperti "saya mau pengaduan" tetap diproses ke alur layanan/AI, bukan dipotong menjadi menu biasa.
  var exact = [
    'halo', 'hallo', 'hai', 'hi', 'hello',
    'menu', 'menu utama', 'home', 'mulai', 'start', '/start',
    'siaga', 'bantuan', 'help', 'p', 'tes', 'test',
    'pagi', 'siang', 'sore', 'malam', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam', 'assalamualaikum', 'assalamu alaikum'
  ];
  if (exact.indexOf(lower) !== -1) return true;
  if (/^ha+l+o+$/i.test(lower)) return true;
  if (/^he+l+o+$/i.test(lower)) return true;
  return false;
}

function isMenuCommand_(lower) {
  lower = String(lower || '').trim().toLowerCase();

  // Dibuat longgar: pelanggan sering mengetik p, min, admin, cek, aduan, hallo, hallooo, dsb.
  var exact = [
    'halo', 'hallo', 'hai', 'hi', 'hello', 'menu', 'mulai', 'start', '/start',
    'siaga', 'bantuan', 'help', 'p', 'tes', 'test'
  ];
  if (exact.indexOf(lower) !== -1) return true;

  // Pola fleksibel untuk variasi kata.
  if (/^ha+l+o+$/i.test(lower)) return true;       // halo, hallo, hallooo
  if (/^he+l+o+$/i.test(lower)) return true;       // hello, helloo
  if (lower.indexOf('menu') !== -1) return true;
  if (lower.indexOf('bantuan') !== -1) return true;
  if (lower.indexOf('admin') !== -1) return true;
  if (lower.indexOf('layanan') !== -1) return true;
  if (lower.indexOf('aduan aktif') !== -1 || lower.indexOf('aduan saya') !== -1) return false;
  if (lower.indexOf('aduan') !== -1 && lower.indexOf('status') === -1) return true;

  return false;
}


function buildAskIdReply_() {
  return [
    '🔎 *Cek Status Aduan*',
    '',
    'Silakan kirim *ID Aduan* atau *No Pelanggan* yang ingin dicek.',
    '',
    'Contoh:',
    '*PRY7K2A*',
    '*25252552*',
    '',
    'Ketik *menu* untuk kembali ke Menu Utama.'
  ].join('\n');
}

function buildAskIdNavButtons_() {
  return [
    { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}





// ============================================================
// V10.9.179 - CHAT ADMIN 15 MENIT AUTO EXPIRE
// - Istilah user-facing diganti menjadi Chat Admin
// - Durasi Human Takeover default 15 menit
// - Jika admin sudah membalas dan pelanggan tidak membalas 15 menit, mode Chat Admin otomatis berakhir
// - Balasan hubungi admin dibuat singkat sesuai permintaan
// V10.9.178 - CHAT AGENT / HUMAN TAKEOVER
// ============================================================

function normalizeAgentChatMinutes_(minutes) {
  // V10.9.179: Chat Admin default 15 menit.
  // Tujuan: kalau admin sudah membalas tetapi pelanggan tidak merespon 15 menit,
  // mode Chat Admin otomatis habis dan bot kembali normal.
  minutes = Number(minutes || 15);
  if (!minutes || isNaN(minutes) || minutes < 1) minutes = 15;
  if (minutes > 60) minutes = 60;
  return minutes;
}

function isAgentHandoffState_(state) {
  return String(state || '').trim().toUpperCase() === 'ADMIN_HANDOFF';
}

function buildAgentHandoffData_(data) {
  data = data || {};
  return {
    context: data.context || 'Chat Admin',
    aduanId: data.aduanId || data.id || '',
    activatedBy: data.activatedBy || '',
    activatedByRole: data.activatedByRole || '',
    source: data.source || 'dashboard',
    activatedAt: data.activatedAt || new Date().toISOString(),
    expiresMinutes: normalizeAgentChatMinutes_(data.expiresMinutes || 15)
  };
}

function activateAgentChatSession_(phone, data, minutes) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor pelanggan tidak valid.' };

  // V10.9.182: pertahankan data Chat Admin sebelumnya (pesan terakhir pelanggan/admin)
  // agar notifikasi dashboard tidak hilang ketika mode diperpanjang atau admin membalas.
  var previousData = {};
  try {
    var previousSession = getWhatsAppSession_(phone);
    if (previousSession && isAgentHandoffState_(previousSession.state)) previousData = previousSession.data || {};
  } catch(ePrev) {}

  data = Object.assign({}, previousData, data || {});
  data = buildAgentHandoffData_(data || {});
  data.expiresMinutes = normalizeAgentChatMinutes_(minutes || data.expiresMinutes || 15);
  setWhatsAppSession_(phone, 'ADMIN_HANDOFF', data);

  try {
    CacheService.getScriptCache().put('AGENT_CHAT_ACTIVE_' + phone, JSON.stringify(data), safeCacheExpirationSeconds_(data.expiresMinutes * 60));
  } catch(e) {}

  return { success: true, phone: phone, data: data };
}

function endAgentChatSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor pelanggan tidak valid.' };
  var session = getWhatsAppSession_(phone);
  if (session && isAgentHandoffState_(session.state)) clearWhatsAppSession_(phone);
  try { CacheService.getScriptCache().remove('AGENT_CHAT_ACTIVE_' + phone); } catch(e) {}
  return { success: true, phone: phone };
}

function getAgentChatStatusByPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { active: false, phone: '' };
  var session = getWhatsAppSession_(phone);
  if (session && isAgentHandoffState_(session.state)) {
    var data = session.data || {};
    // V10.9.189: jika admin sudah membalas lalu pelanggan diam 15 menit,
    // mode Chat Admin otomatis mati. Jika admin belum membalas, jangan mati 15 menit.
    if (shouldAutoEndAgentChatAfterAdminReply_(data)) {
      try { endAgentChatSession_(phone); } catch(eEnd) {}
      return { active: false, phone: phone, state: '', data: data, autoEnded: true };
    }
    return { active: true, phone: phone, state: session.state, data: data };
  }
  return { active: false, phone: phone, state: session ? session.state : '', data: session ? (session.data || {}) : {} };
}

// ============================================================
// V10.9.189 - CHAT ADMIN: DISABLE BALASAN JIKA WINDOW 24 JAM TERTUTUP
// Catatan:
// - Admin hanya boleh mengirim balasan bebas jika pelanggan pernah mengirim pesan dalam 24 jam terakhir.
// - Jika admin belum merespon 15 menit, Chat Admin tetap aktif dan dashboard memberi warning.
// - Jika admin sudah merespon lalu pelanggan diam 15 menit, Chat Admin otomatis mati.
// ============================================================
function getChatAdminLastInboundFromLog_(phone, limitRows) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;
  limitRows = Number(limitRows || 3000) || 3000;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
    if (!sh || safeGetLastRow_(sh) < 2) return null;

    var lastRow = safeGetLastRow_(sh);
    var startRow = Math.max(2, lastRow - limitRows);
    var values = sh.getRange(startRow, 1, lastRow - startRow + 1, Math.min(sh.getLastColumn(), 8)).getValues();

    var skipJenis = {
      'AGENT_CHAT_REPLY': true,
      'AGENT_CHAT_START': true,
      'AGENT_CHAT_END': true,
      'AGENT_CHAT_NOTIFY_ADMIN': true,
      'WEBHOOK_OUTBOUND_STATUS_SKIP': true,
      'WEBHOOK_BOT_ECHO_SKIP': true,
      'WEBHOOK_DUPLICATE_SKIP': true
    };

    for (var i = values.length - 1; i >= 0; i--) {
      var r = values[i];
      var rowPhone = normalizePhone_(r[1] || '');
      if (rowPhone !== phone) continue;

      var jenis = String(r[3] || '').trim().toUpperCase();
      if (skipJenis[jenis]) continue;
      if (jenis.indexOf('AGENT_CHAT_') === 0) continue;
      if (jenis.indexOf('WEBHOOK_') === 0 && jenis.indexOf('SKIP') !== -1) continue;

      var message = String(r[2] || '').trim();
      if (!message) continue;
      if (message === 'Balasan admin dashboard' || message === 'Aktifkan Chat Admin dari Dashboard' || message === 'Akhiri Chat Admin dari Dashboard') continue;

      var d = toSafeDate_(r[0]) || null;
      if (d && !isNaN(d.getTime())) {
        return { date: d, text: message, jenis: jenis };
      }
    }
  } catch(e) {}
  return null;
}

function getChatAdmin24hWindowInfo_(phone, data) {
  phone = normalizePhone_(phone || '');
  data = data || {};
  var candidates = [];

  try {
    var d1 = toSafeDate_(data.lastCustomerMessageAt || '');
    if (d1 && !isNaN(d1.getTime())) candidates.push({ date: d1, source: 'session', text: data.lastCustomerMessage || '' });
  } catch(e1) {}

  var logInfo = getChatAdminLastInboundFromLog_(phone, 3000);
  if (logInfo && logInfo.date) candidates.push({ date: logInfo.date, source: 'log', text: logInfo.text || '' });

  if (!candidates.length) {
    return { canReply: false, phone: phone, lastInboundAt: null, lastInboundText: '', ageMinutes: null, ageHours: null, reason: 'NO_LAST_CUSTOMER_MESSAGE' };
  }

  candidates.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });
  var latest = candidates[0];
  var ageMs = new Date().getTime() - latest.date.getTime();
  var ageMinutes = Math.max(0, Math.floor(ageMs / 60000));
  var ageHours = ageMs / 3600000;
  var canReply = ageMs <= chatAdminFreeWindowMs_FINAL207_();

  return {
    canReply: canReply,
    phone: phone,
    // Nilai yang dikembalikan ke google.script.run tidak boleh membawa objek
    // Date mentah. ISO string tetap dapat diproses kembali oleh toSafeDate_(),
    // sekaligus aman dikirim bersama payload CRM ke browser.
    lastInboundAt: latest.date.toISOString(),
    lastInboundAtText: Utilities.formatDate(latest.date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    lastInboundText: truncateForLog_(latest.text || '', 500),
    lastInboundSource: latest.source || '',
    ageMinutes: ageMinutes,
    ageHours: ageHours,
    reason: canReply ? 'OPEN_24H' : 'CLOSED_24H'
  };
}

function buildChatAdmin24hClosedError_(info) {
  info = info || {};
  var last = info.lastInboundAtText ? (' terakhir pada ' + info.lastInboundAtText) : '';
  return 'Balasan Chat Admin dinonaktifkan karena pelanggan belum mengirim pesan dalam 24 jam terakhir' + last + '. Minta pelanggan mengetik pesan terlebih dahulu, misalnya: admin atau menu.';
}

function shouldAutoEndAgentChatAfterAdminReply_(data) {
  data = data || {};
  var agentAt = toSafeDate_(data.lastAgentMessageAt || '');
  if (!agentAt || isNaN(agentAt.getTime())) return false;

  var customerAt = toSafeDate_(data.lastCustomerMessageAt || '');
  // Kalau pelanggan membalas setelah admin, jangan auto-end.
  if (customerAt && !isNaN(customerAt.getTime()) && customerAt.getTime() > agentAt.getTime()) return false;

  return (new Date().getTime() - agentAt.getTime()) > (15 * 60 * 1000);
}

function getChatAdminWaitingInfo_(data) {
  data = data || {};
  var now = new Date().getTime();
  var customerAt = toSafeDate_(data.lastCustomerMessageAt || '');
  var agentAt = toSafeDate_(data.lastAgentMessageAt || '');
  var waitingAdmin = false;
  var adminLate = false;
  var waitMinutes = 0;

  if (customerAt && !isNaN(customerAt.getTime()) && (!agentAt || isNaN(agentAt.getTime()) || agentAt.getTime() < customerAt.getTime())) {
    waitingAdmin = true;
    waitMinutes = Math.max(0, Math.floor((now - customerAt.getTime()) / 60000));
    adminLate = waitMinutes >= 15;
  }

  return {
    waitingAdmin: waitingAdmin,
    adminLate: adminLate,
    waitMinutes: waitMinutes
  };
}

function buildAgentChatActivatedCustomerReply_(aduan, sessionUser) {
  aduan = aduan || {};
  var id = aduan.id || '';
  return [
    '💬 *Chat Admin Aktif*',
    '',
    'Percakapan Anda sedang ditangani oleh admin PERUMDAM Tirta Ardhia Rinjani.',
    id ? ('ID Aduan: *' + id + '*') : '',
    '',
    'Silakan tulis pesan Anda di chat ini.',
    '',
    'Ketik *menu* jika ingin kembali ke layanan otomatis.'
  ].filter(function(x){ return String(x || '').trim() !== ''; }).join('\n');
}

function buildAgentChatEndedCustomerReply_() {
  return [
    '✅ *Chat Admin Selesai*',
    '',
    'Percakapan dengan admin telah selesai.',
    '',
    'Jika masih membutuhkan layanan, silakan ketik *menu* untuk membuka menu SIAGA TIARA.'
  ].join('\n');
}

function buildAgentChatNeedAdminNotice_(phone, message, data) {
  data = data || {};
  return [
    '💬 *Pelanggan Membutuhkan Admin*',
    '',
    'No WA: *' + (normalizePhone_(phone || '') || '-') + '*',
    data.aduanId ? ('ID Aduan: *' + data.aduanId + '*') : '',
    data.context ? ('Konteks: ' + data.context) : '',
    '',
    'Pesan pelanggan:',
    truncateForLog_(message || '-', 500),
    '',
    'Bot sedang dipause untuk nomor ini. Silakan balas pelanggan melalui dashboard SIAGA TIARA atau inbox Kirimin.'
  ].filter(function(x){ return String(x || '').trim() !== ''; }).join('\n');
}

function getAgentChatNotifyTargets_(data) {
  data = data || {};
  var targets = [];
  var seen = {};

  function addList(list) {
    (list || []).forEach(function(p) {
      var no = normalizePhone_(p.noWa || p.phone || '');
      if (!no || seen[no]) return;
      seen[no] = true;
      targets.push({ noWa: no, nama: p.nama || p.name || 'Admin', cabang: p.cabang || '', role: p.role || '' });
    });
  }

  // V10.9.185: Chat Admin/administrasi hanya diberitahukan ke akun Admin Pusat.
  // Jangan kirim ke petugas/cabang agar tidak tercampur dengan aduan teknis.
  try { addList(getAdminPusatPetugas_()); } catch(e2) {}
  return targets;
}

function notifyAgentChatAdmins_(phone, message, data, force) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor pelanggan kosong.', sent: 0, failed: 0 };

  var cacheKey = 'AGENT_CHAT_NOTIFY_' + phone;
  if (!force) {
    try {
      if (CacheService.getScriptCache().get(cacheKey)) {
        return { success: true, skipped: true, reason: 'cooldown', sent: 0, failed: 0 };
      }
    } catch(e) {}
  }

  data = data || {};
  var targets = getAgentChatNotifyTargets_(data);
  var notice = buildAgentChatNeedAdminNotice_(phone, message, data);
  var sent = 0;
  var failed = 0;
  var detail = [];

  targets.forEach(function(t) {
    var res = sendKiriminTextByPhoneNumber_(t.noWa, notice);
    var ok = !!(res && res.success);
    if (ok) sent++; else failed++;
    detail.push({ target: t.noWa, nama: t.nama, success: ok, response: res });
  });

  try { CacheService.getScriptCache().put(cacheKey, '1', safeCacheExpirationSeconds_(60)); } catch(e2) {}

  logWhatsApp_(
    phone,
    message || 'Pelanggan membutuhkan admin',
    'AGENT_CHAT_NOTIFY_ADMIN',
    data.aduanId || '',
    notice,
    'SENT:' + sent + '/FAILED:' + failed,
    JSON.stringify({ data: data, detail: detail })
  );

  return { success: true, sent: sent, failed: failed, detail: detail };
}

function handleAgentHandoffInbound_(phone, message, session) {
  session = session || {};
  var data = session.data || {};
  var lower = String(message || '').trim().toLowerCase();

  // Pelanggan bisa kembali ke layanan otomatis kapan saja.
  if (lower === 'menu' || lower === 'menu utama' || lower === 'home') {
    endAgentChatSession_(phone);
    return {
      success: true,
      type: 'AGENT_CHAT_CUSTOMER_BACK_TO_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, {})
    };
  }

  // Kalau admin sudah membalas lalu pelanggan diam lebih dari 15 menit,
  // mode Chat Admin dianggap selesai. Pesan baru diproses normal dari awal.
  if (shouldAutoEndAgentChatAfterAdminReply_(data)) {
    endAgentChatSession_(phone);
    return getWhatsAppMenuResponse_(message, phone, {});
  }

  data.lastCustomerMessageAt = new Date().toISOString();
  data.lastCustomerMessage = truncateForLog_(message || '', 500);

  // Perpanjang pause setiap pelanggan membalas selama masih mode chat admin.
  activateAgentChatSession_(phone, data, data.expiresMinutes || 15);

  // Kirim notifikasi ke admin/petugas dengan cooldown agar tidak spam.
  try { notifyAgentChatAdmins_(phone, message, data, false); } catch(e) {}

  return {
    success: true,
    type: 'ADMIN_HANDOFF_NO_REPLY',
    id: data.aduanId || '',
    reply: ''
  };
}



function getAgentChatConversation_(phone, idAduan, limit) {
  phone = normalizePhone_(phone || '');
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  limit = Number(limit || 80);
  if (!phone && !idAduan) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var lastRow = safeGetLastRow_(sh);
  var startRow = Math.max(2, lastRow - 1500);
  var values = sh.getRange(startRow, 1, lastRow - startRow + 1, Math.min(sh.getLastColumn(), 8)).getValues();
  var rows = [];

  function extractMediaFromRawLogLocal_(rawText) {
    rawText = String(rawText || '').trim();
    if (!rawText) return null;
    try {
      var rawObj = parseJsonSafe_(rawText);
      if (!rawObj) rawObj = JSON.parse(rawText);
      var m = extractMediaFromPayload_(rawObj);
      if (m && m.url) return m;
    } catch(e1) {}

    // Fallback kalau Raw Payload terpotong tetapi media_url masih terlihat.
    try {
      var match = rawText.match(/"media_url"\s*:\s*"([^"]+)"/i) || rawText.match(/"file_url"\s*:\s*"([^"]+)"/i) || rawText.match(/"url"\s*:\s*"(https?:\\\/\\\/[^\"]+)"/i);
      if (match && match[1]) {
        var u = String(match[1] || '').replace(/\\\//g, '/');
        return { url: u, mimeType: '', fileName: '', caption: '' };
      }
    } catch(e2) {}
    return null;
  }

  values.forEach(function(r) {
    var waktu = toSafeDate_(r[0]) || null;
    var rowPhone = normalizePhone_(r[1] || '');
    var pesan = String(r[2] || '');
    var jenis = String(r[3] || '').trim();
    var jenisUpper = jenis.toUpperCase();
    var rowId = normalizeAduanIdHyphen_(r[4] || '');
    var balasan = String(r[5] || '');
    var status = String(r[6] || '');
    var statusUpper = status.toUpperCase();
    var raw = String(r[7] || '');
    var media = extractMediaFromRawLogLocal_(raw);

    if (phone && rowPhone && rowPhone !== phone) return;
    if (idAduan && rowId && rowId !== idAduan && jenisUpper.indexOf('AGENT_CHAT') === -1 && jenisUpper.indexOf('ADMIN_HANDOFF') === -1 && jenisUpper !== 'CONTACT_ADMIN') return;

    var direction = '';
    var text = '';
    var sender = '';
    var mediaUrl = media && media.url ? String(media.url || '') : '';
    var mediaMime = media && media.mimeType ? String(media.mimeType || '') : '';
    var mediaCaption = media && media.caption ? String(media.caption || '') : '';

    if (jenisUpper === 'AGENT_CHAT_REPLY') {
      direction = 'admin';
      text = balasan || pesan;
      sender = 'Admin';
    } else if (jenisUpper === 'AGENT_CHAT_START') {
      direction = 'system';
      text = 'Chat Admin diaktifkan.';
      sender = 'Sistem';
    } else if (jenisUpper === 'AGENT_CHAT_END') {
      direction = 'system';
      text = 'Chat Admin diakhiri.';
      sender = 'Sistem';
    } else if (jenisUpper === 'CONTACT_ADMIN') {
      direction = 'customer';
      text = pesan || 'Meminta admin';
      sender = 'Pelanggan';
    } else if (jenisUpper === 'ADMIN_HANDOFF_NO_REPLY' || statusUpper.indexOf('NO_REPLY_ADMIN_HANDOFF') !== -1) {
      direction = 'customer';
      text = pesan;
      sender = 'Pelanggan';
    } else if (jenisUpper === 'AGENT_CHAT_NOTIFY_ADMIN') {
      direction = 'system';
      text = 'Notifikasi kebutuhan admin dikirim ke admin/petugas.';
      sender = 'Sistem';
    } else if (mediaUrl && (pesan === '[FOTO_WHATSAPP]' || statusUpper.indexOf('NO_REPLY') !== -1 || String(raw || '').indexOf('"message_type":"image"') !== -1)) {
      // Media inbound pelanggan saat Chat Admin: tampilkan sebagai foto, bukan teks mentah.
      direction = 'customer';
      text = mediaCaption || (pesan && pesan !== '[FOTO_WHATSAPP]' ? pesan : 'Foto pelanggan');
      sender = 'Pelanggan';
    }

    if (!direction || (!String(text || '').trim() && !mediaUrl)) return;

    if (mediaUrl && (!text || text === '[FOTO_WHATSAPP]')) text = mediaCaption || 'Foto pelanggan';

    rows.push({
      waktu: waktu,
      timeText: waktu ? Utilities.formatDate(waktu, Session.getScriptTimeZone(), 'dd/MM HH:mm') : String(r[0] || ''),
      phone: rowPhone,
      id: rowId || idAduan || '',
      direction: direction,
      sender: sender,
      text: truncateForLog_(text || '', 1200),
      jenis: jenis,
      status: status,
      mediaUrl: mediaUrl,
      mediaMime: mediaMime,
      mediaCaption: mediaCaption
    });
  });

  rows.sort(function(a, b) {
    var at = a.waktu ? a.waktu.getTime() : 0;
    var bt = b.waktu ? b.waktu.getTime() : 0;
    return at - bt;
  });

  if (rows.length > limit) rows = rows.slice(rows.length - limit);
  return rows.map(function(r) {
    return {
      timeText: r.timeText,
      phone: r.phone,
      id: r.id,
      direction: r.direction,
      sender: r.sender,
      text: r.text,
      jenis: r.jenis,
      status: r.status,
      mediaUrl: r.mediaUrl || '',
      mediaMime: r.mediaMime || '',
      mediaCaption: r.mediaCaption || ''
    };
  });
}

function getAduanForAgentChat_(id) {
  id = normalizeAduanIdHyphen_(id || '');
  if (!id) return null;
  return findAduanById_(id);
}


// V10.9.231 - Chat Admin hanya untuk akun Admin Pusat, bukan Admin/Cabang.
// Jangan pakai canSeeAll sebagai izin karena role "Admin Cabang" bisa membuat canSeeAll=true.
function isAdminPusatDashboardUser_(sessionUser) {
  sessionUser = sessionUser || {};
  var role = String(sessionUser.role || '').toLowerCase().trim();
  var cabang = String(sessionUser.cabang || '').toLowerCase().trim();
  var username = String(sessionUser.username || '').toLowerCase().trim();
  var nama = String(sessionUser.nama || sessionUser.name || '').toLowerCase().trim();
  var text = [role, cabang, username, nama].join(' ');

  // Direksi/manajemen boleh akses dashboard, tetapi fitur Chat Admin tetap khusus Admin Pusat.
  if (text.indexOf('direksi') !== -1 || text.indexOf('direktur') !== -1 || text.indexOf('manajemen') !== -1) return false;
  if (text.indexOf('cabang') !== -1 && text.indexOf('admin pusat') === -1) return false;
  if (text.indexOf('petugas') !== -1 || text.indexOf('teknik') !== -1 || text.indexOf('kasub') !== -1 || text.indexOf('kasubbid') !== -1) return false;

  return role.indexOf('admin pusat') !== -1 ||
         cabang === 'all' ||
         cabang.indexOf('admin pusat') !== -1 ||
         username.indexOf('admin pusat') !== -1 ||
         nama.indexOf('admin pusat') !== -1;
}

function requireAdminPusatChatAdmin_(sessionUser) {
  if (isAdminPusatDashboardUser_(sessionUser)) return null;
  return { success: false, error: 'Fitur Chat Admin hanya tersedia untuk akun Admin Pusat.' };
}

function clientGetAgentChatInfo(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    var chatAdminAllowed = requireAdminPusatChatAdmin_(sessionUser);
    if (chatAdminAllowed) return chatAdminAllowed;

    var aduan = getAduanForAgentChat_(form.id || form.aduanId || '');
    if (aduan && !dashboardUserCanAccessAduan_(sessionUser, aduan)) return { success: false, error: 'Anda tidak punya akses ke aduan ini.' };

    var phone = normalizePhone_(form.noHp || form.phone || (aduan && aduan.noHp) || '');
    var status = getAgentChatStatusByPhone_(phone);
    var aduanId = aduan ? aduan.id : (form.id || '');
    var messages = getAgentChatConversation_(phone, aduanId, 80);
    var windowInfo = getChatAdmin24hWindowInfo_(phone, status.data || {});
    var waitingInfo = getChatAdminWaitingInfo_(status.data || {});
    return {
      success: true,
      phone: phone,
      active: !!status.active,
      state: status.state || '',
      data: status.data || {},
      aduanId: aduanId,
      pelanggan: aduan ? aduan.namaPelanggan : '',
      messages: messages,
      canReply: !!windowInfo.canReply,
      windowInfo: windowInfo,
      waitingInfo: waitingInfo
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}


// ============================================================
// V10.9.182 - NOTIFIKASI CHAT ADMIN DI DASHBOARD
// Menampilkan pelanggan yang sedang membutuhkan admin tanpa membuka WA.
// Data diambil ringan dari SESSION_WHATSAPP + LOG_WHATSAPP, bukan dari seluruh ADUAN.
// ============================================================
function getActiveChatAdminDashboardRequests_(sessionUser, limit) {
  sessionUser = sessionUser || {};
  limit = Number(limit || 20);
  if (!limit || limit < 1) limit = 20;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppSessionSheet(ss);
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var rows = [];
  var now = new Date();

  values.forEach(function(r) {
    var phone = normalizePhone_(r[0] || '');
    var state = String(r[1] || '').trim();
    if (!phone || !isAgentHandoffState_(state)) return;

    var updatedAt = toSafeDate_(r[3]) || null;
    if (isWhatsAppSessionExpired_(state, updatedAt)) {
      try { clearWhatsAppSession_(phone); } catch(eClear) {}
      return;
    }

    var data = parseJsonSafe_(r[2]) || {};
    if (shouldAutoEndAgentChatAfterAdminReply_(data)) {
      try { clearWhatsAppSession_(phone); } catch(eAutoEnd) {}
      return;
    }
    var aduanId = normalizeAduanIdHyphen_(data.aduanId || data.id || '');
    var aduan = null;
    if (aduanId) {
      try { aduan = findAduanById_(aduanId); } catch(eFind) {}
      if (aduan && !dashboardUserCanAccessAduan_(sessionUser, aduan)) return;
    } else {
      // Chat admin tanpa aduan hanya ditampilkan ke Admin Pusat/Direksi yang punya akses semua.
      if (!sessionUser.canSeeAll) return;
    }

    var conversation = [];
    try { conversation = getAgentChatConversation_(phone, aduanId, 12); } catch(eConv) {}

    var lastCustomer = '';
    var lastCustomerTime = '';
    var lastAdmin = '';
    for (var i = conversation.length - 1; i >= 0; i--) {
      if (!lastCustomer && conversation[i].direction === 'customer') {
        lastCustomer = conversation[i].text || '';
        lastCustomerTime = conversation[i].timeText || '';
      }
      if (!lastAdmin && conversation[i].direction === 'admin') lastAdmin = conversation[i].text || '';
      if (lastCustomer && lastAdmin) break;
    }

    if (!lastCustomer) lastCustomer = data.lastCustomerMessage || 'Pelanggan meminta dihubungkan ke admin.';
    if (!lastCustomerTime && data.lastCustomerMessageAt) {
      var dc = toSafeDate_(data.lastCustomerMessageAt);
      if (dc) lastCustomerTime = Utilities.formatDate(dc, Session.getScriptTimeZone(), 'dd/MM HH:mm');
    }

    var updatedText = updatedAt ? Utilities.formatDate(updatedAt, Session.getScriptTimeZone(), 'dd/MM HH:mm') : '';
    var windowInfo = getChatAdmin24hWindowInfo_(phone, data);
    var waitingInfo = getChatAdminWaitingInfo_(data);
    var minutesLeft = 15;
    if (data.lastAgentMessageAt) {
      var agentDateForLeft = toSafeDate_(data.lastAgentMessageAt);
      if (agentDateForLeft) minutesLeft = Math.max(0, Math.ceil((15 * 60000 - (now.getTime() - agentDateForLeft.getTime())) / 60000));
    } else {
      minutesLeft = null;
    }

    rows.push({
      phone: phone,
      aduanId: aduanId,
      pelanggan: (aduan && aduan.namaPelanggan) || getRememberedWhatsAppCustomerName_(phone) || 'Pelanggan',
      cabang: (aduan && aduan.cabang) || '',
      jenis: (aduan && aduan.jenis) || '',
      statusAduan: (aduan && aduan.status) || '',
      context: data.context || 'Chat Admin',
      lastMessage: truncateForLog_(lastCustomer || '-', 500),
      lastMessageTime: lastCustomerTime || updatedText,
      lastAdminMessage: truncateForLog_(lastAdmin || data.lastAgentMessage || '', 500),
      updatedAt: updatedAt ? updatedAt.getTime() : 0,
      updatedText: updatedText,
      minutesLeft: minutesLeft,
      messages: conversation,
      canReply: !!windowInfo.canReply,
      windowInfo: windowInfo,
      waitingInfo: waitingInfo,
      waitingAdmin: !!waitingInfo.waitingAdmin,
      adminLate: !!waitingInfo.adminLate,
      adminWaitMinutes: waitingInfo.waitMinutes || 0
    });
  });

  rows.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  return rows.slice(0, limit);
}

function clientGetChatAdminDashboardRequests(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    var chatAdminAllowed = requireAdminPusatChatAdmin_(sessionUser);
    if (chatAdminAllowed) return chatAdminAllowed;

    var rows = getActiveChatAdminDashboardRequests_(sessionUser, Number(form.limit || 20));
    return {
      success: true,
      count: rows.length,
      requests: rows,
      checkedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm:ss')
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientStartAgentChat(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    var chatAdminAllowed = requireAdminPusatChatAdmin_(sessionUser);
    if (chatAdminAllowed) return chatAdminAllowed;

    var aduan = getAduanForAgentChat_(form.id || form.aduanId || '');
    if (aduan && !dashboardUserCanAccessAduan_(sessionUser, aduan)) return { success: false, error: 'Anda tidak punya akses ke aduan ini.' };

    var phone = normalizePhone_(form.noHp || form.phone || (aduan && aduan.noHp) || '');
    if (!phone) return { success: false, error: 'No HP pelanggan kosong/tidak valid.' };

    var windowInfo = getChatAdmin24hWindowInfo_(phone, {});
    if (!windowInfo.canReply) {
      return { success: false, blocked24h: true, windowInfo: windowInfo, error: buildChatAdmin24hClosedError_(windowInfo) };
    }

    var minutes = normalizeAgentChatMinutes_(form.minutes || 15);
    var data = {
      context: form.context || 'Chat Admin Dashboard',
      aduanId: aduan ? aduan.id : (form.id || ''),
      activatedBy: sessionUser.nama || sessionUser.username || 'Admin',
      activatedByRole: sessionUser.role || '',
      source: 'dashboard',
      expiresMinutes: minutes
    };
    var act = activateAgentChatSession_(phone, data, minutes);

    var customerMsg = buildAgentChatActivatedCustomerReply_(aduan || {}, sessionUser);
    var send = sendWhatsAppMessage_(phone, customerMsg, {});

    logWhatsApp_(phone, 'Aktifkan Chat Admin dari Dashboard', 'AGENT_CHAT_START', data.aduanId || '', customerMsg, send && send.success ? 'SENT' : 'FAILED', JSON.stringify({ sessionUser: sessionUser, send: send, data: data }));

    return { success: true, phone: phone, active: true, send: send, message: 'Chat Admin aktif. Bot dipause untuk pelanggan ini selama ' + minutes + ' menit.' };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientEndAgentChat(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    var chatAdminAllowed = requireAdminPusatChatAdmin_(sessionUser);
    if (chatAdminAllowed) return chatAdminAllowed;

    var aduan = getAduanForAgentChat_(form.id || form.aduanId || '');
    if (aduan && !dashboardUserCanAccessAduan_(sessionUser, aduan)) return { success: false, error: 'Anda tidak punya akses ke aduan ini.' };

    var phone = normalizePhone_(form.noHp || form.phone || (aduan && aduan.noHp) || '');
    if (!phone) return { success: false, error: 'No HP pelanggan kosong/tidak valid.' };

    endAgentChatSession_(phone);
    var notify = String(form.notifyCustomer || 'YA').toUpperCase() !== 'TIDAK';
    var send = notify ? { success: false, skipped: false } : { success: true, skipped: true };
    var menuReply = buildMainWhatsAppMenuReply_(phone, {});

    // V10.9.228:
    // Setelah admin klik Akhiri, pelanggan langsung menerima menu awal SIAGA TIARA
    // seperti pesan pembuka, bukan hanya teks "chat admin selesai".
    if (notify) {
      var interactiveError = '';
      try {
        if (typeof shouldUseInteractiveMenu_ === 'function' && shouldUseInteractiveMenu_() && typeof sendKiriminInteractiveMenu_ === 'function') {
          send = sendKiriminInteractiveMenu_(phone, {
            customerName: getRememberedWhatsAppCustomerName_(phone) || ''
          });
          if (!(send && send.success)) interactiveError = (send && (send.error || send.response)) ? String(send.error || send.response) : 'Interactive menu gagal.';
        }
      } catch(eMenuSend) {
        interactiveError = eMenuSend.message || String(eMenuSend);
        send = { success: false, error: interactiveError };
      }

      if (!(send && send.success)) {
        var fallbackSend = sendWhatsAppMessage_(phone, menuReply, {});
        if (interactiveError) fallbackSend.interactiveFallbackError = interactiveError;
        send = fallbackSend;
      }
    }

    logWhatsApp_(phone, 'Akhiri Chat Admin dari Dashboard', 'AGENT_CHAT_END', aduan ? aduan.id : (form.id || ''), notify ? menuReply : '', send && send.success ? 'SENT' : 'FAILED', JSON.stringify({ sessionUser: sessionUser, send: send }));

    return { success: true, phone: phone, active: false, send: send, message: 'Chat Admin diakhiri. Menu awal SIAGA TIARA dikirim ke pelanggan.' };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientSendAgentChatMessage(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    var chatAdminAllowed = requireAdminPusatChatAdmin_(sessionUser);
    if (chatAdminAllowed) return chatAdminAllowed;

    var aduan = getAduanForAgentChat_(form.id || form.aduanId || '');
    if (aduan && !dashboardUserCanAccessAduan_(sessionUser, aduan)) return { success: false, error: 'Anda tidak punya akses ke aduan ini.' };

    var phone = normalizePhone_(form.noHp || form.phone || (aduan && aduan.noHp) || '');
    var message = String(form.message || '').trim();
    if (!phone) return { success: false, error: 'No HP pelanggan kosong/tidak valid.' };
    if (!message) return { success: false, error: 'Isi pesan balasan admin masih kosong.' };

    var currentStatus = getAgentChatStatusByPhone_(phone);
    var windowInfo = getChatAdmin24hWindowInfo_(phone, currentStatus.data || {});
    if (!windowInfo.canReply) {
      return { success: false, blocked24h: true, windowInfo: windowInfo, error: buildChatAdmin24hClosedError_(windowInfo) };
    }

    var minutes = normalizeAgentChatMinutes_(form.minutes || 15);
    var data = {
      context: 'Balasan Admin Dashboard',
      aduanId: aduan ? aduan.id : (form.id || ''),
      activatedBy: sessionUser.nama || sessionUser.username || 'Admin',
      activatedByRole: sessionUser.role || '',
      source: 'dashboard_reply',
      expiresMinutes: minutes,
      lastAgentMessage: truncateForLog_(message || '', 500),
      lastAgentMessageAt: new Date().toISOString()
    };
    activateAgentChatSession_(phone, data, minutes);

    var send = sendWhatsAppMessage_(phone, message, {});
    logWhatsApp_(phone, 'Balasan admin dashboard', 'AGENT_CHAT_REPLY', data.aduanId || '', message, send && send.success ? 'SENT' : 'FAILED', JSON.stringify({ sessionUser: sessionUser, send: send, data: data }));

    return { success: !!(send && send.success), phone: phone, active: true, send: send, message: send && send.success ? 'Balasan admin berhasil dikirim. Bot tetap dipause untuk pelanggan ini selama 15 menit.' : ('Gagal kirim balasan admin: ' + ((send && send.error) || 'Unknown error')) };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

// ============================================================
// V10.9.22 - ADMIN HANDOFF HELPER
// ============================================================

function handleAdminHandoff_(phone, context) {
  context = context || 'Admin';

  if (isRestrictedOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_ADMIN',
      reply: buildOutsideHoursBlockedReply_('Hubungi Admin'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  var data = {
    context: context || 'Hubungi Admin',
    source: 'customer_request',
    expiresMinutes: 15,
    lastCustomerMessage: 'Pelanggan meminta dihubungkan ke admin.',
    lastCustomerMessageAt: new Date().toISOString()
  };
  try {
    var activeAduanList = getActiveAduansByPhone_(phone, 1);
    if (activeAduanList && activeAduanList.length) data.aduanId = activeAduanList[0].id || '';
  } catch(activeAduanErr) {}
  activateAgentChatSession_(phone, data, 15);
  try { notifyAgentChatAdmins_(phone, 'Pelanggan meminta terhubung dengan admin.', data, true); } catch(e) {}

  return {
    success: true,
    type: 'CONTACT_ADMIN',
    reply: [
      'Baik, Anda akan dihubungkan ke admin.',
      '',
      'Mohon tuliskan keperluan Anda secara singkat.',
      '',
      'Ketik *menu* jika ingin kembali ke layanan otomatis.'
    ].join('\n'),
    navButtons: [
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}


// ============================================================
// V10.9.21 - INFO LAYANAN & PEMBAYARAN
// V10.9.24 - DETAIL LAYANAN DARI WEBSITE
// ============================================================

function buildInfoDetailButtons_() {
  return [
    { id: 'PAY_INFO', title: 'Kembali' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildKendalaPembayaranButtons_() {
  return [
    { id: 'PAY_ADMIN', title: 'Hubungi Admin' },
    { id: 'PAY_INFO', title: 'Kembali' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildInfoLayananRows_() {
  return [
    { id: 'PAY_SAMBUNGAN_BARU', title: 'Sambungan Baru', description: 'Syarat dan alur pemasangan baru' },
    { id: 'PAY_CARA_BAYAR', title: 'Cara Bayar', description: 'Panduan pembayaran tagihan' },
    { id: 'PAY_KENDALA_BAYAR', title: 'Kendala Bayar', description: 'Sudah bayar/status belum berubah' },
    { id: 'PAY_AIR_TANGKI', title: 'Air Tangki', description: 'Daftar harga layanan air tangki' },
    { id: 'PAY_BALIK_NAMA', title: 'Balik Nama', description: 'Alur proses balik nama pelanggan' },
    { id: 'PAY_PINDAH_METER', title: 'Pindah Meter Air', description: 'Alur pemindahan water meter' },
    { id: 'PAY_SAMBUNG_KEMBALI', title: 'Sambung Kembali', description: 'Panduan sambung kembali layanan' },
    { id: 'PAY_SAMBUNG_PINDAH', title: 'Sambungan Pindah', description: 'Alur pemindahan meter air' },
    { id: 'NAV_MENU', title: 'Menu Utama', description: 'Kembali ke layanan utama' }
  ];
}

function buildInfoPembayaranReply_() {
  return [
    'ℹ️ *Info Layanan & Pembayaran*',
    '',
    'Silakan pilih informasi yang Anda butuhkan.',
    '',
    '• Sambungan Baru',
    '• Cara Bayar',
    '• Kendala Bayar',
    '• Air Tangki',
    '• Balik Nama',
    '• Pindah Meter Air',
    '• Sambung Kembali',
    '• Sambungan Pemindahan Meter Air'
  ].join('\n');
}

function buildSambunganBaruReply_() {
  return [
    '*Syarat Sambungan Baru*',
    '',
    '1. Mengisi formulir dan melengkapi persyaratan pemasangan baru atau datang langsung ke kantor cabang terdekat.',
    '2. Petugas akan melakukan proses survei lokasi.',
    '3. Pelanggan melakukan pembayaran biaya pemasangan baru.'
  ].join('\n');
}

function sendKiriminInfoLayananMenu_(phone) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk Info Layanan.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: buildInfoPembayaranReply_()
      },
      action: {
        button: 'Pilih Info',
        sections: [
          {
            title: 'Info Layanan',
            rows: buildInfoLayananRows_()
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function buildCaraBayarReply_() {
  return [
    '💳 *Cara Bayar Tagihan*',
    '',
    'Pembayaran tagihan air dapat dilakukan melalui:',
    '',
    '1. Loket resmi PERUMDAM',
    '2. Kantor cabang/unit pelayanan',
    '3. Mitra pembayaran resmi jika tersedia',
    '4. Kanal pembayaran digital yang bekerja sama dengan PERUMDAM jika tersedia',
    '',
    'Pastikan *No Pelanggan* sudah benar sebelum melakukan pembayaran.',
    'Simpan bukti pembayaran sampai status tagihan berhasil terkonfirmasi.',
    '',
    'Jika pembayaran sudah dilakukan tetapi status belum berubah, pilih *Kendala Bayar*.'
  ].join('\n');
}

function buildKendalaPembayaranReply_() {
  return [
    '💳 *Kendala Pembayaran*',
    '',
    'Untuk pengecekan pembayaran, mohon siapkan:',
    '',
    '• No Pelanggan',
    '• Nama pelanggan',
    '• Tanggal pembayaran',
    '• Kanal pembayaran',
    '• Nominal pembayaran',
    '• Bukti pembayaran jika ada',
    '',
    'Kendala yang bisa dibantu:',
    '• Sudah bayar tapi status belum berubah',
    '• Pembayaran gagal tetapi saldo terpotong',
    '• Salah input No Pelanggan',
    '• Tagihan terasa tidak sesuai',
    '• Pembayaran dobel',
    '',
    'Admin akan membantu pengecekan pada jam kerja.'
  ].join('\n');
}

function buildAirTangkiReply_() {
  return [
    '🚚 *Air Tangki*',
    '',
    'Berikut daftar harga layanan air tangki:',
    '',
    '*Kelompok Sosial*',
    '• 0–10 Km: Rp145.000',
    '• 11–20 Km: Rp175.000',
    '• 21–30 Km: Rp205.000',
    '• 31–40 Km: Rp230.000',
    '• >41 Km: Rp260.000',
    '',
    '*Kelompok Niaga*',
    '• 0–10 Km: Rp225.000',
    '• 11–20 Km: Rp265.000',
    '• 21–30 Km: Rp310.000',
    '• 31–40 Km: Rp355.000',
    '• >41 Km: Rp400.000'
  ].join('\n');
}

function buildBalikNamaReply_() {
  return [
    '📝 *Alur Proses Balik Nama*',
    '',
    'Berikut alur proses balik nama:',
    '',
    '1. Pelanggan mendaftar, mengisi dan menandatangani formulir di cabang dengan membawa rekening terakhir yang sudah dilunasi dan KTP.',
    '2. Membayar biaya administrasi sebesar *Rp55.500*.',
    '3. Cabang bersurat ke Bidang Hubungan Langganan untuk diproses.',
    '4. Nama pelanggan akan berubah pada bulan berikutnya.'
  ].join('\n');
}

function buildPindahMeterAirReply_() {
  return [
    '🔧 *Alur Pindah Meter Air*',
    '',
    'Berikut alur pelayanan pindah meter air pelanggan:',
    '',
    '1. Pelanggan mengajukan permohonan pemindahan water meter ke kantor cabang atau unit layanan PDAM terdekat.',
    '2. Petugas PDAM memverifikasi permohonan dan melakukan survei lokasi untuk menilai kelayakan teknis pemindahan.',
    '3. Jika disetujui, PDAM akan menentukan biaya pemindahan.',
    '4. Petugas PDAM datang ke lokasi untuk melakukan pemindahan water meter pada lokasi yang telah ditentukan.',
    '5. Pelanggan memastikan lokasi baru sudah dipersiapkan sesuai petunjuk petugas.'
  ].join('\n');
}

function buildSambungKembaliReply_() {
  return [
    '🔁 *Panduan Sambung Kembali*',
    '',
    'Panduan sambung kembali layanan yang telah terputus:',
    '',
    '1. Pelanggan wajib melunasi tunggakan dan membayar biaya administrasi sebesar *Rp50.000*.',
    '2. Petugas melakukan pemasangan water meter.'
  ].join('\n');
}

function buildSambunganPemindahanMeterReply_() {
  return [
    '🔁 *Panduan Sambungan Pemindahan Meter Air*',
    '',
    'Berikut alur sambungan pemindahan meter air:',
    '',
    '1. Berita acara pencabutan.',
    '2. Membayar seluruh tunggakan rekening yang tertunggak.',
    '3. Petugas melakukan survei.',
    '4. Pemasangan.',
    '5. Melakukan balik nama.'
  ].join('\n');
}


// ============================================================
// V10.9.57 - CEK TAGIHAN PELANGGAN VIA API BILLING
// ============================================================

function getBillingApiConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    baseUrl: String(props.getProperty('BILLING_API_BASE_URL') || CONFIG.BILLING_API_BASE_URL || '').replace(/\/+$/, ''),
    token: String(props.getProperty('BILLING_API_TOKEN') || CONFIG.BILLING_API_TOKEN || '').trim(),
    maskCustomerData: String(props.getProperty('BILLING_MASK_CUSTOMER_DATA') || CONFIG.BILLING_MASK_CUSTOMER_DATA || 'YA').toUpperCase() !== 'TIDAK',
    maxRows: Number(props.getProperty('BILLING_MAX_DETAIL_ROWS') || CONFIG.BILLING_MAX_DETAIL_ROWS || 6)
  };
}

function setBillingApiConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var endpointPrompt = ui.prompt(
    '1/3 - Base URL API Tagihan',
    'Isi base URL API tagihan.\n\nContoh:\nhttp://loteng.homeip.net/webapi/pelanggan',
    ui.ButtonSet.OK_CANCEL
  );
  if (endpointPrompt.getSelectedButton() !== ui.Button.OK) return;

  var tokenPrompt = ui.prompt(
    '2/3 - Token API Tagihan',
    'Tempel token API tagihan dari dokumentasi billing.',
    ui.ButtonSet.OK_CANCEL
  );
  if (tokenPrompt.getSelectedButton() !== ui.Button.OK) return;

  var maskPrompt = ui.prompt(
    '3/3 - Masking Data Pelanggan',
    'Isi YA agar nama/alamat disamarkan di WhatsApp.\nIsi TIDAK jika ingin tampil penuh.\n\nRekomendasi: YA',
    ui.ButtonSet.OK_CANCEL
  );
  if (maskPrompt.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('BILLING_API_BASE_URL', endpointPrompt.getResponseText().trim().replace(/\/+$/, ''));
  props.setProperty('BILLING_API_TOKEN', tokenPrompt.getResponseText().trim());
  props.setProperty('BILLING_MASK_CUSTOMER_DATA', String(maskPrompt.getResponseText() || 'YA').trim().toUpperCase() || 'YA');
  clearRuntimePropCache_();

  ui.alert(
    'Konfigurasi API tagihan tersimpan',
    'Fitur Cek Tagihan pada menu utama WhatsApp sudah dapat memakai konfigurasi ini.',
    ui.ButtonSet.OK
  );
}

function testBillingApiByNoPelanggan() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Tes API Cek Tagihan', 'Masukkan No Pelanggan / NOSAMW:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  var noPelanggan = extractNoPelangganForBilling_(res.getResponseText());
  if (!noPelanggan) {
    ui.alert('No Pelanggan tidak valid.');
    return;
  }

  var result = getBillingTagihanByNoPelanggan_(noPelanggan);
  var debug = buildBillingDebugText_(result);
  ui.alert(
    result.success ? 'Cek tagihan berhasil' : 'Cek tagihan gagal',
    buildBillingTagihanReply_(result, noPelanggan) + (debug ? '\n\n--- DEBUG ADMIN ---\n' + debug : ''),
    ui.ButtonSet.OK
  );
}

function isCekTagihanCommand_(text) {
  text = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return false;

  // V10.9.142: nomor menu Cek Tagihan menjadi 3.
  return text === '3' ||
    text === 'cek tagihan' ||
    text === 'cek rekening' ||
    text === 'rekening air' ||
    text.indexOf('cek tagihan') !== -1 ||
    text.indexOf('tagihan pelanggan') !== -1 ||
    text.indexOf('tagihan air') !== -1 ||
    text.indexOf('cek rekening') !== -1;
}


function buildAskBillingNoPelangganReply_() {
  return [
    '*Cek Tagihan Pelanggan*',
    '',
    'Silakan kirim No Pelanggan yang ingin dicek.',
    '',
    'Pastikan nomor pelanggan ditulis lengkap sesuai rekening.',
    '',
    'Ketik *batal* untuk membatalkan.'
  ].join('\n');
}

function buildBillingNavButtons_() {
  // V10.9.283:
  // Setelah hasil Cek Tagihan tampil, pelanggan tetap berada di mode Cek Tagihan.
  // Jadi tidak perlu tombol "Cek Tagihan Lagi". Untuk cek nomor lain, cukup kirim No Pelanggan baru.
  return [
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function handleStartCekTagihan_(phone) {
  setWhatsAppSession_(phone, 'BILLING_AWAIT_NOPEL', {});
  return {
    success: true,
    type: 'BILLING_ASK_NOPEL',
    reply: buildAskBillingNoPelangganReply_(),
    navButtons: [
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}

function handleBillingNoPelangganInput_(message, phone, session) {
  var noPelanggan = extractNoPelangganForBilling_(message);
  if (!noPelanggan) {
    setWhatsAppSession_(phone, 'BILLING_AWAIT_NOPEL', {});
    return {
      success: false,
      type: 'BILLING_INVALID_NOPEL',
      reply: [
        '*Cek Tagihan Pelanggan*',
        '',
        'No Pelanggan belum terbaca.',
        'Silakan kirim No Pelanggan berupa angka saja sesuai rekening.'
      ].join('\n'),
      navButtons: [
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var billing = getBillingTagihanByNoPelanggan_(noPelanggan);

  // V10.9.283:
  // Jangan langsung keluar ke Menu Utama setelah 1 kali cek.
  // Session tetap di BILLING_AWAIT_NOPEL agar pelanggan bisa cek nomor lain berkali-kali.
  setWhatsAppSession_(phone, 'BILLING_AWAIT_NOPEL', {
    lastNoPelanggan: noPelanggan,
    lastCheckedAt: new Date().toISOString()
  });

  return {
    success: billing.success,
    type: billing.success ? 'BILLING_RESULT' : 'BILLING_NOT_FOUND_OR_ERROR',
    id: noPelanggan,
    reply: buildBillingTagihanReply_(billing, noPelanggan),
    navButtons: buildBillingNavButtons_()
  };
}

function extractNoPelangganForBilling_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  // Pertahankan angka nol di depan. Hilangkan spasi, titik, strip, dan karakter lain.
  var digits = text.replace(/[^0-9]/g, '');
  if (!digits || digits.length < 4 || digits.length > 20) return '';
  return digits;
}


function safeParseBillingJson_(text) {
  text = String(text || '').trim();
  if (!text) return { ok: false, error: 'EMPTY_RESPONSE' };

  // Hilangkan BOM/karakter awal yang kadang muncul dari server PHP.
  text = text.replace(/^\uFEFF/, '').trim();

  try {
    return { ok: true, data: JSON.parse(text), cleaned: text };
  } catch(firstErr) {
    // Beberapa server mengirim warning/HTML kecil sebelum JSON.
    // Ambil potongan JSON paling mungkin agar parser tidak terlalu kaku.
    var firstObj = text.indexOf('{');
    var firstArr = text.indexOf('[');
    var first = -1;
    if (firstObj >= 0 && firstArr >= 0) first = Math.min(firstObj, firstArr);
    else first = Math.max(firstObj, firstArr);

    var lastObj = text.lastIndexOf('}');
    var lastArr = text.lastIndexOf(']');
    var last = Math.max(lastObj, lastArr);

    if (first >= 0 && last > first) {
      var chunk = text.substring(first, last + 1).trim();
      try {
        return { ok: true, data: JSON.parse(chunk), cleaned: chunk, recovered: true };
      } catch(secondErr) {}
    }

    return { ok: false, error: firstErr && firstErr.message ? firstErr.message : String(firstErr), raw: text };
  }
}

function pickBillingValue_(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  keys = keys || [];

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }

  // Fallback case-insensitive, karena API billing kadang mengirim field lower/upper campur.
  var map = {};
  Object.keys(obj).forEach(function(k) { map[String(k).toLowerCase()] = k; });
  for (var j = 0; j < keys.length; j++) {
    var lk = String(keys[j]).toLowerCase();
    if (map[lk] && obj[map[lk]] !== null && obj[map[lk]] !== undefined && String(obj[map[lk]]).trim() !== '') return obj[map[lk]];
  }
  return '';
}

function isBillingTruthy_(value) {
  if (value === true) return true;
  if (value === 1) return true;
  var s = String(value || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'ok' || s === 'success' || s === 'berhasil' || s === 'found';
}

function getBillingPayloadStatus_(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return pickBillingValue_(payload, ['status', 'success', 'result', 'ok', 'STATUS', 'SUCCESS']);
}

function getBillingPayloadMessage_(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return String(pickBillingValue_(payload, ['message', 'msg', 'pesan', 'error', 'keterangan', 'MESSAGE', 'PESAN']) || '');
}

function ensureArrayBilling_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    // Kalau object ini tampak seperti satu item tagihan, bungkus jadi array.
    var hasBillingField = pickBillingValue_(value, ['TAGIHAN', 'tagihan', 'TOTAL', 'total', 'JUMLAH', 'jumlah', 'PERIODE', 'periode']);
    if (hasBillingField !== '') return [value];
  }
  return [];
}

function extractBillingList_(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  var candidates = [];
  if (payload && typeof payload === 'object') {
    candidates.push(payload.pelanggan);
    candidates.push(payload.PELANGGAN);
    candidates.push(payload.tagihan);
    candidates.push(payload.TAGIHAN);
    candidates.push(payload.data);
    candidates.push(payload.DATA);
    candidates.push(payload.result);
    candidates.push(payload.RESULT);
    candidates.push(payload.results);
    candidates.push(payload.items);
    candidates.push(payload.rows);

    if (payload.data && typeof payload.data === 'object') {
      candidates.push(payload.data.pelanggan);
      candidates.push(payload.data.PELANGGAN);
      candidates.push(payload.data.tagihan);
      candidates.push(payload.data.TAGIHAN);
      candidates.push(payload.data.result);
      candidates.push(payload.data.results);
      candidates.push(payload.data.items);
      candidates.push(payload.data.rows);
    }

    if (payload.result && typeof payload.result === 'object') {
      candidates.push(payload.result.pelanggan);
      candidates.push(payload.result.tagihan);
      candidates.push(payload.result.data);
      candidates.push(payload.result.items);
    }
  }

  for (var i = 0; i < candidates.length; i++) {
    var arr = ensureArrayBilling_(candidates[i]);
    if (arr.length) return arr;
  }

  return ensureArrayBilling_(payload);
}

function normalizeBillingItem_(item, noPelanggan) {
  item = item || {};
  return {
    NOSAMW: String(pickBillingValue_(item, ['NOSAMW', 'nosamw', 'NO_SAMW', 'no_samw', 'NOPEL', 'nopel', 'NO_PELANGGAN', 'no_pelanggan', 'NOPLANG', 'noplang', 'IDPEL', 'idpel']) || noPelanggan || ''),
    NAMA: String(pickBillingValue_(item, ['NAMA', 'nama', 'NAMA_PELANGGAN', 'nama_pelanggan', 'NM_PELANGGAN', 'nmpelanggan']) || '-'),
    ALAMAT: String(pickBillingValue_(item, ['ALAMAT', 'alamat', 'ALAMAT_PELANGGAN', 'alamat_pelanggan']) || '-'),
    GOLONGAN: String(pickBillingValue_(item, ['GOLONGAN', 'golongan', 'GOL', 'gol', 'TARIF', 'tarif']) || '-'),
    PERIODE: String(pickBillingValue_(item, ['PERIODE', 'periode', 'BULAN', 'bulan', 'REK_BULAN', 'rek_bulan']) || '-'),
    METER_LALU: String(pickBillingValue_(item, ['METER_LALU', 'meter_lalu', 'STAN_LALU', 'stan_lalu', 'AWAL', 'awal']) || '-'),
    METER_KINI: String(pickBillingValue_(item, ['METER_KINI', 'meter_kini', 'STAN_KINI', 'stan_kini', 'AKHIR', 'akhir']) || '-'),
    PAKAI: String(pickBillingValue_(item, ['PAKAI', 'pakai', 'PEMAKAIAN', 'pemakaian', 'M3', 'm3']) || '-'),
    TAGIHAN: pickBillingValue_(item, ['TAGIHAN', 'tagihan', 'TOTAL', 'total', 'JUMLAH', 'jumlah', 'JML_TAGIHAN', 'jml_tagihan', 'TOTAL_TAGIHAN', 'total_tagihan', 'RP_TAGIHAN', 'rp_tagihan', 'rekening']) || 0
  };
}

function normalizeBillingList_(list, noPelanggan) {
  return (list || []).map(function(item) {
    return normalizeBillingItem_(item, noPelanggan);
  }).filter(function(item) {
    return item && (String(item.NOSAMW || '').trim() || parseBillingAmount_(item.TAGIHAN) > 0 || String(item.PERIODE || '').trim());
  });
}

function ensureBillingLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  var name = 'LOG_BILLING';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Waktu', 'No Pelanggan', 'Method', 'Status', 'HTTP', 'Error Type', 'Pesan', 'Endpoint', 'Raw Sample']);
  }
  return sh;
}

function maskBillingUrl_(url) {
  return String(url || '').replace(/token=([^&]*)/i, 'token=***');
}

function logBillingApiResult_(methodName, noPelanggan, result, url) {
  try {
    // Log hanya kegagalan/response aneh supaya sheet tidak cepat penuh.
    if (result && result.success) return;
    var sh = ensureBillingLogSheet_();
    if (!sh) return;
    var raw = String((result && (result.raw || result.parseRaw)) || '');
    if (raw.length > 500) raw = raw.substring(0, 500);
    sh.appendRow([
      new Date(),
      noPelanggan || '',
      methodName || '',
      result && result.success ? 'SUCCESS' : 'FAILED',
      result && result.httpCode ? result.httpCode : '',
      result && result.errorType ? result.errorType : '',
      result && (result.error || result.message) ? String(result.error || result.message) : '',
      maskBillingUrl_(url),
      raw
    ]);
  } catch(e) {}
}

function buildBillingDebugText_(result) {
  if (!result) return '';
  var lines = [];
  if (result.errorType) lines.push('Error Type: ' + result.errorType);
  if (result.httpCode) lines.push('HTTP: ' + result.httpCode);
  if (result.method) lines.push('Method: ' + result.method);
  if (result.message) lines.push('Pesan API: ' + result.message);
  if (result.error) lines.push('Error: ' + result.error);
  if (result.source) lines.push('Source: ' + result.source);
  if (result.raw) {
    var raw = String(result.raw);
    if (raw.length > 300) raw = raw.substring(0, 300) + '...';
    lines.push('Raw: ' + raw);
  }
  return lines.join('\n');
}

function callBillingApi_(methodName, noPelanggan) {
  var cfg = getBillingApiConfig_();
  if (!cfg.baseUrl || !cfg.token) {
    return { success: false, errorType: 'CONFIG_EMPTY', error: 'API tagihan belum dikonfigurasi.', method: methodName };
  }

  var url = cfg.baseUrl + '/' + methodName +
    '?token=' + encodeURIComponent(cfg.token) +
    '&nosamw=' + encodeURIComponent(noPelanggan);

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true
    });

    var httpCode = res.getResponseCode();
    var text = res.getContentText() || '';
    var parsed = safeParseBillingJson_(text);

    if (!parsed.ok) {
      var bad = {
        success: false,
        errorType: 'INVALID_JSON',
        httpCode: httpCode,
        method: methodName,
        error: 'Response API tagihan tidak dapat dibaca.',
        raw: text
      };
      logBillingApiResult_(methodName, noPelanggan, bad, url);
      return bad;
    }

    var result = {
      success: httpCode >= 200 && httpCode < 300,
      httpCode: httpCode,
      method: methodName,
      data: parsed.data,
      raw: text,
      recoveredJson: parsed.recovered === true
    };

    if (!result.success) logBillingApiResult_(methodName, noPelanggan, result, url);
    return result;
  } catch(err) {
    var fail = {
      success: false,
      errorType: 'FETCH_ERROR',
      method: methodName,
      error: err && err.message ? err.message : String(err)
    };
    logBillingApiResult_(methodName, noPelanggan, fail, url);
    return fail;
  }
}

function getBillingTagihanByNoPelanggan_(noPelanggan) {
  noPelanggan = extractNoPelangganForBilling_(noPelanggan);
  if (!noPelanggan) return { success: false, errorType: 'INVALID_NOPEL' };

  var detail = callBillingApi_('getTagihanDetail', noPelanggan);
  if (!detail.success) return detail;

  var data = detail.data || {};
  var list = normalizeBillingList_(extractBillingList_(data), noPelanggan);
  var statusValue = getBillingPayloadStatus_(data);
  var statusOk = isBillingTruthy_(statusValue);
  var apiMessage = getBillingPayloadMessage_(data);

  // Jangan terlalu kaku: kalau ada rincian tagihan, tetap tampilkan walaupun field status API bukan string "true".
  if (list.length) {
    return {
      success: true,
      noPelanggan: noPelanggan,
      pelanggan: list,
      source: 'getTagihanDetail',
      httpCode: detail.httpCode,
      message: apiMessage
    };
  }

  // Jika tidak ada tagihan, cek apakah pelanggan ada atau tidak.
  var cek = callBillingApi_('cekPelanggan', noPelanggan);
  if (cek.success && cek.data) {
    var cekData = cek.data || {};
    var cekStatus = getBillingPayloadStatus_(cekData);
    var exists = isBillingTruthy_(cekStatus);
    var cekList = normalizeBillingList_(extractBillingList_(cekData), noPelanggan);
    if (cekList.length) exists = true;
    return {
      success: false,
      noPelanggan: noPelanggan,
      errorType: exists ? 'NO_BILL' : 'CUSTOMER_NOT_FOUND',
      customerExists: exists,
      httpCode: cek.httpCode,
      method: 'cekPelanggan',
      message: getBillingPayloadMessage_(cekData)
    };
  }

  // Kalau detail status API true tapi tidak ada rincian, anggap tidak ada tagihan aktif.
  if (statusOk) {
    return {
      success: false,
      noPelanggan: noPelanggan,
      errorType: 'NO_BILL',
      customerExists: true,
      httpCode: detail.httpCode,
      method: 'getTagihanDetail',
      message: apiMessage
    };
  }

  return {
    success: false,
    noPelanggan: noPelanggan,
    errorType: 'NO_BILL_UNKNOWN',
    customerExists: null,
    httpCode: detail.httpCode,
    method: 'getTagihanDetail',
    message: apiMessage,
    raw: detail.raw
  };
}

function parseBillingAmount_(value) {
  var text = String(value || '0').replace(/[^0-9\-]/g, '');
  var n = Number(text || 0);
  return isNaN(n) ? 0 : n;
}

function formatRupiahSiaga_(value) {
  var n = parseBillingAmount_(value);
  var sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  var s = String(Math.round(n));
  var out = '';
  while (s.length > 3) {
    out = '.' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  out = s + out;
  return sign + 'Rp' + out;
}

function formatBillingPeriod_(periode) {
  var text = String(periode || '').replace(/[^0-9]/g, '');
  if (text.length !== 6) return String(periode || '-');

  var year = text.substring(0, 4);
  var month = Number(text.substring(4, 6));
  var names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  if (month < 1 || month > 12) return text;
  return names[month - 1] + ' ' + year;
}

function maskCustomerText_(text, type) {
  text = String(text || '').trim();
  if (!text) return '-';

  var cfg = getBillingApiConfig_();
  if (!cfg.maskCustomerData) return text;

  var parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return '-';

  function maskWord(w) {
    if (!w) return '';
    if (w.length <= 2) return w.charAt(0) + '*';
    if (w.length <= 4) return w.charAt(0) + '**' + w.charAt(w.length - 1);
    return w.substring(0, 2) + '***' + w.charAt(w.length - 1);
  }

  if (type === 'alamat') {
    return parts.slice(0, 2).map(maskWord).join(' ');
  }

  return parts.slice(0, 3).map(maskWord).join(' ');
}

function buildBillingNextCheckInstruction_() {
  return [
    '',
    'Untuk cek nomor pelanggan lain, langsung kirim *No Pelanggan*.',
    'Pilih *Menu Utama* jika sudah selesai.'
  ].join('\n');
}

function buildBillingTagihanReply_(result, noPelanggan) {
  noPelanggan = noPelanggan || (result && result.noPelanggan) || '';

  if (!result || result.errorType === 'CONFIG_EMPTY') {
    return [
      '*Cek Tagihan Pelanggan*',
      '',
      'Fitur cek tagihan belum dapat digunakan karena API tagihan belum dikonfigurasi.',
      '',
      'Silakan hubungi admin atau Bidang IT Sekretariat Perusahaan untuk pengecekan.'
    ].join('\n') + buildBillingNextCheckInstruction_();
  }

  if (result.errorType === 'CUSTOMER_NOT_FOUND') {
    return [
      '*Cek Tagihan Pelanggan*',
      '',
      'No Pelanggan: *' + noPelanggan + '*',
      'Status Tagihan: *Nomor Pelanggan Tidak Ditemukan*',
      '',
      'Nomor pelanggan tidak ditemukan.',
      'Pastikan No Pelanggan sudah benar, lalu coba kembali.'
    ].join('\n') + buildBillingNextCheckInstruction_();
  }

  if (result.errorType === 'NO_BILL') {
    return [
      '*Cek Tagihan Pelanggan*',
      '',
      'No Pelanggan: *' + noPelanggan + '*',
      'Status Tagihan: *Tidak Ada Tagihan Aktif*',
      '',
      'Nomor pelanggan terdaftar dan tidak memiliki tagihan aktif.',
      '',
      'Jika merasa masih ada tagihan, silakan hubungi admin untuk pengecekan.'
    ].join('\n') + buildBillingNextCheckInstruction_();
  }

  if (!result.success) {
    return [
      '*Cek Tagihan Pelanggan*',
      '',
      'Cek tagihan belum berhasil diproses.',
      'Server tagihan sedang tidak dapat diakses atau response tidak terbaca.',
      '',
      'Silakan coba beberapa saat lagi.'
    ].join('\n') + buildBillingNextCheckInstruction_();
  }

  var list = result.pelanggan || [];
  if (!list.length) {
    return [
      '*Cek Tagihan Pelanggan*',
      '',
      'No Pelanggan: *' + noPelanggan + '*',
      'Status Tagihan: *Tidak Ada Rincian Tagihan*',
      '',
      'Tidak ada rincian tagihan yang dapat ditampilkan.'
    ].join('\n') + buildBillingNextCheckInstruction_();
  }

  var first = list[0] || {};
  var cfg = getBillingApiConfig_();
  var maxRows = Math.max(1, Number(cfg.maxRows || 6));
  var shown = list.slice(0, maxRows);
  var total = 0;

  var lines = [
    '*Info Tagihan Pelanggan*',
    '',
    'No Pelanggan: *' + String(first.NOSAMW || noPelanggan || '-') + '*',
    'Nama: ' + maskCustomerText_(first.NAMA || '-', 'nama'),
    'Alamat: ' + maskCustomerText_(first.ALAMAT || '-', 'alamat'),
    'Golongan: ' + String(first.GOLONGAN || '-'),
    'Status Tagihan: *Belum Lunas*',
    '',
    '*Rincian Tagihan:*'
  ];

  shown.forEach(function(item, idx) {
    var amount = parseBillingAmount_(item.TAGIHAN);
    total += amount;
    lines.push('');
    lines.push((idx + 1) + '. Periode: ' + formatBillingPeriod_(item.PERIODE));
    lines.push('   Meter lalu/kini: ' + String(item.METER_LALU || '-') + ' / ' + String(item.METER_KINI || '-'));
    lines.push('   Pemakaian: ' + String(item.PAKAI || '-') + ' m3');
    lines.push('   Tagihan: ' + formatRupiahSiaga_(amount));
  });

  if (list.length > shown.length) {
    lines.push('');
    lines.push('Masih ada ' + (list.length - shown.length) + ' periode lain yang tidak ditampilkan agar pesan tetap ringkas.');
  }

  // Total tetap menghitung seluruh daftar dari API, bukan hanya yang ditampilkan.
  if (list.length > shown.length) {
    total = 0;
    list.forEach(function(item) { total += parseBillingAmount_(item.TAGIHAN); });
  }

  lines.push('');
  lines.push('Total Tagihan: *' + formatRupiahSiaga_(total) + '*');
  lines.push('');
  lines.push('Silakan lakukan pembayaran melalui kanal resmi PERUMDAM Tirta Ardhia Rinjani.');
  lines.push('');
  lines.push('Untuk cek nomor pelanggan lain, langsung kirim *No Pelanggan*.');
  lines.push('Pilih *Menu Utama* jika sudah selesai.');

  return lines.join('\n');
}


function handleInfoPembayaranChoice_(choice, phone) {
  choice = String(choice || '').toLowerCase();

  if (choice.indexOf('hubungi admin') !== -1 || choice === 'admin' || choice.indexOf('chat admin') !== -1) {
    return handleAdminHandoff_(phone, 'Info Layanan & Pembayaran');
  }

  if (choice.indexOf('sambungan baru') !== -1 || choice.indexOf('pasang baru') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'sambungan_baru' });
    return {
      success: true,
      type: 'INFO_SAMBUNGAN_BARU',
      reply: buildSambunganBaruReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('cara') !== -1 && choice.indexOf('bayar') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'cara_bayar' });
    return {
      success: true,
      type: 'INFO_CARA_BAYAR',
      reply: buildCaraBayarReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('kendala') !== -1 || choice.indexOf('gagal') !== -1 || choice.indexOf('saldo') !== -1 || choice.indexOf('dobel') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'kendala_bayar' });
    return {
      success: true,
      type: 'INFO_KENDALA_PEMBAYARAN',
      reply: buildKendalaPembayaranReply_(),
      navButtons: buildKendalaPembayaranButtons_()
    };
  }

  if (choice.indexOf('air tangki') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'air_tangki' });
    return {
      success: true,
      type: 'INFO_AIR_TANGKI',
      reply: buildAirTangkiReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('balik nama') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'balik_nama' });
    return {
      success: true,
      type: 'INFO_BALIK_NAMA',
      reply: buildBalikNamaReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (
    choice.indexOf('sambungan pindah') !== -1 ||
    choice.indexOf('sambungan pemindahan') !== -1 ||
    choice.indexOf('pemindahan meter') !== -1
  ) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'sambungan_pemindahan_meter' });
    return {
      success: true,
      type: 'INFO_SAMBUNGAN_PINDAH_METER',
      reply: buildSambunganPemindahanMeterReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('pindah meter') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'pindah_meter' });
    return {
      success: true,
      type: 'INFO_PINDAH_METER',
      reply: buildPindahMeterAirReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('sambung kembali') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'sambung_kembali' });
    return {
      success: true,
      type: 'INFO_SAMBUNG_KEMBALI',
      reply: buildSambungKembaliReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  setWhatsAppSession_(phone, 'INFO_LAYANAN_MENU', {});
  return {
    success: true,
    type: 'INFO_LAYANAN_MENU',
    reply: buildInfoPembayaranReply_(),
    infoLayananMenu: true
  };
}
