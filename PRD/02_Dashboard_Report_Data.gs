// ============================================================
// SIAGA TIARA V10.9.244 - KODE DIPECAH / MODUL: 02_Dashboard_Report_Data.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

// ============================================================
function buildDashboardAdminMetrics_(data, now) {
  data = data || [];
  now = now || new Date();

  var totalAduan = data.length;
  var statusBaru = 0;
  var sudahDikerjakan = 0;
  var selesaiDinilai = 0;
  var selesaiTepatWaktu = 0;
  var selesaiTerlambat = 0;

  data.forEach(function(d) {
    var status = String((d && d.status) || '').trim();

    if (status === 'Baru' || !status) {
      statusBaru++;
    } else {
      // Definisi pengerjaan: sudah ada tindak lanjut, yaitu status bukan Baru/kosong.
      sudahDikerjakan++;
    }

    if (status === 'Selesai') {
      var sla = buildAduanSlaDashboardInfo_(d, now);
      if (!sla || !sla.valid) return;

      if (sla.statusCode === 'DONE_LATE' || sla.statusClass === 'late') {
        selesaiDinilai++;
        selesaiTerlambat++;
      } else if (sla.statusCode === 'DONE_ONTIME' || sla.statusClass === 'ok') {
        selesaiDinilai++;
        selesaiTepatWaktu++;
      }
    }
  });

  return {
    totalAduan: totalAduan,
    statusBaru: statusBaru,
    sudahDikerjakan: sudahDikerjakan,
    persenPengerjaan: totalAduan ? Math.round((sudahDikerjakan / totalAduan) * 100) : null,

    selesaiDinilai: selesaiDinilai,
    selesaiTepatWaktu: selesaiTepatWaktu,
    selesaiTerlambat: selesaiTerlambat,
    persenWaktuSelesai: selesaiDinilai ? Math.round((selesaiTepatWaktu / selesaiDinilai) * 100) : null
  };
}
// V10.9.164: Duplikasi clientGetDashboardData #1 dihapus. Gunakan definisi utama di bawah.




/**
 * Mengambil data khusus untuk Export PDF.
 * Dashboard reguler tidak mengirim laporan detail agar loading tetap ringan.
 *
 * reportOptions:
 * - period: today | this_month | last_month | custom | all
 * - startDate: yyyy-mm-dd
 * - endDate: yyyy-mm-dd
 * - cabang: Semua / nama cabang
 * - wilayah: Semua / nama wilayah
 */
function clientGetPdfReportData(reportOptions) {
  try {
    reportOptions = reportOptions || {};
    var sessionUser = validateDashboardSession_(reportOptions._sessionToken || reportOptions.sessionToken || '');
    if (!sessionUser) {
      return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    }
    reportOptions = applyDashboardAccessFilters_(reportOptions, sessionUser);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      var emptyMeta = buildReportMeta_(reportOptions, getReportDateRange_(reportOptions, new Date()), new Date());
      var reportIdEmpty = generateReportId_();
      var verificationUrlEmpty = buildVerificationUrl_(reportOptions.dashboardUrl || '', reportIdEmpty);
      emptyMeta.reportId = reportIdEmpty;
      emptyMeta.verificationUrl = verificationUrlEmpty;
      emptyMeta.pdfFileName = 'Laporan_Gangguan_' + (emptyMeta.fileAt || 'NA') + '.pdf';
      logExportReport_(emptyMeta, getEmptyReportStats_(), []);

      return {
        success: true,
        detailRows: [],
        cabangSummary: [],
        stats: getEmptyReportStats_(),
        meta: emptyMeta,
        qrImageDataUrl: getQrImageDataUrl_(verificationUrlEmpty)
      };
    }

    var now = new Date();
    var range = getReportDateRange_(reportOptions, now);
    var rawData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    var allData = parseData(rawData);

    var filtered = allData.filter(function(d) {
      if (!d.waktuMasuk) return false;

      if (range.start && d.waktuMasuk < range.start) return false;
      if (range.end && d.waktuMasuk >= range.end) return false;

      if (reportOptions.cabang && reportOptions.cabang !== 'Semua' && d.cabang !== reportOptions.cabang) return false;
      if (reportOptions.wilayah && reportOptions.wilayah !== 'Semua' && d.wilayah !== reportOptions.wilayah) return false;

      return true;
    });

    var stats = buildReportStats_(filtered, now);
    var cabangSummary = buildCabangReportSummary_(filtered, now);
    var petugasMap = buildAduanPetugasMap_(filtered.map(function(d) { return d.id; }));
    // V10.9.244: Export kolom SLA harus mengikuti indikator Respons dashboard,
    // bukan status akhir aduan. Pakai response map agar hasil sama dengan dashboard.
    var responseMap = (typeof buildAduanResponseTimeMap_ === 'function') ? buildAduanResponseTimeMap_() : null;
    var detailRows = buildReportDetailRows_(filtered, now, petugasMap, responseMap);

    // V11.10.5: hitung total "Telat Respon" untuk ringkasan laporan (di bawah
    // "Detail Aduan Gangguan"), dihitung dari SEMUA data terfilter (bukan cuma
    // 1000 baris pertama di detailRows), supaya tetap akurat walau datanya besar.
    // Dianggap "Telat Respon" kalau aduan sudah direspons TERLAMBAT (RESPONDED_LATE)
    // ATAU masih aktif & belum direspons padahal sudah lewat batas (ACTIVE_LATE) --
    // sama seperti definisi kartu "Lewat Respons" di dashboard, ditambah yang
    // sudah kadung telat direspons di masa lalu.
    stats.telatRespon = countTelatResponUntukLaporan_(filtered, now, responseMap);

    var meta = buildReportMeta_(reportOptions, range, now);
    meta.auth = sessionUser;
    var reportId = generateReportId_();
    var verificationUrl = buildVerificationUrl_(reportOptions.dashboardUrl || '', reportId);

    meta.reportId = reportId;
    meta.verificationUrl = verificationUrl;
    meta.pdfFileName = 'Laporan_Gangguan_' + (meta.fileAt || Date.now()) + '.pdf';

    logExportReport_(meta, stats, detailRows);

    return {
      success: true,
      stats: stats,
      cabangSummary: cabangSummary,
      detailRows: detailRows,
      meta: meta,
      qrImageDataUrl: getQrImageDataUrl_(verificationUrl)
    };
  } catch (e) {
    Logger.log('Error clientGetPdfReportData: ' + e.message + '\n' + e.stack);
    return { success: false, error: e.message };
  }
}

function getEmptyReportStats_() {
  return {
    total: 0,
    aktif: 0,
    selesai: 0,
    batal: 0,
    lewatSLA: 0,
    prioritasTinggi: 0,
    telatRespon: 0
  };
}

function countTelatResponUntukLaporan_(data, now, responseMap) {
  var count = 0;
  (data || []).forEach(function(d) {
    var info = getReportResponseInfoForRow_(d, now, responseMap);
    var code = String((info && info.statusCode) || '').toUpperCase();
    if (code.indexOf('RESPONDED_LATE') !== -1 || code.indexOf('ACTIVE_LATE') !== -1) {
      count++;
    }
  });
  return count;
}

function buildReportStats_(data, now) {
  var stats = getEmptyReportStats_();
  stats.total = data.length;

  data.forEach(function(d) {
    if (d.status === 'Selesai') stats.selesai++;
    if (d.status === 'Batal') stats.batal++;
    if (d.status !== 'Selesai' && d.status !== 'Batal') stats.aktif++;

    if ((d.prioritas === 'Darurat' || d.prioritas === 'Tinggi') &&
        d.status !== 'Selesai' && d.status !== 'Batal') {
      stats.prioritasTinggi++;
    }

    if (d.status !== 'Selesai' && d.status !== 'Batal') {
      var sla = getSlaInfo_(d, now);
      if (sla.overdue) stats.lewatSLA++;
    }
  });

  return stats;
}

function buildCabangReportSummary_(data, now) {
  var map = {};

  CONFIG.CABANG.forEach(function(cabang) {
    map[cabang] = {
      cabang: cabang,
      total: 0,
      aktif: 0,
      selesai: 0,
      batal: 0,
      lewatSLA: 0,
      tinggiDarurat: 0
    };
  });

  data.forEach(function(d) {
    var key = d.cabang || 'Tanpa Cabang';
    if (!map[key]) {
      map[key] = {
        cabang: key,
        total: 0,
        aktif: 0,
        selesai: 0,
        batal: 0,
        lewatSLA: 0,
        tinggiDarurat: 0
      };
    }

    map[key].total++;
    if (d.status === 'Selesai') map[key].selesai++;
    if (d.status === 'Batal') map[key].batal++;
    if (d.status !== 'Selesai' && d.status !== 'Batal') map[key].aktif++;

    if ((d.prioritas === 'Darurat' || d.prioritas === 'Tinggi') &&
        d.status !== 'Selesai' && d.status !== 'Batal') {
      map[key].tinggiDarurat++;
    }

    if (d.status !== 'Selesai' && d.status !== 'Batal') {
      var sla = getSlaInfo_(d, now);
      if (sla.overdue) map[key].lewatSLA++;
    }
  });

  return Object.keys(map)
    .map(function(k) { return map[k]; })
    .filter(function(r) { return r.total > 0; })
    .sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    });
}





// ============================================================
// V10.9.108 - PENUGASAN PETUGAS OPSIONAL DARI INDEX
// ============================================================
function setupPenugasanAduanSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.PENUGASAN_ADUAN_SHEET || 'PENUGASAN_ADUAN';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var headers = ['Timestamp', 'ID Aduan', 'Cabang', 'Nama Petugas', 'No WA Petugas', 'Role Petugas', 'Ditugaskan Oleh', 'Role User', 'Catatan'];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (!current[i]) sh.getRange(1, i + 1).setValue(headers[i]);
    }
  }
  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#0f2044').setFontColor('#ffffff').setFontWeight('bold');
    sh.getRange(2, 5, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
  } catch(e) {}
  return sh;
}

function normalizePetugasAssignmentName_(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function getPenugasanAduanRows_(idAduan) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) return [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupPenugasanAduanSheet_(ss);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(9, sh.getLastColumn())).getDisplayValues();
  var out = [];
  values.forEach(function(r, i) {
    if (normalizeAduanIdHyphen_(r[1] || '') !== idAduan) return;
    out.push({
      rowNumber: i + 2,
      timestamp: r[0] || '',
      id: r[1] || '',
      cabang: r[2] || '',
      nama: r[3] || '',
      noWa: normalizePhone_(r[4] || ''),
      role: r[5] || '',
      ditugaskanOleh: r[6] || '',
      roleUser: r[7] || '',
      catatan: r[8] || ''
    });
  });
  return out;
}

function getAvailablePetugasForCabang_(cabang) {
  var targetKey = normalizeCabangKey_(cabang || '');
  var seen = {};
  var list = [];
  getPetugasRows_().forEach(function(p) {
    if (!p || !p.nama) return;
    if (String(p.status || 'Aktif').toLowerCase() === 'nonaktif') return;
    if (normalizeCabangKey_(p.cabang || '') !== targetKey) return;
    var key = normalizePetugasAssignmentName_(p.nama).toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    list.push({
      nama: normalizePetugasAssignmentName_(p.nama),
      noWa: normalizePhone_(p.noWa || ''),
      role: p.role || '',
      cabang: p.cabang || cabang || ''
    });
  });
  return list.sort(function(a, b) { return String(a.nama).localeCompare(String(b.nama)); });
}

function saveAduanPetugasAssignments_(idAduan, names, sessionUser) {
  idAduan = normalizeAduanIdHyphen_(idAduan || '');
  if (!idAduan) throw new Error('ID aduan kosong.');
  names = Array.isArray(names) ? names : [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var rowNumber = findAduanRowNumberById_(idAduan);
  if (!main || !rowNumber) throw new Error('ID aduan tidak ditemukan: ' + idAduan);

  var aduan = getAduanObjectFromSheetRow_(main, rowNumber);
  if (!dashboardUserCanAccessAduan_(sessionUser, aduan)) throw new Error('Aduan ini bukan cabang login Anda.');

  var available = getAvailablePetugasForCabang_(aduan.cabang || '');
  var byName = {};
  available.forEach(function(p) {
    byName[normalizePetugasAssignmentName_(p.nama).toLowerCase()] = p;
  });

  var selected = [];
  var seen = {};
  names.forEach(function(n) {
    n = normalizePetugasAssignmentName_(n);
    if (!n) return;
    var key = n.toLowerCase();
    if (seen[key]) return;
    var p = byName[key];
    if (!p) throw new Error('Petugas "' + n + '" tidak terdaftar aktif di ' + (aduan.cabang || 'cabang ini') + '.');
    seen[key] = true;
    selected.push(p);
  });

  var sh = setupPenugasanAduanSheet_(ss);
  var last = safeGetLastRow_(sh);
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, Math.max(9, sh.getLastColumn())).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (normalizeAduanIdHyphen_(vals[i][1] || '') === idAduan) {
        sh.deleteRow(i + 2);
      }
    }
  }

  var now = new Date();
  var actor = sessionUser.nama || sessionUser.username || 'Dashboard Admin';
  var roleUser = sessionUser.role || '-';
  var rows = selected.map(function(p) {
    return [now, idAduan, aduan.cabang || '', p.nama || '', normalizePhone_(p.noWa || ''), p.role || '', actor, roleUser, 'Ditambahkan dari Index'];
  });
  if (rows.length) {
    sh.getRange(safeGetLastRow_(sh) + 1, 1, rows.length, 9).setValues(rows);
    try { sh.getRange(2, 5, Math.max(1, safeGetLastRow_(sh) - 1), 1).setNumberFormat('@'); } catch(e) {}
  }

  try {
    logStatusAduan_(idAduan, aduan.status || '', aduan.status || '', sessionUser, 'DASHBOARD_PENUGASAN', '', JSON.stringify({ petugas: selected.map(function(p) { return p.nama; }) }));
  } catch(eLog) {}

  return {
    assigned: getPenugasanAduanRows_(idAduan),
    available: available
  };
}

function clientSaveAduanPetugasAssignments(form) {
  try {
    form = form || {};
    var sessionUser = validateDashboardSession_(form._sessionToken || form.sessionToken || form.token || '');
    if (!sessionUser) return { success: false, needLogin: true, error: 'Sesi login tidak valid atau sudah habis. Silakan masuk kembali.' };
    var result = saveAduanPetugasAssignments_(form.id || form.aduanId || '', form.petugas || form.names || [], sessionUser);
    return { success: true, assigned: result.assigned, availablePetugas: result.available };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function normalizeDashboardCabangForMatch_(value) {
  value = String(value || '').trim();
  if (value === 'Admin Pusat') return 'all';
  if (value.toUpperCase && value.toUpperCase() === 'ALL') return 'all';
  return normalizeCabangKey_(value || '');
}

function clearDashboardSessionsForCabang_(cabang) {
  var wanted = normalizeDashboardCabangForMatch_(cabang || '');
  if (!wanted) return 0;
  var sh = getOrCreateDashboardSessionsSheet_();
  if (!sh || sh.getLastRow() < 2) return 0;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(8, sh.getLastColumn())).getValues();
  var cleared = 0;
  for (var i = vals.length - 1; i >= 0; i--) {
    var rowCabang = normalizeDashboardCabangForMatch_(vals[i][3] || '');
    if (rowCabang === wanted) {
      sh.deleteRow(i + 2);
      cleared++;
    }
  }
  return cleared;
}

// ============================================================
// V10.9.107 - Petugas Menangani Otomatis
// ------------------------------------------------------------
// Tidak menambah step WA petugas. Nama petugas diambil otomatis dari:
// 1) LOG_STATUS_ADUAN: siapa yang update status
// 2) DOKUMENTASI_ADUAN: siapa yang upload foto bukti
// Laporan export mengganti kolom Unit menjadi Petugas.
// ============================================================

function isValidAduanHandlerName_(name) {
  name = String(name || '').trim();
  if (!name) return false;

  var lower = name.toLowerCase();
  if (lower === '-' || lower === '—') return false;
  if (lower === 'sistem' || lower === 'system') return false;
  if (lower === 'siaga tiara' || lower === 'tiara assistant') return false;
  if (lower === 'dashboard manual') return false;
  if (lower === 'admin pusat') return false;
  if (lower.indexOf('pelanggan') !== -1) return false;

  return true;
}

function shouldCountAduanHandlerSource_(source) {
  source = String(source || '').toUpperCase();

  // Pembuatan aduan manual hanya pencatatan awal, bukan petugas yang menangani.
  if (source === 'DASHBOARD_MANUAL') return false;

  // Update status dari petugas WA selalu dihitung.
  if (source.indexOf('WA_PETUGAS') !== -1 || source.indexOf('PETUGAS') !== -1) return true;

  // Update dari dashboard juga dihitung kalau aktornya bukan Admin Pusat/sistem.
  // Ini menjaga jika cabang/petugas update lewat dashboard.
  if (source === 'DASHBOARD_WEB' || source.indexOf('DASHBOARD_UPDATE') !== -1) return true;

  return false;
}

function createAduanHandlerCollector_() {
  var names = [];
  var seen = {};

  return {
    add: function(name) {
      name = String(name || '').trim();
      if (!isValidAduanHandlerName_(name)) return;
      var key = name.toLowerCase().replace(/\s+/g, ' ');
      if (seen[key]) return;
      seen[key] = true;
      names.push(name);
    },
    text: function() {
      return names.length ? names.join(', ') : 'Belum ada petugas';
    },
    list: function() {
      return names.slice();
    }
  };
}

function buildAduanPetugasMap_(aduanIds) {
  var wanted = {};
  var hasFilter = false;
  (aduanIds || []).forEach(function(id) {
    id = normalizeAduanIdHyphen_(id || '');
    if (id) {
      wanted[id] = true;
      hasFilter = true;
    }
  });

  var map = {};

  function collectorFor_(id) {
    id = normalizeAduanIdHyphen_(id || '');
    if (!id) return null;
    if (hasFilter && !wanted[id]) return null;
    if (!map[id]) map[id] = createAduanHandlerCollector_();
    return map[id];
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0) Dari PENUGASAN_ADUAN: pilihan opsional dari Index.
    var assignSh = ss.getSheetByName(CONFIG.PENUGASAN_ADUAN_SHEET || 'PENUGASAN_ADUAN');
    if (assignSh && safeGetLastRow_(assignSh) >= 2) {
      var assignValues = assignSh.getRange(2, 1, safeGetLastRow_(assignSh) - 1, Math.min(assignSh.getLastColumn(), 9)).getValues();
      assignValues.forEach(function(r) {
        var id = normalizeAduanIdHyphen_(r[1] || '');
        var c = collectorFor_(id);
        if (!c) return;
        c.add(r[3] || '');
      });
    }

    // 1) Dari LOG_STATUS_ADUAN.
    var logSh = ss.getSheetByName(CONFIG.LOG_STATUS_ADUAN_SHEET || 'LOG_STATUS_ADUAN');
    if (logSh && safeGetLastRow_(logSh) >= 2) {
      var logValues = logSh.getRange(2, 1, safeGetLastRow_(logSh) - 1, Math.min(logSh.getLastColumn(), 10)).getValues();
      logValues.forEach(function(r) {
        var id = normalizeAduanIdHyphen_(r[1] || '');
        var source = String(r[7] || '');
        if (!shouldCountAduanHandlerSource_(source)) return;
        var c = collectorFor_(id);
        if (!c) return;
        c.add(r[4] || '');
      });
    }

    // 2) Dari DOKUMENTASI_ADUAN.
    var docSh = ss.getSheetByName(CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN');
    if (docSh && safeGetLastRow_(docSh) >= 2) {
      var docValues = docSh.getRange(2, 1, safeGetLastRow_(docSh) - 1, Math.min(docSh.getLastColumn(), 11)).getValues();
      docValues.forEach(function(r) {
        var id = normalizeAduanIdHyphen_(r[1] || '');
        var c = collectorFor_(id);
        if (!c) return;
        c.add(r[3] || '');
      });
    }
  } catch(e) {}

  var out = {};
  Object.keys(map).forEach(function(id) {
    out[id] = map[id].text();
  });
  return out;
}

function buildPetugasMenanganiTextFromLogs_(statusLogs, docs, assignments) {
  var c = createAduanHandlerCollector_();

  (assignments || []).forEach(function(a) {
    a = a || {};
    c.add(a.nama || a.namaPetugas || '');
  });

  (statusLogs || []).forEach(function(l) {
    l = l || {};
    if (!shouldCountAduanHandlerSource_(l.sumber || l.source || '')) return;
    c.add(l.aktor || l.nama || '');
  });

  (docs || []).forEach(function(d) {
    d = d || {};
    c.add(d.petugas || d.namaPetugas || '');
  });

  return c.text();
}



function formatReportResponseLabel_(info, status) {
  info = info || {};
  var code = String(info.statusCode || '').toUpperCase();
  var label = String(info.statusLabel || info.status || '').toLowerCase();
  var st = String(status || '').toLowerCase();

  // V10.9.244:
  // Kolom laporan tetap berjudul "SLA", tetapi NILAINYA harus sama arah dengan
  // kolom Respons dashboard: "Respons terlambat" => "Terlambat",
  // "Respons tepat waktu" => "Tepat waktu". Jangan pakai status akhir "Selesai".
  if (code.indexOf('RESPONDED_LATE') !== -1 || label.indexOf('respons terlambat') !== -1 || label.indexOf('terlambat') !== -1) {
    return 'Terlambat';
  }
  if (code.indexOf('RESPONDED_ONTIME') !== -1 || label.indexOf('respons tepat') !== -1 || label.indexOf('tepat waktu') !== -1) {
    return 'Tepat waktu';
  }
  if (code.indexOf('ACTIVE_LATE') !== -1 || label.indexOf('lewat respons') !== -1 || label.indexOf('lewat sla') !== -1) {
    // BUGFIX: kolom SLA di laporan bulanan sebelumnya cuma tampil kata "Lewat"
    // polos untuk aduan yang belum selesai & sudah lewat SLA, tanpa keterangan
    // sudah berapa lama -- padahal di dashboard (badge SLA) sudah ada info
    // "Lewat 2 hari 3 jam", dst. Sekarang ikutkan durasinya di laporan juga,
    // supaya konsisten dengan dashboard.
    var lateHoursVal = Number(
      (info && (info.lateHours != null ? info.lateHours : info.overdueHours)) || 0
    );
    if (lateHoursVal > 0) {
      return 'Lewat ' + formatDurasiSla_(lateHoursVal);
    }
    return 'Lewat';
  }
  if (code.indexOf('ACTIVE_NEAR') !== -1 || label.indexOf('hampir') !== -1) {
    return 'Menunggu';
  }
  if (code.indexOf('ACTIVE_OK') !== -1 || label.indexOf('menunggu') !== -1) {
    return 'Menunggu';
  }
  if (code.indexOf('BATAL') !== -1 || st === 'batal' || label.indexOf('batal') !== -1) {
    return 'Batal';
  }

  // Fallback lama jika fungsi response belum tersedia.
  // Tetap jangan tampilkan "Selesai" di kolom SLA, karena itu status aduan.
  if (code.indexOf('DONE_LATE') !== -1 || label.indexOf('selesai terlambat') !== -1) {
    return 'Terlambat';
  }
  if (code.indexOf('DONE_ONTIME') !== -1 || label.indexOf('selesai tepat') !== -1) {
    return 'Tepat waktu';
  }
  if (label === 'selesai' || st === 'selesai') {
    return '-';
  }

  return label ? label.replace(/^respons\s+/i, '') : '-';
}

function getReportResponseInfoForRow_(d, now, responseMap) {
  // Prioritas utama: fungsi respons dashboard (sumber kebenaran untuk tepat/terlambat).
  try {
    if (typeof getAduanResponseInfo_ === 'function') {
      return getAduanResponseInfo_(d, now || new Date(), responseMap || {});
    }
  } catch (e1) {}

  // Fallback: override dashboard jika tersedia.
  try {
    if (typeof buildAduanSlaDashboardInfo_ === 'function') {
      return buildAduanSlaDashboardInfo_(d, now || new Date());
    }
  } catch (e2) {}

  // Fallback paling akhir.
  try {
    return getSlaInfo_(d, now || new Date());
  } catch (e3) {}

  return {};
}

function buildReportDetailRows_(data, now, petugasMap, responseMap) {
  responseMap = responseMap || ((typeof buildAduanResponseTimeMap_ === 'function') ? buildAduanResponseTimeMap_() : null);

  return data.slice().sort(function(a, b) {
    if (String(a.cabang || '') !== String(b.cabang || '')) {
      return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    }
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  }).slice(0, 1000).map(function(d) {
    var responseInfo = getReportResponseInfoForRow_(d, now, responseMap);
    var responseText = formatReportResponseLabel_(responseInfo, d.status);

    var idKey = normalizeAduanIdHyphen_(d.id || '');
    var petugasText = (petugasMap && petugasMap[idKey]) ? petugasMap[idKey] : 'Belum ada petugas';

    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noPelanggan: d.noPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
      prioritas: d.prioritas,
      status: d.status,
      unit: petugasText,
      petugas: petugasText,
      unitAsli: d.unit || '',
      // Judul kolom di export tetap "SLA", tetapi isi mengikuti indikator Respons dashboard.
      sla: responseText,
      slaLaporan: responseText,
      reportSla: responseText,
      respons: responseText,
      responseStatusCode: responseInfo.statusCode || '',
      responseStatusLabel: responseInfo.statusLabel || '',
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 220) : ''
    };
  });
}


function getReportDateRange_(options, now) {
  options = options || {};
  var period = options.period || 'this_month';

  var start = null;
  var end = null;
  var label = 'Semua Data';

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    label = 'Hari Ini';
  } else if (period === 'last_7_days') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    label = '7 Hari Terakhir';
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = 'Bulan Ini (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
  } else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'Bulan Lalu (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
  } else if (period === 'custom') {
    start = parseInputDate_(options.startDate);
    var endInput = parseInputDate_(options.endDate);

    if (start && endInput) {
      end = new Date(endInput.getFullYear(), endInput.getMonth(), endInput.getDate() + 1);
      label =
        Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy') +
        ' - ' +
        Utilities.formatDate(endInput, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      label = 'Bulan Ini (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
    }
  } else if (period === 'all') {
    label = 'Semua Data';
  }

  return {
    period: period,
    start: start,
    end: end,
    label: label
  };
}

function buildReportMeta_(options, range, now) {
  options = options || {};
  range = range || {};

  return {
    period: range.period || options.period || 'this_month',
    periodLabel: range.label || 'Bulan Ini',
    cabang: options.cabang && options.cabang !== 'Semua' ? options.cabang : 'Semua Cabang',
    wilayah: options.wilayah && options.wilayah !== 'Semua' ? options.wilayah : 'Semua Wilayah',
    printAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    fileAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmm')
  };
}

function enrichDashboardMetaWithPeriod_(meta, range) {
  meta = meta || {};
  range = range || {};
  meta.period = range.period || 'this_month';
  meta.periodLabel = range.label || 'Bulan Ini';
  return meta;
}

function parseInputDate_(value) {
  if (!value) return null;

  var parts = String(value).split('-');
  if (parts.length !== 3) return null;

  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}


function generateReportId_() {
  // ID laporan dibuat unik dengan kombinasi waktu + potongan UUID.
  // Ini mencegah bentrok meskipun export dilakukan beberapa kali dalam detik yang sama.
  var now = new Date();
  var timePart = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var randomPart = Utilities.getUuid().split('-')[0].toUpperCase();
  return 'LAP-' + timePart + '-' + randomPart;
}

function buildVerificationUrl_(dashboardUrl, reportId) {
  var base = '';

  // Prioritas utama: URL resmi Web App dari Apps Script.
  // Jangan memakai window.location.href dari dashboard karena kadang terbaca sebagai URL sandbox.
  try {
    base = ScriptApp.getService().getUrl();
  } catch (err) {
    base = '';
  }

  // Fallback: URL Dashboard di sheet SETTINGS.
  if (!base) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
      if (sh) {
        base = String(sh.getRange(4, 2).getValue() || '').split('?')[0];
      }
    } catch (err2) {
      base = '';
    }
  }

  // Fallback terakhir: jika user mengirim URL dan itu memang script.google.com.
  if (!base && dashboardUrl && String(dashboardUrl).indexOf('script.google.com') !== -1) {
    base = String(dashboardUrl).split('?')[0];
  }

  if (!base) return '';

  return base + '?verify=' + encodeURIComponent(reportId);
}

function getQrImageDataUrl_(verificationUrl) {
  if (!verificationUrl) return '';

  try {
    var apiUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=240x240&chld=H|0&chl=' + encodeURIComponent(verificationUrl);
    var response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      return 'data:image/png;base64,' + Utilities.base64Encode(response.getContent());
    }
  } catch (err) {
    Logger.log('QR fetch error: ' + err.message);
  }

  return '';
}

function logExportReport_(meta, stats, detailRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupExportLogSheet(ss);
  setupExportDetailSheet(ss);

  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  var detailSheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);

  detailRows = detailRows || [];

  var aduanIds = [];
  if (detailRows.length) {
    aduanIds = detailRows.map(function(r) { return r.id || ''; }).filter(Boolean);
  }

  sheet.appendRow([
    meta.reportId        || '',
    meta.printAt         || '',
    meta.periodLabel     || '',
    meta.cabang          || 'Semua Cabang',
    meta.wilayah         || 'Semua Wilayah',
    Number(stats.total   || 0),
    Number(stats.aktif   || 0),
    Number(stats.selesai || 0),
    Number(stats.lewatSLA|| 0),
    meta.verificationUrl || '',
    meta.pdfFileName     || '',
    JSON.stringify(aduanIds)
  ]);

  // Snapshot detail laporan disimpan saat PDF dibuat.
  // Verify akan membaca sheet ini, bukan sheet ADUAN yang bisa berubah.
  if (detailRows.length) {
    var rows = detailRows.map(function(r, i) {
      return [
        meta.reportId || '',
        i + 1,
        r.id || '',
        r.waktu || '',
        r.cabang || '',
        r.wilayah || '',
        r.namaPelanggan || '',
        r.noHp || '',
        r.jenis || '',
        r.sumberAduan || r.sumber || '',
        r.prioritas || '',
        r.status || '',
        r.unit || '',
        r.sla || '',
        r.keterangan || ''
      ];
    });

    detailSheet
      .getRange(detailSheet.getLastRow() + 1, 1, rows.length, 15)
      .setValues(rows);
  }
}

function getReportLogById_(reportId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(reportId)) {
      return {
        reportId       : values[i][0],
        tanggalExport  : values[i][1],
        periode        : values[i][2],
        cabang         : values[i][3],
        wilayah        : values[i][4],
        totalAduan     : values[i][5],
        aduanAktif     : values[i][6],
        selesai        : values[i][7],
        lewatSLA       : values[i][8],
        verificationUrl: values[i][9],
        pdfFileName    : values[i][10],
        aduanIds       : values[i][11] || ''
      };
    }
  }
  return null;
}



function getReportDetailSnapshot_(reportId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 15)).getValues();
  var rows = [];

  values.forEach(function(v) {
    if (String(v[0]) === String(reportId)) {
      var waktuRaw = v[3];
      var waktuFormatted = '';

      if (waktuRaw instanceof Date) {
        waktuFormatted = formatDisplayDate(waktuRaw);
      } else if (waktuRaw) {
        try {
          var tryDate = new Date(waktuRaw);
          if (!isNaN(tryDate.getTime()) && String(waktuRaw).indexOf('GMT') !== -1) {
            waktuFormatted = formatDisplayDate(tryDate);
          } else {
            waktuFormatted = String(waktuRaw);
          }
        } catch (e) {
          waktuFormatted = String(waktuRaw);
        }
      }

      rows.push({
        no: Number(v[1] || 0),
        id: String(v[2] || ''),
        waktu: waktuFormatted || '',
        cabang: String(v[4] || ''),
        wilayah: String(v[5] || ''),
        namaPelanggan: String(v[6] || ''),
        noHp: String(v[7] || ''),
        jenis: String(v[8] || ''),
        sumberAduan: String(v[9] || ''),
        prioritas: String(v[10] || ''),
        status: String(v[11] || ''),
        unit: String(v[12] || ''),
        sla: String(v[13] || ''),
        keterangan: String(v[14] || '')
      });
    }
  });

  rows.sort(function(a, b) {
    return (a.no || 0) - (b.no || 0);
  });

  return rows;
}

function getVerificationReport_(reportId) {
  var row = getReportLogById_(reportId);

  if (!row) {
    return { found: false, reportId: reportId || '-' };
  }
  // Ambil detail dari snapshot laporan saat PDF dibuat.
  // Ini membuat halaman verify sama dengan isi PDF, walaupun sheet ADUAN sudah berubah.
  var detailRows = getReportDetailSnapshot_(reportId);

  // Format tanggal export
  var tglExportStr = '-';
  try {
    if (row.tanggalExport) {
      tglExportStr = Utilities.formatDate(new Date(row.tanggalExport), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    }
  } catch(e) {}

  return {
    found         : true,
    reportId      : String(row.reportId    || '-'),
    tanggalExport : tglExportStr,
    periode       : String(row.periode     || '-'),
    cabang        : String(row.cabang      || '-'),
    wilayah       : String(row.wilayah     || '-'),
    totalAduan    : Number(row.totalAduan  || 0),
    aduanAktif    : Number(row.aduanAktif  || 0),
    selesai       : Number(row.selesai     || 0),
    lewatSLA      : Number(row.lewatSLA    || 0),
    pdfFileName   : String(row.pdfFileName || '-'),
    rows          : detailRows
  };
}

function buildVerificationPage_(reportId) {
  var row = getReportLogById_(reportId);
  var found = !!row;

  var body = found
    ? '<div class="status ok">✅ Dokumen resmi SIAGA TIARA terverifikasi</div>' +
      '<div class="card-grid">' +
        renderVerifyItem_('ID Laporan', row.reportId) +
        renderVerifyItem_('Tanggal Export', row.tanggalExport) +
        renderVerifyItem_('Periode', row.periode) +
        renderVerifyItem_('Cabang', row.cabang) +
        renderVerifyItem_('Wilayah', row.wilayah) +
        renderVerifyItem_('Total Aduan', row.totalAduan) +
        renderVerifyItem_('Aduan Aktif', row.aduanAktif) +
        renderVerifyItem_('Selesai', row.selesai) +
        renderVerifyItem_('Lewat SLA', row.lewatSLA) +
        renderVerifyItem_('Nama File PDF', row.pdfFileName || '-') +
      '</div>'
    : '<div class="status no">⚠ ID laporan tidak ditemukan. Dokumen perlu diverifikasi ulang oleh admin.</div>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Verifikasi Laporan</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;color:#0f172a;}' +
      '.wrap{max-width:860px;margin:0 auto;}' +
      '.hero{background:#0f3b68;color:#fff;border-radius:18px;padding:24px 22px;box-shadow:0 12px 32px rgba(15,59,104,.18);}' +
      '.hero h1{margin:0 0 6px;font-size:24px;}' +
      '.hero p{margin:0;font-size:14px;opacity:.9;}' +
      '.status{margin:18px 0 0;padding:14px 16px;border-radius:14px;font-weight:700;}' +
      '.ok{background:#ecfdf5;color:#166534;border:1px solid #a7f3d0;}' +
      '.no{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}' +
      '.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px;}' +
      '.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 15px;box-shadow:0 8px 24px rgba(15,23,42,.05);}' +
      '.label{font-size:12px;color:#64748b;margin-bottom:5px;font-weight:700;}' +
      '.value{font-size:16px;color:#111827;font-weight:800;word-break:break-word;}' +
      '.note{margin-top:18px;font-size:13px;color:#475569;line-height:1.6;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 15px;}' +
      '.footer{margin-top:18px;font-size:12px;color:#64748b;}' +
    '</style></head><body><div class="wrap">' +
    '<div class="hero"><h1>Verifikasi Laporan Resmi</h1><p>SIAGA TIARA • PERUMDAM Tirta Ardhia Rinjani</p></div>' +
    body +
    '<div class="note">Scan QR pada PDF untuk membuka halaman verifikasi ini. Jika ID laporan ditemukan, maka dokumen tersebut tercatat sebagai laporan resmi yang dihasilkan oleh sistem SIAGA TIARA.</div>' +
    '<div class="footer">Generated by SIAGA TIARA</div>' +
    '</div></body></html>';
}

function renderVerifyItem_(label, value) {
  return '<div class="card"><div class="label">' + label + '</div><div class="value">' + (value || '-') + '</div></div>';
}


// ============================================================
// HELPER: Sumber/Jenis Aduan
// ============================================================
function getAduanSumberLabel_(catatan) {
  var text = String(catatan || '').toLowerCase();

  // Laporan yang dibuat pelanggan melalui WhatsApp/SIAGA TIARA disebut Call Center.
  if (
    text.indexOf('whatsapp') !== -1 ||
    text.indexOf('wa pelanggan') !== -1 ||
    text.indexOf('pelanggan whatsapp') !== -1 ||
    (text.indexOf('pelanggan') !== -1 && text.indexOf('masuk dari') !== -1)
  ) {
    return 'Call Center';
  }

  // Laporan yang diinput petugas/admin lewat dashboard disebut Langsung.
  if (
    text.indexOf('dashboard manual') !== -1 ||
    text.indexOf('input manual') !== -1 ||
    text.indexOf('diinput') !== -1 ||
    text.indexOf('masuk ke aduan pusat') !== -1 ||
    text.indexOf('dashboard') !== -1
  ) {
    return 'Langsung';
  }

  // Data lama yang tidak punya catatan sumber tetap diberi label default agar kolom tidak kosong.
  return 'Langsung';
}

// ============================================================
// HELPER: Parse data dari sheet
// ============================================================
function parseData(rawData) {
  return rawData.map(function(row) {
    var catatanValue = row[CONFIG.COL.CATATAN - 1];
    return {
      id:           row[CONFIG.COL.ID - 1],
      waktuMasuk:   row[CONFIG.COL.WAKTU_MASUK - 1] ? new Date(row[CONFIG.COL.WAKTU_MASUK - 1]) : null,
      cabang:       row[CONFIG.COL.CABANG - 1],
      wilayah:      row[CONFIG.COL.WILAYAH - 1],
      desa:         row[CONFIG.COL.DESA - 1],
      noPelanggan:  row[CONFIG.COL.NO_PELANGGAN - 1] != null ? String(row[CONFIG.COL.NO_PELANGGAN - 1]) : '',
      namaPelanggan: row[CONFIG.COL.NAMA_PELANGGAN - 1],
      noHp:         row[CONFIG.COL.NO_HP - 1],
      jenisGangguan: row[CONFIG.COL.JENIS_GANGGUAN - 1],
      prioritas:    row[CONFIG.COL.PRIORITAS - 1],
      status:       row[CONFIG.COL.STATUS - 1],
      unit:         row[CONFIG.COL.UNIT - 1],
      keterangan:   row[CONFIG.COL.KETERANGAN - 1],
      catatan:      catatanValue,
      sumberAduan:  getAduanSumberLabel_(catatanValue),
      waktuSelesai: row[CONFIG.COL.WAKTU_SELESAI - 1] ? new Date(row[CONFIG.COL.WAKTU_SELESAI - 1]) : null,
      slaJam:       row[CONFIG.COL.SLA_JAM - 1] || 8,
      updatedAt:    row[CONFIG.COL.UPDATED_AT - 1] ? new Date(row[CONFIG.COL.UPDATED_AT - 1]) : null
    };
  }).filter(function(d) {
    return d.id && d.waktuMasuk; // hanya baris dengan data valid
  });
}

function applyFilters(data, filters) {
  filters = filters || {};
  var range = getReportDateRange_(filters, new Date());
  return data.filter(function(d) {
    if (filters.cabang && filters.cabang !== 'Semua' && d.cabang !== filters.cabang) return false;
    if (filters.wilayah && filters.wilayah !== 'Semua' && d.wilayah !== filters.wilayah) return false;

    if ((range.start || range.end) && !d.waktuMasuk) return false;
    if (range.start && d.waktuMasuk < range.start) return false;
    if (range.end && d.waktuMasuk >= range.end) return false;

    return true;
  });
}

function formatDateStr(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch(e) { return ''; }
}

function formatDisplayDate(date) {
  if (!date) return '-';
  try {
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  } catch(e) { return '-'; }
}

// ============================================================
// HELPER: Chart data
// ============================================================
function getTren7Hari(data, now) {
  var labels = [];
  var counts = [];

  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var dayStr = formatDateStr(d);
    var dayLabel = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM');
    labels.push(dayLabel);

    var count = data.filter(function(item) {
      return item.waktuMasuk && formatDateStr(item.waktuMasuk) === dayStr;
    }).length;
    counts.push(count);
  }

  return { labels: labels, data: counts };
}

function getTren7HariCabang(data, now) {
  var labels = [];
  var dayKeys = [];

  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var dayStr = formatDateStr(d);
    var dayLabel = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM');

    dayKeys.push(dayStr);
    labels.push(dayLabel);
  }

  var datasets = CONFIG.CABANG.map(function(cabang) {
    var values = dayKeys.map(function(dayKey) {
      return data.filter(function(item) {
        return item.waktuMasuk &&
               item.cabang === cabang &&
               formatDateStr(item.waktuMasuk) === dayKey;
      }).length;
    });

    return {
      label: cabang,
      data: values
    };
  });

  return {
    labels: labels,
    datasets: datasets
  };
}


function getStatusCount(data) {
  var result = {};
  CONFIG.STATUS.forEach(function(s) { result[s] = 0; });
  data.forEach(function(d) {
    if (d.status && result.hasOwnProperty(d.status)) result[d.status]++;
  });
  return result;
}

function getJenisCount(data) {
  var result = {};
  CONFIG.JENIS_GANGGUAN.forEach(function(j) { result[j] = 0; });
  data.forEach(function(d) {
    if (d.jenisGangguan && result.hasOwnProperty(d.jenisGangguan)) result[d.jenisGangguan]++;
  });
  // Urutkan descending
  var sorted = Object.keys(result).map(function(k) {
    return { label: k, count: result[k] };
  }).sort(function(a, b) { return b.count - a.count; });
  return sorted;
}

function getCabangRanking(data, fromDate) {
  data = data || [];
  fromDate = fromDate || new Date(0);

  var result = {};
  CONFIG.CABANG.forEach(function(c) {
    result[c] = {
      cabang: c,
      count: 0,
      selesaiCount: 0,
      totalDurationHours: 0,
      validSlaCount: 0,
      onTimeCount: 0
    };
  });

  data.forEach(function(d) {
    if (!d || !result.hasOwnProperty(d.cabang)) return;
    if (d.waktuMasuk && d.waktuMasuk < fromDate) return;

    var item = result[d.cabang];
    item.count++;

    if (String(d.status || '').trim() !== 'Selesai') return;
    var masuk = d.waktuMasuk ? new Date(d.waktuMasuk) : null;
    var selesai = d.waktuSelesai ? new Date(d.waktuSelesai) : null;
    if (!masuk || !selesai) return;

    var durationHours = (selesai.getTime() - masuk.getTime()) / 3600000;
    if (isFinite(durationHours) && durationHours >= 0) {
      item.selesaiCount++;
      item.totalDurationHours += durationHours;
    }

    var sla = buildAduanSlaDashboardInfo_(d, new Date());
    if (sla && sla.valid && (sla.statusCode === 'DONE_ONTIME' || sla.statusCode === 'DONE_LATE')) {
      item.validSlaCount++;
      if (sla.statusCode === 'DONE_ONTIME') item.onTimeCount++;
    }
  });

  var sorted = Object.keys(result).map(function(k) {
    var item = result[k];
    var avgDuration = item.selesaiCount ? (item.totalDurationHours / item.selesaiCount) : null;
    return {
      cabang: item.cabang,
      count: item.count,
      selesaiCount: item.selesaiCount,
      avgDurationHours: avgDuration == null ? null : formatSlaNumber_(avgDuration),
      avgDurationText: avgDuration == null ? '—' : formatDurasiSla_(avgDuration),
      onTimeCount: item.onTimeCount,
      validSlaCount: item.validSlaCount,
      onTimePercent: item.validSlaCount ? Math.round((item.onTimeCount / item.validSlaCount) * 100) : null
    };
  }).sort(function(a, b) {
    var ap = (a.onTimePercent == null) ? -1 : a.onTimePercent;
    var bp = (b.onTimePercent == null) ? -1 : b.onTimePercent;
    if (bp !== ap) return bp - ap;

    var aa = (a.avgDurationHours == null) ? 999999 : a.avgDurationHours;
    var ba = (b.avgDurationHours == null) ? 999999 : b.avgDurationHours;
    if (aa !== ba) return aa - ba;

    if (b.selesaiCount !== a.selesaiCount) return b.selesaiCount - a.selesaiCount;
    return b.count - a.count;
  });
  return sorted; // Tampilkan semua cabang dengan performa SLA, rata-rata selesai, dan jumlah aduan.
}

function getCabangSpeedRanking(data, fromDate, now) {
  data = data || [];
  now = now || new Date();

  var result = {};
  CONFIG.CABANG.forEach(function(c) {
    result[c] = {
      cabang: c,
      selesaiCount: 0,
      totalDurationHours: 0,
      totalSlaHours: 0,
      validSlaCount: 0,
      onTimeCount: 0
    };
  });

  data.forEach(function(d) {
    if (!d || String(d.status || '').trim() !== 'Selesai') return;
    if (!result.hasOwnProperty(d.cabang)) return;

    var masuk = d.waktuMasuk ? new Date(d.waktuMasuk) : null;
    var selesai = d.waktuSelesai ? new Date(d.waktuSelesai) : null;
    if (!masuk || !selesai) return;
    if (selesai < fromDate) return;

    var durationHours = (selesai.getTime() - masuk.getTime()) / 3600000;
    if (!isFinite(durationHours) || durationHours < 0) return;

    var item = result[d.cabang];
    item.selesaiCount++;
    item.totalDurationHours += durationHours;

    var slaJam = Number(d.slaJam || getSlaJamForPrioritas_(d.prioritas) || 8);
    if (isFinite(slaJam) && slaJam > 0) item.totalSlaHours += slaJam;

    var sla = buildAduanSlaDashboardInfo_(d, now);
    if (sla && sla.valid && (sla.statusCode === 'DONE_ONTIME' || sla.statusCode === 'DONE_LATE')) {
      item.validSlaCount++;
      if (sla.statusCode === 'DONE_ONTIME') item.onTimeCount++;
    }
  });

  return Object.keys(result).map(function(k) {
    var item = result[k];
    if (!item.selesaiCount) return null;

    var avgDuration = item.totalDurationHours / item.selesaiCount;
    return {
      cabang: item.cabang,
      selesaiCount: item.selesaiCount,
      avgDurationHours: formatSlaNumber_(avgDuration),
      avgDurationText: formatDurasiSla_(avgDuration),
      onTimeCount: item.onTimeCount,
      validSlaCount: item.validSlaCount,
      onTimePercent: item.validSlaCount ? Math.round((item.onTimeCount / item.validSlaCount) * 100) : null,
      avgSlaUsagePercent: item.totalSlaHours ? Math.round((item.totalDurationHours / item.totalSlaHours) * 100) : null
    };
  }).filter(Boolean).sort(function(a, b) {
    if (a.avgDurationHours !== b.avgDurationHours) return a.avgDurationHours - b.avgDurationHours;
    if ((b.onTimePercent || 0) !== (a.onTimePercent || 0)) return (b.onTimePercent || 0) - (a.onTimePercent || 0);
    return b.selesaiCount - a.selesaiCount;
  });
}

// ============================================================
// HELPER: Tabel data
// ============================================================

function isAduanAktif_(d) {
  return d.status !== 'Selesai' && d.status !== 'Batal';
}

function getSlaInfo_(d, now) {
  var umurJam = d.waktuMasuk ? (now - d.waktuMasuk) / 3600000 : 0;
  var slaJam = Number(d.slaJam || 0);
  var remainingHours = Math.max(0, slaJam - umurJam);
  var overdueHours = Math.max(0, umurJam - slaJam);
  var overdue = slaJam > 0 && umurJam > slaJam;
  var warningLimit = slaJam * (CONFIG.FOCUS_SLA_PERCENT || 0.25);
  var nearDeadline = !overdue && slaJam > 0 && remainingHours <= warningLimit;

  return {
    umurJam: umurJam,
    slaJam: slaJam,
    remainingHours: remainingHours,
    overdueHours: overdueHours,
    overdue: overdue,
    nearDeadline: nearDeadline
  };
}

function isFokusPenanganan_(d, now, todayStr) {
  if (!isAduanAktif_(d)) return false;
  if (!d.waktuMasuk) return false;

  var sla = getSlaInfo_(d, now);
  var isHighPriority = d.prioritas === 'Darurat' || d.prioritas === 'Tinggi';
  var isOldActive = formatDateStr(d.waktuMasuk) !== todayStr;

  // Masuk Fokus Penanganan jika:
  // 1. Sudah lewat SLA
  // 2. Sisa SLA hampir habis, default <= 25% dari SLA
  // 3. Prioritas Darurat/Tinggi
  // 4. Aduan aktif lama, bukan tanggal hari ini
  return sla.overdue || sla.nearDeadline || isHighPriority || isOldActive;
}

function mapAduanRow_(d, now, includeSla) {
  var sla = getSlaInfo_(d, now);
  var slaStatus = sla.overdue ? 'Lewat' : 'Aman';

  return {
    id: d.id,
    waktu: formatDisplayDate(d.waktuMasuk),
    cabang: d.cabang,
    wilayah: d.wilayah,
    namaPelanggan: d.namaPelanggan,
    noPelanggan: d.noPelanggan,
    noHp: d.noHp,
    jenis: d.jenisGangguan,
    sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
    prioritas: d.prioritas,
    status: d.status,
    slaStatus: slaStatus,
    // Kalau belum lewat, tetap tampil seperti logic lama: 0.3 jam, 2.1 jam, dst.
    // Kalau lewat, tampil dinamis: Lewat 10 menit / Lewat 1 jam 20 menit / Lewat 2 hari 3 jam.
    sisaSLA: slaStatus === 'Aman'
      ? Math.round(sla.remainingHours * 10) / 10 + ' jam'
      : 'Lewat ' + formatDurasiSla_(sla.overdueHours),
    unit: d.unit,
    keterangan: d.keterangan ? String(d.keterangan).substring(0, 100) : ''
  };
}

function getTabelFokus(data, now) {
  now = now || new Date();
  var cutoff24Jam = new Date(now.getTime() - 24 * 3600 * 1000);

  var fokus = data.filter(function(d) {
    if (d.status === 'Selesai' || d.status === 'Batal') return false;
    if (!d.waktuMasuk) return false;

    var slaInfo = getSlaInfo_(d, now);
    var isDarurat = d.prioritas === 'Darurat' || d.prioritas === 'Tinggi';
    var isSLALewat = slaInfo.overdue;
    var isNearDeadline = slaInfo.nearDeadline;
    var sudahLebih24Jam = d.waktuMasuk < cutoff24Jam;

    // Aturan Fokus Penanganan:
    // 1. Prioritas Darurat/Tinggi
    // 2. Sudah lewat SLA
    // 3. Hampir lewat SLA: sisa SLA <= CONFIG.FOCUS_SLA_PERCENT
    // 4. Aduan aktif sudah lebih dari 24 jam
    return isDarurat || isSLALewat || isNearDeadline || sudahLebih24Jam;
  });

  // Sort lebih tajam:
  // Darurat/Tinggi tetap di atas, lalu yang sudah lewat SLA,
  // lalu yang hampir lewat SLA, lalu aduan paling lama.
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
    var slaInfo = getSlaInfo_(d, now);
    var slaStatus = slaInfo.overdue ? 'Lewat' : 'Aman';

    var alasanFokus = '';
    if (d.prioritas === 'Darurat') {
      alasanFokus = '🔴 Darurat';
    } else if (d.prioritas === 'Tinggi') {
      alasanFokus = '🟠 Prioritas Tinggi';
    } else if (slaInfo.overdue) {
      alasanFokus = '⏱ SLA Lewat';
    } else if (slaInfo.nearDeadline) {
      alasanFokus = '⚠ Hampir Lewat SLA';
    } else {
      alasanFokus = '📅 > 24 Jam';
    }

    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noPelanggan: d.noPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
      prioritas: d.prioritas,
      status: d.status,
      slaStatus: slaStatus,
      sisaSLA: slaStatus === 'Aman'
        ? Math.round(slaInfo.remainingHours * 10) / 10 + ' jam'
        : 'Lewat ' + formatDurasiSla_(slaInfo.overdueHours),
      alasanFokus: alasanFokus,
      unit: d.unit,
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 100) : ''
    };
  });
}


function formatDurasiSla_(hours) {
  var totalMinutes = Math.max(1, Math.round(Math.abs(Number(hours || 0)) * 60));

  var days = Math.floor(totalMinutes / 1440);
  var remainingAfterDays = totalMinutes % 1440;
  var jam = Math.floor(remainingAfterDays / 60);
  var menit = remainingAfterDays % 60;

  if (days > 0) {
    if (jam > 0) return days + ' hari ' + jam + ' jam';
    return days + ' hari';
  }

  if (jam > 0) {
    if (menit > 0) return jam + ' jam ' + menit + ' menit';
    return jam + ' jam';
  }

  return menit + ' menit';
}

function getTabelTerbaru(data) {
  var sorted = data.filter(function(d) {
    return d.status !== 'Selesai' && d.status !== 'Batal';
  }).sort(function(a, b) {
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  });

  return sorted.slice(0, 100).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noPelanggan: d.noPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit
    };
  });
}


function getTabelSelesai(data) {
  var sorted = data.filter(function(d) {
    return d.status === 'Selesai';
  }).sort(function(a, b) {
    return (b.waktuSelesai || b.waktuMasuk || 0) - (a.waktuSelesai || a.waktuMasuk || 0);
  });

  return sorted.slice(0, 100).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      waktuSelesai: formatDisplayDate(d.waktuSelesai),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noPelanggan: d.noPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit,
      catatan: d.catatan ? String(d.catatan).substring(0, 100) : ''
    };
  });
}

function getLaporanDetail(data, fromDate) {
  return data.filter(function(d) {
    return d.waktuMasuk && d.waktuMasuk >= fromDate;
  }).sort(function(a, b) {
    if (a.cabang !== b.cabang) return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  }).slice(0, 500).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noPelanggan: d.noPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      sumberAduan: d.sumberAduan || getAduanSumberLabel_(d.catatan || ''),
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit,
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 120) : ''
    };
  });
}

function getEmptyData() {
  return {
    success: true,
    lastUpdate: new Date().toLocaleString('id-ID'),
    cards: { aduanHariIni: 0, aduanAktif: 0, lewatSLA: 0, selesaiHariIni: 0 },
    sidebar: { aduanBulanIni: 0, prioritasTinggi: 0, lewatSLA: 0 },
    charts: {
      tren7Hari: { labels: [], data: [] },
      tren7HariCabang: { labels: [], datasets: [] },
      statusCount: { 'Baru': 0, 'Proses': 0, 'Selesai': 0, 'Ditunda': 0, 'Batal': 0 },
      jenisCount: [],
      cabangRanking: [],
      cabangSpeedRanking: []
    },
    tables: { fokus: [], terbaru: [], selesai: [], laporanDetail: [] },
    meta: { cabangList: CONFIG.CABANG, wilayahList: CONFIG.WILAYAH }
  };
}

// ============================================================
// MENU: Buka Dashboard
// ============================================================
function openDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  var ui = SpreadsheetApp.getUi();

  var url = '';
  if (settingsSheet) {
    url = settingsSheet.getRange('B4').getValue();
  }

  if (!url) {
    ui.alert(
      '⚠️ URL Dashboard Belum Diatur',
      'Silakan deploy Web App terlebih dahulu, lalu:\n' +
      '1. Buka sheet SETTINGS\n' +
      '2. Isi URL Dashboard di baris B4\n' +
      '3. Coba lagi menu ini',
      ui.ButtonSet.OK
    );
    return;
  }

  var htmlOutput = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '"); google.script.host.close();</script>'
  ).setWidth(10).setHeight(10);
  ui.showModalDialog(htmlOutput, 'Membuka Dashboard...');
}

// ============================================================
// MENU: Tambah Data Contoh
// ============================================================
function addSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var ui = SpreadsheetApp.getUi();

  if (!sheet) {
    ui.alert('Sheet ADUAN tidak ditemukan. Jalankan Setup terlebih dahulu.');
    return;
  }

  var now = new Date();
  var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  var twoDaysAgo = new Date(now); twoDaysAgo.setDate(now.getDate() - 2);

  var samples = [
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0001', now, 'Cabang Praya', 'Praya', 'Desa Praya', 'Ahmad Fauzi', '081234567890', 'Air Mati', 'Darurat', 'Proses', 'Teknik', 'Air mati sejak subuh, seluruh kompleks terdampak', '', '', 2, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0002', now, 'Cabang Pujut', 'Pujut', 'Dusun Selong', 'Siti Rahayu', '081234567891', 'Tekanan Rendah', 'Tinggi', 'Baru', 'Distribusi', 'Tekanan sangat rendah, air hanya mengalir malam hari', '', '', 4, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0003', now, 'Cabang Jonggat', 'Jonggat', 'Desa Bonder', 'Hasan Basri', '081234567892', 'Pipa Bocor', 'Tinggi', 'Proses', 'Teknik', 'Pipa bocor di jalan utama, air menggenang di jalan', '', '', 4, now],
    ['ADU-' + formatDateStr(yesterday).replace(/-/g,'') + '-0001', yesterday, 'Cabang Batukliang', 'Batukliang', 'Desa Batukliang', 'Maria Ulfa', '081234567893', 'Air Keruh', 'Sedang', 'Selesai', 'Produksi', 'Air berwarna kuning kecoklatan setelah hujan deras', now, now, 8, now],
    ['ADU-' + formatDateStr(yesterday).replace(/-/g,'') + '-0002', yesterday, 'Cabang Praya Barat', 'Praya Barat', 'Desa Mangkung', 'Zainal Arifin', '081234567894', 'Meter Bermasalah', 'Rendah', 'Proses', 'Hublang', 'Meter air rusak, angka tidak bergerak padahal air mengalir', '', '', 24, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0001', twoDaysAgo, 'Cabang Kopang', 'Kopang', 'Desa Kopang', 'Nurul Hidayah', '081234567895', 'Air Mati', 'Darurat', 'Selesai', 'Teknik', 'Pompa rusak, distribusi terganggu 6 jam', now, now, 2, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0002', twoDaysAgo, 'Cabang Janapria', 'Janapria', 'Desa Janapria', 'Supardi', '081234567896', 'Tagihan', 'Rendah', 'Ditunda', 'Hublang', 'Tagihan bulan ini tidak sesuai pemakaian', '', '', 24, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0004', now, 'Cabang Praya Timur', 'Praya Timur', 'Desa Sukarara', 'Dewi Anggraini', '081234567897', 'Sambungan Baru', 'Sedang', 'Baru', 'Cabang', 'Permohonan sambungan baru untuk rumah baru', '', '', 8, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0005', now, 'Cabang Pringgarata', 'Pringgarata', 'Desa Pringgarata', 'Rudi Hartono', '081234567898', 'Pipa Bocor', 'Darurat', 'Baru', 'Teknik', 'Pipa induk bocor besar, banyak pelanggan terdampak', '', '', 2, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0003', twoDaysAgo, 'Cabang Batukliang Utara', 'Batukliang Utara', 'Desa Teratak', 'Lalu Muhamad', '081234567899', 'Tekanan Rendah', 'Sedang', 'Batal', 'Distribusi', 'Setelah dicek tekanan normal, kemungkinan instalasi dalam rumah bermasalah', '', '', 8, now]
  ];

  var startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, 1, samples.length, samples[0].length).setValues(samples);

  // Format kolom tersembunyi
  sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);

  formatSheet();
  ui.alert('✅ ' + samples.length + ' data contoh berhasil ditambahkan!');
}

// ============================================================
// MENU: Rapikan Sheet
// ============================================================
