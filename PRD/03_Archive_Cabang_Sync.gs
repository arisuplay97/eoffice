// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: 03_Archive_Cabang_Sync.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

function formatSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastRow = sheet.getLastRow();

  // Alternating rows
  for (var r = 2; r <= lastRow; r++) {
    var bg = r % 2 === 0 ? '#f8fafc' : '#ffffff';
    sheet.getRange(r, 1, 1, 14).setBackground(bg);
  }

  // Vertical alignment semua data
  sheet.getRange(2, 1, lastRow - 1, 14).setVerticalAlignment('middle');

  // Set row height
  for (var r2 = 2; r2 <= lastRow; r2++) {
    sheet.setRowHeight(r2, 28);
  }

  // Sembunyikan kolom teknis
  sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);
}

// ============================================================
// MENU: Urutkan Data
// ============================================================
function sortSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var ui = SpreadsheetApp.getUi();

  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('Tidak ada data untuk diurutkan.');
    return;
  }

  var result = ui.prompt(
    'Urutkan Data',
    'Pilih pengurutan:\n1 = Cabang (A-Z)\n2 = Wilayah (A-Z)\n3 = Waktu Masuk Terbaru',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  var choice = result.getResponseText().trim();
  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, 1, lastRow - 1, 16);

  if (choice === '1') {
    range.sort([{ column: CONFIG.COL.CABANG, ascending: true }, { column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  } else if (choice === '2') {
    range.sort([{ column: CONFIG.COL.WILAYAH, ascending: true }, { column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  } else {
    range.sort([{ column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  }

  formatSheet();
  ui.alert('✅ Data berhasil diurutkan!');
}


// ============================================================
// FITUR ARSIP BULANAN
// ============================================================

/**
 * Arsipkan data bulan sebelumnya yang statusnya Selesai/Batal.
 * Contoh:
 * Jika sekarang Juni 2026, maka data Mei 2026 yang statusnya Selesai/Batal
 * akan dipindahkan dari ADUAN ke ARSIP_2026_05.
 */
function archiveLastMonth() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var archiveName = 'ARSIP_' + Utilities.formatDate(startLastMonth, Session.getScriptTimeZone(), 'yyyy_MM');

  archiveClosedData_({
    mode: 'LAST_MONTH',
    title: 'Arsipkan Bulan Lalu',
    archiveName: archiveName,
    startDate: startLastMonth,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: false
  });
}


/**
 * V10.9.46
 * Bersihkan data bulanan dari ADUAN dan CABANG_*.
 * Status yang tetap di ADUAN hanya Baru dan Proses.
 * Status lain seperti Selesai, Batal, Ditunda akan masuk arsip.
 */
function archiveChooseMonthExceptNewProcess() {
  var ui = SpreadsheetApp.getUi();
  var now = new Date();
  var defaultPeriod = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );

  var response = ui.prompt(
    'Bersihkan Pilih Bulan',
    'Masukkan periode yang ingin dibersihkan dengan format YYYY-MM.\n\n' +
    'Contoh: ' + defaultPeriod + '\n\n' +
    'Aturan:\n' +
    '- Status Baru tetap di ADUAN.\n' +
    '- Status Proses tetap di ADUAN.\n' +
    '- Status Selesai/Batal/Ditunda akan dipindahkan ke ARSIP bulan tersebut.\n' +
    '- Data yang dipindahkan juga dibersihkan dari sheet CABANG_*.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var input = String(response.getResponseText() || '').trim();
  var parsed = parseArchivePeriod_(input);

  if (!parsed) {
    ui.alert('Format periode tidak valid', 'Gunakan format YYYY-MM, contoh: 2026-04.', ui.ButtonSet.OK);
    return;
  }

  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (parsed.startDate >= startCurrentMonth) {
    var confirmCurrent = ui.alert(
      'Periode masih bulan berjalan / masa depan',
      'Periode yang dipilih adalah ' + parsed.label + '.\n\n' +
      'Saran sistem: pembersihan bulanan sebaiknya hanya untuk bulan yang sudah lewat.\n\n' +
      'Tetap lanjut menghitung data periode ini?',
      ui.ButtonSet.YES_NO
    );
    if (confirmCurrent !== ui.Button.YES) return;
  }

  archiveClosedData_({
    mode: 'CHOOSE_MONTH_EXCEPT_NEW_PROCESS',
    title: 'Bersihkan Pilih Bulan',
    archiveName: parsed.archiveName,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    includeOlderThanCurrentMonth: false,
    selectedPeriodLabel: parsed.label,
    statusRule: 'EXCEPT_NEW_PROCESS',
    cleanCabangMirror: true
  });
}

function archiveLastMonthExceptNewProcess() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var archiveName = 'ARSIP_' + Utilities.formatDate(startLastMonth, Session.getScriptTimeZone(), 'yyyy_MM');

  archiveClosedData_({
    mode: 'LAST_MONTH_EXCEPT_NEW_PROCESS',
    title: 'Bersihkan Bulan Lalu',
    archiveName: archiveName,
    startDate: startLastMonth,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: false,
    statusRule: 'EXCEPT_NEW_PROCESS',
    cleanCabangMirror: true
  });
}

function archiveAllOldExceptNewProcess() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  archiveClosedData_({
    mode: 'ALL_OLD_EXCEPT_NEW_PROCESS',
    title: 'Bersihkan Semua Bulan Lama',
    startDate: null,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: true,
    statusRule: 'EXCEPT_NEW_PROCESS',
    cleanCabangMirror: true
  });
}

function archiveChooseMonth() {
  var ui = SpreadsheetApp.getUi();
  var now = new Date();
  var defaultPeriod = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );

  var response = ui.prompt(
    'Arsipkan Pilih Bulan',
    'Masukkan periode arsip dengan format YYYY-MM.\n\n' +
    'Contoh: ' + defaultPeriod + '\n\n' +
    'Catatan:\n' +
    '- Hanya data status Selesai/Batal yang akan dipindahkan.\n' +
    '- Data Baru/Proses/Ditunda tetap berada di sheet ADUAN.\n' +
    '- Sistem tetap akan menampilkan konfirmasi sebelum memindahkan data.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var input = String(response.getResponseText() || '').trim();
  var parsed = parseArchivePeriod_(input);

  if (!parsed) {
    ui.alert(
      'Format periode tidak valid',
      'Gunakan format YYYY-MM, contoh: 2026-04.',
      ui.ButtonSet.OK
    );
    return;
  }

  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (parsed.startDate >= startCurrentMonth) {
    var confirmCurrent = ui.alert(
      'Periode masih bulan berjalan / masa depan',
      'Periode yang dipilih adalah ' + parsed.label + '.\n\n' +
      'Saran sistem: arsip sebaiknya hanya untuk bulan yang sudah lewat.\n\n' +
      'Tetap lanjut menghitung data arsip periode ini?',
      ui.ButtonSet.YES_NO
    );

    if (confirmCurrent !== ui.Button.YES) return;
  }

  archiveClosedData_({
    mode: 'CHOOSE_MONTH',
    title: 'Arsipkan Pilih Bulan',
    archiveName: parsed.archiveName,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    includeOlderThanCurrentMonth: false,
    selectedPeriodLabel: parsed.label
  });
}

/**
 * Arsipkan semua data lama yang sudah Selesai/Batal dan Waktu Masuk-nya
 * sebelum bulan berjalan. Ini berguna jika admin lupa arsip beberapa bulan.
 * Data akan masuk ke sheet arsip sesuai bulan Waktu Masuk masing-masing.
 */
function archiveAllOldClosedData() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  archiveClosedData_({
    mode: 'ALL_OLD_CLOSED',
    title: 'Arsipkan Semua Data Lama',
    startDate: null,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: true
  });
}

/**
 * V10.9.37
 * Arsipkan semua data berstatus final (Selesai/Batal) tanpa batas bulan.
 * Setelah dipindahkan dari sheet ADUAN, Aduan Aktif di WhatsApp tidak lagi menampilkan tiket final tersebut.
 */
function archiveAllClosedData() {
  archiveClosedData_({
    mode: 'ALL_CLOSED',
    title: 'Arsipkan Semua Selesai/Batal',
    startDate: null,
    endDate: null,
    includeOlderThanCurrentMonth: false
  });
}

/**
 * V10.9.37
 * Arsipkan data final (Selesai/Batal) untuk satu nomor WhatsApp.
 * Cocok untuk membersihkan Aduan Aktif pelanggan tertentu agar di HP menjadi kosong bila semua tiketnya sudah final.
 */
function archiveClosedDataByPhone() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Arsipkan per Nomor WhatsApp',
    'Masukkan nomor WhatsApp pelanggan yang ingin diarsipkan.\n\n' +
    'Contoh: 081234567890 atau 6281234567890\n\n' +
    'Catatan: hanya aduan berstatus Selesai/Batal dari nomor ini yang dipindahkan ke arsip.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var phone = normalizePhone_(response.getResponseText());
  if (!phone) {
    ui.alert('Nomor WhatsApp tidak valid.');
    return;
  }

  archiveClosedData_({
    mode: 'BY_PHONE_CLOSED',
    title: 'Arsipkan Selesai/Batal per No WA',
    startDate: null,
    endDate: null,
    includeOlderThanCurrentMonth: false,
    phone: phone
  });
}

function archiveClosedData_(options) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    ui.alert('Sheet ADUAN tidak ditemukan. Jalankan Setup terlebih dahulu.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('Belum ada data aduan untuk diarsipkan.');
    return;
  }

  options = options || {};

  var archiveWidth = getAduanHeaders_().length; // V10.9.46: arsip menyimpan sampai kolom Lokasi Detail.
  var dataRange = sheet.getRange(2, 1, lastRow - 1, archiveWidth);
  var values = dataRange.getValues();

  var rowsToArchive = [];
  var groups = {};
  var targetPhone = normalizePhone_(options.phone || '');

  values.forEach(function(row, i) {
    var idAduan = String(row[CONFIG.COL.ID - 1] || '').trim();
    var status = String(row[CONFIG.COL.STATUS - 1] || '').trim();
    var waktuMasuk = asDateForArchive_(row[CONFIG.COL.WAKTU_MASUK - 1]);
    var rowPhone = normalizePhone_(row[CONFIG.COL.NO_HP - 1] || '');

    if (!idAduan || !waktuMasuk) return;
    if (!isArchiveStatusEligible_(status, options)) return;

    // Jika mode per nomor, hanya arsipkan nomor yang diminta.
    if (targetPhone && rowPhone !== targetPhone) return;

    var eligible = false;

    if (
      options.mode === 'LAST_MONTH' ||
      options.mode === 'CHOOSE_MONTH' ||
      options.mode === 'LAST_MONTH_EXCEPT_NEW_PROCESS' ||
      options.mode === 'CHOOSE_MONTH_EXCEPT_NEW_PROCESS'
    ) {
      eligible = waktuMasuk >= options.startDate && waktuMasuk < options.endDate;
    } else if (options.mode === 'ALL_OLD_CLOSED' || options.mode === 'ALL_OLD_EXCEPT_NEW_PROCESS') {
      eligible = waktuMasuk < options.endDate;
    } else if (options.mode === 'ALL_CLOSED' || options.mode === 'BY_PHONE_CLOSED') {
      eligible = true;
    }

    if (!eligible) return;

    var archiveSheetName = options.archiveName ||
      ('ARSIP_' + Utilities.formatDate(waktuMasuk, Session.getScriptTimeZone(), 'yyyy_MM'));

    var item = {
      sheetRow: i + 2,
      values: row,
      archiveSheetName: archiveSheetName,
      period: Utilities.formatDate(waktuMasuk, Session.getScriptTimeZone(), 'yyyy-MM')
    };

    rowsToArchive.push(item);

    if (!groups[archiveSheetName]) groups[archiveSheetName] = [];
    groups[archiveSheetName].push(item);
  });

  if (rowsToArchive.length === 0) {
    var emptyStatusText = getArchiveStatusRuleLabel_(options);
    var emptyMsg = targetPhone
      ? 'Tidak ditemukan aduan dengan kriteria ' + emptyStatusText + ' untuk nomor ' + targetPhone + '.\n\nJika Aduan Aktif masih muncul, kemungkinan statusnya masih Baru/Proses atau nomor WhatsApp berbeda.'
      : 'Tidak ditemukan aduan dengan kriteria ' + emptyStatusText + ' yang sesuai kriteria arsip.';

    ui.alert(
      'Tidak ada data untuk diarsipkan',
      emptyMsg,
      ui.ButtonSet.OK
    );
    return;
  }

  var summary = buildArchiveConfirmationSummary_(rowsToArchive, groups, options);

  var confirm = ui.alert(
    options.title,
    summary,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    var backupName = makeUniqueSheetName_(ss, 'BACKUP_ADUAN_' + timestamp);

    // Backup sebelum menghapus data dari ADUAN.
    var backupSheet = sheet.copyTo(ss).setName(backupName);
    backupSheet.hideSheet();

    var headers = getAduanHeaders_();

    Object.keys(groups).forEach(function(archiveSheetName) {
      var archiveSheet = getOrCreateArchiveSheet_(ss, archiveSheetName, headers);
      var groupRows = groups[archiveSheetName].map(function(item) {
        return item.values;
      });

      archiveSheet
        .getRange(archiveSheet.getLastRow() + 1, 1, groupRows.length, headers.length)
        .setValues(groupRows);

      formatArchiveSheet_(archiveSheet, headers.length);

      writeArchiveLog_({
        archiveSheetName: archiveSheetName,
        count: groupRows.length,
        backupName: backupName,
        mode: options.mode,
        period: getPeriodLabel_(groups[archiveSheetName])
      });
    });

    var archivedIds = rowsToArchive.map(function(item) {
      return String(item.values[CONFIG.COL.ID - 1] || '').trim();
    }).filter(Boolean);

    // Hapus dari bawah agar nomor baris tidak bergeser.
    rowsToArchive
      .map(function(item) { return item.sheetRow; })
      .sort(function(a, b) { return b - a; })
      .forEach(function(rowNumber) {
        sheet.deleteRow(rowNumber);
      });

    // V10.9.46: agar semua sheet bulanan/cabang ikut bersih,
    // data yang sudah keluar dari ADUAN juga dihapus dari CABANG_*.
    var mirrorClean = options.cleanCabangMirror === false
      ? { deleted: 0, sheets: [] }
      : removeArchivedIdsFromCabangMirrors_(archivedIds);

    // V10.9.47:
    // Dokumentasi foto milik aduan yang sudah diarsipkan ikut dipindah
    // ke ARSIP_DOKUMENTASI_YYYY_MM, agar DOKUMENTASI_ADUAN tetap kecil
    // dan tombol Lihat Foto pelanggan tidak scan terlalu banyak baris.
    var docsClean = archiveDokumentasiByAduanIds_(archivedIds, options.archiveName || '');

    archivedIds.forEach(function(id) {
      try { invalidateAduanFindCacheById_(id); } catch(cacheErr) {}
      try { invalidateAduanDokumentasiCache_(id); } catch(docCacheErr) {}
    });

    formatSheet();

    ui.alert(
      '✅ Arsip Berhasil',
      rowsToArchive.length + ' data berhasil dipindahkan ke arsip.\n\n' +
      'Aturan status: ' + getArchiveStatusRuleLabel_(options) + '\n' +
      (targetPhone ? ('Nomor WA: ' + targetPhone + '\n') : '') +
      'Backup dibuat otomatis: ' + backupName + '\n' +
      'Data Baru/Proses tetap berada di sheet ADUAN.\n' +
      'Data di sheet CABANG_* yang ikut dibersihkan: ' + (mirrorClean.deleted || 0) + ' baris.\n' +
      'Dokumentasi foto yang ikut diarsipkan: ' + (docsClean.moved || 0) + ' baris.\n\n' +
      'Catatan: Aduan Aktif di WhatsApp hanya membaca sheet ADUAN. Jadi tiket yang sudah diarsipkan tidak akan muncul lagi di HP pelanggan.',
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert('❌ Gagal arsip: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}


function parseArchivePeriod_(periodText) {
  var match = /^(\d{4})-(\d{2})$/.exec(String(periodText || '').trim());
  if (!match) return null;

  var year = Number(match[1]);
  var month = Number(match[2]);

  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;

  var startDate = new Date(year, month - 1, 1);
  var endDate = new Date(year, month, 1);

  return {
    year: year,
    month: month,
    startDate: startDate,
    endDate: endDate,
    label: Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'MMMM yyyy'),
    archiveName: 'ARSIP_' + Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy_MM')
  };
}


function isArchiveExceptNewProcessMode_(options) {
  options = options || {};
  return String(options.statusRule || '').toUpperCase() === 'EXCEPT_NEW_PROCESS' ||
         String(options.mode || '').indexOf('EXCEPT_NEW_PROCESS') !== -1;
}

function getArchiveStatusRuleLabel_(options) {
  if (isArchiveExceptNewProcessMode_(options)) {
    return 'Semua status kecuali Baru dan Proses';
  }
  return 'Selesai dan Batal';
}

function isArchiveStatusEligible_(status, options) {
  status = String(status || '').trim();

  if (isArchiveExceptNewProcessMode_(options)) {
    var lower = status.toLowerCase();

    // Yang tetap aktif di ADUAN hanya Baru dan Proses.
    if (lower === 'baru' || lower === 'proses') return false;

    // Jangan arsipkan baris tanpa status agar data setengah jadi tidak ikut pindah.
    if (!lower) return false;

    return true;
  }

  return status === 'Selesai' || status === 'Batal';
}

function removeArchivedIdsFromCabangMirrors_(ids) {
  ids = (ids || []).map(function(id) { return String(id || '').trim(); }).filter(Boolean);
  if (!ids.length) return { deleted: 0, sheets: [] };

  var idMap = {};
  ids.forEach(function(id) { idMap[id] = true; });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var deleted = 0;
  var sheetsTouched = [];

  Object.keys(CABANG_CODE || {}).forEach(function(cabang) {
    var sheetName = getCabangMirrorSheetName_(cabang);
    var sh = ss.getSheetByName(sheetName);
    if (!sh || safeGetLastRow_(sh) < 2) return;

    var values = sh.getRange(2, CONFIG.COL.ID, safeGetLastRow_(sh) - 1, 1).getValues();
    var rows = [];

    values.forEach(function(row, idx) {
      var id = String(row[0] || '').trim();
      if (id && idMap[id]) rows.push(idx + 2);
    });

    if (!rows.length) return;

    rows.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
      try {
        sh.deleteRow(rowNumber);
        deleted++;
      } catch(e) {}
    });

    sheetsTouched.push(sheetName);
  });

  return { deleted: deleted, sheets: sheetsTouched };
}


function buildArchiveConfirmationSummary_(rowsToArchive, groups, options) {
  var targetSheets = Object.keys(groups).sort();
  var groupLines = targetSheets.map(function(sheetName) {
    return '- ' + sheetName + ': ' + groups[sheetName].length + ' data';
  }).join('\n');

  var periode = options.selectedPeriodLabel || '-';
  if (
    (
      options.mode === 'LAST_MONTH' ||
      options.mode === 'CHOOSE_MONTH' ||
      options.mode === 'LAST_MONTH_EXCEPT_NEW_PROCESS' ||
      options.mode === 'CHOOSE_MONTH_EXCEPT_NEW_PROCESS'
    ) && options.startDate
  ) {
    periode = Utilities.formatDate(options.startDate, Session.getScriptTimeZone(), 'MMMM yyyy');
  } else if ((options.mode === 'ALL_OLD_CLOSED' || options.mode === 'ALL_OLD_EXCEPT_NEW_PROCESS') && options.endDate) {
    periode = 'Semua data sebelum ' + Utilities.formatDate(options.endDate, Session.getScriptTimeZone(), 'MMMM yyyy');
  } else if (options.mode === 'ALL_CLOSED') {
    periode = 'Semua periode';
  } else if (options.mode === 'BY_PHONE_CLOSED') {
    periode = 'Semua periode untuk No WA: ' + normalizePhone_(options.phone || '');
  }

  var statusLabel = getArchiveStatusRuleLabel_(options);
  var activeNote = isArchiveExceptNewProcessMode_(options)
    ? 'Data status Baru dan Proses TIDAK akan dipindahkan. Status lain seperti Selesai/Batal/Ditunda akan dipindahkan.'
    : 'Data aktif seperti Baru, Proses, dan Ditunda TIDAK akan dipindahkan.';

  return (
    'Sistem menemukan data yang siap diarsipkan:\n\n' +
    'Periode: ' + periode + '\n' +
    'Status yang dipindahkan: ' + statusLabel + '\n' +
    'Jumlah data: ' + rowsToArchive.length + ' aduan\n\n' +
    'Tujuan arsip:\n' +
    groupLines + '\n\n' +
    activeNote + '\n\n' +
    'Backup sheet ADUAN akan dibuat otomatis sebelum data dipindahkan.\n\n' +
    'Data yang dipindahkan juga akan dibersihkan dari sheet CABANG_* supaya tabel cabang ikut rapi.\n\n' +
    'Setelah dipindahkan, data ini tidak muncul lagi di Aduan Aktif WhatsApp karena sudah keluar dari sheet ADUAN.\n\n' +
    'Lanjutkan arsip?'
  );
}

function setupArchiveLogSheet(ss) {
  var sh = ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.ARCHIVE_LOG_SHEET);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 7).setValues([[
      'Tanggal Arsip',
      'Mode',
      'Periode',
      'Sheet Arsip',
      'Jumlah Data',
      'Backup Sheet',
      'User'
    ]]);
  }

  sh.getRange(1, 1, 1, 7)
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 7);
}

function openArchiveLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupArchiveLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET));
}

function writeArchiveLog_(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupArchiveLogSheet(ss);

  var sh = ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET);
  var userEmail = '';

  try {
    userEmail = Session.getActiveUser().getEmail() || '-';
  } catch (e) {
    userEmail = '-';
  }

  sh.appendRow([
    new Date(),
    payload.mode,
    payload.period,
    payload.archiveSheetName,
    payload.count,
    payload.backupName,
    userEmail
  ]);

  sh.autoResizeColumns(1, 7);
}

function getOrCreateArchiveSheet_(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);

  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }

  // Refresh header saja, data arsip lama tetap aman.
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatArchiveSheet_(sh, headers.length);
  return sh;
}

function formatArchiveSheet_(sheet, headerCount) {
  var lastRow = Math.max(safeGetLastRow_(sheet), 2);

  sheet.getRange(1, 1, 1, headerCount)
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);

  var colWidths = [130, 140, 140, 130, 130, 140, 120, 140, 90, 90, 120, 220, 220, 140, 70, 130, 100, 100, 220, 220];
  for (var i = 0; i < Math.min(colWidths.length, headerCount); i++) {
    sheet.setColumnWidth(i + 1, colWidths[i]);
  }

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.min(14, headerCount)).setVerticalAlignment('middle');
  }

  try {
    if (headerCount >= CONFIG.COL.SLA_JAM) {
      sheet.hideColumns(CONFIG.COL.SLA_JAM, Math.min(2, headerCount - CONFIG.COL.SLA_JAM + 1));
    }
  } catch (e) {}
}

function getAduanHeaders_() {
  // V10.9.46: arsip mengikuti struktur ADUAN terbaru sampai kolom lokasi.
  return [
    'ID Aduan',
    'Waktu Masuk',
    'Cabang',
    'Wilayah/Kecamatan',
    'No Pelanggan',
    'Nama Pelanggan',
    'No HP',
    'Jenis Gangguan',
    'Prioritas',
    'Status',
    'Unit/Petugas',
    'Keterangan Aduan',
    'Catatan Tindak Lanjut',
    'Waktu Selesai',
    'SLA Respons Jam',
    'Updated At',
    'Latitude',
    'Longitude',
    'Link Maps',
    'Lokasi Detail'
  ];
}

function getPeriodLabel_(items) {
  var periods = {};
  items.forEach(function(item) {
    periods[item.period] = true;
  });
  return Object.keys(periods).sort().join(', ');
}

function asDateForArchive_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  var parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
}

function makeUniqueSheetName_(ss, baseName) {
  var name = baseName;
  var counter = 1;

  while (ss.getSheetByName(name)) {
    name = baseName + '_' + counter;
    counter++;
  }

  return name;
}


// ============================================================
// FITUR INPUT PER CABANG → ADUAN PUSAT
// ============================================================

function setupCabangInputSheets(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) sh = ss.insertSheet(item.sheet);
    setupSingleCabangInputSheet_(sh, item);
  });

  setupInputCabangLogSheet(ss);

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Input Cabang Siap',
      'Sheet input cabang sudah dibuat/diperbarui.\n\nCabang cukup mengisi data pada sheet masing-masing.\nData akan masuk ke ADUAN pusat melalui menu Sinkron Input Cabang ke ADUAN.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

function setupSingleCabangInputSheet_(sh, item) {
  var headers = [
    'Tanggal Input',
    'Nama Pelanggan',
    'No HP',
    'Wilayah/Kecamatan',
    'No Pelanggan',
    'Jenis Gangguan',
    'Prioritas',
    'Keterangan Aduan',
    'Unit/Petugas',
    'Sync Status',
    'ID Aduan',
    'Waktu Sync',
    'Catatan Sistem'
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);

  // Jika sheet input sudah punya data format lama, geser otomatis ke format baru.
  migrateExistingCabangInputRows_(sh);

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b68')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Lebar kolom input cabang
  [150,180,130,150,150,160,110,240,180,120,170,150,220].forEach(function(w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  var inputRows = Math.max(500, sh.getMaxRows() - 1);

  // Bersihkan dropdown lama yang masih nempel di posisi kolom lama,
  // lalu pasang ulang dropdown sesuai struktur baru.
  refreshInputCabangDropdowns_(sh, inputRows);

  // Kolom sistem diberi warna lembut:
  // A = Tanggal Input otomatis
  // J:M = Sync Status, ID Aduan, Waktu Sync, Catatan Sistem
  sh.getRange(1, 1, Math.max(500, sh.getMaxRows()), 1).setBackground('#f1f5f9');
  sh.getRange(1, 10, Math.max(500, sh.getMaxRows()), 4).setBackground('#f1f5f9');

  sh.getRange('B2').setNote(
    'Isi Nama Pelanggan mulai kolom ini. Kolom Tanggal Input akan otomatis muncul saat Nama Pelanggan diketik. Kolom Sync Status, ID Aduan, Waktu Sync, dan Catatan Sistem akan diisi otomatis oleh sistem.'
  );

  // Proteksi kolom sistem agar cabang tidak mengubah tanggal/status sinkron secara manual.
  protectInputCabangSystemColumns_(sh);

  sh.autoResizeRows(1, 1);
}


function isCabangInputSheet_(sheetName) {
  return CABANG_INPUT_SHEETS.some(function(item) {
    return item.sheet === sheetName;
  });
}

function protectInputCabangSystemColumns_(sh) {
  try {
    var protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function(p) {
      var desc = p.getDescription ? p.getDescription() : '';
      if (desc === 'SIAGA_TIARA_INPUT_TANGGAL' || desc === 'SIAGA_TIARA_SYSTEM_COLUMNS') {
        p.remove();
      }
    });

    protectRangeForSystem_(sh.getRange(1, 1, sh.getMaxRows(), 1), 'SIAGA_TIARA_INPUT_TANGGAL');
    protectRangeForSystem_(sh.getRange(1, 10, sh.getMaxRows(), 4), 'SIAGA_TIARA_SYSTEM_COLUMNS');
  } catch (e) {
    // Jika proteksi penuh gagal karena akses, fallback warning saja.
    try {
      var p1 = sh.getRange(1, 1, sh.getMaxRows(), 1).protect();
      p1.setDescription('SIAGA_TIARA_INPUT_TANGGAL');
      p1.setWarningOnly(true);

      var p2 = sh.getRange(1, 10, sh.getMaxRows(), 4).protect();
      p2.setDescription('SIAGA_TIARA_SYSTEM_COLUMNS');
      p2.setWarningOnly(true);
    } catch (err) {}
  }
}

function protectRangeForSystem_(range, description) {
  var protection = range.protect();
  protection.setDescription(description);
  protection.setWarningOnly(false);

  try {
    var effectiveUser = Session.getEffectiveUser();
    protection.addEditor(effectiveUser);

    var ownerEmail = effectiveUser && effectiveUser.getEmail ? effectiveUser.getEmail() : '';
    protection.getEditors().forEach(function(editor) {
      var email = editor && editor.getEmail ? editor.getEmail() : '';
      if (email && email !== ownerEmail) {
        protection.removeEditor(editor);
      }
    });

    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  } catch (e) {}
}

function handleInputCabangEdit_(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (!sheet || !isCabangInputSheet_(sheet.getName())) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();

  if (row < 2) return;

  // Tanggal otomatis muncul saat Nama Pelanggan diketik.
  // Kolom input cabang:
  // A Tanggal Input, B Nama Pelanggan, C No HP, D Wilayah, E Desa,
  // F Jenis, G Prioritas, H Keterangan, I Unit/Petugas.
  if (col >= 2 && col <= 9) {
    var nama = String(sheet.getRange(row, 2).getValue() || '').trim();
    var tanggalCell = sheet.getRange(row, 1);

    if (nama && !tanggalCell.getValue()) {
      try {
        tanggalCell.setValue(new Date());
        tanggalCell.setNumberFormat('dd/MM/yyyy HH:mm:ss');
      } catch (err) {}
    }

    // Kalau semua kolom input B:I kosong dan belum tersinkron, bersihkan tanggal/status.
    var inputValues = sheet.getRange(row, 2, 1, 8).getValues()[0];
    var hasInput = inputValues.some(function(v) {
      return String(v || '').trim() !== '';
    });

    var syncStatus = String(sheet.getRange(row, 10).getValue() || '').trim();
    var idAduan = String(sheet.getRange(row, 11).getValue() || '').trim();

    if (!hasInput && !syncStatus && !idAduan) {
      try {
        sheet.getRange(row, 1).clearContent();
        sheet.getRange(row, 10, 1, 4).clearContent();
        sheet.getRange(row, 1, 1, 13).setBackground(null);
      } catch (err2) {}
    }
  }
}

// Handler untuk installable trigger.
// Dibuat agar tanggal otomatis tetap bisa ditulis meskipun kolom tanggal diproteksi.
function handleInputCabangOnEdit(e) {
  handleInputCabangEdit_(e);
}

function enableInputCabangTimestampTrigger() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Aktifkan Tanggal Otomatis Input Cabang',
    'Sistem akan mengaktifkan trigger agar kolom Tanggal Input pada sheet cabang otomatis terisi ketika Nama Pelanggan diketik.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  ensureInputCabangTimestampTrigger_();

  ui.alert(
    '✅ Tanggal Otomatis Aktif',
    'Kolom Tanggal Input akan otomatis terisi saat Nama Pelanggan diketik di sheet input cabang.',
    ui.ButtonSet.OK
  );
}

function ensureInputCabangTimestampTrigger_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function(t) {
    return t.getHandlerFunction && t.getHandlerFunction() === 'handleInputCabangOnEdit';
  });

  if (!exists) {
    ScriptApp.newTrigger('handleInputCabangOnEdit')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
}



function refreshInputCabangDropdowns_(sh, inputRows) {
  inputRows = inputRows || Math.max(500, sh.getMaxRows() - 1);

  // Hapus semua validation lama di area input baru A:M.
  // Ini penting karena sebelumnya dropdown ada di kolom lama sebelum Tanggal Input ditambahkan.
  sh.getRange(2, 1, inputRows, 13).clearDataValidations();

  // Format tanggal input otomatis di kolom A.
  sh.getRange(2, 1, inputRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  // Struktur baru:
  // A Tanggal Input
  // B Nama Pelanggan
  // C No HP
  // D Wilayah/Kecamatan
  // E No Pelanggan
  // F Jenis Gangguan
  // G Prioritas
  // H Keterangan Aduan
  // I Unit/Petugas
  // J:M Kolom sistem
  var wilayahRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.WILAYAH, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 4, inputRows, 1).setDataValidation(wilayahRule);

  var jenisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.JENIS_GANGGUAN, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 6, inputRows, 1).setDataValidation(jenisRule);

  var priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.PRIORITAS, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 7, inputRows, 1).setDataValidation(priorityRule);

  var unitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.UNIT, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, 9, inputRows, 1).setDataValidation(unitRule);
}


function refreshAllInputCabangDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;

    refreshInputCabangDropdowns_(sh);
    protectInputCabangSystemColumns_(sh);
    total++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ Dropdown Input Cabang Diperbaiki',
    'Dropdown sudah dibersihkan dari posisi lama dan dipasang ulang ke posisi kolom baru pada ' + total + ' sheet input cabang.\n\n' +
    'Posisi baru:\n' +
    '- Wilayah/Kecamatan: kolom D\n' +
    '- Jenis Gangguan: kolom F\n' +
    '- Prioritas: kolom G\n' +
    '- Unit/Petugas: kolom I',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function migrateAllInputCabangTanggalColumns() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Geser Data Lama Input Cabang',
    'Fitur ini akan mengecek semua sheet INPUT cabang.\n\n' +
    'Jika ada data lama yang masih mulai dari kolom A = Nama Pelanggan, sistem akan menggesernya ke kanan sehingga:\n\n' +
    'A = Tanggal Input\n' +
    'B = Nama Pelanggan\n' +
    'C = No HP\n' +
    'dst.\n\n' +
    'Data yang sudah format baru tidak akan digeser lagi.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;
  var details = [];

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;

    var count = migrateExistingCabangInputRows_(sh);
    refreshInputCabangDropdowns_(sh);
    protectInputCabangSystemColumns_(sh);

    total += count;
    details.push(item.sheet + ': ' + count + ' baris digeser');
  });

  ui.alert(
    '✅ Migrasi Selesai',
    'Total baris yang digeser: ' + total + '\n\n' + details.join('\n'),
    ui.ButtonSet.OK
  );
}

function migrateExistingCabangInputRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return 0;

  var lastRow = sh.getLastRow();
  var maxCols = Math.max(13, sh.getLastColumn());

  // Baca sampai 13 kolom agar format lama A:L bisa digeser ke B:M.
  var data = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  var rowsToUpdate = [];
  var migrated = 0;

  data.forEach(function(row, idx) {
    var rowNumber = idx + 2;

    var colA = row[0]; // format baru = Tanggal Input, format lama = Nama Pelanggan
    var colB = row[1]; // format baru = Nama Pelanggan, format lama = No HP
    var colC = row[2]; // format baru = No HP, format lama = Wilayah

    var aText = String(colA || '').trim();
    var bText = String(colB || '').trim();
    var cText = String(colC || '').trim();

    // Baris kosong tidak perlu diproses.
    var hasAnyValue = row.some(function(v) {
      return String(v || '').trim() !== '';
    });
    if (!hasAnyValue) return;

    // Kalau kolom A sudah tanggal, berarti sudah format baru.
    if (isValidDateValue_(colA)) return;

    // Kalau A kosong dan B berisi nama, kemungkinan sudah format baru tapi tanggal belum muncul.
    // Jangan digeser.
    if (!aText && bText) return;

    // Deteksi format lama:
    // A berisi Nama Pelanggan, B berisi No HP / data lain, C biasanya Wilayah.
    // Format lama harus digeser ke kanan.
    var looksOldFormat = !!aText && !isValidDateValue_(colA);

    if (!looksOldFormat) return;

    var newRow = [
      '',      // A Tanggal Input dikosongkan dulu; nanti otomatis saat edit atau dibuat saat sinkron
      row[0],  // B Nama Pelanggan
      row[1],  // C No HP
      row[2],  // D Wilayah/Kecamatan
      row[3],  // E No Pelanggan
      row[4],  // F Jenis Gangguan
      row[5],  // G Prioritas
      row[6],  // H Keterangan Aduan
      row[7],  // I Unit/Petugas
      row[8],  // J Sync Status
      row[9],  // K ID Aduan
      row[10], // L Waktu Sync
      row[11]  // M Catatan Sistem
    ];

    rowsToUpdate.push({
      rowNumber: rowNumber,
      values: newRow
    });

    migrated++;
  });

  rowsToUpdate.forEach(function(item) {
    sh.getRange(item.rowNumber, 1, 1, 13).setValues([item.values]);
  });

  return migrated;
}

function isValidDateValue_(value) {
  if (!value) return false;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return true;

  // Hindari menganggap nama pelanggan sebagai tanggal.
  // Hanya parse jika bentuknya jelas seperti tanggal.
  var text = String(value || '').trim();
  if (!/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text) && !/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text)) {
    return false;
  }

  var parsed = new Date(text);
  return !isNaN(parsed);
}

function setupInputCabangLogSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.INPUT_LOG_SHEET);

  var headers = [
    'Waktu Sync',
    'Cabang',
    'Sheet Input',
    'Baris Input',
    'ID Aduan',
    'Nama Pelanggan',
    'Jenis Gangguan',
    'Status'
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function openInputCabangLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.INPUT_LOG_SHEET));
}

function bersihkanBarisKosong() {
  var ui = SpreadsheetApp.getUi();
  try {
    var removed = removeEmptyRowsAduan();
    ui.alert('✅ Selesai', 'Baris kosong yang dihapus: ' + removed + '\nNilai default di baris tanpa data juga sudah dibersihkan.', ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('❌ Gagal: ' + e.message);
  }
}

// ============================================================
// BERSIHKAN BARIS KOSONG DI SHEET ADUAN
// ============================================================
function removeEmptyRowsAduan() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var lastRow = sheet.getLastRow();
  // Baca kolom ID (A), Cabang (C), Wilayah (D), Nama (F) sekaligus
  var data    = sheet.getRange(2, 1, lastRow - 1, CONFIG.COL.NAMA_PELANGGAN).getValues();
  var removed = 0;

  // Hapus dari bawah ke atas agar nomor baris tidak bergeser
  for (var i = data.length - 1; i >= 0; i--) {
    var idVal     = String(data[i][CONFIG.COL.ID - 1]             || '').trim();
    var cabangVal = String(data[i][CONFIG.COL.CABANG - 1]         || '').trim();
    var wilayah   = String(data[i][CONFIG.COL.WILAYAH - 1]        || '').trim();
    var nama      = String(data[i][CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();

    // Baris dianggap kosong jika tidak ada ID DAN tidak ada data konten utama
    if (!idVal && !cabangVal && !wilayah && !nama) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }

  // Bersihkan nilai Prioritas/Status yang terlanjur terisi di baris kosong
  // (bisa terjadi karena onEdit lama sebelum fix)
  cleanOrphanDefaultValues_();

  return removed;
}

// Bersihkan Prioritas/Status/SLA di baris yang tidak punya ID & data utama
function cleanOrphanDefaultValues_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var idVal     = String(data[i][CONFIG.COL.ID - 1]             || '').trim();
    var cabangVal = String(data[i][CONFIG.COL.CABANG - 1]         || '').trim();
    var wilayah   = String(data[i][CONFIG.COL.WILAYAH - 1]        || '').trim();
    var nama      = String(data[i][CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();
    var jenis     = String(data[i][CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim();

    var isOrphan  = !idVal && !cabangVal && !wilayah && !nama && !jenis;

    if (isOrphan) {
      var sheetRow = i + 2;
      // Bersihkan nilai default yang tidak seharusnya ada
      sheet.getRange(sheetRow, CONFIG.COL.PRIORITAS,  1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.STATUS,      1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.SLA_JAM,     1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.UPDATED_AT,  1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.WAKTU_MASUK, 1, 1).clearContent();
      // Reset warna baris
      sheet.getRange(sheetRow, 1, 1, 16).setBackground(null);
    }
  }
}

function syncAllCabangInputs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Sinkron Manual Sheet Cabang ke ADUAN',
    'Sistem akan membaca baris manual baru di semua sheet CABANG_*.\n\n' +
    'Baris yang ID Aduan-nya masih kosong akan dibuatkan ID dan masuk ke ADUAN jika minimal data ini sudah lengkap:\n' +
    '- Nama Pelanggan atau No Pelanggan\n' +
    '- Jenis Gangguan\n\n' +
    'Lanjutkan sinkron?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);
    var result = syncAllCabangInputs_();

    ui.alert(
      '✅ Sinkron Selesai',
      'Total data manual baru masuk ke ADUAN: ' + result.totalSynced + '\n\nDetail:\n' + result.detailLines.join('\n'),
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('❌ Sinkron gagal: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}



function syncAllCabangInputs_() {
  // V10.9.40:
  // Nama fungsi lama dipertahankan agar trigger lama tidak rusak,
  // tapi sumber datanya sekarang adalah sheet CABANG_*, bukan INPUT_*.
  return syncManualRowsFromAllCabangMirrors_();
}



function syncOneCabangInput_(inputSheet, item, aduanSheet, logSheet, syncedKeyMap, existingAduanMap) {
  var lastRow = inputSheet.getLastRow();
  if (lastRow < 2) return 0;

  syncedKeyMap      = syncedKeyMap      || {};
  existingAduanMap  = existingAduanMap  || {};

  var values = inputSheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var now = new Date();
  var syncedCount = 0;

  // V10.9.56:
  // Legacy INPUT_* juga memakai ID acak cabang agar tidak ada jalur yang masih membuat ID berurutan.
  values.forEach(function(row, idx) {
    var sheetRow  = idx + 2;
    var sourceKey = item.sheet + '#' + sheetRow;
    var propKey   = makeInputSourcePropertyKey_(sourceKey);

    var tanggalInputRaw = row[0];
    var namaPelanggan = String(row[1] || '').trim();
    var noHp          = String(row[2] || '').trim();
    var wilayah       = String(row[3] || '').trim();
    var desa          = String(row[4] || '').trim();
    var jenis         = normalizeInputJenisGangguan_(row[5]);
    var prioritas     = normalizeInputPrioritas_(row[6]);
    var keterangan    = String(row[7] || '').trim();
    var unitPetugas   = normalizeInputUnit_(row[8]);
    var syncStatus    = String(row[9] || '').trim();
    var existingId    = String(row[10] || '').trim();

    // ── FIX BUG #2: tanggalInput dipakai konsisten untuk ID, fingerprint,
    //    dan Waktu Masuk di ADUAN. Fallback ke now hanya jika benar-benar kosong.
    var tanggalInput = asDateForArchive_(tanggalInputRaw) || now;

    // ── Skip baris kosong ──────────────────────────────────
    if (!namaPelanggan && !noHp && !wilayah && !jenis && !keterangan) return;

    // ── LAP ANTI DUPLIKAT 1: kolom sheet input ─────────────
    if (syncStatus === 'Terkirim' || existingId) {
      return;
    }

    // ── LAP ANTI DUPLIKAT 2: LOG_INPUT_CABANG ─────────────
    if (syncedKeyMap[sourceKey]) {
      var logId = syncedKeyMap[sourceKey].id || '';
      if (logId) {
        // Kolom input belum ditandai, perbaiki sekarang
        markInputRowSynced_(inputSheet, sheetRow, logId, now, 'Diperbaiki dari LOG_INPUT_CABANG.');
      }
      return;
    }

    // ── LAP ANTI DUPLIKAT 3: Document Properties ──────────
    var propVal = getInputSourceProperty_(propKey);
    if (propVal) {
      // Properties sudah ada tapi sheet belum ditandai
      markInputRowSynced_(inputSheet, sheetRow, propVal, now, 'Diperbaiki dari Document Properties.');
      return;
    }

    // ── LAP ANTI DUPLIKAT 4: Fingerprint di ADUAN ─────────
    var payload = {
      namaPelanggan: namaPelanggan,
      noHp: noHp,
      wilayah: wilayah,
      desa: desa,
      jenis: jenis,
      prioritas: prioritas,
      unitPetugas: unitPetugas,
      keterangan: keterangan
    };
    var fingerprint = buildInputAduanFingerprint_(item.cabang, tanggalInput, payload);
    if (existingAduanMap[fingerprint]) {
      var dupId = existingAduanMap[fingerprint].id || '';
      markInputRowSynced_(inputSheet, sheetRow, dupId, now, 'Data identik sudah ada di ADUAN.');
      return;
    }

    // ── Validasi minimal ───────────────────────────────────
    if (!namaPelanggan || !wilayah || !jenis) {
      // FIX BUG #3: was kolom 9 (Unit/Petugas) → harus kolom 10 (Sync Status)
      inputSheet.getRange(sheetRow, 10, 1, 4).setValues([[
        'Gagal', '', now, 'Nama pelanggan, wilayah, dan jenis gangguan wajib diisi.'
      ]]);
      inputSheet.getRange(sheetRow, 1, 1, 13).setBackground('#fef2f2');
      return;
    }

    // ── Generate ID ────────────────────────────────────────
    // V10.9.237: ID memakai format acak cabang 4 karakter, contoh PRY7K2A.
    // Tanggal aduan tetap disimpan di kolom Waktu Masuk, bukan di ID publik.
    var idAduan = generateCabangAduanId_(item.code, tanggalInput, aduanSheet);
    var slaJam = getSlaJamForPrioritas_(prioritas);

    // ── KUNCI: Simpan ke Document Properties DULU ─────────
    // Ini mencegah duplikat jika trigger berikutnya datang sebelum
    // penulisan ke sheet selesai
    setInputSourceProperty_(propKey, idAduan);

    // ── Tulis ke ADUAN ─────────────────────────────────────
    // FIX BUG #2: Waktu Masuk pakai tanggalInput (waktu aduan asli dari cabang)
    aduanSheet.appendRow([
      idAduan,
      tanggalInput,   // ← FIX: was 'now', sekarang pakai tanggal asli input cabang
      item.cabang,
      wilayah,
      desa,
      namaPelanggan,
      noHp,
      jenis,
      prioritas,
      'Baru',
      unitPetugas,
      keterangan,
      '',
      '',
      slaJam,
      now
    ]);

    // ── Update existingAduanMap agar batch berikutnya sadar
    existingAduanMap[fingerprint] = { id: idAduan };

    // ── Tandai baris input sebagai Terkirim ────────────────
    markInputRowSynced_(inputSheet, sheetRow, idAduan, now, 'Masuk ke ADUAN pusat.');

    // ── Tulis ke LOG_INPUT_CABANG ──────────────────────────
    appendInputCabangLog_(
      logSheet, now, item.cabang, item.sheet, sheetRow,
      idAduan, namaPelanggan, jenis, 'Terkirim'
    );

    // ── Update syncedKeyMap in-memory ──────────────────────
    syncedKeyMap[sourceKey] = { id: idAduan };

    syncedCount++;
  });

  return syncedCount;
}



function markInputRowSynced_(inputSheet, rowNumber, idAduan, time, note) {
  inputSheet.getRange(rowNumber, 10, 1, 4).setValues([[
    'Terkirim',
    idAduan,
    time,
    note || 'Masuk ke ADUAN pusat.'
  ]]);
  inputSheet.getRange(rowNumber, 1, 1, 13).setBackground('#ecfdf5');
}

function markInputRowFailed_(inputSheet, rowNumber, time, note) {
  inputSheet.getRange(rowNumber, 10, 1, 4).setValues([[
    'Gagal',
    '',
    time,
    note || 'Data belum lengkap.'
  ]]);
  inputSheet.getRange(rowNumber, 1, 1, 13).setBackground('#fef2f2');
}

function appendInputCabangLog_(logSheet, time, cabang, sheetName, rowNumber, idAduan, namaPelanggan, jenis, status) {
  logSheet.appendRow([
    time,
    cabang,
    sheetName,
    rowNumber,
    idAduan,
    namaPelanggan,
    jenis,
    status || 'Terkirim'
  ]);
}

function makeInputSourcePropertyKey_(sourceKey) {
  return 'SIAGA_SYNCED_' + Utilities.base64EncodeWebSafe(sourceKey).replace(/=+$/g, '');
}

function getInputSourceProperty_(propertyKey) {
  try {
    return PropertiesService.getDocumentProperties().getProperty(propertyKey) || '';
  } catch (e) {
    return '';
  }
}

function setInputSourceProperty_(propertyKey, idAduan) {
  try {
    PropertiesService.getDocumentProperties().setProperty(propertyKey, idAduan);
  } catch (e) {}
}

function buildInputAduanFingerprint_(cabang, dateObj, payload) {
  var datePart = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
  return [
    datePart,
    normalizeTextForKey_(cabang),
    normalizeTextForKey_(payload.namaPelanggan),
    normalizeTextForKey_(payload.noHp),
    normalizeTextForKey_(payload.wilayah),
    normalizeTextForKey_(payload.desa),
    normalizeTextForKey_(payload.jenis),
    normalizeTextForKey_(payload.prioritas),
    normalizeTextForKey_(payload.unitPetugas),
    normalizeTextForKey_(payload.keterangan)
  ].join('|');
}

function normalizeTextForKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getExistingAduanFingerprintMap_(aduanSheet) {
  var map = {};
  if (!aduanSheet || aduanSheet.getLastRow() < 2) return map;

  var values = aduanSheet.getRange(2, 1, aduanSheet.getLastRow() - 1, 16).getValues();

  values.forEach(function(row) {
    var idAduan = String(row[CONFIG.COL.ID - 1] || '').trim();
    var waktuMasuk = row[CONFIG.COL.WAKTU_MASUK - 1];
    var cabang = row[CONFIG.COL.CABANG - 1];

    if (!idAduan || !waktuMasuk) return;

    var dateObj = asDateForArchive_(waktuMasuk) || new Date(waktuMasuk);
    if (!dateObj || isNaN(dateObj)) return;

    var fingerprint = buildInputAduanFingerprint_(cabang, dateObj, {
      namaPelanggan: row[CONFIG.COL.NAMA_PELANGGAN - 1],
      noHp: row[CONFIG.COL.NO_HP - 1],
      wilayah: row[CONFIG.COL.WILAYAH - 1],
      desa: row[CONFIG.COL.DESA - 1],
      jenis: row[CONFIG.COL.JENIS_GANGGUAN - 1],
      prioritas: row[CONFIG.COL.PRIORITAS - 1],
      unitPetugas: row[CONFIG.COL.UNIT - 1],
      keterangan: row[CONFIG.COL.KETERANGAN - 1]
    });

    if (!map[fingerprint]) {
      map[fingerprint] = { id: idAduan };
    }
  });

  return map;
}

function repairInputCabangSyncMarks() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Perbaiki Penanda Input Cabang',
    'Fitur ini akan mengecek LOG_INPUT_CABANG dan ADUAN, lalu memperbaiki kolom Sync Status/ID Aduan pada sheet INPUT cabang.\n\n' +
    'Gunakan ini jika data sudah masuk ke ADUAN tetapi di sheet cabang belum tertulis Terkirim.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  if (!aduanSheet || !logSheet) {
    ui.alert('Sheet ADUAN atau LOG_INPUT_CABANG belum tersedia.');
    return;
  }

  var syncedKeyMap = getSyncedInputKeyMap_(logSheet);
  var fixed = 0;

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var inputSheet = ss.getSheetByName(item.sheet);
    if (!inputSheet) return;

    var lastRow = inputSheet.getLastRow();
    if (lastRow < 2) return;

    for (var r = 2; r <= lastRow; r++) {
      var sourceKey = item.sheet + '#' + r;
      var data = syncedKeyMap[sourceKey];

      if (data && data.id) {
        var existingId = String(inputSheet.getRange(r, 11).getValue() || '').trim();
        var existingStatus = String(inputSheet.getRange(r, 10).getValue() || '').trim();

        if (!existingId || existingStatus !== 'Terkirim') {
          markInputRowSynced_(inputSheet, r, data.id, new Date(), 'Penanda diperbaiki dari LOG_INPUT_CABANG.');
          fixed++;
        }
      }
    }
  });

  ui.alert('✅ Perbaikan selesai. Jumlah baris diperbaiki: ' + fixed);
}


function getSyncedInputKeyMap_(logSheet) {
  var map = {};
  if (!logSheet || logSheet.getLastRow() < 2) return map;

  var values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();

  values.forEach(function(row) {
    var sheetName = String(row[2] || '').trim();
    var rowNumber = String(row[3] || '').trim();
    var idAduan = String(row[4] || '').trim();
    var status = String(row[7] || '').trim();

    if (!sheetName || !rowNumber || !idAduan) return;
    if (status !== 'Terkirim') return;

    map[sheetName + '#' + rowNumber] = { id: idAduan };
  });

  return map;
}

function getNextCabangAduanNumber_(cabangCode, dateObj, aduanSheet) {
  var datePart = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = cabangCode + '-' + datePart + '-';
  var propKey = 'SEQ_' + cabangCode + '_' + datePart;
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    var cached = Number(props.getProperty(propKey) || 0);
    if (cached > 0) {
      var nextCached = cached + 1;
      props.setProperty(propKey, String(nextCached));
      return nextCached;
    }

    var lastRow = aduanSheet.getLastRow();
    var maxNumber = 0;

    if (lastRow >= 2) {
      var ids = aduanSheet.getRange(2, 1, lastRow - 1, 1).getValues();

      ids.forEach(function(row) {
        var id = String(row[0] || '');
        if (id.indexOf(prefix) === 0) {
          var num = Number(id.substring(prefix.length));
          if (!isNaN(num) && num > maxNumber) maxNumber = num;
        }
      });
    }

    var nextNumber = maxNumber + 1;
    props.setProperty(propKey, String(nextNumber));
    return nextNumber;

  } catch (err) {
    // Fallback lama jika lock/cache bermasalah.
    var fallbackLastRow = aduanSheet.getLastRow();
    var fallbackMax = 0;

    if (fallbackLastRow >= 2) {
      var fallbackIds = aduanSheet.getRange(2, 1, fallbackLastRow - 1, 1).getValues();
      fallbackIds.forEach(function(row) {
        var id = String(row[0] || '');
        if (id.indexOf(prefix) === 0) {
          var num = Number(id.substring(prefix.length));
          if (!isNaN(num) && num > fallbackMax) fallbackMax = num;
        }
      });
    }

    return fallbackMax + 1;

  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function normalizeCabangCodeForId_(cabangCode) {
  cabangCode = String(cabangCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // V10.9.267: kode ID aduan baru.
  // Praya Barat Daya: PBD, Batukliang Utara: BKU.
  // Kode lama tetap diterima sebagai input agar kompatibel dengan data lama,
  // tetapi pembuatan ID baru selalu diarahkan ke kode baru.
  if (cabangCode === 'PRBD') cabangCode = 'PBD';
  if (cabangCode === 'BTU') cabangCode = 'BKU';

  var allowed = ['PRY', 'PTE', 'PRB', 'PBD', 'PRT', 'PJT', 'JGT', 'KPG', 'JNP', 'BTK', 'BKU', 'PGR', 'LNY', 'ADU'];
  return allowed.indexOf(cabangCode) !== -1 ? cabangCode : 'LNY';
}

function generateRandomTicketSuffix_(length) {
  // V10.9.237: default 4 karakter acak agar ID aduan lebih pendek.
  // Contoh: PRY7K2A, KPG4N8M.
  length = Number(length || 4);
  if (length < 4) length = 4;

  // Hindari karakter yang sering salah baca:
  // 0/O dan 1/I tidak dipakai.
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var suffix = '';

  // Campur beberapa sumber agar tidak terasa berurutan.
  var seed = String(Utilities.getUuid ? Utilities.getUuid() : '') + String(new Date().getTime()) + String(Math.random());

  for (var i = 0; i < length; i++) {
    var index;
    if (seed && seed.length > i) {
      index = (seed.charCodeAt(i % seed.length) + Math.floor(Math.random() * chars.length) + i) % chars.length;
    } else {
      index = Math.floor(Math.random() * chars.length);
    }
    suffix += chars.charAt(index);
  }

  return suffix;
}

function aduanIdExists_(aduanSheet, id) {
  id = normalizeAduanIdHyphen_(id || '');
  if (!id || !aduanSheet) return false;

  var lastRow = safeGetLastRow_(aduanSheet);
  if (lastRow < 2) return false;

  try {
    var found = aduanSheet
      .getRange(2, CONFIG.COL.ID, lastRow - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();

    if (found) return true;

    // ID baru tampil tanpa strip, tetapi data lama mungkin masih pakai strip.
    // Jadi cek ulang dengan normalizeId_ agar PRYABC123 dan PRY-ABC123 dianggap sama.
    var valuesNorm = aduanSheet.getRange(2, CONFIG.COL.ID, lastRow - 1, 1).getValues();
    var keyNorm = normalizeId_(id);
    for (var n = 0; n < valuesNorm.length; n++) {
      if (normalizeId_(valuesNorm[n][0]) === keyNorm) return true;
    }
    return false;
  } catch(e) {
    // Fallback jika TextFinder bermasalah.
    var values = aduanSheet.getRange(2, CONFIG.COL.ID, lastRow - 1, 1).getValues();
    var key = normalizeId_(id);
    for (var i = 0; i < values.length; i++) {
      if (normalizeId_(values[i][0]) === key) return true;
    }
    return false;
  }
}

function buildCabangAduanId_(cabangCode, dateObj, number) {
  cabangCode = normalizeCabangCodeForId_(cabangCode);

  // Kompatibilitas legacy: kalau fungsi lama masih dipanggil dengan nomor urut,
  // format lama tetap bisa dibuat. Operasional baru memakai generateCabangAduanId_().
  if (typeof number !== 'undefined' && number !== null && String(number) !== '') {
    var datePart = Utilities.formatDate(dateObj || new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    return cabangCode + '-' + datePart + '-' + ('0000' + number).slice(-4);
  }

  return cabangCode + generateRandomTicketSuffix_(4);
}

function generateCabangAduanId_(cabangCode, dateObj, aduanSheet) {
  cabangCode = normalizeCabangCodeForId_(cabangCode);
  aduanSheet = aduanSheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);

  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    // Coba 30 kali dengan 4 karakter.
    // Kombinasi per cabang ±1 juta jika memakai 32 karakter aman.
    for (var i = 0; i < 30; i++) {
      var id = cabangCode + generateRandomTicketSuffix_(4);
      if (!aduanIdExists_(aduanSheet, id)) return id;
    }

    // Fallback sangat jarang: tambah 1 karakter kalau kebetulan bentrok terus.
    for (var j = 0; j < 20; j++) {
      var longerId = cabangCode + generateRandomTicketSuffix_(5);
      if (!aduanIdExists_(aduanSheet, longerId)) return longerId;
    }

    throw new Error('Gagal membuat ID acak unik. Coba ulangi beberapa saat lagi.');

  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}
function normalizeInputPrioritas_(value) {
  var v = String(value || '').trim();
  if (CONFIG.SLA[v]) return v;

  var lower = v.toLowerCase();
  if (lower === 'urgent' || lower === 'darurat') return 'Darurat';
  if (lower === 'tinggi') return 'Tinggi';
  if (lower === 'rendah') return 'Rendah';
  return 'Sedang';
}

function normalizeInputJenisGangguan_(value) {
  var v = String(value || '').trim();
  if (!v) return '';

  var exact = CONFIG.JENIS_GANGGUAN.indexOf(v);
  if (exact !== -1) return v;

  var lower = v.toLowerCase();

  if (lower.indexOf('mati') !== -1 || lower.indexOf('tidak ada air') !== -1) return 'Air Mati';
  if (lower.indexOf('tekan') !== -1 || lower.indexOf('kecil') !== -1) return 'Tekanan Rendah';
  if (lower.indexOf('keruh') !== -1 || lower.indexOf('kotor') !== -1) return 'Air Keruh';
  if (lower.indexOf('bocor') !== -1 || lower.indexOf('pipa') !== -1) return 'Pipa Bocor';
  if (lower.indexOf('meter') !== -1) return 'Meter Bermasalah';
  if (lower.indexOf('tagihan') !== -1 || lower.indexOf('rekening') !== -1) return 'Tagihan';
  if (lower.indexOf('sambungan') !== -1 || lower.indexOf('pasang') !== -1) return 'Sambungan Baru';

  return 'Lainnya';
}

function normalizeInputUnit_(value) {
  var v = String(value || '').trim();
  if (!v) return '';

  if (CONFIG.UNIT.indexOf(v) !== -1) return v;

  var lower = v.toLowerCase();
  if (lower.indexOf('teknik') !== -1) return 'Teknik';
  if (lower.indexOf('hublang') !== -1 || lower.indexOf('hub') !== -1) return 'Hublang';
  if (lower.indexOf('distribusi') !== -1) return 'Distribusi';
  if (lower.indexOf('produksi') !== -1) return 'Produksi';
  if (lower.indexOf('it') !== -1) return 'IT';
  if (lower.indexOf('cabang') !== -1) return 'Cabang';

  return v;
}


function getAutoSyncCabangIntervalMinutes_() {
  var minutes = Number(CONFIG.SYNC_INPUT_INTERVAL_MINUTES || 5);

  // Apps Script time trigger paling aman memakai pilihan ini.
  // Jika diisi angka lain, sistem cari pilihan terdekat ke atas.
  var allowed = [1, 5, 10, 15, 30];

  if (allowed.indexOf(minutes) !== -1) return minutes;

  for (var i = 0; i < allowed.length; i++) {
    if (minutes <= allowed[i]) return allowed[i];
  }

  return 30;
}

function enableAutoSyncCabang1Minute() {
  var ui = SpreadsheetApp.getUi();
  var minutes = getAutoSyncCabangIntervalMinutes_();

  var confirm = ui.alert(
    'Aktifkan Sinkron Otomatis Sheet Cabang ' + minutes + ' Menit',
    'Sistem akan otomatis mengecek semua sheet CABANG_* setiap ' + minutes + ' menit.\n\n' +
    'Jika ada baris manual baru yang sudah lengkap dan ID Aduan masih kosong, data akan otomatis masuk ke sheet ADUAN pusat.\n\n' +
    'Interval bisa diganti dari CONFIG:\n' +
    'SYNC_INPUT_INTERVAL_MINUTES: ' + minutes + ',\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  disableAutoSyncCabangTriggers_();

  ScriptApp.newTrigger('autoSyncCabangInputsEveryMinute')
    .timeBased()
    .everyMinutes(minutes)
    .create();

  ui.alert(
    '✅ Sinkron Otomatis Aktif',
    'Sheet CABANG_* akan otomatis dicek setiap ' + minutes + ' menit.\n\n' +
    'Untuk mengganti jeda sync, ubah CONFIG SYNC_INPUT_INTERVAL_MINUTES lalu aktifkan ulang sinkron otomatis.',
    ui.ButtonSet.OK
  );
}



function disableAutoSyncCabangTriggers() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Matikan Sinkron Otomatis',
    'Sinkron otomatis input cabang akan dimatikan.\n\n' +
    'Setelah dimatikan, data cabang hanya masuk ke ADUAN jika admin menjalankan menu Sinkron Input Cabang ke ADUAN secara manual.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var removed = disableAutoSyncCabangTriggers_();

  ui.alert(
    '✅ Sinkron Otomatis Dimatikan',
    'Jumlah trigger yang dihapus: ' + removed,
    ui.ButtonSet.OK
  );
}

function disableAutoSyncCabangTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === 'autoSyncCabangInputsEveryMinute') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  return removed;
}

function autoSyncCabangInputsEveryMinute() {
  // Gunakan ScriptLock agar hanya 1 instance berjalan di semua user sekaligus
  var lock = LockService.getScriptLock();

  try {
    // Jika ada proses lain yang sedang berjalan, lewati saja cycle ini
    if (!lock.tryLock(10000)) {
      Logger.log('autoSync: skip - ada proses lain sedang berjalan.');
      return;
    }

    var result = syncAllCabangInputs_();

    if (result && result.totalSynced > 0) {
      writeAutoSyncLog_(result);
    }
  } catch (e) {
    writeAutoSyncErrorLog_(e);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function writeAutoSyncLog_(result) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  sh.appendRow([
    new Date(),
    'AUTO_SYNC',
    'TRIGGER_1_MENIT',
    '-',
    '-',
    '-',
    'Total data masuk: ' + result.totalSynced,
    'AUTO'
  ]);
}

function writeAutoSyncErrorLog_(error) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  sh.appendRow([
    new Date(),
    'AUTO_SYNC_ERROR',
    'TRIGGER_1_MENIT',
    '-',
    '-',
    '-',
    error && error.message ? error.message : String(error),
    'ERROR'
  ]);
}

