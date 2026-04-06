const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function createApiHandler({ dataFile } = {}){
  const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const DB_FLUSH_DELAY_MS = Math.max(250, Number(process.env.MVS_DB_FLUSH_DELAY_MS || 1200));
  const SUPABASE_URL = String(process.env.MVS_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const SUPABASE_SERVICE_ROLE_KEY = String(
    process.env.MVS_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || ""
  ).trim();
  const ACCESS_INVITE_CODES = Array.from(new Set(
    String(process.env.MVS_ACCESS_INVITE_CODES || "")
      .split(",")
      .map((value) => normalizeInviteCode(value))
      .filter(Boolean)
  ));
  const ACCESS_OWNER_EMAILS = Array.from(new Set(
    String(process.env.MVS_ACCESS_OWNER_EMAILS || "")
      .split(",")
      .map((value) => normalizeAccessEmail(value))
      .filter(Boolean)
  ));
  let cachedDb = null;
  let dbLoaded = false;
  let flushTimer = null;
  let dbRevision = 0;
  let cachedIndex = null;
  let indexedDbRef = null;
  let indexedRevision = -1;

  function brl(value){
    return BRL_FORMATTER.format(Number(value || 0));
  }

  function roundMoney(value){
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function normalizeInviteCode(value){
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function normalizeAccessEmail(value){
    return String(value ?? "").trim().toLowerCase();
  }

  function isValidAccessEmail(value){
    const email = normalizeAccessEmail(value);
    return !!email && email.includes("@");
  }

  function passwordMeetsRules(password){
    const value = String(password || "");
    return value.length >= 6
      && /[a-z]/.test(value)
      && /[A-Z]/.test(value)
      && /\d/.test(value);
  }

  async function readJsonResponse(resp){
    try{
      return await resp.json();
    } catch {
      return null;
    }
  }

  function makeStatusError(message, statusCode = 400){
    const err = new Error(String(message || "Erro"));
    err.statusCode = statusCode;
    return err;
  }

  function formatSupabaseAdminError(data){
    const raw = String(
      data?.msg
      || data?.message
      || data?.error_description
      || data?.error?.message
      || data?.error
      || ""
    ).trim();
    const lowered = raw.toLowerCase();
    if (
      lowered.includes("already registered")
      || lowered.includes("user already registered")
      || lowered.includes("email_exists")
      || lowered.includes("has already been registered")
    ){
      return makeStatusError("Já existe uma conta com esse email.", 409);
    }
    if (
      lowered.includes("password should contain")
      || lowered.includes("weak password")
    ){
      return makeStatusError("A senha precisa ter pelo menos 6 caracteres, com letra maiúscula, letra minúscula e número.", 400);
    }
    return makeStatusError(raw || "Falha ao criar conta no Supabase.", 400);
  }

  function isControlledSignupConfigured(){
    return !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY;
  }

  function isOwnerAccessConfigured(){
    return !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY && ACCESS_OWNER_EMAILS.length > 0;
  }

  function extractBearerToken(req){
    const raw = String(req?.headers?.authorization || "").trim();
    const match = /^Bearer\s+(.+)$/i.exec(raw);
    return match ? String(match[1] || "").trim() : "";
  }

  function isOwnerEmail(email){
    const normalized = normalizeAccessEmail(email);
    return !!normalized && ACCESS_OWNER_EMAILS.includes(normalized);
  }

  async function getSupabaseUserFromToken(accessToken){
    const token = String(accessToken || "").trim();
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
    try{
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) return null;
      const data = await readJsonResponse(resp);
      return data?.user || data || null;
    } catch {
      return null;
    }
  }

  async function requireOwnerAccess(req, res){
    if (!isOwnerAccessConfigured()){
      sendError(res, "Acesso do proprietário não está configurado no servidor.", 503);
      return null;
    }
    const token = extractBearerToken(req);
    if (!token){
      sendError(res, "Sessão inválida. Faça login novamente.", 401);
      return null;
    }
    const user = await getSupabaseUserFromToken(token);
    const email = normalizeAccessEmail(user?.email || "");
    if (!user || !email){
      sendError(res, "Sessão inválida. Faça login novamente.", 401);
      return null;
    }
    if (!isOwnerEmail(email)){
      sendError(res, "Acesso restrito ao proprietário.", 403);
      return null;
    }
    return { ...user, email };
  }

  function createInviteId(db){
    const nextId = Math.max(1, Number(db?.seq?.invite || 1));
    db.seq.invite = nextId + 1;
    return nextId;
  }

  function normalizeAccessInviteRow(row){
    const createdAt = String(row?.created_at || nowIso());
    const updatedAt = String(row?.updated_at || createdAt);
    return {
      id: Math.max(1, Number(row?.id || 0)),
      code: normalizeInviteCode(row?.code || ""),
      label: String(row?.label || "").trim(),
      active: row?.active !== false,
      uses_count: Math.max(0, Number(row?.uses_count || 0)),
      source: String(row?.source || "panel").trim() || "panel",
      created_by_email: normalizeAccessEmail(row?.created_by_email || ""),
      last_used_email: normalizeAccessEmail(row?.last_used_email || ""),
      created_at: createdAt,
      updated_at: updatedAt,
      last_used_at: String(row?.last_used_at || ""),
    };
  }

  function ensureAccessInviteStore(db){
    if (!Array.isArray(db.access_invites)){
      db.access_invites = [];
    }
    const initialized = !!db?.meta?.access_invites_initialized;
    if (initialized || db.access_invites.length > 0 || !ACCESS_INVITE_CODES.length){
      if (db.access_invites.length > 0 && !initialized){
        db.meta.access_invites_initialized = true;
        return true;
      }
      return false;
    }

    const now = nowIso();
    const seeded = ACCESS_INVITE_CODES.map((code) => normalizeAccessInviteRow({
      id: createInviteId(db),
      code,
      label: "",
      active: true,
      uses_count: 0,
      source: "seed",
      created_by_email: "",
      last_used_email: "",
      created_at: now,
      updated_at: now,
      last_used_at: "",
    })).filter((row) => row.code);

    if (seeded.length){
      db.access_invites.push(...seeded);
      db.meta.access_invites_initialized = true;
      return true;
    }

    return false;
  }

  function getAccessInviteRows(db){
    if (!Array.isArray(db.access_invites)) return [];
    return db.access_invites
      .map((row) => normalizeAccessInviteRow(row))
      .filter((row) => !!row.code);
  }

  function findAccessInviteByCode(db, code){
    const normalizedCode = normalizeInviteCode(code);
    if (!normalizedCode) return null;
    return getAccessInviteRows(db).find((row) => row.active && row.code === normalizedCode) || null;
  }

  function getSortedAccessInviteRows(db){
    return getAccessInviteRows(db).sort((a, b) => {
      if (Number(b.active) !== Number(a.active)) return Number(b.active) - Number(a.active);
      const ta = new Date(String(a.updated_at || a.created_at || "")).getTime();
      const tb = new Date(String(b.updated_at || b.created_at || "")).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && tb !== ta) return tb - ta;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }

  function findAccessInviteIndexById(db, id){
    const target = Number(id || 0);
    return Array.isArray(db.access_invites)
      ? db.access_invites.findIndex((row) => Number(row?.id || 0) === target)
      : -1;
  }

  function generateAccessInviteCode(db){
    const existing = new Set(getAccessInviteRows(db).map((row) => row.code));
    for (let attempt = 0; attempt < 20; attempt += 1){
      const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
      const code = `CONVITE-${suffix}`;
      if (!existing.has(code)) return code;
    }
    return `CONVITE-${Date.now().toString(36).toUpperCase()}`;
  }

  async function upsertSupabaseProfile(user){
    if (!user?.id || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: String(user.id),
          email: String(user.email || "").trim() || null,
          updated_at: nowIso(),
        }),
      });
    } catch {}
  }

  async function createSupabaseAccessUser({ name, email, password, inviteCode } = {}){
    if (!isControlledSignupConfigured()){
      throw makeStatusError("Cadastro por convite não está configurado no servidor.", 503);
    }
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          app: "mfas_pdv",
          full_name: name,
          name,
          invite_code: inviteCode,
          signup_source: "server_invite",
        },
      }),
    });
    const data = await readJsonResponse(resp);
    if (!resp.ok){
      throw formatSupabaseAdminError(data);
    }
    const user = data?.user || data || null;
    await upsertSupabaseProfile(user);
    return user;
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function prettyType(value){
    const raw = String(value || "").trim();
    if (!raw) return "-";
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  const PAYMENT_METHOD_LABELS = Object.freeze({
    dinheiro: "Dinheiro",
    pix: "PIX",
    debito: "Débito",
    credito: "Crédito",
    pedido_pago: "Pedido Pago",
    pedido_pago_ifood: "Pedido Pago iFood",
  });

  function paymentMethodLabel(method){
    const key = String(method || "").trim().toLowerCase();
    return PAYMENT_METHOD_LABELS[key] || prettyType(key);
  }

  const CASH_MOVEMENT_LABELS = Object.freeze({
    venda: "Venda",
    abertura: "Abertura",
    sangria: "Sangria",
    despesa: "Despesa",
    pagamento_funcionario: "Pagamento de funcionário",
  });

  function cashMovementLabel(kind){
    const key = String(kind || "").trim().toLowerCase();
    return CASH_MOVEMENT_LABELS[key] || prettyType(key);
  }

  function describeCashMovement(entry){
    const key = String(entry?.kind || entry || "").trim().toLowerCase();
    const reason = String(entry?.reason || "").trim();
    const employee = String(entry?.employee_name || "").trim();
    const baseReason = reason || "Sem motivo";

    if (key === "pagamento_funcionario"){
      const parts = ["Pagamento de funcionário"];
      if (employee) parts.push(`Funcionário: ${employee}`);
      if (reason && !/^pagamento\s+de\s+funcion[aá]rio\b/i.test(reason)){
        parts.push(reason);
      }
      return {
        label: CASH_MOVEMENT_LABELS.despesa,
        description: parts.join(" • "),
      };
    }

    return {
      label: cashMovementLabel(key),
      description: employee ? `${baseReason} • Funcionário: ${employee}` : baseReason,
    };
  }

  function ensureDataDir(){
    const dir = path.dirname(dataFile);
    fs.mkdirSync(dir, { recursive: true });
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function createBaseDb(){
    return {
      version: 1,
      seq: { order: 1, item: 1, movement: 1, invite: 1 },
      meta: {
        last_order_number: 0,
        cash_status: "FECHADO",
        cash_opened_at: "",
        cash_opening_amount: 0,
        cash_last_opened_at: "",
        cash_last_closed_at: "",
        last_backup_at: "",
        last_backup_path: "",
        access_invites_initialized: false,
      },
      orders: [],
      order_items: [],
      cash_movements: [],
      cash_closings: [],
      access_invites: [],
    };
  }

  function normalizeMovementKind(kind){
    const key = String(kind || "").trim().toLowerCase();
    if (["abertura", "sangria", "despesa", "pagamento_funcionario"].includes(key)) return key;
    return "";
  }

  function normalizeDb(raw){
    const base = createBaseDb();
    const source = raw && typeof raw === "object" ? raw : {};
    const normalized = {
      version: 1,
      seq: {
        order: Math.max(1, Number(source?.seq?.order || base.seq.order)),
        item: Math.max(1, Number(source?.seq?.item || base.seq.item)),
        movement: Math.max(1, Number(source?.seq?.movement || base.seq.movement)),
        invite: Math.max(1, Number(source?.seq?.invite || base.seq.invite)),
      },
      meta: {
        last_order_number: Math.max(0, Number(source?.meta?.last_order_number || 0)),
        cash_status: String(source?.meta?.cash_status || base.meta.cash_status).toUpperCase() === "ABERTO" ? "ABERTO" : "FECHADO",
        cash_opened_at: String(source?.meta?.cash_opened_at || ""),
        cash_opening_amount: Math.max(0, roundMoney(Number(source?.meta?.cash_opening_amount || 0))),
        cash_last_opened_at: String(source?.meta?.cash_last_opened_at || ""),
        cash_last_closed_at: String(source?.meta?.cash_last_closed_at || ""),
        last_backup_at: String(source?.meta?.last_backup_at || ""),
        last_backup_path: String(source?.meta?.last_backup_path || ""),
        access_invites_initialized: !!source?.meta?.access_invites_initialized,
      },
      orders: Array.isArray(source?.orders) ? source.orders : [],
      order_items: Array.isArray(source?.order_items) ? source.order_items : [],
      cash_movements: Array.isArray(source?.cash_movements)
        ? source.cash_movements.map((row) => ({
            id: Math.max(1, Number(row?.id || 0)),
            kind: normalizeMovementKind(row?.kind) || "despesa",
            amount: Math.max(0, roundMoney(Number(row?.amount || 0))),
            reason: String(row?.reason || ""),
            employee_name: String(row?.employee_name || ""),
            created_at: String(row?.created_at || nowIso()),
          }))
        : [],
      cash_closings: Array.isArray(source?.cash_closings)
        ? source.cash_closings.map((row) => ({
            id: Math.max(1, Number(row?.id || 0)),
            day: String(row?.day || ""),
            start: String(row?.start || ""),
            end: String(row?.end || ""),
            summary: {
              total: roundMoney(Number(row?.summary?.total || 0)),
              opening_amount: roundMoney(Number(row?.summary?.opening_amount || 0)),
              cash_sales: roundMoney(Number(row?.summary?.cash_sales || 0)),
              money_sales: roundMoney(Number(row?.summary?.money_sales || 0)),
              total_entries: roundMoney(Number(row?.summary?.total_entries || 0)),
              cash_out: roundMoney(Number(row?.summary?.cash_out || 0)),
              projected_cash: roundMoney(Number(row?.summary?.projected_cash || 0)),
              count: Math.max(0, Number(row?.summary?.count || 0)),
            },
            created_at: String(row?.created_at || nowIso()),
          }))
        : [],
      access_invites: Array.isArray(source?.access_invites)
        ? source.access_invites.map((row) => normalizeAccessInviteRow(row)).filter((row) => !!row.code)
        : [],
    };

    const maxOrderId = normalized.orders.reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0);
    const maxItemId = normalized.order_items.reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0);
    const maxMovementId = normalized.cash_movements.reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0);
    const maxInviteId = normalized.access_invites.reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0);
    normalized.seq.order = Math.max(normalized.seq.order, maxOrderId + 1);
    normalized.seq.item = Math.max(normalized.seq.item, maxItemId + 1);
    normalized.seq.movement = Math.max(normalized.seq.movement, maxMovementId + 1);
    normalized.seq.invite = Math.max(normalized.seq.invite, maxInviteId + 1);
    return normalized;
  }

  function markDbChanged(){
    dbRevision += 1;
    indexedDbRef = null;
    cachedIndex = null;
    indexedRevision = -1;
  }

  function buildDbIndex(db){
    const orderById = new Map();
    const itemsByOrder = new Map();
    const itemSubtotalsByOrder = new Map();
    const summaryMapsByOrder = new Map();

    for (const order of Array.isArray(db?.orders) ? db.orders : []){
      orderById.set(Number(order?.id || 0), order);
    }

    for (const item of Array.isArray(db?.order_items) ? db.order_items : []){
      const orderId = Number(item?.order_id || 0);
      const qty = Number(item?.qty || 0);
      const unitPrice = Number(item?.unit_price || 0);
      const notes = String(item?.notes || "");
      const name = String(item?.name || "Item");

      if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, []);
      itemsByOrder.get(orderId).push(item);

      itemSubtotalsByOrder.set(orderId, roundMoney((itemSubtotalsByOrder.get(orderId) || 0) + (qty * unitPrice)));

      let summaryMap = summaryMapsByOrder.get(orderId);
      if (!summaryMap){
        summaryMap = new Map();
        summaryMapsByOrder.set(orderId, summaryMap);
      }
      const summaryKey = `${name}||${notes}`;
      const current = summaryMap.get(summaryKey) || { name, qty: 0, notes };
      current.qty += Number(item?.qty || 1);
      summaryMap.set(summaryKey, current);
    }

    const itemsSummaryByOrder = new Map();
    for (const [orderId, summaryMap] of summaryMapsByOrder.entries()){
      itemsSummaryByOrder.set(orderId, Array.from(summaryMap.values()));
    }

    return {
      orderById,
      itemsByOrder,
      itemSubtotalsByOrder,
      itemsSummaryByOrder,
    };
  }

  function getDbIndex(db){
    if (indexedDbRef === db && indexedRevision === dbRevision && cachedIndex){
      return cachedIndex;
    }
    cachedIndex = buildDbIndex(db);
    indexedDbRef = db;
    indexedRevision = dbRevision;
    return cachedIndex;
  }

  function getOrderById(db, orderId){
    return getDbIndex(db).orderById.get(Number(orderId)) || null;
  }

  function getItemsForOrder(db, orderId){
    return getDbIndex(db).itemsByOrder.get(Number(orderId)) || [];
  }

  function loadDb(){
    if (dbLoaded && cachedDb) return cachedDb;
    ensureDataDir();
    if (!fs.existsSync(dataFile)){
      const base = createBaseDb();
      fs.writeFileSync(dataFile, JSON.stringify(base, null, 2), "utf8");
      cachedDb = normalizeDb(base);
      dbLoaded = true;
      markDbChanged();
      return cachedDb;
    }
    try{
      const raw = fs.readFileSync(dataFile, "utf8");
      cachedDb = normalizeDb(raw ? JSON.parse(raw) : createBaseDb());
    } catch {
      const base = createBaseDb();
      fs.writeFileSync(dataFile, JSON.stringify(base, null, 2), "utf8");
      cachedDb = normalizeDb(base);
    }
    dbLoaded = true;
    markDbChanged();
    return cachedDb;
  }

  function flushDbNow(){
    const snapshot = normalizeDb(cachedDb || createBaseDb());
    ensureDataDir();
    fs.writeFileSync(dataFile, JSON.stringify(snapshot, null, 2), "utf8");
    cachedDb = snapshot;
    dbLoaded = true;
    markDbChanged();
  }

  function scheduleDbFlush({ immediate = false } = {}){
    if (immediate){
      if (flushTimer){
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushDbNow();
      return;
    }
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      try{
        flushDbNow();
      } catch (err){
        console.error("[mfas-pdv] falha ao persistir base:", err);
      }
    }, DB_FLUSH_DELAY_MS);
    if (typeof flushTimer.unref === "function") flushTimer.unref();
  }

  function saveDb(db, opts = {}){
    cachedDb = opts?.normalize ? normalizeDb(db) : db;
    dbLoaded = true;
    markDbChanged();
    scheduleDbFlush(opts);
  }

  function flushDbOnShutdown(){
    if (!dbLoaded || !cachedDb) return;
    try{
      flushDbNow();
    } catch (err){
      console.error("[mfas-pdv] falha ao finalizar persistência:", err);
    }
  }

  process.once("beforeExit", flushDbOnShutdown);
  process.once("SIGTERM", () => {
    flushDbOnShutdown();
    process.exit(0);
  });
  process.once("SIGINT", () => {
    flushDbOnShutdown();
    process.exit(0);
  });

  function sendJson(res, statusCode, data, extraHeaders = {}){
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-MVS-Backend": "node-json",
      ...extraHeaders,
    });
    res.end(JSON.stringify(data));
  }

  function sendHtml(res, statusCode, html){
    res.writeHead(statusCode, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-MVS-Backend": "node-json",
    });
    res.end(String(html || ""));
  }

  function sendError(res, message, statusCode = 400){
    sendJson(res, statusCode, { ok: false, error: String(message || "Erro") });
  }

  function readRawBody(req){
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function parseJsonBody(buffer){
    if (!buffer || !buffer.length) return {};
    try{
      return JSON.parse(buffer.toString("utf8"));
    } catch {
      return {};
    }
  }

  function normalizePaymentSplits(order){
    const raw = Array.isArray(order?.payment_splits) ? order.payment_splits : [];
    const out = [];
    for (const row of raw){
      const method = String(row?.method || "").trim().toLowerCase();
      const amount = Number(row?.amount);
      if (!method) continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const cashReceived = Number(row?.cash_received);
      const cashChange = Number(row?.cash_change);
      out.push({
        person_name: String(row?.person_name || "").trim(),
        method,
        amount: roundMoney(amount),
        cash_received: Number.isFinite(cashReceived) ? roundMoney(Math.max(0, cashReceived)) : null,
        cash_change: Number.isFinite(cashChange) ? roundMoney(Math.max(0, cashChange)) : null,
      });
    }
    return out;
  }

  function paymentBucket(payment){
    const pm = String(payment || "").toLowerCase();
    if (pm.includes("divid")) return "outros";
    if (pm.includes("din")) return "dinheiro";
    if (pm.includes("pix")) return "pix";
    if (pm.includes("deb")) return "debito";
    if (pm.includes("cre")) return "credito";
    if (pm.includes("pedido_pago_ifood") || pm.includes("pedido pago ifood") || pm.includes("pedido pago i-food")) return "pedido_pago_ifood";
    if (pm.includes("pedido_pago") || pm.includes("pedido pago")) return "pedido_pago";
    return "outros";
  }

  function isCashOpen(db){
    return String(db?.meta?.cash_status || "").toUpperCase() === "ABERTO";
  }

  function ensureCashOpen(db, action = "registrar o pedido"){
    if (isCashOpen(db)) return null;
    return `Caixa fechado. Abra o caixa para ${action}.`;
  }

  function orderTotal(db, orderId){
    const index = getDbIndex(db);
    const normalizedOrderId = Number(orderId);
    const itemsTotal = Number(index.itemSubtotalsByOrder.get(normalizedOrderId) || 0);
    const order = index.orderById.get(normalizedOrderId);
    const discount = Number(order?.discount || 0);
    const fee = Number(order?.fee || 0);
    return roundMoney(Math.max(0, itemsTotal - discount + fee));
  }

  function orderCreatedAt(order){
    return String(order?.created_at || nowIso());
  }

  function orderReportedAt(order){
    const finalizedAt = String(order?.finalized_at || "").trim();
    return finalizedAt || orderCreatedAt(order);
  }

  function receivableLaunchCount(db, order){
    const rawCount = Number(order?.merged_count);
    const orderId = Number(order?.id || 0);
    const hasItems = getItemsForOrder(db, orderId).length > 0;
    const mode = String(order?.launch_count_mode || "").trim().toLowerCase();
    if (mode === "launch_only"){
      return Math.max(0, Number.isFinite(rawCount) ? Math.trunc(rawCount) : 0);
    }
    if (!hasItems) return 0;
    if (!Number.isFinite(rawCount)) return 1;
    return Math.max(1, Math.trunc(rawCount) - 1);
  }

  function dayKeyFromIso(iso){
    const date = new Date(iso || nowIso());
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function addCashMovement(db, { kind, amount, reason = "", employee_name = "", created_at = "" } = {}){
    const normalizedKind = normalizeMovementKind(kind);
    if (!normalizedKind) return null;
    const normalizedAmount = Math.max(0, roundMoney(Number(amount || 0)));
    const row = {
      id: Number(db.seq?.movement || 1),
      kind: normalizedKind,
      amount: normalizedAmount,
      reason: String(reason || "").trim(),
      employee_name: String(employee_name || "").trim(),
      created_at: String(created_at || nowIso()),
    };
    db.seq.movement = row.id + 1;
    db.cash_movements.push(row);
    return row;
  }

  function sumCashMovementsBetween(db, startIso, endIso){
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const rows = (Array.isArray(db.cash_movements) ? db.cash_movements : [])
      .filter((row) => {
        const ts = new Date(row?.created_at).getTime();
        return Number.isFinite(ts) && ts >= start && ts <= end;
      })
      .map((row) => ({
        id: Number(row?.id || 0),
        kind: normalizeMovementKind(row?.kind),
        amount: Math.max(0, roundMoney(Number(row?.amount || 0))),
        reason: String(row?.reason || ""),
        employee_name: String(row?.employee_name || ""),
        created_at: String(row?.created_at || nowIso()),
      }))
      .filter((row) => !!row.kind)
      .sort((a, b) => a.id - b.id);

    const byKind = { abertura: 0, sangria: 0, despesa: 0, pagamento_funcionario: 0 };
    for (const row of rows){
      byKind[row.kind] += Number(row.amount || 0);
    }

    const totalOut = roundMoney(
      (byKind.sangria || 0) +
      (byKind.despesa || 0) +
      (byKind.pagamento_funcionario || 0)
    );

    return { rows, byKind, totalOut };
  }

  function sumOrdersBetween(db, startIso, endIso){
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const index = getDbIndex(db);
    const rows = db.orders
      .filter((order) => {
        const status = String(order.status || "").toUpperCase();
        const ts = new Date(orderReportedAt(order)).getTime();
        return status === "FECHADO" && Number.isFinite(ts) && ts >= start && ts <= end;
      })
      .map((order) => ({
        id: Number(order.id),
        order_number: Number(order.order_number || 0),
        payment_method: order.payment_method || "",
        payment_splits: normalizePaymentSplits(order),
        created_at: orderCreatedAt(order),
        reported_at: orderReportedAt(order),
        finalized_at: String(order.finalized_at || ""),
        total: orderTotal(db, order.id),
        order_type: String(order.order_type || ""),
        table_no: String(order.table_no || ""),
        customer_name: String(order.customer_name || ""),
        items: (index.itemsByOrder.get(Number(order.id)) || [])
          .map((row) => ({
            name: String(row.name || "Item"),
            qty: Number(row.qty || 0),
            unit_price: Number(row.unit_price || 0),
            notes: String(row.notes || ""),
          })),
      }))
      .sort((a, b) => {
        const ta = new Date(a.reported_at || a.created_at || 0).getTime();
        const tb = new Date(b.reported_at || b.created_at || 0).getTime();
        if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
        return a.id - b.id;
      });

    const byPay = { dinheiro: 0, pix: 0, debito: 0, credito: 0, pedido_pago: 0, pedido_pago_ifood: 0, outros: 0 };
    let totalGeral = 0;

    for (const row of rows){
      const total = Number(row.total || 0);
      totalGeral += total;
      const splits = Array.isArray(row.payment_splits) ? row.payment_splits : [];
      if (splits.length){
        let splitTotal = 0;
        for (const split of splits){
          const amount = Number(split.amount || 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          splitTotal += amount;
          byPay[paymentBucket(split.method)] += amount;
        }
        const missing = roundMoney(total - splitTotal);
        if (missing > 0){
          byPay[paymentBucket(row.payment_method)] += missing;
        }
      } else {
        byPay[paymentBucket(row.payment_method)] += total;
      }
    }

    const movementTotals = sumCashMovementsBetween(db, startIso, endIso);
    const openingAmount = roundMoney(movementTotals.byKind?.abertura || 0);
    const totalIn = roundMoney(totalGeral || 0);
    const moneySales = roundMoney(byPay.dinheiro || 0);
    const totalOut = roundMoney(movementTotals.totalOut || 0);
    const projectedCash = roundMoney(openingAmount + moneySales - totalOut);

    return {
      rows,
      byPay,
      totalGeral,
      totalIn,
      moneySales,
      openingAmount,
      byExpense: {
        sangria: roundMoney(movementTotals.byKind?.sangria || 0),
        despesa: roundMoney(movementTotals.byKind?.despesa || 0),
        pagamento_funcionario: roundMoney(movementTotals.byKind?.pagamento_funcionario || 0),
      },
      totalOut,
      projectedCash,
      movements: movementTotals.rows,
    };
  }

  function parseDateOnly(dateStr){
    const value = String(dateStr || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date();
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }

  function getReportRange(period, dateStr){
    const p = String(period || "").toLowerCase();
    const base = parseDateOnly(dateStr);
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();

    if (["day", "daily", "diario"].includes(p)){
      return { key: "day", title: "Relatório Diário", start: new Date(year, month, day, 0, 0, 0, 0), end: new Date(year, month, day, 23, 59, 59, 999) };
    }
    if (["month", "monthly", "mensal"].includes(p)){
      return { key: "month", title: "Relatório Mensal", start: new Date(year, month, 1, 0, 0, 0, 0), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
    }
    if (["year", "yearly", "annual", "anual"].includes(p)){
      return { key: "year", title: "Relatório Anual", start: new Date(year, 0, 1, 0, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    return null;
  }

  function getCashReportRange(db, dayStr){
    const dayRaw = String(dayStr || "").trim();
    const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayRaw);
    if (!dayMatch){
      return {
        key: "cash",
        title: "Relatório de Caixa",
        start: db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString(),
        end: db.meta.cash_last_closed_at || nowIso(),
      };
    }

    const base = parseDateOnly(dayRaw);
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();
    const dayLabel = base.toLocaleDateString("pt-BR");
    const closings = Array.isArray(db.cash_closings) ? db.cash_closings : [];
    const rows = closings
      .filter((row) => String(row?.day || "") === dayRaw)
      .sort((a, b) => new Date(String(a?.start || "")).getTime() - new Date(String(b?.start || "")).getTime());

    if (rows.length){
      return {
        key: "cash",
        title: `Relatório de Caixa - ${dayLabel} (Fechamento)`,
        start: rows[0]?.start || new Date(year, month, day, 0, 0, 0, 0).toISOString(),
        end: rows[rows.length - 1]?.end || new Date(year, month, day, 23, 59, 59, 999).toISOString(),
      };
    }

    return {
      key: "cash",
      title: `Relatório de Caixa - ${dayLabel}`,
      start: new Date(year, month, day, 0, 0, 0, 0).toISOString(),
      end: new Date(year, month, day, 23, 59, 59, 999).toISOString(),
    };
  }

  function htmlPage(title, bodyHtml){
    return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page{ size: 80mm auto; margin:4mm; }
    @media print{
      @page{ size: 80mm auto; margin:4mm; }
    }
    *{box-sizing:border-box}
    body{
      font-family: "Courier New", Courier, monospace;
      margin:0 auto;
      color:#111;
      width:100%;
      max-width:72mm;
      font-size:11px;
      line-height:1.25;
      word-break: normal;
      overflow-wrap: break-word;
    }
    h1{margin:0 0 6px 0;font-size:14px}
    .muted{opacity:.72}
    .box{border:1px solid #ddd;border-radius:6px;padding:8px;margin:8px 0;overflow:hidden}
    table{width:100%;border-collapse:collapse;font-size:10.5px;table-layout:fixed}
    th,td{border-bottom:1px solid #eee;padding:4px;text-align:left;vertical-align:top;min-width:0;word-break:break-word;overflow-wrap:anywhere}
    th:last-child,td:last-child{text-align:right}
    .hr{border-top:1px dashed #999;margin:8px 0}
    .amount,.nowrap{white-space:nowrap;word-break:keep-all;overflow-wrap:normal}
    .summaryRow{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .summaryRow + .summaryRow{margin-top:4px}
    .movementTable th:nth-child(1), .movementTable td:nth-child(1){width:26%}
    .movementTable th:nth-child(2), .movementTable td:nth-child(2){width:20%}
    .movementTable th:nth-child(3), .movementTable td:nth-child(3){width:36%}
    .movementTable th:nth-child(4), .movementTable td:nth-child(4){width:18%}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>
    `.trim();
  }

  function buildOrderPrintHtml(order, items){
    const createdAt = order?.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : "-";
    const subtotal = roundMoney(items.reduce((acc, row) => acc + (Number(row.qty || 0) * Number(row.unit_price || 0)), 0));
    const discount = roundMoney(Number(order?.discount || 0));
    const fee = roundMoney(Number(order?.fee || 0));
    const totalRaw = Number(order?.total);
    const total = Number.isFinite(totalRaw) && totalRaw > 0
      ? roundMoney(totalRaw)
      : roundMoney(Math.max(0, subtotal - discount + fee));
    const splits = normalizePaymentSplits(order);
    const paymentSummary = splits.length ? "DIVIDIDO" : String(order?.payment_method || "-").toUpperCase();
    const splitRows = splits.map((split, index) => {
      const person = split.person_name || `Pessoa ${index + 1}`;
      const cashDetail = split.method === "dinheiro" && Number(split.cash_change || 0) > 0
        ? ` • Recebido ${brl(split.cash_received || split.amount || 0)} • Troco ${brl(split.cash_change || 0)}`
        : "";
      return `<div class="muted">• ${escapeHtml(person)} • ${escapeHtml(paymentMethodLabel(split.method).toUpperCase())}: ${escapeHtml(brl(split.amount || 0))}${cashDetail ? ` ${escapeHtml(cashDetail)}` : ""}</div>`;
    }).join("");
    const rows = items.map((row) => {
      const qty = Number(row.qty || 0);
      const unit = Number(row.unit_price || 0);
      const line = qty * unit;
      const notes = String(row.notes || "").trim();
      return `
        <tr>
          <td>
            <div>${escapeHtml(`${qty}x ${row.name}`)}</div>
            <div class="muted">Unitário: ${escapeHtml(brl(unit))}</div>
            ${notes ? `<div class="muted">Obs: ${escapeHtml(notes)}</div>` : ""}
          </td>
          <td class="amount">${escapeHtml(brl(line))}</td>
        </tr>
      `;
    }).join("");

    return htmlPage(
      `Comanda #${order?.order_number || "-"}`,
      `
        <h1>Comanda #${escapeHtml(String(order?.order_number || "-"))}</h1>
        <p class="muted">Impresso em ${escapeHtml(createdAt)}</p>
        <div class="box">
          <div><b>Tipo:</b> ${escapeHtml(String(order?.order_type || "-").toUpperCase())}</div>
          <div><b>Mesa:</b> ${escapeHtml(order?.table_no || "-")}</div>
          <div><b>Cliente:</b> ${escapeHtml(order?.customer_name || "-")}</div>
          <div><b>Pagamento:</b> ${escapeHtml(paymentSummary)}</div>
          ${splitRows ? `<div>${splitRows}</div>` : ""}
        </div>
        <div class="box">
          <table>
            <thead><tr><th>Item</th><th>Total</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="2">Sem itens</td></tr>`}</tbody>
          </table>
        </div>
        <div class="box">
          <div class="summaryRow"><b>Subtotal:</b><span class="amount">${escapeHtml(brl(subtotal))}</span></div>
          <div class="summaryRow"><b>Desconto:</b><span class="amount">${escapeHtml(brl(discount))}</span></div>
          <div class="summaryRow"><b>Taxa:</b><span class="amount">${escapeHtml(brl(fee))}</span></div>
          <div class="hr"></div>
          <div class="summaryRow"><b>Valor total:</b><span class="amount"><b>${escapeHtml(brl(total))}</b></span></div>
        </div>
      `
    );
  }

  function normalizeReportMode(mode){
    const raw = String(mode || "").trim().toLowerCase();
    if (raw === "detailed" || raw === "detalhado" || raw === "detail") return "detailed";
    return "normal";
  }

  function normalizeReportDetailScope(scope){
    const raw = String(scope || "").trim().toLowerCase();
    if (["cash_only", "somente_caixa", "caixa", "cash"].includes(raw)) return "cash_only";
    return "orders_and_cash";
  }

  function buildReportHtml(title, startIso, endIso, report, rangeKey = "", mode = "normal", detailScope = "orders_and_cash"){
    const reportMode = normalizeReportMode(mode);
    const normalizedDetailScope = normalizeReportDetailScope(detailScope);
    const includeDetailedOrders = reportMode === "detailed" && normalizedDetailScope !== "cash_only";
    const dtStart = new Date(startIso).toLocaleString("pt-BR");
    const dtEnd = new Date(endIso).toLocaleString("pt-BR");
    const rangeDayLabel = new Date(startIso).toLocaleDateString("pt-BR");
    const rangeMonthLabel = new Date(startIso).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
    const rangeYearLabel = String(new Date(startIso).getFullYear());
    const rangeHint = (
      rangeKey === "day"
        ? `Vendas fechadas e movimentações de caixa do dia ${rangeDayLabel}.`
        : (rangeKey === "month"
          ? `Vendas fechadas e movimentações de caixa do mes ${rangeMonthLabel}.`
          : (rangeKey === "year"
            ? `Vendas fechadas e movimentações de caixa do ano ${rangeYearLabel}.`
            : ""))
    );
    const orderRows = Array.isArray(report.rows) ? report.rows : [];
    const paymentTotals = report.byPay || {};
    const totalSales = roundMoney(report.totalGeral || 0);
    const totalOut = roundMoney(report.totalOut || 0);
    const netRevenue = roundMoney(totalSales - totalOut);
    const totalEntries = roundMoney((report.totalIn ?? report.totalGeral) || 0);
    const moneySales = roundMoney(report.moneySales || 0);
    const projectedCash = roundMoney(report.projectedCash || 0);
    const expenseTotals = report.byExpense || {};
    const totalExpenses = roundMoney(
      Number(expenseTotals.despesa || 0) +
      Number(expenseTotals.pagamento_funcionario || 0)
    );
    const showCashBreakdown = rangeKey === "cash" || reportMode === "detailed";

    const rows = orderRows.map((row) => {
      const customer = String(row.customer_name || "").trim() || "-";
      const orderMoment = String(row.reported_at || row.created_at || "");
      return `
        <tr>
          <td>#${escapeHtml(String(row.order_number || "-"))}</td>
          <td>${escapeHtml(customer)}</td>
          <td>${escapeHtml(new Date(orderMoment).toLocaleString("pt-BR"))}</td>
          <td>${escapeHtml(brl(row.total || 0))}</td>
        </tr>
      `;
    }).join("");

    const detailedRows = orderRows.map((row) => {
      const typeLabel = String(row.order_type || "-").toUpperCase();
      const customer = String(row.customer_name || "").trim() || "-";
      const tableNo = String(row.table_no || "").trim();
      const typeWithTable = typeLabel === "MESA" && tableNo ? `MESA ${tableNo}` : typeLabel;
      const orderMoment = String(row.reported_at || row.created_at || "");
      const splits = Array.isArray(row.payment_splits) ? row.payment_splits : [];
      const paySummary = splits.length ? "DIVIDIDO" : paymentMethodLabel(row.payment_method || "-");
      const splitHtml = splits.length
        ? splits.map((split, index) => {
            const person = String(split?.person_name || "").trim() || `Pessoa ${index + 1}`;
            const cashDetail = split.method === "dinheiro" && Number(split.cash_change || 0) > 0
              ? ` • Recebido ${brl(split.cash_received || split.amount || 0)} • Troco ${brl(split.cash_change || 0)}`
              : "";
            return `<div class="muted">  • ${escapeHtml(person)}: ${escapeHtml(paymentMethodLabel(split.method))} ${escapeHtml(brl(split.amount || 0))}${cashDetail ? ` ${escapeHtml(cashDetail)}` : ""}</div>`;
          }).join("")
        : "";
      const items = Array.isArray(row.items) ? row.items : [];
      const itemsHtml = items.length
        ? items.map((item) => {
            const qty = Number(item.qty || 0);
            const unit = Number(item.unit_price || 0);
            const line = roundMoney(qty * unit);
            const notes = String(item.notes || "").trim();
            return `
              <div>• ${escapeHtml(`${qty}x ${item.name}`)} - ${escapeHtml(brl(line))}</div>
              <div class="muted">  Unitario: ${escapeHtml(brl(unit))}</div>
              ${notes ? `<div class="muted">  Obs: ${escapeHtml(notes)}</div>` : ""}
            `;
          }).join("")
        : `<div class="muted">Sem itens no pedido.</div>`;
      return `
        <div class="box">
          <div><b>Pedido #${escapeHtml(String(row.order_number || "-"))}</b> - ${escapeHtml(new Date(orderMoment).toLocaleString("pt-BR"))}</div>
          <div>Cliente: ${escapeHtml(customer)} - Origem: ${escapeHtml(typeWithTable)}</div>
          <div>Pagamento: ${escapeHtml(paySummary)} - Total: ${escapeHtml(brl(row.total || 0))}</div>
          ${splitHtml}
          <div class="hr"></div>
          ${itemsHtml}
        </div>
      `;
    }).join("");

    const consolidatedSection = `
      <div class="box">
        <div><b>Pedidos:</b> ${orderRows.length}</div>
        <div><b>Vendas totais:</b> ${escapeHtml(brl(totalSales))}</div>
        <div><b>Saidas totais:</b> ${escapeHtml(brl(totalOut))}</div>
        <div><b>Resultado liquido (vendas - saidas):</b> ${escapeHtml(brl(netRevenue))}</div>
      </div>
    `;

    const paymentSection = `
      <div class="box">
        <div><b>Formas de pagamento</b></div>
        <div>Dinheiro: ${escapeHtml(brl(paymentTotals.dinheiro || 0))}</div>
        <div>Pix: ${escapeHtml(brl(paymentTotals.pix || 0))}</div>
        <div>Debito: ${escapeHtml(brl(paymentTotals.debito || 0))}</div>
        <div>Credito: ${escapeHtml(brl(paymentTotals.credito || 0))}</div>
        <div>Pedido Pago: ${escapeHtml(brl(paymentTotals.pedido_pago || 0))}</div>
        <div>Pedido Pago iFood: ${escapeHtml(brl(paymentTotals.pedido_pago_ifood || 0))}</div>
        <div>Outros: ${escapeHtml(brl(paymentTotals.outros || 0))}</div>
      </div>
    `;

    const cashSection = showCashBreakdown ? `
      <div class="box">
        <div><b>Entradas (todas formas):</b> ${escapeHtml(brl(totalEntries))}</div>
        <div><b>Somente dinheiro:</b> ${escapeHtml(brl(moneySales))}</div>
        <div><b>Sangria:</b> ${escapeHtml(brl(expenseTotals.sangria || 0))}</div>
        <div><b>Despesas:</b> ${escapeHtml(brl(totalExpenses))}</div>
        <div><b>Saldo esperado em caixa:</b> ${escapeHtml(brl(projectedCash))}</div>
        <div class="muted">A abertura do caixa ja está considerada automaticamente neste saldo.</div>
      </div>
    ` : "";

    const normalSection = `
      <div class="box">
        <table class="reportTable">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Data/Hora</th><th>Total</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">Sem vendas no período</td></tr>`}</tbody>
        </table>
      </div>
    `;

    const detailedSection = includeDetailedOrders
      ? `<div class="hr"></div><h1>Pedidos Detalhados (Cliente • Produto • Horário)</h1>${detailedRows || `<div class="box">Sem vendas no período.</div>`}`
      : `<div class="box"><div><b>Pedidos detalhados:</b> não incluídos (somente dados do caixa).</div></div>`;

    const cashMovementRows = (Array.isArray(report.movements) ? report.movements : []).map((movement) => {
      const movementView = describeCashMovement(movement);
      return `
        <tr>
          <td>${escapeHtml(new Date(movement.created_at).toLocaleString("pt-BR"))}</td>
          <td>${escapeHtml(movementView.label)}</td>
          <td>${escapeHtml(movementView.description)}</td>
          <td class="amount">${escapeHtml(brl(movement.amount || 0))}</td>
        </tr>
      `;
    }).join("");

    const movementTableSection = showCashBreakdown ? `
      <div class="box">
        <table class="reportTable movementTable">
          <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Motivo</th><th>Valor</th></tr></thead>
          <tbody>${cashMovementRows || `<tr><td colspan="4">Sem lançamentos no período</td></tr>`}</tbody>
        </table>
      </div>
    ` : "";

    return htmlPage(
      title,
      `
        <h1>${escapeHtml(title)}${reportMode === "detailed" ? " - Detalhado" : " - Normal"}</h1>
        <p class="muted">Período: <b>${escapeHtml(dtStart)}</b> até <b>${escapeHtml(dtEnd)}</b></p>
        ${rangeHint ? `<p class="muted"><b>${escapeHtml(rangeHint)}</b></p>` : ""}
        ${reportMode === "detailed" ? `<p class="muted"><b>${includeDetailedOrders ? "Detalhamento com pedidos do período." : "Detalhamento somente dos dados de caixa."}</b></p>` : ""}
        ${consolidatedSection}
        ${paymentSection}
        ${cashSection}
        ${movementTableSection}
        ${reportMode === "detailed" ? detailedSection : normalSection}
      `
    );
  }

  function buildItemsSummary(db, orderId){
    const rows = getDbIndex(db).itemsSummaryByOrder.get(Number(orderId)) || [];
    return rows.map((row) => ({
      name: String(row.name || "Item"),
      qty: Number(row.qty || 0),
      notes: String(row.notes || ""),
    }));
  }

  async function handle(req, res, urlObj){
    const method = String(req.method || "GET").toUpperCase();
    const pathName = urlObj.pathname;
    const db = loadDb();
    const seededInvites = ensureAccessInviteStore(db);
    if (seededInvites){
      saveDb(db, { immediate: true });
    }

    if (method === "GET" && pathName === "/api/access/owner-status"){
      const token = extractBearerToken(req);
      if (!token){
        sendJson(res, 200, {
          ok: true,
          owner: false,
          configured: isOwnerAccessConfigured(),
          email: "",
        });
        return;
      }
      const user = await getSupabaseUserFromToken(token);
      const email = normalizeAccessEmail(user?.email || "");
      sendJson(res, 200, {
        ok: true,
        owner: isOwnerEmail(email),
        configured: isOwnerAccessConfigured(),
        email,
      });
      return;
    }

    if (method === "GET" && pathName === "/api/access/invites"){
      const owner = await requireOwnerAccess(req, res);
      if (!owner) return;

      const rows = getSortedAccessInviteRows(db);

      sendJson(res, 200, {
        ok: true,
        owner_email: owner.email,
        rows,
      });
      return;
    }

    if (method === "POST" && pathName === "/api/access/invites"){
      const owner = await requireOwnerAccess(req, res);
      if (!owner) return;

      const payload = parseJsonBody(await readRawBody(req));
      const label = String(payload?.label || "").trim();
      const requestedCode = normalizeInviteCode(payload?.code || "");
      const code = requestedCode || generateAccessInviteCode(db);
      const exists = getAccessInviteRows(db).some((row) => row.code === code);
      if (exists){
        sendError(res, "Já existe um convite com esse código.", 409);
        return;
      }

      const now = nowIso();
      const row = normalizeAccessInviteRow({
        id: createInviteId(db),
        code,
        label,
        active: payload?.active !== false,
        uses_count: 0,
        source: "panel",
        created_by_email: owner.email,
        last_used_email: "",
        created_at: now,
        updated_at: now,
        last_used_at: "",
      });

      db.access_invites.push(row);
      db.meta.access_invites_initialized = true;
      saveDb(db);
      sendJson(res, 200, { ok: true, row });
      return;
    }

    const inviteToggleMatch = pathName.match(/^\/api\/access\/invites\/(\d+)\/toggle$/);
    if (method === "POST" && inviteToggleMatch){
      const owner = await requireOwnerAccess(req, res);
      if (!owner) return;
      const inviteId = Number(inviteToggleMatch[1]);
      const inviteIndex = findAccessInviteIndexById(db, inviteId);
      if (inviteIndex < 0){
        sendError(res, "Convite não encontrado.", 404);
        return;
      }
      const payload = parseJsonBody(await readRawBody(req));
      const current = normalizeAccessInviteRow(db.access_invites[inviteIndex]);
      current.active = Object.prototype.hasOwnProperty.call(payload || {}, "active")
        ? !!payload.active
        : !current.active;
      current.updated_at = nowIso();
      db.access_invites[inviteIndex] = current;
      db.meta.access_invites_initialized = true;
      saveDb(db);
      sendJson(res, 200, { ok: true, row: current });
      return;
    }

    const inviteDeleteMatch = pathName.match(/^\/api\/access\/invites\/(\d+)\/delete$/);
    if (method === "POST" && inviteDeleteMatch){
      const owner = await requireOwnerAccess(req, res);
      if (!owner) return;
      const inviteId = Number(inviteDeleteMatch[1]);
      const inviteIndex = findAccessInviteIndexById(db, inviteId);
      if (inviteIndex < 0){
        sendError(res, "Convite não encontrado.", 404);
        return;
      }
      const [removed] = db.access_invites.splice(inviteIndex, 1);
      db.meta.access_invites_initialized = true;
      saveDb(db);
      sendJson(res, 200, { ok: true, row: normalizeAccessInviteRow(removed) });
      return;
    }

    if (method === "POST" && pathName === "/api/access/signup"){
      const payload = parseJsonBody(await readRawBody(req));
      const name = String(payload?.name || "").trim().replace(/\s+/g, " ");
      const email = String(payload?.email || "").trim().toLowerCase();
      const password = String(payload?.password || "");
      const inviteCode = normalizeInviteCode(payload?.invite_code || payload?.inviteCode || "");

      if (!name || name.length < 2){
        sendError(res, "Informe seu nome.", 400);
        return;
      }
      if (!isValidAccessEmail(email)){
        sendError(res, "Informe um email válido.", 400);
        return;
      }
      if (!inviteCode){
        sendError(res, "Informe o código de convite.", 400);
        return;
      }
      if (!passwordMeetsRules(password)){
        sendError(res, "A senha precisa ter pelo menos 6 caracteres, com letra maiúscula, letra minúscula e número.", 400);
        return;
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
        sendError(res, "Cadastro por convite não está configurado no servidor.", 503);
        return;
      }
      const accessInviteRows = getAccessInviteRows(db);
      if (!accessInviteRows.length){
        sendError(res, "Nenhum código de convite foi configurado no servidor.", 503);
        return;
      }
      const inviteRow = findAccessInviteByCode(db, inviteCode);
      if (!inviteRow){
        sendError(res, "Código de convite inválido.", 403);
        return;
      }

      try{
        const user = await createSupabaseAccessUser({ name, email, password, inviteCode });
        const inviteIndex = findAccessInviteIndexById(db, inviteRow.id);
        if (inviteIndex >= 0){
          const updatedInvite = normalizeAccessInviteRow(db.access_invites[inviteIndex]);
          updatedInvite.uses_count = Math.max(0, Number(updatedInvite.uses_count || 0)) + 1;
          updatedInvite.last_used_at = nowIso();
          updatedInvite.last_used_email = email;
          updatedInvite.updated_at = updatedInvite.last_used_at;
          db.access_invites[inviteIndex] = updatedInvite;
          db.meta.access_invites_initialized = true;
          saveDb(db);
        }
        sendJson(res, 200, {
          ok: true,
          user_id: String(user?.id || ""),
          email: String(user?.email || email),
          auto_confirmed: true,
        });
      } catch (err){
        sendError(res, err?.message || "Não foi possível criar a conta.", err?.statusCode || 500);
      }
      return;
    }

    const orderPrintMatch = pathName.match(/^\/api\/orders\/(\d+)\/print$/);
    if (method === "GET" && orderPrintMatch){
      const orderId = Number(orderPrintMatch[1]);
      const order = getOrderById(db, orderId);
      if (!order){
        sendHtml(res, 404, htmlPage("Pedido nao encontrado", "<h1>Pedido nao encontrado</h1>"));
        return;
      }
      const items = getItemsForOrder(db, orderId);
      sendHtml(res, 200, buildOrderPrintHtml(order, items));
      return;
    }

    if (method === "GET" && pathName === "/api/cash/report/print"){
      const cashRange = getCashReportRange(db, urlObj.searchParams.get("day"));
      const report = sumOrdersBetween(db, cashRange.start, cashRange.end);
      const mode = normalizeReportMode(urlObj.searchParams.get("mode"));
      const detailScope = normalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
      sendHtml(res, 200, buildReportHtml(cashRange.title, cashRange.start, cashRange.end, report, cashRange.key || "cash", mode, detailScope));
      return;
    }

    if (method === "GET" && pathName === "/api/reports/print"){
      const range = getReportRange(urlObj.searchParams.get("period"), urlObj.searchParams.get("date"));
      if (!range){
        sendHtml(res, 400, htmlPage("Parametros invalidos", "<h1>Parametros invalidos</h1>"));
        return;
      }
      const start = range.start.toISOString();
      const end = range.end.toISOString();
      const report = sumOrdersBetween(db, start, end);
      const mode = normalizeReportMode(urlObj.searchParams.get("mode"));
      const detailScope = normalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
      sendHtml(res, 200, buildReportHtml(range.title, start, end, report, range.key || "", mode, detailScope));
      return;
    }

    if (method === "GET" && pathName === "/api/cash/status"){
      const open = String(db.meta.cash_status || "").toUpperCase() === "ABERTO";
      if (!open){
        sendJson(res, 200, {
          ok: true,
          cash_status: db.meta.cash_status,
          opened_at: "",
          opening_amount: 0,
          last_closed_at: db.meta.cash_last_closed_at,
          projected_cash: 0,
          cash_sales: 0,
          money_sales: 0,
          total_entries: 0,
          cash_out: 0,
        });
        return;
      }

      const shiftStart = db.meta.cash_opened_at || new Date(0).toISOString();
      const shiftEnd = nowIso();
      const report = sumOrdersBetween(db, shiftStart, shiftEnd);
      const totalEntries = roundMoney((report.totalIn ?? report.totalGeral) || 0);
      const moneySales = roundMoney(report.moneySales || 0);
      sendJson(res, 200, {
        ok: true,
        cash_status: db.meta.cash_status,
        opened_at: db.meta.cash_opened_at,
        opening_amount: roundMoney(report.openingAmount || 0),
        last_closed_at: db.meta.cash_last_closed_at,
        projected_cash: report.projectedCash || 0,
        cash_sales: totalEntries,
        money_sales: moneySales,
        total_entries: totalEntries,
        cash_out: report.totalOut || 0,
      });
      return;
    }

    if (method === "POST" && pathName === "/api/cash/reset"){
      if (String(db.meta.cash_status || "").toUpperCase() === "ABERTO"){
        sendError(res, "Feche o caixa antes de resetar o status.", 400);
        return;
      }
      db.meta.cash_opened_at = nowIso();
      db.meta.cash_opening_amount = 0;
      db.meta.cash_last_opened_at = "";
      db.meta.cash_last_closed_at = "";
      saveDb(db);
      sendJson(res, 200, {
        ok: true,
        cash_status: db.meta.cash_status,
        opening_amount: 0,
        projected_cash: 0,
        cash_sales: 0,
        money_sales: 0,
        total_entries: 0,
        cash_out: 0,
      });
      return;
    }

    if (method === "POST" && pathName === "/api/cash/open"){
      const payload = parseJsonBody(await readRawBody(req));
      const openingAmountRaw = Number(payload?.opening_amount);
      const openingAmount = Number.isFinite(openingAmountRaw) && openingAmountRaw >= 0
        ? roundMoney(openingAmountRaw)
        : 0;

      db.meta.cash_status = "ABERTO";
      db.meta.cash_opened_at = nowIso();
      db.meta.cash_opening_amount = openingAmount;
      addCashMovement(db, {
        kind: "abertura",
        amount: openingAmount,
        reason: "Abertura de caixa",
        created_at: db.meta.cash_opened_at,
      });
      saveDb(db);
      sendJson(res, 200, {
        ok: true,
        opened_at: db.meta.cash_opened_at,
        opening_amount: openingAmount,
      });
      return;
    }

    if (method === "POST" && pathName === "/api/cash/close"){
      if (db.meta.cash_status !== "ABERTO"){
        sendError(res, "Caixa ja esta fechado", 400);
        return;
      }
      const start = db.meta.cash_opened_at || new Date(0).toISOString();
      const end = nowIso();
      const report = sumOrdersBetween(db, start, end);
      const day = dayKeyFromIso(end);
      const closingId = (Array.isArray(db.cash_closings) ? db.cash_closings : []).reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0) + 1;
      if (!Array.isArray(db.cash_closings)) db.cash_closings = [];
      db.cash_closings.push({
        id: closingId,
        day,
        start,
        end,
        summary: {
          total: roundMoney(report.totalGeral || 0),
          opening_amount: roundMoney(report.openingAmount || 0),
          cash_sales: roundMoney((report.totalIn ?? report.totalGeral) || 0),
          money_sales: roundMoney(report.moneySales || 0),
          total_entries: roundMoney((report.totalIn ?? report.totalGeral) || 0),
          cash_out: roundMoney(report.totalOut || 0),
          projected_cash: roundMoney(report.projectedCash || 0),
          count: Number(report.rows?.length || 0),
        },
        created_at: end,
      });
      db.meta.cash_status = "FECHADO";
      db.meta.cash_last_opened_at = start;
      db.meta.cash_last_closed_at = end;
      db.meta.cash_opening_amount = 0;
      db.meta.last_backup_at = end;
      db.meta.last_backup_path = "server_auto_cash_close";
      saveDb(db);
      sendJson(res, 200, {
        ok: true,
        start,
        end,
        total: report.totalGeral,
        byPay: report.byPay,
        count: report.rows.length,
        opening_amount: report.openingAmount,
        cash_sales: (report.totalIn ?? report.totalGeral),
        money_sales: report.moneySales,
        total_entries: (report.totalIn ?? report.totalGeral),
        cash_out: report.totalOut,
        projected_cash: report.projectedCash,
        saved_day: day,
      });
      return;
    }

    const movementRouteMatch = pathName.match(/^\/api\/cash\/movements\/(\d+)\/(update|delete)$/);
    if (movementRouteMatch && method === "POST"){
      const movementId = Number(movementRouteMatch[1]);
      const action = String(movementRouteMatch[2] || "").toLowerCase();
      const index = db.cash_movements.findIndex((row) => Number(row?.id) === movementId);
      if (index < 0){
        sendError(res, "Movimentação não encontrada.", 404);
        return;
      }

      if (action === "delete"){
        db.cash_movements.splice(index, 1);
        saveDb(db);
        sendJson(res, 200, { ok: true });
        return;
      }

      const payload = parseJsonBody(await readRawBody(req));
      const kind = normalizeMovementKind(payload?.kind);
      if (!kind){
        sendError(res, "Tipo de movimentação inválido.", 400);
        return;
      }
      const amount = Number(payload?.amount);
      if (!Number.isFinite(amount) || amount <= 0){
        sendError(res, "Informe um valor válido.", 400);
        return;
      }
      const reason = String(payload?.reason || "").trim();
      if (!reason){
        sendError(res, "Informe o motivo.", 400);
        return;
      }
      const employeeName = String(payload?.employee_name || "").trim();
      if (kind === "pagamento_funcionario" && !employeeName){
        sendError(res, "Informe o nome do funcionário.", 400);
        return;
      }

      const target = db.cash_movements[index];
      target.kind = kind;
      target.amount = roundMoney(amount);
      target.reason = reason;
      target.employee_name = employeeName;
      saveDb(db);
      sendJson(res, 200, { ok: true, row: target });
      return;
    }

    if (pathName === "/api/cash/movements"){
      const defaultStart = db.meta.cash_status === "ABERTO"
        ? (db.meta.cash_opened_at || new Date(0).toISOString())
        : (db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString());
      const defaultEnd = db.meta.cash_status === "ABERTO"
        ? nowIso()
        : (db.meta.cash_last_closed_at || nowIso());
      const hasStartParam = urlObj.searchParams.has("start");
      const hasEndParam = urlObj.searchParams.has("end");
      const dateParam = String(urlObj.searchParams.get("date") || "").trim();
      const hasDateParam = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
      const open = String(db.meta.cash_status || "").toUpperCase() === "ABERTO";
      let start = String(urlObj.searchParams.get("start") || defaultStart);
      let end = String(urlObj.searchParams.get("end") || defaultEnd);

      if (hasDateParam){
        const base = parseDateOnly(dateParam);
        start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0).toISOString();
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999).toISOString();
      }

      if (method === "GET"){
        if (!open && !hasStartParam && !hasEndParam && !hasDateParam){
          sendJson(res, 200, {
            ok: true,
            start: "",
            end: "",
            rows: [],
            totals: { abertura: 0, sangria: 0, despesa: 0, pagamento_funcionario: 0, total_saidas: 0 },
            cash_sales: 0,
            money_sales: 0,
            total_entries: 0,
            projected_cash: 0,
            saved_day: db.meta.cash_last_closed_at ? dayKeyFromIso(db.meta.cash_last_closed_at) : "",
          });
          return;
        }

        const report = sumOrdersBetween(db, start, end);
        const saleRows = (Array.isArray(report.rows) ? report.rows : []).map((order) => {
          const splits = Array.isArray(order?.payment_splits) ? order.payment_splits : [];
          const paymentDesc = splits.length
            ? splits.map((split) => {
                const amountText = `${paymentMethodLabel(split.method)} ${brl(Number(split.amount || 0))}`;
                if (split.method === "dinheiro" && Number(split.cash_change || 0) > 0){
                  return `${amountText} (troco ${brl(Number(split.cash_change || 0))})`;
                }
                return amountText;
              }).join(" + ")
            : paymentMethodLabel(order?.payment_method || "");
          const type = String(order?.order_type || "").trim().toUpperCase() || "-";
          const tableNo = String(order?.table_no || "").trim();
          const typeLabel = type === "MESA" && tableNo ? `MESA ${tableNo}` : type;
          const customer = String(order?.customer_name || "").trim() || "-";
          const orderNo = Number(order?.order_number || 0) || "-";
          const reportAt = String(order?.reported_at || order?.created_at || nowIso());
          return {
            id: `sale-${order?.id || orderNo}`,
            sort_id: Number(order?.id || 0),
            entity_type: "order",
            entity_id: Number(order?.id || 0),
            kind: "venda",
            amount: roundMoney(Number(order?.total || 0)),
            reason: `Pedido #${orderNo} • ${typeLabel} • Cliente: ${customer} • Pgto: ${paymentDesc || "-"}`,
            employee_name: "",
            created_at: reportAt,
            can_edit: true,
            can_delete: true,
          };
        });

        const movementRows = (Array.isArray(report.movements) ? report.movements : []).map((row) => ({
          id: `mv-${row?.id || 0}`,
          sort_id: Number(row?.id || 0),
          entity_type: "movement",
          entity_id: Number(row?.id || 0),
          kind: String(row?.kind || ""),
          amount: roundMoney(Number(row?.amount || 0)),
          reason: String(row?.reason || ""),
          employee_name: String(row?.employee_name || ""),
          created_at: String(row?.created_at || nowIso()),
          can_edit: true,
          can_delete: true,
        }));

        const allRows = [...saleRows, ...movementRows].sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          if (Number.isFinite(ta) && Number.isFinite(tb) && tb !== ta) return tb - ta;
          return Number(b.sort_id || 0) - Number(a.sort_id || 0);
        });

        sendJson(res, 200, {
          ok: true,
          start,
          end,
          rows: allRows,
          totals: {
            abertura: report.openingAmount || 0,
            sangria: report.byExpense?.sangria || 0,
            despesa: report.byExpense?.despesa || 0,
            pagamento_funcionario: report.byExpense?.pagamento_funcionario || 0,
            total_saidas: report.totalOut || 0,
          },
          cash_sales: (report.totalIn ?? report.totalGeral) || 0,
          money_sales: report.moneySales || 0,
          total_entries: (report.totalIn ?? report.totalGeral) || 0,
          projected_cash: report.projectedCash || 0,
        });
        return;
      }

      if (method === "POST"){
        if (db.meta.cash_status !== "ABERTO"){
          sendError(res, "Caixa fechado. Abra o caixa para registrar saídas.", 400);
          return;
        }
        const payload = parseJsonBody(await readRawBody(req));
        const kind = normalizeMovementKind(payload?.kind);
        if (!["sangria", "despesa", "pagamento_funcionario"].includes(kind)){
          sendError(res, "Tipo de movimentação inválido.", 400);
          return;
        }
        const amount = Number(payload?.amount);
        if (!Number.isFinite(amount) || amount <= 0){
          sendError(res, "Informe um valor válido.", 400);
          return;
        }
        const reason = String(payload?.reason || "").trim();
        if (!reason){
          sendError(res, "Informe o motivo.", 400);
          return;
        }
        const employeeName = String(payload?.employee_name || "").trim();
        if (kind === "pagamento_funcionario" && !employeeName){
          sendError(res, "Informe o nome do funcionário.", 400);
          return;
        }

        const movement = addCashMovement(db, { kind, amount, reason, employee_name: employeeName });
        saveDb(db);
        const liveReport = sumOrdersBetween(db, db.meta.cash_opened_at || new Date(0).toISOString(), nowIso());
        sendJson(res, 200, { ok: true, movement, projected_cash: liveReport.projectedCash || 0 });
        return;
      }
    }

    if (method === "GET" && pathName === "/api/tables/open"){
      const rows = db.orders
        .filter((order) => String(order.order_type || "") === "mesa" && String(order.status || "").toUpperCase() === "ABERTO")
        .map((order) => ({
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          table_no: String(order.table_no || ""),
          created_at: order.created_at || nowIso(),
          customer_name: String(order.customer_name || ""),
          total: orderTotal(db, order.id),
          order_count: Number(order.merged_count || 1),
          itemsSummary: buildItemsSummary(db, order.id),
        }))
        .sort((a, b) => b.id - a.id);
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    if (method === "GET" && pathName === "/api/receivables/open"){
      const rows = db.orders
        .filter((order) => String(order.order_type || "") === "a_receber" && String(order.status || "").toUpperCase() === "ABERTO")
        .map((order) => ({
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          created_at: order.created_at || nowIso(),
          customer_name: String(order.customer_name || ""),
          customer_phone: String(order.customer_phone || ""),
          total: orderTotal(db, order.id),
          order_count: receivableLaunchCount(db, order),
          itemsSummary: buildItemsSummary(db, order.id),
        }))
        .sort((a, b) => b.id - a.id);
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    if (method === "POST" && pathName === "/api/receivables/open"){
      const cashError = ensureCashOpen(db, "abrir o fiado");
      if (cashError){
        sendError(res, cashError, 400);
        return;
      }

      const payload = parseJsonBody(await readRawBody(req));
      const customerName = String(payload?.customer_name || "").trim();
      if (!customerName){
        sendError(res, "Informe o nome do cliente", 400);
        return;
      }

      const normalized = customerName.toLocaleLowerCase("pt-BR");
      const existing = db.orders.find((order) =>
        String(order.order_type || "") === "a_receber" &&
        String(order.status || "").toUpperCase() === "ABERTO" &&
        String(order.customer_name || "").trim().toLocaleLowerCase("pt-BR") === normalized
      );

      if (existing){
        sendJson(res, 200, {
          ok: true,
          existing: true,
          row: {
            id: Number(existing.id),
            order_number: Number(existing.order_number || 0),
            created_at: existing.created_at || nowIso(),
            customer_name: String(existing.customer_name || ""),
            customer_phone: String(existing.customer_phone || ""),
            total: orderTotal(db, existing.id),
            order_count: receivableLaunchCount(db, existing),
          },
        });
        return;
      }

      const now = nowIso();
      const orderId = db.seq.order++;
      const orderNumber = Number(db.meta.last_order_number || 0) + 1;
      db.meta.last_order_number = orderNumber;

      const order = {
        id: orderId,
        order_number: orderNumber,
        created_at: now,
        finalized_at: "",
        order_type: "a_receber",
        table_no: "",
        customer_name: customerName,
        customer_phone: "",
        address: "",
        notes: "",
        payment_method: "",
        payment_splits: [],
        delivery_status: "",
        status: "ABERTO",
        merged_count: 0,
        launch_count_mode: "launch_only",
        subtotal: 0,
        discount: 0,
        fee: 0,
        total: 0,
      };
      db.orders.push(order);
      saveDb(db);

      sendJson(res, 200, {
        ok: true,
        existing: false,
        row: {
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          created_at: order.created_at || nowIso(),
          customer_name: String(order.customer_name || ""),
          customer_phone: String(order.customer_phone || ""),
          total: 0,
          order_count: 0,
        },
      });
      return;
    }

    if (method === "GET" && pathName === "/api/kitchen/pending"){
      const orderById = getDbIndex(db).orderById;
      const rows = db.order_items
        .filter((item) => Number(item.is_kitchen) === 1 && (!item.status || String(item.status).toUpperCase() === "PENDENTE"))
        .map((item) => {
          const order = orderById.get(Number(item.order_id));
          if (!order) return null;
          return {
            id: Number(item.id),
            order_id: Number(item.order_id),
            name: String(item.name || "Item"),
            qty: Number(item.qty || 1),
            notes: String(item.notes || ""),
            order_number: Number(order.order_number || 0),
            table_no: String(order.table_no || ""),
            order_type: String(order.order_type || ""),
            created_at: order.created_at || nowIso(),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.id - b.id);
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    if (method === "GET" && pathName === "/api/kitchen/history"){
      const date = String(urlObj.searchParams.get("date") || dayKeyFromIso(nowIso())).trim();
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      const startTs = start.getTime();
      const endTs = end.getTime();
      const orderById = getDbIndex(db).orderById;
      const rows = db.order_items
        .filter((item) => Number(item.is_kitchen) === 1 && String(item.status || "").toUpperCase() === "PRONTO")
        .map((item) => {
          const order = orderById.get(Number(item.order_id));
          if (!order) return null;
          const readyAt = String(item.ready_at || order.created_at || nowIso());
          const ts = new Date(readyAt).getTime();
          if (!Number.isFinite(ts) || ts < startTs || ts > endTs) return null;
          return {
            id: Number(item.id),
            order_id: Number(item.order_id),
            name: String(item.name || "Item"),
            qty: Number(item.qty || 1),
            notes: String(item.notes || ""),
            order_number: Number(order.order_number || 0),
            table_no: String(order.table_no || ""),
            order_type: String(order.order_type || ""),
            created_at: order.created_at || nowIso(),
            ready_at: readyAt,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(String(b.ready_at || "")).getTime() - new Date(String(a.ready_at || "")).getTime());
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    if (method === "GET" && pathName === "/api/orders/day"){
      const date = urlObj.searchParams.get("date");
      if (!date){
        sendError(res, "Informe a data", 400);
        return;
      }
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      const rows = db.orders
        .filter((order) => {
          const ts = new Date(orderReportedAt(order)).getTime();
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .map((order) => ({
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          created_at: orderCreatedAt(order),
          reported_at: orderReportedAt(order),
          finalized_at: String(order.finalized_at || ""),
          order_type: String(order.order_type || ""),
          table_no: String(order.table_no || ""),
          customer_name: String(order.customer_name || ""),
          customer_phone: String(order.customer_phone || ""),
          address: String(order.address || ""),
          notes: String(order.notes || ""),
          payment_method: String(order.payment_method || ""),
          payment_splits: normalizePaymentSplits(order),
          status: String(order.status || ""),
          total: orderTotal(db, order.id),
        }))
        .sort((a, b) => {
          const ta = new Date(String(a.reported_at || a.created_at || "")).getTime();
          const tb = new Date(String(b.reported_at || b.created_at || "")).getTime();
          if (Number.isFinite(ta) && Number.isFinite(tb) && tb !== ta) return tb - ta;
          return Number(b.id || 0) - Number(a.id || 0);
        });
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    const orderUpdateMatch = pathName.match(/^\/api\/orders\/(\d+)\/update$/);
    if (method === "POST" && orderUpdateMatch){
      const id = Number(orderUpdateMatch[1]);
      const payload = parseJsonBody(await readRawBody(req));
      const order = db.orders.find((row) => Number(row.id) === id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      order.order_type = String(payload.order_type || order.order_type || "");
      order.table_no = String(payload.table_no || order.table_no || "");
      order.customer_name = String(payload.customer_name || order.customer_name || "");
      order.customer_phone = String(payload.customer_phone || order.customer_phone || "");
      order.address = String(payload.address || order.address || "");
      order.notes = String(payload.notes || order.notes || "");
      order.payment_method = String(payload.payment_method || order.payment_method || "");
      if (Array.isArray(payload.payment_splits)){
        order.payment_splits = normalizePaymentSplits({ payment_splits: payload.payment_splits });
      } else if (Object.prototype.hasOwnProperty.call(payload || {}, "payment_method")){
        const pm = String(payload.payment_method || "").toLowerCase();
        if (!pm.includes("divid")) order.payment_splits = [];
      }
      saveDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    const orderCancelMatch = pathName.match(/^\/api\/orders\/(\d+)\/cancel$/);
    if (method === "POST" && orderCancelMatch){
      const id = Number(orderCancelMatch[1]);
      const order = db.orders.find((row) => Number(row.id) === id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      order.status = "CANCELADO";
      saveDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathName === "/api/delivery/pending"){
      const rows = db.orders
        .filter((order) =>
          String(order.order_type || "") === "entrega" &&
          String(order.status || "").toUpperCase() === "ABERTO" &&
          String(order.delivery_status || "PREPARO").toUpperCase() !== "FINALIZADO"
        )
        .map((order) => ({
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          created_at: order.created_at || nowIso(),
          customer_name: String(order.customer_name || ""),
          address: String(order.address || ""),
          total: orderTotal(db, order.id),
          delivery_status: String(order.delivery_status || "PREPARO"),
        }))
        .sort((a, b) => b.id - a.id);
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    if (method === "GET" && pathName === "/api/delivery/history"){
      const date = String(urlObj.searchParams.get("date") || dayKeyFromIso(nowIso())).trim();
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      const startTs = start.getTime();
      const endTs = end.getTime();
      const rows = db.orders
        .filter((order) => {
          if (String(order.order_type || "") !== "entrega") return false;
          if (String(order.delivery_status || "").toUpperCase() !== "FINALIZADO") return false;
          const finishedAt = String(order.delivery_finalized_at || order.created_at || "");
          const ts = new Date(finishedAt).getTime();
          return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
        })
        .map((order) => ({
          id: Number(order.id),
          order_number: Number(order.order_number || 0),
          created_at: order.created_at || nowIso(),
          customer_name: String(order.customer_name || ""),
          address: String(order.address || ""),
          total: orderTotal(db, order.id),
          delivery_status: String(order.delivery_status || "FINALIZADO"),
          delivery_finalized_at: String(order.delivery_finalized_at || order.created_at || nowIso()),
        }))
        .sort((a, b) => new Date(String(b.delivery_finalized_at || "")).getTime() - new Date(String(a.delivery_finalized_at || "")).getTime());
      sendJson(res, 200, { ok: true, rows });
      return;
    }

    const orderGetMatch = pathName.match(/^\/api\/orders\/(\d+)$/);
    if (method === "GET" && orderGetMatch){
      const id = Number(orderGetMatch[1]);
      const order = getOrderById(db, id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      const items = getItemsForOrder(db, id);
      sendJson(res, 200, { ok: true, order, items });
      return;
    }

    const kitchenReadyMatch = pathName.match(/^\/api\/kitchen\/item\/(\d+)\/ready$/);
    if (method === "POST" && kitchenReadyMatch){
      const id = Number(kitchenReadyMatch[1]);
      const item = db.order_items.find((row) => Number(row.id) === id);
      if (!item){
        sendError(res, "Item nao encontrado", 400);
        return;
      }
      item.status = "PRONTO";
      item.ready_at = nowIso();
      saveDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    const deliveryDispatchMatch = pathName.match(/^\/api\/delivery\/(\d+)\/dispatch$/);
    if (method === "POST" && deliveryDispatchMatch){
      const id = Number(deliveryDispatchMatch[1]);
      const order = db.orders.find((row) => Number(row.id) === id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      order.delivery_status = "DESPACHADO";
      order.delivery_dispatched_at = nowIso();
      saveDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    const deliveryFinalizeMatch = pathName.match(/^\/api\/delivery\/(\d+)\/finalize$/);
    if (method === "POST" && deliveryFinalizeMatch){
      const id = Number(deliveryFinalizeMatch[1]);
      const order = db.orders.find((row) => Number(row.id) === id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      order.delivery_status = "FINALIZADO";
      order.delivery_finalized_at = nowIso();
      saveDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    const orderFinalizeMatch = pathName.match(/^\/api\/orders\/(\d+)\/finalize$/);
    if (method === "POST" && orderFinalizeMatch){
      const id = Number(orderFinalizeMatch[1]);
      const payload = parseJsonBody(await readRawBody(req));
      const order = db.orders.find((row) => Number(row.id) === id);
      if (!order){
        sendError(res, "Pedido nao encontrado", 404);
        return;
      }
      const cashError = ensureCashOpen(db, "finalizar a venda");
      if (cashError){
        sendError(res, cashError, 400);
        return;
      }
      if (String(order.status || "").toUpperCase() !== "ABERTO"){
        sendError(res, "Pedido ja esta fechado", 400);
        return;
      }
      const payment = String(payload.payment_method || "").trim();
      if (!payment){
        sendError(res, "Informe o pagamento", 400);
        return;
      }

      order.order_type = payload.order_type || order.order_type || "mesa";
      order.table_no = payload.table_no || order.table_no || "";
      order.customer_name = payload.customer_name || order.customer_name || "";
      order.customer_phone = payload.customer_phone || order.customer_phone || "";
      order.address = payload.address || order.address || "";
      order.notes = payload.notes || order.notes || "";
      order.payment_method = payment;
      order.payment_splits = normalizePaymentSplits({ payment_splits: payload.payment_splits });
      order.subtotal = Number(payload?.totals?.subtotal ?? order.subtotal ?? 0);
      order.discount = Number(payload?.totals?.discount ?? order.discount ?? 0);
      order.fee = Number(payload?.totals?.fee ?? order.fee ?? 0);
      order.total = Number(payload?.totals?.total ?? orderTotal(db, id));
      order.status = "FECHADO";
      order.finalized_at = nowIso();

      saveDb(db);
      sendJson(res, 200, { ok: true, order_id: id, order_number: order.order_number });
      return;
    }

    if (method === "POST" && pathName === "/api/orders"){
      const cashError = ensureCashOpen(db, "registrar o pedido");
      if (cashError){
        sendError(res, cashError, 400);
        return;
      }

      const payload = parseJsonBody(await readRawBody(req));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length === 0){
        sendError(res, "Carrinho vazio", 400);
        return;
      }

      const now = nowIso();
      const orderType = String(payload.order_type || "retirada");
      const orderStatus = (orderType === "mesa" || orderType === "a_receber") ? "ABERTO" : "FECHADO";
      const tableNo = String(payload.table_no || "").trim();
      const receivableId = Number(payload?.receivable_id || 0);
      const receivableName = String(payload?.customer_name || "").trim();
      let orderId = null;
      let orderNumber = null;
      let existing = null;

      if (orderType === "mesa" && tableNo){
        existing = db.orders.find((order) =>
          String(order.order_type || "") === "mesa" &&
          String(order.status || "").toUpperCase() === "ABERTO" &&
          String(order.table_no || "").trim() === tableNo
        );
      }

      if (orderType === "a_receber"){
        if (Number.isFinite(receivableId) && receivableId > 0){
          existing = db.orders.find((order) =>
            Number(order.id) === receivableId &&
            String(order.order_type || "") === "a_receber" &&
            String(order.status || "").toUpperCase() === "ABERTO"
          );
        }
        if (!existing && receivableName){
          const normalized = receivableName.toLocaleLowerCase("pt-BR");
          existing = db.orders.find((order) =>
            String(order.order_type || "") === "a_receber" &&
            String(order.status || "").toUpperCase() === "ABERTO" &&
            String(order.customer_name || "").trim().toLocaleLowerCase("pt-BR") === normalized
          );
        }
      }

      if (existing){
        orderId = Number(existing.id);
        orderNumber = Number(existing.order_number || 0);
        if (orderType === "a_receber"){
          existing.merged_count = receivableLaunchCount(db, existing) + 1;
          existing.launch_count_mode = "launch_only";
        } else {
          existing.merged_count = Number(existing.merged_count || 1) + 1;
        }
        const newName = String(payload.customer_name || "").trim();
        if (newName && orderType === "a_receber"){
          existing.customer_name = newName;
        } else if (newName){
          const currentNames = String(existing.customer_name || "").split("/").map((value) => value.trim()).filter(Boolean);
          if (!currentNames.includes(newName)){
            existing.customer_name = currentNames.length ? `${currentNames.join(" / ")} / ${newName}` : newName;
          }
        }
        if (orderType === "a_receber"){
          const newPhone = String(payload.customer_phone || "").trim();
          if (newPhone) existing.customer_phone = newPhone;
        }
        existing.subtotal = Number(existing.subtotal || 0) + Number(payload?.totals?.subtotal || 0);
        existing.discount = Number(existing.discount || 0) + Number(payload?.totals?.discount || 0);
        existing.fee = Number(existing.fee || 0) + Number(payload?.totals?.fee || 0);
        existing.total = Number(existing.total || 0) + Number(payload?.totals?.total || 0);
        if (payload.notes){
          const sep = existing.notes ? " | " : "";
          existing.notes = String(existing.notes || "") + sep + String(payload.notes || "");
        }
      } else {
        if (orderType === "a_receber" && !receivableName){
          sendError(res, "Informe o cliente para lançar no fiado", 400);
          return;
        }
        orderId = db.seq.order++;
        orderNumber = Number(db.meta.last_order_number || 0) + 1;
        db.meta.last_order_number = orderNumber;

        db.orders.push({
          id: orderId,
          order_number: orderNumber,
          created_at: now,
          finalized_at: orderStatus === "FECHADO" ? now : "",
          order_type: orderType,
          table_no: tableNo,
          customer_name: String(payload.customer_name || ""),
          customer_phone: String(payload.customer_phone || ""),
          address: String(payload.address || ""),
          notes: String(payload.notes || ""),
          payment_method: String(payload.payment_method || ""),
          payment_splits: normalizePaymentSplits({ payment_splits: payload.payment_splits }),
          delivery_status: orderType === "entrega" ? "PREPARO" : "",
          status: orderStatus,
          merged_count: orderType === "a_receber" ? 1 : 0,
          launch_count_mode: orderType === "a_receber" ? "launch_only" : "",
          subtotal: Number(payload?.totals?.subtotal || 0),
          discount: Number(payload?.totals?.discount || 0),
          fee: Number(payload?.totals?.fee || 0),
          total: Number(payload?.totals?.total || 0),
        });
      }

      for (const item of items){
        const itemId = db.seq.item++;
        db.order_items.push({
          id: itemId,
          order_id: orderId,
          name: String(item?.name || "Item"),
          qty: Number(item?.qty || 1),
          unit_price: Number(item?.unit_price || 0),
          notes: String(item?.notes || ""),
          is_kitchen: item?.is_kitchen ? 1 : 0,
          status: "PENDENTE",
        });
      }

      saveDb(db);
      sendJson(res, 200, { ok: true, order_id: orderId, order_number: orderNumber });
      return;
    }

    if (method === "GET" && pathName === "/api/diag"){
      ensureDataDir();
      const size = fs.existsSync(dataFile) ? fs.statSync(dataFile).size : 0;
      sendJson(res, 200, {
        ok: true,
        app: {
          version: "server-json-v1",
          runtime: "Node.js",
          platform: process.platform,
          arch: process.arch,
          uptime: Number(process.uptime().toFixed(0)),
        },
        db: {
          label: "Base JSON do servidor",
          size,
          orders: db.orders.length,
          items: db.order_items.length,
          movements: Array.isArray(db.cash_movements) ? db.cash_movements.length : 0,
          cash_status: db.meta.cash_status,
          last_backup_at: db.meta.last_backup_at,
          last_backup_path: db.meta.last_backup_path,
        },
        access: {
          controlled_signup: isControlledSignupConfigured(),
          invite_codes_count: getAccessInviteRows(db).length,
          supabase_url_configured: !!SUPABASE_URL,
          supabase_service_role_configured: !!SUPABASE_SERVICE_ROLE_KEY,
          owner_access_configured: isOwnerAccessConfigured(),
          owner_emails_count: ACCESS_OWNER_EMAILS.length,
        },
      });
      return;
    }

    if (method === "GET" && pathName === "/api/backup/export"){
      db.meta.last_backup_at = nowIso();
      db.meta.last_backup_path = "server_manual_export";
      saveDb(db);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-MVS-Backend": "node-json",
      });
      res.end(JSON.stringify(normalizeDb(db), null, 2));
      return;
    }

    if (method === "POST" && pathName === "/api/backup/import"){
      const rawBody = await readRawBody(req);
      const text = rawBody.toString("utf8");
      if (!text){
        sendError(res, "Arquivo invalido", 400);
        return;
      }
      let parsed;
      try{
        parsed = JSON.parse(text);
      } catch {
        sendError(res, "Backup invalido (esperado JSON)", 400);
        return;
      }
      const imported = normalizeDb(parsed);
      saveDb(imported, { normalize: false, immediate: true });
      sendJson(res, 200, { ok: true });
      return;
    }

    sendError(res, "Rota não implementada", 404);
  }

  return { handle };
}

module.exports = { createApiHandler };
