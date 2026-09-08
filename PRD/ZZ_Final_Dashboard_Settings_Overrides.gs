// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: ZZ_Final_Dashboard_Settings_Overrides.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

function getSlaJamForPrioritas_(prioritas) {
  prioritas = String(prioritas || '').trim();
  var defaults = (CONFIG && CONFIG.SLA) ? CONFIG.SLA : { 'Darurat': 2, 'Tinggi': 4, 'Sedang': 8, 'Rendah': 24 };
  var keyMap = {
    'Darurat': 'SLA_DARURAT_HOURS',
    'Tinggi': 'SLA_TINGGI_HOURS',
    'Sedang': 'SLA_SEDANG_HOURS',
    'Rendah': 'SLA_RENDAH_HOURS'
  };
  var canonical = defaults[prioritas] !== undefined ? prioritas : 'Sedang';
  var raw = getSiagaRuntimeSetting_(keyMap[canonical], defaults[canonical] || 8);
  var n = Number(raw);
  if (!n || n <= 0) n = Number(defaults[canonical] || 8);
  return n;
}

function ensureAdminDashboardAccess_(token) {
  var user = validateDashboardSession_(token || '');
  if (!user) throw new Error('Sesi login sudah habis. Silakan login ulang.');
  if (!user.canSeeAll) throw new Error('Pengaturan Admin hanya bisa diakses Admin Pusat.');
  return user;
}

function readDashboardUsersForAdmin_() {
  var sh = getOrCreateDashboardUsersSheet_();
  var lastRow = sh.getLastRow();
  var result = [];
  if (lastRow < 2) return result;
  var values = sh.getRange(2, 1, lastRow - 1, Math.max(8, sh.getLastColumn())).getDisplayValues();
  values.forEach(function(r, i) {
    var cabang = String(r[3] || '').trim();
    result.push({
      rowNumber: i + 2,
      username: String(r[0] || '').trim(),
      role: String(r[2] || '').trim(),
      cabang: cabang,
      cabangLabel: cabang === 'ALL' ? 'Admin Pusat' : cabang,
      nama: String(r[4] || '').trim(),
      status: String(r[5] || '').trim() || 'Aktif',
      lastLogin: String(r[7] || '').trim()
    });
  });
  return result;
}

function updateDashboardUserStatusByCabang_(cabang, active) {
  var sh = getOrCreateDashboardUsersSheet_();
  var wanted = String(cabang || '').trim();
  if (wanted === 'Admin Pusat') wanted = 'ALL';
  if (wanted === 'ALL' && active === false) throw new Error('Admin Pusat tidak boleh dinonaktifkan dari dashboard.');
  if (!wanted) throw new Error('Cabang akun kosong.');
  if (sh.getLastRow() < 2) throw new Error('Data WEB_USERS kosong.');

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(8, sh.getLastColumn())).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][3] || '').trim() === wanted) {
      sh.getRange(i + 2, 6).setValue(active ? 'Aktif' : 'Nonaktif');
      return true;
    }
  }
  throw new Error('Akun tidak ditemukan: ' + cabang);
}


function resetDashboardUserPinByRow_(rowNumber, newPin) {
  var pin = String(newPin || '').trim();
  if (!/^\d{4,12}$/.test(pin)) throw new Error('PIN baru harus angka 4-12 digit.');

  rowNumber = Number(rowNumber || 0);
  var sh = getOrCreateDashboardUsersSheet_();
  if (!rowNumber || rowNumber < 2 || rowNumber > sh.getLastRow()) {
    throw new Error('Baris akun tidak valid. Klik Muat Pengaturan lalu coba lagi.');
  }

  var lastCol = Math.max(10, sh.getLastColumn());
  if (sh.getMaxColumns() < lastCol) sh.insertColumnsAfter(sh.getMaxColumns(), lastCol - sh.getMaxColumns());

  var row = sh.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  var cabang = String(row[3] || '').trim();
  var nama = String(row[4] || '').trim();
  if (!cabang) throw new Error('Data cabang akun kosong di baris ' + rowNumber + '.');

  sh.getRange(rowNumber, 2).setNumberFormat('@').setValue(dashboardSha256_(pin));
  if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Last PIN Change');
  sh.getRange(rowNumber, 10).setValue(new Date());

  // Hapus semua session akun ini supaya PIN lama tidak ikut terbaca dari sesi tersimpan.
  try { clearDashboardSessionsForCabang_(cabang); } catch(eClear) {}
  try { clearDashboardSessionsForCabang_(nama); } catch(eClear2) {}
  return true;
}

function resetDashboardUserPinByCabang_(cabang, newPin) {
  var pin = String(newPin || '').trim();
  if (!/^\d{4,12}$/.test(pin)) throw new Error('PIN baru harus angka 4-12 digit.');

  var sh = getOrCreateDashboardUsersSheet_();
  var wantedRaw = String(cabang || '').trim();
  var wantedKey = normalizeDashboardCabangForMatch_(wantedRaw);
  if (!wantedKey) throw new Error('Cabang akun kosong.');
  if (sh.getLastRow() < 2) throw new Error('Data WEB_USERS kosong.');

  var lastCol = Math.max(10, sh.getLastColumn());
  if (sh.getMaxColumns() < lastCol) sh.insertColumnsAfter(sh.getMaxColumns(), lastCol - sh.getMaxColumns());
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var cabangKey = normalizeDashboardCabangForMatch_(r[3] || '');
    var labelKey = normalizeDashboardCabangForMatch_(r[4] || '');
    var usernameKey = normalizeDashboardUsername_(wantedRaw);
    var rowUsername = String(r[0] || '').trim();

    if (cabangKey === wantedKey || labelKey === wantedKey || (usernameKey && rowUsername === usernameKey)) {
      sh.getRange(i + 2, 2).setNumberFormat('@').setValue(dashboardSha256_(pin));
      if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Last PIN Change');
      sh.getRange(i + 2, 10).setValue(new Date());

      // Sesi lama cabang ini dihapus supaya login berikutnya benar-benar memakai PIN baru.
      try { clearDashboardSessionsForCabang_(r[3] || wantedRaw); } catch(eClear) {}
      try { clearDashboardSessionsForCabang_(r[4] || wantedRaw); } catch(eClear2) {}
      return true;
    }
  }
  throw new Error('Akun tidak ditemukan: ' + cabang);
}

function getAdminSettingsDefaults_() {
  return {
    SLA_RENDAH_HOURS: CONFIG.SLA.Rendah || 24,
    SLA_SEDANG_HOURS: CONFIG.SLA.Sedang || 8,
    SLA_TINGGI_HOURS: CONFIG.SLA.Tinggi || 4,
    SLA_DARURAT_HOURS: CONFIG.SLA.Darurat || 2,

    NOTIF_ADUAN_PETUGAS_ENABLED: 'YA',
    NOTIF_STATUS_PELANGGAN_ENABLED: 'YA',
    STATUS_NOTIF_WINDOW_HOURS: CONFIG.STATUS_NOTIF_WINDOW_HOURS || 24,
    WHATSAPP_USE_INTERACTIVE_MENU: getRuntimeProp_('WHATSAPP_USE_INTERACTIVE_MENU') || CONFIG.WHATSAPP_USE_INTERACTIVE_MENU || 'YA',

    BUSINESS_HOURS_ENABLED: getRuntimeProp_('BUSINESS_HOURS_ENABLED') || CONFIG.BUSINESS_HOURS_ENABLED || 'YA',
    BUSINESS_HOURS_START: getRuntimeProp_('BUSINESS_HOURS_START') || CONFIG.BUSINESS_HOURS_START || '08:00',
    BUSINESS_HOURS_END: getRuntimeProp_('BUSINESS_HOURS_END') || CONFIG.BUSINESS_HOURS_END || '16:00',
    BUSINESS_HOURS_DAYS: getRuntimeProp_('BUSINESS_HOURS_DAYS') || CONFIG.BUSINESS_HOURS_DAYS || '1,2,3,4,5',
    BUSINESS_HOURS_TIMEZONE: getRuntimeProp_('BUSINESS_HOURS_TIMEZONE') || CONFIG.BUSINESS_HOURS_TIMEZONE || 'Asia/Makassar',

    RATE_LIMIT_ENABLED: CONFIG.RATE_LIMIT_ENABLED || 'YA',
    RATE_LIMIT_PER_MINUTE: CONFIG.RATE_LIMIT_PER_MINUTE || 10,
    RATE_LIMIT_CUSTOMER_DAILY: CONFIG.RATE_LIMIT_CUSTOMER_DAILY || 50,
    RATE_LIMIT_PETUGAS_DAILY: CONFIG.RATE_LIMIT_PETUGAS_DAILY || 150,
    RATE_LIMIT_ADMIN_DAILY: CONFIG.RATE_LIMIT_ADMIN_DAILY || 300,
    RATE_LIMIT_BLOCK_MINUTES: CONFIG.RATE_LIMIT_BLOCK_MINUTES || 3,

    DASHBOARD_PAGE_SIZE: 8,
    DASHBOARD_DEFAULT_PERIOD: 'BULAN_INI',
    DASHBOARD_SHOW_RANKING: 'YA',
    DASHBOARD_SHOW_LATE_TABLE: 'YA',
    DASHBOARD_STICKY_NEW_ADUAN: 'YA',

    AUTO_ARCHIVE_COMPLETED: 'TIDAK',
    AUTO_CLEAN_WA_LOG: 'TIDAK',
    LOG_RETENTION_DAYS: 90,
    BACKUP_REMINDER_ENABLED: 'YA',

    PENGUMUMAN_REPEAT_HOURS: CONFIG.PENGUMUMAN_REPEAT_HOURS || 6,
    PENGUMUMAN_AUTO_NONAKTIF_EXPIRED: CONFIG.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED || 'YA'
  };
}

function readAdminSettingsMap_() {
  var defs = getAdminSettingsDefaults_();
  var out = {};
  Object.keys(defs).forEach(function(k) {
    out[k] = getSiagaRuntimeSetting_(k, defs[k]);
  });
  return out;
}


// ============================================================
// V10.9.284 - PENGUMUMAN LAYANAN DARI DASHBOARD
// Dipakai tab Pengaturan > Pengumuman Layanan.
// Format sheet PENGUMUMAN:
// STATUS | JUDUL | ISI | MULAI | SELESAI | URUTAN | CABANG | WILAYAH_TERDAMPAK | JENIS_DICEGAH | CEGAH_ADUAN
// ============================================================
function ensureDashboardPengumumanSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = ['STATUS', 'JUDUL', 'ISI', 'MULAI', 'SELESAI', 'URUTAN', 'CABANG', 'WILAYAH_TERDAMPAK', 'JENIS_DICEGAH', 'CEGAH_ADUAN'];
  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#0f3b5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 95);
    sh.setColumnWidth(2, 240);
    sh.setColumnWidth(3, 560);
    sh.setColumnWidth(4, 160);
    sh.setColumnWidth(5, 160);
    sh.setColumnWidth(6, 90);
    sh.setColumnWidth(7, 180);
    sh.setColumnWidth(8, 320);
    sh.setColumnWidth(9, 240);
    sh.setColumnWidth(10, 120);
  } catch(eStyle) {}

  if (safeGetLastRow_(sh) < 2) {
    sh.getRange(2, 1, 1, 10).setValues([[
      'NONAKTIF',
      'Contoh Pengumuman',
      'Isi pengumuman ditulis di sini. Ubah STATUS menjadi AKTIF agar tampil sebelum menu utama.',
      '',
      '',
      1,
      'Semua Cabang',
      '',
      'air mati, air kecil, tekanan rendah, distribusi terganggu',
      'TIDAK'
    ]]);
  }
  return sh;
}

function formatPengumumanDateForInput_(value) {
  var d = toSafeDate_(value);
  if (!d) return String(value || '').trim();
  try {
    return Utilities.formatDate(d, CONFIG.BUSINESS_HOURS_TIMEZONE || 'Asia/Makassar', 'yyyy-MM-dd');
  } catch(e) {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyy-MM-dd');
  }
}

function readPengumumanDashboardRows_() {
  var sh = ensureDashboardPengumumanSheet_();
  var last = safeGetLastRow_(sh);
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, 10).getValues();
  var rows = [];
  values.forEach(function(r, idx) {
    var status = String(r[0] || '').trim() || 'NONAKTIF';
    var judul = String(r[1] || '').trim();
    var isi = String(r[2] || '').trim();
    var mulai = formatPengumumanDateForInput_(r[3]);
    var selesai = formatPengumumanDateForInput_(r[4]);
    var urutan = r[5] === '' || r[5] === null || r[5] === undefined ? (idx + 1) : r[5];
    var cabang = String(r[6] || '').trim() || 'Semua Cabang';
    var wilayahTerdampak = String(r[7] || '').trim();
    var jenisDicegah = String(r[8] || '').trim();
    var cegahAduan = String(r[9] || '').trim().toUpperCase() || 'TIDAK';
    if (!judul && !isi && String(status).toUpperCase() !== 'AKTIF') return;
    rows.push({
      rowNumber: idx + 2,
      status: status,
      judul: judul,
      isi: isi,
      mulai: mulai,
      selesai: selesai,
      urutan: urutan,
      cabang: cabang,
      wilayahTerdampak: wilayahTerdampak,
      jenisDicegah: jenisDicegah,
      cegahAduan: cegahAduan
    });
  });
  return rows;
}

function parsePengumumanDashboardDate_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  var d = new Date(text);
  if (isNaN(d.getTime())) return text;
  return d;
}

function sanitizePengumumanDashboardRows_(rows) {
  if (!Array.isArray(rows)) rows = [];
  var out = [];
  rows.forEach(function(r, idx) {
    r = r || {};
    var status = String(r.status || '').trim().toUpperCase();
    status = (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) !== -1) ? 'AKTIF' : 'NONAKTIF';
    var judul = String(r.judul || '').trim();
    var isi = String(r.isi || '').trim();
    if (!judul && !isi) return;
    if (isi.length > 1200) isi = isi.substring(0, 1200);
    if (judul.length > 120) judul = judul.substring(0, 120);
    var urutan = Number(r.urutan || idx + 1);
    if (!urutan || urutan < 1) urutan = idx + 1;
    var cabang = String(r.cabang || '').trim() || 'Semua Cabang';
    var wilayahTerdampak = String(r.wilayahTerdampak || r.wilayah || '').trim();
    var jenisDicegah = String(r.jenisDicegah || '').trim();
    if (!jenisDicegah) jenisDicegah = 'air mati, air kecil, tekanan rendah, distribusi terganggu';
    var cegahAduan = String(r.cegahAduan || '').trim().toUpperCase();
    cegahAduan = (['YA', 'ON', 'TRUE', '1', 'AKTIF'].indexOf(cegahAduan) !== -1) ? 'YA' : 'TIDAK';
    if (cabang.length > 120) cabang = cabang.substring(0, 120);
    if (wilayahTerdampak.length > 700) wilayahTerdampak = wilayahTerdampak.substring(0, 700);
    if (jenisDicegah.length > 300) jenisDicegah = jenisDicegah.substring(0, 300);
    out.push([
      status,
      judul || 'Informasi Layanan',
      isi,
      parsePengumumanDashboardDate_(r.mulai),
      parsePengumumanDashboardDate_(r.selesai),
      urutan,
      cabang,
      wilayahTerdampak,
      jenisDicegah,
      cegahAduan
    ]);
  });
  return out;
}

function clientSavePengumumanDashboard(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    var sh = ensureDashboardPengumumanSheet_();
    var rows = sanitizePengumumanDashboardRows_(payload.rows || []);

    var last = safeGetLastRow_(sh);
    if (last >= 2) {
      sh.getRange(2, 1, last - 1, 10).clearContent();
    }
    if (rows.length) {
      sh.getRange(2, 1, rows.length, 10).setValues(rows);
    }

    try {
      var statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['AKTIF', 'NONAKTIF'], true)
        .setAllowInvalid(false)
        .build();
      sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(statusRule);
      var yesNoRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['YA', 'TIDAK'], true)
        .setAllowInvalid(false)
        .build();
      sh.getRange(2, 10, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(yesNoRule);
    } catch(eRule) {}

    var settingPayload = payload.settings || {};
    var saveSettings = {};
    if (settingPayload.PENGUMUMAN_REPEAT_HOURS !== undefined) {
      var repeatHours = Number(settingPayload.PENGUMUMAN_REPEAT_HOURS);
      if (isNaN(repeatHours) || repeatHours < 0) repeatHours = CONFIG.PENGUMUMAN_REPEAT_HOURS || 6;
      saveSettings.PENGUMUMAN_REPEAT_HOURS = repeatHours;
    }
    if (settingPayload.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED !== undefined) {
      saveSettings.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED = String(settingPayload.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED || 'YA').toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA';
    }
    if (Object.keys(saveSettings).length) setSiagaRuntimeSettings_(saveSettings);

    try { invalidateActivePengumumanCache_(); } catch(eInv) { try { cacheRemove_('SIAGA_ACTIVE_PENGUMUMAN_V10933'); } catch(eCache) {} }
    return { success: true, pengumuman: readPengumumanDashboardRows_(), settings: readAdminSettingsMap_() };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientGetAdminSettings(token) {
  try {
    var user = ensureAdminDashboardAccess_(token);
    setupPetugasCabangSheet(SpreadsheetApp.getActiveSpreadsheet());
    return {
      success: true,
      auth: user,
      settings: readAdminSettingsMap_(),
      users: readDashboardUsersForAdmin_(),
      petugas: getPetugasRows_(),
      pengumuman: readPengumumanDashboardRows_(),
      crm: crmGetAdminConfigSummary_(),
      cabangList: ['Admin Pusat'].concat(CONFIG.CABANG || [])
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientSaveAdminSettings(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');

    var allowed = getAdminSettingsDefaults_();
    var raw = payload.settings || {};
    var saveMap = {};
    Object.keys(allowed).forEach(function(k) {
      if (raw[k] === undefined || raw[k] === null) return;
      var v = raw[k];
      if (/^(SLA_|RATE_LIMIT_|STATUS_NOTIF_WINDOW_HOURS|DASHBOARD_PAGE_SIZE|LOG_RETENTION_DAYS)/.test(k)) {
        var n = Number(v);
        if (isNaN(n) || n < 0) n = Number(allowed[k] || 0);
        v = n;
      }
      saveMap[k] = v;
    });
    setSiagaRuntimeSettings_(saveMap);
    return { success: true, settings: readAdminSettingsMap_() };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientSetDashboardUserActive(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    updateDashboardUserStatusByCabang_(payload.cabang, !!payload.active);
    return { success: true, users: readDashboardUsersForAdmin_() };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientResetDashboardUserPin(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    if (payload.rowNumber) {
      resetDashboardUserPinByRow_(payload.rowNumber, payload.newPin);
    } else {
      resetDashboardUserPinByCabang_(payload.cabang, payload.newPin);
    }
    return { success: true, message: 'PIN berhasil direset untuk ' + (payload.cabang || '-'), users: readDashboardUsersForAdmin_() };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientSaveAdminPetugasRows(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    var rows = payload.rows || [];
    if (!Array.isArray(rows)) rows = [];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = setupPetugasCabangSheet(ss);
    var oldRows = [];
    try { oldRows = getPetugasRows_(); } catch(eOldRows) { oldRows = []; }

    var headers = ['Cabang', 'Nama Petugas', 'No WA', 'Role', 'Status', 'Notif Aduan Baru', 'Notif Darurat', 'Catatan'];
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Nomor WA disimpan sebagai teks agar tidak berubah menjadi 6.28E+12.
    try { sh.getRange(2, 3, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch(eFormat) {}

    var normalized = [];
    var phonesToClear = {};

    oldRows.forEach(function(old) {
      var oldPhone = normalizePhone_(old && old.noWa);
      if (oldPhone) phonesToClear[oldPhone] = true;
    });

    rows.forEach(function(r) {
      r = r || {};
      var cabang = String(r.cabang || '').trim();
      var nama = String(r.nama || '').trim();
      var noWa = normalizePhone_(r.noWa || '');
      if (!cabang && !nama && !noWa) return;

      if (noWa) phonesToClear[noWa] = true;

      normalized.push([
        cabang,
        nama,
        noWa,
        String(r.role || 'Teknisi/Koordinator').trim(),
        String(r.status || 'Aktif').toLowerCase() === 'nonaktif' ? 'Nonaktif' : 'Aktif',
        String(r.notifBaru || 'YA').toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA',
        String(r.notifDarurat || 'YA').toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA',
        String(r.catatan || '').trim()
      ]);
    });

    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, headers.length).clearContent();
    if (normalized.length) {
      sh.getRange(2, 1, normalized.length, headers.length).setValues(normalized);
      try { sh.getRange(2, 3, normalized.length, 1).setNumberFormat('@'); } catch(eFormat2) {}
    }

    try { sh.autoResizeColumns(1, headers.length); } catch(eResize) {}
    try { SpreadsheetApp.flush(); } catch(eFlush) {}

    var phoneList = Object.keys(phonesToClear);
    invalidatePetugasAccessCache_('admin_settings_petugas_saved', phoneList);

    return {
      success: true,
      petugas: getPetugasRows_(),
      cacheCleared: true,
      clearedPhones: phoneList.length
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}


// ============================================================
// V10.9.135 - SLA RESPONS 1x24 JAM + RANKING RESPONS CABANG
// Arahan final: SLA utama bukan waktu pengerjaan, tetapi waktu respons awal.
// Prioritas tetap ada sebagai urgensi, tetapi tidak menentukan batas SLA.
// ============================================================
var SIAGA_RESPONSE_SLA_HOURS = 24;
var SIAGA_RESPONSE_STATUS_SET = {
  'direspons': true,
  'direspon': true,
  'respons': true,
  'respon': true,
  'cek awal': true,
  'proses': true,
  'dalam pengerjaan': true,
  'kendala': true,
  'ditunda': true,
  'selesai': true
};

function getSlaResponseHours_() {
  var raw = '';
  try { raw = getSiagaRuntimeSetting_('SLA_RESPONS_HOURS', SIAGA_RESPONSE_SLA_HOURS); } catch(e) { raw = SIAGA_RESPONSE_SLA_HOURS; }
  var n = Number(raw);
  return (n && n > 0) ? n : SIAGA_RESPONSE_SLA_HOURS;
}

// Override lama: prioritas tidak lagi mengubah batas SLA.
function getSlaJamForPrioritas_(prioritas) {
  return getSlaResponseHours_();
}

function normalizeStatusValue_(value) {
  value = String(value || '').trim().toLowerCase();
  if (value === 'baru') return 'Baru';
  if (value === 'direspons' || value === 'direspon' || value === 'respons' || value === 'respon' || value === 'cek awal' || value === 'cek lokasi' || value === 'verifikasi awal') return 'Direspons';
  if (value === 'proses') return 'Proses';
  if (value === 'dalam pengerjaan' || value === 'pengerjaan' || value === 'dikerjakan') return 'Dalam Pengerjaan';
  if (value === 'kendala' || value === 'menunggu material' || value === 'menunggu jadwal') return 'Kendala';
  if (value === 'selesai') return 'Selesai';
  if (value === 'ditunda' || value === 'tunda') return 'Ditunda';
  if (value === 'batal' || value === 'cancel') return 'Batal';
  return 'Baru';
}

function normalizeInputStatus_(value) {
  value = String(value || '').trim();
  if (!value) return '';
  var lower = value.toLowerCase();
  // V10.9.293: betulkan typo umum kata status ("selsai", "repon", dst) supaya petugas
  // tetap dikenali bot walau salah ketik.
  if (typeof normalizePetugasStatusTypos_ === 'function') lower = normalizePetugasStatusTypos_(lower);
  if (lower.indexOf('cek awal') !== -1 || lower.indexOf('cek lokasi') !== -1 || lower.indexOf('verifikasi awal') !== -1 || lower.indexOf('direspon') !== -1 || lower.indexOf('direspons') !== -1 || lower === 'respons' || lower === 'respon') return 'Direspons';
  if (lower.indexOf('dalam pengerjaan') !== -1 || lower === 'pengerjaan' || lower === 'dikerjakan') return 'Dalam Pengerjaan';
  if (lower.indexOf('kendala') !== -1 || lower.indexOf('material') !== -1 || lower.indexOf('jadwal') !== -1) return 'Kendala';
  if (lower.indexOf('proses') !== -1) return 'Proses';
  if (lower.indexOf('selesai') !== -1) return 'Selesai';
  if (lower.indexOf('tunda') !== -1) return 'Ditunda';
  if (lower.indexOf('batal') !== -1 || lower.indexOf('cancel') !== -1) return 'Batal';
  if (lower.indexOf('baru') !== -1) return 'Baru';
  var allowed = CONFIG.STATUS || ['Baru', 'Direspons', 'Proses', 'Dalam Pengerjaan', 'Kendala', 'Selesai', 'Ditunda', 'Batal'];
  for (var i = 0; i < allowed.length; i++) {
    if (String(allowed[i]).toLowerCase() === lower) return allowed[i];
  }
  return '';
}

function isStatusCountedAsResponse_(status) {
  status = String(status || '').trim().toLowerCase();
  return !!SIAGA_RESPONSE_STATUS_SET[status];
}

var SIAGA_RESPONSE_TIME_MAP_CACHE_ = null;
function buildAduanResponseTimeMap_() {
  if (SIAGA_RESPONSE_TIME_MAP_CACHE_) return SIAGA_RESPONSE_TIME_MAP_CACHE_;
  var map = {};
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.LOG_STATUS_ADUAN_SHEET || 'LOG_STATUS_ADUAN');
    var lastRow = sh ? safeGetLastRow_(sh) : 0;
    if (!sh || lastRow < 2) return (SIAGA_RESPONSE_TIME_MAP_CACHE_ = map);

    // V10.9.144: dashboard jangan membaca log terlalu besar setiap refresh.
    // Ambil log terbaru saja dan cache sebentar agar dashboard mobile tidak timeout.
    var cacheKey = 'RESP_MAP_' + lastRow;
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        Object.keys(parsed || {}).forEach(function(id) {
          var t = toSafeDate_(parsed[id]);
          if (t) map[id] = t;
        });
        return (SIAGA_RESPONSE_TIME_MAP_CACHE_ = map);
      }
    } catch(cacheReadErr) {}

    var maxRows = 3000;
    var rowCount = Math.min(lastRow - 1, maxRows);
    var startRow = Math.max(2, lastRow - rowCount + 1);
    var values = sh.getRange(startRow, 1, rowCount, Math.min(sh.getLastColumn(), 10)).getValues();
    values.forEach(function(r) {
      var id = normalizeAduanIdHyphen_(r[1] || '');
      if (!id) return;
      var statusBaru = String(r[3] || '').trim();
      if (!isStatusCountedAsResponse_(statusBaru)) return;
      var t = toSafeDate_(r[0]);
      if (!t) return;
      if (!map[id] || t.getTime() < map[id].getTime()) map[id] = t;
    });

    try {
      var compact = {};
      Object.keys(map).forEach(function(id) { compact[id] = map[id].getTime(); });
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(compact), 120);
    } catch(cacheWriteErr) {}
  } catch(e) {}
  SIAGA_RESPONSE_TIME_MAP_CACHE_ = map;
  return map;
}

function getAduanResponseAt_(d, responseMap) {
  d = d || {};
  var id = normalizeAduanIdHyphen_(d.id || '');
  responseMap = responseMap || buildAduanResponseTimeMap_();
  var fromLog = id && responseMap[id] ? responseMap[id] : null;
  if (fromLog) return fromLog;

  var status = String(d.status || '').trim();
  if (!isStatusCountedAsResponse_(status)) return null;

  // Fallback untuk data lama yang belum punya LOG_STATUS_ADUAN lengkap.
  var masuk = d.waktuMasukDate || toSafeDate_(d.waktuMasuk) || null;
  var candidates = [];
  var updated = d.updatedAtDate || toSafeDate_(d.updatedAt) || null;
  var selesai = d.waktuSelesaiDate || toSafeDate_(d.waktuSelesai) || null;
  if (updated) candidates.push(updated);
  if (selesai) candidates.push(selesai);
  candidates.sort(function(a, b) { return a.getTime() - b.getTime(); });
  for (var i = 0; i < candidates.length; i++) {
    if (!masuk || candidates[i].getTime() >= masuk.getTime()) return candidates[i];
  }
  return null;
}

function getAduanResponseInfo_(d, now, responseMap) {
  d = d || {};
  now = now || new Date();
  responseMap = responseMap || buildAduanResponseTimeMap_();

  var masuk = d.waktuMasukDate || toSafeDate_(d.waktuMasuk) || null;
  var status = String(d.status || '').trim();
  var slaJam = getSlaResponseHours_();

  if (!masuk) {
    return {
      valid: false,
      responded: false,
      statusCode: 'INVALID',
      statusLabel: 'Respons belum bisa dihitung',
      statusClass: 'neutral',
      slaJam: slaJam,
      slaText: slaJam + ' jam',
      durasiText: '-',
      selisihText: '-',
      batasText: '-',
      waktuResponsText: '-',
      responseHours: 0,
      durationHours: 0,
      lateHours: 0,
      remainingHours: 0
    };
  }

  var dueAt = new Date(masuk.getTime() + slaJam * 3600000);
  var isBatal = siagaDashIsBatalStatus_(status);
  var responseAt = isBatal ? null : getAduanResponseAt_(d, responseMap);
  var responded = !!responseAt;
  var endTime = responseAt || now;
  var hours = Math.max(0, (endTime.getTime() - masuk.getTime()) / 3600000);
  var diffHours = (dueAt.getTime() - endTime.getTime()) / 3600000;
  var remainingHours = Math.max(0, diffHours);
  var lateHours = Math.max(0, -diffHours);
  var warningLimit = slaJam * (CONFIG.FOCUS_SLA_PERCENT || 0.25);

  var out = {
    valid: true,
    responded: responded,
    responseAt: responseAt,
    responseHours: formatSlaNumber_(hours),
    durationHours: formatSlaNumber_(hours),
    slaJam: slaJam,
    slaText: slaJam + ' jam',
    batasText: formatDateForWa_(dueAt),
    waktuMasukText: formatDateForWa_(masuk),
    waktuResponsText: responseAt ? formatDateForWa_(responseAt) : '-',
    waktuSelesaiText: d.waktuSelesaiDate || d.waktuSelesai ? formatDateForWa_(d.waktuSelesaiDate || d.waktuSelesai) : '-',
    durasiText: responded ? formatDurasiSla_(hours) : formatDurasiSla_(hours),
    lateHours: formatSlaNumber_(lateHours),
    remainingHours: formatSlaNumber_(remainingHours),
    fasterHours: responded ? formatSlaNumber_(Math.max(0, diffHours)) : 0,
    statusCode: 'ACTIVE_OK',
    statusLabel: 'Menunggu respons',
    statusClass: 'ok',
    selisihText: remainingHours > 0 ? ('Sisa ' + formatDurasiSla_(remainingHours) + ' untuk respons') : 'Tepat di batas respons'
  };

  if (isBatal) {
    out.statusCode = 'BATAL';
    out.statusLabel = 'Aduan dibatalkan';
    out.statusClass = 'neutral';
    out.selisihText = 'Aduan dibatalkan';
    return out;
  }

  if (responded) {
    if (lateHours > 0) {
      out.statusCode = 'RESPONDED_LATE';
      out.statusLabel = 'Respons terlambat';
      out.statusClass = 'late';
      out.selisihText = 'Respons lewat ' + formatDurasiSla_(lateHours) + ' dari batas 1×24 jam';
    } else {
      out.statusCode = 'RESPONDED_ONTIME';
      out.statusLabel = 'Respons tepat waktu';
      out.statusClass = 'ok';
      out.selisihText = 'Direspons dalam ' + formatDurasiSla_(hours);
    }
    return out;
  }

  if (lateHours > 0) {
    out.statusCode = 'ACTIVE_LATE';
    out.statusLabel = 'Lewat respons';
    out.statusClass = 'late';
    out.selisihText = 'Belum direspons, lewat ' + formatDurasiSla_(lateHours) + ' dari batas 1×24 jam';
    return out;
  }

  if (remainingHours <= warningLimit) {
    out.statusCode = 'ACTIVE_NEAR';
    out.statusLabel = 'Hampir lewat respons';
    out.statusClass = 'warning';
    out.selisihText = 'Sisa ' + formatDurasiSla_(remainingHours) + ' untuk respons';
  }

  return out;
}

// Override lama: semua informasi SLA di dashboard sekarang berarti SLA Respons.
function buildAduanSlaDashboardInfo_(d, now) {
  return getAduanResponseInfo_(d, now || new Date(), buildAduanResponseTimeMap_());
}

function getSlaInfo_(d, now) {
  var info = getAduanResponseInfo_(d, now || new Date(), buildAduanResponseTimeMap_());
  return {
    umurJam: info.durationHours || 0,
    slaJam: info.slaJam || getSlaResponseHours_(),
    remainingHours: info.remainingHours || 0,
    overdueHours: info.lateHours || 0,
    overdue: info.statusCode === 'ACTIVE_LATE',
    nearDeadline: info.statusCode === 'ACTIVE_NEAR',
    responded: !!info.responded,
    statusCode: info.statusCode,
    statusLabel: info.statusLabel
  };
}

function buildDashboardAdminMetrics_(data, now) {
  data = data || [];
  now = now || new Date();
  var responseMap = data.length ? buildAduanResponseTimeMap_() : {};
  var totalAduan = data.length;
  var wajibRespons = 0;
  var belumRespons = 0;
  var sudahDirespons = 0;
  var responsDinilai = 0;
  var responsTepatWaktu = 0;
  var responsTerlambat = 0;

  data.forEach(function(d) {
    var st = String((d && d.status) || '').trim();
    if (st === 'Batal') return;
    wajibRespons++;
    var info = getAduanResponseInfo_(d, now, responseMap);
    if (info.responded) {
      sudahDirespons++;
      responsDinilai++;
      if (info.statusCode === 'RESPONDED_LATE') responsTerlambat++;
      else responsTepatWaktu++;
    } else {
      belumRespons++;
      if (info.statusCode === 'ACTIVE_LATE') {
        responsDinilai++;
        responsTerlambat++;
      }
    }
  });

  return {
    totalAduan: totalAduan,
    totalWajibRespons: wajibRespons,
    statusBaru: belumRespons,
    sudahDikerjakan: sudahDirespons,
    persenPengerjaan: wajibRespons ? Math.round((sudahDirespons / wajibRespons) * 100) : null,
    responsDinilai: responsDinilai,
    responsTepatWaktu: responsTepatWaktu,
    responsTerlambat: responsTerlambat,
    persenWaktuSelesai: responsDinilai ? Math.round((responsTepatWaktu / responsDinilai) * 100) : null,
    persenResponsTepatWaktu: responsDinilai ? Math.round((responsTepatWaktu / responsDinilai) * 100) : null
  };
}

function getCabangRanking(data, fromDate) {
  data = data || [];
  var now = new Date();
  var responseMap = data.length ? buildAduanResponseTimeMap_() : {};
  var map = {};

  (CONFIG.CABANG || []).forEach(function(c) {
    map[c] = {
      cabang: c,
      count: 0,
      eligibleCount: 0,
      respondedCount: 0,
      evaluatedCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalResponseHours: 0,
      avgResponseHours: null,
      avgResponseText: '—',
      avgDurationHours: null,
      avgDurationText: '—',
      onTimePercent: null,
      selesaiCount: 0
    };
  });

  data.forEach(function(d) {
    if (fromDate && d.waktuMasuk && d.waktuMasuk < fromDate) return;
    var cabang = d.cabang || 'Lainnya';
    if (!map[cabang]) {
      map[cabang] = {
        cabang: cabang,
        count: 0,
        eligibleCount: 0,
        respondedCount: 0,
        evaluatedCount: 0,
        onTimeCount: 0,
        lateCount: 0,
        totalResponseHours: 0,
        avgResponseHours: null,
        avgResponseText: '—',
        avgDurationHours: null,
        avgDurationText: '—',
        onTimePercent: null,
        selesaiCount: 0
      };
    }
    var item = map[cabang];
    item.count++;
    if (String(d.status || '').trim() === 'Selesai') item.selesaiCount++;
    if (String(d.status || '').trim() === 'Batal') return;
    item.eligibleCount++;
    var info = getAduanResponseInfo_(d, now, responseMap);
    if (info.responded) {
      item.respondedCount++;
      item.evaluatedCount++;
      item.totalResponseHours += Number(info.responseHours || info.durationHours || 0);
      if (info.statusCode === 'RESPONDED_LATE') item.lateCount++;
      else item.onTimeCount++;
    } else if (info.statusCode === 'ACTIVE_LATE') {
      item.evaluatedCount++;
      item.lateCount++;
    }
  });

  var rows = Object.keys(map).map(function(k) {
    var item = map[k];
    if (item.respondedCount > 0) {
      item.avgResponseHours = item.totalResponseHours / item.respondedCount;
      item.avgDurationHours = item.avgResponseHours;
      item.avgResponseText = formatDurasiSla_(item.avgResponseHours);
      item.avgDurationText = item.avgResponseText;
    }
    if (item.evaluatedCount > 0) {
      item.onTimePercent = Math.round((item.onTimeCount / item.evaluatedCount) * 100);
    }
    return item;
  });

  rows.sort(function(a, b) {
    var ap = a.onTimePercent == null ? -1 : a.onTimePercent;
    var bp = b.onTimePercent == null ? -1 : b.onTimePercent;
    if (bp !== ap) return bp - ap;
    var aa = a.avgResponseHours == null ? 999999 : a.avgResponseHours;
    var ba = b.avgResponseHours == null ? 999999 : b.avgResponseHours;
    if (aa !== ba) return aa - ba;
    return (b.respondedCount || 0) - (a.respondedCount || 0);
  });
  return rows;
}

function getCabangSpeedRanking(data, fromDate, now) {
  // Nama lama dipertahankan agar Index lama tetap membaca field yang sama.
  // Isi sekarang adalah ranking respons cabang, bukan ranking selesai.
  return getCabangRanking(data || [], fromDate || null);
}
// V10.9.164: Duplikasi clientGetDashboardData #2 dihapus. Gunakan definisi utama di bawah.


function getStatusIconForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return '🆕';
  if (status === 'direspons' || status === 'direspon') return '👀';
  if (status === 'proses' || status === 'dalam pengerjaan') return '🔧';
  if (status === 'kendala') return '⚠️';
  if (status === 'selesai') return '✅';
  if (status === 'ditunda') return '⏸️';
  if (status === 'batal') return '❌';
  return 'ℹ️';
}

function buildProgressTextForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return 'Aduan Anda telah kami terima dan sedang menunggu pengecekan oleh petugas. Mohon menunggu, kami akan segera memberikan respons.';
  if (status === 'direspons' || status === 'direspon') return 'Aduan sudah direspons dan sedang dalam pengecekan awal.';
  if (status === 'proses' || status === 'dalam pengerjaan') return 'Aduan sedang dalam pengerjaan.';
  if (status === 'kendala') return 'Aduan sudah direspons, tetapi masih menunggu tindak lanjut karena ada kendala.';
  if (status === 'selesai') return 'Aduan telah selesai ditangani.';
  if (status === 'ditunda') return 'Aduan sementara ditunda karena membutuhkan pengecekan/koordinasi.';
  if (status === 'batal') return 'Aduan dibatalkan.';
  return 'Aduan tercatat di sistem.';
}

function buildPetugasExampleAduanId_(petugas) {
  petugas = petugas || {};
  if (petugas.isAdmin) return 'PRY7K2A';
  var code = String(getCabangCodeSafe_(petugas.cabang || '') || 'PRY').toUpperCase();
  return code + '7K2A';
}

function buildPetugasMainMenuReply_(petugas) {
  petugas = petugas || {};
  var exampleId = buildPetugasExampleAduanId_(petugas);
  return [
    '👷 *Menu Petugas SIAGA TIARA*',
    '',
    'Halo, *' + (petugas.nama || 'Petugas') + '*.',
    'Cabang: *' + (petugas.isAdmin ? 'Semua Cabang' : (petugas.cabang || '-')) + '*',
    '',
    'Pilih menu:',
    '1. *Daftar Aduan*',
    '2. *Cari Aduan*',
    '',
    'Untuk membuka atau memperbarui aduan, kirim *salah satu data*: ID Aduan / Nama Pelanggan / No HP Pelanggan / No Pelanggan.',
    '',
    'Contoh:',
    '• *' + exampleId + ' respon*',
    '• *' + exampleId + ' selesai*',
    '• *Joko Subianto sedang dikerjakan*',
    '',
    'Catatan:',
    '• *Respons* wajib Foto Respons.',
    '• *Selesai* wajib Foto Selesai.',
    '• *Selesai dicek* dianggap Respons, bukan Selesai.'
  ].join('\n');
}


function sendKiriminPetugasStatusMenu_(phone) {
  var rows = [
    { id: 'PETUGAS_STATUS_DIRESPONS', title: 'Respons', description: 'Wajib Foto Respons' },
    { id: 'PETUGAS_STATUS_PROSES', title: 'Pengerjaan', description: 'Aduan mulai dikerjakan' },
    { id: 'PETUGAS_STATUS_KENDALA', title: 'Kendala', description: 'Ada kendala alat/bahan/lokasi' },
    { id: 'PETUGAS_STATUS_SELESAI', title: 'Selesai', description: 'Wajib Foto Selesai' },
    { id: 'PETUGAS_STATUS_DITUNDA', title: 'Ditunda', description: 'Butuh pengecekan/koordinasi' },
    { id: 'PETUGAS_STATUS_BATAL', title: 'Batal', description: 'Aduan dibatalkan/tidak valid' }
  ];

  return sendKiriminGenericListMenu_(
    phone,
    'Pilih status baru. Status *Respons* wajib Foto Respons sebagai bukti cek awal/lokasi. SLA dihitung dari waktu masuk sampai status *Direspons* maksimal 1×24 jam.',
    'Pilih Status',
    'Status Aduan',
    rows
  );
}

function renderSettingsSla() {
  return '<div class="settings-pane-head"><div><div class="settings-pane-title">Pengaturan SLA Respons</div><div class="settings-pane-sub">SLA utama SIAGA adalah waktu respons awal maksimal 1×24 jam untuk semua prioritas. Prioritas tetap dipakai untuk urgensi, bukan batas SLA.</div></div></div>' +
    '<div class="settings-card"><div class="settings-grid">' +
      settingsInputHtml('SLA_RESPONS_HOURS','SLA Respons (jam)','number',24,'min="1" step="1"') +
    '</div></div>';
}

// ============================================================
// V10.9.149 - FIX DASHBOARD HTTP 0 / UNKNOWN ERROR
// Penyebab utama: payload dashboard membawa Date object di dalam field SLA.
// google.script.run kadang gagal mengirim Date object/undefined sehingga muncul HTTP 0/Unknown error.
// Override ini memastikan semua data yang dikirim ke Index sudah JSON-safe.
// ============================================================
function sanitizeDashboardPayloadForClient_(value) {
  try {
    return JSON.parse(JSON.stringify(value, function(key, val) {
      var original = this ? this[key] : val;
      if (original instanceof Date) {
        return isNaN(original.getTime()) ? null : original.toISOString();
      }
      if (typeof val === 'undefined') return null;
      if (typeof val === 'function') return null;
      return val;
    }));
  } catch (e) {
    return {
      success: false,
      error: 'Gagal menyiapkan data dashboard: ' + (e && e.message ? e.message : String(e))
    };
  }
}

function safeSliceDashboardRows_(rows, limit) {
  rows = rows || [];
  limit = Number(limit || 100);
  return rows.slice(0, limit);
}
// V10.9.164: Duplikasi clientGetDashboardData #3 dihapus. Gunakan definisi utama di bawah.




// ============================================================
// V10.9.159 - FIX DASHBOARD LOADING LAMA / HTTP 0
// Dashboard dibuat ringan dan stabil:
// - Tidak membaca LOG_STATUS_ADUAN saat load awal dashboard.
// - Tidak mengirim object Date ke Index.
// - Tabel dibatasi dari server.
// - Error per bagian tidak membuat seluruh dashboard gagal.
// Catatan: SLA Respons tetap dihitung dari status respons/proses/selesai sebagai fallback cepat.
// ============================================================
function siagaDashToDate_(value) {
  if (!value) return null;
  try {
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch(e) {
    return null;
  }
}

function siagaDashPad2_(n) {
  n = Number(n || 0);
  return n < 10 ? ('0' + n) : String(n);
}

function siagaDashDateKey_(date) {
  date = siagaDashToDate_(date);
  if (!date) return '';
  return date.getFullYear() + '-' + siagaDashPad2_(date.getMonth() + 1) + '-' + siagaDashPad2_(date.getDate());
}

function siagaDashDateLabel_(date) {
  date = siagaDashToDate_(date);
  if (!date) return '-';
  return siagaDashPad2_(date.getDate()) + '/' + siagaDashPad2_(date.getMonth() + 1) + '/' + date.getFullYear() + ' ' + siagaDashPad2_(date.getHours()) + ':' + siagaDashPad2_(date.getMinutes());
}

function siagaDashShortDayLabel_(date) {
  date = siagaDashToDate_(date);
  if (!date) return '-';
  return siagaDashPad2_(date.getDate()) + '/' + siagaDashPad2_(date.getMonth() + 1);
}

function siagaDashStatus_(value) {
  return String(value || '').trim();
}

function siagaDashIsSelesaiStatus_(status) {
  status = siagaDashStatus_(status).toLowerCase();
  return status === 'selesai';
}

function siagaDashIsBatalStatus_(status) {
  status = siagaDashStatus_(status).toLowerCase();
  return status === 'batal' || status === 'cancel';
}

function siagaDashIsAktif_(status) {
  // Penting: Direspons/Proses/Kendala/Ditunda tetap dihitung AKTIF.
  // Aduan baru dianggap selesai hanya jika status benar-benar "Selesai".
  return !siagaDashIsSelesaiStatus_(status) && !siagaDashIsBatalStatus_(status);
}

// BUGFIX V11.10.5: kartu dashboard "Aduan Aktif" berdeskripsi
// "Termasuk Direspons/Proses/Kendala" -- artinya SEHARUSNYA tidak menghitung
// status "Baru" (aduan yang belum sempat ditangani/direspons sama sekali).
// Tapi sebelumnya kartu ini memakai siagaDashIsAktif_() yang mendefinisikan
// "aktif" sebagai "bukan Selesai & bukan Batal" -- itu ikut menghitung "Baru"
// juga, sehingga angkanya jauh lebih besar dari jumlah aduan yang benar-benar
// sudah ditangani/dalam pengerjaan. Fungsi baru ini HANYA menghitung status
// yang benar-benar berarti "sedang ditangani", sesuai deskripsi kartunya.
function siagaDashIsAktifDitangani_(status) {
  status = siagaDashStatus_(status).toLowerCase();
  return status === 'direspons' || status === 'proses' || status === 'dalam pengerjaan' ||
         status === 'kendala' || status === 'ditunda';
}

function siagaDashIsRespondedStatus_(status) {
  status = siagaDashStatus_(status).toLowerCase();
  return status === 'direspons' || status === 'dalam pengerjaan' || status === 'proses' || status === 'kendala' || status === 'selesai';
}

function siagaDashParseRows_(rawData) {
  rawData = rawData || [];
  var out = [];
  var C = CONFIG.COL || {};
  for (var i = 0; i < rawData.length; i++) {
    var row = rawData[i] || [];
    var id = String(row[(C.ID || 1) - 1] || '').trim();
    var masukDate = siagaDashToDate_(row[(C.WAKTU_MASUK || 2) - 1]);
    if (!id || !masukDate) continue;
    var selesaiDate = siagaDashToDate_(row[(C.WAKTU_SELESAI || 14) - 1]);
    var updatedDate = siagaDashToDate_(row[(C.UPDATED_AT || 16) - 1]);
    out.push({
      id: id,
      waktuMasukDate: masukDate,
      waktuMasukMs: masukDate.getTime(),
      waktuMasukKey: siagaDashDateKey_(masukDate),
      waktuMasukText: siagaDashDateLabel_(masukDate),
      cabang: String(row[(C.CABANG || 3) - 1] || '').trim(),
      wilayah: String(row[(C.WILAYAH || 4) - 1] || '').trim(),
      desa: String(row[(C.DESA || 5) - 1] || '').trim(),
      noPelanggan: String(row[(C.NO_PELANGGAN || C.DESA || 5) - 1] || '').trim(),
      namaPelanggan: String(row[(C.NAMA_PELANGGAN || 6) - 1] || '').trim(),
      noHp: String(row[(C.NO_HP || 7) - 1] || '').trim(),
      jenisGangguan: String(row[(C.JENIS_GANGGUAN || 8) - 1] || '').trim(),
      prioritas: String(row[(C.PRIORITAS || 9) - 1] || '').trim(),
      status: String(row[(C.STATUS || 10) - 1] || '').trim(),
      unit: String(row[(C.UNIT || 11) - 1] || '').trim(),
      keterangan: String(row[(C.KETERANGAN || 12) - 1] || '').trim(),
      catatan: String(row[(C.CATATAN || 13) - 1] || '').trim(),
      waktuSelesaiDate: selesaiDate,
      waktuSelesaiMs: selesaiDate ? selesaiDate.getTime() : 0,
      waktuSelesaiText: selesaiDate ? siagaDashDateLabel_(selesaiDate) : '-',
      updatedAtDate: updatedDate,
      updatedAtMs: updatedDate ? updatedDate.getTime() : 0
    });
  }
  return out;
}

function siagaDashApplyFilters_(data, filters) {
  filters = filters || {};
  data = data || [];
  var range = getReportDateRange_(filters || {}, new Date());
  var startMs = range && range.start ? range.start.getTime() : null;
  var endMs = range && range.end ? range.end.getTime() : null;
  var cabang = String(filters.cabang || '').trim();
  var wilayah = String(filters.wilayah || '').trim();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    if (cabang && cabang !== 'Semua' && d.cabang !== cabang) continue;
    if (wilayah && wilayah !== 'Semua' && d.wilayah !== wilayah) continue;
    if (startMs != null && d.waktuMasukMs < startMs) continue;
    if (endMs != null && d.waktuMasukMs >= endMs) continue;
    out.push(d);
  }
  return out;
}

var _siagaDashSlaHoursCache = null;
function siagaDashGetSlaHours_() {
  // V10.9.168: jangan baca SETTINGS/Properties berulang-ulang saat hitung ribuan baris dashboard.
  if (_siagaDashSlaHoursCache !== null) return _siagaDashSlaHoursCache;
  try { _siagaDashSlaHoursCache = Number(getSlaResponseHours_() || 24); } catch(e) { _siagaDashSlaHoursCache = 24; }
  if (!_siagaDashSlaHoursCache || _siagaDashSlaHoursCache <= 0) _siagaDashSlaHoursCache = 24;
  return _siagaDashSlaHoursCache;
}

function siagaDashResponseAtMs_(d) {
  if (!d || siagaDashStatus_(d.status) === 'Batal') return 0;
  if (!siagaDashIsRespondedStatus_(d.status)) return 0;

  // BUGFIX V11.10.6: sebelumnya dipakai d.updatedAtMs -- yaitu waktu TERAKHIR
  // baris itu diubah apa pun (termasuk saat petugas cuma edit keterangan, atau
  // saat status akhirnya diubah jadi Selesai). Akibatnya "waktu respons" ikut
  // bergeser maju setiap ada perubahan lain di baris tsb, padahal seharusnya
  // terkunci sejak PERTAMA KALI status berubah dari "Baru" ke status lain.
  // Sekarang pakai getAduanResponseAt_() yang membaca log status (LOG_STATUS_ADUAN)
  // dan mengambil waktu PALING AWAL aduan itu direspons -- sama seperti yang
  // sudah dipakai di laporan/export, supaya konsisten dan benar-benar terkunci.
  try {
    var respDate = getAduanResponseAt_(d);
    if (respDate) return respDate.getTime();
  } catch (eRespLog) {}

  // Fallback lama, hanya dipakai kalau log status tidak tersedia sama sekali.
  return d.updatedAtMs || d.waktuSelesaiMs || d.waktuMasukMs || 0;
}

function siagaDashSlaInfo_(d, nowMs) {
  nowMs = nowMs || new Date().getTime();
  var slaHours = siagaDashGetSlaHours_();
  var masukMs = d && d.waktuMasukMs ? d.waktuMasukMs : 0;
  if (!masukMs) {
    return { statusCode: 'INVALID', statusLabel: '-', statusClass: 'neutral', responded: false, responseHours: 0, durationHours: 0, lateHours: 0, remainingHours: 0, selisihText: '-' };
  }
  var status = siagaDashStatus_(d.status);
  if (siagaDashIsBatalStatus_(status)) {
    return { statusCode: 'BATAL', statusLabel: 'Aduan dibatalkan', statusClass: 'neutral', responded: false, responseHours: 0, durationHours: 0, lateHours: 0, remainingHours: 0, selisihText: 'Aduan dibatalkan' };
  }
  var dueMs = masukMs + (slaHours * 3600000);
  var responseMs = siagaDashResponseAtMs_(d);
  var responded = !!responseMs;
  var endMs = responseMs || nowMs;
  var hours = Math.max(0, (endMs - masukMs) / 3600000);
  var lateHours = Math.max(0, (endMs - dueMs) / 3600000);
  var remainingHours = Math.max(0, (dueMs - endMs) / 3600000);
  var warningLimit = slaHours * 0.25;
  var label = 'Menunggu respons';
  var code = 'ACTIVE_OK';
  var cls = 'ok';
  var selisih = remainingHours > 0 ? ('Sisa ' + siagaDashFormatDurasi_(remainingHours)) : 'Tepat di batas respons';
  if (responded) {
    if (lateHours > 0) {
      code = 'RESPONDED_LATE'; label = 'Respons terlambat'; cls = 'late'; selisih = 'Respons lewat ' + siagaDashFormatDurasi_(lateHours);
    } else {
      code = 'RESPONDED_ONTIME'; label = 'Respons tepat waktu'; cls = 'ok'; selisih = 'Direspons dalam ' + siagaDashFormatDurasi_(hours);
    }
  } else if (lateHours > 0) {
    code = 'ACTIVE_LATE'; label = 'Lewat respons'; cls = 'late'; selisih = 'Belum direspons, lewat ' + siagaDashFormatDurasi_(lateHours);
  } else if (remainingHours <= warningLimit) {
    code = 'ACTIVE_NEAR'; label = 'Hampir lewat respons'; cls = 'warning'; selisih = 'Sisa ' + siagaDashFormatDurasi_(remainingHours);
  }

  // V11.10.6: "sudah berapa lama dalam pengerjaan" -- terhitung sejak PERTAMA
  // KALI direspons (responseMs, sudah terkunci, tidak ikut geser walau diedit
  // lagi) sampai SEKARANG. Hanya relevan selama aduan masih aktif (belum
  // Selesai/Batal) dan sudah pernah direspons -- begitu status jadi Selesai,
  // angka ini berhenti tampil (dianggap tidak relevan lagi, bukan tugas
  // berjalan lagi), sesuai maksud awal fitur ini.
  var lamaPengerjaanHours = 0;
  var lamaPengerjaanText = '-';
  var isSelesaiSekarang = siagaDashIsSelesaiStatus_(status);
  if (responded && !isSelesaiSekarang) {
    lamaPengerjaanHours = Math.max(0, (nowMs - responseMs) / 3600000);
    lamaPengerjaanText = siagaDashFormatDurasi_(lamaPengerjaanHours);
  }

  return {
    valid: true,
    responded: responded,
    statusCode: code,
    statusLabel: label,
    statusClass: cls,
    slaJam: slaHours,
    responseHours: Math.round(hours * 10) / 10,
    durationHours: Math.round(hours * 10) / 10,
    lateHours: Math.round(lateHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    durasiText: siagaDashFormatDurasi_(hours),
    selisihText: selisih,
    lamaPengerjaanHours: Math.round(lamaPengerjaanHours * 10) / 10,
    lamaPengerjaanText: lamaPengerjaanText,
    waktuMasukText: d.waktuMasukText || '-',
    waktuResponsText: responseMs ? siagaDashDateLabel_(new Date(responseMs)) : '-',
    waktuSelesaiText: d.waktuSelesaiText || '-'
  };
}

function siagaDashFormatDurasi_(hours) {
  hours = Number(hours || 0);
  if (!isFinite(hours)) hours = 0;
  if (hours < 1) {
    var menit = Math.max(1, Math.round(hours * 60));
    return menit + ' menit';
  }
  if (hours < 24) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    return h + ' jam' + (m > 0 ? ' ' + m + ' menit' : '');
  }
  var hari = Math.floor(hours / 24);
  var sisaJam = Math.round(hours - (hari * 24));
  return hari + ' hari' + (sisaJam > 0 ? ' ' + sisaJam + ' jam' : '');
}

function siagaDashBuildSummary_(d, nowMs) {
  var sla = siagaDashSlaInfo_(d, nowMs);
  return {
    id: d.id || '',
    waktu: d.waktuMasukText || '-',
    waktuSelesai: d.waktuSelesaiText || '-',
    cabang: d.cabang || '',
    wilayah: d.wilayah || '',
    desa: d.desa || '',
    noPelanggan: d.noPelanggan || '',
    namaPelanggan: d.namaPelanggan || '',
    noHp: d.noHp || '',
    jenis: d.jenisGangguan || '',
    prioritas: d.prioritas || '',
    status: d.status || '',
    unit: d.unit || '',
    keterangan: d.keterangan ? String(d.keterangan).substring(0, 120) : '',
    catatan: d.catatan ? String(d.catatan).substring(0, 120) : '',
    lokasiDetail: '',
    linkMaps: '',
    latitude: '',
    longitude: '',
    sla: sla,
    slaStatus: sla.statusCode === 'ACTIVE_LATE' ? 'Lewat' : (sla.statusCode === 'ACTIVE_NEAR' ? 'Hampir' : 'Aman'),
    sisaSLA: sla.statusCode === 'ACTIVE_LATE' ? ('Lewat ' + siagaDashFormatDurasi_(sla.lateHours || 0)) : (sla.remainingHours ? (sla.remainingHours + ' jam') : (sla.statusLabel || '-')),
    slaText: sla.statusLabel || '-',
    slaSelisih: sla.selisihText || '-',
    durasiText: sla.durasiText || '-',
    lamaPengerjaanText: sla.lamaPengerjaanText || '-',
    lamaPengerjaanHours: sla.lamaPengerjaanHours || 0
  };
}

function siagaDashStatusCount_(data) {
  var result = {};
  try { (CONFIG.STATUS || []).forEach(function(s) { result[s] = 0; }); } catch(e) {}
  (data || []).forEach(function(d) {
    var s = d.status || 'Lainnya';
    if (!result.hasOwnProperty(s)) result[s] = 0;
    result[s]++;
  });
  return result;
}

function siagaDashJenisCount_(data) {
  var map = {};
  (data || []).forEach(function(d) {
    var j = d.jenisGangguan || 'Lainnya';
    map[j] = (map[j] || 0) + 1;
  });
  return Object.keys(map).map(function(k) { return { label: k, count: map[k] }; }).sort(function(a,b){ return b.count - a.count; }).slice(0, 10);
}

function siagaDashTren7Hari_(data, now) {
  var labels = [];
  var keys = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    labels.push(siagaDashShortDayLabel_(d));
    keys.push(siagaDashDateKey_(d));
  }
  var counter = {};
  keys.forEach(function(k) { counter[k] = 0; });
  (data || []).forEach(function(row) { if (counter.hasOwnProperty(row.waktuMasukKey)) counter[row.waktuMasukKey]++; });
  return { labels: labels, data: keys.map(function(k) { return counter[k] || 0; }) };
}

function siagaDashTren7HariCabang_(data, now) {
  var base = siagaDashTren7Hari_([], now);
  var labels = base.labels;
  var keys = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    keys.push(siagaDashDateKey_(d));
  }
  var cabangs = CONFIG.CABANG || [];
  var datasets = cabangs.map(function(cabang) {
    var perDay = {};
    keys.forEach(function(k) { perDay[k] = 0; });
    (data || []).forEach(function(row) {
      if (row.cabang === cabang && perDay.hasOwnProperty(row.waktuMasukKey)) perDay[row.waktuMasukKey]++;
    });
    return { label: cabang, data: keys.map(function(k) { return perDay[k] || 0; }) };
  });
  return { labels: labels, datasets: datasets };
}

function siagaDashAdminMetrics_(data, nowMs) {
  data = data || [];
  var wajib = 0, sudah = 0, dinilai = 0, tepat = 0, telat = 0, belum = 0;
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    if (siagaDashIsBatalStatus_(d.status)) continue;
    wajib++;
    var info = siagaDashSlaInfo_(d, nowMs);
    if (info.responded) {
      sudah++; dinilai++;
      if (info.statusCode === 'RESPONDED_LATE') telat++; else tepat++;
    } else {
      belum++;
      if (info.statusCode === 'ACTIVE_LATE') { dinilai++; telat++; }
    }
  }
  return {
    totalAduan: data.length,
    totalWajibRespons: wajib,
    statusBaru: belum,
    sudahDikerjakan: sudah,
    persenPengerjaan: wajib ? Math.round((sudah / wajib) * 100) : null,
    responsDinilai: dinilai,
    responsTepatWaktu: tepat,
    responsTerlambat: telat,
    persenWaktuSelesai: dinilai ? Math.round((tepat / dinilai) * 100) : null,
    persenResponsTepatWaktu: dinilai ? Math.round((tepat / dinilai) * 100) : null
  };
}

function siagaDashCabangRanking_(data, nowMs) {
  var map = {};
  (CONFIG.CABANG || []).forEach(function(c) {
    map[c] = { cabang: c, count: 0, eligibleCount: 0, respondedCount: 0, evaluatedCount: 0, onTimeCount: 0, lateCount: 0, totalResponseHours: 0, avgResponseHours: null, avgResponseText: '—', avgDurationHours: null, avgDurationText: '—', onTimePercent: null, selesaiCount: 0 };
  });
  (data || []).forEach(function(d) {
    var cabang = d.cabang || 'Lainnya';
    if (!map[cabang]) map[cabang] = { cabang: cabang, count: 0, eligibleCount: 0, respondedCount: 0, evaluatedCount: 0, onTimeCount: 0, lateCount: 0, totalResponseHours: 0, avgResponseHours: null, avgResponseText: '—', avgDurationHours: null, avgDurationText: '—', onTimePercent: null, selesaiCount: 0 };
    var item = map[cabang];
    item.count++;
    if (siagaDashIsSelesaiStatus_(d.status)) item.selesaiCount++;
    if (siagaDashIsBatalStatus_(d.status)) return;
    item.eligibleCount++;
    var info = siagaDashSlaInfo_(d, nowMs);
    if (info.responded) {
      item.respondedCount++;
      item.evaluatedCount++;
      item.totalResponseHours += Number(info.responseHours || 0);
      if (info.statusCode === 'RESPONDED_LATE') item.lateCount++; else item.onTimeCount++;
    } else if (info.statusCode === 'ACTIVE_LATE') {
      item.evaluatedCount++;
      item.lateCount++;
    }
  });
  var rows = Object.keys(map).map(function(k) {
    var item = map[k];
    if (item.respondedCount > 0) {
      item.avgResponseHours = item.totalResponseHours / item.respondedCount;
      item.avgDurationHours = item.avgResponseHours;
      item.avgResponseText = siagaDashFormatDurasi_(item.avgResponseHours);
      item.avgDurationText = item.avgResponseText;
    }
    if (item.evaluatedCount > 0) item.onTimePercent = Math.round((item.onTimeCount / item.evaluatedCount) * 100);
    return item;
  });
  rows.sort(function(a, b) {
    var ap = a.onTimePercent == null ? -1 : a.onTimePercent;
    var bp = b.onTimePercent == null ? -1 : b.onTimePercent;
    if (bp !== ap) return bp - ap;
    var aa = a.avgResponseHours == null ? 999999 : a.avgResponseHours;
    var ba = b.avgResponseHours == null ? 999999 : b.avgResponseHours;
    if (aa !== ba) return aa - ba;
    return (b.respondedCount || 0) - (a.respondedCount || 0);
  });
  return rows;
}

function siagaDashTables_(data, nowMs) {
  data = data || [];
  var now = new Date(nowMs || new Date().getTime());
  var firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  var firstPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  var firstNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  var aktif = [];
  var fokus = [];
  var selesai = [];
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    var info = siagaDashSlaInfo_(d, nowMs);
    if (siagaDashIsAktif_(d.status)) {
      // V11.10.7: "Fokus Penanganan" dan "Aduan Terbaru" sebelumnya SALING TUMPANG
      // TINDIH -- semua aduan aktif otomatis muncul di Terbaru, dan yang darurat/
      // prioritas tinggi/lewat SLA muncul DI KEDUANYA sekaligus (dobel). Sekarang
      // dipisah tegas: aduan yang SUDAH lewat atau MENDEKATI batas SLA respons
      // dipindah HANYA ke Fokus Penanganan (tidak lagi ikut tampil di Aduan
      // Terbaru). Kriteria prioritas (Darurat/Tinggi) TIDAK lagi dipakai untuk
      // menentukan keanggotaan Fokus -- murni berdasarkan status SLA.
      var isFokusSla = (info.statusCode === 'ACTIVE_LATE' || info.statusCode === 'ACTIVE_NEAR');
      if (isFokusSla) {
        fokus.push(d);
      } else {
        aktif.push(d);
      }
    } else if (siagaDashIsSelesaiStatus_(d.status)) {
      var doneMs = d.waktuSelesaiMs || d.updatedAtMs || d.waktuMasukMs;
      if (doneMs >= firstPrevMonth && doneMs < firstNextMonth) selesai.push(d);
    }
  }
  aktif.sort(function(a,b){ return (b.waktuMasukMs || 0) - (a.waktuMasukMs || 0); });
  fokus.sort(function(a,b){ return (a.waktuMasukMs || 0) - (b.waktuMasukMs || 0); });
  selesai.sort(function(a,b){ return ((b.waktuSelesaiMs || b.updatedAtMs || b.waktuMasukMs || 0) - (a.waktuSelesaiMs || a.updatedAtMs || a.waktuMasukMs || 0)); });

  // BUGFIX V11.10.8: batas potong 30/40/60 di atas (sejak V10.9.164, demi performa)
  // ternyata DIAM-DIAM MEMBUANG DATA. Kalau aduan yang memenuhi kriteria lebih
  // banyak dari batas ini, sisanya TIDAK PERNAH terkirim ke dashboard -- tombol
  // halaman "2 3 4 5" yang tampil cuma memilah dari sisa yang sudah terpotong,
  // bukan data asli. Ini yang menyebabkan: (1) badge Fokus Penanganan jauh lebih
  // kecil dari kartu "Lewat Respons" walau harusnya Fokus >= Lewat Respons,
  // dan (2) aduan yang baru lewat 24 jam (pindah dari Terbaru ke Fokus) kalah
  // antre karena pool Fokus sudah penuh di 30, sehingga "hilang" padahal masih
  // ada di sistem. Sekarang batasnya dinaikkan jauh lebih tinggi (aman untuk
  // volume operasional wajar) supaya tidak ada data yang terbuang; paginasi
  // yang sudah ada di client tetap jalan seperti biasa untuk menampilkannya
  // per halaman.
  var fokusRows = fokus.slice(0, 500).map(function(d) {
    var r = siagaDashBuildSummary_(d, nowMs);
    var info = siagaDashSlaInfo_(d, nowMs);
    // V11.10.7: label alasan disesuaikan -- keanggotaan Fokus sekarang murni SLA,
    // tapi info prioritas tetap ditampilkan di label kalau kebetulan aduan itu
    // juga darurat/prioritas tinggi, supaya konteksnya tetap kelihatan.
    if (info.statusCode === 'ACTIVE_LATE') {
      r.alasanFokus = (d.prioritas === 'Darurat') ? '🔴 Darurat & lewat respons'
        : (d.prioritas === 'Tinggi') ? '🟠 Prioritas Tinggi & lewat respons'
        : '⏱ Lewat respons';
    } else if (info.statusCode === 'ACTIVE_NEAR') {
      r.alasanFokus = (d.prioritas === 'Darurat') ? '🔴 Darurat & hampir lewat'
        : (d.prioritas === 'Tinggi') ? '🟠 Prioritas Tinggi & hampir lewat'
        : '⚠ Hampir lewat respons';
    } else {
      r.alasanFokus = 'Perlu perhatian';
    }
    return r;
  });
  var terbaruRows = aktif.slice(0, 500).map(function(d){ return siagaDashBuildSummary_(d, nowMs); });
  var selesaiRows = selesai.slice(0, 500).map(function(d){
    var r = siagaDashBuildSummary_(d, nowMs);
    var doneMs = d.waktuSelesaiMs || d.updatedAtMs || d.waktuMasukMs;
    r.selesaiPeriod = doneMs >= firstThisMonth ? 'bulan_ini' : 'bulan_lalu';
    r.selesaiPeriodLabel = doneMs >= firstThisMonth ? 'Bulan Ini' : 'Bulan Sebelumnya';
    return r;
  });
  return { fokus: fokusRows, terbaru: terbaruRows, selesai: selesaiRows, laporanDetail: [] };
}

function siagaDashSanitize_(value) {
  try {
    return JSON.parse(JSON.stringify(value, function(key, val) {
      var original = this ? this[key] : val;
      if (original instanceof Date) return isNaN(original.getTime()) ? null : original.toISOString();
      if (typeof val === 'undefined' || typeof val === 'function') return null;
      return val;
    }));
  } catch(e) {
    return { success: false, error: 'Gagal menyiapkan data dashboard ringan: ' + (e && e.message ? e.message : String(e)) };
  }
}

// ============================================================
// V10.9.165 - DASHBOARD PULSE / CEK RINGAN ADUAN BARU
// ============================================================
// Dipakai Index.html untuk mendeteksi aduan baru lebih cepat tanpa membaca
// seluruh dashboard. Hanya membaca baris ADUAN terbaru dan membuat signature.
function siagaDashBuildPulseSignature_(parsedRows, filters) {
  parsedRows = parsedRows || [];
  filters = filters || {};

  // Cukup baris terbaru karena aduan baru selalu append di bawah.
  // Untuk cabang tertentu, filter tetap diterapkan agar dashboard cabang lain
  // tidak ikut refresh saat ada aduan cabang berbeda.
  var recentRows = parsedRows.slice(Math.max(0, parsedRows.length - 120));
  var rows = siagaDashApplyFilters_(recentRows, filters || {});

  var latestActivityMs = 0;
  var latestId = '';
  var activeCount = 0;
  var statusCompact = [];

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i] || {};
    var activityMs = Math.max(
      Number(d.updatedAtMs || 0),
      Number(d.waktuSelesaiMs || 0),
      Number(d.waktuMasukMs || 0)
    );

    if (siagaDashIsAktif_(d.status)) activeCount++;
    if (activityMs >= latestActivityMs) {
      latestActivityMs = activityMs;
      latestId = d.id || latestId;
    }

    // Ambil ringkas 20 baris paling baru saja agar update status/foto pada data
    // terbaru juga terdeteksi, tapi signature tetap kecil.
    if (statusCompact.length < 20) {
      statusCompact.push([d.id || '', d.status || '', d.updatedAtMs || 0, d.waktuSelesaiMs || 0].join(':'));
    }
  }

  return [
    rows.length,
    activeCount,
    latestActivityMs,
    latestId,
    statusCompact.join('|')
  ].join('~');
}

function siagaDashBuildPulsePayload_(parsedRows, filters) {
  return {
    signature: siagaDashBuildPulseSignature_(parsedRows || [], filters || {}),
    checkedAt: siagaDashDateLabel_(new Date())
  };
}

function clientGetDashboardPulse(filters) {
  try {
    filters = filters || {};
    var sessionUser = validateDashboardSession_(filters._sessionToken || filters.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };

    filters = applyDashboardAccessFilters_(filters, sessionUser);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, signature: 'EMPTY', checkedAt: siagaDashDateLabel_(new Date()) };
    }

    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(16, Math.min(sheet.getLastColumn(), 20));
    var maxPulseRows = 120;
    var startRow = Math.max(2, lastRow - maxPulseRows + 1);
    var readRows = Math.max(0, lastRow - startRow + 1);
    var rawData = readRows > 0 ? sheet.getRange(startRow, 1, readRows, lastCol).getValues() : [];
    var parsed = siagaDashParseRows_(rawData);
    var pulse = siagaDashBuildPulsePayload_(parsed, filters || {});

    return {
      success: true,
      signature: pulse.signature,
      checkedAt: pulse.checkedAt
    };
  } catch (e) {
    Logger.log('Error clientGetDashboardPulse V10.9.165: ' + (e && e.message ? e.message : e) + '\n' + ((e && e.stack) || ''));
    return { success: false, error: (e && e.message) ? e.message : String(e) };
  }
}


function siagaDashCacheKey_(filters, sessionUser) {
  filters = filters || {};
  sessionUser = sessionUser || {};
  var scope = sessionUser.canSeeAll ? 'ADMIN' : normalizeCabangKey_(sessionUser.cabang || 'CABANG');
  var clean = {
    cabang: String(filters.cabang || ''),
    wilayah: String(filters.wilayah || ''),
    period: String(filters.period || filters.periode || ''),
    startDate: String(filters.startDate || filters.tanggalMulai || ''),
    endDate: String(filters.endDate || filters.tanggalSelesai || '')
  };
  return 'DASH_V109168_' + scope + '_' + Utilities.base64EncodeWebSafe(JSON.stringify(clean)).slice(0, 80);
}

function siagaDashGetCachedPayload_(key, sessionUser) {
  try {
    var cache = CacheService.getScriptCache();
    var txt = cache ? cache.get(key) : '';
    if (!txt) return null;
    var data = JSON.parse(txt);
    if (!data || !data.success) return null;
    data.auth = sessionUser;
    data.cacheHit = true;
    data.cacheLabel = 'cache cepat';
    return data;
  } catch(e) {
    return null;
  }
}

function siagaDashPutCachedPayload_(key, payload) {
  try {
    if (!key || !payload || !payload.success) return;
    var copy = JSON.parse(JSON.stringify(payload));
    copy.auth = null;
    copy.cacheHit = false;
    var txt = JSON.stringify(copy);
    // CacheService punya batas ukuran per key. Jika payload terlalu besar, lewati agar tidak error.
    if (txt.length > 95000) return;
    var cache = CacheService.getScriptCache();
    if (cache) cache.put(key, txt, 90);
  } catch(e) {}
}

function clientGetDashboardData(filters) {
  try {
    filters = filters || {};
    var sessionUser = validateDashboardSession_(filters._sessionToken || filters.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    filters = applyDashboardAccessFilters_(filters, sessionUser);
    var forceRefresh = String(filters._forceRefresh || '').toLowerCase() === 'true' || filters._forceRefresh === true;
    var dashCacheKey = siagaDashCacheKey_(filters, sessionUser);
    if (!forceRefresh) {
      var cachedPayload = siagaDashGetCachedPayload_(dashCacheKey, sessionUser);
      if (cachedPayload) return siagaDashSanitize_(cachedPayload);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    var now = new Date();
    var nowMs = now.getTime();
    var rangeInfo = getReportDateRange_(filters || {}, now);

    if (!sheet || sheet.getLastRow() < 2) {
      var empty = getEmptyData();
      empty.meta = enrichDashboardMetaWithPeriod_(buildDashboardMetaByAccess_(sessionUser), rangeInfo);
      empty.auth = sessionUser;
      empty.dashboardPulse = { signature: 'EMPTY', checkedAt: siagaDashDateLabel_(now) };
      return siagaDashSanitize_(empty);
    }

    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(16, Math.min(sheet.getLastColumn(), 20));
    var rowCount = Math.max(0, lastRow - 1);
    // Batas aman Apps Script agar dashboard tidak timeout jika sheet membesar.
    var maxReadRows = 3500; // V10.9.168: batasi lebih ringan; cache 90 detik menjaga dashboard tetap cepat
    var startRow = rowCount > maxReadRows ? (lastRow - maxReadRows + 1) : 2;
    var readRows = rowCount > maxReadRows ? maxReadRows : rowCount;
    var rawData = readRows > 0 ? sheet.getRange(startRow, 1, readRows, lastCol).getValues() : [];
    var allData = siagaDashParseRows_(rawData);
    var filteredData = siagaDashApplyFilters_(allData, filters || {});

    var aduanHariIni = filteredData.length;
    var aduanAktif = 0;
    var selesaiHariIni = 0;
    var lewatSLA = 0;
    var prioritasTinggi = 0;
    for (var i = 0; i < filteredData.length; i++) {
      var d = filteredData[i];
      if (siagaDashIsAktifDitangani_(d.status)) aduanAktif++;
      if (siagaDashIsSelesaiStatus_(d.status)) selesaiHariIni++;
      if ((d.prioritas === 'Tinggi' || d.prioritas === 'Darurat') && siagaDashIsAktif_(d.status)) prioritasTinggi++;
      var info = siagaDashSlaInfo_(d, nowMs);
      if (siagaDashIsAktif_(d.status) && !info.responded && info.statusCode === 'ACTIVE_LATE') lewatSLA++;
    }

    var charts = {
      tren7Hari: siagaDashTren7Hari_(filteredData, now),
      tren7HariCabang: siagaDashTren7HariCabang_(filteredData, now),
      statusCount: siagaDashStatusCount_(filteredData),
      jenisCount: siagaDashJenisCount_(filteredData),
      cabangRanking: siagaDashCabangRanking_(filteredData, nowMs),
      cabangSpeedRanking: []
    };
    charts.cabangSpeedRanking = charts.cabangRanking;

    var payload = {
      success: true,
      auth: sessionUser,
      fastMode: true,
      lastUpdate: siagaDashDateLabel_(now),
      dashboardPulse: siagaDashBuildPulsePayload_(allData, filters || {}),
      cards: {
        aduanHariIni: aduanHariIni,
        aduanAktif: aduanAktif,
        lewatSLA: lewatSLA,
        selesaiHariIni: selesaiHariIni
      },
      sidebar: {
        aduanBulanIni: aduanHariIni,
        prioritasTinggi: prioritasTinggi,
        lewatSLA: lewatSLA
      },
      charts: charts,
      tables: siagaDashTables_(filteredData, nowMs),
      chatAdmin: { success: true, count: 0, requests: [] },
      adminMetrics: siagaDashAdminMetrics_(filteredData, nowMs),
      meta: enrichDashboardMetaWithPeriod_(buildDashboardMetaByAccess_(sessionUser), rangeInfo)
    };
    try { payload.chatAdmin = clientGetChatAdminDashboardRequests({ _sessionToken: filters._sessionToken || filters.sessionToken || '', limit: 10 }); } catch(eChatDash) {}
    var safePayload = siagaDashSanitize_(payload);
    siagaDashPutCachedPayload_(dashCacheKey, safePayload);
    return safePayload;
  } catch (e) {
    Logger.log('Error clientGetDashboardData V10.9.159 LIGHT: ' + (e && e.message ? e.message : e) + '\n' + ((e && e.stack) || ''));
    return { success: false, error: (e && e.message) ? e.message : String(e) };
  }
}


// ============================================================
// V10.9.201 - HOTFIX FINAL CHAT ADMIN QUEUE ANTI HILANG
// Basis stabil V10.9.195. Fix ini sengaja sederhana:
// - Dashboard membaca langsung CHAT_ADMIN_QUEUE, bukan filter kompleks.
// - Chat Admin dari nomor baru TANPA aduan tetap muncul.
// - Session ADMIN_HANDOFF tetap disimpan.
// - Queue aktif tanpa balasan admin >24 jam dipindah arsip dan tidak tampil di card aktif.
// ============================================================

function setupChatAdminQueueSheet_FINAL201_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = 'CHAT_ADMIN_QUEUE';
  var sh = ss.getSheetByName(name);
  var headers = ['Phone', 'Nama', 'Aduan ID', 'Status', 'Context', 'Last Customer Message', 'Last Customer At', 'Last Admin Message', 'Last Admin At', 'Updated At', 'Source', 'Data JSON'];
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    var current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    var mismatch = false;
    for (var i = 0; i < headers.length; i++) {
      if (String(current[i] || '').trim() !== headers[i]) { mismatch = true; break; }
    }
    if (mismatch) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#111827').setFontColor('#ffffff').setFontWeight('bold');
  } catch(e) {}
  return sh;
}

function setupChatAdminArchiveSheet_FINAL201_(ss, dateObj) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  dateObj = dateObj || new Date();
  var ym = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy_MM');
  var name = 'ARSIP_CHAT_ADMIN_' + ym;
  var sh = ss.getSheetByName(name);
  var headers = ['Phone', 'Nama', 'Aduan ID', 'Status', 'Context', 'Last Customer Message', 'Last Customer At', 'Last Admin Message', 'Last Admin At', 'Updated At', 'Source', 'Data JSON', 'Archived At', 'Archive Reason'];
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#0f2044').setFontColor('#ffffff').setFontWeight('bold');
  } catch(e) {}
  return sh;
}

function parseChatAdminJson_FINAL201_(txt) {
  try { return txt ? JSON.parse(String(txt)) : {}; } catch(e) { return {}; }
}

function findChatAdminQueueRow_FINAL201_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;
  var sh = setupChatAdminQueueSheet_FINAL201_(SpreadsheetApp.getActiveSpreadsheet());
  var lr = sh.getLastRow();
  if (lr < 2) return null;
  var values = sh.getRange(2, 1, lr - 1, 12).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizePhone_(values[i][0] || '') === phone) return { sheet: sh, rowNumber: i + 2, values: values[i] };
  }
  return null;
}

function upsertChatAdminQueue_FINAL201_(phone, data, status) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor kosong' };
  data = data || {};
  status = String(status || 'ACTIVE').trim().toUpperCase();
  var sh = setupChatAdminQueueSheet_FINAL201_(SpreadsheetApp.getActiveSpreadsheet());
  var now = new Date();
  var nama = data.nama || '';
  if (!nama) { try { nama = getRememberedWhatsAppCustomerName_(phone) || ''; } catch(eName) {} }
  var row = [
    phone,
    nama || 'Pelanggan',
    normalizeAduanIdHyphen_(data.aduanId || data.id || ''),
    status,
    data.context || 'Chat Admin',
    data.lastCustomerMessage || data.message || 'chat admin',
    data.lastCustomerMessageAt || data.customerAt || data.activatedAt || now,
    data.lastAgentMessage || data.lastAdminMessage || '',
    data.lastAgentMessageAt || data.lastAdminMessageAt || '',
    now,
    data.source || 'customer_request',
    JSON.stringify(data || {})
  ];
  var found = findChatAdminQueueRow_FINAL201_(phone);
  if (found && found.rowNumber) {
    sh.getRange(found.rowNumber, 1, 1, row.length).setValues([row]);
    return { success: true, updated: true, rowNumber: found.rowNumber };
  }
  sh.appendRow(row);
  return { success: true, inserted: true, rowNumber: sh.getLastRow() };
}

function archiveChatAdminQueue_FINAL201_(phone, reason) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor kosong' };
  var found = findChatAdminQueueRow_FINAL201_(phone);
  if (!found) return { success: true, archived: false };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var archive = setupChatAdminArchiveSheet_FINAL201_(ss, new Date());
  var values = found.values || [];
  while (values.length < 12) values.push('');
  archive.appendRow(values.slice(0, 12).concat([new Date(), reason || 'Selesai/Kedaluwarsa']));
  try { found.sheet.deleteRow(found.rowNumber); } catch(eDel) {}
  return { success: true, archived: true };
}

function getChatAdminQueueRows_FINAL201_() {
  var sh = setupChatAdminQueueSheet_FINAL201_(SpreadsheetApp.getActiveSpreadsheet());
  var lr = sh.getLastRow();
  if (lr < 2) return [];
  var values = sh.getRange(2, 1, lr - 1, 12).getValues();
  return values.map(function(r, i) {
    return {
      rowNumber: i + 2,
      phone: normalizePhone_(r[0] || ''),
      nama: String(r[1] || '').trim(),
      aduanId: normalizeAduanIdHyphen_(r[2] || ''),
      status: String(r[3] || '').trim().toUpperCase(),
      context: String(r[4] || '').trim() || 'Chat Admin',
      lastCustomerMessage: String(r[5] || '').trim(),
      lastCustomerMessageAt: r[6] || '',
      lastAgentMessage: String(r[7] || '').trim(),
      lastAgentMessageAt: r[8] || '',
      updatedAt: toSafeDate_(r[9]) || null,
      source: String(r[10] || '').trim(),
      data: parseChatAdminJson_FINAL201_(r[11]) || {}
    };
  }).filter(function(x) { return !!x.phone; });
}

// Override: jangan buang lastCustomerMessage saat session dibangun.
function buildAgentHandoffData_(data) {
  data = data || {};
  return {
    context: data.context || 'Chat Admin',
    aduanId: data.aduanId || data.id || '',
    activatedBy: data.activatedBy || '',
    activatedByRole: data.activatedByRole || '',
    source: data.source || 'dashboard',
    activatedAt: data.activatedAt || new Date().toISOString(),
    expiresMinutes: normalizeAgentChatMinutes_(data.expiresMinutes || 15),
    lastCustomerMessage: data.lastCustomerMessage || data.message || '',
    lastCustomerMessageAt: data.lastCustomerMessageAt || data.customerAt || data.activatedAt || new Date().toISOString(),
    lastAgentMessage: data.lastAgentMessage || data.lastAdminMessage || '',
    lastAgentMessageAt: data.lastAgentMessageAt || data.lastAdminMessageAt || '',
    nama: data.nama || '',
    queueNote: data.queueNote || ''
  };
}

// Override: semua aktivasi Chat Admin wajib masuk queue.
function activateAgentChatSession_(phone, data, minutes) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor pelanggan tidak valid.' };
  var previousData = {};
  try {
    var previousSession = getWhatsAppSession_(phone);
    if (previousSession && isAgentHandoffState_(previousSession.state)) previousData = previousSession.data || {};
  } catch(ePrev) {}
  data = Object.assign({}, previousData, data || {});
  data = buildAgentHandoffData_(data || {});
  data.expiresMinutes = normalizeAgentChatMinutes_(minutes || data.expiresMinutes || 15);
  setWhatsAppSession_(phone, 'ADMIN_HANDOFF', data);
  try { CacheService.getScriptCache().put('AGENT_CHAT_ACTIVE_' + phone, JSON.stringify(data), safeCacheExpirationSeconds_(data.expiresMinutes * 60)); } catch(e) {}
  try { upsertChatAdminQueue_FINAL201_(phone, data, 'ACTIVE'); } catch(eQueue) {}
  return { success: true, phone: phone, data: data };
}

// Override: akhiri chat = keluarkan dari queue aktif dan arsipkan.
function endAgentChatSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, error: 'Nomor pelanggan tidak valid.' };
  try {
    var session = getWhatsAppSession_(phone);
    if (session && isAgentHandoffState_(session.state)) clearWhatsAppSession_(phone);
  } catch(eClear) {}
  try { CacheService.getScriptCache().remove('AGENT_CHAT_ACTIVE_' + phone); } catch(eCache) {}
  try { archiveChatAdminQueue_FINAL201_(phone, 'Chat Admin selesai/diakhiri'); } catch(eArchive) {}
  return { success: true, phone: phone };
}



// V10.9.207 - Chat Admin window dibuat 24 jam penuh.
// Card keluar dari antrean aktif jika admin klik Akhiri, admin belum membalas sampai window habis, atau pelanggan diam 15 menit setelah admin membalas.
function chatAdminFreeWindowMs_FINAL207_() {
  return 24 * 60 * 60 * 1000;
}
function chatAdminFreeWindowMinutes_FINAL207_() {
  return 24 * 60;
}

// V11 CRM: pelanggan tidak boleh terjebak di Mode Admin ketika petugas belum
// membalas. Setelah 15 menit tanpa balasan petugas, takeover ditutup dan menu
// layanan dikirim kembali. Lock + pengecekan ulang mencegah menu terkirim ganda
// jika dua trigger berjalan pada menit yang sama.
function closeUnansweredAgentChatAfter15m_FINAL_(phone, rawData, updatedAt) {
  phone = normalizePhone_(phone || '');
  if (!phone) return { success: false, closed: false, error: 'Nomor pelanggan tidak valid.' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) return { success: false, closed: false, busy: true };
  try {
    var current = getAgentChatStatusByPhone_(phone);
    if (!current || !current.active) return { success: true, closed: false, reason: 'NOT_ACTIVE' };

    var supplied = parseChatAdminJson_FINAL201_(rawData) || {};
    var data = Object.assign({}, supplied, current.data || {});
    var customerAt = toSafeDate_(data.lastCustomerMessageAt || data.activatedAt || updatedAt || '');
    var agentAt = toSafeDate_(data.lastAgentMessageAt || data.lastAdminMessageAt || '');
    if (!customerAt || isNaN(customerAt.getTime())) return { success: true, closed: false, reason: 'NO_CUSTOMER_TIME' };

    // Balasan petugas yang dikirim setelah pesan terakhir pelanggan berarti
    // percakapan sudah ditangani; timeout pelanggan memakai jalur lain.
    if (agentAt && !isNaN(agentAt.getTime()) && agentAt.getTime() >= customerAt.getTime()) {
      return { success: true, closed: false, reason: 'AGENT_REPLIED' };
    }

    var waitMinutes = (new Date().getTime() - customerAt.getTime()) / 60000;
    if (waitMinutes < 15) return { success: true, closed: false, waitMinutes: Math.max(0, Math.floor(waitMinutes)) };

    endAgentChatSession_(phone);

    var notice = [
      'Maaf, admin belum dapat membalas dalam 15 menit.',
      '',
      'Layanan otomatis telah diaktifkan kembali. Silakan pilih menu yang Anda butuhkan.'
    ].join('\n');
    var noticeSend = sendWhatsAppMessage_(phone, notice, {});
    var menuSend = { success: false };
    try {
      if (typeof shouldUseInteractiveMenu_ === 'function' && shouldUseInteractiveMenu_() && typeof sendKiriminInteractiveMenu_ === 'function') {
        menuSend = sendKiriminInteractiveMenu_(phone, { customerName: data.nama || getRememberedWhatsAppCustomerName_(phone) || '' });
      }
    } catch(eInteractive) {
      menuSend = { success: false, error: eInteractive.message || String(eInteractive) };
    }
    if (!(menuSend && menuSend.success)) menuSend = sendWhatsAppMessage_(phone, buildMainWhatsAppMenuReply_(phone, {}), {});

    logWhatsApp_(
      phone,
      'Chat Admin berakhir otomatis: admin belum membalas 15 menit',
      'AGENT_CHAT_TIMEOUT_ADMIN_NO_REPLY',
      data.aduanId || '',
      notice,
      menuSend && menuSend.success ? 'SENT' : 'FAILED',
      JSON.stringify({ source: 'AUTO_TIMEOUT_15_MINUTES', noticeSend: noticeSend, menuSend: menuSend })
    );

    return {
      success: true,
      closed: true,
      waitMinutes: Math.floor(waitMinutes),
      noticeSent: !!(noticeSend && noticeSend.success),
      menuSent: !!(menuSend && menuSend.success)
    };
  } finally {
    lock.releaseLock();
  }
}

function buildChatAdminDashboardRow_FINAL201_(q) {
  q = q || {};
  var phone = normalizePhone_(q.phone || '');
  if (!phone) return null;
  var data = q.data || {};
  var customerAt = toSafeDate_(q.lastCustomerMessageAt || data.lastCustomerMessageAt || data.activatedAt || q.updatedAt || '');
  var updatedAt = toSafeDate_(q.updatedAt || q.lastCustomerMessageAt || data.updatedAt || data.activatedAt || '') || new Date();

  var lastAgentAt = toSafeDate_(q.lastAgentMessageAt || data.lastAgentMessageAt || '');

  // V10.9.207:
  // Card Chat Admin jangan hilang setelah admin membalas.
  // Card keluar dari antrean aktif jika:
  // 1) admin klik Akhiri, atau
  // 2) admin belum membalas sampai window 24 jam habis, atau
  // 3) admin sudah membalas tetapi pelanggan tidak membalas selama 15 menit.
  if (customerAt && ((new Date()).getTime() - customerAt.getTime()) > chatAdminFreeWindowMs_FINAL207_() && (!lastAgentAt || isNaN(lastAgentAt.getTime()))) {
    try { archiveChatAdminQueue_FINAL201_(phone, 'Chat Admin kedaluwarsa: admin belum membalas 24 jam'); } catch(eArch) {}
    return null;
  }

  var messages = [];
  try { messages = getAgentChatConversation_(phone, q.aduanId || data.aduanId || '', 8) || []; } catch(eConv) {}
  if (!messages.length) {
    messages = [{ direction: 'customer', sender: 'Pelanggan', text: q.lastCustomerMessage || data.lastCustomerMessage || 'chat admin', timeText: customerAt ? Utilities.formatDate(customerAt, Session.getScriptTimeZone(), 'dd/MM HH:mm') : '' }];
    if (q.lastAgentMessage || data.lastAgentMessage) {
      var ad = toSafeDate_(q.lastAgentMessageAt || data.lastAgentMessageAt || '');
      messages.push({ direction: 'admin', sender: 'Admin', text: q.lastAgentMessage || data.lastAgentMessage || '', timeText: ad ? Utilities.formatDate(ad, Session.getScriptTimeZone(), 'dd/MM HH:mm') : '' });
    }
  }

  var canReply = true;
  var ageMinutes = null;
  if (customerAt) {
    ageMinutes = Math.max(0, Math.floor((new Date().getTime() - customerAt.getTime()) / 60000));
    canReply = ageMinutes <= chatAdminFreeWindowMinutes_FINAL207_();
  }

  var nowMsForWait = (new Date()).getTime();
  var waitingAdmin = !lastAgentAt || (customerAt && !isNaN(customerAt.getTime()) && lastAgentAt && !isNaN(lastAgentAt.getTime()) && customerAt.getTime() > lastAgentAt.getTime());
  var waitMinutes = customerAt ? Math.max(0, Math.floor((nowMsForWait - customerAt.getTime()) / 60000)) : 0;
  var adminLate = waitingAdmin && waitMinutes >= 15;

  // V10.9.209: jika admin sudah membalas lalu pelanggan tidak membalas 15 menit,
  // chat dikeluarkan dari popup aktif dan dipindahkan ke arsip.
  // Catatan: jika pelanggan membalas lagi setelah itu, webhook akan membuka sesi baru/normal kembali.
  var waitingCustomer = false;
  var customerWaitMinutes = 0;
  var customerLate = false;
  if (!waitingAdmin && lastAgentAt && !isNaN(lastAgentAt.getTime())) {
    waitingCustomer = true;
    customerWaitMinutes = Math.max(0, Math.floor((nowMsForWait - lastAgentAt.getTime()) / 60000));
    customerLate = customerWaitMinutes >= 15;
    if (customerLate) {
      try { archiveChatAdminQueue_FINAL201_(phone, 'Chat Admin selesai otomatis: pelanggan tidak membalas 15 menit setelah admin membalas'); } catch(eArchCustomer) {}
      try {
        var activeSession = getWhatsAppSession_(phone);
        if (activeSession && isAgentHandoffState_(activeSession.state)) clearWhatsAppSession_(phone);
      } catch(eClearCustomer) {}
      try { CacheService.getScriptCache().remove('AGENT_CHAT_ACTIVE_' + phone); } catch(eCacheCustomer) {}
      return null;
    }
  }

  var minutesLeft = null;
  if (lastAgentAt) minutesLeft = Math.max(0, Math.ceil((15 * 60000 - (nowMsForWait - lastAgentAt.getTime())) / 60000));

  return {
    phone: phone,
    aduanId: q.aduanId || data.aduanId || '',
    pelanggan: q.nama || data.nama || getRememberedWhatsAppCustomerName_(phone) || 'Pelanggan',
    cabang: '',
    jenis: '',
    statusAduan: '',
    context: q.context || data.context || 'Chat Admin',
    lastMessage: truncateForLog_(q.lastCustomerMessage || data.lastCustomerMessage || 'chat admin', 500),
    lastMessageTime: customerAt ? Utilities.formatDate(customerAt, Session.getScriptTimeZone(), 'dd/MM HH:mm') : '',
    lastAdminMessage: truncateForLog_(q.lastAgentMessage || data.lastAgentMessage || '', 500),
    updatedAt: updatedAt.getTime(),
    updatedText: Utilities.formatDate(updatedAt, Session.getScriptTimeZone(), 'dd/MM HH:mm'),
    minutesLeft: minutesLeft,
    messages: messages,
    canReply: canReply,
    windowInfo: { canReply: canReply, ageMinutes: ageMinutes, reason: canReply ? 'OPEN_24H' : 'CLOSED_24H' },
    waitingInfo: {
      waitingAdmin: waitingAdmin,
      adminLate: adminLate,
      waitMinutes: waitMinutes,
      waitingCustomer: waitingCustomer,
      customerLate: customerLate,
      customerWaitMinutes: customerWaitMinutes
    },
    waitingAdmin: waitingAdmin,
    adminLate: adminLate,
    adminWaitMinutes: waitMinutes,
    waitingCustomer: waitingCustomer,
    customerLate: customerLate,
    customerWaitMinutes: customerWaitMinutes
  };
}

// Override final: dashboard baca langsung queue aktif, tidak pakai filter rumit.
function clientGetChatAdminDashboardRequests(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    var limit = Number(form.limit || 10) || 10;
    var rows = [];
    var seen = {};

    getChatAdminQueueRows_FINAL201_().forEach(function(q) {
      if (!q.phone || seen[q.phone]) return;
      if (q.status && q.status !== 'ACTIVE') return;
      var item = buildChatAdminDashboardRow_FINAL201_(q);
      if (item) { rows.push(item); seen[q.phone] = true; }
    });

    // Fallback: kalau session ADMIN_HANDOFF ada tapi queue belum sempat dibuat, buat queue dan tampilkan.
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      setupWhatsAppSessionSheet(ss);
      var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
      if (sh && sh.getLastRow() >= 2) {
        var vals = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 5)).getValues();
        vals.forEach(function(r) {
          var phone = normalizePhone_(r[0] || '');
          var state = String(r[1] || '').trim();
          if (!phone || seen[phone] || !isAgentHandoffState_(state)) return;
          var data = parseChatAdminJson_FINAL201_(r[2]) || {};
          if (!data.lastCustomerMessage) data.lastCustomerMessage = data.context || 'chat admin';
          if (!data.lastCustomerMessageAt) data.lastCustomerMessageAt = r[3] || new Date();
          upsertChatAdminQueue_FINAL201_(phone, data, 'ACTIVE');
          var item = buildChatAdminDashboardRow_FINAL201_({ phone: phone, nama: data.nama || '', aduanId: data.aduanId || '', status: 'ACTIVE', context: data.context || 'Chat Admin', lastCustomerMessage: data.lastCustomerMessage, lastCustomerMessageAt: data.lastCustomerMessageAt, lastAgentMessage: data.lastAgentMessage || '', lastAgentMessageAt: data.lastAgentMessageAt || '', updatedAt: toSafeDate_(r[3]) || new Date(), data: data });
          if (item) { rows.push(item); seen[phone] = true; }
        });
      }
    } catch(eSess) {}

    rows.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    rows = rows.slice(0, limit);
    return { success: true, count: rows.length, requests: rows, checkedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm:ss'), source: 'QUEUE_FINAL201' };
  } catch(e) {
    return { success: false, error: e.message || String(e), source: 'QUEUE_FINAL201_ERROR' };
  }
}

// Override: kirim balasan admin sekaligus update queue.
function clientSendAgentChatMessage(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    var phone = normalizePhone_(form.noHp || form.phone || '');
    var message = String(form.message || '').trim();
    if (!phone) return { success: false, error: 'No HP pelanggan kosong/tidak valid.' };
    if (!message) return { success: false, error: 'Isi pesan balasan admin masih kosong.' };

    var q = findChatAdminQueueRow_FINAL201_(phone);
    if (!q) return { success: false, error: 'Chat Admin sudah tidak aktif atau tidak ditemukan di antrean.' };
    var data = parseChatAdminJson_FINAL201_(q.values[11]) || {};
    var customerAt = toSafeDate_(q.values[6] || data.lastCustomerMessageAt || '');
    if (customerAt && (new Date().getTime() - customerAt.getTime()) > chatAdminFreeWindowMs_FINAL207_()) {
      return { success: false, blocked24h: true, error: 'Balasan dinonaktifkan karena pelanggan belum mengirim pesan dalam 24 jam terakhir.' };
    }

    var now = new Date();
    data.lastAgentMessage = message;
    data.lastAgentMessageAt = now.toISOString();
    data.source = 'dashboard_reply';
    upsertChatAdminQueue_FINAL201_(phone, data, 'ACTIVE');
    // Aktifkan takeover sebelum pesan dikirim agar balasan pelanggan yang masuk
    // bersamaan tidak sempat dijawab oleh menu/bot otomatis.
    activateAgentChatSession_(phone, data, 15);
    var send = sendWhatsAppMessage_(phone, message, {});
    logWhatsApp_(phone, 'Balasan admin dashboard', 'AGENT_CHAT_REPLY', form.id || form.aduanId || '', message, send && send.success ? 'SENT' : 'FAILED', JSON.stringify({ sessionUser: sessionUser, send: send }));
    return { success: !!(send && send.success), send: send, message: send && send.success ? 'Balasan admin terkirim.' : 'Balasan admin gagal dikirim.' };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}
