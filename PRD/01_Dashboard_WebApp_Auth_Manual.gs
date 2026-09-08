// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: 01_Dashboard_WebApp_Auth_Manual.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================



// ============================================================
// V10.9.65 - WEB LOGIN CABANG / PETUGAS
// V10.9.67 - WEB INPUT ADUAN MANUAL (PIN)
// Satu dashboard untuk Admin Pusat, Cabang, dan Petugas Cabang.
// Cabang/petugas hanya menerima data cabangnya dari server.
// ============================================================


// ============================================================
// V10.9.88 - DROPDOWN & WARNA ADUAN UTAMA
// ============================================================

function addDropdownValidations(sheet) {
  return applyMainAduanDropdowns_(sheet);
}

function addConditionalFormatting(sheet) {
  return applyMainAduanConditionalFormatting_(sheet);
}

function applyMainAduanDropdowns_(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: false, error: 'Sheet ADUAN tidak ditemukan.' };

  var lastRow = Math.max(safeGetLastRow_(sheet), 2);
  var maxRows = Math.max(1000, lastRow + 300);
  var rowCount = Math.max(1, Math.min(sheet.getMaxRows() - 1, maxRows - 1));

  var cabangRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.CABANG || [], true)
    .setAllowInvalid(true)
    .build();

  var wilayahRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.WILAYAH || [], true)
    .setAllowInvalid(true)
    .build();

  var jenisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.JENIS_GANGGUAN || ['Air Mati', 'Tekanan Rendah', 'Air Keruh', 'Pipa Bocor', 'Meter Bermasalah', 'Tagihan', 'Sambungan Baru', 'Lainnya'], true)
    .setAllowInvalid(true)
    .build();

  var priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.PRIORITAS || ['Rendah', 'Sedang', 'Tinggi', 'Darurat'], true)
    .setAllowInvalid(false)
    .build();

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS || ['Baru', 'Proses', 'Selesai', 'Ditunda', 'Batal'], true)
    .setAllowInvalid(false)
    .build();

  var unitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.UNIT || ['Cabang', 'Hublang', 'Teknik', 'Distribusi', 'Produksi', 'IT', 'Lainnya'], true)
    .setAllowInvalid(true)
    .build();

  try { sheet.getRange(2, CONFIG.COL.CABANG, rowCount, 1).setDataValidation(cabangRule); } catch(e0) {}
  try { sheet.getRange(2, CONFIG.COL.WILAYAH, rowCount, 1).setDataValidation(wilayahRule); } catch(e1) {}
  try { sheet.getRange(2, CONFIG.COL.JENIS_GANGGUAN, rowCount, 1).setDataValidation(jenisRule); } catch(e2) {}
  try { sheet.getRange(2, CONFIG.COL.PRIORITAS, rowCount, 1).setDataValidation(priorityRule); } catch(e3) {}
  try { sheet.getRange(2, CONFIG.COL.STATUS, rowCount, 1).setDataValidation(statusRule); } catch(e4) {}
  try { sheet.getRange(2, CONFIG.COL.UNIT, rowCount, 1).setDataValidation(unitRule); } catch(e5) {}

  try { sheet.getRange(2, CONFIG.COL.WAKTU_MASUK, rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e6) {}
  try { sheet.getRange(2, CONFIG.COL.WAKTU_SELESAI, rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e7) {}
  try { sheet.getRange(2, CONFIG.COL.UPDATED_AT, rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e8) {}

  return { success: true, rows: rowCount };
}

function applyMainAduanConditionalFormatting_(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: false, error: 'Sheet ADUAN tidak ditemukan.' };

  var lastCol = Math.max(sheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20);
  var maxRows = Math.max(1000, safeGetLastRow_(sheet) + 300);
  var rowCount = Math.max(1, Math.min(sheet.getMaxRows() - 1, maxRows - 1));
  var dataRange = sheet.getRange(2, 1, rowCount, Math.min(lastCol, 20));

  // Pertahankan conditional formatting lain yang bukan area ADUAN utama sebisa mungkin.
  var existing = sheet.getConditionalFormatRules() || [];
  var kept = existing.filter(function(rule) {
    try {
      var ranges = rule.getRanges() || [];
      return !ranges.some(function(r) {
        return r.getRow() === 2 && r.getColumn() === 1 && r.getNumColumns() >= 10;
      });
    } catch(e) {
      return true;
    }
  });

  function makeStatusRule(status, bg, fg) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="' + status + '"')
      .setBackground(bg)
      .setFontColor(fg || '#0f172a')
      .setRanges([dataRange])
      .build();
  }

  function makePriorityRule(priority, bg, fg) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$I2="' + priority + '"')
      .setBackground(bg)
      .setFontColor(fg || '#0f172a')
      .setRanges([sheet.getRange(2, CONFIG.COL.PRIORITAS, rowCount, 1)])
      .build();
  }

  function makeSlaLateRule() {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($J2<>"Selesai",$J2<>"Batal",$B2<>"",$O2<>"",NOW()>($B2+($O2/24)))')
      .setBackground('#fff1f2')
      .setFontColor('#7f1d1d')
      .setRanges([dataRange])
      .build();
  }

  var rules = kept.concat([
    makeStatusRule('Baru', '#f8fafc'),
    makeStatusRule('Proses', '#e0f2fe'),
    makeStatusRule('Selesai', '#dcfce7'),
    makeStatusRule('Ditunda', '#fef3c7'),
    makeStatusRule('Batal', '#fee2e2'),
    makePriorityRule('Rendah', '#f1f5f9'),
    makePriorityRule('Sedang', '#dbeafe'),
    makePriorityRule('Tinggi', '#ffedd5'),
    makePriorityRule('Darurat', '#fee2e2', '#991b1b'),
    makeSlaLateRule()
  ]);

  try { sheet.setConditionalFormatRules(rules); } catch(e) {}

  return { success: true, rows: rowCount };
}

function applyMainAduanRowStyle_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return;
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 20), 20);

  try {
    sheet.getRange(rowNumber, 1, 1, lastCol)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
  } catch(e) {}

  try { sheet.getRange(rowNumber, CONFIG.COL.WAKTU_MASUK).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e2) {}
  try { sheet.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e3) {}
  try { sheet.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e4) {}
}

function refreshMainAduanDropdownsAndColors() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = setupAduanSheet(ss);
  }

  applyMainAduanDropdowns_(sheet);
  applyMainAduanConditionalFormatting_(sheet);

  var lastRow = safeGetLastRow_(sheet);
  for (var r = 2; r <= lastRow; r++) {
    applyMainAduanRowStyle_(sheet, r);
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Refresh ADUAN selesai',
      'Dropdown Prioritas/Status/Unit dan warna status di sheet ADUAN sudah diperbarui.\n\n' +
      'Catatan: sheet CABANG_* adalah mirror dari ADUAN. Jika baris di CABANG_* dihapus manual, data sumber di ADUAN tidak ikut terhapus.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}

  return { success: true, rows: lastRow };
}


function getDashboardWebCabangList_() {
  return [
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
  ];
}

function dashboardSha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function getDashboardInitialPinMap_() {
  return {
    'Admin Pusat': '000000',
    'Cabang Praya': '111111',
    'Cabang Praya Tengah': '222222',
    'Cabang Praya Barat': '333333',
    'Cabang Praya Barat Daya': '444444',
    'Cabang Praya Timur': '555555',
    'Cabang Pujut': '666666',
    'Cabang Jonggat': '777777',
    'Cabang Batukliang': '888888',
    'Cabang Batukliang Utara': '999999',
    'Cabang Kopang': '121212',
    'Cabang Janapria': '232323',
    'Cabang Pringgarata': '343434'
  };
}

function normalizeDashboardUsername_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^cabang\s+/i, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function getOrCreateDashboardUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('WEB_USERS');
  if (!sh) {
    sh = ss.insertSheet('WEB_USERS');
  }

  var headers = ['Username', 'PIN Hash', 'Role', 'Cabang', 'Nama Tampilan', 'Status Aktif', 'Created At', 'Last Login'];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (!current[i]) sh.getRange(1, i + 1).setValue(headers[i]);
    }
  }

  var existing = {};
  if (sh.getLastRow() >= 2) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), headers.length)).getValues();
    rows.forEach(function(r) {
      var cabang = String(r[3] || '').trim();
      if (cabang) existing[cabang] = true;
    });
  }

  var now = new Date();
  var pins = getDashboardInitialPinMap_();

  if (!existing['ALL']) {
    sh.appendRow(['admin', dashboardSha256_(pins['Admin Pusat']), 'Admin Pusat', 'ALL', 'Admin Pusat', 'Aktif', now, '']);
  }

  getDashboardWebCabangList_().forEach(function(cabang) {
    if (existing[cabang]) return;
    sh.appendRow([
      normalizeDashboardUsername_(cabang),
      dashboardSha256_(pins[cabang] || '123456'),
      'Cabang',
      cabang,
      cabang,
      'Aktif',
      now,
      ''
    ]);
  });

  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#0f2044').setFontColor('#ffffff').setFontWeight('bold');
  } catch(e) {}

  return sh;
}

function getOrCreateDashboardSessionsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('WEB_SESSIONS');
  if (!sh) sh = ss.insertSheet('WEB_SESSIONS');
  var headers = ['Token Hash', 'Username', 'Role', 'Cabang', 'Nama Tampilan', 'Expired At', 'Last Access', 'Created At'];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#0f2044').setFontColor('#ffffff').setFontWeight('bold');
  } catch(e) {}
  return sh;
}

function generateDashboardToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function buildDashboardUserResponse_(rowObj, token, expiresAt) {
  var isAdmin = String(rowObj.role || '').toLowerCase().indexOf('admin') !== -1 || String(rowObj.cabang || '') === 'ALL';
  return {
    username: rowObj.username || '',
    role: rowObj.role || 'Cabang',
    cabang: rowObj.cabang || '',
    nama: rowObj.nama || rowObj.cabang || rowObj.username || '',
    canSeeAll: isAdmin,
    token: token || '',
    expiresAt: expiresAt ? expiresAt.toISOString() : ''
  };
}

function findDashboardUserByCabang_(selectedCabang, pin) {
  selectedCabang = String(selectedCabang || '').trim();
  pin = String(pin || '').trim();
  if (!selectedCabang || !pin) return null;

  var sh = getOrCreateDashboardUsersSheet_();
  if (sh.getLastRow() < 2) return null;

  var pinHash = dashboardSha256_(pin);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 8)).getValues();
  var wantedCabang = selectedCabang === 'Admin Pusat' ? 'ALL' : selectedCabang;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var status = String(r[5] || '').trim().toLowerCase();
    if (status && status !== 'aktif') continue;

    if (String(r[3] || '').trim() !== wantedCabang) continue;
    if (String(r[1] || '').trim() !== pinHash) continue;

    sh.getRange(i + 2, 8).setValue(new Date());
    return {
      username: String(r[0] || '').trim(),
      role: String(r[2] || '').trim() || 'Cabang',
      cabang: String(r[3] || '').trim(),
      nama: String(r[4] || '').trim() || String(r[3] || '').trim(),
      rowNumber: i + 2
    };
  }

  return null;
}

function clientDashboardLogin(selectedCabang, pin, remember) {
  try {
    var user = findDashboardUserByCabang_(selectedCabang, pin);
    if (!user) {
      return { success: false, error: 'Cabang/PIN tidak sesuai. Mohon cek kembali.' };
    }

    var token = generateDashboardToken_();
    var tokenHash = dashboardSha256_(token);
    var now = new Date();
    var expiresAt = new Date(now.getTime() + (remember ? 7 * 24 : 8) * 3600 * 1000);

    var sh = getOrCreateDashboardSessionsSheet_();
    sh.appendRow([tokenHash, user.username, user.role, user.cabang, user.nama, expiresAt, now, now]);

    return {
      success: true,
      user: buildDashboardUserResponse_(user, token, expiresAt)
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function validateDashboardSession_(token) {
  token = String(token || '').trim();
  if (!token) return null;

  // V10.9.164 PERF: Cache session validation untuk kurangi baca Spreadsheet
  // Session valid di-cache 5 menit di CacheService (RAM Google ~20ms vs Spreadsheet ~400ms)
  var cacheKey = 'DSESS_' + token.substring(0, 32);
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed._exp && parsed._exp > new Date().getTime()) {
        return parsed;
      }
    }
  } catch(cacheErr) {}

  // Fallback ke Spreadsheet
  var sh = getOrCreateDashboardSessionsSheet_();
  if (sh.getLastRow() < 2) return null;

  var tokenHash = dashboardSha256_(token);
  var now = new Date();
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 8)).getValues();

  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (String(r[0] || '').trim() !== tokenHash) continue;

    var expiredAt = toSafeDate_(r[5]) || new Date(r[5]);
    if (!expiredAt || expiredAt.getTime() < now.getTime()) return null;

    sh.getRange(i + 2, 7).setValue(now);
    var user = {
      username: String(r[1] || '').trim(),
      role: String(r[2] || '').trim(),
      cabang: String(r[3] || '').trim(),
      nama: String(r[4] || '').trim()
    };
    var result = buildDashboardUserResponse_(user, token, expiredAt);

    // Simpan ke cache 5 menit
    try {
      result._exp = new Date().getTime() + 300000;
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 300);
    } catch(e2) {}

    return result;
  }

  return null;
}

function clientValidateDashboardSession(token) {
  try {
    var user = validateDashboardSession_(token);
    if (!user) return { success: false, needLogin: true, error: 'Sesi login sudah habis. Silakan masuk kembali.' };
    return { success: true, user: user };
  } catch(e) {
    return { success: false, needLogin: true, error: e.message };
  }
}

function clientDashboardLogout(token) {
  try {
    token = String(token || '').trim();
    if (!token) return { success: true };
    var tokenHash = dashboardSha256_(token);
    var sh = getOrCreateDashboardSessionsSheet_();
    if (sh.getLastRow() >= 2) {
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = rows.length - 1; i >= 0; i--) {
        if (String(rows[i][0] || '') === tokenHash) {
          sh.deleteRow(i + 2);
          break;
        }
      }
    }
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function applyDashboardAccessFilters_(filters, sessionUser) {
  filters = filters || {};
  sessionUser = sessionUser || {};
  var isAdmin = !!sessionUser.canSeeAll;

  // Hapus token dari object filter supaya tidak ikut kebaca sebagai filter UI.
  var clean = {};
  Object.keys(filters).forEach(function(k) {
    if (k === '_sessionToken' || k === 'sessionToken') return;
    clean[k] = filters[k];
  });

  if (!isAdmin) {
    clean.cabang = sessionUser.cabang || clean.cabang || 'Semua';
  }
  return clean;
}

function buildDashboardMetaByAccess_(sessionUser) {
  var isAdmin = !!(sessionUser && sessionUser.canSeeAll);
  var cabangList = isAdmin ? CONFIG.CABANG : [sessionUser.cabang];
  return {
    cabangList: cabangList,
    wilayahList: CONFIG.WILAYAH,
    auth: sessionUser || null
  };
}

// ============================================================
// CLIENT API - ambil semua data dashboard
// ============================================================


// ============================================================
// V10.9.67 - WEB INPUT ADUAN MANUAL
// Input dari dashboard cabang/petugas dengan ID otomatis,
// filter cabang dari session login, mirror ke sheet cabang,
// dan notifikasi petugas cabang jika aktif.
// ============================================================

function normalizeDashboardManualCabang_(requestedCabang, sessionUser) {
  sessionUser = sessionUser || {};
  var isAdmin = !!sessionUser.canSeeAll;

  if (!isAdmin) {
    return String(sessionUser.cabang || '').trim();
  }

  requestedCabang = String(requestedCabang || '').trim();
  if (requestedCabang === 'ALL' || requestedCabang === 'Semua') return '';
  return requestedCabang;
}

function validateDashboardManualAduanForm_(form, sessionUser) {
  form = form || {};
  sessionUser = sessionUser || {};

  var cabang = normalizeDashboardManualCabang_(form.cabang, sessionUser);
  if (!cabang || CONFIG.CABANG.indexOf(cabang) === -1) {
    throw new Error('Cabang belum valid. Silakan pilih cabang layanan.');
  }

  var noPelanggan = normalizeNoPelanggan_(form.noPelanggan || '');
  if (!noPelanggan) {
    throw new Error('No Pelanggan belum valid. Isi angka No Pelanggan sesuai rekening.');
  }

  var jenis = normalizeJenisGangguanChoice_(form.jenis || '') || normalizeInputJenisGangguan_(form.jenis || '');
  if (!jenis) jenis = 'Lainnya';

  var keterangan = String(form.keterangan || '').trim();
  if (keterangan.length < 5) {
    throw new Error('Keterangan aduan terlalu singkat.');
  }

  var prioritas = String(form.prioritas || '').trim();
  if (prioritas && prioritas !== 'Otomatis') {
    prioritas = normalizePriorityValue_(prioritas);
  } else {
    prioritas = '';
  }

  var nama = String(form.namaPelanggan || form.nama || '').trim();
  var noHp = normalizePhone_(form.noHp || form.phone || '');
  var wilayah = String(form.wilayah || '').trim() || cabang.replace(/^Cabang\s+/i, '');
  var lokasiDetail = String(form.lokasiDetail || form.lokasi || '').trim();

  return {
    cabang: cabang,
    wilayah: wilayah,
    noPelanggan: noPelanggan,
    desa: noPelanggan,
    nama: nama,
    noHp: noHp,
    jenis: jenis,
    prioritas: prioritas,
    keterangan: keterangan,
    lokasiDetail: lokasiDetail || 'Input manual dashboard',
    latitude: String(form.latitude || '').trim(),
    longitude: String(form.longitude || '').trim(),
    linkMaps: String(form.linkMaps || '').trim()
  };
}

function createAduanFromDashboardManual_(form, sessionUser) {
  var data = validateDashboardManualAduanForm_(form, sessionUser);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    setupAduanSheet(ss);
    sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  ensureRuntimeHeadersFast_(sh);

  var now = new Date();
  var cabang = data.cabang;
  var code = getCabangCodeSafe_(cabang);
  var id = generateCabangAduanId_(code, now, sh);

  var priorityInfo = determineWhatsAppPriority_(data.jenis || 'Lainnya', data.keterangan || '', data.wilayah || '', data.noPelanggan || '');
  var prioritas = data.prioritas || normalizePriorityValue_(priorityInfo.prioritas || 'Sedang');
  var statusAduan = normalizeStatusValue_('Baru');
  var kategoriLayanan = getKategoriLayananByJenis_(data.jenis || 'Lainnya');
  var unitAduan = getUnitByJenisGangguan_(data.jenis || 'Lainnya');
  var slaJam = getSlaJamForPrioritas_(prioritas);

  var catatan = 'Masuk dari Dashboard Manual';
  catatan += ' | Diinput oleh: ' + (sessionUser.nama || sessionUser.username || '-');
  catatan += ' | Role: ' + (sessionUser.role || '-');
  catatan += ' | Kategori: ' + kategoriLayanan;
  catatan += ' | Unit otomatis: ' + unitAduan;
  if (data.prioritas) {
    catatan += ' | Prioritas manual dashboard: ' + prioritas;
  } else if (priorityInfo.alasan) {
    catatan += ' | Prioritas otomatis: ' + prioritas + ' (' + priorityInfo.alasan + ')';
  }

  var latitude = data.latitude || '';
  var longitude = data.longitude || '';
  var linkMaps = data.linkMaps || '';

  if ((!latitude || !longitude) && data.lokasiDetail) {
    var parsedLocFromDetail = extractCoordinatesFromText_(data.lokasiDetail);
    if (parsedLocFromDetail) {
      latitude = parsedLocFromDetail.latitude;
      longitude = parsedLocFromDetail.longitude;
      linkMaps = parsedLocFromDetail.mapsUrl;
      data.lokasiDetail = 'Koordinat dari input dashboard';
    }
  }

  if (latitude && longitude && !linkMaps) {
    linkMaps = buildGoogleMapsUrl_(latitude, longitude);
  }

  sh.appendRow([
    id,
    now,
    cabang,
    data.wilayah || '',
    data.noPelanggan || '',
    data.nama || '',
    data.noHp || '',
    data.jenis || 'Lainnya',
    prioritas,
    statusAduan,
    unitAduan,
    data.keterangan || '',
    catatan,
    '',
    slaJam,
    now,
    latitude,
    longitude,
    linkMaps,
    data.lokasiDetail || ''
  ]);

  var insertedRow = sh.getLastRow();

  // V10.9.88:
  // Baris dari input manual dashboard tetap harus punya dropdown, validasi, format tanggal, dan warna status.
  try { enforcePriorityStatusUnitForRow_(sh, insertedRow); } catch(enforceErr) {}
  try { applyMainAduanDropdowns_(sh); } catch(dropErr) {}
  try { applyMainAduanConditionalFormatting_(sh); } catch(colorErr) {}
  try { applyMainAduanRowStyle_(sh, insertedRow); } catch(styleErr) {}

  var createdAduan;
  try {
    createdAduan = parseAduanRowForTracking_(sh.getRange(insertedRow, 1, 1, Math.max(sh.getLastColumn(), 20)).getValues()[0]);
  } catch (parseErr) {
    // V10.9.93:
    // Aduan sudah berhasil append ke ADUAN. Jangan kembalikan error ke dashboard
    // hanya karena proses baca ulang/format setelah append bermasalah.
    createdAduan = {
      id: id,
      waktuMasuk: now,
      cabang: cabang,
      wilayah: data.wilayah || '',
      desa: data.noPelanggan || '',
      noPelanggan: data.noPelanggan || '',
      namaPelanggan: data.nama || '',
      noHp: data.noHp || '',
      jenisGangguan: data.jenis || 'Lainnya',
      prioritas: prioritas,
      status: statusAduan,
      unit: unitAduan,
      keterangan: data.keterangan || '',
      catatan: catatan,
      slaJam: slaJam,
      lokasiDetail: data.lokasiDetail || ''
    };
    try {
      logWhatsApp_(
        data.noHp || (sessionUser.username || '-'),
        'DASHBOARD_MANUAL_PARSE_WARNING',
        'MANUAL_CREATE_PARSE_WARNING',
        id,
        '',
        'WARNING',
        parseErr.message
      );
    } catch(logParseErr) {}
  }

  try { invalidateAduanFindCacheById_(createdAduan.id); } catch(e) {}

  try {
    mirrorAduanToCabangSheet_(createdAduan);
  } catch (mirrorErr) {
    try {
      logWhatsApp_(
        data.noHp || (sessionUser.username || '-'),
        'DASHBOARD_MANUAL_MIRROR_ERROR',
        'CABANG_MIRROR_ERROR',
        createdAduan.id,
        '',
        'ERROR',
        mirrorErr.message || String(mirrorErr)
      );
    } catch(logMirrorErr) {}
  }

  try {
    createdAduan.notifikasiPetugas = notifyPetugasCabang_(createdAduan);
  } catch (notifyErr) {
    try {
      logWhatsApp_(
        data.noHp || (sessionUser.username || '-'),
        'DASHBOARD_MANUAL_NOTIF_ERROR',
        'PETUGAS_NOTIFY_ERROR',
        createdAduan.id,
        '',
        'ERROR',
        notifyErr.message || String(notifyErr)
      );
    } catch(logNotifyErr) {}
  }

  // V11.10: kirim notifikasi tiket berhasil dibuat ke WhatsApp pelanggan, persis
  // seperti balasan yang diterima pelanggan kalau aduan dibuat sendiri lewat WA.
  // Kalau No HP kosong atau kirim gagal, tidak menggagalkan penyimpanan aduan --
  // hanya dicatat di createdAduan.notifikasiPelanggan + log WhatsApp.
  try {
    createdAduan.notifikasiPelanggan = notifyPelangganAduanManual_(createdAduan);
  } catch (notifyPelangganErr) {
    try {
      logWhatsApp_(
        data.noHp || (sessionUser.username || '-'),
        'DASHBOARD_MANUAL_PELANGGAN_NOTIF_ERROR',
        'PELANGGAN_NOTIFY_MANUAL_ERROR',
        createdAduan.id,
        '',
        'ERROR',
        notifyPelangganErr.message || String(notifyPelangganErr)
      );
    } catch(logNotifyPelangganErr) {}
  }

  // V10.9.96: catat pembuatan aduan manual ke LOG_STATUS_ADUAN untuk riwayat/detail audit.
  try {
    logStatusAduan_(
      createdAduan.id,
      '',
      statusAduan,
      {
        nama: sessionUser.nama || sessionUser.username || 'Dashboard Manual',
        noWa: '',
        cabang: sessionUser.canSeeAll ? 'Admin Pusat' : (sessionUser.cabang || data.cabang || '-'),
        role: sessionUser.role || '-'
      },
      'DASHBOARD_MANUAL',
      data.keterangan || '',
      JSON.stringify({ prioritas: prioritas, unit: unitAduan, noPelanggan: data.noPelanggan || '', cabang: cabang })
    );
  } catch(logCreateErr) {}

  return createdAduan;
}

// V10.9.94:
// Return google.script.run harus object sederhana. Jangan kirim Date/object besar dari Apps Script
// karena pada beberapa deployment bisa membuat client menerima null/Unknown error padahal row sudah tersimpan.
function toClientSafeManualAduan_(created) {
  created = created || {};

  // V11.10: ringkas status notifikasi WA ke pelanggan supaya bisa ditampilkan
  // di popup sukses dashboard (mis. "Notifikasi terkirim ke WA pelanggan" /
  // "No HP kosong, notifikasi tidak dikirim").
  var notifPelanggan = created.notifikasiPelanggan || {};
  var notifStatus = 'SKIPPED';
  if (notifPelanggan.success) notifStatus = 'SENT';
  else if (notifPelanggan.reason === 'NO_PHONE') notifStatus = 'NO_PHONE';
  else if (notifPelanggan.reason === 'DISABLED') notifStatus = 'DISABLED';
  else if (notifPelanggan.reason === 'WINDOW_CLOSED') notifStatus = 'WINDOW_CLOSED';
  else if (notifPelanggan.skipped) notifStatus = 'SKIPPED';
  else notifStatus = 'FAILED';

  return {
    id: String(created.id || ''),
    cabang: String(created.cabang || ''),
    wilayah: String(created.wilayah || ''),
    noPelanggan: String(created.noPelanggan || created.desa || ''),
    namaPelanggan: String(created.namaPelanggan || created.nama || ''),
    noHp: String(created.noHp || ''),
    jenisGangguan: String(created.jenisGangguan || created.jenis || ''),
    prioritas: String(created.prioritas || ''),
    status: String(created.status || ''),
    unit: String(created.unit || ''),
    keterangan: String(created.keterangan || ''),
    lokasiDetail: String(created.lokasiDetail || ''),
    notifikasiPelangganStatus: notifStatus
  };
}

function clientFindLatestManualAduan(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var data = validateDashboardManualAduanForm_(form, sessionUser);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sh || safeGetLastRow_(sh) < 2) return { success: false, error: 'Data aduan belum ditemukan.' };

    var lastRow = safeGetLastRow_(sh);
    var startRow = Math.max(2, lastRow - 80);
    var values = sh.getRange(startRow, 1, lastRow - startRow + 1, Math.max(sh.getLastColumn(), 20)).getValues();
    var targetCabang = normalizeCabangKey_(data.cabang || '');
    var targetNoPel = normalizeNoPelanggan_(data.noPelanggan || '');
    var targetNoHp = normalizePhone_(data.noHp || '');
    var targetJenis = String(data.jenis || '').trim().toLowerCase();
    var targetKet = String(data.keterangan || '').trim().toLowerCase();

    for (var i = values.length - 1; i >= 0; i--) {
      var row = values[i];
      var id = String(row[CONFIG.COL.ID - 1] || '').trim();
      if (!id) continue;

      var rowCabang = normalizeCabangKey_(row[CONFIG.COL.CABANG - 1] || '');
      var rowNoPel = normalizeNoPelanggan_(row[CONFIG.COL.NO_PELANGGAN - 1] || '');
      var rowNoHp = normalizePhone_(row[CONFIG.COL.NO_HP - 1] || '');
      var rowJenis = String(row[CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim().toLowerCase();
      var rowKet = String(row[CONFIG.COL.KETERANGAN - 1] || '').trim().toLowerCase();

      if (rowCabang !== targetCabang) continue;
      if (rowNoPel !== targetNoPel) continue;
      if (targetNoHp && rowNoHp && rowNoHp !== targetNoHp) continue;
      if (targetJenis && rowJenis && rowJenis !== targetJenis) continue;
      if (targetKet && rowKet && rowKet.indexOf(targetKet) === -1 && targetKet.indexOf(rowKet) === -1) continue;

      return {
        success: true,
        id: id,
        aduan: {
          id: id,
          cabang: String(row[CONFIG.COL.CABANG - 1] || ''),
          wilayah: String(row[CONFIG.COL.WILAYAH - 1] || ''),
          noPelanggan: String(row[CONFIG.COL.NO_PELANGGAN - 1] || ''),
          namaPelanggan: String(row[CONFIG.COL.NAMA_PELANGGAN - 1] || ''),
          noHp: String(row[CONFIG.COL.NO_HP - 1] || ''),
          jenisGangguan: String(row[CONFIG.COL.JENIS_GANGGUAN - 1] || ''),
          prioritas: String(row[CONFIG.COL.PRIORITAS - 1] || ''),
          status: String(row[CONFIG.COL.STATUS - 1] || ''),
          unit: String(row[CONFIG.COL.UNIT - 1] || ''),
          keterangan: String(row[CONFIG.COL.KETERANGAN - 1] || ''),
          lokasiDetail: String(row[CONFIG.COL.LOKASI_DETAIL - 1] || '')
        },
        message: 'Aduan manual sudah ditemukan di ADUAN dengan ID ' + id + '.'
      };
    }

    return { success: false, error: 'Aduan belum ditemukan di ADUAN. Coba refresh dashboard/sheet sebentar lagi.' };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCreateManualAduan(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var created = createAduanFromDashboardManual_(form, sessionUser);
    var safeCreated = toClientSafeManualAduan_(created);

    return {
      success: true,
      id: safeCreated.id,
      aduan: safeCreated,
      message: 'Aduan manual berhasil dibuat dengan ID ' + safeCreated.id + '.'
    };
  } catch (e) {
    Logger.log('Error clientCreateManualAduan: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}



// ============================================================
// V10.9.67 - DASHBOARD UPDATE STATUS / PRIORITAS / UNIT / CATATAN
// ============================================================

function dashboardUserCanAccessAduan_(sessionUser, aduan) {
  sessionUser = sessionUser || {};
  aduan = aduan || {};
  if (!aduan || !aduan.id) return false;
  if (sessionUser.canSeeAll) return true;
  return normalizeCabangKey_(sessionUser.cabang || '') === normalizeCabangKey_(aduan.cabang || '');
}

function clientUpdateDashboardAduan(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var result = updateAduanFromDashboard_(form, sessionUser);
    return {
      success: true,
      id: result.id,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
      assignedPetugas: result.assignedPetugas || [],
      message: 'Aduan ' + result.id + ' berhasil diperbarui.'
    };
  } catch (e) {
    Logger.log('Error clientUpdateDashboardAduan: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}


// ============================================================
// V11.0.7 - ALIHKAN CABANG
// Dipakai kalau pelanggan salah pilih cabang saat isi aduan (alamatnya sebenarnya
// di cabang lain). Admin Pusat bisa mengalihkan aduan ke cabang yang benar:
// - ID BARU dibuat otomatis (bukan edit cabang di ID lama, supaya nomor tiket tetap
//   konsisten dengan kode cabang masing-masing dan riwayat lama tidak tertimpa).
// - Notifikasi ke PETUGAS cabang tujuan terkirim otomatis (pakai jalur yang sama
//   dengan aduan baru biasa) - tidak perlu admin input manual/notif manual lagi.
// - Aduan lama otomatis ditutup berstatus "Batal" dengan catatan yang menyebutkan
//   ID baru, dan (berkat perbaikan Catatan Tindak Lanjut di notifikasi pelanggan)
//   pelanggan otomatis dapat WhatsApp yang menjelaskan aduannya dialihkan + ID barunya.
// HANYA Admin Pusat (canSeeAll) yang boleh memakai fitur ini - akun cabang tidak bisa,
// supaya perpindahan lintas-cabang selalu lewat sepengetahuan pusat.
// ============================================================

function alihkanCabangAduan_(form, sessionUser) {
  form = form || {};
  sessionUser = sessionUser || {};

  if (!sessionUser.canSeeAll) {
    throw new Error('Hanya Admin Pusat yang bisa mengalihkan cabang aduan.');
  }

  var oldId = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
  if (!oldId) throw new Error('ID aduan kosong.');

  var newCabang = String(form.cabangBaru || form.newCabang || '').trim();
  if (!newCabang || CONFIG.CABANG.indexOf(newCabang) === -1) {
    throw new Error('Cabang tujuan belum valid. Pilih cabang yang benar.');
  }

  var alasan = String(form.alasan || form.catatan || '').trim();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var oldRowNumber = findAduanRowNumberById_(oldId);
  if (!main || !oldRowNumber) throw new Error('ID aduan tidak ditemukan: ' + oldId);

  // Pastikan kolom No Pelanggan tetap Plain Text sebelum menulis baris baru hasil
  // pengalihan cabang -- fungsi ini juga menulis ke sheet ADUAN yang sama, jadi
  // butuh proteksi yang sama seperti input manual & alur WA.
  ensureRuntimeHeadersFast_(main);

  var oldData = getAduanObjectFromSheetRow_(main, oldRowNumber);
  var oldCabang = String(oldData.cabang || '').trim();

  if (normalizeCabangKey_(oldCabang) === normalizeCabangKey_(newCabang)) {
    throw new Error('Cabang tujuan sama dengan cabang aduan saat ini.');
  }

  var oldStatusRaw = String(oldData.status || '').trim();
  var oldStatusLower = oldStatusRaw.toLowerCase();
  if (oldStatusLower === 'selesai' || oldStatusLower === 'batal') {
    throw new Error('Aduan berstatus ' + oldStatusRaw + ' tidak bisa dialihkan cabang lagi.');
  }

  var now = new Date();
  var jenis = String(oldData.jenisGangguan || oldData.jenis || 'Lainnya').trim() || 'Lainnya';
  var wilayahBaru = String(form.wilayahBaru || '').trim() || newCabang.replace(/^Cabang\s+/i, '');
  var lokasiDetailBaru = String(form.lokasiDetailBaru || '').trim() || oldData.lokasiDetail || 'Dialihkan dari cabang lain';

  var priorityInfo = determineWhatsAppPriority_(jenis, oldData.keterangan || '', wilayahBaru, oldData.noPelanggan || '');
  var prioritas = normalizePriorityValue_(oldData.prioritas || priorityInfo.prioritas || 'Sedang');
  var statusAduan = normalizeStatusValue_('Baru');
  var unitAduan = getUnitByJenisGangguan_(jenis);
  var slaJam = getSlaJamForPrioritas_(prioritas);

  var newCabangCode = getCabangCodeSafe_(newCabang);
  var newId = generateCabangAduanId_(newCabangCode, now, main);

  var catatanBaru = 'Dialihkan dari ' + (oldCabang || '-') + ' (ID lama: ' + oldId + ')';
  catatanBaru += ' | Dialihkan oleh: ' + (sessionUser.nama || sessionUser.username || '-');
  catatanBaru += ' | Role: ' + (sessionUser.role || '-');
  if (alasan) catatanBaru += ' | Alasan: ' + alasan;

  main.appendRow([
    newId,
    now,
    newCabang,
    wilayahBaru,
    oldData.noPelanggan || '',
    oldData.namaPelanggan || '',
    oldData.noHp || '',
    jenis,
    prioritas,
    statusAduan,
    unitAduan,
    oldData.keterangan || '',
    catatanBaru,
    '',
    slaJam,
    now,
    oldData.latitude || '',
    oldData.longitude || '',
    oldData.linkMaps || '',
    lokasiDetailBaru
  ]);

  var insertedRow = main.getLastRow();
  try { enforcePriorityStatusUnitForRow_(main, insertedRow); } catch(enforceErr) {}
  try { applyMainAduanDropdowns_(main); } catch(dropErr) {}
  try { applyMainAduanConditionalFormatting_(main); } catch(colorErr) {}
  try { applyMainAduanRowStyle_(main, insertedRow); } catch(styleErr) {}

  var createdAduan;
  try {
    createdAduan = parseAduanRowForTracking_(main.getRange(insertedRow, 1, 1, Math.max(main.getLastColumn(), 20)).getValues()[0]);
  } catch(parseErr) {
    createdAduan = {
      id: newId,
      waktuMasuk: now,
      cabang: newCabang,
      wilayah: wilayahBaru,
      noPelanggan: oldData.noPelanggan || '',
      namaPelanggan: oldData.namaPelanggan || '',
      noHp: oldData.noHp || '',
      jenisGangguan: jenis,
      prioritas: prioritas,
      status: statusAduan,
      unit: unitAduan,
      keterangan: oldData.keterangan || '',
      catatan: catatanBaru,
      slaJam: slaJam,
      lokasiDetail: lokasiDetailBaru
    };
  }

  try { invalidateAduanFindCacheById_(createdAduan.id); } catch(e) {}

  try {
    mirrorAduanToCabangSheet_(createdAduan);
  } catch(mirrorErr) {
    try { logWhatsApp_(sessionUser.username || '', 'DASHBOARD_ALIHKAN_MIRROR_ERROR', 'CABANG_MIRROR_ERROR', createdAduan.id, '', 'ERROR', mirrorErr.message || String(mirrorErr)); } catch(e) {}
  }

  // Notifikasi otomatis ke petugas cabang TUJUAN - persis jalur aduan baru biasa,
  // supaya admin tidak perlu input/notif manual lagi.
  var petugasNotifyResult = null;
  try {
    petugasNotifyResult = notifyPetugasCabang_(createdAduan);
  } catch(notifyErr) {
    try { logWhatsApp_(sessionUser.username || '', 'DASHBOARD_ALIHKAN_NOTIF_PETUGAS_ERROR', 'PETUGAS_NOTIFY_ERROR', createdAduan.id, '', 'ERROR', notifyErr.message || String(notifyErr)); } catch(e) {}
  }

  try {
    logStatusAduan_(
      createdAduan.id,
      '',
      statusAduan,
      {
        nama: sessionUser.nama || sessionUser.username || 'Admin Pusat',
        noWa: '',
        cabang: 'Admin Pusat',
        role: sessionUser.role || '-'
      },
      'DASHBOARD_ALIHKAN_CABANG',
      catatanBaru,
      JSON.stringify({ oldId: oldId, oldCabang: oldCabang, newCabang: newCabang, prioritas: prioritas, unit: unitAduan })
    );
  } catch(logCreateErr) {}

  // ---- Tutup aduan lama sebagai "Batal" dengan catatan yang menyebut ID baru.
  // Ini otomatis memicu notifikasi WhatsApp ke pelanggan (lihat perbaikan Catatan
  // Tindak Lanjut di notifyCustomerStatusChangeByRow_) yang menjelaskan alasan +
  // ID aduan barunya, sehingga pelanggan tidak bingung aduannya "hilang".
  var catatanTutup = 'Dialihkan ke ' + newCabang + ' karena salah pilih cabang saat mengisi aduan. ID aduan baru Anda: ' + newId + '.';
  if (alasan) catatanTutup += ' Alasan: ' + alasan;

  main.getRange(oldRowNumber, CONFIG.COL.STATUS).setValue('Batal');
  main.getRange(oldRowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
  try { applyMainAduanDropdowns_(main); } catch(dropErr2) {}
  try { applyMainAduanConditionalFormatting_(main); } catch(colorErr2) {}
  try { applyMainAduanRowStyle_(main, oldRowNumber); } catch(styleErr2) {}

  var oldCatatanCell = String(main.getRange(oldRowNumber, CONFIG.COL.CATATAN).getValue() || '').trim();
  var actor = sessionUser.nama || sessionUser.username || '-';
  var addCatatanOld = '[' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '] ' +
    'Alihkan Cabang via Dashboard: ' + actor + ' (' + (sessionUser.role || '-') + ') → ' + catatanTutup;
  main.getRange(oldRowNumber, CONFIG.COL.CATATAN).setValue(oldCatatanCell ? (oldCatatanCell + '\n' + addCatatanOld) : addCatatanOld);

  try { invalidateAduanFindCacheById_(oldId); } catch(e) {}
  try { syncAduanRowToCabangMirror_(main, oldRowNumber); } catch(syncErr) {
    try { logWhatsApp_(sessionUser.username || '', 'DASHBOARD_ALIHKAN_MIRROR_OLD_ERROR', 'CABANG_MIRROR_ERROR', oldId, '', 'ERROR', syncErr.message || String(syncErr)); } catch(e) {}
  }

  try {
    logStatusAduan_(
      oldId,
      oldStatusRaw,
      'Batal',
      {
        nama: actor,
        noWa: '',
        cabang: 'Admin Pusat',
        role: sessionUser.role || '-'
      },
      'DASHBOARD_ALIHKAN_CABANG',
      catatanTutup,
      JSON.stringify({ newId: newId, newCabang: newCabang })
    );
  } catch(logCloseErr) {}

  var customerNotifyResult = null;
  try {
    customerNotifyResult = notifyCustomerStatusChangeByRow_(main, oldRowNumber, oldStatusRaw, 'Batal', 'DASHBOARD_ALIHKAN_CABANG', catatanTutup);
  } catch(notifErr) {
    try { logWhatsApp_(sessionUser.username || '', 'DASHBOARD_ALIHKAN_NOTIF_PELANGGAN_ERROR', 'CUSTOMER_NOTIFY_ERROR', oldId, '', 'ERROR', notifErr.message || String(notifErr)); } catch(e) {}
  }

  return {
    oldId: oldId,
    oldCabang: oldCabang,
    newId: newId,
    newCabang: newCabang,
    petugasNotified: !!(petugasNotifyResult && petugasNotifyResult.success),
    petugasNotifyResult: petugasNotifyResult,
    customerNotified: !!(customerNotifyResult && customerNotifyResult.sent),
    customerNotifyResult: customerNotifyResult
  };
}

function clientAlihkanCabangAduan(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var result = alihkanCabangAduan_(form, sessionUser);
    return {
      success: true,
      oldId: result.oldId,
      newId: result.newId,
      newCabang: result.newCabang,
      petugasNotified: result.petugasNotified,
      customerNotified: result.customerNotified,
      message: 'Aduan ' + result.oldId + ' berhasil dialihkan ke ' + result.newCabang + ' dengan ID baru ' + result.newId + '.'
    };
  } catch (e) {
    Logger.log('Error clientAlihkanCabangAduan: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}


// ============================================================
// V10.9.74 - DASHBOARD AKSI DOKUMENTASI PROSES / SELESAI
// ============================================================

function normalizeDashboardJenisFoto_(value) {
  var v = String(value || '').trim().toLowerCase();
  if (!v) return 'Foto Proses';

  // V10.9.76:
  // Foto Sesudah dan Foto Selesai adalah jenis yang sama.
  // Di sistem disimpan sebagai "Foto Selesai" agar tidak muncul dobel di pelanggan.
  if (v.indexOf('selesai') !== -1 || v.indexOf('sesudah') !== -1 || v.indexOf('setelah') !== -1) return 'Foto Selesai';

  if (v.indexOf('respons') !== -1 || v.indexOf('respon') !== -1 || v.indexOf('cek awal') !== -1 || v.indexOf('cek lokasi') !== -1 || v.indexOf('survey') !== -1 || v.indexOf('survei') !== -1) return 'Foto Respons';
  if (v.indexOf('proses') !== -1) return 'Foto Proses';
  if (v.indexOf('sebelum') !== -1) return 'Foto Sebelum';
  if (v.indexOf('meter') !== -1 || v.indexOf('lokasi') !== -1) return 'Foto Meter/Lokasi';
  return 'Foto Lainnya';
}


function getDashboardAduanForDocumentation_(id, sessionUser) {
  id = normalizeAduanIdHyphen_(id || '');
  if (!id) throw new Error('ID aduan kosong.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var rowNumber = findAduanRowNumberById_(id);
  if (!main || !rowNumber) throw new Error('ID aduan tidak ditemukan: ' + id);

  var aduan = getAduanObjectFromSheetRow_(main, rowNumber);
  if (!dashboardUserCanAccessAduan_(sessionUser, aduan)) {
    throw new Error('Aduan ini bukan cabang login Anda.');
  }

  return { aduan: aduan, rowNumber: rowNumber, sheet: main };
}

function formatDashboardDokumentasiRow_(d) {
  d = d || {};
  var waktu = toSafeDate_(d.waktu) || (d.waktu ? new Date(d.waktu) : null);
  var waktuText = '';
  try {
    waktuText = waktu && !isNaN(waktu.getTime())
      ? Utilities.formatDate(waktu, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
      : '';
  } catch(e) { waktuText = ''; }

  return {
    waktuText: waktuText,
    id: String(d.id || ''),
    cabang: String(d.cabang || ''),
    petugas: String(d.petugas || ''),
    jenisFoto: String(d.jenisFoto || ''),
    link: String(d.link || ''),
    caption: String(d.caption || ''),
    status: String(d.status || ''),
    rowNumber: Number(d.rowNumber || 0)
  };
}

function clientGetDashboardDocumentation(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
    getDashboardAduanForDocumentation_(id, sessionUser);

    var docs = getAduanDocumentationRows_(id, 20).map(formatDashboardDokumentasiRow_);
    return { success: true, id: id, docs: docs };
  } catch (e) {
    Logger.log('Error clientGetDashboardDocumentation: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}


function extractDriveFileIdFromUrl_(url) {
  url = String(url || '');
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function dashboardUserCanRejectDocumentation_(sessionUser) {
  sessionUser = sessionUser || {};
  var role = String(sessionUser.role || '').toLowerCase();
  return !!(sessionUser.canSeeAll || role.indexOf('admin') !== -1 || role.indexOf('direksi') !== -1);
}

function clientRejectDashboardDocumentation(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }
    if (!dashboardUserCanRejectDocumentation_(sessionUser)) {
      return { success: false, error: 'Hanya Admin/Direksi yang bisa menolak dokumentasi foto.' };
    }

    var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
    var access = getDashboardAduanForDocumentation_(id, sessionUser);
    var docRow = Number(form.rowNumber || form.docRow || 0);
    if (!docRow || docRow < 2) throw new Error('Data foto yang akan ditolak tidak valid. Muat ulang dokumentasi lalu coba lagi.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
    if (!sh || safeGetLastRow_(sh) < docRow) throw new Error('Baris dokumentasi tidak ditemukan.');

    var row = sh.getRange(docRow, 1, 1, Math.min(sh.getLastColumn(), 11)).getValues()[0];
    var rowId = normalizeAduanIdHyphen_(row[1] || '');
    if (normalizeId_(rowId) !== normalizeId_(id)) throw new Error('Foto ini tidak sesuai dengan ID aduan yang sedang dibuka.');

    var jenisFoto = String(row[5] || 'Foto').trim();
    var link = String(row[6] || '').trim();
    var caption = String(row[8] || '').trim();
    var actor = sessionUser.nama || sessionUser.username || 'Admin';

    // Hapus file Drive jika bisa dikenali, lalu hapus baris dokumentasi aktif.
    try {
      var fileId = extractDriveFileIdFromUrl_(link);
      if (fileId) DriveApp.getFileById(fileId).setTrashed(true);
    } catch(fileErr) {}

    sh.deleteRow(docRow);
    try { invalidateAduanDokumentasiCache_(id); } catch(cacheErr) {}

    var now = new Date();
    var oldStatus = String(access.sheet.getRange(access.rowNumber, CONFIG.COL.STATUS).getValue() || access.aduan.status || '').trim();
    var newStatus = '';

    // Kalau bukti respons ditolak dan tidak ada Foto Respons lain, status dikembalikan ke Baru
    // agar tidak dihitung sebagai respons valid.
    if (isResponseDocumentationJenis_(jenisFoto) && !hasResponseDocumentationForAduan_(id)) {
      if (isStatusCountedAsResponse_(oldStatus) && oldStatus.toLowerCase() !== 'selesai' && oldStatus.toLowerCase() !== 'batal') {
        newStatus = 'Baru';
      }
    }

    // Kalau bukti selesai ditolak dan tidak ada Foto Selesai lain, status dibuka kembali.
    if (isFinalDocumentationJenis_(jenisFoto) && !hasFinalDocumentationForAduan_(id)) {
      if (oldStatus.toLowerCase() === 'selesai') {
        newStatus = 'Dalam Pengerjaan';
        try { access.sheet.getRange(access.rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(''); } catch(clearErr) {}
      }
    }

    if (newStatus && newStatus !== oldStatus) {
      access.sheet.getRange(access.rowNumber, CONFIG.COL.STATUS).setValue(newStatus);
      access.sheet.getRange(access.rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
      try {
        logStatusAduan_(id, oldStatus, newStatus, {
          nama: actor,
          noWa: '',
          cabang: sessionUser.canSeeAll ? 'Admin Pusat' : (sessionUser.cabang || '-'),
          role: sessionUser.role || '-'
        }, 'DASHBOARD_REJECT_PHOTO', 'Foto ditolak admin: ' + jenisFoto + (caption ? ' | Caption: ' + caption : ''), 'Admin menolak dokumentasi foto karena tidak valid.');
      } catch(logErr) {}
    }

    try {
      var oldCatatan = String(access.sheet.getRange(access.rowNumber, CONFIG.COL.CATATAN).getValue() || '').trim();
      var addCatatan = '[' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '] ' +
        'Dokumentasi ditolak oleh ' + actor + ': ' + jenisFoto + (caption ? '. Caption: ' + caption : '');
      access.sheet.getRange(access.rowNumber, CONFIG.COL.CATATAN).setValue(oldCatatan ? (oldCatatan + '\n' + addCatatan) : addCatatan);
      access.sheet.getRange(access.rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
    } catch(noteErr) {}

    try { syncAduanRowToCabangMirror_(access.sheet, access.rowNumber); } catch(syncErr) {}
    try { invalidateAduanFindCacheById_(id); } catch(cacheFindErr) {}
    try { SIAGA_RESPONSE_TIME_MAP_CACHE_ = null; } catch(cacheMapErr) {}

    return {
      success: true,
      id: id,
      rejectedJenis: jenisFoto,
      newStatus: newStatus || oldStatus,
      statusChanged: !!newStatus,
      message: 'Dokumentasi ditolak dan dihapus.' + (newStatus ? ' Status aduan dikembalikan menjadi ' + newStatus + '.' : '')
    };
  } catch (e) {
    Logger.log('Error clientRejectDashboardDocumentation: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}

function clientUploadDashboardDocumentation(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
    var access = getDashboardAduanForDocumentation_(id, sessionUser);
    var aduan = access.aduan;

    var dataUrl = String(form.dataUrl || form.fileData || '').trim();
    if (!dataUrl) throw new Error('File foto belum dipilih.');

    var m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('Format file foto tidak valid.');

    var mimeType = String(form.mimeType || m[1] || 'image/jpeg');
    if (mimeType.indexOf('image/') !== 0) throw new Error('File harus berupa gambar.');

    var bytes = Utilities.base64Decode(m[2]);
    if (!bytes || bytes.length === 0) throw new Error('File foto kosong.');
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Ukuran foto terlalu besar. Maksimal sekitar 8 MB.');

    var jenisFoto = normalizeDashboardJenisFoto_(form.jenisFoto || form.jenis || 'Foto Proses');
    var ext = 'jpg';
    if (mimeType.indexOf('png') !== -1) ext = 'png';
    else if (mimeType.indexOf('webp') !== -1) ext = 'webp';
    else if (mimeType.indexOf('jpeg') !== -1 || mimeType.indexOf('jpg') !== -1) ext = 'jpg';

    var safeId = String(aduan.id || id || 'ADUAN').replace(/[^A-Z0-9-]/gi, '_');
    var safeJenis = String(jenisFoto || 'Foto').replace(/[^A-Z0-9]+/gi, '_');
    var fileName = safeId + '_' + safeJenis + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.' + ext;

    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = getOrCreateSiagaDocsFolder_();
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(shareErr) {}

    var link = file.getUrl();
    var actor = sessionUser.nama || sessionUser.username || 'Dashboard';
    var caption = String(form.caption || '').trim();
    var detail = 'UPLOAD_DASHBOARD | ' + fileName + ' | size=' + bytes.length + ' | original=' + String(form.originalSize || '') + ' | compressed=' + String(form.compressedSize || '');

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // V10.9.76: Foto final dari dashboard mengganti foto final lama.
    if (isFinalDocumentationJenis_(jenisFoto)) {
      try { cleanupOldFinalDocumentationRows_(aduan.id || id); } catch(cleanErr) {}
    }

    var sh = setupDokumentasiAduanSheet_(ss);
    sh.getRange(sh.getLastRow() + 1, 1, 1, 11).setValues([[
      new Date(),
      aduan.id || id,
      aduan.cabang || '',
      actor,
      '',
      jenisFoto,
      link,
      '',
      caption,
      'DRIVE_OK_DASHBOARD',
      truncateForLog_(detail, 1200)
    ]]);

    try { invalidateAduanDokumentasiCache_(aduan.id || id); } catch(cacheErr) {}

    // V10.9.121:
    // Dashboard > Dokumentasi > Foto Selesai harus sama dengan alur petugas WhatsApp:
    // setelah Foto Selesai berhasil diupload, status aduan otomatis menjadi Selesai.
    // Jadi admin/cabang tidak perlu lagi membuka Aksi Aduan hanya untuk mengubah status.
    var finalPhotoAutoFinished = false;
    var finalPhotoNotifyResult = null;
    try {
      if (isFinalDocumentationJenis_(jenisFoto)) {
        var oldStatusFinal = String(aduan.status || '').trim();

        if (oldStatusFinal.toLowerCase() !== 'selesai') {
          var finishNow = new Date();
          access.sheet.getRange(access.rowNumber, CONFIG.COL.STATUS).setValue('Selesai');
          access.sheet.getRange(access.rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(finishNow);
          access.sheet.getRange(access.rowNumber, CONFIG.COL.UPDATED_AT).setValue(finishNow);
          finalPhotoAutoFinished = true;

          try {
            var actorObjAutoFinish = {
              nama: actor,
              noWa: '',
              cabang: sessionUser.canSeeAll ? 'Admin Pusat' : (sessionUser.cabang || '-'),
              role: sessionUser.role || '-'
            };
            logStatusAduan_(aduan.id || id, oldStatusFinal, 'Selesai', actorObjAutoFinish, 'DASHBOARD_FINAL_PHOTO', caption || '', 'Foto Selesai upload via Dashboard otomatis menutup aduan.');
          } catch(logAutoErr) {}

          try { syncAduanRowToCabangMirror_(access.sheet, access.rowNumber); } catch(syncAutoErr) {}
          try { invalidateAduanFindCacheById_(aduan.id || id); } catch(cacheAutoErr) {}

          try {
            finalPhotoNotifyResult = notifyCustomerStatusChangeByRow_(access.sheet, access.rowNumber, oldStatusFinal, 'Selesai', 'DASHBOARD_FINAL_PHOTO');
          } catch(notifAutoErr) {
            finalPhotoNotifyResult = { success: false, error: notifAutoErr.message || String(notifAutoErr) };
          }
        } else {
          // Jika aduan memang sudah Selesai, kirim ulang dokumentasi terbaru ke pelanggan
          // supaya caption/catatan foto terakhir ikut muncul.
          finalPhotoNotifyResult = sendCustomerCompletionPhotoIfAvailable_(aduan.noHp || '', aduan, 'DASHBOARD_FINAL_PHOTO_UPLOAD');
        }
      }
    } catch(finalPhotoAutoErr) {
      try {
        logWhatsApp_(aduan.noHp || '', 'Dashboard Foto Selesai auto finish error', 'DASHBOARD_FINAL_PHOTO_AUTO_ERROR', aduan.id || id, '', 'ERROR', finalPhotoAutoErr.message || String(finalPhotoAutoErr));
      } catch(logErr2) {}
    }

    // V10.9.140:
    // Dashboard > Dokumentasi > Foto Respons harus sama dengan alur petugas WhatsApp:
    // setelah Foto Respons berhasil diupload pada aduan yang masih Baru, status otomatis menjadi Direspons.
    var responsePhotoAutoResponded = false;
    var responsePhotoNotifyResult = null;
    try {
      if (isResponseDocumentationJenis_(jenisFoto)) {
        var oldStatusResponse = String(access.sheet.getRange(access.rowNumber, CONFIG.COL.STATUS).getValue() || aduan.status || '').trim();
        if (!isStatusCountedAsResponse_(oldStatusResponse) && oldStatusResponse.toLowerCase() !== 'selesai' && oldStatusResponse.toLowerCase() !== 'batal') {
          var responseNow = new Date();
          access.sheet.getRange(access.rowNumber, CONFIG.COL.STATUS).setValue('Direspons');
          access.sheet.getRange(access.rowNumber, CONFIG.COL.UPDATED_AT).setValue(responseNow);
          responsePhotoAutoResponded = true;

          try {
            var actorObjAutoResponse = {
              nama: actor,
              noWa: '',
              cabang: sessionUser.canSeeAll ? 'Admin Pusat' : (sessionUser.cabang || '-'),
              role: sessionUser.role || '-'
            };
            logStatusAduan_(aduan.id || id, oldStatusResponse, 'Direspons', actorObjAutoResponse, 'DASHBOARD_RESPONSE_PHOTO', caption || '', 'Foto Respons upload via Dashboard otomatis mengubah status menjadi Direspons.');
            try { SIAGA_RESPONSE_TIME_MAP_CACHE_ = null; } catch(cacheRespMapErr) {}
          } catch(logRespErr) {}

          try { syncAduanRowToCabangMirror_(access.sheet, access.rowNumber); } catch(syncRespErr) {}
          try { invalidateAduanFindCacheById_(aduan.id || id); } catch(cacheRespErr) {}

          try {
            responsePhotoNotifyResult = notifyCustomerStatusChangeByRow_(access.sheet, access.rowNumber, oldStatusResponse, 'Direspons', 'DASHBOARD_RESPONSE_PHOTO');
          } catch(notifRespErr) {
            responsePhotoNotifyResult = { success: false, error: notifRespErr.message || String(notifRespErr) };
          }
        }
      }
    } catch(responsePhotoAutoErr) {
      try {
        logWhatsApp_(aduan.noHp || '', 'Dashboard Foto Respons auto response error', 'DASHBOARD_RESPONSE_PHOTO_AUTO_ERROR', aduan.id || id, '', 'ERROR', responsePhotoAutoErr.message || String(responsePhotoAutoErr));
      } catch(logErr3) {}
    }

    // Tambahkan jejak ringan di CATATAN agar update bisa diaudit dari sheet ADUAN.
    try {
      var now = new Date();
      var oldCatatan = String(access.sheet.getRange(access.rowNumber, CONFIG.COL.CATATAN).getValue() || '').trim();
      var addCatatan = '[' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '] ' +
        'Dokumentasi via Dashboard: ' + actor + ' upload ' + jenisFoto;
      if (caption) addCatatan += '. Catatan foto: ' + caption;
      access.sheet.getRange(access.rowNumber, CONFIG.COL.CATATAN).setValue(oldCatatan ? (oldCatatan + '\n' + addCatatan) : addCatatan);
      access.sheet.getRange(access.rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
      try { syncAduanRowToCabangMirror_(access.sheet, access.rowNumber); } catch(syncErr) {}
    } catch(noteErr) {}

    return {
      success: true,
      id: aduan.id || id,
      jenisFoto: jenisFoto,
      link: link,
      autoFinished: finalPhotoAutoFinished,
      autoResponded: responsePhotoAutoResponded,
      notifyResult: finalPhotoNotifyResult || responsePhotoNotifyResult,
      message: 'Dokumentasi ' + jenisFoto + ' berhasil diupload.' + (finalPhotoAutoFinished ? ' Status aduan otomatis menjadi Selesai.' : '') + (responsePhotoAutoResponded ? ' Status aduan otomatis menjadi Direspons / Cek Awal.' : '')
    };
  } catch (e) {
    Logger.log('Error clientUploadDashboardDocumentation: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message };
  }
}

function updateAduanFromDashboard_(form, sessionUser) {
  form = form || {};
  sessionUser = sessionUser || {};

  var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
  if (!id) throw new Error('ID aduan kosong.');

  var newStatus = normalizeInputStatus_(form.status || '');
  if (!newStatus) throw new Error('Status tidak valid.');

  var newPrioritas = normalizePriorityValue_(form.prioritas || 'Sedang');
  var hasNoHpField = Object.prototype.hasOwnProperty.call(form, 'noHp') || Object.prototype.hasOwnProperty.call(form, 'phone');
  var rawNoHpInput = hasNoHpField ? String(form.noHp || form.phone || '').trim() : '';
  var hasMeaningfulNoHp = !!rawNoHpInput && ['-', '—', '–'].indexOf(rawNoHpInput) === -1;
  var newNoHp = hasMeaningfulNoHp ? normalizePhone_(rawNoHpInput) : '';
  // Aduan lama bisa tidak memiliki nomor pelanggan. Kolom kosong/placeholder
  // tidak boleh memblokir update status, prioritas, unit, atau petugas.
  // Validasi nomor hanya dijalankan ketika pengguna benar-benar mengisinya.
  if (hasMeaningfulNoHp && !newNoHp) throw new Error('No HP pelanggan tidak valid.');
  var shouldUpdateNoHp = hasNoHpField && hasMeaningfulNoHp;
  var newUnit = String(form.unit || '').trim();
  var catatanInput = String(form.catatan || '').trim();
  var hasPetugasField = Object.prototype.hasOwnProperty.call(form, 'petugas') || Object.prototype.hasOwnProperty.call(form, 'petugasMenangani') || Object.prototype.hasOwnProperty.call(form, 'names');
  var petugasInput = form.petugas || form.petugasMenangani || form.names || [];
  if (typeof petugasInput === 'string') {
    petugasInput = petugasInput.split(',').map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  }
  if (!Array.isArray(petugasInput)) petugasInput = [];

  var allowedUnits = ['Cabang', 'Teknik', 'Hublang', 'Distribusi', 'Admin', 'Lainnya'];
  if (newUnit && allowedUnits.indexOf(newUnit) === -1) {
    // Tetap aman kalau user lama mengirim nama petugas/unit bebas, tapi batasi panjang.
    newUnit = newUnit.substring(0, 40);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var rowNumber = findAduanRowNumberById_(id);
  if (!main || !rowNumber) throw new Error('ID aduan tidak ditemukan: ' + id);

  var oldData = getAduanObjectFromSheetRow_(main, rowNumber);
  if (!dashboardUserCanAccessAduan_(sessionUser, oldData)) {
    throw new Error('Aduan ini bukan cabang login Anda.');
  }

  var oldStatus = String(oldData.status || '').trim();
  var oldPrioritas = String(oldData.prioritas || '').trim();
  var oldNoHp = normalizePhone_(oldData.noHp || '');
  var oldUnit = String(oldData.unit || '').trim();
  var now = new Date();

  // V10.9.140: Dashboard juga wajib punya Foto Respons sebelum status bisa menjadi Direspons.
  // Ini mencegah petugas/cabang mengklaim sudah menuju/cek lokasi tanpa bukti foto.
  if (newStatus === 'Direspons' && oldStatus.toLowerCase() !== 'direspons' && !hasResponseDocumentationForAduan_(id)) {
    throw new Error('Status Respons / Cek Awal wajib melampirkan Foto Respons. Pilih jenis Foto Respons, pilih file foto, lalu klik Simpan / Upload.');
  }

  // V10.9.122: Dashboard tidak boleh menutup aduan dari tombol Simpan / Upload
  // tanpa Foto Selesai. Jika Foto Selesai baru diupload, fungsi upload akan
  // menyimpan dokumentasi terlebih dahulu, lalu update status ini boleh lanjut.
  if (newStatus === 'Selesai' && oldStatus.toLowerCase() !== 'selesai' && !hasFinalDocumentationForAduan_(id)) {
    throw new Error('Status Selesai wajib melampirkan Foto Selesai. Pilih jenis Foto Selesai, pilih file foto, lalu klik Simpan / Upload.');
  }

  main.getRange(rowNumber, CONFIG.COL.STATUS).setValue(newStatus);
  main.getRange(rowNumber, CONFIG.COL.PRIORITAS).setValue(newPrioritas);
  main.getRange(rowNumber, CONFIG.COL.SLA_JAM).setValue(getSlaJamForPrioritas_(newPrioritas));
  if (shouldUpdateNoHp) main.getRange(rowNumber, CONFIG.COL.NO_HP).setValue(newNoHp);
  if (newUnit) main.getRange(rowNumber, CONFIG.COL.UNIT).setValue(newUnit);
  main.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);

  try { applyMainAduanDropdowns_(main); } catch(dropErr) {}
  try { applyMainAduanConditionalFormatting_(main); } catch(colorErr) {}
  try { applyMainAduanRowStyle_(main, rowNumber); } catch(styleErr) {}

  if (newStatus === 'Selesai') {
    main.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(now);
  } else if (oldStatus === 'Selesai' && newStatus !== 'Selesai') {
    main.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).clearContent();
  }

  var oldCatatan = String(main.getRange(rowNumber, CONFIG.COL.CATATAN).getValue() || '').trim();
  var actor = sessionUser.nama || sessionUser.username || '-';
  var addCatatan = '[' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '] ' +
    'Update via Dashboard: ' + actor + ' (' + (sessionUser.role || '-') + ') → Status ' + (oldStatus || '-') + ' menjadi ' + newStatus +
    ' | Prioritas ' + (oldPrioritas || '-') + ' menjadi ' + newPrioritas +
    (shouldUpdateNoHp && oldNoHp !== newNoHp ? ' | No HP ' + (oldNoHp || '-') + ' menjadi ' + newNoHp : '') +
    ' | Unit ' + (oldUnit || '-') + ' menjadi ' + (newUnit || oldUnit || '-');
  if (catatanInput) addCatatan += '. Catatan: ' + catatanInput;

  main.getRange(rowNumber, CONFIG.COL.CATATAN).setValue(oldCatatan ? (oldCatatan + '\n' + addCatatan) : addCatatan);

  try { invalidateAduanFindCacheById_(id); } catch(e) {}
  try { syncAduanRowToCabangMirror_(main, rowNumber); } catch(syncErr) {
    logWhatsApp_(sessionUser.username || '', 'DASHBOARD_UPDATE_MIRROR_ERROR', 'CABANG_MIRROR_ERROR', id, '', 'ERROR', syncErr.message);
  }

  var actorObj = {
    nama: actor,
    noWa: '',
    cabang: sessionUser.canSeeAll ? 'Admin Pusat' : (sessionUser.cabang || '-'),
    role: sessionUser.role || '-'
  };
  try { logStatusAduan_(id, oldStatus, newStatus, actorObj, 'DASHBOARD_WEB', catatanInput || '', JSON.stringify({ oldPrioritas: oldPrioritas, newPrioritas: newPrioritas, oldNoHp: oldNoHp, newNoHp: shouldUpdateNoHp ? newNoHp : oldNoHp, oldUnit: oldUnit, newUnit: newUnit })); } catch(logErr) {}

  if (oldStatus.toLowerCase() !== newStatus.toLowerCase()) {
    try { notifyCustomerStatusChangeByRow_(main, rowNumber, oldStatus, newStatus, 'DASHBOARD_WEB', catatanInput); } catch(notifErr) {
      logWhatsApp_(sessionUser.username || '', 'DASHBOARD_UPDATE_NOTIFY_ERROR', 'CUSTOMER_NOTIFY_ERROR', id, '', 'ERROR', notifErr.message);
    }
  }

  var assignedPetugasResult = null;
  if (hasPetugasField) {
    try {
      assignedPetugasResult = saveAduanPetugasAssignments_(id, petugasInput, sessionUser);
    } catch(assignErr) {
      throw new Error('Update aduan tersimpan, tetapi gagal menyimpan petugas: ' + (assignErr.message || assignErr));
    }
  }

  return {
    id: id,
    oldStatus: oldStatus,
    newStatus: newStatus,
    rowNumber: rowNumber,
    assignedPetugas: assignedPetugasResult ? assignedPetugasResult.assigned : getPenugasanAduanRows_(id)
  };
}


// ============================================================
// V10.9.112 - METRIK ADMIN DASHBOARD
// Persentase pengerjaan dan ketepatan waktu dihitung di server
// agar memakai seluruh data terfilter, bukan hanya tabel selesai yang dibatasi.
