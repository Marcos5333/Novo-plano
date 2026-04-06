// ===== Helpers (carregados de helpers.js) =====
    if (!window.MVS_HELPERS){
      throw new Error("js/core/helpers.js não carregado antes dos arquivos de app");
    }
    const {
      brl,
      escapeHtml,
      escapeAttr,
      openPrintModal,
      closePrintModal,
      openPrintUrl,
      readJsonSafe,
      lockSignaturePosition,
      removeSignatureBackground,
      uid,
      parsePrice,
      paymentMethodLabel,
      cashMovementLabel,
      describeCashMovement,
      roundMoney,
    } = window.MVS_HELPERS;

    // ===== Demo Storage Mode / Backend Runtime =====
    const MVS_RUNTIME_CONFIG = (window.MVS_RUNTIME_CONFIG && typeof window.MVS_RUNTIME_CONFIG === "object")
      ? window.MVS_RUNTIME_CONFIG
      : {};
    const DEMO_STORAGE_MODE = String(MVS_RUNTIME_CONFIG.backendMode || "demo").toLowerCase() !== "server";
    const DEMO_DB_KEY = "mvs_demo_backend_v1";
    const AUTO_BACKUP_PREFIX = "mvs_auto_backup_";
    const AUTO_BACKUP_INDEX = "mvs_auto_backup_index_v1";
    const AUTO_BACKUP_ENABLED_KEY = "mvs_auto_backup_enabled_v1";
    window.__MVS_DEMO_STORAGE = DEMO_STORAGE_MODE;
    window.__MVS_STORAGE_LABEL = String(
      MVS_RUNTIME_CONFIG.storageLabel ||
      (DEMO_STORAGE_MODE ? "Base local" : "Base no servidor")
    );

    if (DEMO_STORAGE_MODE) {
      installDemoStorageApiShim();
    }

    function installDemoStorageApiShim(){
      const DEMO_DB_KEY = "mvs_demo_backend_v1";
      const nativeFetch = window.fetch.bind(window);
      const nativeOpen = window.open.bind(window);

      function demoNowIso(){
        return new Date().toISOString();
      }

      function demoCreateBaseDb(){
        return {
          version: 1,
          seq: { order: 1, item: 1, movement: 1 },
          meta: {
            last_order_number: 0,
            cash_status: "FECHADO",
            cash_opened_at: "",
            cash_opening_amount: 0,
            cash_last_opened_at: "",
            cash_last_closed_at: "",
            last_backup_at: "",
            last_backup_path: ""
          },
          orders: [],
          order_items: [],
          cash_movements: [],
          cash_closings: []
        };
      }

      function demoNormalizeDb(raw){
        const base = demoCreateBaseDb();
        const source = (raw && typeof raw === "object") ? raw : {};
        const normalized = {
          version: 1,
          seq: {
            order: Math.max(1, Number(source?.seq?.order || base.seq.order)),
            item: Math.max(1, Number(source?.seq?.item || base.seq.item)),
            movement: Math.max(1, Number(source?.seq?.movement || base.seq.movement)),
          },
          meta: {
            last_order_number: Math.max(0, Number(source?.meta?.last_order_number || base.meta.last_order_number)),
            cash_status: String(source?.meta?.cash_status || base.meta.cash_status).toUpperCase() === "FECHADO" ? "FECHADO" : "ABERTO",
            cash_opened_at: String(source?.meta?.cash_opened_at || base.meta.cash_opened_at),
            cash_opening_amount: Math.max(0, roundMoney(Number(source?.meta?.cash_opening_amount ?? base.meta.cash_opening_amount))),
            cash_last_opened_at: String(source?.meta?.cash_last_opened_at || ""),
            cash_last_closed_at: String(source?.meta?.cash_last_closed_at || ""),
            last_backup_at: String(source?.meta?.last_backup_at || ""),
            last_backup_path: String(source?.meta?.last_backup_path || ""),
          },
          orders: Array.isArray(source?.orders) ? source.orders : [],
          order_items: Array.isArray(source?.order_items) ? source.order_items : [],
          cash_movements: Array.isArray(source?.cash_movements)
            ? source.cash_movements.map((row) => ({
                id: Math.max(1, Number(row?.id || 0)),
                kind: (() => {
                  const key = String(row?.kind || "").trim().toLowerCase();
                  if (["abertura", "sangria", "despesa", "pagamento_funcionario"].includes(key)) return key;
                  return "despesa";
                })(),
                amount: Math.max(0, roundMoney(Number(row?.amount || 0))),
                reason: String(row?.reason || ""),
                employee_name: String(row?.employee_name || ""),
                created_at: String(row?.created_at || base.meta.cash_opened_at),
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
                  cash_out: roundMoney(Number(row?.summary?.cash_out || 0)),
                  projected_cash: roundMoney(Number(row?.summary?.projected_cash || 0)),
                  count: Math.max(0, Number(row?.summary?.count || 0)),
                },
                created_at: String(row?.created_at || base.meta.cash_opened_at),
              }))
            : []
        };

        const maxOrderId = normalized.orders.reduce((acc, o) => Math.max(acc, Number(o?.id || 0)), 0);
        const maxItemId = normalized.order_items.reduce((acc, it) => Math.max(acc, Number(it?.id || 0)), 0);
        const maxMovementId = normalized.cash_movements.reduce((acc, mv) => Math.max(acc, Number(mv?.id || 0)), 0);
        normalized.seq.order = Math.max(normalized.seq.order, maxOrderId + 1);
        normalized.seq.item = Math.max(normalized.seq.item, maxItemId + 1);
        normalized.seq.movement = Math.max(normalized.seq.movement, maxMovementId + 1);
        return normalized;
      }

      function demoLoadDb(){
        try{
          const raw = localStorage.getItem(DEMO_DB_KEY);
          if (!raw) {
            const base = demoCreateBaseDb();
            localStorage.setItem(DEMO_DB_KEY, JSON.stringify(base));
            return base;
          }
          return demoNormalizeDb(JSON.parse(raw));
        } catch {
          const base = demoCreateBaseDb();
          localStorage.setItem(DEMO_DB_KEY, JSON.stringify(base));
          return base;
        }
      }

      function demoSaveDb(db){
        localStorage.setItem(DEMO_DB_KEY, JSON.stringify(demoNormalizeDb(db)));
      }

      function demoJson(data, status = 200){
        return new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }

      function demoError(message, status = 400){
        return demoJson({ ok: false, error: String(message || "Erro") }, status);
      }

      function demoParseJsonBody(init){
        const body = init?.body;
        if (!body) return {};
        if (typeof body === "string") {
          try { return JSON.parse(body); } catch { return {}; }
        }
        return {};
      }

      async function demoReadBodyText(body){
        if (body == null) return "";
        if (typeof body === "string") return body;
        if (body instanceof ArrayBuffer) {
          return new TextDecoder().decode(new Uint8Array(body));
        }
        if (ArrayBuffer.isView(body)) {
          return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
        }
        if (typeof Blob !== "undefined" && body instanceof Blob) {
          return await body.text();
        }
        return "";
      }

      function demoPaymentBucket(payment){
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

      function demoNormalizePaymentSplits(order){
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

      function demoIsCashOpen(db){
        return String(db?.meta?.cash_status || "").toUpperCase() === "ABERTO";
      }

      function demoEnsureCashOpen(db, action = "registrar o pedido"){
        if (demoIsCashOpen(db)) return null;
        return demoError(`Caixa fechado. Abra o caixa para ${action}.`, 400);
      }

      function demoOrderTotal(db, orderId){
        const itemsTotal = db.order_items
          .filter((it) => Number(it.order_id) === Number(orderId))
          .reduce((acc, it) => acc + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0);
        const order = db.orders.find((o) => Number(o.id) === Number(orderId));
        const discount = Number(order?.discount || 0);
        const fee = Number(order?.fee || 0);
        return roundMoney(Math.max(0, itemsTotal - discount + fee));
      }

      function demoOrderCreatedAt(order){
        return String(order?.created_at || demoNowIso());
      }

      function demoOrderReportedAt(order){
        const finalizedAt = String(order?.finalized_at || "").trim();
        return finalizedAt || demoOrderCreatedAt(order);
      }

      function demoReceivableLaunchCount(db, order){
        const rawCount = Number(order?.merged_count);
        const orderId = Number(order?.id || 0);
        const hasItems = db.order_items.some((it) => Number(it.order_id) === orderId);
        const mode = String(order?.launch_count_mode || "").trim().toLowerCase();
        if (mode === "launch_only"){
          return Math.max(0, Number.isFinite(rawCount) ? Math.trunc(rawCount) : 0);
        }
        if (!hasItems) return 0;
        if (!Number.isFinite(rawCount)) return 1;
        return Math.max(1, Math.trunc(rawCount) - 1);
      }

      function demoDayKeyFromIso(iso){
        const d = new Date(iso || demoNowIso());
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      function demoNormalizeMovementKind(kind){
        const key = String(kind || "").trim().toLowerCase();
        if (["abertura", "sangria", "despesa", "pagamento_funcionario"].includes(key)) return key;
        return "";
      }

      function demoAddCashMovement(db, { kind, amount, reason = "", employee_name = "", created_at = "" } = {}){
        const normalizedKind = demoNormalizeMovementKind(kind);
        if (!normalizedKind) return null;
        const normalizedAmount = Math.max(0, roundMoney(Number(amount || 0)));
        const row = {
          id: Number(db.seq?.movement || 1),
          kind: normalizedKind,
          amount: normalizedAmount,
          reason: String(reason || "").trim(),
          employee_name: String(employee_name || "").trim(),
          created_at: String(created_at || demoNowIso()),
        };
        db.seq.movement = row.id + 1;
        db.cash_movements.push(row);
        return row;
      }

      function demoSumCashMovementsBetween(db, startIso, endIso){
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        const rows = (Array.isArray(db.cash_movements) ? db.cash_movements : [])
          .filter((mv) => {
            const ts = new Date(mv?.created_at).getTime();
            return Number.isFinite(ts) && ts >= start && ts <= end;
          })
          .map((mv) => ({
            id: Number(mv?.id || 0),
            kind: demoNormalizeMovementKind(mv?.kind),
            amount: Math.max(0, roundMoney(Number(mv?.amount || 0))),
            reason: String(mv?.reason || ""),
            employee_name: String(mv?.employee_name || ""),
            created_at: String(mv?.created_at || demoNowIso()),
          }))
          .filter((mv) => !!mv.kind)
          .sort((a, b) => a.id - b.id);

        const byKind = {
          abertura: 0,
          sangria: 0,
          despesa: 0,
          pagamento_funcionario: 0,
        };

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

      function demoSumOrdersBetween(db, startIso, endIso){
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        const rows = db.orders
          .filter((o) => {
            const status = String(o.status || "").toUpperCase();
            const ts = new Date(demoOrderReportedAt(o)).getTime();
            return status === "FECHADO" && Number.isFinite(ts) && ts >= start && ts <= end;
          })
          .map((o) => ({
            id: Number(o.id),
            order_number: Number(o.order_number || 0),
            payment_method: o.payment_method || "",
            payment_splits: demoNormalizePaymentSplits(o),
            created_at: demoOrderCreatedAt(o),
            reported_at: demoOrderReportedAt(o),
            finalized_at: String(o.finalized_at || ""),
            total: demoOrderTotal(db, o.id),
            order_type: String(o.order_type || ""),
            table_no: String(o.table_no || ""),
            customer_name: String(o.customer_name || ""),
            items: db.order_items
              .filter((it) => Number(it.order_id) === Number(o.id))
              .map((it) => ({
                name: String(it.name || "Item"),
                qty: Number(it.qty || 0),
                unit_price: Number(it.unit_price || 0),
                notes: String(it.notes || ""),
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
          const t = Number(row.total || 0);
          totalGeral += t;
          const splits = Array.isArray(row.payment_splits) ? row.payment_splits : [];
          if (splits.length){
            let splitTotal = 0;
            for (const split of splits){
              const amount = Number(split.amount || 0);
              if (!Number.isFinite(amount) || amount <= 0) continue;
              splitTotal += amount;
              byPay[demoPaymentBucket(split.method)] += amount;
            }
            const missing = roundMoney(t - splitTotal);
            if (missing > 0){
              byPay[demoPaymentBucket(row.payment_method)] += missing;
            }
          } else {
            byPay[demoPaymentBucket(row.payment_method)] += t;
          }
        }
        const movementTotals = demoSumCashMovementsBetween(db, startIso, endIso);
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

      function demoParseDateOnly(dateStr){
        const value = String(dateStr || "").trim();
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!m) return new Date();
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        return new Date(y, mo, d);
      }

      function demoGetReportRange(period, dateStr){
        const p = String(period || "").toLowerCase();
        const base = demoParseDateOnly(dateStr);
        const y = base.getFullYear();
        const m = base.getMonth();
        const d = base.getDate();

        if (["day", "daily", "diario"].includes(p)) {
          return {
            key: "day",
            title: "Relatório Diário",
            start: new Date(y, m, d, 0, 0, 0, 0),
            end: new Date(y, m, d, 23, 59, 59, 999),
          };
        }
        if (["month", "monthly", "mensal"].includes(p)) {
          return {
            key: "month",
            title: "Relatório Mensal",
            start: new Date(y, m, 1, 0, 0, 0, 0),
            end: new Date(y, m + 1, 0, 23, 59, 59, 999),
          };
        }
        if (["year", "yearly", "annual", "anual"].includes(p)) {
          return {
            key: "year",
            title: "Relatório Anual",
            start: new Date(y, 0, 1, 0, 0, 0, 0),
            end: new Date(y, 11, 31, 23, 59, 59, 999),
          };
        }
        return null;
      }

      function demoGetCashReportRange(db, dayStr){
        const dayRaw = String(dayStr || "").trim();
        const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayRaw);
        if (!dayMatch){
          return {
            key: "cash",
            title: "Relatório de Caixa",
            start: db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString(),
            end: db.meta.cash_last_closed_at || demoNowIso(),
          };
        }

        const base = demoParseDateOnly(dayRaw);
        const y = base.getFullYear();
        const m = base.getMonth();
        const d = base.getDate();
        const dayLabel = base.toLocaleDateString("pt-BR");
        const closings = Array.isArray(db.cash_closings) ? db.cash_closings : [];
        const rows = closings
          .filter((row) => String(row?.day || "") === dayRaw)
          .sort((a, b) => new Date(String(a?.start || "")).getTime() - new Date(String(b?.start || "")).getTime());

        if (rows.length){
          const firstStart = rows[0]?.start;
          const lastEnd = rows[rows.length - 1]?.end;
          const startIso = firstStart || new Date(y, m, d, 0, 0, 0, 0).toISOString();
          const endIso = lastEnd || new Date(y, m, d, 23, 59, 59, 999).toISOString();
          return {
            key: "cash",
            title: `Relatório de Caixa - ${dayLabel} (Fechamento)`,
            start: startIso,
            end: endIso,
          };
        }

        return {
          key: "cash",
          title: `Relatório de Caixa - ${dayLabel}`,
          start: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
          end: new Date(y, m, d, 23, 59, 59, 999).toISOString(),
        };
      }

      function demoHtmlPage(title, bodyHtml){
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

      function demoBuildOrderPrintHtml(order, items){
        const dt = order?.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : "-";
        const subtotal = roundMoney(items.reduce((acc, it) => acc + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0));
        const discount = roundMoney(Number(order?.discount || 0));
        const fee = roundMoney(Number(order?.fee || 0));
        const totalRaw = Number(order?.total);
        const total = Number.isFinite(totalRaw) && totalRaw > 0
          ? roundMoney(totalRaw)
          : roundMoney(Math.max(0, subtotal - discount + fee));
        const splits = demoNormalizePaymentSplits(order);
        const paymentSummary = splits.length
          ? "DIVIDIDO"
          : String(order?.payment_method || "-").toUpperCase();
        const splitRows = splits.map((split, idx) => {
          const person = split.person_name || `Pessoa ${idx + 1}`;
          const cashDetail = split.method === "dinheiro" && Number(split.cash_change || 0) > 0
            ? ` • Recebido ${brl(split.cash_received || split.amount || 0)} • Troco ${brl(split.cash_change || 0)}`
            : "";
          return `<div class="muted">• ${escapeHtml(person)} • ${escapeHtml(paymentMethodLabel(split.method).toUpperCase())}: ${escapeHtml(brl(split.amount || 0))}${cashDetail ? ` ${escapeHtml(cashDetail)}` : ""}</div>`;
        }).join("");
        const rows = items.map((it) => {
          const qty = Number(it.qty || 0);
          const unit = Number(it.unit_price || 0);
          const line = Number(it.qty || 0) * Number(it.unit_price || 0);
          const notes = String(it.notes || "").trim();
          return `
            <tr>
              <td>
                <div>${escapeHtml(`${qty}x ${it.name}`)}</div>
                <div class="muted">Unitário: ${escapeHtml(brl(unit))}</div>
                ${notes ? `<div class="muted">Obs: ${escapeHtml(notes)}</div>` : ""}
              </td>
              <td class="amount">${escapeHtml(brl(line))}</td>
            </tr>
          `;
        }).join("");

        return demoHtmlPage(
          `Comanda #${order?.order_number || "-"}`,
          `
            <h1>Comanda #${escapeHtml(String(order?.order_number || "-"))}</h1>
            <p class="muted">Impresso em ${escapeHtml(dt)}</p>
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

      function demoNormalizeReportMode(mode){
        const raw = String(mode || "").trim().toLowerCase();
        if (raw === "detailed" || raw === "detalhado" || raw === "detail") return "detailed";
        return "normal";
      }

      function demoNormalizeReportDetailScope(scope){
        const raw = String(scope || "").trim().toLowerCase();
        if (["cash_only", "somente_caixa", "caixa", "cash"].includes(raw)) return "cash_only";
        return "orders_and_cash";
      }

      function demoBuildReportHtml(title, startIso, endIso, report, rangeKey = "", mode = "normal", detailScope = "orders_and_cash"){
        const reportMode = demoNormalizeReportMode(mode);
        const normalizedDetailScope = demoNormalizeReportDetailScope(detailScope);
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
        const showCashBreakdown = (rangeKey === "cash") || (reportMode === "detailed");

        const rows = orderRows.map((r) => {
          const customer = String(r.customer_name || "").trim() || "-";
          const orderMoment = String(r.reported_at || r.created_at || "");
          return `
            <tr>
              <td>#${escapeHtml(String(r.order_number || "-"))}</td>
              <td>${escapeHtml(customer)}</td>
              <td>${escapeHtml(new Date(orderMoment).toLocaleString("pt-BR"))}</td>
              <td>${escapeHtml(brl(r.total || 0))}</td>
            </tr>
          `;
        }).join("");

        const detailedRows = orderRows.map((r) => {
          const typeLabel = String(r.order_type || "-").toUpperCase();
          const customer = String(r.customer_name || "").trim() || "-";
          const tableNo = String(r.table_no || "").trim();
          const typeWithTable = (typeLabel === "MESA" && tableNo) ? `MESA ${tableNo}` : typeLabel;
          const orderMoment = String(r.reported_at || r.created_at || "");
          const splits = Array.isArray(r.payment_splits) ? r.payment_splits : [];
          const paySummary = splits.length
            ? "DIVIDIDO"
            : paymentMethodLabel(r.payment_method || "-");
          const splitHtml = splits.length
            ? splits.map((split, idx) => {
                const person = String(split?.person_name || "").trim() || `Pessoa ${idx + 1}`;
                const cashDetail = split.method === "dinheiro" && Number(split.cash_change || 0) > 0
                  ? ` • Recebido ${brl(split.cash_received || split.amount || 0)} • Troco ${brl(split.cash_change || 0)}`
                  : "";
                return `<div class="muted">  • ${escapeHtml(person)}: ${escapeHtml(paymentMethodLabel(split.method))} ${escapeHtml(brl(split.amount || 0))}${cashDetail ? ` ${escapeHtml(cashDetail)}` : ""}</div>`;
              }).join("")
            : "";
          const items = Array.isArray(r.items) ? r.items : [];
          const itemsHtml = items.length
            ? items.map((it) => {
                const qty = Number(it.qty || 0);
                const unit = Number(it.unit_price || 0);
                const line = roundMoney(qty * unit);
                const notes = String(it.notes || "").trim();
                return `
                  <div>• ${escapeHtml(`${qty}x ${it.name}`)} - ${escapeHtml(brl(line))}</div>
                  <div class="muted">  Unitario: ${escapeHtml(brl(unit))}</div>
                  ${notes ? `<div class="muted">  Obs: ${escapeHtml(notes)}</div>` : ""}
                `;
              }).join("")
            : `<div class="muted">Sem itens no pedido.</div>`;
          return `
            <div class="box">
              <div><b>Pedido #${escapeHtml(String(r.order_number || "-"))}</b> - ${escapeHtml(new Date(orderMoment).toLocaleString("pt-BR"))}</div>
              <div>Cliente: ${escapeHtml(customer)} - Origem: ${escapeHtml(typeWithTable)}</div>
              <div>Pagamento: ${escapeHtml(paySummary)} - Total: ${escapeHtml(brl(r.total || 0))}</div>
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
            <div class="muted">A abertura do caixa ja esta considerada automaticamente neste saldo.</div>
          </div>
        ` : "";

        const normalSection = `
          <div class="box">
            <table class="reportTable">
              <thead>
                <tr><th>Pedido</th><th>Cliente</th><th>Data/Hora</th><th>Total</th></tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="4">Sem vendas no periodo</td></tr>`}</tbody>
            </table>
          </div>
        `;

        const detailedSection = includeDetailedOrders
          ? `
            <div class="hr"></div>
            <h1>Pedidos Detalhados (Cliente • Produto • Horario)</h1>
            ${detailedRows || `<div class="box">Sem vendas no periodo.</div>`}
          `
          : `
            <div class="box">
              <div><b>Pedidos detalhados:</b> não incluídos (somente dados do caixa).</div>
            </div>
          `;

        const cashMovementRows = (Array.isArray(report.movements) ? report.movements : []).map((mv) => {
          const movementView = describeCashMovement(mv);
          return `
            <tr>
              <td>${escapeHtml(new Date(mv.created_at).toLocaleString("pt-BR"))}</td>
              <td>${escapeHtml(movementView.label)}</td>
              <td>${escapeHtml(movementView.description)}</td>
              <td class="amount">${escapeHtml(brl(mv.amount || 0))}</td>
            </tr>
          `;
        }).join("");

        const movementTableSection = showCashBreakdown ? `
          <div class="box">
            <table class="reportTable movementTable">
              <thead>
                <tr><th>Data/Hora</th><th>Tipo</th><th>Motivo</th><th>Valor</th></tr>
              </thead>
              <tbody>${cashMovementRows || `<tr><td colspan="4">Sem lançamentos no período</td></tr>`}</tbody>
            </table>
          </div>
        ` : "";

        return demoHtmlPage(
          title,
          `
            <h1>${escapeHtml(title)}${reportMode === "detailed" ? " - Detalhado" : " - Normal"}</h1>
            <p class="muted">Periodo: <b>${escapeHtml(dtStart)}</b> ate <b>${escapeHtml(dtEnd)}</b></p>
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

      function demoOpenHtml(html, target, features){
        openPrintModal(html);
        return null;
      }

      function demoHandleApiOpen(urlObj, target, features){
        const path = urlObj.pathname;
        const db = demoLoadDb();

        const orderPrint = path.match(/^\/api\/orders\/(\d+)\/print$/);
        if (orderPrint){
          const orderId = Number(orderPrint[1]);
          const order = db.orders.find((o) => Number(o.id) === orderId);
          if (!order) {
            return demoOpenHtml(demoHtmlPage("Pedido nao encontrado", "<h1>Pedido nao encontrado</h1>"), target, features);
          }
          const items = db.order_items.filter((it) => Number(it.order_id) === orderId);
          return demoOpenHtml(demoBuildOrderPrintHtml(order, items), target, features);
        }

        if (path === "/api/cash/report/print"){
          const cashRange = demoGetCashReportRange(db, urlObj.searchParams.get("day"));
          const start = cashRange.start;
          const end = cashRange.end;
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          const detailScope = demoNormalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
          return demoOpenHtml(demoBuildReportHtml(cashRange.title, start, end, report, cashRange.key || "cash", mode, detailScope), target, features);
        }

        if (path === "/api/reports/print"){
          const range = demoGetReportRange(urlObj.searchParams.get("period"), urlObj.searchParams.get("date"));
          if (!range){
            return demoOpenHtml(demoHtmlPage("Parametros invalidos", "<h1>Parametros invalidos</h1>"), target, features);
          }
          const start = range.start.toISOString();
          const end = range.end.toISOString();
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          const detailScope = demoNormalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
          return demoOpenHtml(demoBuildReportHtml(range.title, start, end, report, range.key || "", mode, detailScope), target, features);
        }

        return null;
      }

      async function demoHandleApiFetch(urlObj, init = {}){
        const method = String(init?.method || "GET").toUpperCase();
        const path = urlObj.pathname;
        const db = demoLoadDb();

        const orderPrint = path.match(/^\/api\/orders\/(\d+)\/print$/);
        if (method === "GET" && orderPrint){
          const orderId = Number(orderPrint[1]);
          const order = db.orders.find((o) => Number(o.id) === orderId);
          if (!order) {
            return new Response(demoHtmlPage("Pedido nao encontrado", "<h1>Pedido nao encontrado</h1>"), {
              status: 404,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            });
          }
          const items = db.order_items.filter((it) => Number(it.order_id) === orderId);
          return new Response(demoBuildOrderPrintHtml(order, items), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }

        if (method === "GET" && path === "/api/cash/report/print"){
          const cashRange = demoGetCashReportRange(db, urlObj.searchParams.get("day"));
          const start = cashRange.start;
          const end = cashRange.end;
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          const detailScope = demoNormalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
          return new Response(demoBuildReportHtml(cashRange.title, start, end, report, cashRange.key || "cash", mode, detailScope), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }

        if (method === "GET" && path === "/api/reports/print"){
          const range = demoGetReportRange(urlObj.searchParams.get("period"), urlObj.searchParams.get("date"));
          if (!range){
            return new Response(demoHtmlPage("Parametros invalidos", "<h1>Parametros invalidos</h1>"), {
              status: 400,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            });
          }
          const start = range.start.toISOString();
          const end = range.end.toISOString();
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          const detailScope = demoNormalizeReportDetailScope(urlObj.searchParams.get("detail_scope"));
          return new Response(demoBuildReportHtml(range.title, start, end, report, range.key || "", mode, detailScope), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }

        if (method === "GET" && path === "/api/cash/status"){
          const isOpen = String(db.meta.cash_status || "").toUpperCase() === "ABERTO";
          if (!isOpen){
            return demoJson({
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
          }

          const shiftStart = db.meta.cash_opened_at || new Date(0).toISOString();
          const shiftEnd = demoNowIso();
          const report = demoSumOrdersBetween(db, shiftStart, shiftEnd);
          const totalEntries = roundMoney((report.totalIn ?? report.totalGeral) || 0);
          const moneySales = roundMoney(report.moneySales || 0);
          return demoJson({
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
        }

        if (method === "POST" && path === "/api/cash/reset"){
          if (String(db.meta.cash_status || "").toUpperCase() === "ABERTO"){
            return demoError("Feche o caixa antes de resetar o status.", 400);
          }
          db.meta.cash_opened_at = demoNowIso();
          db.meta.cash_opening_amount = 0;
          db.meta.cash_last_opened_at = "";
          db.meta.cash_last_closed_at = "";
          demoSaveDb(db);
          return demoJson({
            ok: true,
            cash_status: db.meta.cash_status,
            opening_amount: 0,
            projected_cash: 0,
            cash_sales: 0,
            money_sales: 0,
            total_entries: 0,
            cash_out: 0,
          });
        }

        if (method === "POST" && path === "/api/cash/open"){
          const payload = demoParseJsonBody(init);
          const openingAmountRaw = Number(payload?.opening_amount);
          const openingAmount = Number.isFinite(openingAmountRaw) && openingAmountRaw >= 0
            ? roundMoney(openingAmountRaw)
            : 0;

          db.meta.cash_status = "ABERTO";
          db.meta.cash_opened_at = demoNowIso();
          db.meta.cash_opening_amount = openingAmount;
          demoAddCashMovement(db, {
            kind: "abertura",
            amount: openingAmount,
            reason: "Abertura de caixa",
            created_at: db.meta.cash_opened_at,
          });
          demoSaveDb(db);
          return demoJson({
            ok: true,
            opened_at: db.meta.cash_opened_at,
            opening_amount: openingAmount
          });
        }

        if (method === "POST" && path === "/api/cash/close"){
          if (db.meta.cash_status !== "ABERTO") {
            return demoError("Caixa ja esta fechado", 400);
          }
          const start = db.meta.cash_opened_at || new Date(0).toISOString();
          const end = demoNowIso();
          const report = demoSumOrdersBetween(db, start, end);
          const day = demoDayKeyFromIso(end);
          const closingId = (Array.isArray(db.cash_closings) ? db.cash_closings : [])
            .reduce((acc, row) => Math.max(acc, Number(row?.id || 0)), 0) + 1;
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
          db.meta.last_backup_path = "demo_auto_cash_close";
          demoSaveDb(db);
          return demoJson({
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
            saved_day: day
          });
        }

        const movementRouteMatch = path.match(/^\/api\/cash\/movements\/(\d+)\/(update|delete)$/);
        if (movementRouteMatch && method === "POST"){
          const movementId = Number(movementRouteMatch[1]);
          const action = String(movementRouteMatch[2] || "").toLowerCase();
          const idx = db.cash_movements.findIndex((row) => Number(row?.id) === movementId);
          if (idx < 0) return demoError("Movimentação não encontrada.", 404);

          if (action === "delete"){
            db.cash_movements.splice(idx, 1);
            demoSaveDb(db);
            return demoJson({ ok: true });
          }

          const payload = demoParseJsonBody(init);
          const kind = demoNormalizeMovementKind(payload?.kind);
          if (!kind){
            return demoError("Tipo de movimentação inválido.", 400);
          }
          const amount = Number(payload?.amount);
          if (!Number.isFinite(amount) || amount <= 0){
            return demoError("Informe um valor válido.", 400);
          }
          const reason = String(payload?.reason || "").trim();
          if (!reason){
            return demoError("Informe o motivo.", 400);
          }
          const employeeName = String(payload?.employee_name || "").trim();
          if (kind === "pagamento_funcionario" && !employeeName){
            return demoError("Informe o nome do funcionário.", 400);
          }

          const target = db.cash_movements[idx];
          target.kind = kind;
          target.amount = roundMoney(amount);
          target.reason = reason;
          target.employee_name = employeeName;
          demoSaveDb(db);
          return demoJson({ ok: true, row: target });
        }

        if (path === "/api/cash/movements"){
          const defaultStart = db.meta.cash_status === "ABERTO"
            ? (db.meta.cash_opened_at || new Date(0).toISOString())
            : (db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString());
          const defaultEnd = db.meta.cash_status === "ABERTO"
            ? demoNowIso()
            : (db.meta.cash_last_closed_at || demoNowIso());
          const hasStartParam = urlObj.searchParams.has("start");
          const hasEndParam = urlObj.searchParams.has("end");
          const dateParam = String(urlObj.searchParams.get("date") || "").trim();
          const hasDateParam = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
          const isOpen = String(db.meta.cash_status || "").toUpperCase() === "ABERTO";
          let start = String(urlObj.searchParams.get("start") || defaultStart);
          let end = String(urlObj.searchParams.get("end") || defaultEnd);

          if (hasDateParam){
            const base = demoParseDateOnly(dateParam);
            start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0).toISOString();
            end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999).toISOString();
          }

          if (method === "GET"){
            if (!isOpen && !hasStartParam && !hasEndParam && !hasDateParam){
              return demoJson({
                ok: true,
                start: "",
                end: "",
                rows: [],
                totals: {
                  abertura: 0,
                  sangria: 0,
                  despesa: 0,
                  pagamento_funcionario: 0,
                  total_saidas: 0,
                },
                cash_sales: 0,
                money_sales: 0,
                total_entries: 0,
                projected_cash: 0,
                saved_day: db.meta.cash_last_closed_at ? demoDayKeyFromIso(db.meta.cash_last_closed_at) : "",
              });
            }

            const report = demoSumOrdersBetween(db, start, end);
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
              const typeLabel = (type === "MESA" && tableNo) ? `MESA ${tableNo}` : type;
              const customer = String(order?.customer_name || "").trim() || "-";
              const orderNo = Number(order?.order_number || 0) || "-";
              const reportAt = String(order?.reported_at || order?.created_at || demoNowIso());
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
              created_at: String(row?.created_at || demoNowIso()),
              can_edit: true,
              can_delete: true,
            }));

            const allRows = [...saleRows, ...movementRows].sort((a, b) => {
              const ta = new Date(a.created_at).getTime();
              const tb = new Date(b.created_at).getTime();
              if (Number.isFinite(ta) && Number.isFinite(tb) && tb !== ta) return tb - ta;
              return Number(b.sort_id || 0) - Number(a.sort_id || 0);
            });

            return demoJson({
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
          }

          if (method === "POST"){
            if (db.meta.cash_status !== "ABERTO") {
              return demoError("Caixa fechado. Abra o caixa para registrar saídas.", 400);
            }
            const payload = demoParseJsonBody(init);
            const kind = demoNormalizeMovementKind(payload?.kind);
            if (!["sangria", "despesa", "pagamento_funcionario"].includes(kind)){
              return demoError("Tipo de movimentação inválido.", 400);
            }
            const amount = Number(payload?.amount);
            if (!Number.isFinite(amount) || amount <= 0){
              return demoError("Informe um valor válido.", 400);
            }
            const reason = String(payload?.reason || "").trim();
            if (!reason){
              return demoError("Informe o motivo.", 400);
            }
            const employeeName = String(payload?.employee_name || "").trim();
            if (kind === "pagamento_funcionario" && !employeeName){
              return demoError("Informe o nome do funcionário.", 400);
            }

            const movement = demoAddCashMovement(db, {
              kind,
              amount,
              reason,
              employee_name: employeeName,
            });
            demoSaveDb(db);

            const liveReport = demoSumOrdersBetween(db, db.meta.cash_opened_at || new Date(0).toISOString(), demoNowIso());
            return demoJson({
              ok: true,
              movement,
              projected_cash: liveReport.projectedCash || 0,
            });
          }
        }

        if (method === "GET" && path === "/api/tables/open"){
          const rows = db.orders
            .filter((o) => String(o.order_type || "") === "mesa" && String(o.status || "").toUpperCase() === "ABERTO")
            .map((o) => ({
              id: Number(o.id),
              order_number: Number(o.order_number || 0),
              table_no: String(o.table_no || ""),
              created_at: o.created_at || demoNowIso(),
              customer_name: String(o.customer_name || ""),
              total: demoOrderTotal(db, o.id),
              order_count: Number(o.merged_count || 1),
              itemsSummary: (() => {
                const items = db.order_items.filter((it) => Number(it.order_id) === Number(o.id));
                const map = new Map();
                for (const it of items){
                  const key = `${it.name}||${it.notes || ""}`;
                  const cur = map.get(key) || { name: String(it.name || "Item"), qty: 0, notes: String(it.notes || "") };
                  cur.qty += Number(it.qty || 1);
                  map.set(key, cur);
                }
                return Array.from(map.values());
              })()
            }))
            .sort((a, b) => b.id - a.id);
          return demoJson({ ok: true, rows });
        }

        if (method === "GET" && path === "/api/receivables/open"){
          const rows = db.orders
            .filter((o) => String(o.order_type || "") === "a_receber" && String(o.status || "").toUpperCase() === "ABERTO")
            .map((o) => ({
              id: Number(o.id),
              order_number: Number(o.order_number || 0),
              created_at: o.created_at || demoNowIso(),
              customer_name: String(o.customer_name || ""),
              customer_phone: String(o.customer_phone || ""),
              total: demoOrderTotal(db, o.id),
              order_count: demoReceivableLaunchCount(db, o),
              itemsSummary: (() => {
                const items = db.order_items.filter((it) => Number(it.order_id) === Number(o.id));
                const map = new Map();
                for (const it of items){
                  const key = `${it.name}||${it.notes || ""}`;
                  const cur = map.get(key) || { name: String(it.name || "Item"), qty: 0, notes: String(it.notes || "") };
                  cur.qty += Number(it.qty || 1);
                  map.set(key, cur);
                }
                return Array.from(map.values());
              })()
            }))
            .sort((a, b) => b.id - a.id);
          return demoJson({ ok: true, rows });
        }

        if (method === "POST" && path === "/api/receivables/open"){
          const cashError = demoEnsureCashOpen(db, "abrir o fiado");
          if (cashError) return cashError;

          const payload = demoParseJsonBody(init);
          const customerName = String(payload?.customer_name || "").trim();
          if (!customerName) return demoError("Informe o nome do cliente", 400);

          const normalized = customerName.toLocaleLowerCase("pt-BR");
          const existing = db.orders.find((o) =>
            String(o.order_type || "") === "a_receber" &&
            String(o.status || "").toUpperCase() === "ABERTO" &&
            String(o.customer_name || "").trim().toLocaleLowerCase("pt-BR") === normalized
          );
          if (existing){
            return demoJson({
              ok: true,
              existing: true,
              row: {
                id: Number(existing.id),
                order_number: Number(existing.order_number || 0),
                created_at: existing.created_at || demoNowIso(),
                customer_name: String(existing.customer_name || ""),
                customer_phone: String(existing.customer_phone || ""),
                total: demoOrderTotal(db, existing.id),
                order_count: demoReceivableLaunchCount(db, existing),
              }
            });
          }

          const now = demoNowIso();
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
            total: 0
          };
          db.orders.push(order);
          demoSaveDb(db);

          return demoJson({
            ok: true,
            existing: false,
            row: {
              id: Number(order.id),
              order_number: Number(order.order_number || 0),
              created_at: order.created_at || demoNowIso(),
              customer_name: String(order.customer_name || ""),
              customer_phone: String(order.customer_phone || ""),
              total: 0,
              order_count: 0,
            }
          });
        }

        if (method === "GET" && path === "/api/kitchen/pending"){
          const orderById = new Map(db.orders.map((o) => [Number(o.id), o]));
          const rows = db.order_items
            .filter((it) => Number(it.is_kitchen) === 1 && (!it.status || String(it.status).toUpperCase() === "PENDENTE"))
            .map((it) => {
              const order = orderById.get(Number(it.order_id));
              if (!order) return null;
              return {
                id: Number(it.id),
                order_id: Number(it.order_id),
                name: String(it.name || "Item"),
                qty: Number(it.qty || 1),
                notes: String(it.notes || ""),
                order_number: Number(order.order_number || 0),
                table_no: String(order.table_no || ""),
                order_type: String(order.order_type || ""),
                created_at: order.created_at || demoNowIso(),
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);
          return demoJson({ ok: true, rows });
        }

        if (method === "GET" && path === "/api/kitchen/history"){
          const date = String(urlObj.searchParams.get("date") || demoDayKeyFromIso(demoNowIso())).trim();
          const start = new Date(`${date}T00:00:00`);
          const end = new Date(`${date}T23:59:59.999`);
          const startTs = start.getTime();
          const endTs = end.getTime();
          const orderById = new Map(db.orders.map((o) => [Number(o.id), o]));
          const rows = db.order_items
            .filter((it) => Number(it.is_kitchen) === 1 && String(it.status || "").toUpperCase() === "PRONTO")
            .map((it) => {
              const order = orderById.get(Number(it.order_id));
              if (!order) return null;
              const readyAt = String(it.ready_at || order.created_at || demoNowIso());
              const ts = new Date(readyAt).getTime();
              if (!Number.isFinite(ts) || ts < startTs || ts > endTs) return null;
              return {
                id: Number(it.id),
                order_id: Number(it.order_id),
                name: String(it.name || "Item"),
                qty: Number(it.qty || 1),
                notes: String(it.notes || ""),
                order_number: Number(order.order_number || 0),
                table_no: String(order.table_no || ""),
                order_type: String(order.order_type || ""),
                created_at: order.created_at || demoNowIso(),
                ready_at: readyAt,
              };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(String(b.ready_at || "")).getTime() - new Date(String(a.ready_at || "")).getTime());
          return demoJson({ ok: true, rows });
        }

        if (method === "GET" && path === "/api/orders/day"){
          const date = urlObj.searchParams.get("date");
          if (!date) return demoError("Informe a data", 400);
          const start = new Date(`${date}T00:00:00`);
          const end = new Date(`${date}T23:59:59.999`);
          const rows = db.orders
            .filter((o) => {
              const t = new Date(demoOrderReportedAt(o)).getTime();
              return t >= start.getTime() && t <= end.getTime();
            })
            .map((o) => {
              const createdAt = demoOrderCreatedAt(o);
              const reportedAt = demoOrderReportedAt(o);
              return {
                id: Number(o.id),
                order_number: Number(o.order_number || 0),
                created_at: createdAt,
                reported_at: reportedAt,
                finalized_at: String(o.finalized_at || ""),
                order_type: String(o.order_type || ""),
                table_no: String(o.table_no || ""),
                customer_name: String(o.customer_name || ""),
                customer_phone: String(o.customer_phone || ""),
                address: String(o.address || ""),
                notes: String(o.notes || ""),
                payment_method: String(o.payment_method || ""),
                payment_splits: demoNormalizePaymentSplits(o),
                status: String(o.status || ""),
                total: demoOrderTotal(db, o.id)
              };
            })
            .sort((a, b) => {
              const ta = new Date(String(a.reported_at || a.created_at || "")).getTime();
              const tb = new Date(String(b.reported_at || b.created_at || "")).getTime();
              if (Number.isFinite(ta) && Number.isFinite(tb) && tb !== ta) return tb - ta;
              return Number(b.id || 0) - Number(a.id || 0);
            });
          return demoJson({ ok: true, rows });
        }

        const orderUpdateMatch = path.match(/^\/api\/orders\/(\d+)\/update$/);
        if (method === "POST" && orderUpdateMatch){
          const id = Number(orderUpdateMatch[1]);
          const payload = demoParseJsonBody(init);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.order_type = String(payload.order_type || order.order_type || "");
          order.table_no = String(payload.table_no || order.table_no || "");
          order.customer_name = String(payload.customer_name || order.customer_name || "");
          order.customer_phone = String(payload.customer_phone || order.customer_phone || "");
          order.address = String(payload.address || order.address || "");
          order.notes = String(payload.notes || order.notes || "");
          order.payment_method = String(payload.payment_method || order.payment_method || "");
          if (Array.isArray(payload.payment_splits)){
            order.payment_splits = demoNormalizePaymentSplits({ payment_splits: payload.payment_splits });
          } else if (Object.prototype.hasOwnProperty.call(payload || {}, "payment_method")) {
            const pm = String(payload.payment_method || "").toLowerCase();
            if (!pm.includes("divid")) order.payment_splits = [];
          }
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const orderCancelMatch = path.match(/^\/api\/orders\/(\d+)\/cancel$/);
        if (method === "POST" && orderCancelMatch){
          const id = Number(orderCancelMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.status = "CANCELADO";
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        if (method === "GET" && path === "/api/delivery/pending"){
          const rows = db.orders
            .filter((o) =>
              String(o.order_type || "") === "entrega" &&
              String(o.delivery_status || "PREPARO").toUpperCase() !== "FINALIZADO"
            )
            .map((o) => ({
              id: Number(o.id),
              order_number: Number(o.order_number || 0),
              created_at: o.created_at || demoNowIso(),
              customer_name: String(o.customer_name || ""),
              address: String(o.address || ""),
              total: demoOrderTotal(db, o.id),
              delivery_status: String(o.delivery_status || "PREPARO")
            }))
            .sort((a, b) => b.id - a.id);
          return demoJson({ ok: true, rows });
        }

        if (method === "GET" && path === "/api/delivery/history"){
          const date = String(urlObj.searchParams.get("date") || demoDayKeyFromIso(demoNowIso())).trim();
          const start = new Date(`${date}T00:00:00`);
          const end = new Date(`${date}T23:59:59.999`);
          const startTs = start.getTime();
          const endTs = end.getTime();
          const rows = db.orders
            .filter((o) => {
              if (String(o.order_type || "") !== "entrega") return false;
              if (String(o.delivery_status || "").toUpperCase() !== "FINALIZADO") return false;
              const finishedAt = String(o.delivery_finalized_at || o.created_at || "");
              const ts = new Date(finishedAt).getTime();
              return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
            })
            .map((o) => ({
              id: Number(o.id),
              order_number: Number(o.order_number || 0),
              created_at: o.created_at || demoNowIso(),
              customer_name: String(o.customer_name || ""),
              address: String(o.address || ""),
              total: demoOrderTotal(db, o.id),
              delivery_status: String(o.delivery_status || "FINALIZADO"),
              delivery_finalized_at: String(o.delivery_finalized_at || o.created_at || demoNowIso()),
            }))
            .sort((a, b) => new Date(String(b.delivery_finalized_at || "")).getTime() - new Date(String(a.delivery_finalized_at || "")).getTime());
          return demoJson({ ok: true, rows });
        }

        const orderGetMatch = path.match(/^\/api\/orders\/(\d+)$/);
        if (method === "GET" && orderGetMatch){
          const id = Number(orderGetMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          const items = db.order_items.filter((it) => Number(it.order_id) === id);
          return demoJson({ ok: true, order, items });
        }

        const kitchenReadyMatch = path.match(/^\/api\/kitchen\/item\/(\d+)\/ready$/);
        if (method === "POST" && kitchenReadyMatch){
          const id = Number(kitchenReadyMatch[1]);
          const item = db.order_items.find((it) => Number(it.id) === id);
          if (!item) return demoError("Item nao encontrado", 400);
          item.status = "PRONTO";
          item.ready_at = demoNowIso();
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const deliveryDispatchMatch = path.match(/^\/api\/delivery\/(\d+)\/dispatch$/);
        if (method === "POST" && deliveryDispatchMatch){
          const id = Number(deliveryDispatchMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.delivery_status = "DESPACHADO";
          order.delivery_dispatched_at = demoNowIso();
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const deliveryFinalizeMatch = path.match(/^\/api\/delivery\/(\d+)\/finalize$/);
        if (method === "POST" && deliveryFinalizeMatch){
          const id = Number(deliveryFinalizeMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.delivery_status = "FINALIZADO";
          order.delivery_finalized_at = demoNowIso();
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const orderFinalizeMatch = path.match(/^\/api\/orders\/(\d+)\/finalize$/);
        if (method === "POST" && orderFinalizeMatch){
          const id = Number(orderFinalizeMatch[1]);
          const payload = demoParseJsonBody(init);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          const cashError = demoEnsureCashOpen(db, "finalizar a venda");
          if (cashError) return cashError;
          if (String(order.status || "").toUpperCase() !== "ABERTO") {
            return demoError("Pedido ja esta fechado", 400);
          }
          const payment = String(payload.payment_method || "").trim();
          if (!payment) return demoError("Informe o pagamento", 400);

          order.order_type = payload.order_type || order.order_type || "mesa";
          order.table_no = payload.table_no || order.table_no || "";
          order.customer_name = payload.customer_name || order.customer_name || "";
          order.customer_phone = payload.customer_phone || order.customer_phone || "";
          order.address = payload.address || order.address || "";
          order.notes = payload.notes || order.notes || "";
          order.payment_method = payment;
          order.payment_splits = demoNormalizePaymentSplits({ payment_splits: payload.payment_splits });
          order.subtotal = Number(payload?.totals?.subtotal ?? order.subtotal ?? 0);
          order.discount = Number(payload?.totals?.discount ?? order.discount ?? 0);
          order.fee = Number(payload?.totals?.fee ?? order.fee ?? 0);
          order.total = Number(payload?.totals?.total ?? demoOrderTotal(db, id));
          order.status = "FECHADO";
          order.finalized_at = demoNowIso();

          demoSaveDb(db);
          return demoJson({ ok: true, order_id: id, order_number: order.order_number });
        }

        if (method === "POST" && path === "/api/orders"){
          const cashError = demoEnsureCashOpen(db, "registrar o pedido");
          if (cashError) return cashError;

          const payload = demoParseJsonBody(init);
          const items = Array.isArray(payload?.items) ? payload.items : [];
          if (items.length === 0) return demoError("Carrinho vazio", 400);

          const now = demoNowIso();
          const orderType = String(payload.order_type || "retirada");
          const orderStatus = (orderType === "mesa" || orderType === "a_receber") ? "ABERTO" : "FECHADO";
          const tableNo = String(payload.table_no || "").trim();
          const receivableId = Number(payload?.receivable_id || 0);
          const receivableName = String(payload?.customer_name || "").trim();
          let orderId = null;
          let orderNumber = null;
          let existing = null;

          if (orderType === "mesa" && tableNo){
            existing = db.orders.find((o) =>
              String(o.order_type || "") === "mesa" &&
              String(o.status || "").toUpperCase() === "ABERTO" &&
              String(o.table_no || "").trim() === tableNo
            );
          }
          if (orderType === "a_receber"){
            if (Number.isFinite(receivableId) && receivableId > 0){
              existing = db.orders.find((o) =>
                Number(o.id) === receivableId &&
                String(o.order_type || "") === "a_receber" &&
                String(o.status || "").toUpperCase() === "ABERTO"
              );
            }
            if (!existing && receivableName){
              const normalized = receivableName.toLocaleLowerCase("pt-BR");
              existing = db.orders.find((o) =>
                String(o.order_type || "") === "a_receber" &&
                String(o.status || "").toUpperCase() === "ABERTO" &&
                String(o.customer_name || "").trim().toLocaleLowerCase("pt-BR") === normalized
              );
            }
          }

          if (existing){
            orderId = Number(existing.id);
            orderNumber = Number(existing.order_number || 0);
            if (orderType === "a_receber"){
              existing.merged_count = demoReceivableLaunchCount(db, existing) + 1;
              existing.launch_count_mode = "launch_only";
            } else {
              existing.merged_count = Number(existing.merged_count || 1) + 1;
            }
            const newName = String(payload.customer_name || "").trim();
            if (newName && orderType === "a_receber"){
              existing.customer_name = newName;
            } else if (newName){
              const currentNames = String(existing.customer_name || "").split("/").map(s => s.trim()).filter(Boolean);
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
              return demoError("Informe o cliente para lançar no fiado", 400);
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
              payment_splits: demoNormalizePaymentSplits({ payment_splits: payload.payment_splits }),
              delivery_status: orderType === "entrega" ? "PREPARO" : "",
              status: orderStatus,
              merged_count: orderType === "a_receber" ? 1 : 0,
              launch_count_mode: orderType === "a_receber" ? "launch_only" : "",
              subtotal: Number(payload?.totals?.subtotal || 0),
              discount: Number(payload?.totals?.discount || 0),
              fee: Number(payload?.totals?.fee || 0),
              total: Number(payload?.totals?.total || 0)
            });
          }

          for (const it of items){
            const itemId = db.seq.item++;
            db.order_items.push({
              id: itemId,
              order_id: orderId,
              name: String(it?.name || "Item"),
              qty: Number(it?.qty || 1),
              unit_price: Number(it?.unit_price || 0),
              notes: String(it?.notes || ""),
              is_kitchen: it?.is_kitchen ? 1 : 0,
              status: "PENDENTE"
            });
          }

          demoSaveDb(db);
          return demoJson({ ok: true, order_id: orderId, order_number: orderNumber });
        }

        if (method === "GET" && path === "/api/diag"){
          const raw = localStorage.getItem(DEMO_DB_KEY) || "";
          const size = new Blob([raw]).size;
          return demoJson({
            ok: true,
            app: {
              version: "app-local",
              runtime: "Navegador",
              platform: "Web",
              arch: navigator.platform || "Browser",
              uptime: Number((performance.now() / 1000).toFixed(0)),
            },
            db: {
              label: "Base local do aplicativo",
              size,
              orders: db.orders.length,
              items: db.order_items.length,
              movements: Array.isArray(db.cash_movements) ? db.cash_movements.length : 0,
              cash_status: db.meta.cash_status,
              last_backup_at: db.meta.last_backup_at,
              last_backup_path: db.meta.last_backup_path,
            }
          });
        }

        if (method === "GET" && path === "/api/backup/export"){
          db.meta.last_backup_at = demoNowIso();
          db.meta.last_backup_path = "demo_manual_export";
          demoSaveDb(db);
          const text = JSON.stringify(db, null, 2);
          return new Response(text, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "X-MVS-Demo": "1"
            }
          });
        }

        if (method === "POST" && path === "/api/backup/import"){
          const text = await demoReadBodyText(init?.body);
          if (!text) return demoError("Arquivo invalido", 400);
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            return demoError("Backup demo invalido (esperado JSON)", 400);
          }
          const imported = demoNormalizeDb(parsed);
          demoSaveDb(imported);
          return demoJson({ ok: true });
        }

        return demoError("Rota demo nao implementada", 404);
      }

      window.fetch = async (input, init) => {
        let urlObj = null;
        try {
          if (typeof input === "string") {
            urlObj = new URL(input, window.location.origin);
          } else if (input && typeof input.url === "string") {
            urlObj = new URL(input.url, window.location.origin);
          }
        } catch {}

        if (urlObj && urlObj.pathname.startsWith("/api/")) {
          return demoHandleApiFetch(urlObj, init || {});
        }

        return nativeFetch(input, init);
      };

      window.open = (url, target, features) => {
        let urlObj = null;
        try { urlObj = new URL(String(url), window.location.origin); } catch {}

        if (urlObj && urlObj.pathname.startsWith("/api/")) {
          const handled = demoHandleApiOpen(urlObj, target, features);
          if (handled) return handled;
        }

        return nativeOpen(url, target, features);
      };
    }

    
