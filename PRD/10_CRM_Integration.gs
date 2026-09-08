// ============================================================
// SIAGA TIARA V11 - CRM INBOX INTEGRATION
// Backend proxy + outbox. API key tidak pernah dikirim ke browser.
// ============================================================

var CRM_OUTBOX_SHEET_ = 'CRM_OUTBOX';
var CRM_DEFAULT_BASE_URL_ = 'https://crm.perumdamtiaraloteng.id';

function crmGetConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    enabled: String(props.getProperty('CRM_ENABLED') || 'TRUE').toUpperCase() !== 'FALSE',
    baseUrl: String(props.getProperty('CRM_API_BASE_URL') || CRM_DEFAULT_BASE_URL_).replace(/\/+$/, ''),
    apiKey: String(props.getProperty('CRM_API_KEY') || '').trim()
  };
}

function crmValidateBaseUrl_(value) {
  var baseUrl = String(value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) baseUrl = CRM_DEFAULT_BASE_URL_;
  if (baseUrl.length > 300 || !/^https:\/\/[A-Za-z0-9.-]+(?::\d{2,5})?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*)?$/.test(baseUrl)) {
    throw new Error('URL API CRM harus berupa alamat HTTPS yang valid, contoh: https://crm.perumdamtiaraloteng.id');
  }
  return baseUrl;
}

function crmValidateApiKey_(value) {
  var apiKey = String(value || '').trim();
  if (apiKey.length < 32 || apiKey.length > 500 || /\s/.test(apiKey)) {
    throw new Error('API key CRM harus minimal 32 karakter dan tidak boleh mengandung spasi.');
  }
  return apiKey;
}

function crmGetAdminConfigSummary_() {
  var config = crmGetConfig_();
  var suffix = config.apiKey ? config.apiKey.slice(-4) : '';
  return {
    enabled: !!config.enabled,
    baseUrl: config.baseUrl,
    apiKeyConfigured: !!config.apiKey,
    apiKeyMask: suffix ? ('••••' + suffix) : ''
  };
}

function crmConfigFromAdminPayload_(payload) {
  payload = payload || {};
  var current = crmGetConfig_();
  var apiKey = String(payload.apiKey || '').trim();
  return {
    enabled: payload.enabled === undefined ? current.enabled : !!payload.enabled,
    baseUrl: crmValidateBaseUrl_(payload.baseUrl || current.baseUrl),
    apiKey: apiKey ? crmValidateApiKey_(apiKey) : current.apiKey
  };
}

// API key tidak pernah dikembalikan ke browser. Kolom kosong berarti mempertahankan key lama.
function clientSaveCrmAdminConfig(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    var config = crmConfigFromAdminPayload_(payload);
    if (!config.apiKey) throw new Error('Masukkan API key CRM terlebih dahulu.');

    PropertiesService.getScriptProperties().setProperties({
      CRM_ENABLED: config.enabled ? 'TRUE' : 'FALSE',
      CRM_API_BASE_URL: config.baseUrl,
      CRM_API_KEY: config.apiKey
    }, false);
    crmGetOrCreateOutboxSheet_();
    crmEnsureFlushTrigger_();
    return {
      success: true,
      crm: crmGetAdminConfigSummary_(),
      message: 'Konfigurasi CRM tersimpan aman dan trigger sinkronisasi sudah aktif.'
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

// Dapat menguji nilai yang baru ditempel sebelum disimpan. Rahasia tetap diproses di server.
function clientTestCrmAdminConfig(payload) {
  try {
    payload = payload || {};
    ensureAdminDashboardAccess_(payload._sessionToken || payload.token || '');
    var config = crmConfigFromAdminPayload_(payload);
    if (!config.apiKey) throw new Error('Masukkan atau simpan API key CRM terlebih dahulu.');
    config.enabled = true;
    var health = crmApiRequestWithConfig_(config, '/health', 'get', null, null, true);
    var stats = crmApiRequestWithConfig_(config, '/api/v1/stats', 'get', null, null, false);
    return {
      success: true,
      message: 'Koneksi berhasil. API key diterima dan database CRM terhubung.',
      service: health.service || 'SIAGA CRM API',
      database: health.database || 'connected',
      stats: stats.data || {}
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function crmSetupIntegration() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CRM_API_BASE_URL')) props.setProperty('CRM_API_BASE_URL', CRM_DEFAULT_BASE_URL_);
  if (!props.getProperty('CRM_ENABLED')) props.setProperty('CRM_ENABLED', 'TRUE');
  crmGetOrCreateOutboxSheet_();
  crmEnsureFlushTrigger_();

  var config = crmGetConfig_();
  return {
    success: true,
    configured: !!config.apiKey,
    message: config.apiKey
      ? 'CRM aktif. Antrean sinkronisasi dan trigger 1 menit sudah siap.'
      : 'Antrean CRM siap. Isi CRM_API_KEY di Script Properties lalu jalankan fungsi ini sekali lagi.'
  };
}

function crmEnsureFlushTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'crmFlushOutbox';
  });
  if (!exists) {
    ScriptApp.newTrigger('crmFlushOutbox').timeBased().everyMinutes(1).create();
  }
}

function crmGetOrCreateOutboxSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CRM_OUTBOX_SHEET_);
  if (!sh) sh = ss.insertSheet(CRM_OUTBOX_SHEET_);
  var headers = ['Created At', 'Dedup Key', 'Payload JSON', 'Attempts', 'Last Error', 'Available At'];
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setBackground('#111827').setFontColor('#ffffff').setFontWeight('bold');
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 250);
    sh.setColumnWidth(3, 500);
    sh.setColumnWidth(4, 80);
    sh.setColumnWidth(5, 320);
    sh.setColumnWidth(6, 150);
  } catch(e) {}
  return sh;
}

function crmSafeJsonParse_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch(e) { return {}; }
}

function crmNormalizePhone_(value) {
  var phone = String(value || '').replace(/\D/g, '');
  if (phone.indexOf('0') === 0) phone = '62' + phone.substring(1);
  if (phone && phone.indexOf('62') !== 0) phone = '62' + phone;
  return phone.substring(0, 30);
}

function crmFindFirst_(obj, keys) {
  obj = obj || {};
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') return obj[keys[i]];
  }
  return '';
}

function crmExtractInboundMeta_(rawPayload) {
  var obj = crmSafeJsonParse_(rawPayload);
  var data = obj.data || {};
  var customer = data.customer || obj.customer || {};
  var location = data.location || obj.location || {};
  var media = data.media || obj.media || {};
  var resolvedCustomerName = '';
  try {
    if (typeof extractCustomerNameFromPayload_ === 'function') resolvedCustomerName = extractCustomerNameFromPayload_(obj) || '';
  } catch(eCustomerName) {}
  return {
    customerId: crmFindFirst_(data, ['customer_id', 'customerId']) || crmFindFirst_(obj, ['customer_id', 'customerId']) || customer.id || '',
    customerName: resolvedCustomerName || crmFindFirst_(data, ['customer_name', 'customerName', 'name']) || crmFindFirst_(obj, ['customer_name', 'customerName']) || customer.name || '',
    externalMessageId: crmFindFirst_(data, ['message_id', 'messageId', 'id']) || crmFindFirst_(obj, ['message_id', 'messageId', 'id']) || '',
    messageType: crmFindFirst_(data, ['message_type', 'messageType', 'type']) || crmFindFirst_(obj, ['message_type', 'messageType', 'type']) || 'text',
    mediaUrl: crmFindFirst_(data, ['media_url', 'mediaUrl', 'file_url', 'url']) || crmFindFirst_(media, ['url', 'link']) || '',
    mediaCaption: crmFindFirst_(data, ['caption', 'media_caption']) || crmFindFirst_(media, ['caption']) || '',
    latitude: crmFindFirst_(data, ['latitude', 'lat']) || crmFindFirst_(location, ['latitude', 'lat']) || '',
    longitude: crmFindFirst_(data, ['longitude', 'lng', 'lon']) || crmFindFirst_(location, ['longitude', 'lng', 'lon']) || ''
  };
}

function crmGetAduanContextSafe_(idAduan) {
  var id = String(idAduan || '').trim();
  if (!id || id === '-') return {};
  try {
    var aduan = findAduanById_(id);
    if (!aduan) return {};
    return {
      customerName: aduan.namaPelanggan || '',
      customerNumber: getNoPelangganFromAduan_(aduan) || aduan.noPelanggan || '',
      branchName: aduan.cabang || '',
      branchCode: getCabangCodeSafe_(aduan.cabang || '') || ''
    };
  } catch(e) {
    return {};
  }
}

function crmEnqueuePayload_(payload) {
  try {
    var config = crmGetConfig_();
    if (!config.enabled || !payload || !payload.phone) return false;
    var sh = crmGetOrCreateOutboxSheet_();
    var dedupKey = String(payload.externalMessageId || payload.dedupKey || Utilities.getUuid());
    payload.externalMessageId = dedupKey;
    sh.appendRow([new Date(), dedupKey, JSON.stringify(payload), 0, '', new Date()]);
    return true;
  } catch(e) {
    return false;
  }
}

// Dipanggil setelah LOG_WHATSAPP berhasil ditulis. Hanya enqueue; tidak memanggil internet.
function crmMirrorLogWhatsApp_(phone, message, jenis, idAduan, reply, status, rawPayload) {
  try {
    var normalizedPhone = crmNormalizePhone_(phone);
    if (!normalizedPhone) return;
    var kind = String(jenis || '').toUpperCase();
    var rawMeta = crmExtractInboundMeta_(rawPayload);
    var context = crmGetAduanContextSafe_(idAduan);
    var rememberedCustomerName = '';
    try {
      if (typeof getRememberedWhatsAppCustomerName_ === 'function') rememberedCustomerName = getRememberedWhatsAppCustomerName_(normalizedPhone) || '';
    } catch(eRememberedName) {}
    var rootDedup = rawMeta.externalMessageId || Utilities.getUuid();
    var timestamp = new Date().toISOString();
    var common = {
      phone: normalizedPhone,
      customerId: rawMeta.customerId || '',
      customerName: rawMeta.customerName || context.customerName || rememberedCustomerName || '',
      customerNumber: context.customerNumber || '',
      branchCode: context.branchCode || '',
      branchName: context.branchName || '',
      aduanId: String(idAduan || '').replace(/^[-]+$/, ''),
      timestamp: timestamp,
      rawPayload: rawPayload || '',
      metadata: { source: 'SIAGA_TIARA', eventType: jenis || '' }
    };

    var isAgentAction = kind.indexOf('AGENT_CHAT_') === 0;
    var isSystemSkip = kind.indexOf('SKIP') !== -1 || kind.indexOf('DEBOUNCE') !== -1 || kind.indexOf('DUPLICATE') !== -1;

    if (message && !isAgentAction && !isSystemSkip) {
      var inbound = JSON.parse(JSON.stringify(common));
      inbound.externalMessageId = rootDedup + ':in';
      inbound.direction = 'inbound';
      inbound.senderType = 'customer';
      inbound.senderName = inbound.customerName || 'Pelanggan';
      inbound.messageType = rawMeta.messageType || 'text';
      inbound.body = String(message || '');
      inbound.mediaUrl = rawMeta.mediaUrl || '';
      inbound.mediaCaption = rawMeta.mediaCaption || '';
      inbound.latitude = rawMeta.latitude || '';
      inbound.longitude = rawMeta.longitude || '';
      inbound.eventType = jenis || 'INBOUND';
      crmEnqueuePayload_(inbound);
    }

    if (reply) {
      var outbound = JSON.parse(JSON.stringify(common));
      outbound.externalMessageId = rootDedup + ':out';
      outbound.direction = 'outbound';
      outbound.senderType = kind === 'AGENT_CHAT_REPLY' ? 'admin' : 'bot';
      outbound.senderName = kind === 'AGENT_CHAT_REPLY' ? 'Petugas SIAGA' : 'SIAGA TIARA';
      outbound.messageType = 'text';
      outbound.body = String(reply || '');
      outbound.eventType = jenis || 'OUTBOUND';
      outbound.deliveryStatus = String(status || '');
      crmEnqueuePayload_(outbound);
    } else if (isAgentAction && message) {
      var system = JSON.parse(JSON.stringify(common));
      system.externalMessageId = rootDedup + ':system';
      system.direction = 'system';
      system.senderType = 'system';
      system.senderName = 'SIAGA TIARA';
      system.messageType = 'event';
      system.body = String(message || '');
      system.eventType = jenis || 'SYSTEM';
      crmEnqueuePayload_(system);
    }
  } catch(e) {
    // Fail-open: gangguan CRM tidak boleh menghentikan chatbot.
  }
}

function crmApiRequestWithConfig_(config, path, method, payload, query, allowDisabled) {
  if (!config.enabled && !allowDisabled) throw new Error('CRM sedang dinonaktifkan.');
  if (!allowDisabled && !config.apiKey) throw new Error('CRM_API_KEY belum diisi.');
  var url = config.baseUrl + path;
  var parts = [];
  Object.keys(query || {}).forEach(function(key) {
    var value = query[key];
    if (value === '' || value === null || value === undefined) return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  if (parts.length) url += '?' + parts.join('&');

  var options = {
    method: String(method || 'get').toLowerCase(),
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'X-SIAGA-API-Key': config.apiKey,
      'Accept': 'application/json'
    }
  };
  if (payload !== undefined && payload !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText() || '';
  var parsed = crmSafeJsonParse_(text);
  if (code < 200 || code >= 300) {
    throw new Error(parsed.error || ('CRM HTTP ' + code));
  }
  return parsed;
}

function crmApiRequest_(path, method, payload, query) {
  return crmApiRequestWithConfig_(crmGetConfig_(), path, method, payload, query, false);
}

function crmFlushOutbox() {
  // Trigger CRM berjalan setiap menit. Sekalian jalankan penjaga timeout sesi
  // agar Chat Admin yang belum dijawab 15 menit tetap ditutup walau dashboard
  // tidak sedang dibuka. Tetap dijalankan meskipun sinkronisasi CRM dinonaktifkan.
  try { checkInactiveWhatsAppSessions_(); } catch(eSessionSweep) {}

  var config = crmGetConfig_();
  if (!config.enabled || !config.apiKey) return { success: false, skipped: true, error: 'CRM belum dikonfigurasi.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { success: false, skipped: true, error: 'Sinkronisasi lain sedang berjalan.' };
  try {
    var sh = crmGetOrCreateOutboxSheet_();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: true, processed: 0 };
    var rowCount = Math.min(lastRow - 1, 50);
    var rows = sh.getRange(2, 1, rowCount, 6).getValues();
    var now = new Date();
    var selected = [];
    rows.forEach(function(row, index) {
      var availableAt = row[5] instanceof Date ? row[5] : new Date(row[5] || 0);
      if (availableAt.getTime() <= now.getTime()) {
        selected.push({ rowNumber: index + 2, payload: crmSafeJsonParse_(row[2]), attempts: Number(row[3] || 0) });
      }
    });
    if (!selected.length) return { success: true, processed: 0 };

    var result = crmApiRequest_('/api/v1/ingest/batch', 'post', { items: selected.map(function(item) { return item.payload; }) });
    var resultRows = result.results || [];
    var deleteRows = [];
    selected.forEach(function(item, index) {
      var itemResult = resultRows[index] || { success: !!result.success, error: result.error || '' };
      if (itemResult.success) {
        deleteRows.push(item.rowNumber);
      } else {
        var attempts = item.attempts + 1;
        var retryMinutes = Math.min(60, Math.pow(2, Math.min(attempts, 6)));
        sh.getRange(item.rowNumber, 4, 1, 3).setValues([[attempts, String(itemResult.error || 'Gagal sinkronisasi').substring(0, 500), new Date(now.getTime() + retryMinutes * 60000)]]);
      }
    });
    deleteRows.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) { sh.deleteRow(rowNumber); });
    return { success: true, processed: selected.length, sent: deleteRows.length, failed: selected.length - deleteRows.length };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  } finally {
    lock.releaseLock();
  }
}

function crmRequireDashboardUser_(form) {
  form = form || {};
  var user = validateDashboardSession_(form._sessionToken || form.sessionToken || '');
  if (!user) throw new Error('Sesi login sudah habis. Silakan masuk kembali.');
  if (!crmIsAdminUser_(user)) {
    throw new Error('CRM hanya tersedia untuk akun Admin Pusat.');
  }
  return user;
}

function crmIsAdminUser_(user) {
  return !!(user && (user.canSeeAll || String(user.cabang || '').toUpperCase() === 'ALL'));
}

function crmBranchForUser_(user) {
  return crmIsAdminUser_(user) ? '' : String(user.cabang || '').trim();
}

function crmCanAccessConversation_(user, conversation) {
  if (crmIsAdminUser_(user)) return true;
  var allowed = String(user.cabang || '').toLowerCase().trim();
  var branch = String((conversation && (conversation.branch_name || conversation.assigned_branch)) || '').toLowerCase().trim();
  return !!allowed && !!branch && (branch === allowed || branch.indexOf(allowed) !== -1 || allowed.indexOf(branch) !== -1);
}

function crmEnrichConversationCustomer_(row) {
  row = row || {};
  var phone = crmNormalizePhone_(row.phone || '');
  var name = String(row.customer_name || '').trim();
  if (/^\+?\d[\d\s().-]{5,}$/.test(name) || name.toLowerCase() === 'pelanggan') name = '';
  if (!name && phone) {
    try {
      if (typeof getRememberedWhatsAppCustomerName_ === 'function') name = getRememberedWhatsAppCustomerName_(phone) || '';
    } catch(eRemembered) {}
  }
  if (name) row.customer_name = name;
  return row;
}

function crmListAccessibleConversations_(user, options) {
  options = options || {};
  var limit = Math.max(1, Math.min(Number(options.limit || 50), 100));
  var query = {
    limit: limit,
    offset: Math.max(0, Number(options.offset || 0)),
    status: options.status || '',
    search: options.search || '',
    branch: crmBranchForUser_(user)
  };
  var result = crmApiRequest_('/api/v1/conversations', 'get', null, query);
  var rows = (result.data || []).filter(function(row) { return crmCanAccessConversation_(user, row); }).map(crmEnrichConversationCustomer_);
  return { rows: rows, limit: result.limit || limit, offset: result.offset || 0 };
}

function crmFindAccessibleConversation_(user, conversationId) {
  var wanted = Number(conversationId || 0);
  if (!wanted) return null;
  var result = crmListAccessibleConversations_(user, { limit: 100 });
  for (var i = 0; i < result.rows.length; i++) {
    if (Number(result.rows[i].id) === wanted) return result.rows[i];
  }
  return null;
}

function clientCrmBootstrap(form) {
  try {
    var user = crmRequireDashboardUser_(form);
    var config = crmGetConfig_();
    var health = { success: false };
    try {
      var healthResponse = UrlFetchApp.fetch(config.baseUrl + '/health', { muteHttpExceptions: true, followRedirects: true });
      health = crmSafeJsonParse_(healthResponse.getContentText());
      health.httpCode = healthResponse.getResponseCode();
    } catch(eHealth) {
      health = { success: false, error: eHealth.message || String(eHealth) };
    }
    var list = crmListAccessibleConversations_(user, { limit: 100 });
    var stats = { total: 0, open: 0, pending: 0, in_progress: 0, done: 0, unread: 0 };
    list.rows.forEach(function(row) {
      stats.total++;
      if (stats[row.status] !== undefined) stats[row.status]++;
      stats.unread += Number(row.unread_count || 0);
    });
    return {
      success: true,
      health: health,
      stats: stats,
      conversations: list.rows.slice(0, 50),
      user: { nama: user.nama || '', role: user.role || '', cabang: user.cabang || '', canSeeAll: !!user.canSeeAll },
      configured: !!config.apiKey,
      checkedAt: new Date().toISOString()
    };
  } catch(e) {
    return { success: false, error: e.message || String(e), needLogin: String(e.message || '').indexOf('Sesi login') !== -1 };
  }
}

function clientCrmListConversations(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var list = crmListAccessibleConversations_(user, {
      status: form.status || '', search: form.search || '', limit: form.limit || 50, offset: form.offset || 0
    });
    return { success: true, conversations: list.rows, limit: list.limit, offset: list.offset };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmGetMessages(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var conversation = crmFindAccessibleConversation_(user, form.conversationId);
    if (!conversation) return { success: false, error: 'Percakapan tidak ditemukan atau bukan akses cabang Anda.' };
    var messages = crmApiRequest_('/api/v1/conversations/' + Number(conversation.id) + '/messages', 'get', null, { limit: Math.min(Number(form.limit || 120), 200) });
    try { crmApiRequest_('/api/v1/conversations/' + Number(conversation.id) + '/read', 'post', {}); } catch(eRead) {}
    conversation.unread_count = 0;
    var agentChat = { active: false, phone: conversation.phone || '' };
    try { agentChat = getAgentChatStatusByPhone_(conversation.phone || ''); } catch(eAgentStatus) {}
    try {
      var replyWindow = getChatAdmin24hWindowInfo_(conversation.phone || '', agentChat.data || {});
      agentChat.windowInfo = replyWindow;
      agentChat.canReply = !!(replyWindow && replyWindow.canReply);
    } catch(eReplyWindow) {
      // Gagal membaca window harus fail-closed: server pengiriman tetap melakukan
      // pemeriksaan yang sama sebelum mengirim pesan bebas.
      agentChat.canReply = false;
      agentChat.windowInfo = { canReply: false, reason: 'WINDOW_CHECK_FAILED' };
    }
    return { success: true, conversation: conversation, messages: messages.data || [], agentChat: agentChat };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmUpdateConversation(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var conversation = crmFindAccessibleConversation_(user, form.conversationId);
    if (!conversation) return { success: false, error: 'Percakapan tidak ditemukan atau bukan akses cabang Anda.' };
    var payload = {
      status: form.status || conversation.status || 'open',
      assignedStaffId: form.claim === true ? (user.username || user.nama || '') : (form.assignedStaffId || ''),
      assignedStaffName: form.claim === true ? (user.nama || user.username || '') : (form.assignedStaffName || ''),
      assignedBranch: crmIsAdminUser_(user) ? (form.assignedBranch || conversation.assigned_branch || conversation.branch_name || '') : (user.cabang || '')
    };
    var result = crmApiRequest_('/api/v1/conversations/' + Number(conversation.id), 'patch', payload);
    return { success: true, conversation: result.data || {} };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmSendReply(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var conversation = crmFindAccessibleConversation_(user, form.conversationId);
    if (!conversation) return { success: false, error: 'Percakapan tidak ditemukan atau bukan akses cabang Anda.' };
    var message = String(form.message || '').trim();
    if (!message) return { success: false, error: 'Pesan masih kosong.' };
    if (message.length > 4000) return { success: false, error: 'Pesan terlalu panjang. Maksimum 4.000 karakter.' };
    var phone = crmNormalizePhone_(conversation.phone || '');
    if (!phone) return { success: false, error: 'Nomor WhatsApp pelanggan tidak valid.' };

    var windowInfo = null;
    if (typeof getChatAdmin24hWindowInfo_ === 'function') {
      windowInfo = getChatAdmin24hWindowInfo_(phone, {});
      if (windowInfo && windowInfo.canReply === false) {
        return { success: false, blocked24h: true, error: buildChatAdmin24hClosedError_(windowInfo), windowInfo: windowInfo };
      }
    }

    // Setiap balasan dari CRM otomatis mengaktifkan human takeover.
    // Selama ADMIN_HANDOFF aktif, webhook tidak mengirim menu/balasan bot ke pelanggan.
    var previousAgentChat = { active: false };
    try { previousAgentChat = getAgentChatStatusByPhone_(phone); } catch(ePreviousAgent) {}
    var activeChatData = {
      context: 'Balasan dari CRM Inbox',
      aduanId: form.aduanId || conversation.aduan_id || '',
      activatedBy: user.nama || user.username || 'Petugas SIAGA',
      activatedByRole: user.role || '',
      source: 'crm_dashboard_reply',
      expiresMinutes: 15,
      lastAgentMessage: message,
      lastAgentMessageAt: new Date().toISOString(),
      nama: conversation.customer_name || ''
    };
    try { activateAgentChatSession_(phone, activeChatData, 15); } catch(eActivate) {}

    var send = sendWhatsAppMessage_(phone, message, {});
    var success = !!(send && send.success);
    if (!success && !(previousAgentChat && previousAgentChat.active)) {
      try { endAgentChatSession_(phone); } catch(eRollbackAgent) {}
    }
    logWhatsApp_(
      phone,
      'Balasan admin CRM',
      'AGENT_CHAT_REPLY',
      form.aduanId || '',
      message,
      success ? 'SENT' : ('FAILED: ' + ((send && send.error) || 'Unknown error')),
      JSON.stringify({ source: 'CRM_DASHBOARD', operator: user.nama || user.username || '', conversationId: conversation.id })
    );
    if (success) {
      try {
        crmApiRequest_('/api/v1/conversations/' + Number(conversation.id), 'patch', {
          status: 'in_progress',
          assignedStaffId: user.username || user.nama || '',
          assignedStaffName: user.nama || user.username || '',
          assignedBranch: crmIsAdminUser_(user) ? (conversation.branch_name || conversation.assigned_branch || '') : user.cabang
        });
      } catch(ePatch) {}
    }
    return {
      success: success,
      send: send,
      agentChat: { active: success || !!(previousAgentChat && previousAgentChat.active), phone: phone, canReply: !!(windowInfo && windowInfo.canReply), windowInfo: windowInfo || {} },
      message: success ? 'Pesan berhasil dikirim. Mode Chat Admin aktif dan menu bot dipause.' : ('Gagal mengirim: ' + ((send && send.error) || 'Unknown error'))
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmStartAgentChat(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var conversation = crmFindAccessibleConversation_(user, form.conversationId);
    if (!conversation) return { success: false, error: 'Percakapan tidak ditemukan atau bukan akses cabang Anda.' };
    var phone = crmNormalizePhone_(conversation.phone || '');
    if (!phone) return { success: false, error: 'Nomor WhatsApp pelanggan tidak valid.' };

    var windowInfo = getChatAdmin24hWindowInfo_(phone, {});
    if (windowInfo && windowInfo.canReply === false) {
      return { success: false, blocked24h: true, error: buildChatAdmin24hClosedError_(windowInfo), windowInfo: windowInfo };
    }

    var data = {
      context: 'Mode Chat Admin dari CRM',
      aduanId: form.aduanId || conversation.aduan_id || '',
      activatedBy: user.nama || user.username || 'Petugas SIAGA',
      activatedByRole: user.role || '',
      source: 'crm_dashboard',
      expiresMinutes: 15,
      nama: conversation.customer_name || ''
    };
    var result = activateAgentChatSession_(phone, data, 15);
    var active = !!(result && result.success);
    return { success: active, active: active, phone: phone, canReply: !!(windowInfo && windowInfo.canReply), windowInfo: windowInfo || {}, message: active ? 'Mode Chat Admin aktif. Menu dan balasan otomatis bot dipause untuk pelanggan ini.' : ((result && result.error) || 'Mode Chat Admin belum dapat diaktifkan.') };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmEndAgentChat(form) {
  try {
    form = form || {};
    var user = crmRequireDashboardUser_(form);
    var conversation = crmFindAccessibleConversation_(user, form.conversationId);
    if (!conversation) return { success: false, error: 'Percakapan tidak ditemukan atau bukan akses cabang Anda.' };
    var phone = crmNormalizePhone_(conversation.phone || '');
    if (!phone) return { success: false, error: 'Nomor WhatsApp pelanggan tidak valid.' };

    endAgentChatSession_(phone);
    var menuReply = buildMainWhatsAppMenuReply_(phone, {});
    var send = { success: false };
    try {
      if (typeof shouldUseInteractiveMenu_ === 'function' && shouldUseInteractiveMenu_() && typeof sendKiriminInteractiveMenu_ === 'function') {
        send = sendKiriminInteractiveMenu_(phone, { customerName: conversation.customer_name || getRememberedWhatsAppCustomerName_(phone) || '' });
      }
    } catch(eInteractive) {
      send = { success: false, error: eInteractive.message || String(eInteractive) };
    }
    if (!(send && send.success)) send = sendWhatsAppMessage_(phone, menuReply, {});

    logWhatsApp_(
      phone,
      'Akhiri Chat Admin dari CRM',
      'AGENT_CHAT_END',
      form.aduanId || conversation.aduan_id || '',
      menuReply,
      send && send.success ? 'SENT' : 'FAILED',
      JSON.stringify({ source: 'CRM_DASHBOARD', operator: user.nama || user.username || '', conversationId: conversation.id })
    );
    var menuSent = !!(send && send.success);
    return {
      success: true,
      active: false,
      menuSent: menuSent,
      send: send,
      message: menuSent ? 'Mode Chat Admin diakhiri. Menu layanan dikirim kembali ke pelanggan.' : 'Mode Chat Admin diakhiri, tetapi pengiriman menu gagal. Pelanggan dapat mengetik menu untuk membukanya kembali.'
    };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

function clientCrmFlushNow(form) {
  try {
    crmRequireDashboardUser_(form || {});
    return crmFlushOutbox();
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}
