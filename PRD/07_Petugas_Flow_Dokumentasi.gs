// ============================================================
// SIAGA TIARA V10.9.292 - PETUGAS FOTO PESAN FOTO LEBIH MUDAH / MODUL: 07_Petugas_Flow_Dokumentasi.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

function getPetugasByPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  var cacheKey = 'PETUGAS_BY_PHONE_' + phone;
  var cached = cacheGet_(cacheKey);
  if (cached === '__NONE__') return null;
  if (cached) {
    try {
      var c = JSON.parse(cached);
      if (c && c.noWa) return c;
    } catch(e) {}
  }

  var rows = getPetugasRows_();
  for (var i = 0; i < rows.length; i++) {
    var p = rows[i];
    if (!p.noWa || normalizePhone_(p.noWa) !== phone) continue;

    var status = String(p.status || '').trim().toLowerCase();
    if (status && status !== 'aktif') continue;

    var result = {
      cabang: p.cabang || '',
      nama: p.nama || 'Petugas',
      noWa: phone,
      role: p.role || 'Petugas',
      rowNumber: p.rowNumber,
      isAdmin: isAdminPetugas_(p)
    };

    try { cachePut_(cacheKey, JSON.stringify(result), 120); } catch(e2) {}
    return result;
  }

  // Pelanggan biasa jauh lebih banyak daripada petugas. Cache hasil negatif agar
  // setiap chat pelanggan tidak membaca sheet PETUGAS_CABANG berulang kali.
  try { cachePut_(cacheKey, '__NONE__', 120); } catch(e3) {}
  return null;
}

function isAdminPetugas_(p) {
  p = p || {};
  var cabang = normalizeCabangKey_(p.cabang || '');
  var role = String(p.role || '').toLowerCase();
  return cabang === normalizeCabangKey_('Admin Pusat') ||
         cabang === normalizeCabangKey_('Pusat') ||
         role.indexOf('admin') !== -1 ||
         role.indexOf('pusat') !== -1;
}

function petugasCanAccessAduan_(petugas, aduan) {
  petugas = petugas || {};
  aduan = aduan || {};
  if (!aduan.id) return false;
  if (petugas.isAdmin) return true;
  return normalizeCabangKey_(petugas.cabang) === normalizeCabangKey_(aduan.cabang);
}

function listActiveAduanForPetugas_(petugas, limit, offset) {
  petugas = petugas || {};
  limit = Number(limit || 10);
  offset = Math.max(0, Number(offset || 0));

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var list = [];
  var statusOrder = { 'Baru': 1, 'Proses': 2, 'Ditunda': 3 };

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id) return;

    var st = String(d.status || '').trim();
    if (st === 'Selesai' || st === 'Batal') return;
    if (!petugasCanAccessAduan_(petugas, d)) return;

    list.push(d);
  });

  list.sort(function(a, b) {
    var so = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
    if (so !== 0) return so;

    var ad = a.waktuMasukDate || toSafeDate_(a.waktuMasuk) || new Date(0);
    var bd = b.waktuMasukDate || toSafeDate_(b.waktuMasuk) || new Date(0);
    return bd.getTime() - ad.getTime();
  });

  return list.slice(offset, offset + limit);
}

function buildPetugasMainMenuReply_(petugas) {
  petugas = petugas || {};
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
    'Untuk ubah status aduan, kirim *FOTO dokumentasi*.',
    '',
    'Di pesan foto, tulis salah satu format berikut:',
    '',
    '*ID Aduan respon*',
    '*ID Aduan selesai*',
    '',
    'Contoh:',
    '*PRBKT3Q respon*',
    '*PRBKT3Q selesai*',
    '',
    'Bisa juga pakai No HP pelanggan atau No Pelanggan:',
    '*081907941188 respon*',
    '*081907941188 selesai*',
    '',
    'Catatan:',
    'Chat biasa tanpa foto tidak mengubah status aduan.'
  ].join('\n');
}



function buildPetugasOpenAduanResult_(phone, petugas, id) {
  var directId = normalizeAduanIdHyphen_(id || '');
  var d = findAduanById_(directId);
  if (!d) {
    return { success: false, type: 'PETUGAS_ID_NOT_FOUND', id: directId, reply: 'ID aduan tidak ditemukan: *' + (directId || '-') + '*', petugasMenu: true, petugas: petugas };
  }
  if (!petugasCanAccessAduan_(petugas, d)) {
    return { success: false, type: 'PETUGAS_FORBIDDEN', id: d.id, reply: 'Aduan ini bukan cabang Anda, jadi tidak bisa dibuka dari menu petugas.', petugasMenu: true, petugas: petugas };
  }
  try { setLastCheckedAduanIdForPhone_(phone, d.id); } catch(e) {}
  setWhatsAppSession_(phone, 'PETUGAS_VIEW_ADUAN', { id: d.id });
  return {
    success: true,
    type: 'PETUGAS_STATUS_BY_ID',
    id: d.id,
    reply: buildWhatsAppTrackingReply_(d) + '\n\nUntuk ubah status, kirim *FOTO dokumentasi*. Di pesan foto tulis: *' + d.id + ' respon* atau *' + d.id + ' selesai*.',
    navButtons: [
      { id: 'PETUGAS_UPDATE_' + d.id, title: 'Update Status' },
      { id: 'PETUGAS_FOTO_' + d.id, title: 'Upload Foto' },
      { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
    ]
  };
}

function inferPetugasSemiAiIntent_(message, hasMedia) {
  var lower = String(message || '').toLowerCase();
  // V10.9.293: betulkan typo umum ("selsai", "repon", dst) dulu supaya deteksi kata kunci
  // status di bawah ini tetap jalan walau petugas salah ketik.
  lower = normalizePetugasStatusTypos_(lower);
  var intent = { action: '', status: '', jenisFoto: '', catatan: String(message || '').trim() };

  if (hasMedia || lower.indexOf('foto') !== -1 || lower.indexOf('gambar') !== -1 || lower.indexOf('dokumentasi') !== -1) {
    intent.action = 'foto';
    if (lower.indexOf('foto sebelum') !== -1 || lower.indexOf('kondisi awal') !== -1) intent.jenisFoto = 'Foto Sebelum';
    else if (lower.indexOf('foto proses') !== -1 || lower.indexOf('saat dikerjakan') !== -1) intent.jenisFoto = 'Foto Proses';
    else if (lower.indexOf('foto selesai') !== -1 || lower.indexOf('foto sesudah') !== -1 || lower.indexOf('dokumentasi selesai') !== -1) intent.jenisFoto = 'Foto Selesai';
    else intent.jenisFoto = 'Foto Lainnya';
  }

  var containsBelumSelesai = lower.indexOf('belum selesai') !== -1 || lower.indexOf('tidak selesai') !== -1 || lower.indexOf('blm selesai') !== -1;
  var containsCek = (
    lower.indexOf('cek awal') !== -1 ||
    lower.indexOf('cek lokasi') !== -1 ||
    lower.indexOf('sudah cek') !== -1 ||
    lower.indexOf('sudah saya cek') !== -1 ||
    lower.indexOf('sudah kami cek') !== -1 ||
    lower.indexOf('di cek') !== -1 ||
    lower.indexOf('dicek') !== -1 ||
    lower.indexOf('telah dicek') !== -1 ||
    lower.indexOf('selesai di cek') !== -1 ||
    lower.indexOf('selesai dicek') !== -1 ||
    lower.indexOf('selesai saya cek') !== -1
  );
  var containsFinalResult = (
    lower.indexOf('sudah normal') !== -1 ||
    lower.indexOf('air normal') !== -1 ||
    lower.indexOf('air sudah jalan') !== -1 ||
    lower.indexOf('sudah mengalir') !== -1 ||
    lower.indexOf('sudah diperbaiki') !== -1 ||
    lower.indexOf('selesai diperbaiki') !== -1 ||
    lower.indexOf('pekerjaan selesai') !== -1 ||
    lower.indexOf('perbaikan selesai') !== -1 ||
    lower.indexOf('sudah beres') !== -1 ||
    lower.indexOf('beres') !== -1 ||
    lower.indexOf('tuntas') !== -1
  );

  // Penting: frasa seperti "sudah selesai dicek" atau "sudah selesai di cek"
  // berarti petugas selesai melakukan pengecekan awal, bukan pekerjaan sudah selesai.
  // Jadi diarahkan sebagai Respons/Proses, bukan Selesai.
  if (!containsBelumSelesai && containsCek && !containsFinalResult) {
    intent.action = intent.action || 'status';
    intent.status = 'Direspons';
    if (hasMedia && (!intent.jenisFoto || intent.jenisFoto === 'Foto Lainnya' || intent.jenisFoto === 'Foto Selesai')) intent.jenisFoto = 'Foto Respons';
    return intent;
  }

  if (!containsBelumSelesai && (
      containsFinalResult ||
      (lower.indexOf('selesai') !== -1 && !containsCek)
    )) {
    intent.action = intent.action || 'status';
    intent.status = 'Selesai';
    if (hasMedia || lower.indexOf('foto') !== -1) intent.jenisFoto = 'Foto Selesai';
    return intent;
  }

  if (
    lower.indexOf('kendala') !== -1 ||
    lower.indexOf('menunggu') !== -1 ||
    lower.indexOf('material') !== -1 ||
    lower.indexOf('belum bisa') !== -1 ||
    lower.indexOf('tidak bisa') !== -1 ||
    lower.indexOf('perlu koordinasi') !== -1 ||
    lower.indexOf('perlu penggalian') !== -1 ||
    lower.indexOf('lokasi belum jelas') !== -1 ||
    lower.indexOf('pelanggan tidak bisa dihubungi') !== -1
  ) {
    intent.action = intent.action || 'status';
    intent.status = 'Kendala';
    return intent;
  }

  if (
    lower.indexOf('dalam pengerjaan') !== -1 ||
    lower.indexOf('sedang dikerjakan') !== -1 ||
    lower.indexOf('mulai dikerjakan') !== -1 ||
    lower.indexOf('pengerjaan') !== -1 ||
    lower.indexOf('proses') !== -1 ||
    lower.indexOf('perbaikan') !== -1
  ) {
    intent.action = intent.action || 'status';
    intent.status = 'Dalam Pengerjaan';
    return intent;
  }

  if (
    lower.indexOf('respons') !== -1 ||
    lower.indexOf('respon') !== -1 ||
    lower.indexOf('cek awal') !== -1 ||
    lower.indexOf('sudah cek') !== -1 ||
    lower.indexOf('cek lokasi') !== -1 ||
    lower.indexOf('di cek') !== -1 ||
    lower.indexOf('dicek') !== -1 ||
    lower.indexOf('verifikasi') !== -1 ||
    lower.indexOf('survei') !== -1 ||
    lower.indexOf('survey') !== -1 ||
    lower.indexOf('tinjau') !== -1
  ) {
    intent.action = intent.action || 'status';
    intent.status = 'Direspons';
    if (hasMedia && (!intent.jenisFoto || intent.jenisFoto === 'Foto Lainnya')) intent.jenisFoto = 'Foto Respons';
    return intent;
  }

  return intent.action ? intent : null;
}


function isClosedAduanStatus_(status) {
  var st = String(status || '').trim().toLowerCase();
  return st === 'selesai' || st === 'batal' || st === 'dibatalkan' || st === 'closed';
}

// ============================================================
// V10.9.293 - TOLERANSI TYPO KATA STATUS PETUGAS
// Petugas di lapangan sering salah ketik kata kunci status (mis. "selsai", "Repon",
// "selesei", "respn"). Sebelumnya kata seperti ini tidak dikenali bot sehingga status
// aduan tidak berubah walau petugas sudah membalas. Fungsi ini membetulkan typo umum
// tersebut menjadi kata baku ("selesai", "respon", dst) sebelum diproses lebih lanjut,
// tanpa mengubah alur/logic pengenalan status yang sudah ada.
// ============================================================
var PETUGAS_STATUS_TYPO_MAP_ = [
  // "selesai" - typo yang sering muncul dari lapangan
  [/\bselsai\b/g, 'selesai'],
  [/\bslesai\b/g, 'selesai'],
  [/\bseselai\b/g, 'selesai'],
  [/\bselesei\b/g, 'selesai'],
  [/\bselesay\b/g, 'selesai'],
  [/\bselese\b/g, 'selesai'],
  [/\bslesei\b/g, 'selesai'],
  [/\bseleai\b/g, 'selesai'],
  [/\bselsesai\b/g, 'selesai'],
  [/\bsdh selesai\b/g, 'sudah selesai'],

  // "respon" / "respons" / "direspon" - typo yang sering muncul dari lapangan
  [/\brepon\b/g, 'respon'],
  [/\brespn\b/g, 'respon'],
  [/\bresfon\b/g, 'respon'],
  [/\brespom\b/g, 'respon'],
  [/\bresepon\b/g, 'respon'],
  [/\brespond\b/g, 'respon'],
  [/\breponn\b/g, 'respon'],
  [/\brespone\b/g, 'respon'],
  [/\bripon\b/g, 'respon'],
  [/\brspon\b/g, 'respon'],
  [/\bresponn\b/g, 'respon'],
  [/\bdirepon\b/g, 'direspon'],
  [/\bdirespn\b/g, 'direspon'],
  [/\bdireponn\b/g, 'direspon'],

  // "proses" / "pengerjaan"
  [/\bproces\b/g, 'proses'],
  [/\bprosess\b/g, 'proses'],
  [/\bprosesss\b/g, 'proses'],
  [/\bpngerjaan\b/g, 'pengerjaan'],
  [/\bpengerjan\b/g, 'pengerjaan'],

  // "kendala"
  [/\bkendal\b/g, 'kendala'],
  [/\bkndala\b/g, 'kendala'],

  // "batal" / "ditunda"
  [/\bbtal\b/g, 'batal'],
  [/\bditnda\b/g, 'ditunda']
];

function normalizePetugasStatusTypos_(text) {
  var s = String(text == null ? '' : text);
  for (var i = 0; i < PETUGAS_STATUS_TYPO_MAP_.length; i++) {
    s = s.replace(PETUGAS_STATUS_TYPO_MAP_[i][0], PETUGAS_STATUS_TYPO_MAP_[i][1]);
  }
  return s;
}

function normalizePetugasCaptionMatchText_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\*`_~]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCabangFromPetugasCaption_(text, petugas) {
  var raw = String(text || '').trim();
  var cabang = '';
  try { cabang = normalizeIncomingCabangChoice_(raw, 1); } catch(e) { cabang = ''; }

  if (!cabang) {
    var clean = normalizePetugasCaptionMatchText_(raw);
    var rows = [];
    try { rows = getCabangMenuRows_(1) || []; } catch(e2) { rows = []; }
    for (var i = 0; i < rows.length; i++) {
      var title = rows[i] && rows[i].title ? String(rows[i].title) : '';
      var key = normalizePetugasCaptionMatchText_(title.replace(/^cabang\s+/i, ''));
      var code = getCabangCodeSafe_(title).toLowerCase();
      if ((key && clean.indexOf(key) !== -1) || (code && clean.split(' ').indexOf(code) !== -1)) {
        cabang = title;
        break;
      }
    }
  }

  // Untuk petugas cabang biasa, jika caption tidak menyebut cabang,
  // pakai cabang petugas sebagai batas pencarian agar tetap aman.
  if (!cabang && petugas && !petugas.isAdmin && petugas.cabang) cabang = petugas.cabang;
  return cabang || '';
}

function extractCustomerNameFromPetugasCaption_(text, cabang) {
  var raw = String(text || '').trim();
  if (!raw) return '';
  // V10.9.293: betulkan typo kata status dulu, supaya kata seperti "selsai"/"repon" tetap
  // ikut terbuang dari daftar removeWords di bawah dan tidak "nyangkut" jadi nama pelanggan.
  raw = normalizePetugasStatusTypos_(raw);

  // Jika ada koma, biasanya formatnya: "sudah selesai, Nama Pelanggan".
  var part = raw;
  var commaParts = raw.split(',');
  if (commaParts.length > 1) part = commaParts.slice(1).join(' ');

  var clean = normalizePetugasCaptionMatchText_(part);
  var allClean = normalizePetugasCaptionMatchText_(raw);

  // Kalau bagian setelah koma terlalu kosong, fallback ke seluruh caption.
  if (!clean || clean.length < 2) clean = allClean;

  var removeWords = [
    'sudah selesai', 'sdh selesai', 'udh selesai', 'telah selesai', 'sudah beres',
    'foto selesai', 'dokumentasi selesai', 'selesai', 'beres', 'tuntas',
    'sudah normal', 'air sudah normal', 'air normal', 'normal',
    'sudah di respon', 'sudah direspons', 'sudah direspon', 'sudah respons', 'sudah respon',
    'telah di respon', 'telah direspons', 'telah direspon', 'di respon', 'direspons', 'direspon',
    'respons', 'respon', 'cek awal', 'sudah cek', 'sudah saya cek', 'cek lokasi', 'dicek',
    'dalam pengerjaan', 'sedang dikerjakan', 'mulai dikerjakan', 'pengerjaan', 'proses', 'perbaikan',
    'kendala', 'menunggu material', 'menunggu', 'material', 'belum bisa', 'tidak bisa',
    'foto', 'gambar', 'dokumentasi', 'bukti', 'laporan', 'aduan',
    'atas nama', 'nama pelanggan', 'nama', 'pelanggan', 'cabang', 'unit',
    'di', 'ke', 'untuk', 'pak', 'bu', 'bapak', 'ibu'
  ];

  removeWords.forEach(function(w) {
    var nw = normalizePetugasCaptionMatchText_(w);
    if (nw) clean = clean.replace(new RegExp('(^|\\s)' + nw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?=\\s|$)', 'g'), ' ');
  });

  if (cabang) {
    var cabangName = normalizePetugasCaptionMatchText_(String(cabang || '').replace(/^cabang\s+/i, ''));
    var cabangFull = normalizePetugasCaptionMatchText_(cabang);
    var cabangCode = String(getCabangCodeSafe_(cabang) || '').toLowerCase();
    [cabangFull, cabangName, cabangCode].forEach(function(w) {
      if (w) clean = clean.replace(new RegExp('(^|\\s)' + w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?=\\s|$)', 'g'), ' ');
    });
  }

  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function aduanNameMatchesPetugasCaption_(aduanName, queryName) {
  var a = normalizePetugasCaptionMatchText_(aduanName || '');
  var q = normalizePetugasCaptionMatchText_(queryName || '');
  if (!a || !q || q.length < 2) return false;

  if (a === q || a.indexOf(q) !== -1 || q.indexOf(a) !== -1) return true;

  var tokens = q.split(' ').filter(function(t) { return t && t.length >= 2; });
  if (!tokens.length) return false;

  var matched = 0;
  tokens.forEach(function(t) {
    if (a.indexOf(t) !== -1) matched++;
  });

  // Untuk nama pendek seperti "Doni", satu token cukup.
  if (tokens.length === 1) return matched === 1;
  return matched >= Math.min(tokens.length, 2);
}

function findActiveAduanByNameCabangForPetugas_(petugas, queryName, cabang, limit) {
  limit = Number(limit || 10);
  petugas = petugas || {};
  queryName = String(queryName || '').trim();
  var targetCabangKey = normalizeCabangKey_(cabang || '');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var found = [];

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id) return;

    // Penting: jangan tampilkan/cocokkan aduan yang sudah selesai atau batal.
    if (isClosedAduanStatus_(d.status)) return;
    if (!petugasCanAccessAduan_(petugas, d)) return;
    if (targetCabangKey && normalizeCabangKey_(d.cabang || '') !== targetCabangKey) return;
    if (!aduanNameMatchesPetugasCaption_(d.namaPelanggan || '', queryName)) return;

    found.push(d);
  });

  found.sort(function(a, b) {
    var ad = a.waktuMasukDate || toSafeDate_(a.waktuMasuk) || new Date(0);
    var bd = b.waktuMasukDate || toSafeDate_(b.waktuMasuk) || new Date(0);
    return bd.getTime() - ad.getTime();
  });

  return found.slice(0, limit);
}


function extractPetugasCaptionCustomerRefs_(text) {
  var raw = String(text || '').trim();
  var result = { phones: [], noPelangganList: [], labels: [] };
  if (!raw) return result;

  function addUnique_(arr, value) {
    value = String(value || '').trim();
    if (value && arr.indexOf(value) === -1) arr.push(value);
  }

  // No HP pelanggan: dukung format 08..., 8..., +62..., 62..., dengan spasi/strip.
  // Contoh: 0816363636, 08 1636 3636, +62816363636, 62816363636.
  var phoneRegex = /(?:\+?62|0)?8[0-9\s\-]{7,17}/g;
  var phoneMatches = raw.match(phoneRegex) || [];
  phoneMatches.forEach(function(m) {
    var digits = String(m || '').replace(/[^0-9+]/g, '');
    var norm = normalizePhone_(digits);
    if (/^62[0-9]{8,14}$/.test(norm)) {
      addUnique_(result.phones, norm);
      addUnique_(result.labels, 'No HP ' + norm);
    }
  });

  function looksLikePhoneDigits_(digits) {
    digits = String(digits || '').replace(/[^0-9]/g, '');
    if (!digits) return false;
    if (/^08[0-9]{8,14}$/.test(digits)) return true;
    if (/^628[0-9]{7,13}$/.test(digits)) return true;
    if (/^8[0-9]{8,13}$/.test(digits)) return true;
    return false;
  }

  function addNoPel_(value, fromLabel) {
    var digits = String(value || '').replace(/[^0-9]/g, '');
    if (!digits || digits.length < 5 || digits.length > 20) return;
    if (!fromLabel && looksLikePhoneDigits_(digits)) return;
    var noPel = normalizeNoPelanggan_(digits);
    if (noPel) {
      addUnique_(result.noPelangganList, noPel);
      addUnique_(result.labels, 'No Pelanggan ' + noPel);
    }
  }

  // Jika petugas menulis label eksplisit, anggap sebagai No Pelanggan walaupun format angkanya mirip nomor.
  var labelRegex = /\b(?:no\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan|idpel|no\s*pel|nopel|nopa|id)\b\s*[:=\-]?\s*([0-9][0-9\s\-]{4,24})/gi;
  var lm;
  while ((lm = labelRegex.exec(raw)) !== null) addNoPel_(lm[1], true);

  // Fallback angka panjang tanpa label. Ini untuk caption: "sudah selesai, 1234567".
  var numberRegex = /\b[0-9][0-9\s\-]{4,24}\b/g;
  var nm;
  while ((nm = numberRegex.exec(raw)) !== null) addNoPel_(nm[0], false);

  return result;
}

function hasPetugasCaptionCustomerRefs_(refs) {
  refs = refs || {};
  return (refs.phones && refs.phones.length) || (refs.noPelangganList && refs.noPelangganList.length);
}

function getPetugasCaptionRefsLabel_(refs) {
  refs = refs || {};
  var labels = refs.labels || [];
  if (labels.length) return labels.join(', ');
  var list = [];
  (refs.phones || []).forEach(function(x) { list.push('No HP ' + x); });
  (refs.noPelangganList || []).forEach(function(x) { list.push('No Pelanggan ' + x); });
  return list.join(', ') || '-';
}

function findActiveAduanByCustomerRefsForPetugas_(petugas, refs, cabang, limit) {
  limit = Number(limit || 10);
  petugas = petugas || {};
  refs = refs || {};
  var phones = refs.phones || [];
  var noPels = refs.noPelangganList || [];
  var targetCabangKey = normalizeCabangKey_(cabang || '');

  if (!phones.length && !noPels.length) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var found = [];

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id) return;
    if (isClosedAduanStatus_(d.status)) return;
    if (!petugasCanAccessAduan_(petugas, d)) return;
    if (targetCabangKey && normalizeCabangKey_(d.cabang || '') !== targetCabangKey) return;

    var rowPhone = normalizePhone_(d.noHp || '');
    var rowNoPel = normalizeNoPelanggan_(getNoPelangganFromAduan_(d));
    var matchPhone = rowPhone && phones.indexOf(rowPhone) !== -1;
    var matchNoPel = rowNoPel && noPels.indexOf(rowNoPel) !== -1;
    if (!matchPhone && !matchNoPel) return;

    d._matchBy = matchPhone ? ('No HP ' + rowPhone) : ('No Pelanggan ' + rowNoPel);
    found.push(d);
  });

  found.sort(function(a, b) {
    var ad = a.waktuMasukDate || toSafeDate_(a.waktuMasuk) || new Date(0);
    var bd = b.waktuMasukDate || toSafeDate_(b.waktuMasuk) || new Date(0);
    return bd.getTime() - ad.getTime();
  });

  return found.slice(0, limit);
}

function buildPetugasCaptionMatchCandidatesReply_(queryName, cabang, list) {
  list = list || [];
  var lines = [
    'Ditemukan beberapa aduan aktif yang mirip.',
    '',
    'Data dicari: *' + (queryName || '-') + '*',
    'Cabang: *' + (cabang || '-') + '*',
    '',
    'Balas nomor aduan yang benar:'
  ];

  list.forEach(function(d, idx) {
    lines.push((idx + 1) + '. *' + (d.id || '-') + '* - ' + (d.namaPelanggan || '-') + ' - ' + (d.jenisGangguan || '-') + ' - ' + (d.status || '-'));
    var refInfo = [];
    if (getNoPelangganFromAduan_(d)) refInfo.push('No Pel: ' + getNoPelangganFromAduan_(d));
    if (d.noHp) refInfo.push('No HP: ' + d.noHp);
    if (refInfo.length) lines.push('   ' + refInfo.join(' | '));
    if (d.lokasiDetail) lines.push('   Lokasi: ' + String(d.lokasiDetail).substring(0, 80));
  });

  lines.push('');
  lines.push('Catatan: aduan yang sudah *Selesai/Batal* tidak ditampilkan.');
  lines.push('Kalau ragu, kirim ulang FOTO. Di pesan foto, tulis *ID Aduan*.');
  return lines.join('\n');
}

function handlePetugasCaptionPhotoSelection_(message, phone, payload, petugas, session) {
  session = session || {};
  var data = session.data || {};
  var candidates = data.candidates || [];
  var lower = String(message || '').trim().toLowerCase();

  if (lower === 'menu' || lower === 'menu utama' || lower === 'petugas menu') {
    clearWhatsAppSession_(phone);
    return { success: true, type: 'PETUGAS_MENU', reply: buildPetugasMainMenuReply_(petugas), petugasMenu: true, petugas: petugas };
  }

  var selectedId = extractAduanId_(message);
  if (!selectedId) {
    var m = lower.match(/^0*([1-9]|10)$/);
    if (m) {
      var idx = Number(m[1]) - 1;
      if (candidates[idx]) selectedId = candidates[idx].id || '';
    }
  }

  if (!selectedId) {
    return {
      success: true,
      type: 'PETUGAS_CAPTION_PHOTO_WAIT_SELECTION',
      reply: 'Balas nomor pilihan yang benar, atau kirim ID aduan. Ketik *batal* untuk membatalkan.',
      navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
    };
  }

  var aduan = findAduanById_(selectedId);
  if (!aduan || !petugasCanAccessAduan_(petugas, aduan)) {
    clearWhatsAppSession_(phone);
    return { success: false, type: 'PETUGAS_CAPTION_PHOTO_INVALID_SELECTION', reply: 'Aduan tidak ditemukan atau bukan cabang Anda.', petugasMenu: true, petugas: petugas };
  }

  if (isClosedAduanStatus_(aduan.status)) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'PETUGAS_CAPTION_PHOTO_ALREADY_CLOSED',
      reply: 'Aduan *' + aduan.id + '* sudah berstatus *' + (aduan.status || '-') + '*, jadi tidak ditampilkan/diproses sebagai aduan aktif.',
      petugasMenu: true,
      petugas: petugas
    };
  }

  var media = data.media || (payload && payload.media) || null;
  if (!media || !media.url) {
    clearWhatsAppSession_(phone);
    return { success: false, type: 'PETUGAS_CAPTION_PHOTO_MEDIA_EXPIRED', reply: 'Foto sebelumnya tidak terbaca lagi. Mohon kirim ulang FOTO. Di pesan foto, tulis ID Aduan.', petugasMenu: true, petugas: petugas };
  }

  clearWhatsAppSession_(phone);
  var fakeSession = {
    state: 'PETUGAS_AWAIT_PHOTO',
    data: {
      id: aduan.id,
      jenisFoto: data.jenisFoto || 'Foto Selesai',
      autoFinish: !!data.autoFinish,
      autoStatus: data.autoStatus || '',
      catatan: data.caption || ''
    }
  };
  return handlePetugasReceivePhoto_(phone, petugas, fakeSession, media, { media: media, caption: data.caption || '', source: 'PETUGAS_CAPTION_PHOTO_SELECTION' });
}

function buildPetugasCaptionPhotoTarget_(intent) {
  intent = intent || {};
  var status = normalizeInputStatus_(intent.status || '');

  if (status === 'Selesai') {
    return {
      jenisFoto: 'Foto Selesai',
      autoFinish: true,
      autoStatus: 'Selesai',
      label: 'Selesai',
      contoh: '081907941188 selesai'
    };
  }

  // Arahan V10.9.156:
  // Jika petugas kirim Foto Respons, aduan langsung masuk proses/pengerjaan.
  // SLA respons tetap tercatat karena status Dalam Pengerjaan dihitung sebagai sudah direspons.
  if (status === 'Direspons') {
    return {
      jenisFoto: 'Foto Respons',
      autoFinish: false,
      autoStatus: 'Dalam Pengerjaan',
      label: 'Respons / Proses',
      contoh: '081907941188 respon'
    };
  }

  if (status === 'Dalam Pengerjaan') {
    return {
      jenisFoto: 'Foto Proses',
      autoFinish: false,
      autoStatus: 'Dalam Pengerjaan',
      label: 'Dalam Pengerjaan',
      contoh: '081907941188 respon'
    };
  }

  if (status === 'Kendala') {
    return {
      jenisFoto: 'Foto Lainnya',
      autoFinish: false,
      autoStatus: 'Kendala',
      label: 'Kendala',
      contoh: 'PRBKT3Q respon'
    };
  }

  return null;
}


// ============================================================
// V10.9.281 - PETUGAS TEKS STATUS TANPA FOTO
// Jika petugas mengetik "ID/No HP/No Pelanggan proses/selesai/respon"
// tanpa melampirkan foto, sistem tidak langsung mengubah status.
// Sistem menyimpan sesi dan meminta foto dokumentasi terlebih dahulu.
// ============================================================
function buildPetugasNeedPhotoReply_(aduan, target, catatan, refLabel) {
  aduan = aduan || {};
  target = target || {};
  var statusTujuan = target.autoFinish ? 'Selesai' : (target.autoStatus || target.label || '-');
  var noPelanggan = getNoPelangganFromAduan_(aduan);

  return [
    'Aduan ditemukan: *' + (aduan.id || '-') + '*',
    'Pelanggan: *' + (aduan.namaPelanggan || '-') + '*',
    noPelanggan ? 'No Pelanggan: *' + noPelanggan + '*' : '',
    '',
    'Status belum diubah karena belum ada foto dokumentasi.',
    'Silakan kirim *FOTO* sekarang.',
    'Di pesan foto boleh dikosongkan.',
    '',
    'Ketik *batal* jika tidak jadi.'
  ].filter(function(x) { return String(x || '').trim() !== ''; }).join('\n');
}

function preparePetugasAwaitPhotoFromText_(phone, petugas, aduan, target, catatan, refLabel) {
  aduan = aduan || {};
  target = target || {};
  if (!aduan.id) return null;

  try { setLastCheckedAduanIdForPhone_(phone, aduan.id); } catch(e) {}

  setWhatsAppSession_(phone, 'PETUGAS_AWAIT_PHOTO', {
    id: aduan.id,
    jenisFoto: normalizeDashboardJenisFoto_(target.jenisFoto || 'Foto Lainnya'),
    autoFinish: !!target.autoFinish,
    autoStatus: target.autoStatus || '',
    catatan: catatan || ''
  });

  return {
    success: true,
    type: 'PETUGAS_TEXT_STATUS_NEED_PHOTO',
    id: aduan.id,
    reply: buildPetugasNeedPhotoReply_(aduan, target, catatan || '', refLabel || ''),
    navButtons: [
      { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
    ]
  };
}

function buildPetugasTextNeedPhotoCandidatesReply_(label, cabang, list, target) {
  list = list || [];
  target = target || {};
  var lines = [
    'Ditemukan beberapa aduan aktif yang cocok.',
    '',
    'Data dicari: *' + (label || '-') + '*',
    'Cabang: *' + (cabang || '-') + '*',
    'Status tujuan: *' + (target.autoFinish ? 'Selesai' : (target.autoStatus || target.label || '-')) + '*',
    '',
    'Balas nomor pilihan atau ID Aduan yang benar. Setelah itu bot akan minta foto dokumentasi.'
  ];

  list.forEach(function(d, idx) {
    lines.push((idx + 1) + '. *' + (d.id || '-') + '* - ' + (d.namaPelanggan || '-') + ' - ' + (d.jenisGangguan || '-') + ' - ' + (d.status || '-'));
    var refInfo = [];
    if (getNoPelangganFromAduan_(d)) refInfo.push('No Pel: ' + getNoPelangganFromAduan_(d));
    if (d.noHp) refInfo.push('No HP: ' + normalizePhone_(d.noHp));
    if (refInfo.length) lines.push('   ' + refInfo.join(' | '));
    if (d.lokasiDetail) lines.push('   Lokasi: ' + String(d.lokasiDetail).substring(0, 80));
  });

  lines.push('');
  lines.push('Kalau ingin batal, ketik *batal* atau *menu*.');
  return lines.join('\n');
}

function handlePetugasTextNeedPhotoSelection_(message, phone, payload, petugas, session) {
  session = session || {};
  var data = session.data || {};
  var candidates = data.candidates || [];
  var lower = String(message || '').trim().toLowerCase();

  if (lower === 'menu' || lower === 'menu utama' || lower === 'petugas menu') {
    clearWhatsAppSession_(phone);
    return { success: true, type: 'PETUGAS_MENU', reply: buildPetugasMainMenuReply_(petugas), petugasMenu: true, petugas: petugas };
  }

  var selectedId = extractAduanId_(message);
  if (!selectedId) {
    var m = lower.match(/^0*([1-9]|10)$/);
    if (m) {
      var idx = Number(m[1]) - 1;
      if (candidates[idx]) selectedId = candidates[idx].id || '';
    }
  }

  if (!selectedId) {
    return {
      success: true,
      type: 'PETUGAS_TEXT_NEED_PHOTO_WAIT_SELECTION',
      reply: 'Balas nomor pilihan yang benar atau kirim ID aduan. Ketik *batal* untuk membatalkan.',
      navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
    };
  }

  var aduan = findAduanById_(selectedId);
  if (!aduan || !petugasCanAccessAduan_(petugas, aduan)) {
    clearWhatsAppSession_(phone);
    return { success: false, type: 'PETUGAS_TEXT_NEED_PHOTO_INVALID_SELECTION', reply: 'Aduan tidak ditemukan atau bukan cabang Anda.', petugasMenu: true, petugas: petugas };
  }

  if (isClosedAduanStatus_(aduan.status)) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'PETUGAS_TEXT_NEED_PHOTO_ALREADY_CLOSED',
      reply: 'Aduan *' + aduan.id + '* sudah berstatus *' + (aduan.status || '-') + '*, jadi tidak bisa diproses sebagai aduan aktif.',
      petugasMenu: true,
      petugas: petugas
    };
  }

  clearWhatsAppSession_(phone);
  return preparePetugasAwaitPhotoFromText_(
    phone,
    petugas,
    aduan,
    data.target || {},
    data.catatan || '',
    data.refLabel || ''
  );
}

function handlePetugasPhotoCaptionWithoutId_(message, phone, payload, petugas) {
  payload = payload || {};
  petugas = petugas || {};
  var media = payload.media || null;
  if (!media || !media.url) return null;
  if (extractAduanId_(message)) return null;

  var caption = String(message || media.caption || '').trim();
  if (!caption) return null;

  var intent = inferPetugasSemiAiIntent_(caption, true);
  if (!intent || !intent.status) return null;

  var target = buildPetugasCaptionPhotoTarget_(intent);
  if (!target) return null;

  var refs = extractPetugasCaptionCustomerRefs_(caption);
  var hasRefs = hasPetugasCaptionCustomerRefs_(refs);
  var cabang = detectCabangFromPetugasCaption_(caption, petugas);
  if (!cabang && !(petugas && petugas.isAdmin && hasRefs)) {
    return {
      success: true,
      type: 'PETUGAS_CAPTION_PHOTO_NEED_CABANG',
      reply: [
        'Foto diterima, tapi cabang belum terbaca.',
        '',
        'Di pesan foto tanpa ID, tulis salah satu data pelanggan: nama, No HP, atau No Pelanggan.',
        'Contoh: *' + (target.contoh || '081907941188 respon') + '*',
        '',
        'Lebih aman: di pesan foto tulis ID Aduan, contoh: *PRY7K2A respon*.'
      ].join('\n'),
      petugasMenu: true,
      petugas: petugas
    };
  }

  if (hasRefs) {
    var refLabel = getPetugasCaptionRefsLabel_(refs);
    var refMatches = findActiveAduanByCustomerRefsForPetugas_(petugas, refs, cabang, 10);

    if (refMatches.length === 0) {
      return {
        success: true,
        type: 'PETUGAS_CAPTION_PHOTO_NO_ACTIVE_REF_MATCH',
        reply: [
          'Aduan aktif dengan data *' + refLabel + '* ' + (cabang ? 'di *' + cabang + '* ' : '') + 'tidak ditemukan.',
          '',
          'Aduan yang sudah *Selesai/Batal* memang tidak dimunculkan.',
          '',
          'Mohon kirim ulang FOTO. Di pesan foto, tulis ID Aduan, contoh:',
          '*PRY7K2A respon*'
        ].join('\n'),
        petugasMenu: true,
        petugas: petugas
      };
    }

    if (refMatches.length === 1) {
      var byRef = refMatches[0];
      var fakeSessionByRef = {
        state: 'PETUGAS_AWAIT_PHOTO',
        data: {
          id: byRef.id,
          jenisFoto: target.jenisFoto,
          autoFinish: !!target.autoFinish,
          autoStatus: target.autoStatus || '',
          catatan: caption
        }
      };
      return handlePetugasReceivePhoto_(phone, petugas, fakeSessionByRef, media, payload);
    }

    setWhatsAppSession_(phone, 'PETUGAS_SELECT_PHOTO_ADUAN_BY_NAME', {
      jenisFoto: target.jenisFoto,
      autoFinish: !!target.autoFinish,
      autoStatus: target.autoStatus || '',
      caption: caption,
      media: media,
      candidates: refMatches.map(function(d) { return { id: d.id, status: d.status, nama: d.namaPelanggan, cabang: d.cabang }; })
    });

    return {
      success: true,
      type: 'PETUGAS_CAPTION_PHOTO_MULTIPLE_REF_MATCH',
      reply: buildPetugasCaptionMatchCandidatesReply_(refLabel, cabang || 'Semua Cabang', refMatches),
      navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
    };
  }

  var queryName = extractCustomerNameFromPetugasCaption_(caption, cabang);
  if (!queryName || queryName.length < 2) {
    return {
      success: true,
      type: 'PETUGAS_CAPTION_PHOTO_NEED_NAME',
      reply: [
        'Foto diterima, tapi data pelanggan belum terbaca jelas.',
        '',
        'Contoh pesan foto:',
        '*' + (target.contoh || '081907941188 respon') + '*',
        '',
        'Atau di pesan foto gunakan ID Aduan:',
        '*PRY7K2A respon*'
      ].join('\n'),
      petugasMenu: true,
      petugas: petugas
    };
  }

  var matches = findActiveAduanByNameCabangForPetugas_(petugas, queryName, cabang, 10);

  if (matches.length === 0) {
    return {
      success: true,
      type: 'PETUGAS_CAPTION_PHOTO_NO_ACTIVE_MATCH',
      reply: [
        'Aduan aktif dengan data *' + queryName + '* di *' + cabang + '* tidak ditemukan.',
        '',
        'Aduan yang sudah *Selesai/Batal* memang tidak dimunculkan.',
        '',
        'Mohon kirim ulang FOTO. Di pesan foto, tulis ID Aduan, contoh:',
        '*PRY7K2A respon*'
      ].join('\n'),
      petugasMenu: true,
      petugas: petugas
    };
  }

  if (matches.length === 1) {
    var only = matches[0];
    var fakeSession = {
      state: 'PETUGAS_AWAIT_PHOTO',
      data: {
        id: only.id,
        jenisFoto: target.jenisFoto,
        autoFinish: !!target.autoFinish,
        autoStatus: target.autoStatus || '',
        catatan: caption
      }
    };
    return handlePetugasReceivePhoto_(phone, petugas, fakeSession, media, payload);
  }

  setWhatsAppSession_(phone, 'PETUGAS_SELECT_PHOTO_ADUAN_BY_NAME', {
    jenisFoto: target.jenisFoto,
    autoFinish: !!target.autoFinish,
    autoStatus: target.autoStatus || '',
    caption: caption,
    media: media,
    candidates: matches.map(function(d) { return { id: d.id, status: d.status, nama: d.namaPelanggan, cabang: d.cabang }; })
  });

  return {
    success: true,
    type: 'PETUGAS_CAPTION_PHOTO_MULTIPLE_MATCH',
    reply: buildPetugasCaptionMatchCandidatesReply_(queryName, cabang, matches),
    navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
  };
}


function handlePetugasSemiAiCommand_(message, phone, payload, petugas) {
  var id = extractAduanId_(message);
  if (!id) return null;

  payload = payload || {};
  var media = payload.media || null;
  var hasMedia = !!(media && media.url);
  var intent = inferPetugasSemiAiIntent_(message, hasMedia);
  if (!intent) return null;

  var aduan = findAduanById_(id);
  if (!aduan) return { success: false, type: 'PETUGAS_SEMI_AI_NOT_FOUND', id: id, reply: 'ID aduan tidak ditemukan: *' + id + '*', petugasMenu: true, petugas: petugas };
  if (!petugasCanAccessAduan_(petugas, aduan)) return { success: false, type: 'PETUGAS_SEMI_AI_FORBIDDEN', id: aduan.id, reply: 'Aduan ini bukan cabang Anda.', petugasMenu: true, petugas: petugas };

  try { setLastCheckedAduanIdForPhone_(phone, aduan.id); } catch(e) {}

  var target = intent.status ? buildPetugasCaptionPhotoTarget_(intent) : null;

  if (hasMedia) {
    var jenisFoto = normalizeDashboardJenisFoto_(
      (target && target.jenisFoto) ||
      intent.jenisFoto ||
      (intent.status === 'Selesai' ? 'Foto Selesai' : (intent.status === 'Direspons' ? 'Foto Respons' : 'Foto Lainnya'))
    );
    var fakeSession = {
      state: 'PETUGAS_AWAIT_PHOTO',
      data: {
        id: aduan.id,
        jenisFoto: jenisFoto,
        autoFinish: (target ? !!target.autoFinish : isFinalDocumentationJenis_(jenisFoto)),
        autoStatus: (target && target.autoStatus) ? target.autoStatus : ((isResponseDocumentationJenis_(jenisFoto) || intent.status === 'Direspons') ? 'Dalam Pengerjaan' : ''),
        catatan: intent.catatan || message
      }
    };
    return handlePetugasReceivePhoto_(phone, petugas, fakeSession, media, payload);
  }

  // V10.9.281:
  // Petugas sering mengetik "JNP4EN2 proses" tanpa foto.
  // Jangan langsung ubah status; simpan sesi dan minta foto terlebih dahulu.
  if (target) {
    return preparePetugasAwaitPhotoFromText_(phone, petugas, aduan, target, intent.catatan || message, 'ID Aduan ' + aduan.id);
  }

  if (intent.action === 'foto') {
    var jenis = normalizeDashboardJenisFoto_(intent.jenisFoto || 'Foto Lainnya');
    setWhatsAppSession_(phone, 'PETUGAS_AWAIT_PHOTO', {
      id: aduan.id,
      jenisFoto: jenis,
      autoFinish: isFinalDocumentationJenis_(jenis),
      autoStatus: isResponseDocumentationJenis_(jenis) ? 'Dalam Pengerjaan' : '',
      catatan: intent.catatan || message
    });
    return {
      success: true,
      type: 'PETUGAS_SEMI_AI_AWAIT_PHOTO',
      id: aduan.id,
      reply: [
        'Baik, kirim foto untuk aduan ini.',
        '',
        'ID Aduan: *' + aduan.id + '*',
        'Jenis Foto: *' + jenis + '*',
        isFinalDocumentationJenis_(jenis) ? 'Setelah foto diterima, tekan *Ya* untuk menutup aduan sebagai *Selesai*.' : '',
        isResponseDocumentationJenis_(jenis) ? 'Setelah foto diterima, tekan *Ya* untuk mengubah status menjadi *Dalam Pengerjaan/Proses*.' : '',
        '',
        'Kalau batal, ketik *batal*.'
      ].filter(function(x) { return String(x || '').trim() !== ''; }).join('\n'),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  return null;
}



function handlePetugasNoIdTextStatusCommand_(message, phone, payload, petugas) {
  payload = payload || {};
  petugas = petugas || {};
  var media = payload.media || null;
  if (media && media.url) return null;
  if (extractAduanId_(message)) return null;

  var text = String(message || '').trim();
  if (!text) return null;

  var intent = inferPetugasSemiAiIntent_(text, false);
  if (!intent || !intent.status) return null;

  var target = buildPetugasCaptionPhotoTarget_(intent);
  if (!target) return null;

  var cabang = detectCabangFromPetugasCaption_(text, petugas);
  var refs = extractPetugasCaptionCustomerRefs_(text);
  var hasRefs = hasPetugasCaptionCustomerRefs_(refs);

  // Format lapangan paling sering: "6287717931691 proses" / "40215842 selesai".
  // Tangani hanya jika ada No HP/No Pelanggan, atau ada koma/nama agar chat biasa tidak ketarik.
  if (hasRefs) {
    var refLabel = getPetugasCaptionRefsLabel_(refs);
    var refMatches = findActiveAduanByCustomerRefsForPetugas_(petugas, refs, cabang, 10);

    if (refMatches.length === 0) {
      return {
        success: true,
        type: 'PETUGAS_NO_ID_TEXT_NO_ACTIVE_REF_MATCH',
        reply: [
          'Perintah terbaca, tapi aduan aktif dengan data *' + refLabel + '* ' + (cabang ? 'di *' + cabang + '* ' : '') + 'tidak ditemukan.',
          '',
          'Status belum diubah karena foto tetap wajib.',
          '',
          'Mohon kirim *FOTO*. Di pesan foto, tulis *ID Aduan*, contoh:',
          '*PRY7K2A respon*',
          '*PRY7K2A selesai*'
        ].join('\n'),
        navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
      };
    }

    if (refMatches.length === 1) {
      return preparePetugasAwaitPhotoFromText_(phone, petugas, refMatches[0], target, text, refLabel);
    }

    setWhatsAppSession_(phone, 'PETUGAS_SELECT_TEXT_ADUAN_NEED_PHOTO', {
      target: target,
      catatan: text,
      refLabel: refLabel,
      candidates: refMatches.map(function(d) { return { id: d.id, status: d.status, nama: d.namaPelanggan, cabang: d.cabang }; })
    });

    return {
      success: true,
      type: 'PETUGAS_NO_ID_TEXT_MULTIPLE_REF_MATCH',
      reply: buildPetugasTextNeedPhotoCandidatesReply_(refLabel, cabang || 'Semua Cabang', refMatches, target),
      navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
    };
  }

  // Untuk nama pelanggan, tetap batasi ke format yang jelas seperti:
  // "proses, ab kadir" agar kata "proses" saja tidak dianggap perintah.
  if (text.indexOf(',') === -1) return null;

  var queryName = extractCustomerNameFromPetugasCaption_(text, cabang || (petugas && petugas.cabang) || '');
  if (!queryName || queryName.length < 2) return null;

  var matches = findActiveAduanByNameCabangForPetugas_(petugas, queryName, cabang || (petugas && petugas.cabang) || '', 10);

  if (matches.length === 0) {
    return {
      success: true,
      type: 'PETUGAS_NO_ID_TEXT_NO_ACTIVE_NAME_MATCH',
      reply: [
        'Perintah terbaca untuk data *' + queryName + '*, tapi aduan aktifnya belum ditemukan.',
        '',
        'Status belum diubah karena foto tetap wajib.',
        '',
        'Mohon kirim *FOTO*. Di pesan foto, tulis *ID Aduan*, contoh:',
        '*PRY7K2A respon*',
        '*PRY7K2A selesai*'
      ].join('\n'),
      navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
    };
  }

  if (matches.length === 1) {
    return preparePetugasAwaitPhotoFromText_(phone, petugas, matches[0], target, text, 'Nama ' + queryName);
  }

  setWhatsAppSession_(phone, 'PETUGAS_SELECT_TEXT_ADUAN_NEED_PHOTO', {
    target: target,
    catatan: text,
    refLabel: 'Nama ' + queryName,
    candidates: matches.map(function(d) { return { id: d.id, status: d.status, nama: d.namaPelanggan, cabang: d.cabang }; })
  });

  return {
    success: true,
    type: 'PETUGAS_NO_ID_TEXT_MULTIPLE_NAME_MATCH',
    reply: buildPetugasTextNeedPhotoCandidatesReply_(queryName, cabang || ((petugas && petugas.cabang) || '-'), matches, target),
    navButtons: [{ id: 'PETUGAS_MENU', title: 'Menu Petugas' }]
  };
}


function handlePetugasWhatsAppMessage_(message, phone, payload, petugas) {
  message = String(message || '').trim();
  phone = normalizePhone_(phone || '');
  payload = payload || {};
  petugas = petugas || {};

  var lower = message.toLowerCase();
  var session = getWhatsAppSession_(phone);
  var media = payload.media || null;

  if (['batal', 'cancel', 'reset', 'ulang'].indexOf(lower) !== -1) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'PETUGAS_CANCEL',
      reply: 'Baik, proses petugas dibatalkan.',
      petugasMenu: true,
      petugas: petugas
    };
  }

  if (session && session.state === 'PETUGAS_AWAIT_PHOTO') {
    if (media && media.url) {
      return handlePetugasReceivePhoto_(phone, petugas, session, media, payload);
    }

    if (lower === 'menu' || lower === 'menu utama' || lower === 'petugas menu') {
      clearWhatsAppSession_(phone);
      return { success: true, type: 'PETUGAS_MENU', reply: buildPetugasMainMenuReply_(petugas), petugasMenu: true, petugas: petugas };
    }

    return {
      success: true,
      type: 'PETUGAS_AWAIT_PHOTO',
      reply: [
        '📷 Silakan kirim *foto* untuk aduan:',
        '*' + ((session.data && session.data.id) || '-') + '*',
        '',
        'Jenis foto: *' + ((session.data && session.data.jenisFoto) || '-') + '*',
        ((session.data && session.data.autoFinish) ? 'Setelah foto diterima, tekan *Ya* untuk menutup aduan sebagai *Selesai*.' : ''),
        ((session.data && session.data.autoStatus) ? 'Setelah foto diterima, tekan *Ya* untuk mengubah status menjadi *' + session.data.autoStatus + '*.' : ''),
        '',
        'Kalau ingin batal, ketik *batal*.'
      ].filter(function(x) { return String(x || '').trim() !== ''; }).join('\n'),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  if (session && session.state === 'PETUGAS_CONFIRM_PHOTO_STATUS') {
    if (lower === 'menu' || lower === 'menu utama' || lower === 'petugas menu') {
      clearPetugasPendingConfirmStatus_(phone);
      clearWhatsAppSession_(phone);
      return { success: true, type: 'PETUGAS_MENU', reply: buildPetugasMainMenuReply_(petugas), petugasMenu: true, petugas: petugas };
    }

    if (isPetugasConfirmYesText_(lower)) {
      var confirmId = session.data && session.data.id;
      var confirmStatus = session.data && session.data.targetStatus;
      var confirmCatatan = session.data && session.data.catatan;
      clearPetugasPendingConfirmStatus_(phone);
      clearWhatsAppSession_(phone);
      return handlePetugasUpdateStatus_(phone, petugas, confirmId, confirmStatus, confirmCatatan || 'Konfirmasi status setelah upload foto.', { skipPhotoRequirement: true });
    }

    if (isPetugasConfirmNoText_(lower)) {
      var cancelId = session.data && session.data.id;
      cleanupPetugasPendingPhotoDocumentation_(session.data || {});
      clearPetugasPendingConfirmStatus_(phone);
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'PETUGAS_CONFIRM_STATUS_CANCELLED',
        id: cancelId,
        reply: [
          'Baik, perubahan status dibatalkan.',
          '',
          'Foto yang baru dikirim tidak disimpan sebagai dokumentasi aktif.',
          'ID Aduan: *' + (cancelId || '-') + '*',
          '',
          'Status aduan tidak diubah.'
        ].join('\n'),
        petugasMenu: true,
        petugas: petugas
      };
    }

    return {
      success: true,
      type: 'PETUGAS_CONFIRM_STATUS_WAIT',
      reply: buildPetugasConfirmPhotoStatusReply_(session.data && session.data.id, session.data && session.data.jenisFoto, session.data && session.data.targetStatus),
      navButtons: buildPetugasConfirmButtons_()
    };
  }

  // V10.9.160: jika balasan tombol Ya/Tidak tidak membawa sesi normal,
  // tetap proses dari pending konfirmasi terakhir nomor petugas.
  var pendingConfirmFallback = handlePetugasPendingConfirmFallback_(message, phone, petugas);
  if (pendingConfirmFallback) return pendingConfirmFallback;

  if (session && session.state === 'PETUGAS_CONFIRM_SELESAI') {
    if (lower.indexOf('ya') !== -1 || lower.indexOf('selesai') !== -1 || lower === 'petugas selesai ya') {
      var doneId = session.data && session.data.id;
      clearWhatsAppSession_(phone);
      return handlePetugasUpdateStatus_(phone, petugas, doneId, 'Selesai', 'Konfirmasi selesai setelah upload Foto Selesai.', { skipPhotoRequirement: true });
    }

    if (lower.indexOf('belum') !== -1 || lower.indexOf('tidak') !== -1 || lower.indexOf('proses') !== -1 || lower === 'petugas selesai tidak') {
      var keepId = session.data && session.data.id;
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'PETUGAS_FOTO_TETAP_PROSES',
        id: keepId,
        reply: [
          '✅ Foto sudah tersimpan.',
          '',
          'Status aduan *tetap Proses*.',
          'ID Aduan: *' + (keepId || '-') + '*'
        ].join('\n'),
        petugasMenu: true,
        petugas: petugas
      };
    }
  }

  if (session && session.state === 'PETUGAS_SELECT_PHOTO_ADUAN_BY_NAME') {
    return handlePetugasCaptionPhotoSelection_(message, phone, payload, petugas, session);
  }

  if (session && session.state === 'PETUGAS_SELECT_TEXT_ADUAN_NEED_PHOTO') {
    return handlePetugasTextNeedPhotoSelection_(message, phone, payload, petugas, session);
  }

  if (session && session.state === 'PETUGAS_CARI_ADUAN') {
    if (lower === 'menu' || lower === 'menu utama' || lower === 'petugas menu') {
      clearWhatsAppSession_(phone);
      return { success: true, type: 'PETUGAS_MENU', reply: buildPetugasMainMenuReply_(petugas), petugasMenu: true, petugas: petugas };
    }

    var cariId = extractAduanId_(message);
    if (!cariId) {
      return {
        success: true,
        type: 'PETUGAS_CARI_WAIT_ID',
        reply: [
          'Kirim ID aduan yang ingin dicari.',
          '',
          'Contoh: *PRY7K2A*',
          'Atau ketik *menu* untuk kembali.'
        ].join('\n'),
        navButtons: [
          { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
        ]
      };
    }

    clearWhatsAppSession_(phone);
    return buildPetugasOpenAduanResult_(phone, petugas, cariId);
  }

  // V10.9.48:
  // Beberapa provider mengirim title list, bukan row id.
  // Jadi saat bot sedang menunggu pilihan aduan, teks ID aduan langsung diarahkan sesuai action terakhir.
  var selectedAduanIdFromMessage = extractAduanId_(message);

  if (session && session.state === 'PETUGAS_SELECT_ADUAN' && selectedAduanIdFromMessage) {
    var selectAction = session.data && session.data.action ? String(session.data.action).toLowerCase() : '';
    if (selectAction === 'foto') {
      return handlePetugasSelectAduanForFoto_(phone, petugas, selectedAduanIdFromMessage);
    }
    if (selectAction === 'update') {
      return handlePetugasSelectAduanForUpdate_(phone, petugas, selectedAduanIdFromMessage);
    }
  }

  // Kalau petugas sedang melihat detail aduan lalu tekan tombol Upload Foto/Update Status
  // dan provider hanya mengirim title tombol, tetap langsung pakai ID aduan terakhir.
  if (session && session.state === 'PETUGAS_VIEW_ADUAN' && session.data && session.data.id) {
    if (lower === 'upload foto' || lower.indexOf('upload foto') !== -1 || lower.indexOf('foto bukti') !== -1) {
      return handlePetugasSelectAduanForFoto_(phone, petugas, session.data.id);
    }

    if (lower === 'update status' || lower.indexOf('update status') !== -1) {
      return handlePetugasSelectAduanForUpdate_(phone, petugas, session.data.id);
    }
  }

  // V10.9.94:
  // Provider WA kadang hanya mengirim judul tombol "Upload Foto" dan sesi PETUGAS_VIEW_ADUAN
  // tidak ikut terbaca. Pakai ID aduan terakhir sebagai fallback, termasuk untuk aduan yang sudah Selesai.
  if (lower === 'upload foto' || lower.indexOf('upload foto') !== -1 || lower.indexOf('foto bukti') !== -1) {
    var lastFotoAduanId = getLastCheckedAduanIdForPhone_(phone);
    if (lastFotoAduanId) {
      var lastFotoAduan = findAduanById_(lastFotoAduanId);
      if (lastFotoAduan && petugasCanAccessAduan_(petugas, lastFotoAduan)) {
        return handlePetugasSelectAduanForFoto_(phone, petugas, lastFotoAduanId);
      }
    }
  }

  // Kalau provider mengirim title status saja dari list status.
  if (session && session.state === 'PETUGAS_UPDATE_STATUS' && session.data && session.data.id) {
    var lowerFixedTypo = normalizePetugasStatusTypos_(lower);
    if (['baru', 'respons', 'respon', 'direspons', 'direspon', 'cek awal', 'proses', 'pengerjaan', 'dalam pengerjaan', 'kendala', 'selesai', 'ditunda', 'batal'].indexOf(lowerFixedTypo) !== -1) {
      var quickStatus = normalizeInputStatus_(lowerFixedTypo);
      clearWhatsAppSession_(phone);
      return handlePetugasUpdateStatus_(phone, petugas, session.data.id, quickStatus, 'Update status melalui Menu Petugas WhatsApp.');
    }
  }

  // Kalau provider mengirim title jenis foto saja dari list jenis foto.
  if (session && session.state === 'PETUGAS_FOTO_TYPE' && session.data && session.data.id) {
    if (lower.indexOf('foto respons') !== -1 || lower.indexOf('foto respon') !== -1 || lower.indexOf('foto cek awal') !== -1) return handlePetugasChooseFotoType_(phone, petugas, 'Foto Respons');
    if (lower.indexOf('foto sebelum') !== -1) return handlePetugasChooseFotoType_(phone, petugas, 'Foto Sebelum');
    if (lower.indexOf('foto proses') !== -1) return handlePetugasChooseFotoType_(phone, petugas, 'Foto Proses');
    if (lower.indexOf('foto sesudah') !== -1 || lower.indexOf('foto selesai') !== -1) return handlePetugasChooseFotoType_(phone, petugas, 'Foto Selesai');
    if (lower.indexOf('foto lainnya') !== -1 || lower.indexOf('lainnya') !== -1) return handlePetugasChooseFotoType_(phone, petugas, 'Foto Lainnya');
  }

  // V10.9.50:
  // Admin Pusat memakai menu admin khusus, tapi tetap bisa memakai fitur petugas
  // seperti Update Status dan Upload Foto dari detail aduan.
  if (petugas && petugas.isAdmin) {
    return handleAdminWhatsAppMessage_(message, phone, payload, petugas, session);
  }

  if (lower === 'petugas menu' || lower === 'menu' || lower === 'menu utama' ||
      lower === 'halo' || lower === 'hallo' || lower === 'hi' || lower === 'start' || lower === '/start') {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'PETUGAS_MENU',
      reply: buildPetugasMainMenuReply_(petugas),
      petugasMenu: true,
      petugas: petugas
    };
  }

  if (lower === '1' || lower === 'petugas daftar' || lower.indexOf('daftar aduan') !== -1) {
    var daftar = listActiveAduanForPetugas_(petugas, 8);
    return {
      success: true,
      type: 'PETUGAS_DAFTAR',
      reply: buildPetugasDaftarAduanReply_(petugas, daftar),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  if (lower === '2' || lower === 'petugas cari' || lower === 'admin cari' || lower.indexOf('cari aduan') !== -1 || lower.indexOf('cari id') !== -1) {
    setWhatsAppSession_(phone, 'PETUGAS_CARI_ADUAN', {});
    return {
      success: true,
      type: 'PETUGAS_CARI_ADUAN',
      reply: [
        '🔎 *Cari Aduan*',
        '',
        'Kirim ID aduan yang ingin dibuka.',
        'Contoh: *PRY7K2A*',
        '',
        'Bisa juga langsung kirim FOTO dengan pesan foto:',
        '*PRY7K2A respon*',
        '*PRY7K2A selesai*',
        '',
        'Bisa juga pakai No HP/No Pelanggan:',
        '*081907941188 respon*',
        '*081907941188 selesai*'
      ].join('\n'),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  if (lower === 'petugas update' || lower.indexOf('update status') !== -1) {
    var listUpdate = listActiveAduanForPetugas_(petugas, 10);
    if (listUpdate.length === 0) {
      return {
        success: true,
        type: 'PETUGAS_UPDATE_EMPTY',
        reply: 'Tidak ada aduan aktif yang bisa diupdate untuk cabang ini.',
        petugasMenu: true,
        petugas: petugas
      };
    }

    setWhatsAppSession_(phone, 'PETUGAS_SELECT_ADUAN', { action: 'update' });

    return {
      success: true,
      type: 'PETUGAS_UPDATE_LIST',
      reply: 'Pilih aduan yang ingin diupdate statusnya.',
      petugasAduanListMenu: true,
      petugasAction: 'update',
      aduanList: listUpdate
    };
  }

  if (lower === '3' || lower === 'petugas foto' || lower.indexOf('upload foto') !== -1 || lower.indexOf('foto bukti') !== -1) {
    var listFoto = listActiveAduanForPetugas_(petugas, 10);
    if (listFoto.length === 0) {
      return {
        success: true,
        type: 'PETUGAS_FOTO_EMPTY',
        reply: 'Tidak ada aduan aktif untuk upload foto bukti.',
        petugasMenu: true,
        petugas: petugas
      };
    }

    setWhatsAppSession_(phone, 'PETUGAS_SELECT_ADUAN', { action: 'foto' });

    return {
      success: true,
      type: 'PETUGAS_FOTO_LIST',
      reply: 'Pilih aduan untuk upload foto bukti.',
      petugasAduanListMenu: true,
      petugasAction: 'foto',
      aduanList: listFoto
    };
  }

  if (lower.indexOf('petugas update ') === 0) {
    var updateId = normalizeAduanIdHyphen_(message.substring(message.toLowerCase().indexOf('petugas update ') + 'petugas update '.length));
    return handlePetugasSelectAduanForUpdate_(phone, petugas, updateId);
  }

  if (lower.indexOf('petugas foto ') === 0 && lower.indexOf('petugas foto jenis ') !== 0) {
    var fotoId = normalizeAduanIdHyphen_(message.substring(message.toLowerCase().indexOf('petugas foto ') + 'petugas foto '.length));
    return handlePetugasSelectAduanForFoto_(phone, petugas, fotoId);
  }

  if (lower.indexOf('petugas status ') === 0) {
    var statusCode = message.substring(message.toLowerCase().indexOf('petugas status ') + 'petugas status '.length);
    var statusMap = {
      'DIRESPONS': 'Direspons',
      'DIRESPON': 'Direspons',
      'RESPONS': 'Direspons',
      'RESPON': 'Direspons',
      'CEK_AWAL': 'Direspons',
      'PROSES': 'Dalam Pengerjaan',
      'PENGERJAAN': 'Dalam Pengerjaan',
      'DALAM_PENGERJAAN': 'Dalam Pengerjaan',
      'KENDALA': 'Kendala',
      'SELESAI': 'Selesai',
      'DITUNDA': 'Ditunda',
      'BATAL': 'Batal',
      'BARU': 'Baru'
    };
    var newStatus = statusMap[String(statusCode || '').toUpperCase()] || statusCode;
    var statusSession = getWhatsAppSession_(phone);
    var statusId = statusSession && statusSession.data ? statusSession.data.id : '';
    clearWhatsAppSession_(phone);
    return handlePetugasUpdateStatus_(phone, petugas, statusId, newStatus, 'Update status melalui Menu Petugas WhatsApp.');
  }

  if (lower.indexOf('petugas foto jenis ') === 0) {
    var typeCode = String(message.substring(message.toLowerCase().indexOf('petugas foto jenis ') + 'petugas foto jenis '.length) || '').toUpperCase();
    var typeMap = {
      'RESPONS': 'Foto Respons',
      'RESPON': 'Foto Respons',
      'CEK_AWAL': 'Foto Respons',
      'SEBELUM': 'Foto Sebelum',
      'PROSES': 'Foto Proses',
      'SESUDAH': 'Foto Selesai',
      'SELESAI': 'Foto Selesai',
      'LAINNYA': 'Foto Lainnya'
    };
    var jenisFoto = typeMap[typeCode] || typeCode || 'Foto Lainnya';
    return handlePetugasChooseFotoType_(phone, petugas, jenisFoto);
  }

  if (lower === '4') {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'PETUGAS_MENU',
      reply: buildPetugasMainMenuReply_(petugas),
      petugasMenu: true,
      petugas: petugas
    };
  }

  var semiAiPetugasResult = handlePetugasSemiAiCommand_(message, phone, payload, petugas);
  if (semiAiPetugasResult) return semiAiPetugasResult;

  var noIdCaptionPhotoResult = handlePetugasPhotoCaptionWithoutId_(message, phone, payload, petugas);
  if (noIdCaptionPhotoResult) return noIdCaptionPhotoResult;

  var noIdTextStatusResult = handlePetugasNoIdTextStatusCommand_(message, phone, payload, petugas);
  if (noIdTextStatusResult) return noIdTextStatusResult;

  // noIdCaptionPhotoResult sudah dicek di atas; sisakan variabel kosong agar patch lama tidak menggandakan handler.
  noIdCaptionPhotoResult = null;

  var directId = extractAduanId_(message);
  if (directId) {
    return buildPetugasOpenAduanResult_(phone, petugas, directId);
  }

  if (media && media.url) {
    return {
      success: true,
      type: 'PETUGAS_MEDIA_NO_SESSION',
      reply: [
        'Foto sudah diterima, tapi sistem belum tahu foto ini untuk aduan mana.',
        '',
        'Di pesan foto, tulis ID Aduan, contoh: *PRY7K2A selesai*.',
        'Untuk respon bisa tulis: *PRY7K2A respon* atau *081907941188 respon*.',
        'Untuk selesai bisa tulis: *PRY7K2A selesai* atau *081907941188 selesai*.',
        '',
        'Catatan: pencarian nama+cabang hanya memakai aduan aktif. Aduan *Selesai/Batal* tidak dimunculkan.'
      ].join('\n'),
      petugasMenu: true,
      petugas: petugas
    };
  }

  return {
    success: true,
    type: 'PETUGAS_MENU',
    reply: buildPetugasMainMenuReply_(petugas),
    petugasMenu: true,
    petugas: petugas
  };
}

function handlePetugasSelectAduanForUpdate_(phone, petugas, id) {
  var aduan = findAduanById_(id);
  if (!aduan) return { success: false, type: 'PETUGAS_UPDATE_NOT_FOUND', reply: 'ID aduan tidak ditemukan: *' + (id || '-') + '*', petugasMenu: true, petugas: petugas };
  if (!petugasCanAccessAduan_(petugas, aduan)) return { success: false, type: 'PETUGAS_UPDATE_FORBIDDEN', reply: 'Aduan ini bukan cabang Anda.', petugasMenu: true, petugas: petugas };

  try { setLastCheckedAduanIdForPhone_(phone, aduan.id); } catch(lastErr) {}
  setWhatsAppSession_(phone, 'PETUGAS_UPDATE_STATUS', { id: aduan.id });
  return {
    success: true,
    type: 'PETUGAS_STATUS_MENU',
    id: aduan.id,
    reply: [
      '🛠️ *Update Status Aduan*',
      '',
      'ID Aduan: *' + aduan.id + '*',
      'Status saat ini: *' + (aduan.status || '-') + '*',
      'Jenis: ' + (aduan.jenisGangguan || '-'),
      '',
      'Pilih status baru.'
    ].join('\n'),
    petugasStatusMenu: true
  };
}

function handlePetugasSelectAduanForFoto_(phone, petugas, id) {
  var aduan = findAduanById_(id);
  if (!aduan) return { success: false, type: 'PETUGAS_FOTO_NOT_FOUND', reply: 'ID aduan tidak ditemukan: *' + (id || '-') + '*', petugasMenu: true, petugas: petugas };
  if (!petugasCanAccessAduan_(petugas, aduan)) return { success: false, type: 'PETUGAS_FOTO_FORBIDDEN', reply: 'Aduan ini bukan cabang Anda.', petugasMenu: true, petugas: petugas };

  try { setLastCheckedAduanIdForPhone_(phone, aduan.id); } catch(lastErr) {}
  setWhatsAppSession_(phone, 'PETUGAS_FOTO_TYPE', { id: aduan.id });
  return {
    success: true,
    type: 'PETUGAS_FOTO_TYPE_MENU',
    id: aduan.id,
    reply: [
      '📷 *Upload Foto Bukti*',
      '',
      'ID Aduan: *' + aduan.id + '*',
      'Status: *' + (aduan.status || '-') + '*',
      'Jenis: ' + (aduan.jenisGangguan || '-'),
      '',
      'Pilih jenis foto.'
    ].join('\n'),
    petugasFotoTypeMenu: true
  };
}

function handlePetugasChooseFotoType_(phone, petugas, jenisFoto) {
  jenisFoto = normalizeDashboardJenisFoto_(jenisFoto || 'Foto Lainnya');
  var session = getWhatsAppSession_(phone);
  var id = session && session.data ? session.data.id : '';
  if (!id) {
    return { success: false, type: 'PETUGAS_FOTO_NO_ID', reply: 'Sesi upload foto tidak ditemukan. Silakan pilih Upload Foto Bukti lagi.', petugasMenu: true, petugas: petugas };
  }

  var aduan = findAduanById_(id);
  if (!aduan || !petugasCanAccessAduan_(petugas, aduan)) {
    clearWhatsAppSession_(phone);
    return { success: false, type: 'PETUGAS_FOTO_FORBIDDEN', reply: 'Aduan tidak ditemukan atau bukan cabang Anda.', petugasMenu: true, petugas: petugas };
  }

  setWhatsAppSession_(phone, 'PETUGAS_AWAIT_PHOTO', {
    id: id,
    jenisFoto: jenisFoto,
    autoStatus: isResponseDocumentationJenis_(jenisFoto) ? 'Dalam Pengerjaan' : '',
    autoFinish: isFinalDocumentationJenis_(jenisFoto)
  });
  return {
    success: true,
    type: 'PETUGAS_AWAIT_PHOTO',
    id: id,
    reply: [
      '📷 Silakan kirim foto sekarang.',
      '',
      'ID Aduan: *' + id + '*',
      'Jenis Foto: *' + jenisFoto + '*',
      '',
      isResponseDocumentationJenis_(jenisFoto) ? 'Setelah foto diterima, tekan *Ya* untuk mengubah status menjadi *Dalam Pengerjaan/Proses*.' : '',
      isFinalDocumentationJenis_(jenisFoto) ? 'Setelah foto diterima, tekan *Ya* untuk menutup aduan sebagai *Selesai*.' : '',
      'Kirim 1 foto saja dulu. Kalau ingin batal, ketik *batal*.'
    ].join('\n'),
    navButtons: [
      { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
    ]
  };
}


function buildPetugasConfirmPhotoStatusReply_(id, jenisFoto, targetStatus) {
  id = normalizeAduanIdHyphen_(id || '');
  jenisFoto = normalizeDashboardJenisFoto_(jenisFoto || 'Foto Lainnya');
  targetStatus = normalizeInputStatus_(targetStatus || '');

  var isFinish = targetStatus === 'Selesai';
  var statusText = isFinish ? 'Selesai' : (targetStatus === 'Dalam Pengerjaan' ? 'Dalam Pengerjaan/Proses' : (targetStatus || '-'));

  return [
    '✅ ' + jenisFoto + ' sudah tersimpan.',
    '',
    'ID Aduan: *' + (id || '-') + '*',
    'Status tujuan: *' + statusText + '*',
    '',
    isFinish
      ? 'Apakah aduan ini sudah benar-benar selesai dan boleh ditutup?'
      : 'Apakah status aduan ini akan diubah menjadi *' + statusText + '*?',
    '',
    'Tekan *Ya* untuk menyimpan status.',
    'Tekan *Tidak* untuk membatalkan dan menghapus foto dari dokumentasi.'
  ].join('\n');
}

function buildPetugasConfirmButtons_() {
  return [
    { id: 'PETUGAS_CONFIRM_STATUS_YA', title: 'Ya' },
    { id: 'PETUGAS_CONFIRM_STATUS_TIDAK', title: 'Tidak' },
    { id: 'PETUGAS_MENU', title: 'Menu' }
  ];
}

// ============================================================
// V10.9.160 - FALLBACK KONFIRMASI STATUS PETUGAS
// Beberapa provider mengirim balasan tombol Ya/Tidak tanpa membawa sesi WA
// dengan stabil. Simpan pending konfirmasi terpisah agar tombol tetap diproses.
// ============================================================
var PETUGAS_PENDING_CONFIRM_PREFIX_ = 'PETUGAS_PENDING_CONFIRM_';

function setPetugasPendingConfirmStatus_(phone, data) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  data = data || {};
  data.createdAt = new Date().getTime();
  var payload = JSON.stringify(data);
  var key = PETUGAS_PENDING_CONFIRM_PREFIX_ + phone;
  try { CacheService.getScriptCache().put(key, payload, safeCacheExpirationSeconds_(15 * 60)); } catch(e) {}
  try { PropertiesService.getScriptProperties().setProperty(key, payload); } catch(e2) {}
}

function getPetugasPendingConfirmStatus_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;
  var key = PETUGAS_PENDING_CONFIRM_PREFIX_ + phone;
  var raw = '';
  try { raw = CacheService.getScriptCache().get(key) || ''; } catch(e) {}
  if (!raw) {
    try { raw = PropertiesService.getScriptProperties().getProperty(key) || ''; } catch(e2) {}
  }
  if (!raw) return null;
  var data = parseJsonSafe_(raw) || null;
  if (!data) return null;
  var createdAt = Number(data.createdAt || 0);
  if (createdAt && (new Date().getTime() - createdAt > 15 * 60 * 1000)) {
    clearPetugasPendingConfirmStatus_(phone);
    return null;
  }
  return data;
}

function clearPetugasPendingConfirmStatus_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  var key = PETUGAS_PENDING_CONFIRM_PREFIX_ + phone;
  try { CacheService.getScriptCache().remove(key); } catch(e) {}
  try { PropertiesService.getScriptProperties().deleteProperty(key); } catch(e2) {}
}

// V10.9.161:
// Jika petugas menekan Tidak pada konfirmasi Foto Respons/Foto Selesai,
// foto yang baru diupload ikut dibatalkan: file Drive ditrash dan baris
// DOKUMENTASI_ADUAN dihapus. Jadi foto tidak tersimpan sebagai bukti aktif.
function cleanupPetugasPendingPhotoDocumentation_(pending) {
  pending = pending || {};
  var doc = pending.photoDoc || pending.saveResult || {};
  var id = normalizeAduanIdHyphen_(pending.id || doc.id || '');
  var jenisFoto = normalizeDashboardJenisFoto_(pending.jenisFoto || doc.jenisFoto || '');
  var link = String(doc.link || '').trim();
  var mediaUrl = String(doc.mediaUrl || '').trim();
  var removedRow = false;
  var trashedFile = false;

  if (doc.fileId) {
    try {
      DriveApp.getFileById(String(doc.fileId)).setTrashed(true);
      trashedFile = true;
    } catch(fileErr) {}
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = doc.sheetName || CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN';
    var sh = ss.getSheetByName(sheetName);
    if (sh && safeGetLastRow_(sh) >= 2) {
      var rowNumber = Number(doc.rowNumber || 0);
      if (rowNumber >= 2 && rowNumber <= safeGetLastRow_(sh)) {
        var row = sh.getRange(rowNumber, 1, 1, Math.min(sh.getLastColumn(), 11)).getValues()[0] || [];
        var rowId = normalizeAduanIdHyphen_(row[1] || '');
        var rowJenis = normalizeDashboardJenisFoto_(row[5] || '');
        var rowLink = String(row[6] || '').trim();
        var rowMedia = String(row[7] || '').trim();
        var match = (!id || rowId === id) && (!jenisFoto || rowJenis === jenisFoto) &&
          (!link || rowLink === link) && (!mediaUrl || rowMedia === mediaUrl);
        if (match) {
          sh.deleteRow(rowNumber);
          removedRow = true;
        }
      }

      if (!removedRow) {
        var lastRow = safeGetLastRow_(sh);
        var values = sh.getRange(2, 1, lastRow - 1, Math.min(sh.getLastColumn(), 11)).getValues();
        for (var i = values.length - 1; i >= 0; i--) {
          var r = values[i] || [];
          var rid = normalizeAduanIdHyphen_(r[1] || '');
          var rjenis = normalizeDashboardJenisFoto_(r[5] || '');
          var rlink = String(r[6] || '').trim();
          var rmedia = String(r[7] || '').trim();
          var same = (!id || rid === id) && (!jenisFoto || rjenis === jenisFoto) &&
            ((!link && !mediaUrl) || (link && rlink === link) || (mediaUrl && rmedia === mediaUrl));
          if (same) {
            sh.deleteRow(i + 2);
            removedRow = true;
            break;
          }
        }
      }
    }
  } catch(sheetErr) {}

  try { if (id) invalidateAduanDokumentasiCache_(id); } catch(cacheErr) {}
  return { success: true, removedRow: removedRow, trashedFile: trashedFile };
}

function handlePetugasPendingConfirmFallback_(message, phone, petugas) {
  var lower = String(message || '').toLowerCase().trim();
  if (!isPetugasConfirmYesText_(lower) && !isPetugasConfirmNoText_(lower)) return null;

  var pending = getPetugasPendingConfirmStatus_(phone);
  if (!pending || !pending.id || !pending.targetStatus) return null;

  if (isPetugasConfirmYesText_(lower)) {
    clearPetugasPendingConfirmStatus_(phone);
    clearWhatsAppSession_(phone);
    return handlePetugasUpdateStatus_(
      phone,
      petugas,
      pending.id,
      pending.targetStatus,
      pending.catatan || 'Konfirmasi status setelah upload foto.',
      { skipPhotoRequirement: true }
    );
  }

  cleanupPetugasPendingPhotoDocumentation_(pending);
  clearPetugasPendingConfirmStatus_(phone);
  clearWhatsAppSession_(phone);
  return {
    success: true,
    type: 'PETUGAS_CONFIRM_STATUS_CANCELLED',
    id: pending.id,
    reply: [
      'Baik, perubahan status dibatalkan.',
      '',
      'Foto yang baru dikirim tidak disimpan sebagai dokumentasi aktif.',
      'ID Aduan: *' + (pending.id || '-') + '*',
      '',
      'Status aduan tidak diubah.'
    ].join('\n'),
    petugasMenu: true,
    petugas: petugas
  };
}

function isPetugasConfirmYesText_(lower) {
  lower = String(lower || '').toLowerCase().trim();
  return lower === 'ya' || lower === 'iya' || lower === 'yes' || lower === 'ok' ||
         lower === 'petugas_confirm_status_ya' || lower === 'petugas confirm status ya' ||
         lower.indexOf('confirm_status_ya') !== -1;
}

function isPetugasConfirmNoText_(lower) {
  lower = String(lower || '').toLowerCase().trim();
  return lower === 'tidak' || lower === 'tdk' || lower === 'no' || lower === 'batal' ||
         lower === 'petugas_confirm_status_tidak' || lower === 'petugas confirm status tidak' ||
         lower.indexOf('confirm_status_tidak') !== -1;
}

function handlePetugasReceivePhoto_(phone, petugas, session, media, payload) {
  var id = session && session.data ? session.data.id : '';
  var jenisFoto = normalizeDashboardJenisFoto_(session && session.data ? session.data.jenisFoto : 'Foto Lainnya');
  var sessionCatatan = String((session && session.data && session.data.catatan) || '').trim();
  payload = payload || {};
  media = media || {};
  if (sessionCatatan && !String(media.caption || '').trim()) media.caption = sessionCatatan;
  if (sessionCatatan && !String(payload.caption || '').trim()) payload.caption = sessionCatatan;
  var aduan = findAduanById_(id);

  if (!aduan || !petugasCanAccessAduan_(petugas, aduan)) {
    clearWhatsAppSession_(phone);
    return { success: false, type: 'PETUGAS_FOTO_INVALID_ID', reply: 'Aduan tidak ditemukan atau bukan cabang Anda.', petugasMenu: true, petugas: petugas };
  }

  var saveResult = savePetugasPhotoDocumentation_(aduan, petugas, jenisFoto, media, payload);
  if (!saveResult || !saveResult.success) {
    return {
      success: false,
      type: 'PETUGAS_FOTO_SAVE_FAILED',
      reply: [
        'Foto belum berhasil disimpan.',
        '',
        'Penyebab: ' + ((saveResult && saveResult.error) || 'media URL tidak terbaca dari webhook.'),
        '',
        'Payload tetap tercatat di LOG_WHATSAPP untuk dicek.'
      ].join('\n'),
      petugasMenu: true,
      petugas: petugas
    };
  }

  if (isFinalDocumentationJenis_(jenisFoto)) {
    // V10.9.157:
    // Foto Selesai disimpan dulu, lalu petugas wajib konfirmasi Ya/Tidak
    // sebelum status diubah menjadi Selesai.
    var confirmDataSelesai = {
      id: id,
      jenisFoto: jenisFoto,
      targetStatus: 'Selesai',
      catatan: 'Foto Selesai diterima. Status dikonfirmasi menjadi Selesai. ' + ((session.data && session.data.catatan) || ''),
      photoDoc: saveResult
    };
    setWhatsAppSession_(phone, 'PETUGAS_CONFIRM_PHOTO_STATUS', confirmDataSelesai);
    setPetugasPendingConfirmStatus_(phone, confirmDataSelesai);
    return {
      success: true,
      type: 'PETUGAS_CONFIRM_FOTO_SELESAI_STATUS',
      id: id,
      reply: buildPetugasConfirmPhotoStatusReply_(id, jenisFoto, 'Selesai'),
      navButtons: buildPetugasConfirmButtons_()
    };
  }

  var desiredAutoStatus = (session.data && session.data.autoStatus) ? normalizeInputStatus_(session.data.autoStatus) : '';
  if (desiredAutoStatus || isResponseDocumentationJenis_(jenisFoto)) {
    if (!desiredAutoStatus) desiredAutoStatus = 'Direspons';
    // V10.9.157:
    // Foto Respons/Proses disimpan dulu, lalu petugas wajib konfirmasi Ya/Tidak
    // sebelum status otomatis diubah.
    var confirmDataStatus = {
      id: id,
      jenisFoto: jenisFoto,
      targetStatus: desiredAutoStatus,
      catatan: 'Foto ' + jenisFoto + ' diterima. Status dikonfirmasi menjadi ' + desiredAutoStatus + '. ' + ((session.data && session.data.catatan) || ''),
      photoDoc: saveResult
    };
    setWhatsAppSession_(phone, 'PETUGAS_CONFIRM_PHOTO_STATUS', confirmDataStatus);
    setPetugasPendingConfirmStatus_(phone, confirmDataStatus);
    return {
      success: true,
      type: 'PETUGAS_CONFIRM_FOTO_STATUS',
      id: id,
      reply: buildPetugasConfirmPhotoStatusReply_(id, jenisFoto, desiredAutoStatus),
      navButtons: buildPetugasConfirmButtons_()
    };
  }

  clearWhatsAppSession_(phone);
  return {
    success: true,
    type: 'PETUGAS_FOTO_SAVED',
    id: id,
    reply: [
      '✅ Foto berhasil disimpan.',
      '',
      'ID Aduan: *' + id + '*',
      'Jenis Foto: *' + jenisFoto + '*',
      '',
      'Status aduan tidak otomatis diubah.'
    ].join('\n'),
    petugasMenu: true,
    petugas: petugas
  };
}


function handlePetugasUpdateStatus_(phone, petugas, id, newStatus, catatan, options) {
  id = normalizeAduanIdHyphen_(id || '');
  newStatus = normalizeInputStatus_(newStatus || '');
  if (!id) return { success: false, type: 'PETUGAS_UPDATE_NO_ID', reply: 'ID aduan tidak ditemukan dari sesi. Silakan ulangi Update Status.', petugasMenu: true, petugas: petugas };
  if (!newStatus) return { success: false, type: 'PETUGAS_UPDATE_NO_STATUS', reply: 'Status tidak valid. Silakan ulangi Update Status.', petugasMenu: true, petugas: petugas };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var rowNumber = findAduanRowNumberById_(id);

  if (!main || !rowNumber) return { success: false, type: 'PETUGAS_UPDATE_NOT_FOUND', reply: 'ID aduan tidak ditemukan: *' + id + '*', petugasMenu: true, petugas: petugas };

  var oldData = getAduanObjectFromSheetRow_(main, rowNumber);
  if (!petugasCanAccessAduan_(petugas, oldData)) {
    return { success: false, type: 'PETUGAS_UPDATE_FORBIDDEN', reply: 'Aduan ini bukan cabang Anda.', petugasMenu: true, petugas: petugas };
  }

  var oldStatus = String(oldData.status || '').trim();
  options = options || {};

  if (newStatus === 'Direspons' && !options.skipPhotoRequirement) {
    try { setLastCheckedAduanIdForPhone_(phone, id); } catch(lastErr) {}
    setWhatsAppSession_(phone, 'PETUGAS_AWAIT_PHOTO', { id: id, jenisFoto: 'Foto Respons', autoStatus: 'Dalam Pengerjaan', catatan: catatan || '' });
    return {
      success: true,
      type: 'PETUGAS_RESPONS_NEED_PHOTO',
      id: id,
      reply: [
        'Silakan kirim *Foto Respons / Cek Awal* sebagai bukti petugas sudah menuju/cek lokasi.',
        '',
        'ID Aduan: *' + id + '*',
        '',
        'Setelah foto diterima, tekan *Ya* untuk mengubah status menjadi *Dalam Pengerjaan/Proses*.',
        'Kalau ingin batal, ketik *batal*.'
      ].join('\n'),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  if (newStatus === 'Selesai' && !options.skipPhotoRequirement) {
    try { setLastCheckedAduanIdForPhone_(phone, id); } catch(lastErr) {}
    setWhatsAppSession_(phone, 'PETUGAS_AWAIT_PHOTO', { id: id, jenisFoto: 'Foto Selesai', autoFinish: true });
    return {
      success: true,
      type: 'PETUGAS_SELESAI_NEED_PHOTO',
      id: id,
      reply: [
        'Silakan kirim foto selesai untuk menutup aduan ini.',
        '',
        'ID Aduan: *' + id + '*',
        '',
        'Setelah foto diterima, tekan *Ya* untuk menutup aduan sebagai *Selesai*.'
      ].join('\n'),
      navButtons: [
        { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
      ]
    };
  }

  var now = new Date();

  main.getRange(rowNumber, CONFIG.COL.STATUS).setValue(newStatus);
  main.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);

  if (newStatus === 'Selesai') {
    main.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(now);
  } else if (oldStatus === 'Selesai' && newStatus !== 'Selesai') {
    main.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).clearContent();
  }

  var oldCatatan = String(main.getRange(rowNumber, CONFIG.COL.CATATAN).getValue() || '').trim();
  var addCatatan = '[' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '] ' +
    'Update via WA Petugas: ' + (petugas.nama || '-') + ' (' + (petugas.noWa || '-') + ') → ' + newStatus +
    (catatan ? '. ' + catatan : '');

  main.getRange(rowNumber, CONFIG.COL.CATATAN).setValue(oldCatatan ? (oldCatatan + '\n' + addCatatan) : addCatatan);

  try { invalidateAduanFindCacheById_(id); } catch(e) {}
  try { syncAduanRowToCabangMirror_(main, rowNumber); } catch(syncErr) {}
  try { logStatusAduan_(id, oldStatus, newStatus, petugas, 'WA_PETUGAS', catatan || '', ''); } catch(logErr) {}

  if (oldStatus.toLowerCase() !== newStatus.toLowerCase()) {
    try { notifyCustomerStatusChangeByRow_(main, rowNumber, oldStatus, newStatus, 'WA_PETUGAS'); } catch(notifErr) {}
  }

  // V10.9.93:
  // Setelah status berhasil diupdate, simpan ID terakhir di sesi.
  // Ini penting karena beberapa provider WA hanya mengirim judul tombol "Upload Foto",
  // bukan ID tombol PETUGAS_FOTO_<ID>. Tanpa sesi ini, tombol Upload Foto bisa balik ke menu/list.
  try { setLastCheckedAduanIdForPhone_(phone, id); } catch(lastErr) {}
  try { setWhatsAppSession_(phone, 'PETUGAS_VIEW_ADUAN', { id: id }); } catch(sessErr) {}

  // V10.9.96: jika status selesai, tampilkan ringkasan SLA ke petugas.
  var slaPetugasText = '';
  try {
    if (newStatus === 'Selesai') {
      var latestAduanForSla = getAduanObjectFromSheetRow_(main, rowNumber);
      var petugasSla = buildAduanSlaDashboardInfo_(latestAduanForSla, new Date());
      slaPetugasText = [
        '',
        'SLA: *' + (petugasSla.statusLabel || '-') + '*',
        'Durasi: ' + (petugasSla.durasiText || '-'),
        petugasSla.selisihText || '',
        'Terima kasih telah berkontribusi dalam menjaga kelancaran layanan air kepada pelanggan.'
      ].join('\n');
    }
  } catch(slaReplyErr) {}

  return {
    success: true,
    type: 'PETUGAS_UPDATE_STATUS_OK',
    id: id,
    reply: [
      '✅ Status aduan berhasil diupdate.',
      '',
      'ID Aduan: *' + id + '*',
      'Status lama: *' + (oldStatus || '-') + '*',
      'Status baru: *' + newStatus + '*',
      '',
      'Diupdate oleh: ' + (petugas.nama || '-'),
      slaPetugasText
    ].join('\n'),
    navButtons: [
      { id: 'PETUGAS_FOTO_' + id, title: 'Upload Foto' },
      { id: 'PETUGAS_UPDATE', title: 'Update Lagi' },
      { id: 'PETUGAS_MENU', title: 'Menu Petugas' }
    ]
  };
}

function buildPetugasDaftarAduanReply_(petugas, list) {
  petugas = petugas || {};
  list = list || [];

  if (list.length === 0) {
    return [
      '📋 *Daftar Aduan Cabang*',
      '',
      'Tidak ada aduan aktif untuk ' + (petugas.isAdmin ? 'semua cabang' : (petugas.cabang || 'cabang ini')) + '.'
    ].join('\n');
  }

  var lines = [
    '📋 *Daftar Aduan Cabang*',
    '',
    'Cabang: *' + (petugas.isAdmin ? 'Semua Cabang' : (petugas.cabang || '-')) + '*',
    'Ditampilkan maksimal ' + list.length + ' aduan aktif.',
    ''
  ];

  list.forEach(function(d, idx) {
    lines.push((idx + 1) + '. *' + d.id + '*');
    lines.push('Status/Prioritas: ' + (d.status || '-') + ' / ' + (d.prioritas || '-'));
    lines.push('Pelanggan: ' + (d.namaPelanggan || '-') + (d.noPelanggan ? ' • NoPel: ' + d.noPelanggan : ''));
    if (d.noHp) lines.push('No HP: ' + d.noHp);
    lines.push('Jenis: ' + (d.jenisGangguan || '-'));
    if (d.keterangan) lines.push('Ket: ' + String(d.keterangan).substring(0, 140));
    if (d.lokasiDetail) lines.push('Lokasi: ' + String(d.lokasiDetail).substring(0, 120));
    if (d.linkMaps) lines.push('Maps: ' + d.linkMaps);
    lines.push('');
  });

  lines.push('Balas *ID Aduan* untuk buka detail.');
  lines.push('Untuk ubah status, kirim FOTO dokumentasi. Di pesan foto tulis: *' + (list[0] && list[0].id ? list[0].id : 'PRBKT3Q') + ' respon* atau *' + (list[0] && list[0].id ? list[0].id : 'PRBKT3Q') + ' selesai*.');
  return lines.join('\n');
}

function sendKiriminPetugasMenu_(phone, petugas) {
  if (petugas && petugas.isAdmin) {
    return sendKiriminAdminMenu_(phone, petugas);
  }

  var rows = [
    { id: 'PETUGAS_DAFTAR', title: 'Daftar Aduan', description: 'Aduan aktif cabang' },
    { id: 'PETUGAS_CARI', title: 'Cari Aduan', description: 'Cari ID aduan' }
  ];

  return sendKiriminGenericListMenu_(
    phone,
    buildPetugasMainMenuReply_(petugas),
    'Pilih Menu',
    'Menu Petugas',
    rows
  );
}

function sendKiriminPetugasAduanListMenu_(phone, action, list) {
  action = String(action || 'update').toLowerCase();
  list = list || [];

  if (list.length === 0) {
    return sendKiriminTextByPhoneNumber_(phone, 'Tidak ada aduan aktif.');
  }

  var rows = list.slice(0, 10).map(function(d) {
    var prefix = action === 'foto' ? 'PETUGAS_FOTO_' : 'PETUGAS_UPDATE_';
    return {
      id: prefix + d.id,
      title: String(d.id || '-').substring(0, 24),
      description: String((d.status || '-') + ' • ' + (d.jenisGangguan || '-') + ' • ' + (d.namaPelanggan || d.noPelanggan || '-')).substring(0, 72)
    };
  });

  var body = action === 'foto'
    ? '📷 Pilih aduan untuk upload foto bukti.'
    : '🛠️ Pilih aduan yang ingin diupdate statusnya.';

  return sendKiriminGenericListMenu_(
    phone,
    body,
    'Pilih Aduan',
    'Aduan Aktif',
    rows
  );
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

function sendKiriminPetugasFotoTypeMenu_(phone) {
  var rows = [
    { id: 'PETUGAS_FOTO_TYPE_RESPONS', title: 'Foto Respons', description: 'Bukti cek awal/lokasi' },
    { id: 'PETUGAS_FOTO_TYPE_SEBELUM', title: 'Foto Sebelum', description: 'Kondisi awal' },
    { id: 'PETUGAS_FOTO_TYPE_PROSES', title: 'Foto Proses', description: 'Saat ditangani' },
    { id: 'PETUGAS_FOTO_TYPE_SELESAI', title: 'Foto Selesai', description: 'Dokumentasi akhir penanganan' },
    { id: 'PETUGAS_FOTO_TYPE_LAINNYA', title: 'Foto Lainnya', description: 'Dokumentasi tambahan' }
  ];

  return sendKiriminGenericListMenu_(
    phone,
    'Pilih jenis foto bukti.',
    'Pilih Jenis',
    'Jenis Foto',
    rows
  );
}

function sendKiriminGenericListMenu_(phone, bodyText, buttonText, sectionTitle, rows) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var phoneNumber = normalizePhone_(phone || '');
  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong.' };

  rows = (rows || []).slice(0, 10).map(function(r) {
    return {
      id: String(r.id || r.title || '').substring(0, 200),
      title: String(r.title || 'Menu').substring(0, 24),
      description: String(r.description || '').substring(0, 72)
    };
  });

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: String(bodyText || '') },
      action: {
        button: String(buttonText || 'Pilih').substring(0, 20),
        sections: [
          {
            title: String(sectionTitle || 'Menu').substring(0, 24),
            rows: rows
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function extractMediaFromPayload_(obj) {
  obj = obj || {};
  var data = obj.data || {};
  var candidates = [
    obj,
    data,
    obj.message || {},
    data.message || {},
    obj.payload || {},
    data.payload || {},
    obj.media || {},
    data.media || {},
    obj.attachment || {},
    data.attachment || {},
    obj.image || {},
    data.image || {}
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

  var url = first([
    'media_url',
    'image_url',
    'file_url',
    'attachment_url',
    'url',
    'link',
    'download_url',
    'media.url',
    'media.link',
    'image.url',
    'image.link',
    'file.url',
    'attachment.url',
    'attachments.0.url',
    'attachments.0.link',
    'data.media_url',
    'data.image_url',
    'data.file_url'
  ]);

  var mime = first(['mime_type', 'mimetype', 'mime', 'media.mime_type', 'file.mime_type', 'attachment.mime_type', 'attachments.0.mime_type']);
  var fileName = first(['filename', 'file_name', 'name', 'media.filename', 'file.name', 'attachment.filename', 'attachments.0.filename']);
  var caption = first(['caption', 'text', 'body', 'message.caption', 'image.caption', 'media.caption']);

  if (!url) return null;

  return {
    url: String(url || '').trim(),
    mimeType: String(mime || '').trim(),
    fileName: String(fileName || '').trim(),
    caption: String(caption || '').trim()
  };
}

function getOrCreateSiagaDocsFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('SIAGA_DOKUMENTASI_FOLDER_ID') || '';

  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch(e) {}
  }

  var name = 'SIAGA_TIARA_DOKUMENTASI_ADUAN';
  var it = DriveApp.getFoldersByName(name);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  try { props.setProperty('SIAGA_DOKUMENTASI_FOLDER_ID', folder.getId()); } catch(e2) {}
  return folder;
}

function savePetugasPhotoDocumentation_(aduan, petugas, jenisFoto, media, payload) {
  aduan = aduan || {};
  petugas = petugas || {};
  media = media || {};
  jenisFoto = normalizeDashboardJenisFoto_(jenisFoto || 'Foto Lainnya');

  if (!aduan.id) return { success: false, error: 'ID aduan kosong.' };
  if (!media.url) return { success: false, error: 'Media URL tidak terbaca.' };

  var link = '';
  var fileId = '';
  var status = 'URL_ONLY';
  var detail = '';

  try {
    var res = UrlFetchApp.fetch(media.url, { muteHttpExceptions: true });
    var code = res.getResponseCode();

    if (code >= 200 && code < 300) {
      var blob = res.getBlob();
      var ext = 'jpg';
      var mime = media.mimeType || blob.getContentType() || '';
      if (mime.indexOf('png') !== -1) ext = 'png';
      if (mime.indexOf('webp') !== -1) ext = 'webp';
      if (mime.indexOf('jpeg') !== -1 || mime.indexOf('jpg') !== -1) ext = 'jpg';

      var safeId = String(aduan.id || 'ADUAN').replace(/[^A-Z0-9-]/gi, '_');
      var safeJenis = String(jenisFoto || 'Foto').replace(/[^A-Z0-9]+/gi, '_');
      var fileName = safeId + '_' + safeJenis + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.' + ext;

      blob.setName(fileName);
      var folder = getOrCreateSiagaDocsFolder_();
      var file = folder.createFile(blob);
      fileId = file.getId();

      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(shareErr) {}
      link = file.getUrl();
      status = 'DRIVE_OK';
      detail = 'HTTP ' + code + ' | ' + fileName;
    } else {
      link = media.url;
      status = 'URL_ONLY_FETCH_FAILED';
      detail = 'HTTP ' + code + ' | ' + res.getContentText().substring(0, 300);
    }
  } catch(err) {
    link = media.url;
    status = 'URL_ONLY_ERROR';
    detail = err.message || String(err);
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // V10.9.161:
    // Foto Respons/Selesai disimpan sementara dulu karena petugas harus tekan Ya/Tidak.
    // Jangan hapus foto final lama di tahap ini. Jika petugas menekan Tidak,
    // foto baru akan dihapus dari Drive dan DOKUMENTASI_ADUAN.
    var sh = setupDokumentasiAduanSheet_(ss);
    var rowNumber = sh.getLastRow() + 1;
    sh.getRange(rowNumber, 1, 1, 11).setValues([[
      new Date(),
      aduan.id || '',
      aduan.cabang || '',
      petugas.nama || '',
      normalizePhone_(petugas.noWa || ''),
      jenisFoto || 'Foto Lainnya',
      link || '',
      media.url || '',
      media.caption || '',
      status,
      truncateForLog_(detail || JSON.stringify(payload || {}), 1200)
    ]]);
  } catch(sheetErr) {
    return { success: false, error: 'Foto tersimpan tapi gagal menulis sheet: ' + sheetErr.message, link: link, status: status };
  }

  try { invalidateAduanDokumentasiCache_(aduan.id); } catch(cacheErr) {}

  return {
    success: true,
    link: link,
    fileId: fileId,
    rowNumber: rowNumber || 0,
    sheetName: CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN',
    id: aduan.id || '',
    jenisFoto: jenisFoto || 'Foto Lainnya',
    mediaUrl: media.url || '',
    status: status,
    detail: detail
  };
}


function getDokumentasiHeaders_() {
  return [
    'Waktu Upload',
    'ID Aduan',
    'Cabang',
    'Nama Petugas',
    'No WA Petugas',
    'Jenis Foto',
    'Link Drive',
    'Media URL Asli',
    'Caption',
    'Status Simpan',
    'Detail'
  ];
}

function getDokumentasiArchiveSheetName_(archiveName, dateValue) {
  var ym = '';

  if (archiveName) {
    var m = String(archiveName).match(/(\d{4})[_-](\d{2})/);
    if (m) ym = m[1] + '_' + m[2];
  }

  if (!ym && dateValue) {
    var d = asDateForArchive_(dateValue);
    if (d) ym = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy_MM');
  }

  if (!ym) ym = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy_MM');
  return 'ARSIP_DOKUMENTASI_' + ym;
}

function getOrCreateDokumentasiArchiveSheet_(ss, sheetName) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var headers = getDokumentasiHeaders_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#334155')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, headers.length); } catch(e) {}
  return sh;
}

function getAduanDokumentasiCacheKey_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  return idAduan ? ('DOKUMENTASI_ADUAN_' + normalizeId_(idAduan)) : '';
}

function invalidateAduanDokumentasiCache_(idAduan) {
  var key = getAduanDokumentasiCacheKey_(idAduan);
  if (key) cacheRemove_(key);
}


function isFinalDocumentationJenis_(jenisFoto) {
  var v = String(jenisFoto || '').toLowerCase();
  return v.indexOf('selesai') !== -1 || v.indexOf('sesudah') !== -1 || v.indexOf('setelah') !== -1;
}


function isResponseDocumentationJenis_(jenisFoto) {
  var v = String(jenisFoto || '').toLowerCase();
  return v.indexOf('respons') !== -1 || v.indexOf('respon') !== -1 || v.indexOf('cek awal') !== -1 || v.indexOf('cek lokasi') !== -1;
}

function hasFinalDocumentationForAduan_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) return false;
  var docs = getAduanDocumentationRows_(idAduan, 999) || [];
  return docs.some(function(d) { return isFinalDocumentationJenis_(d && d.jenisFoto); });
}

function hasResponseDocumentationForAduan_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) return false;
  var docs = getAduanDocumentationRows_(idAduan, 999) || [];
  return docs.some(function(d) { return isResponseDocumentationJenis_(d && d.jenisFoto); });
}

function cleanupOldFinalDocumentationRows_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) return { success: true, removed: 0 };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
  if (!sh || safeGetLastRow_(sh) < 2) return { success: true, removed: 0 };

  var lastRow = safeGetLastRow_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, Math.min(sh.getLastColumn(), 11)).getValues();
  var removed = 0;

  // Hapus dari bawah agar nomor row tidak bergeser.
  for (var i = values.length - 1; i >= 0; i--) {
    var rowId = normalizeAduanIdHyphen_(values[i][1] || '');
    var jenis = String(values[i][5] || '');
    if (rowId === idAduan && isFinalDocumentationJenis_(jenis)) {
      try {
        sh.deleteRow(i + 2);
        removed++;
      } catch(e) {}
    }
  }

  try { invalidateAduanDokumentasiCache_(idAduan); } catch(cacheErr) {}
  return { success: true, removed: removed };
}


function archiveDokumentasiByAduanIds_(ids, archiveName) {
  ids = (ids || []).map(function(id) { return normalizeAduanIdHyphen_(id || ''); }).filter(Boolean);
  if (!ids.length) return { moved: 0, sheets: [] };

  var idMap = {};
  ids.forEach(function(id) { idMap[id] = true; });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
  if (!src || safeGetLastRow_(src) < 2) return { moved: 0, sheets: [] };

  var width = getDokumentasiHeaders_().length;
  var values = src.getRange(2, 1, safeGetLastRow_(src) - 1, width).getValues();
  var byArchiveSheet = {};
  var rowsToDelete = [];

  values.forEach(function(row, idx) {
    var id = normalizeAduanIdHyphen_(row[1] || '');
    if (!id || !idMap[id]) return;

    var archiveSheetName = getDokumentasiArchiveSheetName_(archiveName, row[0]);
    if (!byArchiveSheet[archiveSheetName]) byArchiveSheet[archiveSheetName] = [];
    byArchiveSheet[archiveSheetName].push(row);
    rowsToDelete.push(idx + 2);
  });

  var moved = 0;
  var sheets = [];

  Object.keys(byArchiveSheet).forEach(function(sheetName) {
    var target = getOrCreateDokumentasiArchiveSheet_(ss, sheetName);
    var rows = byArchiveSheet[sheetName];
    if (!rows.length) return;

    target.getRange(target.getLastRow() + 1, 1, rows.length, width).setValues(rows);
    moved += rows.length;
    sheets.push(sheetName);
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    try { src.deleteRow(rowNumber); } catch(e) {}
  });

  ids.forEach(function(id) {
    try { invalidateAduanDokumentasiCache_(id); } catch(e) {}
  });

  return { moved: moved, sheets: sheets };
}

function archiveDokumentasiLastMonth() {
  var ui = SpreadsheetApp.getUi();
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var archiveName = 'ARSIP_DOKUMENTASI_' + Utilities.formatDate(startLastMonth, Session.getScriptTimeZone(), 'yyyy_MM');

  var confirm = ui.alert(
    'Arsip Dokumentasi Bulan Lalu',
    'Dokumentasi foto bulan lalu akan dipindahkan dari DOKUMENTASI_ADUAN ke ' + archiveName + '.\n\n' +
    'File foto di Google Drive TIDAK dihapus.\n' +
    'Yang dipindah hanya baris data/link dokumentasinya, supaya DOKUMENTASI_ADUAN tetap ringan.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;
  var result = archiveDokumentasiByDateRange_(startLastMonth, startCurrentMonth, archiveName, false);

  ui.alert(
    '✅ Arsip Dokumentasi Selesai',
    'Dokumentasi yang dipindahkan: ' + result.moved + ' baris.\n' +
    'Tujuan: ' + archiveName + '\n\n' +
    'File Drive tetap aman.',
    ui.ButtonSet.OK
  );
}

function archiveDokumentasiNonActive() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!aduanSheet || safeGetLastRow_(aduanSheet) < 2) {
    ui.alert('Sheet ADUAN belum memiliki data aktif.');
    return;
  }

  var confirm = ui.alert(
    'Arsip Dokumentasi Semua yang Tidak Aktif',
    'Sistem akan mengecek DOKUMENTASI_ADUAN dan memindahkan dokumentasi yang ID aduannya sudah tidak ada di ADUAN aktif.\n\n' +
    'Ini cocok setelah arsip bulanan, supaya tombol Lihat Foto pelanggan tidak scan data lama.\n\n' +
    'File foto di Drive TIDAK dihapus.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var activeIds = {};
  var values = aduanSheet.getRange(2, CONFIG.COL.ID, safeGetLastRow_(aduanSheet) - 1, 1).getValues();
  values.forEach(function(r) {
    var id = normalizeAduanIdHyphen_(r[0] || '');
    if (id) activeIds[id] = true;
  });

  var result = archiveDokumentasiNotInActiveIds_(activeIds);

  ui.alert(
    '✅ Arsip Dokumentasi Selesai',
    'Dokumentasi yang dipindahkan: ' + result.moved + ' baris.\n\n' +
    'Dokumentasi untuk aduan yang masih aktif tetap berada di DOKUMENTASI_ADUAN.',
    ui.ButtonSet.OK
  );
}

function archiveDokumentasiByDateRange_(startDate, endDate, archiveSheetName, onlyIfIdNotActive) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
  if (!src || safeGetLastRow_(src) < 2) return { moved: 0 };

  var activeIds = {};
  if (onlyIfIdNotActive) {
    var main = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (main && safeGetLastRow_(main) >= 2) {
      main.getRange(2, CONFIG.COL.ID, safeGetLastRow_(main) - 1, 1).getValues().forEach(function(r) {
        var id = normalizeAduanIdHyphen_(r[0] || '');
        if (id) activeIds[id] = true;
      });
    }
  }

  var width = getDokumentasiHeaders_().length;
  var values = src.getRange(2, 1, safeGetLastRow_(src) - 1, width).getValues();
  var rowsToMove = [];
  var rowsToDelete = [];

  values.forEach(function(row, idx) {
    var t = asDateForArchive_(row[0]);
    if (!t) return;
    if (startDate && t < startDate) return;
    if (endDate && t >= endDate) return;

    if (onlyIfIdNotActive) {
      var id = normalizeAduanIdHyphen_(row[1] || '');
      if (id && activeIds[id]) return;
    }

    rowsToMove.push(row);
    rowsToDelete.push(idx + 2);
  });

  if (!rowsToMove.length) return { moved: 0 };

  var target = getOrCreateDokumentasiArchiveSheet_(ss, archiveSheetName || getDokumentasiArchiveSheetName_('', startDate));
  target.getRange(target.getLastRow() + 1, 1, rowsToMove.length, width).setValues(rowsToMove);

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    try { src.deleteRow(rowNumber); } catch(e) {}
  });

  rowsToMove.forEach(function(row) {
    try { invalidateAduanDokumentasiCache_(row[1]); } catch(e) {}
  });

  return { moved: rowsToMove.length };
}

function archiveDokumentasiNotInActiveIds_(activeIds) {
  activeIds = activeIds || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
  if (!src || safeGetLastRow_(src) < 2) return { moved: 0 };

  var width = getDokumentasiHeaders_().length;
  var values = src.getRange(2, 1, safeGetLastRow_(src) - 1, width).getValues();
  var byArchiveSheet = {};
  var rowsToDelete = [];

  values.forEach(function(row, idx) {
    var id = normalizeAduanIdHyphen_(row[1] || '');
    if (id && activeIds[id]) return;

    var archiveSheetName = getDokumentasiArchiveSheetName_('', row[0]);
    if (!byArchiveSheet[archiveSheetName]) byArchiveSheet[archiveSheetName] = [];
    byArchiveSheet[archiveSheetName].push(row);
    rowsToDelete.push(idx + 2);
  });

  var moved = 0;
  Object.keys(byArchiveSheet).forEach(function(sheetName) {
    var target = getOrCreateDokumentasiArchiveSheet_(ss, sheetName);
    var rows = byArchiveSheet[sheetName];
    if (!rows.length) return;
    target.getRange(target.getLastRow() + 1, 1, rows.length, width).setValues(rows);
    moved += rows.length;
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    try { src.deleteRow(rowNumber); } catch(e) {}
  });

  return { moved: moved };
}


function getAduanDocumentationRows_(idAduan, limit) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  limit = Number(limit || 10);
  if (!idAduan) return [];

  var cacheKey = getAduanDokumentasiCacheKey_(idAduan);
  var cached = cacheKey ? cacheGet_(cacheKey) : '';
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed.slice(0, limit);
    } catch(e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  // DOKUMENTASI_ADUAN sekarang sengaja hanya menyimpan dokumentasi aktif/belum diarsip.
  // Arsip lama pindah ke ARSIP_DOKUMENTASI_YYYY_MM agar tombol Lihat Foto tidak lambat.
  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.min(sh.getLastColumn(), 11)).getValues();
  var rows = [];

  values.forEach(function(r, idx) {
    if (normalizeAduanIdHyphen_(r[1] || '') !== idAduan) return;
    rows.push({
      rowNumber: idx + 2,
      waktu: r[0],
      id: String(r[1] || ''),
      cabang: String(r[2] || ''),
      petugas: String(r[3] || ''),
      noWa: String(r[4] || ''),
      jenisFoto: String(r[5] || ''),
      link: String(r[6] || ''),
      mediaUrl: String(r[7] || ''),
      caption: String(r[8] || ''),
      status: String(r[9] || '')
    });
  });

  rows.sort(function(a, b) {
    var ad = toSafeDate_(a.waktu) || new Date(0);
    var bd = toSafeDate_(b.waktu) || new Date(0);
    return bd.getTime() - ad.getTime();
  });

  try { if (cacheKey) cachePut_(cacheKey, JSON.stringify(rows), 120); } catch(cacheErr) {}

  return rows.slice(0, limit);
}

function getAduanDocumentationCount_(idAduan) {
  return getAduanDocumentationRows_(idAduan, 999).length;
}

function buildStatusNavButtonsForAduan_(aduan) {
  aduan = aduan || {};
  if (getAduanDocumentationCount_(aduan.id) > 0) {
    return [
      { id: 'PHOTO_LAST', title: 'Lihat Foto' },
      { id: 'NAV_BACK_STATUS', title: 'Kembali' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  return [
    { id: 'NAV_BACK_STATUS', title: 'Kembali' },
    { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function getLastCheckedPhotoCacheKey_(phone) {
  return 'LAST_CHECKED_ADUAN_' + normalizePhone_(phone || '');
}

function setLastCheckedAduanIdForPhone_(phone, aduanId) {
  phone = normalizePhone_(phone || '');
  aduanId = normalizeAduanIdHyphen_(aduanId || '');
  if (!phone || !aduanId) return;

  try { cachePut_(getLastCheckedPhotoCacheKey_(phone), aduanId, 21600); } catch(e) {}
  try { PropertiesService.getScriptProperties().setProperty(getLastCheckedPhotoCacheKey_(phone), aduanId); } catch(e2) {}
}

function getLastCheckedAduanIdForPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return '';

  var key = getLastCheckedPhotoCacheKey_(phone);
  var cached = cacheGet_(key);
  if (cached) return normalizeAduanIdHyphen_(cached);

  try { return normalizeAduanIdHyphen_(PropertiesService.getScriptProperties().getProperty(key) || ''); } catch(e) {}
  return '';
}

function handleCustomerLihatFoto_(phone, message) {
  var id = extractAduanId_(message) || getLastCheckedAduanIdForPhone_(phone);
  id = normalizeAduanIdHyphen_(id || '');

  if (!id) {
    return {
      success: false,
      type: 'FOTO_NO_ID',
      reply: 'Silakan cek status aduan dulu, lalu tekan tombol *Lihat Foto*.',
      navButtons: [
        { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var docs = getAduanDocumentationRows_(id, 5);
  if (docs.length === 0) {
    return {
      success: true,
      type: 'FOTO_EMPTY',
      id: id,
      reply: [
        '📷 *Dokumentasi Foto*',
        '',
        'ID Aduan: *' + id + '*',
        '',
        'Dokumentasi foto belum tersedia.'
      ].join('\n'),
      navButtons: [
        { id: 'NAV_BACK_STATUS', title: 'Kembali' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var lines = [
    '📷 *Dokumentasi Foto Aduan*',
    '',
    'ID Aduan: *' + id + '*',
    '',
    'Berikut dokumentasi yang tersedia:'
  ];

  docs.forEach(function(d, idx) {
    lines.push('');
    lines.push((idx + 1) + '. *' + (d.jenisFoto || 'Foto') + '*');
    if (d.petugas) lines.push('Petugas: ' + d.petugas);
    if (d.link) lines.push('Link: ' + d.link);
  });

  lines.push('');
  lines.push('Jika link tidak langsung terbuka, salin link lalu buka di browser.');

  return {
    success: true,
    type: 'FOTO_LIST',
    id: id,
    reply: lines.join('\n'),
    navButtons: [
      { id: 'NAV_BACK_STATUS', title: 'Kembali' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}



function normalizeInputStatus_(value) {
  value = String(value || '').trim();
  if (!value) return '';
  var lower = value.toLowerCase();

  if (lower.indexOf('proses') !== -1) return 'Proses';
  if (lower.indexOf('selesai') !== -1) return 'Selesai';
  if (lower.indexOf('tunda') !== -1) return 'Ditunda';
  if (lower.indexOf('batal') !== -1 || lower.indexOf('cancel') !== -1) return 'Batal';
  if (lower.indexOf('baru') !== -1) return 'Baru';

  var allowed = CONFIG.STATUS || ['Baru', 'Proses', 'Selesai', 'Ditunda', 'Batal'];
  for (var i = 0; i < allowed.length; i++) {
    if (String(allowed[i]).toLowerCase() === lower) return allowed[i];
  }

  return '';
}



// ============================================================
