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

    const AUTO_CASH_CLOSE_MARK_KEY = "mvs_auto_cash_close_mark_v1";

    function getAutoCashCloseMark(){
      try{
        return String(localStorage.getItem(AUTO_CASH_CLOSE_MARK_KEY) || "");
      } catch {
        return "";
      }
    }

    function setAutoCashCloseMark(day){
      try{
        localStorage.setItem(AUTO_CASH_CLOSE_MARK_KEY, String(day || ""));
      } catch {
        // ignore storage failures
      }
    }

    async function runAutoCashCloseNow(){
      try{
        const statusResp = await fetch("/api/cash/status");
        const statusData = await statusResp.json().catch(() => null);
        if (!statusResp.ok || statusData?.ok === false){
          throw new Error(statusData?.error || "Erro ao consultar status do caixa");
        }
        const isOpen = String(statusData?.cash_status || "").toUpperCase() === "ABERTO";
        if (!isOpen){
          return { ok: true, closed: false };
        }

        const closeResp = await fetch("/api/cash/close", { method: "POST" });
        const closeData = await closeResp.json().catch(() => null);
        if (!closeResp.ok || closeData?.ok === false){
          throw new Error(closeData?.error || "Erro ao fechar caixa automaticamente");
        }

        syncCashFromServer();
        loadDiagnostics();
        if (typeof loadExpensesData === "function"){
          loadExpensesData({ silent: true });
        }
        logEvent("info", "Fechamento automático do caixa", "Executado às 00:50");
        toast("Caixa fechado automaticamente (00:50).", "success");
        return { ok: true, closed: true };
      } catch (e){
        logEvent("error", "Falha no fechamento automático do caixa", e?.message || String(e));
        return { ok: false, closed: false, error: e };
      }
    }

    async function runDailyAutoCashCloseIfDue(){
      const now = new Date();
      const today = localDateISO(now);
      const targetToday = new Date(now);
      targetToday.setHours(0, 50, 0, 0);

      if (now < targetToday) return;
      if (getAutoCashCloseMark() === today) return;

      const result = await runAutoCashCloseNow();
      if (result?.ok){
        setAutoCashCloseMark(today);
      }
    }

    function scheduleAutoCashClose(){
      runDailyAutoCashCloseIfDue();

      const now = new Date();
      const target = new Date(now);
      target.setHours(0, 50, 0, 0);
      if (now >= target){
        target.setDate(target.getDate() + 1);
      }

      const delay = Math.max(1000, target.getTime() - now.getTime());
      setTimeout(async () => {
        await runAutoCashCloseNow().then((result) => {
          if (result?.ok){
            setAutoCashCloseMark(localDateISO(new Date()));
          }
        });
        scheduleAutoCashClose();
      }, delay);
    }

    const PRINT_SETTINGS_KEY = "mvs_print_settings_v1";
    const DEFAULT_PRINT_SETTINGS = Object.freeze({
      mode: "preview",
      printer_name: "",
      auto_order_print: false,
    });

    function normalizePrintSettings(raw){
      const source = (raw && typeof raw === "object") ? raw : {};
      const mode = String(source.mode || DEFAULT_PRINT_SETTINGS.mode).trim().toLowerCase() === "auto_browser"
        ? "auto_browser"
        : "preview";
      return {
        mode,
        printer_name: String(source.printer_name || "").trim(),
        auto_order_print: !!source.auto_order_print,
      };
    }

    function loadPrintSettings(){
      try{
        const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
        return normalizePrintSettings(raw ? JSON.parse(raw) : DEFAULT_PRINT_SETTINGS);
      } catch {
        return { ...DEFAULT_PRINT_SETTINGS };
      }
    }

    let printSettings = loadPrintSettings();

    function savePrintSettings(nextSettings){
      printSettings = normalizePrintSettings(nextSettings);
      try{
        localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(printSettings));
      } catch {
        // ignore persistence failures
      }
      renderPrinterSettingsUi();
      return printSettings;
    }

    function printerModeLabel(mode = printSettings.mode){
      return mode === "auto_browser"
        ? "Automática (impressora padrão do Windows)"
        : "Pré-visualização manual";
    }

    function printerDisplayName(settings = printSettings){
      const name = String(settings?.printer_name || "").trim();
      if (name) return name;
      return settings?.mode === "auto_browser" ? "Padrão do Windows" : "Pré-visualização manual";
    }

    function shouldAutoPrintOrders(){
      return printSettings.mode === "auto_browser" && !!printSettings.auto_order_print;
    }

    function renderPrinterStatus(settings = printSettings){
      if (els.printerStatus){
        const autoLabel = settings.mode === "auto_browser" && settings.auto_order_print ? "Ativada" : "Desligada";
        els.printerStatus.textContent = [
          `Modo: ${printerModeLabel(settings.mode)}`,
          `Impressora: ${printerDisplayName(settings)}`,
          `Autoimpressão de pedidos: ${autoLabel}`,
        ].join("\n");
      }
    }

    function previewPrinterSettingsFromUi(){
      return normalizePrintSettings({
        mode: els.printerModeSelect?.value,
        printer_name: els.printerNameInput?.value,
        auto_order_print: !!els.printerAutoToggle?.checked,
      });
    }

    function renderPrinterSettingsUi(){
      if (els.printerModeSelect) els.printerModeSelect.value = printSettings.mode;
      if (els.printerNameInput) els.printerNameInput.value = printSettings.printer_name || "";
      if (els.printerAutoToggle) els.printerAutoToggle.checked = !!printSettings.auto_order_print;
      renderPrinterStatus(printSettings);
    }

    function savePrinterSettingsFromUi(){
      if (!requireManager()) return;
      const next = savePrintSettings({
        mode: String(els.printerModeSelect?.value || DEFAULT_PRINT_SETTINGS.mode),
        printer_name: String(els.printerNameInput?.value || "").trim(),
        auto_order_print: !!els.printerAutoToggle?.checked,
      });
      toast(`Configuração de impressão salva: ${printerModeLabel(next.mode)}.`, "success");
      loadDiagnostics();
    }

    function buildPrinterTestHtml(){
      const when = new Date().toLocaleString("pt-BR");
      const printerName = printerDisplayName(printSettings);
      return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Teste de Impressão</title>
  <style>
    @page{ size: 80mm auto; margin:4mm; }
    body{
      font-family:"Courier New", Courier, monospace;
      margin:0 auto;
      width:72mm;
      color:#111;
      font-size:11px;
      line-height:1.3;
    }
    h1{margin:0 0 8px 0;font-size:14px}
    .box{border:1px solid #ddd;border-radius:6px;padding:8px;margin:8px 0}
    .row{display:flex;justify-content:space-between;gap:8px}
    .amount{white-space:nowrap}
  </style>
</head>
<body>
  <h1>Teste de Impressão</h1>
  <div class="box">
    <div><b>Data:</b> ${escapeHtml(when)}</div>
    <div><b>Modo:</b> ${escapeHtml(printerModeLabel(printSettings.mode))}</div>
    <div><b>Impressora:</b> ${escapeHtml(printerName)}</div>
  </div>
  <div class="box">
    <div class="row"><span>Item teste</span><span class="amount">R$ 2,90</span></div>
    <div class="row"><span>Valor total</span><span class="amount"><b>R$ 2,90</b></span></div>
  </div>
</body>
</html>
      `.trim();
    }

    function autoPrintHtmlBestEffort(html){
      return new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.position = "fixed";
        frame.style.right = "-10000px";
        frame.style.bottom = "0";
        frame.style.width = "1px";
        frame.style.height = "1px";
        frame.style.opacity = "0";
        frame.style.pointerEvents = "none";

        let finished = false;
        const cleanup = () => {
          window.setTimeout(() => frame.remove(), 300);
        };
        const done = (error = null) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        };

        frame.addEventListener("load", () => {
          const win = frame.contentWindow;
          if (!win){
            done(new Error("Pré-visualização indisponível para imprimir."));
            return;
          }
          try{
            win.onafterprint = () => done();
            window.setTimeout(() => {
              try{
                win.focus();
                win.print();
                window.setTimeout(() => done(), 1800);
              } catch (err){
                done(err instanceof Error ? err : new Error(String(err || "Falha ao imprimir")));
              }
            }, 120);
          } catch (err){
            done(err instanceof Error ? err : new Error(String(err || "Falha ao preparar impressão")));
          }
        }, { once: true });

        document.body.appendChild(frame);
        frame.srcdoc = html;
      });
    }

    async function fetchPrintHtml(url){
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      if (!html) throw new Error("Resposta vazia do servidor.");
      return html;
    }

    async function openPrintUrlSmart(url, opts = {}){
      const html = await fetchPrintHtml(url);
      const shouldAuto = !!opts.auto && shouldAutoPrintOrders();
      if (!shouldAuto){
        openPrintModal(html);
        return { auto: false };
      }
      try{
        await autoPrintHtmlBestEffort(html);
        toast("Impressão enviada automaticamente.", "success");
        return { auto: true };
      } catch (e){
        openPrintModal(html);
        toast("Não foi possível enviar direto para a impressora. Abrindo pré-visualização.", "info");
        return { auto: false, fallback: true, error: e };
      }
    }

    async function testPrinterOutput(){
      const html = buildPrinterTestHtml();
      if (printSettings.mode === "auto_browser"){
        try{
          await autoPrintHtmlBestEffort(html);
          toast("Teste enviado para impressão.", "success");
          return;
        } catch (e){
          openPrintModal(html);
          toast("Falha no envio automático. Pré-visualização aberta para conferência.", "info");
          return;
        }
      }
      openPrintModal(html);
    }

    async function loadDiagnostics(){
      if (!els.diagInfo) return;
      setButtonLoading(els.diagRefreshBtn, true);
      try{
        const resp = await fetch("/api/diag");
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro");

        const lines = [
          `Versão do app: ${data?.app?.version || "-"}`,
          `Ambiente: ${data?.app?.runtime || "Navegador"}`,
          `Plataforma: ${data?.app?.platform || "-"} / ${data?.app?.arch || "-"}`,
          `Tempo ativo: ${Math.round(Number(data?.app?.uptime || 0))}s`,
          `Base atual: ${data?.db?.label || "Aplicativo local"}`,
          `Dados ocupados: ${formatBytes(data?.db?.size || 0)}`,
          `Pedidos: ${data?.db?.orders ?? "-"}`,
          `Itens: ${data?.db?.items ?? "-"}`,
          `Movimentações: ${data?.db?.movements ?? "-"}`,
          `Caixa: ${data?.db?.cash_status || "-"}`,
          `Impressão: ${printerModeLabel(printSettings.mode)}`,
          `Impressora: ${printerDisplayName(printSettings)}`,
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

    function addonCategoryLabel(id){
      const key = String(id || "").trim().toLowerCase();
      if (key === "_default") return "Padrão (outras categorias)";
      const category = categories.find((c) => c.id === key);
      if (category){
        return `${category.emoji || "🏷️"} ${category.label}`;
      }
      return prettyCatLabel(key);
    }

    function storedAddonCategoryHasExtras(key){
      const list = Array.isArray(categoryAddons?.[key]) ? categoryAddons[key] : [];
      return list.some((entry) => String(entry?.name || "").toLowerCase() !== "sem adicional");
    }

    function renderAddonCategorySelect(){
      if (!els.addonCategorySelect) return;
      const current = String(els.addonCategorySelect.value || "").trim().toLowerCase();
      const keys = new Set(["_default"]);
      for (const c of categories){
        if (c?.id) keys.add(String(c.id).trim().toLowerCase());
      }
      for (const k of Object.keys(categoryAddons || {})){
        const key = String(k || "").trim().toLowerCase();
        if (!key || key === "_default") continue;
        if (!storedAddonCategoryHasExtras(key)) continue;
        keys.add(key);
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
      syncAddonCategoryDeleteState();
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
      syncAddonCategoryDeleteState();
    }

    function categoryHasExtraAddons(categoryKey){
      const list = addonOptionsForCategory(categoryKey);
      return list.some((entry) => String(entry?.name || "").toLowerCase() !== "sem adicional");
    }

    function syncAddonCategoryDeleteState(){
      if (!els.addonCategoryDeleteBtn || !els.addonCategorySelect) return;
      const selectedCategory = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const categoryId = (typeof resolveAddonCategoryKey === "function")
        ? resolveAddonCategoryKey(selectedCategory)
        : selectedCategory;
      const canClear = categoryId !== "_default" && categoryHasExtraAddons(selectedCategory);
      els.addonCategoryDeleteBtn.disabled = !canClear || !isManager();
      els.addonCategoryDeleteBtn.title = canClear
        ? "Remove os acompanhamentos extras desta categoria e mantém apenas 'Sem adicional'."
        : "Esta categoria já está sem acompanhamentos extras.";
    }

    function refreshAddonManager(){
      renderAddonCategorySelect();
      renderAddonList();
    }

    function addAddonFromEditor(){
      if (!requireManager()) return;
      if (!els.addonCategorySelect || !els.addonNameInput) return;

      const selectedCategory = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const categoryId = (typeof resolveAddonCategoryKey === "function")
        ? resolveAddonCategoryKey(selectedCategory)
        : selectedCategory;
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

      const current = addonOptionsForCategory(selectedCategory).slice();
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

    async function clearAddonCategoryFromEditor(){
      if (!requireManager()) return;
      if (!els.addonCategorySelect) return;

      const selectedCategory = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const categoryId = (typeof resolveAddonCategoryKey === "function")
        ? resolveAddonCategoryKey(selectedCategory)
        : selectedCategory;
      const label = addonCategoryLabel(categoryId);

      if (categoryId === "_default"){
        toast("A categoria padrão não pode ser removida.", "info");
        return;
      }
      if (!categoryHasExtraAddons(selectedCategory)){
        toast("Essa categoria já está sem acompanhamentos extras.", "info");
        return;
      }

      const ok = await openConfirmModal({
        title: "Excluir categoria de acompanhamentos",
        message: `Remover todos os acompanhamentos extras de "${label}" e manter apenas "Sem adicional"?`
      });
      if (!ok) return;

      categoryAddons[categoryId] = [{ name: "Sem adicional", price: 0 }];
      saveCategoryAddons(categoryAddons);
      refreshAddonManager();
      toast("Categoria limpa com sucesso.", "success");
    }

    async function removeAddonFromEditor(nameRaw){
      if (!requireManager()) return;
      if (!els.addonCategorySelect) return;

      const selectedCategory = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const categoryId = (typeof resolveAddonCategoryKey === "function")
        ? resolveAddonCategoryKey(selectedCategory)
        : selectedCategory;
      const target = normalizeAddonName(nameRaw);
      if (!target) return;
      const ok = await openConfirmModal({
        title: "Excluir acompanhamento",
        message: `Excluir "${target}" desta categoria?`
      });
      if (!ok) return;

      const current = addonOptionsForCategory(selectedCategory)
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

      const selectedCategory = String(els.addonCategorySelect.value || "_default").trim().toLowerCase();
      const categoryId = (typeof resolveAddonCategoryKey === "function")
        ? resolveAddonCategoryKey(selectedCategory)
        : selectedCategory;
      const currentName = normalizeAddonName(nameRaw);
      if (!currentName) return;

      const current = addonOptionsForCategory(selectedCategory).slice();
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

    const COMPANY_NAME_KEY = "mvs_company_name_v1";
    const COMPANY_LOGO_KEY = "mvs_company_logo_v1";
    const COMPANY_NAME_DEFAULT = "MVS TECHSOLUTION";
    const COMPANY_LOGO_FALLBACK = "mvs-logo.png";

    function normalizeCompanyName(value){
      const clean = String(value || "").replace(/\s+/g, " ").trim();
      if (!clean) return COMPANY_NAME_DEFAULT;
      return clean.slice(0, 60);
    }

    function getStoredCompanyName(){
      try{
        return normalizeCompanyName(localStorage.getItem(COMPANY_NAME_KEY) || COMPANY_NAME_DEFAULT);
      } catch {
        return COMPANY_NAME_DEFAULT;
      }
    }

    function getStoredCompanyLogo(){
      try{
        return String(localStorage.getItem(COMPANY_LOGO_KEY) || "").trim();
      } catch {
        return "";
      }
    }

    function setStoredCompanyName(value){
      try{
        localStorage.setItem(COMPANY_NAME_KEY, normalizeCompanyName(value));
        return true;
      } catch {
        return false;
      }
    }

    function setStoredCompanyLogo(value){
      try{
        if (!value){
          localStorage.removeItem(COMPANY_LOGO_KEY);
        } else {
          localStorage.setItem(COMPANY_LOGO_KEY, String(value));
        }
        return true;
      } catch {
        return false;
      }
    }

    function renderCompanyBrandHeader(name, logoSrc){
      const safeName = normalizeCompanyName(name);
      const safeLogo = String(logoSrc || COMPANY_LOGO_FALLBACK).trim() || COMPANY_LOGO_FALLBACK;

      if (els.brandCompanyName){
        els.brandCompanyName.textContent = safeName;
      }
      if (!els.brandLogoImg) return;

      const showFallback = () => {
        if (els.brandLogoImg) els.brandLogoImg.style.display = "none";
        if (els.brandLogoFallback) els.brandLogoFallback.style.display = "grid";
      };
      const showLogo = () => {
        if (els.brandLogoImg) els.brandLogoImg.style.display = "block";
        if (els.brandLogoFallback) els.brandLogoFallback.style.display = "none";
      };

      els.brandLogoImg.alt = `Logo da empresa ${safeName}`;
      els.brandLogoImg.onerror = showFallback;
      els.brandLogoImg.onload = showLogo;
      els.brandLogoImg.src = safeLogo;
      if (safeLogo === COMPANY_LOGO_FALLBACK){
        showLogo();
      }
    }

    function renderCompanyBrandCard(opts = {}){
      const preserveInput = !!opts.preserveInput;
      const name = getStoredCompanyName();
      const customLogo = getStoredCompanyLogo();
      const previewSrc = customLogo || COMPANY_LOGO_FALLBACK;

      if (els.companyNameInput){
        const shouldKeep = preserveInput && document.activeElement === els.companyNameInput;
        if (!shouldKeep){
          els.companyNameInput.value = name;
        }
      }
      if (els.companyLogoPreview){
        els.companyLogoPreview.src = previewSrc;
        els.companyLogoPreview.alt = `Logo da empresa ${name}`;
        els.companyLogoPreview.onerror = () => {
          if (previewSrc !== COMPANY_LOGO_FALLBACK){
            els.companyLogoPreview.src = COMPANY_LOGO_FALLBACK;
          }
        };
      }
      if (els.companyLogoRemoveBtn){
        els.companyLogoRemoveBtn.disabled = !isManager();
      }
      renderCompanyBrandHeader(name, previewSrc);
    }

    function fileToDataUrl(file){
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
    }

    function loadImageFromDataUrl(dataUrl){
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
        img.src = dataUrl;
      });
    }

    async function normalizeLogoFile(file){
      const type = String(file?.type || "").toLowerCase();
      if (!["image/png", "image/jpeg", "image/jpg"].includes(type)){
        throw new Error("Formato inválido. Use PNG ou JPG.");
      }
      const raw = await fileToDataUrl(file);
      const img = await loadImageFromDataUrl(raw);
      const maxSide = 360;
      const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * scale));
      const h = Math.max(1, Math.round((img.height || 1) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Falha ao processar logo.");
      ctx.drawImage(img, 0, 0, w, h);

      const outputType = type === "image/png" ? "image/png" : "image/jpeg";
      return canvas.toDataURL(outputType, outputType === "image/jpeg" ? 0.9 : undefined);
    }

    function saveCompanyNameFromInput(){
      if (!requireManager()) return;
      const value = normalizeCompanyName(els.companyNameInput?.value || "");
      if (!setStoredCompanyName(value)){
        toast("Não foi possível salvar o nome da empresa.", "error");
        return;
      }
      renderCompanyBrandCard();
      toast("Nome da empresa salvo.", "success");
    }

    async function removeCompanyLogo(){
      if (!requireManager()) return;
      const currentLogo = getStoredCompanyLogo();
      if (!currentLogo){
        toast("Nenhuma logo personalizada para remover.", "info");
        return;
      }
      const ok = await openConfirmModal({
        title: "Remover logo",
        message: "Deseja remover a logo personalizada da empresa?"
      });
      if (!ok) return;
      if (!setStoredCompanyLogo("")){
        toast("Não foi possível remover a logo.", "error");
        return;
      }
      renderCompanyBrandCard();
      toast("Logo removida.", "success");
    }

    function openSystemModal(){
      if (!els.systemModal) return;
      closeOtherModals();
      renderLogs();
      loadDiagnostics();
      renderPrinterSettingsUi();
      renderCompanyBrandCard();
      updateMiniStatus();
      updateSystemLock();
      updateBackupHint();
      syncThemeLoginBgToggle();
      if (!isManager()){
        toast("Modo operador: recursos administrativos bloqueados.", "info");
      }
      els.systemModal.style.display = "flex";
    }

    function openManagerLoginModal(){
      if (!els.managerLoginModal) return;
      closeOtherModals();
      applyRoleLocks();
      if (els.managerPinInputLogin) els.managerPinInputLogin.value = "";
      els.managerLoginModal.style.display = "flex";
      setTimeout(() => {
        if (isManager()){
          els.managerNewPinInput?.focus();
        } else {
          els.managerPinInputLogin?.focus();
        }
      }, 0);
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

    const mobileMenuMedia = window.matchMedia("(max-width: 900px)");

    function syncMobileMenuA11yState(isOpen){
      if (els.mobileMenuToggle){
        els.mobileMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }
      if (els.mobileMenuPanel){
        els.mobileMenuPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
      }
      if (els.mobileMenuBackdrop){
        els.mobileMenuBackdrop.setAttribute("aria-hidden", isOpen ? "false" : "true");
      }
    }

    function closeMobileMenu(){
      document.body.classList.remove("mobile-menu-open");
      syncMobileMenuA11yState(false);
    }

    function openMobileMenu(){
      if (!mobileMenuMedia.matches) return;
      document.body.classList.add("mobile-menu-open");
      syncMobileMenuA11yState(true);
    }

    function toggleMobileMenu(){
      if (document.body.classList.contains("mobile-menu-open")){
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
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

    if (els.mobileMenuToggle) els.mobileMenuToggle.addEventListener("click", toggleMobileMenu);
    if (els.mobileMenuClose) els.mobileMenuClose.addEventListener("click", closeMobileMenu);
    if (els.mobileMenuBackdrop) els.mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
    if (els.mobileMenuPanel) els.mobileMenuPanel.addEventListener("click", (e) => {
      const actionTarget = e.target.closest("button, .pill");
      if (!actionTarget) return;
      if (actionTarget.id === "mobileMenuClose" || actionTarget.id === "mobileMenuToggle") return;
      if (mobileMenuMedia.matches){
        setTimeout(closeMobileMenu, 0);
      }
    });
    if (mobileMenuMedia?.addEventListener){
      mobileMenuMedia.addEventListener("change", (ev) => {
        if (!ev.matches) closeMobileMenu();
      });
    } else if (mobileMenuMedia?.addListener){
      mobileMenuMedia.addListener((ev) => {
        if (!ev.matches) closeMobileMenu();
      });
    }
    closeMobileMenu();

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
    if (els.rolePill) els.rolePill.addEventListener("click", openManagerLoginModal);

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
      renderCompanyBrandCard({ preserveInput: true });
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
      renderCompanyBrandCard({ preserveInput: true });
      toast("Modo gerente ativado.", "success");
      if (els.managerPinInputLogin) els.managerPinInputLogin.value = "";
      closeManagerLoginModal();
    });
    if (els.managerPinInput) els.managerPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.managerLoginBtn?.click();
    });
    if (els.managerPinInputLogin) els.managerPinInputLogin.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.managerLoginBtnModal?.click();
    });

    if (els.managerLogoutBtn) els.managerLogoutBtn.addEventListener("click", () => {
      setRole("operador");
      renderCompanyBrandCard({ preserveInput: true });
      toast("Modo operador ativado.", "info");
      if (els.managerPinInputLogin) els.managerPinInputLogin.value = "";
      if (els.managerNewPinInput) els.managerNewPinInput.value = "";
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

    const THEME_KEY = "mvs_theme_v1";
    const THEME_LOGIN_BG = "loginbg";

    function getStoredTheme(){
      try{
        return String(localStorage.getItem(THEME_KEY) || "");
      } catch {
        return "";
      }
    }

    function setThemeLoginBg(enabled){
      document.documentElement.classList.toggle("theme-loginbg", enabled);
      try{
        if (enabled){
          localStorage.setItem(THEME_KEY, THEME_LOGIN_BG);
        } else {
          localStorage.removeItem(THEME_KEY);
        }
      } catch {
        // ignore storage failures
      }
      if (els.themeLoginBgToggle) els.themeLoginBgToggle.checked = enabled;
    }

    function syncThemeLoginBgToggle(){
      if (!els.themeLoginBgToggle) return;
      const storedTheme = getStoredTheme();
      const enabled = document.documentElement.classList.contains("theme-loginbg") || storedTheme === THEME_LOGIN_BG;
      els.themeLoginBgToggle.checked = enabled;
    }

    if (els.themeLoginBgToggle){
      syncThemeLoginBgToggle();
      els.themeLoginBgToggle.addEventListener("change", () => {
        const enabled = !!els.themeLoginBgToggle.checked;
        setThemeLoginBg(enabled);
        toast(enabled ? "Modo dark (fundo) ativado." : "Modo padrão ativado.", "info");
      });
    }

    renderCompanyBrandCard();
    renderPrinterSettingsUi();
    if (els.companyNameSaveBtn) els.companyNameSaveBtn.addEventListener("click", saveCompanyNameFromInput);
    if (els.companyNameInput) els.companyNameInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      saveCompanyNameFromInput();
    });
    if (els.companyLogoUploadBtn) els.companyLogoUploadBtn.addEventListener("click", () => {
      if (!requireManager()) return;
      if (!els.companyLogoFileInput) return;
      els.companyLogoFileInput.value = "";
      els.companyLogoFileInput.click();
    });
    if (els.companyLogoFileInput) els.companyLogoFileInput.addEventListener("change", async () => {
      const file = els.companyLogoFileInput.files?.[0];
      if (!file) return;
      if (!requireManager()) return;
      try{
        setButtonLoading(els.companyLogoUploadBtn, true, "Enviando...");
        const normalized = await normalizeLogoFile(file);
        if (!setStoredCompanyLogo(normalized)){
          throw new Error("Não foi possível salvar a logo no dispositivo.");
        }
        renderCompanyBrandCard();
        toast("Logo atualizada.", "success");
      } catch (e){
        toast("Falha ao enviar logo: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.companyLogoUploadBtn, false);
      }
    });
    if (els.companyLogoRemoveBtn) els.companyLogoRemoveBtn.addEventListener("click", removeCompanyLogo);
    if (els.printerSaveBtn) els.printerSaveBtn.addEventListener("click", savePrinterSettingsFromUi);
    if (els.printerTestBtn) els.printerTestBtn.addEventListener("click", testPrinterOutput);
    if (els.printerModeSelect) els.printerModeSelect.addEventListener("change", () => {
      renderPrinterStatus(previewPrinterSettingsFromUi());
    });
    if (els.printerNameInput) els.printerNameInput.addEventListener("input", () => {
      renderPrinterStatus(previewPrinterSettingsFromUi());
    });
    if (els.printerAutoToggle) els.printerAutoToggle.addEventListener("change", () => {
      renderPrinterStatus(previewPrinterSettingsFromUi());
    });

    if (els.addonCategorySelect) els.addonCategorySelect.addEventListener("change", renderAddonList);
    if (els.addonCategoryDeleteBtn) els.addonCategoryDeleteBtn.addEventListener("click", clearAddonCategoryFromEditor);
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
    if (els.addonList) els.addonList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const name = btn.dataset.name || "";
      if (action === "edit-addon"){
        editAddonFromEditor(name);
        return;
      }
      if (action === "del-addon"){
        await removeAddonFromEditor(name);
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
    const mobileCartMedia = window.matchMedia("(max-width: 900px)");

    function cartQtyCount(){
      let qty = 0;
      for (const item of cart.values()){
        qty += Number(item?.qty || 0);
      }
      return qty;
    }

    // Trava o scroll da página de fundo enquanto qualquer modal estiver aberto.
    let modalLockScrollY = 0;
    function syncModalScrollLock(){
      const hasOpenModal = Array.from(document.querySelectorAll(".modalOverlay"))
        .some((el) => {
          try{
            return window.getComputedStyle(el).display !== "none";
          } catch {
            return false;
          }
        });

      if (hasOpenModal){
        if (!document.body.classList.contains("modal-open")){
          modalLockScrollY = window.scrollY || window.pageYOffset || 0;
          document.body.style.top = `-${modalLockScrollY}px`;
          document.body.classList.add("modal-open");
        }
        return;
      }

      if (document.body.classList.contains("modal-open")){
        document.body.classList.remove("modal-open");
        document.body.style.top = "";
        window.scrollTo(0, modalLockScrollY);
      }
    }

    const modalScrollObserver = new MutationObserver(() => {
      syncModalScrollLock();
    });
    modalScrollObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
    syncModalScrollLock();

    function updateMobileCartFab(totals){
      if (!els.mobileCartFab || !els.mobileCartFabCount || !els.mobileCartFabTotal) return;

      const qty = cartQtyCount();
      const total = Number(totals?.total);
      const safeTotal = Number.isFinite(total) ? total : 0;
      const show = mobileCartMedia.matches;
      const isEmpty = qty <= 0;

      els.mobileCartFabCount.textContent = isEmpty
        ? "Carrinho"
        : (qty === 1 ? "1 item" : `${qty} itens`);
      els.mobileCartFabTotal.textContent = isEmpty
        ? "Toque para abrir"
        : brl(safeTotal);
      els.mobileCartFab.classList.toggle("is-visible", show);
      els.mobileCartFab.classList.toggle("is-empty", isEmpty);
      els.mobileCartFab.setAttribute("aria-hidden", show ? "false" : "true");
    }

    function scrollToCartPanel(){
      if (!els.cartPanel) return;
      els.cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

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

    function parseCurrentDeliveryFee(){
      const fee = parsePaymentAmountInput(els.deliveryFee?.value || "");
      if (!Number.isFinite(fee) || fee < 0) return 0;
      return roundMoney(fee);
    }

    function currentCheckoutFee(){
      const type = String(els.orderType?.value || "");
      const appliesFee = type === "entrega" || type === "a_receber";
      return appliesFee
        ? parseCurrentDeliveryFee()
        : 0;
    }

    function renderTotals(){
      const { subtotal, discount, fee, total } = calcTotals();

      els.subtotal.textContent = brl(subtotal);
      els.discount.textContent = brl(discount);
      els.fee.textContent = brl(fee);
      els.total.textContent = brl(total);
      updateMobileCartFab({ total });
    }

    // ===== Carrinho +/− =====
    els.cartItems.addEventListener("click", (e) => {
      if (closingTableId){
        toast("Fechamento em andamento. Para alterar itens, cancele o fechamento e abra uma nova venda.", "info");
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

    els.clearBtn.addEventListener("click", async () => {
      if (closingTableId){
        const ok = await openConfirmModal({
          title: "Limpar carrinho",
          message: "Cancelar fechamento atual e limpar carrinho?"
        });
        if (!ok) return;
        closingTableId = null;
        closingTableIds = null;
        activeReceivableId = null;
        updatePaymentVisibility();
      }
      cart.clear();
      if (els.deliveryFee) els.deliveryFee.value = "";
      renderCart();
      resetPaymentSplitState(0);
      activeReceivableId = null;
      updatePaymentVisibility();
    });

    if (els.mobileCartFab) els.mobileCartFab.addEventListener("click", () => {
      if (cart.size === 0){
        toast("Carrinho vazio 😅", "info");
        return;
      }
      scrollToCartPanel();
    });
    const refreshMobileCartFab = () => updateMobileCartFab(calcTotals());
    if (mobileCartMedia?.addEventListener){
      mobileCartMedia.addEventListener("change", refreshMobileCartFab);
    } else if (mobileCartMedia?.addListener){
      mobileCartMedia.addListener(refreshMobileCartFab);
    }

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
        const row = emojiTargetInput.closest?.(".catRow");
        const preview = row?.querySelector?.(".catPreview");
        if (preview) preview.textContent = emojiTargetInput.value.trim() || "🏷️";
        emojiTargetInput.focus();
      }
      closeEmojiModal();
    });
    if (els.categorySave) els.categorySave.addEventListener("click", () => {
      if (!requireManager()) return;
      if (saveCategoryEdits()) closeCategoryModal();
    });
    if (els.categoryList) els.categoryList.addEventListener("click", async (e) => {
      const emojiBtn = e.target.closest("button[data-action='emoji']");
      if (emojiBtn){
        if (!requireManager()) return;
        const row = emojiBtn.closest(".catRow");
        const input = row?.querySelector('[data-field="emoji"]');
        if (!input) return;
        openEmojiModal(input);
        return;
      }

      const btn = e.target.closest("button[data-action='del']");
      if (!btn) return;
      if (!requireManager()) return;
      const id = btn.dataset.id;
      if (!id) return;
      const inUseCount = products.filter((p) => String(p.category || "") === String(id)).length;
      const msg = inUseCount > 0
        ? `A categoria possui ${inUseCount} produto(s). Excluir categoria e produtos vinculados?`
        : "Excluir categoria?";
      const ok = await openConfirmModal({
        title: "Excluir categoria",
        message: msg
      });
      if (!ok) return;

      const result = removeCategoryAndProducts(id);
      const removedProducts = Number(result?.removedProducts || 0);
      if (removedProducts > 0){
        toast(`Categoria removida com ${removedProducts} produto(s).`, "success");
      } else {
        toast("Categoria removida.", "success");
      }
    });
    if (els.categoryList) els.categoryList.addEventListener("input", (e) => {
      const input = e.target.closest('input[data-field="emoji"]');
      if (!input) return;
      const row = input.closest(".catRow");
      const preview = row?.querySelector(".catPreview");
      if (preview) preview.textContent = input.value.trim() || "🏷️";
    });
    els.productClose.addEventListener("click", closeProductModal);
    els.productCancel.addEventListener("click", closeProductModal);
    els.productModal.addEventListener("click", (e) => { if (e.target === els.productModal) closeProductModal(); });

    function upsertProduct(){
      if (!requireManager()) return;
      const name = els.pName.value.trim();
      const category = els.pCategory.value;
      if (!category){
        toast("Cadastre ao menos uma categoria antes de salvar produto.", "error");
        return;
      }
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

    async function deleteProduct(id){
      if (!requireManager()) return;
      const p = products.find(x => x.id === id);
      if (!p) return;
      const ok = await openConfirmModal({
        title: "Excluir produto",
        message: `Excluir "${p.name}"?`
      });
      if (!ok) return;

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

    function syncPizzaFlavorFields(){
      if (!els.pizzaFlavor2Field) return;
      els.pizzaFlavor2Field.style.display = pizzaState.half ? "grid" : "none";
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

      syncPizzaFlavorFields();
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
      syncPizzaFlavorFields();
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

    function regularModalAddonOptions(product){
      return addonOptionsForCategory(product?.category)
        .map((entry) => ({
          name: normalizeAddonName(entry?.name || ""),
          price: roundMoney(Math.max(0, Number(entry?.price || 0))),
        }))
        .filter((entry) => entry.name && entry.name.toLowerCase() !== "sem adicional");
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

      const options = regularModalAddonOptions(product);
      if (!options.length){
        els.itemAddon.innerHTML = `<div class="opsEmpty">Sem acompanhamentos extras nesta categoria.</div>`;
      } else {
        els.itemAddon.innerHTML = options.map((opt, idx) => (
          `<label class="addonCheck">
            <input type="checkbox" data-addon-idx="${idx}" />
            <span>${escapeHtml(addonOptionLabel(opt))}</span>
          </label>`
        )).join("");
      }

      if (els.itemAddonHint){
        els.itemAddonHint.textContent = `Categoria: ${prettyCatLabel(product.category)}. Marque quantos quiser.`;
      }

      if (els.itemNotes) els.itemNotes.value = "";
      if (els.itemRemove) els.itemRemove.disabled = !hasRegularItemInCart(product.id);

      els.itemModal.style.display = "flex";
      setTimeout(() => {
        const firstCheck = els.itemAddon.querySelector("input[type='checkbox']");
        if (firstCheck) firstCheck.focus();
        else els.itemNotes?.focus();
      }, 0);
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

    function currentRegularAddonsFromModal(){
      const product = currentRegularItemFromModal();
      if (!product || !els.itemAddon) return [];
      const options = regularModalAddonOptions(product);
      const checks = Array.from(els.itemAddon.querySelectorAll("input[type='checkbox'][data-addon-idx]:checked"));
      const chosen = checks.map((input) => {
        const idx = Number.parseInt(String(input.dataset.addonIdx || "-1"), 10);
        if (!Number.isFinite(idx) || idx < 0) return null;
        return options[idx] || null;
      }).filter(Boolean);

      const uniq = new Map();
      for (const addon of chosen){
        const key = `${addon.name}||${addon.price}`;
        if (!uniq.has(key)) uniq.set(key, addon);
      }
      return Array.from(uniq.values());
    }

    function currentRegularAddonTotalFromModal(){
      return roundMoney(currentRegularAddonsFromModal().reduce((acc, addon) => (
        acc + roundMoney(Math.max(0, Number(addon?.price || 0)))
      ), 0));
    }

    function currentRegularItemNotesFromModal(){
      return buildRegularItemNotes(currentRegularAddonsFromModal(), els.itemNotes?.value);
    }

    if (els.itemAdd) els.itemAdd.addEventListener("click", () => {
      const product = currentRegularItemFromModal();
      if (!product) return;
      const addonPrice = currentRegularAddonTotalFromModal();
      const notes = currentRegularItemNotesFromModal();
      addRegularProductToCart(product, notes, addonPrice);
      closeRegularItemModal();
    });
    if (els.itemRemove) els.itemRemove.addEventListener("click", () => {
      const product = currentRegularItemFromModal();
      if (!product) return;
      const addonPrice = currentRegularAddonTotalFromModal();
      const notes = currentRegularItemNotesFromModal();
      removeRegularProductFromCart(product, notes, addonPrice);
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
          toast("Finalize o fechamento atual antes de adicionar itens.", "info");
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

    const PAYMENT_METHOD_VALUES = Object.freeze(["dinheiro", "pix", "debito", "credito", "pedido_pago", "pedido_pago_ifood"]);
    const PAYMENT_METHOD_SET = new Set(PAYMENT_METHOD_VALUES);

    function buildPaymentMethodOptions(selected){
      return PAYMENT_METHOD_VALUES
        .map((value) => {
          const label = paymentMethodLabel(value);
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

    function changeSplitPeople(delta){
      const current = syncSplitPeopleInput();
      const next = Math.min(20, Math.max(2, current + Number(delta || 0)));
      if (els.paymentSplitPeople) els.paymentSplitPeople.value = String(next);
      if (!els.paymentSplitToggle?.checked){
        updatePaymentSplitHint(calcTotals().total);
        return;
      }
      seedPaymentSplits(calcTotals().total, next);
      renderPaymentSplits(calcTotals().total);
      els.metaPay.textContent = getCheckoutPaymentMeta();
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

    function getSplitCashReceivedValue(split){
      if (String(split?.method || "").trim().toLowerCase() !== "dinheiro") return null;
      const raw = String(split?.cash_received || "").trim();
      if (!raw) return null;
      const value = parsePaymentAmountInput(raw);
      return Number.isFinite(value) && value >= 0 ? roundMoney(value) : null;
    }

    function getSplitCashChangeValue(split){
      if (String(split?.method || "").trim().toLowerCase() !== "dinheiro") return null;
      const amount = parsePaymentAmountInput(split?.amount);
      if (!Number.isFinite(amount) || amount < 0) return null;
      const received = getSplitCashReceivedValue(split);
      if (!Number.isFinite(received)) return 0;
      return roundMoney(Math.max(0, received - amount));
    }

    function getSplitCashMissingValue(split){
      if (String(split?.method || "").trim().toLowerCase() !== "dinheiro") return null;
      const amount = parsePaymentAmountInput(split?.amount);
      if (!Number.isFinite(amount) || amount < 0) return null;
      const received = getSplitCashReceivedValue(split);
      if (!Number.isFinite(received)) return 0;
      return roundMoney(Math.max(0, amount - received));
    }

    function getPaymentSplitCashTotals(){
      return paymentSplits.reduce((acc, split) => {
        const change = getSplitCashChangeValue(split);
        if (Number.isFinite(change) && change > 0){
          acc.change += change;
        }
        return acc;
      }, { change: 0 });
    }

    function updatePaymentSplitHint(totalTarget){
      if (!els.paymentSplitHint) return;
      const target = roundMoney(totalTarget);
      const total = getPaymentSplitTotal();
      const mismatch = Math.abs(total - target) > 0.009;
      const peopleCount = syncSplitPeopleInput();
      const peopleMismatch = paymentSplits.length !== peopleCount;
      const fewSplits = paymentSplits.length < 2;
      const cashTotals = getPaymentSplitCashTotals();

      let text = `${peopleCount} pessoas: ${brl(total)} de ${brl(target)}`;
      if (fewSplits || peopleMismatch) text += " • ajuste a quantidade de pessoas";
      else if (mismatch) text += " • ajuste os valores";
      if (cashTotals.change > 0) text += ` • troco total ${brl(cashTotals.change)}`;

      els.paymentSplitHint.textContent = text;
      els.paymentSplitHint.classList.toggle("paymentSplitHintMismatch", mismatch || fewSplits || peopleMismatch);
    }

    function splitCashHintText(split){
      const method = String(split?.method || "").trim().toLowerCase();
      if (method !== "dinheiro") return "";
      const amount = parsePaymentAmountInput(split?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return "Informe o valor desta pessoa.";
      const receivedRaw = String(split?.cash_received || "").trim();
      if (!receivedRaw) return "Digite quanto esta pessoa entregou para calcular o troco.";
      const received = getSplitCashReceivedValue(split);
      if (!Number.isFinite(received)) return "Valor recebido inválido.";
      const missing = getSplitCashMissingValue(split);
      if (Number.isFinite(missing) && missing > 0) return `Falta ${brl(missing)}.`;
      const change = getSplitCashChangeValue(split);
      return change > 0 ? `Troco: ${brl(change)}.` : "Sem troco.";
    }

    function refreshPaymentSplitCardUi(card, split){
      if (!card || !split) return;
      const changeInput = card.querySelector(".splitChange");
      if (changeInput){
        const change = Math.max(0, Number(getSplitCashChangeValue(split) || 0));
        changeInput.value = formatPaymentAmountInput(change);
      }
      const hintEl = card.querySelector(".splitCashHint");
      if (hintEl){
        const hint = splitCashHintText(split);
        hintEl.textContent = hint;
        hintEl.classList.toggle("splitCashHintError", hint.includes("Falta") || hint.includes("inválido"));
      }
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
        const cashReceived = String(split.cash_received || "");
        const changeValue = getSplitCashChangeValue(split);
        const showCashFields = method === "dinheiro";
        const splitHint = splitCashHintText(split);
        const splitHintClass = splitHint.includes("Falta") || splitHint.includes("inválido")
          ? " splitCashHintError"
          : "";
        return `
          <div class="paymentSplitCard" data-split-id="${escapeAttr(split.id)}">
            <div class="paymentSplitRow">
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
            ${showCashFields ? `
              <div class="paymentSplitCashRow">
                <div class="field">
                  <label>Recebido</label>
                  <input
                    class="splitReceived"
                    data-field="cash_received"
                    inputmode="decimal"
                    placeholder="0,00"
                    value="${escapeAttr(cashReceived)}"
                  />
                </div>
                <div class="field">
                  <label>Troco</label>
                  <input
                    class="splitChange"
                    data-field="cash_change"
                    value="${escapeAttr(formatPaymentAmountInput(Math.max(0, Number(changeValue || 0))))}"
                    readonly
                  />
                </div>
              </div>
              <div class="hint splitCashHint${splitHintClass}">${escapeHtml(splitHint)}</div>
            ` : ""}
          </div>
        `;
      }).join("");

      updatePaymentSplitHint(totalTarget);
    }

    function seedPaymentSplits(totalTarget, peopleCount = syncSplitPeopleInput()){
      const count = Math.max(2, Number(peopleCount || 2));
      const preferred = String(els.paymentMethod?.value || "dinheiro").toLowerCase();
      const method = PAYMENT_METHOD_SET.has(preferred) ? preferred : "dinheiro";
      const amounts = splitTotalEvenly(totalTarget, count);
      paymentSplits = amounts.map((amount, idx) => ({
        id: uid(),
        person_name: `Pessoa ${idx + 1}`,
        method,
        amount: amount > 0 ? formatPaymentAmountInput(amount) : "",
        cash_received: "",
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
        if (!PAYMENT_METHOD_SET.has(method)){
          throw new Error(`Informe a forma de pagamento de ${person}`);
        }
        const amount = parsePaymentAmountInput(split.amount);
        if (!Number.isFinite(amount) || amount <= 0){
          throw new Error(`Informe um valor válido para ${person}`);
        }
        const normalizedRow = { person_name: person, method, amount: roundMoney(amount) };
        if (method === "dinheiro"){
          const rawReceived = String(split.cash_received || "").trim();
          const received = rawReceived ? parsePaymentAmountInput(rawReceived) : roundMoney(amount);
          if (!Number.isFinite(received) || received < 0){
            throw new Error(`Informe um valor recebido válido para ${person}`);
          }
          if ((received + 0.009) < amount){
            throw new Error(`O valor recebido de ${person} é menor que a parcela em dinheiro`);
          }
          normalizedRow.cash_received = roundMoney(received);
          normalizedRow.cash_change = roundMoney(Math.max(0, received - amount));
        }
        return normalizedRow;
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

    function clearCheckoutCashFields(){
      if (els.checkoutCashReceived) els.checkoutCashReceived.value = "";
      if (els.checkoutCashChange) els.checkoutCashChange.value = brl(0);
      if (els.checkoutCashHint) els.checkoutCashHint.textContent = "Digite quanto recebeu para calcular o troco.";
      if (els.checkoutCashHint) els.checkoutCashHint.classList.remove("checkoutCashHintError");
      if (els.checkoutCashReceived) els.checkoutCashReceived.classList.remove("invalid");
      if (els.checkoutCashWrap) els.checkoutCashWrap.style.display = "none";
    }

    function updateCheckoutCashChange(needsPay, totalTarget){
      if (!els.checkoutCashWrap || !els.checkoutCashReceived || !els.checkoutCashChange || !els.checkoutCashHint) return;

      const splitEnabled = !!els.paymentSplitToggle?.checked;
      const method = String(els.paymentMethod?.value || "").trim().toLowerCase();
      const show = !!needsPay && !splitEnabled && method === "dinheiro";

      els.checkoutCashWrap.style.display = show ? "grid" : "none";
      if (!show){
        clearCheckoutCashFields();
        return;
      }

      const total = roundMoney(totalTarget);
      const raw = String(els.checkoutCashReceived.value || "").trim();
      if (!raw){
        els.checkoutCashChange.value = brl(0);
        els.checkoutCashHint.textContent = "Digite quanto recebeu para calcular o troco.";
        els.checkoutCashHint.classList.remove("checkoutCashHintError");
        els.checkoutCashReceived.classList.remove("invalid");
        return;
      }

      const received = parsePaymentAmountInput(raw);
      const receivedValid = Number.isFinite(received) && received >= 0;
      const diff = receivedValid ? roundMoney(received - total) : NaN;
      const ok = receivedValid && diff >= -0.009;

      els.checkoutCashReceived.classList.toggle("invalid", !ok);
      els.checkoutCashHint.classList.toggle("checkoutCashHintError", !ok);

      if (!receivedValid){
        els.checkoutCashChange.value = brl(0);
        els.checkoutCashHint.textContent = "Valor recebido inválido.";
        return;
      }

      if (!ok){
        const missing = Math.max(0, roundMoney(total - received));
        els.checkoutCashChange.value = brl(0);
        els.checkoutCashHint.textContent = `Falta ${brl(missing)} para completar.`;
        return;
      }

      const change = Math.max(0, roundMoney(received - total));
      els.checkoutCashChange.value = brl(change);
      els.checkoutCashHint.textContent = change > 0 ? `Troco: ${brl(change)}.` : "Sem troco.";
    }

    function validateCheckoutCashReceived(needsPay, totalTarget){
      if (!needsPay) return { ok: true, received: null, change: 0 };
      if (els.paymentSplitToggle?.checked) return { ok: true, received: null, change: 0 };
      const method = String(els.paymentMethod?.value || "").trim().toLowerCase();
      if (method !== "dinheiro") return { ok: true, received: null, change: 0 };

      const raw = String(els.checkoutCashReceived?.value || "").trim();
      if (!raw) return { ok: true, received: null, change: 0 };

      const received = parsePaymentAmountInput(raw);
      if (!Number.isFinite(received) || received < 0){
        return { ok: false, message: "Valor recebido inválido." };
      }

      const total = roundMoney(totalTarget);
      if ((received + 0.009) < total){
        return { ok: false, message: `Valor recebido menor que o total (${brl(total)}).` };
      }

      const change = Math.max(0, roundMoney(received - total));
      return { ok: true, received: roundMoney(received), change };
    }

    function calcTotals(){
      let subtotal = 0;
      for (const it of cart.values()) subtotal += it.unit_price * it.qty;
      const discount = 0;
      const fee = currentCheckoutFee();
      const total = Math.max(0, subtotal - discount + fee);
      return { subtotal, discount, fee, total };
    }

    function unlockCheckoutFields(){
      const fields = [
        els.orderType, els.tableNo, els.custName, els.custPhone,
        els.deliveryFee, els.custAddress, els.orderNotes, els.paymentMethod, els.paymentSplitToggle, els.paymentSplitPeople,
        els.checkoutCashReceived
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
      activeReceivableId = null;
      if (els.deliveryFee) els.deliveryFee.value = "";
      clearCheckoutCashFields();
      resetPaymentSplitState(calcTotals().total);
      unlockCheckoutFields();
      forceEnableCheckoutModal();
      updatePaymentVisibility();
      if (els.checkoutConfirm) els.checkoutConfirm.innerHTML = "Salvar e Imprimir";
      if (els.checkoutModal) els.checkoutModal.style.display = "none";
    }

    function clearCheckoutInvalid(){
      [els.orderType, els.tableNo, els.deliveryFee, els.custName, els.custPhone, els.custAddress, els.checkoutCashReceived].forEach(el => {
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
      const feeRaw = String(els.deliveryFee?.value || "").trim();
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

      if (type === "entrega" || type === "a_receber"){
        if (feeRaw){
          const parsedFee = parsePaymentAmountInput(feeRaw);
          if (!Number.isFinite(parsedFee) || parsedFee < 0){
            els.deliveryFee.classList.add("invalid");
            els.deliveryFee.focus();
            toast("Informe uma taxa de entrega válida.", "error");
            return false;
          }
        }
      }

      if (type === "entrega"){
        if (phone && !isValidPhone(phone)){
          els.custPhone.classList.add("invalid");
          els.custPhone.focus();
          toast("Telefone inválido.", "error");
          return false;
        }
      }

      return true;
    }

    function closeOtherModals(){
      closeMobileMenu();
      if (els.productModal) els.productModal.style.display = "none";
      if (els.pizzaModal) els.pizzaModal.style.display = "none";
      if (els.itemModal) closeRegularItemModal();
      if (els.opsTablesModal) els.opsTablesModal.style.display = "none";
      if (els.opsKitchenModal) els.opsKitchenModal.style.display = "none";
      if (els.deliveryModal) els.deliveryModal.style.display = "none";
      if (els.receivableModal) els.receivableModal.style.display = "none";
      if (els.cashModal) els.cashModal.style.display = "none";
      if (els.managerLoginModal) els.managerLoginModal.style.display = "none";
      if (els.salesModal) els.salesModal.style.display = "none";
      closeConfirmModal(false);
      closeChoiceModal(null);
      closePromptModal(null);
      if (els.reportsModal) els.reportsModal.style.display = "none";
      if (els.expensesModal) els.expensesModal.style.display = "none";
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
      stopExpensesLiveUpdates();
    }

    async function ensureCashOpenForCheckout(actionText = "seguir com a venda"){
      try{
        await syncCashFromServer();
      } catch {
        // usa o ultimo status conhecido se a sincronizacao falhar
      }
      if (shiftState.open) return true;
      toast(`Caixa fechado. Abra o caixa para ${actionText}.`, "info");
      return false;
    }

    async function openCheckout(){
      if (!(await ensureCashOpenForCheckout("seguir com a venda"))) return;
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

    els.finishBtn.addEventListener("click", async () => {
      if (cart.size === 0){ toast("Carrinho vazio 😅", "info"); return; }
      await openCheckout();
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
        const ok = await openConfirmModal({
          title: "Cancelar venda",
          message: "Cancelar esta venda? Essa ação não remove itens do histórico."
        });
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
    let choiceResolve = null;
    let promptResolve = null;

    function openConfirmModal({
      title = "Confirmação",
      message = "Tem certeza?",
      okText = "OK",
      cancelText = "Cancelar"
    } = {}){
      if (confirmResolve) closeConfirmModal(false);
      return new Promise((resolve) => {
        confirmResolve = resolve;
        if (els.confirmTitle) els.confirmTitle.textContent = title;
        if (els.confirmMessage) els.confirmMessage.textContent = message;
        if (els.confirmOk) els.confirmOk.textContent = String(okText || "OK");
        if (els.confirmCancel) els.confirmCancel.textContent = String(cancelText || "Cancelar");
        if (els.confirmModal) els.confirmModal.style.display = "flex";
      });
    }
    function closeConfirmModal(result = false){
      if (els.confirmModal) els.confirmModal.style.display = "none";
      if (els.confirmOk) els.confirmOk.textContent = "OK";
      if (els.confirmCancel) els.confirmCancel.textContent = "Cancelar";
      if (confirmResolve){
        confirmResolve(result);
        confirmResolve = null;
      }
    }

    function openChoiceModal({
      title = "Escolha",
      message = "Selecione uma opção.",
      options = [],
      cancelText = "Cancelar",
    } = {}){
      if (choiceResolve) closeChoiceModal(null);
      return new Promise((resolve) => {
        choiceResolve = resolve;
        if (els.choiceTitle) els.choiceTitle.textContent = title;
        if (els.choiceMessage) els.choiceMessage.textContent = message;
        if (els.choiceCancel) els.choiceCancel.textContent = String(cancelText || "Cancelar");
        if (els.choiceOptions){
          els.choiceOptions.innerHTML = "";
          const list = Array.isArray(options) ? options : [];
          for (const opt of list){
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = String(opt?.className || "btnGhost");
            btn.textContent = String(opt?.label || "Opção");
            btn.dataset.choiceValue = String(opt?.value || "");
            btn.addEventListener("click", () => closeChoiceModal(btn.dataset.choiceValue || null));
            els.choiceOptions.appendChild(btn);
          }
        }
        if (els.choiceModal) els.choiceModal.style.display = "flex";
      });
    }
    function closeChoiceModal(result = null){
      if (els.choiceModal) els.choiceModal.style.display = "none";
      if (els.choiceOptions) els.choiceOptions.innerHTML = "";
      if (els.choiceCancel) els.choiceCancel.textContent = "Cancelar";
      if (choiceResolve){
        choiceResolve(result);
        choiceResolve = null;
      }
    }

    function openPromptModal({
      title = "Informar valor",
      message = "Preencha o campo abaixo.",
      label = "Valor",
      defaultValue = "",
      placeholder = "",
      confirmText = "OK",
      cancelText = "Cancelar",
      inputType = "text",
    } = {}){
      if (promptResolve) closePromptModal(null);
      return new Promise((resolve) => {
        promptResolve = resolve;
        if (els.promptTitle) els.promptTitle.textContent = title;
        if (els.promptMessage) els.promptMessage.textContent = message;
        if (els.promptLabel) els.promptLabel.textContent = label;
        if (els.promptInput){
          els.promptInput.type = inputType;
          els.promptInput.placeholder = String(placeholder || "");
          els.promptInput.value = String(defaultValue ?? "");
        }
        if (els.promptOk) els.promptOk.textContent = String(confirmText || "OK");
        if (els.promptCancel) els.promptCancel.textContent = String(cancelText || "Cancelar");
        if (els.promptModal) els.promptModal.style.display = "flex";
        setTimeout(() => {
          els.promptInput?.focus();
          if (els.promptInput?.value) els.promptInput.select();
        }, 0);
      });
    }
    function closePromptModal(result = null){
      if (els.promptModal) els.promptModal.style.display = "none";
      if (els.promptInput){
        els.promptInput.value = "";
        els.promptInput.placeholder = "";
        els.promptInput.type = "text";
      }
      if (els.promptOk) els.promptOk.textContent = "OK";
      if (els.promptCancel) els.promptCancel.textContent = "Cancelar";
      if (promptResolve){
        promptResolve(result);
        promptResolve = null;
      }
    }

    if (els.confirmClose) els.confirmClose.addEventListener("click", () => closeConfirmModal(false));
    if (els.confirmCancel) els.confirmCancel.addEventListener("click", () => closeConfirmModal(false));
    if (els.confirmOk) els.confirmOk.addEventListener("click", () => closeConfirmModal(true));
    if (els.confirmModal) els.confirmModal.addEventListener("click", (e) => {
      if (e.target === els.confirmModal) closeConfirmModal(false);
    });

    if (els.choiceClose) els.choiceClose.addEventListener("click", () => closeChoiceModal(null));
    if (els.choiceCancel) els.choiceCancel.addEventListener("click", () => closeChoiceModal(null));
    if (els.choiceModal) els.choiceModal.addEventListener("click", (e) => {
      if (e.target === els.choiceModal) closeChoiceModal(null);
    });

    if (els.promptClose) els.promptClose.addEventListener("click", () => closePromptModal(null));
    if (els.promptCancel) els.promptCancel.addEventListener("click", () => closePromptModal(null));
    if (els.promptOk) els.promptOk.addEventListener("click", () => closePromptModal(String(els.promptInput?.value ?? "")));
    if (els.promptInput) els.promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        closePromptModal(String(els.promptInput?.value ?? ""));
      }
    });
    if (els.promptModal) els.promptModal.addEventListener("click", (e) => {
      if (e.target === els.promptModal) closePromptModal(null);
    });
    if (els.printSave) els.printSave.addEventListener("click", () => {
      const frame = document.getElementById("printFrame");
      if (frame?.contentWindow){
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }
    });

    function closeAnyModal(){
      if (document.body.classList.contains("mobile-menu-open")){
        closeMobileMenu();
        return true;
      }
      if (els.promptModal && els.promptModal.style.display === "flex"){
        closePromptModal(null);
        return true;
      }
      if (els.choiceModal && els.choiceModal.style.display === "flex"){
        closeChoiceModal(null);
        return true;
      }
      if (els.confirmModal && els.confirmModal.style.display === "flex"){
        closeConfirmModal(false);
        return true;
      }
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
      if (els.receivableModal && els.receivableModal.style.display === "flex"){
        closeReceivableModal();
        return true;
      }
      if (els.deliveryModal && els.deliveryModal.style.display === "flex"){
        closeDeliveryModal();
        return true;
      }
      if (els.cashModal && els.cashModal.style.display === "flex"){
        closeCashModal();
        return true;
      }
      if (els.salesModal && els.salesModal.style.display === "flex"){
        closeSalesModal();
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
      if (els.expensesModal && els.expensesModal.style.display === "flex"){
        closeExpensesModal();
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
      const accessLocked = window.MVS_ACCESS?.isLocked?.() || document.documentElement.classList.contains("access-locked");

      if (accessLocked){
        if (isCtrlP || (!e.altKey && (key === "F2" || key === "F4")) || key === "Escape"){
          e.preventDefault();
        }
        return;
      }

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
      const orderType = String(els.orderType?.value || "");
      const isEntrega = orderType === "entrega";
      const hasDeliveryFee = isEntrega || orderType === "a_receber";
      const isMesa = orderType === "mesa";
      const isDeferredType = orderType === "mesa" || orderType === "a_receber";
      const needsPay = (!isDeferredType) || (closingTableId !== null);
      const totalTarget = calcTotals().total;
      const compactCheckout = window.matchMedia("(max-width: 560px)").matches;

      if (els.tableNoField) els.tableNoField.style.display = isMesa ? "grid" : "none";
      if (els.deliveryFeeField) els.deliveryFeeField.style.display = hasDeliveryFee ? "grid" : "none";

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

      renderTotals();
      if (els.checkoutTotal) els.checkoutTotal.value = brl(totalTarget);
      updateCheckoutCashChange(needsPay, totalTarget);
    }

    function checkoutNeedsPay(){
      const orderType = String(els.orderType?.value || "");
      const isDeferredType = orderType === "mesa" || orderType === "a_receber";
      return (!isDeferredType) || (closingTableId !== null);
    }

    // Atualiza meta tags no carrinho (só visual)
    els.orderType.addEventListener("change", () => {
      if (els.orderType.value !== "a_receber") activeReceivableId = null;
      els.metaType.textContent = prettyType(els.orderType.value);
      updatePaymentVisibility();
    });
    if (els.deliveryFee) els.deliveryFee.addEventListener("input", () => {
      const totalTarget = calcTotals().total;
      renderTotals();
      if (els.checkoutTotal) els.checkoutTotal.value = brl(totalTarget);
      if (els.paymentSplitToggle?.checked) updatePaymentSplitHint(totalTarget);
      updateCheckoutCashChange(checkoutNeedsPay(), totalTarget);
    });
    if (els.deliveryFee) els.deliveryFee.addEventListener("change", () => {
      const fee = parseCurrentDeliveryFee();
      els.deliveryFee.value = fee > 0 ? formatPaymentAmountInput(fee) : "";
      const totalTarget = calcTotals().total;
      renderTotals();
      if (els.checkoutTotal) els.checkoutTotal.value = brl(totalTarget);
      if (els.paymentSplitToggle?.checked) updatePaymentSplitHint(totalTarget);
      updateCheckoutCashChange(checkoutNeedsPay(), totalTarget);
    });
    els.custName.addEventListener("input", () => {
      if (els.orderType.value === "a_receber" && closingTableId === null){
        activeReceivableId = null;
      }
    });
    els.paymentMethod.addEventListener("change", () => {
      if (els.paymentSplitToggle?.checked) return;
      els.metaPay.textContent = getCheckoutPaymentMeta();
      updateCheckoutCashChange(checkoutNeedsPay(), calcTotals().total);
    });
    if (els.checkoutCashReceived) els.checkoutCashReceived.addEventListener("input", () => {
      updateCheckoutCashChange(checkoutNeedsPay(), calcTotals().total);
    });
    if (els.checkoutCashReceived) els.checkoutCashReceived.addEventListener("change", () => {
      const raw = String(els.checkoutCashReceived.value || "").trim();
      if (raw){
        const parsed = parsePaymentAmountInput(raw);
        if (Number.isFinite(parsed)) els.checkoutCashReceived.value = formatPaymentAmountInput(parsed);
      }
      updateCheckoutCashChange(checkoutNeedsPay(), calcTotals().total);
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
    if (els.paymentSplitPeopleMinus) els.paymentSplitPeopleMinus.addEventListener("click", () => {
      changeSplitPeople(-1);
    });
    if (els.paymentSplitPeoplePlus) els.paymentSplitPeoplePlus.addEventListener("click", () => {
      changeSplitPeople(1);
    });
    if (els.paymentSplitList) els.paymentSplitList.addEventListener("input", (e) => {
      const input = e.target.closest("[data-field]");
      if (!input) return;
      const row = input.closest(".paymentSplitCard");
      if (!row) return;
      const id = String(row.dataset.splitId || "");
      const split = paymentSplits.find((item) => item.id === id);
      if (!split) return;
      const field = String(input.dataset.field || "");
      if (field === "person_name") split.person_name = input.value;
      if (field === "amount") split.amount = input.value;
      if (field === "method") split.method = input.value;
      if (field === "cash_received") split.cash_received = input.value;
      updatePaymentSplitHint(calcTotals().total);
      if (field === "amount" || field === "cash_received") refreshPaymentSplitCardUi(row, split);
    });
    if (els.paymentSplitList) els.paymentSplitList.addEventListener("change", (e) => {
      const fieldEl = e.target.closest("[data-field]");
      if (!fieldEl) return;
      const row = fieldEl.closest(".paymentSplitCard");
      if (!row) return;
      const id = String(row.dataset.splitId || "");
      const split = paymentSplits.find((item) => item.id === id);
      if (!split) return;
      const field = String(fieldEl.dataset.field || "");
      if (field === "method"){
        split.method = fieldEl.value;
        if (split.method !== "dinheiro"){
          split.cash_received = "";
        }
      }
      if (field === "amount"){
        const parsed = parsePaymentAmountInput(fieldEl.value);
        if (Number.isFinite(parsed)) split.amount = formatPaymentAmountInput(parsed);
      }
      if (field === "cash_received"){
        const parsedReceived = parsePaymentAmountInput(fieldEl.value);
        split.cash_received = Number.isFinite(parsedReceived) ? formatPaymentAmountInput(parsedReceived) : fieldEl.value;
      }
      renderPaymentSplits(calcTotals().total);
    });
    window.addEventListener("resize", updatePaymentVisibility);

    // Salvar e imprimir
    els.checkoutConfirm.addEventListener("click", async () => {
      if (cart.size === 0){ toast("Carrinho vazio 😅", "info"); return; }
      if (!(await ensureCashOpenForCheckout("salvar o pedido"))) return;
      if (!validateCheckout()) return;

      try{
        const totals = calcTotals();
        const orderType = String(els.orderType.value || "");
        const isDeferredType = orderType === "mesa" || orderType === "a_receber";
        const payNow = (!isDeferredType) || (closingTableId !== null);
        const paymentData = resolveCheckoutPayment(payNow, totals.total);

         const cashValidation = validateCheckoutCashReceived(payNow, totals.total);
         if (!cashValidation.ok){
           if (els.checkoutCashReceived){
             els.checkoutCashReceived.classList.add("invalid");
             els.checkoutCashReceived.focus();
             els.checkoutCashReceived.select?.();
           }
           toast(cashValidation.message || "Valor recebido inválido.", "error");
           updateCheckoutCashChange(payNow, totals.total);
           return;
         }

        const payload = {
          order_type: orderType,
          table_no: els.tableNo.value.trim(),
          customer_name: els.custName.value.trim(),
          customer_phone: els.custPhone.value.trim(),
          address: els.custAddress.value.trim(),
          notes: els.orderNotes.value.trim(),
          receivable_id: (orderType === "a_receber" && !closingTableId && Number.isFinite(Number(activeReceivableId)))
            ? Number(activeReceivableId)
            : null,

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
          if (!paymentData.payment_method) throw new Error("Informe o pagamento para fechar o pedido");

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
          await openPrintUrlSmart(`/api/orders/${lastId}/print?prices=1`, { auto: true });

          closingTableId = null;
          closingTableIds = null;
          activeReceivableId = null;
           updatePaymentVisibility();
           cart.clear();
           renderCart();
           resetPaymentSplitState(0);
           clearCheckoutCashFields();
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
          await openPrintUrlSmart(`/api/orders/${data.order_id}/print?prices=1`, { auto: true });
 
           cart.clear();
           renderCart();
           resetPaymentSplitState(0);
           clearCheckoutCashFields();
           activeReceivableId = null;
         }

       } catch (e){
         toast("Erro ao salvar/imprimir: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.checkoutConfirm, false);
      }
    });

    // ===== Caixa: modal abrir/fechar + relatório =====
    function closeCashModal(){
      if (els.cashModal) els.cashModal.style.display = "none";
      stopExpensesLiveUpdates();
    }

    async function loadCashModalStatus(){
      if (!els.cashModalStatus) return;
      setButtonLoading(els.cashOpenBtn, true);
      setButtonLoading(els.cashCloseBtn, true);
      setButtonLoading(els.cashResetBtn, true);
      try{
        const resp = await fetch("/api/cash/status");
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao consultar status do caixa");

        const isOpen = String(data?.cash_status || "").toUpperCase() === "ABERTO";
        const openedAt = data?.opened_at ? fmtDateTime(data.opened_at) : "-";
        const lastClosedAt = data?.last_closed_at ? fmtDateTime(data.last_closed_at) : "-";
        const openAmount = brl(Number(data?.opening_amount || 0));
        const totalEntries = brl(Number((data?.total_entries ?? data?.cash_sales) || 0));
        const moneySalesRaw = Number(data?.money_sales);
        const moneySales = Number.isFinite(moneySalesRaw) ? brl(moneySalesRaw) : "";
        const cashOut = brl(Number(data?.cash_out || 0));
        const projectedCash = brl(Number(data?.projected_cash || 0));

        if (els.cashOpenCard) els.cashOpenCard.style.display = isOpen ? "none" : "grid";
        if (els.cashCloseCard) els.cashCloseCard.style.display = isOpen ? "grid" : "none";

        els.cashModalStatus.textContent = [
          `Status: ${isOpen ? "ABERTO" : "FECHADO"}`,
          (isOpen ? `Aberto em: ${openedAt}` : `Último fechamento: ${lastClosedAt}`),
          `Abertura atual: ${openAmount}`,
          `Entradas do dia: ${totalEntries}`,
          ...(moneySales ? [`Dinheiro no dia: ${moneySales}`] : []),
          `Saídas (sangria/despesas): ${cashOut}`,
          `Saldo esperado: ${projectedCash}`,
        ].join("\n");

        if (els.cashOpenBtn) els.cashOpenBtn.disabled = isOpen || !isManager();
        if (els.cashCloseBtn) els.cashCloseBtn.disabled = !isOpen || !isManager();
        if (els.cashResetBtn) els.cashResetBtn.disabled = isOpen || !isManager();
      } catch (e){
        els.cashModalStatus.textContent = "Falha ao carregar status do caixa.";
        toast("Falha ao carregar caixa: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.cashOpenBtn, false);
        setButtonLoading(els.cashCloseBtn, false);
        setButtonLoading(els.cashResetBtn, false);
      }
    }

    function openCashModal(){
      if (!requireManager()) return;
      if (!els.cashModal) return;
      closeOtherModals();
      if (els.cashOpenAmount) els.cashOpenAmount.value = "";
      els.cashModal.style.display = "flex";
      startExpensesLiveUpdates();
      loadCashModalStatus().then(() => {
        loadExpensesData();
        if (els.cashOpenCard && els.cashOpenCard.style.display !== "none"){
          setTimeout(() => els.cashOpenAmount?.focus(), 0);
        }
      });
    }

    async function openCashFromModal(){
      if (!requireManager()) return;
      const raw = String(els.cashOpenAmount?.value || "").trim();
      const openingAmount = raw === "" ? 0 : parsePrice(raw);
      if (!Number.isFinite(openingAmount) || openingAmount < 0){
        toast("Valor de abertura inválido.", "error");
        els.cashOpenAmount?.focus();
        return;
      }

      try{
        setButtonLoading(els.cashOpenBtn, true, "Abrindo...");
        setBusy(els.cashPill, true);
        const resp = await fetch("/api/cash/open", {
          method:"POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ opening_amount: roundMoney(openingAmount) })
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao abrir caixa");

        shiftState.open = true;
        saveShift();
        renderShift();
        resetCheckoutState();
        toast(`Caixa aberto com sucesso. Abertura: ${brl(Number(data?.opening_amount ?? openingAmount))}.`, "success");
        loadCashModalStatus();
        loadExpensesData();
      } catch (e){
        toast("Falha ao abrir caixa: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.cashOpenBtn, false);
        setBusy(els.cashPill, false);
      }
    }

    async function closeCashFromModal(){
      if (!requireManager()) return;
      const ok = await openConfirmModal({
        title: "Fechar caixa",
        message: "Tem certeza que deseja FECHAR o caixa e gerar relatório?"
      });
      if (!ok) return;

      try{
        setButtonLoading(els.cashCloseBtn, true, "Fechando...");
        setBusy(els.cashPill, true);
        const resp = await fetch("/api/cash/close", { method:"POST" });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao fechar caixa");

        shiftState.open = false;
        saveShift();
        renderShift();
        resetCheckoutState();
        closeCashModal();

        openPrintUrl("/api/cash/report/print");
        toast(`Caixa fechado com sucesso. Saldo esperado: ${brl(Number(data?.projected_cash || 0))}.`, "success");
      } catch (e){
        toast("Falha ao fechar caixa: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.cashCloseBtn, false);
        setBusy(els.cashPill, false);
      }
    }

    async function resetCashStatus(){
      if (!requireManager()) return;
      const ok = await openConfirmModal({
        title: "Resetar caixa",
        message: "Resetar tudo do status do caixa? Isso limpa os indicadores de status (não apaga vendas)."
      });
      if (!ok) return;

      try{
        setButtonLoading(els.cashResetBtn, true, "Resetando...");
        const resp = await fetch("/api/cash/reset", { method: "POST" });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao resetar caixa");

        shiftState.open = false;
        saveShift();
        renderShift();
        toast("Status do caixa resetado.", "success");
        loadCashModalStatus();
        loadExpensesData();
      } catch (e){
        toast("Falha ao resetar caixa: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.cashResetBtn, false);
      }
    }

    if (els.cashPill) els.cashPill.addEventListener("click", openCashModal);
    if (els.cashModalClose) els.cashModalClose.addEventListener("click", closeCashModal);
    if (els.cashOpenBtn) els.cashOpenBtn.addEventListener("click", openCashFromModal);
    if (els.cashCloseBtn) els.cashCloseBtn.addEventListener("click", closeCashFromModal);
    if (els.cashResetBtn) els.cashResetBtn.addEventListener("click", resetCashStatus);
    if (els.cashOpenAmount) els.cashOpenAmount.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openCashFromModal();
    });
    if (els.cashModal) els.cashModal.addEventListener("click", (e) => {
      if (e.target === els.cashModal) closeCashModal();
    });

    
