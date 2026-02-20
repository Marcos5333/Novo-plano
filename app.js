    // ===== Helpers =====
    const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const escapeHtml = (s) => String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
    const escapeAttr = (s) => String(s ?? "")
      .replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

    function openPrintModal(html){
      const modal = document.getElementById("printModal");
      const frame = document.getElementById("printFrame");
      if (!modal || !frame) {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
        }
        return;
      }
      frame.srcdoc = html;
      modal.style.display = "flex";
    }
    function closePrintModal(){
      const modal = document.getElementById("printModal");
      const frame = document.getElementById("printFrame");
      if (frame) frame.srcdoc = "";
      if (modal) modal.style.display = "none";
    }
    async function openPrintUrl(url){
      try{
        const resp = await fetch(url, { method: "GET" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        if (!html) throw new Error("Resposta vazia do servidor.");
        openPrintModal(html);
      } catch (e){
        toast("Falha ao abrir impressao: " + e.message, "error");
      }
    }

    async function readJsonSafe(resp){
      const text = await resp.text();
      if (!text) return null;
      try{
        return JSON.parse(text);
      } catch {
        throw new Error("Resposta inválida do servidor (JSON)");
      }
    }

    function lockSignaturePosition(){
      const img = document.getElementById("signatureMark");
      if (!img) return;
      const apply = () => {
        img.style.position = "fixed";
        img.style.right = "10px";
        img.style.bottom = "8px";
        img.style.left = "auto";
        img.style.top = "auto";
        img.style.transform = "none";
      };
      apply();
      window.addEventListener("scroll", apply, { passive: true });
      window.addEventListener("resize", apply, { passive: true });
      document.addEventListener("scroll", apply, { passive: true });
    }

    function removeSignatureBackground(){
      const img = document.getElementById("signatureMark");
      if (!img) return;

      const hide = () => { img.style.display = "none"; };
      img.addEventListener("error", hide, { once: true });

      const process = () => {
        if (img.dataset.cleaned === "1") return;
        if (!img.naturalWidth || !img.naturalHeight) return;
        try{
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(img, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = frame.data;

          const patchW = Math.max(6, Math.floor(canvas.width * 0.08));
          const patchH = Math.max(6, Math.floor(canvas.height * 0.08));
          const points = [
            [0, 0],
            [canvas.width - patchW, 0],
            [0, canvas.height - patchH],
            [canvas.width - patchW, canvas.height - patchH],
          ];
          let sr = 0, sg = 0, sb = 0, count = 0;
          for (const [x0, y0] of points){
            for (let y = y0; y < y0 + patchH; y++){
              for (let x = x0; x < x0 + patchW; x++){
                const i = (y * canvas.width + x) * 4;
                sr += data[i];
                sg += data[i + 1];
                sb += data[i + 2];
                count += 1;
              }
            }
          }
          if (!count) return;
          const br = sr / count;
          const bg = sg / count;
          const bb = sb / count;

          const removeThreshold = 62;
          const fadeThreshold = 105;

          for (let i = 0; i < data.length; i += 4){
            const a = data[i + 3];
            if (a < 6) continue;
            const dist = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
            if (dist <= removeThreshold){
              data[i + 3] = 0;
              continue;
            }
            if (dist < fadeThreshold){
              const ratio = (dist - removeThreshold) / (fadeThreshold - removeThreshold);
              data[i + 3] = Math.round(a * Math.max(0, Math.min(1, ratio)));
            }
          }

          ctx.putImageData(frame, 0, 0);
          img.dataset.cleaned = "1";
          img.src = canvas.toDataURL("image/png");
        } catch {
          // mantém imagem original se não conseguir processar
        }
      };

      if (img.complete && img.naturalWidth > 0){
        process();
      } else {
        img.addEventListener("load", process, { once: true });
      }
    }

    function uid(){
      return (crypto?.randomUUID?.() ?? ('id-' + Math.random().toString(16).slice(2)));
    }

    function parsePrice(input){
      const normalized = String(input ?? '').trim().replace(/\./g,'').replace(',', '.');
      const v = Number(normalized);
      return Number.isFinite(v) ? v : NaN;
    }

    const PAYMENT_METHOD_LABELS = Object.freeze({
      dinheiro: "Dinheiro",
      pix: "PIX",
      debito: "Débito",
      credito: "Crédito",
    });

    function paymentMethodLabel(method){
      const key = String(method || "").toLowerCase();
      return PAYMENT_METHOD_LABELS[key] || prettyType(key);
    }

    function roundMoney(value){
      return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    }

    // ===== Demo Storage Mode (Web/Vercel sem SQLite) =====
    const DEMO_STORAGE_MODE = true;
    const DEMO_DB_KEY = "mvs_demo_backend_v1";
    const AUTO_BACKUP_PREFIX = "mvs_auto_backup_";
    const AUTO_BACKUP_INDEX = "mvs_auto_backup_index_v1";
    const AUTO_BACKUP_ENABLED_KEY = "mvs_auto_backup_enabled_v1";
    window.__MVS_DEMO_STORAGE = DEMO_STORAGE_MODE;

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
        const now = demoNowIso();
        return {
          version: 1,
          seq: { order: 1, item: 1 },
          meta: {
            last_order_number: 0,
            cash_status: "ABERTO",
            cash_opened_at: now,
            cash_last_opened_at: "",
            cash_last_closed_at: "",
            last_backup_at: "",
            last_backup_path: ""
          },
          orders: [],
          order_items: []
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
          },
          meta: {
            last_order_number: Math.max(0, Number(source?.meta?.last_order_number || base.meta.last_order_number)),
            cash_status: String(source?.meta?.cash_status || base.meta.cash_status).toUpperCase() === "FECHADO" ? "FECHADO" : "ABERTO",
            cash_opened_at: String(source?.meta?.cash_opened_at || base.meta.cash_opened_at),
            cash_last_opened_at: String(source?.meta?.cash_last_opened_at || ""),
            cash_last_closed_at: String(source?.meta?.cash_last_closed_at || ""),
            last_backup_at: String(source?.meta?.last_backup_at || ""),
            last_backup_path: String(source?.meta?.last_backup_path || ""),
          },
          orders: Array.isArray(source?.orders) ? source.orders : [],
          order_items: Array.isArray(source?.order_items) ? source.order_items : []
        };

        const maxOrderId = normalized.orders.reduce((acc, o) => Math.max(acc, Number(o?.id || 0)), 0);
        const maxItemId = normalized.order_items.reduce((acc, it) => Math.max(acc, Number(it?.id || 0)), 0);
        normalized.seq.order = Math.max(normalized.seq.order, maxOrderId + 1);
        normalized.seq.item = Math.max(normalized.seq.item, maxItemId + 1);
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
          out.push({
            person_name: String(row?.person_name || "").trim(),
            method,
            amount: roundMoney(amount),
          });
        }
        return out;
      }

      function demoOrderTotal(db, orderId){
        return db.order_items
          .filter((it) => Number(it.order_id) === Number(orderId))
          .reduce((acc, it) => acc + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0);
      }

      function demoSumOrdersBetween(db, startIso, endIso){
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        const rows = db.orders
          .filter((o) => {
            const status = String(o.status || "").toUpperCase();
            const ts = new Date(o.created_at).getTime();
            return status === "FECHADO" && Number.isFinite(ts) && ts >= start && ts <= end;
          })
          .map((o) => ({
            id: Number(o.id),
            order_number: Number(o.order_number || 0),
            payment_method: o.payment_method || "",
            payment_splits: demoNormalizePaymentSplits(o),
            created_at: o.created_at || demoNowIso(),
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
          .sort((a, b) => a.id - b.id);

        const byPay = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outros: 0 };
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
        return { rows, byPay, totalGeral };
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
            title: "Relatorio Diario (Demo Storage)",
            start: new Date(y, m, d, 0, 0, 0, 0),
            end: new Date(y, m, d, 23, 59, 59, 999),
          };
        }
        if (["month", "monthly", "mensal"].includes(p)) {
          return {
            key: "month",
            title: "Relatorio Mensal (Demo Storage)",
            start: new Date(y, m, 1, 0, 0, 0, 0),
            end: new Date(y, m + 1, 0, 23, 59, 59, 999),
          };
        }
        if (["year", "yearly", "annual", "anual"].includes(p)) {
          return {
            key: "year",
            title: "Relatorio Anual (Demo Storage)",
            start: new Date(y, 0, 1, 0, 0, 0, 0),
            end: new Date(y, 11, 31, 23, 59, 59, 999),
          };
        }
        return null;
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
    body{
      font-family: "Courier New", Courier, monospace;
      margin:0 auto;
      color:#111;
      width:72mm;
      font-size:11px;
      line-height:1.25;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    h1{margin:0 0 6px 0;font-size:14px}
    .muted{opacity:.72}
    .box{border:1px solid #ddd;border-radius:6px;padding:8px;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th,td{border-bottom:1px solid #eee;padding:4px;text-align:left;vertical-align:top}
    th:last-child,td:last-child{text-align:right}
    .hr{border-top:1px dashed #999;margin:8px 0}
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
        const total = items.reduce((acc, it) => acc + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0);
        const splits = demoNormalizePaymentSplits(order);
        const paymentSummary = splits.length
          ? "DIVIDIDO"
          : String(order?.payment_method || "-").toUpperCase();
        const splitRows = splits.map((split, idx) => {
          const person = split.person_name || `Pessoa ${idx + 1}`;
          return `<div class="muted">• ${escapeHtml(person)} • ${escapeHtml(paymentMethodLabel(split.method).toUpperCase())}: ${escapeHtml(brl(split.amount || 0))}</div>`;
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
              <td>${escapeHtml(brl(line))}</td>
            </tr>
          `;
        }).join("");

        return demoHtmlPage(
          `Comanda #${order?.order_number || "-"}`,
          `
            <h1>Comanda #${escapeHtml(String(order?.order_number || "-"))}</h1>
            <p class="muted">Demo Storage (sem SQLite) - ${escapeHtml(dt)}</p>
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
            <div class="box"><b>Total:</b> ${escapeHtml(brl(total))}</div>
          `
        );
      }

      function demoNormalizeReportMode(mode){
        const raw = String(mode || "").trim().toLowerCase();
        if (raw === "detailed" || raw === "detalhado" || raw === "detail") return "detailed";
        return "normal";
      }

      function demoBuildReportHtml(title, startIso, endIso, report, rangeKey = "", mode = "normal"){
        const reportMode = demoNormalizeReportMode(mode);
        const dtStart = new Date(startIso).toLocaleString("pt-BR");
        const dtEnd = new Date(endIso).toLocaleString("pt-BR");
        const rangeDayLabel = new Date(startIso).toLocaleDateString("pt-BR");
        const rangeMonthLabel = new Date(startIso).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
        const rangeYearLabel = String(new Date(startIso).getFullYear());
        const rangeHint = (
          rangeKey === "day"
            ? `Somente vendas fechadas do dia ${rangeDayLabel}.`
            : (rangeKey === "month"
              ? `Somente vendas fechadas do mes ${rangeMonthLabel}.`
              : (rangeKey === "year"
                ? `Somente vendas fechadas do ano ${rangeYearLabel}.`
                : ""))
        );
        const rows = report.rows.map((r) => {
          const customer = String(r.customer_name || "").trim() || "-";
          return `
          <tr>
            <td>#${escapeHtml(String(r.order_number || "-"))}</td>
            <td>${escapeHtml(customer)}</td>
            <td>${escapeHtml(new Date(r.created_at).toLocaleString("pt-BR"))}</td>
            <td>${escapeHtml(brl(r.total || 0))}</td>
          </tr>
        `;
        }).join("");

        const detailedRows = report.rows.map((r) => {
          const payLabel = (Array.isArray(r.payment_splits) && r.payment_splits.length)
            ? "DIVIDIDO"
            : String(r.payment_method || "-").toUpperCase();
          const typeLabel = String(r.order_type || "-").toUpperCase();
          const customer = String(r.customer_name || "").trim() || "-";
          const tableNo = String(r.table_no || "").trim();
          const typeWithTable = (typeLabel === "MESA" && tableNo) ? `MESA ${tableNo}` : typeLabel;
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
              <div><b>Pedido #${escapeHtml(String(r.order_number || "-"))}</b> - ${escapeHtml(new Date(r.created_at).toLocaleString("pt-BR"))}</div>
              <div>Cliente: ${escapeHtml(customer)}</div>
              <div>Origem: ${escapeHtml(typeWithTable)} - Pagamento: ${escapeHtml(payLabel)} - Total: ${escapeHtml(brl(r.total || 0))}</div>
              <div class="hr"></div>
              ${itemsHtml}
            </div>
          `;
        }).join("");

        const normalSection = `
          <div class="box">
            <table>
              <thead>
                <tr><th>Pedido</th><th>Cliente</th><th>Data/Hora</th><th>Total</th></tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="4">Sem vendas no periodo</td></tr>`}</tbody>
            </table>
          </div>
        `;

        const detailedSection = `
          <div class="hr"></div>
          <h1>Detalhado (Cliente • Produto • Horario)</h1>
          ${detailedRows || `<div class="box">Sem vendas no periodo.</div>`}
        `;

        return demoHtmlPage(
          title,
          `
            <h1>${escapeHtml(title)}${reportMode === "detailed" ? " - Detalhado" : " - Normal"}</h1>
            <p class="muted">Periodo: <b>${escapeHtml(dtStart)}</b> ate <b>${escapeHtml(dtEnd)}</b></p>
            ${rangeHint ? `<p class="muted"><b>${escapeHtml(rangeHint)}</b></p>` : ""}
            <div class="box">
              <div><b>Pedidos:</b> ${report.rows.length}</div>
              <div><b>Total:</b> ${escapeHtml(brl(report.totalGeral || 0))}</div>
              <div>Dinheiro: ${escapeHtml(brl(report.byPay?.dinheiro || 0))}</div>
              <div>Pix: ${escapeHtml(brl(report.byPay?.pix || 0))}</div>
              <div>Debito: ${escapeHtml(brl(report.byPay?.debito || 0))}</div>
              <div>Credito: ${escapeHtml(brl(report.byPay?.credito || 0))}</div>
            </div>
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
          const start = db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString();
          const end = db.meta.cash_last_closed_at || demoNowIso();
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          return demoOpenHtml(demoBuildReportHtml("Relatorio de Caixa (Demo Storage)", start, end, report, "cash", mode), target, features);
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
          return demoOpenHtml(demoBuildReportHtml(range.title, start, end, report, range.key || "", mode), target, features);
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
          const start = db.meta.cash_last_opened_at || db.meta.cash_opened_at || new Date(0).toISOString();
          const end = db.meta.cash_last_closed_at || demoNowIso();
          const report = demoSumOrdersBetween(db, start, end);
          const mode = demoNormalizeReportMode(urlObj.searchParams.get("mode"));
          return new Response(demoBuildReportHtml("Relatorio de Caixa (Demo Storage)", start, end, report, "cash", mode), {
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
          return new Response(demoBuildReportHtml(range.title, start, end, report, range.key || "", mode), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }

        if (method === "GET" && path === "/api/cash/status"){
          return demoJson({
            ok: true,
            cash_status: db.meta.cash_status,
            opened_at: db.meta.cash_opened_at,
            last_closed_at: db.meta.cash_last_closed_at,
          });
        }

        if (method === "POST" && path === "/api/cash/open"){
          db.meta.cash_status = "ABERTO";
          db.meta.cash_opened_at = demoNowIso();
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        if (method === "POST" && path === "/api/cash/close"){
          if (db.meta.cash_status !== "ABERTO") {
            return demoError("Caixa ja esta fechado", 400);
          }
          const start = db.meta.cash_opened_at || new Date(0).toISOString();
          const end = demoNowIso();
          const report = demoSumOrdersBetween(db, start, end);
          db.meta.cash_status = "FECHADO";
          db.meta.cash_last_opened_at = start;
          db.meta.cash_last_closed_at = end;
          db.meta.last_backup_at = end;
          db.meta.last_backup_path = "demo_auto_cash_close";
          demoSaveDb(db);
          return demoJson({
            ok: true,
            start,
            end,
            total: report.totalGeral,
            byPay: report.byPay,
            count: report.rows.length
          });
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

        if (method === "GET" && path === "/api/orders/day"){
          const date = urlObj.searchParams.get("date");
          if (!date) return demoError("Informe a data", 400);
          const start = new Date(`${date}T00:00:00`);
          const end = new Date(`${date}T23:59:59.999`);
          const rows = db.orders
            .filter((o) => {
              const t = new Date(o.created_at || 0).getTime();
              return t >= start.getTime() && t <= end.getTime();
            })
            .map((o) => ({
              id: Number(o.id),
              order_number: Number(o.order_number || 0),
              created_at: o.created_at || demoNowIso(),
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
            }))
            .sort((a, b) => b.id - a.id);
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
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const deliveryDispatchMatch = path.match(/^\/api\/delivery\/(\d+)\/dispatch$/);
        if (method === "POST" && deliveryDispatchMatch){
          const id = Number(deliveryDispatchMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.delivery_status = "DESPACHADO";
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const deliveryFinalizeMatch = path.match(/^\/api\/delivery\/(\d+)\/finalize$/);
        if (method === "POST" && deliveryFinalizeMatch){
          const id = Number(deliveryFinalizeMatch[1]);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
          order.delivery_status = "FINALIZADO";
          demoSaveDb(db);
          return demoJson({ ok: true });
        }

        const orderFinalizeMatch = path.match(/^\/api\/orders\/(\d+)\/finalize$/);
        if (method === "POST" && orderFinalizeMatch){
          const id = Number(orderFinalizeMatch[1]);
          const payload = demoParseJsonBody(init);
          const order = db.orders.find((o) => Number(o.id) === id);
          if (!order) return demoError("Pedido nao encontrado", 404);
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
          order.status = "FECHADO";

          demoSaveDb(db);
          return demoJson({ ok: true, order_id: id, order_number: order.order_number });
        }

        if (method === "POST" && path === "/api/orders"){
          const payload = demoParseJsonBody(init);
          const items = Array.isArray(payload?.items) ? payload.items : [];
          if (items.length === 0) return demoError("Carrinho vazio", 400);
          if (db.meta.cash_status !== "ABERTO") {
            return demoError("Caixa esta FECHADO. Abra o caixa para vender.", 400);
          }

          const now = demoNowIso();
          const orderType = String(payload.order_type || "retirada");
          const orderStatus = orderType === "mesa" ? "ABERTO" : "FECHADO";
          const tableNo = String(payload.table_no || "").trim();
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

          if (existing){
            orderId = Number(existing.id);
            orderNumber = Number(existing.order_number || 0);
            existing.merged_count = Number(existing.merged_count || 1) + 1;
            const newName = String(payload.customer_name || "").trim();
            if (newName){
              const currentNames = String(existing.customer_name || "").split("/").map(s => s.trim()).filter(Boolean);
              if (!currentNames.includes(newName)){
                existing.customer_name = currentNames.length ? `${currentNames.join(" / ")} / ${newName}` : newName;
              }
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
            orderId = db.seq.order++;
            orderNumber = Number(db.meta.last_order_number || 0) + 1;
            db.meta.last_order_number = orderNumber;

            db.orders.push({
              id: orderId,
              order_number: orderNumber,
              created_at: now,
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
              version: "demo-storage",
              node: "n/a",
              platform: "web",
              arch: navigator.platform || "browser",
              uptime: Number((performance.now() / 1000).toFixed(0)),
            },
            db: {
              path: `localStorage:${DEMO_DB_KEY}`,
              size,
              orders: db.orders.length,
              items: db.order_items.length,
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

    // ===== Toasts + Logs =====
    const LS_LOGS = "mvs_logs_v1";
    const toastStack = document.getElementById("toastStack");
    let logs = (() => {
      try{
        const raw = localStorage.getItem(LS_LOGS);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      }catch{ return []; }
    })();

    function saveLogs(){
      if (logs.length > 300) logs = logs.slice(-300);
      localStorage.setItem(LS_LOGS, JSON.stringify(logs));
    }

    function logEvent(level, msg, data){
      logs.push({
        ts: new Date().toISOString(),
        level: String(level || "info"),
        msg: String(msg || ""),
        data: data ? String(data) : ""
      });
      saveLogs();
      if (document.getElementById("systemModal")?.style.display === "flex"){
        renderLogs();
      }
    }

    function logError(msg, err){
      const detail = err?.stack || err?.message || String(err || "");
      logEvent("error", msg, detail);
    }

    function toast(message, type = "info", opts = {}){
      if (!toastStack) return;
      const t = document.createElement("div");
      const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
      t.className = `toast ${type}`;
      t.innerHTML = `<div class="ticon">${icon}</div><div>${escapeHtml(message)}</div>`;
      toastStack.appendChild(t);

      if (type === "error"){
        logEvent("error", message, opts?.detail || "");
      }

      const timeout = Number(opts.timeout || 3500);
      setTimeout(() => t.remove(), timeout);
    }

    function safePrompt(message, def = ""){
      try{
        // Some environments disable prompt(); handle gracefully
        return window.prompt(message, def);
      } catch (e){
        toast("Entrada por prompt não suportada. Use os campos da tela.", "error");
        return null;
      }
    }

    function setButtonLoading(btn, loading, label){
      if (!btn) return;
      if (loading){
        if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
        if (label) btn.innerHTML = escapeHtml(label);
        btn.classList.add("loading");
        btn.disabled = true;
      } else {
        if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
        btn.classList.remove("loading");
        btn.disabled = false;
      }
    }

    function setBusy(el, loading){
      if (!el) return;
      el.classList.toggle("loading", !!loading);
      el.setAttribute("aria-busy", loading ? "true" : "false");
    }

    window.addEventListener("error", (e) => {
      logError("Erro JS", e?.error || e?.message || e);
    });
    window.addEventListener("unhandledrejection", (e) => {
      logError("Promise rejeitada", e?.reason || e);
    });

    // ===== Estado Caixa =====
    const LS_SHIFT = "mvs_shift_state_v1";
    const LS_LAST_ORDER = "mvs_last_order_id_v1";
    const LS_ROLE = "mvs_role_v1";
    const LS_MANAGER_PIN = "mvs_manager_pin_v1";
    let shiftState = (() => {
      try{
        const raw = localStorage.getItem(LS_SHIFT);
        if (!raw) return { open: true };
        const parsed = JSON.parse(raw);
        return { open: !!parsed.open };
      }catch{ return { open:true }; }
    })();
    let lastOrderId = (() => {
      try{
        const raw = localStorage.getItem(LS_LAST_ORDER);
        return raw ? String(raw) : null;
      }catch{ return null; }
    })();

    let currentRole = (() => {
      try{
        const raw = localStorage.getItem(LS_ROLE);
        return raw === "gerente" ? "gerente" : "operador";
      }catch{ return "operador"; }
    })();

    let managerPin = (() => {
      try{
        const raw = localStorage.getItem(LS_MANAGER_PIN);
        if (raw && String(raw).trim()) return String(raw);
        localStorage.setItem(LS_MANAGER_PIN, "1234");
        return "1234";
      }catch{
        return "1234";
      }
    })();

    function isManager(){ return currentRole === "gerente"; }
    function setRole(role){
      currentRole = role === "gerente" ? "gerente" : "operador";
      localStorage.setItem(LS_ROLE, currentRole);
      renderRole();
    }

    function applyRoleLocks(){
      const locked = !isManager();
      document.querySelectorAll("[data-role-only='manager']").forEach(el => {
        el.classList.toggle("locked", locked);
        el.setAttribute("aria-disabled", locked ? "true" : "false");
        const tag = el.tagName.toLowerCase();
        if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea"){
          el.disabled = locked;
        }
      });
    }

    function renderRole(){
      const roleText = document.getElementById("roleText");
      const roleDot = document.getElementById("roleDot");
      if (roleText) roleText.textContent = `Modo: ${isManager() ? "Gerente" : "Operador"}`;
      if (roleDot){
        roleDot.classList.remove("role-operator", "role-manager");
        roleDot.classList.add(isManager() ? "role-manager" : "role-operator");
      }
      applyRoleLocks();
      updateSystemLock();
      updateMiniStatus();
    }

    function requireManager(){
      if (isManager()) return true;
      toast("Ação restrita ao gerente.", "error");
      return false;
    }

    function saveShift(){
      localStorage.setItem(LS_SHIFT, JSON.stringify(shiftState));
    }
    function setLastOrderId(id){
      if (id === undefined || id === null) return;
      lastOrderId = String(id);
      localStorage.setItem(LS_LAST_ORDER, lastOrderId);
    }
    function reprintLastOrder(){
      if (!lastOrderId){
        toast("Nenhum pedido para reimprimir ainda.", "info");
        return;
      }
      openPrintUrl(`/api/orders/${lastOrderId}/print?prices=1`);
    }

    async function syncCashFromServer(){
      try{
        const resp = await fetch("/api/cash/status");
        if (!resp.ok) throw new Error("status");
        const data = await resp.json();
        if (data?.cash_status){
          shiftState.open = String(data.cash_status).toUpperCase() === "ABERTO";
          saveShift();
          renderShift();
        }
      }catch{
        // mantém estado local se o servidor estiver indisponível
      }
    }

    // ===== Subcategorias de Pizza =====
const LS_SUBCATS = "mvs_pizza_subcats_v1";

function loadPizzaSubcats(){
  try{
    const raw = localStorage.getItem(LS_SUBCATS);
    if (!raw) return ["salgadas", "doces"];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return ["salgadas", "doces"];
    return arr;
  }catch{
    return ["salgadas", "doces"];
  }
}
function savePizzaSubcats(arr){
  localStorage.setItem(LS_SUBCATS, JSON.stringify(arr));
}

let pizzaSubcats = loadPizzaSubcats();
let activePizzaSubcat = "salgadas"; // default

function normalizeSubcat(s){
  return String(s || "").trim().toLowerCase();
}
function defaultPizzaSubcat(){
  return normalizeSubcat(pizzaSubcats[0] || "salgadas");
}
function productSubcat(p){
  return normalizeSubcat(p?.subcat) || defaultPizzaSubcat();
}

function prettySubcat(s){
  const v = String(s||"").toLowerCase();
  if (v === "salgadas") return "🍕 Salgadas";
  if (v === "doces") return "🍫 Doces";
  return "🏷️ " + (s.charAt(0).toUpperCase() + s.slice(1));
}

function renderPizzaSubTabs(){
  // compat: subcategorias agora ficam ao lado das categorias
  renderCategoryTabs();
}

document.getElementById("newSubcatBtn")?.addEventListener("click", () => {
  const name = safePrompt("Nome da subcategoria (ex: doces, especiais, veganas):");
  if (!name) return;
  const v = name.trim().toLowerCase();
  if (!v) return;

  if (!pizzaSubcats.includes(v)) {
    pizzaSubcats.push(v);
    savePizzaSubcats(pizzaSubcats);
  }
  activePizzaSubcat = v;
  renderPizzaSubTabs();
  // atualiza select do modal se estiver aberto
  syncSubcatSelect();
  renderProducts();
});

function syncSubcatSelect(){
  const block = document.getElementById("pizzaSubcatBlock");
  const select = document.getElementById("pSubcat");
  if (!block || !select) return;

  const isPizza = (document.getElementById("pCategory")?.value === "pizzas");
  block.style.display = isPizza ? "grid" : "none";
  if (!isPizza) return;

  select.innerHTML = pizzaSubcats.map(sc => `<option value="${sc}">${prettySubcat(sc)}</option>`).join("");
  if (!select.value) select.value = activePizzaSubcat || pizzaSubcats[0];
}

    // ===== Categorias =====
    const LS_CATS = "mvs_categories_v1";
    function seedCategories(){
      return [
        { id:"pizzas", label:"Pizzas", emoji:"🍕" },
        { id:"lanches", label:"Lanches", emoji:"🍔" },
        { id:"acai", label:"Açaí", emoji:"🍧" },
        { id:"bebidas", label:"Bebidas", emoji:"🥤" },
        { id:"extras", label:"Extras", emoji:"🍟" },
        { id:"sobremesas", label:"Sobremesas", emoji:"🍰" },
      ];
    }

    function loadCategories(){
      try{
        const raw = localStorage.getItem(LS_CATS);
        if (!raw){
          const seeded = seedCategories();
          localStorage.setItem(LS_CATS, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("bad");
        const seeded = seedCategories();
        const ids = new Set(parsed.map(c => c.id));
        for (const s of seeded){
          if (!ids.has(s.id)) parsed.push(s);
        }
        localStorage.setItem(LS_CATS, JSON.stringify(parsed));
        return parsed;
      }catch{
        const seeded = seedCategories();
        localStorage.setItem(LS_CATS, JSON.stringify(seeded));
        return seeded;
      }
    }

    function saveCategories(list){
      localStorage.setItem(LS_CATS, JSON.stringify(list));
    }

    function normalizeCatId(name){
      return String(name || "")
        .trim()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    function normalizeCategoryId(raw){
      const id = normalizeCatId(raw);
      if (id === "pizza") return "pizzas";
      if (id === "lanche") return "lanches";
      if (id === "bebida") return "bebidas";
      if (id === "sobremesa") return "sobremesas";
      if (id === "extra") return "extras";
      return id;
    }

    function guessCategoryEmoji(name){
      const n = String(name || "").toLowerCase();
      if (n.includes("pizza")) return "🍕";
      if (n.includes("lanche") || n.includes("burger") || n.includes("hamb")) return "🍔";
      if (n.includes("acai") || n.includes("açai")) return "🍧";
      if (n.includes("bebida") || n.includes("suco") || n.includes("refr")) return "🥤";
      if (n.includes("sobrem")) return "🍰";
      if (n.includes("extra")) return "🍟";
      return "🏷️";
    }

    let categories = loadCategories();

    function getCategoryLabel(id){
      const c = categories.find(x => x.id === id);
      if (!c) return "Produtos";
      return `${c.emoji || "🏷️"} ${c.label}`;
    }

    function ensureActiveCategory(){
      if (!categories.find(c => c.id === activeCategory)){
        activeCategory = categories[0]?.id || "pizzas";
      }
    }

    function renderCategoryTabs(){
      if (!els.categoryTabs) return;
      ensureActiveCategory();
      if (activeCategory === "pizzas"){
        if (!pizzaSubcats.includes(activePizzaSubcat)) activePizzaSubcat = pizzaSubcats[0];
      }

      const catChips = categories.map(c => `
        <div class="chip ${c.id === activeCategory ? "active" : ""}" data-cat="${c.id}">
          ${escapeHtml(c.emoji || "🏷️")} ${escapeHtml(c.label)}
        </div>
      `).join("");

      const subChips = (activeCategory === "pizzas") ? pizzaSubcats.map(sc => `
        <div class="chip ${sc === activePizzaSubcat ? "active":""}" data-subcat="${sc}">
          ${prettySubcat(sc)}
        </div>
      `).join("") : "";

      const catRow = `<div class="chipRow">${catChips}</div>`;
      const subRow = subChips ? `<div class="chipRow subRow">${subChips}</div>` : "";
      els.categoryTabs.innerHTML = catRow + subRow;
    }

    function renderCategorySelect(){
      if (!els.pCategory) return;
      els.pCategory.innerHTML = categories.map(c =>
        `<option value="${c.id}">${escapeHtml(c.emoji || "🏷️")} ${escapeHtml(c.label)}</option>`
      ).join("");
    }

    function categoryInUse(id){
      return products.some(p => p.category === id);
    }

    function renderCategoryEditor(){
      if (!els.categoryList) return;
      if (!categories.length){
        els.categoryList.innerHTML = `<div class="opsEmpty">Nenhuma categoria</div>`;
        return;
      }
      els.categoryList.innerHTML = categories.map(c => `
        <div class="catRow" data-id="${escapeAttr(c.id)}">
          <div class="catPreview">${escapeHtml(c.emoji || "🏷️")}</div>
          <input type="text" data-field="label" value="${escapeAttr(c.label)}" placeholder="Nome da categoria" />
          <input type="text" data-field="emoji" value="${escapeAttr(c.emoji || "")}" placeholder="Emoji" />
          <button class="miniBtn danger" type="button" data-action="del" data-id="${escapeAttr(c.id)}">Excluir</button>
        </div>
      `).join("");
    }

    const CATEGORY_EMOJIS = [
      "🍕","🍔","🥪","🌭","🍟","🥟","🍗","🍖","🥩","🍤",
      "🍝","🍛","🍜","🍲","🥗","🥣","🧀","🥓","🍳","🥚",
      "🍞","🥐","🥖","🫓","🥨","🥯","🍰","🧁","🍩","🍪",
      "🍫","🍬","🍭","🍦","🍨","🍧","🍮","🥧","🍓","🍍",
      "🍇","🍌","🍉","🍑","🍒","🍎","🍐","🥭","🍋","🥝",
      "🥤","🧃","☕","🫖","🥛","🍺","🍹","🧋","🧉","🧊"
    ];

    function renderEmojiGrid(){
      if (!els.emojiGrid) return;
      els.emojiGrid.innerHTML = CATEGORY_EMOJIS.map(e => `
        <button class="emojiBtn" type="button" data-emoji="${escapeAttr(e)}">${escapeHtml(e)}</button>
      `).join("");
    }

    function openCategoryModal(){
      if (!els.categoryModal) return;
      if (!requireManager()) return;
      closeOtherModals();
      applyRoleLocks();
      renderCategoryEditor();
      els.categoryModal.style.display = "flex";
    }

    let emojiTargetInput = null;
    function openEmojiModal(targetInput){
      if (!els.emojiModal) return;
      emojiTargetInput = targetInput || null;
      renderEmojiGrid();
      els.emojiModal.style.display = "flex";
    }
    function closeEmojiModal(){
      if (els.emojiModal) els.emojiModal.style.display = "none";
    }

    function closeCategoryModal(){
      if (els.categoryModal) els.categoryModal.style.display = "none";
    }

    function saveCategoryEdits(){
      if (!els.categoryList) return;
      const rows = Array.from(els.categoryList.querySelectorAll(".catRow"));
      const updated = [];
      for (const row of rows){
        const id = row.dataset.id;
        const label = row.querySelector('[data-field="label"]')?.value?.trim() || "";
        const emoji = row.querySelector('[data-field="emoji"]')?.value?.trim() || "🏷️";
        if (!label){
          toast("Nome da categoria não pode ficar vazio.", "error");
          return false;
        }
        updated.push({ id, label, emoji });
      }
      categories = updated;
      saveCategories(categories);
      renderCategoryTabs();
      renderCategorySelect();
      refreshAddonManager();
      syncTabs();
      renderProducts();
      toast("Categorias atualizadas.", "success");
      return true;
    }

    // ===== Produtos =====
    const LS_KEY = "mvs_products_v3";
    function seedProducts(){
      return [
        { id: uid(), name:"Calabresa", category:"pizzas", emoji:"🍕", desc:"Tradicional", priceP:39.90, priceM:49.90, isKitchen:true },
        { id: uid(), name:"Frango c/ Catupiry", category:"pizzas", emoji:"🍕", desc:"Cremosa", priceP:42.90, priceM:54.90, isKitchen:true },
        { id: uid(), name:"4 Queijos", category:"pizzas", emoji:"🧀", desc:"Bem queijo", priceP:45.90, priceM:58.90, isKitchen:true },

        { id: uid(), name:"Refrigerante 2L", category:"bebidas", emoji:"🥤", desc:"Gelado", price:12.00, isKitchen:false },
        { id: uid(), name:"Suco 500ml", category:"bebidas", emoji:"🧃", desc:"Natural", price:8.00, isKitchen:false },

        { id: uid(), name:"Borda Recheada", category:"extras", emoji:"🧀", desc:"Catupiry/Cheddar", price:8.00, isKitchen:true },
        { id: uid(), name:"Batata Frita", category:"extras", emoji:"🍟", desc:"Crocante", price:18.00, isKitchen:true },

        { id: uid(), name:"Brownie", category:"sobremesas", emoji:"🍰", desc:"Top!", price:14.00, isKitchen:false },
      ];
    }

    function loadProducts(){
      try{
        const raw = localStorage.getItem(LS_KEY);
        if (!raw){
          const seeded = seedProducts();
          localStorage.setItem(LS_KEY, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("bad");
        return parsed;
      }catch{
        const seeded = seedProducts();
        localStorage.setItem(LS_KEY, JSON.stringify(seeded));
        return seeded;
      }
    }

    function saveProducts(list){
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    let products = loadProducts();

    function prettyCatLabel(id){
      return String(id || "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    }

    function ensureCategoriesFromProducts(){
      let changed = false;
      for (const p of products){
        const cid = String(p.category || "").trim();
        if (!cid) continue;
        if (!categories.find(c => c.id === cid)){
          categories.push({
            id: cid,
            label: prettyCatLabel(cid),
            emoji: guessCategoryEmoji(cid)
          });
          changed = true;
        }
      }
      if (changed) saveCategories(categories);
    }

    // ===== Carrinho =====
    // cart: Map<key, { name, qty, unit_price, notes, is_kitchen, emoji }>
    const cart = new Map();

    const LS_ADDONS = "mvs_category_addons_v1";
    const DEFAULT_CATEGORY_ADDONS = Object.freeze({
      pizzas: [
        { name: "Sem adicional", price: 0 },
        { name: "Azeitona extra", price: 2.0 },
        { name: "Borda recheada", price: 8.0 },
        { name: "Orégano extra", price: 1.0 },
      ],
      lanches: [
        { name: "Sem adicional", price: 0 },
        { name: "Batata frita", price: 6.0 },
        { name: "Molho da casa", price: 2.0 },
        { name: "Maionese temperada", price: 2.0 },
        { name: "Queijo extra", price: 4.0 },
        { name: "Bacon extra", price: 5.0 },
      ],
      acai: [
        { name: "Sem adicional", price: 0 },
        { name: "Leite condensado", price: 2.0 },
        { name: "Granola", price: 2.0 },
        { name: "Banana", price: 2.0 },
        { name: "Morango", price: 3.0 },
        { name: "Paçoca", price: 2.0 },
      ],
      bebidas: [
        { name: "Sem adicional", price: 0 },
        { name: "Com gelo", price: 0 },
        { name: "Sem gelo", price: 0 },
        { name: "Limão", price: 1.0 },
      ],
      extras: [
        { name: "Sem adicional", price: 0 },
        { name: "Molho da casa", price: 2.0 },
        { name: "Queijo ralado", price: 2.0 },
      ],
      sobremesas: [
        { name: "Sem adicional", price: 0 },
        { name: "Calda de chocolate", price: 2.0 },
        { name: "Calda de morango", price: 2.0 },
        { name: "Chantilly", price: 3.0 },
      ],
      _default: [{ name: "Sem adicional", price: 0 }],
    });

    function normalizeAddonName(raw){
      return String(raw || "").trim().replace(/\s+/g, " ");
    }

    function defaultAddonPriceForCategory(categoryKey, addonName){
      const key = String(categoryKey || "_default").trim().toLowerCase();
      const name = normalizeAddonName(addonName).toLowerCase();
      if (!name) return 0;
      const variants = new Set([key]);
      if (key.endsWith("s")) variants.add(key.slice(0, -1));
      if (key && !key.endsWith("s")) variants.add(`${key}s`);
      if (key === "pizza") variants.add("pizzas");
      if (key === "lanche") variants.add("lanches");
      if (key === "bebida") variants.add("bebidas");
      if (key === "sobremesa") variants.add("sobremesas");
      if (key === "extra") variants.add("extras");
      if (key === "açai") variants.add("acai");
      if (key === "acai") variants.add("açai");

      for (const candidate of variants){
        const source = Array.isArray(DEFAULT_CATEGORY_ADDONS[candidate]) ? DEFAULT_CATEGORY_ADDONS[candidate] : null;
        if (!source) continue;
        const found = source.find((entry) => normalizeAddonName(entry?.name || "").toLowerCase() === name);
        if (found){
          const value = Number(found?.price || 0);
          return roundMoney(Math.max(0, Number.isFinite(value) ? value : 0));
        }
      }
      return 0;
    }

    function parseMoneyFlexible(raw){
      const str = String(raw ?? "").trim();
      if (!str) return NaN;
      const cleaned = str.replace(/[^\d,.-]/g, "");
      if (!cleaned) return NaN;
      const hasComma = cleaned.includes(",");
      const hasDot = cleaned.includes(".");
      let normalized = cleaned;
      if (hasComma && hasDot){
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
      } else if (hasComma){
        normalized = cleaned.replace(",", ".");
      }
      const n = Number(normalized);
      return Number.isFinite(n) ? n : NaN;
    }

    function normalizeAddonEntry(raw, categoryKey = "_default"){
      if (typeof raw === "string"){
        const name = normalizeAddonName(raw);
        if (!name) return null;
        return { name, price: defaultAddonPriceForCategory(categoryKey, name) };
      }
      if (raw && typeof raw === "object"){
        const name = normalizeAddonName(raw.name || raw.label || "");
        if (!name) return null;
        const fallbackPrice = defaultAddonPriceForCategory(categoryKey, name);
        const rawPriceValue = raw.price;
        const hasRawPrice = rawPriceValue !== undefined && rawPriceValue !== null && String(rawPriceValue).trim() !== "";
        const parsed = hasRawPrice
          ? ((typeof rawPriceValue === "string") ? parseMoneyFlexible(rawPriceValue) : Number(rawPriceValue))
          : fallbackPrice;
        const safe = Number.isFinite(parsed) ? parsed : fallbackPrice;
        const price = roundMoney(Math.max(0, safe));
        return { name, price: Number.isFinite(price) ? price : 0 };
      }
      return null;
    }

    function normalizeAddonList(rawList, categoryKey = "_default"){
      const list = Array.isArray(rawList) ? rawList : [];
      const out = [];
      const seen = new Set();
      for (const row of list){
        const entry = normalizeAddonEntry(row, categoryKey);
        if (!entry) continue;
        const key = entry.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
      }
      const filtered = out.filter((entry) => entry.name.toLowerCase() !== "sem adicional");
      return [{ name: "Sem adicional", price: 0 }, ...filtered];
    }

    function normalizeAddonsMap(rawMap){
      const source = (rawMap && typeof rawMap === "object") ? rawMap : {};
      const keys = new Set(["_default", ...Object.keys(DEFAULT_CATEGORY_ADDONS), ...Object.keys(source)]);
      const out = {};
      for (const keyRaw of keys){
        const key = String(keyRaw || "").trim().toLowerCase();
        if (!key) continue;
        const fromSource = Array.isArray(source[key]) ? source[key] : source[keyRaw];
        const base = Array.isArray(fromSource)
          ? fromSource
          : (DEFAULT_CATEGORY_ADDONS[key] || DEFAULT_CATEGORY_ADDONS._default);
        out[key] = normalizeAddonList(base, key);
      }
      if (!Array.isArray(out._default) || !out._default.length){
        out._default = [{ name: "Sem adicional", price: 0 }];
      }
      return out;
    }

    function loadCategoryAddons(){
      try{
        const raw = localStorage.getItem(LS_ADDONS);
        const parsed = raw ? JSON.parse(raw) : DEFAULT_CATEGORY_ADDONS;
        const normalized = normalizeAddonsMap(parsed);
        localStorage.setItem(LS_ADDONS, JSON.stringify(normalized));
        return normalized;
      } catch {
        const fallback = normalizeAddonsMap(DEFAULT_CATEGORY_ADDONS);
        localStorage.setItem(LS_ADDONS, JSON.stringify(fallback));
        return fallback;
      }
    }

    function saveCategoryAddons(map){
      const normalized = normalizeAddonsMap(map);
      categoryAddons = normalized;
      localStorage.setItem(LS_ADDONS, JSON.stringify(normalized));
    }

    let categoryAddons = loadCategoryAddons();

    function addonOptionsForCategory(category){
      const key = String(category || "").trim().toLowerCase();
      const variants = new Set([key]);
      if (key.endsWith("s")) variants.add(key.slice(0, -1));
      if (key && !key.endsWith("s")) variants.add(`${key}s`);
      if (key === "pizza") variants.add("pizzas");
      if (key === "lanche") variants.add("lanches");
      if (key === "bebida") variants.add("bebidas");
      if (key === "sobremesa") variants.add("sobremesas");
      if (key === "extra") variants.add("extras");
      if (key === "açai") variants.add("acai");
      if (key === "acai") variants.add("açai");

      for (const candidate of variants){
        const byCategory = categoryAddons[candidate];
        if (Array.isArray(byCategory) && byCategory.length) return byCategory;
      }
      return categoryAddons._default || [{ name: "Sem adicional", price: 0 }];
    }

    function addonOptionLabel(addon){
      const addonName = normalizeAddonName(addon?.name || "");
      const addonPrice = roundMoney(Math.max(0, Number(addon?.price || 0)));
      if (!addonName) return "";
      if (addonName.toLowerCase() === "sem adicional") return addonName;
      return `${addonName} (+${brl(addonPrice)})`;
    }

    function buildRegularItemNotes(addon, rawNote){
      const parts = [];
      const addonName = normalizeAddonName(typeof addon === "string" ? addon : (addon?.name || ""));
      const addonPriceRaw = typeof addon === "string" ? 0 : Number(addon?.price || 0);
      const addonPrice = roundMoney(Math.max(0, addonPriceRaw));
      const noteTxt = String(rawNote || "").trim();
      if (addonName && addonName.toLowerCase() !== "sem adicional"){
        const addonLabel = addonOptionLabel({ name: addonName, price: addonPrice });
        parts.push(`Acomp.: ${addonLabel}`);
      }
      if (noteTxt){
        parts.push(noteTxt);
      }
      return parts.join(" • ");
    }

    // ===== UI/DOM =====
    const els = {
      clock: document.getElementById("clock"),
      systemBtn: document.getElementById("systemBtn"),
      addonManagerBtn: document.getElementById("addonManagerBtn"),
      systemModal: document.getElementById("systemModal"),
      systemClose: document.getElementById("systemClose"),
      addonModal: document.getElementById("addonModal"),
      addonClose: document.getElementById("addonClose"),
      addonCancel: document.getElementById("addonCancel"),
      addonEditModal: document.getElementById("addonEditModal"),
      addonEditClose: document.getElementById("addonEditClose"),
      addonEditCancel: document.getElementById("addonEditCancel"),
      addonEditSave: document.getElementById("addonEditSave"),
      rolePill: document.getElementById("rolePill"),
      roleText: document.getElementById("roleText"),
      roleDot: document.getElementById("roleDot"),

      managerPinInput: document.getElementById("managerPinInput"),
      managerPinInputLogin: document.getElementById("managerPinInputLogin"),
      managerLoginBtn: document.getElementById("managerLoginBtn"),
      managerLogoutBtn: document.getElementById("managerLogoutBtn"),
      managerNewPinInput: document.getElementById("managerNewPinInput"),
      managerSetPinBtn: document.getElementById("managerSetPinBtn"),
      backupExportBtn: document.getElementById("backupExportBtn"),
      backupImportBtn: document.getElementById("backupImportBtn"),
      backupFileInput: document.getElementById("backupFileInput"),
      backupHint: document.getElementById("backupHint"),
      backupRestoreBtn: document.getElementById("backupRestoreBtn"),
      autoBackupToggle: document.getElementById("autoBackupToggle"),
      diagInfo: document.getElementById("diagInfo"),
      diagRefreshBtn: document.getElementById("diagRefreshBtn"),
      logClearBtn: document.getElementById("logClearBtn"),
      logList: document.getElementById("logList"),
      cancelSaleBtn: document.getElementById("cancelSaleBtn"),
      addonCategorySelect: document.getElementById("addonCategorySelect"),
      addonNameInput: document.getElementById("addonNameInput"),
      addonPriceInput: document.getElementById("addonPriceInput"),
      addonAddBtn: document.getElementById("addonAddBtn"),
      addonList: document.getElementById("addonList"),
      addonEditNameInput: document.getElementById("addonEditNameInput"),
      addonEditPriceInput: document.getElementById("addonEditPriceInput"),
      miniRole: document.getElementById("miniRole"),
      miniCash: document.getElementById("miniCash"),
      miniStorage: document.getElementById("miniStorage"),
      miniOnline: document.getElementById("miniOnline"),
      managerLoginModal: document.getElementById("managerLoginModal"),
      managerLoginClose: document.getElementById("managerLoginClose"),
      managerLoginBtnModal: document.getElementById("managerLoginBtnModal"),
      salesModal: document.getElementById("salesModal"),
      salesClose: document.getElementById("salesClose"),
      salesRefresh: document.getElementById("salesRefresh"),
      salesDate: document.getElementById("salesDate"),
      salesList: document.getElementById("salesList"),
      salesEditCard: document.getElementById("salesEditCard"),
      salesEditType: document.getElementById("salesEditType"),
      salesEditTable: document.getElementById("salesEditTable"),
      salesEditName: document.getElementById("salesEditName"),
      salesEditPhone: document.getElementById("salesEditPhone"),
      salesEditAddress: document.getElementById("salesEditAddress"),
      salesEditNotes: document.getElementById("salesEditNotes"),
      salesEditPayment: document.getElementById("salesEditPayment"),
      salesEditCancel: document.getElementById("salesEditCancel"),
      salesEditSave: document.getElementById("salesEditSave"),
      confirmModal: document.getElementById("confirmModal"),
      confirmTitle: document.getElementById("confirmTitle"),
      confirmMessage: document.getElementById("confirmMessage"),
      confirmClose: document.getElementById("confirmClose"),
      confirmCancel: document.getElementById("confirmCancel"),
      confirmOk: document.getElementById("confirmOk"),
      itemModal: document.getElementById("itemModal"),
      itemTitle: document.getElementById("itemTitle"),
      itemClose: document.getElementById("itemClose"),
      itemCancel: document.getElementById("itemCancel"),
      itemName: document.getElementById("itemName"),
      itemAddon: document.getElementById("itemAddon"),
      itemAddonHint: document.getElementById("itemAddonHint"),
      itemNotes: document.getElementById("itemNotes"),
      itemRemove: document.getElementById("itemRemove"),
      itemAdd: document.getElementById("itemAdd"),
      categoryTabs: document.getElementById("categoryTabs"),
      activeCategoryLabel: document.getElementById("activeCategoryLabel"),
      searchInput: document.getElementById("searchInput"),
      products: document.getElementById("products"),
      productsTitle: document.getElementById("productsTitle"),

      importXmlBtn: document.getElementById("importXmlBtn"),
      xmlFileInput: document.getElementById("xmlFileInput"),

      cartItems: document.getElementById("cartItems"),
      emptyState: document.getElementById("emptyState"),
      subtotal: document.getElementById("subtotal"),
      discount: document.getElementById("discount"),
      fee: document.getElementById("fee"),
      total: document.getElementById("total"),

      finishBtn: document.getElementById("finishBtn"),
      clearBtn: document.getElementById("clearBtn"),

      cashPill: document.getElementById("cashPill"),
      cashDot: document.getElementById("cashDot"),
      cashText: document.getElementById("cashText"),

      reportsBtn: document.getElementById("reportsBtn"),
      reportsModal: document.getElementById("reportsModal"),
      reportsClose: document.getElementById("reportsClose"),
      reportDate: document.getElementById("reportDate"),
      reportGrid: document.getElementById("reportGrid"),
      printModal: document.getElementById("printModal"),
      printClose: document.getElementById("printClose"),
      printDo: document.getElementById("printDo"),
      printSave: document.getElementById("printSave"),
      printFrame: document.getElementById("printFrame"),

      metaType: document.getElementById("metaType"),
      metaPay: document.getElementById("metaPay"),

      // Product modal
      productModal: document.getElementById("productModal"),
      productModalTitle: document.getElementById("productModalTitle"),
      productClose: document.getElementById("productClose"),
      productCancel: document.getElementById("productCancel"),
      productSave: document.getElementById("productSave"),
      newProductBtn: document.getElementById("newProductBtn"),
      manageCategoriesBtn: document.getElementById("manageCategoriesBtn"),
      pName: document.getElementById("pName"),
      pCategory: document.getElementById("pCategory"),
      pSubcat: document.getElementById("pSubcat"),
      pEmoji: document.getElementById("pEmoji"),
      pDesc: document.getElementById("pDesc"),
      pPrice: document.getElementById("pPrice"),
      pPriceP: document.getElementById("pPriceP"),
      pPriceM: document.getElementById("pPriceM"),
      priceSingleBlock: document.getElementById("priceSingleBlock"),
      pricePizzaBlock: document.getElementById("pricePizzaBlock"),
      kitchenBlock: document.getElementById("kitchenBlock"),
      pIsKitchen: document.getElementById("pIsKitchen"),
      pIsKitchenPizza: document.getElementById("pIsKitchenPizza"),

      // Pizza modal
      pizzaModal: document.getElementById("pizzaModal"),
      pizzaTitle: document.getElementById("pizzaTitle"),
      pizzaClose: document.getElementById("pizzaClose"),
      pizzaCancel: document.getElementById("pizzaCancel"),
      sizeSeg: document.getElementById("sizeSeg"),
      halfSeg: document.getElementById("halfSeg"),
      flavor1: document.getElementById("flavor1"),
      flavor2: document.getElementById("flavor2"),
      pizzaAddon: document.getElementById("pizzaAddon"),
      pizzaAddonHint: document.getElementById("pizzaAddonHint"),
      pizzaNotes: document.getElementById("pizzaNotes"),
      pizzaPrice: document.getElementById("pizzaPrice"),
      pizzaAdd: document.getElementById("pizzaAdd"),

      // Checkout modal
      checkoutModal: document.getElementById("checkoutModal"),
      checkoutClose: document.getElementById("checkoutClose"),
      checkoutCancel: document.getElementById("checkoutCancel"),
      checkoutConfirm: document.getElementById("checkoutConfirm"),
      orderType: document.getElementById("orderType"),
      tableNo: document.getElementById("tableNo"),
      custName: document.getElementById("custName"),
      custPhone: document.getElementById("custPhone"),
      custAddress: document.getElementById("custAddress"),
      orderNotes: document.getElementById("orderNotes"),
      paymentMethod: document.getElementById("paymentMethod"),
      paymentSplitToggle: document.getElementById("paymentSplitToggle"),
      paymentSplitPeople: document.getElementById("paymentSplitPeople"),
      paymentMethodSingleWrap: document.getElementById("paymentMethodSingleWrap"),
      paymentSplitWrap: document.getElementById("paymentSplitWrap"),
      paymentSplitList: document.getElementById("paymentSplitList"),
      paymentSplitHint: document.getElementById("paymentSplitHint"),
      paymentBlock: document.getElementById("paymentBlock"),
      paymentRow: document.getElementById("paymentRow"),
      checkoutTotal: document.getElementById("checkoutTotal"),

      // Mesas/Cozinha
      opsTablesBtn: document.getElementById("opsTablesBtn"),
      opsKitchenBtn: document.getElementById("opsKitchenBtn"),
      deliveryBtn: document.getElementById("deliveryBtn"),
      opsTablesModal: document.getElementById("opsTablesModal"),
      opsKitchenModal: document.getElementById("opsKitchenModal"),
      opsTablesClose: document.getElementById("opsTablesClose"),
      opsKitchenClose: document.getElementById("opsKitchenClose"),
      opsTablesRefresh: document.getElementById("opsTablesRefresh"),
      opsKitchenRefresh: document.getElementById("opsKitchenRefresh"),
      deliveryModal: document.getElementById("deliveryModal"),
      deliveryClose: document.getElementById("deliveryClose"),
      deliveryRefresh: document.getElementById("deliveryRefresh"),
      deliveryList: document.getElementById("deliveryList"),
      opsTables: document.getElementById("opsTables"),
      opsKitchen: document.getElementById("opsKitchen"),

      // Category modal
      categoryModal: document.getElementById("categoryModal"),
      categoryClose: document.getElementById("categoryClose"),
      categoryCancel: document.getElementById("categoryCancel"),
      categorySave: document.getElementById("categorySave"),
      categoryAddBtn: document.getElementById("categoryAddBtn"),
      categoryList: document.getElementById("categoryList"),
      categoryAddName: document.getElementById("categoryAddName"),
      categoryAddEmoji: document.getElementById("categoryAddEmoji"),
      categoryEmojiToggle: document.getElementById("categoryEmojiToggle"),
      emojiModal: document.getElementById("emojiModal"),
      emojiClose: document.getElementById("emojiClose"),
      emojiGrid: document.getElementById("emojiGrid"),
    };

    let activeCategory = "pizzas";
    let searchQuery = "";
    let editingProductId = null;
    let closingTableId = null;
    let closingTableIds = null;
    let paymentSplits = [];

    // ===== Relógio =====
    function tickClock(){
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      els.clock.textContent = `${hh}:${mm}`;
    }
    tickClock(); setInterval(tickClock, 1000);

    function todayISODate(){
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    }

    // ===== Caixa UI =====
    function renderShift(){
      if (shiftState.open){
        els.cashText.textContent = "Caixa: ABERTO";
        els.cashDot.classList.remove("closed");
      } else {
        els.cashText.textContent = "Caixa: FECHADO";
        els.cashDot.classList.add("closed");
      }
      updateMiniStatus();
    }
    renderShift();
    syncCashFromServer();

    // ===== Mesas/Cozinha/Delivery =====
    let opsPoll = null;
    let deliveryPoll = null;

    function prettyType(t){
      const v = String(t || "");
      return v ? (v.charAt(0).toUpperCase() + v.slice(1)) : "-";
    }

    function fmtDateTime(iso){
      try{ return new Date(iso).toLocaleString("pt-BR"); }
      catch{ return "-"; }
    }

    function groupOpenTables(rows){
      const byTable = new Map();
      for (const r of rows || []){
        const tableNo = String(r.table_no || "").trim() || "-";
        const key = tableNo.toLowerCase();
        const entry = byTable.get(key) || {
          table_no: tableNo,
          order_ids: [],
          order_numbers: [],
          order_count: 0,
          names: new Set(),
          items: new Map(),
          total: 0,
          created_at: r.created_at || null
        };
        entry.order_ids.push(Number(r.id));
        if (r.order_number) entry.order_numbers.push(Number(r.order_number));
        entry.order_count += Number(r.order_count || 1);
        if (r.customer_name) entry.names.add(String(r.customer_name));
        if (Array.isArray(r.itemsSummary)){
          for (const it of r.itemsSummary){
            const keyItem = `${it.name}||${it.notes || ""}`;
            const cur = entry.items.get(keyItem) || { name: it.name, qty: 0, notes: it.notes || "" };
            cur.qty += Number(it.qty || 0);
            entry.items.set(keyItem, cur);
          }
        }
        entry.total += Number(r.total || 0);
        if (r.created_at){
          const prev = entry.created_at ? new Date(entry.created_at).getTime() : 0;
          const now = new Date(r.created_at).getTime();
          if (now > prev) entry.created_at = r.created_at;
        }
        byTable.set(key, entry);
      }
      return Array.from(byTable.values()).sort((a, b) => {
        const sa = String(a.table_no || "").trim();
        const sb = String(b.table_no || "").trim();
        const emptyA = !sa || sa === "-";
        const emptyB = !sb || sb === "-";
        if (emptyA !== emptyB) return emptyA ? 1 : -1;

        const na = Number.parseInt(sa, 10);
        const nb = Number.parseInt(sb, 10);
        const numA = Number.isFinite(na);
        const numB = Number.isFinite(nb);
        if (numA && numB && na !== nb) return na - nb;
        if (numA !== numB) return numA ? -1 : 1;

        const byLabel = sa.localeCompare(sb, "pt-BR", { numeric: true, sensitivity: "base" });
        if (byLabel !== 0) return byLabel;

        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
    }

    function renderOpsTables(rows){
      if (!rows || rows.length === 0){
        els.opsTables.innerHTML = `<div class="opsEmpty">Nenhuma mesa aberta</div>`;
        return;
      }

      const grouped = groupOpenTables(rows);
      if (grouped.length === 0){
        els.opsTables.innerHTML = `<div class="opsEmpty">Nenhuma mesa aberta</div>`;
        return;
      }

      els.opsTables.innerHTML = grouped.map(g => {
        const mesaNo = g.table_no && g.table_no !== "-" ? String(g.table_no) : "-";
        const total = brl(Number(g.total || 0));
        const count = Math.max(1, Number(g.order_count || g.order_ids.length || 1));
        const pedidoTxt = count > 1 ? `${count} pedidos` : "1 pedido";
        const ids = g.order_ids.join(",");
        const names = Array.from(g.names || []);
        const namesText = names.length ? names.join(" / ") : "";
        const itemsList = Array.from(g.items.values());
        const totalItems = itemsList.reduce((acc, it) => acc + Number(it.qty || 0), 0);
        const itemsText = totalItems === 1 ? "1 item" : `${totalItems} itens`;
        const toggleId = `ops-items-${g.table_no || "mesa"}-${ids.replace(/[^0-9,]/g, "").replaceAll(",", "-")}`;
        const itemsHtml = itemsList.length
          ? `<div class="opsItems" id="${escapeHtml(toggleId)}" style="display:none">${itemsList.map(it => {
              const notes = (it.notes || "").trim();
              return `<div class="opsMeta">• ${escapeHtml(`${it.qty}x ${it.name}`)}${notes ? ` (${escapeHtml(notes)})` : ""}</div>`;
            }).join("")}</div>`
          : `<div class="opsMeta">Itens indisponíveis</div>`;
        return `
          <article class="opsItem mesaCard">
            <div class="mesaHead">
              <div class="mesaBubble">Mesa ${escapeHtml(mesaNo)}</div>
              <div class="mesaTotal">${escapeHtml(total)}</div>
            </div>
            <div class="opsMeta">${escapeHtml(pedidoTxt)} • ${escapeHtml(itemsText)}</div>
            ${namesText ? `<div class="opsMeta">${escapeHtml(namesText)}</div>` : ""}
            <div class="opsMeta">${escapeHtml(fmtDateTime(g.created_at))}</div>
            <div class="mesaActions">
              <button class="miniBtn" type="button" data-action="toggle-items" data-target="${escapeHtml(toggleId)}">Ver itens</button>
              <button class="miniBtn" type="button" data-action="close-table" data-order-ids="${escapeHtml(ids)}">Carregar</button>
            </div>
            ${itemsHtml}
          </article>
        `;
      }).join("");
    }

    function renderOpsKitchen(rows){
      if (!rows || rows.length === 0){
        els.opsKitchen.innerHTML = `<div class="opsEmpty">Nenhum item pendente</div>`;
        return;
      }

      els.opsKitchen.innerHTML = rows.map(r => {
        const qty = Number(r.qty || 0);
        const itemName = String(r.name || "Item");
        const origin = (String(r.order_type) === "mesa" && r.table_no)
          ? `Mesa ${r.table_no}`
          : prettyType(r.order_type);
        const notes = (r.notes || "").trim();
        const meta = `Pedido #${r.order_number} • ${origin} • ${fmtDateTime(r.created_at)}`;
        return `
          <article class="opsItem kitchenCard">
            <div class="kitchenHead">
              <span class="kitchenStatus">Em preparo</span>
              <span class="kitchenQty">${escapeHtml(`${qty}x`)}</span>
            </div>
            <div class="opsTitle">${escapeHtml(itemName)}</div>
            <div class="opsMeta">${escapeHtml(meta)}</div>
            ${notes ? `<div class="opsMeta">Obs: ${escapeHtml(notes)}</div>` : ""}
            <button class="miniBtn" type="button" data-action="ready-item" data-id="${escapeHtml(String(r.id))}">Pronto</button>
          </article>
        `;
      }).join("");
    }

    async function loadOpsData(){
      if (!els.opsTables || !els.opsKitchen) return;

      const refreshBtns = [els.opsTablesRefresh, els.opsKitchenRefresh].filter(Boolean);
      try{
        refreshBtns.forEach(b => setButtonLoading(b, true));
        const [tResp, kResp] = await Promise.all([
          fetch("/api/tables/open"),
          fetch("/api/kitchen/pending"),
        ]);

        const tData = await tResp.json().catch(() => null);
        const kData = await kResp.json().catch(() => null);

        if (!tResp.ok || tData?.ok === false) throw new Error(tData?.error || "Erro ao carregar mesas");
        if (!kResp.ok || kData?.ok === false) throw new Error(kData?.error || "Erro ao carregar cozinha");

        let rows = tData?.rows || [];
        const needItems = rows.filter(r => !Array.isArray(r.itemsSummary));
        if (needItems.length){
          const enriched = await Promise.all(rows.map(async (r) => {
            if (Array.isArray(r.itemsSummary)) return r;
            try{
              const resp = await fetch(`/api/orders/${r.id}`);
              const data = await resp.json().catch(() => null);
              if (!resp.ok || data?.ok === false) return r;
              const items = Array.isArray(data.items) ? data.items : [];
              const summaryMap = new Map();
              for (const it of items){
                const key = `${it.name}||${it.notes || ""}`;
                const cur = summaryMap.get(key) || { name: String(it.name || "Item"), qty: 0, notes: String(it.notes || "") };
                cur.qty += Number(it.qty || 1);
                summaryMap.set(key, cur);
              }
              return { ...r, itemsSummary: Array.from(summaryMap.values()) };
            } catch {
              return r;
            }
          }));
          rows = enriched;
        }
        renderOpsTables(rows);
        renderOpsKitchen(kData?.rows || []);
      } catch (e){
        els.opsTables.innerHTML = `<div class="opsEmpty">Falha ao carregar mesas</div>`;
        els.opsKitchen.innerHTML = `<div class="opsEmpty">Falha ao carregar cozinha</div>`;
        logError("Falha ao carregar OPS", e);
      } finally {
        refreshBtns.forEach(b => setButtonLoading(b, false));
      }
    }

    async function loadTableToCart(orderIds){
      const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
      try{
        const results = await Promise.all(ids.map(async (id) => {
          const resp = await fetch(`/api/orders/${id}`);
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao carregar mesa");
          return data;
        }));

        const merged = new Map();
        let baseOrder = null;

        for (const data of results){
          const order = data.order || {};
          const items = Array.isArray(data.items) ? data.items : [];
          baseOrder = order;

          for (const it of items){
            const key = `${it.name}||${it.unit_price}||${it.notes}||${it.is_kitchen ? 1 : 0}`;
            const current = merged.get(key);
            if (current){
              current.qty += Number(it.qty || 1);
            } else {
              merged.set(key, {
                name: String(it.name || "Item"),
                qty: Number(it.qty || 1),
                unit_price: Number(it.unit_price || 0),
                notes: String(it.notes || ""),
                is_kitchen: !!it.is_kitchen,
                emoji: "🧾"
              });
            }
          }
        }

        cart.clear();
        let idx = 0;
        for (const it of merged.values()){
          cart.set(`merge|${idx++}`, it);
        }

        renderCart();

        closingTableIds = ids.map(Number).filter(v => Number.isFinite(v));
        closingTableId = closingTableIds[closingTableIds.length - 1] || null;
        els.orderType.value = baseOrder?.order_type || "mesa";
        els.tableNo.value = baseOrder?.table_no || "";
        els.custName.value = baseOrder?.customer_name || "";
        els.custPhone.value = baseOrder?.customer_phone || "";
        els.custAddress.value = baseOrder?.address || "";
        els.orderNotes.value = baseOrder?.notes || "";

        els.orderType.dispatchEvent(new Event("change"));
        updatePaymentVisibility();

        closeOpsTablesModal();
        toast("Mesa carregada no carrinho. Finalize o pagamento.", "success");
      } catch (e){
        toast("Falha ao carregar mesa: " + e.message, "error", { detail: e?.stack || e?.message });
      }
    }

    function opsAnyOpen(){
      return (els.opsTablesModal && els.opsTablesModal.style.display === "flex")
        || (els.opsKitchenModal && els.opsKitchenModal.style.display === "flex")
        || (els.deliveryModal && els.deliveryModal.style.display === "flex");
    }

    function openOpsTablesModal(){
      if (!els.opsTablesModal) return;
      els.opsTablesModal.style.display = "flex";
      loadOpsData();
      if (opsPoll) clearInterval(opsPoll);
      opsPoll = setInterval(loadOpsData, 8000);
    }

    function openOpsKitchenModal(){
      if (!els.opsKitchenModal) return;
      els.opsKitchenModal.style.display = "flex";
      loadOpsData();
      if (opsPoll) clearInterval(opsPoll);
      opsPoll = setInterval(loadOpsData, 8000);
    }

    function closeOpsTablesModal(){
      if (els.opsTablesModal) els.opsTablesModal.style.display = "none";
      if (!opsAnyOpen() && opsPoll) { clearInterval(opsPoll); opsPoll = null; }
    }

    function closeOpsKitchenModal(){
      if (els.opsKitchenModal) els.opsKitchenModal.style.display = "none";
      if (!opsAnyOpen() && opsPoll) { clearInterval(opsPoll); opsPoll = null; }
    }

    function openDeliveryModal(){
      if (!els.deliveryModal) return;
      els.deliveryModal.style.display = "flex";
      loadDeliveryData();
      if (deliveryPoll) clearInterval(deliveryPoll);
      deliveryPoll = setInterval(loadDeliveryData, 8000);
    }

    function closeDeliveryModal(){
      if (els.deliveryModal) els.deliveryModal.style.display = "none";
      if (deliveryPoll) { clearInterval(deliveryPoll); deliveryPoll = null; }
    }

    if (els.opsTablesBtn) els.opsTablesBtn.addEventListener("click", openOpsTablesModal);
    if (els.opsKitchenBtn) els.opsKitchenBtn.addEventListener("click", openOpsKitchenModal);
    if (els.deliveryBtn) els.deliveryBtn.addEventListener("click", openDeliveryModal);
    if (els.opsTablesClose) els.opsTablesClose.addEventListener("click", closeOpsTablesModal);
    if (els.opsKitchenClose) els.opsKitchenClose.addEventListener("click", closeOpsKitchenModal);
    if (els.opsTablesRefresh) els.opsTablesRefresh.addEventListener("click", loadOpsData);
    if (els.opsKitchenRefresh) els.opsKitchenRefresh.addEventListener("click", loadOpsData);
    if (els.opsTablesModal) els.opsTablesModal.addEventListener("click", (e) => { if (e.target === els.opsTablesModal) closeOpsTablesModal(); });
    if (els.opsKitchenModal) els.opsKitchenModal.addEventListener("click", (e) => { if (e.target === els.opsKitchenModal) closeOpsKitchenModal(); });
    if (els.deliveryClose) els.deliveryClose.addEventListener("click", closeDeliveryModal);
    if (els.deliveryRefresh) els.deliveryRefresh.addEventListener("click", loadDeliveryData);
    if (els.deliveryModal) els.deliveryModal.addEventListener("click", (e) => { if (e.target === els.deliveryModal) closeDeliveryModal(); });

    els.opsTables.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "toggle-items"){
        const targetId = btn.dataset.target;
        if (!targetId) return;
        const el = document.getElementById(targetId);
        if (!el) return;
        const visible = el.style.display !== "none";
        el.style.display = visible ? "none" : "grid";
        btn.textContent = visible ? "Ver itens" : "Ocultar itens";
        return;
      }
      if (action === "close-table"){
        const ids = String(btn.dataset.orderIds || "").split(",").map(v => v.trim()).filter(Boolean);
        if (ids.length === 0) return;
        const ok = await openConfirmModal({
          title: "Carregar mesa",
          message: "Carregar mesa no carrinho para fechar?"
        });
        if (!ok) return;
        setButtonLoading(btn, true);
        try{
          await loadTableToCart(ids);
        } finally {
          setButtonLoading(btn, false);
        }
      }
    });

    els.opsKitchen.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action='ready-item']");
      if (!btn) return;
      const id = btn.dataset.id;
      try{
        setButtonLoading(btn, true);
        const resp = await fetch(`/api/kitchen/item/${id}/ready`, { method:"POST" });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao atualizar item");
        loadOpsData();
      } catch (err){
        toast("Falha ao marcar pronto: " + err.message, "error", { detail: err?.stack || err?.message });
      } finally {
        setButtonLoading(btn, false);
      }
    });

    function renderDelivery(rows){
      if (!els.deliveryList) return;
      if (!rows || rows.length === 0){
        els.deliveryList.innerHTML = `<div class="opsEmpty">Nenhuma entrega em preparo</div>`;
        return;
      }

      els.deliveryList.innerHTML = rows.map(r => {
        const total = brl(Number(r.total || 0));
        const customer = r.customer_name ? `Cliente: ${escapeHtml(r.customer_name)}` : "Cliente: -";
        const address = r.address ? `Endereço: ${escapeHtml(r.address)}` : "Endereço: -";
        const meta = `Pedido #${r.order_number} • ${fmtDateTime(r.created_at)}`;
        const status = String(r.delivery_status || "PREPARO").toUpperCase();
        const statusLabel = status === "DESPACHADO" ? "Despachado" : "Em preparo";
        const actionLabel = status === "DESPACHADO" ? "Finalizar" : "Despachar";
        const action = status === "DESPACHADO" ? "finalize" : "dispatch";
        const statusClass = status === "DESPACHADO" ? "is-dispatched" : "is-prep";
        return `
          <article class="opsItem deliveryCard">
            <div class="deliveryHead">
              <span class="deliveryStatus ${statusClass}">${statusLabel}</span>
              <span class="deliveryTotal">${escapeHtml(total)}</span>
            </div>
            <div class="opsMeta">${escapeHtml(meta)}</div>
            <div class="opsMeta">${customer}</div>
            <div class="opsMeta">${address}</div>
            <button class="miniBtn" type="button" data-action="${action}" data-id="${escapeHtml(String(r.id))}">${actionLabel}</button>
          </article>
        `;
      }).join("");
    }

    async function loadDeliveryData(){
      if (!els.deliveryList) return;
      try{
        setButtonLoading(els.deliveryRefresh, true);
        const resp = await fetch("/api/delivery/pending");
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao carregar deliveries");
        renderDelivery(data?.rows || []);
      } catch (e){
        els.deliveryList.innerHTML = `<div class="opsEmpty">Falha ao carregar deliveries</div>`;
        logError("Falha ao carregar Delivery", e);
      } finally {
        setButtonLoading(els.deliveryRefresh, false);
      }
    }

    if (els.deliveryList) els.deliveryList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;
      try{
        setButtonLoading(btn, true);
        if (action === "dispatch"){
          const resp = await fetch(`/api/delivery/${id}/dispatch`, { method:"POST" });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao despachar");
        } else if (action === "finalize"){
          const resp = await fetch(`/api/delivery/${id}/finalize`, { method:"POST" });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao finalizar");
        }
        loadDeliveryData();
      } catch (err){
        const msg = action === "finalize" ? "Falha ao finalizar: " : "Falha ao despachar: ";
        toast(msg + err.message, "error", { detail: err?.stack || err?.message });
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // ===== Relatórios =====
    function openReportsModal(){
      if (!els.reportsModal) return;
      if (!requireManager()) return;
      closeOtherModals();
      if (els.reportDate && !els.reportDate.value) {
        els.reportDate.value = todayISODate();
      }
      els.reportsModal.style.display = "flex";
    }

    function closeReportsModal(){
      if (els.reportsModal) els.reportsModal.style.display = "none";
    }

    if (els.reportsBtn) els.reportsBtn.addEventListener("click", openReportsModal);
    if (els.reportsClose) els.reportsClose.addEventListener("click", closeReportsModal);
    if (els.reportsModal) els.reportsModal.addEventListener("click", (e) => {
      if (e.target === els.reportsModal) closeReportsModal();
    });

    if (els.reportGrid) els.reportGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-report]");
      if (!btn) return;
      const period = btn.dataset.report;
      const mode = btn.dataset.mode === "detailed" ? "detailed" : "normal";

      if (period === "last"){
        const qs = new URLSearchParams({ mode }).toString();
        openPrintUrl(`/api/cash/report/print?${qs}`);
        return;
      }

      const date = (els.reportDate && els.reportDate.value) ? els.reportDate.value : todayISODate();
      const qs = new URLSearchParams({ period, date, mode }).toString();
      openPrintUrl(`/api/reports/print?${qs}`);
    });

    // ===== Sistema / Diagnóstico =====
    function renderLogs(){
      if (!els.logList) return;
      if (!logs.length){
        els.logList.innerHTML = `<div class="logRow"><div class="logMsg">Sem logs no momento</div></div>`;
        return;
      }

      const rows = [...logs].reverse().slice(0, 200).map(l => {
        const when = new Date(l.ts).toLocaleString("pt-BR");
        return `
          <div class="logRow">
            <div class="logMeta">
              <span>${escapeHtml(l.level.toUpperCase())}</span>
              <span>${escapeHtml(when)}</span>
            </div>
            <div class="logMsg">${escapeHtml(l.msg)}${l.data ? ` • ${escapeHtml(l.data)}` : ""}</div>
          </div>
        `;
      }).join("");
      els.logList.innerHTML = rows;
    }

    function formatBytes(bytes){
      const b = Number(bytes || 0);
      if (b < 1024) return `${b} B`;
      const kb = b / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if (mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }

    function localDateISO(d = new Date()){
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    }

    function loadAutoBackupIndex(){
      try{
        const raw = localStorage.getItem(AUTO_BACKUP_INDEX);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }

    function saveAutoBackupIndex(arr){
      localStorage.setItem(AUTO_BACKUP_INDEX, JSON.stringify(arr));
    }

    function isAutoBackupEnabled(){
      try{
        const v = localStorage.getItem(AUTO_BACKUP_ENABLED_KEY);
        return v === null ? true : v === "1";
      } catch {
        return true;
      }
    }

    function setAutoBackupEnabled(val){
      localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, val ? "1" : "0");
    }

    function updateBackupHint(){
      if (!els.backupHint) return;
      const list = loadAutoBackupIndex();
      const last = list[0] || "";
      if (isAutoBackupEnabled()){
        els.backupHint.textContent = last ? `Backup automático ativo. Último: ${last}` : "Backup automático ativo.";
      } else {
        els.backupHint.textContent = "Backup automático desativado.";
      }
    }

    function runAutoBackup(){
      if (!DEMO_STORAGE_MODE) return;
      if (!isAutoBackupEnabled()) return;
      const raw = localStorage.getItem(DEMO_DB_KEY);
      if (!raw) return;
      const today = localDateISO();
      const key = `${AUTO_BACKUP_PREFIX}${today}`;
      localStorage.setItem(key, raw);

      let list = loadAutoBackupIndex();
      list = [today, ...list.filter(d => d !== today)];
      const keep = list.slice(0, 2);
      for (const d of list.slice(2)){
        localStorage.removeItem(`${AUTO_BACKUP_PREFIX}${d}`);
      }
      saveAutoBackupIndex(keep);
      updateBackupHint();
      logEvent("info", "Backup automático criado", `Data: ${today}`);
    }

    function scheduleAutoBackup(){
      if (!DEMO_STORAGE_MODE) return;
      const now = new Date();
      const today = localDateISO(now);
      const targetToday = new Date(now);
      targetToday.setHours(23,50,0,0);

      const list = loadAutoBackupIndex();
      if (now >= targetToday && list[0] !== today){
        runAutoBackup();
      }

      let target = targetToday;
      if (now > target) target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
      const delay = Math.max(1000, target.getTime() - now.getTime());
      setTimeout(() => {
        runAutoBackup();
        scheduleAutoBackup();
      }, delay);
    }

    function restoreAutoBackup(daysAgo = 1){
      if (!DEMO_STORAGE_MODE) return;
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const key = `${AUTO_BACKUP_PREFIX}${localDateISO(d)}`;
      const raw = localStorage.getItem(key);
      if (!raw){
        toast("Backup de ontem não encontrado.", "error");
        return;
      }
      try{
        JSON.parse(raw);
      } catch {
        toast("Backup inválido.", "error");
        return;
      }
      const ok = confirm("Restaurar backup de ontem? Isso substitui os dados atuais.");
      if (!ok) return;
      localStorage.setItem(DEMO_DB_KEY, raw);
      updateBackupHint();
      logEvent("info", "Backup restaurado", `Data: ${localDateISO(d)}`);
      location.reload();
    }
    function updateMiniStatus(){
      if (!els.miniRole || !els.miniCash || !els.miniStorage || !els.miniOnline) return;
      els.miniRole.textContent = isManager() ? "Gerente" : "Operador";
      els.miniCash.textContent = shiftState.open ? "Aberto" : "Fechado";
      try{
        if (DEMO_STORAGE_MODE) {
          const raw = localStorage.getItem("mvs_demo_backend_v1") || "";
          els.miniStorage.textContent = `Local (${formatBytes(new Blob([raw]).size)})`;
        } else {
          els.miniStorage.textContent = "Servidor";
        }
      } catch {
        els.miniStorage.textContent = DEMO_STORAGE_MODE ? "Local" : "Servidor";
      }
      els.miniOnline.textContent = navigator.onLine ? "Online" : "Offline";
    }

    async function loadDiagnostics(){
      if (!els.diagInfo) return;
      setButtonLoading(els.diagRefreshBtn, true);
      try{
        const resp = await fetch("/api/diag");
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro");

        const lines = [
          `Versão: ${data?.app?.version || "-"}`,
          `Node: ${data?.app?.node || "-"}`,
          `Plataforma: ${data?.app?.platform || "-"} / ${data?.app?.arch || "-"}`,
          `Uptime: ${Math.round(Number(data?.app?.uptime || 0))}s`,
          `DB: ${data?.db?.path || "-"}`,
          `DB tamanho: ${formatBytes(data?.db?.size || 0)}`,
          `Pedidos: ${data?.db?.orders ?? "-"}`,
          `Itens: ${data?.db?.items ?? "-"}`,
          `Caixa: ${data?.db?.cash_status || "-"}`,
          `Último backup: ${data?.db?.last_backup_at ? new Date(data.db.last_backup_at).toLocaleString("pt-BR") : "-"}`
        ];

        els.diagInfo.textContent = lines.join("\n");
        if (els.backupHint){
          const lastBk = data?.db?.last_backup_at
            ? new Date(data.db.last_backup_at).toLocaleString("pt-BR")
            : "—";
          els.backupHint.textContent = `Backup automático ativo. Último: ${lastBk}`;
        }
      } catch (e){
        toast("Falha ao carregar diagnóstico: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.diagRefreshBtn, false);
      }
    }

    function updateSystemLock(){
      const cards = document.querySelectorAll("#systemModal .sysCard");
      const locked = !isManager();
      cards.forEach((card, idx) => {
        if (idx === 0) return; // keep Access card enabled
        card.classList.toggle("locked", locked);
        card.style.pointerEvents = locked ? "none" : "auto";
      });
    }

    function addonCategoryLabel(id){
      const key = String(id || "").trim().toLowerCase();
      if (key === "_default") return "Padrão (outras categorias)";
      const category = categories.find((c) => c.id === key);
      if (category){
        return `${category.emoji || "🏷️"} ${category.label}`;
      }
      return prettyCatLabel(key);
    }

    function renderAddonCategorySelect(){
      if (!els.addonCategorySelect) return;
      const current = String(els.addonCategorySelect.value || "").trim().toLowerCase();
      const keys = new Set(["_default"]);
      for (const c of categories){
        if (c?.id) keys.add(String(c.id).trim().toLowerCase());
      }
      for (const k of Object.keys(categoryAddons || {})){
        if (k) keys.add(String(k).trim().toLowerCase());
      }

      const sorted = Array.from(keys).filter(Boolean).sort((a, b) => {
        if (a === "_default") return -1;
        if (b === "_default") return 1;
        return addonCategoryLabel(a).localeCompare(addonCategoryLabel(b), "pt-BR");
      });

      els.addonCategorySelect.innerHTML = sorted.map((id) => (
        `<option value="${escapeAttr(id)}">${escapeHtml(addonCategoryLabel(id))}</option>`
      )).join("");

      const next = sorted.includes(current) ? current : (sorted[0] || "_default");
      els.addonCategorySelect.value = next;
    }

    function renderAddonList(){
      if (!els.addonList || !els.addonCategorySelect) return;
      const categoryId = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const addons = addonOptionsForCategory(categoryId)
        .filter((entry) => String(entry?.name || "").toLowerCase() !== "sem adicional");

      if (!addons.length){
        els.addonList.innerHTML = `<div class="opsEmpty">Nenhum acompanhamento extra nesta categoria.</div>`;
        return;
      }

      els.addonList.innerHTML = addons.map((entry) => {
        const name = normalizeAddonName(entry?.name || "");
        const price = roundMoney(Math.max(0, Number(entry?.price || 0)));
        return `
        <div class="opsItem">
          <div>
            <div class="opsTitle">${escapeHtml(name)}</div>
            <div class="opsMeta">${escapeHtml(brl(price))}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="miniBtn" type="button" data-action="edit-addon" data-name="${escapeAttr(name)}" data-role-only="manager">Editar</button>
            <button class="miniBtn danger" type="button" data-action="del-addon" data-name="${escapeAttr(name)}" data-role-only="manager">Excluir</button>
          </div>
        </div>
      `;
      }).join("");
      applyRoleLocks();
    }

    function refreshAddonManager(){
      renderAddonCategorySelect();
      renderAddonList();
    }

    function addAddonFromEditor(){
      if (!requireManager()) return;
      if (!els.addonCategorySelect || !els.addonNameInput) return;

      const categoryId = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const name = normalizeAddonName(els.addonNameInput.value);
      const priceRaw = String(els.addonPriceInput?.value || "").trim();
      const priceParsed = priceRaw ? parseMoneyFlexible(priceRaw) : 0;
      const price = roundMoney(Math.max(0, Number(priceParsed || 0)));
      if (!name){
        toast("Informe o acompanhamento.", "error");
        els.addonNameInput.focus();
        return;
      }
      if (!Number.isFinite(priceParsed) && priceRaw){
        toast("Valor inválido. Ex: 2,50", "error");
        els.addonPriceInput?.focus();
        return;
      }
      if (name.toLowerCase() === "sem adicional"){
        toast("\"Sem adicional\" já é padrão.", "info");
        return;
      }

      const current = addonOptionsForCategory(categoryId).slice();
      if (current.some((x) => String(x?.name || "").toLowerCase() === name.toLowerCase())){
        toast("Acompanhamento já existe nesta categoria.", "info");
        return;
      }

      current.push({ name, price });
      categoryAddons[categoryId] = current;
      saveCategoryAddons(categoryAddons);
      refreshAddonManager();
      els.addonNameInput.value = "";
      if (els.addonPriceInput) els.addonPriceInput.value = "";
      els.addonNameInput.focus();
      toast("Acompanhamento adicionado.", "success");
    }

    function removeAddonFromEditor(nameRaw){
      if (!requireManager()) return;
      if (!els.addonCategorySelect) return;

      const categoryId = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const target = normalizeAddonName(nameRaw);
      if (!target) return;

      const current = addonOptionsForCategory(categoryId)
        .filter((entry) => String(entry?.name || "").toLowerCase() !== target.toLowerCase());
      categoryAddons[categoryId] = current;
      saveCategoryAddons(categoryAddons);
      refreshAddonManager();
      toast("Acompanhamento removido.", "success");
    }

    let addonEditContext = null;

    function closeAddonEditModal(){
      if (els.addonEditModal) els.addonEditModal.style.display = "none";
      addonEditContext = null;
      if (els.addonEditNameInput) els.addonEditNameInput.value = "";
      if (els.addonEditPriceInput) els.addonEditPriceInput.value = "";
    }

    function saveAddonEditFromModal(){
      if (!requireManager()) return;
      if (!addonEditContext) return;

      const nextName = normalizeAddonName(els.addonEditNameInput?.value || "");
      const nextPriceRaw = String(els.addonEditPriceInput?.value || "").trim();
      const nextPriceParsed = nextPriceRaw ? parseMoneyFlexible(nextPriceRaw) : 0;

      if (!nextName){
        toast("Informe um nome válido.", "error");
        els.addonEditNameInput?.focus();
        return;
      }
      if (nextName.toLowerCase() === "sem adicional"){
        toast("\"Sem adicional\" já é padrão.", "info");
        return;
      }
      if (!Number.isFinite(nextPriceParsed) || nextPriceParsed < 0){
        toast("Valor inválido. Ex: 2,50", "error");
        els.addonEditPriceInput?.focus();
        return;
      }
      const nextPrice = roundMoney(nextPriceParsed);

      const { categoryId, currentName } = addonEditContext;
      const current = addonOptionsForCategory(categoryId).slice();
      const idx = current.findIndex((entry) => String(entry?.name || "").toLowerCase() === currentName.toLowerCase());
      if (idx < 0){
        toast("Acompanhamento não encontrado.", "error");
        closeAddonEditModal();
        return;
      }
      if (current.some((entry, i) => i !== idx && String(entry?.name || "").toLowerCase() === nextName.toLowerCase())){
        toast("Já existe acompanhamento com esse nome.", "info");
        return;
      }

      current[idx] = { name: nextName, price: nextPrice };
      categoryAddons[categoryId] = current;
      saveCategoryAddons(categoryAddons);
      refreshAddonManager();
      closeAddonEditModal();
      toast("Acompanhamento atualizado.", "success");
    }

    function editAddonFromEditor(nameRaw){
      if (!requireManager()) return;
      if (!els.addonCategorySelect || !els.addonEditModal) return;

      const categoryId = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const currentName = normalizeAddonName(nameRaw);
      if (!currentName) return;

      const current = addonOptionsForCategory(categoryId).slice();
      const idx = current.findIndex((entry) => String(entry?.name || "").toLowerCase() === currentName.toLowerCase());
      if (idx < 0){
        toast("Acompanhamento não encontrado.", "error");
        return;
      }

      const currentEntry = current[idx] || { name: currentName, price: 0 };
      const currentPrice = roundMoney(Math.max(0, Number(currentEntry?.price || 0)));
      addonEditContext = { categoryId, currentName };
      if (els.addonEditNameInput) els.addonEditNameInput.value = normalizeAddonName(currentEntry?.name || currentName);
      if (els.addonEditPriceInput) els.addonEditPriceInput.value = String(currentPrice).replace(".", ",");
      els.addonEditModal.style.display = "flex";
      applyRoleLocks();
      setTimeout(() => els.addonEditNameInput?.focus(), 0);
    }

    function openSystemModal(){
      if (!els.systemModal) return;
      closeOtherModals();
      renderLogs();
      loadDiagnostics();
      updateMiniStatus();
      updateSystemLock();
      updateBackupHint();
      if (!isManager()){
        toast("Modo operador: recursos administrativos bloqueados.", "info");
      }
      els.systemModal.style.display = "flex";
    }

    function openAddonManager(){
      if (!els.addonModal) return;
      closeOtherModals();
      refreshAddonManager();
      applyRoleLocks();
      if (els.addonNameInput) els.addonNameInput.value = "";
      if (els.addonPriceInput) els.addonPriceInput.value = "";
      if (!isManager()){
        toast("Modo operador: recursos administrativos bloqueados.", "info");
      }
      els.addonModal.style.display = "flex";
      setTimeout(() => els.addonCategorySelect?.focus(), 0);
    }

    function closeAddonManager(){
      if (els.addonModal) els.addonModal.style.display = "none";
      closeAddonEditModal();
    }

    function closeSystemModal(){
      if (els.systemModal) els.systemModal.style.display = "none";
    }

    function closeManagerLoginModal(){
      if (els.managerLoginModal) els.managerLoginModal.style.display = "none";
    }

    if (els.systemBtn) els.systemBtn.addEventListener("click", openSystemModal);
    if (els.addonManagerBtn) els.addonManagerBtn.addEventListener("click", openAddonManager);
    if (els.systemClose) els.systemClose.addEventListener("click", closeSystemModal);
    if (els.systemModal) els.systemModal.addEventListener("click", (e) => {
      if (e.target === els.systemModal) closeSystemModal();
    });
    if (els.addonClose) els.addonClose.addEventListener("click", closeAddonManager);
    if (els.addonCancel) els.addonCancel.addEventListener("click", closeAddonManager);
    if (els.addonModal) els.addonModal.addEventListener("click", (e) => {
      if (e.target === els.addonModal) closeAddonManager();
    });
    if (els.addonEditClose) els.addonEditClose.addEventListener("click", closeAddonEditModal);
    if (els.addonEditCancel) els.addonEditCancel.addEventListener("click", closeAddonEditModal);
    if (els.addonEditSave) els.addonEditSave.addEventListener("click", saveAddonEditFromModal);
    if (els.addonEditModal) els.addonEditModal.addEventListener("click", (e) => {
      if (e.target === els.addonEditModal) closeAddonEditModal();
    });
    if (els.rolePill) els.rolePill.addEventListener("click", () => {
      openSystemModal();
    });

    if (els.managerLoginClose) els.managerLoginClose.addEventListener("click", closeManagerLoginModal);
    if (els.managerLoginModal) els.managerLoginModal.addEventListener("click", (e) => {
      if (e.target === els.managerLoginModal) closeManagerLoginModal();
    });

    if (els.managerLoginBtn) els.managerLoginBtn.addEventListener("click", () => {
      const pin = String(els.managerPinInput?.value || "").trim();
      if (!pin){
        toast("Informe o PIN do gerente.", "error");
        return;
      }
      if (pin !== managerPin){
        toast("PIN inválido.", "error");
        return;
      }
      setRole("gerente");
      toast("Modo gerente ativado.", "success");
      if (els.managerPinInput) els.managerPinInput.value = "";
    });
    if (els.managerLoginBtnModal) els.managerLoginBtnModal.addEventListener("click", () => {
      const pin = String(els.managerPinInputLogin?.value || "").trim();
      if (!pin){
        toast("Informe o PIN do gerente.", "error");
        return;
      }
      if (pin !== managerPin){
        toast("PIN inválido.", "error");
        return;
      }
      setRole("gerente");
      toast("Modo gerente ativado.", "success");
      if (els.managerPinInputLogin) els.managerPinInputLogin.value = "";
      closeManagerLoginModal();
      openSystemModal();
    });
    if (els.managerPinInput) els.managerPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.managerLoginBtn?.click();
    });
    if (els.managerPinInputLogin) els.managerPinInputLogin.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.managerLoginBtnModal?.click();
    });

    if (els.managerLogoutBtn) els.managerLogoutBtn.addEventListener("click", () => {
      setRole("operador");
      toast("Modo operador ativado.", "info");
    });

    if (els.managerSetPinBtn) els.managerSetPinBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      const newPin = String(els.managerNewPinInput?.value || "").trim();
      if (newPin.length < 4){
        toast("PIN deve ter no mínimo 4 dígitos.", "error");
        return;
      }
      managerPin = newPin;
      localStorage.setItem(LS_MANAGER_PIN, managerPin);
      if (els.managerNewPinInput) els.managerNewPinInput.value = "";
      toast("PIN atualizado com sucesso.", "success");
    });
    if (els.managerNewPinInput) els.managerNewPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.managerSetPinBtn?.click();
    });

    if (els.backupExportBtn) els.backupExportBtn.addEventListener("click", async () => {
      if (!requireManager()) return;
      setButtonLoading(els.backupExportBtn, true);
      try{
        const resp = await fetch("/api/backup/export");
        if (!resp.ok) throw new Error("Falha ao exportar backup");
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g,"-");
        a.href = url;
        a.download = window.__MVS_DEMO_STORAGE
          ? `mvs_pdv_backup_demo_${stamp}.json`
          : `mvs_pdv_backup_${stamp}.sqlite`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast("Backup exportado.", "success");
        logEvent("info", "Backup exportado", window.__MVS_DEMO_STORAGE ? "Demo JSON" : "SQLite");
        loadDiagnostics();
      } catch (e){
        toast("Falha ao exportar: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.backupExportBtn, false);
      }
    });

    if (els.backupImportBtn) els.backupImportBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      if (els.backupFileInput){
        els.backupFileInput.value = "";
        els.backupFileInput.click();
      }
    });

    if (els.backupFileInput) els.backupFileInput.addEventListener("change", async () => {
      const file = els.backupFileInput.files?.[0];
      if (!file) return;
      if (!requireManager()) return;
      setButtonLoading(els.backupImportBtn, true);
      try{
        const buf = await file.arrayBuffer();
        const resp = await fetch("/api/backup/import", {
          method:"POST",
          headers:{ "Content-Type":"application/octet-stream" },
          body: buf
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao importar");
        toast("Backup importado. Reabra o app para garantir consistência.", "success");
        logEvent("info", "Backup importado", file.name || "arquivo");
        loadDiagnostics();
      } catch (e){
        toast("Falha ao importar: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.backupImportBtn, false);
      }
    });

    if (els.autoBackupToggle){
      els.autoBackupToggle.checked = isAutoBackupEnabled();
      els.autoBackupToggle.addEventListener("change", () => {
        const enabled = !!els.autoBackupToggle.checked;
        setAutoBackupEnabled(enabled);
        updateBackupHint();
        logEvent("info", "Backup automático", enabled ? "Ativado" : "Desativado");
      });
    }

    if (els.addonCategorySelect) els.addonCategorySelect.addEventListener("change", renderAddonList);
    if (els.addonAddBtn) els.addonAddBtn.addEventListener("click", addAddonFromEditor);
    if (els.addonNameInput) els.addonNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        addAddonFromEditor();
      }
    });
    if (els.addonPriceInput) els.addonPriceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        addAddonFromEditor();
      }
    });
    if (els.addonEditNameInput) els.addonEditNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        saveAddonEditFromModal();
      }
    });
    if (els.addonEditPriceInput) els.addonEditPriceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        saveAddonEditFromModal();
      }
    });
    if (els.addonList) els.addonList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const name = btn.dataset.name || "";
      if (action === "edit-addon"){
        editAddonFromEditor(name);
        return;
      }
      if (action === "del-addon"){
        removeAddonFromEditor(name);
      }
    });
    if (els.diagRefreshBtn) els.diagRefreshBtn.addEventListener("click", loadDiagnostics);
    if (els.logClearBtn) els.logClearBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      logs = [];
      saveLogs();
      renderLogs();
      toast("Logs limpos.", "success");
    });
    if (els.cancelSaleBtn) els.cancelSaleBtn.addEventListener("click", () => {
      openSalesModal();
    });

    // ===== Tabs + Busca =====
    function syncTabs(){
      ensureActiveCategory();
      renderCategoryTabs();
      if (els.activeCategoryLabel) {
        els.activeCategoryLabel.textContent = getCategoryLabel(activeCategory);
      }
      if (els.productsTitle) {
        els.productsTitle.style.display = (activeCategory === "pizzas") ? "block" : "none";
      }
    }

    els.categoryTabs.addEventListener("click", (e) => {
      const sub = e.target.closest(".chip[data-subcat]");
      if (sub){
        activePizzaSubcat = sub.dataset.subcat;
        renderCategoryTabs();
        renderProducts();
        return;
      }
      const chip = e.target.closest(".chip[data-cat]");
      if (!chip) return;
      activeCategory = chip.dataset.cat;
      syncTabs();
      renderProducts();
    });

    els.searchInput.addEventListener("input", () => {
      searchQuery = els.searchInput.value;
      renderProducts();
    });

    // ===== Render Produtos =====
    function filteredProducts(){
      ensureActiveCategory();
      const q = searchQuery.trim().toLowerCase();
      return products.filter(p => {
        if (p.category !== activeCategory) return false;
        if (p.category === "pizzas"){
          const activeSub = normalizeSubcat(activePizzaSubcat) || defaultPizzaSubcat();
          if (productSubcat(p) !== activeSub) return false;
        }
        if (!q) return true;
        const hay = `${p.name} ${p.desc || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    function productMainPrice(p){
      if (p.category === "pizzas"){
        const broto = Number.isFinite(Number(p.priceP)) ? Number(p.priceP) : Number(p.priceM ?? p.priceG ?? 0);
        const normal = Number.isFinite(Number(p.priceM)) ? Number(p.priceM) : Number(p.priceG ?? p.priceP ?? 0);
        const min = Math.min(Math.max(0, broto), Math.max(0, normal));
        return `a partir de ${brl(min)}`;
      }
      return brl(Number(p.price || 0));
    }

    function renderProducts(){
      ensureActiveCategory();
      if (els.activeCategoryLabel) {
        els.activeCategoryLabel.textContent = getCategoryLabel(activeCategory);
      }
      const list = filteredProducts();

      if (list.length === 0){
        els.products.innerHTML = `<div class="emptyState" style="grid-column:1/-1">Nada aqui 😅</div>`;
        return;
      }

      els.products.innerHTML = list.map(p => `
        <article class="prod" data-id="${escapeHtml(p.id)}">
          <div class="inner">
            <h3>${escapeHtml(p.emoji || "🧾")} ${escapeHtml(p.name)}</h3>
            <div class="priceRow">
              <div>
                <div class="price">${productMainPrice(p)}</div>
                <div class="mini">${escapeHtml(p.desc || "")}</div>
              </div>
              <button class="add" type="button" data-action="add"><span>➕</span>Adicionar</button>
            </div>
            <div class="prodActions">
              <button class="miniBtn" type="button" data-action="edit" data-role-only="manager">✏️ Editar</button>
              <button class="miniBtn danger" type="button" data-action="del" data-role-only="manager">🗑️ Excluir</button>
            </div>
          </div>
        </article>
      `).join("");

      applyRoleLocks();
    }

    // ===== Render Carrinho =====
    function renderCart(){
      const isEmpty = cart.size === 0;
      els.emptyState.style.display = isEmpty ? "block" : "none";

      const nodes = Array.from(els.cartItems.querySelectorAll('[data-cart-row="1"]'));
      nodes.forEach(n => n.remove());

      for (const [key, item] of cart.entries()){
        const row = document.createElement("div");
        row.className = "item";
        row.dataset.cartRow = "1";
        row.dataset.key = key;

        const noteLine = (item.notes || "").trim();
        const unitLine = `${brl(item.unit_price)} • ${item.qty}x`;

        row.innerHTML = `
          <div class="emoji">${escapeHtml(item.emoji || "🧾")}</div>
          <div>
            <h4>${escapeHtml(item.name)}</h4>
            <p>${escapeHtml(noteLine || unitLine)}</p>
          </div>
          <div class="qty">
            <button type="button" data-action="dec">−</button>
            <span>${item.qty}</span>
            <button type="button" data-action="inc">+</button>
          </div>
        `;
        els.cartItems.appendChild(row);
      }

      renderTotals();
    }

    function renderTotals(){
      let subtotal = 0;
      for (const it of cart.values()){
        subtotal += it.unit_price * it.qty;
      }
      const discount = 0;
      const fee = 0;
      const total = Math.max(0, subtotal - discount + fee);

      els.subtotal.textContent = brl(subtotal);
      els.discount.textContent = brl(discount);
      els.fee.textContent = brl(fee);
      els.total.textContent = brl(total);
    }

    // ===== Carrinho +/− =====
    els.cartItems.addEventListener("click", (e) => {
      if (closingTableId){
        toast("Mesa em fechamento. Para alterar itens, cancele o fechamento e abra uma nova venda.", "info");
        return;
      }
      const b = e.target.closest("button[data-action]");
      if (!b) return;
      const row = e.target.closest("[data-cart-row='1']");
      if (!row) return;

      const key = row.dataset.key;
      const it = cart.get(key);
      if (!it) return;

      if (b.dataset.action === "inc") it.qty += 1;
      if (b.dataset.action === "dec") it.qty -= 1;

      if (it.qty <= 0) cart.delete(key);
      renderCart();
    });

    els.clearBtn.addEventListener("click", () => {
      if (closingTableId){
        const ok = confirm("Cancelar fechamento da mesa e limpar carrinho?");
        if (!ok) return;
        closingTableId = null;
        closingTableIds = null;
        updatePaymentVisibility();
      }
      cart.clear();
      renderCart();
      resetPaymentSplitState(0);
      updatePaymentVisibility();
    });

    // ===== Produto Modal (Cadastrar/Editar) =====
    function openProductModal(mode, product){
      els.productModal.style.display = "flex";
      ensureCategoriesFromProducts();
      renderCategorySelect();
      ensureActiveCategory();

      if (mode === "edit"){
        editingProductId = product.id;
        els.productModalTitle.textContent = "Editar Produto";
        els.pName.value = product.name || "";
        els.pCategory.value = product.category || "pizzas";
        els.pEmoji.value = product.emoji || "";
        els.pDesc.value = product.desc || "";
        els.pIsKitchen.value = product.isKitchen ? "1" : "0";
        els.pIsKitchenPizza.value = product.isKitchen ? "1" : "0";

        if (product.category === "pizzas"){
          els.pPriceP.value = String(product.priceP ?? "").replace(".", ",");
          els.pPriceM.value = String((product.priceM ?? product.priceG ?? "")).replace(".", ",");
        } else {
          els.pPrice.value = String(product.price ?? "").replace(".", ",");
        }
      } else {
        editingProductId = null;
        els.productModalTitle.textContent = "Cadastrar Produto";
        els.pName.value = "";
        els.pCategory.value = activeCategory;
        els.pEmoji.value = "";
        els.pDesc.value = "";
        els.pPrice.value = "";
        els.pPriceP.value = "";
        els.pPriceM.value = "";
        els.pIsKitchen.value = "1";
        els.pIsKitchenPizza.value = "1";
      }

      syncPriceBlocks();
      if (els.pCategory.value === "pizzas"){
        const subcat = (mode === "edit")
          ? (product?.subcat || activePizzaSubcat || pizzaSubcats[0])
          : (activePizzaSubcat || pizzaSubcats[0]);
        if (subcat) els.pSubcat.value = subcat;
      }
      setTimeout(() => els.pName.focus(), 0);
    }

    function closeProductModal(){
      els.productModal.style.display = "none";
    }

    function syncPriceBlocks(){
      const isPizza = els.pCategory.value === "pizzas";
      els.priceSingleBlock.style.display = isPizza ? "none" : "grid";
      els.pricePizzaBlock.style.display = isPizza ? "block" : "none";
      els.kitchenBlock.style.display = isPizza ? "none" : "grid";
      syncSubcatSelect();
    }

    els.pCategory.addEventListener("change", syncPriceBlocks);

    els.newProductBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      openProductModal("new");
    });
    function addCategoryPrompt(){
      if (!requireManager()) return;
      const name = String(els.categoryAddName?.value || "").trim();
      if (!name){
        toast("Informe o nome da categoria.", "error");
        els.categoryAddName?.focus();
        return;
      }

      const id = normalizeCategoryId(name);
      if (!id){
        toast("Nome inválido.", "error");
        return;
      }

      const emoji = String(els.categoryAddEmoji?.value || "").trim() || guessCategoryEmoji(name);

      const existing = categories.find(c => c.id === id);
      if (existing){
        existing.label = name;
        existing.emoji = emoji;
        toast("Categoria atualizada.", "success");
      } else {
        categories.push({ id, label: name, emoji });
        toast("Categoria adicionada.", "success");
      }

      saveCategories(categories);
      activeCategory = id;
      renderCategoryTabs();
      renderCategorySelect();
      refreshAddonManager();
      syncTabs();
      renderProducts();
      renderCategoryEditor();
      if (els.productModal && els.productModal.style.display === "flex"){
        els.pCategory.value = id;
        syncPriceBlocks();
      }
      if (els.categoryAddName) els.categoryAddName.value = "";
      if (els.categoryAddEmoji) els.categoryAddEmoji.value = "";
      els.categoryAddName?.focus();
    }

    if (els.manageCategoriesBtn) els.manageCategoriesBtn.addEventListener("click", openCategoryModal);
    if (els.categoryClose) els.categoryClose.addEventListener("click", closeCategoryModal);
    if (els.categoryCancel) els.categoryCancel.addEventListener("click", closeCategoryModal);
    if (els.categoryModal) els.categoryModal.addEventListener("click", (e) => {
      if (e.target === els.categoryModal) closeCategoryModal();
    });
    if (els.categoryAddBtn) els.categoryAddBtn.addEventListener("click", addCategoryPrompt);
    if (els.categoryAddName) els.categoryAddName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategoryPrompt();
    });
    if (els.categoryAddEmoji) els.categoryAddEmoji.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategoryPrompt();
    });
    if (els.categoryEmojiToggle) els.categoryEmojiToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      openEmojiModal(els.categoryAddEmoji);
    });
    if (els.emojiClose) els.emojiClose.addEventListener("click", closeEmojiModal);
    if (els.emojiModal) els.emojiModal.addEventListener("click", (e) => {
      if (e.target === els.emojiModal) closeEmojiModal();
    });
    if (els.emojiGrid) els.emojiGrid.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-emoji]");
      if (!b) return;
      if (emojiTargetInput){
        emojiTargetInput.value = b.dataset.emoji || "";
        emojiTargetInput.focus();
      }
      closeEmojiModal();
    });
    if (els.categorySave) els.categorySave.addEventListener("click", () => {
      if (!requireManager()) return;
      if (saveCategoryEdits()) closeCategoryModal();
    });
    if (els.categoryList) els.categoryList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='del']");
      if (!btn) return;
      if (!requireManager()) return;
      const id = btn.dataset.id;
      if (!id) return;
      if (categoryInUse(id)){
        toast("Não é possível excluir: categoria em uso.", "error");
        return;
      }
      if (!confirm("Excluir categoria?")) return;
      categories = categories.filter(c => c.id !== id);
      saveCategories(categories);
      renderCategoryEditor();
      renderCategoryTabs();
      renderCategorySelect();
      refreshAddonManager();
      syncTabs();
      renderProducts();
      toast("Categoria removida.", "success");
    });
    els.productClose.addEventListener("click", closeProductModal);
    els.productCancel.addEventListener("click", closeProductModal);
    els.productModal.addEventListener("click", (e) => { if (e.target === els.productModal) closeProductModal(); });

    function upsertProduct(){
      if (!requireManager()) return;
      const name = els.pName.value.trim();
      const category = els.pCategory.value;
      const emoji = els.pEmoji.value.trim() || (
        category === "pizzas" ? "🍕" :
        category === "bebidas" ? "🥤" :
        category === "sobremesas" ? "🍰" : "🍟"
      );
      const desc = els.pDesc.value.trim();
      const isKitchen = (category === "pizzas")
        ? (els.pIsKitchenPizza.value === "1")
        : (els.pIsKitchen.value === "1");

      if (!name){
        toast("Informe o nome do produto.", "error");
        els.pName.focus();
        return;
      }

      let product;

      if (category === "pizzas"){
        const priceP = parsePrice(els.pPriceP.value);
        const priceM = parsePrice(els.pPriceM.value);
        const subcat = normalizeSubcat(els.pSubcat?.value || activePizzaSubcat || pizzaSubcats[0]);

        if (![priceP, priceM].every(v => Number.isFinite(v) && v >= 0)){
          toast("Preços BROTO/Normal inválidos. Ex: 49,90", "error");
          return;
        }

        product = { name, category, emoji, desc, priceP, priceM, priceG: undefined, isKitchen, subcat };
      } else {
        const price = parsePrice(els.pPrice.value);
        if (!Number.isFinite(price) || price < 0){
          toast("Preço inválido. Ex: 12,00", "error");
          return;
        }
        product = { name, category, emoji, desc, price, isKitchen };
      }

      if (editingProductId){
        products = products.map(p => p.id === editingProductId ? { ...p, ...product } : p);
      } else {
        products = [{ id: uid(), ...product }, ...products];
      }

      saveProducts(products);
      closeProductModal();

      activeCategory = category;
      syncTabs();
      renderProducts();
    }

    els.productSave.addEventListener("click", upsertProduct);

    function deleteProduct(id){
      if (!requireManager()) return;
      const p = products.find(x => x.id === id);
      if (!p) return;
      if (!confirm(`Excluir "${p.name}"?`)) return;

      products = products.filter(x => x.id !== id);
      saveProducts(products);

      for (const key of cart.keys()){
        if (key === `item|${id}` || key.startsWith(`item|${id}|`)) cart.delete(key);
      }

      renderProducts();
      renderCart();
    }

    // ===== Pizza Modal (BROTO/Normal + meio a meio) =====
    let pizzaState = { size:"NORMAL", half:false, flavor1Id:null, flavor2Id:null, addonIndex:0, notes:"" };

    function setSegActive(segEl, attr, value){
      Array.from(segEl.querySelectorAll("button")).forEach(b => {
        b.classList.toggle("active", b.getAttribute(attr) === value);
      });
    }

    function pizzaSizeLabel(size){
      return size === "BROTO" ? "BROTO" : "Normal";
    }

    function priceForSize(pizzaProduct, size){
      if (size === "BROTO"){
        const broto = Number(pizzaProduct.priceP ?? pizzaProduct.priceM ?? pizzaProduct.priceG ?? 0);
        return Number.isFinite(broto) ? broto : 0;
      }
      // "Normal" usa preço M; se não existir, cai para legado.
      const normal = Number(pizzaProduct.priceM ?? pizzaProduct.priceG ?? pizzaProduct.priceP ?? 0);
      return Number.isFinite(normal) ? normal : 0;
    }

    function currentPizzaAddonFromModal(){
      const options = addonOptionsForCategory("pizzas");
      const idxRaw = Number.parseInt(String(els.pizzaAddon?.value || pizzaState.addonIndex || 0), 10);
      const idx = Number.isFinite(idxRaw) ? idxRaw : 0;
      const chosen = options[idx] || options[0] || { name: "Sem adicional", price: 0 };
      return {
        name: normalizeAddonName(chosen?.name || "Sem adicional") || "Sem adicional",
        price: roundMoney(Math.max(0, Number(chosen?.price || 0))),
      };
    }

    function renderPizzaAddonSelect(){
      if (!els.pizzaAddon) return;
      const options = addonOptionsForCategory("pizzas");
      els.pizzaAddon.innerHTML = options.map((opt, idx) => (
        `<option value="${idx}">${escapeHtml(addonOptionLabel(opt))}</option>`
      )).join("");
      const maxIndex = Math.max(0, options.length - 1);
      const safeIndex = Math.min(Math.max(0, Number(pizzaState.addonIndex || 0)), maxIndex);
      pizzaState.addonIndex = safeIndex;
      els.pizzaAddon.value = String(safeIndex);
    }

    function updatePizzaPrice(){
      const f1 = products.find(p => p.id === pizzaState.flavor1Id);
      const f2 = products.find(p => p.id === pizzaState.flavor2Id);
      if (!f1){ els.pizzaPrice.value = "—"; return; }

      const p1 = priceForSize(f1, pizzaState.size);
      const addon = currentPizzaAddonFromModal();
      const addonPrice = roundMoney(Math.max(0, Number(addon.price || 0)));

      let final = p1;
      if (!pizzaState.half){
        final = p1;
      } else {
        const p2 = f2 ? priceForSize(f2, pizzaState.size) : p1;
        final = Math.max(p1, p2);
      }
      final = roundMoney(final + addonPrice);
      els.pizzaPrice.value = brl(final) + " (meio a meio)";
      if (!pizzaState.half) els.pizzaPrice.value = brl(final);
      if (els.pizzaAddonHint){
        els.pizzaAddonHint.textContent = addonPrice > 0
          ? `Adicional selecionado: ${addon.name} (+${brl(addonPrice)}).`
          : "Opcional. Soma no valor final da pizza.";
      }
    }

    function openPizzaModal(defaultFlavorId){
      const pizzaFlavors = products.filter(p => p.category === "pizzas");
      if (pizzaFlavors.length === 0){
        toast("Cadastre pizzas primeiro 🍕", "info");
        return;
      }

      els.flavor1.innerHTML = pizzaFlavors.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
      els.flavor2.innerHTML = pizzaFlavors.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

      pizzaState.size = "NORMAL";
      pizzaState.half = false;
      pizzaState.flavor1Id = defaultFlavorId || pizzaFlavors[0].id;
      pizzaState.flavor2Id = pizzaFlavors[1]?.id || pizzaState.flavor1Id;
      pizzaState.addonIndex = 0;
      pizzaState.notes = "";

      els.flavor1.value = pizzaState.flavor1Id;
      els.flavor2.value = pizzaState.flavor2Id;
      renderPizzaAddonSelect();
      els.pizzaNotes.value = "";

      setSegActive(els.sizeSeg, "data-size", pizzaState.size);
      setSegActive(els.halfSeg, "data-half", "0");

      updatePizzaPrice();
      els.pizzaModal.style.display = "flex";
    }

    function closePizzaModal(){ els.pizzaModal.style.display = "none"; }

    els.sizeSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-size]");
      if (!b) return;
      pizzaState.size = b.dataset.size;
      setSegActive(els.sizeSeg, "data-size", pizzaState.size);
      updatePizzaPrice();
    });

    els.halfSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-half]");
      if (!b) return;
      pizzaState.half = b.dataset.half === "1";
      setSegActive(els.halfSeg, "data-half", pizzaState.half ? "1" : "0");
      updatePizzaPrice();
    });

    els.flavor1.addEventListener("change", () => { pizzaState.flavor1Id = els.flavor1.value; updatePizzaPrice(); });
    els.flavor2.addEventListener("change", () => { pizzaState.flavor2Id = els.flavor2.value; updatePizzaPrice(); });
    if (els.pizzaAddon) els.pizzaAddon.addEventListener("change", () => {
      const idxRaw = Number.parseInt(String(els.pizzaAddon?.value || "0"), 10);
      pizzaState.addonIndex = Number.isFinite(idxRaw) ? idxRaw : 0;
      updatePizzaPrice();
    });
    els.pizzaNotes.addEventListener("input", () => { pizzaState.notes = els.pizzaNotes.value; });

    els.pizzaClose.addEventListener("click", closePizzaModal);
    els.pizzaCancel.addEventListener("click", closePizzaModal);
    els.pizzaModal.addEventListener("click", (e) => { if (e.target === els.pizzaModal) closePizzaModal(); });

    els.pizzaAdd.addEventListener("click", () => {
      const f1 = products.find(p => p.id === pizzaState.flavor1Id);
      const f2 = products.find(p => p.id === pizzaState.flavor2Id);
      if (!f1) return;

      const p1 = priceForSize(f1, pizzaState.size);
      let unit = p1;
      const sizeLabel = pizzaSizeLabel(pizzaState.size);
      let name = `Pizza ${f1.name} (${sizeLabel})`;
      const addon = currentPizzaAddonFromModal();

      if (pizzaState.half && f2){
        const p2 = priceForSize(f2, pizzaState.size);
        unit = Math.max(p1, p2);
        name = `Pizza Meio a Meio: ${f1.name} + ${f2.name} (${sizeLabel})`;
      }
      unit = roundMoney(unit + Math.max(0, Number(addon.price || 0)));

      const notes = buildRegularItemNotes(addon, pizzaState.notes);
      const addonToken = encodeURIComponent(`${addon.name}|${roundMoney(addon.price || 0).toFixed(2)}`);
      const key = `pizza|${pizzaState.size}|${pizzaState.half ? "half" : "full"}|${pizzaState.flavor1Id}|${pizzaState.half ? pizzaState.flavor2Id : ""}|addon:${addonToken}|${notes}`;

      const existing = cart.get(key);
      if (existing) existing.qty += 1;
      else cart.set(key, {
        name,
        qty: 1,
        unit_price: unit,
        notes,
        is_kitchen: true,
        emoji: "🍕"
      });

      closePizzaModal();
      renderCart();
    });

    // ===== Clique produtos (add/edit/del) =====
    const itemModalState = { productId: null };

    function regularItemKey(productId, notes, addonPrice = 0){
      const safeNotes = String(notes || "").trim();
      const safeAddon = roundMoney(Math.max(0, Number(addonPrice || 0))).toFixed(2);
      return safeNotes
        ? `item|${productId}|ap:${safeAddon}|${safeNotes}`
        : `item|${productId}|ap:${safeAddon}`;
    }

    function hasRegularItemInCart(productId){
      for (const key of cart.keys()){
        if (key === `item|${productId}` || key.startsWith(`item|${productId}|`)) return true;
      }
      return false;
    }

    function addRegularProductToCart(product, notes = "", addonPrice = 0){
      const safeNotes = String(notes || "").trim();
      const extra = roundMoney(Math.max(0, Number(addonPrice || 0)));
      const key = regularItemKey(product.id, safeNotes, extra);
      const existing = cart.get(key);
      if (existing) existing.qty += 1;
      else cart.set(key, {
        name: product.name,
        qty: 1,
        unit_price: roundMoney(Number(product.price || 0) + extra),
        notes: safeNotes,
        is_kitchen: !!product.isKitchen,
        emoji: product.emoji || "🧾"
      });

      renderCart();
    }

    function removeRegularProductFromCart(product, notes = "", addonPrice = 0){
      const preferredKey = regularItemKey(product.id, notes, addonPrice);
      let keyToUse = cart.has(preferredKey) ? preferredKey : null;
      if (!keyToUse){
        for (const key of cart.keys()){
          if (key === `item|${product.id}` || key.startsWith(`item|${product.id}|`)){
            keyToUse = key;
            break;
          }
        }
      }

      if (!keyToUse){
        toast("Item não está no carrinho.", "info");
        return false;
      }

      const existing = cart.get(keyToUse);
      if (!existing) return false;
      existing.qty -= 1;
      if (existing.qty <= 0) cart.delete(keyToUse);
      renderCart();
      return true;
    }

    function openRegularItemModal(product){
      if (!els.itemModal || !els.itemAddon || !els.itemName) {
        // fallback de segurança
        addRegularProductToCart(product);
        return;
      }

      itemModalState.productId = product.id;
      if (els.itemTitle) els.itemTitle.textContent = `Ajustar item`;
      els.itemName.value = product.name || "";

      const options = addonOptionsForCategory(product.category);
      els.itemAddon.innerHTML = options.map((opt, idx) => {
        const label = addonOptionLabel(opt);
        return `<option value="${idx}">${escapeHtml(label)}</option>`;
      }).join("");
      els.itemAddon.value = "0";

      if (els.itemAddonHint){
        els.itemAddonHint.textContent = `Categoria: ${prettyCatLabel(product.category)}`;
      }

      if (els.itemNotes) els.itemNotes.value = "";
      if (els.itemRemove) els.itemRemove.disabled = !hasRegularItemInCart(product.id);

      els.itemModal.style.display = "flex";
      setTimeout(() => els.itemAddon.focus(), 0);
    }

    function closeRegularItemModal(){
      if (els.itemModal) els.itemModal.style.display = "none";
      itemModalState.productId = null;
    }

    function currentRegularItemFromModal(){
      const id = itemModalState.productId;
      if (!id) return null;
      return products.find((p) => p.id === id) || null;
    }

    function currentRegularAddonFromModal(){
      const product = currentRegularItemFromModal();
      if (!product) return { name: "Sem adicional", price: 0 };
      const options = addonOptionsForCategory(product.category);
      const idxRaw = Number.parseInt(String(els.itemAddon?.value || "0"), 10);
      const idx = Number.isFinite(idxRaw) ? idxRaw : 0;
      const chosen = options[idx] || options[0] || { name: "Sem adicional", price: 0 };
      return {
        name: normalizeAddonName(chosen?.name || "Sem adicional") || "Sem adicional",
        price: roundMoney(Math.max(0, Number(chosen?.price || 0))),
      };
    }

    function currentRegularItemNotesFromModal(){
      return buildRegularItemNotes(currentRegularAddonFromModal(), els.itemNotes?.value);
    }

    if (els.itemAdd) els.itemAdd.addEventListener("click", () => {
      const product = currentRegularItemFromModal();
      if (!product) return;
      const addon = currentRegularAddonFromModal();
      const notes = currentRegularItemNotesFromModal();
      addRegularProductToCart(product, notes, addon.price);
      closeRegularItemModal();
    });
    if (els.itemRemove) els.itemRemove.addEventListener("click", () => {
      const product = currentRegularItemFromModal();
      if (!product) return;
      const addon = currentRegularAddonFromModal();
      const notes = currentRegularItemNotesFromModal();
      removeRegularProductFromCart(product, notes, addon.price);
      closeRegularItemModal();
    });
    if (els.itemClose) els.itemClose.addEventListener("click", closeRegularItemModal);
    if (els.itemCancel) els.itemCancel.addEventListener("click", closeRegularItemModal);
    if (els.itemModal) els.itemModal.addEventListener("click", (e) => {
      if (e.target === els.itemModal) closeRegularItemModal();
    });

    els.products.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const card = e.target.closest(".prod");
      if (!card) return;

      const id = card.dataset.id;
      const p = products.find(x => x.id === id);
      if (!p) return;

      const action = btn.dataset.action;

      if (action === "add"){
        if (closingTableId){
          toast("Finalize a mesa antes de adicionar itens.", "info");
          return;
        }
        if (p.category === "pizzas"){
          openPizzaModal(p.id);
          return;
        }

        openRegularItemModal(p);
      }

      if (action === "edit"){
        if (!requireManager()) return;
        openProductModal("edit", p);
      }

      if (action === "del"){
        if (!requireManager()) return;
        deleteProduct(p.id);
      }
    });

    // ===== Checkout =====
    function parsePaymentAmountInput(value){
      const raw = String(value ?? "").trim();
      if (!raw) return NaN;
      const cleaned = raw.replace(/[^\d,.-]/g, "");
      if (!cleaned) return NaN;
      const hasComma = cleaned.includes(",");
      const hasDot = cleaned.includes(".");
      let normalized = cleaned;
      if (hasComma && hasDot){
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
      } else if (hasComma){
        normalized = cleaned.replace(",", ".");
      }
      const n = Number(normalized);
      return Number.isFinite(n) ? n : NaN;
    }

    function formatPaymentAmountInput(value){
      return roundMoney(value).toFixed(2).replace(".", ",");
    }

    function buildPaymentMethodOptions(selected){
      return Object.entries(PAYMENT_METHOD_LABELS)
        .map(([value, label]) => {
          const sel = value === selected ? " selected" : "";
          return `<option value="${escapeAttr(value)}"${sel}>${escapeHtml(label)}</option>`;
        })
        .join("");
    }

    function getSplitPeopleCount(){
      const raw = Number.parseInt(String(els.paymentSplitPeople?.value || "2"), 10);
      if (!Number.isFinite(raw)) return 2;
      return Math.min(20, Math.max(2, raw));
    }

    function syncSplitPeopleInput(){
      const count = getSplitPeopleCount();
      if (els.paymentSplitPeople) els.paymentSplitPeople.value = String(count);
      return count;
    }

    function splitTotalEvenly(totalTarget, peopleCount){
      const count = Math.max(2, Number(peopleCount || 2));
      const cents = Math.max(0, Math.round(roundMoney(totalTarget) * 100));
      const base = Math.floor(cents / count);
      let remainder = cents - (base * count);
      const amounts = [];
      for (let i = 0; i < count; i++){
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder -= 1;
        amounts.push((base + extra) / 100);
      }
      return amounts;
    }

    function getPaymentSplitTotal(){
      return roundMoney(paymentSplits.reduce((acc, split) => {
        const amount = parsePaymentAmountInput(split.amount);
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0));
    }

    function updatePaymentSplitHint(totalTarget){
      if (!els.paymentSplitHint) return;
      const target = roundMoney(totalTarget);
      const total = getPaymentSplitTotal();
      const mismatch = Math.abs(total - target) > 0.009;
      const peopleCount = syncSplitPeopleInput();
      const peopleMismatch = paymentSplits.length !== peopleCount;
      const fewSplits = paymentSplits.length < 2;

      let text = `${peopleCount} pessoas: ${brl(total)} de ${brl(target)}`;
      if (fewSplits || peopleMismatch) text += " • ajuste a quantidade de pessoas";
      else if (mismatch) text += " • ajuste os valores";

      els.paymentSplitHint.textContent = text;
      els.paymentSplitHint.classList.toggle("paymentSplitHintMismatch", mismatch || fewSplits || peopleMismatch);
    }

    function renderPaymentSplits(totalTarget){
      if (!els.paymentSplitList) return;
      if (paymentSplits.length === 0){
        els.paymentSplitList.innerHTML = `<div class="opsEmpty">Sem parcelas geradas.</div>`;
        updatePaymentSplitHint(totalTarget);
        return;
      }

      els.paymentSplitList.innerHTML = paymentSplits.map((split, idx) => {
        const method = String(split.method || "dinheiro").toLowerCase();
        const options = buildPaymentMethodOptions(method);
        const person = String(split.person_name || "");
        const amount = String(split.amount || "");
        return `
          <div class="paymentSplitRow" data-split-id="${escapeAttr(split.id)}">
            <input
              class="splitPerson"
              data-field="person_name"
              placeholder="Pessoa ${idx + 1}"
              value="${escapeAttr(person)}"
            />
            <select class="splitMethod" data-field="method">${options}</select>
            <input
              class="splitAmount"
              data-field="amount"
              inputmode="decimal"
              placeholder="0,00"
              value="${escapeAttr(amount)}"
            />
          </div>
        `;
      }).join("");

      updatePaymentSplitHint(totalTarget);
    }

    function seedPaymentSplits(totalTarget, peopleCount = syncSplitPeopleInput()){
      const count = Math.max(2, Number(peopleCount || 2));
      const preferred = String(els.paymentMethod?.value || "dinheiro").toLowerCase();
      const method = PAYMENT_METHOD_LABELS[preferred] ? preferred : "dinheiro";
      const amounts = splitTotalEvenly(totalTarget, count);
      paymentSplits = amounts.map((amount, idx) => ({
        id: uid(),
        person_name: `Pessoa ${idx + 1}`,
        method,
        amount: amount > 0 ? formatPaymentAmountInput(amount) : ""
      }));
    }

    function setSplitPaymentEnabled(enabled, totalTarget){
      if (els.paymentMethodSingleWrap){
        els.paymentMethodSingleWrap.style.display = enabled ? "none" : "grid";
      }
      if (els.paymentSplitWrap){
        els.paymentSplitWrap.style.display = enabled ? "grid" : "none";
      }
      if (enabled){
        if (paymentSplits.length === 0) seedPaymentSplits(totalTarget);
        renderPaymentSplits(totalTarget);
      }
    }

    function resetPaymentSplitState(totalTarget = 0){
      paymentSplits = [];
      if (els.paymentSplitToggle) els.paymentSplitToggle.checked = false;
      if (els.paymentSplitPeople) els.paymentSplitPeople.value = "2";
      setSplitPaymentEnabled(false, totalTarget);
      if (els.paymentSplitHint){
        const target = roundMoney(totalTarget);
        els.paymentSplitHint.textContent = `2 pessoas: ${brl(0)} de ${brl(target)}`;
        els.paymentSplitHint.classList.remove("paymentSplitHintMismatch");
      }
    }

    function getCheckoutPaymentMeta(){
      if (els.paymentSplitToggle?.checked) return "Dividido";
      const v = String(els.paymentMethod?.value || "");
      return paymentMethodLabel(v);
    }

    function normalizePaymentSplits(totalTarget){
      const target = roundMoney(totalTarget);
      if (paymentSplits.length < 2){
        throw new Error("Adicione ao menos 2 parcelas para usar pagamento dividido");
      }

      const normalized = paymentSplits.map((split, idx) => {
        const person = String(split.person_name || "").trim() || `Pessoa ${idx + 1}`;
        const method = String(split.method || "").trim().toLowerCase();
        if (!PAYMENT_METHOD_LABELS[method]){
          throw new Error(`Informe a forma de pagamento de ${person}`);
        }
        const amount = parsePaymentAmountInput(split.amount);
        if (!Number.isFinite(amount) || amount <= 0){
          throw new Error(`Informe um valor válido para ${person}`);
        }
        return { person_name: person, method, amount: roundMoney(amount) };
      });

      const sum = roundMoney(normalized.reduce((acc, split) => acc + split.amount, 0));
      if (Math.abs(sum - target) > 0.009){
        throw new Error(`A soma das parcelas (${brl(sum)}) precisa ser igual ao total (${brl(target)})`);
      }
      return normalized;
    }

    function resolveCheckoutPayment(payNow, totalTarget){
      if (!payNow) return { payment_method: "", payment_splits: [] };

      const splitEnabled = !!els.paymentSplitToggle?.checked;
      if (!splitEnabled){
        const payment = String(els.paymentMethod?.value || "").trim();
        if (!payment) throw new Error("Informe o pagamento");
        return { payment_method: payment, payment_splits: [] };
      }

      const splits = normalizePaymentSplits(totalTarget);
      const methods = Array.from(new Set(splits.map((split) => split.method)))
        .map((method) => paymentMethodLabel(method))
        .join(" + ");
      return {
        payment_method: `dividido (${methods || "misto"})`,
        payment_splits: splits
      };
    }

    function calcTotals(){
      let subtotal = 0;
      for (const it of cart.values()) subtotal += it.unit_price * it.qty;
      const discount = 0;
      const fee = 0;
      const total = Math.max(0, subtotal - discount + fee);
      return { subtotal, discount, fee, total };
    }

    function unlockCheckoutFields(){
      const fields = [
        els.orderType, els.tableNo, els.custName, els.custPhone,
        els.custAddress, els.orderNotes, els.paymentMethod, els.paymentSplitToggle, els.paymentSplitPeople
      ];
      for (const f of fields){
        if (!f) continue;
        f.disabled = false;
        f.readOnly = false;
      }
      if (els.checkoutConfirm) els.checkoutConfirm.disabled = false;
    }

    function forceEnableCheckoutModal(){
      if (!els.checkoutModal) return;
      els.checkoutModal.style.pointerEvents = "auto";
      const modalBox = els.checkoutModal.querySelector(".modal");
      if (modalBox) modalBox.style.pointerEvents = "auto";
      const all = els.checkoutModal.querySelectorAll("input, select, textarea, button");
      all.forEach(el => {
        el.disabled = false;
        el.readOnly = false;
        el.removeAttribute("disabled");
        el.removeAttribute("readonly");
      });
    }

    function resetCheckoutState(){
      closingTableId = null;
      closingTableIds = null;
      resetPaymentSplitState(calcTotals().total);
      unlockCheckoutFields();
      forceEnableCheckoutModal();
      updatePaymentVisibility();
      if (els.checkoutConfirm) els.checkoutConfirm.innerHTML = "Salvar e Imprimir";
      if (els.checkoutModal) els.checkoutModal.style.display = "none";
    }

    function clearCheckoutInvalid(){
      [els.orderType, els.tableNo, els.custName, els.custPhone, els.custAddress].forEach(el => {
        if (el) el.classList.remove("invalid");
      });
    }

    function onlyDigits(s){ return String(s || "").replace(/\D/g, ""); }
    function isValidPhone(phone){
      const d = onlyDigits(phone);
      return d.length >= 10;
    }

    function validateCheckout(){
      clearCheckoutInvalid();
      const type = els.orderType.value;
      const table = els.tableNo.value.trim();
      const name = els.custName.value.trim();
      const phone = els.custPhone.value.trim();
      const address = els.custAddress.value.trim();

      if (type === "mesa"){
        if (!table){
          els.tableNo.classList.add("invalid");
          els.tableNo.focus();
          toast("Informe a mesa.", "error");
          return false;
        }
        return true;
      }

      if (!name){
        els.custName.classList.add("invalid");
        els.custName.focus();
        toast("Informe o nome do cliente.", "error");
        return false;
      }

      if (!phone){
        els.custPhone.classList.add("invalid");
        els.custPhone.focus();
        toast("Informe o telefone.", "error");
        return false;
      }

      if (!isValidPhone(phone)){
        els.custPhone.classList.add("invalid");
        els.custPhone.focus();
        toast("Telefone inválido.", "error");
        return false;
      }

      if (type === "entrega" && !address){
        els.custAddress.classList.add("invalid");
        els.custAddress.focus();
        toast("Informe o endereço.", "error");
        return false;
      }

      return true;
    }

    function closeOtherModals(){
      if (els.productModal) els.productModal.style.display = "none";
      if (els.pizzaModal) els.pizzaModal.style.display = "none";
      if (els.itemModal) closeRegularItemModal();
      if (els.opsTablesModal) els.opsTablesModal.style.display = "none";
      if (els.opsKitchenModal) els.opsKitchenModal.style.display = "none";
      if (els.deliveryModal) els.deliveryModal.style.display = "none";
      if (els.managerLoginModal) els.managerLoginModal.style.display = "none";
      if (els.salesModal) els.salesModal.style.display = "none";
      if (els.confirmModal) els.confirmModal.style.display = "none";
      if (els.reportsModal) els.reportsModal.style.display = "none";
      if (els.systemModal) els.systemModal.style.display = "none";
      if (els.addonModal) els.addonModal.style.display = "none";
      closeAddonEditModal();
      if (els.categoryModal) els.categoryModal.style.display = "none";
      if (els.emojiModal) els.emojiModal.style.display = "none";
      if (els.printModal) els.printModal.style.display = "none";
      if (typeof opsPoll !== "undefined" && opsPoll){
        clearInterval(opsPoll);
        opsPoll = null;
      }
      if (typeof deliveryPoll !== "undefined" && deliveryPoll){
        clearInterval(deliveryPoll);
        deliveryPoll = null;
      }
    }

    function openCheckout(){
      closeOtherModals();
      clearCheckoutInvalid();
      unlockCheckoutFields();
      forceEnableCheckoutModal();
      const t = calcTotals();
      els.checkoutTotal.value = brl(t.total);
      els.checkoutModal.style.display = "flex";
      updatePaymentVisibility();
      els.custName.focus();
    }

    function closeCheckout(){
      els.checkoutModal.style.display = "none";
      unlockCheckoutFields();
    }

    els.finishBtn.addEventListener("click", () => {
      if (cart.size === 0){ toast("Carrinho vazio 😅", "info"); return; }
      openCheckout();
    });

    els.checkoutClose.addEventListener("click", closeCheckout);
    els.checkoutCancel.addEventListener("click", closeCheckout);
    els.checkoutModal.addEventListener("click", (e) => { if (e.target === els.checkoutModal) closeCheckout(); });

    if (els.printClose) els.printClose.addEventListener("click", closePrintModal);
    if (els.printModal) els.printModal.addEventListener("click", (e) => { if (e.target === els.printModal) closePrintModal(); });
    if (els.printDo) els.printDo.addEventListener("click", () => {
      const frame = document.getElementById("printFrame");
      if (frame?.contentWindow){
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }
    });

    if (els.backupRestoreBtn) els.backupRestoreBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      restoreAutoBackup(1);
    });

    function openSalesModal(){
      if (!els.salesModal) return;
      if (!requireManager()) return;
      closeOtherModals();
      if (els.salesDate && !els.salesDate.value) {
        els.salesDate.value = todayISODate();
      }
      loadSalesData();
      els.salesModal.style.display = "flex";
    }

    function closeSalesModal(){
      if (els.salesModal) els.salesModal.style.display = "none";
    }

    async function loadSalesData(){
      if (!els.salesList || !els.salesDate) return;
      const date = els.salesDate.value || todayISODate();
      try{
        setButtonLoading(els.salesRefresh, true);
        const resp = await fetch(`/api/orders/day?date=${encodeURIComponent(date)}`);
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao carregar vendas");
        renderSalesList(data?.rows || []);
      } catch (e){
        els.salesList.innerHTML = `<div class="opsEmpty">Falha ao carregar vendas</div>`;
        logError("Falha ao carregar vendas", e);
      } finally {
        setButtonLoading(els.salesRefresh, false);
      }
    }

    function renderSalesList(rows){
      if (!rows || rows.length === 0){
        els.salesList.innerHTML = `<div class="opsEmpty">Nenhuma venda no dia</div>`;
        return;
      }
      els.salesList.innerHTML = `<div class="opsList">${
        rows.map(r => {
          const total = brl(Number(r.total || 0));
          const status = String(r.status || "").toUpperCase() || "OK";
          const type = prettyType(r.order_type);
          const mesa = r.table_no ? `Mesa ${r.table_no}` : "-";
          const customer = r.customer_name || "-";
          const meta = `#${r.order_number} • ${type} • ${mesa} • ${fmtDateTime(r.created_at)}`;
          return `
            <div class="opsItem">
              <div>
                <div class="opsTitle">${escapeHtml(meta)}</div>
                <div class="opsMeta">Cliente: ${escapeHtml(customer)} • Total ${escapeHtml(total)} • ${escapeHtml(status)}</div>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="miniBtn" type="button" data-action="edit-sale" data-id="${escapeHtml(String(r.id))}">Editar</button>
                <button class="miniBtn danger" type="button" data-action="cancel-sale" data-id="${escapeHtml(String(r.id))}">Cancelar</button>
              </div>
            </div>
          `;
        }).join("")
      }</div>`;
    }

    let activeSaleEditId = null;

    function openSaleEditForm(order){
      if (!els.salesEditCard) return;
      activeSaleEditId = Number(order.id);
      els.salesEditType.value = order.order_type || "retirada";
      els.salesEditTable.value = order.table_no || "";
      els.salesEditName.value = order.customer_name || "";
      els.salesEditPhone.value = order.customer_phone || "";
      els.salesEditAddress.value = order.address || "";
      els.salesEditNotes.value = order.notes || "";
      els.salesEditPayment.value = order.payment_method || "";
      els.salesEditCard.style.display = "block";
    }

    function closeSaleEditForm(){
      activeSaleEditId = null;
      if (els.salesEditCard) els.salesEditCard.style.display = "none";
    }

    if (els.salesClose) els.salesClose.addEventListener("click", closeSalesModal);
    if (els.salesModal) els.salesModal.addEventListener("click", (e) => { if (e.target === els.salesModal) closeSalesModal(); });
    if (els.salesRefresh) els.salesRefresh.addEventListener("click", loadSalesData);
    if (els.salesDate) els.salesDate.addEventListener("change", loadSalesData);
    if (els.salesEditCancel) els.salesEditCancel.addEventListener("click", closeSaleEditForm);
    if (els.salesEditSave) els.salesEditSave.addEventListener("click", async () => {
      if (!activeSaleEditId) return;
      try{
        setButtonLoading(els.salesEditSave, true);
        const payload = {
          order_type: els.salesEditType.value,
          table_no: els.salesEditTable.value.trim(),
          customer_name: els.salesEditName.value.trim(),
          customer_phone: els.salesEditPhone.value.trim(),
          address: els.salesEditAddress.value.trim(),
          notes: els.salesEditNotes.value.trim(),
          payment_method: els.salesEditPayment.value
        };
        const resp = await fetch(`/api/orders/${activeSaleEditId}/update`, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao salvar");
        toast("Venda atualizada.", "success");
        closeSaleEditForm();
        loadSalesData();
      } catch (e){
        toast("Falha ao salvar: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.salesEditSave, false);
      }
    });

    if (els.salesList) els.salesList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      const action = btn.dataset.action;
      if (action === "edit-sale"){
        try{
          const resp = await fetch(`/api/orders/${id}`);
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro");
          openSaleEditForm(data.order || {});
        } catch (e){
          toast("Falha ao carregar venda: " + e.message, "error", { detail: e?.stack || e?.message });
        }
        return;
      }
      if (action === "cancel-sale"){
        const ok = confirm("Cancelar esta venda? Essa ação não remove itens do histórico.");
        if (!ok) return;
        try{
          setButtonLoading(btn, true);
          const resp = await fetch(`/api/orders/${id}/cancel`, { method:"POST" });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao cancelar");
          toast("Venda cancelada.", "success");
          loadSalesData();
        } catch (e){
          toast("Falha ao cancelar: " + e.message, "error", { detail: e?.stack || e?.message });
        } finally {
          setButtonLoading(btn, false);
        }
      }
    });

    let confirmResolve = null;
    function openConfirmModal({ title = "Confirmação", message = "Tem certeza?" } = {}){
      return new Promise((resolve) => {
        confirmResolve = resolve;
        if (els.confirmTitle) els.confirmTitle.textContent = title;
        if (els.confirmMessage) els.confirmMessage.textContent = message;
        if (els.confirmModal) els.confirmModal.style.display = "flex";
      });
    }
    function closeConfirmModal(result = false){
      if (els.confirmModal) els.confirmModal.style.display = "none";
      if (confirmResolve){
        confirmResolve(result);
        confirmResolve = null;
      }
    }

    if (els.confirmClose) els.confirmClose.addEventListener("click", () => closeConfirmModal(false));
    if (els.confirmCancel) els.confirmCancel.addEventListener("click", () => closeConfirmModal(false));
    if (els.confirmOk) els.confirmOk.addEventListener("click", () => closeConfirmModal(true));
    if (els.confirmModal) els.confirmModal.addEventListener("click", (e) => {
      if (e.target === els.confirmModal) closeConfirmModal(false);
    });
    if (els.printSave) els.printSave.addEventListener("click", () => {
      const frame = document.getElementById("printFrame");
      if (frame?.contentWindow){
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }
    });

    function closeAnyModal(){
      if (els.checkoutModal && els.checkoutModal.style.display === "flex"){
        closeCheckout();
        return true;
      }
      if (els.printModal && els.printModal.style.display === "flex"){
        closePrintModal();
        return true;
      }
      if (els.productModal && els.productModal.style.display === "flex"){
        els.productModal.style.display = "none";
        return true;
      }
      if (els.pizzaModal && els.pizzaModal.style.display === "flex"){
        closePizzaModal();
        return true;
      }
      if (els.itemModal && els.itemModal.style.display === "flex"){
        closeRegularItemModal();
        return true;
      }
      if (els.opsTablesModal && els.opsTablesModal.style.display === "flex"){
        closeOpsTablesModal();
        return true;
      }
      if (els.opsKitchenModal && els.opsKitchenModal.style.display === "flex"){
        closeOpsKitchenModal();
        return true;
      }
      if (els.deliveryModal && els.deliveryModal.style.display === "flex"){
        closeDeliveryModal();
        return true;
      }
      if (els.salesModal && els.salesModal.style.display === "flex"){
        closeSalesModal();
        return true;
      }
      if (els.confirmModal && els.confirmModal.style.display === "flex"){
        closeConfirmModal();
        return true;
      }
      if (els.managerLoginModal && els.managerLoginModal.style.display === "flex"){
        closeManagerLoginModal();
        return true;
      }
      if (els.reportsModal && els.reportsModal.style.display === "flex"){
        closeReportsModal();
        return true;
      }
      if (els.addonEditModal && els.addonEditModal.style.display === "flex"){
        closeAddonEditModal();
        return true;
      }
      if (els.addonModal && els.addonModal.style.display === "flex"){
        closeAddonManager();
        return true;
      }
      if (els.systemModal && els.systemModal.style.display === "flex"){
        closeSystemModal();
        return true;
      }
      if (els.categoryModal && els.categoryModal.style.display === "flex"){
        closeCategoryModal();
        return true;
      }
      if (els.emojiModal && els.emojiModal.style.display === "flex"){
        closeEmojiModal();
        return true;
      }
      return false;
    }

    // ===== Atalhos (F2, F4, Esc, Ctrl+P) =====
    document.addEventListener("keydown", (e) => {
      const key = e.key;
      const isCtrlP = (e.ctrlKey || e.metaKey) && key.toLowerCase() === "p";

      if (isCtrlP){
        e.preventDefault();
        reprintLastOrder();
        return;
      }

      if (!e.altKey && key === "F2"){
        e.preventDefault();
        if (els.checkoutModal && els.checkoutModal.style.display === "flex"){
          if (els.checkoutConfirm && !els.checkoutConfirm.disabled) els.checkoutConfirm.click();
          return;
        }
        if (cart.size === 0){ toast("Carrinho vazio 😅", "info"); return; }
        openCheckout();
        return;
      }

      if (!e.altKey && key === "F4"){
        e.preventDefault();
        if (els.searchInput){
          els.searchInput.focus();
          els.searchInput.select?.();
        }
        return;
      }

      if (key === "Escape"){
        if (closeAnyModal()) e.preventDefault();
      }
    });

    function updatePaymentVisibility(){
      const isMesa = els.orderType.value === "mesa";
      const needsPay = (!isMesa) || (closingTableId !== null);
      const totalTarget = calcTotals().total;
      const compactCheckout = window.matchMedia("(max-width: 560px)").matches;

      if (els.paymentBlock && els.paymentRow){
        els.paymentBlock.style.display = needsPay ? "grid" : "none";
        els.paymentRow.style.gridTemplateColumns = needsPay
          ? (compactCheckout ? "1fr" : "minmax(0,1fr) 170px")
          : "1fr";
      }

      if (!needsPay){
        if (els.paymentSplitToggle) els.paymentSplitToggle.checked = false;
        setSplitPaymentEnabled(false, totalTarget);
        els.metaPay.textContent = "A pagar";
      } else {
        const splitEnabled = !!els.paymentSplitToggle?.checked;
        setSplitPaymentEnabled(splitEnabled, totalTarget);
        els.metaPay.textContent = getCheckoutPaymentMeta();
      }
    }

    // Atualiza meta tags no carrinho (só visual)
    els.orderType.addEventListener("change", () => {
      els.metaType.textContent = els.orderType.value.charAt(0).toUpperCase() + els.orderType.value.slice(1);
      updatePaymentVisibility();
    });
    els.paymentMethod.addEventListener("change", () => {
      if (els.paymentSplitToggle?.checked) return;
      els.metaPay.textContent = getCheckoutPaymentMeta();
    });
    if (els.paymentSplitToggle) els.paymentSplitToggle.addEventListener("change", () => {
      if (els.paymentSplitToggle.checked){
        const totalTarget = calcTotals().total;
        seedPaymentSplits(totalTarget, syncSplitPeopleInput());
      }
      updatePaymentVisibility();
    });
    if (els.paymentSplitPeople) els.paymentSplitPeople.addEventListener("change", () => {
      const count = syncSplitPeopleInput();
      if (!els.paymentSplitToggle?.checked) return;
      seedPaymentSplits(calcTotals().total, count);
      renderPaymentSplits(calcTotals().total);
      els.metaPay.textContent = getCheckoutPaymentMeta();
    });
    if (els.paymentSplitPeople) els.paymentSplitPeople.addEventListener("input", () => {
      syncSplitPeopleInput();
    });
    if (els.paymentSplitList) els.paymentSplitList.addEventListener("input", (e) => {
      const input = e.target.closest("[data-field]");
      if (!input) return;
      const row = input.closest(".paymentSplitRow");
      if (!row) return;
      const id = String(row.dataset.splitId || "");
      const split = paymentSplits.find((item) => item.id === id);
      if (!split) return;
      const field = String(input.dataset.field || "");
      if (field === "person_name") split.person_name = input.value;
      if (field === "amount") split.amount = input.value;
      if (field === "method") split.method = input.value;
      updatePaymentSplitHint(calcTotals().total);
    });
    if (els.paymentSplitList) els.paymentSplitList.addEventListener("change", (e) => {
      const select = e.target.closest("select[data-field='method']");
      if (!select) return;
      const row = select.closest(".paymentSplitRow");
      if (!row) return;
      const id = String(row.dataset.splitId || "");
      const split = paymentSplits.find((item) => item.id === id);
      if (!split) return;
      split.method = select.value;
      updatePaymentSplitHint(calcTotals().total);
    });
    window.addEventListener("resize", updatePaymentVisibility);

    // Salvar e imprimir
    els.checkoutConfirm.addEventListener("click", async () => {
      if (cart.size === 0){ toast("Carrinho vazio 😅", "info"); return; }
      if (!validateCheckout()) return;

      try{
        const totals = calcTotals();
        const isMesa = els.orderType.value === "mesa";
        const payNow = (!isMesa) || (closingTableId !== null);
        const paymentData = resolveCheckoutPayment(payNow, totals.total);

        const payload = {
          order_type: els.orderType.value,
          table_no: els.tableNo.value.trim(),
          customer_name: els.custName.value.trim(),
          customer_phone: els.custPhone.value.trim(),
          address: els.custAddress.value.trim(),
          notes: els.orderNotes.value.trim(),

          payment_method: paymentData.payment_method,
          payment_splits: paymentData.payment_splits,
          totals,

          items: Array.from(cart.values()).map(it => ({
            name: it.name,
            qty: it.qty,
            unit_price: it.unit_price,
            notes: it.notes || "",
            is_kitchen: !!it.is_kitchen
          }))
        };

        setButtonLoading(els.checkoutConfirm, true, "Salvando...");

        if (closingTableId){
          if (!paymentData.payment_method) throw new Error("Informe o pagamento para fechar a mesa");

          const ids = (Array.isArray(closingTableIds) && closingTableIds.length)
            ? closingTableIds
            : [closingTableId];
          let lastId = closingTableId;

          for (const id of ids){
            const resp = await fetch(`/api/orders/${id}/finalize`, {
              method:"POST",
              headers:{ "Content-Type":"application/json" },
              body: JSON.stringify({
                order_type: payload.order_type,
                table_no: payload.table_no,
                customer_name: payload.customer_name,
                customer_phone: payload.customer_phone,
                address: payload.address,
                notes: payload.notes,
                payment_method: paymentData.payment_method,
                payment_splits: paymentData.payment_splits
              })
            });

            const data = await readJsonSafe(resp);
            if (!resp.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${resp.status}`);
            if (!data) throw new Error("Resposta vazia do servidor.");
            lastId = id;
          }

          closeCheckout();
          setLastOrderId(lastId);
          openPrintUrl(`/api/orders/${lastId}/print?prices=1`);

          closingTableId = null;
          closingTableIds = null;
          updatePaymentVisibility();
          cart.clear();
          renderCart();
          resetPaymentSplitState(0);
        } else {
          const resp = await fetch("/api/orders", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify(payload)
          });

          const data = await readJsonSafe(resp);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${resp.status}`);
          if (!data) throw new Error("Resposta vazia do servidor.");

          closeCheckout();
          setLastOrderId(data.order_id);
          openPrintUrl(`/api/orders/${data.order_id}/print?prices=1`);

          cart.clear();
          renderCart();
          resetPaymentSplitState(0);
        }

      } catch (e){
        toast("Erro ao salvar/imprimir: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.checkoutConfirm, false);
      }
    });

    // ===== Caixa: abrir/fechar + relatório =====
    els.cashPill.addEventListener("click", async () => {
      if (!requireManager()) return;
      if (els.cashPill.classList.contains("loading")) return;

      if (shiftState.open){
        const ok = confirm("Tem certeza que deseja FECHAR o caixa e gerar relatório?");
        if (!ok) return;
        setBusy(els.cashPill, true);

        try{
          const resp = await fetch("/api/cash/close", { method:"POST" });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao fechar caixa");

          shiftState.open = false;
          saveShift();
          renderShift();
          resetCheckoutState();

          openPrintUrl("/api/cash/report/print");
          toast("Caixa fechado com sucesso.", "success");
        } catch (e){
          toast("Falha ao fechar caixa: " + e.message, "error", { detail: e?.stack || e?.message });
        } finally {
          setBusy(els.cashPill, false);
        }
      } else {
        const ok = confirm("Deseja ABRIR o caixa novamente?");
        if (!ok) return;
        setBusy(els.cashPill, true);

        try{
          const resp = await fetch("/api/cash/open", { method:"POST" });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao abrir caixa");

          shiftState.open = true;
          saveShift();
          renderShift();
          resetCheckoutState();
          toast("Caixa aberto com sucesso.", "success");
        } catch (e){
          toast("Falha ao abrir caixa: " + e.message, "error", { detail: e?.stack || e?.message });
        } finally {
          setBusy(els.cashPill, false);
        }
      }
    });

    // ===== IMPORTAÇÃO XML =====
    function parseNumberFlexible(s){
      const norm = String(s ?? "").trim().replace(",", ".");
      const n = Number(norm);
      return Number.isFinite(n) ? n : NaN;
    }

    function parseMenuXml(xmlText){
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "application/xml");

      if (doc.querySelector("parsererror")) {
        throw new Error("XML inválido (verifique as tags).");
      }

      const nodes = Array.from(doc.querySelectorAll("cardapio > produto"));
      if (!nodes.length) throw new Error("Nenhum <produto> encontrado em <cardapio>.");

      const imported = [];

      for (const n of nodes){
        const get = (selector) => (n.querySelector(selector)?.textContent ?? "").trim();
        const name = get("nome");
        const rawCategory = (get("categoria") || "").trim();
        const category = normalizeCategoryId(rawCategory);
        const emoji = get("emoji") || (category === "pizzas" ? "🍕" : "🧾");
        const desc = get("descricao");
        const cozinhaTxt = (get("cozinha") || "").toLowerCase();
        const isKitchen = (cozinhaTxt === "" ? (category === "pizzas") : (cozinhaTxt === "true" || cozinhaTxt === "1" || cozinhaTxt === "sim"));

        if (!name) continue;
        if (!category) continue;

        if (!categories.find(c => c.id === category)){
          const label = rawCategory || prettyCatLabel(category);
          categories.push({ id: category, label, emoji: guessCategoryEmoji(label) });
          saveCategories(categories);
        }

        if (category === "pizzas"){
          const broto = parseNumberFlexible(get("precos > broto") || get("precos > p"));
          const normal = parseNumberFlexible(get("precos > normal") || get("precos > m") || get("precos > g"));
          if (![broto, normal].every(v => Number.isFinite(v) && v >= 0)) continue;

          imported.push({
            id: uid(),
            name, category, emoji, desc,
            priceP: broto, priceM: normal,
            isKitchen
          });
        } else {
          const price = parseNumberFlexible(get("preco"));
          if (!Number.isFinite(price) || price < 0) continue;

          imported.push({
            id: uid(),
            name, category, emoji, desc,
            price,
            isKitchen
          });
        }
      }

      if (!imported.length) throw new Error("Nenhum produto válido encontrado no XML.");
      return imported;
    }

    function mergeProducts(existing, incoming){
      const out = [...existing];

      for (const inc of incoming){
        const idx = out.findIndex(p =>
          (p.category === inc.category) &&
          (String(p.name||"").trim().toLowerCase() === String(inc.name||"").trim().toLowerCase())
        );

        if (idx >= 0){
          out[idx] = { ...out[idx], ...inc, id: out[idx].id };
        } else {
          out.unshift(inc);
        }
      }
      return out;
    }

    els.importXmlBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      els.xmlFileInput.value = "";
      els.xmlFileInput.click();
    });

    els.xmlFileInput.addEventListener("change", async () => {
      const file = els.xmlFileInput.files?.[0];
      if (!file) return;
      if (!requireManager()) return;

      try{
        setButtonLoading(els.importXmlBtn, true);
        const text = await file.text();
        const imported = parseMenuXml(text);

        const mode = confirm(
          `Importar ${imported.length} itens.\n\nOK = Mesclar/atualizar (recomendado)\nCancelar = Substituir tudo`
        );

        products = mode ? mergeProducts(products, imported) : imported;
        saveProducts(products);

        // se trocar tudo, mantém a categoria atual e atualiza
        ensureCategoriesFromProducts();
        renderCategoryTabs();
        renderCategorySelect();
        syncTabs();
        renderProducts();
        toast(`Importação concluída ✅ (${imported.length} itens)`, "success");
      } catch (e){
        toast("Falha ao importar XML: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.importXmlBtn, false);
      }
    });

    // ===== Init =====
    ensureCategoriesFromProducts();
    renderCategorySelect();
    renderCategoryTabs();
    refreshAddonManager();
    syncTabs();
    renderProducts();
    renderCart();
    if (els.metaType) els.metaType.textContent = prettyType(els.orderType?.value || "entrega");
    updatePaymentVisibility();
    renderRole();
    updateBackupHint();
    scheduleAutoBackup();
    lockSignaturePosition();
    removeSignatureBackground();
    if (window.__MVS_DEMO_STORAGE) {
      toast("Modo demo em storage local ativo (sem SQLite).", "info", { timeout: 4800 });
    }
  
