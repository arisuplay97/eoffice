// ============================================================
// SIAGA TIARA V10.9.214 - KODE DIPECAH / MODUL: 08_Admin_Petugas_Notifikasi.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

// V10.9.50 - MENU ADMIN PUSAT & PENGUMUMAN VIA WHATSAPP
// ============================================================

function buildAdminMainMenuReply_(admin) {
  admin = admin || {};
  return [
    '👨‍💼 *Menu Admin SIAGA TIARA*',
    '',
    'Halo, *' + (admin.nama || 'Admin') + '*.',
    'Akses: *Semua Cabang*',
    '',
    'Silakan pilih menu:',
    '1. Semua Aduan Aktif',
    '2. Aduan per Cabang',
    '3. Cari Aduan by ID',
    '4. Rekap Hari Ini',
    '5. Kelola Pengumuman',
    '6. Menu Admin'
  ].join('\n');
}

function handleAdminWhatsAppMessage_(message, phone, payload, admin, session) {
  message = String(message || '').trim();
  phone = normalizePhone_(phone || '');
  payload = payload || {};
  admin = admin || {};
  session = session || getWhatsAppSession_(phone);

  var lower = message.toLowerCase();

  // Prefix dari tombol detail aduan tetap diarahkan ke fitur petugas yang sudah ada.
  if (lower.indexOf('petugas update ') === 0) {
    var updateId = normalizeAduanIdHyphen_(message.substring(message.toLowerCase().indexOf('petugas update ') + 'petugas update '.length));
    return handlePetugasSelectAduanForUpdate_(phone, admin, updateId);
  }

  if (lower.indexOf('petugas foto ') === 0 && lower.indexOf('petugas foto jenis ') !== 0) {
    var fotoId = normalizeAduanIdHyphen_(message.substring(message.toLowerCase().indexOf('petugas foto ') + 'petugas foto '.length));
    return handlePetugasSelectAduanForFoto_(phone, admin, fotoId);
  }

  if (lower === 'petugas menu') {
    return {
      success: true,
      type: 'PETUGAS_MENU_FOR_ADMIN',
      reply: buildPetugasMainMenuReply_(admin),
      petugasMenu: true,
      petugas: admin
    };
  }

  // V10.9.53 - tombol pagination admin.
  // Jika provider hanya mengirim title tombol, session terakhir dipakai sebagai konteks.
  if (session && (lower === 'berikutnya' || lower.indexOf('berikutnya') !== -1 || lower === 'next' || lower === 'lanjut')) {
    if (session.state === 'ADMIN_LIST_ALL') {
      var nextAllPage = Number((session.data && session.data.page) || 1) + 1;
      return handleAdminAllPage_(phone, admin, nextAllPage);
    }
    if (session.state === 'ADMIN_LIST_CABANG') {
      var nextCabangPage = Number((session.data && session.data.page) || 1) + 1;
      return handleAdminCabangPage_(phone, admin, (session.data && session.data.cabang) || '', nextCabangPage);
    }
  }

  if (session && (lower === 'sebelumnya' || lower.indexOf('sebelumnya') !== -1 || lower === 'prev' || lower === 'back page')) {
    if (session.state === 'ADMIN_LIST_ALL') {
      var prevAllPage = Math.max(1, Number((session.data && session.data.page) || 1) - 1);
      return handleAdminAllPage_(phone, admin, prevAllPage);
    }
    if (session.state === 'ADMIN_LIST_CABANG') {
      var prevCabangPage = Math.max(1, Number((session.data && session.data.page) || 1) - 1);
      return handleAdminCabangPage_(phone, admin, (session.data && session.data.cabang) || '', prevCabangPage);
    }
  }

  if (lower.indexOf('admin semua page ') === 0) {
    var allPageNum = Number(lower.replace('admin semua page ', '').replace(/[^0-9]/g, '')) || 1;
    return handleAdminAllPage_(phone, admin, allPageNum);
  }

  if (lower.indexOf('admin cabang page ') === 0) {
    var cabangPageText = message.substring(message.toLowerCase().indexOf('admin cabang page ') + 'admin cabang page '.length).trim();
    var cabangPageParts2 = cabangPageText.split(/\s+/);
    var cabangPageNum2 = Number(cabangPageParts2.pop()) || 1;
    var cabangPageCode2 = cabangPageParts2.join(' ');
    return handleAdminCabangPage_(phone, admin, cabangPageCode2, cabangPageNum2);
  }

  // Session submenu pengumuman (fallback jika list/menu interaktif gagal atau user balas angka).
  if (session && session.state === 'ADMIN_MENU_PENGUMUMAN') {
    if (lower === '1') {
      return { success: true, type: 'ADMIN_PENGUMUMAN_AKTIF', reply: buildActivePengumumanAdminReply_(), adminPengumumanMenu: true };
    }
    if (lower === '2') {
      setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_TITLE', {});
      return { success: true, type: 'ADMIN_PENGUMUMAN_ASK_TITLE', reply: 'Ketik *judul pengumuman*.\n\nContoh: Perbaikan Jaringan Praya Tengah' };
    }
    if (lower === '3') {
      var editChoicesMenu = listActivePengumumanRows_(10);
      if (!editChoicesMenu.length) {
        return { success: true, type: 'ADMIN_PENGUMUMAN_EDIT_EMPTY', reply: 'Tidak ada pengumuman aktif yang bisa diedit.', adminPengumumanMenu: true };
      }
      setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_EDIT_SELECT', { choices: editChoicesMenu });
      return { success: true, type: 'ADMIN_PENGUMUMAN_EDIT_LIST', reply: 'Pilih pengumuman yang ingin diedit.', adminPengumumanEditMenu: true, editRows: editChoicesMenu };
    }
    if (lower === '4') {
      var countMenu = nonaktifkanSemuaPengumumanAktif_();
      return { success: true, type: 'ADMIN_PENGUMUMAN_NONAKTIF', reply: '✅ ' + countMenu + ' pengumuman aktif berhasil dinonaktifkan.', adminPengumumanMenu: true };
    }
    if (lower === '5') {
      clearWhatsAppSession_(phone);
      return { success: true, type: 'ADMIN_MENU', reply: buildAdminMainMenuReply_(admin), adminMenu: true, petugas: admin };
    }
  }

  // Session cari ID.
  if (session && session.state === 'ADMIN_AWAIT_ID') {
    var searchedId = extractAduanId_(message);
    if (!searchedId) {
      return {
        success: false,
        type: 'ADMIN_CARI_ID_INVALID',
        reply: 'Mohon ketik ID aduan yang benar.\n\nContoh: *PRY7K2A*',
        navButtons: [
          { id: 'ADMIN_CARI', title: 'Cari Lagi' },
          { id: 'ADMIN_MENU', title: 'Menu Admin' }
        ]
      };
    }

    clearWhatsAppSession_(phone);
    return handleAdminShowAduanById_(phone, admin, searchedId);
  }

  // Session edit pengumuman.
  if (session && session.state === 'ADMIN_PENGUMUMAN_EDIT_SELECT') {
    var selected = resolveAdminPengumumanChoiceFromSession_(message, session.data || {});
    if (!selected || !selected.row) {
      return {
        success: false,
        type: 'ADMIN_PENGUMUMAN_EDIT_SELECT_INVALID',
        reply: 'Pilihan pengumuman belum dikenali. Silakan pilih dari daftar atau ketik nomor urutnya.',
        adminPengumumanEditMenu: true,
        editRows: (session.data && session.data.choices) || []
      };
    }

    return startAdminEditPengumumanByRow_(phone, selected.row);
  }

  if (session && session.state === 'ADMIN_PENGUMUMAN_EDIT_TITLE') {
    var editTitleData = session.data || {};
    if (!message) {
      return { success: false, type: 'ADMIN_PENGUMUMAN_EDIT_TITLE_INVALID', reply: 'Judul tidak boleh kosong. Ketik judul baru atau ketik *lewati*.' };
    }

    if (['lewati', 'skip', '-'].indexOf(lower) !== -1) {
      editTitleData.newJudul = editTitleData.currentJudul || '';
    } else {
      editTitleData.newJudul = message;
    }

    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_EDIT_ISI', editTitleData);
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_EDIT_ASK_ISI',
      reply: [
        'Sekarang ketik *isi pengumuman baru*.',
        '',
        'Ketik *lewati* jika isi lama tetap dipakai.',
        '',
        'Isi saat ini:',
        String(editTitleData.currentIsi || '').substring(0, 500)
      ].join('\n')
    };
  }

  if (session && session.state === 'ADMIN_PENGUMUMAN_EDIT_ISI') {
    var editIsiData = session.data || {};
    if (!message) {
      return { success: false, type: 'ADMIN_PENGUMUMAN_EDIT_ISI_INVALID', reply: 'Isi pengumuman tidak boleh kosong. Ketik isi baru atau ketik *lewati*.' };
    }

    if (['lewati', 'skip', '-'].indexOf(lower) !== -1) {
      editIsiData.newIsi = editIsiData.currentIsi || '';
    } else {
      editIsiData.newIsi = message;
    }

    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_EDIT_DURASI', editIsiData);
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_EDIT_ASK_DURASI',
      reply: [
        'Ketik *durasi aktif baru* dalam jam. Contoh: *24*',
        '',
        'Ketik *lewati* jika waktu aktif lama tetap dipakai.',
        'Ketik *tanpa batas* jika ingin mengosongkan tanggal selesai.'
      ].join('\n')
    };
  }

  if (session && session.state === 'ADMIN_PENGUMUMAN_EDIT_DURASI') {
    var editDurasiData = session.data || {};
    var durasiEditText = String(message || '').trim().toLowerCase();
    var newSelesai = editDurasiData.currentSelesai || '';

    if (['lewati', 'skip', '-'].indexOf(durasiEditText) !== -1) {
      newSelesai = editDurasiData.currentSelesai || '';
    } else if (['tanpa batas', 'aktif terus', 'tanpa', 'nol', '0'].indexOf(durasiEditText) !== -1) {
      newSelesai = '';
    } else {
      var editHours = Number(durasiEditText.replace(/[^0-9]/g, ''));
      if (!(editHours > 0)) {
        return {
          success: false,
          type: 'ADMIN_PENGUMUMAN_EDIT_DURASI_INVALID',
          reply: 'Durasi belum valid. Ketik angka jam, contoh *24*, atau ketik *lewati* / *tanpa batas*.'
        };
      }
      newSelesai = new Date(new Date().getTime() + editHours * 60 * 60 * 1000);
    }

    clearWhatsAppSession_(phone);
    var updated = updatePengumumanRowFromAdmin_(editDurasiData.row, {
      judul: editDurasiData.newJudul || editDurasiData.currentJudul || '',
      isi: editDurasiData.newIsi || editDurasiData.currentIsi || '',
      selesai: newSelesai
    }, admin);

    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_EDIT_SAVED',
      reply: [
        '✅ Pengumuman berhasil diperbarui.',
        '',
        'Judul: *' + updated.judul + '*',
        updated.selesai ? ('Aktif sampai: ' + formatDateForWa_(updated.selesai)) : 'Aktif sampai: dinonaktifkan manual / tanpa batas',
        '',
        'Perubahan langsung sinkron ke sheet *PENGUMUMAN*.'
      ].join('\n'),
      adminPengumumanMenu: true
    };
  }

  // Session buat pengumuman.
  if (session && session.state === 'ADMIN_PENGUMUMAN_TITLE') {
    if (!message || message.length < 3) {
      return {
        success: false,
        type: 'ADMIN_PENGUMUMAN_TITLE_INVALID',
        reply: 'Judul terlalu pendek. Ketik judul pengumuman minimal 3 karakter.'
      };
    }

    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_ISI', { judul: message });
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_ASK_ISI',
      reply: 'Baik. Sekarang ketik *isi pengumuman* yang akan ditampilkan sebelum Menu Utama.'
    };
  }

  if (session && session.state === 'ADMIN_PENGUMUMAN_ISI') {
    if (!message || message.length < 8) {
      return {
        success: false,
        type: 'ADMIN_PENGUMUMAN_ISI_INVALID',
        reply: 'Isi pengumuman terlalu pendek. Mohon ketik isi pengumuman lebih jelas.'
      };
    }

    var dataIsi = session.data || {};
    dataIsi.isi = message;
    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_DURASI', dataIsi);

    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_ASK_DURASI',
      reply: [
        'Pengumuman siap dibuat.',
        '',
        'Ketik durasi aktif dalam jam.',
        'Contoh: *24* untuk aktif 24 jam.',
        '',
        'Ketik *lewati* jika ingin aktif terus sampai dinonaktifkan manual.'
      ].join('\n')
    };
  }

  if (session && session.state === 'ADMIN_PENGUMUMAN_DURASI') {
    var dataDurasi = session.data || {};
    var durasiText = String(message || '').trim().toLowerCase();
    var hours = Number(durasiText.replace(/[^0-9]/g, ''));
    var selesai = '';

    if (hours && hours > 0) {
      selesai = new Date(new Date().getTime() + hours * 60 * 60 * 1000);
    } else if (['lewati', 'skip', '-', 'tanpa batas', 'aktif terus'].indexOf(durasiText) === -1) {
      return {
        success: false,
        type: 'ADMIN_PENGUMUMAN_DURASI_INVALID',
        reply: 'Durasi belum valid. Ketik angka jam, contoh *24*, atau ketik *lewati*.'
      };
    }

    clearWhatsAppSession_(phone);
    var created = createPengumumanFromAdmin_(dataDurasi.judul, dataDurasi.isi, selesai, admin);

    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_CREATED',
      reply: [
        '✅ Pengumuman berhasil dibuat dan diaktifkan.',
        '',
        'Judul: *' + created.judul + '*',
        selesai ? ('Aktif sampai: ' + formatDateForWa_(selesai)) : 'Aktif sampai: dinonaktifkan manual',
        '',
        'Pengumuman akan tampil sebelum Menu Utama sesuai pengaturan repeat/cooldown.'
      ].join('\n'),
      adminMenu: true,
      petugas: admin
    };
  }

  // Menu utama admin.
  if (
    lower === 'admin menu' ||
    lower === 'menu' ||
    lower === 'menu utama' ||
    lower === 'halo' ||
    lower === 'hallo' ||
    lower === 'hi' ||
    lower === 'start' ||
    lower === '/start' ||
    lower === '6'
  ) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'ADMIN_MENU',
      reply: buildAdminMainMenuReply_(admin),
      adminMenu: true,
      petugas: admin
    };
  }

  if (lower === '1' || lower === 'admin semua' || lower.indexOf('semua aduan') !== -1) {
    return handleAdminAllPage_(phone, admin, 1);
  }

  if (lower === '2' || lower === 'admin cabang' || lower.indexOf('aduan per cabang') !== -1) {
    setWhatsAppSession_(phone, 'ADMIN_SELECT_CABANG', {});
    return {
      success: true,
      type: 'ADMIN_SELECT_CABANG',
      reply: 'Pilih cabang yang ingin dilihat.',
      adminCabangMenu: true
    };
  }

  if (lower.indexOf('admin cabang ') === 0) {
    var cabangText = message.substring(message.toLowerCase().indexOf('admin cabang ') + 'admin cabang '.length);
    return handleAdminCabangChoice_(phone, admin, cabangText);
  }

  if (session && session.state === 'ADMIN_SELECT_CABANG') {
    var maybeCabang = resolveAdminCabangChoice_(message);
    if (maybeCabang) {
      clearWhatsAppSession_(phone);
      return handleAdminCabangChoice_(phone, admin, maybeCabang);
    }
  }

  if (lower === '3' || lower === 'admin cari' || lower.indexOf('cari aduan') !== -1 || lower.indexOf('cari id') !== -1) {
    setWhatsAppSession_(phone, 'ADMIN_AWAIT_ID', {});
    return {
      success: true,
      type: 'ADMIN_ASK_ID',
      reply: 'Ketik ID aduan yang ingin dicari.\n\nContoh: *PRY7K2A*',
      navButtons: [
        { id: 'ADMIN_MENU', title: 'Menu Admin' }
      ]
    };
  }

  if (lower === '4' || lower === 'admin rekap' || lower.indexOf('rekap hari ini') !== -1) {
    return {
      success: true,
      type: 'ADMIN_REKAP_HARI_INI',
      reply: buildAdminRekapHariIniReply_(admin),
      navButtons: [
        { id: 'ADMIN_ALL', title: 'Semua Aduan' },
        { id: 'ADMIN_CABANG', title: 'Per Cabang' },
        { id: 'ADMIN_MENU', title: 'Menu Admin' }
      ]
    };
  }

  if (lower === '5' || lower === 'admin pengumuman' || lower.indexOf('kelola pengumuman') !== -1) {
    setWhatsAppSession_(phone, 'ADMIN_MENU_PENGUMUMAN', {});
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_MENU',
      reply: buildAdminPengumumanMenuReply_(),
      adminPengumumanMenu: true
    };
  }

  if (lower === 'admin pengumuman lihat' || lower.indexOf('lihat pengumuman aktif') !== -1) {
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_AKTIF',
      reply: buildActivePengumumanAdminReply_(),
      adminPengumumanMenu: true
    };
  }

  if (lower === 'admin pengumuman buat' || lower.indexOf('buat pengumuman') !== -1) {
    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_TITLE', {});
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_ASK_TITLE',
      reply: 'Ketik *judul pengumuman*.\n\nContoh: Perbaikan Jaringan Praya Tengah'
    };
  }

  if (lower === 'admin pengumuman edit' || lower.indexOf('edit pengumuman') !== -1) {
    var editChoices = listActivePengumumanRows_(10);
    if (!editChoices.length) {
      return {
        success: true,
        type: 'ADMIN_PENGUMUMAN_EDIT_EMPTY',
        reply: 'Tidak ada pengumuman aktif yang bisa diedit.',
        adminPengumumanMenu: true
      };
    }

    setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_EDIT_SELECT', { choices: editChoices });
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_EDIT_LIST',
      reply: 'Pilih pengumuman yang ingin diedit.',
      adminPengumumanEditMenu: true,
      editRows: editChoices
    };
  }

  if (lower.indexOf('admin pengumuman edit row ') === 0) {
    var rowNum = Number(message.substring(message.toLowerCase().indexOf('admin pengumuman edit row ') + 'admin pengumuman edit row '.length).replace(/[^0-9]/g, ''));
    if (rowNum > 0) return startAdminEditPengumumanByRow_(phone, rowNum);
  }

  if (lower === 'admin pengumuman nonaktif' || lower.indexOf('nonaktifkan pengumuman') !== -1) {
    var count = nonaktifkanSemuaPengumumanAktif_();
    return {
      success: true,
      type: 'ADMIN_PENGUMUMAN_NONAKTIF',
      reply: '✅ ' + count + ' pengumuman aktif berhasil dinonaktifkan.',
      adminPengumumanMenu: true
    };
  }

  var directId = extractAduanId_(message);
  if (directId) {
    return handleAdminShowAduanById_(phone, admin, directId);
  }

  return {
    success: true,
    type: 'ADMIN_MENU',
    reply: buildAdminMainMenuReply_(admin),
    adminMenu: true,
    petugas: admin
  };
}

function sendKiriminAdminMenu_(phone, admin) {
  var rows = [
    { id: 'ADMIN_ALL', title: 'Semua Aduan Aktif', description: 'Pantau semua cabang' },
    { id: 'ADMIN_CABANG', title: 'Aduan per Cabang', description: 'Pilih cabang tertentu' },
    { id: 'ADMIN_CARI', title: 'Cari Aduan by ID', description: 'Cari cepat berdasarkan ID' },
    { id: 'ADMIN_REKAP', title: 'Rekap Hari Ini', description: 'Ringkasan aduan hari ini' },
    { id: 'ADMIN_PENGUMUMAN', title: 'Kelola Pengumuman', description: 'Lihat/buat/nonaktifkan pengumuman' },
    { id: 'ADMIN_MENU', title: 'Menu Admin', description: 'Buka ulang menu admin' }
  ];

  return sendKiriminGenericListMenu_(
    phone,
    buildAdminMainMenuReply_(admin),
    'Pilih Menu',
    'Menu Admin',
    rows
  );
}

function sendKiriminAdminCabangMenu_(phone) {
  var rows = Object.keys(CABANG_CODE || {})
    .filter(function(cabang) { return cabang !== 'Cabang Lainnya'; })
    .map(function(cabang) {
      var code = CABANG_CODE[cabang] || cabang;
      return {
        id: 'ADMIN_CABANG_' + code,
        title: String(code + ' - ' + cabang.replace(/^Cabang\s+/i, '')).substring(0, 24),
        description: 'Lihat aduan aktif ' + cabang
      };
    })
    .slice(0, 10);

  // List WhatsApp maksimal 10 row, jadi cabang sisanya tetap bisa diketik manual.
  return sendKiriminGenericListMenu_(
    phone,
    'Pilih cabang yang ingin dilihat.\n\nJika cabang tidak muncul, ketik nama/kode cabang manual. Contoh: *PBD* atau *Cabang Praya Barat Daya*.',
    'Pilih Cabang',
    'Cabang',
    rows
  );
}

function sendKiriminAdminPengumumanMenu_(phone) {
  var rows = [
    { id: 'ADMIN_PENGUMUMAN_LIHAT', title: 'Lihat Aktif', description: 'Lihat pengumuman yang aktif' },
    { id: 'ADMIN_PENGUMUMAN_BUAT', title: 'Buat Baru', description: 'Buat pengumuman via WA' },
    { id: 'ADMIN_PENGUMUMAN_EDIT', title: 'Edit Pengumuman', description: 'Ubah judul / isi / durasi' },
    { id: 'ADMIN_PENGUMUMAN_NONAKTIF', title: 'Nonaktifkan', description: 'Nonaktifkan semua pengumuman aktif' },
    { id: 'ADMIN_MENU', title: 'Menu Admin', description: 'Kembali ke menu admin' }
  ];

  return sendKiriminGenericListMenu_(
    phone,
    buildAdminPengumumanMenuReply_(),
    'Pilih Aksi',
    'Pengumuman',
    rows
  );
}


function sendKiriminAdminPengumumanEditMenu_(phone, rowsData) {
  rowsData = rowsData || [];
  var rows = rowsData.slice(0, 10).map(function(item, idx) {
    var title = String((idx + 1) + '. ' + (item.judul || 'Tanpa Judul')).substring(0, 24);
    var desc = item.isi ? String(item.isi).substring(0, 72) : 'Pilih untuk edit pengumuman';
    return {
      id: 'ADMIN_PENGUMUMAN_EDIT_ROW_' + item.row,
      title: title,
      description: desc
    };
  });

  return sendKiriminGenericListMenu_(
    phone,
    'Pilih pengumuman aktif yang ingin diedit. Anda juga bisa ketik nomor urutnya jika daftar sudah tampil.',
    'Pilih Pengumuman',
    'Edit Pengumuman',
    rows
  );
}

function listActivePengumumanRows_(limit) {
  limit = Number(limit || 10);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, 6).getValues();
  var now = new Date();
  var list = [];

  values.forEach(function(row, idx) {
    var status = String(row[0] || '').trim().toUpperCase();
    var judul = String(row[1] || '').trim();
    var isi = String(row[2] || '').trim();
    var mulai = parsePengumumanDate_(row[3], false);
    var selesai = parsePengumumanDate_(row[4], true);

    if (!isi) return;
    if (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) === -1) return;
    if (mulai && now < mulai) return;
    if (selesai && now > selesai) return;

    list.push({
      row: idx + 2,
      judul: judul || 'Tanpa Judul',
      isi: isi,
      mulai: mulai || row[3] || '',
      selesai: selesai || row[4] || ''
    });
  });

  return list.slice(0, limit);
}

function resolveAdminPengumumanChoiceFromSession_(message, data) {
  message = String(message || '').trim();
  data = data || {};
  var choices = data.choices || [];
  if (!choices.length) return null;

  var idx = Number(message.replace(/[^0-9]/g, ''));
  if (idx > 0 && idx <= choices.length) return choices[idx - 1];

  var lower = message.toLowerCase();
  for (var i = 0; i < choices.length; i++) {
    if (String(choices[i].judul || '').toLowerCase() === lower) return choices[i];
    if (String(choices[i].judul || '').toLowerCase().indexOf(lower) !== -1 && lower.length >= 4) return choices[i];
  }
  return null;
}

function getPengumumanRowData_(rowNum) {
  rowNum = Number(rowNum || 0);
  if (!(rowNum >= 2)) return null;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || rowNum > safeGetLastRow_(sh)) return null;

  var row = sh.getRange(rowNum, 1, 1, 6).getValues()[0];
  return {
    row: rowNum,
    status: String(row[0] || '').trim(),
    judul: String(row[1] || '').trim(),
    isi: String(row[2] || '').trim(),
    mulai: parsePengumumanDate_(row[3], false) || row[3] || '',
    selesai: parsePengumumanDate_(row[4], true) || row[4] || '',
    urutan: row[5] || ''
  };
}

function startAdminEditPengumumanByRow_(phone, rowNum) {
  var item = getPengumumanRowData_(rowNum);
  if (!item || !item.isi) {
    return {
      success: false,
      type: 'ADMIN_PENGUMUMAN_EDIT_NOT_FOUND',
      reply: 'Pengumuman tidak ditemukan atau tidak bisa diedit.',
      adminPengumumanMenu: true
    };
  }

  setWhatsAppSession_(phone, 'ADMIN_PENGUMUMAN_EDIT_TITLE', {
    row: item.row,
    currentJudul: item.judul,
    currentIsi: item.isi,
    currentSelesai: item.selesai || ''
  });

  return {
    success: true,
    type: 'ADMIN_PENGUMUMAN_EDIT_ASK_TITLE',
    reply: [
      '✏️ *Edit Pengumuman*',
      '',
      'Judul saat ini: *' + (item.judul || 'Tanpa Judul') + '*',
      '',
      'Ketik *judul baru*.',
      'Ketik *lewati* jika judul lama tetap dipakai.'
    ].join('\n')
  };
}

function updatePengumumanRowFromAdmin_(rowNum, data, admin) {
  rowNum = Number(rowNum || 0);
  data = data || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || !(rowNum >= 2) || rowNum > safeGetLastRow_(sh)) throw new Error('Row pengumuman tidak valid.');

  var existing = getPengumumanRowData_(rowNum);
  if (!existing) throw new Error('Pengumuman tidak ditemukan.');

  var judul = String(data.judul || existing.judul || '').trim();
  var isi = String(data.isi || existing.isi || '').trim();
  var selesai = data.selesai;
  if (typeof selesai === 'undefined') selesai = existing.selesai || '';

  sh.getRange(rowNum, 1, 1, 6).setValues([[
    'AKTIF',
    judul,
    isi,
    existing.mulai || new Date(),
    selesai || '',
    existing.urutan || 1
  ]]);

  invalidateActivePengumumanCache_();

  return { row: rowNum, judul: judul, isi: isi, selesai: selesai || '' };
}

function buildAdminPengumumanMenuReply_() {
  return [
    '📢 *Kelola Pengumuman*',
    '',
    '1. Lihat Pengumuman Aktif',
    '2. Buat Pengumuman Baru',
    '3. Edit Pengumuman',
    '4. Nonaktifkan Pengumuman',
    '5. Menu Admin',
    '',
    'Buat, edit, dan nonaktifkan pengumuman dari WA akan langsung sinkron ke sheet *PENGUMUMAN*.'
  ].join('\n');
}

function resolveAdminCabangChoice_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  var upper = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  var keys = Object.keys(CABANG_CODE || {});

  for (var i = 0; i < keys.length; i++) {
    var cabang = keys[i];
    var code = String(CABANG_CODE[cabang] || '').toUpperCase();
    if (upper === code) return cabang;
  }

  var normalized = normalizeCabangKey_(text);
  for (var j = 0; j < keys.length; j++) {
    var cabang2 = keys[j];
    if (normalizeCabangKey_(cabang2) === normalized) return cabang2;
    if (normalizeCabangKey_(cabang2).indexOf(normalized) !== -1 && normalized.length > 3) return cabang2;
  }

  return '';
}

function handleAdminCabangChoice_(phone, admin, cabangChoice) {
  return handleAdminCabangPage_(phone, admin, cabangChoice, 1);
}

function listActiveAduanByCabangForAdmin_(cabang, limit, offset) {
  cabang = String(cabang || '').trim();
  limit = Number(limit || 10);
  offset = Math.max(0, Number(offset || 0));

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || safeGetLastRow_(sh) < 2) return [];

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var list = [];
  var target = normalizeCabangKey_(cabang);
  var statusOrder = { 'Baru': 1, 'Proses': 2, 'Ditunda': 3 };

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id) return;
    var st = String(d.status || '').trim();
    if (st === 'Selesai' || st === 'Batal') return;
    if (normalizeCabangKey_(d.cabang) !== target) return;
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

function handleAdminAllPage_(phone, admin, page) {
  page = Math.max(1, Number(page || 1));
  var perPage = Number((CONFIG && CONFIG.ADMIN_ADUAN_PAGE_SIZE) || 10);
  if (!(perPage > 0)) perPage = 10;
  if (perPage > 10) perPage = 10; // jaga panjang chat dan batas tombol WA.

  var offset = (page - 1) * perPage;
  var listPlusOne = listActiveAduanForPetugas_(admin, perPage + 1, offset);
  var hasNext = listPlusOne.length > perPage;
  var visible = listPlusOne.slice(0, perPage);

  try {
    setWhatsAppSession_(phone, 'ADMIN_LIST_ALL', { page: page });
  } catch(e) {}

  return {
    success: true,
    type: 'ADMIN_ALL_ACTIVE_PAGE',
    reply: buildAdminAduanListReply_('Semua Cabang', visible, {
      page: page,
      start: offset + 1,
      perPage: perPage,
      hasNext: hasNext
    }),
    navButtons: buildAdminPaginationButtons_('ALL', page, hasNext, '')
  };
}

function handleAdminCabangPage_(phone, admin, cabangChoice, page) {
  page = Math.max(1, Number(page || 1));

  var cabang = resolveAdminCabangChoice_(cabangChoice) || cabangChoice;
  if (!cabang || !CABANG_CODE[cabang]) {
    return {
      success: false,
      type: 'ADMIN_CABANG_INVALID',
      reply: 'Cabang belum dikenali. Silakan pilih dari menu cabang atau ketik kode cabang, contoh *PRY*.',
      adminCabangMenu: true
    };
  }

  var perPage = Number((CONFIG && CONFIG.ADMIN_ADUAN_PAGE_SIZE) || 10);
  if (!(perPage > 0)) perPage = 10;
  if (perPage > 10) perPage = 10;

  var offset = (page - 1) * perPage;
  var listPlusOne = listActiveAduanByCabangForAdmin_(cabang, perPage + 1, offset);
  var hasNext = listPlusOne.length > perPage;
  var visible = listPlusOne.slice(0, perPage);

  try {
    setWhatsAppSession_(phone, 'ADMIN_LIST_CABANG', { page: page, cabang: cabang });
  } catch(e) {}

  return {
    success: true,
    type: 'ADMIN_CABANG_LIST_PAGE',
    reply: buildAdminAduanListReply_(cabang, visible, {
      page: page,
      start: offset + 1,
      perPage: perPage,
      hasNext: hasNext
    }),
    navButtons: buildAdminPaginationButtons_('CABANG', page, hasNext, cabang)
  };
}

function buildAdminPaginationButtons_(mode, page, hasNext, cabang) {
  mode = String(mode || 'ALL').toUpperCase();
  page = Math.max(1, Number(page || 1));
  hasNext = !!hasNext;

  var buttons = [];
  var cabangCode = '';
  if (cabang && CABANG_CODE && CABANG_CODE[cabang]) cabangCode = String(CABANG_CODE[cabang]);
  else cabangCode = String(cabang || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  function pageId(nextPage) {
    if (mode === 'CABANG') return 'ADMIN_CABANG_PAGE_' + cabangCode + '_' + nextPage;
    return 'ADMIN_ALL_PAGE_' + nextPage;
  }

  if (page > 1) buttons.push({ id: pageId(page - 1), title: 'Sebelumnya' });
  if (hasNext) buttons.push({ id: pageId(page + 1), title: 'Berikutnya' });

  if (buttons.length < 3 && page <= 1 && mode === 'ALL') {
    buttons.push({ id: 'ADMIN_CABANG', title: 'Per Cabang' });
  } else if (buttons.length < 3 && mode === 'CABANG') {
    buttons.push({ id: 'ADMIN_CABANG', title: 'Pilih Cabang' });
  }

  if (buttons.length < 3) buttons.push({ id: 'ADMIN_CARI', title: 'Cari ID' });
  if (buttons.length < 3) buttons.push({ id: 'ADMIN_MENU', title: 'Menu Admin' });

  return buttons.slice(0, 3);
}

function buildAdminAduanListReply_(scope, list, pageInfo) {
  scope = scope || 'Semua Cabang';
  list = list || [];
  pageInfo = pageInfo || {};

  var page = Math.max(1, Number(pageInfo.page || 1));
  var startNo = Math.max(1, Number(pageInfo.start || 1));
  var hasNext = !!pageInfo.hasNext;

  if (!list.length) {
    return [
      '📋 *Aduan Aktif Admin*',
      '',
      'Lingkup: *' + scope + '*',
      'Halaman: *' + page + '*',
      '',
      page > 1 ? 'Tidak ada aduan lagi di halaman ini. Tekan *Sebelumnya* untuk kembali.' : 'Tidak ada aduan aktif.'
    ].join('\n');
  }

  var lines = [
    '📋 *Aduan Aktif Admin*',
    '',
    'Lingkup: *' + scope + '*',
    'Halaman: *' + page + '* · Data ' + startNo + '–' + (startNo + list.length - 1),
    ''
  ];

  list.forEach(function(d, idx) {
    lines.push((startNo + idx) + '. *' + d.id + '*');
    lines.push('Cabang: ' + (d.cabang || '-'));
    lines.push('Status/Prioritas: ' + (d.status || '-') + ' / ' + (d.prioritas || '-'));
    lines.push('Pelanggan: ' + (d.namaPelanggan || '-') + (d.noPelanggan ? ' • NoPel: ' + d.noPelanggan : ''));
    if (d.noHp) lines.push('No HP: ' + d.noHp);
    lines.push('Jenis: ' + (d.jenisGangguan || '-'));
    if (d.keterangan) lines.push('Ket: ' + String(d.keterangan).substring(0, 120));
    if (d.lokasiDetail) lines.push('Lokasi: ' + String(d.lokasiDetail).substring(0, 100));
    if (d.linkMaps) lines.push('Maps: ' + d.linkMaps);
    lines.push('');
  });

  if (hasNext) {
    lines.push('Tekan tombol *Berikutnya* untuk melihat data selanjutnya.');
  } else if (page > 1) {
    lines.push('Ini halaman terakhir. Tekan *Sebelumnya* untuk kembali.');
  } else {
    lines.push('Untuk update/upload foto, pilih menu *Cari ID* atau buka detail aduan.');
  }

  return lines.join('\n');
}
function handleAdminShowAduanById_(phone, admin, id) {
  id = normalizeAduanIdHyphen_(id || '');
  var aduan = findAduanById_(id);
  if (!aduan) {
    return {
      success: false,
      type: 'ADMIN_ADUAN_NOT_FOUND',
      id: id,
      reply: 'ID aduan tidak ditemukan: *' + (id || '-') + '*',
      navButtons: [
        { id: 'ADMIN_CARI', title: 'Cari Lagi' },
        { id: 'ADMIN_MENU', title: 'Menu Admin' }
      ]
    };
  }

  setLastCheckedAduanIdForPhone_(phone, aduan.id);
  setWhatsAppSession_(phone, 'PETUGAS_VIEW_ADUAN', { id: aduan.id });

  return {
    success: true,
    type: 'ADMIN_ADUAN_DETAIL',
    id: aduan.id,
    reply: buildWhatsAppTrackingReply_(aduan),
    navButtons: [
      { id: 'PETUGAS_UPDATE_' + aduan.id, title: 'Update Status' },
      { id: 'PETUGAS_FOTO_' + aduan.id, title: 'Upload Foto' },
      { id: 'ADMIN_MENU', title: 'Menu Admin' }
    ]
  };
}

function buildAdminRekapHariIniReply_(admin) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || safeGetLastRow_(sh) < 2) {
    return '📊 *Rekap Hari Ini*\\n\\nBelum ada data aduan.';
  }

  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();

  var total = 0;
  var statusCount = {};
  var prioritasCount = {};
  var cabangCount = {};
  var tinggiDarurat = 0;

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id || !d.waktuMasukDate) return;

    var key = Utilities.formatDate(d.waktuMasukDate, tz, 'yyyyMMdd');
    if (key !== todayKey) return;

    total++;
    var st = d.status || 'Baru';
    var pr = d.prioritas || 'Sedang';
    var cb = d.cabang || '-';

    statusCount[st] = (statusCount[st] || 0) + 1;
    prioritasCount[pr] = (prioritasCount[pr] || 0) + 1;
    cabangCount[cb] = (cabangCount[cb] || 0) + 1;

    if (pr === 'Tinggi' || pr === 'Darurat') tinggiDarurat++;
  });

  var topCabang = '-';
  var topCount = 0;
  Object.keys(cabangCount).forEach(function(cabang) {
    if (cabangCount[cabang] > topCount) {
      topCount = cabangCount[cabang];
      topCabang = cabang;
    }
  });

  return [
    '📊 *Rekap Aduan Hari Ini*',
    '',
    'Tanggal: ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy'),
    '',
    'Total aduan: *' + total + '*',
    'Baru: ' + (statusCount.Baru || 0),
    'Proses: ' + (statusCount.Proses || 0),
    'Ditunda: ' + (statusCount.Ditunda || 0),
    'Selesai: ' + (statusCount.Selesai || 0),
    'Batal: ' + (statusCount.Batal || 0),
    '',
    'Prioritas Tinggi/Darurat: *' + tinggiDarurat + '*',
    'Cabang terbanyak: *' + topCabang + '* (' + topCount + ')'
  ].join('\n');
}

function createPengumumanFromAdmin_(judul, isi, selesai, admin) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    setupPengumumanSheet();
    sh = ss.getSheetByName(sheetName);
  }

  var now = new Date();
  var row = [
    'AKTIF',
    String(judul || '').trim(),
    String(isi || '').trim(),
    now,
    selesai || '',
    1
  ];

  sh.getRange(sh.getLastRow() + 1, 1, 1, 6).setValues([row]);
  invalidateActivePengumumanCache_();

  return {
    judul: row[1],
    isi: row[2],
    mulai: now,
    selesai: selesai || ''
  };
}

function invalidateActivePengumumanCache_() {
  try { cacheRemove_('SIAGA_ACTIVE_PENGUMUMAN_V10933'); } catch(e) {}
}

function buildActivePengumumanAdminReply_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || safeGetLastRow_(sh) < 2) {
    return '📢 *Pengumuman Aktif*\\n\\nBelum ada data pengumuman.';
  }

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, 6).getValues();
  var now = new Date();
  var lines = ['📢 *Pengumuman Aktif*', ''];
  var count = 0;

  values.forEach(function(row, idx) {
    var status = String(row[0] || '').trim().toUpperCase();
    var judul = String(row[1] || '').trim();
    var isi = String(row[2] || '').trim();
    var mulai = parsePengumumanDate_(row[3], false);
    var selesai = parsePengumumanDate_(row[4], true);

    if (!isi) return;
    if (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) === -1) return;
    if (mulai && now < mulai) return;
    if (selesai && now > selesai) return;

    count++;
    lines.push(count + '. *' + (judul || 'Tanpa Judul') + '*');
    lines.push(String(isi).substring(0, 350));
    if (selesai) lines.push('Aktif sampai: ' + formatDateForWa_(selesai));
    lines.push('');
  });

  if (!count) lines.push('Tidak ada pengumuman aktif.');
  return lines.join('\n');
}

function nonaktifkanSemuaPengumumanAktif_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || safeGetLastRow_(sh) < 2) return 0;

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, 1).getValues();
  var count = 0;
  values.forEach(function(row, idx) {
    var status = String(row[0] || '').trim().toUpperCase();
    if (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) !== -1) {
      sh.getRange(idx + 2, 1).setValue('NONAKTIF');
      count++;
    }
  });

  invalidateActivePengumumanCache_();
  return count;
}


// ============================================================
// PETUGAS CABANG - NOTIFIKASI OTOMATIS ADUAN WHATSAPP
// ============================================================

function setupPetugasCabangSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PETUGAS_CABANG_SHEET || 'PETUGAS_CABANG';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var __fastKey = sh ? getSheetRuntimeKey_('PETUGAS_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  var headers = [
    'Cabang',
    'Nama Petugas',
    'No WA',
    'Role',
    'Status',
    'Notif Aduan Baru',
    'Notif Darurat',
    'Catatan'
  ];

  if (safeGetLastRow_(sh) === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (safeGetLastRow_(sh) < 2) {
    var rows = [
      ['Admin Pusat', 'Admin Pusat', '', 'Admin', 'Aktif', 'YA', 'YA', 'Isi nomor admin pusat. Nomor format 628xxx, tanpa +.']
    ];

    (CONFIG.CABANG || []).forEach(function(cabang) {
      rows.push([
        cabang,
        'Petugas ' + cabang.replace('Cabang ', ''),
        '',
        'Teknisi/Koordinator',
        'Aktif',
        'YA',
        'YA',
        'Isi nomor WA petugas cabang. Petugas harus pernah chat ke bot minimal sekali.'
      ]);
    });

    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);

  // V10.9.101: kolom No WA wajib teks agar nomor 628xxx tidak berubah menjadi scientific notation.
  try { sh.getRange(2, 3, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch(eFormatNoWa) {}

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Aktif', 'Nonaktif'], true)
    .setAllowInvalid(false)
    .build();

  var yaTidakRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YA', 'TIDAK'], true)
    .setAllowInvalid(false)
    .build();

  try {
    sh.getRange(2, 5, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(statusRule);
    sh.getRange(2, 6, Math.max(1, sh.getMaxRows() - 1), 2).setDataValidation(yaTidakRule);
  } catch (e) {}

  if (__fastKey) cachePut_(__fastKey, '1', 21600);
  return sh;

}

function openPetugasCabangSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupPetugasCabangSheet(ss);
  ss.setActiveSheet(sh);
}

function notifyPetugasCabang_(aduan) {
  aduan = aduan || {};
  if (String(getSiagaRuntimeSetting_('NOTIF_ADUAN_PETUGAS_ENABLED', 'YA')).toUpperCase() === 'TIDAK') {
    try {
      logWhatsApp_('', 'Notifikasi aduan baru ke petugas sedang NONAKTIF dari Pengaturan Admin', 'PETUGAS_NOTIFY', aduan.id || '', '', 'SKIP_DISABLED', JSON.stringify({ cabang: aduan.cabang || '', marker: 'NOTIF_ADUAN_PETUGAS_DISABLED_V1097' }));
    } catch(e) {}
    return { totalPetugas: 0, terkirim: 0, gagal: 0, disabled: true, detail: [] };
  }
  var isAdminRelatedAduan = isAdminRelatedJenis_(aduan.jenisGangguan || aduan.jenis || aduan.type || '');
  var petugasList = isAdminRelatedAduan ? getAdminPusatPetugas_() : getActivePetugasForAduan_(aduan);
  var branchPetugasCount = petugasList.filter(function(p) {
    return p && p.tipeNotif === 'PETUGAS_CABANG';
  }).length;
  var result = {
    totalPetugas: petugasList.length,
    petugasCabang: branchPetugasCount,
    terkirim: 0,
    gagal: 0,
    detail: []
  };

  if (!aduan.id) {
    result.error = 'ID aduan kosong.';
    return result;
  }

  if (petugasList.length === 0) {
    // FIX V9.9:
    // Kalau petugas cabang belum cocok, fallback ke Admin Pusat agar aduan tetap ada yang menerima.
    var adminFallback = getAdminPusatPetugas_();
    if (adminFallback.length > 0) {
      petugasList = adminFallback;
      result.totalPetugas = petugasList.length;
      logWhatsApp_(
        '',
        'Tidak ada petugas aktif untuk ' + (aduan.cabang || '-') + ', fallback ke Admin Pusat',
        'PETUGAS_NOTIFY',
        aduan.id,
        '',
        'FALLBACK_ADMIN_PUSAT',
        JSON.stringify({ cabang: aduan.cabang, prioritas: aduan.prioritas })
      );
    } else {
      logWhatsApp_(
        '',
        'Tidak ada petugas aktif untuk ' + (aduan.cabang || '-'),
        'PETUGAS_NOTIFY',
        aduan.id,
        '',
        'NO_PETUGAS',
        JSON.stringify({ cabang: aduan.cabang, prioritas: aduan.prioritas })
      );
      return result;
    }
  }

  // Audit penting: sebelumnya Admin Pusat ikut berada di daftar target sehingga
  // daftar tidak pernah kosong walaupun petugas cabang sebenarnya tidak cocok.
  // Akibatnya kondisi salah cabang/nomor kosong/notifikasi TIDAK sulit terlihat.
  if (!isAdminRelatedAduan && branchPetugasCount === 0) {
    logWhatsApp_(
      '',
      'Tidak ada target petugas cabang yang cocok untuk ' + (aduan.cabang || '-'),
      'PETUGAS_NOTIFY_AUDIT',
      aduan.id,
      '',
      'NO_BRANCH_TARGET',
      JSON.stringify({
        cabang: aduan.cabang || '',
        cabangKey: normalizeCabangKey_(aduan.cabang || ''),
        totalTargetTermasukAdmin: petugasList.length,
        petugasRows: getPetugasRows_().map(function(p) {
          return {
            rowNumber: p.rowNumber,
            cabang: p.cabang,
            cabangKey: normalizeCabangKey_(p.cabang),
            nama: p.nama,
            noWaAda: !!p.noWa,
            status: p.status,
            notifBaru: p.notifBaru
          };
        })
      })
    );
  }

  var message = buildPetugasNotificationMessage_(aduan);

  petugasList.forEach(function(petugas) {
    // Kirim cepat lewat phone_number. Jika provider menolak, coba ulang memakai
    // customer_id yang terkait nomor tersebut. Jalur kedua penting untuk nomor
    // petugas yang sudah pernah chat tetapi endpoint direct tidak menerimanya.
    var sendResult = sendPetugasNotificationText_(petugas.noWa, message);

    var ok = sendResult && sendResult.success;
    if (ok) result.terkirim++;
    else result.gagal++;

    var status = ok ? 'TERKIRIM' : 'GAGAL';
    var raw = JSON.stringify({
      petugas: petugas,
      sendResult: sendResult
    });

    logWhatsApp_(
      petugas.noWa,
      'Notifikasi aduan baru ke petugas',
      'PETUGAS_NOTIFY',
      aduan.id,
      message,
      status,
      raw
    );

    result.detail.push({
      nama: petugas.nama,
      noWa: petugas.noWa,
      cabang: petugas.cabang,
      status: status,
      response: sendResult
    });
  });

  return result;
}

// V11.10:
// Aduan yang diinput manual oleh staf di dashboard sebelumnya HANYA mengirim
// notifikasi ke petugas cabang. Pelanggan tidak pernah menerima konfirmasi apapun
// di WhatsApp-nya sendiri, beda dengan aduan yang dibuat pelanggan lewat WA (yang
// langsung dibalas bot). Fungsi ini mengirim pesan sukses yang FORMATNYA SAMA PERSIS
// dengan buildNewAduanCreatedReply_ (dipakai di alur WA), tapi dikirim sebagai pesan
// proaktif (push) ke nomor No HP yang diisi staf di form manual, memakai jalur kirim
// yang sama dengan notifikasi petugas (sendKiriminTextByPhoneNumber_).
//
// Aturan:
// - Kalau No HP kosong: dilewati (skip) + dicatat log, TIDAK menggagalkan penyimpanan aduan.
// - Ikut setting NOTIF_ADUAN_PETUGAS_ENABLED yang sudah ada (tidak ada toggle terpisah).
function notifyPelangganAduanManual_(aduan) {
  aduan = aduan || {};
  var noHp = normalizePhone_(aduan.noHp || '');

  if (!noHp) {
    try {
      logWhatsApp_(
        '',
        'No HP pelanggan kosong, notifikasi tiket manual ke pelanggan dilewati',
        'PELANGGAN_NOTIFY_MANUAL',
        aduan.id || '',
        '',
        'SKIP_NO_PHONE',
        JSON.stringify({ cabang: aduan.cabang || '', marker: 'NOTIF_PELANGGAN_MANUAL_SKIP_NO_PHONE_V1110' })
      );
    } catch (e) {}
    return { success: false, skipped: true, reason: 'NO_PHONE' };
  }

  if (String(getSiagaRuntimeSetting_('NOTIF_ADUAN_PETUGAS_ENABLED', 'YA')).toUpperCase() === 'TIDAK') {
    try {
      logWhatsApp_(
        noHp,
        'Notifikasi tiket manual ke pelanggan sedang NONAKTIF (ikut Pengaturan Notifikasi Petugas)',
        'PELANGGAN_NOTIFY_MANUAL',
        aduan.id || '',
        '',
        'SKIP_DISABLED',
        JSON.stringify({ cabang: aduan.cabang || '', marker: 'NOTIF_PELANGGAN_MANUAL_DISABLED_V1110' })
      );
    } catch (e) {}
    return { success: false, skipped: true, reason: 'DISABLED' };
  }

  if (!aduan.id) {
    return { success: false, skipped: true, reason: 'NO_ID' };
  }

  // V11.10 FIX: aduan input manual paling sering justru dari pelanggan yang TIDAK
  // sedang aktif chat bot (itu sebabnya staf yang input manual). WhatsApp Business
  // API hanya mengizinkan kirim pesan bebas (bukan template resmi) ke nomor yang
  // pernah chat masuk dalam window waktu tertentu (default 24 jam, lihat
  // isWithinWhatsApp24hWindow_ / STATUS_NOTIF_WINDOW_HOURS -- fungsi yang sama
  // dipakai notifyCustomerStatusChange_ untuk notifikasi perubahan status).
  // Kalau dipaksa kirim di luar window, pesan berisiko ditolak provider.
  // Maka di sini WAJIB dicek dulu sebelum mencoba kirim.
  var windowInfo = isWithinWhatsApp24hWindow_(noHp);
  if (!windowInfo.ok) {
    logWhatsApp_(
      noHp,
      'Notifikasi tiket manual ke pelanggan TIDAK dikirim: window 24 jam tidak aktif',
      'PELANGGAN_NOTIFY_MANUAL',
      aduan.id,
      '',
      'SKIP_WINDOW_CLOSED',
      JSON.stringify({ cabang: aduan.cabang || '', reason: windowInfo.reason, lastInboundAt: windowInfo.lastInboundAt || '', marker: 'NOTIF_PELANGGAN_MANUAL_WINDOW_CLOSED_V1110' })
    );
    return { success: false, skipped: true, reason: 'WINDOW_CLOSED', windowInfo: windowInfo };
  }

  // Pesan sengaja disamakan persis dengan balasan sukses di alur WhatsApp pelanggan
  // (buildNewAduanCreatedReply_ di 05_Pelanggan_Menu_Aduan.gs) supaya pengalaman
  // pelanggan sama, baik aduan dibuat sendiri lewat WA maupun diinput staf di dashboard.
  // V11.10.2: dikirim SEKALIAN dengan 3 tombol interaktif yang sama persis dengan
  // yang muncul di alur WA asli (Cek Tiket Ini / Cek Status Aduan / Menu Utama),
  // via sendKiriminButtonMessage_ -- fungsi ini sudah ada & dipakai untuk balasan
  // interaktif di webhook, endpoint-nya sama dan phone_number-based (bisa dipakai
  // push), jadi tidak perlu bikin endpoint baru.
  var message = buildNewAduanCreatedReply_(aduan);
  var buttons = buildCreatedTicketButtons_(aduan.id);
  var sendResult = sendKiriminButtonMessage_(noHp, message, buttons);
  var ok = !!(sendResult && sendResult.success);

  // Fallback: kalau kirim interaktif gagal (mis. provider menolak format button
  // untuk pesan proaktif), coba sekali lagi pakai teks polos supaya pelanggan
  // tetap dapat info ID aduannya walau tanpa tombol.
  if (!ok) {
    var fallbackResult = sendKiriminTextByPhoneNumber_(noHp, message);
    if (fallbackResult && fallbackResult.success) {
      sendResult = fallbackResult;
      sendResult.viaFallbackText = true;
      ok = true;
    }
  }

  logWhatsApp_(
    noHp,
    ok ? 'Notifikasi tiket manual berhasil dikirim ke pelanggan' : 'Notifikasi tiket manual GAGAL dikirim ke pelanggan',
    'PELANGGAN_NOTIFY_MANUAL',
    aduan.id,
    message,
    ok ? 'TERKIRIM' : 'GAGAL',
    JSON.stringify({ cabang: aduan.cabang || '', sendResult: sendResult })
  );

  return sendResult;
}

function sendPetugasNotificationText_(phone, message) {
  var direct = sendKiriminTextByPhoneNumber_(phone, message);
  if (direct && direct.success) return direct;

  var resolved = null;
  var byCustomer = null;
  try {
    if (typeof resolveKiriminCustomerIdByPhone_ === 'function') {
      resolved = resolveKiriminCustomerIdByPhone_(phone);
    }
    if (resolved && resolved.success && resolved.customerId &&
        typeof sendWhatsAppMessage_ === 'function') {
      byCustomer = sendWhatsAppMessage_(phone, message, {
        customerId: resolved.customerId
      });
    }
  } catch (fallbackErr) {
    byCustomer = { success: false, error: fallbackErr.message || String(fallbackErr) };
  }

  if (byCustomer && byCustomer.success) {
    return {
      success: true,
      via: 'customer_id_fallback',
      statusCode: byCustomer.statusCode || 200,
      response: byCustomer.response || '',
      directAttempt: direct,
      customerLookup: {
        success: true,
        customerId: resolved.customerId,
        statusCode: resolved.statusCode || ''
      }
    };
  }

  return {
    success: false,
    via: 'phone_number_and_customer_id_failed',
    error: (byCustomer && (byCustomer.error || byCustomer.response)) ||
      (direct && (direct.error || direct.response)) ||
      'Pengiriman notifikasi petugas gagal.',
    directAttempt: direct || null,
    customerLookup: resolved || null,
    customerIdAttempt: byCustomer || null
  };
}


function getPetugasHeaderMap_(sh) {
  var map = {};
  if (!sh || sh.getLastColumn() < 1) return map;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];

  headers.forEach(function(h, idx) {
    var key = normalizeHeaderKey_(h);
    if (!key) return;

    if (key === 'cabang') map.cabang = idx + 1;
    if (key === 'nama_petugas' || key === 'namapetugas' || key === 'nama') map.nama = idx + 1;
    if (key === 'no_wa' || key === 'nowa' || key === 'nomor_wa' || key === 'nomor_whatsapp' || key === 'whatsapp') map.noWa = idx + 1;
    if (key === 'role' || key === 'jabatan') map.role = idx + 1;
    if (key === 'status') map.status = idx + 1;
    if (key === 'notif_aduan_baru' || key === 'notifaduanbaru' || key === 'aduan_baru') map.notifBaru = idx + 1;
    if (key === 'notif_darurat' || key === 'notifdarurat' || key === 'darurat') map.notifDarurat = idx + 1;
    if (key === 'catatan') map.catatan = idx + 1;
  });

  // Fallback posisi default kalau header belum terbaca.
  map.cabang = map.cabang || 1;
  map.nama = map.nama || 2;
  map.noWa = map.noWa || 3;
  map.role = map.role || 4;
  map.status = map.status || 5;
  map.notifBaru = map.notifBaru || 6;
  map.notifDarurat = map.notifDarurat || 7;
  map.catatan = map.catatan || 8;

  return map;
}

function normalizeHeaderKey_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');
}

function getPetugasRows_() {
  var cachedRows = cacheGet_('PETUGAS_ROWS');
  if (cachedRows) {
    try {
      var parsedRows = JSON.parse(cachedRows);
      if (Array.isArray(parsedRows)) return parsedRows;
    } catch(eCachedRows) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupPetugasCabangSheet(ss);
  var lastRow = safeGetLastRow_(sh);
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) return [];

  var map = getPetugasHeaderMap_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  var rows = values.map(function(row, i) {
    function val(col) {
      if (!col) return '';
      return String(row[col - 1] || '').trim();
    }

    return {
      rowNumber: i + 2,
      cabang: val(map.cabang),
      nama: val(map.nama),
      noWa: normalizePhone_(val(map.noWa)),
      role: val(map.role),
      status: val(map.status),
      notifBaru: val(map.notifBaru) || 'YA',
      notifDarurat: val(map.notifDarurat) || 'YA',
      catatan: val(map.catatan)
    };
  });

  try { cachePut_('PETUGAS_ROWS', JSON.stringify(rows), 120); } catch(ePutRows) {}
  return rows;
}

function getActivePetugasForAduan_(aduan) {
  aduan = aduan || {};
  var cabangKey = normalizeCabangKey_(aduan.cabang || '');

  var list = [];
  var seen = {};
  var rows = getPetugasRows_();

  rows.forEach(function(p) {
    if (!p.noWa) return;

    var status = String(p.status || '').trim().toLowerCase();
    var notifBaru = String(p.notifBaru || 'YA').trim().toUpperCase();

    if (status && status !== 'aktif') return;
    if (notifBaru === 'TIDAK') return;

    var rowCabangKey = normalizeCabangKey_(p.cabang);
    var sameCabang = rowCabangKey === cabangKey;
    var adminPusat = rowCabangKey === normalizeCabangKey_('Admin Pusat');

    // Admin Pusat selalu menerima semua aduan.
    // Petugas cabang menerima aduan sesuai cabangnya.
    var include = sameCabang || adminPusat;

    if (!include) return;

    if (!seen[p.noWa]) {
      seen[p.noWa] = true;
      list.push({
        cabang: p.cabang,
        nama: p.nama || 'Petugas',
        noWa: p.noWa,
        role: p.role || '-',
        rowNumber: p.rowNumber,
        tipeNotif: adminPusat ? 'ADMIN_PUSAT_MONITORING' : 'PETUGAS_CABANG'
      });
    }
  });

  return list;
}

function getAdminPusatPetugas_() {
  var list = [];
  var seen = {};
  var rows = getPetugasRows_();

  rows.forEach(function(p) {
    if (normalizeCabangKey_(p.cabang) !== normalizeCabangKey_('Admin Pusat')) return;
    if (!p.noWa) return;

    var status = String(p.status || '').trim().toLowerCase();
    var notifBaru = String(p.notifBaru || 'YA').trim().toUpperCase();

    if (status && status !== 'aktif') return;
    if (notifBaru === 'TIDAK') return;

    if (!seen[p.noWa]) {
      seen[p.noWa] = true;
      list.push({
        cabang: p.cabang || 'Admin Pusat',
        nama: p.nama || 'Admin Pusat',
        noWa: p.noWa,
        role: p.role || 'Admin',
        rowNumber: p.rowNumber,
        tipeNotif: 'ADMIN_PUSAT_MONITORING'
      });
    }
  });

  return list;
}

function cekPetugasCabangAktif() {
  var ui = SpreadsheetApp.getUi();
  var cabangPrompt = ui.prompt(
    'Cek Petugas Cabang',
    'Masukkan cabang. Contoh: Cabang Praya',
    ui.ButtonSet.OK_CANCEL
  );
  if (cabangPrompt.getSelectedButton() !== ui.Button.OK) return;

  var cabang = cabangPrompt.getResponseText() || 'Cabang Praya';
  var dummy = {
    id: 'CEK-PETUGAS',
    cabang: cabang,
    prioritas: 'Sedang'
  };

  var list = getActivePetugasForAduan_(dummy);
  var rows = getPetugasRows_();

  ui.alert(
    list.length ? '✅ Petugas ditemukan: ' + list.length : '⚠️ Petugas tidak ditemukan',
    'Cabang dicek: ' + cabang + '\n\nPetugas cocok:\n' + JSON.stringify(list, null, 2) +
    '\n\nSemua baris PETUGAS_CABANG terbaca:\n' + JSON.stringify(rows, null, 2),
    ui.ButtonSet.OK
  );
}


function sendKiriminTextByPhoneNumber_(phone, message) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!endpoint || !token) {
    return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  }

  if (!phoneNumber) {
    return { success: false, error: 'phone_number kosong.' };
  }

  // Format fallback Kirimin:
  // Karena interactive List Menu berhasil pakai phone_number di endpoint /messages/send,
  // notifikasi petugas juga dicoba pakai phone_number jika customer_id gagal.
  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'text',
    content: String(message || '')
  };

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

    if (isKiriminAcceptedResponse_(statusCode, text)) {
      return { success: true, statusCode: statusCode, response: text, requestBody: body, via: 'phone_number' };
    }

    return { success: false, statusCode: statusCode, error: text, requestBody: body, via: 'phone_number' };

  } catch (err) {
    return { success: false, error: err.message, requestBody: body, via: 'phone_number' };
  }
}

// Jangan menganggap semua HTTP 2xx pasti terkirim. Beberapa API mengembalikan
// HTTP 200 dengan success:false/status:error di JSON. Sebelumnya kondisi itu
// tercatat sebagai TERKIRIM sehingga kegagalan petugas tidak terlihat.
function isKiriminAcceptedResponse_(statusCode, responseText) {
  statusCode = Number(statusCode || 0);
  if (statusCode < 200 || statusCode >= 300) return false;

  var obj = null;
  try { obj = JSON.parse(String(responseText || '{}')); } catch(e) {}
  if (!obj || typeof obj !== 'object') return true;

  if (obj.success === false || obj.ok === false) return false;
  var status = String(obj.status || obj.state || '').toLowerCase();
  if (status === 'error' || status === 'failed' || status === 'failure' || status === 'rejected') return false;
  if (obj.error && !obj.data && !obj.result && obj.success !== true) return false;
  return true;
}

function getPetugasNotificationAudit_(idAduan) {
  var id = normalizeId_(idAduan || '');
  var aduan = id ? findAduanById_(id) : null;
  if (!aduan) return { success: false, error: 'ID aduan tidak ditemukan: ' + (idAduan || '-') };

  var targets = getActivePetugasForAduan_(aduan);
  var logs = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
    if (sh && sh.getLastRow() >= 2) {
      var startRow = Math.max(2, sh.getLastRow() - 499);
      var values = sh.getRange(startRow, 1, sh.getLastRow() - startRow + 1, Math.max(8, sh.getLastColumn())).getDisplayValues();
      values.forEach(function(row) {
        if (normalizeId_(row[4] || '') !== id) return;
        var kind = String(row[3] || '').toUpperCase();
        if (kind.indexOf('PETUGAS_NOTIFY') === -1) return;
        logs.push({
          timestamp: row[0] || '',
          noWa: row[1] || '',
          jenis: row[3] || '',
          status: row[6] || '',
          raw: row[7] || ''
        });
      });
    }
  } catch(eLog) {
    logs.push({ status: 'AUDIT_LOG_ERROR', raw: eLog.message || String(eLog) });
  }

  return {
    success: true,
    id: aduan.id,
    cabang: aduan.cabang,
    cabangKey: normalizeCabangKey_(aduan.cabang),
    notifEnabled: String(getSiagaRuntimeSetting_('NOTIF_ADUAN_PETUGAS_ENABLED', 'YA')).toUpperCase() !== 'TIDAK',
    targetCabang: targets.filter(function(t) { return t.tipeNotif === 'PETUGAS_CABANG'; }),
    targetAdmin: targets.filter(function(t) { return t.tipeNotif === 'ADMIN_PUSAT_MONITORING'; }),
    logs: logs
  };
}

function auditNotifikasiPetugasAduan() {
  // Project ini dijalankan sebagai web app/standalone sehingga getUi() tidak
  // tersedia ketika fungsi dipilih dari editor. Kosongkan nilai ini untuk
  // otomatis mengaudit aduan paling baru, atau isi ID tertentu jika diperlukan.
  var ID_ADUAN_AUDIT = '';
  var id = String(ID_ADUAN_AUDIT || '').trim();

  if (!id) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss && ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) {
      var emptyResult = { success: false, error: 'Sheet ADUAN kosong atau tidak ditemukan.' };
      console.log('AUDIT_NOTIFIKASI_PETUGAS\n' + JSON.stringify(emptyResult, null, 2));
      return emptyResult;
    }

    // Aduan WhatsApp selalu ditambahkan sebagai baris baru. Cari dari bawah
    // agar baris kosong atau baris tidak lengkap tidak membuat audit gagal.
    var startRow = Math.max(2, sh.getLastRow() - 49);
    var rows = sh.getRange(
      startRow,
      1,
      sh.getLastRow() - startRow + 1,
      Math.max(sh.getLastColumn(), 20)
    ).getValues();

    for (var i = rows.length - 1; i >= 0; i--) {
      var latest = parseAduanRowForTracking_(rows[i]);
      if (latest && latest.id) {
        id = latest.id;
        break;
      }
    }
  }

  var result = id
    ? getPetugasNotificationAudit_(id)
    : { success: false, error: 'Tidak menemukan ID aduan terbaru untuk diaudit.' };

  console.log('AUDIT_NOTIFIKASI_PETUGAS\n' + JSON.stringify(result, null, 2));
  return result;
}


function buildPetugasNotificationMessage_(aduan) {
  aduan = aduan || {};
  var prioritas = aduan.prioritas || 'Sedang';
  var icon = prioritas === 'Darurat' ? '🚨' : (prioritas === 'Tinggi' ? '⚠️' : '📌');
  var noPelanggan = getNoPelangganFromAduan_(aduan) || '-';

  var lines = [
    icon + ' *ADUAN BARU SIAGA TIARA*',
    '',
    (String(aduan.catatan || '').indexOf('Di luar jam kerja') !== -1 ? '*DI LUAR JAM KERJA*' : ''),
    'ID Aduan: *' + (aduan.id || '-') + '*',
    'Prioritas: *' + prioritas + '*',
    'Status: *' + (aduan.status || 'Baru') + '*',
    '',
    'Cabang: ' + (aduan.cabang || '-'),
    'Nama Pelanggan: ' + (aduan.namaPelanggan || '-'),
    'No HP Pelanggan: ' + (aduan.noHp || '-'),
    'Jenis Laporan: ' + (aduan.jenisGangguan || '-'),
    'Kategori: ' + getKategoriLayananByJenis_(aduan.jenisGangguan || '-'),
    'Unit Tujuan: ' + (aduan.unit || getUnitByJenisGangguan_(aduan.jenisGangguan || '-')),
    'No Pelanggan: ' + noPelanggan,
    'Detail Lokasi: ' + (aduan.lokasiDetail || '-'),
    '',
    'Keterangan:',
    (aduan.keterangan || '-'),
    ''
  ];

  if (aduan.linkMaps) {
    lines.push('');
    lines.push('Maps: ' + aduan.linkMaps);
  }

  // V10.9.230: Catatan Sistem tidak dikirim ke petugas agar notifikasi aduan baru lebih ringkas.
  // Catatan tetap tersimpan di dashboard/log untuk kebutuhan audit admin.

  lines.push('Mohon segera ditindaklanjuti dan update status di dashboard SIAGA TIARA.');

  if (prioritas === 'Darurat') {
    lines.push('');
    lines.push('⚠️ *Prioritas Darurat* — mohon dipantau segera.');
  }

  return lines.join('\n');
}



// V10.9.68: Duplikasi cekPetugasCabangAktif dihapus.
// Fungsi lengkap ada di atas.


function testDirectNotifikasiPetugasByCabang() {
  var ui = SpreadsheetApp.getUi();

  var cabangPrompt = ui.prompt(
    'Tes Petugas Cabang',
    'Masukkan cabang. Contoh: Cabang Praya',
    ui.ButtonSet.OK_CANCEL
  );
  if (cabangPrompt.getSelectedButton() !== ui.Button.OK) return;

  var cabang = cabangPrompt.getResponseText() || 'Cabang Praya';

  var dummy = {
    id: 'TEST-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    cabang: cabang,
    wilayah: cabang.replace(/^Cabang\s+/i, ''),
    desa: '0000000000',
    namaPelanggan: 'Tes Pelanggan',
    noHp: '628000000000',
    jenisGangguan: 'Tes Notifikasi',
    prioritas: 'Sedang',
    status: 'Baru',
    keterangan: 'Ini hanya tes notifikasi petugas cabang.',
    catatan: 'Tes dari menu SIAGA TIARA.',
    linkMaps: '',
    lokasiDetail: 'Tes lokasi'
  };

  var result = notifyPetugasCabang_(dummy);

  ui.alert(
    result.terkirim > 0 ? '✅ Notifikasi petugas terkirim' : '⚠️ Notifikasi belum terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function testNotifikasiPetugasCabang() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPetugasCabangSheet(ss);

  var idPrompt = ui.prompt(
    'Tes Notifikasi Petugas',
    'Masukkan ID Aduan yang sudah ada. Contoh: PRY7K2A',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(idPrompt.getResponseText()) || idPrompt.getResponseText();
  var aduan = findAduanById_(id);

  if (!aduan) {
    ui.alert(
      '❌ ID tidak ditemukan',
      'ID tidak ada di sheet ADUAN: ' + id,
      ui.ButtonSet.OK
    );
    return;
  }

  var result = notifyPetugasCabang_(aduan);

  ui.alert(
    result.terkirim > 0 ? '✅ Tes notifikasi selesai' : '⚠️ Tidak ada notifikasi terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function normalizeCabangKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^cabang\s+/, '')
    .trim();
}




function testRandomAduanIdFormat_() {
  var fakeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  var codes = ['PRY', 'PTE', 'PRB', 'PBD', 'PRT', 'PJT', 'JGT', 'BKU'];
  var lines = codes.map(function(code) {
    return code + ' => ' + generateCabangAduanId_(code, new Date(), fakeSheet);
  });

  lines.push('');
  lines.push('Legacy check: ' + normalizeAduanIdHyphen_('PRY7K2A'));
  lines.push('Random check: ' + normalizeAduanIdHyphen_('PTE 4N8M'));

  try {
    SpreadsheetApp.getUi().alert('Test ID Acak Cabang', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    Logger.log(lines.join('\n'));
  }
}



function testCabangIdMappingFix_() {
  var tests = [
    ['Cabang Praya', 'Cabang Praya', 'PRY'],
    ['Cabang Praya Tengah', 'Cabang Praya Tengah', 'PTE'],
    ['Praya Tengah', 'Cabang Praya Tengah', 'PTE'],
    ['CABANG_PTE', 'Cabang Praya Tengah', 'PTE'],
    ['Cabang Praya Barat', 'Cabang Praya Barat', 'PRB'],
    ['Cabang Praya Barat Daya', 'Cabang Praya Barat Daya', 'PBD'],
    ['Cabang Praya Timur', 'Cabang Praya Timur', 'PRT'],
    ['Cabang Batukliang Utara', 'Cabang Batukliang Utara', 'BKU'],
    ['Cabang Batukliang', 'Cabang Batukliang', 'BTK'],
    ['1|page2', 'Cabang Kopang', 'KPG'],
    ['2|page2', 'Cabang Janapria', 'JNP'],
    ['3|page2', 'Cabang Pringgarata', 'PGR']
  ];

  var lines = tests.map(function(t) {
    var inputText = String(t[0] || '');
    var page = inputText.indexOf('|page2') !== -1 ? 2 : 1;
    inputText = inputText.replace('|page2', '');
    var normalized = normalizeIncomingCabangChoice_(inputText, page);
    var code = getCabangCodeSafe_(normalized);
    return t[0] + ' => ' + normalized + ' / ' + code + ' | expected ' + t[1] + ' / ' + t[2];
  });

  try {
    SpreadsheetApp.getUi().alert('Test Mapping Cabang', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    Logger.log(lines.join('\n'));
  }
}


// ============================================================
// V10.9.7 - NOTIFIKASI PERUBAHAN STATUS KE PELANGGAN
// ============================================================

function setupStatusNotifLogSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.STATUS_NOTIF_LOG_SHEET || 'LOG_NOTIF_STATUS';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 10).setValues([[
      'Timestamp',
      'ID Aduan',
      'No HP',
      'Status Lama',
      'Status Baru',
      'Window 24 Jam',
      'Hasil',
      'Alasan',
      'Waktu Chat Terakhir',
      'Detail'
    ]]);
  }

  sh.getRange(1, 1, 1, 10)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, 10); } catch(e) {}

  return sh;
}

function openStatusNotifLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupStatusNotifLogSheet_(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.STATUS_NOTIF_LOG_SHEET || 'LOG_NOTIF_STATUS'));
}

function logStatusNotif_(idAduan, phone, oldStatus, newStatus, windowOk, result, reason, lastInboundAt, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = setupStatusNotifLogSheet_(ss);

    sh.getRange(sh.getLastRow() + 1, 1, 1, 10).setValues([[
      new Date(),
      idAduan || '',
      normalizePhone_(phone || ''),
      oldStatus || '',
      newStatus || '',
      windowOk ? 'AKTIF' : 'TIDAK AKTIF',
      result || '',
      reason || '',
      lastInboundAt || '',
      truncateForLog_(detail || '', 1200)
    ]]);
  } catch(e) {}
}

function getLastInboundChatAt_(phone) {
  // V10.9.68: Optimasi - cek CacheService dulu sebelum scan LOG_WHATSAPP.
  // Timestamp disimpan di cache saat pesan masuk di handleWhatsAppWebhook_.
  // Ini menghilangkan kebutuhan scan 600 baris LOG setiap cek notifikasi.
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  // 1. Cek cache dulu (sangat cepat ~20ms)
  try {
    var cacheKey = 'LAST_INBOUND_' + phone;
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var ts = parseInt(cached, 10);
      if (!isNaN(ts)) return new Date(ts);
    }
  } catch(e) {}

  // 2. Fallback ke scan LOG_WHATSAPP (untuk data lama sebelum v10.9.68)
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
    if (!sh || sh.getLastRow() < 2) return null;

    var lastRow = sh.getLastRow();
    var checkRows = Math.min(lastRow - 1, 300); // dikurangi dari 600 ke 300
    var startRow = Math.max(2, lastRow - checkRows + 1);
    var values = sh.getRange(startRow, 1, checkRows, 7).getValues();

    for (var i = values.length - 1; i >= 0; i--) {
      var rowPhone = normalizePhone_(values[i][1] || '');
      var pesanMasuk = String(values[i][2] || '').trim();
      var jenis = String(values[i][3] || '').trim();

      if (rowPhone === phone && pesanMasuk && jenis !== 'EMPTY_WEBHOOK' && jenis !== 'DOPOST_ERROR') {
        var d = toSafeDate_(values[i][0]) || new Date(values[i][0]);
        if (d && !isNaN(d.getTime())) {
          // Simpan ke cache agar berikutnya tidak scan lagi
          try {
            CacheService.getScriptCache().put('LAST_INBOUND_' + phone,
              String(d.getTime()), safeCacheExpirationSeconds_(21600));
          } catch(e2) {}
          return d;
        }
      }
    }
  } catch(e) {}

  return null;
}

function isWithinWhatsApp24hWindow_(phone) {
  var lastInbound = getLastInboundChatAt_(phone);
  if (!lastInbound) {
    return { ok: false, lastInboundAt: null, reason: 'Belum ada riwayat chat masuk dari nomor ini di LOG_WHATSAPP.' };
  }

  var windowHours = Number(getSiagaRuntimeSetting_('STATUS_NOTIF_WINDOW_HOURS', CONFIG.STATUS_NOTIF_WINDOW_HOURS || 24));
  var diffHours = (new Date().getTime() - lastInbound.getTime()) / 3600000;

  if (diffHours <= windowHours) {
    return {
      ok: true,
      lastInboundAt: lastInbound,
      reason: 'Window 24 jam masih aktif. Chat terakhir sekitar ' + diffHours.toFixed(1) + ' jam lalu.'
    };
  }

  return {
    ok: false,
    lastInboundAt: lastInbound,
    reason: 'Window 24 jam sudah lewat. Chat terakhir sekitar ' + diffHours.toFixed(1) + ' jam lalu.'
  };
}

function buildCustomerStatusChangeMessage_(aduan, oldStatus, newStatus, catatan) {
  aduan = aduan || {};
  var statusText = String(newStatus || aduan.status || '').trim();
  var statusLower = statusText.toLowerCase();
  var idText = aduan.id || '-';
  var catatanText = String(catatan || '').trim();
  var lines;

  if (statusLower === 'selesai') {
    var hasDocs = false;
    try { hasDocs = getAduanDocumentationCount_(idText) > 0; } catch(e) { hasDocs = false; }

    lines = [
      '*Update Status Aduan SIAGA TIARA*',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *Selesai*',
      '',
      'Laporan Anda telah selesai ditindaklanjuti oleh petugas PERUMDAM Tirta Ardhia Rinjani.'
    ];

    if (hasDocs) {
      lines.push('');
      lines.push('Dokumentasi foto penanganan tersedia. Sistem akan mencoba mengirim foto langsung setelah pesan ini.');
      lines.push('Jika foto tidak muncul, tekan tombol *Lihat Foto* untuk membuka dokumentasi.');
    }

    lines.push('');
    lines.push('Terima kasih atas partisipasi Anda dalam membantu kami meningkatkan pelayanan air bersih.');
  } else if (statusLower === 'ditunda') {
    lines = [
      '*Update Status Aduan SIAGA TIARA*',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *Ditunda*',
      '',
      'Penanganan aduan Anda untuk sementara ditunda karena masih membutuhkan pengecekan atau koordinasi lebih lanjut.',
      '',
      'Aduan tetap tercatat di sistem dan akan dilanjutkan kembali setelah proses pengecekan selesai.',
      '',
      'Anda juga bisa melihat perkembangan aduan melalui menu Aduan Aktif.'
    ];
  } else if (statusLower === 'dalam pengerjaan' || statusLower === 'proses' || statusLower === 'direspons' || statusLower === 'direspon') {
    // V10.9.162:
    // Foto Respons adalah bukti internal petugas. Pelanggan cukup menerima informasi
    // bahwa aduan sudah mulai ditindaklanjuti, tanpa dikirimi Foto Respons.
    lines = [
      'Aduan Anda sedang ditindaklanjuti oleh Tim Teknis PERUMDAM Tirta Ardhia Rinjani.',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *Dalam Pengerjaan*',
      '',
      'Petugas telah melakukan pengecekan awal dan aduan sedang dalam proses penanganan.',
      '',
      'Anda bisa cek status kapan saja melalui menu *Cek Status Aduan*.'
    ];
  } else {
    var progress = buildProgressTextForWa_(statusText || aduan.status || '');
    lines = [
      '*Update Status Aduan SIAGA TIARA*',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *' + (statusText || '-') + '*',
      'Tahap: ' + progress,
      '',
      'Anda juga bisa cek status kapan saja dengan mengirim ID aduan ini.'
    ];
  }

  // V11.0.7:
  // Sebelumnya catatan yang ditulis admin/petugas di "Catatan Tindak Lanjut" saat mengubah
  // status (mis. alasan pembatalan) hanya tersimpan internal di sheet dan TIDAK PERNAH ikut
  // terkirim ke pelanggan - notifikasi cuma berisi ID Aduan/Status/Tahap. Sekarang, kalau ada
  // catatan yang ditulis khusus untuk perubahan status ini, disisipkan sebagai bagian resmi
  // pesan WhatsApp ke pelanggan supaya pelanggan tahu alasan/detailnya juga.
  if (catatanText) {
    lines.push('');
    lines.push('Catatan Petugas: ' + catatanText);
  }

  return lines.join('\n');
}



function getDriveFileIdFromUrl_(url) {
  url = String(url || '').trim();
  if (!url) return '';

  var m = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m && m[1]) return m[1];

  m = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m && m[1]) return m[1];

  m = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m && m[1]) return m[1];

  return '';
}

function buildDriveThumbnailUrl_(url, size) {
  var fileId = getDriveFileIdFromUrl_(url);
  if (!fileId) return '';
  size = String(size || 'w1280').trim();
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=' + encodeURIComponent(size);
}

function buildDriveDownloadUrl_(url) {
  var fileId = getDriveFileIdFromUrl_(url);
  if (!fileId) return '';
  return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
}

function normalizeDokumentasiJenisForPriority_(jenisFoto) {
  var v = String(jenisFoto || '').toLowerCase();
  if (v.indexOf('selesai') !== -1 || v.indexOf('sesudah') !== -1) return 100;
  if (v.indexOf('proses') !== -1) return 80;
  if (v.indexOf('meter') !== -1 || v.indexOf('lokasi') !== -1) return 60;
  if (v.indexOf('sebelum') !== -1) return 40;
  return 10;
}

function getBestAduanPhotoForCustomer_(idAduan) {
  var docs = getAduanDocumentationRows_(idAduan, 30) || [];
  if (!docs.length) return null;

  docs.sort(function(a, b) {
    var pr = normalizeDokumentasiJenisForPriority_(b.jenisFoto) - normalizeDokumentasiJenisForPriority_(a.jenisFoto);
    if (pr !== 0) return pr;
    var ad = toSafeDate_(a.waktu) || new Date(0);
    var bd = toSafeDate_(b.waktu) || new Date(0);
    return bd.getTime() - ad.getTime();
  });

  return docs[0] || null;
}

function buildCustomerDocumentationImageUrl_(doc) {
  // Kompatibilitas lama: kembalikan URL prioritas pertama.
  var urls = buildCustomerDocumentationImageUrls_(doc);
  return urls.length ? urls[0] : '';
}

function buildCustomerDocumentationImageUrls_(doc) {
  doc = doc || {};
  var link = String(doc.link || '').trim();
  var mediaUrl = String(doc.mediaUrl || '').trim();
  var fileId = getDriveFileIdFromUrl_(link);
  var urls = [];

  function addUrl_(u) {
    u = String(u || '').trim();
    if (!u) return;
    if (urls.indexOf(u) === -1) urls.push(u);
  }

  // V10.9.78:
  // Coba format lh3 lebih awal karena sebagian WA API lebih mudah fetch
  // URL image langsung dibanding halaman/redirect Drive biasa.
  if (fileId) {
    addUrl_('https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w1280');
    addUrl_('https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w800');
    addUrl_('https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId));
    addUrl_(buildDriveThumbnailUrl_(link, 'w1280'));
    addUrl_(buildDriveThumbnailUrl_(link, 'w800'));
    addUrl_('https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId));
    addUrl_('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId));
    addUrl_('https://drive.usercontent.google.com/download?id=' + encodeURIComponent(fileId) + '&export=view&authuser=0');
    addUrl_(buildDriveDownloadUrl_(link));
  }

  // Fallback kalau foto berasal dari provider WA dan link aslinya masih aktif.
  addUrl_(mediaUrl);
  addUrl_(link);

  return urls;
}



function buildCustomerCompletionPhotoCaption_(aduan, doc) {
  aduan = aduan || {};
  doc = doc || {};
  var catatanFoto = String(doc.caption || doc.catatan || '').trim();

  // V10.9.124:
  // Caption foto selesai digabung dengan pesan selesai agar pelanggan hanya menerima 1 chat.
  // Notifikasi ke pelanggan tetap tidak menampilkan nama personal petugas/cabang.
  var lines = [
    'Laporan Anda telah selesai ditindaklanjuti oleh petugas PERUMDAM Tirta Ardhia Rinjani.',
    '',
    '*Dokumentasi Penanganan Selesai*',
    '',
    'ID Aduan: *' + (aduan.id || doc.id || '-') + '*',
    'Petugas: Tim Teknis'
  ];

  if (catatanFoto) lines.push('Catatan: ' + catatanFoto);

  lines.push('');
  lines.push('Terima kasih atas partisipasi Anda dalam membantu kami meningkatkan pelayanan air bersih.');

  return lines.join('\n');
}

function buildCustomerCompletionNoPhotoMessage_(aduan) {
  aduan = aduan || {};
  var catatan = String(aduan.catatan || '').trim();
  var lines = [
    'Laporan Anda telah selesai ditindaklanjuti oleh petugas PERUMDAM Tirta Ardhia Rinjani.',
    '',
    'ID Aduan: *' + (aduan.id || '-') + '*',
    'Petugas: Tim Teknis'
  ];

  if (catatan) lines.push('Catatan: ' + catatan);

  lines.push('');
  lines.push('Terima kasih atas partisipasi Anda dalam membantu kami meningkatkan pelayanan air bersih.');

  return lines.join('\n');
}

function buildCustomerDoneNavButtons_() {
  return [
    { id: 'MENU_3_ADUAN_SAYA', title: 'Cek Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}


function isKiriminMediaSendAccepted_(result) {
  if (!result || !result.success) return false;

  var text = String(result.response || result.error || '').trim();
  if (!text) return true;

  try {
    var obj = JSON.parse(text);

    // Banyak API mengembalikan HTTP 200 tapi isi JSON-nya gagal.
    if (obj.success === false || obj.status === false || obj.status === 'false') return false;
    if (obj.error || obj.errors) return false;

    var msg = String(obj.message || obj.msg || '').toLowerCase();
    if (msg.indexOf('invalid') !== -1 || msg.indexOf('error') !== -1 || msg.indexOf('failed') !== -1 || msg.indexOf('gagal') !== -1) {
      return false;
    }

    return true;
  } catch(e) {
    var lower = text.toLowerCase();
    if (lower.indexOf('"success":false') !== -1 || lower.indexOf('"status":false') !== -1 || lower.indexOf('invalid') !== -1 || lower.indexOf('error') !== -1 || lower.indexOf('failed') !== -1 || lower.indexOf('gagal') !== -1) {
      return false;
    }
    return true;
  }
}


function summarizeKiriminMediaErrors_(errors) {
  errors = errors || [];
  return errors.slice(0, 6).map(function(e) {
    var txt = String((e && (e.error || e.response || '')) || '').replace(/\s+/g, ' ').trim();
    if (txt.length > 220) txt = txt.substring(0, 220) + '...';
    return 'Attempt ' + (e.attempt || '-') + ' HTTP ' + (e.statusCode || '-') + ': ' + txt;
  }).join(' | ');
}

function sendKiriminImageByPhoneNumber_(phone, imageUrl, caption) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  imageUrl = String(imageUrl || '').trim();
  caption = String(caption || '').trim();

  if (!endpoint || !token) return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk kirim foto.' };
  if (!imageUrl) return { success: false, error: 'URL foto kosong.' };

  // V10.9.79:
  // Error dari Kirimin:
  // {"error":{"code":"ValidationError","message":"media_url is required for media messages"}}
  // Jadi media_url harus berada di level utama payload, bukan di image.url / image.link.
  var attempts = [
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'media',
      media_url: imageUrl,
      caption: caption
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'image',
      media_url: imageUrl,
      caption: caption
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'media',
      media_url: imageUrl,
      media_type: 'image',
      caption: caption
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'media',
      media_url: imageUrl,
      type: 'image',
      caption: caption
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'file',
      media_url: imageUrl,
      caption: caption
    },

    // Fallback lama jika provider menerima format lain.
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'image',
      image_url: imageUrl,
      caption: caption
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'image',
      content: { url: imageUrl, caption: caption }
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'media',
      media: { type: 'image', url: imageUrl, caption: caption }
    }
  ];

  var errors = [];
  for (var i = 0; i < attempts.length; i++) {
    var result = postKiriminJson_(endpoint, token, attempts[i]);
    if (isKiriminMediaSendAccepted_(result)) {
      result.mediaAttempt = i + 1;
      result.imageUrl = imageUrl;
      return result;
    }
    errors.push({
      attempt: i + 1,
      statusCode: result && result.statusCode,
      response: result && result.response,
      error: result && (result.error || result.response),
      requestBody: attempts[i]
    });
  }

  return {
    success: false,
    error: 'Semua format payload foto gagal.',
    errorSummary: summarizeKiriminMediaErrors_(errors),
    attempts: errors,
    imageUrl: imageUrl
  };
}


function sendKiriminImageButtonMessageByPhoneNumber_(phone, imageUrl, caption, buttons) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  imageUrl = String(imageUrl || '').trim();
  caption = String(caption || '').trim();

  if (!endpoint || !token) return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk kirim foto.' };
  if (!imageUrl) return { success: false, error: 'URL foto kosong.' };

  var btnPayload = (buttons || []).slice(0, 3).map(function(btn) {
    return {
      type: 'reply',
      reply: {
        id: String(btn.id || btn.title || '').substring(0, 256),
        title: String(btn.title || 'Menu').substring(0, 20)
      }
    };
  });

  if (!btnPayload.length) {
    btnPayload = buildCustomerDoneNavButtons_().map(function(btn) {
      return {
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title
        }
      };
    });
  }

  // V10.9.124:
  // Coba kirim 1 chat berisi foto, caption, dan tombol.
  // Format utama mengikuti pola WhatsApp Cloud API interactive button dengan header image.
  var attempts = [
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'image',
          image: { link: imageUrl }
        },
        body: { text: caption },
        action: { buttons: btnPayload }
      }
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'image',
          image: { url: imageUrl }
        },
        body: { text: caption },
        action: { buttons: btnPayload }
      }
    },
    {
      phone_number: phoneNumber,
      channel: 'whatsapp',
      message_type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'image',
          media_url: imageUrl
        },
        body: { text: caption },
        action: { buttons: btnPayload }
      }
    }
  ];

  var errors = [];
  for (var i = 0; i < attempts.length; i++) {
    var result = postKiriminJson_(endpoint, token, attempts[i]);
    if (isKiriminMediaSendAccepted_(result)) {
      result.mediaButtonAttempt = i + 1;
      result.imageUrl = imageUrl;
      return result;
    }
    errors.push({
      attempt: i + 1,
      statusCode: result && result.statusCode,
      response: result && result.response,
      error: result && (result.error || result.response),
      requestBody: attempts[i]
    });
  }

  return {
    success: false,
    error: 'Semua format payload foto + tombol gagal.',
    errorSummary: summarizeKiriminMediaErrors_(errors),
    attempts: errors,
    imageUrl: imageUrl
  };
}




function sendCustomerCompletionPhotoIfAvailable_(phone, aduan, source) {
  aduan = aduan || {};
  var id = normalizeAduanIdHyphen_(aduan.id || '');
  phone = normalizePhone_(phone || aduan.noHp || '');

  if (!id || !phone) return { success: true, skipped: true, reason: 'ID/No HP kosong.' };

  var doc = getBestAduanPhotoForCustomer_(id);
  if (!doc) return { success: true, skipped: true, reason: 'Dokumentasi belum tersedia.' };

  var urls = buildCustomerDocumentationImageUrls_(doc);
  if (!urls.length) return { success: true, skipped: true, reason: 'URL dokumentasi tidak tersedia.' };

  var caption = buildCustomerCompletionPhotoCaption_(aduan, doc);
  var buttons = buildCustomerDoneNavButtons_();
  var attempts = [];
  var sendResult = null;

  // V10.9.124: prioritas kirim 1 chat: foto + caption + tombol.
  for (var i = 0; i < urls.length; i++) {
    var oneUrl = urls[i];
    var oneResult = sendKiriminImageButtonMessageByPhoneNumber_(phone, oneUrl, caption, buttons);
    attempts.push({
      mode: 'image_button',
      url: oneUrl,
      success: !!(oneResult && oneResult.success),
      error: oneResult && (oneResult.errorSummary || oneResult.error || oneResult.response || '')
    });

    if (oneResult && oneResult.success) {
      sendResult = oneResult;
      try { sendResult.mode = 'image_button'; } catch(eMode) {}
      break;
    }
  }

  // Fallback: kalau provider belum mendukung header foto + tombol, tetap kirim foto 1 chat.
  // Tombol tidak dipaksa sebagai chat kedua agar notifikasi selesai tidak dobel.
  if (!sendResult) {
    for (var j = 0; j < urls.length; j++) {
      var fallbackUrl = urls[j];
      var fallbackResult = sendKiriminImageByPhoneNumber_(phone, fallbackUrl, caption);
      attempts.push({
        mode: 'image_only',
        url: fallbackUrl,
        success: !!(fallbackResult && fallbackResult.success),
        error: fallbackResult && (fallbackResult.errorSummary || fallbackResult.error || fallbackResult.response || '')
      });

      if (fallbackResult && fallbackResult.success) {
        sendResult = fallbackResult;
        try { sendResult.mode = 'image_only_fallback'; } catch(eFallbackMode) {}
        break;
      }
    }
  }

  if (!sendResult) {
    sendResult = {
      success: false,
      error: 'Semua URL foto gagal dikirim.',
      errorSummary: attempts.map(function(a, idx) {
        var t = String(a.error || '').replace(/\s+/g, ' ').trim();
        if (t.length > 180) t = t.substring(0, 180) + '...';
        return (a.mode || 'url') + ' ' + (idx + 1) + ': ' + t;
      }).join(' | '),
      attempts: attempts
    };
  } else {
    try { sendResult.urlAttempts = attempts; } catch(eAttach) {}
  }

  logWhatsApp_(
    phone,
    'Kirim notifikasi selesai foto ke pelanggan',
    'CUSTOMER_DONE_PHOTO',
    id,
    caption,
    (sendResult && sendResult.success) ? 'TERKIRIM' : 'GAGAL',
    JSON.stringify({ source: source || '-', doc: doc, sendResult: sendResult })
  );

  return sendResult;
}

function sendCustomerCompletionDoneNotification_(phone, aduan, source) {
  aduan = aduan || {};
  var id = normalizeAduanIdHyphen_(aduan.id || '');
  phone = normalizePhone_(phone || aduan.noHp || '');

  if (!id || !phone) return { success: true, skipped: true, reason: 'ID/No HP kosong.' };

  var doc = null;
  try { doc = getBestAduanPhotoForCustomer_(id); } catch(eDoc) { doc = null; }

  if (doc) {
    var photoResult = sendCustomerCompletionPhotoIfAvailable_(phone, aduan, source || 'STATUS_DONE');
    if (photoResult && photoResult.success) return photoResult;

    // Kalau foto gagal terkirim, tetap kirim teks dengan tombol supaya pelanggan dapat info selesai.
    var fallbackText = buildCustomerCompletionNoPhotoMessage_(aduan) + '\n\nDokumentasi tersedia, tetapi foto belum berhasil dikirim otomatis. Silakan tekan *Cek Aduan* untuk melihat status aduan.';
    var fallbackSend = sendKiriminButtonMessage_(phone, fallbackText, buildCustomerDoneNavButtons_());
    try { fallbackSend.photoResult = photoResult; } catch(eAttach) {}
    return fallbackSend;
  }

  var message = buildCustomerCompletionNoPhotoMessage_(aduan);
  return sendKiriminButtonMessage_(phone, message, buildCustomerDoneNavButtons_());
}




function notifyCustomerStatusChange_(aduan, oldStatus, newStatus, source, catatan) {
  aduan = aduan || {};
  if (String(getSiagaRuntimeSetting_('NOTIF_STATUS_PELANGGAN_ENABLED', 'YA')).toUpperCase() === 'TIDAK') {
    try {
      logStatusNotif_(aduan.id || '', normalizePhone_(aduan.noHp || ''), oldStatus || '', newStatus || aduan.status || '', false, 'SKIP_DISABLED', 'Notifikasi status pelanggan sedang NONAKTIF dari Pengaturan Admin.', '', 'NOTIF_STATUS_PELANGGAN_DISABLED_V1097');
    } catch(e) {}
    return { success: true, skipped: true, disabled: true, reason: 'Notifikasi status pelanggan nonaktif.' };
  }
  var id = aduan.id || '';
  var phone = normalizePhone_(aduan.noHp || '');

  oldStatus = String(oldStatus || '').trim();
  newStatus = String(newStatus || aduan.status || '').trim();

  if (!id || !phone || !newStatus) {
    logStatusNotif_(id, phone, oldStatus, newStatus, false, 'SKIP', 'ID/No HP/Status kosong.', '', JSON.stringify(aduan || {}));
    return { success: true, skipped: true, reason: 'ID/No HP/Status kosong.' };
  }

  if (oldStatus && oldStatus.toLowerCase() === newStatus.toLowerCase()) {
    logStatusNotif_(id, phone, oldStatus, newStatus, true, 'SKIP', 'Status tidak berubah.', '', '');
    return { success: true, skipped: true, reason: 'Status tidak berubah.' };
  }

  var windowInfo = isWithinWhatsApp24hWindow_(phone);
  if (!windowInfo.ok) {
    logStatusNotif_(
      id,
      phone,
      oldStatus,
      newStatus,
      false,
      'TIDAK TERKIRIM',
      windowInfo.reason + ' Pelanggan bisa cek manual.',
      windowInfo.lastInboundAt || '',
      'Source: ' + (source || '-')
    );

    return {
      success: true,
      skipped: true,
      reason: windowInfo.reason,
      windowActive: false
    };
  }

  try { setLastCheckedAduanIdForPhone_(phone, id); } catch(cacheErr) {}

  var sendResult = null;

  // V10.9.124:
  // Status Selesai tidak lagi dikirim sebagai chat teks + foto terpisah.
  // Jika ada Foto Selesai, kirim 1 chat berisi foto, caption, dan tombol.
  // Jika tidak ada foto, kirim 1 chat teks dengan tombol.
  if (String(newStatus || '').toLowerCase() === 'selesai') {
    try {
      sendResult = sendCustomerCompletionDoneNotification_(phone, aduan, source || 'STATUS_NOTIFY');
    } catch(doneErr) {
      sendResult = { success: false, error: doneErr.message || String(doneErr) };
      logWhatsApp_(phone, 'Kirim notifikasi selesai error', 'CUSTOMER_DONE_NOTIFY', id, '', 'ERROR', JSON.stringify(sendResult));
    }
  } else {
    var message = buildCustomerStatusChangeMessage_(aduan, oldStatus, newStatus, catatan);
    var navButtons = buildStatusNavButtonsForAduan_(aduan);
    sendResult = sendKiriminButtonMessage_(phone, message, navButtons);
  }

  if (sendResult && sendResult.success) {
    logStatusNotif_(
      id,
      phone,
      oldStatus,
      newStatus,
      true,
      'TERKIRIM',
      windowInfo.reason,
      windowInfo.lastInboundAt || '',
      JSON.stringify(sendResult || {})
    );

    return {
      success: true,
      sent: true,
      windowActive: true,
      result: sendResult
    };
  }

  logStatusNotif_(
    id,
    phone,
    oldStatus,
    newStatus,
    true,
    'GAGAL KIRIM',
    (sendResult && (sendResult.error || sendResult.response)) || 'Gagal kirim pesan.',
    windowInfo.lastInboundAt || '',
    JSON.stringify(sendResult || {})
  );

  return {
    success: false,
    sent: false,
    windowActive: true,
    result: sendResult
  };
}


function notifyCustomerStatusChangeByRow_(sheet, rowNumber, oldStatus, newStatus, source, catatan) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  rowNumber = Number(rowNumber || 0);
  if (!sheet || rowNumber < 2) return { success: true, skipped: true, reason: 'Sheet/row tidak valid.' };

  var lastCol = Math.max(sheet.getLastColumn(), 20);
  var row = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  var aduan = parseAduanRowForTracking_(row);

  newStatus = String(newStatus || aduan.status || '').trim();
  oldStatus = String(oldStatus || '').trim();

  // Update timestamp perubahan status.
  try {
    if (CONFIG.COL.UPDATED_AT) sheet.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(new Date());
  } catch(e) {}

  // Kalau status selesai dan waktu selesai masih kosong, isi otomatis.
  try {
    if (newStatus.toLowerCase() === 'selesai' && CONFIG.COL.WAKTU_SELESAI && !row[CONFIG.COL.WAKTU_SELESAI - 1]) {
      sheet.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(new Date());
      aduan.waktuSelesai = formatDateForWa_(new Date());
    }
  } catch(e) {}

  aduan.status = newStatus;
  try { invalidateAduanFindCacheById_(aduan.id); } catch(e) {}
  return notifyCustomerStatusChange_(aduan, oldStatus, newStatus, source || 'EDIT_SHEET', catatan);
}

function handleAduanStatusEditTrigger(e) {
  try {
    if (!e || !e.range) return;

    var range = e.range;
    var sheet = range.getSheet();
    if (!sheet || sheet.getName() !== CONFIG.SHEET_NAME) return;

    var statusCol = CONFIG.COL.STATUS || 10;
    var startCol = range.getColumn();
    var endCol = startCol + range.getNumColumns() - 1;
    if (statusCol < startCol || statusCol > endCol) return;

    var startRow = range.getRow();
    var numRows = range.getNumRows();
    if (startRow < 2) return;

    // Untuk edit satu sel, e.oldValue tersedia.
    // Untuk paste banyak baris, oldValue biasanya kosong; tetap dicatat sebagai perubahan massal.
    for (var r = startRow; r < startRow + numRows; r++) {
      if (r < 2) continue;

      var newStatus = String(sheet.getRange(r, statusCol).getValue() || '').trim();
      var oldStatus = (numRows === 1 && range.getNumColumns() === 1) ? String(e.oldValue || '').trim() : '';

      if (!newStatus) continue;
      if (oldStatus && oldStatus.toLowerCase() === newStatus.toLowerCase()) continue;

      // Pastikan sheet cabang ikut update jika status diedit langsung dari ADUAN.
      try { syncAduanRowToCabangMirror_(sheet, r); } catch(syncErr) {}

      notifyCustomerStatusChangeByRow_(sheet, r, oldStatus, newStatus, 'ON_EDIT_STATUS');
    }

  } catch(err) {
    try {
      logStatusNotif_('-', '-', '-', '-', false, 'ERROR_TRIGGER', err.message || String(err), '', err.stack || '');
    } catch(e2) {}
  }
}

function installStatusNotificationTrigger() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

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

  ui.alert(
    '✅ Trigger notifikasi status aktif',
    'Mulai sekarang, jika kolom Status di sheet ADUAN diedit manual, sistem akan mencoba mengirim notifikasi ke pelanggan hanya jika window 24 jam masih aktif.\n\nJika window sudah lewat, sistem hanya mencatat ke LOG_NOTIF_STATUS.',
    ui.ButtonSet.OK
  );
}

function testCustomerStatusNotificationById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Tes Notifikasi Status Pelanggan',
    'Masukkan ID Aduan. Contoh: PRY7K2A',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = idPrompt.getResponseText().trim();
  var aduan = findAduanById_(id);
  if (!aduan) {
    ui.alert('ID tidak ditemukan.');
    return;
  }

  var statusPrompt = ui.prompt(
    'Tes Notifikasi Status Pelanggan',
    'Masukkan status baru untuk simulasi.\nContoh: Proses / Selesai / Ditunda',
    ui.ButtonSet.OK_CANCEL
  );
  if (statusPrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = notifyCustomerStatusChange_(aduan, aduan.status, statusPrompt.getResponseText().trim(), 'TEST_MANUAL');

  ui.alert(
    result.sent ? '✅ Notifikasi terkirim' : (result.skipped ? '⚠️ Notifikasi tidak dikirim' : '❌ Gagal kirim'),
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function cekWindow24JamPelangganById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Cek Window 24 Jam Pelanggan',
    'Masukkan ID Aduan.',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var aduan = findAduanById_(idPrompt.getResponseText().trim());
  if (!aduan) {
    ui.alert('ID tidak ditemukan.');
    return;
  }

  var info = isWithinWhatsApp24hWindow_(aduan.noHp);

  ui.alert(
    info.ok ? '✅ Window 24 jam masih aktif' : '⚠️ Window 24 jam tidak aktif',
    'No HP: ' + aduan.noHp + '\n' +
    'Chat terakhir: ' + (info.lastInboundAt ? formatDateForWa_(info.lastInboundAt) : '-') + '\n' +
    'Alasan: ' + info.reason,
    ui.ButtonSet.OK
  );
}
