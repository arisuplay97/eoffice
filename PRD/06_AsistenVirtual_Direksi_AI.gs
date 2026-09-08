// ============================================================
// SIAGA TIARA V10.9.236 - KODE DIPECAH / MODUL: 06_AsistenVirtual_Direksi_AI.gs
// Sumber: V10.9.213 FORMAT WAKTU CHAT ADMIN
// Catatan: Jangan ubah urutan file. File ZZ_Final_* berisi override final/hotfix terakhir.
// ============================================================

function setupDireksiAccessSheet(ss) {
  // V10.9.85:
  // Akses direksi tetap memakai PETUGAS_CABANG agar tidak menambah sheet baru.
  // Fungsi ini hanya memastikan PETUGAS_CABANG siap dan menambahkan baris contoh jika belum ada.
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var sh = setupPetugasCabangSheet(ss);
  var rows = getPetugasRows_();
  var hasDireksi = false;

  for (var i = 0; i < rows.length; i++) {
    var roleText = [rows[i].role, rows[i].cabang, rows[i].nama].join(' ');
    if (isDireksiRoleText_(roleText)) {
      hasDireksi = true;
      break;
    }
  }

  if (!hasDireksi) {
    var newRow = [
      'Direksi',
      'Nama Direksi',
      '',
      'Direksi',
      'Aktif',
      'TIDAK',
      'TIDAK',
      'Isi nomor WA direksi/manajemen. Nomor format 628xxx tanpa +. Akses Executive Insight.'
    ];
    sh.getRange(sh.getLastRow() + 1, 1, 1, newRow.length).setValues([newRow]);
  }

  try {
    sh.activate();
    SpreadsheetApp.getUi().alert(
      'Setup Akses Direksi',
      'Setup selesai.\n\n' +
      'Akses direksi memakai sheet PETUGAS_CABANG.\n\n' +
      'Isi baris Direksi dengan format:\n' +
      '- Cabang: Direksi / Admin Pusat\n' +
      '- Nama Petugas: nama direksi\n' +
      '- No WA: 628xxxxxxxxxx\n' +
      '- Role: Direksi / Direktur / Dirut / Manajemen\n' +
      '- Status: Aktif\n' +
      '- Notif Aduan Baru: TIDAK\n' +
      '- Notif Darurat: TIDAK',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}

  return sh;
}

function openDireksiAccessSheet() {
  // V10.9.82:
  // Akses direksi ada di PETUGAS_CABANG, bukan DIREKSI_ACCESS.
  openPetugasCabangSheet();
}

function setupAiInsightLogSheet_(ss) {
  // V10.9.82:
  // LOG_AI tidak dibuat lagi agar sheet tidak bertambah.
  // Riwayat Tanya Asisten Virtual dicatat ke LOG_WHATSAPP dengan jenis AI_DIREKSI.
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  return ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET || 'LOG_WHATSAPP');
}

function openAiInsightLogSheet() {
  // V10.9.82:
  // Riwayat AI ada di LOG_WHATSAPP, jenis AI_DIREKSI.
  openWhatsAppLog();
}

function logAiInsight_(phone, nama, fitur, input, model, status, output) {
  try {
    var raw = JSON.stringify({
      source: 'DIREKSI_AI',
      nama: nama || '',
      fitur: fitur || '',
      model: model || '',
      status: status || '',
      input: truncateForLog_(input || '', 500),
      output: truncateForLog_(output || '', 900)
    });

    logWhatsApp_(
      phone || '',
      input || '',
      'AI_DIREKSI_' + String(fitur || 'CHAT'),
      '',
      output || '',
      status || '',
      raw
    );
  } catch(e) {}
}


// ============================================================
// V10.9.216 - TIARA Asisten Virtual pelanggan diperketat + API AI Bersama
// - Satu konfigurasi AI dipakai untuk pelanggan dan direksi.
// - Pelanggan yang mengetik admin/hubungi admin/cs tetap langsung ke Chat Admin manusia.
// - AI hanya membantu mengarahkan jika pelanggan mengetik bebas/ngasal di menu awal.
// - Jika AI mati/error/timeout, sistem kembali ke menu otomatis lama.
// ============================================================

function getSharedAiConfig_() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = String(props.getProperty('SHARED_AI_BASE_URL') || props.getProperty('ANTHROPIC_BASE_URL') || CONFIG.SHARED_AI_BASE_URL || 'https://capi.aerolink.lat').trim();
  baseUrl = baseUrl.replace(/\/+$/, '');
  return {
    apiKey: String(props.getProperty('SHARED_AI_API_KEY') || props.getProperty('ANTHROPIC_API_KEY') || '').trim(),
    baseUrl: baseUrl,
    model: String(props.getProperty('SHARED_AI_MODEL') || props.getProperty('ANTHROPIC_MODEL') || CONFIG.SHARED_AI_MODEL || 'claude-opus-4-6').trim(),
    timeoutSeconds: Number(props.getProperty('SHARED_AI_TIMEOUT_SECONDS') || CONFIG.SHARED_AI_TIMEOUT_SECONDS || 10) || 10,
    customerEnabled: String(props.getProperty('SHARED_AI_CUSTOMER_ENABLED') || CONFIG.SHARED_AI_CUSTOMER_ENABLED || 'YA').toUpperCase() !== 'TIDAK',
    direksiEnabled: String(props.getProperty('SHARED_AI_DIREKSI_ENABLED') || CONFIG.SHARED_AI_DIREKSI_ENABLED || 'YA').toUpperCase() !== 'TIDAK'
  };
}

function setSharedAiConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var cfg = getSharedAiConfig_();

  var keyPrompt = ui.prompt(
    '1/5 - API Key AI Bersama',
    'Tempel API Key AI.\n\nKey disimpan di Script Properties, bukan di sheet biasa.',
    ui.ButtonSet.OK_CANCEL
  );
  if (keyPrompt.getSelectedButton() !== ui.Button.OK) return;
  var apiKey = String(keyPrompt.getResponseText() || '').trim();
  if (!apiKey) {
    ui.alert('API Key kosong. Konfigurasi dibatalkan.');
    return;
  }

  var basePrompt = ui.prompt(
    '2/5 - Base URL AI',
    'Masukkan Base URL.\n\nDefault:\n' + (cfg.baseUrl || 'https://capi.aerolink.lat'),
    ui.ButtonSet.OK_CANCEL
  );
  if (basePrompt.getSelectedButton() !== ui.Button.OK) return;
  var baseUrl = String(basePrompt.getResponseText() || cfg.baseUrl || 'https://capi.aerolink.lat').trim().replace(/\/+$/, '');

  var modelPrompt = ui.prompt(
    '3/5 - Model AI',
    'Masukkan nama model.\n\nContoh sesuai provider Anda: opus 4.6 / claude-opus-4-6 / model lain.\n\nDefault:\n' + (cfg.model || 'claude-opus-4-6'),
    ui.ButtonSet.OK_CANCEL
  );
  if (modelPrompt.getSelectedButton() !== ui.Button.OK) return;
  var model = String(modelPrompt.getResponseText() || cfg.model || 'claude-opus-4-6').trim();

  var customerPrompt = ui.prompt(
    '4/5 - AI Pelanggan',
    'Aktifkan TIARA Asisten Virtual untuk pelanggan?\n\nIsi YA atau TIDAK.\nRekomendasi: YA',
    ui.ButtonSet.OK_CANCEL
  );
  if (customerPrompt.getSelectedButton() !== ui.Button.OK) return;
  var customerEnabled = String(customerPrompt.getResponseText() || 'YA').trim().toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA';

  var direksiPrompt = ui.prompt(
    '5/5 - AI Direksi',
    'Aktifkan AI Direksi memakai API yang sama?\n\nIsi YA atau TIDAK.\nRekomendasi: YA',
    ui.ButtonSet.OK_CANCEL
  );
  if (direksiPrompt.getSelectedButton() !== ui.Button.OK) return;
  var direksiEnabled = String(direksiPrompt.getResponseText() || 'YA').trim().toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA';

  props.setProperty('SHARED_AI_API_KEY', apiKey);
  props.setProperty('ANTHROPIC_API_KEY', apiKey);
  props.setProperty('SHARED_AI_BASE_URL', baseUrl);
  props.setProperty('ANTHROPIC_BASE_URL', baseUrl);
  props.setProperty('SHARED_AI_MODEL', model);
  props.setProperty('ANTHROPIC_MODEL', model);
  props.setProperty('SHARED_AI_CUSTOMER_ENABLED', customerEnabled);
  props.setProperty('SHARED_AI_DIREKSI_ENABLED', direksiEnabled);
  props.setProperty('SHARED_AI_TIMEOUT_SECONDS', String(cfg.timeoutSeconds || 10));
  clearRuntimePropCache_();

  ui.alert(
    '✅ API AI Bersama tersimpan',
    'Base URL: ' + baseUrl + '\nModel: ' + model + '\nAI Pelanggan: ' + customerEnabled + '\nAI Direksi: ' + direksiEnabled + '\n\nDipakai bersama untuk pelanggan dan direksi.',
    ui.ButtonSet.OK
  );
}

function enableSharedAiAll() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHARED_AI_CUSTOMER_ENABLED', 'YA');
  props.setProperty('SHARED_AI_DIREKSI_ENABLED', 'YA');
  SpreadsheetApp.getUi().alert('✅ AI pelanggan dan AI direksi sudah diaktifkan.');
}

function disableCustomerAiAssistant() {
  PropertiesService.getScriptProperties().setProperty('SHARED_AI_CUSTOMER_ENABLED', 'TIDAK');
  SpreadsheetApp.getUi().alert('AI pelanggan dimatikan. Sistem pelanggan kembali seperti menu otomatis biasa.');
}

function disableDireksiAiAssistant() {
  PropertiesService.getScriptProperties().setProperty('SHARED_AI_DIREKSI_ENABLED', 'TIDAK');
  SpreadsheetApp.getUi().alert('AI direksi dimatikan. Menu direksi tetap memakai ringkasan data sistem.');
}

function testSharedAiConfig() {
  var ui = SpreadsheetApp.getUi();
  var cfg = getSharedAiConfig_();
  if (!cfg.apiKey) {
    ui.alert('API AI belum disimpan. Jalankan menu: Asisten Virtual > Masukkan API AI Bersama.');
    return;
  }
  var res = callSharedAiMessages_([
    { role: 'user', content: 'Jawab singkat: sebutkan nama Anda sebagai TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani.' }
  ], {
    system: 'Kamu adalah TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani. Jawab singkat, bahasa Indonesia.',
    maxTokens: 120,
    temperature: 0.2
  });
  ui.alert(
    res.success ? 'Tes API AI berhasil' : 'Tes API AI gagal',
    res.success ? ('Model: ' + res.model + '\n\n' + res.text) : (res.error || 'Tidak diketahui'),
    ui.ButtonSet.OK
  );
}

function callSharedAiMessages_(messages, options) {
  options = options || {};
  var cfg = getSharedAiConfig_();
  if (!cfg.apiKey) return { success: false, skipped: false, error: 'API AI belum disimpan.' };
  if (!cfg.baseUrl) return { success: false, skipped: false, error: 'Base URL AI belum disimpan.' };
  if (!cfg.model) return { success: false, skipped: false, error: 'Model AI belum disimpan.' };

  var baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '');
  var modelLower = String(cfg.model || '').toLowerCase();
  var baseLower = baseUrl.toLowerCase();

  // V10.9.229:
  // Sistem AI sekarang mendukung 2 format API:
  // 1) Anthropic/Claude-style  : POST /v1/messages, header x-api-key
  // 2) OpenAI-compatible style : POST /chat/completions, header Authorization: Bearer
  // Error "Unknown endpoint: POST /v1/messages" muncul jika provider OpenAI-compatible
  // dipanggil memakai format Anthropic. Contoh: DeepSeek/Dhanon/OpenRouter/Gemini-compatible.
  var explicitFormat = '';
  try {
    explicitFormat = String(PropertiesService.getScriptProperties().getProperty('SHARED_AI_API_FORMAT') || '').trim().toUpperCase();
  } catch(e) {}
  var useAnthropic = false;
  if (explicitFormat === 'ANTHROPIC' || explicitFormat === 'CLAUDE') {
    useAnthropic = true;
  } else if (explicitFormat === 'OPENAI' || explicitFormat === 'OPENAI_COMPATIBLE') {
    useAnthropic = false;
  } else {
    // Auto-detect aman: model Claude atau base URL Anthropic memakai /messages.
    // Selain itu pakai OpenAI-compatible agar bisa coba AI lain seperti DeepSeek/Dhanon.
    useAnthropic = /claude|anthropic/.test(modelLower) || /anthropic/.test(baseLower) || /\/messages$/i.test(baseUrl);
  }

  var payload, headers, url;
  if (useAnthropic) {
    url = baseUrl;
    if (!/\/v1\/messages$/i.test(url) && !/\/messages$/i.test(url)) url += '/v1/messages';
    payload = {
      model: cfg.model,
      max_tokens: Number(options.maxTokens || 700),
      temperature: Number(options.temperature || 0.25),
      messages: (messages || []).map(function(m) {
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '')
        };
      })
    };
    if (options.system) payload.system = String(options.system || '');
    headers = {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    };
  } else {
    url = baseUrl;
    if (!/\/chat\/completions$/i.test(url)) url += '/chat/completions';
    var openAiMessages = [];
    if (options.system) openAiMessages.push({ role: 'system', content: String(options.system || '') });
    (messages || []).forEach(function(m) {
      var role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
      openAiMessages.push({ role: role, content: String(m.content || '') });
    });
    payload = {
      model: cfg.model,
      messages: openAiMessages,
      max_tokens: Number(options.maxTokens || 700),
      temperature: Number(options.temperature || 0.25),
      stream: false
    };
    headers = {
      'Authorization': 'Bearer ' + cfg.apiKey
    };
  }

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload)
    });

    var status = res.getResponseCode();
    var body = res.getContentText() || '';
    if (status < 200 || status >= 300) {
      return { success: false, model: cfg.model, error: 'AI HTTP ' + status + ': ' + body.substring(0, 700) };
    }

    var parsed = JSON.parse(body);
    var text = '';

    // Anthropic response
    if (parsed && parsed.content && parsed.content.length) {
      text = parsed.content.map(function(part) {
        if (typeof part === 'string') return part;
        return part.text || '';
      }).join('\n').trim();
    }

    // OpenAI-compatible response
    if (!text && parsed && parsed.choices && parsed.choices.length) {
      var choice = parsed.choices[0] || {};
      if (choice.message && choice.message.content) text = String(choice.message.content || '').trim();
      if (!text && choice.text) text = String(choice.text || '').trim();
      if (!text && choice.delta && choice.delta.content) text = String(choice.delta.content || '').trim();
    }

    if (!text && parsed && parsed.completion) text = String(parsed.completion || '').trim();
    if (!text && parsed && parsed.output_text) text = String(parsed.output_text || '').trim();

    if (!text) return { success: false, model: cfg.model, error: 'Jawaban AI kosong. Response: ' + body.substring(0, 500) };
    return { success: true, model: cfg.model, text: text };
  } catch(err) {
    return { success: false, model: cfg.model, error: err && err.message ? err.message : String(err) };
  }
}

function normalizeVirtualAssistantReply_(text) {
  text = String(text || '').trim();
  if (!text) return '';
  text = text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '*$1*')
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, '*$1*')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  text = sanitizeCustomerVirtualAssistantOrganization_(text);
  return fixUnbalancedWhatsAppBold_(text);
}

function sanitizeCustomerVirtualAssistantOrganization_(text) {
  text = String(text || '');
  if (!text) return '';

  // Pengaman keras agar provider AI tidak mengambil contoh/brand PDAM lain.
  // Identitas resmi pelanggan SIAGA TIARA hanya PERUMDA Tirta Ardhia Rinjani.
  return text
    .replace(/SIAGA\s+PDAM\s+Giri\s+Menang/gi, 'SIAGA TIARA')
    .replace(/PDAM\s+Giri\s+Menang/gi, 'PERUMDA Tirta Ardhia Rinjani')
    .replace(/Perumda\s+Giri\s+Menang/gi, 'PERUMDA Tirta Ardhia Rinjani')
    .replace(/Tirta\s+Giri\s+Menang/gi, 'Tirta Ardhia Rinjani')
    .replace(/Kabupaten\s+Lombok\s+Barat/gi, 'Kabupaten Lombok Tengah');
}


// ============================================================
// V10.9.226 - AI pelanggan dikunci identitas PERUMDA TAR + status aduan gaya resmi
// Catatan: jawaban tetap Bahasa Indonesia resmi. Sasak/typo hanya dipakai
// untuk menangkap maksud pelanggan, bukan untuk membuka topik umum lain.
// V10.9.225: tambah normalisasi typo umum pelanggan agar kalimat seperti
// "kpn nyla air", "aiir blm idup", "tagihn naek", "piran nyale aim" tetap terbaca.
// ============================================================
function normalizeCustomerTypoText_(text) {
  var raw = String(text || '').toLowerCase();
  if (!raw) return '';

  var t = ' ' + raw
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim() + ' ';

  var typoRules = [
    // kata tanya / keluhan umum
    [/\b(kpn|kapn|kapaan|kapang|piran|pirean|piraan|sekat|seket|seked)\b/g, ' kapan '],
    [/\b(knp|kenpa|kenp|napa|ngape|ngapa|kembe|kembeq|kembek|ngumbe|ngumbeq)\b/g, ' kenapa kapan '],
    [/\b(blm|blom|belom|belun|blum|belm|bloman)\b/g, ' belum '],
    [/\b(gk|ga|gak|ngak|nggak|ngga|ndak|ndaq|ndeq|ndek|endek|endeq|nda|dek|tak)\b/g, ' tidak '],
    [/\b(udah|sdh|suda)\b/g, ' sudah '],

    // air / gangguan teknis
    [/\b(aiir|airr|aer|aor|ajr|aie|ayr|aire|aik|aiq|aim|aem|aeq|aieq|aiaq|toto)\b/g, ' air '],
    [/\b(nyla|nylaa|nyalaa|nyalah|nyale|nyaleq|nyalaq|nyalan|nyalane|nyle|nyaleh)\b/g, ' nyala '],
    [/\b(idup|hdup|iduq|hidupne|hdupne)\b/g, ' hidup '],
    [/\b(ngalir|mngalir|menggalir|mengalr|mengalirn|alirn)\b/g, ' mengalir '],
    [/\b(kluar|kelua|kluarr|keluaq|keluarq|metu|embet|embetn)\b/g, ' keluar '],
    [/\b(mat|mti|mate|matiq|matin)\b/g, ' mati '],
    [/\b(pipah|pipaq|pipaah|pipa2)\b/g, ' pipa '],
    [/\b(bocr|bocorr|bocorq|bocorne|rembes|rembesan)\b/g, ' bocor '],
    [/\b(krh|keru|keroh|putek|puteq|butek|butekne)\b/g, ' keruh '],
    [/\b(kcil|kcl|kecill|kodeq|kodek|kedik|kedek|cenik|cerik|kecit)\b/g, ' kecil '],
    [/\b(tekananx|tekananya|debitx|debitnya)\b/g, ' tekanan debit '],
    [/\b(meteran|mter|meternya|standmeter|standn)\b/g, ' meter stand meter '],

    // tagihan / status / informasi
    [/\b(tagihn|tagian|taghan|tagihannya|tagihanya|tagihann|tagiham)\b/g, ' tagihan '],
    [/\b(rekenig|rekeningg|rekning|rek)\b/g, ' rekening '],
    [/\b(naek|naikk|nambah|melonjaknya|bengkak|membengkak|mahl|mahalnya|beleq|belek|beloq)\b/g, ' naik mahal besar '],
    [/\b(stts|setatus|statusnya|progresnya|progressnya|progres|progress)\b/g, ' status progres '],
    [/\b(aduann|aduanya|laporann|laporanya|aduang|aduq)\b/g, ' aduan laporan '],
    [/\b(alamt|alamatnya|lokasix|lokasinya)\b/g, ' alamat lokasi '],
    [/\b(kantorx|kantorne|loketne|loketx)\b/g, ' kantor loket '],
    [/\b(tariff|tarip|tarifnya)\b/g, ' tarif '],
    [/\b(pasangx|pasangin|sambungn|sambungannya|sambunganx|anyar|baruq)\b/g, ' pasang sambungan baru '],

    // angka/durasi umum Sasak/typo
    [/\b(sekeq|saiq|sopoq|sopok)\b/g, ' 1 '],
    [/\b(due)\b/g, ' 2 '],
    [/\b(telu|telo)\b/g, ' 3 '],
    [/\b(jelo|jeloq|jelone)\b/g, ' hari ']
  ];

  for (var i = 0; i < typoRules.length; i++) {
    t = t.replace(typoRules[i][0], typoRules[i][1]);
  }

  // Fuzzy ringan untuk typo 1 huruf pada kata kunci layanan.
  // Aman karena hanya kamus layanan PDAM, bukan semua kata bebas.
  var dictionary = [
    'air','nyala','hidup','mengalir','keluar','mati','bocor','pipa','keruh','kecil','meter',
    'tagihan','rekening','status','aduan','laporan','alamat','kantor','loket','tarif','pasang','sambungan',
    'pelanggan','praya','pujut','kopang','jonggat','janapria','batukliang','pringgarata'
  ];
  var tokens = t.trim().split(/\s+/).map(function(tok) {
    if (!tok || tok.length < 3 || /^\d+$/.test(tok)) return tok;
    for (var d = 0; d < dictionary.length; d++) {
      var target = dictionary[d];
      if (tok === target) return tok;
      if (Math.abs(tok.length - target.length) <= 1 && customerTypoEditDistanceOne_(tok, target)) return target;
    }
    return tok;
  });

  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

function customerTypoEditDistanceOne_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  var i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a.charAt(i) === b.charAt(j)) { i++; j++; continue; }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function normalizeSasakLombokTengahText_(text) {
  var raw = String(text || '').toLowerCase();
  if (!raw) return '';
  var typoNorm = normalizeCustomerTypoText_(raw);

  var t = ' ' + (raw + ' ' + typoNorm)
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';

  var rules = [
    // Air/PDAM
    [/\b(aiq|aik|aim|aem|aeq|aieq|aiaq|aiqnya|aiknya|toto)\b/g, ' air '],
    [/\bledeng\b/g, ' air pdam '],

    // Tidak/ada/keluar/nyala
    [/\b(ndeq|ndek|endek|endeq|nendeq|ndak|ndaq|nda|dek)\b/g, ' tidak '],
    [/\b(ndaraq|ndarak|ndareq|ndarakne|ndaraqne)\b/g, ' tidak ada '],
    [/\b(araq|arak|ara)\b/g, ' ada '],
    [/\b(mate|matiq|matin)\b/g, ' mati '],
    [/\b(idup|iduq|hidupne)\b/g, ' hidup '],
    [/\b(nyale|nyalaq|nyalan|nyalane)\b/g, ' nyala '],
    [/\b(metu|keluaq|keluarq|tebete|tebeteq|embet|embetn)\b/g, ' keluar '],
    [/\b(ngalir|mengalirn|alirn)\b/g, ' mengalir '],

    // Keluhan teknis
    [/\b(bocorq|bocorne|rembes|rembesan|pipaq)\b/g, ' bocor pipa '],
    [/\b(kodeq|kodek|kedik|kedek|cenik|cerik|kecit)\b/g, ' kecil '],
    [/\b(beleq|belek|beloq)\b/g, ' besar mahal naik '],
    [/\b(putek|puteq|butek|butekne|keru)\b/g, ' keruh '],
    [/\b(bauq|baune)\b/g, ' bau '],
    [/\b(macetn|macetne)\b/g, ' macet '],

    // Waktu/lokasi/pertanyaan
    [/\b(piran|pirean|piraan|sekat|seket|seked)\b/g, ' kapan '],
    [/\b(jelo|jeloq|jelone)\b/g, ' hari '],
    [/\b(jamne|jamn)\b/g, ' jam '],
    [/\b(mbe|embe)\b/g, ' dimana '],
    [/\b(leq|lek|eleq)\b/g, ' di '],
    [/\b(kembe|kembeq|kembek|kenape|kenapo|ngumbe|ngumbeq)\b/g, ' kenapa kapan '],
    [/\b(napi|apiq)\b/g, ' apa '],

    // Pelanggan/lapor/tagihan/info
    [/\b(tiang|tiyang|akuq)\b/g, ' saya '],
    [/\b(side|pelungguh|kamuq)\b/g, ' anda '],
    [/\b(adu|ngadu|aduang|aduq)\b/g, ' lapor aduan '],
    [/\b(aji|ajine|biayaq|bayaraq|bayeq)\b/g, ' harga bayar tagihan '],
    [/\b(kantorne|loketne)\b/g, ' kantor loket '],
    [/\b(anyar|baruq)\b/g, ' baru '],

    // Angka yang sering muncul di keluhan durasi
    [/\b(sekeq|saiq|sopoq|sopok)\b/g, ' 1 '],
    [/\b(dua|due)\b/g, ' 2 '],
    [/\b(telu|telo)\b/g, ' 3 '],
    [/\b(pat|empat)\b/g, ' 4 '],
    [/\b(lime|lima)\b/g, ' 5 ']
  ];

  for (var i = 0; i < rules.length; i++) {
    t = t.replace(rules[i][0], rules[i][1]);
  }
  t = t.replace(/\s+/g, ' ').trim();

  // Kembalikan teks asli + bantuan typo/Sasak agar regex tetap aman
  // dan tidak kehilangan kata asli pelanggan.
  return (raw + ' ' + typoNorm + ' ' + t).replace(/\s+/g, ' ').trim();
}

function isSasakLombokTengahLikelyText_(text) {
  text = String(text || '').toLowerCase();
  return /\b(aiq|aik|aim|aem|aeq|aieq|aiaq|aer|aor|ayr|airr|toto|ndeq|ndek|endek|endeq|nendeq|ndaraq|ndarak|araq|arak|mate|nyale|nyla|nyalaa|nyalaq|metu|keluaq|kodeq|kodek|beleq|belek|putek|puteq|piran|sekat|seket|seked|jelo|mbe|embe|kembe|kembeq|kembek|leq|lek|ngumbe|napi|tiang|side|pelungguh|aduang|ajine|anyar|kpn|knp|blm|blom|tagihn|naek|stts)\b/i.test(text);
}

function isCustomerVirtualAssistantEnabled_() {
  var cfg = getSharedAiConfig_();
  return !!(cfg.customerEnabled && cfg.apiKey);
}

function shouldInvokeCustomerVirtualAssistant_(message, phone, payload, session) {
  message = String(message || '').trim();
  var hasMediaOrLocation = false;
  try { hasMediaOrLocation = hasIncomingWhatsAppMediaOrLocation_(payload || {}); } catch(eMediaCheck) { hasMediaOrLocation = false; }

  var lower = message.toLowerCase();
  var state = String(session && session.state || '').toUpperCase();

  // V10.9.276 - FIX SHARE LOCATION ADUAN:
  // Media/lokasi hanya boleh dilempar ke AI jika pelanggan berada di menu awal.
  // Saat sedang FAST_LOKASI / FAST_CONFIRM / NEW_LOKASI, share location harus diproses oleh alur aduan,
  // bukan dijawab AI dengan pesan "Foto/media sudah diterima".
  if (state && state !== 'MAIN') return false;

  if (!message && !hasMediaOrLocation) return false;
  if (hasMediaOrLocation) return true;

  // Perintah tegas tetap diproses sistem, bukan AI.
  if (/^[1-9]$/.test(lower)) return false;
  if (lower === 'menu' || lower === 'menu utama' || lower === 'home' || lower === 'mulai' || lower === 'start' || lower === '/start') return false;
  if (lower === 'batal' || lower === 'cancel' || lower === 'reset' || lower === 'ulang') return false;
  if (lower === 'admin' || lower === 'cs' || lower === 'operator' || lower.indexOf('hubungi admin') !== -1 || lower.indexOf('chat admin') !== -1 || lower.indexOf('butuh admin') !== -1 || lower.indexOf('minta admin') !== -1 || lower.indexOf('customer service') !== -1) return false;
  if (isCekTagihanCommand_(lower) || isFastAduanCommand_(lower)) return false;
  if (extractAduanId_(message)) return false;
  if (lower === 'status' || lower === 'cek' || lower === 'cek status' || lower === 'cek status aduan' || lower === 'riwayat' || lower === 'lihat') return false;

  // Teks bebas seperti "air mati", "tagihan naik", "halo min", atau pesan asal diarahkan oleh asisten.
  return true;
}

function buildCustomerVirtualAssistantMenuButtons_(primary, count) {
  var buttons = [];
  primary = String(primary || '').toUpperCase();
  count = Number(count || 0) || 0;

  // Tombol AI pelanggan dibuat kontekstual, bukan selalu Menu Utama saja.
  // Maksimal 3 tombol sesuai batas reply button WhatsApp.
  if (primary === 'ADUAN') buttons.push({ id: 'MENU_2_ADUAN_CEPAT', title: 'Buat Aduan' });
  if (primary === 'STATUS') buttons.push({ id: 'MENU_2_STATUS', title: 'Cek Status' });
  if (primary === 'TAGIHAN') buttons.push({ id: 'MENU_4_CEK_TAGIHAN', title: 'Cek Tagihan' });
  if (primary === 'INFO') buttons.push({ id: 'MENU_5_INFO_LAYANAN', title: 'Info Layanan' });

  // Hubungi Admin hanya muncul jika pelanggan sudah 2x tidak jelas/bingung.
  if (count >= 2) buttons.push({ id: 'PAY_ADMIN', title: 'Hubungi Admin' });

  buttons.push({ id: 'NAV_MENU', title: 'Menu Utama' });

  // Hapus duplikat dan batasi maksimal 3 tombol.
  var seen = {};
  var out = [];
  buttons.forEach(function(btn) {
    var id = String(btn && btn.id || '');
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push(btn);
  });
  return out.slice(0, 3);
}

function inferCustomerVirtualAssistantPrimary_(message, payload) {
  message = String(message || '');
  try {
    if (hasIncomingWhatsAppMediaOrLocation_(payload || {})) return 'ADUAN';
  } catch(e) {}
  if (isCustomerVirtualAssistantAduanHelpText_(message)) return 'ADUAN';
  if (isCustomerVirtualAssistantGangguanText_(message)) return 'ADUAN';
  if (isCustomerVirtualAssistantStatusText_(message)) return 'STATUS';
  if (isCustomerVirtualAssistantTagihanText_(message)) return 'TAGIHAN';
  if (isCustomerVirtualAssistantInfoText_(message)) return 'INFO';
  return '';
}

function isCustomerVirtualAssistantIdentityQuestion_(text) {
  text = normalizeSasakLombokTengahText_(text).toLowerCase();
  return text.indexOf('kamu siapa') !== -1 ||
         text.indexOf('anda siapa') !== -1 ||
         text.indexOf('siapa kamu') !== -1 ||
         text.indexOf('siapa ini') !== -1 ||
         text.indexOf('ini siapa') !== -1 ||
         text.indexOf('bot apa') !== -1 ||
         text.indexOf('tiara itu apa') !== -1 ||
         text.indexOf('siaga tiara itu apa') !== -1;
}

function isCustomerVirtualAssistantGreetingOnly_(text) {
  text = String(text || '').toLowerCase().replace(/[!?.]/g, '').replace(/\s+/g, ' ').trim();
  return text === 'halo' || text === 'hallo' || text === 'hai' || text === 'hi' ||
         text === 'min' || text === 'admin' || text === 'permisi' ||
         text === 'pagi' || text === 'siang' || text === 'sore' || text === 'malam' ||
         text === 'assalamualaikum' || text === 'assalamu alaikum';
}

function isCustomerVirtualAssistantAffirmationOnly_(text) {
  text = String(text || '').toLowerCase().replace(/[!?.]/g, '').replace(/\s+/g, ' ').trim();
  return text === 'sudah benar' || text === 'benar' || text === 'sudah' || text === 'sesuai' ||
         text === 'sudah sesuai' || text === 'iya' || text === 'ya' || text === 'ok' || text === 'oke' ||
         text === 'lanjut' || text === 'bisa' || text === 'betul';
}

function isCustomerVirtualAssistantThanksOnly_(text) {
  text = String(text || '').toLowerCase().replace(/[!?.]/g, '').replace(/\s+/g, ' ').trim();
  return text === 'terima kasih' || text === 'terimakasih' || text === 'makasih' || text === 'thanks' || text === 'thank you';
}

function isCustomerVirtualAssistantGangguanText_(text) {
  text = normalizeSasakLombokTengahText_(text).toLowerCase();
  if (!text) return false;

  // Tangkap bahasa pelanggan yang natural, misalnya:
  // "kenapa udah 3 hari belom nyala praya ini", "air belum hidup", "air tidak keluar".
  var gangguanPattern = /air\s*(mati|tidak\s*ada|tidak\s*mengalir|tidak\s*hidup|tidak\s*keluar|belum\s*mengalir|belom\s*mengalir|belum\s*nyala|belom\s*nyala|belum\s*hidup|belom\s*hidup|nggak\s*mengalir|gak\s*mengalir|ga\s*mengalir|nggak\s*keluar|gak\s*keluar|ga\s*keluar|kecil|keruh|bau|kuning|hitam|macet)|mati\s*air|airnya\s*(mati|belum|belom|nggak|gak|ga|tidak)|tidak\s*ada\s*air|air\s*tidak\s*ada|pipa|bocor|tekanan|meter\s*(rusak|bermasalah)|gangguan|ledeng|kran/i;
  if (gangguanPattern.test(text)) return true;

  var serviceComplaintPattern = /\b(belum|belom|nggak|gak|ga|tidak|tak)\b\s*(nyala|hidup|mengalir|keluar|normal)|(?:udah|sudah)\s*\d+\s*(hari|jam|minggu)\s*(belum|belom|nggak|gak|ga|tidak|tak)|\b(nyala|hidup|mengalir|keluar)\b\s*(belum|belom|nggak|gak|ga|tidak|tak)|\bmati\b\s*(total|semua|lagi)?|\bkapan\s*air\s*(nyala|hidup|mengalir|keluar|normal)|\bkapan\s*(nyala|hidup|mengalir|keluar|normal)\s*air|\b(nyala|hidup|mengalir|keluar|normal)\s*air\s*kapan|\bair\s*(nyala|hidup|mengalir|keluar|normal)?\s*kapan/i;
  if (serviceComplaintPattern.test(text)) return true;

  // V10.9.224: pola bebas Indonesia/Sasak Lombok Tengah.
  // Contoh: "kembe sekat nyale aik", "piran nyale aim",
  // "kapan nyala air di batuson ini".
  var hasAirWord = /\b(air|aik|aiq|aim|aem|aeq|aer|aor|ayr|airr|ledeng|pdam)\b/i.test(text);
  var hasGangguanSignal = /\b(kapan|kenapa|nyala|hidup|mengalir|keluar|mati|belum|belom|tidak|nggak|gak|ga|blm|blom|kpn|knp|ndeq|ndek|kecil|keruh|bocor|tekanan|gangguan|sekat|seket|seked)\b/i.test(text);
  if (hasAirWord && hasGangguanSignal) return true;

  // Jika ada nama cabang/wilayah + keluhan umum, perlakukan sebagai gangguan air, bukan di luar konteks.
  var hasCabang = /(praya|pujut|jonggat|kopang|janapria|batukliang|pringgarata)/i.test(text);
  var hasComplaintTone = /(kenapa|kok|lama|hari|jam|nyala|hidup|mati|keluar|mengalir|kecil|keruh|bocor)/i.test(text);
  if (hasCabang && hasComplaintTone) return true;

  return false;
}

function isCustomerVirtualAssistantTagihanText_(text) {
  text = normalizeSasakLombokTengahText_(text);
  if (/tagihan|rekening|bayar|pembayaran|nominal|tunggakan|stand\s*meter|angka\s*meter|harga/i.test(text)) return true;
  if (/(tagihan|rekening|harga|air|meter).*(mahal|naik|melonjak|besar)/i.test(text)) return true;
  if (/(mahal|naik|melonjak|besar).*(tagihan|rekening|harga|air|meter)/i.test(text)) return true;
  return false;
}

function isCustomerVirtualAssistantStatusText_(text) {
  text = normalizeSasakLombokTengahText_(text);
  return /status|progres|progress|cek\s*aduan|cek\s*laporan|aduan\s*saya|laporan\s*saya|lapor\s*aduan\s*saya|tiket|id\s*aduan|sudah\s*ditangani|sudah\s*dikerjakan|belum\s*(ditangani|dikerjakan|direspon|diproses|selesai)|belom\s*(ditangani|dikerjakan|direspon|diproses|selesai)|aduan.*(belum|belom|tidak|gak|ga|nggak).*(dikerjakan|ditangani|direspon|diproses|selesai)|laporan.*(belum|belom|tidak|gak|ga|nggak).*(dikerjakan|ditangani|direspon|diproses|selesai)|mana\s*(kejelasan|progres|status|tindak\s*lanjut)|sampai\s*sekarang.*(aduan|laporan|dikerjakan|ditangani)|foto\s*(respon|selesai|bukti)/i.test(text);
}

function isCustomerVirtualAssistantInfoText_(text) {
  text = normalizeSasakLombokTengahText_(text);
  return /jadwal|jam\s*(buka|operasional|kerja)|alamat|kantor|loket|layanan|tarif|sambungan\s*baru|pasang\s*baru|pemasangan|balik\s*nama|pindah\s*meter|air\s*tangki|sambung\s*kembali|cara\s*bayar|dimana\s*(kantor|loket)|(kantor|loket).*dimana/i.test(text);
}

function isCustomerVirtualAssistantFeatureQuestion_(text) {
  text = normalizeSasakLombokTengahText_(text).toLowerCase();
  if (!text) return false;

  // Pertanyaan umum seperti “fiturnya apa saja?” atau “bantu saya”
  // jangan dibalas opening menu polos. AI tetap menjawab dulu, lalu tampilkan menu interaktif.
  return /\b(fitur|fiturnya|menu|layanan|bantuan|bantu\s*saya|bantu|tolong\s*saya|tolong|bisa\s*bantu|mau\s*tanya|ingin\s*tanya|nanya|tanya|butuh\s*bantuan|apa\s*saja|apa\s*aja|bisa\s*apa|cara\s*pakai|cara\s*gunakan|panduan|arahin|arahkan|bingung|gimana\s*ini|bagaimana\s*ini)\b/i.test(text) &&
         !isCustomerVirtualAssistantGangguanText_(text) &&
         !isCustomerVirtualAssistantTagihanText_(text) &&
         !isCustomerVirtualAssistantStatusText_(text);
}


// V10.9.232:
// Pesan lanjutan seperti "saya tidak paham cara mengisinya" harus dipahami
// sebagai kebutuhan bantuan penggunaan menu, bukan dianggap di luar konteks.
function isCustomerVirtualAssistantAduanHelpText_(text) {
  text = normalizeSasakLombokTengahText_(text).toLowerCase();
  if (!text) return false;

  var asksHow = /\b(cara|gimana|bagaimana|bantu|tolong|bingung|tidak\s*paham|nggak\s*paham|gak\s*paham|ga\s*paham|kurang\s*paham|belum\s*paham|belom\s*paham|ndak\s*paham|ndeq\s*paham|ajari|contoh|format|isi|mengisi|ngisi|isikan|pengisian|data|datanya|isian|apa\s*saja|apa\s*aja|butuh|perlu|syarat|lengkapi|melengkapi)\b/i.test(text);
  var aboutAduan = /\b(aduan|pengaduan|laporan|lapor|keluhan|gangguan|air|pdam|tiara|siaga|menu|tombol|form|datanya|mengisinya|isinya)\b/i.test(text);

  // Jika pelanggan baru saja diberi tahap Buat Aduan, kalimat "cara mengisinya" biasanya
  // merujuk ke format pengaduan. Jangan jawab tidak paham.
  if (asksHow && aboutAduan) return true;
  if (/\b(saya|aku|tiang)\b.*\b(tidak|nggak|gak|ga|belum|belom)\b.*\b(paham|mengerti)\b.*\b(cara|isi|mengisi|ngisi|datanya|form)\b/i.test(text)) return true;
  return false;
}

function isCustomerVirtualAssistantClearlyOutsideContext_(text) {
  var originalTextForOutside = String(text || '').toLowerCase();
  text = normalizeSasakLombokTengahText_(text).toLowerCase();
  if (!text) return false;
  if (isCustomerVirtualAssistantIdentityQuestion_(text) || isCustomerVirtualAssistantGreetingOnly_(text) || isCustomerVirtualAssistantThanksOnly_(text)) return false;
  if (isCustomerVirtualAssistantAduanHelpText_(text) || isCustomerVirtualAssistantFeatureQuestion_(text) || isCustomerVirtualAssistantGangguanText_(text) || isCustomerVirtualAssistantTagihanText_(text) || isCustomerVirtualAssistantStatusText_(text) || isCustomerVirtualAssistantInfoText_(text)) return false;

  // Di luar konteks = benar-benar bukan layanan air/PDAM/SIAGA TIARA,
  // misalnya matematika, coding, resep, game, politik, hiburan, dll.
  var outsideWords = [
    'resep', 'masak', 'game', 'film', 'lagu', 'musik', 'cuaca', 'berita', 'politik', 'bola',
    'coding', 'kode', 'script', 'program', 'javascript', 'python', 'api', 'model ai', 'gpt',
    'matematika', 'hitung', 'rumus', 'soal', 'pacar', 'jodoh', 'utang', 'pinjaman', 'promo',
    'jualan', 'bitcoin', 'crypto', 'saham', 'anime', 'drama korea'
  ];
  for (var i = 0; i < outsideWords.length; i++) {
    if (originalTextForOutside.indexOf(outsideWords[i]) !== -1 || text.indexOf(outsideWords[i]) !== -1) return true;
  }

  // Pesan sangat random seperti "asdf" tetap tidak dipahami, tetapi jangan memblokir
  // keluhan natural yang memuat wilayah, hari/jam, nyala/hidup/mengalir, dll.
  if (text.length <= 18 && !/(air|pdam|perumda|tiara|siaga|cabang|pelanggan|rekening|meter|tagihan|aduan|laporan|layanan|praya|pujut|kopang|jonggat|janapria|batukliang|pringgarata|nyala|hidup|mati)/i.test(text)) return true;
  return false;
}

function buildCustomerVirtualAssistantUnknownReply_(count) {
  var lines = [
    'Saya bantu arahkan ke layanan yang sesuai.',
    'Silakan pilih menu SIAGA TIARA di bawah ini, atau tuliskan kebutuhan layanan air seperti *air mati*, *cek status aduan*, *cek tagihan*, atau *info layanan*. 🙏🏻'
  ];
  if (Number(count || 1) >= 2) lines.push('', 'Jika masih bingung, tersedia pilihan *Hubungi Admin*.');
  return lines.join('\n');
}


function getCustomerVirtualAssistantIssueLabel_(message) {
  var text = normalizeSasakLombokTengahText_(message).toLowerCase();
  if (/bocor|pipa|pecah|rembes/i.test(text)) return 'kebocoran pipa/air';
  if (/keruh|bau|kuning|hitam|kotor|berpasir|berlumpur/i.test(text)) return 'kualitas air';
  if (/kecil|tekanan|debit|pelan|lemah/i.test(text)) return 'debit/tekanan air kecil';
  if (/meter\s*(rusak|bermasalah|mati|macet)|stand\s*meter/i.test(text)) return 'meter air';
  if (/mati|nyala|hidup|mengalir|keluar|normal|macet/i.test(text)) return 'air tidak mengalir/belum normal';
  return 'gangguan layanan air';
}

function buildCustomerVirtualAssistantOpening_() {
  return [
    'Halo, Bapak/Ibu! 🙂',
    'Saya *TIARA*, Asisten Virtual *PERUMDA Tirta Ardhia Rinjani*. Siap membantu!'
  ].join('\n');
}


// V10.9.223:
// Perkenalan TIARA hanya tampil sekali per nomor per hari.
// Tujuannya agar AI tetap resmi di awal, tetapi tidak terasa berulang setiap pelanggan bertanya.
function getCustomerVirtualAssistantIntroKey_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) phone = 'UNKNOWN';
  var tz = 'Asia/Makassar';
  try { tz = Session.getScriptTimeZone() || tz; } catch(eTz) {}
  var day = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  return 'CUSTOMER_AI_INTRO_SHOWN_' + phone + '_' + day;
}

function hasCustomerVirtualAssistantIntroShown_(phone) {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(getCustomerVirtualAssistantIntroKey_(phone)) || '') === 'YA';
  } catch(e) {
    return false;
  }
}

function markCustomerVirtualAssistantIntroShown_(phone) {
  try {
    PropertiesService.getScriptProperties().setProperty(getCustomerVirtualAssistantIntroKey_(phone), 'YA');
  } catch(e) {}
}

function stripCustomerVirtualAssistantOpening_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  // Hapus variasi pembuka resmi yang biasa muncul di jawaban AI pelanggan.
  text = sanitizeCustomerVirtualAssistantOrganization_(text)
    .replace(/^Halo[,!\s]*(Bapak\/Ibu|Bapak|Ibu|Kakak|Kak)?[.!👋🙂\s]*\n\s*Saya\s+\*?TIARA\*?\s*,?\s*Asisten Virtual\s+\*?PERUMDA Tirta Ardhia Rinjani\*?\.?\s*(Siap membantu!?)?\s*\n*/i, '')
    .replace(/^Halo[,!\s]*(Bapak\/Ibu|Bapak|Ibu|Kakak|Kak)?[.!👋🙂\s]*\n+/i, '')
    .replace(/^Saya\s+\*?TIARA\*?\s*,?\s*Asisten Virtual\s+\*?PERUMDA Tirta Ardhia Rinjani\*?\.?\s*(Siap membantu!?)?\s*\n*/i, '')
    .replace(/^Perkenalkan[,!\s]*saya\s+\*?TIARA\*?[^.\n]*\.?\s*\n*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

function customerVirtualAssistantReplyHasIntro_(text) {
  text = String(text || '');
  return /Saya\s+\*?TIARA\*?\s*,?\s*Asisten Virtual|Perkenalkan\s+.*TIARA/i.test(text);
}

function applyCustomerVirtualAssistantIntroOnce_(phone, reply) {
  reply = String(reply || '').trim();
  if (!reply) return '';

  if (hasCustomerVirtualAssistantIntroShown_(phone)) {
    return stripCustomerVirtualAssistantOpening_(reply) || reply;
  }

  if (customerVirtualAssistantReplyHasIntro_(reply)) {
    markCustomerVirtualAssistantIntroShown_(phone);
  }
  return reply;
}

function buildCustomerVirtualAssistantGangguanReply_(message) {
  message = String(message || '');
  var cabangText = '';
  try {
    var inferredCabang = inferCabangByWilayah_(message);
    if (inferredCabang && inferredCabang !== 'Cabang Lainnya') cabangText = ' di *' + inferredCabang + '*';
  } catch(eCabang) {}
  var issueLabel = getCustomerVirtualAssistantIssueLabel_(message);

  return [
    buildCustomerVirtualAssistantOpening_(),
    '',
    'Kami memahami keluhan Bapak/Ibu terkait *' + issueLabel + '*' + cabangText + '. Mohon maaf atas ketidaknyamanannya. 🙏🏻',
    '',
    'Agar laporan dapat segera diproses, silakan pilih tombol *Buat Aduan* lalu lengkapi data berikut:',
    '1. *Nama pelanggan*',
    '2. *Nomor ID Pelanggan*',
    '3. *Alamat lengkap/lokasi patokan*',
    '4. *Keterangan gangguan* (misal: air mati, kecil, keruh, bocor, meter bermasalah, dll.)',
    '5. *Sejak kapan gangguan terjadi*',
    '',
    'Setelah aduan masuk, petugas cabang akan menindaklanjuti laporan Bapak/Ibu.'
  ].join('\n');
}


function buildCustomerVirtualAssistantAduanHelpReply_(message) {
  return [
    buildCustomerVirtualAssistantOpening_(),
    '',
    'Bisa, saya bantu. Untuk membuat pengaduan, pilih tombol *Buat Aduan* lalu isi data dengan sederhana dan jelas.',
    '',
    'Contoh format yang bisa ditulis:',
    '*Nama:* Ari',
    '*No Pelanggan:* 12345677',
    '*Keluhan:* air mati sudah 3 hari',
    '*Lokasi/Patokan:* pinggir jalan dekat kantor desa',
    '*Cabang/Wilayah:* Cabang Praya',
    '',
    'Setelah data dikirim, sistem akan membuat *ID Aduan* dan meneruskan laporan ke petugas cabang.'
  ].join('\n');
}

function buildCustomerVirtualAssistantTagihanReply_(message) {
  return [
    buildCustomerVirtualAssistantOpening_(),
    '',
    'Untuk pertanyaan terkait *tagihan/rekening air*, Bapak/Ibu dapat mengecek melalui menu resmi *Cek Tagihan*.',
    '',
    'Silakan pilih tombol *Cek Tagihan*, lalu masukkan *Nomor ID Pelanggan* sesuai lembar tagihan.',
    '',
    'Jika setelah dicek masih ada perbedaan data, Bapak/Ibu dapat melanjutkan laporan melalui menu yang tersedia.'
  ].join('\n');
}

function buildCustomerVirtualAssistantStatusReply_(message) {
  return [
    buildCustomerVirtualAssistantOpening_(),
    '',
    'Dari pesan Bapak/Ibu, saya memahami bahwa Bapak/Ibu ingin mengetahui *progres/status pengerjaan* yang sedang berjalan.',
    '',
    'Untuk mengecek status pengerjaan, silakan gunakan menu resmi *SIAGA TIARA* berikut. Bapak/Ibu juga bisa langsung mengirim *No Pelanggan / ID Aduan* setelah pesan ini:',
    '',
    '---',
    '',
    '📋 *CEK STATUS PENGADUAN*',
    '',
    'Menu ini dapat digunakan untuk melacak sampai di mana proses pengerjaan atas pengaduan atau permohonan layanan yang telah Bapak/Ibu ajukan sebelumnya.',
    '',
    'Mohon siapkan informasi berikut agar proses pengecekan lebih cepat:',
    '✅ *Nomor Pelanggan / ID Pelanggan*',
    '✅ *Nomor Tiket Pengaduan* (jika ada)',
    '',
    '---',
    '',
    'Silakan pilih tombol *Cek Status Aduan*, atau langsung kirim *No Pelanggan / ID Aduan* setelah pesan ini.',
    '',
    'Apakah ada hal lain yang bisa TIARA bantu?'
  ].join('\n');
}

function buildCustomerVirtualAssistantInfoReply_(message) {
  return [
    buildCustomerVirtualAssistantOpening_(),
    '',
    'Untuk informasi layanan seperti jam operasional, alamat kantor, tarif, pembayaran, atau sambungan baru, silakan pilih tombol *Info Layanan*.',
    '',
    'Setelah itu pilih topik informasi yang dibutuhkan dari menu SIAGA TIARA.'
  ].join('\n');
}

function buildCustomerVirtualAssistantFeatureMenuReply_(message) {
  return [
    'Bisa, saya bantu. Melalui SIAGA TIARA, Bapak/Ibu dapat menggunakan layanan berikut:',
    '',
    '1. *Buat Aduan* - lapor gangguan air seperti air mati, keruh, kecil, pipa bocor, atau meter bermasalah.',
    '2. *Cek Status Aduan* - melihat progres laporan yang sudah dibuat.',
    '3. *Cek Tagihan* - mengecek informasi tagihan air berdasarkan nomor pelanggan.',
    '4. *Info Layanan* - melihat informasi jam layanan, alamat kantor, tarif, dan layanan lainnya.',
    '',
    'Silakan tekan tombol *Pilih Layanan* di bawah ini, atau balas dengan angka *1 / 2 / 3 / 4*.'
  ].join('\n');
}

function buildCustomerVirtualAssistantDirectReply_(message, count, payload) {
  message = String(message || '').trim();
  count = Number(count || 1) || 1;
  var lower = message.toLowerCase();
  var hasMedia = false;
  try { hasMedia = hasIncomingWhatsAppMediaOrLocation_(payload || {}); } catch(e) { hasMedia = false; }

  if (hasMedia) {
    return {
      reply: [
        buildCustomerVirtualAssistantOpening_(),
        '',
        'Foto/media sudah diterima.',
        'Jika media tersebut terkait gangguan layanan air, silakan pilih tombol *Buat Aduan* agar laporan tercatat dan dapat ditindaklanjuti.'
      ].join('\n'),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('ADUAN', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantAduanHelpText_(message)) {
    return {
      reply: buildCustomerVirtualAssistantAduanHelpReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('ADUAN', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantFeatureQuestion_(message)) {
    return {
      reply: buildCustomerVirtualAssistantFeatureMenuReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      interactiveMenu: true,
      includeAdmin: count >= 2,
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantIdentityQuestion_(message)) {
    return {
      reply: [
        'Saya *TIARA*, asisten virtual SIAGA TIARA untuk layanan PERUMDA Tirta Ardhia Rinjani.',
        'Ketik *menu* untuk melihat layanan.'
      ].join('\n'),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantGreetingOnly_(message)) {
    return {
      reply: 'Halo 🙂\nSilakan pilih layanan SIAGA TIARA berikut.',
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      interactiveMenu: true,
      includeAdmin: false,
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantThanksOnly_(message)) {
    return {
      reply: 'Sama-sama 🙂',
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantAffirmationOnly_(message)) {
    return {
      reply: buildCustomerVirtualAssistantUnknownReply_(count),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      interactiveMenu: true,
      includeAdmin: count >= 2,
      adminAfterThird: true
    };
  }

  if (isCustomerVirtualAssistantGangguanText_(message)) {
    return {
      reply: buildCustomerVirtualAssistantGangguanReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('ADUAN', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantStatusText_(message)) {
    return {
      reply: buildCustomerVirtualAssistantStatusReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('STATUS', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantTagihanText_(message)) {
    return {
      reply: buildCustomerVirtualAssistantTagihanReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('TAGIHAN', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantInfoText_(message)) {
    return {
      reply: buildCustomerVirtualAssistantInfoReply_(message),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('INFO', count),
      adminAfterThird: false
    };
  }

  if (isCustomerVirtualAssistantClearlyOutsideContext_(message)) {
    return {
      reply: buildCustomerVirtualAssistantUnknownReply_(count),
      navButtons: buildCustomerVirtualAssistantMenuButtons_('', count),
      interactiveMenu: true,
      includeAdmin: count >= 2,
      adminAfterThird: true
    };
  }

  return null;
}

function handleCustomerVirtualAssistantFreeText_(message, phone, payload, session) {
  phone = normalizePhone_(phone || '');
  message = String(message || '').trim();
  payload = payload || {};
  session = session || { state: 'MAIN', data: {} };

  if (!shouldInvokeCustomerVirtualAssistant_(message, phone, payload, session)) return null;

  // Jika API AI belum aktif/mati, jangan ubah perilaku lama.
  // Handler akan lanjut ke fallback menu otomatis seperti versi sebelumnya.
  if (!isCustomerVirtualAssistantEnabled_()) return null;

  var stateKey = 'MAIN_VIRTUAL_ASSISTANT';
  var count = getCustomerInvalidInputCounter_(phone, stateKey) + 1;
  setCustomerInvalidInputCounter_(phone, count, stateKey);
  if (count > 3) count = 3;

  // V10.9.223: sebelum memanggil AI, jawab deterministik untuk pelanggan.
  // Semua pertanyaan layanan PDAM yang dikenali diarahkan ke menu resmi: Buat Aduan/Cek Status/Cek Tagihan/Info Layanan.
  // Keluhan gangguan air memakai gaya resmi: salam, perkenalan singkat, penjelasan, lalu tahap Buat Aduan.
  var direct = buildCustomerVirtualAssistantDirectReply_(message, count, payload);
  if (direct && direct.reply) {
    var directReply = normalizeVirtualAssistantReply_(direct.reply);
    directReply = applyCustomerVirtualAssistantIntroOnce_(phone, directReply);
    if (count >= 2) resetCustomerInvalidInputCounter_(phone, stateKey);

    // V10.9.227:
    // Jika AI mengarahkan ke Cek Status Aduan, jangan set session ke MAIN.
    // Buat pelanggan bisa langsung mengirim No Pelanggan / ID Aduan tanpa harus menekan tombol Cek Status dulu.
    var directPrimary = inferCustomerVirtualAssistantPrimary_(message, payload);
    if (directPrimary === 'STATUS') {
      setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'AI_STATUS_DIRECT', allowNoPelanggan: true });
    } else {
      setWhatsAppSession_(phone, 'MAIN', {});
    }

    try { logWhatsApp_(phone, message, 'AI_PELANGGAN_ASISTEN_VIRTUAL_DIRECT', '', directReply, 'SUCCESS', JSON.stringify({ count: count, direct: true, primary: directPrimary })); } catch(eDirectLog) {}
    return {
      success: true,
      type: 'CUSTOMER_VIRTUAL_ASSISTANT_DIRECT_REPLY',
      reply: directReply,
      navButtons: direct.navButtons || buildCustomerVirtualAssistantMenuButtons_(directPrimary, count),
      interactiveMenu: !!direct.interactiveMenu,
      includeAdmin: !!direct.includeAdmin
    };
  }

  var aiReply = '';
  var aiError = '';
  var mediaNote = hasIncomingWhatsAppMediaOrLocation_(payload) ? 'Pelanggan mengirim media/foto/lokasi, bukan teks biasa.' : '';
  var customerPrompt = buildCustomerVirtualAssistantUserPrompt_(message, count, mediaNote);
  var res = callSharedAiMessages_([
    { role: 'user', content: customerPrompt }
  ], {
    system: buildCustomerVirtualAssistantSystemPrompt_(count, mediaNote),
    maxTokens: 120,
    temperature: 0
  });
  if (res && res.success) aiReply = normalizeVirtualAssistantReply_(res.text);
  else aiError = res && res.error ? res.error : 'AI gagal menjawab.';

  // Jika API error/timeout/limit, jangan memaksa jawaban AI.
  // Biarkan sistem kembali ke menu lama.
  if (!aiReply) {
    resetCustomerInvalidInputCounter_(phone, stateKey);
    return null;
  }

  // V10.9.219: pelanggan harus dipagari. Jika provider/model menjawab terlalu luas,
  // membuat menu baru, atau keluar dari layanan PDAM, pakai jawaban aman berbasis maksud pelanggan.
  aiReply = enforceCustomerVirtualAssistantScope_(aiReply, message, count, payload);
  aiReply = applyCustomerVirtualAssistantIntroOnce_(phone, aiReply);

  if (count < 3) aiReply = stripAdminSuggestionBeforeThird_(aiReply);

  if (count >= 2) {
    resetCustomerInvalidInputCounter_(phone, stateKey);
    if (aiReply.toLowerCase().indexOf('hubungi admin') === -1 && buildCustomerVirtualAssistantUnknownReply_(count).toLowerCase().indexOf('hubungi admin') !== -1) {
      aiReply += '\n\nJika masih bingung, silakan ketik *Hubungi Admin*.';
    }
  }

  // V10.9.227:
  // Untuk jawaban AI non-deterministik yang tetap mengarah ke Cek Status Aduan,
  // buka sesi tunggu input agar pelanggan bisa langsung mengirim No Pelanggan / ID Aduan.
  var aiPrimary = inferCustomerVirtualAssistantPrimary_(message, payload);
  if (aiPrimary === 'STATUS') {
    setWhatsAppSession_(phone, 'AWAIT_ID', { source: 'AI_STATUS_REPLY', allowNoPelanggan: true });
  } else {
    setWhatsAppSession_(phone, 'MAIN', {});
  }
  try { logWhatsApp_(phone, message, 'AI_PELANGGAN_ASISTEN_VIRTUAL', '', aiReply, aiError ? 'FALLBACK' : 'SUCCESS', JSON.stringify({ count: count, error: aiError || '', primary: aiPrimary })); } catch(eLog) {}

  // V10.9.235: untuk pertanyaan random/umum yang tidak masuk kategori khusus,
  // AI tetap menjawab lalu sistem menampilkan list *Pilih Layanan*.
  var showInteractiveMenu = !aiPrimary || isCustomerVirtualAssistantFeatureQuestion_(message) || isCustomerVirtualAssistantClearlyOutsideContext_(message);
  return {
    success: true,
    type: aiError ? 'CUSTOMER_VIRTUAL_ASSISTANT_FALLBACK' : 'CUSTOMER_VIRTUAL_ASSISTANT_REPLY',
    reply: aiReply,
    navButtons: buildCustomerVirtualAssistantMenuButtons_(aiPrimary, count),
    interactiveMenu: !!showInteractiveMenu,
    includeAdmin: count >= 2 && !!showInteractiveMenu
  };
}

function buildCustomerVirtualAssistantSystemPrompt_(count, mediaNote) {
  count = Number(count || 1) || 1;
  var canSuggestAdmin = count >= 2;
  return [
    'Kamu adalah TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani untuk pelanggan WhatsApp SIAGA TIARA.',
    'Identitas resmi wajib: PERUMDA Tirta Ardhia Rinjani Kabupaten Lombok Tengah. Dilarang keras menyebut PDAM Giri Menang, Tirta Giri Menang, Lombok Barat, atau nama PDAM lain.',
    'Jawaban harus sopan, jelas, dan tidak bertele-tele. Untuk keluhan gangguan air boleh lebih dari 3 baris agar tahap pengaduan lengkap.',
    'Pahami pesan pelanggan dalam Bahasa Indonesia, typo umum, singkatan chat, dan Bahasa Sasak Lombok Tengah yang umum dipakai pelanggan. Jawaban tetap memakai Bahasa Indonesia resmi.',
    '',
    'Menu resmi yang boleh disebut hanya ini:',
    '1. Buat Aduan - gangguan air, pipa bocor, air mati/belum nyala, air keruh, tekanan kecil, meter bermasalah.',
    '2. Cek Status Aduan - melihat progres laporan/aduan yang sudah dibuat.',
    '3. Cek Tagihan - tagihan, rekening air, pembayaran, nominal.',
    '4. Info Layanan - jam operasional, alamat kantor, tarif, pemasangan/sambungan, balik nama, pindah meter, air tangki.',
    '',
    'Aturan wajib:',
    '- Untuk semua keluhan teknis layanan air seperti air belum nyala/hidup/mengalir/keluar, air mati, pipa bocor, air keruh, air kecil, tekanan lemah, meter bermasalah, atau menyebut wilayah/cabang seperti Praya + keluhan, jawab dengan pola: salam pembuka singkat, perkenalan TIARA singkat, minta maaf/beri penjelasan, lalu arahkan ke tombol/angka *Buat Aduan* dengan tahap data: nama, nomor pelanggan, alamat/lokasi patokan, keterangan gangguan, sejak kapan.',
    '- Jangan langsung menjawab tidak paham untuk pertanyaan/keluhan layanan PDAM yang ditulis natural, misalnya "kenapa udah 3 hari belom nyala praya ini", "kpn nyla air", "aiir blm idup", "air keruh di rumah", "pipa bocor", "tagihn naek", "status aduan saya", atau Bahasa Sasak Lombok Tengah seperti "aiq ndeq araq", "aik mate", "piran aik nyala", "piran nyale aim", "kembe sekat nyale aik", "tagihan belek".',
    '- Jika pelanggan bertanya lanjutan seperti "saya tidak paham cara mengisinya", "gimana cara isi aduan", "bisa bantu isi", "formatnya gimana", atau "bingung mengisi data", pahami sebagai bantuan *Buat Aduan* dan beri contoh format pengisian. Jangan jawab tidak paham.',
    '- Jika pelanggan bertanya umum atau random seperti "fiturnya apa saja", "bantu saya", "saya mau tanya", "tolong", "bingung", "gimana ini", "ada apa saja", atau pertanyaan bebas yang masih mungkin terkait layanan pelanggan, jawab dulu dengan kalimat bantuan yang natural, lalu arahkan ke tombol *Pilih Layanan* atau angka 1/2/3/4.',
    '- Untuk pertanyaan random yang belum jelas, jangan langsung menolak. Beri jawaban pendek: saya bantu arahkan, lalu sebutkan pilihan layanan resmi. Menu interaktif akan dikirim oleh sistem.',
    '- Untuk tagihan arahkan ke *Cek Tagihan*. Untuk status/progres arahkan ke *Cek Status Aduan*. Untuk alamat/jam/tarif/sambungan baru arahkan ke *Info Layanan*.',
    '- Jangan membuat menu baru selain 1-4 di atas.',
    '- Jangan menyuruh pelanggan mengetik "Laporan Gangguan", "Pengaduan Gangguan", atau frasa baru lain. Arahkan ke angka/tombol menu resmi.',
    '- Perkenalan TIARA hanya boleh muncul sekali di awal percakapan/pertanyaan pertama yang relevan. Untuk pertanyaan berikutnya, langsung jawab inti tanpa mengulang "Saya TIARA".',
    '- Jangan memakai sapaan Bapak/Ibu/Kakak secara berlebihan. Lebih baik langsung jawab inti.',
    '- Jangan bertanya banyak hal seperti tetangga ikut mati atau kondisi lain. Cukup arahkan ke menu yang benar.',
    '- Dilarang membahas matematika, coding, API, model AI, politik, hiburan, resep, game, bahasa daerah selain Sasak Lombok Tengah, atau topik di luar layanan PERUMDA/SIAGA TIARA.',
    "- Jika pesan benar-benar di luar konteks layanan air/PDAM/SIAGA TIARA, jangan memakai kalimat 'tidak paham'. Balas ramah dan arahkan: Layanan ini khusus membantu SIAGA TIARA seperti aduan air, tagihan, status aduan, atau info layanan. Silakan pilih menu di bawah ini atau tuliskan kebutuhan layanan air. 🙏🏻",
    '- Emoji maksimal satu, hanya boleh 🙂 atau 🙏🏻.',
    canSuggestAdmin ? '- Karena pelanggan sudah 2 kali tidak sesuai/masih bingung, boleh tambahkan: Jika masih bingung, silakan ketik *Hubungi Admin*.' : '- Jangan menyarankan Hubungi Admin dulu.',
    mediaNote || ''
  ].filter(Boolean).join('\n');
}

function stripAdminSuggestionBeforeThird_(text) {
  text = String(text || '');
  var lines = text.split('\n').filter(function(line) {
    var l = String(line || '').toLowerCase();
    return l.indexOf('hubungi admin') === -1 && l.indexOf('chat admin') === -1 && l.indexOf('admin manusia') === -1 && l.indexOf('cs') === -1;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildCustomerVirtualAssistantUserPrompt_(message, count, mediaNote) {
  message = String(message || '').trim();
  count = Number(count || 1) || 1;
  return [
    'Pesan pelanggan:',
    message || '[MEDIA_WHATSAPP]',
    ('Bantuan normalisasi typo/Sasak bila ada: ' + normalizeSasakLombokTengahText_(message)),
    '',
    'Tugas: klasifikasikan pesan ke menu resmi SIAGA TIARA dan jawab singkat. Jika pesan memakai typo/singkatan chat atau Bahasa Sasak Lombok Tengah, pahami maksudnya lalu jawab tetap dalam Bahasa Indonesia resmi.',
    'Jika ini keluhan teknis layanan air seperti air belum nyala/hidup/mengalir/keluar walaupun typo, air mati, pipa bocor, air keruh, air kecil, tekanan lemah, meter bermasalah, atau menyebut wilayah/cabang + keluhan, jawab dengan salam pembuka, perkenalan TIARA singkat, permintaan maaf/penjelasan, lalu arahkan ke tombol/angka *Buat Aduan* dan sebutkan tahap data aduan.',
    'Jika pesan adalah lanjutan seperti "saya tidak paham cara mengisinya", "gimana cara isi", "bisa bantu", atau "formatnya gimana", jawab sebagai bantuan pengisian *Buat Aduan* dan berikan contoh format.',
    'Jika pesan bertanya umum/random seperti "fiturnya apa saja", "layanan apa saja", "bantu saya", "saya mau tanya", "tolong", "bingung", atau pertanyaan bebas yang belum jelas, jawab ringkas dan arahkan memilih tombol *Pilih Layanan* atau angka 1/2/3/4.',
    'Jika pertanyaan terkait tagihan arahkan ke *Cek Tagihan*. Jika terkait progres laporan arahkan ke *Cek Status Aduan*. Jika terkait alamat/jam/tarif/sambungan baru arahkan ke *Info Layanan*.',
    'Jangan buat menu baru. Jangan minta pelanggan mengetik "Laporan Gangguan".',
    'Untuk pesan layanan PDAM yang dikenali, boleh pakai salam dan perkenalan TIARA singkat hanya jika belum pernah dikenalkan. Untuk pertanyaan lanjutan, langsung jawab inti.',
    "Jika benar-benar tidak berhubungan dengan layanan air/PDAM/SIAGA TIARA, jangan memakai kalimat 'tidak paham'. Jawab ramah: Layanan ini khusus membantu SIAGA TIARA seperti aduan air, tagihan, status aduan, atau info layanan. Silakan pilih menu di bawah ini atau tuliskan kebutuhan layanan air. 🙏🏻",
    count >= 2 ? 'Percobaan ke-2: boleh tambahkan opsi ketik *Hubungi Admin*.' : 'Jangan menyarankan Hubungi Admin pada percobaan ini.',
    mediaNote || ''
  ].filter(Boolean).join('\n');
}

function enforceCustomerVirtualAssistantScope_(reply, originalMessage, count, payload) {
  reply = String(reply || '').trim();
  if (!reply) return buildCustomerVirtualAssistantSafeReply_(originalMessage, count, payload);

  var lower = reply.toLowerCase();
  var forbidden = [
    'claude code', 'claude', 'anthropic', 'coding', 'pemrograman', 'programming',
    'source code', 'api key', 'base url', 'model ai', 'asisten ai untuk',
    'teknologi', 'pdam setempat', 'pdams setempat',
    'giri menang', 'lombok barat', 'pdam lain', 'tirtagiri',
    'laporan gangguan', 'pengaduan gangguan', 'update pembacaan meter',
    'berikut menu layanan', 'mau pilih menu yang mana'
  ];
  var unsafe = forbidden.some(function(word) { return lower.indexOf(word) !== -1; });

  // Jangan biarkan AI membuat daftar menu panjang/hallucination di pelanggan.
  var looksLikeLongMenu = /1\s*[).\-]|1️⃣|2\s*[).\-]|2️⃣/.test(reply) && reply.length > 280;
  var emojiHits = (reply.match(/🙂|🙏🏻|🙏|💧|✅|📋|🔎|🏠|🛠️|🚰/g) || []).length;
  var tooManyEmojis = emojiHits > 2;

  // Jawaban pelanggan harus mengarah ke menu SIAGA TIARA atau layanan PDAM. Jika tidak, pakai pagar aman.
  var hasSiagaContext = /menu|aduan|tagihan|status|layanan|air|pdam|perumda|tirta|cabang|petugas/i.test(reply);
  if (unsafe || looksLikeLongMenu || tooManyEmojis || !hasSiagaContext) return buildCustomerVirtualAssistantSafeReply_(originalMessage, count, payload);

  // Untuk keluhan gangguan air, pembuka/perkenalan boleh tampil agar terasa resmi.
  // Untuk konteks selain gangguan, pembuka panjang tetap diringkas agar tidak berulang.
  if (!isCustomerVirtualAssistantGangguanText_(originalMessage)) {
    reply = reply
      .replace(/^halo[,!\s]*(kak|bapak\/ibu|bapak|ibu)?[,!\s]*/i, '')
      .replace(/^perkenalkan[,!\s]*/i, '')
      .replace(/^saya\s+tiara[^.\n]*[.\n]+/i, '')
      .trim();
  }
  reply = sanitizeCustomerVirtualAssistantOrganization_(reply).replace(/\n{3,}/g, '\n\n').trim();

  return reply || buildCustomerVirtualAssistantSafeReply_(originalMessage, count, payload);
}

function buildCustomerVirtualAssistantSafeReply_(message, count, payload) {
  message = String(message || '').toLowerCase();
  count = Number(count || 1) || 1;
  var hasMedia = false;
  try { hasMedia = hasIncomingWhatsAppMediaOrLocation_(payload || {}); } catch(e) { hasMedia = false; }

  var lines;
  if (hasMedia) {
    lines = [[
      buildCustomerVirtualAssistantOpening_(),
      '',
      'Foto/media sudah diterima.',
      'Jika media tersebut terkait gangguan layanan air, silakan pilih tombol *Buat Aduan* agar laporan tercatat dan dapat ditindaklanjuti.'
    ].join('\n')];
  } else if (isCustomerVirtualAssistantAduanHelpText_(message)) {
    lines = [buildCustomerVirtualAssistantAduanHelpReply_(message)];
  } else if (isCustomerVirtualAssistantGangguanText_(message)) {
    lines = [buildCustomerVirtualAssistantGangguanReply_(message)];
  } else if (isCustomerVirtualAssistantTagihanText_(message)) {
    lines = [buildCustomerVirtualAssistantTagihanReply_(message)];
  } else if (isCustomerVirtualAssistantStatusText_(message)) {
    lines = [buildCustomerVirtualAssistantStatusReply_(message)];
  } else if (isCustomerVirtualAssistantFeatureQuestion_(message)) {
    lines = [buildCustomerVirtualAssistantFeatureMenuReply_(message)];
  } else if (isCustomerVirtualAssistantInfoText_(message)) {
    lines = [buildCustomerVirtualAssistantInfoReply_(message)];
  } else {
    lines = [buildCustomerVirtualAssistantUnknownReply_(count)];
  }

  return lines.join('\n');
}

function buildCustomerVirtualAssistantThirdFallbackReply_() {
  return [
    'Saya belum dapat memastikan kebutuhan Anda dari pesan tersebut.',
    '',
    'Silakan pilih salah satu layanan berikut:',
    '1. Buat Aduan',
    '2. Cek Status Aduan',
    '3. Cek Tagihan',
    '4. Info Layanan',
    '',
    'Jika ingin dibantu admin, silakan ketik *Hubungi Admin*.'
  ].join('\n');
}

function buildDireksiSharedAiAnswer_(question, direksi, history, data, options) {
  var cfg = getSharedAiConfig_();
  if (!cfg.direksiEnabled) return { skipped: true, error: 'AI Direksi nonaktif.' };
  if (!cfg.apiKey) return { skipped: true, error: 'API AI bersama belum disimpan.' };

  var prompt = buildDireksiGeminiPrompt_(question, direksi, history, data, options)
    .replace(/Gemini/g, 'AI')
    .replace(/TIARA Asisten Virtual\/Direksi/g, 'TIARA Asisten Virtual')
    .replace(/Kamu adalah[^\n]+/i, 'Kamu adalah TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani, asisten Executive Insight untuk SIAGA TIARA.');

  var messages = [];
  (history || []).slice(-4).forEach(function(h) {
    if (h && h.q) messages.push({ role: 'user', content: String(h.q || '') });
    if (h && h.a) messages.push({ role: 'assistant', content: String(h.a || '').substring(0, 1200) });
  });
  messages.push({ role: 'user', content: prompt });

  var res = callSharedAiMessages_(messages, {
    system: 'Kamu adalah TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani untuk Executive Insight SIAGA TIARA. Jawab berdasarkan data yang diberikan. Jangan mengarang data.',
    maxTokens: Number(options && options.maxOutputTokens || 1200),
    temperature: Number(options && options.temperature || 0.35)
  });
  if (!res.success) return res;
  return { success: true, model: res.model, text: res.text };
}

function setGeminiAiConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var keyPrompt = ui.prompt(
    'Simpan API Gemini',
    'Masukkan API Key Gemini.\n\nKey disimpan di Script Properties, bukan di sheet umum.',
    ui.ButtonSet.OK_CANCEL
  );
  if (keyPrompt.getSelectedButton() !== ui.Button.OK) return;

  var apiKey = String(keyPrompt.getResponseText() || '').trim();
  if (!apiKey) {
    ui.alert('API Key kosong. Konfigurasi dibatalkan.');
    return;
  }

  var defaultModel = props.getProperty('GEMINI_MODEL_DIREKSI') || CONFIG.GEMINI_MODEL_DIREKSI || 'gemini-3.1-flash-lite';
  if (defaultModel === 'gemini-2.5-flash') defaultModel = CONFIG.GEMINI_MODEL_DIREKSI || 'gemini-3.1-flash-lite';
  var modelPrompt = ui.prompt(
    'Model Gemini',
    'Masukkan nama model untuk Executive Insight.\n\nDefault: ' + defaultModel,
    ui.ButtonSet.OK_CANCEL
  );

  var model = defaultModel;
  if (modelPrompt.getSelectedButton() === ui.Button.OK) {
    model = String(modelPrompt.getResponseText() || '').trim() || defaultModel;
  }

  props.setProperty('GEMINI_API_KEY', apiKey);
  props.setProperty('GEMINI_MODEL_DIREKSI', model);

  ui.alert(
    '✅ API Gemini tersimpan',
    'Model Executive Insight: ' + model + '\n\nFitur Tanya Asisten Virtual Direksi siap diuji.',
    ui.ButtonSet.OK
  );
}

function getDireksiAccessRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupDireksiAccessSheet(ss);
  var lastRow = safeGetLastRow_(sh);
  if (lastRow < 2) return [];

  var lastCol = Math.max(sh.getLastColumn(), 6);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  return values.map(function(r, i) {
    return {
      rowNumber: i + 2,
      nama: String(r[0] || '').trim(),
      noWa: normalizePhone_(r[1] || ''),
      jabatan: String(r[2] || '').trim(),
      role: String(r[3] || 'Direksi').trim(),
      status: String(r[4] || 'Aktif').trim(),
      catatan: String(r[5] || '').trim()
    };
  });
}

function isDireksiRoleText_(text) {
  text = String(text || '').toLowerCase();
  return text.indexOf('direksi') !== -1 ||
         text.indexOf('direktur') !== -1 ||
         text.indexOf('dirut') !== -1 ||
         text.indexOf('manajemen') !== -1 ||
         text.indexOf('executive') !== -1;
}

function getDireksiByPhone_(phone, petugas) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  var cacheKey = 'DIREKSI_BY_PHONE_' + phone;
  var cached = cacheGet_(cacheKey);
  if (cached === '__NONE__') return null;
  if (cached) {
    try {
      var c = JSON.parse(cached);
      if (c && c.noWa) return c;
    } catch(e) {}
  }

  // getWhatsAppMenuResponse_ selalu memanggil getPetugasByPhone_ lebih dahulu.
  // Jika nomor sudah terbukti bukan petugas, pasti juga bukan direksi dari sheet yang sama.
  try {
    if (!petugas && cacheGet_('PETUGAS_BY_PHONE_' + phone) === '__NONE__') {
      cachePut_(cacheKey, '__NONE__', 120);
      return null;
    }
  } catch(eNegativePetugas) {}

  function makeResult_(p) {
    return {
      nama: p.nama || 'Direksi',
      jabatan: p.role || 'Direksi',
      noWa: phone,
      role: p.role || 'Direksi',
      cabang: p.cabang || '',
      isAdmin: true,
      isDireksi: true,
      fromPetugasCabang: true,
      rowNumber: p.rowNumber || ''
    };
  }

  // V10.9.82:
  // Tidak memakai sheet DIREKSI_ACCESS lagi.
  // Cukup isi nomor direksi di PETUGAS_CABANG dengan Role:
  // Direksi / Direktur / Dirut / Manajemen / Executive.
  if (petugas && petugas.noWa && normalizePhone_(petugas.noWa) === phone) {
    var roleText = [petugas.role, petugas.cabang, petugas.nama].join(' ');
    if (isDireksiRoleText_(roleText)) {
      var result = makeResult_(petugas);
      try { cachePut_(cacheKey, JSON.stringify(result), 120); } catch(e2) {}
      return result;
    }
  }

  // Fallback pencarian langsung dari PETUGAS_CABANG jika activePetugas belum terbaca.
  var rows = getPetugasRows_();
  for (var i = 0; i < rows.length; i++) {
    var p = rows[i];
    if (!p.noWa || normalizePhone_(p.noWa) !== phone) continue;

    var status = String(p.status || '').trim().toLowerCase();
    if (status && status !== 'aktif') continue;

    var roleText2 = [p.role, p.cabang, p.nama].join(' ');
    if (!isDireksiRoleText_(roleText2)) continue;

    var r = makeResult_(p);
    try { cachePut_(cacheKey, JSON.stringify(r), 120); } catch(e3) {}
    return r;
  }

  try { cachePut_(cacheKey, '__NONE__', 120); } catch(e4) {}
  return null;
}

function buildDireksiMainMenuReply_(direksi) {
  direksi = direksi || {};
  var nama = direksi.nama && direksi.nama !== 'Direksi' ? direksi.nama : 'Bapak/Ibu';

  return [
    '🏢 *EXECUTIVE INSIGHT SIAGA TIARA*',
    '',
    'Halo ' + nama + '.',
    'Silakan pilih informasi monitoring layanan:',
    '',
    '1. 📊 Ringkasan Layanan',
    '2. ⚠️ Cabang Perlu Perhatian',
    '3. ⏱️ Aduan Lewat SLA',
    '4. 🏢 Analisis Cabang',
    '5. 🤖 Tanya Asisten Virtual',
    '',
    'Ketik angka menu.',
    '',
    '_Khusus internal direksi/manajemen._'
  ].join('\n');
}


function normalizeDireksiCommand_(text) {
  var v = String(text || '').trim().toLowerCase();
  // Bersihkan format WhatsApp/AI seperti *selesai*, _selesai_, tanda titik, dll.
  v = v.replace(/[\*_`~]/g, '');
  v = v.replace(/[.!?,;:\s]+$/g, '').trim();
  v = v.replace(/^[.!?,;:\s]+/g, '').trim();
  return v;
}

function isDireksiAiEndCommand_(text) {
  var cmd = normalizeDireksiCommand_(text);
  return ['selesai', 'keluar', 'stop', 'akhiri', 'tutup'].indexOf(cmd) !== -1;
}

function buildDireksiAiEndReply_(direksi) {
  return 'Baik, sesi *Tanya Asisten Virtual* ditutup.\n\n' + buildDireksiMainMenuReply_(direksi || {});
}

function handleDireksiWhatsAppMessage_(message, phone, payload, direksi) {
  message = String(message || '').trim();
  phone = normalizePhone_(phone || '');
  payload = payload || {};
  direksi = direksi || {};

  var lower = message.toLowerCase();
  var command = normalizeDireksiCommand_(message);
  var session = getWhatsAppSession_(phone);

  if (['batal', 'cancel', 'reset', 'ulang'].indexOf(command) !== -1) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'DIREKSI_CANCEL',
      reply: 'Baik, percakapan direksi dibatalkan.\n\n' + buildDireksiMainMenuReply_(direksi)
    };
  }

  if (session && session.state === 'DIREKSI_AI_CHAT') {
    if (isDireksiAiEndCommand_(message)) {
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'DIREKSI_AI_END',
        reply: buildDireksiAiEndReply_(direksi)
      };
    }

    if (command === 'menu' || command === 'menu utama' || command === 'direksi menu') {
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'DIREKSI_MENU',
        reply: buildDireksiMainMenuReply_(direksi)
      };
    }

    if (['lanjut', 'lanjutkan', 'sambung', 'next'].indexOf(command) !== -1) {
      return handleDireksiAiContinuation_(phone, direksi, session);
    }

    return handleDireksiAiQuestion_(phone, direksi, message, session);
  }

  if (session && session.state === 'DIREKSI_SELECT_CABANG_ANALYSIS') {
    if (command === 'menu' || command === 'menu utama' || command === 'direksi menu') {
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'DIREKSI_MENU',
        reply: buildDireksiMainMenuReply_(direksi)
      };
    }

    var selectedCabang = resolveDireksiCabangChoice_(message);
    if (!selectedCabang) {
      return {
        success: false,
        type: 'DIREKSI_SELECT_CABANG_INVALID',
        reply: buildDireksiAskCabangReply_()
      };
    }

    clearWhatsAppSession_(phone);
    return handleDireksiAnalisisCabang_(phone, direksi, selectedCabang);
  }

  if (
    lower === 'menu' ||
    lower === 'menu utama' ||
    lower === 'direksi menu' ||
    lower === 'halo' ||
    lower === 'hallo' ||
    lower === 'hi' ||
    lower === 'start' ||
    lower === '/start'
  ) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'DIREKSI_MENU',
      reply: buildDireksiMainMenuReply_(direksi)
    };
  }

  if (lower === '1' || lower.indexOf('ringkasan') !== -1) {
    return handleDireksiRingkasanLayanan_(phone, direksi);
  }

  if (lower === '2' || lower.indexOf('perhatian') !== -1 || lower.indexOf('bermasalah') !== -1 || lower.indexOf('rawan') !== -1) {
    return handleDireksiCabangPerluPerhatian_(phone, direksi);
  }

  if (lower === '3' || lower.indexOf('sla') !== -1 || lower.indexOf('lewat') !== -1) {
    return handleDireksiAduanLewatSla_(phone, direksi);
  }

  if (lower === '4' || lower.indexOf('analisis cabang') !== -1) {
    var cabangFromText = resolveDireksiCabangChoice_(message);
    if (cabangFromText) return handleDireksiAnalisisCabang_(phone, direksi, cabangFromText);

    setWhatsAppSession_(phone, 'DIREKSI_SELECT_CABANG_ANALYSIS', {});
    return {
      success: true,
      type: 'DIREKSI_SELECT_CABANG',
      reply: buildDireksiAskCabangReply_()
    };
  }

  if (lower === '5' || lower.indexOf('asisten virtual') !== -1 || lower.indexOf('tanya ai') !== -1 || lower.indexOf('ai') === 0) {
    setWhatsAppSession_(phone, 'DIREKSI_AI_CHAT', { history: [] });
    return {
      success: true,
      type: 'DIREKSI_AI_START',
      reply: buildDireksiAiStartReply_()
    };
  }

  // Jika direksi langsung bertanya tanpa membuka menu 5, langsung masuk mode AI
  // agar alurnya terasa seperti chat natural.
  if (looksLikeDireksiQuestion_(lower)) {
    var aiSession = { state: 'DIREKSI_AI_CHAT', data: { history: [] } };
    setWhatsAppSession_(phone, 'DIREKSI_AI_CHAT', { history: [] });
    return handleDireksiAiQuestion_(phone, direksi, message, aiSession);
  }

  return {
    success: true,
    type: 'DIREKSI_MENU',
    reply: buildDireksiMainMenuReply_(direksi)
  };
}

function looksLikeDireksiQuestion_(lower) {
  lower = String(lower || '').toLowerCase();
  if (!lower) return false;
  if (lower.indexOf('?') !== -1) return true;

  var words = [
    'apakah', 'apa ', 'kenapa', 'mengapa', 'bagaimana', 'gimana',
    'dimana', 'di mana', 'cabang', 'saran', 'rekomendasi',
    'masalah', 'bermasalah', 'perlu', 'atasi', 'mengatasi',
    'kinerja', 'mutasi', 'pindahkan', 'ganti', 'diganti',
    'terburuk', 'terbaik', 'naik', 'turun', 'evaluasi'
  ];

  for (var i = 0; i < words.length; i++) {
    if (lower.indexOf(words[i]) !== -1) return true;
  }
  return false;
}

function buildDireksiAiStartReply_() {
  return [
    '🤖 *Tanya Asisten Virtual*',
    '',
    'Silakan tanya terkait data aduan SIAGA TIARA.',
    'Sesi ini tidak langsung selesai setelah 1 pertanyaan, jadi Bapak/Ibu bisa tanya lanjutan.',
    '',
    'Contoh:',
    '- Cabang bermasalah dimana?',
    '- Saran mengatasi masalah Cabang Praya?',
    '- Apakah Kepala Cabang Praya perlu dipindahkan ke Kopang?',
    '- Kenapa aduan bulan ini naik?',
    '',
    'Ketik *selesai* untuk menutup sesi AI.',
    'Ketik *menu* untuk kembali ke Executive Insight.'
  ].join('\n');
}

function buildDireksiAskCabangReply_() {
  var lines = [
    '🏢 *Analisis Cabang*',
    '',
    'Pilih cabang yang ingin dianalisis:'
  ];

  (CONFIG.CABANG || []).forEach(function(cabang, i) {
    lines.push((i + 1) + '. ' + cabang.replace(/^Cabang\s+/i, ''));
  });

  lines.push('');
  lines.push('Balas angka atau nama cabang.');
  return lines.join('\n');
}

function resolveDireksiCabangChoice_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  var lower = text.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  var num = Number(lower.replace(/[^0-9]/g, ''));
  if (String(num) === lower && num >= 1 && num <= (CONFIG.CABANG || []).length) {
    return CONFIG.CABANG[num - 1];
  }

  var normalized = normalizeCabangKey_(lower.replace(/^cabang\s+/i, ''));
  var cabangs = CONFIG.CABANG || [];
  var best = '';

  for (var i = 0; i < cabangs.length; i++) {
    var full = cabangs[i];
    var fullKey = normalizeCabangKey_(full);
    var shortKey = normalizeCabangKey_(full.replace(/^Cabang\s+/i, ''));

    if (normalized === fullKey || normalized === shortKey) return full;

    // Cocokkan cabang spesifik dulu; "Praya Tengah" jangan jatuh ke "Praya".
    if (!best && (lower.indexOf(shortKey) !== -1 || lower.indexOf(fullKey) !== -1)) best = full;
  }

  // Cari dari yang nama cabangnya paling panjang agar Praya Barat Daya menang dari Praya.
  var ordered = cabangs.slice().sort(function(a, b) {
    return b.length - a.length;
  });

  for (var j = 0; j < ordered.length; j++) {
    var sh = ordered[j].replace(/^Cabang\s+/i, '').toLowerCase();
    if (lower.indexOf(sh) !== -1) return ordered[j];
  }

  return best;
}

function handleDireksiRingkasanLayanan_(phone, direksi) {
  var today = getDireksiAduanInsightData_({ period: 'today' });
  var month = getDireksiAduanInsightData_({ period: 'month' });

  var topCabang = month.topCabang && month.topCabang.length ? month.topCabang[0] : null;
  var topGangguan = month.topGangguan && month.topGangguan.length ? month.topGangguan[0] : null;

  var lines = [
    '📊 *Ringkasan Layanan SIAGA TIARA*',
    '',
    '*Hari ini*',
    'Total aduan: *' + today.total + '*',
    'Aktif: ' + today.active + ' | Selesai: ' + today.selesai + ' | Lewat/Telat SLA: ' + today.lewatSla,
    '',
    '*Bulan ini*',
    'Total aduan: *' + month.total + '*',
    'Aktif: ' + month.active + ' | Selesai: ' + month.selesai + ' | Lewat/Telat SLA: ' + month.lewatSla + ' (Aktif ' + month.activeLewatSla + ', Selesai telat ' + month.selesaiLewatSla + ')',
    'Tingkat selesai: *' + month.selesaiPercent + '%*',
    '',
    'Cabang tertinggi: *' + (topCabang ? (topCabang.name || topCabang.cabang || '-') : '-') + '* (' + (topCabang ? (topCabang.count || topCabang.total || 0) : 0) + ')',
    'Gangguan dominan: *' + (topGangguan ? topGangguan.name : '-') + '* (' + (topGangguan ? topGangguan.count : 0) + ')',
    '',
    buildDireksiShortInsight_(month),
    '',
    'Ketik *menu* untuk kembali.'
  ];

  return {
    success: true,
    type: 'DIREKSI_RINGKASAN',
    reply: lines.join('\n')
  };
}

function handleDireksiCabangPerluPerhatian_(phone, direksi) {
  var data = getDireksiAduanInsightData_({ period: 'month' });
  var list = (data.cabangPrioritas || []).slice(0, 3);

  if (!list.length) {
    return {
      success: true,
      type: 'DIREKSI_CABANG_PERHATIAN_EMPTY',
      reply: '⚠️ *Cabang Perlu Perhatian*\n\nBelum ada data aduan bulan ini.'
    };
  }

  var lines = [
    '⚠️ *Cabang Perlu Perhatian*',
    '',
    'Periode: ' + data.periodeLabel,
    '',
    'Penilaian memakai kombinasi total aduan, aduan aktif, lewat SLA, ditunda, prioritas tinggi/darurat, dan pola gangguan.'
  ];

  list.forEach(function(c, i) {
    lines.push('');
    lines.push((i + 1) + '. *' + c.cabang + '*');
    lines.push('Skor perhatian: ' + c.score + ' | Risiko: *' + c.risk + '*');
    lines.push('Total: ' + c.total + ' | Aktif: ' + c.active + ' | Lewat/Telat SLA: ' + c.lewatSla + ' (Aktif ' + (c.activeLewatSla || 0) + ', selesai telat ' + (c.selesaiLewatSla || 0) + ')');
    lines.push('Dominan: ' + (c.topGangguan || '-') + ' | Wilayah: ' + (c.topWilayah || '-'));
  });

  lines.push('');
  lines.push('Catatan: ini indikator layanan, bukan penilaian personal pegawai.');
  lines.push('Ketik *5* untuk tanya TIARA Asisten Virtual lebih dalam.');

  return {
    success: true,
    type: 'DIREKSI_CABANG_PERHATIAN',
    reply: lines.join('\n')
  };
}

function handleDireksiAduanLewatSla_(phone, direksi) {
  var data = getDireksiAduanInsightData_({ period: 'month' });
  var list = (data.slaLateList || data.overdueList || []).slice(0, 10);

  if (!list.length) {
    return {
      success: true,
      type: 'DIREKSI_SLA_EMPTY',
      reply: [
        '⏱️ *Aduan Lewat / Terlambat SLA*',
        '',
        'Untuk periode ' + data.periodeLabel + ', belum ada aduan aktif yang melewati SLA dan belum ada aduan selesai yang tercatat terlambat.',
        '',
        'Kondisi ini baik untuk dipertahankan.'
      ].join('\n')
    };
  }

  var lines = [
    '⏱️ *Aduan Lewat / Terlambat SLA*',
    '',
    'Periode: ' + data.periodeLabel,
    'Aktif lewat SLA: *' + (data.activeLewatSla || 0) + '*',
    'Selesai terlambat: *' + (data.selesaiLewatSla || 0) + '*',
    '',
    'Daftar prioritas/riwayat:'
  ];

  list.forEach(function(a, i) {
    lines.push('');
    lines.push((i + 1) + '. *' + a.id + '*');
    lines.push(a.cabang + ' | ' + a.jenisGangguan + ' | ' + a.status);
    lines.push('SLA: *' + (a.statusSla || 'Lewat SLA') + '*');
    lines.push('Telat: *' + (a.lewatText || (a.lewatJam + ' jam')) + '*');
    if (a.wilayah) lines.push('Wilayah: ' + a.wilayah);
    if (a.waktuSelesai) lines.push('Selesai: ' + a.waktuSelesai);
  });

  lines.push('');
  lines.push('Catatan: aduan yang sudah selesai tetap dihitung sebagai riwayat terlambat jika waktu selesai melewati batas SLA.');

  return {
    success: true,
    type: 'DIREKSI_SLA',
    reply: lines.join('\n')
  };
}

function handleDireksiAnalisisCabang_(phone, direksi, cabang) {
  var data = getDireksiAduanInsightData_({ period: 'month', cabang: cabang });
  var c = data.targetCabang || null;

  if (!c || c.total === 0) {
    return {
      success: true,
      type: 'DIREKSI_ANALISIS_CABANG_EMPTY',
      reply: [
        '🏢 *Analisis Cabang*',
        '',
        'Cabang: *' + cabang + '*',
        'Periode: ' + data.periodeLabel,
        '',
        'Belum ada data aduan pada periode ini.',
        '',
        'Ketik *menu* untuk kembali.'
      ].join('\n')
    };
  }

  var key = getGeminiApiKey_();
  if (key) {
    var question = 'Buat analisis manajemen untuk ' + cabang + ' berdasarkan data SIAGA.';
    var ai = buildDireksiAiAnswer_(question, direksi, [], data, {
      mode: 'ANALISIS_CABANG',
      targetCabang: cabang,
      maxOutputTokens: 1200
    });

    if (ai && ai.success && ai.text) {
      logAiInsight_(phone, direksi.nama, 'ANALISIS_CABANG', question, ai.model, 'OK', ai.text);
      return {
        success: true,
        type: 'DIREKSI_ANALISIS_CABANG_AI',
        reply: ai.text + '\n\nKetik *5* untuk lanjut tanya TIARA Asisten Virtual.'
      };
    }
  }

  return {
    success: true,
    type: 'DIREKSI_ANALISIS_CABANG',
    reply: buildDireksiCabangRuleBasedAnalysis_(c, data)
  };
}

function handleDireksiAiQuestion_(phone, direksi, question, session) {
  question = String(question || '').trim();
  session = session || getWhatsAppSession_(phone) || { data: {} };
  var dataSession = session.data || {};
  var history = dataSession.history || [];

  var insightData = getDireksiAduanInsightData_({
    period: 'month',
    cabang: resolveDireksiCabangChoice_(question)
  });

  var ai = buildDireksiAiAnswer_(question, direksi, history, insightData, {
    mode: 'TANYA_ASISTEN_VIRTUAL',
    maxOutputTokens: 1400
  });

  var reply;
  var status = 'FALLBACK';

  if (ai && ai.success && ai.text) {
    reply = ai.text;
    status = 'OK';
  } else {
    reply = buildDireksiAIWithoutGeminiReply_(question, insightData, ai && ai.error ? ai.error : '');
    status = ai && ai.error ? ('FALLBACK: ' + ai.error) : 'FALLBACK_NO_KEY';
  }

  reply = normalizeDireksiAiReply_(reply);

  history.push({
    q: question,
    a: reply.substring(0, 700),
    at: new Date().toISOString()
  });

  if (history.length > 4) {
    history = history.slice(history.length - 4);
  }

  var parts = splitDireksiAiReplyForWhatsApp_(reply, 1850);
  var firstReply = parts.shift() || reply;
  var pending = parts || [];

  setWhatsAppSession_(phone, 'DIREKSI_AI_CHAT', {
    history: history,
    pendingReplyParts: pending,
    lastQuestion: question
  });

  logAiInsight_(phone, direksi.nama, 'TANYA_ASISTEN_VIRTUAL', question, ai && ai.model ? ai.model : '', status, reply);

  var footer = pending.length
    ? '_Jawaban masih ada lanjutannya. Ketik *lanjut* untuk sambungan._'
    : '_Anda bisa tanya lanjutan. Ketik *selesai* untuk menutup sesi AI._';

  return {
    success: true,
    type: 'DIREKSI_AI_REPLY',
    reply: firstReply + '\n\n' + footer
  };
}

function normalizeDireksiAiReply_(text) {
  text = String(text || '').trim();
  if (!text) return 'Belum ada jawaban yang bisa dibuat dari data saat ini.';

  // Bersihkan markdown AI agar cocok untuk WhatsApp.
  text = text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '*$1*')
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, '*$1*')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\blewat_sla_total\b/gi, 'total lewat/telat SLA')
    .replace(/\blewat_sla_aktif\b/gi, 'aktif lewat SLA')
    .replace(/\bselesai_terlambat_sla\b/gi, 'selesai terlambat SLA')
    .replace(/\baduan_lewat_sla\b/gi, 'aduan lewat SLA');

  // Hindari salam berulang pada sesi lanjutan yang bikin jawaban terasa template.
  text = text.replace(/^(Selamat\s+(pagi|siang|sore|malam),?\s+[^.\n]+\.?\s*)\n+/i, '');

  // Rapikan spasi dan baris kosong.
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Jika ada bold WhatsApp yang tidak tertutup karena output model terpotong,
  // jangan biarkan tanda * tampil mentah di WA.
  text = fixUnbalancedWhatsAppBold_(text);

  return text || 'Belum ada jawaban yang bisa dibuat dari data saat ini.';
}

function fixUnbalancedWhatsAppBold_(text) {
  text = String(text || '');

  // Ubah sisa double star yang belum tertangkap menjadi single star dulu.
  text = text.replace(/\*\*/g, '*');

  var starCount = (text.match(/\*/g) || []).length;
  if (starCount % 2 === 0) return text;

  // Jika ada satu tanda * pembuka yang tidak punya penutup di akhir teks,
  // hapus tanda tersebut agar tidak tampil sebagai karakter mentah.
  var lastStar = text.lastIndexOf('*');
  if (lastStar >= 0) {
    text = text.substring(0, lastStar) + text.substring(lastStar + 1);
  }

  return text;
}

function splitDireksiAiReplyForWhatsApp_(text, maxLen) {
  text = String(text || '').trim();
  maxLen = Number(maxLen || 1850);
  if (!text || text.length <= maxLen) return [text];

  var parts = [];
  var rest = text;

  while (rest.length > maxLen && parts.length < 4) {
    var cut = findSafeWaCutIndex_(rest, maxLen);
    var part = rest.substring(0, cut).trim();
    if (part) parts.push(part);
    rest = rest.substring(cut).trim();
  }

  if (rest) parts.push(rest);

  return parts.filter(function(p) { return !!String(p || '').trim(); });
}

function findSafeWaCutIndex_(text, maxLen) {
  text = String(text || '');
  maxLen = Number(maxLen || 1850);
  if (text.length <= maxLen) return text.length;

  var slice = text.substring(0, maxLen);
  var candidates = [
    slice.lastIndexOf('\n\n'),
    slice.lastIndexOf('\n• '),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! ')
  ];

  var best = -1;
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] > best) best = candidates[i];
  }

  if (best > Math.floor(maxLen * 0.55)) {
    // Untuk titik/kalimat, sertakan tanda baca.
    var ch = text.charAt(best);
    if (ch === '.' || ch === '?' || ch === '!') return best + 1;
    return best;
  }

  // Fallback: jangan potong di tengah kata.
  var space = slice.lastIndexOf(' ');
  return space > Math.floor(maxLen * 0.7) ? space : maxLen;
}

function handleDireksiAiContinuation_(phone, direksi, session) {
  session = session || getWhatsAppSession_(phone) || { data: {} };
  var data = session.data || {};
  var pending = data.pendingReplyParts || [];

  if (!pending.length) {
    return {
      success: true,
      type: 'DIREKSI_AI_NO_CONTINUATION',
      reply: 'Tidak ada lanjutan jawaban yang tertunda.\n\nSilakan tulis pertanyaan berikutnya, atau ketik *selesai* untuk menutup sesi AI.'
    };
  }

  var next = String(pending.shift() || '').trim();
  data.pendingReplyParts = pending;
  setWhatsAppSession_(phone, 'DIREKSI_AI_CHAT', data);

  var footer = pending.length
    ? '_Masih ada sambungan. Ketik *lanjut* lagi._'
    : '_Sambungan selesai. Anda bisa tanya lanjutan atau ketik *selesai* untuk menutup sesi AI._';

  return {
    success: true,
    type: 'DIREKSI_AI_CONTINUATION',
    reply: next + '\n\n' + footer
  };
}

function getGeminiApiKey_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('GEMINI_API_KEY') || props.getProperty('GOOGLE_GEMINI_API_KEY') || '';
}

function getGeminiDireksiModel_() {
  var props = PropertiesService.getScriptProperties();
  var model = props.getProperty('GEMINI_MODEL_DIREKSI') || CONFIG.GEMINI_MODEL_DIREKSI || 'gemini-3.1-flash-lite';
  // V10.9.100: migrasi otomatis jika Script Properties masih menyimpan model lama.
  if (model === 'gemini-2.5-flash') {
    model = CONFIG.GEMINI_MODEL_DIREKSI || 'gemini-3.1-flash-lite';
    try { props.setProperty('GEMINI_MODEL_DIREKSI', model); } catch (e) {}
  }
  return model;
}

function buildDireksiAiAnswer_(question, direksi, history, data, options) {
  options = options || {};

  // V10.9.212: pakai API AI bersama dulu agar pelanggan dan direksi memakai konfigurasi yang sama.
  try {
    var sharedAi = buildDireksiSharedAiAnswer_(question, direksi, history, data, options);
    if (sharedAi && !sharedAi.skipped) return sharedAi;
  } catch(eSharedAi) {}

  var apiKey = getGeminiApiKey_();
  if (!apiKey) {
    return { success: false, error: 'API AI belum disimpan.' };
  }

  var model = getGeminiDireksiModel_();
  var prompt = buildDireksiGeminiPrompt_(question, direksi, history, data, options);

  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
    var payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: Number(options.temperature || 0.35),
        maxOutputTokens: Number(options.maxOutputTokens || 1200),
        topP: 0.9
      }
    };

    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    var status = res.getResponseCode();
    var body = res.getContentText();

    if (status < 200 || status >= 300) {
      return { success: false, model: model, error: 'AI HTTP ' + status + ': ' + body.substring(0, 500) };
    }

    var parsed = JSON.parse(body);
    var parts = parsed &&
      parsed.candidates &&
      parsed.candidates[0] &&
      parsed.candidates[0].content &&
      parsed.candidates[0].content.parts;

    var text = '';
    if (parts && parts.length) {
      text = parts.map(function(p) { return p.text || ''; }).join('\n').trim();
    }

    if (!text) {
      return { success: false, model: model, error: 'Jawaban AI kosong.' };
    }

    return { success: true, model: model, text: text };

  } catch(err) {
    return { success: false, model: model, error: err && err.message ? err.message : String(err) };
  }
}

function buildDireksiGeminiPrompt_(question, direksi, history, data, options) {
  options = options || {};
  var compactData = makeDireksiDataForAi_(data);
  var hist = (history || []).slice(-4);

  return [
    'Kamu adalah TIARA Asisten Virtual PERUMDA Tirta Ardhia Rinjani, asisten Executive Insight untuk SIAGA TIARA.',
    '',
    'Peran utama:',
    '- Menjawab pertanyaan direksi/manajemen dengan natural, nyambung, dan berbasis DATA SIAGA TIARA.',
    '- Jangan mengarang angka, nama cabang, wilayah, kejadian, penyebab, atau keputusan yang tidak ada di data.',
    '- Kalau data belum cukup atau sampelnya kecil, sebutkan keterbatasan data secara jelas.',
    '- Jangan terlalu percaya diri hanya dari 1-2 data. Hindari kata mutlak seperti pasti, sangat baik, wajib, harus, jika datanya belum kuat.',
    '- Gunakan bahasa Indonesia profesional, sederhana, dan cocok dibaca di WhatsApp.',
    '- Jawaban ideal 5-10 baris pendek. Boleh lebih panjang hanya kalau pertanyaannya meminta analisis mendalam.',
    '- Jangan mengulang salam seperti Selamat pagi/siang/malam pada jawaban lanjutan.',
    '- Jangan gunakan Markdown **double star**. Jika perlu penekanan, gunakan format WhatsApp satu bintang: *teks*.',
    '',
    'Cara memilih format jawaban:',
    '- Jangan memaksa semua jawaban memakai Kesimpulan/Alasan/Saran.',
    '- Untuk pertanyaan sederhana seperti jumlah aduan, cabang terbanyak, status hari ini: jawab langsung dan ringkas.',
    '- Untuk pertanyaan keputusan manajemen seperti mutasi, rotasi, kenaikan gaji, insentif, teguran, evaluasi kepala cabang: gunakan format Jawaban singkat, Dasar data, Catatan, Rekomendasi.',
    '- Untuk pertanyaan analisis kinerja cabang: gunakan Ringkasan, Temuan utama, Risiko, Tindak lanjut.',
    '- Untuk pertanyaan perbandingan cabang: tampilkan ranking/perbandingan singkat dan jelaskan indikatornya.',
    '- Untuk pertanyaan yang tidak bisa dijawab dari data SIAGA, katakan data SIAGA belum cukup dan sebutkan data tambahan yang dibutuhkan.',
    '',
    'Aturan keputusan besar:',
    '- Jangan memutuskan mutasi, pergantian jabatan, hukuman, kenaikan gaji, atau penilaian personal final.',
    '- Untuk SDM, berikan rekomendasi manajemen yang aman: evaluasi, pembinaan, pendampingan, monitoring 7-30 hari, atau rotasi sebagai opsi jika indikator tidak membaik.',
    '- Kenaikan gaji/insentif tidak boleh disimpulkan hanya dari data aduan. Sebutkan perlu data tambahan seperti kebijakan perusahaan, anggaran, masa kerja, beban kerja, penilaian kinerja, dan kehadiran.',
    '- Mutasi/rotasi tidak boleh disimpulkan hanya dari volume aduan. Lihat SLA, aduan aktif, selesai terlambat, tren, kendala lapangan, jumlah petugas, dan stok/material.',
    '',
    'Aturan data rendah:',
    '- Jika target cabang hanya punya total aduan kurang dari 5 atau selesai kurang dari 3, wajib tulis: Data masih rendah, jadi belum cukup kuat untuk keputusan akhir.',
    '- Jika persentase 100% muncul dari data sangat sedikit, jelaskan bahwa itu indikator awal, bukan bukti kinerja final.',
    '',
    'Larangan output:',
    '- Jangan menyebut token, API key, nomor HP pelanggan, atau data sensitif yang tidak perlu.',
    '- Jangan menampilkan nama field JSON mentah seperti lewat_sla_total atau selesai_terlambat_sla. Ubah menjadi bahasa manusia: aktif lewat SLA, selesai terlambat, telat sekian jam.',
    '- Jangan menutup jawaban dengan kalimat generik yang tidak perlu.',
    '',
    'Profil penanya:',
    JSON.stringify({
      nama: direksi && direksi.nama ? direksi.nama : 'Direksi',
      jabatan: direksi && direksi.jabatan ? direksi.jabatan : 'Direksi/Manajemen'
    }),
    '',
    'Riwayat percakapan singkat:',
    JSON.stringify(hist),
    '',
    'Data ringkas SIAGA TIARA:',
    JSON.stringify(compactData),
    '',
    'Pertanyaan terbaru:',
    question,
    '',
    'Instruksi akhir:',
    '- Jawab pertanyaan terbaru secara langsung dulu, baru beri penjelasan seperlunya.',
    '- Fokus pada cabang/topik yang ditanya. Jangan melebar ke cabang lain kecuali perlu perbandingan.',
    '- Jika memakai angka, pastikan angka berasal dari data ringkas.',
    '- Pastikan jawaban selesai utuh, tidak menggantung di tengah kata/kalimat.'
  ].join('\n');
}

function makeDireksiDataForAi_(data) {
  data = data || {};
  return {
    periode: data.periodeLabel || '',
    total_aduan: data.total || 0,
    aktif: data.active || 0,
    selesai: data.selesai || 0,
    selesai_persen: data.selesaiPercent || 0,
    lewat_sla_total: data.lewatSla || 0,
    lewat_sla_aktif: data.activeLewatSla || 0,
    selesai_terlambat_sla: data.selesaiLewatSla || 0,
    ditunda: data.byStatus && data.byStatus.Ditunda ? data.byStatus.Ditunda : 0,
    top_cabang: (data.topCabang || []).slice(0, 5),
    cabang_perlu_perhatian: (data.cabangPrioritas || []).slice(0, 5),
    top_gangguan: (data.topGangguan || []).slice(0, 5),
    top_wilayah: (data.topWilayah || []).slice(0, 5),
    aduan_aktif_lewat_sla: (data.overdueList || []).slice(0, 5),
    riwayat_selesai_terlambat_sla: (data.completedLateList || []).slice(0, 5),
    semua_aduan_lewat_atau_telat_sla: (data.slaLateList || []).slice(0, 8),
    target_cabang: data.targetCabang || null
  };
}

function getDireksiAduanInsightData_(options) {
  options = options || {};
  var period = options.period || 'month';
  var cabangFilter = options.cabang || '';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  var tz = Session.getScriptTimeZone();
  var now = new Date();

  var start;
  var end;
  var label;

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    label = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = Utilities.formatDate(now, tz, 'MMMM yyyy');
  }

  var result = {
    period: period,
    periodeLabel: label,
    generatedAt: Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm'),
    total: 0,
    active: 0,
    selesai: 0,
    selesaiPercent: 0,

    // V10.9.83:
    // lewatSla = total semua aduan yang pernah melewati SLA pada periode ini,
    // baik yang masih aktif maupun yang sudah selesai terlambat.
    lewatSla: 0,
    activeLewatSla: 0,
    selesaiLewatSla: 0,

    byStatus: {},
    byCabang: {},
    byGangguan: {},
    byWilayah: {},
    byJam: {},
    topCabang: [],
    cabangPrioritas: [],
    topGangguan: [],
    topWilayah: [],
    overdueList: [],       // aktif yang sedang lewat SLA
    completedLateList: [], // selesai tapi terlambat dari SLA
    slaLateList: [],       // gabungan overdueList + completedLateList
    targetCabang: null
  };

  if (!sh || safeGetLastRow_(sh) < 2) return result;

  var values = sh.getRange(2, 1, safeGetLastRow_(sh) - 1, Math.max(sh.getLastColumn(), 20)).getValues();

  values.forEach(function(row) {
    var d = parseAduanRowForTracking_(row);
    if (!d || !d.id || !d.waktuMasukDate) return;

    var t = d.waktuMasukDate.getTime();
    if (t < start.getTime() || t >= end.getTime()) return;

    var cabang = d.cabang || 'Cabang Tidak Diketahui';
    var status = d.status || 'Baru';
    var jenis = d.jenisGangguan || 'Lainnya';
    var wilayah = d.wilayah || d.lokasiDetail || '-';
    var isClosed = status === 'Selesai' || status === 'Batal';
    var isActive = !isClosed;
    var isSelesai = status === 'Selesai';

    var slaInfo = getAduanSlaFinalInfo_(d, now);
    var isActiveOverdue = !!slaInfo.isActiveLate;
    var isCompletedLate = !!slaInfo.isCompletedLate;
    var isAnyLate = isActiveOverdue || isCompletedLate;

    result.total++;
    if (isActive) result.active++;
    if (isSelesai) result.selesai++;

    if (isAnyLate) result.lewatSla++;
    if (isActiveOverdue) result.activeLewatSla++;
    if (isCompletedLate) result.selesaiLewatSla++;

    incMap_(result.byStatus, status);
    incMap_(result.byCabang, cabang);
    incMap_(result.byGangguan, jenis);
    incMap_(result.byWilayah, wilayah);
    incMap_(result.byJam, getJamBucketDireksi_(d.waktuMasukDate));

    if (!result.byCabangDetail) result.byCabangDetail = {};
    if (!result.byCabangDetail[cabang]) {
      result.byCabangDetail[cabang] = {
        cabang: cabang,
        total: 0,
        active: 0,
        selesai: 0,
        ditunda: 0,
        batal: 0,
        lewatSla: 0,
        activeLewatSla: 0,
        selesaiLewatSla: 0,
        tinggiDarurat: 0,
        byGangguan: {},
        byWilayah: {},
        byJam: {},
        score: 0
      };
    }

    var c = result.byCabangDetail[cabang];
    c.total++;
    if (isActive) c.active++;
    if (isSelesai) c.selesai++;
    if (status === 'Ditunda') c.ditunda++;
    if (status === 'Batal') c.batal++;
    if (isAnyLate) c.lewatSla++;
    if (isActiveOverdue) c.activeLewatSla++;
    if (isCompletedLate) c.selesaiLewatSla++;
    if (d.prioritas === 'Tinggi' || d.prioritas === 'Darurat') c.tinggiDarurat++;
    incMap_(c.byGangguan, jenis);
    incMap_(c.byWilayah, wilayah);
    incMap_(c.byJam, getJamBucketDireksi_(d.waktuMasukDate));

    if (isActiveOverdue || isCompletedLate) {
      var item = {
        id: d.id,
        cabang: cabang,
        wilayah: wilayah,
        jenisGangguan: jenis,
        status: status,
        prioritas: d.prioritas || '',
        statusSla: isCompletedLate ? 'Selesai terlambat' : 'Aktif lewat SLA',
        lewatJam: Math.round((slaInfo.lateHours || 0) * 10) / 10,
        lewatText: formatDurasiSla_(slaInfo.lateHours || 0),
        waktuMasuk: d.waktuMasuk || '',
        batasSla: slaInfo.dueAt ? formatDateForWa_(slaInfo.dueAt) : '',
        waktuSelesai: d.waktuSelesai || '',
        selesaiTerlambat: isCompletedLate
      };

      result.slaLateList.push(item);
      if (isActiveOverdue) result.overdueList.push(item);
      if (isCompletedLate) result.completedLateList.push(item);
    }
  });

  result.selesaiPercent = result.total ? Math.round((result.selesai / result.total) * 100) : 0;
  result.topCabang = mapToTopList_(result.byCabang, 12);
  result.topGangguan = mapToTopList_(result.byGangguan, 8);
  result.topWilayah = mapToTopList_(result.byWilayah, 8);

  result.overdueList.sort(function(a, b) { return (b.lewatJam || 0) - (a.lewatJam || 0); });
  result.completedLateList.sort(function(a, b) { return (b.lewatJam || 0) - (a.lewatJam || 0); });
  result.slaLateList.sort(function(a, b) {
    // Yang aktif lewat SLA tetap ditaruh dulu, lalu riwayat selesai terlambat.
    if (!!b.selesaiTerlambat !== !!a.selesaiTerlambat) return a.selesaiTerlambat ? 1 : -1;
    return (b.lewatJam || 0) - (a.lewatJam || 0);
  });

  var details = result.byCabangDetail || {};
  var prior = [];
  Object.keys(details).forEach(function(cabang) {
    var c = details[cabang];
    c.topGangguan = mapToTopList_(c.byGangguan, 1)[0] ? mapToTopList_(c.byGangguan, 1)[0].name : '-';
    c.topWilayah = mapToTopList_(c.byWilayah, 1)[0] ? mapToTopList_(c.byWilayah, 1)[0].name : '-';
    c.jamRawan = mapToTopList_(c.byJam, 1)[0] ? mapToTopList_(c.byJam, 1)[0].name : '-';
    c.selesaiPercent = c.total ? Math.round((c.selesai / c.total) * 100) : 0;
    c.score = (c.total || 0) + (c.active || 0) * 2 + (c.lewatSla || 0) * 4 + (c.ditunda || 0) * 2 + (c.tinggiDarurat || 0) * 2;
    c.risk = c.activeLewatSla >= 3 || c.score >= 35 ? 'Tinggi' : (c.score >= 15 ? 'Sedang' : 'Rendah');
    prior.push(c);
  });

  prior.sort(function(a, b) {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (b.total || 0) - (a.total || 0);
  });

  result.cabangPrioritas = prior.map(function(c) {
    return {
      cabang: c.cabang,
      total: c.total,
      active: c.active,
      selesai: c.selesai,
      selesaiPercent: c.selesaiPercent,
      ditunda: c.ditunda,
      lewatSla: c.lewatSla,
      activeLewatSla: c.activeLewatSla,
      selesaiLewatSla: c.selesaiLewatSla,
      tinggiDarurat: c.tinggiDarurat,
      topGangguan: c.topGangguan,
      topWilayah: c.topWilayah,
      jamRawan: c.jamRawan,
      score: c.score,
      risk: c.risk
    };
  });

  if (cabangFilter) {
    var targetKey = normalizeCabangKey_(cabangFilter);
    for (var k = 0; k < result.cabangPrioritas.length; k++) {
      if (normalizeCabangKey_(result.cabangPrioritas[k].cabang) === targetKey) {
        result.targetCabang = result.cabangPrioritas[k];
        break;
      }
    }
  }

  return result;
}

function getAduanSlaFinalInfo_(d, now) {
  d = d || {};
  now = now || new Date();

  var masuk = d.waktuMasukDate || toSafeDate_(d.waktuMasuk) || null;
  if (!masuk || isNaN(masuk.getTime())) {
    return {
      valid: false,
      isLate: false,
      isActiveLate: false,
      isCompletedLate: false,
      lateHours: 0,
      durationHours: 0,
      dueAt: null
    };
  }

  var status = String(d.status || '').trim();
  var isSelesai = status === 'Selesai';
  var isClosed = isSelesai || status === 'Batal';

  var selesai = d.waktuSelesaiDate || toSafeDate_(d.waktuSelesai) || null;
  var updated = d.updatedAtDate || toSafeDate_(d.updatedAt) || null;

  // Jika status sudah selesai tapi Waktu Selesai kosong, pakai Updated At sebagai fallback.
  var endTime = isClosed ? (selesai || updated || now) : now;

  var slaJam = Number(d.slaJam || getSlaJamForPrioritas_(d.prioritas));
  if (!slaJam || slaJam <= 0) slaJam = 8;

  var dueAt = new Date(masuk.getTime() + slaJam * 3600000);
  var durationHours = Math.max(0, (endTime.getTime() - masuk.getTime()) / 3600000);
  var lateHours = Math.max(0, (endTime.getTime() - dueAt.getTime()) / 3600000);
  var isLate = lateHours > 0;

  return {
    valid: true,
    slaJam: slaJam,
    dueAt: dueAt,
    endTime: endTime,
    durationHours: durationHours,
    lateHours: lateHours,
    isLate: isLate,
    isActiveLate: !isClosed && isLate,
    isCompletedLate: isSelesai && isLate,
    isClosedLate: isClosed && isLate,
    selesaiOnTime: isSelesai && !isLate
  };
}

function buildSlaPenangananText_(d) {
  var info = getAduanSlaFinalInfo_(d, new Date());
  if (!info || !info.valid) return '';

  var status = String(d.status || '').trim();
  if (status !== 'Selesai') return '';

  var durasi = formatDurasiSla_(info.durationHours || 0);
  if (info.isCompletedLate) {
    return 'Durasi penanganan: ' + durasi + ' · Lewat SLA sekitar ' + formatDurasiSla_(info.lateHours || 0);
  }

  return 'Durasi penanganan: ' + durasi + ' · SLA terpenuhi';
}

function incMap_(map, key) {
  key = String(key || '-').trim() || '-';
  map[key] = (map[key] || 0) + 1;
}

function mapToTopList_(map, limit) {
  limit = Number(limit || 5);
  return Object.keys(map || {}).map(function(k) {
    return { name: k, count: map[k] };
  }).sort(function(a, b) {
    return (b.count || 0) - (a.count || 0);
  }).slice(0, limit);
}

function getJamBucketDireksi_(dateObj) {
  var d = toSafeDate_(dateObj) || new Date(dateObj);
  if (!d || isNaN(d.getTime())) return '-';

  var h = d.getHours();
  if (h >= 6 && h < 10) return '06.00-10.00';
  if (h >= 10 && h < 14) return '10.00-14.00';
  if (h >= 14 && h < 18) return '14.00-18.00';
  if (h >= 18 && h < 24) return '18.00-24.00';
  return '00.00-06.00';
}

function buildDireksiShortInsight_(data) {
  data = data || {};
  if (!data.total) return 'Catatan: belum ada data cukup untuk membaca pola layanan.';

  var topCabang = data.topCabang && data.topCabang[0] ? data.topCabang[0].name : '-';
  var topGangguan = data.topGangguan && data.topGangguan[0] ? data.topGangguan[0].name : '-';

  if (data.activeLewatSla > 0) {
    return 'Catatan: perlu perhatian pada aduan aktif yang sedang melewati SLA, terutama cabang dengan volume laporan tertinggi.';
  }

  if (data.selesaiLewatSla > 0) {
    return 'Catatan: tidak ada/lebih sedikit kasus aktif, tetapi ada aduan aktif selesai terlambat yang tetap perlu dievaluasi.';
  }

  if (data.active > data.selesai) {
    return 'Catatan: aduan aktif masih lebih dominan, perlu percepatan update status dan tindak lanjut cabang.';
  }

  return 'Catatan: pola bulan ini didominasi ' + topGangguan + ' dengan kontribusi tertinggi dari ' + topCabang + '.';
}

function buildDireksiCabangRuleBasedAnalysis_(c, data) {
  c = c || {};
  var lines = [
    '🏢 *Analisis ' + (c.cabang || 'Cabang') + '*',
    '',
    'Periode: ' + ((data && data.periodeLabel) || '-'),
    'Status risiko: *' + (c.risk || '-') + '*',
    '',
    'Ringkasan:',
    '- Total aduan: ' + (c.total || 0),
    '- Aktif: ' + (c.active || 0),
    '- Selesai: ' + (c.selesai || 0) + ' (' + (c.selesaiPercent || 0) + '%)',
    '- Lewat/Telat SLA: ' + (c.lewatSla || 0) + ' (Aktif ' + (c.activeLewatSla || 0) + ', selesai telat ' + (c.selesaiLewatSla || 0) + ')',
    '- Gangguan dominan: ' + (c.topGangguan || '-'),
    '- Wilayah dominan: ' + (c.topWilayah || '-'),
    '- Jam rawan: ' + (c.jamRawan || '-'),
    '',
    'Diagnosis:',
    buildDireksiDiagnosisLine_(c),
    '',
    'Rekomendasi:',
    '1. Fokuskan monitoring pada wilayah dominan.',
    '2. Prioritaskan aduan aktif yang sedang lewat SLA dan evaluasi riwayat selesai terlambat.',
    '3. Wajibkan catatan penyebab lapangan saat status selesai.',
    '4. Evaluasi progres cabang selama 7 hari.',
    '',
    'Ketik *5* untuk tanya TIARA Asisten Virtual lebih dalam.'
  ];

  return lines.join('\n');
}

function buildDireksiDiagnosisLine_(c) {
  c = c || {};
  if ((c.activeLewatSla || 0) > 0) {
    return 'Masalah utama bukan hanya jumlah aduan, tetapi kecepatan penanganan karena masih ada laporan aktif yang melewati SLA.';
  }
  if ((c.selesaiLewatSla || 0) > 0) {
    return 'Tidak ada masalah aktif yang dominan, tetapi ada riwayat penyelesaian terlambat. Ini perlu menjadi bahan evaluasi kecepatan respon cabang.';
  }
  if ((c.topGangguan || '').toLowerCase().indexOf('air mati') !== -1 || (c.topGangguan || '').toLowerCase().indexOf('tekanan') !== -1) {
    return 'Pola gangguan mengarah ke distribusi/tekanan jaringan, sehingga perlu pengecekan zona layanan dan jam rawan.';
  }
  if ((c.topGangguan || '').toLowerCase().indexOf('pipa') !== -1) {
    return 'Pola gangguan mengarah ke gangguan fisik jaringan, sehingga perlu pengecekan titik berulang dan prioritas perbaikan pipa.';
  }
  return 'Cabang perlu dipantau dari kombinasi volume aduan, aduan aktif, dan pola gangguan dominan.';
}

function isDireksiSensitiveHrQuestion_(text) {
  text = String(text || '').toLowerCase();
  var keys = [
    'pecat', 'dipecat', 'memecat',
    'copot', 'dicopot',
    'ganti', 'diganti',
    'mutasi', 'dimutasi',
    'pindah', 'dipindahkan',
    'rotasi', 'kepala cabang',
    'kacab', 'kepala'
  ];

  var hit = 0;
  for (var i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) !== -1) hit++;
  }

  // Minimal ada unsur jabatan/orang + tindakan SDM.
  var hasPerson = text.indexOf('kepala') !== -1 || text.indexOf('kacab') !== -1 || text.indexOf('pegawai') !== -1 || text.indexOf('petugas') !== -1;
  var hasAction = text.indexOf('pecat') !== -1 || text.indexOf('copot') !== -1 || text.indexOf('ganti') !== -1 || text.indexOf('mutasi') !== -1 || text.indexOf('pindah') !== -1 || text.indexOf('rotasi') !== -1;

  return hasPerson && hasAction;
}

function getDireksiFriendlyGeminiFallbackNote_(error) {
  error = String(error || '');

  if (/503|high demand|overload|unavailable/i.test(error)) {
    return 'AI sedang sibuk sementara, jadi saya tampilkan analisis dari hitungan data SIAGA dulu.';
  }

  if (/429|rate limit|quota/i.test(error)) {
    return 'Kuota/rate limit AI sedang terbatas, jadi saya tampilkan analisis dari hitungan data SIAGA dulu.';
  }

  if (/api key|belum disimpan|permission|403|401/i.test(error)) {
    return 'API AI belum aktif/izin belum sesuai, jadi saya tampilkan analisis dari hitungan data SIAGA dulu.';
  }

  return 'Jawaban sementara dibuat dari hitungan data SIAGA.';
}

function buildDireksiAIWithoutGeminiReply_(question, data, error) {
  question = String(question || '').trim();
  data = data || {};

  var target = data.targetCabang || null;
  var top = data.cabangPrioritas && data.cabangPrioritas.length ? data.cabangPrioritas[0] : null;
  var isHr = isDireksiSensitiveHrQuestion_(question);

  var lines = [
    '🤖 *TIARA Asisten Virtual - Mode Data Sistem*',
    '',
    getDireksiFriendlyGeminiFallbackNote_(error)
  ];

  lines.push('');

  if (isHr) {
    lines.push('Untuk pertanyaan yang menyangkut pegawai/jabatan, SIAGA TIARA tidak memberikan keputusan personal seperti pecat, copot, atau mutasi langsung.');
    lines.push('');
    lines.push('Yang bisa dibaca dari sistem adalah indikator layanan cabang sebagai bahan evaluasi manajemen.');

    var c = target || top;
    if (c) {
      lines.push('');
      lines.push('Indikator cabang yang perlu dilihat saat ini:');
      lines.push('- Cabang perhatian: *' + c.cabang + '*');
      lines.push('- Total aduan: ' + (c.total || 0));
      lines.push('- Aduan aktif: ' + (c.active || 0));
      lines.push('- Lewat/Telat SLA: ' + (c.lewatSla || 0) + ' (Aktif ' + (c.activeLewatSla || 0) + ', selesai telat ' + (c.selesaiLewatSla || 0) + ')');
      lines.push('- Gangguan dominan: ' + (c.topGangguan || '-'));
      lines.push('- Wilayah dominan: ' + (c.topWilayah || '-'));
    }

    lines.push('');
    lines.push('Rekomendasi aman:');
    lines.push('1. Lakukan evaluasi kinerja cabang 30 hari.');
    lines.push('2. Tetapkan target penurunan aduan aktif dan keterlambatan SLA.');
    lines.push('3. Minta rencana tindak lanjut dari kepala cabang terkait.');
    lines.push('4. Jika tidak ada perbaikan, direksi dapat mempertimbangkan pembinaan, pendampingan, atau rotasi sesuai kebijakan perusahaan.');
    lines.push('');
    lines.push('Kesimpulan: data SIAGA dapat menjadi dasar evaluasi, bukan dasar keputusan pecat/copot secara langsung.');
    return lines.join('\n');
  }

  if (target) {
    lines.push(buildDireksiCabangRuleBasedAnalysis_(target, data));
    return lines.join('\n');
  }

  if (top) {
    lines.push('Cabang yang paling perlu perhatian saat ini adalah *' + top.cabang + '*.');
    lines.push('');
    lines.push('Alasannya:');
    lines.push('- Total aduan: ' + (top.total || 0));
    lines.push('- Aduan aktif: ' + (top.active || 0));
    lines.push('- Lewat/Telat SLA: ' + (top.lewatSla || 0) + ' (Aktif ' + (top.activeLewatSla || 0) + ', selesai telat ' + (top.selesaiLewatSla || 0) + ')');
    lines.push('- Gangguan dominan: ' + (top.topGangguan || '-'));
    lines.push('- Wilayah dominan: ' + (top.topWilayah || '-'));
    lines.push('');
    lines.push('Saran awal: lakukan monitoring 7 hari, fokus pada wilayah dominan, selesaikan aduan aktif yang lewat SLA, dan evaluasi riwayat selesai terlambat.');
  } else {
    lines.push('Belum ada data cukup untuk membuat analisis cabang.');
  }

  return lines.join('\n');
}

function testDireksiRingkasanLayanan() {
  var reply = handleDireksiRingkasanLayanan_('', { nama: 'Direksi' }).reply;
  SpreadsheetApp.getUi().alert('Tes Ringkasan Direksi', reply, SpreadsheetApp.getUi().ButtonSet.OK);
  return reply;
}


