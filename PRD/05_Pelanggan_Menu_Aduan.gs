// ============================================================
// SIAGA TIARA V10.9.289 - MODUL: 05_Pelanggan_Menu_Aduan.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

// V11: cache hanya untuk satu eksekusi webhook. Ini mencegah 4-7 pembacaan
// session yang sama dalam satu pesan tanpa membuat session antarpesan menjadi basi.
var WA_SESSION_REQUEST_CACHE_ = {};

function resetWhatsAppSessionRequestCache_() {
  WA_SESSION_REQUEST_CACHE_ = {};
}

function getWhatsAppSessionFromRequestCache_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone || !Object.prototype.hasOwnProperty.call(WA_SESSION_REQUEST_CACHE_, phone)) {
    return { found: false, value: null };
  }
  return { found: true, value: WA_SESSION_REQUEST_CACHE_[phone] };
}

function putWhatsAppSessionInRequestCache_(phone, session) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  WA_SESSION_REQUEST_CACHE_[phone] = session || null;
}

function isFastAduanCommand_(text) {
  text = String(text || '').trim().toLowerCase();
  var norm = text
    .replace(/pemgadua+n/g, 'pengaduan')
    .replace(/pengadua+n/g, 'pengaduan')
    .replace(/adua+n/g, 'aduan')
    .replace(/lapo+r/g, 'lapor');

  // V10.9.236:
  // Jangan langsung masuk alur Buat Aduan jika pelanggan sebenarnya sedang bertanya.
  // Contoh: "kalau aduan butuh isi data apa saja kak?" harus dijawab AI dulu,
  // bukan langsung menampilkan daftar cabang.
  var isQuestionAboutAduan = /(apa\s*saja|apa\s*aja|data\s*apa|isi\s*data|format|contoh|syarat|cara|gimana|bagaimana|butuh|perlu|panduan|bingung|paham|mengisi|ngisi|isian|lengkapi|melengkapi|bisa\s*bantu|tolong)/i.test(norm) && /(aduan|pengaduan|laporan|lapor|keluhan|gangguan)/i.test(norm);
  if (isQuestionAboutAduan) return false;

  // Jangan salah arahkan cek status aduan menjadi Buat Aduan.
  var isStatusContext = /(status|progres|progress|cek|riwayat|sudah|belum|belom|dikerjakan|ditangani|selesai|tiket)/i.test(norm);

  return norm === 'aduan cepat' ||
         norm === 'lapor cepat' ||
         norm === 'input cepat' ||
         norm === 'quick aduan' ||
         norm === 'lapor gangguan' ||
         norm === 'laporan gangguan' ||
         norm === 'pengaduan gangguan' ||
         norm === 'gangguan air' ||
         norm.indexOf('aduan cepat') !== -1 ||
         norm.indexOf('lapor cepat') !== -1 ||
         norm.indexOf('lapor gangguan') !== -1 ||
         norm.indexOf('laporan gangguan') !== -1 ||
         norm.indexOf('pengaduan gangguan') !== -1 ||
         (!isStatusContext && /(^|\b)(saya|sy|aku|mau|ingin|buat|bikin|lapor|ajukan|pengaduan|aduan|keluhan)(\b|$)/i.test(norm) && /(pengaduan|aduan|keluhan|lapor)/i.test(norm));
}

function handleMainMenuChoice_(message, phone) {
  var choice = String(message || '').trim().toLowerCase();

  // V10.9.115:
  // Menu publik disederhanakan. Buat Aduan Baru/terpandu tidak ditampilkan lagi.
  // Menu "Buat Aduan" sekarang memakai alur satu pesan yang sebelumnya bernama Aduan Cepat.
  var wantsNewAduan = false;

  var wantsFastAduan = (
    choice === '1' ||
    isFastAduanCommand_(choice) ||
    choice.indexOf('buat aduan') !== -1 ||
    choice.indexOf('aduan baru') !== -1 ||
    choice.indexOf('lapor gangguan') !== -1 ||
    choice.indexOf('laporkan gangguan') !== -1
  );

  if ((wantsNewAduan || wantsFastAduan) && shouldBlockNewAduanOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: wantsFastAduan ? 'OUTSIDE_HOURS_BLOCK_FAST_ADUAN' : 'OUTSIDE_HOURS_BLOCK_NEW_ADUAN',
      reply: buildOutsideHoursBlockedReply_('Buat Aduan'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  if (wantsNewAduan) {
    clearCustomerInvalidInputCountersForPhone_(phone);
    var activeLimit = buildActiveLimitResult_(phone);
    if (activeLimit.blocked) return activeLimit.result;

    setWhatsAppSession_(phone, 'NEW_CABANG', {
      activeCheckedAt: new Date().getTime(),
      activeCount: activeLimit.info ? activeLimit.info.count : 0
    });
    return {
      success: true,
      type: 'ASK_CABANG',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (wantsFastAduan) {
    clearCustomerInvalidInputCountersForPhone_(phone);
    var fastLimit = buildActiveLimitResult_(phone);
    if (fastLimit.blocked) return fastLimit.result;

    setWhatsAppSession_(phone, 'FAST_CABANG', {
      activeCheckedAt: new Date().getTime(),
      activeCount: fastLimit.info ? fastLimit.info.count : 0,
      mode: 'BUAT_ADUAN'
    });
    return {
      success: true,
      type: 'ASK_CABANG',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (choice === '3' || isCekTagihanCommand_(choice)) {
    clearCustomerInvalidInputCountersForPhone_(phone);
    return handleStartCekTagihan_(phone);
  }

  if (choice === '2' || choice.indexOf('cek status') !== -1 || choice.indexOf('status aduan') !== -1 || choice === 'status' || choice === 'cek' || choice.indexOf('lihat') !== -1 || choice.indexOf('riwayat') !== -1 || choice.indexOf('aduan saya') !== -1 || choice.indexOf('aduan aktif') !== -1) {
    clearCustomerInvalidInputCountersForPhone_(phone);
    return handleCekStatusAduan_(phone);
  }

  if (choice === '4' || choice === '5' || choice.indexOf('info') !== -1 || choice.indexOf('layanan') !== -1 || choice.indexOf('pembayaran') !== -1 || choice.indexOf('bayar') !== -1 || choice.indexOf('kendala') !== -1) {
    clearCustomerInvalidInputCountersForPhone_(phone);
    return handleInfoPembayaranChoice_(choice, phone);
  }

  if (choice.indexOf('admin') !== -1 || choice.indexOf('petugas') !== -1 || choice.indexOf('operator') !== -1) {
    return handleAdminHandoff_(phone, 'Admin');
  }

  var mainAiResult = handleCustomerVirtualAssistantFreeText_(message, phone, {}, { state: 'MAIN', data: {} });
  if (mainAiResult) return mainAiResult;

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU_FALLBACK',
    reply: buildMainWhatsAppMenuReply_(phone, {})
  };
}

function getBusinessHoursConfig_() {
  var props = PropertiesService.getScriptProperties();

  return {
    enabled: String(props.getProperty('BUSINESS_HOURS_ENABLED') || CONFIG.BUSINESS_HOURS_ENABLED || 'YA').toUpperCase() !== 'TIDAK',
    start: props.getProperty('BUSINESS_HOURS_START') || CONFIG.BUSINESS_HOURS_START || '08:00',
    end: props.getProperty('BUSINESS_HOURS_END') || CONFIG.BUSINESS_HOURS_END || '16:00',
    days: props.getProperty('BUSINESS_HOURS_DAYS') || CONFIG.BUSINESS_HOURS_DAYS || '1,2,3,4,5',
    timezone: props.getProperty('BUSINESS_HOURS_TIMEZONE') || CONFIG.BUSINESS_HOURS_TIMEZONE || Session.getScriptTimeZone()
  };
}

function isWithinBusinessHours_() {
  var cfg = getBusinessHoursConfig_();
  if (!cfg.enabled) return true;

  var now = new Date();
  var tz = cfg.timezone || Session.getScriptTimeZone();

  var day = Number(Utilities.formatDate(now, tz, 'u')); // 1 Senin - 7 Minggu
  var allowedDays = String(cfg.days || '1,2,3,4,5')
    .split(',')
    .map(function(x) { return Number(String(x).trim()); })
    .filter(Boolean);

  if (allowedDays.indexOf(day) === -1) return false;

  var currentMinutes = timeTextToMinutes_(Utilities.formatDate(now, tz, 'HH:mm'));
  var startMinutes = timeTextToMinutes_(cfg.start || '08:00');
  var endMinutes = timeTextToMinutes_(cfg.end || '16:00');

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Untuk shift melewati tengah malam.
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function timeTextToMinutes_(text) {
  var parts = String(text || '00:00').split(':');
  var h = Number(parts[0] || 0);
  var m = Number(parts[1] || 0);
  return h * 60 + m;
}

function getBusinessHoursLabel_() {
  var cfg = getBusinessHoursConfig_();
  var dayLabel = 'Senin–Jumat';
  var days = String(cfg.days || '').replace(/\s/g, '');

  if (days === '1,2,3,4,5,6') dayLabel = 'Senin–Sabtu';
  if (days === '1,2,3,4,5,6,7') dayLabel = 'Setiap hari';

  return dayLabel + ' pukul ' + (cfg.start || '08:00') + '–' + (cfg.end || '16:00') + ' WITA';
}

function buildOutsideBusinessHoursNotice_() {
  return [
    'Saat ini layanan admin berada di luar jam kerja.',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Aduan tetap dapat dibuat melalui sistem dan akan tercatat otomatis.',
    'Untuk kondisi darurat, laporan akan tetap diteruskan ke petugas/admin.'
  ].join('\n');
}

function maybeAppendBusinessHoursNotice_(reply, type) {
  // V10.9.3:
  // Di luar jam kerja tidak lagi sekadar menambah notice.
  // Akses pembuatan aduan/admin diblokir langsung di handler menu.
  // Cek status dan lihat aduan tetap bersih.
  return reply;
}


function isRestrictedOutsideHours_() {
  return !isWithinBusinessHours_();
}

function buildOutsideHoursLimitedMenuReply_(phone, payload) {
  return [
    buildWhatsAppOpeningGreeting_(phone, payload),
    '',
    'Saat ini layanan admin berada di luar jam kerja.',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Di luar jam kerja, layanan yang tersedia:',
    '',
    '• Cek Tagihan',
    '• Info Layanan',
    '• Cek Status Aduan',
    '',
    'Silakan gunakan tombol di bawah ini.',
    'Untuk cek status, pilih *Cek Status Aduan*. Sistem akan mencari dari nomor WhatsApp ini, atau Anda bisa kirim ID aduan.',
    'Jika sudah memiliki tiket, Anda juga bisa mengirim langsung *ID Aduan*.'
  ].join('\n');
}

function buildOutsideHoursBlockedReply_(featureName) {
  return [
    'Mohon maaf, layanan *' + (featureName || 'ini') + '* belum tersedia di luar jam kerja.',
    '',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Yang masih bisa digunakan saat ini:',
    '• *Cek Tagihan*',
    '• *Info Layanan*',
    '• *Cek Status Aduan*',
    '',
    'Silakan gunakan tombol di bawah ini.',
    'Untuk cek status, pilih *Cek Status Aduan*. Sistem akan mencari dari nomor WhatsApp ini, atau Anda bisa kirim ID aduan.',
    'Jika sudah memiliki tiket, Anda juga bisa mengirim langsung *ID Aduan*.'
  ].join('\n');
}

function shouldBlockNewAduanOutsideHours_() {
  return isRestrictedOutsideHours_();
}


function setBusinessHoursConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var enabledPrompt = ui.prompt(
    '1/4 - Aktifkan Jam Kerja?',
    'Isi YA atau TIDAK. Default: YA',
    ui.ButtonSet.OK_CANCEL
  );
  if (enabledPrompt.getSelectedButton() !== ui.Button.OK) return;

  var startPrompt = ui.prompt(
    '2/4 - Jam Mulai',
    'Contoh: 08:00',
    ui.ButtonSet.OK_CANCEL
  );
  if (startPrompt.getSelectedButton() !== ui.Button.OK) return;

  var endPrompt = ui.prompt(
    '3/4 - Jam Selesai',
    'Contoh: 16:00',
    ui.ButtonSet.OK_CANCEL
  );
  if (endPrompt.getSelectedButton() !== ui.Button.OK) return;

  var daysPrompt = ui.prompt(
    '4/4 - Hari Kerja',
    'Isi angka hari dipisah koma.\n1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu\n\nContoh Senin-Jumat: 1,2,3,4,5\nContoh Senin-Sabtu: 1,2,3,4,5,6',
    ui.ButtonSet.OK_CANCEL
  );
  if (daysPrompt.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('BUSINESS_HOURS_ENABLED', enabledPrompt.getResponseText().trim().toUpperCase() || 'YA');
  props.setProperty('BUSINESS_HOURS_START', startPrompt.getResponseText().trim() || '08:00');
  props.setProperty('BUSINESS_HOURS_END', endPrompt.getResponseText().trim() || '16:00');
  props.setProperty('BUSINESS_HOURS_DAYS', daysPrompt.getResponseText().trim() || '1,2,3,4,5');
  props.setProperty('BUSINESS_HOURS_TIMEZONE', 'Asia/Makassar');

  ui.alert(
    '✅ Jam kerja tersimpan',
    'Jam layanan admin: ' + getBusinessHoursLabel_(),
    ui.ButtonSet.OK
  );
}

function testBusinessHoursMessage() {
  var ui = SpreadsheetApp.getUi();
  var inside = isWithinBusinessHours_();

  ui.alert(
    inside ? '✅ Sekarang masih dalam jam kerja' : '⚠️ Sekarang di luar jam kerja',
    'Jam layanan admin: ' + getBusinessHoursLabel_() + '\n\n' + buildOutsideBusinessHoursNotice_(),
    ui.ButtonSet.OK
  );
}



// ============================================================
// V10.9.150 - NAMA PENGGUNA WHATSAPP DI SAPAAN MENU PELANGGAN
// Jika Kirimin mengirim nama profil customer, sapaan menu utama memakai nama tersebut.
// Fallback tetap "Sahabat Tiara" jika nama tidak tersedia.
// ============================================================
function cleanWhatsAppCustomerName_(name, phone) {
  name = String(name || '').trim();
  if (!name) return '';

  name = name.replace(/\s+/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^@+/, '')
    .trim();

  var lower = name.toLowerCase();
  if (!lower || lower === 'null' || lower === 'undefined' || lower === 'unknown' || lower === 'customer' || lower === 'pelanggan') return '';

  var normalizedPhone = normalizePhone_(phone || '');
  var digitsOnly = name.replace(/\D/g, '');
  if (normalizedPhone && digitsOnly && digitsOnly === normalizedPhone) return '';
  if (/^[+\d\s\-()]{8,}$/.test(name)) return '';

  // Hindari nama terlalu panjang agar pesan WA tetap rapi.
  if (name.length > 40) name = name.substring(0, 40).trim();

  return name;
}

function extractCustomerNameFromPayload_(obj) {
  obj = obj || {};
  var data = obj.data || {};

  function dg(base, path) {
    try { return deepGet_(base || {}, path); } catch(e) { return ''; }
  }

  var candidates = [
    data.customer_name,
    data.customerName,
    data.sender_name,
    data.senderName,
    data.sender_full_name,
    data.senderFullName,
    data.from_name,
    data.fromName,
    data.push_name,
    data.pushName,
    data.profile_name,
    data.profileName,
    data.name,
    data.full_name,
    data.fullName,
    data.contact_name,
    data.contactName,
    data.customer && data.customer.name,
    data.customer && data.customer.full_name,
    data.customer && data.customer.fullName,
    data.contact && data.contact.name,
    data.contact && data.contact.full_name,
    data.profile && data.profile.name,
    obj.customer_name,
    obj.customerName,
    obj.sender_name,
    obj.senderName,
    obj.sender_full_name,
    obj.senderFullName,
    obj.from_name,
    obj.fromName,
    obj.push_name,
    obj.pushName,
    obj.profile_name,
    obj.profileName,
    obj.name,
    obj.full_name,
    obj.fullName,
    obj.contact_name,
    obj.contactName,
    obj.customer && obj.customer.name,
    obj.customer && obj.customer.full_name,
    obj.customer && obj.customer.fullName,
    obj.contact && obj.contact.name,
    obj.contact && obj.contact.full_name,
    obj.profile && obj.profile.name,
    obj.message && obj.message.customer && obj.message.customer.name,
    obj.message && obj.message.contact && obj.message.contact.name,
    data.message && data.message.customer && data.message.customer.name,
    data.message && data.message.contact && data.message.contact.name,
    dg(obj, 'payload.customer.name'),
    dg(obj, 'payload.contact.name'),
    dg(obj, 'event.customer.name'),
    dg(obj, 'event.contact.name'),
    dg(obj, 'conversation.customer.name'),
    dg(data, 'conversation.customer.name')
  ];

  for (var i = 0; i < candidates.length; i++) {
    var cleaned = cleanWhatsAppCustomerName_(candidates[i], '');
    if (cleaned) return cleaned;
  }
  return '';
}

function rememberWhatsAppCustomerName_(phone, name) {
  phone = normalizePhone_(phone || '');
  name = cleanWhatsAppCustomerName_(name, phone);
  if (!phone || !name) return '';

  var key = 'WA_CUSTOMER_NAME_' + phone;
  // Nama biasanya sama pada setiap pesan. Jangan tulis Script Properties berulang kali.
  try {
    var existingCachedName = cleanWhatsAppCustomerName_(cacheGet_(key) || '', phone);
    if (existingCachedName && existingCachedName === name) return name;
  } catch(eExistingCache) {}
  try { cachePut_(key, name, 21600); } catch(eCache) {}
  try {
    var props = PropertiesService.getScriptProperties();
    if (String(props.getProperty(key) || '') !== name) props.setProperty(key, name);
  } catch(eProp) {}
  return name;
}

function getRememberedWhatsAppCustomerName_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return '';
  var key = 'WA_CUSTOMER_NAME_' + phone;
  var cached = '';
  try { cached = cacheGet_(key) || ''; } catch(eCache) {}
  if (cached) return cleanWhatsAppCustomerName_(cached, phone);

  var prop = '';
  try { prop = PropertiesService.getScriptProperties().getProperty(key) || ''; } catch(eProp) {}
  prop = cleanWhatsAppCustomerName_(prop, phone);
  if (prop) {
    try { cachePut_(key, prop, 21600); } catch(ePut) {}
  }
  return prop;
}

function extractCustomerNameFromKiriminResponse_(obj, phone) {
  if (!obj) return '';

  function pickFrom(o) {
    o = o || {};
    var candidates = [
      o.name,
      o.full_name,
      o.fullName,
      o.customer_name,
      o.customerName,
      o.profile_name,
      o.profileName,
      o.push_name,
      o.pushName,
      o.contact_name,
      o.contactName,
      o.phone_name,
      o.whatsapp_name,
      o.whatsappName,
      o.data && o.data.name,
      o.data && o.data.full_name,
      o.data && o.data.fullName,
      o.data && o.data.customer_name,
      o.data && o.data.customerName,
      o.data && o.data.profile_name,
      o.data && o.data.profileName,
      o.data && o.data.push_name,
      o.data && o.data.pushName,
      o.data && o.data.contact_name,
      o.data && o.data.contactName,
      o.customer && o.customer.name,
      o.customer && o.customer.full_name,
      o.contact && o.contact.name,
      o.profile && o.profile.name,
      o.data && o.data.customer && o.data.customer.name,
      o.data && o.data.customer && o.data.customer.full_name,
      o.data && o.data.contact && o.data.contact.name,
      o.data && o.data.profile && o.data.profile.name
    ];

    for (var i = 0; i < candidates.length; i++) {
      var cleaned = cleanWhatsAppCustomerName_(candidates[i], phone);
      if (cleaned) return cleaned;
    }
    return '';
  }

  var direct = pickFrom(obj);
  if (direct) return direct;

  var arrays = [];
  if (Array.isArray(obj.data)) arrays.push(obj.data);
  if (obj.data && Array.isArray(obj.data.customers)) arrays.push(obj.data.customers);
  if (Array.isArray(obj.customers)) arrays.push(obj.customers);
  if (Array.isArray(obj.result)) arrays.push(obj.result);

  for (var a = 0; a < arrays.length; a++) {
    for (var j = 0; j < arrays[a].length; j++) {
      var name = pickFrom(arrays[a][j]);
      if (name) return name;
    }
  }

  return '';
}

function fetchKiriminCustomerNameByPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return '';

  var cacheKey = 'WA_CUSTOMER_NAME_LOOKUP_' + phone;
  var negKey = 'WA_CUSTOMER_NAME_LOOKUP_EMPTY_' + phone;

  try {
    var cached = cacheGet_(cacheKey);
    if (cached) return cleanWhatsAppCustomerName_(cached, phone);
    if (cacheGet_(negKey)) return '';
  } catch(eCache) {}

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  if (!token) return '';

  var endpointPattern = props.getProperty('WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT') ||
    CONFIG.WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}';

  var phoneVariants = buildPhoneVariantsForKirimin_(phone);
  var endpointVariants = buildCustomerByPhoneEndpointVariants_(endpointPattern, phoneVariants);

  for (var i = 0; i < endpointVariants.length; i++) {
    try {
      var res = UrlFetchApp.fetch(endpointVariants[i], {
        method: 'get',
        muteHttpExceptions: true,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json'
        }
      });

      var code = res.getResponseCode();
      if (code < 200 || code >= 300) continue;

      var obj = parseJsonSafe_(res.getContentText());
      var name = extractCustomerNameFromKiriminResponse_(obj, phone);
      if (name) {
        rememberWhatsAppCustomerName_(phone, name);
        try { cachePut_(cacheKey, name, 21600); } catch(ePut) {}
        return name;
      }
    } catch(err) {}
  }

  try { cachePut_(negKey, '1', 1800); } catch(eNeg) {}
  return '';
}

function getWhatsAppGreetingName_(phone, payload) {
  payload = payload || {};
  var fromPayload = cleanWhatsAppCustomerName_(payload.customerName || '', phone);
  if (fromPayload) {
    rememberWhatsAppCustomerName_(phone, fromPayload);
    return fromPayload;
  }

  var remembered = getRememberedWhatsAppCustomerName_(phone);
  if (remembered) return remembered;

  // V10.9.152: Jika webhook Kirimin tidak mengirim nama profil,
  // coba ambil nama customer dari endpoint customer berdasarkan nomor HP.
  var fromKiriminCustomer = fetchKiriminCustomerNameByPhone_(phone);
  if (fromKiriminCustomer) return fromKiriminCustomer;

  return 'Sahabat Tiara';
}

function buildWhatsAppOpeningGreeting_(phone, payload) {
  var name = getWhatsAppGreetingName_(phone, payload || {});
  // V10.9.153: Nama pengguna WA tidak dibuat bold agar sapaan terlihat natural.
  return 'Hallo ' + name + ', Selamat datang di layanan WhatsApp *PERUMDAM Tirta Ardhia Rinjani Kabupaten Lombok Tengah*.';
}

function buildMainWhatsAppMenuReply_(phone, payload) {
  payload = payload || {};
  return [
    buildWhatsAppOpeningGreeting_(phone, payload),
    '',
    'Saya adalah *SIAGA TIARA*, layanan informasi aduan gangguan air. Melalui chat ini, pelanggan dapat membuat aduan, mengecek tagihan, mengecek progres penanganan, atau melihat info layanan.',
    '',
    'Silakan pilih layanan:',
    '',
    '*1.* Buat Aduan',
    '*2.* Cek Status Aduan',
    '*3.* Cek Tagihan',
    '*4.* Info Layanan',
    '',
    'Balas dengan angka *1 / 2 / 3 / 4*.',
    '',
    'Jika sudah memiliki ID aduan, kirim langsung ID tersebut.',
    'Contoh: *PRY7K2A*'
  ].join('\n');
}


// ============================================================
// V10.9.227 - CEK STATUS LANJUTAN DARI AI
// Setelah AI menjawab konteks status/progres aduan, pelanggan bisa langsung
// mengirim ID Aduan atau No Pelanggan tanpa wajib menekan tombol Cek Status.
// ============================================================
function handleCekStatusInput_(message, phone) {
  var text = String(message || '').trim();
  var lower = text.toLowerCase();

  if (lower === 'lihat' || lower === 'riwayat' || lower === 'aduan' || lower === 'aduan aktif' || lower === 'aduan saya') {
    return handleCekStatusAduan_(phone);
  }

  var id = extractAduanId_(text);
  if (id) {
    var aduan = findAduanById_(id);
    if (aduan) {
      clearWhatsAppSession_(phone);
      setLastCheckedAduanIdForPhone_(phone, aduan.id);
      return {
        success: true,
        type: 'STATUS_BY_ID_AFTER_AI',
        id: aduan.id,
        reply: buildWhatsAppTrackingReply_(aduan),
        navButtons: buildStatusNavButtonsForAduan_(aduan)
      };
    }
    setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'STATUS_INPUT_NOT_FOUND_ID', allowNoPelanggan: true });
    return {
      success: false,
      type: 'NOT_FOUND_ID_AFTER_AI',
      id: id,
      reply: buildNotFoundReply_(id, phone),
      navButtons: buildAskIdNavButtons_()
    };
  }

  var noPelanggan = normalizeNoPelanggan_(text);
  if (noPelanggan) {
    return handleCekStatusByNoPelanggan_(phone, noPelanggan);
  }

  setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'STATUS_INPUT_INVALID', allowNoPelanggan: true });
  return {
    success: true,
    type: 'ASK_ID_OR_NOPEL',
    reply: buildAskIdReply_(),
    navButtons: buildAskIdNavButtons_()
  };
}

function handleCekStatusByNoPelanggan_(phone, noPelanggan) {
  noPelanggan = normalizeNoPelanggan_(noPelanggan);
  if (!noPelanggan) {
    setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'STATUS_NOPEL_INVALID', allowNoPelanggan: true });
    return {
      success: false,
      type: 'STATUS_NOPEL_INVALID',
      reply: buildNoPelangganInvalidReply_(),
      navButtons: buildAskIdNavButtons_()
    };
  }

  var list = findAduansByNoPelanggan_(noPelanggan, 10);
  if (!list.length) {
    setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'STATUS_NOPEL_NOT_FOUND', noPelanggan: noPelanggan, allowNoPelanggan: true });
    return {
      success: false,
      type: 'STATUS_NOPEL_NOT_FOUND',
      noPelanggan: noPelanggan,
      reply: [
        '🔎 *Cek Status Aduan*',
        '',
        'Belum ada aduan yang ditemukan untuk No Pelanggan *' + noPelanggan + '*.',
        '',
        'Silakan cek kembali nomor yang dikirim, atau kirim *ID Aduan* jika sudah memiliki nomor tiket.',
        '',
        'Contoh:',
        '*PRY7K2A*'
      ].join('\n'),
      navButtons: [
        { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
        { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var latest = list[0];
  clearWhatsAppSession_(phone);
  setLastCheckedAduanIdForPhone_(phone, latest.id);

  var reply = buildWhatsAppTrackingReply_(latest);
  if (list.length > 1) {
    reply += '\n\nCatatan: ditampilkan 1 aduan terbaru dari No Pelanggan ini. Untuk cek tiket lama, kirim ID Aduan.';
  }

  return {
    success: true,
    type: 'STATUS_ADUAN_TERBARU_BY_NO_PELANGGAN',
    id: latest.id,
    noPelanggan: noPelanggan,
    totalRiwayat: list.length,
    reply: reply,
    navButtons: buildStatusNavButtonsForAduan_(latest)
  };
}

function findAduansByNoPelanggan_(noPelanggan, limit) {
  noPelanggan = normalizeNoPelanggan_(noPelanggan);
  if (!noPelanggan) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var list = [];

  for (var i = 0; i < values.length; i++) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d) continue;
    var rowNoPel = normalizeNoPelanggan_(getNoPelangganFromAduan_(d));
    if (rowNoPel !== noPelanggan) continue;
    list.push(d);
  }

  list.sort(function(a, b) {
    var aOpen = isActiveAduanStatus_(a.status);
    var bOpen = isActiveAduanStatus_(b.status);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return (b.waktuMasukDate || 0) - (a.waktuMasukDate || 0);
  });

  return list.slice(0, limit || 10);
}

function handleCekStatusAduan_(phone) {
  // V10.9.154:
  // Cek Status Aduan dibuat ringkas: otomatis menampilkan 1 aduan saja.
  // Prioritas: aduan aktif terbaru. Jika tidak ada aktif, tampilkan aduan selesai/batal terbaru.
  // Riwayat lengkap tetap tersimpan di dashboard/admin dan tiket lama tetap bisa dicek dengan ID Aduan.
  var list = findAduansByPhone_(phone, 10);

  if (!list.length) {
    setWhatsAppSession_(phone, 'AWAIT_ID', {});
    return {
      success: true,
      type: 'ASK_ID_NO_ADUAN_BY_PHONE',
      reply: [
        '🔎 *Cek Status Aduan*',
        '',
        'Belum ada aduan yang ditemukan pada nomor WhatsApp ini.',
        '',
        'Jika ingin mengecek aduan lama atau aduan lain, silakan kirim *ID Aduan* atau *No Pelanggan*.',
        '',
        'Contoh:',
        '*PRY7K2A*'
      ].join('\n'),
      navButtons: [
        { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  return handleLatestAduanSaya_(phone, list);
}

function handleListOrLatestAduan_(phone) {
  return handleCekStatusAduan_(phone);
}

function handleListAduanSaya_(phone) {
  return handleCekStatusAduan_(phone);
}

function handleLatestAduanSaya_(phone, list) {
  var allList = list || findAduansByPhone_(phone, 10);
  if (!allList.length) {
    setWhatsAppSession_(phone, 'AWAIT_ID', {});
    return {
      success: false,
      type: 'NO_ADUAN_BY_PHONE',
      reply: [
        'Belum ada aduan yang ditemukan pada nomor WhatsApp ini.',
        '',
        'Untuk cek tiket lama, silakan kirim ID Aduan atau No Pelanggan.'
      ].join('\n'),
      navButtons: [
        { id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  // findAduansByPhone_ sudah mengurutkan: aduan aktif di atas, lalu data terbaru.
  // Jadi item pertama adalah status yang paling relevan untuk pelanggan.
  var latest = allList[0];
  clearWhatsAppSession_(phone);
  setLastCheckedAduanIdForPhone_(phone, latest.id);

  var reply = buildWhatsAppTrackingReply_(latest);
  var total = allList.length;
  if (total > 1) {
    reply += '\n\nCatatan: ditampilkan 1 aduan terbaru dari nomor WhatsApp ini. Untuk cek tiket lama, kirim ID Aduan.';
  }

  return {
    success: true,
    type: 'STATUS_ADUAN_TERBARU_BY_PHONE',
    id: latest.id,
    totalRiwayat: total,
    reply: reply,
    navButtons: buildStatusNavButtonsForAduan_(latest)
  };
}

function buildAduanListReply_(list, totalCount) {
  // V10.9.155: kalimat Cek Status Aduan dibuat singkat dan tidak membingungkan.
  // Normalnya menu status sekarang menampilkan 1 aduan terbaru saja.
  // Fungsi ini hanya cadangan jika provider/flow lama masih memanggil menu list.
  var lines = [
    '🔎 *Cek Status Aduan*',
    '',
    'Berikut aduan terbaru dari nomor WhatsApp ini.',
    '',
    'Tekan tombol *Buka Detail* untuk melihat status aduan.',
    'Untuk cek aduan lama, kirim *ID Aduan*.'
  ];

  return lines.join('\n');
}


function buildRiwayatAduanRows_(list) {
  list = (list || []).slice(0, 1);

  var rows = list.map(function(d, i) {
    var id = normalizeAduanIdHyphen_(d.id || '') || (d.id || '');
    var jenis = String(d.jenisGangguan || '-');
    var status = String(d.status || '-');
    var noPel = String(getNoPelangganFromAduan_(d) || '-');

    return {
      id: 'CEK_TIKET_' + id,
      title: ((i + 1) + '. ' + id).substring(0, 24),
      description: (jenis + ' - ' + status + ' | No: ' + noPel).substring(0, 72)
    };
  });

  rows.push({
    id: 'NAV_MENU',
    title: 'Menu Utama',
    description: 'Kembali ke layanan utama'
  });

  return rows;
}

function sendKiriminRiwayatAduanMenu_(phone, list) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk Cek Status Aduan.' };

  var rows = buildRiwayatAduanRows_(list || []);
  if (!rows.length) return { success: false, error: 'Data status aduan kosong.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: buildAduanListReply_(list || [], (list || []).length)
      },
      action: {
        button: 'Buka Detail',
        sections: [
          {
            title: 'Cek Status Aduan',
            rows: rows
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}


function handlePickAduan_(message, phone, session) {
  var n = parseInt(String(message || '').trim(), 10);
  var ids = session.data && session.data.ids ? session.data.ids : [];

  if (!n || n < 1 || n > ids.length) {
    return {
      success: false,
      type: 'PICK_ADUAN_INVALID',
      reply: 'Pilihan tidak tersedia. Silakan buka lagi Cek Status Aduan.',
      navButtons: [
        { id: 'MENU_2_STATUS', title: 'Cek Status Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var id = ids[n - 1];
  var d = findAduanById_(id);
  if (!d) {
    return { success: false, type: 'PICK_ADUAN_NOT_FOUND', id: id, reply: buildNotFoundReply_(id, phone),
      navButtons: buildNavButtons_('not_found') };
  }

  clearWhatsAppSession_(phone);
  setLastCheckedAduanIdForPhone_(phone, d.id);
  return { success: true, type: 'PICK_ADUAN_STATUS', id: d.id, reply: buildWhatsAppTrackingReply_(d),
      navButtons: buildStatusNavButtonsForAduan_(d) };
}



// ============================================================
// V10.9.13 - TOMBOL KONTROL INPUT ADUAN (BATAL / KEMBALI)
// ============================================================

function buildNewAduanControlButtons_() {
  return [
    { id: 'ADUAN_CANCEL', title: 'Batal' },
    { id: 'ADUAN_BACK', title: 'Kembali' }
  ];
}

function isNewAduanBackCommand_(text) {
  var lower = String(text || '').toLowerCase().trim();
  return lower === '__aduan_back__' ||
         lower === 'aduan_back' ||
         lower === 'adduan_back' ||
         lower === 'kembali' ||
         lower === 'back' ||
         lower === 'mundur';
}

function buildAskNamaPelangganReply_(cabangChoice) {
  return '📝 *Buat Aduan*\n\n' +
    'Cabang terpilih: *' + (cabangChoice || '-') + '*\n\n' +
    'Silakan ketik *nama pelanggan*.\n\n' +
    'Contoh:\n*ERWIN*';
}

function buildAskNoPelangganReply_() {
  return 'Baik. Sekarang ketik *No Pelanggan*.';
}

function buildNoPelangganInvalidReply_() {
  return 'No Pelanggan belum sesuai.\n\n' +
    'Mohon isi hanya angka, minimal 5 digit dan maksimal 20 digit.\n\n' +
    'Contoh:\n*0102030405*\n*1234567890*';
}

function buildAskWilayahReply_() {
  return 'Baik. Sekarang ketik *wilayah/kecamatan*.\n\n' +
    'Contoh:\n*Praya*\n*Kopang*\n*Pujut*';
}

function buildAskKeteranganReply_() {
  return 'Baik. Sekarang tulis *keterangan singkat* aduan.\n\n' +
    'Contoh:\n*Air mati sejak tadi pagi*\n*Pipa bocor besar di depan rumah*';
}

function handleNewAduanBack_(phone, session, data) {
  data = data || {};
  var state = session && session.state ? String(session.state) : '';

  if (state === 'NEW_NAMA' || state === 'NEW_WILAYAH') {
    setWhatsAppSession_(phone, 'NEW_CABANG', data);
    return {
      success: true,
      type: 'ASK_CABANG',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (state === 'NEW_DESA') {
    delete data.noPelanggan;
    delete data.desa;
    setWhatsAppSession_(phone, 'NEW_NAMA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NAMA',
      reply: buildAskNamaPelangganReply_(data.cabang),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (state === 'NEW_JENIS') {
    delete data.noPelanggan;
    delete data.desa;
    setWhatsAppSession_(phone, 'NEW_DESA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
      reply: buildAskNoPelangganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (state === 'NEW_KETERANGAN') {
    delete data.jenis;
    setWhatsAppSession_(phone, 'NEW_JENIS', data);
    return {
      success: true,
      type: 'ASK_JENIS_GANGGUAN',
      reply: 'Silakan pilih jenis laporan/gangguan.',
      jenisMenu: true
    };
  }

  if (state === 'NEW_LOKASI') {
    delete data.keterangan;
    setWhatsAppSession_(phone, 'NEW_KETERANGAN', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_KETERANGAN',
      reply: buildAskKeteranganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  setWhatsAppSession_(phone, 'NEW_CABANG', data);
  return {
    success: true,
    type: 'ASK_CABANG',
    page: 1,
    reply: buildCabangMenuReply_(1)
  };
}




// ============================================================
// V10.9.62 - ADUAN CEPAT
// Pelanggan pilih cabang dulu, lalu tulis Nama + No Pelanggan + keluhan
// dalam satu pesan. Sistem baca nama, No Pelanggan, jenis gangguan, dan
// keterangan, lalu minta konfirmasi sebelum membuat ID aduan.
// ============================================================

function buildFastAduanInstructionReply_(cabang) {
  return [
    'Silakan isi data aduan sesuai format berikut:',
    '',
    '*Nama:*',
    '*No Pelanggan:*',
    '*Keluhan:*',
    '*Lokasi/Patokan:*',
    '',
    'Contoh:',
    'Tiara',
    '123456667',
    'air mati dari tadi pagi',
    'Jln Tirta Rinjani No. 11, dekat masjid'
  ].join('\n');
}

function normalizeNamaPelangganInput_(text) {
  var nama = String(text || '').replace(/^nama\s*[:=.-]\s*/i, '').replace(/\s+/g, ' ').trim();
  if (!nama || nama.length < 2) return '';
  if (!/[A-Za-z]/.test(nama)) return '';
  return nama.substring(0, 80);
}

function buildFastAskNamaPelangganReply_(cabang) {
  return [
    '*Buat Aduan*',
    '',
    'Cabang: *' + (cabang || '-') + '*',
    '',
    'Silakan ketik *nama pelanggan/pelapor*.',
    '',
    'Contoh:',
    '*Erwin*',
    '',
    'Ketik *batal* untuk membatalkan.'
  ].join('\n');
}

function buildNamaPelangganInvalidReply_() {
  return [
    'Nama belum sesuai.',
    '',
    'Silakan ketik nama pelanggan/pelapor minimal 2 huruf.',
    '',
    'Contoh:',
    '*Erwin*'
  ].join('\n');
}

function buildFastAduanConfirmButtons_() {
  return [
    { id: 'FAST_CONFIRM_YES', title: 'Ya, Buat Aduan' },
    { id: 'FAST_ADD_LOCATION', title: 'Tambah Lokasi' },
    { id: 'FAST_EDIT', title: 'Ubah Data' }
  ];
}


// ============================================================
// V10.9.286 - PENGUMUMAN GANGGUAN BLOKIR ADUAN WILAYAH
// Jika dashboard Pengumuman mengaktifkan "Cegah Aduan", sistem cek:
// cabang + wilayah/alamat + jenis keluhan. Aduan sejenis langsung ditahan
// dan tiket baru tidak dibuat sampai pengumuman dimatikan/masa gangguan selesai.
// ============================================================
function normalizePengumumanMatchText_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/cabang\s+/g, ' ')
    .replace(/[()\[\]{}.,;:!?_+="'`~|/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPengumumanTerms_(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map(function(t) { return String(t || '').trim(); })
    .filter(function(t) { return !!t; });
}

function pengumumanCabangMatchesAduan_(item, data) {
  item = item || {};
  data = data || {};
  var target = String(item.cabang || '').trim();
  if (!target || /^semua\s*cabang$/i.test(target) || /^semua$/i.test(target)) return true;

  var a = normalizePengumumanMatchText_(target);
  var b = normalizePengumumanMatchText_(data.cabang || data.wilayah || '');
  if (!a || !b) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

function pengumumanJenisMatchesAduan_(item, data) {
  item = item || {};
  data = data || {};
  var defaultTerms = 'air mati, air kecil, tekanan rendah, distribusi terganggu';
  var rawJenis = String(item.jenisDicegah || defaultTerms).trim();
  if (/^(\*|semua|semua\s+aduan|semua\s+jenis|semua\s+jenis\s+aduan)$/i.test(rawJenis)) return true;

  var terms = splitPengumumanTerms_(rawJenis);
  var hay = normalizePengumumanMatchText_([
    data.jenis,
    data.keterangan,
    data.lokasiDetail
  ].join(' '));

  if (!terms.length) return true;
  if (!hay) return false;

  for (var i = 0; i < terms.length; i++) {
    var term = normalizePengumumanMatchText_(terms[i]);
    if (!term) continue;
    if (hay.indexOf(term) !== -1) return true;

    if (/(air\s*kecil|tekanan\s*rendah|debit\s*kecil|distribusi)/i.test(term) &&
        /(air\s*kecil|tekanan\s*rendah|keluar\s*kecil|debit\s*kecil|air\s*lemah|distribusi)/i.test(hay)) return true;

    if (/air\s*mati/i.test(term) &&
        /(air\s*mati|tidak\s*keluar|nggak\s*keluar|gak\s*keluar|tdk\s*keluar|mati)/i.test(hay)) return true;
  }

  return false;
}

function pengumumanWilayahMatchesAduan_(item, data) {
  item = item || {};
  data = data || {};
  var wilayahText = String(item.wilayahTerdampak || '').trim();
  if (!wilayahText) return true; // Sengaja kosong = semua wilayah pada cabang tersebut.

  var terms = splitPengumumanTerms_(wilayahText);
  if (!terms.length) return true;

  var hay = normalizePengumumanMatchText_([
    data.lokasiDetail,
    data.keterangan,
    data.wilayah,
    data.cabang
  ].join(' '));

  if (!hay) return false;

  for (var i = 0; i < terms.length; i++) {
    var term = normalizePengumumanMatchText_(terms[i]);
    if (!term || term.length < 3) continue;
    if (hay.indexOf(term) !== -1) return true;

    // Kalau admin menulis "BTN Pujut Permai" dan pelanggan menulis sebagian kata,
    // anggap cocok jika minimal 2 kata utama ditemukan.
    var words = term.split(/\s+/).filter(function(w) { return w.length >= 3; });
    var hit = 0;
    words.forEach(function(w) { if (hay.indexOf(w) !== -1) hit++; });
    if (words.length >= 2 && hit >= Math.min(2, words.length)) return true;
  }

  return false;
}

function findMatchingPengumumanForAduan_(data) {
  data = data || {};
  if (data.skipPengumumanCheck) return null;

  var pengumuman = null;
  try { pengumuman = getActivePengumuman_(); } catch(e) { pengumuman = null; }
  if (!pengumuman || !pengumuman.items || !pengumuman.items.length) return null;

  for (var i = 0; i < pengumuman.items.length; i++) {
    var item = pengumuman.items[i] || {};
    var cegah = String(item.cegahAduan || '').toUpperCase() === 'YA';
    if (!cegah) continue;
    if (!pengumumanCabangMatchesAduan_(item, data)) continue;
    if (!pengumumanWilayahMatchesAduan_(item, data)) continue;
    if (!pengumumanJenisMatchesAduan_(item, data)) continue;
    return item;
  }

  return null;
}

function buildPengumumanAduanWarningReply_(item, data) {
  item = item || {};
  data = data || {};
  var lines = [
    '📢 *Info Gangguan Aktif*',
    '',
    item.judul ? '*' + item.judul + '*' : '*Gangguan layanan sedang ditangani*',
    ''
  ];

  if (item.isi) lines.push(String(item.isi).trim(), '');

  var cabang = data.cabang || item.cabang || '-';
  var wilayah = String(item.wilayahTerdampak || '').trim();
  lines.push('Cabang: *' + cabang + '*');
  if (wilayah) lines.push('Wilayah terdampak: *' + wilayah + '*');
  else lines.push('Cakupan: *Seluruh wilayah dalam cabang*');
  lines.push(
    '',
    'Lokasi/keluhan Anda masuk cakupan gangguan yang sedang ditangani petugas.',
    'Aduan belum dibuat agar tidak terjadi laporan ganda.',
    'Silakan coba kembali setelah pengumuman dinonaktifkan atau gangguan selesai.'
  );

  return lines.join('\n');
}

function buildPengumumanAduanButtons_() {
  return [
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function maybePromptPengumumanBeforeAduan_(phone, data, stateName) {
  var match = findMatchingPengumumanForAduan_(data);
  if (!match) return null;

  // Mode blokir: jangan simpan session lanjut aduan.
  // Pelanggan bisa membuat aduan lagi setelah pengumuman dinonaktifkan/selesai.
  clearWhatsAppSession_(phone);

  return {
    success: true,
    type: 'ADUAN_PENGUMUMAN_BLOCKED',
    reply: buildPengumumanAduanWarningReply_(match, data),
    navButtons: buildPengumumanAduanButtons_()
  };
}

function isPengumumanRelatedChoice_(text) {
  var t = normalizePengumumanMatchText_(text);
  return t === 'aduan gangguan terkait' ||
         t === 'gangguan terkait' ||
         t === 'terkait gangguan ini' ||
         t.indexOf('terkait gangguan') !== -1;
}

function isPengumumanContinueChoice_(text) {
  var t = normalizePengumumanMatchText_(text);
  return t === 'aduan lanjut buat' ||
         t === 'lanjut buat aduan' ||
         t === 'lanjut aduan' ||
         t.indexOf('lanjut buat') !== -1;
}

function isPengumumanMenuChoice_(text) {
  var t = normalizePengumumanMatchText_(text);
  return t === 'nav menu' || t === 'menu' || t === 'menu utama' || t.indexOf('menu utama') !== -1;
}

function handleFastPengumumanCheck_(message, phone, data) {
  data = data || {};
  var text = String(message || '').trim();

  if (isPengumumanMenuChoice_(text)) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, {})
    };
  }

  // Kompatibilitas session lama V10.9.285: tombol apa pun selain Menu Utama
  // tetap tidak boleh melanjutkan pembuatan aduan ketika pengumuman blokir aktif.
  clearWhatsAppSession_(phone);
  var item = {
    judul: data.pendingPengumumanJudul || 'Gangguan layanan sedang ditangani',
    isi: ''
  };
  return {
    success: true,
    type: 'ADUAN_PENGUMUMAN_BLOCKED_LEGACY',
    reply: buildPengumumanAduanWarningReply_(item, data),
    navButtons: buildPengumumanAduanButtons_()
  };
}

function handleNewPengumumanCheck_(message, phone, data) {
  data = data || {};
  var text = String(message || '').trim();

  if (isPengumumanMenuChoice_(text)) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_(phone, {})
    };
  }

  // Kompatibilitas session lama V10.9.285: tombol apa pun selain Menu Utama
  // tetap tidak boleh membuat tiket baru jika sebelumnya terkena blokir pengumuman.
  clearWhatsAppSession_(phone);
  var item = {
    judul: data.pendingPengumumanJudul || 'Gangguan layanan sedang ditangani',
    isi: ''
  };
  return {
    success: true,
    type: 'ADUAN_PENGUMUMAN_BLOCKED_LEGACY',
    reply: buildPengumumanAduanWarningReply_(item, data),
    navButtons: buildPengumumanAduanButtons_()
  };
}


function buildFastAduanConfirmReply_(data) {
  data = data || {};
  var lokasiInfo = 'Belum ada lokasi/patokan';
  if (data.latitude && data.longitude) lokasiInfo = 'Share location tersimpan';
  else if (data.lokasiDetail && data.lokasiDetail.indexOf('Aduan') === -1) lokasiInfo = data.lokasiDetail;

  return [
    '*Konfirmasi Aduan*',
    '',
    'Cabang: ' + (data.cabang || '-'),
    'Nama: ' + (data.nama || '-'),
    'No Pelanggan: ' + (data.noPelanggan || '-'),
    'Jenis Gangguan: ' + (data.jenis || '-'),
    'Keterangan: ' + (data.keterangan || '-'),
    'Lokasi: ' + lokasiInfo,
    '',
    'Apakah data aduan sudah benar?',
    '',
    'Jika ingin mengirim share location, pilih *Tambah Lokasi*.'
  ].join('\n');
}


function isFastAddLocationCommand_(text) {
  text = String(text || '').toLowerCase().trim();
  return text === 'fast add location' ||
         text === '2' ||
         text.indexOf('tambah lokasi') !== -1 ||
         text.indexOf('kirim lokasi') !== -1 ||
         text.indexOf('shareloc') !== -1 ||
         text.indexOf('share location') !== -1;
}

function buildFastAskLocationReply_() {
  return [
    '*Tambah Lokasi Aduan*',
    '',
    'Silakan kirim *share location* WhatsApp agar posisi gangguan lebih mudah ditemukan.',
    '',
    'Jika tidak ingin mengirim lokasi, ketik *lewati*.',
    'Jika hanya ingin memberi patokan, ketik patokan lokasi secara singkat.'
  ].join('\n');
}

function applyFastLocationFromInput_(data, text, payload) {
  data = data || {};
  payload = payload || {};
  text = String(text || '').trim();

  var loc = payload.location || null;
  if ((!loc || !loc.latitude || !loc.longitude) && text) {
    loc = extractCoordinatesFromText_(text);
  }

  if (loc && loc.latitude && loc.longitude) {
    data.latitude = loc.latitude;
    data.longitude = loc.longitude;
    data.linkMaps = loc.mapsUrl || buildGoogleMapsUrl_(loc.latitude, loc.longitude);
    data.lokasiDetail = loc.address || loc.name || 'Share location WhatsApp';
    return { success: true, type: 'LOCATION_SAVED', data: data };
  }

  var lower = text.toLowerCase();
  if (['lewati', 'lewati lokasi', 'skip', 'skip lokasi', 'tidak ada', '-'].indexOf(lower) !== -1) {
    if (!data.lokasiDetail) data.lokasiDetail = 'Aduan - lokasi/patokan ada pada keterangan pelanggan';
    return { success: true, type: 'LOCATION_SKIPPED', data: data };
  }

  if (text && text !== '[LOKASI_WHATSAPP]') {
    data.lokasiDetail = text;
    return { success: true, type: 'LOCATION_TEXT', data: data };
  }

  return { success: false, type: 'LOCATION_EMPTY', data: data };
}


function extractNoPelangganFromFastText_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  // Kalau pelanggan hanya mengirim angka, pakai validator normal.
  var direct = normalizeNoPelanggan_(raw);
  if (direct) return direct;

  // Prioritaskan angka setelah kata No Pelanggan/Nosamw/ID pelanggan.
  // V11.7 FIX: dulu pakai [0-9\s\-] yang lewat \s ikut menganggap newline sebagai
  // bagian dari satu nomor. Efeknya kalau pelanggan kirim list bernomor per baris
  // (mis. "2. 012909146" lalu baris berikutnya "3. Air mati..."), digit "3" di awal
  // baris berikutnya ikut nyambung jadi "0129091463" -> No Pelanggan salah/nambah 1 digit.
  // Sekarang dibatasi [0-9 \t\-] (spasi/tab/strip dalam SATU baris saja, tanpa newline)
  // supaya nomor tidak pernah bocor lintas baris.
  var keyMatch = raw.match(/(?:no\.?\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan|nosamw|no\s*samw|rekening|nopel|no\s*pel)\s*[:=\-]?\s*([0-9][0-9 \t\-]{4,24})/i);
  if (keyMatch) {
    var byKey = normalizeNoPelanggan_(keyMatch[1]);
    if (byKey) return byKey;
  }

  var matches = raw.match(/[0-9][0-9 \t\-]{4,24}/g) || [];
  var candidates = matches
    .map(function(x) { return normalizeNoPelanggan_(x); })
    .filter(function(x) { return !!x; });

  if (!candidates.length) return '';

  // Pilih yang paling panjang agar jam/tanggal pendek tidak kebaca sebagai No Pelanggan.
  candidates.sort(function(a, b) { return b.length - a.length; });
  return candidates[0];
}


function isLikelyNamaPelangganCandidate_(text) {
  var nama = normalizeNamaPelangganInput_(text);
  if (!nama) return false;

  var lower = nama.toLowerCase();
  if (/[0-9]/.test(lower)) return false;
  if (nama.split(/\s+/).length > 5) return false;

  // Hindari salah baca keluhan/lokasi/cabang sebagai nama.
  var blockedWords = [
    'air', 'mati', 'bocor', 'pipa', 'meter', 'tagihan', 'rekening', 'tekanan', 'rendah',
    'keruh', 'kotor', 'bau', 'sambungan', 'pasang', 'baru', 'lokasi', 'alamat', 'patokan',
    'dekat', 'jalan', 'jln', 'gang', 'dusun', 'desa', 'kelurahan', 'kecamatan', 'rumah',
    'kantor', 'masjid', 'sekolah', 'pasar'
  ];
  for (var i = 0; i < blockedWords.length; i++) {
    if (lower.indexOf(blockedWords[i]) !== -1) return false;
  }

  var cabangWords = ['praya', 'pujut', 'kopang', 'jonggat', 'batukliang', 'janapria', 'pringgarata'];
  for (var j = 0; j < cabangWords.length; j++) {
    if (lower === cabangWords[j] || lower.indexOf(cabangWords[j] + ' ') === 0) return false;
  }

  return true;
}

function extractNamaPelangganFromFastText_(text, noPelanggan) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  // Format berlabel: Nama: Ari / Nama Pelapor: Ari.
  var labelMatch = raw.match(/(?:^|[\n,;])\s*(?:nama\s*(?:pelanggan|pelapor)?|pelapor)\s*[:=\-]?\s*([^\n,;]+)/i);
  if (labelMatch) {
    var byLabel = normalizeNamaPelangganInput_(labelMatch[1]);
    if (isLikelyNamaPelangganCandidate_(byLabel)) return byLabel;
  }

  // Format: atas nama Ari.
  var atasNamaMatch = raw.match(/atas\s+nama\s*[:=\-]?\s*([A-Za-z][^\n,;0-9]{1,70})/i);
  if (atasNamaMatch) {
    var byAtasNama = normalizeNamaPelangganInput_(atasNamaMatch[1]);
    if (isLikelyNamaPelangganCandidate_(byAtasNama)) return byAtasNama;
  }

  // V11.7 FIX: dulu di sini ada implementasi split sendiri yang duplikat dan tidak
  // membuang prefix nomor urut list ("1.", "2)", dst), beda dengan splitFastAduanParts_
  // yang sudah dibetulkan. Akibatnya kandidat nama seperti "1. Baiq Alya Galuh Dininggrat"
  // masih membawa "1." di depan, lalu ditolak oleh isLikelyNamaPelangganCandidate_ karena
  // dianggap "mengandung angka". Sekarang pakai splitFastAduanParts_ yang sama supaya
  // prefix nomor urut sudah bersih sebelum dicek.
  var parts = splitFastAduanParts_(raw);

  // Format paling umum: Ari, 252562, air mati / Ari\n252562\nair mati.
  var numberPartIndex = -1;
  for (var i = 0; i < parts.length; i++) {
    if (extractNoPelangganFromFastText_(parts[i])) {
      numberPartIndex = i;
      break;
    }
  }

  if (numberPartIndex > 0) {
    for (var j = 0; j < numberPartIndex; j++) {
      if (isLikelyNamaPelangganCandidate_(parts[j])) return normalizeNamaPelangganInput_(parts[j]);
    }
  }

  // Format satu baris: Ari 252562 air mati.
  // V11.7 FIX: batasi ke satu baris ([0-9 \t\-]) supaya tidak ikut menelan newline.
  var digitMatch = raw.match(/[0-9][0-9 \t\-]{4,24}/);
  if (digitMatch && digitMatch.index > 0) {
    var beforeNumber = stripFastListNumber_(raw.substring(0, digitMatch.index))
      .replace(/(?:nama\s*(?:pelanggan|pelapor)?|pelapor)\s*[:=\-]?/ig, '')
      .replace(/[\n,;:.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (isLikelyNamaPelangganCandidate_(beforeNumber)) return normalizeNamaPelangganInput_(beforeNumber);
  }

  return '';
}

function escapeRegexText_(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferFastJenisGangguan_(text) {
  var lower = String(text || '').toLowerCase();

  if (
    lower.indexOf('air mati') !== -1 ||
    lower.indexOf('air mari') !== -1 ||
    lower.indexOf('air maty') !== -1 ||
    lower.indexOf('tidak mengalir') !== -1 ||
    lower.indexOf('tidak ngalir') !== -1 ||
    lower.indexOf('gak ngalir') !== -1 ||
    lower.indexOf('ga ngalir') !== -1 ||
    lower.indexOf('ndak ngalir') !== -1 ||
    lower.indexOf('nggak ngalir') !== -1 ||
    lower.indexOf('tidak keluar') !== -1 ||
    lower.indexOf('air tidak keluar') !== -1 ||
    lower.indexOf('air mati total') !== -1
  ) return 'Air Mati';

  if (
    lower.indexOf('tekanan') !== -1 ||
    lower.indexOf('air kecil') !== -1 ||
    lower.indexOf('airnya kecil') !== -1 ||
    lower.indexOf('kecil sekali') !== -1 ||
    lower.indexOf('debit kecil') !== -1 ||
    lower.indexOf('debit sedikit') !== -1 ||
    lower.indexOf('aliran kecil') !== -1 ||
    lower.indexOf('aliran sedikit') !== -1 ||
    lower.indexOf('air pelan') !== -1 ||
    lower.indexOf('airnya pelan') !== -1 ||
    lower.indexOf('air sedikit') !== -1 ||
    lower.indexOf('airnya sedikit') !== -1 ||
    lower.indexOf('keluar sedikit') !== -1 ||
    lower.indexOf('air keluar sedikit') !== -1 ||
    lower.indexOf('airnya keluar sedikit') !== -1 ||
    lower.indexOf('keluar kecil') !== -1 ||
    lower.indexOf('ngalir kecil') !== -1 ||
    lower.indexOf('ngalir sedikit') !== -1 ||
    lower.indexOf('ngalir dikit') !== -1 ||
    lower.indexOf('ngalir dikit-dikit') !== -1 ||
    lower.indexOf('air ngalir dikit') !== -1 ||
    lower.indexOf('airnya ngalir dikit') !== -1 ||
    lower.indexOf('air mengalir dikit') !== -1 ||
    lower.indexOf('mengalir kecil') !== -1 ||
    lower.indexOf('mengalir sedikit') !== -1 ||
    lower.indexOf('mengalir dikit') !== -1 ||
    lower.indexOf('keluar dikit') !== -1 ||
    lower.indexOf('air keluar dikit') !== -1 ||
    lower.indexOf('airnya keluar dikit') !== -1 ||
    lower.indexOf('air kurang') !== -1 ||
    lower.indexOf('airnya kurang') !== -1 ||
    lower.indexOf('aliran lemah') !== -1 ||
    lower.indexOf('alirannya lemah') !== -1 ||
    lower.indexOf('tekanan lemah') !== -1 ||
    lower.indexOf('tekanannya lemah') !== -1 ||
    lower.indexOf('tersendat') !== -1 ||
    lower.indexOf('seret') !== -1
  ) return 'Tekanan Rendah';

  if (
    lower.indexOf('keruh') !== -1 ||
    lower.indexOf('air kotor') !== -1 ||
    lower.indexOf('kotor') !== -1 ||
    lower.indexOf('bau') !== -1 ||
    lower.indexOf('berwarna') !== -1
  ) return 'Air Keruh';

  if (
    lower.indexOf('bocor') !== -1 ||
    lower.indexOf('pipa pecah') !== -1 ||
    lower.indexOf('pipa retak') !== -1 ||
    lower.indexOf('rembes') !== -1
  ) return 'Pipa Bocor';

  if (
    lower.indexOf('meter') !== -1 ||
    lower.indexOf('water meter') !== -1 ||
    lower.indexOf('wm ') !== -1 ||
    lower.indexOf('angka meter') !== -1
  ) return 'Meter Bermasalah';

  if (
    lower.indexOf('tagihan') !== -1 ||
    lower.indexOf('rekening') !== -1 ||
    lower.indexOf('sudah bayar') !== -1 ||
    lower.indexOf('bayar') !== -1
  ) return 'Tagihan';

  if (
    lower.indexOf('sambungan baru') !== -1 ||
    lower.indexOf('pasang baru') !== -1 ||
    lower.indexOf('daftar sambungan') !== -1
  ) return 'Sambungan Baru';

  return '';
}

function cleanFastKeterangan_(text, noPelanggan, namaPelanggan) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  var parts = raw.split(/[\n,;]+/).map(function(part) {
    return String(part || '').trim();
  }).filter(function(part) {
    return !!part;
  });

  var filtered = parts.filter(function(part) {
    var lower = part.toLowerCase();

    // Buang bagian yang hanya berisi nama/no pelanggan.
    if (/^(nama\s*(pelanggan|pelapor)?|pelapor)\s*[:=\-.]?/i.test(part)) return false;
    if (/^(no\.?\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan|nosamw|no\s*samw|rekening)\s*[:=\-.]?/i.test(part)) return false;

    if (namaPelanggan) {
      var normalizedPartName = normalizeNamaPelangganInput_(part);
      if (normalizedPartName && normalizedPartName.toLowerCase() === String(namaPelanggan).toLowerCase()) return false;
    }

    var noInPart = extractNoPelangganFromFastText_(part);
    if (noPelanggan && noInPart === noPelanggan && !inferFastJenisGangguan_(part)) return false;

    return true;
  }).map(function(part) {
    return part
      .replace(/^(keluhan|keterangan|laporan|lokasi\s*\/\s*patokan|lokasi|alamat|patokan)\s*[:=\-.]?\s*/i, '')
      .trim();
  }).filter(function(part) {
    return !!part;
  });

  var ket = filtered.length ? filtered.join(', ') : raw;

  if (namaPelanggan) {
    var namaRx = new RegExp('(?:^|[\\s,;\\n]+)' + escapeRegexText_(namaPelanggan) + '(?=[\\s,;\\n]+|$)', 'ig');
    ket = ket.replace(namaRx, ' ');
  }

  if (noPelanggan) {
    // Hapus penyebutan No Pelanggan agar keterangan lebih bersih.
    var rx = new RegExp('(no\\.?\\s*pelanggan|nomor\\s*pelanggan|id\\s*pelanggan|nosamw|no\\s*samw|rekening)\\s*[:=\\-]?\\s*' + escapeRegexText_(noPelanggan), 'ig');
    ket = ket.replace(rx, ' ');
    ket = ket.replace(new RegExp(escapeRegexText_(noPelanggan), 'g'), ' ');

    // Hapus juga format angka dengan spasi/strip yang mungkin berbeda dari digit normal.
    // V11.7 FIX: sama seperti extractNoPelangganFromFastText_, batasi ke satu baris saja
    // ([0-9 \t\-]) supaya tidak ikut menelan newline/nomor urut baris berikutnya.
    var formattedNumbers = raw.match(/[0-9][0-9 \t\-]{4,24}/g) || [];
    formattedNumbers.forEach(function(numText) {
      if (normalizeNoPelanggan_(numText) === noPelanggan) {
        ket = ket.replace(numText, ' ');
      }
    });
  }

  ket = ket
    .replace(/\b(nama\s*(pelanggan|pelapor)?|pelapor|no\.?\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan)\b\s*[:=\-.]?/ig, ' ')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^[\s,.;:\-]+/, '')
    .replace(/[\s,.;:\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // V10.9.271:
  // Jangan kembalikan raw jika pesan hanya berisi nama + No Pelanggan.
  // Sebelumnya input seperti "Ria,1334423" masih dianggap keterangan,
  // lalu sistem lanjut ke menu jenis gangguan. Sekarang wajib ada keluhan/lokasi.
  return ket;
}

function stripFastFieldLabel_(text) {
  return String(text || '')
    .replace(/^(nama\s*(pelanggan|pelapor)?|pelapor|no\.?\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan|nopel|no\s*pel|keluhan|keterangan|laporan|gangguan|jenis\s*gangguan|lokasi\s*\/\s*patokan|lokasi\s*patokan|lokasi|alamat|patokan)\s*[:=\-.]?\s*/i, '')
    .trim();
}

// V11.7 FIX: pelanggan sering kirim data aduan sebagai list bernomor, misalnya:
// "1. Baiq Alya Galuh Dininggrat" / "2. 012909146" / "3. Air mati dari pagi" / "4. Bermis, ...".
// Sebelumnya angka penomoran ("1.", "2)", dst) ikut terbawa sebagai bagian dari isi field,
// yang bikin:
//   - isLikelyNamaPelangganCandidate_ menolak nama karena dianggap "mengandung angka"
//     (padahal angkanya cuma nomor urut, bukan bagian nama) -> Nama gagal terbaca.
//   - digit nomor urut baris berikutnya bisa ketarik masuk ke No Pelanggan.
// stripFastListNumber_ membuang prefix nomor urut di awal setiap bagian sebelum diproses.
// Syarat wajib ada spasi setelah tanda baca (mis. "1. ", "2) ") supaya nomor pelanggan
// asli yang kebetulan pakai strip tanpa spasi (mis. "08-123456") tidak ikut terpotong.
function stripFastListNumber_(text) {
  return String(text || '').replace(/^\s*\(?\d{1,2}[.)\-:]\s+/, '').trim();
}

function splitFastAduanParts_(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map(function(part) { return stripFastListNumber_(String(part || '').trim()); })
    .filter(function(part) { return !!part; });
}

function extractFastLokasiDetail_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  var labeled = raw.match(/(?:^|[\n,;])\s*(lokasi\s*\/\s*patokan|lokasi|alamat|patokan)\s*[:=\-.]?\s*([^\n;]+)/i);
  if (labeled && labeled[2]) {
    return stripFastFieldLabel_(labeled[2]).substring(0, 180);
  }

  var parts = splitFastAduanParts_(raw);
  if (parts.length >= 4) {
    return parts.slice(3).map(stripFastFieldLabel_).filter(function(part) { return !!part; }).join(', ').substring(0, 180);
  }

  return '';
}

function hasFastLokasiPatokan_(data) {
  data = data || {};
  if (data.latitude && data.longitude) return true;
  var loc = String(data.lokasiDetail || '').trim();
  if (!loc) return false;
  if (/^Aduan\s*-\s*lokasi\/patokan/i.test(loc)) return false;
  if (/patokan mengikuti keterangan/i.test(loc)) return false;
  return loc.length >= 5;
}

function parseFastLabeledAduanFields_(text) {
  var raw = String(text || '').trim();
  var result = { nama: '', noPelanggan: '', keluhan: '', lokasiDetail: '' };
  if (!raw) return result;

  // Mendukung format mudah: Nama: Ari / No Pelanggan: 123 / Keluhan: air mati / Lokasi: dekat masjid.
  // Juga mendukung label dan isi dipisah baris, misalnya: Nama: lalu baris berikutnya Ari.
  var lines = raw.split(/\n+/).map(function(line) {
    return String(line || '').trim();
  }).filter(function(line) {
    return !!line;
  });

  if (!lines.length) return result;

  var currentKey = '';
  function keyFromLabel_(label) {
    var l = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^(nama|nama pelanggan|nama pelapor|pelapor)$/.test(l)) return 'nama';
    if (/^(no pelanggan|nomor pelanggan|id pelanggan|nosamw|no samw|rekening|nopel|no pel)$/.test(l)) return 'noPelanggan';
    if (/^(keluhan|keterangan|laporan|gangguan|jenis gangguan)$/.test(l)) return 'keluhan';
    if (/^(lokasi|alamat|patokan|lokasi\/patokan|lokasi patokan)$/.test(l)) return 'lokasiDetail';
    return '';
  }

  function addValue_(key, value) {
    value = String(value || '').trim();
    if (!key || !value) return;
    if (key === 'noPelanggan') {
      var np = normalizeNoPelanggan_(value);
      if (np) result.noPelanggan = np;
      return;
    }
    if (key === 'nama') {
      var nm = normalizeNamaPelangganInput_(value);
      if (isLikelyNamaPelangganCandidate_(nm)) result.nama = nm;
      return;
    }
    if (key === 'keluhan') {
      result.keluhan = (result.keluhan ? result.keluhan + ' ' : '') + stripFastFieldLabel_(value);
      result.keluhan = result.keluhan.replace(/\s+/g, ' ').trim().substring(0, 220);
      return;
    }
    if (key === 'lokasiDetail') {
      result.lokasiDetail = (result.lokasiDetail ? result.lokasiDetail + ' ' : '') + stripFastFieldLabel_(value);
      result.lokasiDetail = result.lokasiDetail.replace(/\s+/g, ' ').trim().substring(0, 180);
    }
  }

  lines.forEach(function(line) {
    var m = line.match(/^\s*(nama\s*(?:pelanggan|pelapor)?|pelapor|no\.?\s*pelanggan|nomor\s*pelanggan|id\s*pelanggan|nosamw|no\s*samw|rekening|nopel|no\s*pel|keluhan|keterangan|laporan|gangguan|jenis\s*gangguan|lokasi\s*\/\s*patokan|lokasi\s*patokan|lokasi|alamat|patokan)\s*[:=\-.]?\s*(.*)$/i);
    if (m) {
      currentKey = keyFromLabel_(m[1]);
      addValue_(currentKey, m[2]);
    } else if (currentKey) {
      addValue_(currentKey, line);
    }
  });

  return result;
}

function parseFastAduanText_(text) {
  var labeled = parseFastLabeledAduanFields_(text);
  var noPelanggan = labeled.noPelanggan || extractNoPelangganFromFastText_(text);
  var nama = labeled.nama || extractNamaPelangganFromFastText_(text, noPelanggan);
  var jenis = inferFastJenisGangguan_(labeled.keluhan || text);
  var keterangan = labeled.keluhan || cleanFastKeterangan_(text, noPelanggan, nama);
  var lokasiDetail = labeled.lokasiDetail || extractFastLokasiDetail_(text);

  var parts = splitFastAduanParts_(text);
  if (!labeled.keluhan && parts.length >= 3) {
    var keluhanPart = stripFastFieldLabel_(parts[2]);
    if (keluhanPart && !normalizeNoPelanggan_(keluhanPart)) {
      keterangan = keluhanPart;
      jenis = inferFastJenisGangguan_(keluhanPart) || jenis;
    }
  }

  return {
    nama: nama,
    noPelanggan: noPelanggan,
    jenis: jenis,
    keterangan: keterangan,
    lokasiDetail: lokasiDetail
  };
}

function isFastConfirmYes_(text) {
  text = String(text || '').toLowerCase().trim();
  return text === 'fast confirm yes' ||
         text === '1' ||
         text === 'ya' ||
         text === 'iya' ||
         text === 'ok' ||
         text === 'oke' ||
         text === 'ya, buat aduan' ||
         text === 'ya buat aduan' ||
         text.indexOf('buat aduan') !== -1 ||
         text.indexOf('ya buat') !== -1;
}

function isFastEditCommand_(text) {
  text = String(text || '').toLowerCase().trim();
  return text === 'fast edit' ||
         text === '3' ||
         text.indexOf('ubah') !== -1 ||
         text.indexOf('edit') !== -1 ||
         text.indexOf('perbaiki') !== -1;
}

function isFastDataComplete_(data) {
  data = data || {};
  return !!(data.cabang && data.nama && data.noPelanggan && data.jenis && String(data.keterangan || '').trim().length >= 8 && hasFastLokasiPatokan_(data));
}

function buildFastMissingReply_(data) {
  data = data || {};

  if (!data.nama) {
    return [
      '*Data aduan belum lengkap.*',
      '',
      'Cabang: ' + (data.cabang || '-'),
      '',
      'Nama pelanggan/pelapor belum terisi.',
      'Silakan kirim nama pelanggan/pelapor.'
    ].join('\n');
  }

  if (!data.noPelanggan) {
    return [
      '*Data aduan hampir lengkap.*',
      '',
      'Cabang: ' + (data.cabang || '-'),
      'Nama: ' + (data.nama || '-'),
      'Jenis Gangguan: ' + (data.jenis || '-'),
      'Keterangan: ' + (data.keterangan || '-'),
      '',
      'No Pelanggan belum terbaca.',
      'Silakan kirim No Pelanggan Anda.'
    ].join('\n');
  }

  if (!data.jenis) {
    return [
      '*Data aduan belum lengkap.*',
      '',
      'Cabang: ' + (data.cabang || '-'),
      'Nama: ' + (data.nama || '-'),
      'No Pelanggan: ' + (data.noPelanggan || '-'),
      '',
      'Keluhan belum terbaca.',
      '',
      'Silakan kirim ulang data aduan seperti contoh:',
      '',
      '*Tiara*',
      '*123456667*',
      '*air mati dari tadi pagi*',
      '*Jln Tirta Rinjani No 11, dekat masjid*'
    ].join('\n');
  }

  if (!hasFastLokasiPatokan_(data)) {
    return [
      '*Data aduan belum lengkap.*',
      '',
      'Cabang: ' + (data.cabang || '-'),
      'Nama: ' + (data.nama || '-'),
      'No Pelanggan: ' + (data.noPelanggan || '-'),
      'Keluhan: ' + (data.keterangan || '-'),
      '',
      'Lokasi/patokan belum terbaca.',
      '',
      'Silakan kirim ulang data aduan seperti contoh:',
      '',
      '*Tiara*',
      '*123456667*',
      '*air mati dari tadi pagi*',
      '*Jln Tirta Rinjani No 11, dekat masjid*'
    ].join('\n');
  }

  return [
    '*Data aduan belum lengkap.*',
    '',
    'Keluhan/lokasi masih terlalu singkat.',
    '',
    'Silakan kirim ulang data aduan seperti contoh:',
    '',
    '*Tiara*',
    '*123456667*',
    '*air mati dari tadi pagi*',
    '*Jln Tirta Rinjani No 11, dekat masjid*'
  ].join('\n');
}

function handleFastAduanFlow_(message, phone, session, payload) {
  payload = payload || {};
  session = session || { state: 'FAST_CABANG', data: {} };
  var text = String(message || '').trim();
  var lower = text.toLowerCase();
  var data = session.data || {};

  if (['batal', 'cancel', 'reset', 'ulang'].indexOf(lower) !== -1) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'FAST_ADUAN_CANCEL',
      reply: 'Baik, proses aduan dibatalkan.',
      navButtons: buildNavButtons_('main')
    };
  }

  if (session.state === 'FAST_PENGUMUMAN_CHECK') {
    return handleFastPengumumanCheck_(text, phone, data);
  }

  if (isNewAduanBackCommand_(text)) {
    if (session.state === 'FAST_NAMA') {
      delete data.nama;
      setWhatsAppSession_(phone, 'FAST_CABANG', data);
      return {
        success: true,
        type: 'ASK_CABANG',
        page: 1,
        reply: buildCabangMenuReply_(1)
      };
    }

    if (session.state === 'FAST_TEXT') {
      delete data.nama;
      delete data.noPelanggan;
      delete data.jenis;
      delete data.keterangan;
      setWhatsAppSession_(phone, 'FAST_CABANG', data);
      return {
        success: true,
        type: 'ASK_CABANG',
        page: 1,
        reply: buildCabangMenuReply_(1)
      };
    }

    if (session.state === 'FAST_NOPEL' || session.state === 'FAST_JENIS' || session.state === 'FAST_LOKASI' || session.state === 'FAST_CONFIRM') {
      if (!data.cabang) {
        setWhatsAppSession_(phone, 'FAST_CABANG', data);
        return {
          success: true,
          type: 'ASK_CABANG_REQUIRED_FIRST_BACK',
          page: 1,
          reply: buildCabangMenuReply_(1)
        };
      }
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: true,
        type: 'FAST_ADUAN_ASK_TEXT',
        reply: buildFastAduanInstructionReply_(data.cabang),
        navButtons: buildNewAduanControlButtons_()
      };
    }
  }

  // V10.9.272:
  // Pengaman utama: alur Buat Aduan WA wajib mulai dari pilih cabang.
  // Jika session lama/cache tersangkut di FAST_TEXT/FAST_CONFIRM tanpa data.cabang,
  // jangan langsung minta isi data aduan. Kembalikan dulu ke daftar cabang.
  if (session.state !== 'FAST_CABANG' && !data.cabang) {
    data = {
      activeCheckedAt: new Date().getTime(),
      activeCount: data.activeCount || 0,
      mode: 'BUAT_ADUAN',
      restoredMissingCabang: true
    };
    setWhatsAppSession_(phone, 'FAST_CABANG', data);
    return {
      success: true,
      type: 'ASK_CABANG_REQUIRED_FIRST',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (shouldBlockNewAduanOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_FAST_ADUAN_FLOW',
      reply: buildOutsideHoursBlockedReply_('Buat Aduan'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  if (session.state === 'FAST_CABANG') {
    var cabangChoice = normalizeIncomingCabangChoice_(text, data.cabangPage || 1);

    if (!cabangChoice) {
      // V10.9.206: tetap di mode pilih cabang. Jangan munculkan fallback umum
      // "1. Buat Aduan" karena angka 1 di tahap ini harus berarti Cabang Praya.
      return handleCabangInvalidChoice_(phone, 'FAST_CABANG');
    }

    resetCustomerInvalidInputCounter_(phone, 'FAST_CABANG');
    data.cabang = cabangChoice;
    data.wilayah = cabangChoice.replace(/^Cabang\s+/i, '');
    delete data.cabangPage;

    setWhatsAppSession_(phone, 'FAST_TEXT', data);
    return {
      success: true,
      type: 'FAST_ADUAN_ASK_TEXT',
      reply: buildFastAduanInstructionReply_(cabangChoice),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'FAST_NAMA') {
    var namaPelanggan = normalizeNamaPelangganInput_(text);
    if (!namaPelanggan) {
      return {
        success: false,
        type: 'FAST_ADUAN_NAMA_INVALID',
        reply: buildNamaPelangganInvalidReply_(),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.nama = namaPelanggan;
    setWhatsAppSession_(phone, 'FAST_TEXT', data);
    return {
      success: true,
      type: 'FAST_ADUAN_ASK_TEXT',
      reply: buildFastAduanInstructionReply_(data.cabang),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'FAST_TEXT') {
    // Kalau pelanggan langsung kirim shareloc di tahap ini, simpan dulu lalu tetap minta teks aduan.
    if (payload.location || text === '[LOKASI_WHATSAPP]' || extractCoordinatesFromText_(text)) {
      var savedTextLoc = applyFastLocationFromInput_(data, text, payload);
      if (savedTextLoc.success) {
        setWhatsAppSession_(phone, 'FAST_TEXT', data);
        return {
          success: true,
          type: 'FAST_ADUAN_LOCATION_SAVED_EARLY',
          reply: 'Lokasi sudah tersimpan. Sekarang kirim nama, No Pelanggan, dan keluhan dalam satu pesan.',
          navButtons: buildNewAduanControlButtons_()
        };
      }
    }

    var parsed = parseFastAduanText_(text);
    data.nama = parsed.nama || data.nama || '';
    data.noPelanggan = parsed.noPelanggan || data.noPelanggan || '';
    data.desa = data.noPelanggan || '';
    data.jenis = parsed.jenis || data.jenis || '';
    data.keterangan = parsed.keterangan || data.keterangan || '';
    data.lokasiDetail = parsed.lokasiDetail || data.lokasiDetail || '';

    // V10.9.185: keluhan administrasi/tagihan dari alur Buat Aduan diarahkan ke Chat Admin,
    // bukan ke petugas cabang, agar ditangani langsung oleh admin.
    if (isAdminRelatedJenis_(data.jenis) || isAdminRelatedCustomerText_(text)) {
      var adminData = {
        context: 'Administrasi / Tagihan',
        source: 'aduan_fast_admin_related',
        expiresMinutes: 15,
        lastCustomerMessage: text,
        lastCustomerMessageAt: new Date().toISOString()
      };
      activateAgentChatSession_(phone, adminData, 15);
      try { notifyAgentChatAdmins_(phone, text || 'Pelanggan membutuhkan admin untuk administrasi/tagihan.', adminData, true); } catch(eAdminNotify) {}
      return {
        success: true,
        type: 'CONTACT_ADMIN_BY_TAGIHAN',
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

    if (!data.noPelanggan) {
      setWhatsAppSession_(phone, 'FAST_NOPEL', data);
      return {
        success: false,
        type: 'FAST_ADUAN_MISSING_NOPEL',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!data.jenis) {
      // V10.9.271: jangan tampilkan menu jenis gangguan pada alur aduan cepat.
      // Pelanggan wajib mengirim data lengkap: nama, no pelanggan, keluhan, lokasi/patokan.
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_INCOMPLETE_TEXT',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!data.keterangan || String(data.keterangan).trim().length < 8) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_KETERANGAN_INVALID',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!hasFastLokasiPatokan_(data)) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_LOKASI_MISSING',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    var pengumumanCheck = maybePromptPengumumanBeforeAduan_(phone, data, 'FAST_PENGUMUMAN_CHECK');
    if (pengumumanCheck) return pengumumanCheck;

    setWhatsAppSession_(phone, 'FAST_CONFIRM', data);
    return {
      success: true,
      type: 'FAST_ADUAN_CONFIRM',
      reply: buildFastAduanConfirmReply_(data),
      navButtons: buildFastAduanConfirmButtons_()
    };
  }

  if (session.state === 'FAST_NOPEL') {
    var noPelanggan = normalizeNoPelanggan_(text);
    if (!noPelanggan) {
      return {
        success: false,
        type: 'FAST_ADUAN_MISSING_NOPEL',
        reply: 'No Pelanggan belum terbaca. Silakan kirim No Pelanggan berupa angka sesuai rekening.',
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.noPelanggan = noPelanggan;
    data.desa = noPelanggan;

    if (!data.jenis) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: true,
        type: 'FAST_ADUAN_INCOMPLETE_TEXT',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!data.keterangan || String(data.keterangan).trim().length < 8) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: true,
        type: 'FAST_ADUAN_ASK_TEXT',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!hasFastLokasiPatokan_(data)) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_LOKASI_MISSING',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    var pengumumanCheck = maybePromptPengumumanBeforeAduan_(phone, data, 'FAST_PENGUMUMAN_CHECK');
    if (pengumumanCheck) return pengumumanCheck;

    setWhatsAppSession_(phone, 'FAST_CONFIRM', data);
    return {
      success: true,
      type: 'FAST_ADUAN_CONFIRM',
      reply: buildFastAduanConfirmReply_(data),
      navButtons: buildFastAduanConfirmButtons_()
    };
  }

  if (session.state === 'FAST_JENIS') {
    // V10.9.271: kompatibilitas untuk sesi lama yang sudah terlanjur berada di FAST_JENIS.
    // Jangan kirim menu jenis lagi; arahkan pelanggan mengirim data lengkap.
    var jenis = normalizeJenisGangguanChoice_(text) || inferFastJenisGangguan_(text);
    if (jenis) data.jenis = jenis;

    if (!data.jenis || !data.keterangan || String(data.keterangan).trim().length < 8 || !hasFastLokasiPatokan_(data)) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_INCOMPLETE_TEXT',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    var pengumumanCheck = maybePromptPengumumanBeforeAduan_(phone, data, 'FAST_PENGUMUMAN_CHECK');
    if (pengumumanCheck) return pengumumanCheck;

    setWhatsAppSession_(phone, 'FAST_CONFIRM', data);
    return {
      success: true,
      type: 'FAST_ADUAN_CONFIRM',
      reply: buildFastAduanConfirmReply_(data),
      navButtons: buildFastAduanConfirmButtons_()
    };
  }

  if (session.state === 'FAST_LOKASI') {
    var locResult = applyFastLocationFromInput_(data, text, payload);
    if (!locResult.success) {
      return {
        success: false,
        type: 'FAST_ADUAN_ASK_LOCATION',
        reply: buildFastAskLocationReply_(),
        navButtons: [
          { id: 'FAST_SKIP_LOCATION', title: 'Lewati Lokasi' },
          { id: 'FAST_EDIT', title: 'Ubah Data' },
          { id: 'ADUAN_CANCEL', title: 'Batal' }
        ]
      };
    }

    var pengumumanCheck = maybePromptPengumumanBeforeAduan_(phone, data, 'FAST_PENGUMUMAN_CHECK');
    if (pengumumanCheck) return pengumumanCheck;

    setWhatsAppSession_(phone, 'FAST_CONFIRM', data);
    return {
      success: true,
      type: 'FAST_ADUAN_LOCATION_SAVED',
      reply: buildFastAduanConfirmReply_(data),
      navButtons: buildFastAduanConfirmButtons_()
    };
  }

  if (session.state === 'FAST_CONFIRM') {
    // Kalau pelanggan mengirim shareloc langsung saat halaman konfirmasi, simpan tanpa mengulang form.
    if (payload.location || text === '[LOKASI_WHATSAPP]' || extractCoordinatesFromText_(text)) {
      var directLocResult = applyFastLocationFromInput_(data, text, payload);
      if (directLocResult.success) {
        setWhatsAppSession_(phone, 'FAST_CONFIRM', data);
        return {
          success: true,
          type: 'FAST_ADUAN_LOCATION_SAVED',
          reply: buildFastAduanConfirmReply_(data),
          navButtons: buildFastAduanConfirmButtons_()
        };
      }
    }

    if (isFastAddLocationCommand_(text)) {
      setWhatsAppSession_(phone, 'FAST_LOKASI', data);
      return {
        success: true,
        type: 'FAST_ADUAN_ASK_LOCATION',
        reply: buildFastAskLocationReply_(),
        navButtons: [
          { id: 'FAST_SKIP_LOCATION', title: 'Lewati Lokasi' },
          { id: 'FAST_EDIT', title: 'Ubah Data' },
          { id: 'ADUAN_CANCEL', title: 'Batal' }
        ]
      };
    }

    if (isFastEditCommand_(text)) {
      delete data.skipPengumumanCheck;
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: true,
        type: 'FAST_ADUAN_EDIT',
        reply: buildFastAduanInstructionReply_(data.cabang),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    if (!isFastConfirmYes_(text)) {
      return {
        success: true,
        type: 'FAST_ADUAN_CONFIRM',
        reply: buildFastAduanConfirmReply_(data),
        navButtons: buildFastAduanConfirmButtons_()
      };
    }

    if (!isFastDataComplete_(data)) {
      setWhatsAppSession_(phone, 'FAST_TEXT', data);
      return {
        success: false,
        type: 'FAST_ADUAN_INCOMPLETE_FINAL',
        reply: buildFastMissingReply_(data),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    var activeLimitFinal = buildActiveLimitResult_(phone);
    if (activeLimitFinal.blocked) {
      activeLimitFinal.result.type = 'MAX_ACTIVE_ADUAN_LIMIT_FAST_FINAL';
      return activeLimitFinal.result;
    }

    data.nama = normalizeNamaPelangganInput_(data.nama || '');
    data.wilayah = data.wilayah || String(data.cabang || '').replace(/^Cabang\s+/i, '');
    data.desa = data.noPelanggan;

    var created = createAduanFromWhatsApp_(phone, data);
    clearWhatsAppSession_(phone);
    setLastCreatedAduanIdForPhone_(phone, created.id);

    return {
      success: true,
      type: 'FAST_ADUAN_CREATED',
      id: created.id,
      reply: buildNewAduanCreatedReply_(created),
      navButtons: buildCreatedTicketButtons_(created.id)
    };
  }

  setWhatsAppSession_(phone, 'FAST_CABANG', data);
  return {
    success: true,
    type: 'ASK_CABANG',
    page: 1,
    reply: buildCabangMenuReply_(1)
  };
}



function handleNewAduanFlow_(message, phone, session, payload) {
  payload = payload || {};
  var text = String(message || '').trim();
  var data = session.data || {};

  if (session.state === 'NEW_PENGUMUMAN_CHECK') {
    return handleNewPengumumanCheck_(text, phone, data);
  }

  if (isNewAduanBackCommand_(text)) {
    return handleNewAduanBack_(phone, session, data);
  }

  if (shouldBlockNewAduanOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_FLOW',
      reply: buildOutsideHoursBlockedReply_('Buat Aduan'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  // V10.9.12:
  // Jangan cek batas aduan aktif di setiap step input karena bikin tombol terasa lama.
  // Cek sudah dilakukan saat mulai Buat Aduan dan dicek ulang sekali lagi sebelum simpan final.


  if (session.state === 'NEW_CABANG') {
    var cabangChoice = normalizeIncomingCabangChoice_(text, data.cabangPage || 1);

    if (!cabangChoice) {
      // V10.9.206: tetap di mode pilih cabang dan beri pesan khusus.
      return handleCabangInvalidChoice_(phone, 'NEW_CABANG');
    }

    resetCustomerInvalidInputCounter_(phone, 'NEW_CABANG');
    data.cabang = cabangChoice;
    data.wilayah = cabangChoice.replace(/^Cabang\s+/i, '');
    delete data.cabangPage;
    setWhatsAppSession_(phone, 'NEW_NAMA', data);

    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NAMA',
      reply: buildAskNamaPelangganReply_(cabangChoice),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_NAMA') {
    data.nama = text;

    // FIX V9.8:
    // Jika cabang sudah dipilih lewat List Menu, tidak perlu tanya wilayah/kecamatan lagi.
    // Langsung minta No Pelanggan.
    if (data.cabang) {
      if (!data.wilayah) data.wilayah = data.cabang.replace(/^Cabang\s+/i, '');
      setWhatsAppSession_(phone, 'NEW_DESA', data);
      return {
        success: true,
        type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
        reply: buildAskNoPelangganReply_(),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    setWhatsAppSession_(phone, 'NEW_WILAYAH', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_WILAYAH',
      reply: buildAskWilayahReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_WILAYAH') {
    data.wilayah = text;
    if (!data.cabang) data.cabang = inferCabangByWilayah_(text);
    setWhatsAppSession_(phone, 'NEW_DESA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
      reply: buildAskNoPelangganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_DESA') {
    var noPelanggan = normalizeNoPelanggan_(text);
    if (!noPelanggan) {
      return {
        success: false,
        type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
        reply: buildNoPelangganInvalidReply_(),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.noPelanggan = noPelanggan;
    data.desa = noPelanggan; // kompatibel dengan struktur kolom lama: kolom 5
    setWhatsAppSession_(phone, 'NEW_JENIS', data);
    return {
      success: true,
      type: 'ASK_JENIS_GANGGUAN',
      reply: 'Silakan pilih jenis laporan/gangguan.',
      jenisMenu: true
    };
  }

  if (session.state === 'NEW_JENIS') {
    var jenis = normalizeJenisGangguanChoice_(text) || normalizeJenisGangguan_(text);
    if (!jenis) {
      return {
        success: false,
        type: 'ASK_JENIS_GANGGUAN',
        reply: 'Pilihan jenis laporan belum sesuai. Silakan pilih dari menu.',
        jenisMenu: true
      };
    }

    data.jenis = jenis;
    setWhatsAppSession_(phone, 'NEW_KETERANGAN', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_KETERANGAN',
      reply: buildAskKeteranganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_KETERANGAN') {
    if (text.length < 3) {
      return {
        success: false,
        type: 'NEW_ADUAN_KETERANGAN_INVALID',
        reply: 'Keterangan terlalu pendek. Mohon ketik keterangan singkat gangguan.\n\nContoh:\n*Air mati sejak tadi pagi di rumah dan sekitar tetangga.*',
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.keterangan = text;
    setWhatsAppSession_(phone, 'NEW_LOKASI', data);

    return {
      success: true,
      type: 'NEW_ADUAN_ASK_LOKASI',
      reply: buildAskLocationReplyByJenis_(data.jenis),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_LOKASI') {
    var loc = payload.location || null;

    // FIX V10.1:
    // Beberapa provider mengirim share location sebagai teks:
    // "Location: -8.703289985657, 116.2587341309"
    if ((!loc || !loc.latitude || !loc.longitude) && text) {
      loc = extractCoordinatesFromText_(text);
    }

    if (loc && loc.latitude && loc.longitude) {
      data.latitude = loc.latitude;
      data.longitude = loc.longitude;
      data.linkMaps = loc.mapsUrl || buildGoogleMapsUrl_(loc.latitude, loc.longitude);
      data.lokasiDetail = loc.address || loc.name || 'Share location WhatsApp';
    } else {
      if (!text) {
        return {
          success: false,
          type: 'NEW_ADUAN_LOKASI_EMPTY',
          reply: buildAskLocationReply_(),
          navButtons: buildNewAduanControlButtons_()
        };
      }

      var lower = text.toLowerCase();
      if (['lewati', 'skip', 'tidak ada', '-'].indexOf(lower) !== -1) {
        data.lokasiDetail = 'Tidak diisi pelanggan';
      } else {
        data.lokasiDetail = text;
      }
    }

    var pengumumanCheckNew = maybePromptPengumumanBeforeAduan_(phone, data, 'NEW_PENGUMUMAN_CHECK');
    if (pengumumanCheckNew) return pengumumanCheckNew;

    var activeLimitFinal = buildActiveLimitResult_(phone);
    if (activeLimitFinal.blocked) {
      activeLimitFinal.result.type = 'MAX_ACTIVE_ADUAN_LIMIT_FINAL';
      return activeLimitFinal.result;
    }

    var created = createAduanFromWhatsApp_(phone, data);
    clearWhatsAppSession_(phone);
    setLastCreatedAduanIdForPhone_(phone, created.id);

    return {
      success: true,
      type: 'NEW_ADUAN_CREATED',
      id: created.id,
      reply: buildNewAduanCreatedReply_(created),
      navButtons: buildCreatedTicketButtons_(created.id)
    };
  }

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU',
    reply: buildMainWhatsAppMenuReply_(phone, (typeof payload !== 'undefined' ? payload : {}))
  };
}


function normalizeNoPelanggan_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  var lower = raw.toLowerCase();
  var blocked = ['belum tahu', 'tidak tahu', 'gak tahu', 'nggak tahu', 'ga tahu', 'tdk tahu', 'tidak ada', 'belum ada', '-'];
  if (blocked.indexOf(lower) !== -1) return '';

  // Hanya terima angka, spasi, dan tanda strip.
  // Contoh yang diterima: 0102030405, 01 020 304 05, 01-020-304-05.
  // Contoh yang ditolak: abc123, tidak tahu, 123.
  if (!/^[0-9\s-]+$/.test(raw)) return '';

  var digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 5 || digits.length > 20) return '';

  return digits;
}

function isNoPelangganValid_(text) {
  return !!normalizeNoPelanggan_(text);
}

function buildJenisGangguanRows_() {
  return [
    { id: 'JENIS_AIR_MATI', title: 'Air Mati', description: 'Aliran air tidak keluar' },
    { id: 'JENIS_TEKANAN_RENDAH', title: 'Tekanan Rendah', description: 'Air keluar kecil/lemah' },
    { id: 'JENIS_AIR_KERUH', title: 'Air Keruh', description: 'Air keruh/berwarna/berbau' },
    { id: 'JENIS_PIPA_BOCOR', title: 'Pipa Bocor', description: 'Kebocoran pipa/jaringan' },
    { id: 'JENIS_METER_BERMASALAH', title: 'Meter Bermasalah', description: 'Meter rusak/tidak normal' },
    { id: 'JENIS_TAGIHAN', title: 'Tagihan', description: 'Informasi/keluhan tagihan' },
    { id: 'JENIS_SAMBUNGAN_BARU', title: 'Sambungan Baru', description: 'Permohonan sambungan baru' },
    { id: 'JENIS_LAINNYA', title: 'Lainnya', description: 'Laporan lain terkait layanan' }
  ];
}

function sendKiriminJenisGangguanMenu_(phone) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk jenis gangguan menu.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Silakan pilih jenis laporan/gangguan.'
      },
      action: {
        button: 'Pilih Jenis',
        sections: [
          {
            title: 'Gangguan Teknis',
            rows: buildJenisGangguanRows_().slice(0, 5)
          },
          {
            title: 'Layanan Pelanggan',
            rows: buildJenisGangguanRows_().slice(5)
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function normalizeJenisGangguanChoice_(text) {
  var raw = String(text || '').trim();
  var lower = raw.toLowerCase();

  var map = {
    '1': 'Air Mati',
    '2': 'Tekanan Rendah',
    '3': 'Air Keruh',
    '4': 'Pipa Bocor',
    '5': 'Meter Bermasalah',
    '6': 'Tagihan',
    '7': 'Sambungan Baru',
    '8': 'Lainnya',
    'jenis_air_mati': 'Air Mati',
    'jenis_tekanan_rendah': 'Tekanan Rendah',
    'jenis_air_keruh': 'Air Keruh',
    'jenis_pipa_bocor': 'Pipa Bocor',
    'jenis_meter_bermasalah': 'Meter Bermasalah',
    'jenis_tagihan': 'Tagihan',
    'jenis_sambungan_baru': 'Sambungan Baru',
    'jenis_lainnya': 'Lainnya'
  };

  if (map[lower]) return map[lower];

  if (lower.indexOf('air mati') !== -1) return 'Air Mati';
  if (lower.indexOf('tekanan rendah') !== -1) return 'Tekanan Rendah';
  if (lower.indexOf('air keruh') !== -1) return 'Air Keruh';
  if (lower.indexOf('pipa bocor') !== -1 || lower.indexOf('bocor') !== -1) return 'Pipa Bocor';
  if (lower.indexOf('meter') !== -1) return 'Meter Bermasalah';
  if (lower.indexOf('tagihan') !== -1) return 'Tagihan';
  if (lower.indexOf('sambungan baru') !== -1 || lower.indexOf('pasang baru') !== -1) return 'Sambungan Baru';
  if (lower.indexOf('lain') !== -1) return 'Lainnya';

  return '';
}


function buildJenisGangguanMenu_() {
  return [
    'Pilih *jenis gangguan* dengan balas angka:',
    '',
    '*1.* Air Mati',
    '*2.* Tekanan Rendah',
    '*3.* Air Keruh',
    '*4.* Pipa Bocor',
    '*5.* Meter Bermasalah',
    '*6.* Tagihan',
    '*7.* Sambungan Baru',
    '*8.* Lainnya',
    '',
    'Contoh balasan: *1*'
  ].join('\n');
}

function normalizeJenisFromWhatsApp_(text) {
  var map = {
    '1': 'Air Mati',
    '2': 'Tekanan Rendah',
    '3': 'Air Keruh',
    '4': 'Pipa Bocor',
    '5': 'Meter Bermasalah',
    '6': 'Tagihan',
    '7': 'Sambungan Baru',
    '8': 'Lainnya'
  };

  var key = String(text || '').trim();
  if (map[key]) return map[key];

  return normalizeInputJenisGangguan_(text) || 'Lainnya';
}

function createAduanFromWhatsApp_(phone, data) {
  if (shouldBlockNewAduanOutsideHours_()) {
    throw new Error('CREATE_BLOCKED_OUTSIDE_HOURS: Pembuatan aduan baru tidak tersedia di luar jam kerja.');
  }

  var activeLimitInfo = getActiveAduanLimitInfo_(phone);
  if (activeLimitInfo.blocked) {
    throw new Error('CREATE_BLOCKED_ACTIVE_LIMIT: Nomor WhatsApp ini sudah memiliki ' + activeLimitInfo.count + ' aduan aktif. Maksimal ' + activeLimitInfo.max + '.');
  }


  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    setupAduanSheet(ss);
    sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  ensureRuntimeHeadersFast_(sh);

  var now = new Date();
  var cabang = data.cabang || inferCabangByWilayah_(data.wilayah);
  var code = getCabangCodeSafe_(cabang);
  var id = generateCabangAduanId_(code, now, sh);
  var priorityInfo = determineWhatsAppPriority_(data.jenis || 'Lainnya', data.keterangan || '', data.wilayah || '', data.noPelanggan || data.desa || '');
  var prioritas = normalizePriorityValue_(priorityInfo.prioritas || 'Sedang');
  var statusAduan = normalizeStatusValue_('Baru');
  var kategoriLayanan = getKategoriLayananByJenis_(data.jenis || 'Lainnya');
  var unitAduan = getUnitByJenisGangguan_(data.jenis || 'Lainnya');
  var slaJam = getSlaJamForPrioritas_(prioritas);
  var catatanWa = 'Masuk dari WhatsApp pelanggan';
  if (!isWithinBusinessHours_()) catatanWa += ' | Di luar jam kerja';
  catatanWa += ' | Kategori: ' + kategoriLayanan;
  catatanWa += ' | Unit otomatis: ' + unitAduan;
  if (priorityInfo.alasan) {
    catatanWa += ' | Prioritas otomatis: ' + prioritas + ' (' + priorityInfo.alasan + ')';
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
      data.lokasiDetail = 'Share location WhatsApp';
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
    (data.noPelanggan || data.desa || ''),
    data.nama || '',
    normalizePhone_(phone),
    data.jenis || 'Lainnya',
    prioritas,
    statusAduan,
    unitAduan,
    data.keterangan || '',
    catatanWa,
    '',
    slaJam,
    now,
    latitude,
    longitude,
    linkMaps,
    data.lokasiDetail || ''
  ]);

  var insertedRow = sh.getLastRow();

  // Fast mode: nilai prioritas/status/unit/SLA sudah diisi saat appendRow, jadi tidak perlu baca-tulis ulang sel.
  if (!isSiagaFastMode_()) {
    enforcePriorityStatusUnitForRow_(sh, insertedRow);
  }

  var createdAduan = parseAduanRowForTracking_(sh.getRange(insertedRow, 1, 1, Math.max(sh.getLastColumn(), 20)).getValues()[0]);
  try { invalidateAduanFindCacheById_(createdAduan.id); } catch(e) {}

  // Copy otomatis ke sheet aduan cabang terkait.
  try {
    mirrorAduanToCabangSheet_(createdAduan);
  } catch (mirrorErr) {
    logWhatsApp_(
      normalizePhone_(phone),
      'MIRROR_CABANG_ERROR',
      'CABANG_MIRROR_ERROR',
      createdAduan.id,
      '',
      'ERROR',
      mirrorErr.message
    );
  }

  // Kirim notifikasi otomatis ke petugas cabang terkait.
  try {
    createdAduan.notifikasiPetugas = notifyPetugasCabang_(createdAduan);
  } catch (notifyErr) {
    logWhatsApp_(
      normalizePhone_(phone),
      'NOTIF_PETUGAS_ERROR',
      'PETUGAS_NOTIFY_ERROR',
      createdAduan.id,
      '',
      'ERROR',
      notifyErr.message
    );
  }

  // V10.9.96: catat pembuatan aduan WhatsApp ke LOG_STATUS_ADUAN untuk riwayat/detail audit.
  try {
    logStatusAduan_(
      createdAduan.id,
      '',
      statusAduan,
      {
        nama: createdAduan.namaPelanggan || 'Pelanggan WhatsApp',
        noWa: normalizePhone_(phone),
        cabang: createdAduan.cabang || cabang || '-',
        role: 'Pelanggan'
      },
      'WHATSAPP_PELANGGAN',
      data.keterangan || '',
      JSON.stringify({ prioritas: prioritas, unit: unitAduan, noPelanggan: data.noPelanggan || data.desa || '' })
    );
  } catch(logCreateWaErr) {}

  return createdAduan;
}

function buildNewAduanCreatedReply_(d) {
  var statusIcon = (typeof getStatusIconForWa_ === 'function') ? getStatusIconForWa_(d.status) : '🆕';
  return [
    '✅ *Aduan Berhasil Dibuat*',
    '',
    'ID Aduan: *' + d.id + '*',
    '',
    'Aduan Anda telah berhasil diterima dan tercatat di sistem.',
    'Status: ' + statusIcon + ' *' + (d.status || 'Baru') + '*',
    'Nama: ' + (d.namaPelanggan || '-'),
    'Cabang: ' + (d.cabang || '-'),
    'Jenis: ' + (d.jenisGangguan || '-'),
    '',
    'Mohon maaf atas ketidaknyamanannya. Petugas akan segera melakukan pengecekan dan penanganan.',
    '',
    'Simpan ID Aduan ini untuk tracking. Gunakan tombol *Cek Tiket Ini* untuk melihat perkembangan aduan.'
  ].join('\n');
}



// ============================================================
// SHARE LOCATION WHATSAPP
// ============================================================

function setupLocationColumns_(sheet) {
  if (!sheet) return;

  var __fastKey = getSheetRuntimeKey_('LOCATION_SETUP_FAST_V1096', sheet);
  if (isSiagaFastMode_() && cacheGet_(__fastKey)) return;

  var headers = [
    { col: CONFIG.COL.LATITUDE || 17, name: 'Latitude', width: 100 },
    { col: CONFIG.COL.LONGITUDE || 18, name: 'Longitude', width: 100 },
    { col: CONFIG.COL.LINK_MAPS || 19, name: 'Link Maps', width: 220 },
    { col: CONFIG.COL.LOKASI_DETAIL || 20, name: 'Lokasi Detail', width: 220 }
  ];

  headers.forEach(function(h) {
    var cell = sheet.getRange(1, h.col);
    if (!cell.getValue()) {
      cell.setValue(h.name);
      cell
        .setBackground('#1e3a5f')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }
    try { sheet.setColumnWidth(h.col, h.width); } catch(e) {}
  });
  cachePut_(__fastKey, '1', 21600);

}

function buildAskLocationReply_() {
  return [
    '📍 *Lokasi Gangguan*',
    '',
    'Mohon kirim lokasi gangguan agar petugas lebih mudah menemukan titik masalah.',
    '',
    'Bisa pilih salah satu:',
    '1. Kirim *Share Location* WhatsApp',
    '2. Atau ketik alamat/patokan lengkap',
    '',
    'Contoh:',
    '*Dusun Bogak, dekat masjid, rumah pagar biru*',
    '',
    'Kalau belum bisa kirim lokasi, ketik *lewati*.'
  ].join('\n');
}

function extractLocationFromPayload_(obj) {
  obj = obj || {};
  var data = obj.data || {};

  var candidates = [
    data.location,
    data.content && data.content.location,
    data.content,
    data.message && data.message.location,
    data.message,
    obj.location,
    obj.content && obj.content.location,
    obj.content,
    obj.message && obj.message.location,
    obj.message
  ];

  // Kalau content berupa string JSON lokasi, coba parse.
  if (typeof data.content === 'string' && data.content.charAt(0) === '{') {
    try { candidates.push(JSON.parse(data.content)); } catch(e) {}
  }
  if (typeof obj.content === 'string' && obj.content.charAt(0) === '{') {
    try { candidates.push(JSON.parse(obj.content)); } catch(e) {}
  }

  for (var i = 0; i < candidates.length; i++) {
    var loc = normalizeLocationObject_(candidates[i]);
    if (loc) return loc;
  }

  // Beberapa webhook meletakkan latitude/longitude langsung di data.
  return normalizeLocationObject_(data) || normalizeLocationObject_(obj);
}

function normalizeLocationObject_(obj) {
  if (!obj || typeof obj !== 'object') return null;

  var lat = obj.latitude || obj.lat || obj.latitute || obj.y || obj.location_latitude;
  var lng = obj.longitude || obj.lng || obj.lon || obj.long || obj.x || obj.location_longitude;

  // Format nested umum
  if ((!lat || !lng) && obj.coordinates) {
    lat = obj.coordinates.latitude || obj.coordinates.lat || lat;
    lng = obj.coordinates.longitude || obj.coordinates.lng || obj.coordinates.lon || lng;
  }

  lat = String(lat || '').replace(',', '.').trim();
  lng = String(lng || '').replace(',', '.').trim();

  if (!lat || !lng) return null;

  var latNum = Number(lat);
  var lngNum = Number(lng);

  if (isNaN(latNum) || isNaN(lngNum)) return null;
  if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return null;

  var address = obj.address || obj.formatted_address || obj.description || obj.caption || '';
  var name = obj.name || obj.title || obj.location_name || '';

  return {
    latitude: latNum,
    longitude: lngNum,
    address: String(address || '').trim(),
    name: String(name || '').trim(),
    mapsUrl: buildGoogleMapsUrl_(latNum, lngNum)
  };
}

function buildGoogleMapsUrl_(lat, lng) {
  if (!lat || !lng) return '';
  return 'https://www.google.com/maps?q=' + encodeURIComponent(String(lat) + ',' + String(lng));
}



function extractCoordinatesFromText_(text) {
  text = String(text || '').trim();
  if (!text) return null;

  // Format umum:
  // Location: -8.703289985657, 116.2587341309
  // -8.703289985657,116.2587341309
  // https://www.google.com/maps?q=-8.703289985657,116.2587341309
  var match = text.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!match) return null;

  var lat = Number(String(match[1]).replace(',', '.'));
  var lng = Number(String(match[2]).replace(',', '.'));

  if (isNaN(lat) || isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    latitude: lat,
    longitude: lng,
    address: '',
    name: 'Share location WhatsApp',
    mapsUrl: buildGoogleMapsUrl_(lat, lng)
  };
}

function fixExistingShareLocationRows() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sh || safeGetLastRow_(sh) < 2) {
    ui.alert('Tidak ada data ADUAN yang bisa dicek.');
    return;
  }

  setupLocationColumns_(sh);

  var lastRow = safeGetLastRow_(sh);
  var lastCol = Math.max(sh.getLastColumn(), 20);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var fixed = 0;

  values.forEach(function(row, i) {
    var rowNumber = i + 2;

    var latitude = String(row[(CONFIG.COL.LATITUDE || 17) - 1] || '').trim();
    var longitude = String(row[(CONFIG.COL.LONGITUDE || 18) - 1] || '').trim();
    var linkMaps = String(row[(CONFIG.COL.LINK_MAPS || 19) - 1] || '').trim();
    var lokasiDetail = String(row[(CONFIG.COL.LOKASI_DETAIL || 20) - 1] || '').trim();

    if (latitude && longitude && linkMaps) return;

    var loc = null;

    // Cek Lokasi Detail dulu
    if (lokasiDetail) loc = extractCoordinatesFromText_(lokasiDetail);

    // Kalau provider menaruh lokasi di Catatan karena data lama geser/overflow
    if (!loc) {
      var catatan = String(row[(CONFIG.COL.CATATAN || 13) - 1] || '').trim();
      loc = extractCoordinatesFromText_(catatan);
    }

    // Scan semua sel di baris untuk jaga-jaga.
    if (!loc) {
      for (var c = 0; c < row.length; c++) {
        loc = extractCoordinatesFromText_(row[c]);
        if (loc) break;
      }
    }

    if (!loc) return;

    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LATITUDE || 17, loc.latitude);
    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LONGITUDE || 18, loc.longitude);
    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LINK_MAPS || 19, loc.mapsUrl);

    if (!lokasiDetail || lokasiDetail.indexOf('Location:') !== -1) {
      safeSetCellValue_(sh, rowNumber, CONFIG.COL.LOKASI_DETAIL || 20, 'Share location WhatsApp');
    }

    fixed++;
  });

  ui.alert(
    fixed > 0 ? '✅ Lokasi berhasil diperbaiki' : 'ℹ️ Tidak ada baris yang perlu diperbaiki',
    'Jumlah baris diperbaiki: ' + fixed,
    ui.ButtonSet.OK
  );
}



function testNormalizeListMenuChoice() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Baca Pilihan List Menu',
    'Tempel teks dari pilihan WhatsApp. Contoh: Buat Aduan Baru Laporkan gangguan air',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var text = prompt.getResponseText();
  var mapped = normalizeIncomingListMenuChoice_(text);

  ui.alert(
    mapped ? '✅ Terbaca sebagai menu ' + mapped : '⚠️ Belum terbaca',
    'Input:\\n' + text + '\\n\\nHasil mapping: ' + (mapped || '-'),
    ui.ButtonSet.OK
  );
}


function testParseShareLocationPayload() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Payload Share Location',
    'Tempel contoh raw JSON webhook lokasi dari LOG_WHATSAPP.',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var raw = prompt.getResponseText();
  var parsed = parseIncomingPayload_(raw, {});
  ui.alert(
    parsed.location ? '✅ Lokasi terbaca' : '⚠️ Lokasi belum terbaca',
    JSON.stringify(parsed, null, 2),
    ui.ButtonSet.OK
  );
}



// ============================================================
// FIX PRIORITAS / STATUS / UNIT OTOMATIS
// ============================================================


// ============================================================
// SAFE SHEETS OPERATION UNTUK GOOGLE SHEETS TABLE / TYPED COLUMNS
// ============================================================

function isTypedColumnError_(err) {
  var msg = String((err && err.message) || err || '').toLowerCase();
  return msg.indexOf('kolom dengan jenis') !== -1 ||
         msg.indexOf('typed column') !== -1 ||
         msg.indexOf('cells in typed columns') !== -1 ||
         msg.indexOf('column with type') !== -1;
}

function safeGetLastRow_(sheet) {
  if (!sheet) return 0;

  try {
    return sheet.getLastRow();
  } catch (err) {
    // Fallback untuk sheet yang memakai Google Sheets Table/typed columns.
    try {
      var maxRows = Math.min(sheet.getMaxRows(), 5000);
      var maxCols = Math.min(sheet.getMaxColumns(), 20);
      var values = sheet.getRange(1, 1, maxRows, maxCols).getDisplayValues();

      for (var r = values.length - 1; r >= 0; r--) {
        if (values[r].join('').trim() !== '') return r + 1;
      }

      return 0;
    } catch (innerErr) {
      return 0;
    }
  }
}

function safeSetCellValue_(sheet, row, col, value) {
  try {
    sheet.getRange(row, col).setValue(value);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: String((err && err.message) || err || ''),
      typedColumn: isTypedColumnError_(err)
    };
  }
}

function safeGetCellValue_(sheet, row, col) {
  try {
    return sheet.getRange(row, col).getValue();
  } catch (err) {
    return '';
  }
}

function alertTypedTableIfNeeded_(errors) {
  errors = errors || [];
  var typed = errors.some(function(e) { return e && e.typedColumn; });

  if (!typed) return '';

  return '\\n\\nCatatan: Sheet masih memakai Google Sheets Table/typed columns. Jika masih gagal, klik nama Table di kiri atas lalu pilih Revert to unformatted data / ubah ke range biasa.';
}


function normalizePriorityValue_(value) {
  value = String(value || '').trim().toLowerCase();

  if (value === 'darurat') return 'Darurat';
  if (value === 'tinggi') return 'Tinggi';
  if (value === 'sedang') return 'Sedang';
  if (value === 'rendah') return 'Rendah';

  return 'Sedang';
}

function normalizeStatusValue_(value) {
  value = String(value || '').trim().toLowerCase();

  if (value === 'baru') return 'Baru';
  if (value === 'proses') return 'Proses';
  if (value === 'selesai') return 'Selesai';
  if (value === 'ditunda') return 'Ditunda';
  if (value === 'batal') return 'Batal';

  return 'Baru';
}

function enforcePriorityStatusUnitForRow_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return { success: true, errors: [] };

  var errors = [];

  var jenis = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.JENIS_GANGGUAN) || '').trim();
  var prioritas = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS) || '').trim();
  var status = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.STATUS) || '').trim();
  var unit = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.UNIT) || '').trim();
  var wilayah = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.WILAYAH) || '').trim();
  var desa = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.DESA) || '').trim();
  var keterangan = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.KETERANGAN) || '').trim();

  if (!prioritas) {
    var p = determineWhatsAppPriority_(jenis || 'Lainnya', keterangan, wilayah, desa);
    prioritas = normalizePriorityValue_(p.prioritas || 'Sedang');

    var resP = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS, prioritas);
    if (!resP.success) errors.push(resP);

    var catatan = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.CATATAN) || '').trim();
    if (p.alasan && catatan.indexOf('Prioritas otomatis') === -1) {
      var resC = safeSetCellValue_(
        sheet,
        rowNumber,
        CONFIG.COL.CATATAN,
        (catatan ? catatan + ' | ' : '') + 'Prioritas otomatis: ' + prioritas + ' (' + p.alasan + ')'
      );
      if (!resC.success) errors.push(resC);
    }
  }

  if (!status) {
    var resS = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.STATUS, 'Baru');
    if (!resS.success) errors.push(resS);
  }

  if (!unit) {
    var autoUnit = getUnitByJenisGangguan_(jenis || 'Lainnya');
    var resU = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.UNIT, autoUnit);
    if (!resU.success) errors.push(resU);
  }

  var sla = safeGetCellValue_(sheet, rowNumber, CONFIG.COL.SLA_JAM);
  if (!sla) {
    var finalPriority = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS) || prioritas || 'Sedang').trim();
    var resSla = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.SLA_JAM, getSlaJamForPrioritas_(finalPriority));
    if (!resSla.success) errors.push(resSla);
  }

  return {
    success: errors.length === 0,
    errors: errors
  };
}


function fixExistingPriorityStatusUnitRows() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!main || safeGetLastRow_(main) < 2) {
    ui.alert('Tidak ada data ADUAN yang bisa diperbaiki.');
    return;
  }

  var resultMain = fixPriorityStatusUnitInSheet_(main);

  var totalCabang = { checked: 0, fixed: 0, errors: [] };
  ss.getSheets().forEach(function(sh) {
    if (String(sh.getName()).indexOf('CABANG_') === 0) {
      var r = fixPriorityStatusUnitInSheet_(sh);
      totalCabang.checked += r.checked;
      totalCabang.fixed += r.fixed;
      totalCabang.errors = totalCabang.errors.concat(r.errors || []);
    }
  });

  var allErrors = (resultMain.errors || []).concat(totalCabang.errors || []);

  ui.alert(
    allErrors.length ? '⚠️ Perbaikan selesai dengan catatan' : '✅ Perbaikan selesai',
    'ADUAN utama dicek: ' + resultMain.checked + ' baris\\n' +
    'ADUAN utama diperbaiki: ' + resultMain.fixed + ' baris\\n' +
    'Sheet cabang dicek: ' + totalCabang.checked + ' baris\\n' +
    'Sheet cabang diperbaiki: ' + totalCabang.fixed + ' baris\\n' +
    'Error dilewati: ' + allErrors.length +
    alertTypedTableIfNeeded_(allErrors),
    ui.ButtonSet.OK
  );
}

function fixPriorityStatusUnitInSheet_(sheet) {
  if (!sheet || safeGetLastRow_(sheet) < 2) return { checked: 0, fixed: 0, errors: [] };

  var checked = 0;
  var fixed = 0;
  var errors = [];
  var lastRow = safeGetLastRow_(sheet);

  for (var r = 2; r <= lastRow; r++) {
    var id = String(safeGetCellValue_(sheet, r, CONFIG.COL.ID) || '').trim();
    var jenis = String(safeGetCellValue_(sheet, r, CONFIG.COL.JENIS_GANGGUAN) || '').trim();

    if (!id && !jenis) continue;

    var beforeP = String(safeGetCellValue_(sheet, r, CONFIG.COL.PRIORITAS) || '').trim();
    var beforeS = String(safeGetCellValue_(sheet, r, CONFIG.COL.STATUS) || '').trim();
    var beforeU = String(safeGetCellValue_(sheet, r, CONFIG.COL.UNIT) || '').trim();

    var result = enforcePriorityStatusUnitForRow_(sheet, r);
    checked++;

    var afterP = String(safeGetCellValue_(sheet, r, CONFIG.COL.PRIORITAS) || '').trim();
    var afterS = String(safeGetCellValue_(sheet, r, CONFIG.COL.STATUS) || '').trim();
    var afterU = String(safeGetCellValue_(sheet, r, CONFIG.COL.UNIT) || '').trim();

    if ((!beforeP && afterP) || (!beforeS && afterS) || (!beforeU && afterU)) fixed++;
    if (result && result.errors && result.errors.length) errors = errors.concat(result.errors);
  }

  return {
    checked: checked,
    fixed: fixed,
    errors: errors
  };
}


function onEdit(e) {
  // V10.9.38:
  // 1. INPUT_ cabang tetap bisa isi tanggal otomatis.
  // 2. ADUAN utama tetap auto-fill Prioritas/Status/Unit.
  // 3. CABANG_ mirror sekarang punya dropdown dan perubahan Status/Unit/Catatan disinkronkan ke ADUAN.
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (!sh) return;

    var name = sh.getName();

    // Sheet input cabang: isi Tanggal Input otomatis saat Nama Pelanggan diketik.
    if (isCabangInputSheet_(name)) {
      handleInputCabangEdit_(e);
      return;
    }

    var isMainAduan = name === CONFIG.SHEET_NAME;
    var isCabangMirror = isCabangMirrorSheetName_(name);
    if (!isMainAduan && !isCabangMirror) return;

    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row < 2) return;

    // Pastikan dropdown tetap ada dan Cabang/Wilayah otomatis mengikuti sheet cabang.
    if (isCabangMirror) {
      try { applyCabangMirrorDropdowns_(sh); } catch(dropErr) {}
      try { autoFillCabangWilayahForMirrorRow_(sh, row); } catch(autoFillErr) {}
    }

    // BUGFIX V11.10.3: lapisan kedua selain onOpen() -- kalau spreadsheet sudah
    // lama terbuka (onOpen tidak sempat jalan ulang hari itu), pastikan kolom
    // No Pelanggan tetap Plain Text ('@') minimal tiap 6 jam sekali (cache-gated,
    // murah) supaya edit-edit berikutnya di baris lain tidak ikut kehilangan nol
    // di depan.
    if (isCabangMirror || isMainAduan) {
      try { ensureNoPelangganColumnHeader_(false); } catch (eNoPelOnEdit) {}
    }

    if (
      col === CONFIG.COL.JENIS_GANGGUAN ||
      col === CONFIG.COL.KETERANGAN ||
      col === CONFIG.COL.PRIORITAS ||
      col === CONFIG.COL.STATUS ||
      col === CONFIG.COL.UNIT ||
      col === CONFIG.COL.CATATAN
    ) {
      enforcePriorityStatusUnitForRow_(sh, row);
    }

    // Jika edit terjadi di ADUAN, update/cerminkan ulang ke sheet CABANG_*.
    if (isMainAduan) {
      syncAduanEditToCabangMirror_(e);
    }

    // Jika edit terjadi di CABANG_*, update balik ke ADUAN pusat.
    if (isCabangMirror) {
      syncCabangMirrorEditToAduan_(e);
    }
  } catch (err) {
    // Jangan tampilkan error ke user saat edit sheet.
  }
}


// ============================================================
// KATEGORI LAYANAN - TEKNIS VS PELANGGAN
// ============================================================

function getKategoriLayananByJenis_(jenis) {
  jenis = String(jenis || '').toLowerCase();

  if (
    jenis.indexOf('tagihan') !== -1 ||
    jenis.indexOf('sambungan baru') !== -1 ||
    jenis.indexOf('pasang baru') !== -1
  ) {
    return 'Layanan Pelanggan';
  }

  return 'Gangguan Teknis';
}

function getUnitByJenisGangguan_(jenis) {
  jenis = String(jenis || '').toLowerCase();

  if (
    jenis.indexOf('tagihan') !== -1 ||
    jenis.indexOf('sambungan baru') !== -1 ||
    jenis.indexOf('pasang baru') !== -1 ||
    jenis.indexOf('meter') !== -1
  ) {
    return 'Hublang';
  }

  if (
    jenis.indexOf('air mati') !== -1 ||
    jenis.indexOf('tekanan rendah') !== -1 ||
    jenis.indexOf('pipa bocor') !== -1 ||
    jenis.indexOf('air keruh') !== -1
  ) {
    return 'Teknik';
  }

  return 'Cabang';
}

function isLayananPelanggan_(jenis) {
  return getKategoriLayananByJenis_(jenis) === 'Layanan Pelanggan';
}
function isAdminRelatedJenis_(jenis) {
  jenis = String(jenis || '').toLowerCase();
  return (
    jenis.indexOf('tagihan') !== -1 ||
    jenis.indexOf('rekening') !== -1 ||
    jenis.indexOf('administrasi') !== -1 ||
    jenis.indexOf('sambungan baru') !== -1 ||
    jenis.indexOf('pasang baru') !== -1 ||
    jenis.indexOf('balik nama') !== -1
  );
}

function isAdminRelatedCustomerText_(text) {
  text = String(text || '').toLowerCase();
  var keywords = [
    'tagihan', 'rekening', 'pembayaran', 'sudah bayar', 'belum lunas', 'lunas',
    'tagihan naik', 'tagihan mahal', 'tagihan melonjak', 'rekening naik', 'rekening mahal',
    'denda', 'tarif', 'administrasi', 'balik nama', 'nama pelanggan', 'no pelanggan',
    'nomor pelanggan', 'pasang baru', 'sambungan baru', 'buka kembali', 'tutup sambungan'
  ];
  for (var i = 0; i < keywords.length; i++) {
    if (text.indexOf(keywords[i]) !== -1) return true;
  }
  return false;
}


function buildAskKeteranganReplyByJenis_(jenis) {
  var kategori = getKategoriLayananByJenis_(jenis);

  if (kategori === 'Layanan Pelanggan') {
    if (String(jenis || '').toLowerCase().indexOf('tagihan') !== -1) {
      return [
        'Ketik *keterangan tagihan* yang ingin ditanyakan.',
        '',
        'Contoh:',
        '*Tagihan bulan ini naik, mohon dicek.*',
        '*Saya mau cek tagihan atas nama pelanggan ini.*'
      ].join('\n');
    }

    if (String(jenis || '').toLowerCase().indexOf('sambungan') !== -1) {
      return [
        'Ketik *keterangan kebutuhan sambungan baru*.',
        '',
        'Contoh:',
        '*Ingin pasang sambungan baru di rumah, mohon info syarat dan prosesnya.*'
      ].join('\n');
    }
  }

  return [
    'Ketik *keterangan singkat* gangguan.',
    '',
    'Contoh:',
    '*Air mati sejak tadi pagi*',
    '*Pipa bocor besar di pinggir jalan*',
    '*Air keruh dan berbau*'
  ].join('\n');
}

function buildAskLocationReplyByJenis_(jenis) {
  var kategori = getKategoriLayananByJenis_(jenis);

  if (kategori === 'Layanan Pelanggan') {
    return [
      '📍 *Alamat / Lokasi Pelanggan*',
      '',
      'Mohon ketik alamat atau patokan lokasi pelanggan.',
      '',
      'Untuk layanan pelanggan, share location tidak wajib, tapi alamat/patokan tetap membantu admin.',
      '',
      'Contoh:',
      '*Dusun Bogak, dekat masjid, rumah pagar biru*',
      '',
      'Kalau belum ada lokasi, ketik *lewati*.'
    ].join('\n');
  }

  return buildAskLocationReply_();
}


function determineWhatsAppPriority_(jenis, keterangan, wilayah, desa) {
  jenis = String(jenis || '').toLowerCase();
  var text = [
    jenis,
    keterangan || '',
    wilayah || '',
    desa || ''
  ].join(' ').toLowerCase();

  // Layanan pelanggan tidak masuk kategori darurat teknis.
  if (jenis.indexOf('tagihan') !== -1) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan pelanggan - tagihan'
    };
  }

  if (jenis.indexOf('sambungan baru') !== -1 || jenis.indexOf('pasang baru') !== -1) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan pelanggan - sambungan baru'
    };
  }

  // Kata kunci kondisi bahaya / berdampak besar.
  var emergencyKeywords = [
    'bahaya', 'darurat', 'listrik', 'tiang listrik', 'setrum',
    'banjir', 'tergenang', 'jalan tergenang', 'longsor',
    'pipa pecah', 'pecah besar', 'bocor besar', 'bocor deras',
    'semburan', 'sembur', 'jalan raya', 'mengganggu jalan',
    'rumah sakit', 'rs ', 'puskesmas', 'sekolah',
    'kantor pelayanan', 'pemadam', 'kebakaran'
  ];

  var highKeywords = [
    'air mati total', 'mati total', 'tidak mengalir',
    'satu dusun', 'satu desa', 'banyak rumah', 'banyak pelanggan',
    'semua rumah', 'seharian', 'dari kemarin', '2 hari', 'dua hari',
    'lebih dari sehari', 'total', 'parah'
  ];

  var lowKeywords = [
    'tagihan', 'rekening', 'bayar', 'pembayaran',
    'sambungan baru', 'pasang baru', 'informasi',
    'tanya', 'bertanya'
  ];

  if (containsAny_(text, emergencyKeywords)) {
    return {
      prioritas: 'Darurat',
      alasan: 'indikasi bahaya/dampak besar'
    };
  }

  if (jenis.indexOf('pipa bocor') !== -1) {
    if (containsAny_(text, ['deras', 'besar', 'jalan', 'tergenang', 'bahaya', 'pecah'])) {
      return {
        prioritas: 'Darurat',
        alasan: 'pipa bocor berisiko/dampak besar'
      };
    }
    return {
      prioritas: 'Tinggi',
      alasan: 'pipa bocor perlu penanganan cepat'
    };
  }

  if (jenis.indexOf('air mati') !== -1) {
    if (containsAny_(text, highKeywords)) {
      return {
        prioritas: 'Tinggi',
        alasan: 'air mati berdampak luas/lama'
      };
    }
    return {
      prioritas: 'Tinggi',
      alasan: 'air mati'
    };
  }

  if (jenis.indexOf('tekanan rendah') !== -1) {
    if (containsAny_(text, ['total', 'seharian', 'banyak', 'satu dusun', 'satu desa'])) {
      return {
        prioritas: 'Tinggi',
        alasan: 'tekanan rendah berdampak luas/lama'
      };
    }
    return {
      prioritas: 'Sedang',
      alasan: 'tekanan rendah'
    };
  }

  if (jenis.indexOf('air keruh') !== -1) {
    if (containsAny_(text, ['bau', 'hitam', 'berminyak', 'tidak layak', 'sakit', 'gatal'])) {
      return {
        prioritas: 'Tinggi',
        alasan: 'indikasi kualitas air serius'
      };
    }
    return {
      prioritas: 'Sedang',
      alasan: 'air keruh'
    };
  }

  if (jenis.indexOf('meter') !== -1) {
    return {
      prioritas: 'Sedang',
      alasan: 'meter bermasalah'
    };
  }

  if (containsAny_(text, lowKeywords)) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan administrasi/informasi'
    };
  }

  return {
    prioritas: 'Sedang',
    alasan: 'default aduan WhatsApp'
  };
}

function containsAny_(text, keywords) {
  text = String(text || '').toLowerCase();
  keywords = keywords || [];
  for (var i = 0; i < keywords.length; i++) {
    if (text.indexOf(String(keywords[i]).toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

function inferCabangByWilayah_(wilayah) {
  var w = String(wilayah || '').toLowerCase();

  if (w.indexOf('praya barat daya') !== -1) return 'Cabang Praya Barat Daya';
  if (w.indexOf('praya barat') !== -1) return 'Cabang Praya Barat';
  if (w.indexOf('praya timur') !== -1) return 'Cabang Praya Timur';
  if (w.indexOf('praya tengah') !== -1) return 'Cabang Praya Tengah';
  if (w.indexOf('praya') !== -1) return 'Cabang Praya';
  if (w.indexOf('pujut') !== -1) return 'Cabang Pujut';
  if (w.indexOf('jonggat') !== -1) return 'Cabang Jonggat';
  if (w.indexOf('kopang') !== -1) return 'Cabang Kopang';
  if (w.indexOf('janapria') !== -1) return 'Cabang Janapria';
  if (w.indexOf('batukliang utara') !== -1) return 'Cabang Batukliang Utara';
  if (w.indexOf('batukliang') !== -1) return 'Cabang Batukliang';
  if (w.indexOf('pringgarata') !== -1) return 'Cabang Pringgarata';

  return 'Cabang Lainnya';
}

function buildContactAdminReply_() {
  return [
    'Baik, Anda akan dihubungkan ke admin.',
    '',
    'Mohon tuliskan keperluan Anda secara singkat.',
    '',
    'Ketik *menu* jika ingin kembali ke layanan otomatis.'
  ].join('\n');
}


// ============================================================
// V10.9.8 - BATAS ADUAN AKTIF PER NOMOR HP
// ============================================================

function isActiveAduanStatus_(status) {
  status = String(status || '').trim().toLowerCase();

  // Status final tidak dihitung aktif.
  if (status === 'selesai') return false;
  if (status === 'batal') return false;

  // Baru, Proses, Ditunda, Menunggu Validasi, dan status lain dianggap masih aktif.
  return true;
}

function getMaxActiveAduanPerPhone_() {
  // V10.9.274: aturan SIAGA dikunci 1 nomor WhatsApp = 1 aduan aktif.
  // Jangan mengikuti runtime setting lama jika sempat berubah, agar pelanggan tidak bisa membuat aduan baru
  // sebelum aduan aktif sebelumnya berstatus Selesai atau Batal.
  return 1;
}

function getActiveLimitPhoneKey_(phone) {
  var normalized = normalizePhone_(phone || '');
  if (!normalized) return '';
  // Pengaman jika format nomor di sheet/provider berbeda tipis: +62/62/08/scientific notation.
  // Ambil 10 digit terakhir sebagai kunci pembanding tambahan.
  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

function isSamePhoneForActiveLimit_(a, b) {
  var na = normalizePhone_(a || '');
  var nb = normalizePhone_(b || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  var ka = getActiveLimitPhoneKey_(na);
  var kb = getActiveLimitPhoneKey_(nb);
  return !!(ka && kb && ka === kb);
}

function addUniqueActiveAduanForLimit_(list, d, maxList) {
  if (!d || !isActiveAduanStatus_(d.status)) return;
  var id = normalizeAduanIdHyphen_(d.id || '');
  for (var i = 0; i < list.length; i++) {
    if (id && normalizeAduanIdHyphen_(list[i].id || '') === id) return;
  }
  list.push(d);
  if (list.length > maxList) list.length = maxList;
}

function getActiveAduansByPhone_(phone, limit) {
  phone = normalizePhone_(phone || '');
  if (!phone) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var lastRow = sh.getLastRow();

  // V10.9.274:
  // Baca minimal sampai kolom lokasi detail agar parseAduanRowForTracking_ aman meskipun header bertambah.
  // Pembacaan tetap ringan karena hanya 20 kolom utama ADUAN.
  var lastCol = Math.max(
    CONFIG.COL.LOKASI_DETAIL || 20,
    CONFIG.COL.STATUS || 10,
    CONFIG.COL.NO_HP || 7,
    CONFIG.COL.JENIS_GANGGUAN || 8,
    CONFIG.COL.WAKTU_MASUK || 2
  );
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var list = [];
  var maxList = Number(limit || 20);

  // Scan dari baris terbaru ke lama. Biasanya aduan aktif ada di data terbaru.
  for (var i = values.length - 1; i >= 0; i--) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || !isSamePhoneForActiveLimit_(d.noHp, phone)) continue;
    if (!isActiveAduanStatus_(d.status)) continue;

    addUniqueActiveAduanForLimit_(list, d, maxList);
    if (list.length >= maxList) break;
  }

  return list;
}

function getActiveAduanLimitInfo_(phone) {
  phone = normalizePhone_(phone || '');
  var maxActive = getMaxActiveAduanPerPhone_();
  var activeList = getActiveAduansByPhone_(phone, maxActive + 5);

  // V10.9.274: backup check dari ID aduan terakhir yang dibuat nomor ini.
  // Ini menutup celah ketika scan sheet lambat/nomor provider beda format, tetapi sistem sudah tahu tiket terakhir.
  try {
    var lastId = getLastCreatedAduanIdForPhone_(phone);
    if (lastId) {
      var lastAduan = findAduanById_(lastId);
      if (lastAduan && isSamePhoneForActiveLimit_(lastAduan.noHp, phone) && isActiveAduanStatus_(lastAduan.status)) {
        addUniqueActiveAduanForLimit_(activeList, lastAduan, maxActive + 5);
      }
    }
  } catch (eLastActive) {}

  return {
    max: maxActive,
    count: activeList.length,
    blocked: activeList.length >= maxActive,
    list: activeList
  };
}

function buildMaxActiveAduanReply_(limitInfo) {
  limitInfo = limitInfo || {};
  var maxActive = limitInfo.max || getMaxActiveAduanPerPhone_();
  var list = limitInfo.list || [];

  var lines = [
    'Nomor WhatsApp ini masih memiliki *' + list.length + ' aduan aktif*.',
    '',
    'Untuk menghindari duplikasi laporan, pengajuan aduan baru sementara dibatasi maksimal *' + maxActive + ' aduan aktif* per nomor WhatsApp.',
    '',
    'Aduan aktif saat ini:'
  ];

  if (list.length) {
    list.slice(0, maxActive).forEach(function(d, idx) {
      lines.push(
        (idx + 1) + '. *' + (d.id || '-') + '* - ' + (d.status || '-') + ' - ' + (d.jenisGangguan || '-')
      );
    });
  } else {
    lines.push('-');
  }

  lines.push('');
  lines.push('Silakan pilih *Cek Status Aduan* untuk melihat progres aduan dari nomor WhatsApp ini atau kirim ID aduan.');
  lines.push('');
  lines.push('Aduan baru dapat dibuat kembali setelah salah satu aduan selesai atau dibatalkan.');

  return lines.join('\n');
}

function buildActiveLimitResult_(phone) {
  var info = getActiveAduanLimitInfo_(phone);

  if (!info.blocked) {
    return {
      blocked: false,
      info: info
    };
  }

  clearWhatsAppSession_(phone);

  return {
    blocked: true,
    result: {
      success: false,
      type: 'MAX_ACTIVE_ADUAN_LIMIT',
      reply: buildMaxActiveAduanReply_(info),
      navButtons: buildNavButtons_('active_limit')
    },
    info: info
  };
}

function setMaxActiveAduanPerPhone() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Batas Aduan Aktif per Nomor WA',
    'Masukkan jumlah maksimal aduan aktif per nomor WhatsApp.\n\nDefault dan rekomendasi saat ini: 1',
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var value = Number(prompt.getResponseText());
  if (!value || value < 1) {
    ui.alert('Nilai tidak valid. Minimal 1.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('MAX_ACTIVE_ADUAN_PER_PHONE', String(value));

  ui.alert(
    '✅ Batas disimpan',
    'Maksimal aduan aktif per nomor WhatsApp sekarang: ' + value,
    ui.ButtonSet.OK
  );
}

function cekAduanAktifByPhone() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Cek Aduan Aktif Nomor WA',
    'Masukkan nomor HP/WA pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = normalizePhone_(prompt.getResponseText());
  var info = getActiveAduanLimitInfo_(phone);

  ui.alert(
    info.blocked ? '⚠️ Nomor mencapai batas aduan aktif' : '✅ Nomor masih bisa membuat aduan',
    'No WA: ' + phone + '\n' +
    'Aduan aktif: ' + info.count + '\n' +
    'Batas maksimal: ' + info.max + '\n\n' +
    info.list.map(function(d, idx) {
      return (idx + 1) + '. ' + d.id + ' - ' + d.status + ' - ' + d.jenisGangguan;
    }).join('\n'),
    ui.ButtonSet.OK
  );
}


function findAduansByPhone_(phone, limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var target = normalizePhone_(phone);
  var list = [];

  for (var i = 0; i < values.length; i++) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || normalizePhone_(d.noHp) !== target) continue;
    list.push(d);
  }

  list.sort(function(a, b) {
    var aOpen = isActiveAduanStatus_(a.status);
    var bOpen = isActiveAduanStatus_(b.status);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return (b.waktuMasukDate || 0) - (a.waktuMasukDate || 0);
  });

  return list.slice(0, limit || 10);
}


// ============================================================
// V10.9.7 - SESSION TIMEOUT
// ============================================================

function getWhatsAppSessionTimeoutMinutes_(state) {
  state = String(state || '').trim().toUpperCase();

  // MAIN hanya menu awal, tidak perlu dipaksa tutup cepat.
  if (state === 'MAIN') {
    return Number(CONFIG.SESSION_TIMEOUT_MAIN_MINUTES || 15);
  }

  // State non-aduan yang sedang menunggu input pelanggan.
  // V10.9.71: dibuat 10 menit, dengan reminder sekitar menit ke-5.
  if (
    state === 'AWAIT_ID' ||
    state === 'PICK_ADUAN' ||
    state === 'BILLING_AWAIT_NOPEL'
  ) {
    return Number(CONFIG.SESSION_TIMEOUT_WAITING_MINUTES || 10);
  }

  // State input aduan.
  // V10.9.70: Buat Aduan Baru (NEW_*) dan Aduan Cepat (FAST_*) sama-sama 15 menit.
  if (state.indexOf('NEW_') === 0 || state.indexOf('FAST_') === 0) {
    return Number(CONFIG.SESSION_TIMEOUT_INPUT_MINUTES || 15);
  }

  // V10.9.189: Chat Admin tidak dimatikan otomatis kalau admin belum membalas.
  // Auto-end 15 menit hanya berlaku setelah admin sudah membalas dan pelanggan diam,
  // diproses oleh shouldAutoEndAgentChatAfterAdminReply_(). TTL umum dibuat 24 jam.
  if (state === 'ADMIN_HANDOFF') {
    return 24 * 60;
  }

  return Number(CONFIG.SESSION_TIMEOUT_MAIN_MINUTES || 15);
}



function isWhatsAppSessionExpired_(state, updatedAt) {
  if (!updatedAt) return false;
  var d = toSafeDate_(updatedAt) || new Date(updatedAt);
  if (!d || isNaN(d.getTime())) return false;

  var timeoutMinutes = getWhatsAppSessionTimeoutMinutes_(state);
  var diffMinutes = (new Date().getTime() - d.getTime()) / 60000;
  return diffMinutes > timeoutMinutes;
}

function buildExpiredSessionReply_(state) {
  state = String(state || '').toUpperCase();

  if (state.indexOf('NEW_') === 0) {
    return [
      'Sesi pengisian aduan sudah berakhir karena tidak ada aktivitas selama 30 menit.',
      '',
      'Silakan mulai ulang dari menu utama jika ingin membuat aduan baru.'
    ].join('\n');
  }

  return [
    'Sesi sebelumnya sudah berakhir karena tidak ada aktivitas selama 15 menit.',
    '',
    'Silakan pilih menu yang tersedia.'
  ].join('\n');
}


// ============================================================
// SESSION MANAGEMENT V10.9.11 - FAST CACHE
// CacheService (RAM Google) sebagai primary, Spreadsheet sebagai backup.
// NEW_* dan FAST_* state: TTL 15 menit | State lain: TTL 15 menit
// ============================================================
var WA_SESSION_PREFIX_ = 'SIAGA_WA_';
// V10.9.268 - Fallback khusus sesi aduan.
// Tujuan: jika CacheService/Sheet session telat/tertinggal, pilihan cabang 1-12 tetap dibaca
// sebagai cabang, bukan menu utama Cek Tagihan/Info Layanan.
var WA_ADUAN_SESSION_PROP_PREFIX_ = 'SIAGA_WA_ADUAN_SESSION_';

// V10.9.270 - Marker khusus prompt pilih cabang.
// Jika SESSION_WHATSAPP/Cache gagal terbaca, balasan angka 1-12 setelah bot
// menampilkan daftar cabang tetap diproses sebagai pilihan cabang aduan.
var WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ = 'SIAGA_WA_CABANG_PROMPT_';

function getAduanPromptCandidateKeys_(phone, payload) {
  var keys = [];
  var addKey = function(v) {
    v = String(v || '').trim();
    if (!v) return;
    var n = normalizePhone_(v);
    if (n && keys.indexOf(n) === -1) keys.push(n);
  };
  addKey(phone);
  if (payload) {
    addKey(payload.phone);
    addKey(payload.customerId);
    addKey(payload.from);
    addKey(payload.sender);
    addKey(payload.wa);
    addKey(payload.number);
  }
  return keys;
}

function rememberAduanCabangPromptMarker_(phone, payload) {
  var keys = getAduanPromptCandidateKeys_(phone, payload);
  if (!keys.length) return;
  var marker = JSON.stringify({ at: new Date().getTime(), state: 'FAST_CABANG' });
  try {
    var cache = CacheService.getScriptCache();
    keys.forEach(function(k) { cache.put(WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + k, marker, safeCacheExpirationSeconds_(1800)); });
  } catch(e) {}
  try {
    var props = PropertiesService.getScriptProperties();
    keys.forEach(function(k) { props.setProperty(WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + k, marker); });
  } catch(e2) {}
}

function clearAduanCabangPromptMarker_(phone, payload) {
  var keys = getAduanPromptCandidateKeys_(phone, payload);
  if (!keys.length) return;
  try {
    var cache = CacheService.getScriptCache();
    keys.forEach(function(k) { cache.remove(WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + k); });
  } catch(e) {}
  try {
    var props = PropertiesService.getScriptProperties();
    keys.forEach(function(k) { props.deleteProperty(WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + k); });
  } catch(e2) {}
}

function hasRecentAduanCabangPromptMarker_(phone, payload, minutes) {
  minutes = Number(minutes || 20);
  var maxAge = minutes * 60 * 1000;
  var keys = getAduanPromptCandidateKeys_(phone, payload);
  if (!keys.length) return false;
  var now = new Date().getTime();
  var check = function(raw) {
    if (!raw) return false;
    var parsed = parseJsonSafe_(raw);
    if (!parsed || !parsed.at) return false;
    return (now - Number(parsed.at)) <= maxAge;
  };
  try {
    var cache = CacheService.getScriptCache();
    for (var i = 0; i < keys.length; i++) {
      if (check(cache.get(WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + keys[i]))) return true;
    }
  } catch(e) {}
  try {
    var props = PropertiesService.getScriptProperties();
    for (var j = 0; j < keys.length; j++) {
      var propKey = WA_ADUAN_CABANG_PROMPT_PROP_PREFIX_ + keys[j];
      var raw = props.getProperty(propKey);
      if (check(raw)) return true;
      if (raw && !check(raw)) props.deleteProperty(propKey);
    }
  } catch(e2) {}
  return false;
}

function isAduanInputFlowState_(state) {
  state = String(state || '').trim().toUpperCase();
  return state.indexOf('FAST_') === 0 || state.indexOf('NEW_') === 0;
}

function getAduanSessionFallbackKey_(phone) {
  phone = normalizePhone_(phone || '');
  return WA_ADUAN_SESSION_PROP_PREFIX_ + phone;
}

function rememberAduanSessionFallback_(phone, state, data) {
  phone = normalizePhone_(phone || '');
  state = String(state || '').trim();
  if (!phone) return;

  if (state === 'FAST_CABANG' || state === 'NEW_CABANG') {
    rememberAduanCabangPromptMarker_(phone, { phone: phone });
  } else {
    clearAduanCabangPromptMarker_(phone, { phone: phone });
  }

  // Kalau keluar dari alur aduan, pastikan fallback lama dibersihkan.
  if (!isAduanInputFlowState_(state)) {
    clearAduanSessionFallback_(phone);
    return;
  }

  try {
    var ttlSeconds = getWhatsAppSessionTtlSeconds_(state);
    var now = new Date().getTime();
    var payload = {
      state: state,
      data: data || {},
      updatedAt: now,
      expiresAt: now + (Math.max(60, Number(ttlSeconds || 900)) * 1000)
    };
    PropertiesService.getScriptProperties().setProperty(getAduanSessionFallbackKey_(phone), JSON.stringify(payload));
    try { cachePut_('WA_ADUAN_FALLBACK_' + phone, JSON.stringify(payload), ttlSeconds); } catch(eCacheFallback) {}
  } catch(e) {}
}

function getAduanSessionFallback_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  try {
    var fastRaw = cacheGet_('WA_ADUAN_FALLBACK_' + phone);
    if (fastRaw === '__NONE__') return null;
    if (fastRaw) {
      var fastParsed = parseJsonSafe_(fastRaw);
      if (fastParsed && fastParsed.state && isAduanInputFlowState_(fastParsed.state) &&
          (!fastParsed.expiresAt || Number(fastParsed.expiresAt) >= new Date().getTime())) {
        return { phone: phone, state: fastParsed.state, data: fastParsed.data || {}, source: 'cache_fallback' };
      }
    }

    var raw = PropertiesService.getScriptProperties().getProperty(getAduanSessionFallbackKey_(phone));
    if (!raw) {
      try { cachePut_('WA_ADUAN_FALLBACK_' + phone, '__NONE__', 120); } catch(eNegativeFallback) {}
      return null;
    }
    var parsed = parseJsonSafe_(raw);
    if (!parsed || !parsed.state || !isAduanInputFlowState_(parsed.state)) {
      clearAduanSessionFallback_(phone);
      return null;
    }
    if (parsed.expiresAt && Number(parsed.expiresAt) < new Date().getTime()) {
      clearAduanSessionFallback_(phone);
      return null;
    }
    try {
      var remainingSeconds = parsed.expiresAt
        ? Math.max(60, Math.floor((Number(parsed.expiresAt) - new Date().getTime()) / 1000))
        : 900;
      cachePut_('WA_ADUAN_FALLBACK_' + phone, raw, remainingSeconds);
    } catch(eWarmFallback) {}
    return { phone: phone, state: parsed.state, data: parsed.data || {}, source: 'props_fallback' };
  } catch(e) {
    return null;
  }
}

function clearAduanSessionFallback_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  try { PropertiesService.getScriptProperties().deleteProperty(getAduanSessionFallbackKey_(phone)); } catch(e) {}
  try { cachePut_('WA_ADUAN_FALLBACK_' + phone, '__NONE__', 120); } catch(eCacheClear) {}
  try { clearAduanCabangPromptMarker_(phone, { phone: phone }); } catch(e2) {}
}


// ============================================================
// V10.9.269 - RECENT PROMPT FALLBACK PILIH CABANG
// Jika session hilang karena pergantian key phone/customerId atau cache terlambat,
// angka 1-12 setelah bot mengirim daftar cabang tetap diproses sebagai cabang.
// ============================================================
function isStrictCabangNumberReply_(text) {
  text = String(text || '').trim();
  return /^([1-9]|1[0-2])$/.test(text);
}

function hasRecentAduanCabangPromptLog_(phone, payload, minutes) {
  minutes = Number(minutes || 20);
  var cutoff = new Date().getTime() - minutes * 60 * 1000;
  var keys = [];
  var addKey = function(v) {
    v = String(v || '').trim();
    if (!v) return;
    var n = normalizePhone_(v);
    if (n && keys.indexOf(n) === -1) keys.push(n);
    if (keys.indexOf(v) === -1) keys.push(v);
  };

  addKey(phone);
  if (payload) {
    addKey(payload.phone);
    addKey(payload.customerId);
    addKey(payload.from);
    addKey(payload.sender);
  }

  if (!keys.length) return false;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
    if (!sh || sh.getLastRow() < 2) return false;

    var lastRow = sh.getLastRow();
    var startRow = Math.max(2, lastRow - 80);
    var values = sh.getRange(startRow, 1, lastRow - startRow + 1, Math.min(8, sh.getLastColumn())).getValues();

    for (var i = values.length - 1; i >= 0; i--) {
      var ts = values[i][0] ? new Date(values[i][0]) : null;
      if (ts && !isNaN(ts.getTime()) && ts.getTime() < cutoff) break;

      var rowPhone = String(values[i][1] || '').trim();
      var rowPhoneNorm = normalizePhone_(rowPhone);
      if (keys.indexOf(rowPhone) === -1 && keys.indexOf(rowPhoneNorm) === -1) continue;

      var incoming = String(values[i][2] || '').toLowerCase();
      var jenis = String(values[i][3] || '').toLowerCase();
      var reply = String(values[i][5] || '').toLowerCase();
      var haystack = incoming + '\n' + jenis + '\n' + reply;

      if (haystack.indexOf('pilih cabang tujuan aduan') !== -1 ||
          haystack.indexOf('balas dengan angka cabang') !== -1 ||
          haystack.indexOf('contoh: 12') !== -1 && haystack.indexOf('cabang pringgarata') !== -1) {
        return true;
      }
    }
  } catch(e) {}

  return false;
}

function buildForcedAduanCabangSessionFromRecentPrompt_(phone, message, payload) {
  if (!isStrictCabangNumberReply_(message)) return null;
  if (!hasRecentAduanCabangPromptMarker_(phone, payload, 20) &&
      !hasRecentAduanCabangPromptLog_(phone, payload, 20)) return null;

  var data = {
    activeCheckedAt: new Date().getTime(),
    activeCount: 0,
    mode: 'BUAT_ADUAN',
    restoredFromRecentCabangPrompt: true
  };

  try { setWhatsAppSession_(phone, 'FAST_CABANG', data); } catch(e) {}
  return { phone: normalizePhone_(phone || ''), state: 'FAST_CABANG', data: data, source: 'recent_prompt_log' };
}

function getWhatsAppSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  var requestCached = getWhatsAppSessionFromRequestCache_(phone);
  if (requestCached.found) return requestCached.value;

  // 1. Prioritas fallback sesi aduan dipertahankan, tetapi sekarang cache-first.
  // Ini menutup bug angka cabang tanpa menambah baca Script Properties berulang.
  var aduanFallbackSession = getAduanSessionFallback_(phone);
  if (aduanFallbackSession) {
    putWhatsAppSessionInRequestCache_(phone, aduanFallbackSession);
    return aduanFallbackSession;
  }

  // 2. Coba CacheService session umum.
  try {
    var cached = CacheService.getScriptCache().get(WA_SESSION_PREFIX_ + phone);
    if (cached) {
      var parsed = parseJsonSafe_(cached);
      if (parsed && parsed.state) {
        var cacheSession = { phone: phone, state: parsed.state, data: parsed.data || {} };
        putWhatsAppSessionInRequestCache_(phone, cacheSession);
        return cacheSession;
      }
    }
  } catch(e) {}

  // 3. Fallback terakhir ke Spreadsheet.
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) {
      putWhatsAppSessionInRequestCache_(phone, null);
      return null;
    }

    var values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = 0; i < values.length; i++) {
      if (normalizePhone_(values[i][0]) !== phone) continue;
      var state = String(values[i][1] || '');
      var updatedAt = values[i][3] ? new Date(values[i][3]) : null;

      if (isWhatsAppSessionExpired_(state, updatedAt)) {
        clearWhatsAppSession_(phone);
        return null;
      }

      var session = { row: i + 2, phone: phone, state: state, data: parseJsonSafe_(values[i][2]) };

      // Repopulate cache dari Spreadsheet
      try {
        var ttl = getWhatsAppSessionTtlSeconds_(state);
        CacheService.getScriptCache().put(WA_SESSION_PREFIX_ + phone, JSON.stringify({ state: state, data: session.data }), ttl);
      } catch(e) {}

      putWhatsAppSessionInRequestCache_(phone, session);
      return session;
    }
  } catch(e) {}

  putWhatsAppSessionInRequestCache_(phone, null);
  return null;
}


function getWhatsAppSessionTtlSeconds_(state) {
  var minutes = getWhatsAppSessionTimeoutMinutes_(state);
  var seconds = Math.max(60, Math.floor(Number(minutes || 15) * 60));
  return safeCacheExpirationSeconds_(seconds);
}

function isWhatsAppAduanInputSessionState_(state) {
  state = String(state || '').trim().toUpperCase();
  return state.indexOf('NEW_') === 0 || state.indexOf('FAST_') === 0;
}

function isWhatsAppWaitingInputSessionState_(state) {
  state = String(state || '').trim().toUpperCase();
  return state === 'AWAIT_ID' ||
         state === 'PICK_ADUAN' ||
         state === 'BILLING_AWAIT_NOPEL';
}

function isWhatsAppReminderEligibleSessionState_(state) {
  // V10.9.90:
  // Reminder/notifikasi no-response hanya untuk proses aduan.
  // Non-aduan seperti cek status, riwayat, dan cek tagihan tidak dikirimi reminder.
  return isWhatsAppAduanInputSessionState_(state);
}

function isWhatsAppAutoCloseSessionState_(state) {
  // Sesi aduan dan non-aduan tetap boleh dibersihkan saat timeout.
  // Bedanya: hanya sesi aduan yang dapat reminder/notifikasi.
  return isWhatsAppAduanInputSessionState_(state) || isWhatsAppWaitingInputSessionState_(state);
}


function getWhatsAppSessionReminderMinutes_(state) {
  state = String(state || '').trim().toUpperCase();

  // Non-aduan: reminder menit ke-5, session habis menit ke-10.
  if (isWhatsAppWaitingInputSessionState_(state)) {
    return Number(CONFIG.SESSION_REMINDER_WAITING_MINUTES || 5);
  }

  // Aduan: reminder 5 menit sebelum session habis.
  var timeout = getWhatsAppSessionTimeoutMinutes_(state);
  return Math.max(5, timeout - 5);
}




function setWhatsAppSession_(phone, state, data) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  var ttl = getWhatsAppSessionTtlSeconds_(state);
  var payload = JSON.stringify({ state: state || '', data: data || {} });

  putWhatsAppSessionInRequestCache_(phone, {
    phone: phone,
    state: state || '',
    data: data || {}
  });

  // V10.9.268: simpan mirror/fallback khusus alur aduan agar pilihan cabang tidak hilang.
  rememberAduanSessionFallback_(phone, state, data || {});

  // 1. Cache dulu (cepat)
  try {
    CacheService.getScriptCache().put(WA_SESSION_PREFIX_ + phone, payload, ttl);
  } catch(e) {}

  // 2. Backup ke Spreadsheet
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var row = getWhatsAppSessionRow_(sh, phone);
    if (row < 2) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 5).setValues([[phone, state || '', JSON.stringify(data || {}), new Date(), '']]);
  } catch(e) {}
}


function clearWhatsAppSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;

  putWhatsAppSessionInRequestCache_(phone, null);

  // V10.9.268: bersihkan fallback sesi aduan juga.
  clearAduanSessionFallback_(phone);

  // 1. Hapus dari Cache
  try { CacheService.getScriptCache().remove(WA_SESSION_PREFIX_ + phone); } catch(e) {}

  // 2. Hapus dari Spreadsheet
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var values = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (normalizePhone_(values[i][0]) === phone) sh.deleteRow(i + 2);
    }
  } catch(e) {}
}

// ============================================================
// V10.9.70 - REMINDER SESSION INPUT ADUAN
// ============================================================

function buildWhatsAppSessionNoResponseReminderReply_(state, phone) {
  state = String(state || '').trim().toUpperCase();
  var greetingName = getWhatsAppGreetingName_(phone || '', {});

  if (state === 'BILLING_AWAIT_NOPEL') {
    return [
      'Hai *' + greetingName + '*, kami belum menerima No Pelanggan Anda.',
      '',
      'Silakan kirim No Pelanggan untuk melanjutkan cek tagihan.',
      '',
      'Ketik *menu* untuk kembali ke Menu Utama.'
    ].join('\n');
  }

  if (state === 'AWAIT_ID') {
    return [
      'Hai *' + greetingName + '*, kami belum menerima ID Aduan Anda.',
      '',
      'Silakan kirim ID Aduan untuk melanjutkan cek status.',
      '',
      'Ketik *menu* untuk kembali ke Menu Utama.'
    ].join('\n');
  }

  if (state === 'PICK_ADUAN') {
    return [
      'Hai *' + greetingName + '*, kami belum menerima pilihan aduan Anda.',
      '',
      'Silakan pilih salah satu aduan dari daftar sebelumnya.',
      '',
      'Ketik *menu* untuk kembali ke Menu Utama.'
    ].join('\n');
  }

  return [
    'Hai *' + greetingName + '*, kami belum menerima respon lanjutan Anda.',
    '',
    'Silakan ikuti instruksi terakhir di atas untuk melanjutkan proses aduan.',
    '',
    'Ketik *menu* untuk kembali ke Menu Utama.'
  ].join('\n');
}


function buildWhatsAppSessionClosedNoResponseReply_(state) {
  state = String(state || '').trim().toUpperCase();

  if (state === 'BILLING_AWAIT_NOPEL') {
    return [
      'Terima kasih sudah menghubungi SIAGA TIARA.',
      '',
      'Karena belum ada No Pelanggan yang dikirim, proses cek tagihan otomatis dibatalkan.',
      '',
      'Silakan ketik *menu* jika ingin memulai kembali.'
    ].join('\n');
  }

  if (state === 'AWAIT_ID') {
    return [
      'Terima kasih sudah menghubungi SIAGA TIARA.',
      '',
      'Karena belum ada ID Aduan yang dikirim, proses cek status otomatis dibatalkan.',
      '',
      'Silakan ketik *menu* jika ingin memulai kembali.'
    ].join('\n');
  }

  if (state === 'PICK_ADUAN') {
    return [
      'Terima kasih sudah menghubungi SIAGA TIARA.',
      '',
      'Karena belum ada pilihan aduan, proses aduan aktif otomatis dibatalkan.',
      '',
      'Silakan ketik *menu* jika ingin memulai kembali.'
    ].join('\n');
  }

  return [
    'Terima kasih sudah menghubungi SIAGA TIARA.',
    '',
    'Karena belum ada respon lanjutan, proses input aduan otomatis dibatalkan.',
    '',
    'Silakan ketik *menu* jika ingin memulai kembali.'
  ].join('\n');
}


function parseSessionReminderNote_(note) {
  note = String(note || '').trim();
  if (!note) return {};
  try {
    var obj = JSON.parse(note);
    return obj && typeof obj === 'object' ? obj : {};
  } catch(e) {
    return {};
  }
}

function installWhatsAppSessionReminderTrigger() {
  uninstallWhatsAppSessionReminderTrigger();

  ScriptApp.newTrigger('checkInactiveWhatsAppSessions_')
    .timeBased()
    .everyMinutes(1)
    .create();

  try {
    SpreadsheetApp.getUi().alert('Reminder session WhatsApp aktif. Sistem akan mengecek session pelanggan setiap 1 menit.');
  } catch(e) {}

  return true;
}

function uninstallWhatsAppSessionReminderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'checkInactiveWhatsAppSessions_') {
      ScriptApp.deleteTrigger(t);
    }
  });

  try {
    SpreadsheetApp.getUi().alert('Reminder session WhatsApp dimatikan.');
  } catch(e) {}

  return true;
}

function checkInactiveWhatsAppSessions_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppSessionSheet(ss);

  var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
  if (!sh || sh.getLastRow() < 2) return { success: true, checked: 0, reminded: 0, closed: 0, silentClosed: 0 };

  var now = new Date();
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();

  var checked = 0;
  var reminded = 0;
  var closed = 0;
  var silentClosed = 0;

  // Loop dari bawah supaya aman kalau perlu hapus row.
  for (var i = values.length - 1; i >= 0; i--) {
    var row = i + 2;
    var phone = normalizePhone_(values[i][0] || '');
    var state = String(values[i][1] || '').trim();
    var updatedAt = toSafeDate_(values[i][3]) || (values[i][3] ? new Date(values[i][3]) : null);
    var note = parseSessionReminderNote_(values[i][4]);

    // V11 CRM: jika pelanggan sudah meminta Chat Admin tetapi belum mendapat
    // satu pun balasan petugas selama 15 menit, tutup takeover dan kirim menu
    // utama kembali. Proses ini berjalan dari trigger setiap menit.
    if (phone && state.toUpperCase() === 'ADMIN_HANDOFF') {
      checked++;
      try {
        var chatAdminTimeout = closeUnansweredAgentChatAfter15m_FINAL_(phone, values[i][2], updatedAt);
        if (chatAdminTimeout && chatAdminTimeout.closed) closed++;
      } catch(eChatAdminTimeout) {}
      continue;
    }

    // V10.9.90:
    // Cek sesi yang perlu auto-close: aduan + non-aduan.
    // Tapi reminder hanya dikirim jika isWhatsAppReminderEligibleSessionState_(state) = true.
    if (!phone || !state || !updatedAt || !isWhatsAppAutoCloseSessionState_(state)) continue;
    if (isNaN(updatedAt.getTime())) continue;

    checked++;
    var timeoutMinutes = getWhatsAppSessionTimeoutMinutes_(state);
    var reminderMinutes = getWhatsAppSessionReminderMinutes_(state);
    var diffMinutes = (now.getTime() - updatedAt.getTime()) / 60000;
    var canSendReminder = isWhatsAppReminderEligibleSessionState_(state);

    // Tutup session jika melewati batas.
    if (diffMinutes >= timeoutMinutes) {
      // Hanya sesi aduan yang dikirim notifikasi penutupan.
      // Non-aduan cukup ditutup diam-diam agar tidak terlalu banyak notif.
      if (canSendReminder) {
        try {
          sendWhatsAppMessage_(phone, buildWhatsAppSessionClosedNoResponseReply_(state), {});
        } catch(e) {}
        closed++;
      } else {
        silentClosed++;
      }

      try {
        CacheService.getScriptCache().remove(WA_SESSION_PREFIX_ + phone);
      } catch(e2) {}

      try {
        sh.deleteRow(row);
      } catch(e3) {}

      continue;
    }

    // Kirim reminder sekali, hanya untuk sesi aduan.
    if (canSendReminder && diffMinutes >= reminderMinutes && !note.reminderSentAt) {
      try {
        sendWhatsAppMessage_(phone, buildWhatsAppSessionNoResponseReminderReply_(state, phone), {});
        sh.getRange(row, 5).setValue(JSON.stringify({ reminderSentAt: now.toISOString() }));
        reminded++;
      } catch(e4) {}
    }
  }

  return { success: true, checked: checked, reminded: reminded, closed: closed, silentClosed: silentClosed };
}


function testCheckInactiveWhatsAppSessions() {
  var result = checkInactiveWhatsAppSessions_();
  try {
    SpreadsheetApp.getUi().alert(JSON.stringify(result, null, 2));
  } catch(e) {}
  return result;
}



// Helper: cari row session di sheet tanpa rekursif
function getWhatsAppSessionRow_(sh, phone) {
  try {
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return -1;
    var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (normalizePhone_(vals[i][0]) === phone) return i + 2;
    }
  } catch(e) {}
  return -1;
}

function parseJsonSafe_(value) {
  try {
    return value ? JSON.parse(String(value)) : {};
  } catch (e) {
    return {};
  }
}

function testWhatsAppMenuReply() {
  var ui = SpreadsheetApp.getUi();
  var phonePrompt = ui.prompt('Tes Menu WhatsApp', 'Masukkan nomor HP pelanggan untuk simulasi:', ui.ButtonSet.OK_CANCEL);
  if (phonePrompt.getSelectedButton() !== ui.Button.OK) return;

  var messagePrompt = ui.prompt(
    'Tes Menu WhatsApp',
    'Masukkan pesan masuk.\nContoh: halo, 1, 2, 3, status PRY7K2A',
    ui.ButtonSet.OK_CANCEL
  );
  if (messagePrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = getWhatsAppMenuResponse_(messagePrompt.getResponseText(), phonePrompt.getResponseText());

  ui.alert('Balasan Bot', result.reply, ui.ButtonSet.OK);
}


// ============================================================
// WHATSAPP TRACKING - CEK PROGRES ADUAN VIA CHAT
// ============================================================
// Fungsi utama:
// 1. Pelanggan kirim chat berisi ID aduan, contoh: PRY7K2A
// 2. Webhook WhatsApp memanggil doPost(e)
// 3. Sistem mencari ID / nomor HP di sheet ADUAN
// 4. Sistem membalas status pengerjaan seperti resi JNE
//
// Catatan:
// Setiap provider WhatsApp punya format webhook dan endpoint berbeda.
// Modul ini dibuat fleksibel untuk format umum: message/text/body, from/sender/phone.
// Untuk kirim pesan, default payload: { phone: nomor, message: isiPesan }
// Jika provider kamu beda field, ubah properti WHATSAPP_PHONE_FIELD dan WHATSAPP_MESSAGE_FIELD.
// ============================================================

function doPost(e) {
  try {
    // V10.9.132:
    // Jangan pakai ScriptLock global di seluruh webhook.
    // Penyebab bug: jika 2 pelanggan menekan tombol bersamaan, request kedua bisa masuk saat lock masih dipakai,
    // lalu dianggap sukses/skipped sehingga bot tidak mengirim balasan.
    // Anti-duplicate webhook tetap ditangani di handleWhatsAppWebhook_(), sedangkan pembuatan ID aduan
    // sudah punya lock sendiri di generateCabangAduanId_().
    var result = handleWhatsAppWebhook_(e);
    return jsonOutput_(result);
  } catch (err) {
    logWhatsApp_('-', '-', 'DOPOST_ERROR', err.message || String(err), 'ERROR');
    return jsonOutput_({ success: false, error: err.message || String(err) });
  }
}

function setupWhatsAppTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  setupWhatsAppSessionSheet(ss);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WHATSAPP_REPLY_MODE')) props.setProperty('WHATSAPP_REPLY_MODE', CONFIG.WHATSAPP_DEFAULT_REPLY_MODE || 'AUTO');

  SpreadsheetApp.getUi().alert(
    '✅ WhatsApp Tracking siap',
    'Modul WhatsApp Tracking sudah ditambahkan.\n\n' +
    'Webhook URL yang dipakai adalah URL Web App /exec dari SIAGA TIARA.\n\n' +
    'Format chat pelanggan:\n' +
    '- halo / menu untuk pilihan layanan\n' +
    '- 1 untuk buat aduan baru\n' +
    '- 2 untuk cek status aduan\n' +
    '- 3 untuk lihat daftar aduan\n' +
    '- atau langsung ketik ID aduan: PRY7K2A',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}



// ============================================================
// PILIH CABANG VIA TEKS ANGKA WHATSAPP + MIRROR SHEET CABANG
// ============================================================

function getCabangMenuRows_(page) {
  // V10.9.116:
  // Cabang ditampilkan dalam satu daftar teks, bukan tombol/list interaktif.
  // Urutan angka mengikuti CONFIG.CABANG agar pelanggan bisa balas 1-12.
  return [
    { id: 'CABANG_PRY',  title: 'Cabang Praya',              description: 'Wilayah layanan Praya' },
    { id: 'CABANG_PTE',  title: 'Cabang Praya Tengah',       description: 'Wilayah Praya Tengah' },
    { id: 'CABANG_PRB',  title: 'Cabang Praya Barat',        description: 'Wilayah Praya Barat' },
    { id: 'CABANG_PBD', title: 'Cabang Praya Barat Daya',   description: 'Wilayah Praya Barat Daya' },
    { id: 'CABANG_PRT',  title: 'Cabang Praya Timur',        description: 'Wilayah Praya Timur' },
    { id: 'CABANG_PJT',  title: 'Cabang Pujut',              description: 'Wilayah layanan Pujut' },
    { id: 'CABANG_JGT',  title: 'Cabang Jonggat',            description: 'Wilayah layanan Jonggat' },
    { id: 'CABANG_BTK',  title: 'Cabang Batukliang',         description: 'Wilayah layanan Batukliang' },
    { id: 'CABANG_BKU',  title: 'Cabang Batukliang Utara',   description: 'Wilayah Batukliang Utara' },
    { id: 'CABANG_KPG',  title: 'Cabang Kopang',             description: 'Wilayah layanan Kopang' },
    { id: 'CABANG_JNP',  title: 'Cabang Janapria',           description: 'Wilayah layanan Janapria' },
    { id: 'CABANG_PGR',  title: 'Cabang Pringgarata',        description: 'Wilayah layanan Pringgarata' }
  ];
}

function buildCabangMenuReply_(page) {
  var rows = getCabangMenuRows_(1);

  var lines = [
    '*Pilih cabang tujuan aduan:*',
    ''
  ];

  rows.forEach(function(r, i) {
    lines.push((i + 1) + '. ' + r.title);
  });

  lines.push('');
  lines.push('Balas dengan angka cabang.');
  lines.push('Contoh: *12*');

  return lines.join('\n');
}


// V10.9.206:
// Balasan khusus saat pelanggan salah pilih nomor cabang.
// Jangan pakai fallback umum yang berisi "1. Buat Aduan", karena saat user sedang pilih cabang
// angka 1 harus tetap berarti Cabang Praya, bukan menu Buat Aduan.
function buildCabangInvalidChoiceReply_(count) {
  count = Number(count || 1) || 1;
  var lines = [
    'Nomor cabang tidak valid.',
    '',
    'Silakan pilih cabang dengan membalas angka *1–12* sesuai daftar cabang.',
    'Contoh: *12*'
  ];

  if (count >= 2) {
    lines.push('');
    lines.push('Jika kesulitan memilih cabang, silakan balas: *Hubungi Admin*');
  }

  lines.push('');
  lines.push('Ketik *menu* untuk kembali ke layanan otomatis.');
  return lines.join('\n');
}

function handleCabangInvalidChoice_(phone, stateKey) {
  stateKey = String(stateKey || 'FAST_CABANG').toUpperCase();
  var count = getCustomerInvalidInputCounter_(phone, stateKey) + 1;
  setCustomerInvalidInputCounter_(phone, count, stateKey);
  return {
    success: false,
    type: 'CABANG_CHOICE_RETRY',
    page: 1,
    reply: buildCabangInvalidChoiceReply_(count),
    navButtons: [
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}

function sendKiriminCabangMenu_(phone, page) {
  // V10.9.116:
  // Permintaan cabang tidak lagi dikirim sebagai interactive list/tombol.
  // Tetap pertahankan nama fungsi agar pemanggil lama tidak rusak,
  // tetapi isi yang dikirim adalah teks biasa berisi 12 cabang.
  return sendKiriminTextByPhoneNumber_(phone, buildCabangMenuReply_(1));
}

function normalizeIncomingCabangChoice_(text, currentPage) {
  text = String(text || '').toLowerCase();
  text = text
    .replace(/\*/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  var rows = getCabangMenuRows_(1);
  var numberMatch = text.match(/^0*([1-9]|1[0-2])$/);
  if (numberMatch) {
    var idx = Number(numberMatch[1]) - 1;
    return rows[idx] ? rows[idx].title : '';
  }

  // Terima juga format seperti "12. Cabang Pringgarata" atau "12 cabang pringgarata".
  var prefixedNumber = text.match(/^0*([1-9]|1[0-2])(?:\.|\)|\s|-)/);
  if (prefixedNumber) {
    var prefixedIdx = Number(prefixedNumber[1]) - 1;
    if (rows[prefixedIdx]) return rows[prefixedIdx].title;
  }

  // Cabang turunan Praya harus dicek sebelum Cabang Praya.
  if (text.indexOf('cabang pbd') !== -1 || text.indexOf('cabang prbd') !== -1 || text.indexOf('praya barat daya') !== -1 || text === 'pbd' || text === 'prbd') return 'Cabang Praya Barat Daya';
  if (text.indexOf('cabang pte') !== -1 || text.indexOf('praya tengah') !== -1 || text === 'pte') return 'Cabang Praya Tengah';
  if (text.indexOf('cabang prb') !== -1 || (text.indexOf('praya barat') !== -1 && text.indexOf('daya') === -1) || text === 'prb') return 'Cabang Praya Barat';
  if (text.indexOf('cabang prt') !== -1 || text.indexOf('praya timur') !== -1 || text === 'prt') return 'Cabang Praya Timur';

  // Batukliang Utara harus dicek sebelum Batukliang.
  if (text.indexOf('cabang bku') !== -1 || text.indexOf('cabang btu') !== -1 || text.indexOf('batukliang utara') !== -1 || text === 'bku' || text === 'bku' || text === 'btu') return 'Cabang Batukliang Utara';
  if (text.indexOf('cabang btk') !== -1 || (text.indexOf('batukliang') !== -1 && text.indexOf('utara') === -1) || text === 'btk') return 'Cabang Batukliang';

  // Cabang utama dan cabang lain.
  if (text.indexOf('cabang pry') !== -1 || text === 'cabang praya' || text === 'praya' || text === 'pry') return 'Cabang Praya';
  if (text.indexOf('cabang pjt') !== -1 || text.indexOf('pujut') !== -1 || text === 'pjt') return 'Cabang Pujut';
  if (text.indexOf('cabang jgt') !== -1 || text.indexOf('jonggat') !== -1 || text === 'jgt') return 'Cabang Jonggat';
  if (text.indexOf('cabang kpg') !== -1 || text.indexOf('kopang') !== -1 || text === 'kpg') return 'Cabang Kopang';
  if (text.indexOf('cabang jnp') !== -1 || text.indexOf('janapria') !== -1 || text === 'jnp') return 'Cabang Janapria';
  if (text.indexOf('cabang pgr') !== -1 || text.indexOf('pringgarata') !== -1 || text === 'pgr') return 'Cabang Pringgarata';

  return '';
}
function getCabangCodeSafe_(cabang) {
  cabang = String(cabang || '').trim();
  if (!cabang) return 'LNY';

  // Exact match dulu.
  if (CABANG_CODE && CABANG_CODE[cabang]) return CABANG_CODE[cabang];

  var normalized = normalizeCabangKey_(cabang);
  var keys = Object.keys(CABANG_CODE || {});

  // Exact normalized match.
  for (var i = 0; i < keys.length; i++) {
    if (normalizeCabangKey_(keys[i]) === normalized) return CABANG_CODE[keys[i]];
  }

  // Fallback aman: cek cabang paling spesifik dulu, bukan "Praya" dulu.
  var ordered = keys.slice().sort(function(a, b) {
    return normalizeCabangKey_(b).length - normalizeCabangKey_(a).length;
  });

  for (var j = 0; j < ordered.length; j++) {
    var key = ordered[j];
    var nk = normalizeCabangKey_(key);
    if (normalized.indexOf(nk) !== -1 || nk.indexOf(normalized) !== -1) return CABANG_CODE[key];
  }

  return 'LNY';
}

function getCabangMirrorSheetName_(cabang) {
  cabang = String(cabang || 'Cabang Lainnya').trim();
  var code = CABANG_CODE[cabang] || 'LNY';
  return 'CABANG_' + code;
}



// ============================================================
// V10.9.40 - ONE SHEET CABANG: MANUAL INPUT + UPDATE STATUS
// ============================================================


function getDefaultWilayahByCabang_(cabang) {
  cabang = String(cabang || '').trim();
  if (!cabang) return '';

  var map = {
    'Cabang Praya': 'Praya',
    'Cabang Praya Tengah': 'Praya Tengah',
    'Cabang Praya Barat': 'Praya Barat',
    'Cabang Praya Barat Daya': 'Praya Barat Daya',
    'Cabang Praya Timur': 'Praya Timur',
    'Cabang Pujut': 'Pujut',
    'Cabang Jonggat': 'Jonggat',
    'Cabang Batukliang': 'Batukliang',
    'Cabang Batukliang Utara': 'Batukliang Utara',
    'Cabang Kopang': 'Kopang',
    'Cabang Janapria': 'Janapria',
    'Cabang Pringgarata': 'Pringgarata'
  };

  return map[cabang] || cabang.replace(/^Cabang\s+/i, '').trim();
}

function cabangMirrorRowHasManualInput_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var cols = [
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.LOKASI_DETAIL
  ];

  for (var i = 0; i < cols.length; i++) {
    try {
      var v = String(sh.getRange(rowNumber, cols[i]).getValue() || '').trim();
      if (v) return true;
    } catch(e) {}
  }

  return false;
}

function autoFillCabangWilayahForMirrorRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2 || !isCabangMirrorSheetName_(sh.getName())) return;

  var sheetCabang = getCabangNameByMirrorSheetName_(sh.getName());
  if (!sheetCabang) return;

  // Jangan isi baris yang benar-benar kosong agar sheet tidak penuh default.
  if (!cabangMirrorRowHasManualInput_(sh, rowNumber)) return;

  var wilayahDefault = getDefaultWilayahByCabang_(sheetCabang);

  try {
    var cabangCell = sh.getRange(rowNumber, CONFIG.COL.CABANG);
    if (!String(cabangCell.getValue() || '').trim()) {
      cabangCell.setValue(sheetCabang);
    }
  } catch(e1) {}

  try {
    var wilayahCell = sh.getRange(rowNumber, CONFIG.COL.WILAYAH);
    if (!String(wilayahCell.getValue() || '').trim()) {
      wilayahCell.setValue(wilayahDefault);
    }
  } catch(e2) {}
}


function getCabangNameByMirrorSheetName_(sheetName) {
  sheetName = String(sheetName || '').trim();
  if (sheetName.indexOf('CABANG_') !== 0) return '';

  var code = sheetName.replace(/^CABANG_/, '').trim();

  for (var cabang in CABANG_CODE) {
    if (CABANG_CODE[cabang] === code) return cabang;
  }

  return '';
}

function isCabangMirrorManualRowEmpty_(rowValues) {
  rowValues = rowValues || [];

  var colsToCheck = [
    CONFIG.COL.WILAYAH,
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.LOKASI_DETAIL
  ];

  for (var i = 0; i < colsToCheck.length; i++) {
    var idx = colsToCheck[i] - 1;
    if (String(rowValues[idx] || '').trim()) return false;
  }

  return true;
}

function buildAduanObjectFromCabangRow_(rowValues) {
  rowValues = rowValues || [];
  return {
    id: String(rowValues[CONFIG.COL.ID - 1] || '').trim(),
    waktuMasukDate: rowValues[CONFIG.COL.WAKTU_MASUK - 1] || '',
    waktuMasuk: rowValues[CONFIG.COL.WAKTU_MASUK - 1] || '',
    cabang: String(rowValues[CONFIG.COL.CABANG - 1] || '').trim(),
    wilayah: String(rowValues[CONFIG.COL.WILAYAH - 1] || '').trim(),
    desa: String(rowValues[CONFIG.COL.DESA - 1] || '').trim(),
    namaPelanggan: String(rowValues[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim(),
    noHp: normalizePhone_(rowValues[CONFIG.COL.NO_HP - 1] || ''),
    jenisGangguan: String(rowValues[CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim(),
    prioritas: String(rowValues[CONFIG.COL.PRIORITAS - 1] || '').trim(),
    status: String(rowValues[CONFIG.COL.STATUS - 1] || '').trim(),
    unit: String(rowValues[CONFIG.COL.UNIT - 1] || '').trim(),
    keterangan: String(rowValues[CONFIG.COL.KETERANGAN - 1] || '').trim(),
    catatan: String(rowValues[CONFIG.COL.CATATAN - 1] || '').trim(),
    waktuSelesaiDate: rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '',
    waktuSelesai: rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '',
    slaJam: rowValues[CONFIG.COL.SLA_JAM - 1] || '',
    updatedAtDate: rowValues[CONFIG.COL.UPDATED_AT - 1] || '',
    updatedAt: rowValues[CONFIG.COL.UPDATED_AT - 1] || '',
    latitude: rowValues[CONFIG.COL.LATITUDE - 1] || '',
    longitude: rowValues[CONFIG.COL.LONGITUDE - 1] || '',
    linkMaps: rowValues[CONFIG.COL.LINK_MAPS - 1] || '',
    lokasiDetail: String(rowValues[CONFIG.COL.LOKASI_DETAIL - 1] || '').trim()
  };
}

function syncManualCabangRowToAduan_(sh, rowNumber, aduanSheet, logSheet) {
  if (!sh || rowNumber < 2) return { synced: false, reason: 'invalid row' };

  // V10.9.41:
  // Di sheet CABANG_*, kolom Cabang dan Wilayah otomatis mengikuti nama sheet.
  // Contoh: CABANG_PRY otomatis Cabang Praya + Praya.
  try { autoFillCabangWilayahForMirrorRow_(sh, rowNumber); } catch(e) {}

  aduanSheet = aduanSheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!aduanSheet) {
    setupAduanSheet(SpreadsheetApp.getActiveSpreadsheet());
    aduanSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  }

  var width = Math.max(CONFIG.COL.LOKASI_DETAIL || 20, 20);
  var rowValues = sh.getRange(rowNumber, 1, 1, width).getValues()[0];

  var existingId = String(rowValues[CONFIG.COL.ID - 1] || '').trim();
  if (existingId) return { synced: false, reason: 'row already has ID', id: existingId };

  if (isCabangMirrorManualRowEmpty_(rowValues)) {
    return { synced: false, reason: 'empty row' };
  }

  var sheetCabang = getCabangNameByMirrorSheetName_(sh.getName());
  if (!sheetCabang) return { synced: false, reason: 'unknown cabang sheet' };

  var now = new Date();
  var cabang = String(rowValues[CONFIG.COL.CABANG - 1] || '').trim() || sheetCabang;
  var wilayah = String(rowValues[CONFIG.COL.WILAYAH - 1] || '').trim() || getDefaultWilayahByCabang_(sheetCabang);
  var noPelanggan = String(rowValues[CONFIG.COL.DESA - 1] || '').trim();
  var namaPelanggan = String(rowValues[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();
  var noHp = normalizePhone_(rowValues[CONFIG.COL.NO_HP - 1] || '');
  var keterangan = String(rowValues[CONFIG.COL.KETERANGAN - 1] || '').trim();

  // V10.9.42:
  // Jenis Gangguan sekarang punya dropdown. Kalau masih kosong, sistem coba tebak dari Keterangan.
  // Contoh keterangan "mati terus" -> Air Mati.
  var jenis = normalizeInputJenisGangguan_(rowValues[CONFIG.COL.JENIS_GANGGUAN - 1]);
  if (!jenis && keterangan) jenis = normalizeInputJenisGangguan_(keterangan);

  var prioritas = normalizeInputPrioritas_(rowValues[CONFIG.COL.PRIORITAS - 1]);
  var status = String(rowValues[CONFIG.COL.STATUS - 1] || '').trim() || 'Baru';
  var unit = normalizeInputUnit_(rowValues[CONFIG.COL.UNIT - 1]) || getUnitByJenisGangguan_(jenis) || 'Cabang';
  var catatan = String(rowValues[CONFIG.COL.CATATAN - 1] || '').trim();
  var waktuMasuk = asDateForArchive_(rowValues[CONFIG.COL.WAKTU_MASUK - 1]) || now;
  var latitude = rowValues[CONFIG.COL.LATITUDE - 1] || '';
  var longitude = rowValues[CONFIG.COL.LONGITUDE - 1] || '';
  var linkMaps = rowValues[CONFIG.COL.LINK_MAPS - 1] || '';
  var lokasiDetail = String(rowValues[CONFIG.COL.LOKASI_DETAIL - 1] || '').trim();

  // Minimal data agar sistem tidak membuat ID saat baris masih setengah diisi.
  // Cabang/Wilayah otomatis dari sheet.
  // Cukup ada identitas pelanggan (Nama atau No Pelanggan) + Jenis Gangguan.
  if ((!namaPelanggan && !noPelanggan) || !jenis) {
    return { synced: false, pending: true, reason: 'minimal belum lengkap' };
  }

  var cabangCode = getCabangCodeSafe_(cabang) || getCabangCodeSafe_(sheetCabang) || 'LNY';
  var sourceKey = sh.getName() + '#' + rowNumber;
  var propKey = makeInputSourcePropertyKey_(sourceKey);
  var existingPropId = getInputSourceProperty_(propKey);
  if (existingPropId) {
    sh.getRange(rowNumber, CONFIG.COL.ID).setValue(existingPropId);
    return { synced: false, reason: 'restored from property', id: existingPropId };
  }

  var payload = {
    namaPelanggan: namaPelanggan,
    noHp: noHp,
    wilayah: wilayah,
    desa: noPelanggan,
    jenis: jenis,
    prioritas: prioritas,
    unitPetugas: unit,
    keterangan: keterangan
  };

  var existingAduanMap = getExistingAduanFingerprintMap_(aduanSheet);
  var fingerprint = buildInputAduanFingerprint_(cabang, waktuMasuk, payload);
  if (existingAduanMap[fingerprint]) {
    var dupId = existingAduanMap[fingerprint].id || '';
    if (dupId) {
      sh.getRange(rowNumber, CONFIG.COL.ID).setValue(dupId);
      sh.getRange(rowNumber, CONFIG.COL.CABANG).setValue(cabang);
      sh.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
      return { synced: false, duplicate: true, id: dupId, reason: 'duplicate fingerprint' };
    }
  }

  var idAduan = generateCabangAduanId_(cabangCode, waktuMasuk, aduanSheet);
  setInputSourceProperty_(propKey, idAduan);

  var slaJam = getSlaJamForPrioritas_(prioritas);
  var waktuSelesai = rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '';
  if (status === 'Selesai' && !waktuSelesai) waktuSelesai = now;

  var rowToWrite = [
    idAduan,
    waktuMasuk,
    cabang,
    wilayah,
    noPelanggan,
    namaPelanggan,
    noHp,
    jenis,
    prioritas,
    status,
    unit,
    keterangan,
    catatan,
    waktuSelesai,
    slaJam,
    now,
    latitude,
    longitude,
    linkMaps,
    lokasiDetail
  ];

  aduanSheet.appendRow(rowToWrite);
  var aduanRow = aduanSheet.getLastRow();
  try { enforcePriorityStatusUnitForRow_(aduanSheet, aduanRow); } catch(e) {}
  try { invalidateAduanFindCacheById_(idAduan); } catch(eCache) {}

  // Tulis balik ke sheet cabang agar baris manual berubah menjadi tiket resmi.
  sh.getRange(rowNumber, 1, 1, rowToWrite.length).setValues([rowToWrite]);
  try { enforcePriorityStatusUnitForRow_(sh, rowNumber); } catch(e2) {}
  try { applyCabangMirrorDropdowns_(sh); } catch(e3) {}
  try { sh.getRange(rowNumber, 1, 1, rowToWrite.length).setBackground('#ecfdf5'); } catch(e4) {}

  if (logSheet) {
    appendInputCabangLog_(
      logSheet, now, cabang, sh.getName(), rowNumber,
      idAduan, namaPelanggan, jenis, 'Terkirim'
    );
  }

  // Notifikasi ke petugas cabang, sama seperti aduan dari WhatsApp.
  try {
    notifyPetugasCabang_(buildAduanObjectFromCabangRow_(rowToWrite));
  } catch(notifErr) {
    try {
      logWhatsApp_('', 'Gagal notif petugas dari input manual sheet cabang', 'PETUGAS_NOTIFY_MANUAL', idAduan, '', 'ERROR', notifErr.message || String(notifErr));
    } catch(e5) {}
  }

  return { synced: true, id: idAduan, cabang: cabang };
}

function syncManualRowsFromAllCabangMirrors_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!aduanSheet) {
    setupAduanSheet(ss);
    aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  }

  setupInputCabangLogSheet(ss);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);
  var totalSynced = 0;
  var detailLines = [];

  (CONFIG.CABANG || []).forEach(function(cabang) {
    var sh = setupSingleCabangMirrorSheet_(ss, cabang);
    if (!sh) return;

    var lastRow = safeGetLastRow_(sh);
    var synced = 0;

    if (lastRow >= 2) {
      for (var r = 2; r <= lastRow; r++) {
        var result = syncManualCabangRowToAduan_(sh, r, aduanSheet, logSheet);
        if (result && result.synced) synced++;
      }
    }

    totalSynced += synced;
    detailLines.push(cabang + ': ' + synced + ' data manual');
  });

  if (totalSynced > 0) {
    try { sortSheet(); } catch(e) {}
    try { removeEmptyRowsAduan(); } catch(e2) {}
  }

  return { totalSynced: totalSynced, detailLines: detailLines };
}

function deleteLegacyInputCabangSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var existing = (LEGACY_CABANG_INPUT_SHEETS || []).filter(function(item) {
    return !!ss.getSheetByName(item.sheet);
  });

  if (!existing.length) {
    ui.alert('Tidak ada sheet INPUT lama yang ditemukan.');
    return;
  }

  var names = existing.map(function(item) { return item.sheet; }).join('\\n');

  var confirm = ui.alert(
    'Hapus Sheet INPUT Lama',
    'Sheet INPUT_* tidak dipakai lagi mulai versi ini. Manual input sekarang langsung di sheet CABANG_*.\n\n' +
    'Sheet berikut akan dihapus permanen dari spreadsheet:\\n\\n' + names + '\\n\\n' +
    'Pastikan tidak ada data penting yang belum dipindahkan. Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var deleted = 0;
  existing.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;
    try {
      ss.deleteSheet(sh);
      deleted++;
    } catch(e) {}
  });

  ui.alert(
    '✅ Sheet INPUT Lama Dihapus',
    deleted + ' sheet INPUT lama sudah dihapus.\\n\\n' +
    'Mulai sekarang cabang cukup pakai sheet CABANG_* untuk input manual sekaligus update status.',
    ui.ButtonSet.OK
  );
}


// ============================================================
// V10.9.38 - DROPDOWN STATUS / UNIT DI SHEET CABANG + SYNC KE ADUAN
// ============================================================

function isCabangMirrorSheetName_(name) {
  name = String(name || '').trim();
  return name.indexOf('CABANG_') === 0;
}

function applyCabangMirrorDropdowns_(sh) {
  if (!sh) return;
  var maxRows = Math.max(500, sh.getMaxRows() - 1);

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

  var jenisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.JENIS_GANGGUAN || ['Air Mati', 'Tekanan Rendah', 'Air Keruh', 'Pipa Bocor', 'Meter Bermasalah', 'Tagihan', 'Sambungan Baru', 'Lainnya'], true)
    .setAllowInvalid(true)
    .build();

  try { sh.getRange(2, CONFIG.COL.JENIS_GANGGUAN, maxRows, 1).setDataValidation(jenisRule); } catch(e0) {}
  try { sh.getRange(2, CONFIG.COL.PRIORITAS, maxRows, 1).setDataValidation(priorityRule); } catch(e) {}
  try { sh.getRange(2, CONFIG.COL.STATUS, maxRows, 1).setDataValidation(statusRule); } catch(e2) {}
  try { sh.getRange(2, CONFIG.COL.UNIT, maxRows, 1).setDataValidation(unitRule); } catch(e3) {}

  try { sh.getRange(2, CONFIG.COL.WAKTU_SELESAI, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e4) {}
  try { sh.getRange(2, CONFIG.COL.UPDATED_AT, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e5) {}
}

function refreshAllCabangMirrorDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;

  (CONFIG.CABANG || []).forEach(function(cabang) {
    var sh = setupSingleCabangMirrorSheet_(ss, cabang);
    if (!sh) return;
    applyCabangMirrorDropdowns_(sh);

    // V10.9.42: rapikan baris existing yang sudah punya input manual tetapi Cabang/Wilayah masih kosong.
    try {
      var lastRow = safeGetLastRow_(sh);
      if (lastRow >= 2) {
        for (var r = 2; r <= lastRow; r++) {
          autoFillCabangWilayahForMirrorRow_(sh, r);
        }
      }
    } catch(e) {}

    total++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ Dropdown Cabang Diperbaiki',
    'Dropdown Jenis Gangguan, Status, Unit/Petugas, dan Prioritas sudah dipasang ulang pada ' + total + ' sheet cabang.\n\n' +
    'Kolom yang memiliki dropdown:\n' +
    '- Jenis Gangguan\n' +
    '- Prioritas\n' +
    '- Status\n' +
    '- Unit/Petugas\n\n' +
    'Cabang bisa mengganti Status/Unit dari sheet CABANG_ masing-masing.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function findAduanRowNumberById_(id) {
  id = normalizeAduanIdHyphen_(id || '');
  if (!id) return 0;
  var key = normalizeId_(id);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!main || safeGetLastRow_(main) < 2) return 0;

  var values = main.getRange(2, CONFIG.COL.ID, safeGetLastRow_(main) - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeId_(values[i][0]) === key) return i + 2;
  }
  return 0;
}


// ============================================================
// V10.9.43 - SYNC ADUAN UTAMA KE SHEET CABANG
// ============================================================

function findCabangMirrorRowById_(sheet, id) {
  id = normalizeAduanIdHyphen_(id || '');
  if (!sheet || !id || safeGetLastRow_(sheet) < 2) return 0;
  var key = normalizeId_(id);

  var ids = sheet.getRange(2, CONFIG.COL.ID, safeGetLastRow_(sheet) - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (normalizeId_(ids[i][0]) === key) return i + 2;
  }

  return 0;
}

function getAduanObjectFromSheetRow_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return null;
  var width = Math.max(sheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20, 20);
  var row = sheet.getRange(rowNumber, 1, 1, width).getValues()[0];
  return parseAduanRowForTracking_(row);
}

function syncAduanRowToCabangMirror_(mainSheet, rowNumber) {
  mainSheet = mainSheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  rowNumber = Number(rowNumber || 0);
  if (!mainSheet || rowNumber < 2) return { success: false, reason: 'invalid row' };

  var aduan = getAduanObjectFromSheetRow_(mainSheet, rowNumber);
  if (!aduan || !aduan.id) return { success: false, reason: 'ID kosong' };

  // Data master ADUAN berubah/akan dicerminkan, cache cek status harus dibersihkan.
  try { invalidateAduanFindCacheById_(aduan.id); } catch(e) {}

  // Ambil nilai mentah tanggal agar tidak berubah jadi teks format WA.
  try {
    var width = Math.max(mainSheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20, 20);
    var raw = mainSheet.getRange(rowNumber, 1, 1, width).getValues()[0];
    aduan.waktuMasukDate = raw[CONFIG.COL.WAKTU_MASUK - 1] || aduan.waktuMasukDate || aduan.waktuMasuk;
    aduan.waktuSelesaiDate = raw[CONFIG.COL.WAKTU_SELESAI - 1] || aduan.waktuSelesaiDate || aduan.waktuSelesai;
    aduan.updatedAtDate = raw[CONFIG.COL.UPDATED_AT - 1] || aduan.updatedAtDate || aduan.updatedAt;
    aduan.desa = raw[CONFIG.COL.DESA - 1] || aduan.desa || aduan.noPelanggan || '';
    aduan.noPelanggan = raw[(CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA) - 1] || aduan.noPelanggan || '';
  } catch(e) {}

  return mirrorAduanToCabangSheet_(aduan);
}

function syncAduanEditToCabangMirror_(e) {
  if (!e || !e.range) return;

  var sh = e.range.getSheet();
  if (!sh || sh.getName() !== CONFIG.SHEET_NAME) return;

  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var startCol = range.getColumn();
  var endCol = startCol + range.getNumColumns() - 1;

  if (startRow < 2) return;

  // Kolom-kolom yang kalau berubah harus dicerminkan ke sheet cabang.
  var watchedCols = [
    CONFIG.COL.CABANG,
    CONFIG.COL.WILAYAH,
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.PRIORITAS,
    CONFIG.COL.STATUS,
    CONFIG.COL.UNIT,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.CATATAN,
    CONFIG.COL.WAKTU_SELESAI,
    CONFIG.COL.LATITUDE,
    CONFIG.COL.LONGITUDE,
    CONFIG.COL.LINK_MAPS,
    CONFIG.COL.LOKASI_DETAIL
  ];

  var touched = watchedCols.some(function(c) {
    return c >= startCol && c <= endCol;
  });

  if (!touched) return;

  for (var r = startRow; r < startRow + numRows; r++) {
    if (r < 2) continue;
    try { syncAduanRowToCabangMirror_(sh, r); } catch(err) {}
  }
}

function syncAllAduanToCabangMirror() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!main || safeGetLastRow_(main) < 2) {
    ui.alert('Belum ada data ADUAN untuk disinkronkan.');
    return;
  }

  var confirm = ui.alert(
    'Sinkron ADUAN ke Sheet Cabang',
    'Fitur ini akan menyalin ulang data dari sheet ADUAN ke sheet CABANG_* berdasarkan ID Aduan.\n\n' +
    'Kalau Status/Unit/Prioritas di ADUAN sudah diubah, sheet cabang akan ikut diperbarui.\n' +
    'Jika ada ID di CABANG_* yang sudah tidak ada di ADUAN, baris mirror cabang juga akan dibersihkan.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getScriptLock();
  var total = 0;
  var gagal = 0;

  try {
    lock.waitLock(30000);

    for (var r = 2; r <= safeGetLastRow_(main); r++) {
      var id = String(main.getRange(r, CONFIG.COL.ID).getValue() || '').trim();
      if (!id) continue;

      var result = syncAduanRowToCabangMirror_(main, r);
      if (result && result.success) total++;
      else gagal++;
    }

    var cleanup = cleanupCabangMirrorRowsMissingInAduan_(true);

    ui.alert(
      '✅ Sinkron Selesai',
      'Data ADUAN yang disinkron ke sheet cabang: ' + total + '\n' +
      'Gagal/terlewati: ' + gagal + '\n' +
      'Baris mirror cabang yang dibersihkan karena ID sudah tidak ada di ADUAN: ' + (cleanup.deleted || 0) + '\n\n' +
      'Sekarang Status di ADUAN dan CABANG_* harus sama.',
      ui.ButtonSet.OK
    );

  } catch(e) {
    ui.alert('❌ Sinkron gagal: ' + (e.message || String(e)));
  } finally {
    try { lock.releaseLock(); } catch(err) {}
  }
}

// ============================================================
// V10.9.89 - SYNC HAPUS ADUAN KE SHEET CABANG
// ============================================================

function getMainAduanIdSet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  var set = {};
  if (!main || safeGetLastRow_(main) < 2) return set;

  var values = main.getRange(2, CONFIG.COL.ID, safeGetLastRow_(main) - 1, 1).getDisplayValues();
  values.forEach(function(row) {
    var id = normalizeAduanIdHyphen_(row[0] || '');
    if (id) set[id] = true;
  });

  return set;
}

function cleanupCabangMirrorRowsMissingInAduan(silent) {
  var result = cleanupCabangMirrorRowsMissingInAduan_(!!silent);

  if (!silent) {
    try {
      SpreadsheetApp.getUi().alert(
        'Bersihkan Sheet Cabang Selesai',
        'Baris CABANG_* yang ID-nya sudah tidak ada di ADUAN telah dibersihkan.\n\n' +
        'Total dihapus: ' + (result.deleted || 0) + '\n' +
        'Sheet dicek: ' + (result.sheetsChecked || 0) + '\n\n' +
        'Catatan: hapus baris di CABANG_* tetap tidak menghapus ADUAN. ADUAN adalah data pusat.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch(e) {}
  }

  return result;
}

function cleanupCabangMirrorRowsMissingInAduan_(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var idSet = getMainAduanIdSet_();
  var sheets = ss.getSheets();

  var deleted = 0;
  var checked = 0;
  var detail = [];

  sheets.forEach(function(sh) {
    var name = sh.getName();
    if (!isCabangMirrorSheetName_(name)) return;

    checked++;
    var lastRow = safeGetLastRow_(sh);
    if (lastRow < 2) return;

    var ids = sh.getRange(2, CONFIG.COL.ID, lastRow - 1, 1).getDisplayValues();
    var rowsToDelete = [];

    ids.forEach(function(row, i) {
      var id = normalizeAduanIdHyphen_(row[0] || '');
      // Jangan hapus baris kosong, karena CABANG_* bisa dipakai untuk input manual.
      if (!id) return;
      if (!idSet[id]) rowsToDelete.push(i + 2);
    });

    rowsToDelete.sort(function(a, b) { return b - a; });
    rowsToDelete.forEach(function(rowNumber) {
      try {
        sh.deleteRow(rowNumber);
        deleted++;
      } catch(e) {}
    });

    if (rowsToDelete.length) {
      detail.push({ sheet: name, deleted: rowsToDelete.length });
    }
  });

  return {
    success: true,
    deleted: deleted,
    sheetsChecked: checked,
    detail: detail
  };
}

function enableAduanDeleteMirrorSyncTrigger() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Aktifkan Sinkron Hapus ADUAN',
    'Trigger ini akan membantu membersihkan sheet CABANG_* ketika ada baris aduan yang dihapus dari ADUAN.\n\n' +
    'Catatan aman:\n' +
    '- ADUAN tetap menjadi data pusat.\n' +
    '- Hapus di CABANG_* tidak akan menghapus ADUAN.\n' +
    '- Hapus di ADUAN akan membersihkan mirror CABANG_* setelah trigger berjalan.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  installAduanDeleteMirrorSyncTrigger_();

  ui.alert(
    '✅ Sinkron Hapus ADUAN Aktif',
    'Trigger onChange sudah aktif.\n\nJika baris di ADUAN dihapus, sistem akan membersihkan data mirror di CABANG_* yang ID-nya sudah tidak ada di ADUAN.',
    ui.ButtonSet.OK
  );
}

function installAduanDeleteMirrorSyncTrigger_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'handleAduanDeleteMirrorOnChange') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('handleAduanDeleteMirrorOnChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();
}

function handleAduanDeleteMirrorOnChange(e) {
  try {
    var changeType = e && e.changeType ? String(e.changeType) : '';

    // REMOVE_ROW adalah target utama. OTHER tetap ikut dibersihkan ringan karena
    // beberapa aksi sheet kadang tidak mengirim detail yang konsisten.
    if (changeType && ['REMOVE_ROW', 'OTHER'].indexOf(changeType) === -1) return;

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return;

    try {
      var result = cleanupCabangMirrorRowsMissingInAduan_(true);
      if (result && result.deleted) {
        logWhatsApp_(
          'SYSTEM',
          'ADUAN_DELETE_MIRROR_SYNC',
          'CABANG_MIRROR_CLEANUP',
          '',
          'Bersihkan mirror cabang dari ID yang sudah tidak ada di ADUAN',
          'OK',
          JSON.stringify(result)
        );
      }
    } finally {
      try { lock.releaseLock(); } catch(e2) {}
    }
  } catch(err) {
    try {
      logWhatsApp_(
        'SYSTEM',
        'ADUAN_DELETE_MIRROR_SYNC_ERROR',
        'CABANG_MIRROR_CLEANUP',
        '',
        '',
        'ERROR',
        err.message || String(err)
      );
    } catch(e3) {}
  }
}




function syncCabangMirrorEditToAduan_(e) {
  if (!e || !e.range) return;

  var sh = e.range.getSheet();
  if (!sh || !isCabangMirrorSheetName_(sh.getName())) return;

  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var startCol = range.getColumn();
  var endCol = startCol + range.getNumColumns() - 1;

  if (startRow < 2) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!main) return;

  setupInputCabangLogSheet(ss);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  for (var r = startRow; r < startRow + numRows; r++) {
    if (r < 2) continue;

    var id = String(sh.getRange(r, CONFIG.COL.ID).getValue() || '').trim();

    // V10.9.40:
    // Jika ID kosong, baris di CABANG_* dianggap input manual baru.
    // Setelah minimal Nama + Wilayah + Jenis Gangguan lengkap, sistem buat ID dan kirim ke ADUAN.
    if (!id) {
      syncManualCabangRowToAduan_(sh, r, main, logSheet);
      continue;
    }

    var watchedCols = [
      CONFIG.COL.PRIORITAS,
      CONFIG.COL.STATUS,
      CONFIG.COL.UNIT,
      CONFIG.COL.CATATAN
    ];

    var touched = watchedCols.some(function(c) {
      return c >= startCol && c <= endCol;
    });

    if (!touched) continue;

    var mainRow = findAduanRowNumberById_(id);
    if (!mainRow) continue;

    var oldStatus = String(main.getRange(mainRow, CONFIG.COL.STATUS).getValue() || '').trim();
    var newPrioritas = String(sh.getRange(r, CONFIG.COL.PRIORITAS).getValue() || '').trim();
    var newStatus = String(sh.getRange(r, CONFIG.COL.STATUS).getValue() || '').trim();
    var newUnit = String(sh.getRange(r, CONFIG.COL.UNIT).getValue() || '').trim();
    var newCatatan = String(sh.getRange(r, CONFIG.COL.CATATAN).getValue() || '').trim();

    if (newPrioritas) {
      main.getRange(mainRow, CONFIG.COL.PRIORITAS).setValue(newPrioritas);
      main.getRange(mainRow, CONFIG.COL.SLA_JAM).setValue(getSlaJamForPrioritas_(newPrioritas));
    }

    if (newStatus) {
      main.getRange(mainRow, CONFIG.COL.STATUS).setValue(newStatus);

      if (newStatus === 'Selesai') {
        var doneAt = sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).getValue() || new Date();
        main.getRange(mainRow, CONFIG.COL.WAKTU_SELESAI).setValue(doneAt);
        sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).setValue(doneAt);
      } else if (oldStatus === 'Selesai' && newStatus !== 'Selesai') {
        main.getRange(mainRow, CONFIG.COL.WAKTU_SELESAI).clearContent();
        sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).clearContent();
      }
    }

    if (newUnit) main.getRange(mainRow, CONFIG.COL.UNIT).setValue(newUnit);
    main.getRange(mainRow, CONFIG.COL.CATATAN).setValue(newCatatan);

    var now = new Date();
    main.getRange(mainRow, CONFIG.COL.UPDATED_AT).setValue(now);
    sh.getRange(r, CONFIG.COL.UPDATED_AT).setValue(now);

    try { invalidateAduanFindCacheById_(id); } catch(cacheErr) {}

    if (newStatus && oldStatus && oldStatus.toLowerCase() !== newStatus.toLowerCase()) {
      try {
        notifyCustomerStatusChangeByRow_(main, mainRow, oldStatus, newStatus, 'CABANG_SHEET_EDIT');
      } catch(notifErr) {
        try {
          logStatusNotif_(id, '-', oldStatus, newStatus, false, 'ERROR_CABANG_SYNC', notifErr.message || String(notifErr), '', notifErr.stack || '');
        } catch(e2) {}
      }
    }
  }
}


function getAduanHeadersForCabangMirror_() {
  return [
    'ID Aduan', 'Waktu Masuk', 'Cabang', 'Wilayah/Kecamatan',
    'No Pelanggan', 'Nama Pelanggan', 'No HP', 'Jenis Gangguan', 'Prioritas',
    'Status', 'Unit/Petugas', 'Keterangan Aduan', 'Catatan Tindak Lanjut',
    'Waktu Selesai', 'SLA Respons Jam', 'Updated At',
    'Latitude', 'Longitude', 'Link Maps', 'Lokasi Detail'
  ];
}


// ============================================================
// V10.9.39 - FIX CABANG PRAYA BARAT DAYA / LNY
// ============================================================

function fixPrayaBaratDayaFromLny() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Pastikan sheet resmi PBD dibuat.
  var prbdSheet = setupSingleCabangMirrorSheet_(ss, 'Cabang Praya Barat Daya');
  applyCabangMirrorDropdowns_(prbdSheet);

  var lnySheet = ss.getSheetByName('CABANG_LNY');
  var moved = 0;

  if (lnySheet && safeGetLastRow_(lnySheet) >= 2) {
    var lastCol = Math.max(lnySheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20);
    var values = lnySheet.getRange(2, 1, safeGetLastRow_(lnySheet) - 1, lastCol).getValues();
    var rowsToDelete = [];

    values.forEach(function(row, idx) {
      var cabang = String(row[CONFIG.COL.CABANG - 1] || '').trim();
      var id = String(row[CONFIG.COL.ID - 1] || '').trim();

      // Pindahkan hanya data yang memang Cabang Praya Barat Daya.
      // ID lama mungkin masih LNY karena versi sebelumnya belum punya mapping PBD.
      if (cabang === 'Cabang Praya Barat Daya') {
        var exists = false;
        if (safeGetLastRow_(prbdSheet) >= 2) {
          var ids = prbdSheet.getRange(2, CONFIG.COL.ID, safeGetLastRow_(prbdSheet) - 1, 1).getValues();
          exists = ids.some(function(v) { return String(v[0] || '').trim() === id; });
        }
        if (!exists) prbdSheet.appendRow(row);
        rowsToDelete.push(idx + 2);
        moved++;
      }
    });

    // Hapus dari bawah agar nomor baris tidak bergeser.
    rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNum) {
      try { lnySheet.deleteRow(rowNum); } catch(e) {}
    });

    applyCabangMirrorDropdowns_(prbdSheet);
  }

  ui.alert(
    '✅ PBD Diperbaiki',
    'Kode Cabang Praya Barat Daya sekarang adalah PBD.\n\n' +
    'Sheet resmi yang dipakai:\n' +
    '- CABANG_PBD\n\n' +
    'Data Praya Barat Daya yang sebelumnya masuk CABANG_LNY dipindahkan: ' + moved + ' baris.\n\n' +
    'Catatan: CABANG_LNY adalah sheet fallback/lainnya. Jika sudah kosong dan tidak dipakai, boleh dihapus manual.',
    ui.ButtonSet.OK
  );
}


function setupCabangMirrorSheets(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  (CONFIG.CABANG || []).forEach(function(cabang) {
    setupSingleCabangMirrorSheet_(ss, cabang);
  });

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Aduan Cabang Siap',
      'Sheet cabang resmi sudah dicek/dibuat. Mulai versi ini, sheet CABANG_* dipakai untuk melihat aduan, update status, sekaligus input manual aduan baru. Data lama tidak dihapus.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}
}

function setupSingleCabangMirrorSheet_(ss, cabang) {
  var sheetName = getCabangMirrorSheetName_(cabang);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = getAduanHeadersForCabangMirror_();
  var __fastKey = getSheetRuntimeKey_('MIRROR_SETUP_FAST_V10942', sh);
  var fastReady = isSiagaFastMode_() && cacheGet_(__fastKey);

  if (!fastReady) {
    if (sh.getMaxColumns() < headers.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    }

    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#123a5d')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);

    try {
      if (!sh.getFilter()) sh.getRange(1, 1, Math.max(safeGetLastRow_(sh), 2), headers.length).createFilter();
    } catch(e) {}

    try {
      sh.setColumnWidth(CONFIG.COL.STATUS, 110);
      sh.setColumnWidth(CONFIG.COL.UNIT, 130);
      sh.setColumnWidth(CONFIG.COL.CATATAN, 220);
    } catch(e2) {}

    applyCabangMirrorDropdowns_(sh);
    cachePut_(__fastKey, '1', 21600);
  }

  // BUGFIX V11.10.1: format kolom No Pelanggan sebelumnya ada DI DALAM blok
  // "if (!fastReady)" di atas, sehingga saat cache fast-mode masih aktif
  // (sampai 6 jam), format Plain Text ('@') TIDAK pernah dipaksa ulang di
  // sheet mirror cabang ini -- padahal fungsi ini dipanggil setiap ada aduan
  // baru/update via mirrorAduanToCabangSheet_. Sekarang dipindah ke luar blok
  // cache supaya selalu dijalankan (operasi ini ringan/murah).
  try {
    var noPelangganColMirror = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
    sh.getRange(2, noPelangganColMirror, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
  } catch (eFormatMirrorNoPel) {}

  return sh;
}

function mirrorAduanToCabangSheet_(aduan) {
  aduan = aduan || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cabang = aduan.cabang || 'Cabang Lainnya';
  var sh = setupSingleCabangMirrorSheet_(ss, cabang);
  var id = String(aduan.id || '').trim();
  if (!id) return { success: false, error: 'ID aduan kosong.' };

  var row = [
    aduan.id || '',
    aduan.waktuMasukDate || aduan.waktuMasuk || '',
    aduan.cabang || '',
    aduan.wilayah || '',
    aduan.desa || aduan.noPelanggan || '',
    aduan.namaPelanggan || '',
    aduan.noHp || '',
    aduan.jenisGangguan || '',
    aduan.prioritas || '',
    aduan.status || '',
    aduan.unit || '',
    aduan.keterangan || '',
    aduan.catatan || '',
    aduan.waktuSelesaiDate || aduan.waktuSelesai || '',
    aduan.slaJam || '',
    aduan.updatedAtDate || aduan.updatedAt || '',
    aduan.latitude || '',
    aduan.longitude || '',
    aduan.linkMaps || '',
    aduan.lokasiDetail || ''
  ];

  // V10.9.43:
  // Kalau ID sudah ada di sheet cabang, UPDATE barisnya.
  // Sebelumnya sistem skip, sehingga Status di CABANG_* bisa tidak sama dengan ADUAN.
  var existingRow = findCabangMirrorRowById_(sh, id);
  if (existingRow) {
    sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
    enforcePriorityStatusUnitForRow_(sh, existingRow);
    try { applyCabangMirrorDropdowns_(sh); } catch(e) {}
    return { success: true, updated: true, sheet: sh.getName(), row: existingRow, id: id };
  }

  sh.appendRow(row);
  var appendedRow = sh.getLastRow();
  enforcePriorityStatusUnitForRow_(sh, appendedRow);
  try { applyCabangMirrorDropdowns_(sh); } catch(e2) {}
  return { success: true, inserted: true, sheet: sh.getName(), row: appendedRow, id: id };
}

function testMirrorAduanToCabangSheet() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Copy Aduan ke Sheet Cabang',
    'Masukkan ID Aduan yang sudah ada. Contoh: PRY7K2A',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(prompt.getResponseText()) || prompt.getResponseText();
  var aduan = findAduanById_(id);

  if (!aduan) {
    ui.alert('❌ ID tidak ditemukan', 'ID tidak ada di sheet ADUAN: ' + id, ui.ButtonSet.OK);
    return;
  }

  var result = mirrorAduanToCabangSheet_(aduan);
  ui.alert(result.success ? '✅ Copy selesai' : '❌ Copy gagal', JSON.stringify(result, null, 2), ui.ButtonSet.OK);
}



// ============================================================
// V10.9.45 - MENU PETUGAS, UPDATE STATUS, DAN FOTO BUKTI
// ============================================================

function setupDokumentasiAduanSheet(ss) {
  return setupDokumentasiAduanSheet_(ss || SpreadsheetApp.getActiveSpreadsheet());
}

function setupDokumentasiAduanSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.DOKUMENTASI_ADUAN_SHEET || 'DOKUMENTASI_ADUAN';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var headers = [
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

  if (safeGetLastRow_(sh) === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, headers.length); } catch(e) {}
  return sh;
}

function openDokumentasiAduanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(setupDokumentasiAduanSheet_(ss));
}

function setupLogStatusAduanSheet(ss) {
  return setupLogStatusAduanSheet_(ss || SpreadsheetApp.getActiveSpreadsheet());
}

function setupLogStatusAduanSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.LOG_STATUS_ADUAN_SHEET || 'LOG_STATUS_ADUAN';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var headers = [
    'Waktu',
    'ID Aduan',
    'Status Lama',
    'Status Baru',
    'Nama Petugas/Admin',
    'No WA',
    'Cabang Petugas',
    'Sumber Update',
    'Catatan',
    'Detail'
  ];

  if (safeGetLastRow_(sh) === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, headers.length); } catch(e) {}
  return sh;
}

function openLogStatusAduanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(setupLogStatusAduanSheet_(ss));
}

function logStatusAduan_(idAduan, oldStatus, newStatus, petugas, source, catatan, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = setupLogStatusAduanSheet_(ss);
    petugas = petugas || {};
    sh.getRange(sh.getLastRow() + 1, 1, 1, 10).setValues([[
      new Date(),
      idAduan || '',
      oldStatus || '',
      newStatus || '',
      petugas.nama || petugas.name || '-',
      normalizePhone_(petugas.noWa || ''),
      petugas.cabang || '-',
      source || 'WA_PETUGAS',
      catatan || '',
      truncateForLog_(detail || '', 1200)
    ]]);
  } catch(e) {}
}



// ============================================================
// V10.9.81 - EXECUTIVE INSIGHT / MENU DIREKSI + TANYA TIARA AI
// ============================================================
