// ============================================================
// SIAGA TIARA V11 - BACKUP PERFORMA
// Salin ke PostgreSQL + Spreadsheet arsip terpisah, lalu hapus
// hanya data lama yang aman dari spreadsheet operasional.
// ============================================================

var SIAGA_BACKUP_FILE_ID_PROP_ = 'SIAGA_BACKUP_SPREADSHEET_ID';
// Batch kecil menjaga payload di bawah JSON_LIMIT API dan durasi Apps Script.
var SIAGA_BACKUP_MAX_PER_RUN_ = 120;
var SIAGA_BACKUP_FINAL_STATUSES_ = {
  'selesai': true, 'batal': true, 'dibatalkan': true, 'cancelled': true, 'closed': true
};

function siagaBackupNormalizeMonth_(value) {
  var text = String(value || '').trim();
  if (text === 'ALL') return text;
  if (!/^\d{4}-\d{2}$/.test(text)) throw new Error('Pilih bulan dengan format YYYY-MM.');
  var parts = text.split('-');
  var month = Number(parts[1]);
  if (month < 1 || month > 12) throw new Error('Bulan tidak valid.');
  var current = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  // V11.0.4:
  // Sebelumnya bulan berjalan SELALU diblokir ('>= current' throw error), padahal admin
  // kadang perlu langsung membackup bulan ini (misalnya banyak aduan sudah Selesai bulan
  // ini dan ingin diringankan tanpa menunggu pergantian bulan). Yang benar-benar tidak
  // boleh dibackup hanyalah bulan yang belum tiba (masa depan) - itu jelas tidak masuk akal.
  // Data yang ikut terbawa tetap aman karena siagaBackupCollect_ hanya mengambil log
  // WhatsApp (riwayat, sudah final) dan aduan berstatus FINAL (Selesai/Batal/dst) - aduan
  // yang masih aktif/berjalan tidak pernah ikut terbawa, baik bulan lalu maupun bulan ini.
  if (text > current) throw new Error('Bulan yang dipilih belum tiba, tidak bisa dibackup.');
  return text;
}

function siagaBackupDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (value === null || value === undefined || value === '') return null;
  var parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  var match = String(value).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
}

function siagaBackupMonth_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function siagaBackupHeaderMap_(headers) {
  var map = {};
  (headers || []).forEach(function(header, index) {
    map[String(header || '').trim().toLowerCase()] = index;
  });
  return map;
}

function siagaBackupValueByHeaders_(row, map, names) {
  for (var i = 0; i < names.length; i++) {
    var index = map[String(names[i]).toLowerCase()];
    if (index !== undefined) return row[index];
  }
  return '';
}

function siagaBackupRecordKey_(source, naturalKey, row) {
  var raw = source + '|' + String(naturalKey || '') + '|' + JSON.stringify(row || []);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function siagaBackupCollect_(month, limit) {
  month = siagaBackupNormalizeMonth_(month);
  limit = Math.max(1, Math.min(Number(limit || SIAGA_BACKUP_MAX_PER_RUN_), SIAGA_BACKUP_MAX_PER_RUN_));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  var items = [];

  function selected_(recordMonth) {
    if (!recordMonth) return false;
    // V11.0.4:
    // - "ALL" (Semua bulan lama) tetap seperti semula: cuma bulan SEBELUM bulan berjalan,
    //   sesuai keterangan di UI ("Semua bulan = seluruh bulan sebelum bulan berjalan").
    // - Pilihan bulan SPESIFIK sekarang boleh sama dengan bulan berjalan (lihat
    //   siagaBackupNormalizeMonth_) - jadi di sini cukup dicocokkan persis, tanpa
    //   batasan "harus sebelum bulan berjalan" lagi.
    if (month === 'ALL') return recordMonth < currentMonth;
    return recordMonth === month;
  }

  function collectSheet_(sheetName, type, subLimit) {
    var collected = 0;
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return collected;
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(function(v) { return String(v || '').trim(); });
    var map = siagaBackupHeaderMap_(headers);
    for (var r = 1; r < values.length && collected < subLimit; r++) {
      var row = values[r];
      var dateValue = type === 'whatsapp'
        ? siagaBackupValueByHeaders_(row, map, ['Timestamp'])
        : siagaBackupValueByHeaders_(row, map, ['Waktu Masuk', 'Timestamp', 'Tanggal']);
      var date = siagaBackupDate_(dateValue);
      if (!date || !selected_(siagaBackupMonth_(date))) continue;

      var idAduan = String(siagaBackupValueByHeaders_(row, map, ['ID Aduan', 'ID']) || '').trim();
      if (type === 'aduan') {
        var status = String(siagaBackupValueByHeaders_(row, map, ['Status']) || '').trim().toLowerCase();
        if (!SIAGA_BACKUP_FINAL_STATUSES_[status]) continue;
      }
      var phone = String(siagaBackupValueByHeaders_(row, map, ['No HP', 'Nomor HP', 'No. HP']) || '').trim();
      var naturalKey = type === 'aduan' && idAduan ? idAduan : '';
      var key = siagaBackupRecordKey_(sheetName, naturalKey, row);
      var payload = {};
      headers.forEach(function(header, c) {
        if (!header) return;
        var value = row[c];
        payload[header] = value instanceof Date ? value.toISOString() : value;
      });
      items.push({
        sourceSheet: sheetName,
        sourceRow: r + 1,
        sourceRecordKey: key,
        recordType: type,
        recordMonth: siagaBackupMonth_(date),
        recordTimestamp: date.toISOString(),
        aduanId: idAduan,
        phone: phone,
        summary: type === 'aduan'
          ? String(siagaBackupValueByHeaders_(row, map, ['Keterangan Aduan', 'Jenis Gangguan']) || '')
          : String(siagaBackupValueByHeaders_(row, map, ['Pesan Masuk', 'Balasan', 'Jenis']) || ''),
        payload: payload
      });
      collected++;
    }
    return collected;
  }

  // V11.0.6 FIX:
  // Sebelumnya LOG_WHATSAPP SELALU diproses lebih dulu dan boleh memakai SELURUH jatah
  // limit (120 baris) satu batch. Untuk bulan yang log chat-nya jauh lebih banyak
  // daripada aduan berstatus final (kasus umum: bulan berjalan yang aktif dipakai
  // pelanggan chat, tapi aduan Selesai cuma sedikit), ADUAN tidak pernah kebagian jatah
  // sampai SEMUA log bulan itu habis dulu - bisa puluhan-ratusan batch. Kalau prosesnya
  // berhenti sebelum log habis (lihat catatan di Index.html soal tab harus tetap
  // terbuka), aduan yang sudah Selesai jadi kelihatan "tidak pernah kebackup" walau
  // sebenarnya baru belum kebagian giliran.
  // Sekarang jatah limit dibagi: ADUAN final diproses duluan (biasanya jumlahnya jauh
  // lebih sedikit, jadi cepat habis & langsung lega dari sheet operasional), separuh
  // sisa jatah baru dipakai LOG_WHATSAPP. Hasilnya kedua sumber SELALU maju tiap batch.
  var aduanShare = Math.max(1, Math.ceil(limit / 2));
  var aduanCollected = collectSheet_(CONFIG.SHEET_NAME || 'ADUAN', 'aduan', aduanShare);
  var whatsappShare = Math.max(1, limit - aduanCollected);
  collectSheet_(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP', 'whatsapp', whatsappShare);

  return items;
}

function siagaGetOrCreateBackupSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty(SIAGA_BACKUP_FILE_ID_PROP_) || '').trim();
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (ignored) {}
  }
  var file = SpreadsheetApp.create('SIAGA TIARA - BACKUP BOT');
  props.setProperty(SIAGA_BACKUP_FILE_ID_PROP_, file.getId());
  var first = file.getSheets()[0];
  first.setName('PETUNJUK');
  first.getRange('A1:A5').setValues([
    ['SIAGA TIARA - BACKUP BOT'],
    ['File ini dibuat otomatis. Jangan dijadikan spreadsheet operasional.'],
    ['Data disalin ke PostgreSQL dan file ini sebelum dihapus dari spreadsheet utama.'],
    ['Sheet BACKUP_YYYY_MM berisi arsip per bulan.'],
    ['Dibuat: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')]
  ]);
  return file;
}

function siagaAppendBackupSpreadsheet_(items) {
  var backup = siagaGetOrCreateBackupSpreadsheet_();
  var grouped = {};
  items.forEach(function(item) {
    (grouped[item.recordMonth] = grouped[item.recordMonth] || []).push(item);
  });
  Object.keys(grouped).forEach(function(month) {
    var name = 'BACKUP_' + month.replace('-', '_');
    var sh = backup.getSheetByName(name) || backup.insertSheet(name);
    var headers = ['Backup Key', 'Sumber', 'Bulan', 'Waktu Data', 'ID Aduan', 'No HP', 'Ringkasan', 'Payload JSON', 'Waktu Backup'];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#163b65').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    var existing = {};
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(row) { existing[String(row[0] || '')] = true; });
    }
    var now = new Date();
    var rows = grouped[month].filter(function(item) { return !existing[item.sourceRecordKey]; }).map(function(item) {
      return [item.sourceRecordKey, item.sourceSheet, item.recordMonth, new Date(item.recordTimestamp), item.aduanId, item.phone, item.summary, JSON.stringify(item.payload), now];
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  });
  return { id: backup.getId(), url: backup.getUrl() };
}

function siagaDeleteBackedUpRows_(items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bySheet = {};
  items.forEach(function(item) { (bySheet[item.sourceSheet] = bySheet[item.sourceSheet] || []).push(Number(item.sourceRow)); });
  Object.keys(bySheet).forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    bySheet[name].sort(function(a, b) { return b - a; }).forEach(function(row) {
      if (row > 1 && row <= sh.getLastRow()) sh.deleteRow(row);
    });
  });
}

// V11.0.4:
// Sebelumnya dropdown "Periode backup" di dashboard diisi 36 bulan ke belakang secara
// membabi-buta oleh JavaScript client (lihat populatePerformanceBackupMonths di Index.html),
// tanpa cek apakah bulan itu benar-benar punya data. Akibatnya banyak muncul bulan kosong
// (mis. sebelum bot ini dipakai) yang membingungkan admin, dan bulan berjalan sama sekali
// tidak ada di daftar. Fungsi ini menggantinya: scan LOG_WHATSAPP + aduan final di sheet
// ADUAN, kembalikan hanya bulan yang benar-benar ada datanya, plus tandai bulan berjalan
// supaya selalu bisa dipilih langsung oleh dashboard walau datanya belum ada/masih sedikit.
function clientGetAvailableBackupMonths(payload) {
  payload = payload || {};
  ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  var monthCounts = {};

  function bump_(month, type) {
    if (!month) return;
    if (!monthCounts[month]) monthCounts[month] = { whatsapp: 0, aduan: 0 };
    monthCounts[month][type] = (monthCounts[month][type] || 0) + 1;
  }

  function scanSheet_(sheetName, type) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return;
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(function(v) { return String(v || '').trim(); });
    var map = siagaBackupHeaderMap_(headers);
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var dateValue = type === 'whatsapp'
        ? siagaBackupValueByHeaders_(row, map, ['Timestamp'])
        : siagaBackupValueByHeaders_(row, map, ['Waktu Masuk', 'Timestamp', 'Tanggal']);
      var date = siagaBackupDate_(dateValue);
      if (!date) continue;
      if (type === 'aduan') {
        var status = String(siagaBackupValueByHeaders_(row, map, ['Status']) || '').trim().toLowerCase();
        if (!SIAGA_BACKUP_FINAL_STATUSES_[status]) continue;
      }
      bump_(siagaBackupMonth_(date), type);
    }
  }

  scanSheet_(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP', 'whatsapp');
  scanSheet_(CONFIG.SHEET_NAME || 'ADUAN', 'aduan');

  var months = Object.keys(monthCounts).sort().reverse().map(function(m) {
    return {
      month: m,
      isCurrent: m === currentMonth,
      whatsapp: monthCounts[m].whatsapp,
      aduan: monthCounts[m].aduan,
      total: monthCounts[m].whatsapp + monthCounts[m].aduan
    };
  });

  return { success: true, months: months, currentMonth: currentMonth };
}

function clientPreviewPerformanceBackup(payload) {
  payload = payload || {};
  ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
  var month = siagaBackupNormalizeMonth_(payload.month || 'ALL');
  var items = siagaBackupCollect_(month, SIAGA_BACKUP_MAX_PER_RUN_);
  var counts = { whatsapp: 0, aduan: 0 };
  items.forEach(function(item) { counts[item.recordType] = (counts[item.recordType] || 0) + 1; });
  return {
    success: true, month: month, counts: counts, total: items.length,
    capped: items.length >= SIAGA_BACKUP_MAX_PER_RUN_,
    note: items.length >= SIAGA_BACKUP_MAX_PER_RUN_ ? 'Masih ada data berikutnya; dashboard akan melanjutkan per batch.' : ''
  };
}

function clientRunPerformanceBackup(payload) {
  payload = payload || {};
  ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
  var month = siagaBackupNormalizeMonth_(payload.month || 'ALL');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Backup lain sedang berjalan. Coba lagi sebentar.');
  try {
    var items = siagaBackupCollect_(month, SIAGA_BACKUP_MAX_PER_RUN_);
    if (!items.length) return { success: true, processed: 0, hasMore: false, message: 'Tidak ada data lama yang memenuhi syarat.' };
    var runId = Utilities.getUuid();
    var pg = crmApiRequest_('/api/v1/backups/batch', 'post', { runId: runId, items: items }, null);
    if (!pg || Number(pg.failed || 0) > 0 || Number(pg.processed || 0) !== items.length) {
      throw new Error('Backup PostgreSQL belum lengkap. Data aktif tidak dihapus.');
    }
    var spreadsheet = siagaAppendBackupSpreadsheet_(items);
    siagaDeleteBackedUpRows_(items);
    var remaining = siagaBackupCollect_(month, 1).length > 0;
    return {
      success: true, processed: items.length, hasMore: remaining,
      backupSpreadsheetUrl: spreadsheet.url,
      message: items.length + ' data berhasil diamankan ke PostgreSQL dan Spreadsheet arsip.'
    };
  } finally {
    lock.releaseLock();
  }
}
