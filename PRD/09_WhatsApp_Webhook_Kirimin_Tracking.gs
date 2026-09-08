// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: 09_WhatsApp_Webhook_Kirimin_Tracking.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================



function setupWhatsAppLogSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.WHATSAPP_LOG_SHEET);

  var __fastKey = sh ? getSheetRuntimeKey_('LOG_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 8).setValues([[ 
      'Timestamp', 'No HP', 'Pesan Masuk', 'Jenis', 'ID Aduan', 'Balasan', 'Status Kirim', 'Raw Payload'
    ]]);
  }

  sh.getRange(1, 1, 1, 8)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 8);
  if (__fastKey) cachePut_(__fastKey, '1', 21600);

}

function openWhatsAppLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET));
}

// ============================================================
// V10.9.80 - ARSIP LOG WHATSAPP LAMA
// ============================================================

function getWhatsAppLogArchiveSheetName_(dateObj) {
  var d = toSafeDate_(dateObj) || new Date(dateObj);
  if (!d || isNaN(d.getTime())) d = new Date();
  return 'ARSIP_LOG_WHATSAPP_' + Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy_MM');
}

function getOrCreateWhatsAppLogArchiveSheet_(ss, dateObj, sourceSheet) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = getWhatsAppLogArchiveSheetName_(dateObj);
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var headers = [
    'Timestamp', 'No HP', 'Pesan Masuk', 'Jenis', 'ID Aduan', 'Balasan', 'Status Kirim', 'Raw Payload'
  ];

  if (sourceSheet && sourceSheet.getLastRow() >= 1) {
    try {
      headers = sourceSheet.getRange(1, 1, 1, Math.min(sourceSheet.getLastColumn(), 8)).getValues()[0];
    } catch(e) {}
  }

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#0f3b5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sh.setFrozenRows(1);
    try { sh.autoResizeColumns(1, headers.length); } catch(e2) {}
  }

  return sh;
}

function getOldWhatsAppLogRows_(days) {
  days = Number(days || 30);
  if (days < 2) days = 2; // pengaman: jangan pernah hapus log 24 jam terakhir.

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    return { sheet: sh, rows: [], cutoff: new Date(new Date().getTime() - days * 24 * 3600000) };
  }

  var cutoff = new Date(new Date().getTime() - days * 24 * 3600000);
  var lastRow = sh.getLastRow();
  var lastCol = Math.min(sh.getLastColumn(), 8);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var ts = toSafeDate_(values[i][0]) || (values[i][0] ? new Date(values[i][0]) : null);
    if (!ts || isNaN(ts.getTime())) continue;
    if (ts.getTime() < cutoff.getTime()) {
      rows.push({
        rowNumber: i + 2,
        timestamp: ts,
        values: values[i]
      });
    }
  }

  return { sheet: sh, rows: rows, cutoff: cutoff };
}

function previewOldWhatsAppLogSummary() {
  var ui = SpreadsheetApp.getUi();
  var info = getOldWhatsAppLogRows_(30);
  var rows = info.rows || [];

  var byMonth = {};
  rows.forEach(function(r) {
    var key = Utilities.formatDate(r.timestamp, Session.getScriptTimeZone(), 'yyyy-MM');
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  var lines = [
    'Ringkasan LOG_WHATSAPP lama',
    '',
    'Batas arsip: lebih lama dari 30 hari.',
    'Cutoff: ' + Utilities.formatDate(info.cutoff, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    '',
    'Total yang siap diarsipkan: ' + rows.length + ' baris.'
  ];

  var keys = Object.keys(byMonth).sort();
  if (keys.length) {
    lines.push('');
    lines.push('Per bulan:');
    keys.forEach(function(k) {
      lines.push('- ' + k + ': ' + byMonth[k] + ' baris');
    });
  }

  lines.push('');
  lines.push('Belum ada data yang dipindahkan dari menu ini.');

  ui.alert('Cek LOG WhatsApp Lama', lines.join('\n'), ui.ButtonSet.OK);
  return { success: true, total: rows.length, byMonth: byMonth, cutoff: info.cutoff };
}

function archiveWhatsAppLogOlderThan30Days() {
  var ui = SpreadsheetApp.getUi();

  var info = getOldWhatsAppLogRows_(30);
  var rows = info.rows || [];

  if (!rows.length) {
    ui.alert(
      'Tidak ada LOG lama',
      'Tidak ada baris LOG_WHATSAPP yang lebih lama dari 30 hari.\n\nLOG utama masih aman.',
      ui.ButtonSet.OK
    );
    return { success: true, archived: 0, deleted: 0 };
  }

  var confirm = ui.alert(
    'Arsipkan LOG WhatsApp >30 Hari',
    'Ditemukan ' + rows.length + ' baris LOG_WHATSAPP yang lebih lama dari 30 hari.\n\n' +
    'Data akan DIPINDAHKAN ke sheet ARSIP_LOG_WHATSAPP_YYYY_MM lalu dihapus dari LOG_WHATSAPP utama.\n\n' +
    'Log 30 hari terakhir tetap disimpan agar window 24 jam dan debugging terbaru aman.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return { success: false, cancelled: true, archived: 0, deleted: 0 };
  }

  return archiveOldWhatsAppLogs_(30);
}

function archiveOldWhatsAppLogs_(days) {
  days = Number(days || 30);
  if (days < 2) days = 2;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var info = getOldWhatsAppLogRows_(days);
  var sh = info.sheet;
  var rows = info.rows || [];

  if (!sh || !rows.length) {
    return { success: true, archived: 0, deleted: 0, message: 'Tidak ada log lama.' };
  }

  var groups = {};
  rows.forEach(function(r) {
    var archiveName = getWhatsAppLogArchiveSheetName_(r.timestamp);
    if (!groups[archiveName]) groups[archiveName] = { date: r.timestamp, rows: [] };
    groups[archiveName].rows.push(r.values);
  });

  var archived = 0;
  Object.keys(groups).sort().forEach(function(name) {
    var group = groups[name];
    var archiveSheet = getOrCreateWhatsAppLogArchiveSheet_(ss, group.date, sh);
    var startRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(startRow, 1, group.rows.length, group.rows[0].length).setValues(group.rows);
    archived += group.rows.length;
  });

  // Hapus dari bawah agar rowNumber tidak berubah.
  rows.sort(function(a, b) { return b.rowNumber - a.rowNumber; });
  rows.forEach(function(r) {
    try { sh.deleteRow(r.rowNumber); } catch(e) {}
  });

  try {
    SpreadsheetApp.getUi().alert(
      'Arsip LOG WhatsApp selesai',
      'Berhasil memindahkan ' + archived + ' baris LOG_WHATSAPP lama ke sheet arsip bulanan.\n\n' +
      'LOG_WHATSAPP utama sekarang lebih ringan.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e2) {}

  return {
    success: true,
    archived: archived,
    deleted: rows.length,
    days: days,
    cutoff: info.cutoff
  };
}

function testArchiveOldWhatsAppLogsPreview() {
  return previewOldWhatsAppLogSummary();
}



function setWhatsAppApiConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var endpointPrompt = ui.prompt(
    '1/3 - Endpoint Kirim Pesan Kirimin ID',
    'Isi ini:\nhttps://apiapp.kirimin.id/api/v1/public/messages/send',
    ui.ButtonSet.OK_CANCEL
  );
  if (endpointPrompt.getSelectedButton() !== ui.Button.OK) return;

  var tokenPrompt = ui.prompt(
    '2/3 - API Key Kirimin ID',
    'Tempel API key kamu.\n\nContoh: kc_live_xxxxx',
    ui.ButtonSet.OK_CANCEL
  );
  if (tokenPrompt.getSelectedButton() !== ui.Button.OK) return;

  var devicePrompt = ui.prompt(
    '3/3 - WhatsApp Device ID',
    'Isi Device ID dari List WhatsApp Devices.\n\nUntuk akun kamu:\ncmoz14qey0s3ny6yjoi9gt2n7',
    ui.ButtonSet.OK_CANCEL
  );
  if (devicePrompt.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('WHATSAPP_PROVIDER', 'KIRIMIN_ID');
  props.setProperty('WHATSAPP_API_ENDPOINT', endpointPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_API_TOKEN', tokenPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_DEVICE_ID', devicePrompt.getResponseText().trim());

  props.setProperty('WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT', 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}');
  props.setProperty('WHATSAPP_INTERACTIVE_ENDPOINT', endpointPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_USE_INTERACTIVE_MENU', 'YA');
  props.setProperty('WHATSAPP_REPLY_MODE', 'AUTO');

  ui.alert(
    '✅ Konfigurasi WhatsApp tersimpan',
    'Selesai. Menu utama akan mencoba List Menu WhatsApp lewat endpoint utama /messages/send. Jika ditolak, sistem fallback ke menu teks.',
    ui.ButtonSet.OK
  );
}

function testWhatsAppStatusReply() {
  var ui = SpreadsheetApp.getUi();
  var phone = ui.prompt('Tes WhatsApp', 'Masukkan nomor HP tujuan, contoh: 6281234567890', ui.ButtonSet.OK_CANCEL);
  if (phone.getSelectedButton() !== ui.Button.OK) return;

  var q = ui.prompt('Tes WhatsApp', 'Masukkan ID Aduan atau No HP pelanggan yang ada di sheet ADUAN.', ui.ButtonSet.OK_CANCEL);
  if (q.getSelectedButton() !== ui.Button.OK) return;

  var res = getAduanTrackingResponse_(q.getResponseText(), phone.getResponseText());
  var send = sendWhatsAppMessage_(phone.getResponseText(), res.reply);

  ui.alert(
    send.success ? '✅ Tes terkirim' : '⚠ Balasan dibuat, tapi pengiriman gagal',
    'Balasan:\n\n' + res.reply + '\n\nStatus kirim: ' + (send.success ? 'OK' : send.error),
    ui.ButtonSet.OK
  );
}


// ============================================================
// V10.9.99 - ANTI CHAT SENDIRI / DUPLICATE WEBHOOK
// ============================================================
function whatsappWebhookHash_(text) {
  try {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      String(text || ''),
      Utilities.Charset.UTF_8
    );
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '').substring(0, 36);
  } catch (e) {
    return String(new Date().getTime());
  }
}

function whatsappWebhookTruthy_(value) {
  var v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'ya';
}

function extractIncomingWebhookMessageId_(payload, raw) {
  payload = payload || {};
  var obj = payload.rawObject || {};
  var data = obj.data || {};

  var candidates = [
    data.message_id,
    data.messageId,
    data.wa_message_id,
    data.whatsapp_message_id,
    data.id,
    data.uuid,
    data.msg_id,
    obj.message_id,
    obj.messageId,
    obj.wa_message_id,
    obj.whatsapp_message_id,
    obj.id,
    obj.uuid,
    obj.msg_id,
    data.message && data.message.id,
    data.message && data.message.message_id,
    obj.message && obj.message.id,
    obj.message && obj.message.message_id,
    obj.payload && obj.payload.message_id,
    obj.payload && obj.payload.id
  ];

  for (var i = 0; i < candidates.length; i++) {
    var v = String(candidates[i] || '').trim();
    if (v && v.length >= 6 && v.toLowerCase() !== String(payload.customerId || '').toLowerCase()) return v;
  }

  // Fallback jika provider tidak mengirim message_id.
  // Raw payload yang sama dari retry provider akan menghasilkan kunci sama.
  if (raw) return 'RAW_' + whatsappWebhookHash_(raw);

  return 'SIG_' + whatsappWebhookHash_([
    payload.phone || '',
    payload.customerId || '',
    payload.message || '',
    JSON.stringify(payload.media || {}),
    JSON.stringify(payload.location || {})
  ].join('|'));
}

function isOutboundOrStatusWhatsAppWebhook_(payload) {
  payload = payload || {};
  var obj = payload.rawObject || {};
  var data = obj.data || {};
  var msg = data.message || obj.message || {};

  var boolCandidates = [
    data.from_me,
    data.fromMe,
    data.is_from_me,
    data.isFromMe,
    data.is_me,
    data.isMe,
    data.outgoing,
    data.is_echo,
    data.isEcho,
    msg.from_me,
    msg.fromMe,
    msg.is_from_me,
    msg.isFromMe,
    obj.from_me,
    obj.fromMe,
    obj.is_from_me,
    obj.isFromMe,
    obj.outgoing,
    obj.is_echo,
    obj.isEcho
  ];

  for (var i = 0; i < boolCandidates.length; i++) {
    if (whatsappWebhookTruthy_(boolCandidates[i])) return true;
  }

  var fields = [
    data.direction,
    data.message_direction,
    data.messageDirection,
    msg.direction,
    obj.direction,
    obj.message_direction,
    obj.messageDirection
  ].map(function(v) { return String(v || '').trim().toLowerCase(); }).join('|');

  if (/(^|\|)(out|outbound|outgoing|sent|api|bot)(\||$)/.test(fields)) return true;

  var eventText = [
    obj.event,
    obj.event_type,
    obj.eventType,
    obj.type,
    obj.status,
    obj.message_status,
    obj.messageStatus,
    data.event,
    data.event_type,
    data.eventType,
    data.type,
    data.status,
    data.message_status,
    data.messageStatus,
    msg.type,
    msg.status
  ].map(function(v) { return String(v || '').trim().toLowerCase(); }).join('|');

  // Delivery/status webhook dari provider tidak boleh diproses sebagai chat masuk.
  if (eventText.indexOf('message.status') !== -1) return true;
  if (eventText.indexOf('delivery') !== -1) return true;
  if (/(^|\|)(sent|delivered|read|queued|sending|failed|undelivered)(\||$)/.test(eventText)) return true;

  return false;
}

function isLikelyOwnBotEchoMessage_(message) {
  var text = String(message || '').toLowerCase();
  if (!text) return false;

  // Jika provider mengirim balik pesan outbound bot sebagai webhook inbound,
  // jangan diproses lagi agar bot tidak mengirim menu berulang sendiri.
  if (text.indexOf('saya adalah siaga tiara') !== -1 && text.indexOf('silakan pilih layanan') !== -1) return true;
  if (text.indexOf('menu petugas siaga tiara') !== -1 && text.indexOf('silakan pilih menu') !== -1) return true;
  if (text.indexOf('ringkasan layanan siaga tiara') !== -1 && text.indexOf('total aduan') !== -1) return true;
  if (text.indexOf('cek tagihan pelanggan') !== -1 && text.indexOf('silakan kirim no pelanggan') !== -1) return true;
  if (text.indexOf('status aduan berhasil diupdate') !== -1 && text.indexOf('id aduan') !== -1) return true;

  return false;
}

function checkDuplicateWhatsAppWebhook_(payload, raw) {
  payload = payload || {};
  var messageId = extractIncomingWebhookMessageId_(payload, raw);
  var key = 'WA_WEBHOOK_DEDUP_' + whatsappWebhookHash_(messageId);
  var existing = cacheGet_(key);

  if (existing) {
    return { duplicate: true, messageId: messageId, key: key };
  }

  // TTL 10 menit cukup untuk menahan retry/delivery webhook ganda.
  cachePut_(key, '1', 600);
  return { duplicate: false, messageId: messageId, key: key };
}


// ============================================================
// V10.9.175 - FIX ANTI SPAM RACE CONDITION 3 DETIK
// Masalah: pelanggan/petugas bisa spam teks bebas 2-3x, lalu bot mengirim
// menu/prompt yang sama berulang. Dedup webhook tidak cukup karena setiap chat
// punya message_id berbeda. Fix ini menahan BALASAN PROMPT yang sama dari nomor
// yang sama selama 3 detik, tanpa memblokir perintah valid, data valid, atau foto valid.
// ============================================================
function isSuppressibleWhatsAppReplyResult_(result) {
  if (!result || !result.reply) return false;

  var type = String(result.type || '').toUpperCase();

  // Jangan tahan hasil aksi final yang bisa menjadi bukti bahwa aksi berhasil.
  // Debounce ini hanya untuk menu/prompt berulang, bukan hasil simpan/update.
  if (type === 'PETUGAS_UPDATE_STATUS_OK' ||
      type === 'PETUGAS_FOTO_SAVED' ||
      type === 'PETUGAS_CONFIRM_FOTO_STATUS' ||
      type === 'PETUGAS_CONFIRM_FOTO_SELESAI_STATUS' ||
      type === 'FAST_ADUAN_CREATED' ||
      type === 'NEW_ADUAN_CREATED' ||
      type === 'ADUAN_CREATED') {
    return false;
  }

  // Menu utama / welcome paling sering kena spam.
  if (type === 'MAIN_MENU' || type === 'MAIN_MENU_FALLBACK') return true;

  // List/menu pemilihan yang sifatnya prompt boleh ditahan jika identik berulang.
  if (type === 'ASK_CABANG' || type === 'ASK_ID' || type === 'ASK_JENIS_GANGGUAN') return true;

  // V10.9.173: pelanggan yang sudah masuk proses aduan lalu spam teks ngasal
  // tidak boleh menerima prompt yang sama berkali-kali.
  var promptTypes = {
    FAST_ADUAN_ASK_TEXT: true,
    FAST_ADUAN_LOCATION_SAVED_EARLY: true,
    FAST_ADUAN_MISSING_NOPEL: true,
    FAST_ADUAN_NAMA_INVALID: true,
    FAST_ADUAN_KETERANGAN_INVALID: true,
    FAST_ADUAN_ASK_LOCATION: true,
    FAST_ADUAN_EDIT: true,
    FAST_ADUAN_LOCATION_SAVED: true,
    FAST_ADUAN_CONFIRM: true,
    FAST_ADUAN_CONFIRM_INVALID: true,
    NEW_ADUAN_ASK_CABANG: true,
    NEW_ADUAN_ASK_NAMA: true,
    NEW_ADUAN_NAMA_INVALID: true,
    NEW_ADUAN_ASK_NO_PELANGGAN: true,
    NEW_ADUAN_KETERANGAN_INVALID: true,
    NEW_ADUAN_ASK_KETERANGAN: true,
    NEW_ADUAN_ASK_LOKASI: true,
    NEW_ADUAN_LOKASI_EMPTY: true,
    BILLING_AWAIT_NOPEL: true,
    BILLING_NOPEL_INVALID: true,

    // V10.9.174: petugas juga harus aman dari spam chat ngasal.
    PETUGAS_MENU: true,
    PETUGAS_DAFTAR: true,
    PETUGAS_CARI_ADUAN: true,
    PETUGAS_CARI_WAIT_ID: true,
    PETUGAS_STATUS_BY_ID: true,
    PETUGAS_STATUS_MENU: true,
    PETUGAS_FOTO_TYPE_MENU: true,
    PETUGAS_AWAIT_PHOTO: true,
    PETUGAS_RESPONS_NEED_PHOTO: true,
    PETUGAS_SELESAI_NEED_PHOTO: true,
    PETUGAS_CONFIRM_STATUS_WAIT: true,
    PETUGAS_CAPTION_PHOTO_WAIT_SELECTION: true,
    PETUGAS_CAPTION_PHOTO_INVALID_SELECTION: true,
    PETUGAS_CAPTION_PHOTO_NEED_CABANG: true,
    PETUGAS_CAPTION_PHOTO_NEED_NAME: true,
    PETUGAS_CAPTION_PHOTO_NO_ACTIVE_MATCH: true,
    PETUGAS_CAPTION_PHOTO_MULTIPLE_MATCH: true,
    PETUGAS_NO_ID_TEXT_NEED_PHOTO: true,
    PETUGAS_MEDIA_NO_SESSION: true,
    PETUGAS_UPDATE_EMPTY: true,
    PETUGAS_UPDATE_LIST: true,
    PETUGAS_FOTO_EMPTY: true,
    PETUGAS_FOTO_LIST: true,
    PETUGAS_UPDATE_NOT_FOUND: true,
    PETUGAS_UPDATE_FORBIDDEN: true,
    PETUGAS_FOTO_NOT_FOUND: true,
    PETUGAS_FOTO_FORBIDDEN: true,
    PETUGAS_FOTO_NO_ID: true,
    PETUGAS_ID_NOT_FOUND: true,
    PETUGAS_FORBIDDEN: true
  };
  if (promptTypes[type]) return true;

  // Fallback aman untuk prompt aduan lain yang namanya belum masuk daftar.
  if (type.indexOf('FAST_ADUAN_') === 0 && type.indexOf('CREATED') === -1) return true;
  if (type.indexOf('NEW_ADUAN_') === 0 && type.indexOf('CREATED') === -1) return true;

  // Fallback aman untuk prompt/menu petugas lain. Hindari hasil simpan/update final.
  if (type.indexOf('PETUGAS_') === 0) {
    if (type.indexOf('_OK') !== -1 ||
        type.indexOf('_SAVED') !== -1 ||
        type.indexOf('_CANCEL') !== -1 ||
        type.indexOf('_CANCELLED') !== -1) {
      return false;
    }
    if (type.indexOf('MENU') !== -1 ||
        type.indexOf('LIST') !== -1 ||
        type.indexOf('WAIT') !== -1 ||
        type.indexOf('AWAIT') !== -1 ||
        type.indexOf('EMPTY') !== -1 ||
        type.indexOf('NOT_FOUND') !== -1 ||
        type.indexOf('FORBIDDEN') !== -1 ||
        type.indexOf('INVALID') !== -1 ||
        type.indexOf('NEED_') !== -1 ||
        type.indexOf('NO_SESSION') !== -1) {
      return true;
    }
  }

  if (result.jenisMenu || result.infoLayananMenu || result.riwayatMenu) return true;
  if (result.adminCabangMenu || result.adminMenu || result.petugasMenu) return true;
  if (result.petugasAduanListMenu || result.petugasStatusMenu || result.petugasFotoTypeMenu) return true;

  // Fallback: kalau isi balasan memang menu utama, tahan juga.
  try {
    if (isMainMenuReply_(result.reply)) return true;
  } catch (e) {}

  return false;
}

function getWhatsAppReplyDebounceSeconds_(result) {
  var type = String(result && result.type || '').toUpperCase();
  if (type === 'MAIN_MENU' || type === 'MAIN_MENU_FALLBACK') return 3;
  if (type === 'ASK_CABANG') return 3;
  if (type === 'ASK_ID') return 3;
  return 3;
}


// V11: debounce cache-first dengan lock sangat singkat.
// Versi lama menunggu ScriptLock global sampai 3 detik, dua kali per chat. Saat
// beberapa pelanggan chat bersamaan, ini bisa menambah jeda hampir 6 detik.
function shouldDebounceWhatsAppKeyWithLock_(key, seconds) {
  key = String(key || '').trim();
  seconds = Number(seconds || 3);
  if (!key) return false;
  if (!seconds || isNaN(seconds) || seconds < 1) seconds = 3;

  // Duplikat yang sudah tercatat dapat ditolak tanpa menyentuh lock/properties.
  try {
    if (cacheGet_(key)) return true;
  } catch (cacheFastErr) {}

  var lock = null;
  var locked = false;
  try {
    lock = LockService.getScriptLock();
    var waitMs = Number(getSiagaRuntimeSetting_(
      'WHATSAPP_DEBOUNCE_LOCK_WAIT_MS',
      CONFIG.WHATSAPP_DEBOUNCE_LOCK_WAIT_MS || 120
    ));
    if (!waitMs || isNaN(waitMs) || waitMs < 20) waitMs = 120;
    locked = lock.tryLock(Math.min(waitMs, 250));
  } catch (e) {
    locked = false;
  }

  try {
    // V11.0.1 PERF FIX:
    // Versi lama ikut menulis ScriptProperties (props.setProperty) untuk setiap
    // key debounce dan TIDAK PERNAH menghapusnya. Akibatnya store Script
    // Properties membengkak tanpa batas: getProperties() yang dipanggil hampir
    // setiap webhook (via getRuntimeProp_) makin lambat, dan lama-lama kena
    // kuota 500KB sehingga setProperty gagal diam-diam.
    // Untuk debounce 3 detik, persistensi properti tidak ada gunanya.
    // Cukup: cek cache -> ambil lock singkat -> cek ulang cache -> tulis cache.
    // Lock tetap menutup race dua webhook paralel yang sama-sama miss cache.
    try {
      if (cacheGet_(key)) return true;
    } catch (cacheErr) {}

    try { cachePut_(key, '1', seconds); } catch (cachePutErr) {}
    return false;
  } finally {
    if (locked && lock) {
      try { lock.releaseLock(); } catch (e2) {}
    }
  }
}

function hasIncomingWhatsAppMediaOrLocation_(payload) {
  payload = payload || {};
  var obj = payload.rawObject || {};
  var data = obj.data || {};
  var msg = data.message || obj.message || {};
  var media = payload.media || data.media || msg.media || obj.media || null;
  if (media && (media.url || media.fileUrl || media.link || media.id || media.attachment_id)) return true;
  if (payload.location || data.location || msg.location || obj.location) return true;
  var typ = [payload.type, data.type, msg.type, obj.type, data.message_type, msg.message_type]
    .map(function(v) { return String(v || '').toLowerCase(); }).join('|');
  if (/(image|photo|video|audio|document|file|location)/.test(typ)) return true;
  return false;
}

function isLikelyValidWhatsAppInputForPreDebounce_(message, session, payload) {
  message = String(message || '').trim();
  var lower = message.toLowerCase();
  if (!message) return true;
  if (hasIncomingWhatsAppMediaOrLocation_(payload)) return true;

  var mapped = '';
  try { mapped = normalizeIncomingListMenuChoice_(message); } catch (e) { mapped = ''; }
  if (mapped) return true;

  // Angka menu, pilihan cabang, pilihan status, Ya/Tidak, dan perintah umum harus langsung lewat.
  if (/^\d{1,3}$/.test(lower)) return true;
  if (/^(ya|iya|y|tidak|tdk|no|n|ok|oke)$/.test(lower)) return true;
  if (/^(menu|menu utama|home|mulai|start|\/start|batal|cancel|reset|ulang|kembali)$/.test(lower)) return true;
  if (/^(status|cek|cek status|cek status aduan|riwayat|lihat|aduan aktif|aduan aktif saya)$/.test(lower)) return true;
  if (/^(halo|hallo|hi|petugas menu|daftar aduan|cari aduan|upload foto|update status)$/.test(lower)) return true;

  try { if (extractAduanId_(message)) return true; } catch (e2) {}
  try { if (isFastAduanCommand_(lower) || isCekTagihanCommand_(lower) || isMenuCommand_(lower)) return true; } catch (e3) {}

  // Form/data pelanggan biasanya ada koma atau nomor pelanggan panjang.
  if (message.indexOf(',') !== -1 && message.length >= 10) return true;
  if (/^\d{4,}$/.test(lower)) return true;

  // Kata kunci layanan yang memang harus diproses.
  if (lower.indexOf('tagihan') !== -1 || lower.indexOf('rekening') !== -1 || lower.indexOf('pembayaran') !== -1) return true;
  if (lower.indexOf('info') !== -1 || lower.indexOf('aduan') !== -1 || lower.indexOf('lapor') !== -1) return true;
  if (lower.indexOf('air mati') !== -1 || lower.indexOf('air keruh') !== -1 || lower.indexOf('pipa') !== -1 || lower.indexOf('bocor') !== -1) return true;

  return false;
}

function shouldSuppressIncomingNoiseWhatsAppBeforeMenu_(phone, message, payload) {
  phone = normalizePhone_(phone || '');
  message = String(message || '').trim();
  if (!phone || !message) return false;
  if (hasIncomingWhatsAppMediaOrLocation_(payload)) return false;

  var session = null;
  try { session = getWhatsAppSession_(phone); } catch (e) { session = null; }
  var state = String(session && session.state || '').toUpperCase();

  if (isLikelyValidWhatsAppInputForPreDebounce_(message, session, payload)) return false;

  var bucket = '';
  // Yang paling sering membuat menu dobel: user belum masuk alur atau masih di MAIN.
  if (!state || state === 'MAIN') bucket = 'MAIN_MENU_NOISE';
  else if (state === 'AWAIT_ID') bucket = 'ASK_ID_NOISE';
  else if (state === 'BILLING_AWAIT_NOPEL') bucket = 'BILLING_NOPEL_NOISE';
  else if (state === 'PICK_ADUAN') bucket = 'PICK_ADUAN_NOISE';
  else if (state.indexOf('PETUGAS_') === 0) bucket = 'PETUGAS_PROMPT_NOISE_' + state;
  else {
    // Untuk NEW_/FAST_ jangan dipotong terlalu agresif di awal, karena pelanggan bisa
    // mengisi nama/keluhan bebas. Nanti tetap ditahan oleh debounce hasil balasan.
    return false;
  }

  var key = 'WA_IN_NOISE_' + whatsappWebhookHash_(phone + '_' + bucket);
  return shouldDebounceWhatsAppKeyWithLock_(key, 3);
}

function shouldSuppressRapidDuplicateWhatsAppReply_(phone, result) {
  phone = normalizePhone_(phone || '');
  if (!phone || !isSuppressibleWhatsAppReplyResult_(result)) return false;

  var replyHash = whatsappWebhookHash_(String(result.reply || '').substring(0, 1500));
  var type = String(result.type || 'MENU').toUpperCase();
  var key = 'WA_REPLY_DEBOUNCE_' + whatsappWebhookHash_(phone + '_' + type + '_' + replyHash);
  var seconds = getWhatsAppReplyDebounceSeconds_(result);

  // V10.9.175: jangan hanya CacheService. Pakai lock + ScriptProperties agar
  // webhook paralel tidak sama-sama lolos saat pelanggan/petugas spam chat.
  return shouldDebounceWhatsAppKeyWithLock_(key, seconds);
}


// ============================================================
// V10.9.136 - KIRIMIN TYPING INDICATOR
// Menampilkan indikator "sedang mengetik..." sebelum bot membalas.
// Rate limit Kirimin: maksimal 1 request per 3 detik per customer.
// ============================================================
function isWhatsAppTypingEnabled_() {
  return String(getSiagaRuntimeSetting_('WHATSAPP_TYPING_ENABLED', CONFIG.WHATSAPP_TYPING_ENABLED || 'YA')).toUpperCase() !== 'TIDAK';
}

function isWhatsAppFastReplyEnabled_() {
  return String(getSiagaRuntimeSetting_(
    'WHATSAPP_FAST_REPLY_ENABLED',
    CONFIG.WHATSAPP_FAST_REPLY_ENABLED || 'YA'
  )).toUpperCase() !== 'TIDAK';
}

function getKiriminTypingEndpoint_() {
  return getSiagaRuntimeSetting_(
    'WHATSAPP_TYPING_ENDPOINT',
    CONFIG.WHATSAPP_TYPING_ENDPOINT || 'https://apiapp.kirimin.id/api/v1/public/conversations/{customerIdentifier}/typing'
  );
}

function sendKiriminTypingIndicator_(customerIdentifier, options) {
  options = options || {};
  if (!isWhatsAppTypingEnabled_()) return { success: true, skipped: true, reason: 'typing disabled' };

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var identifier = String(customerIdentifier || '').trim();
  if (!identifier && options.phone) identifier = normalizePhone_(options.phone);
  if (!identifier) return { success: false, skipped: true, error: 'customerIdentifier kosong untuk typing indicator.' };
  if (!token) return { success: false, skipped: true, error: 'API token kosong.' };

  var cooldown = Number(getSiagaRuntimeSetting_('WHATSAPP_TYPING_COOLDOWN_SECONDS', CONFIG.WHATSAPP_TYPING_COOLDOWN_SECONDS || 3));
  if (!cooldown || isNaN(cooldown) || cooldown < 1) cooldown = 3;

  var key = 'WA_TYPING_' + whatsappWebhookHash_(identifier);
  if (cacheGet_(key)) {
    return { success: true, skipped: true, reason: 'typing cooldown', customerIdentifier: identifier };
  }
  cachePut_(key, '1', cooldown);

  var endpoint = String(getKiriminTypingEndpoint_() || '').trim();
  if (!endpoint) return { success: false, error: 'Endpoint typing Kirimin kosong.' };

  endpoint = endpoint.replace('{customerIdentifier}', encodeURIComponent(identifier));
  if (endpoint.indexOf('{') !== -1 || endpoint.indexOf('}') !== -1) {
    endpoint = 'https://apiapp.kirimin.id/api/v1/public/conversations/' + encodeURIComponent(identifier) + '/typing';
  }

  try {
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: '{}'
    });

    var code = res.getResponseCode();
    var text = res.getContentText();
    return {
      success: code >= 200 && code < 300,
      statusCode: code,
      response: text,
      customerIdentifier: identifier,
      url: endpoint
    };
  } catch (err) {
    return { success: false, error: err.message, customerIdentifier: identifier, url: endpoint };
  }
}

function shouldUseTypingForWhatsAppResult_(result) {
  if (!result || !result.reply) return false;
  if (result.noTyping) return false;

  var mode = String(getSiagaRuntimeSetting_('WHATSAPP_TYPING_MODE', CONFIG.WHATSAPP_TYPING_MODE || 'SELECTIVE')).toUpperCase();
  if (mode === 'ALL' || mode === 'SEMUA') return true;
  if (mode === 'NO' || mode === 'TIDAK' || mode === 'OFF') return false;

  var type = String(result.type || '').toUpperCase();

  // V10.9.146: typing dibuat selektif agar menu WA tetap cepat.
  // Dipakai hanya untuk jawaban yang terasa seperti AI/olah bahasa bebas.
  if (type === 'DIREKSI_AI_START') return true;
  if (type === 'DIREKSI_AI_REPLY') return true;
  if (type === 'DIREKSI_AI_CONTINUATION') return true;
  if (type.indexOf('PETUGAS_SEMI_AI_') === 0) return true;

  // Menu cepat, cek status, buat aduan, daftar aduan, notifikasi, upload foto, dll tidak pakai typing.
  return false;
}

function maybeSendTypingBeforeWhatsAppReply_(phone, customerId, result) {
  if (!result || !result.reply) return { success: true, skipped: true, reason: 'no reply' };
  if (!shouldUseTypingForWhatsAppResult_(result)) {
    return { success: true, skipped: true, reason: 'typing selective skip', type: result.type || '' };
  }

  var identifier = String(customerId || '').trim() || normalizePhone_(phone || '');
  if (!identifier) return { success: true, skipped: true, reason: 'no identifier' };

  var typingResult = sendKiriminTypingIndicator_(identifier, { phone: phone });
  if (typingResult && typingResult.success && !typingResult.skipped) {
    var delayMs = Number(getSiagaRuntimeSetting_('WHATSAPP_TYPING_DELAY_MS', CONFIG.WHATSAPP_TYPING_DELAY_MS || 600));
    if (!delayMs || isNaN(delayMs) || delayMs < 0) delayMs = 600;
    delayMs = Math.min(delayMs, 1500);
    if (delayMs > 0) {
      try { Utilities.sleep(delayMs); } catch(e) {}
    }
  }
  return typingResult;
}



// ============================================================
// V10.9.182 - AUTO BANTUAN HUBUNGI ADMIN SETELAH 2X INPUT SALAH
// Catatan:
// - Tidak menampilkan Hubungi Admin di menu utama.
// - Hanya muncul sebagai bantuan setelah pelanggan salah/teks tidak dipahami berulang.
// - Tidak berlaku untuk petugas/direksi.
// - Tidak membuat aduan baru. Jika pelanggan memilih hubungi admin, masuk mode Chat Admin.
// ============================================================
function getCustomerInvalidInputCounterKey_(phone, state) {
  phone = normalizePhone_(phone || '');
  var stateKey = String(state || 'GLOBAL').toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 40);
  return phone ? ('WA_INVALID_INPUT_COUNT_' + phone + '_' + stateKey) : '';
}

function getCustomerInvalidInputCounter_(phone, state) {
  var key = getCustomerInvalidInputCounterKey_(phone, state);
  if (!key) return 0;
  try {
    return Number(PropertiesService.getScriptProperties().getProperty(key) || 0) || 0;
  } catch(e) {
    return 0;
  }
}

function setCustomerInvalidInputCounter_(phone, value, state) {
  var key = getCustomerInvalidInputCounterKey_(phone, state);
  if (!key) return;
  try {
    var props = PropertiesService.getScriptProperties();
    value = Number(value || 0) || 0;
    if (value <= 0) props.deleteProperty(key);
    else props.setProperty(key, String(value));
  } catch(e) {}
}

function resetCustomerInvalidInputCounter_(phone, state) {
  setCustomerInvalidInputCounter_(phone, 0, state);
}

function clearCustomerInvalidInputCountersForPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  var prefix = 'WA_INVALID_INPUT_COUNT_' + phone + '_';
  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties() || {};
    Object.keys(all).forEach(function(k) {
      if (k.indexOf(prefix) === 0) props.deleteProperty(k);
    });
  } catch(e) {}
}

function isCustomerInvalidHelpAllowedContext_(sessionBefore, result) {
  var beforeState = String(sessionBefore && sessionBefore.state || '').toUpperCase();
  var type = String(result && result.type || '').toUpperCase();

  // V10.9.187: Bantuan Hubungi Admin setelah salah input hanya untuk alur
  // Buat Aduan dan Cek Status/Cek Tiket. Jangan muncul di Cek Tagihan/Info Layanan/menu umum.
  if (!beforeState || beforeState === 'MAIN') return false;
  if (beforeState === 'BILLING_AWAIT_NOPEL') return false;
  if (beforeState.indexOf('INFO_LAYANAN') === 0) return false;
  if (type.indexOf('BILLING_') === 0 || type.indexOf('INFO_LAYANAN') === 0) return false;

  if (beforeState === 'AWAIT_ID' || beforeState === 'PICK_ADUAN') return true;
  if (beforeState.indexOf('NEW_') === 0 || beforeState.indexOf('FAST_') === 0) return true;

  return false;
}

function isLikelyValidCustomerInputForInvalidHelp_(message) {
  var lower = String(message || '').trim().toLowerCase();
  if (!lower) return false;

  // Perintah/menu valid tidak dihitung salah.
  if (lower === 'menu' || lower === 'menu utama' || lower === 'home' || lower === 'batal' || lower === 'cancel' || lower === 'reset' || lower === 'ulang') return true;
  if (/^[1-9]$/.test(lower)) return true;
  if (isCekTagihanCommand_(lower) || isFastAduanCommand_(lower)) return true;
  if (extractAduanId_(message)) return true;

  // Permintaan admin langsung diproses oleh handler utama, bukan dihitung salah.
  if (lower === 'admin' || lower === 'cs' || lower === 'operator' || lower.indexOf('hubungi admin') !== -1 || lower.indexOf('chat admin') !== -1 || lower.indexOf('butuh admin') !== -1 || lower.indexOf('minta admin') !== -1 || lower.indexOf('customer service') !== -1) return true;

  // Format aduan satu baris yang berisi koma kemungkinan besar valid/akan diparse, jangan dianggap salah di awal.
  if (String(message || '').split(',').length >= 3) return true;

  return false;
}

function isCustomerInvalidPromptResultForHelp_(result, message, sessionBefore, payload) {
  if (!result || !result.reply) return false;
  if (!message) return false;

  // Petugas/direksi/admin internal tidak ikut fitur ini.
  try {
    var phone = normalizePhone_(payload && payload.phone || '');
    if (phone && (getPetugasByPhone_(phone) || getDireksiByPhone_(phone, null))) return false;
  } catch(eRole) {}

  if (isLikelyValidCustomerInputForInvalidHelp_(message)) return false;

  var type = String(result.type || '').toUpperCase();
  var beforeState = String(sessionBefore && sessionBefore.state || '').toUpperCase();

  // Mode Chat Admin tidak perlu bantuan lagi, bot memang diam.
  if (beforeState === 'ADMIN_HANDOFF' || type === 'AGENT_HANDOFF_INBOUND' || type === 'CONTACT_ADMIN') return false;

  // Balasan yang jelas menunjukkan input tidak dipahami/kurang lengkap.
  if (type.indexOf('INVALID') !== -1) return true;
  if (type.indexOf('NOT_FOUND') !== -1) return true;
  if (type.indexOf('MISSING') !== -1) return true;
  if (type.indexOf('EMPTY') !== -1) return true;

  // Menu utama/fallback umum tidak memunculkan Hubungi Admin.
  // Bantuan ini hanya untuk alur Buat Aduan dan Cek Status/Cek Tiket.
  if (type === 'MAIN_MENU' || type === 'MAIN_MENU_FALLBACK') return false;

  // Saat menunggu ID aduan, teks ngasal berulang akan menghasilkan ASK_ID.
  if (type === 'ASK_ID' && beforeState === 'AWAIT_ID') return true;

  // Saat proses aduan, prompt berikut sering muncul karena format tidak lengkap.
  if (type.indexOf('FAST_ADUAN_') === 0 && type.indexOf('CONFIRM') === -1 && type.indexOf('CREATED') === -1) return true;
  if (type.indexOf('NEW_ADUAN_') === 0 && type.indexOf('CONFIRM') === -1 && type.indexOf('CREATED') === -1) return true;
  if (type === 'ASK_JENIS_GANGGUAN' || type === 'ASK_CABANG') return !!beforeState;

  return false;
}

function buildCustomerInvalidHelpReply_(count) {
  count = Number(count || 3) || 3;
  return [
    'Maaf, sistem belum dapat memahami pesan Anda.',
    '',
    'Anda bisa memilih layanan berikut:',
    '*1.* Buat Aduan',
    '*2.* Cek Status Aduan',
    '*3.* Kembali ke Menu Utama',
    '',
    'Jika ingin dibantu admin, silakan balas: *Hubungi Admin*'
  ].join('\n');
}

function maybeApplyCustomerInvalidHelpAfterTwo_(phone, message, result, sessionBefore, payload) {
  phone = normalizePhone_(phone || '');
  if (!phone || !result) return result;

  // Counter dipisahkan per state supaya kesalahan lama tidak terbawa ke proses baru.
  var type = String(result.type || '').toUpperCase();
  var stateKey = String(sessionBefore && sessionBefore.state || 'MAIN').toUpperCase();

  if (!isCustomerInvalidHelpAllowedContext_(sessionBefore, result)) {
    resetCustomerInvalidInputCounter_(phone, stateKey);
    return result;
  }

  var shouldCount = isCustomerInvalidPromptResultForHelp_(result, message, sessionBefore, payload);

  if (!shouldCount) {
    // Reset pada state saat ini agar bantuan admin tidak muncul karena sisa counter lama.
    resetCustomerInvalidInputCounter_(phone, stateKey);
    return result;
  }

  var count = getCustomerInvalidInputCounter_(phone, stateKey) + 1;
  setCustomerInvalidInputCounter_(phone, count, stateKey);

  if (count >= 3) {
    // Reset setelah menampilkan bantuan agar tidak spam setiap pesan berikutnya.
    resetCustomerInvalidInputCounter_(phone, stateKey);
    return {
      success: true,
      type: 'CUSTOMER_INVALID_3X_HELP_ADMIN',
      reply: buildCustomerInvalidHelpReply_(count),
      navButtons: [
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  return result;
}

function handleWhatsAppWebhook_(e) {
  var webhookStartedAtMs = new Date().getTime();
  try { resetWhatsAppSessionRequestCache_(); } catch(eResetRequestCache) {}
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  var payload = parseIncomingPayload_(raw, e);
  var phone = normalizePhone_(payload.phone || '');
  var customerId = String(payload.customerId || '').trim();
  var message = String(payload.message || '').trim();
  if (phone && payload.customerName) rememberWhatsAppCustomerName_(phone, payload.customerName);

  if (isOutboundOrStatusWhatsAppWebhook_(payload)) {
    logWhatsApp_(phone || customerId || '-', message || raw, 'WEBHOOK_OUTBOUND_STATUS_SKIP', '-', '', 'SKIP', raw);
    return { success: true, skipped: true, reason: 'outbound/status webhook' };
  }

  if (isLikelyOwnBotEchoMessage_(message)) {
    logWhatsApp_(phone || customerId || '-', message, 'WEBHOOK_BOT_ECHO_SKIP', '-', '', 'SKIP', raw);
    return { success: true, skipped: true, reason: 'bot echo webhook' };
  }

  var dedup = checkDuplicateWhatsAppWebhook_(payload, raw);
  if (dedup && dedup.duplicate) {
    logWhatsApp_(phone || customerId || '-', message || raw, 'WEBHOOK_DUPLICATE_SKIP', dedup.messageId || '-', '', 'SKIP', raw);
    return { success: true, skipped: true, reason: 'duplicate webhook', messageId: dedup.messageId || '' };
  }

  if (!message && !phone && !customerId) {
    // V11.0.1 FIX: sebelumnya kurang 1 argumen sehingga kolom "Status Kirim"
    // terisi raw payload dan kolom "Raw Payload" kosong.
    logWhatsApp_('-', raw, 'EMPTY_WEBHOOK', '-', '', 'SKIP', raw);
    return { success: true, skipped: true, reason: 'empty payload' };
  }

  // Untuk session, nomor HP lebih ideal. Jika webhook belum memberi phone,
  // fallback pakai customer_id agar alur chat tetap berjalan.
  // V10.9.269: kalau session sebelumnya tersimpan dengan customerId tetapi pesan berikutnya
  // sudah membawa phone, jangan pindah kunci session secara tiba-tiba. Ini penyebab
  // angka 3/6 setelah daftar cabang kadang terbaca sebagai menu utama.
  var sessionKey = phone || customerId;
  if (phone && customerId) {
    try {
      var sessByPhoneForKey = getWhatsAppSession_(phone);
      var sessByCustomerForKey = getWhatsAppSession_(customerId);
      if (!sessByPhoneForKey && sessByCustomerForKey && sessByCustomerForKey.state) {
        sessionKey = customerId;
      }
    } catch(eSessionKey) {}
  }

  // V10.9.68: Simpan timestamp pesan masuk ke cache untuk optimasi cek window 24 jam.
  // Ini menggantikan scan 300-600 baris LOG_WHATSAPP setiap ada notifikasi status.
  if (phone && message) {
    try {
      CacheService.getScriptCache().put(
        'LAST_INBOUND_' + phone,
        String(new Date().getTime()),
        safeCacheExpirationSeconds_(21600)
      );
    } catch(e) {}
  }

  // V10.9.175: tahan chat ngasal SEBELUM proses menu.
  // Fix race condition: kalau user spam 3-5 pesan cepat, eksekusi webhook paralel
  // duluan dikunci sehingga menu utama tidak terkirim 2-3x.
  if (shouldSuppressIncomingNoiseWhatsAppBeforeMenu_(phone || sessionKey, message, payload)) {
    logWhatsApp_(
      phone || customerId || '-',
      message || raw,
      'WEBHOOK_INBOUND_NOISE_DEBOUNCE_SKIP',
      '-',
      '',
      'SKIP',
      raw
    );
    return {
      success: true,
      skipped: true,
      reason: 'rapid incoming noise before prompt',
      phone: phone,
      customerId: customerId
    };
  }

  // V10.9.181: simpan state sebelum diproses untuk menghitung input salah/kurang jelas.
  var sessionBeforeInvalidHelp = null;
  try { sessionBeforeInvalidHelp = getWhatsAppSession_(sessionKey); } catch(eStateBeforeInvalid) {}

  var result = getWhatsAppMenuResponse_(message, sessionKey, payload);

  // V10.9.270: marker eksplisit saat bot menampilkan daftar cabang.
  // Disimpan dengan phone dan customerId supaya balasan angka 3/6 tidak jatuh ke menu utama.
  try {
    if (result && result.type === 'ASK_CABANG') {
      rememberAduanCabangPromptMarker_(phone || sessionKey, {
        phone: phone,
        customerId: customerId,
        from: payload && payload.from,
        sender: payload && payload.sender
      });
    }
  } catch(eRememberCabangPrompt) {}

  // V10.9.181: jika pelanggan salah input/teks tidak dipahami 2x, tampilkan bantuan Hubungi Admin.
  // Tidak dibuat sebagai menu utama agar pelanggan tetap diarahkan ke Buat Aduan/Cek Status dulu.
  try {
    result = maybeApplyCustomerInvalidHelpAfterTwo_(phone || sessionKey, message, result, sessionBeforeInvalidHelp, payload);
  } catch(eInvalidHelp) {}

  if (result && result.reply) {
    result.reply = maybeAppendBusinessHoursNotice_(result.reply, result.type);

    // V10.9.174: tahan balasan menu/prompt yang sama jika pelanggan/petugas spam chat cepat.
    // Contoh: user kirim teks bebas 3x, bot cukup balas instruksi/menu 1x.
    if (shouldSuppressRapidDuplicateWhatsAppReply_(phone || sessionKey, result)) {
      logWhatsApp_(
        phone || customerId || '-',
        message || raw,
        'WEBHOOK_REPLY_DEBOUNCE_SKIP',
        result.id || '-',
        result.reply,
        'SKIP',
        raw
      );
      return {
        success: true,
        skipped: true,
        reason: 'rapid duplicate prompt reply',
        phone: phone,
        customerId: customerId,
        type: result.type || 'MENU'
      };
    }
  }
  var replyReadyAtMs = new Date().getTime();
  var sendStartedAtMs = replyReadyAtMs;
  var sendResult = { success: true, skipped: true };

  var mode = getRuntimeProp_('WHATSAPP_REPLY_MODE') || CONFIG.WHATSAPP_DEFAULT_REPLY_MODE || 'AUTO';
  var typingIndicatorResult = null;
  if (mode !== 'AUTO') {
    Logger.log('[PENGUMUMAN] tidak dicoba sama sekali: WHATSAPP_REPLY_MODE = "' + mode + '" (bukan AUTO), jadi pengiriman balasan otomatis dilewati di sini.');
  }
  if (mode === 'AUTO' && (customerId || phone) && result.reply) {
    typingIndicatorResult = maybeSendTypingBeforeWhatsAppReply_(phone || sessionKey, customerId, result);
    var pengumumanAwal = getPengumumanForMenu_(result, phone || sessionKey);
    var pengumumanSendResult = null;

    if (pengumumanAwal && phone) {
      pengumumanSendResult = sendWhatsAppMessage_(phone, pengumumanAwal, {
        customerId: customerId,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId,
        customerName: payload.customerName || ''
      });
      // V10.9.44: sleep 500ms dihapus agar webhook WA lebih cepat.
    }

    if (shouldUseInteractiveMenu_() && result.adminCabangMenu && phone) {
      sendResult = sendKiriminAdminCabangMenu_(phone);

      if (!sendResult.success) {
        var adminCabangError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.adminCabangFallbackError = adminCabangError;
      }

    } else if (shouldUseInteractiveMenu_() && result.adminPengumumanEditMenu && phone) {
      sendResult = sendKiriminAdminPengumumanEditMenu_(phone, result.editRows || []);

      if (!sendResult.success) {
        var adminPengumumanEditError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.adminPengumumanEditFallbackError = adminPengumumanEditError;
      }

    } else if (shouldUseInteractiveMenu_() && result.adminPengumumanMenu && phone) {
      sendResult = sendKiriminAdminPengumumanMenu_(phone);

      if (!sendResult.success) {
        var adminPengumumanError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.adminPengumumanFallbackError = adminPengumumanError;
      }

    } else if (shouldUseInteractiveMenu_() && result.adminMenu && phone) {
      sendResult = sendKiriminAdminMenu_(phone, result.petugas);

      if (!sendResult.success) {
        var adminMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.adminMenuFallbackError = adminMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.petugasMenu && phone) {
      sendResult = sendKiriminPetugasMenu_(phone, result.petugas);

      if (!sendResult.success) {
        var petugasMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.petugasMenuFallbackError = petugasMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.petugasAduanListMenu && phone) {
      sendResult = sendKiriminPetugasAduanListMenu_(phone, result.petugasAction, result.aduanList || []);

      if (!sendResult.success) {
        var petugasListError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.petugasListFallbackError = petugasListError;
      }

    } else if (shouldUseInteractiveMenu_() && result.petugasStatusMenu && phone) {
      sendResult = sendKiriminPetugasStatusMenu_(phone);

      if (!sendResult.success) {
        var petugasStatusError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.petugasStatusFallbackError = petugasStatusError;
      }

    } else if (shouldUseInteractiveMenu_() && result.petugasFotoTypeMenu && phone) {
      sendResult = sendKiriminPetugasFotoTypeMenu_(phone);

      if (!sendResult.success) {
        var petugasFotoTypeError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.petugasFotoTypeFallbackError = petugasFotoTypeError;
      }

    } else if (shouldUseInteractiveMenu_() && result.jenisMenu && phone) {
      sendResult = sendKiriminJenisGangguanMenu_(phone);

      if (!sendResult.success) {
        var jenisMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply + '\n\n' + buildJenisGangguanMenu_(), {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.jenisMenuFallbackError = jenisMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.type === 'ASK_CABANG' && phone) {
      sendResult = sendKiriminCabangMenu_(phone, result.page || 1);

      if (!sendResult.success) {
        var cabangInteractiveError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.interactiveFallbackError = cabangInteractiveError;
      }

    } else if (shouldUseInteractiveMenu_() && result.infoLayananMenu && phone) {
      sendResult = sendKiriminInfoLayananMenu_(phone);

      if (!sendResult.success) {
        var infoLayananMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.infoLayananMenuFallbackError = infoLayananMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.riwayatMenu && phone) {
      sendResult = sendKiriminRiwayatAduanMenu_(phone, result.riwayatList || []);

      if (!sendResult.success) {
        var riwayatMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.riwayatMenuFallbackError = riwayatMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result && result.interactiveMenu && phone) {
      // V10.9.233:
      // Jika AI pelanggan belum bisa memastikan maksud pesan, jangan hanya beri tombol "Menu Utama".
      // Kirim menu interaktif yang sama seperti opening chat agar pelanggan bisa langsung memilih layanan.
      sendResult = sendKiriminInteractiveMenu_(phone, {
        customerId: customerId,
        customerPhone: phone,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId,
        customerName: payload.customerName || '',
        bodyText: result.reply || '',
        includeAdmin: !!result.includeAdmin
      });

      if (!sendResult.success) {
        var aiMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply + '\n\nBalas *menu* untuk kembali ke menu utama.', {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.interactiveMenuFallbackError = aiMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && isNavButtonEligible_(result) && phone) {
      sendResult = sendKiriminButtonMessage_(phone, result.reply, result.navButtons);

      if (!sendResult.success) {
        var buttonError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply + '\n\nBalas *menu* untuk kembali ke menu utama.', {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.buttonFallbackError = buttonError;
      }

    } else if (shouldUseInteractiveMenu_() && isMainMenuReply_(result.reply) && phone) {
      sendResult = sendKiriminInteractiveMenu_(phone, {
        customerId: customerId,
        customerPhone: phone,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId,
        customerName: payload.customerName || ''
      });

      if (!sendResult.success) {
        var interactiveError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.interactiveFallbackError = interactiveError;
      }

    } else {
      sendResult = sendWhatsAppMessage_(phone, result.reply, {
        customerId: customerId,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId
      });
    }
  }

  if (pengumumanSendResult) {
    try {
      sendResult.pengumumanAwal = pengumumanSendResult;
    } catch(e) {}
  }

  if (typingIndicatorResult) {
    try {
      sendResult.typingIndicator = typingIndicatorResult;
    } catch(e2) {}
  }

  var sendFinishedAtMs = new Date().getTime();

  logWhatsApp_(
    phone || customerId,
    message,
    result.type || 'MENU',
    result.id || '-',
    result.reply,
    (result.reply ? (sendResult.success ? 'SENT' : ('FAILED: ' + sendResult.error)) : 'NO_REPLY_ADMIN_HANDOFF'),
    raw
  );

  return {
    success: true,
    phone: phone,
    customerId: customerId,
    message: message,
    type: result.type || 'MENU',
    id: result.id || '',
    reply: result.reply,
    send: sendResult,
    performance: {
      replyReadyMs: Math.max(0, replyReadyAtMs - webhookStartedAtMs),
      sendApiMs: Math.max(0, sendFinishedAtMs - sendStartedAtMs),
      totalBeforeLogMs: Math.max(0, sendFinishedAtMs - webhookStartedAtMs),
      fastReply: isWhatsAppFastReplyEnabled_()
    }
  };
}

function parseIncomingPayload_(raw, e) {
  var obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch (err) {
    obj = {};
  }

  var data = obj.data || {};

  var phone = data.customer_phone ||
              data.phone ||
              data.from ||
              obj.customer_phone ||
              obj.phone ||
              obj.from ||
              '';

  var message = data.content ||
                data.text ||
                data.body ||
                data.message ||
                obj.content ||
                obj.text ||
                obj.body ||
                obj.message ||
                '';

  // Reply dari List Menu / Button Interactive.
  var interactiveId =
    data.list_reply_id ||
    data.button_reply_id ||
    data.reply_id ||
    data.selected_id ||
    data.interactive_id ||
    (data.content && data.content.id) ||
    (data.content && data.content.reply && data.content.reply.id) ||
    (data.interactive && data.interactive.list_reply && data.interactive.list_reply.id) ||
    (data.interactive && data.interactive.button_reply && data.interactive.button_reply.id) ||
    (data.list_reply && data.list_reply.id) ||
    (data.button_reply && data.button_reply.id) ||
    '';

  var interactiveTitle =
    data.list_reply_title ||
    data.button_reply_title ||
    data.reply_title ||
    data.selected_title ||
    (data.content && data.content.title) ||
    (data.content && data.content.reply && data.content.reply.title) ||
    (data.interactive && data.interactive.list_reply && data.interactive.list_reply.title) ||
    (data.interactive && data.interactive.button_reply && data.interactive.button_reply.title) ||
    '';

  if (interactiveId) {
    message = mapInteractiveIdToMenuChoice_(interactiveId) || interactiveTitle || interactiveId;
  } else if (interactiveTitle) {
    message = normalizeIncomingListMenuChoice_(interactiveTitle) || interactiveTitle;
  }

  var customerId = data.customer_id ||
                   (data.customer && data.customer.id) ||
                   obj.customer_id ||
                   (obj.customer && obj.customer.id) ||
                   '';

  var channel = obj.channel || data.channel || 'whatsapp';

  var whatsappDeviceId = data.whatsapp_device_id ||
                         data.device_id ||
                         data.channel_id ||
                         obj.whatsapp_device_id ||
                         obj.device_id ||
                         obj.channel_id ||
                         '';

  if (!phone || !message || !customerId) {
    var candidates = [
      obj,
      obj.data || {},
      obj.message || {},
      obj.customer || {},
      obj.payload || {},
      obj.event || {},
      obj.data && obj.data.message ? obj.data.message : {},
      obj.data && obj.data.customer ? obj.data.customer : {}
    ];

    function first(keys) {
      for (var i = 0; i < candidates.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          var v = deepGet_(candidates[i], keys[j]);
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
      }
      return '';
    }

    phone = phone || first([
      'phone', 'from', 'sender', 'sender_phone', 'customer_phone',
      'wa_id', 'number', 'msisdn', 'contact.phone', 'customer.phone',
      'data.customer_phone', 'data.customer.phone'
    ]);

    message = message || first([
      'message', 'text', 'body', 'content', 'caption',
      'message.text', 'message.body', 'message.content',
      'data.message', 'data.text', 'data.body', 'data.content',
      'data.message.text', 'data.message.body', 'data.message.content'
    ]);

    customerId = customerId || first([
      'customer_id', 'customer.id', 'data.customer_id', 'data.customer.id',
      'message.customer_id', 'payload.customer_id'
    ]);
  }

  var customerName = extractCustomerNameFromPayload_(obj);

  var location = extractLocationFromPayload_(obj);
  var media = extractMediaFromPayload_(obj);

  if (!message && media && media.url) {
    message = media.caption || '[FOTO_WHATSAPP]';
  }

  if (typeof message === 'object') {
    if (message.id) message = mapInteractiveIdToMenuChoice_(message.id) || message.title || message.id;
    else if (message.text) message = message.text;
    else if (message.body) message = message.body;
    else if (message.content) message = message.content;
    else if (message.latitude && message.longitude) {
      location = normalizeLocationObject_(message) || location;
      message = '[LOKASI_WHATSAPP]';
    }
    else message = JSON.stringify(message);
  }

  if (!message && location && location.latitude && location.longitude) {
    message = '[LOKASI_WHATSAPP]';
  }

  return {
    phone: normalizePhone_(phone),
    message: String(message || '').trim(),
    customerId: String(customerId || '').trim(),
    channel: String(channel || ''),
    whatsappDeviceId: String(whatsappDeviceId || ''),
    customerName: customerName,
    location: location,
    media: media,
    // V10.9.275: simpan metadata klik button/list agar menu global bisa dibedakan
    // dari teks biasa jika diperlukan pada hotfix berikutnya.
    interactiveId: String(interactiveId || '').trim(),
    interactiveTitle: String(interactiveTitle || '').trim(),
    rawObject: obj
  };
}


function normalizeIncomingListMenuChoice_(text) {
  text = String(text || '').toLowerCase();

  // Bersihkan format teks yang kadang dikirim WA/Kirimin dari List Menu.
  text = text
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  // V10.9.32:
  // Detail "Sambung Kembali" harus dicek sebelum tombol umum "Kembali".
  // Kalau tidak, kata "kembali" di "Sambung Kembali" akan dianggap tombol kembali.
  if (text.indexOf('sambung kembali') !== -1) {
    return 'sambung kembali';
  }

  if (
    text.indexOf('sambungan pindah') !== -1 ||
    text.indexOf('sambungan pemindahan') !== -1 ||
    text.indexOf('pemindahan meter') !== -1 ||
    text.indexOf('alur sambungan pemindahan') !== -1
  ) {
    return 'sambungan pemindahan meter air';
  }

  if (text.indexOf('menu utama') !== -1 || text === 'menu' || text === 'home') {
    return 'menu';
  }

  if (text === '↩ kembali' || text.indexOf('↩ kembali') !== -1 || text === 'kembali' || text.indexOf('kembali') !== -1) {
    return 'kembali';
  }

  if (text.indexOf('cek tiket') !== -1 || text.indexOf('tiket ini') !== -1) {
    return 'cek tiket ini';
  }

  if (text.indexOf('cek lagi') !== -1) {
    return '2';
  }

  // V10.9.64 - Sebagian provider hanya mengirim judul tombol quick reply,
  // bukan ID tombolnya. Judul tombol Aduan Cepat harus dicek sebelum
  // aturan umum "buat aduan", agar "Ya, Buat Aduan" tidak kebaca sebagai menu 1.
  if (text === 'ya, buat aduan' || text === 'ya buat aduan' || text === 'buat aduan sekarang' || text === 'fast confirm yes') {
    return 'fast confirm yes';
  }
  if (text === 'tambah lokasi' || text === 'kirim lokasi' || text === 'share location' || text === 'shareloc' || text === 'fast add location') {
    return 'fast add location';
  }
  if (text === 'ubah data' || text === 'edit data' || text === 'fast edit') {
    return 'fast edit';
  }
  if (text === 'lewati lokasi' || text === 'skip lokasi' || text === 'fast skip location') {
    return 'lewati';
  }

  // V10.9.50 - List menu admin.
  if (text.indexOf('semua aduan aktif') !== -1 || text.indexOf('aduan semua cabang') !== -1) return 'admin semua';
  if (text.indexOf('aduan per cabang') !== -1 || text.indexOf('pilih cabang') !== -1) return 'admin cabang';
  if (text.indexOf('cari aduan') !== -1 || text.indexOf('cari by id') !== -1 || text.indexOf('cari id') !== -1) return 'admin cari';
  if (text.indexOf('rekap hari ini') !== -1) return 'admin rekap';
  if (text.indexOf('kelola pengumuman') !== -1 || text.indexOf('pengumuman layanan') !== -1) return 'admin pengumuman';
  if (text.indexOf('lihat pengumuman aktif') !== -1) return 'admin pengumuman lihat';
  if (text.indexOf('buat pengumuman baru') !== -1) return 'admin pengumuman buat';
  if (text.indexOf('edit pengumuman') !== -1) return 'admin pengumuman edit';
  if (text.indexOf('nonaktifkan pengumuman') !== -1) return 'admin pengumuman nonaktif';
  if (text.indexOf('menu admin') !== -1) return 'admin menu';

  // V10.9.49 - List menu petugas harus dicek sebelum menu pelanggan.
  // Sebelumnya "Daftar Aduan" dari Menu Petugas kebaca sebagai menu pelanggan nomor 3,
  // lalu oleh Menu Petugas dianggap "Upload Foto".
  if (
    text.indexOf('daftar aduan') !== -1 ||
    text.indexOf('lihat aduan aktif cabang') !== -1 ||
    text.indexOf('aduan aktif cabang') !== -1
  ) {
    return 'petugas daftar';
  }

  if (
    text.indexOf('update status') !== -1 ||
    text.indexOf('ubah status') !== -1
  ) {
    return 'petugas update';
  }

  if (
    text === 'cari aduan' ||
    text.indexOf('cari aduan petugas') !== -1 ||
    text.indexOf('cari id aduan') !== -1
  ) {
    return 'petugas cari';
  }

  if (
    text.indexOf('upload foto') !== -1 ||
    text.indexOf('foto bukti') !== -1 ||
    text.indexOf('kirim foto bukti') !== -1
  ) {
    return 'petugas foto';
  }

  if (text.indexOf('menu petugas') !== -1) {
    return 'petugas menu';
  }

  // List menu SIAGA TIARA.
  if (
    text.indexOf('aduan cepat') !== -1 ||
    text.indexOf('lapor cepat') !== -1 ||
    text.indexOf('input cepat') !== -1 ||
    text.indexOf('keluhan sekaligus') !== -1
  ) {
    return '1';
  }

  if (
    text.indexOf('buat aduan') !== -1 ||
    text.indexOf('aduan baru') !== -1 ||
    text.indexOf('laporkan gangguan') !== -1 ||
    text.indexOf('lapor gangguan') !== -1
  ) {
    return '1';
  }

  if (
    text.indexOf('cek status') !== -1 ||
    text.indexOf('status aduan') !== -1 ||
    text.indexOf('cek progres') !== -1 ||
    text.indexOf('progres berdasarkan id') !== -1
  ) {
    return '2';
  }

  if (
    text.indexOf('lihat aduan') !== -1 ||
    text.indexOf('riwayat') !== -1 ||
    text.indexOf('aduan saya') !== -1 ||
    text.indexOf('aduan aktif') !== -1 ||
    text.indexOf('daftar aduan') !== -1 ||
    text.indexOf('nomor whatsapp ini') !== -1
  ) {
    return '2';
  }

  if (
    text.indexOf('cek tagihan') !== -1 ||
    text.indexOf('tagihan pelanggan') !== -1 ||
    text.indexOf('tagihan berdasarkan no pelanggan') !== -1 ||
    text.indexOf('cek rekening') !== -1
  ) {
    return '3';
  }

  // V10.9.31 - Detail Info Layanan harus dicek dulu sebelum menu induk.
  if (text.indexOf('cara bayar') !== -1 || text.indexOf('panduan pembayaran tagihan') !== -1) return 'cara bayar';
  if (
    text.indexOf('kendala bayar') !== -1 ||
    text.indexOf('kendala pembayaran') !== -1 ||
    text.indexOf('sudah bayar/status') !== -1 ||
    text.indexOf('status belum berubah') !== -1 ||
    text.indexOf('sudah bayar') !== -1
  ) return 'kendala pembayaran';

  if (text.indexOf('air tangki') !== -1) return 'air tangki';
  if (text.indexOf('balik nama') !== -1) return 'balik nama';
  if (
    text.indexOf('sambungan pindah') !== -1 ||
    text.indexOf('sambungan pemindahan') !== -1 ||
    text.indexOf('pemindahan meter') !== -1
  ) return 'sambungan pemindahan meter air';
  if (text.indexOf('pindah meter') !== -1) return 'pindah meter air';
  if (text.indexOf('sambung kembali') !== -1) return 'sambung kembali';

  if (
    text.indexOf('info layanan') !== -1 ||
    text.indexOf('info pembayaran') !== -1 ||
    text.indexOf('pembayaran') !== -1
  ) {
    return 'info pembayaran';
  }

  if (
    text.indexOf('hubungi admin') !== -1 ||
    text.indexOf('customer support') !== -1 ||
    text.indexOf('chat manual') !== -1 ||
    text.indexOf('admin/petugas') !== -1
  ) {
    return 'hubungi admin';
  }

  return '';
}

function mapInteractiveIdToMenuChoice_(id) {
  id = String(id || '').toUpperCase().trim();

  // V10.9.50 - Menu Admin.
  if (id === 'ADMIN_MENU') return 'admin menu';
  if (id === 'ADMIN_ALL') return 'admin semua';
  if (id.indexOf('ADMIN_ALL_PAGE_') === 0) return 'admin semua page ' + id.substring('ADMIN_ALL_PAGE_'.length);
  if (id === 'ADMIN_CABANG') return 'admin cabang';
  if (id.indexOf('ADMIN_CABANG_PAGE_') === 0) {
    var cabangPageTail = id.substring('ADMIN_CABANG_PAGE_'.length);
    var cabangPageParts = cabangPageTail.split('_');
    var cabangPageNum = cabangPageParts.pop();
    return 'admin cabang page ' + cabangPageParts.join('_') + ' ' + cabangPageNum;
  }
  if (id.indexOf('ADMIN_CABANG_') === 0) return 'admin cabang ' + id.substring('ADMIN_CABANG_'.length);
  if (id === 'ADMIN_CARI') return 'admin cari';
  if (id === 'ADMIN_REKAP') return 'admin rekap';
  if (id === 'ADMIN_PENGUMUMAN') return 'admin pengumuman';
  if (id === 'ADMIN_PENGUMUMAN_LIHAT') return 'admin pengumuman lihat';
  if (id === 'ADMIN_PENGUMUMAN_BUAT') return 'admin pengumuman buat';
  if (id === 'ADMIN_PENGUMUMAN_EDIT') return 'admin pengumuman edit';
  if (id.indexOf('ADMIN_PENGUMUMAN_EDIT_ROW_') === 0) return 'admin pengumuman edit row ' + id.substring('ADMIN_PENGUMUMAN_EDIT_ROW_'.length);
  if (id === 'ADMIN_PENGUMUMAN_NONAKTIF') return 'admin pengumuman nonaktif';

  // V10.9.45 - Menu Petugas / Dokumentasi Foto.
  if (id.indexOf('PETUGAS_ADUAN_') === 0) return 'petugas aduan ' + id.substring('PETUGAS_ADUAN_'.length);
  if (id.indexOf('PETUGAS_UPDATE_') === 0) return 'petugas update ' + id.substring('PETUGAS_UPDATE_'.length);
  if (id.indexOf('PETUGAS_FOTO_TYPE_') === 0) return 'petugas foto jenis ' + id.substring('PETUGAS_FOTO_TYPE_'.length);
  if (id.indexOf('PETUGAS_FOTO_') === 0) return 'petugas foto ' + id.substring('PETUGAS_FOTO_'.length);
  if (id.indexOf('PETUGAS_STATUS_') === 0) return 'petugas status ' + id.substring('PETUGAS_STATUS_'.length);
  if (id === 'PETUGAS_MENU') return 'petugas menu';
  if (id === 'PETUGAS_CONFIRM_STATUS_YA') return 'petugas_confirm_status_ya';
  if (id === 'PETUGAS_CONFIRM_STATUS_TIDAK') return 'petugas_confirm_status_tidak';
  if (id === 'PETUGAS_DAFTAR') return 'petugas daftar';
  if (id === 'PETUGAS_CARI') return 'petugas cari';
  if (id === 'PETUGAS_UPDATE') return 'petugas update';
  if (id === 'PETUGAS_UPLOAD_FOTO') return 'petugas foto';
  if (id === 'PETUGAS_SELESAI_YA') return 'petugas selesai ya';
  if (id === 'PETUGAS_SELESAI_TIDAK') return 'petugas selesai tidak';
  if (id === 'PHOTO_LAST') return 'lihat foto';
  if (id.indexOf('PHOTO_') === 0) return 'lihat foto ' + id.substring('PHOTO_'.length);

  // Cabang pelanggan.
  if (id === 'CABANG_PAGE_2') return 'cabang page 2';
  if (id === 'CABANG_PAGE_1') return 'cabang page 1';
  if (id === 'CABANG_PRY') return 'Cabang Praya';
  if (id === 'CABANG_PTE') return 'Cabang Praya Tengah';
  if (id === 'CABANG_PRB') return 'Cabang Praya Barat';
  if (id === 'CABANG_PBD') return 'Cabang Praya Barat Daya';
  if (id === 'CABANG_PRBD') return 'Cabang Praya Barat Daya';
  if (id === 'CABANG_PRT') return 'Cabang Praya Timur';
  if (id === 'CABANG_PJT') return 'Cabang Pujut';
  if (id === 'CABANG_JGT') return 'Cabang Jonggat';
  if (id === 'CABANG_BTK') return 'Cabang Batukliang';
  if (id === 'CABANG_BKU') return 'Cabang Batukliang Utara';
  if (id === 'CABANG_BTU') return 'Cabang Batukliang Utara';
  if (id === 'CABANG_KPG') return 'Cabang Kopang';
  if (id === 'CABANG_JNP') return 'Cabang Janapria';
  if (id === 'CABANG_PGR') return 'Cabang Pringgarata';

  // Tombol pelanggan untuk tiket/foto.
  if (id.indexOf('CEK_TIKET_') === 0) return id.substring('CEK_TIKET_'.length);
  if (id === 'CEK_TIKET_INI' || id === 'CEK_TIKET') return 'cek tiket ini';

  // V10.9.115 - Menu Buat Aduan memakai alur satu pesan yang sebelumnya bernama Aduan Cepat.
  if (id === 'MENU_2_ADUAN_CEPAT' || id === 'MENU_ADUAN_CEPAT' || id === 'ADUAN_CEPAT' || id === 'ROW_ADUAN_CEPAT') return '1';
  if (id === 'FAST_CONFIRM_YES') return 'fast confirm yes';
  if (id === 'FAST_EDIT') return 'fast edit';
  if (id === 'FAST_ADD_LOCATION') return 'fast add location';
  if (id === 'FAST_SKIP_LOCATION') return 'lewati';

  var map = {
    // Menu pelanggan terbaru:
    // 1 Buat Aduan, 2 Cek Status Aduan, 3 Cek Tagihan, 4 Info Layanan.
    'MENU_1_ADUAN': '1',
    'MENU_ADUAN_BARU': '1',
    'BUAT_ADUAN': '1',
    'ADUAN_BARU': '1',
    'ROW_ADUAN': '1',
    'BUAT_ADUAN_BARU': '1',

    'MENU_2_STATUS': '2',
    'MENU_CEK_STATUS': '2',
    'CEK_STATUS': '2',
    'ROW_STATUS': '2',
    'CEK_STATUS_ADUAN': '2',
    'NAV_BACK_STATUS': '2',

    'MENU_3_ADUAN_SAYA': '2',
    'MENU_LIHAT_ADUAN': '2',
    'ADUAN_SAYA': '2',
    'ROW_ADUAN_SAYA': '2',
    'LIHAT_ADUAN_SAYA': '2',

    'MENU_4_CEK_TAGIHAN': '3',
    'MENU_CEK_TAGIHAN': '3',
    'CEK_TAGIHAN': '3',
    'ROW_TAGIHAN': '3',

    'MENU_5_INFO_LAYANAN': 'info pembayaran',
    'MENU_4_ADMIN': 'info pembayaran',
    'MENU_4_INFO_PEMBAYARAN': 'info pembayaran',
    'INFO_PEMBAYARAN': 'info pembayaran',
    'PAY_INFO': 'info pembayaran',
    'PAY_SAMBUNGAN_BARU': 'sambungan baru',
    'PAY_CARA_BAYAR': 'cara bayar',
    'PAY_KENDALA_BAYAR': 'kendala pembayaran',
    'PAY_AIR_TANGKI': 'air tangki',
    'PAY_BALIK_NAMA': 'balik nama',
    'PAY_PINDAH_METER': 'pindah meter air',
    'PAY_SAMBUNG_KEMBALI': 'sambung kembali',
    'PAY_SAMBUNG_PINDAH': 'sambungan pemindahan meter air',
    'PAY_ADMIN': 'hubungi admin',
    'NAV_MENU': 'menu',
    'NAV_BACK': 'menu',

    // Tombol kontrol proses input aduan.
    'ADUAN_CANCEL': 'batal',
    'ADUAN_BACK': '__ADUAN_BACK__',

    'MENU_HUBUNGI_ADMIN': 'hubungi admin',
    'HUBUNGI_ADMIN': 'hubungi admin',
    'ROW_SUPPORT': 'hubungi admin',
    'HUBUNGI_ADMIN_PETUGAS': 'hubungi admin'
  };
  return map[id] || '';
}


function deepGet_(obj, path) {
  if (!obj || !path) return undefined;
  var parts = String(path).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function normalizePhone_(phone) {
  phone = String(phone || '').trim();

  // V10.9.101: aman jika nomor WA dari sheet terbaca dalam format scientific notation, misal 6.2819E+12.
  if (/^[0-9]+(?:\.[0-9]+)?e\+?[0-9]+$/i.test(phone)) {
    var n = Number(phone);
    if (isFinite(n)) phone = Utilities.formatString('%.0f', n);
  }

  phone = phone.replace(/@c\.us|@s\.whatsapp\.net|@g\.us/gi, '');
  phone = phone.replace(/[^0-9+]/g, '');
  if (phone.indexOf('+') === 0) phone = phone.substring(1);
  if (phone.indexOf('08') === 0) phone = '62' + phone.substring(1);
  if (phone.indexOf('8') === 0) phone = '62' + phone;
  return phone;
}

function normalizeId_(id) {
  return String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}


function sendWhatsAppMessage_(phone, message, options) {
  options = options || {};
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') || '';
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var provider = props.getProperty('WHATSAPP_PROVIDER') || CONFIG.WHATSAPP_PROVIDER || 'KIRIMIN_ID';
  var deviceId = options.whatsappDeviceId || props.getProperty('WHATSAPP_DEVICE_ID') || CONFIG.WHATSAPP_DEVICE_ID || '';
  var customerId = options.customerId || '';

  if (!endpoint || !token) {
    return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  }

  var body;
  var resolveInfo = null;

  if (provider === 'KIRIMIN_ID') {
    if (!customerId) {
      // V10.9.6:
      // Untuk Kirimin ID, kirim langsung via phone_number lebih cepat daripada lookup customer_id.
      var directByPhone = sendKiriminTextByPhoneNumber_(phone, message);
      directByPhone.fastMode = true;
      directByPhone.via = directByPhone.via || 'phone_number_direct';
      return directByPhone;
    }

    if (!deviceId) {
      return {
        success: false,
        error: 'whatsapp_device_id belum diset. Jalankan menu Simpan Konfigurasi API WhatsApp.'
      };
    }

    body = {
      channel: 'whatsapp',
      whatsapp_device_id: deviceId,
      customer_id: customerId,
      message_type: 'text',
      content: String(message || '')
    };

  } else {
    var phoneField = props.getProperty('WHATSAPP_PHONE_FIELD') || 'phone';
    var messageField = props.getProperty('WHATSAPP_MESSAGE_FIELD') || 'message';
    body = {};
    body[phoneField] = normalizePhone_(phone);
    body[messageField] = String(message || '');
  }

  try {
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body)
    });

    var statusCode = res.getResponseCode();
    var text = res.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      return { success: true, statusCode: statusCode, response: text, requestBody: body, resolveInfo: resolveInfo };
    }

    return { success: false, statusCode: statusCode, error: text, requestBody: body, resolveInfo: resolveInfo };

  } catch (err) {
    return { success: false, error: err.message, requestBody: body, resolveInfo: resolveInfo };
  }
}

function resolveKiriminCustomerIdByPhone_(phone) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var rawPhone = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!rawPhone) return { success: false, error: 'Nomor HP kosong dari webhook.' };

  var endpointPattern = props.getProperty('WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT') ||
    CONFIG.WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}';

  var phoneVariants = buildPhoneVariantsForKirimin_(rawPhone);
  var endpointVariants = buildCustomerByPhoneEndpointVariants_(endpointPattern, phoneVariants);
  var lastError = '';

  for (var i = 0; i < endpointVariants.length; i++) {
    var url = endpointVariants[i];

    try {
      var res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json'
        }
      });

      var statusCode = res.getResponseCode();
      var text = res.getContentText();
      var obj = parseJsonSafe_(text);
      var customerId = extractCustomerIdFromKiriminResponse_(obj);

      if (statusCode >= 200 && statusCode < 300 && customerId) {
        return { success: true, customerId: customerId, url: url, statusCode: statusCode, raw: text };
      }

      lastError = 'HTTP ' + statusCode + ' ' + text;

    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    success: false,
    error: lastError || 'Tidak ada customer_id dari semua endpoint percobaan.',
    tried: endpointVariants,
    phone: rawPhone
  };
}

function buildPhoneVariantsForKirimin_(phone) {
  phone = normalizePhone_(phone || '');
  var list = [];
  var seen = {};

  function add(v) {
    v = String(v || '').trim();
    if (v && !seen[v]) {
      seen[v] = true;
      list.push(v);
    }
  }

  add(phone);
  add('+' + phone);
  if (phone.indexOf('62') === 0) add('0' + phone.substring(2));
  return list;
}

function buildCustomerByPhoneEndpointVariants_(pattern, phones) {
  var list = [];
  var seen = {};

  function add(url) {
    url = String(url || '').trim();
    if (url && !seen[url]) {
      seen[url] = true;
      list.push(url);
    }
  }

  pattern = String(pattern || '').trim();
  if (!pattern) pattern = 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}';

  phones.forEach(function(p) {
    var encoded = encodeURIComponent(p);
    add(pattern.replace('{phone}', encoded));
    add('https://apiapp.kirimin.id/api/v1/public/customers/phone/' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers/by-phone/' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers?phone=' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers?customer_phone=' + encoded);
  });

  return list;
}

function extractCustomerIdFromKiriminResponse_(obj) {
  if (!obj) return '';

  var candidates = [
    obj.customer_id,
    obj.id,
    obj.data && obj.data.customer_id,
    obj.data && obj.data.id,
    obj.data && obj.data.customer && obj.data.customer.id,
    obj.customer && obj.customer.id,
    obj.result && obj.result.id,
    obj.result && obj.result.customer_id
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) return String(candidates[i]);
  }

  if (Array.isArray(obj.data) && obj.data.length) {
    for (var j = 0; j < obj.data.length; j++) {
      var item = obj.data[j] || {};
      if (item.id) return String(item.id);
      if (item.customer_id) return String(item.customer_id);
    }
  }

  if (obj.data && Array.isArray(obj.data.customers) && obj.data.customers.length) {
    for (var k = 0; k < obj.data.customers.length; k++) {
      var c = obj.data.customers[k] || {};
      if (c.id) return String(c.id);
      if (c.customer_id) return String(c.customer_id);
    }
  }

  return '';
}

function testKiriminResolveCustomerByPhone() {
  var ui = SpreadsheetApp.getUi();
  var phonePrompt = ui.prompt(
    'Tes Kirimin ID - Cari customer_id dari No HP',
    'Masukkan nomor HP pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (phonePrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = resolveKiriminCustomerIdByPhone_(phonePrompt.getResponseText());

  ui.alert(
    result.success ? '✅ customer_id ditemukan' : '❌ customer_id belum ditemukan',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function testKiriminSendMessage() {
  var ui = SpreadsheetApp.getUi();

  var targetPrompt = ui.prompt(
    'Tes Kirimin ID - customer_id / No HP',
    'Masukkan customer_id dari payload webhook.\n\nJika belum punya customer_id, boleh isi nomor HP pelanggan.\nContoh nomor: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var msgPrompt = ui.prompt(
    'Tes Kirimin ID - Pesan',
    'Masukkan isi pesan tes:',
    ui.ButtonSet.OK_CANCEL
  );
  if (msgPrompt.getSelectedButton() !== ui.Button.OK) return;

  var target = targetPrompt.getResponseText().trim();
  var isLikelyPhone = /^(\+?62|0)\d{8,15}$/.test(target);

  var result = sendWhatsAppMessage_(isLikelyPhone ? target : '', msgPrompt.getResponseText(), {
    customerId: isLikelyPhone ? '' : target
  });

  ui.alert(
    result.success ? '✅ Berhasil' : '❌ Gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


// ============================================================
// V8.6 - WhatsApp Interactive Menu / List Button
// ============================================================

function shouldUseInteractiveMenu_() {
  // V10.9.11: cache hasil per eksekusi - tidak perlu buka PropertiesService 5x
  if (_interactiveMenuFlag !== null) return _interactiveMenuFlag;
  var v = getRuntimeProp_('WHATSAPP_USE_INTERACTIVE_MENU') || CONFIG.WHATSAPP_USE_INTERACTIVE_MENU || 'YA';
  _interactiveMenuFlag = String(v).toUpperCase() === 'YA';
  return _interactiveMenuFlag;
}

function isMainMenuReply_(reply) {
  reply = String(reply || '');
  return reply.indexOf('PERUMDAM Tirta Ardhia Rinjani') !== -1 &&
         (
           reply.indexOf('Buat aduan') !== -1 ||
           reply.indexOf('Buat Aduan') !== -1 ||
           reply.indexOf('Silakan pilih layanan') !== -1
         );
}


// ============================================================
// V10.9.33 - PENGUMUMAN LAYANAN SEBELUM MENU UTAMA
// ============================================================

function setupPengumumanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = ['STATUS', 'JUDUL', 'ISI', 'MULAI', 'SELESAI', 'URUTAN', 'CABANG', 'WILAYAH_TERDAMPAK', 'JENIS_DICEGAH', 'CEGAH_ADUAN'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 520);
  sh.setColumnWidth(4, 120);
  sh.setColumnWidth(5, 120);
  sh.setColumnWidth(6, 80);
  sh.setColumnWidth(7, 180);
  sh.setColumnWidth(8, 320);
  sh.setColumnWidth(9, 240);
  sh.setColumnWidth(10, 120);

  if (sh.getLastRow() < 2) {
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

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Pengumuman siap',
      'Isi sheet PENGUMUMAN lalu ubah STATUS menjadi AKTIF.\n\nKolom:\nSTATUS | JUDUL | ISI | MULAI | SELESAI | URUTAN | CABANG | WILAYAH_TERDAMPAK | JENIS_DICEGAH | CEGAH_ADUAN',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}
}

function openPengumumanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    setupPengumumanSheet();
    sh = ss.getSheetByName(sheetName);
  }
  ss.setActiveSheet(sh);
}

function parsePengumumanDate_(value, endOfDay) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    var d0 = new Date(value.getTime());
    if (endOfDay) d0.setHours(23, 59, 59, 999);
    else d0.setHours(0, 0, 0, 0);
    return d0;
  }

  var text = String(value || '').trim();
  if (!text) return null;

  var d = new Date(text);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function getActivePengumuman_() {
  var cacheKey = 'SIAGA_ACTIVE_PENGUMUMAN_V10933';
  var cached = cacheGet_(cacheKey);
  if (cached) {
    try {
      var obj = JSON.parse(cached);
      if (obj && obj.message) { Logger.log('[PENGUMUMAN] cache HIT -> aktif: ' + obj.key); return obj; }
      if (obj && obj.none) { Logger.log('[PENGUMUMAN] cache HIT -> tidak ada yang aktif (cache 5 menit terakhir)'); return null; }
    } catch(e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) {
    Logger.log('[PENGUMUMAN] sheet "' + sheetName + '" tidak ditemukan atau kosong (lastRow=' + (sh ? sh.getLastRow() : 'no-sheet') + ')');
    cachePut_(cacheKey, JSON.stringify({ none: true }), 300);
    return null;
  }

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(10, Math.max(6, sh.getLastColumn()))).getValues();
  var now = new Date();
  var active = [];

  var expiredRows = [];
  var autoNonaktif = String(getSiagaRuntimeSetting_('PENGUMUMAN_AUTO_NONAKTIF_EXPIRED', CONFIG.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED || 'YA')).toUpperCase() === 'YA';

  values.forEach(function(row, idx) {
    var status = String(row[0] || '').trim().toUpperCase();
    var judul = String(row[1] || '').trim();
    var isi = String(row[2] || '').trim();
    var mulai = parsePengumumanDate_(row[3], false);
    var selesai = parsePengumumanDate_(row[4], true);
    var urutan = Number(row[5] || 999);
    var cabang = String(row[6] || '').trim() || 'Semua Cabang';
    var wilayahTerdampak = String(row[7] || '').trim();
    var jenisDicegah = String(row[8] || '').trim() || 'air mati, air kecil, tekanan rendah, distribusi terganggu';
    var cegahAduan = String(row[9] || '').trim().toUpperCase();

    if (!isi) { Logger.log('[PENGUMUMAN] baris ' + (idx + 2) + ' dilewati: kolom ISI kosong'); return; }
    if (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) === -1) { Logger.log('[PENGUMUMAN] baris ' + (idx + 2) + ' dilewati: STATUS = "' + status + '" (harus AKTIF/YA/ON/TRUE/1)'); return; }
    if (mulai && now < mulai) { Logger.log('[PENGUMUMAN] baris ' + (idx + 2) + ' dilewati: tanggal MULAI (' + mulai + ') masih di masa depan'); return; }

    // V10.9.35:
    // Jika tanggal selesai sudah lewat, pengumuman tidak tampil.
    // Bila autoNonaktif aktif, STATUS di sheet ikut diubah menjadi NONAKTIF.
    if (selesai && now > selesai) {
      Logger.log('[PENGUMUMAN] baris ' + (idx + 2) + ' dilewati: tanggal SELESAI (' + selesai + ') sudah lewat');
      if (autoNonaktif) expiredRows.push(idx + 2); // data mulai dari baris 2
      return;
    }

    Logger.log('[PENGUMUMAN] baris ' + (idx + 2) + ' AKTIF & lolos semua cek (judul: "' + judul + '", urutan: ' + urutan + ')');
    active.push({
      judul: judul,
      isi: isi,
      urutan: urutan,
      cabang: cabang,
      wilayahTerdampak: wilayahTerdampak,
      jenisDicegah: jenisDicegah,
      cegahAduan: (['YA', 'ON', 'TRUE', '1', 'AKTIF'].indexOf(cegahAduan) !== -1) ? 'YA' : 'TIDAK'
    });
  });

  if (expiredRows.length) {
    expiredRows.forEach(function(rowNumber) {
      try { sh.getRange(rowNumber, 1).setValue('NONAKTIF'); } catch(e) {}
    });
  }

  if (!active.length) {
    cachePut_(cacheKey, JSON.stringify({ none: true }), 300);
    return null;
  }

  active.sort(function(a, b) {
    return (a.urutan || 999) - (b.urutan || 999);
  });

  var item = active[0];
  var lines = ['📢 *Pengumuman Layanan*', ''];
  if (item.judul) lines.push('*' + item.judul + '*', '');
  lines.push(item.isi);

  var message = lines.join('\n');
  var result = {
    message: message,
    key: Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, message)).substring(0, 16),
    items: active
  };

  cachePut_(cacheKey, JSON.stringify(result), 300);
  return result;
}

function shouldAttachPengumumanBeforeMenu_(result) {
  if (!result || !result.reply) return false;

  var type = String(result.type || '');
  if (type !== 'MAIN_MENU' && type !== 'MAIN_MENU_FALLBACK' && type !== 'MAIN_MENU_GREETING') {
    Logger.log('[PENGUMUMAN] tidak dicoba: type balasan ini adalah "' + type + '" (bukan menu utama, jadi memang seharusnya tidak muncul di sini)');
    return false;
  }

  // Hanya untuk menu utama full list, bukan detail layanan atau pesan status.
  var isMenu = isMainMenuReply_(result.reply);
  if (!isMenu) Logger.log('[PENGUMUMAN] tidak dicoba: type = "' + type + '" tapi teks balasan tidak dikenali sebagai menu utama oleh isMainMenuReply_()');
  return isMenu;
}

function getPengumumanForMenu_(result, phone) {
  if (!shouldAttachPengumumanBeforeMenu_(result)) return '';

  var pengumuman = getActivePengumuman_();
  if (!pengumuman || !pengumuman.message) {
    Logger.log('[PENGUMUMAN] tidak ada pengumuman aktif untuk ditampilkan (cek log getActivePengumuman_ di atas untuk alasan detail per baris)');
    return '';
  }

  // Supaya tidak terlalu spam: tampil maksimal 1x per nomor per 6 jam untuk pengumuman yang sama.
  var p = normalizePhone_(phone || '');
  if (p) {
    var sentKey = 'SIAGA_PENGUMUMAN_SENT_' + p + '_' + pengumuman.key;
    if (cacheGet_(sentKey)) {
      Logger.log('[PENGUMUMAN] TIDAK dikirim ke ' + p + ': sudah pernah dikirim dalam periode "Tampilkan ulang per nomor (jam)" saat ini. Ganti nomor tes, tunggu periodenya habis, atau set field itu ke 0 supaya tidak pernah ditahan cache.');
      return '';
    }

    var repeatHours = Number(getSiagaRuntimeSetting_('PENGUMUMAN_REPEAT_HOURS', CONFIG.PENGUMUMAN_REPEAT_HOURS || 6));
    if (isNaN(repeatHours)) repeatHours = 6;

    // Jika 0, tidak disimpan ke cache agar pengumuman muncul setiap buka Menu Utama.
    if (repeatHours > 0) {
      cachePut_(sentKey, '1', Math.max(60, repeatHours * 3600));
    }
  }

  Logger.log('[PENGUMUMAN] DIKIRIM ke ' + p + ': "' + pengumuman.key + '"');
  return pengumuman.message;
}


function buildInteractiveMenuBody_(phone, payload) {
  payload = payload || {};
  var rows = [
    {
      id: 'MENU_2_ADUAN_CEPAT',
      title: 'Buat Aduan',
      description: 'Pilih cabang lalu isi data aduan'
    },
    {
      id: 'MENU_2_STATUS',
      title: 'Cek Status Aduan',
      description: 'Otomatis dari nomor WA atau kirim ID aduan'
    },
    {
      id: 'MENU_4_CEK_TAGIHAN',
      title: 'Cek Tagihan',
      description: 'Cek tagihan berdasarkan No Pelanggan'
    },
    {
      id: 'MENU_5_INFO_LAYANAN',
      title: 'Info Layanan',
      description: 'Informasi layanan pelanggan'
    }
  ];

  if (payload.includeAdmin) {
    rows.push({
      id: 'PAY_ADMIN',
      title: 'Hubungi Admin',
      description: 'Bantuan lanjutan oleh Admin Pusat'
    });
  }

  var bodyText = String(payload.bodyText || '').trim();
  if (!bodyText) {
    bodyText = buildWhatsAppOpeningGreeting_(phone, payload) + '\n\nSaya adalah *SIAGA TIARA*, layanan informasi aduan gangguan air.\n\nSilakan pilih layanan yang Anda butuhkan.';
  }

  return {
    body: bodyText,
    button: 'Pilih Layanan',
    sections: [
      {
        title: 'Layanan Utama',
        rows: rows
      }
    ]
  };
}


// ============================================================
// INTERACTIVE NAVIGATION BUTTONS - KEMBALI / MENU UTAMA
// ============================================================


// ============================================================
// HOTFIX V10.9.10 - STATUS NOTIFICATION USES 3 CLEAN NAV BUTTONS
// HOTFIX V10.9.1 - FORCE CONTEXT BUTTONS
// ============================================================


// ============================================================
// V10.9.18 - LAST CREATED TICKET CACHE
// ============================================================
// Beberapa provider WA kadang hanya mengirim title tombol "Cek Tiket Ini",
// bukan id tombol CEK_TIKET_<ID>. Karena title tidak membawa ID,
// sistem menyimpan ID tiket terakhir per nomor WA agar tombol tetap jalan.

function getLastTicketCacheKey_(phone) {
  return 'LAST_TICKET_' + normalizePhone_(phone || '');
}

function setLastCreatedAduanIdForPhone_(phone, aduanId) {
  phone = normalizePhone_(phone || '');
  aduanId = normalizeAduanIdHyphen_(aduanId || '');
  if (!phone || !aduanId) return;

  try {
    var cache = getRuntimeCache_();
    if (cache) {
      cache.put(getLastTicketCacheKey_(phone), aduanId, 21600); // 6 jam
    }
  } catch (e) {}

  try {
    PropertiesService.getScriptProperties().setProperty(getLastTicketCacheKey_(phone), aduanId);
  } catch (e2) {}
}

function getLastCreatedAduanIdForPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return '';

  var key = getLastTicketCacheKey_(phone);

  try {
    var cache = getRuntimeCache_();
    var fromCache = cache ? cache.get(key) : '';
    if (fromCache) return normalizeAduanIdHyphen_(fromCache);
  } catch (e) {}

  try {
    return normalizeAduanIdHyphen_(PropertiesService.getScriptProperties().getProperty(key) || '');
  } catch (e2) {
    return '';
  }
}

function handleCekTiketIni_(phone) {
  var id = getLastCreatedAduanIdForPhone_(phone);
  if (id) {
    var d = findAduanById_(id);
    if (d) {
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'CEK_TIKET_INI',
        id: d.id,
        reply: buildWhatsAppTrackingReply_(d),
        navButtons: buildStatusNavButtonsForAduan_(d)
      };
    }
  }

  // Kalau cache hilang/cold start, fallback ke aduan terakhir nomor tersebut.
  return handleListOrLatestAduan_(phone);
}


function buildCreatedTicketButtons_(aduanId) {
  aduanId = normalizeAduanIdHyphen_(aduanId || '');
  if (!aduanId) return buildNavButtons_('created');

  return [
    { id: 'CEK_TIKET_' + aduanId, title: 'Cek Tiket Ini' },
    { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildNavButtons_(type) {
  type = String(type || '').toLowerCase();

  if (type === 'status') {
    return [
      { id: 'NAV_BACK_STATUS', title: 'Kembali' },
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'created') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'not_found') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'active_limit') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'outside_hours') {
    return [
      { id: 'MENU_4_CEK_TAGIHAN', title: 'Cek Tagihan' },
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'MENU_5_INFO_LAYANAN', title: 'Info Layanan' }
    ];
  }

  if (type === 'main') {
    return [
      { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
      { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' }
    ];
  }

  return [
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function isNavButtonEligible_(result) {
  return !!(result && result.reply && result.navButtons && result.navButtons.length);
}

function sendKiriminButtonMessage_(phone, message, buttons) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk button message.' };

  buttons = (buttons || []).slice(0, 3).map(function(btn) {
    return {
      type: 'reply',
      reply: {
        id: String(btn.id || btn.title || '').substring(0, 256),
        title: String(btn.title || 'Menu').substring(0, 20)
      }
    };
  });

  if (buttons.length === 0) {
    buttons = buildNavButtons_('main').map(function(btn) {
      return {
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title
        }
      };
    });
  }

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: String(message || '')
      },
      action: {
        buttons: buttons
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function testKiriminButtonMessage() {
  var ui = SpreadsheetApp.getUi();
  var targetPrompt = ui.prompt(
    'Tes Reply Button WhatsApp',
    'Masukkan nomor HP. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminButtonMessage_(
    phone,
    'Tes tombol SIAGA TIARA.\n\nPilih salah satu layanan:',
    buildNavButtons_('status')
  );

  ui.alert(
    result.success ? '✅ Tombol terkirim' : '❌ Tombol gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function sendKiriminInteractiveMenu_(phone, options) {
  options = options || {};
  var props = PropertiesService.getScriptProperties();

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';

  // FIX V9.1:
  // Kirimin menolak /messages/send/interactive dengan route not found.
  // Jadi interactive dikirim ke endpoint utama /messages/send sesuai body dokumentasi.
  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var phoneNumber = normalizePhone_(phone || '');
  if (!phoneNumber && options.customerPhone) phoneNumber = normalizePhone_(options.customerPhone);

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk List Menu.' };

  var menu = buildInteractiveMenuBody_(phoneNumber, {
    customerName: options.customerName || '',
    bodyText: options.bodyText || '',
    includeAdmin: !!options.includeAdmin
  });

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: menu.body
      },
      action: {
        button: menu.button,
        sections: menu.sections
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function postKiriminJson_(url, token, body) {
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body)
    });

    var code = res.getResponseCode();
    var text = res.getContentText();

    return {
      success: code >= 200 && code < 300,
      statusCode: code,
      response: text,
      requestBody: body,
      url: url
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      requestBody: body,
      url: url
    };
  }
}



function testKiriminInteractiveMenu() {
  var ui = SpreadsheetApp.getUi();

  var targetPrompt = ui.prompt(
    'Tes List Menu WhatsApp',
    'Masukkan nomor HP pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminInteractiveMenu_(phone, { customerPhone: phone });

  if (!result.success) {
    var fallback = sendWhatsAppMessage_(phone, buildMainWhatsAppMenuReply_(), {});
    ui.alert(
      fallback.success ? '⚠ List Menu belum cocok, fallback teks terkirim' : '❌ List Menu dan fallback teks gagal',
      'Response List Menu:\n' + JSON.stringify(result, null, 2) +
      '\n\nStatus fallback teks: ' + (fallback.success ? 'OK' : 'GAGAL'),
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert(
    '✅ List Menu terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function testWhatsAppCekStatusById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Tes Cek Status Aduan',
    'Masukkan ID Aduan. Contoh: PRY7K2A',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(idPrompt.getResponseText()) || idPrompt.getResponseText();
  var d = findAduanById_(id);

  ui.alert(
    d ? '✅ ID ditemukan' : '❌ ID tidak ditemukan',
    d ? buildWhatsAppTrackingReply_(d) : buildNotFoundReply_(id, ''),
    ui.ButtonSet.OK
  );
}

function logWhatsApp_(phone, message, jenis, idAduan, reply, status, rawPayload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);

    if (!sh) {
      setupWhatsAppLogSheet(ss);
      sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
    }

    var row = [
      new Date(),
      phone || '',
      truncateForLog_(message || '', 700),
      jenis || '',
      idAduan || '',
      truncateForLog_(reply || '', 1500),
      truncateForLog_(status || '', 500),
      truncateForLog_(rawPayload || '', 1200)
    ];

    // V11.0.1 FIX RACE:
    // doPost sengaja berjalan tanpa ScriptLock global (keputusan V10.9.132),
    // sehingga dua webhook paralel bisa menghitung getLastRow()+1 yang sama
    // lalu saling menimpa baris log. appendRow lebih aman terhadap eksekusi
    // paralel karena penentuan baris dilakukan atomik oleh Sheets.
    sh.appendRow(row);

    // V11 CRM: hanya masukkan ke antrean lokal. Jika CRM mati, webhook tetap sukses.
    try {
      if (typeof crmMirrorLogWhatsApp_ === 'function') {
        crmMirrorLogWhatsApp_(phone, message, jenis, idAduan, reply, status, rawPayload);
      }
    } catch (crmErr) {}

  } catch (err) {
    // Jangan throw agar webhook tetap balas 200.
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function extractAduanId_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  var upper = text.toUpperCase();

  // V10.9.55 - Format baru acak:
  // PRY7K2A / PTE4N8M / PBD9B3R
  // Urutan kode sengaja dari yang paling panjang agar PBD/PRBD tidak kebaca PRB.
  var randomMatch = upper.match(/\b(?:PBD|PRBD|PRY|PTE|PRB|PRT|PJT|JGT|KPG|JNP|BKU|BTU|BTK|PGR|LNY|ADU)-?[A-HJ-NP-Z2-9]{4,8}\b/);
  if (randomMatch) return normalizeAduanIdHyphen_(randomMatch[0]);

  // Format lama tetap didukung: PRY-20260503-0001 / ADU-20260503-0001
  var match = upper.match(/\b(?:ADU|PBD|PRBD|PRY|PJT|JGT|KPG|JNP|BTK|BKU|BTU|PGR|PRB|PRT|PTE|LNY)-?\d{8}-?\d{4}\b/);
  if (match) return normalizeAduanIdHyphen_(match[0]);

  // Format longgar lama: "status PRY 20260503 0001"
  var loose = upper.match(/\b(ADU|PBD|PRBD|PRY|PJT|JGT|KPG|JNP|BTK|BKU|BTU|PGR|PRB|PRT|PTE|LNY)[\s_-]*(\d{8})[\s_-]*(\d{4})\b/);
  if (loose) return loose[1] + '-' + loose[2] + '-' + loose[3];

  // Format longgar baru: "status PTE 4N8M"
  var looseRandom = upper.match(/\b(PBD|PRBD|PRY|PTE|PRB|PRT|PJT|JGT|KPG|JNP|BKU|BTU|BTK|PGR|LNY|ADU)[\s_-]*([A-HJ-NP-Z2-9]{4,8})\b/);
  if (looseRandom) return looseRandom[1] + looseRandom[2];

  return '';
}

function normalizeAduanIdHyphen_(id) {
  id = String(id || '').toUpperCase().trim();
  id = id.replace(/\s+/g, '-').replace(/_/g, '-');

  // Format baru: KODECABANG-4 s.d. 8 KARAKTER ACAK
  var r = id.match(/^(PBD|PRBD|PRY|PTE|PRB|PRT|PJT|JGT|KPG|JNP|BKU|BTU|BTK|PGR|LNY|ADU)-?([A-HJ-NP-Z2-9]{4,8})$/);
  if (r) return r[1] + r[2];

  // Format lama: KODECABANG-YYYYMMDD-0001
  var m = id.match(/^(ADU|PBD|PRBD|PRY|PJT|JGT|KPG|JNP|BTK|BKU|BTU|PGR|PRB|PRT|PTE|LNY)-?(\d{8})-?(\d{4})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];

  return id;
}

function getWebhookPayloadDebug_(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return { raw: raw || '', parseError: err.message };
  }
}


// ============================================================
// PATCH V8.8 - Tracking ID Aduan WhatsApp helpers
// ============================================================

function getAduanFindCacheKey_(id) {
  var key = normalizeId_(normalizeAduanIdHyphen_(id || ''));
  return key ? ('ADUAN_FIND_' + key) : '';
}

function invalidateAduanFindCacheById_(id) {
  var cacheKey = getAduanFindCacheKey_(id);
  if (cacheKey) cacheRemove_(cacheKey);
}

function findAduanById_(id) {
  id = normalizeAduanIdHyphen_(id || '');
  var key = normalizeId_(id);
  if (!key) return null;

  // V10.9.44:
  // Cache singkat untuk cek status berulang.
  // TTL dibuat pendek dan di-invalidate saat status/data berubah agar tidak stale terlalu lama.
  var cacheKey = getAduanFindCacheKey_(id);
  var cached = cacheKey ? cacheGet_(cacheKey) : '';
  if (cached) {
    try {
      var obj = JSON.parse(cached);
      if (obj && obj.id) return obj;
    } catch(e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 20)).getValues();

  for (var i = 0; i < values.length; i++) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || !d.id) continue;

    if (normalizeId_(d.id) === key) {
      try { if (cacheKey) cachePut_(cacheKey, JSON.stringify(d), 60); } catch(ce) {}
      return d;
    }
  }

  return null;
}

function parseAduanRowForTracking_(row) {
  row = row || [];

  var waktuMasuk = row[CONFIG.COL.WAKTU_MASUK - 1];
  var waktuSelesai = row[CONFIG.COL.WAKTU_SELESAI - 1];
  var updatedAt = row[CONFIG.COL.UPDATED_AT - 1];

  var waktuMasukDate = toSafeDate_(waktuMasuk);
  var waktuSelesaiDate = toSafeDate_(waktuSelesai);
  var updatedAtDate = toSafeDate_(updatedAt);

  return {
    id: String(row[CONFIG.COL.ID - 1] || '').trim(),
    waktuMasuk: formatDateForWa_(waktuMasukDate || waktuMasuk),
    waktuMasukDate: waktuMasukDate,
    cabang: String(row[CONFIG.COL.CABANG - 1] || '').trim(),
    wilayah: String(row[CONFIG.COL.WILAYAH - 1] || '').trim(),
    desa: String(row[CONFIG.COL.DESA - 1] || '').trim(),
    noPelanggan: String(row[(CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA) - 1] || '').trim(),
    namaPelanggan: String(row[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim(),
    noHp: normalizePhone_(row[CONFIG.COL.NO_HP - 1] || ''),
    jenisGangguan: String(row[CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim(),
    prioritas: String(row[CONFIG.COL.PRIORITAS - 1] || 'Sedang').trim(),
    status: String(row[CONFIG.COL.STATUS - 1] || 'Baru').trim(),
    unit: String(row[CONFIG.COL.UNIT - 1] || '').trim(),
    keterangan: String(row[CONFIG.COL.KETERANGAN - 1] || '').trim(),
    catatan: String(row[CONFIG.COL.CATATAN - 1] || '').trim(),
    sumberAduan: (typeof getAduanSumberLabel_ === 'function' ? getAduanSumberLabel_(row[CONFIG.COL.CATATAN - 1] || '') : ''),
    waktuSelesai: formatDateForWa_(waktuSelesaiDate || waktuSelesai),
    waktuSelesaiDate: waktuSelesaiDate,
    slaJam: Number(row[CONFIG.COL.SLA_JAM - 1] || 8),
    updatedAt: formatDateForWa_(updatedAtDate || updatedAt),
    updatedAtDate: updatedAtDate,
    latitude: String(row[(CONFIG.COL.LATITUDE || 17) - 1] || '').trim(),
    longitude: String(row[(CONFIG.COL.LONGITUDE || 18) - 1] || '').trim(),
    linkMaps: String(row[(CONFIG.COL.LINK_MAPS || 19) - 1] || '').trim(),
    lokasiDetail: String(row[(CONFIG.COL.LOKASI_DETAIL || 20) - 1] || '').trim()
  };
}

function buildWhatsAppTrackingReply_(d) {
  d = d || {};
  var statusIcon = getStatusIconForWa_(d.status);
  var noPelanggan = getNoPelangganFromAduan_(d) || '-';
  var progress = buildProgressTextForWa_(d.status);

  // V10.7:
  // Balasan untuk pelanggan dibuat bersih.
  // Jangan tampilkan data internal seperti Prioritas, Unit/Petugas, dan Catatan Sistem.
  // Detail tersebut hanya untuk admin/petugas melalui notifikasi internal.
  var lines = [
    '🔎 *Status Aduan SIAGA TIARA*',
    '',
    'ID Aduan: *' + (d.id || '-') + '*',
    'Status: ' + statusIcon + ' *' + (d.status || '-') + '*',
    'Tahap: ' + progress,
    '',
    'Nama: ' + (d.namaPelanggan || '-'),
    'Cabang: ' + (d.cabang || '-'),
    'No Pelanggan: ' + noPelanggan,
    'Jenis: ' + (d.jenisGangguan || '-'),
    '',
    'Waktu masuk: ' + (d.waktuMasuk || '-')
  ];

  if (d.status === 'Selesai' && d.waktuSelesai) {
    lines.push('Waktu selesai: ' + d.waktuSelesai);
  }

  if (d.linkMaps) {
    lines.push('Maps: ' + d.linkMaps);
  }

  var docCount = getAduanDocumentationCount_(d.id);
  if (docCount > 0) {
    lines.push('');
    lines.push('📷 Dokumentasi foto tersedia: *' + docCount + ' file*.');
    lines.push('Tekan tombol *Lihat Foto* untuk membuka bukti penanganan.');
  }

  lines.push('');
  lines.push('Ketik *menu* untuk kembali ke layanan utama.');

  return lines.join('\n');
}


function buildNotFoundReply_(id, phone) {
  return [
    '⚠️ *ID Aduan Tidak Ditemukan*',
    '',
    'ID yang dikirim:',
    '*' + (id || '-') + '*',
    '',
    'Pastikan format ID benar.',
    'Contoh: *PRY7K2A*',
    '',
    'Atau pilih *Cek Status Aduan* untuk menampilkan aduan aktif dan riwayat selesai terbaru dari nomor WhatsApp ini.',
    'Ketik *menu* untuk kembali ke layanan utama.'
  ].join('\n');
}

function getStatusIconForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return '🆕';
  if (status === 'proses') return '🔧';
  if (status === 'selesai') return '✅';
  if (status === 'ditunda') return '⏸️';
  if (status === 'batal') return '❌';
  return 'ℹ️';
}

function buildProgressTextForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return 'Aduan sudah masuk dan menunggu tindak lanjut.';
  if (status === 'proses') return 'Aduan sedang dalam proses penanganan.';
  if (status === 'selesai') return 'Aduan telah selesai ditangani.';
  if (status === 'ditunda') return 'Aduan sementara ditunda.';
  if (status === 'batal') return 'Aduan dibatalkan.';
  return 'Aduan tercatat di sistem.';
}

function toSafeDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  var d = new Date(value);
  if (!isNaN(d)) return d;
  return null;
}

function formatDateForWa_(value) {
  if (!value) return '';
  var d = toSafeDate_(value);
  if (!d) return String(value || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}



function testKiriminJenisGangguanMenu() {
  var ui = SpreadsheetApp.getUi();
  var targetPrompt = ui.prompt(
    'Tes Menu Jenis Gangguan',
    'Masukkan nomor HP. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminJenisGangguanMenu_(phone);

  ui.alert(
    result.success ? '✅ Menu jenis gangguan terkirim' : '❌ Menu jenis gangguan gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


// ============================================================
// V10.9.96 - SLA FINAL, DETAIL ADUAN, SEARCH, VALIDASI & RIWAYAT LOG
// ============================================================
function formatSlaNumber_(n) {
  n = Number(n || 0);
  if (!isFinite(n)) n = 0;
  return Math.round(n * 10) / 10;
}

function buildAduanSlaDashboardInfo_(d, now) {
  d = d || {};
  now = now || new Date();

  var info = getAduanSlaFinalInfo_(d, now);
  var status = String(d.status || '').trim();
  var masuk = d.waktuMasukDate || toSafeDate_(d.waktuMasuk) || null;
  var selesai = d.waktuSelesaiDate || toSafeDate_(d.waktuSelesai) || null;
  var updated = d.updatedAtDate || toSafeDate_(d.updatedAt) || null;
  var slaJam = Number(d.slaJam || getSlaJamForPrioritas_(d.prioritas));
  if (!slaJam || slaJam <= 0) slaJam = 8;

  if (!info || !info.valid || !masuk) {
    return {
      valid: false,
      statusCode: 'INVALID',
      statusLabel: 'SLA belum bisa dihitung',
      statusClass: 'neutral',
      slaJam: slaJam,
      slaText: slaJam + ' jam',
      durasiText: '-',
      selisihText: '-',
      batasText: '-',
      waktuSelesaiText: selesai ? formatDateForWa_(selesai) : '-',
      durationHours: 0,
      lateHours: 0,
      remainingHours: 0,
      fasterHours: 0
    };
  }

  var dueAt = info.dueAt || new Date(masuk.getTime() + slaJam * 3600000);
  var isBatal = siagaDashIsBatalStatus_(status);
  var isSelesai = status === 'Selesai';
  var isClosed = isSelesai || isBatal;
  var endTime = isClosed ? (selesai || updated || now) : now;
  var durationHours = Math.max(0, (endTime.getTime() - masuk.getTime()) / 3600000);
  var diffHours = (dueAt.getTime() - endTime.getTime()) / 3600000;
  var remainingHours = Math.max(0, diffHours);
  var lateHours = Math.max(0, -diffHours);
  var fasterHours = isSelesai ? Math.max(0, diffHours) : 0;
  var warningLimit = slaJam * (CONFIG.FOCUS_SLA_PERCENT || 0.25);

  var out = {
    valid: true,
    slaJam: slaJam,
    slaText: slaJam + ' jam',
    batasText: formatDateForWa_(dueAt),
    waktuMasukText: formatDateForWa_(masuk),
    waktuSelesaiText: selesai ? formatDateForWa_(selesai) : (isClosed && endTime ? formatDateForWa_(endTime) : '-'),
    durasiText: formatDurasiSla_(durationHours),
    durationHours: formatSlaNumber_(durationHours),
    lateHours: formatSlaNumber_(lateHours),
    remainingHours: formatSlaNumber_(remainingHours),
    fasterHours: formatSlaNumber_(fasterHours),
    statusCode: 'ACTIVE_OK',
    statusLabel: 'SLA aman',
    statusClass: 'ok',
    selisihText: remainingHours > 0 ? ('Sisa ' + formatDurasiSla_(remainingHours) + ' dari SLA') : 'SLA tepat di batas'
  };

  if (isBatal) {
    out.statusCode = 'BATAL';
    out.statusLabel = 'Aduan dibatalkan';
    out.statusClass = 'neutral';
    out.selisihText = lateHours > 0 ? ('Batal setelah lewat SLA ' + formatDurasiSla_(lateHours)) : 'Batal sebelum batas SLA';
    return out;
  }

  if (isSelesai) {
    if (lateHours > 0) {
      out.statusCode = 'DONE_LATE';
      out.statusLabel = 'Selesai terlambat';
      out.statusClass = 'late';
      out.selisihText = 'Telat ' + formatDurasiSla_(lateHours) + ' dari SLA';
    } else {
      out.statusCode = 'DONE_ONTIME';
      out.statusLabel = 'Selesai tepat waktu';
      out.statusClass = 'ok';
      out.selisihText = fasterHours > 0 ? ('Lebih cepat ' + formatDurasiSla_(fasterHours) + ' dari SLA') : 'Selesai tepat pada batas SLA';
    }
    return out;
  }

  if (lateHours > 0) {
    out.statusCode = 'ACTIVE_LATE';
    out.statusLabel = 'Lewat SLA';
    out.statusClass = 'late';
    out.selisihText = 'Lewat ' + formatDurasiSla_(lateHours) + ' dari SLA';
    return out;
  }

  if (remainingHours <= warningLimit) {
    out.statusCode = 'ACTIVE_NEAR';
    out.statusLabel = 'Hampir lewat SLA';
    out.statusClass = 'warning';
    out.selisihText = 'Sisa ' + formatDurasiSla_(remainingHours) + ' dari SLA';
  }

  return out;
}

function buildAduanClientSummary_(d, now) {
  d = d || {};
  var sla = buildAduanSlaDashboardInfo_(d, now || new Date());
  return {
    id: String(d.id || ''),
    waktu: formatDisplayDate(d.waktuMasukDate || d.waktuMasuk),
    waktuMasuk: formatDisplayDate(d.waktuMasukDate || d.waktuMasuk),
    waktuSelesai: formatDisplayDate(d.waktuSelesaiDate || d.waktuSelesai),
    cabang: String(d.cabang || ''),
    wilayah: String(d.wilayah || ''),
    noPelanggan: String(d.noPelanggan || d.desa || ''),
    namaPelanggan: String(d.namaPelanggan || ''),
    noHp: String(d.noHp || ''),
    jenis: String(d.jenisGangguan || d.jenis || ''),
    sumberAduan: String(d.sumberAduan || (typeof getAduanSumberLabel_ === 'function' ? getAduanSumberLabel_(d.catatan || '') : '')),
    prioritas: String(d.prioritas || ''),
    status: String(d.status || ''),
    unit: String(d.unit || ''),
    keterangan: String(d.keterangan || ''),
    catatan: String(d.catatan || ''),
    lokasiDetail: String(d.lokasiDetail || ''),
    linkMaps: String(d.linkMaps || ''),
    latitude: String(d.latitude || ''),
    longitude: String(d.longitude || ''),
    sla: sla,
    slaStatus: sla.statusCode === 'ACTIVE_LATE' ? 'Lewat' : (sla.statusCode === 'ACTIVE_NEAR' ? 'Hampir' : 'Aman'),
    sisaSLA: sla.statusCode === 'ACTIVE_LATE' ? ('Lewat ' + formatDurasiSla_(sla.lateHours || 0)) : (sla.remainingHours ? (sla.remainingHours + ' jam') : (sla.statusLabel || '-')),
    slaText: sla.statusLabel || '-',
    slaSelisih: sla.selisihText || '-',
    durasiText: sla.durasiText || '-'
  };
}

// Override tabel fokus/terbaru/selesai agar SLA selesai tetap tampil lengkap di Index.
function getTabelFokus(data, now) {
  now = now || new Date();
  var cutoff24Jam = new Date(now.getTime() - 24 * 3600 * 1000);
  var fokus = (data || []).filter(function(d) {
    if (d.status === 'Selesai' || d.status === 'Batal') return false;
    if (!d.waktuMasuk) return false;
    var slaInfo = getSlaInfo_(d, now);
    var isDarurat = d.prioritas === 'Darurat' || d.prioritas === 'Tinggi';
    var isSLALewat = slaInfo.overdue;
    var isNearDeadline = slaInfo.nearDeadline;
    var sudahLebih24Jam = d.waktuMasuk < cutoff24Jam;
    return isDarurat || isSLALewat || isNearDeadline || sudahLebih24Jam;
  });

  fokus.sort(function(a, b) {
    var priOrder = { 'Darurat': 4, 'Tinggi': 3, 'Sedang': 2, 'Rendah': 1 };
    var aSla = getSlaInfo_(a, now);
    var bSla = getSlaInfo_(b, now);
    var priDiff = (priOrder[b.prioritas] || 0) - (priOrder[a.prioritas] || 0);
    if (priDiff !== 0) return priDiff;
    var lewatDiff = (bSla.overdue ? 1 : 0) - (aSla.overdue ? 1 : 0);
    if (lewatDiff !== 0) return lewatDiff;
    var nearDiff = (bSla.nearDeadline ? 1 : 0) - (aSla.nearDeadline ? 1 : 0);
    if (nearDiff !== 0) return nearDiff;
    return (a.waktuMasuk || 0) - (b.waktuMasuk || 0);
  });

  return fokus.slice(0, 50).map(function(d) {
    var r = buildAduanClientSummary_(d, now);
    var slaInfo = getSlaInfo_(d, now);
    if (d.prioritas === 'Darurat') r.alasanFokus = '🔴 Darurat';
    else if (d.prioritas === 'Tinggi') r.alasanFokus = '🟠 Prioritas Tinggi';
    else if (slaInfo.overdue) r.alasanFokus = '⏱ SLA Lewat';
    else if (slaInfo.nearDeadline) r.alasanFokus = '⚠ Hampir Lewat SLA';
    else r.alasanFokus = '📅 > 24 Jam';
    r.keterangan = r.keterangan ? String(r.keterangan).substring(0, 100) : '';
    return r;
  });
}

function getTabelTerbaru(data, now) {
  now = now || new Date();
  var sorted = (data || []).filter(function(d) {
    return d.status !== 'Selesai' && d.status !== 'Batal';
  }).sort(function(a, b) {
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  });
  return sorted.slice(0, 100).map(function(d) {
    return buildAduanClientSummary_(d, now);
  });
}

function getTabelSelesai(data, now) {
  now = now || new Date();

  // Dashboard tidak lagi mengirim semua aduan selesai.
  // Yang dikirim hanya periode bulan ini dan bulan sebelumnya agar tabel ringan,
  // lalu Index memilih tampilan awal Bulan Ini.
  var firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var firstPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var firstNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  var sorted = (data || []).filter(function(d) {
    if (d.status !== 'Selesai') return false;
    var doneAt = d.waktuSelesai || d.waktuSelesaiDate || d.waktuMasuk || d.waktuMasukDate;
    if (!doneAt) return false;
    var doneDate = new Date(doneAt);
    if (isNaN(doneDate.getTime())) return false;
    return doneDate >= firstPrevMonth && doneDate < firstNextMonth;
  }).sort(function(a, b) {
    return (b.waktuSelesai || b.waktuMasuk || 0) - (a.waktuSelesai || a.waktuMasuk || 0);
  });

  return sorted.map(function(d) {
    var doneAt = d.waktuSelesai || d.waktuSelesaiDate || d.waktuMasuk || d.waktuMasukDate;
    var doneDate = new Date(doneAt);
    var r = buildAduanClientSummary_(d, now);
    r.catatan = d.catatan ? String(d.catatan).substring(0, 100) : '';
    r.selesaiPeriod = doneDate >= firstThisMonth ? 'bulan_ini' : 'bulan_lalu';
    r.selesaiPeriodLabel = doneDate >= firstThisMonth ? 'Bulan Ini' : 'Bulan Sebelumnya';
    return r;
  });
}

function getStatusLogsForAduan_(idAduan, limit) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  limit = Number(limit || 80);
  if (!idAduan) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.LOG_STATUS_ADUAN_SHEET || 'LOG_STATUS_ADUAN');
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  // V11.5 FIX: dulu ini selalu membaca SELURUH sheet LOG_STATUS_ADUAN dari baris 2,
  // apa pun ID yang dicari. Begitu sheet log-nya sudah besar (ribuan baris setelah
  // berbulan-bulan operasional), pembacaan ini jadi lambat dan sesekali bikin
  // clientGetAduanDetail timeout/exception untuk aduan tertentu -> muncul sebagai
  // "Gagal memuat detail: Unknown error" di dashboard, padahal datanya sendiri valid.
  // Sekarang dibatasi ke N baris terakhir saja (riwayat status realistis selalu ada
  // di bagian akhir sheet karena ditulis berurutan seiring waktu).
  var lastRow = safeGetLastRow_(sh);
  var maxRows = 6000;
  var rowCount = Math.min(lastRow - 1, maxRows);
  var startRow = Math.max(2, lastRow - rowCount + 1);
  var values = sh.getRange(startRow, 1, rowCount, Math.min(sh.getLastColumn(), 10)).getValues();
  var rows = [];
  values.forEach(function(r) {
    if (normalizeAduanIdHyphen_(r[1] || '') !== idAduan) return;
    var waktu = toSafeDate_(r[0]) || null;
    rows.push({
      waktu: waktu,
      waktuText: waktu ? formatDateForWa_(waktu) : String(r[0] || ''),
      id: String(r[1] || ''),
      statusLama: String(r[2] || ''),
      statusBaru: String(r[3] || ''),
      aktor: String(r[4] || ''),
      noWa: String(r[5] || ''),
      cabangPetugas: String(r[6] || ''),
      sumber: String(r[7] || ''),
      catatan: String(r[8] || ''),
      detail: String(r[9] || '')
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
      waktuText: r.waktuText,
      id: r.id,
      statusLama: r.statusLama,
      statusBaru: r.statusBaru,
      aktor: r.aktor,
      noWa: r.noWa,
      cabangPetugas: r.cabangPetugas,
      sumber: r.sumber,
      catatan: r.catatan,
      detail: r.detail
    };
  });
}

function getWhatsAppLogsForAduan_(idAduan, limit) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  limit = Number(limit || 40);
  if (!idAduan) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var lastRow = safeGetLastRow_(sh);
  var startRow = Math.max(2, lastRow - 1000);
  var values = sh.getRange(startRow, 1, lastRow - startRow + 1, Math.min(sh.getLastColumn(), 8)).getValues();
  var rows = [];
  values.forEach(function(r) {
    if (normalizeAduanIdHyphen_(r[4] || '') !== idAduan) return;
    var waktu = toSafeDate_(r[0]) || null;
    rows.push({
      waktu: waktu,
      waktuText: waktu ? formatDateForWa_(waktu) : String(r[0] || ''),
      noHp: String(r[1] || ''),
      pesan: String(r[2] || ''),
      jenis: String(r[3] || ''),
      id: String(r[4] || ''),
      balasan: String(r[5] || ''),
      status: String(r[6] || ''),
      raw: String(r[7] || '')
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
      waktuText: r.waktuText,
      noHp: r.noHp,
      pesan: r.pesan,
      jenis: r.jenis,
      id: r.id,
      balasan: r.balasan,
      status: r.status,
      raw: r.raw
    };
  });
}

function buildAduanValidationInfo_(aduan, statusLogs) {
  aduan = aduan || {};
  statusLogs = statusLogs || [];
  var notes = [];
  var status = String(aduan.status || '').trim();
  var selesai = aduan.waktuSelesaiDate || toSafeDate_(aduan.waktuSelesai) || null;

  if (!statusLogs.length) {
    return {
      status: 'Tidak Dapat Diverifikasi',
      statusClass: 'unknown',
      notes: ['Belum ada riwayat di LOG_STATUS_ADUAN untuk aduan ini. Data lama tetap bisa tampil, tetapi audit waktunya belum lengkap.']
    };
  }

  var lastLog = statusLogs[statusLogs.length - 1] || {};
  var lastStatus = String(lastLog.statusBaru || '').trim();
  if (lastStatus && status && lastStatus !== status) {
    notes.push('Status di ADUAN saat ini "' + status + '", tetapi status terakhir di log adalah "' + lastStatus + '".');
  }

  var selesaiLogs = statusLogs.filter(function(l) { return String(l.statusBaru || '').trim() === 'Selesai'; });
  if (status === 'Selesai') {
    if (!selesai) {
      notes.push('Status sudah Selesai, tetapi Waktu Selesai di ADUAN masih kosong.');
    }
    if (!selesaiLogs.length) {
      notes.push('Status Selesai tidak memiliki jejak perubahan ke Selesai di LOG_STATUS_ADUAN.');
    } else if (selesai) {
      var lastSelesaiLog = selesaiLogs[selesaiLogs.length - 1];
      var logTime = toSafeDate_(lastSelesaiLog.waktuText) || null;
      // Waktu text format id-ID kadang tidak mudah diparse; ambil dari pembacaan internal bila tersedia tidak dikirim.
      // Pakai pencarian ulang dari sheet untuk validasi presisi.
      var rawLogTime = getRawLastSelesaiLogTime_(aduan.id);
      if (rawLogTime) logTime = rawLogTime;
      if (logTime) {
        var diffMin = Math.abs(selesai.getTime() - logTime.getTime()) / 60000;
        if (diffMin > 3) {
          notes.push('Waktu Selesai di ADUAN berbeda dengan waktu log Selesai sekitar ' + Math.round(diffMin) + ' menit.');
        }
      }
    }
  } else {
    if (selesai) {
      notes.push('Status bukan Selesai, tetapi kolom Waktu Selesai masih terisi.');
    }
  }

  if (notes.length) {
    return { status: 'Perlu Dicek', statusClass: 'warning', notes: notes };
  }

  return { status: 'Valid', statusClass: 'valid', notes: ['Data utama konsisten dengan riwayat LOG_STATUS_ADUAN.'] };
}

function getRawLastSelesaiLogTime_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.LOG_STATUS_ADUAN_SHEET || 'LOG_STATUS_ADUAN');
  if (!sh || safeGetLastRow_(sh) < 2) return null;
  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.min(sh.getLastColumn(), 4)).getValues();
  var found = null;
  values.forEach(function(r) {
    if (normalizeAduanIdHyphen_(r[1] || '') === idAduan && String(r[3] || '').trim() === 'Selesai') {
      found = toSafeDate_(r[0]) || found;
    }
  });
  return found;
}


// ============================================================
// V10.9.176 - META AKSI ADUAN RINGAN
// Dipakai modal Aksi agar petugas menangani tidak ikut gagal karena
// log/detail/dokumentasi lama yang bermasalah pada aduan selesai.
// ============================================================
function clientGetAduanUpdateMeta(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
    if (!id) throw new Error('ID aduan kosong.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var main = ss.getSheetByName(CONFIG.SHEET_NAME);
    var rowNumber = findAduanRowNumberById_(id);
    if (!main || !rowNumber) throw new Error('ID aduan tidak ditemukan: ' + id);

    var aduan = getAduanObjectFromSheetRow_(main, rowNumber);
    if (!dashboardUserCanAccessAduan_(sessionUser, aduan)) {
      throw new Error('Aduan ini bukan cabang login Anda.');
    }

    var now = new Date();
    var detail = buildAduanClientSummary_(aduan, now);

    var assignments = [];
    var availablePetugas = [];
    var docs = [];
    var metaWarnings = [];

    try {
      assignments = getPenugasanAduanRows_(id) || [];
    } catch (assignReadErr) {
      metaWarnings.push('Penugasan lama tidak terbaca: ' + (assignReadErr.message || assignReadErr));
      assignments = [];
    }

    try {
      availablePetugas = getAvailablePetugasForCabang_(aduan.cabang || '') || [];
    } catch (petugasErr) {
      metaWarnings.push('Daftar petugas cabang tidak terbaca: ' + (petugasErr.message || petugasErr));
      availablePetugas = [];
    }

    try {
      docs = (getAduanDocumentationRows_(id, 30) || []).map(formatDashboardDokumentasiRow_);
    } catch (docErr) {
      // Jangan gagalkan modal Aksi hanya karena dokumentasi/log lama rusak.
      metaWarnings.push('Dokumentasi lama tidak terbaca: ' + (docErr.message || docErr));
      docs = [];
    }

    detail.petugasMenanganiList = assignments.map(function(p) { return p.nama; }).filter(Boolean);
    detail.petugasMenangani = detail.petugasMenanganiList.length ? detail.petugasMenanganiList.join(', ') : 'Belum ada petugas';

    // V11.6 FIX: sama seperti clientGetAduanDetail - detail.sla membawa Date mentah
    // (sla.responseAt) yang bisa bikin google.script.run gagal kirim payload ke
    // client ("Unknown error"). Disaring lewat siagaDashSanitize_ juga di sini.
    return siagaDashSanitize_({
      success: true,
      id: id,
      rowNumber: rowNumber,
      aduan: detail,
      availablePetugas: availablePetugas,
      assignedPetugas: assignments,
      logs: {
        status: [],
        whatsapp: [],
        dokumentasi: docs
      },
      warnings: metaWarnings,
      generatedAt: formatDateForWa_(now)
    });
  } catch (e) {
    Logger.log('Error clientGetAduanUpdateMeta: ' + e.message + '\n' + (e.stack || ''));
    return { success: false, error: e.message || String(e) };
  }
}

function clientGetAduanDetail(form) {
  var idForLog = '';
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var id = normalizeAduanIdHyphen_(form.id || form.aduanId || '');
    idForLog = id;
    if (!id) throw new Error('ID aduan kosong.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var main = ss.getSheetByName(CONFIG.SHEET_NAME);
    var rowNumber = findAduanRowNumberById_(id);
    if (!main || !rowNumber) throw new Error('ID aduan tidak ditemukan: ' + id);

    var aduan = getAduanObjectFromSheetRow_(main, rowNumber);
    if (!dashboardUserCanAccessAduan_(sessionUser, aduan)) {
      throw new Error('Aduan ini bukan cabang login Anda.');
    }

    var now = new Date();
    var warnings = [];

    // V11.5 FIX: masing-masing bagian (log status, log WhatsApp, dokumentasi, penugasan,
    // daftar petugas, validasi) sekarang diisolasi try/catch sendiri-sendiri. Sebelumnya
    // kalau SATU bagian saja error (mis. karena sheet log sudah sangat besar / ada baris
    // log yang formatnya tidak terduga untuk aduan lama tertentu), seluruh modal Detail
    // Aduan gagal total dan cuma menampilkan "Unknown error" tanpa info lain — walaupun
    // data utama aduan-nya sendiri valid dan seharusnya tetap bisa ditampilkan.
    var detail;
    try {
      detail = buildAduanClientSummary_(aduan, now);
    } catch (eSummary) {
      Logger.log('[DETAIL ADUAN] gagal buildAduanClientSummary_ untuk ' + id + ': ' + eSummary.message + '\n' + (eSummary.stack || ''));
      throw new Error('Gagal menghitung ringkasan SLA aduan ini: ' + (eSummary.message || eSummary));
    }

    var statusLogs = [];
    try { statusLogs = getStatusLogsForAduan_(id, 100); }
    catch (eLog) { Logger.log('[DETAIL ADUAN] gagal getStatusLogsForAduan_ untuk ' + id + ': ' + eLog.message + '\n' + (eLog.stack || '')); warnings.push('Riwayat status gagal dimuat.'); }

    var waLogs = [];
    try { waLogs = getWhatsAppLogsForAduan_(id, 50); }
    catch (eWa) { Logger.log('[DETAIL ADUAN] gagal getWhatsAppLogsForAduan_ untuk ' + id + ': ' + eWa.message + '\n' + (eWa.stack || '')); warnings.push('Log WhatsApp gagal dimuat.'); }

    var docs = [];
    try { docs = getAduanDocumentationRows_(id, 30).map(formatDashboardDokumentasiRow_); }
    catch (eDoc) { Logger.log('[DETAIL ADUAN] gagal getAduanDocumentationRows_ untuk ' + id + ': ' + eDoc.message + '\n' + (eDoc.stack || '')); warnings.push('Dokumentasi foto gagal dimuat.'); }

    var assignments = [];
    try { assignments = getPenugasanAduanRows_(id); }
    catch (eAssign) { Logger.log('[DETAIL ADUAN] gagal getPenugasanAduanRows_ untuk ' + id + ': ' + eAssign.message + '\n' + (eAssign.stack || '')); warnings.push('Data penugasan petugas gagal dimuat.'); }

    var availablePetugas = [];
    try { availablePetugas = getAvailablePetugasForCabang_(aduan.cabang || ''); }
    catch (ePetugas) { Logger.log('[DETAIL ADUAN] gagal getAvailablePetugasForCabang_ untuk ' + id + ': ' + ePetugas.message + '\n' + (ePetugas.stack || '')); warnings.push('Daftar petugas cabang gagal dimuat.'); }

    try {
      var petugasMenangani = buildPetugasMenanganiTextFromLogs_(statusLogs, docs, assignments);
      detail.petugasMenangani = petugasMenangani;
      detail.petugasMenanganiList = assignments.map(function(p) { return p.nama; }).filter(Boolean);
    } catch (ePm) {
      Logger.log('[DETAIL ADUAN] gagal buildPetugasMenanganiTextFromLogs_ untuk ' + id + ': ' + ePm.message + '\n' + (ePm.stack || ''));
      detail.petugasMenangani = detail.unit || 'Belum ada petugas';
      detail.petugasMenanganiList = [];
    }

    var validation = { valid: true, notes: [] };
    try { validation = buildAduanValidationInfo_(aduan, statusLogs); }
    catch (eVal) { Logger.log('[DETAIL ADUAN] gagal buildAduanValidationInfo_ untuk ' + id + ': ' + eVal.message + '\n' + (eVal.stack || '')); warnings.push('Validasi data gagal dihitung.'); }

    // V11.6 FIX: root cause "Gagal memuat detail: Unknown error".
    // detail.sla (dari buildAduanClientSummary_ -> buildAduanSlaDashboardInfo_ ->
    // getAduanResponseInfo_) menyertakan field `responseAt` berupa objek Date mentah
    // (bukan string). google.script.run kadang gagal mengirim payload yang membawa
    // objek Date mentah bersarang ke client, sehingga withSuccessHandler menerima
    // res = null/undefined -> muncul sebagai "Unknown error" di modal, padahal
    // datanya sendiri valid. clientGetDashboardData sudah lebih dulu memakai pola
    // sanitasi JSON-safe ini (lihat siagaDashSanitize_); clientGetAduanDetail dulu
    // belum memakainya. Sekarang seluruh payload disaring lewat siagaDashSanitize_
    // sebelum dikirim ke client agar semua Date otomatis jadi string ISO aman.
    return siagaDashSanitize_({
      success: true,
      id: id,
      rowNumber: rowNumber,
      aduan: detail,
      validation: validation,
      availablePetugas: availablePetugas,
      assignedPetugas: assignments,
      logs: {
        status: statusLogs,
        whatsapp: waLogs,
        dokumentasi: docs
      },
      warnings: warnings,
      generatedAt: formatDateForWa_(now)
    });
  } catch (e) {
    var msg = (e && e.message) ? e.message : (e ? String(e) : 'Terjadi kesalahan tak terduga saat memuat detail aduan.');
    Logger.log('[DETAIL ADUAN] Error clientGetAduanDetail untuk id="' + idForLog + '": ' + msg + '\n' + ((e && e.stack) || ''));
    return { success: false, error: msg };
  }
}

function siagaSearchNormalizeText_(value) {
  return String(value == null ? '' : value).toLowerCase().trim();
}

function siagaSearchDigits_(value) {
  return String(value == null ? '' : value).replace(/\D+/g, '');
}

function clientSearchDashboardAduan(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }

    var queryRaw = String(form.query || form.q || '').trim();
    var query = siagaSearchNormalizeText_(queryRaw);
    var queryDigits = siagaSearchDigits_(queryRaw);
    var queryId = normalizeId_(queryRaw || '');
    var limit = Math.min(50, Math.max(5, Number(form.limit || 20)));
    if (!query && !queryDigits && !queryId) return { success: true, rows: [], total: 0, query: queryRaw };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
    var lastRow = sh ? sh.getLastRow() : 0;
    if (!sh || lastRow < 2) return { success: true, rows: [], total: 0, query: queryRaw };

    // V10.9.168: search dibuat memakai parser dashboard ringan saja.
    // Hindari fungsi detail/log supaya tidak memunculkan Unknown error saat audit/search.
    var lastCol = Math.max(20, Math.min(sh.getLastColumn(), 20));
    var maxSearchRows = Math.min(Number(form.maxRows || 3000), 3000);
    var startRow = Math.max(2, lastRow - maxSearchRows + 1);
    var numRows = Math.max(0, lastRow - startRow + 1);
    var rawData = numRows ? sh.getRange(startRow, 1, numRows, lastCol).getValues() : [];
    var parsed = siagaDashParseRows_(rawData);
    var rows = [];
    var nowMs = new Date().getTime();

    for (var i = parsed.length - 1; i >= 0; i--) {
      var d = parsed[i] || {};
      if (!d.id) continue;
      if (!dashboardUserCanAccessAduan_(sessionUser, d)) continue;

      var hay = [
        d.id, d.cabang, d.wilayah, d.desa, d.namaPelanggan, d.noHp,
        d.jenisGangguan, d.prioritas, d.status, d.unit, d.keterangan, d.catatan
      ].map(siagaSearchNormalizeText_).join(' ');
      var hayDigits = siagaSearchDigits_([d.id, d.desa, d.noHp].join(' '));
      var idMatch = queryId && normalizeId_(d.id || '').indexOf(queryId) !== -1;
      var textMatch = query && hay.indexOf(query) !== -1;
      var digitMatch = queryDigits && hayDigits.indexOf(queryDigits) !== -1;

      if (!textMatch && !digitMatch && !idMatch) continue;
      rows.push(siagaDashBuildSummary_(d, nowMs));
      if (rows.length >= limit) break;
    }

    return {
      success: true,
      rows: rows,
      total: rows.length,
      query: queryRaw,
      searchedRows: rawData.length
    };
  } catch (e) {
    Logger.log('Error clientSearchDashboardAduan V10.9.168: ' + (e && e.message ? e.message : e) + '\n' + ((e && e.stack) || ''));
    return { success: false, error: 'Search aduan gagal diproses. Klik Refresh lalu coba lagi.' };
  }
}




// ============================================================
// V10.9.97 - ADMIN SETTINGS DASHBOARD
// Pengaturan admin dari Index: akun cabang, petugas, SLA,
// notifikasi WA, jam layanan, dashboard, dan arsip/log.
// ============================================================

function getSiagaRuntimeSetting_(key, defaultValue) {
  key = String(key || '').trim();
  if (!key) return defaultValue;

  var prop = '';
  try { prop = getRuntimeProp_(key); } catch(e0) { prop = ''; }
  if (prop !== null && prop !== undefined && String(prop) !== '') return prop;

  // V11.0.1 PERF FIX:
  // Sebelumnya setiap key yang tidak ada di Script Properties membuat scan
  // sheet SETTINGS (getRange().getValues()) TANPA cache. Satu chat masuk bisa
  // memanggil fungsi ini 5-10x (rate limit, typing, debounce, fast reply, dst)
  // sehingga menambah latensi ratusan ms per panggilan.
  // Sekarang seluruh isi sheet SETTINGS dibaca sekali lalu di-cache 5 menit.
  // Cache di-invalidate otomatis oleh setSiagaRuntimeSettings_().
  try {
    var map = getSettingsSheetMapCached_();
    if (map && Object.prototype.hasOwnProperty.call(map, key)) {
      var v = map[key];
      if (v !== null && v !== undefined && String(v) !== '') return v;
    }
  } catch(e1) {}

  return defaultValue;
}

var SIAGA_SETTINGS_SHEET_MAP_CACHE_KEY_ = 'SETTINGS_SHEET_MAP_V1';
var _settingsSheetMapRequestCache = null;

function getSettingsSheetMapCached_() {
  // Cache level 1: memori per eksekusi (0 ms).
  if (_settingsSheetMapRequestCache !== null) return _settingsSheetMapRequestCache;

  // Cache level 2: CacheService 5 menit (lintas eksekusi).
  try {
    var raw = cacheGet_(SIAGA_SETTINGS_SHEET_MAP_CACHE_KEY_);
    if (raw) {
      var parsed = parseJsonSafe_(raw);
      if (parsed && typeof parsed === 'object') {
        _settingsSheetMapRequestCache = parsed;
        return parsed;
      }
    }
  } catch(eCache) {}

  // Sumber asli: sheet SETTINGS, dibaca sekali saja.
  var map = {};
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET || 'SETTINGS');
    if (sh && sh.getLastRow() >= 1) {
      var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
      for (var i = 0; i < vals.length; i++) {
        var k = String(vals[i][0] || '').trim();
        if (!k) continue;
        var val = vals[i][1];
        if (val === null || val === undefined) val = '';
        if (val instanceof Date) val = val.toISOString();
        map[k] = val;
      }
    }
  } catch(eSheet) {}

  try { cachePut_(SIAGA_SETTINGS_SHEET_MAP_CACHE_KEY_, JSON.stringify(map), 300); } catch(ePut) {}
  _settingsSheetMapRequestCache = map;
  return map;
}

function invalidateSettingsSheetMapCache_() {
  _settingsSheetMapRequestCache = null;
  try { cacheRemove_(SIAGA_SETTINGS_SHEET_MAP_CACHE_KEY_); } catch(e) {}
}

function setSiagaRuntimeSettings_(settingsMap) {
  settingsMap = settingsMap || {};
  var props = PropertiesService.getScriptProperties();
  var keys = Object.keys(settingsMap);
  keys.forEach(function(k) {
    var v = settingsMap[k];
    if (v === null || v === undefined) v = '';
    props.setProperty(k, String(v));
  });
  clearRuntimePropCache_();
  // V11.0.1 PERF FIX: cache map SETTINGS harus ikut di-refresh saat setting berubah.
  try { invalidateSettingsSheetMapCache_(); } catch(eInvalidateSettingsCache) {}

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET || 'SETTINGS');
    if (!sh) sh = ss.insertSheet(CONFIG.SETTINGS_SHEET || 'SETTINGS');

    var last = Math.max(1, sh.getLastRow());
    var existing = {};
    if (last >= 1) {
      var vals = sh.getRange(1, 1, last, Math.min(2, Math.max(2, sh.getLastColumn()))).getValues();
      vals.forEach(function(r, idx) {
        var key = String(r[0] || '').trim();
        if (key) existing[key] = idx + 1;
      });
    }

    keys.forEach(function(k) {
      var row = existing[k];
      if (!row) {
        row = sh.getLastRow() + 1;
        sh.getRange(row, 1).setValue(k);
        existing[k] = row;
      }
      sh.getRange(row, 2).setValue(String(settingsMap[k]));
    });

    try { sh.autoResizeColumns(1, 2); } catch(eResize) {}
  } catch(e2) {}

  // V11.0.1 PERF FIX: pastikan cache dibersihkan lagi setelah sheet SETTINGS ditulis.
  try { invalidateSettingsSheetMapCache_(); } catch(eInvalidateSettingsCache2) {}
}


// ============================================================
// V11.0.1 PERF FIX - PEMBERSIH SCRIPT PROPERTIES SAMPAH
// Masalah: versi sebelumnya menumpuk properti yang tidak pernah dihapus:
// - WA_REPLY_DEBOUNCE_* dan WA_IN_NOISE_* (debounce lama; sekarang tidak
//   ditulis lagi, tetapi sisa lama masih ada di store)
// - RL_DAY_<yyyymmdd>_<role>_<phone> (rate limit harian, 1 properti baru
//   per nomor per hari)
// - WA_INVALID_INPUT_COUNT_* (counter salah input pelanggan)
// - SIAGA_WA_CABANG_PROMPT_* dan SIAGA_WA_ADUAN_SESSION_* yang sudah expired
// Dampak: getProperties() (dipanggil hampir setiap webhook lewat
// getRuntimeProp_) makin lambat, dan store bisa mentok kuota 500KB sehingga
// setProperty gagal diam-diam.
// Cara pakai:
// 1. Jalankan purgeSiagaJunkScriptProperties() sekali secara manual dari
//    editor Apps Script untuk membersihkan tumpukan lama.
// 2. Jalankan setupSiagaPropertyPurgeTrigger() sekali untuk memasang
//    trigger pembersihan otomatis setiap hari (sekitar jam 02:00).
// ============================================================

function purgeSiagaJunkScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var all = {};
  try {
    all = props.getProperties() || {};
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }

  var todayKey = '';
  try { todayKey = getRateLimitDateKey_(); } catch (eDate) {
    todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  }

  var now = new Date().getTime();
  var keys = Object.keys(all);
  var deleted = 0;
  var kept = 0;
  var errors = 0;

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var drop = false;

    if (k.indexOf('WA_REPLY_DEBOUNCE_') === 0) {
      // Sisa debounce balasan versi lama. Tidak dipakai lagi.
      drop = true;
    } else if (k.indexOf('WA_IN_NOISE_') === 0) {
      // Sisa debounce chat ngasal versi lama. Tidak dipakai lagi.
      drop = true;
    } else if (k.indexOf('WA_INVALID_INPUT_COUNT_') === 0) {
      // Counter salah input harian; aman di-reset tiap malam.
      drop = true;
    } else if (k.indexOf('RL_DAY_') === 0 && k.indexOf('RL_DAY_' + todayKey + '_') !== 0) {
      // Rate limit harian selain hari berjalan.
      drop = true;
    } else if (k.indexOf('SIAGA_WA_CABANG_PROMPT_') === 0) {
      // Marker daftar cabang; valid maksimal 20-30 menit. Hapus jika > 2 jam.
      var marker = parseJsonSafe_(all[k]);
      if (!marker || !marker.at || (now - Number(marker.at)) > 2 * 60 * 60 * 1000) drop = true;
    } else if (k.indexOf('SIAGA_WA_ADUAN_SESSION_') === 0) {
      // Fallback sesi aduan; punya expiresAt sendiri. Hapus jika sudah lewat.
      var fallback = parseJsonSafe_(all[k]);
      if (!fallback || !fallback.expiresAt || Number(fallback.expiresAt) < now) drop = true;
    }

    if (!drop) {
      kept++;
      continue;
    }

    try {
      props.deleteProperty(k);
      deleted++;
    } catch (eDel) {
      errors++;
    }
  }

  try { clearRuntimePropCache_(); } catch (eClear) {}

  var summary = {
    success: true,
    totalBefore: keys.length,
    deleted: deleted,
    kept: kept,
    errors: errors,
    ranAt: new Date().toISOString()
  };

  try {
    props.setProperty('SIAGA_LAST_PROPERTY_PURGE', JSON.stringify(summary));
  } catch (eSummary) {}

  try {
    Logger.log('purgeSiagaJunkScriptProperties: ' + JSON.stringify(summary));
  } catch (eLog) {}

  return summary;
}

function setupSiagaPropertyPurgeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'purgeSiagaJunkScriptProperties') {
      return { success: true, existing: true, message: 'Trigger pembersih properti sudah terpasang.' };
    }
  }

  ScriptApp.newTrigger('purgeSiagaJunkScriptProperties')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  return { success: true, created: true, message: 'Trigger pembersih properti harian (± jam 02:00) berhasil dipasang.' };
}
