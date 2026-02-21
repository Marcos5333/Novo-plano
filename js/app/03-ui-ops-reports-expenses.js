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
      choiceModal: document.getElementById("choiceModal"),
      choiceTitle: document.getElementById("choiceTitle"),
      choiceMessage: document.getElementById("choiceMessage"),
      choiceOptions: document.getElementById("choiceOptions"),
      choiceClose: document.getElementById("choiceClose"),
      choiceCancel: document.getElementById("choiceCancel"),
      promptModal: document.getElementById("promptModal"),
      promptTitle: document.getElementById("promptTitle"),
      promptMessage: document.getElementById("promptMessage"),
      promptLabel: document.getElementById("promptLabel"),
      promptInput: document.getElementById("promptInput"),
      promptClose: document.getElementById("promptClose"),
      promptCancel: document.getElementById("promptCancel"),
      promptOk: document.getElementById("promptOk"),
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
      cashModal: document.getElementById("cashModal"),
      cashModalClose: document.getElementById("cashModalClose"),
      cashModalStatus: document.getElementById("cashModalStatus"),
      cashResetBtn: document.getElementById("cashResetBtn"),
      cashOpenCard: document.getElementById("cashOpenCard"),
      cashCloseCard: document.getElementById("cashCloseCard"),
      cashOpenAmount: document.getElementById("cashOpenAmount"),
      cashOpenBtn: document.getElementById("cashOpenBtn"),
      cashCloseBtn: document.getElementById("cashCloseBtn"),

      reportsBtn: document.getElementById("reportsBtn"),
      reportsModal: document.getElementById("reportsModal"),
      reportsClose: document.getElementById("reportsClose"),
      reportDate: document.getElementById("reportDate"),
      reportGrid: document.getElementById("reportGrid"),
      expensesBtn: document.getElementById("expensesBtn"),
      expensesModal: document.getElementById("expensesModal"),
      expensesClose: document.getElementById("expensesClose"),
      expensesRefresh: document.getElementById("expensesRefresh"),
      expenseType: document.getElementById("expenseType"),
      expenseAmount: document.getElementById("expenseAmount"),
      expenseReason: document.getElementById("expenseReason"),
      expenseEmployeeField: document.getElementById("expenseEmployeeField"),
      expenseEmployee: document.getElementById("expenseEmployee"),
      expenseSave: document.getElementById("expenseSave"),
      expensesSummary: document.getElementById("expensesSummary"),
      expensesList: document.getElementById("expensesList"),
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
    let launchRowsIndex = new Map();
    let expensesPoll = null;

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

    if (els.reportGrid) els.reportGrid.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-report]");
      if (!btn) return;
      const period = btn.dataset.report;
      const mode = btn.dataset.mode === "detailed" ? "detailed" : "normal";
      let detailScope = "orders_and_cash";

      if (mode === "detailed"){
        const selected = await openChoiceModal({
          title: "Relatório detalhado",
          message: "Deseja incluir os pedidos do período no relatório detalhado?",
          options: [
            { value: "orders_and_cash", label: "Incluir pedidos do período", className: "btn" },
            { value: "cash_only", label: "Somente dados do caixa", className: "btnGhost" },
          ],
          cancelText: "Cancelar",
        });
        if (!selected) return;
        detailScope = selected;
      }

      if (period === "last"){
        const params = new URLSearchParams({ mode });
        if (mode === "detailed") params.set("detail_scope", detailScope);
        const qs = params.toString();
        openPrintUrl(`/api/cash/report/print?${qs}`);
        return;
      }

      const date = (els.reportDate && els.reportDate.value) ? els.reportDate.value : todayISODate();
      const params = new URLSearchParams({ period, date, mode });
      if (mode === "detailed") params.set("detail_scope", detailScope);
      const qs = params.toString();
      openPrintUrl(`/api/reports/print?${qs}`);
    });

    // ===== Despesas / Sangria =====
    function isExpenseEmployeeRequired(){
      return String(els.expenseType?.value || "") === "pagamento_funcionario";
    }

    function syncExpenseTypeUi(){
      const needEmployee = isExpenseEmployeeRequired();
      if (els.expenseEmployeeField){
        els.expenseEmployeeField.style.display = needEmployee ? "grid" : "none";
      }
      if (!needEmployee && els.expenseEmployee){
        els.expenseEmployee.value = "";
      }
    }

    function renderExpensesSummary(data){
      if (!els.expensesSummary) return;
      const totals = data?.totals || {};
      const cards = [
        { label: "Abertura", value: Number(totals.abertura || 0) },
        { label: "Sangria", value: Number(totals.sangria || 0) },
        { label: "Despesas", value: Number(totals.despesa || 0) },
        { label: "Pagamento funcionário", value: Number(totals.pagamento_funcionario || 0) },
        { label: "Vendas em dinheiro", value: Number(data?.cash_sales || 0) },
        { label: "Saldo esperado", value: Number(data?.projected_cash || 0) },
      ];

      els.expensesSummary.innerHTML = cards.map((card) => `
        <div class="expenseStat">
          <span>${escapeHtml(card.label)}</span>
          <b>${escapeHtml(brl(card.value))}</b>
        </div>
      `).join("");
    }

    function renderExpensesList(rows){
      if (!els.expensesList) return;
      if (!rows || !rows.length){
        launchRowsIndex = new Map();
        els.expensesList.innerHTML = `<div class="opsEmpty">Sem lançamentos neste período</div>`;
        return;
      }

      const normalizedRows = rows.map((row, idx) => {
        const id = String(row?.id || `${row?.entity_type || "row"}-${row?.entity_id || idx}-${idx}`);
        return { ...row, __row_id: id };
      });
      launchRowsIndex = new Map(normalizedRows.map((row) => [String(row.__row_id), row]));

      els.expensesList.innerHTML = `
        <div class="expenseList">
          ${normalizedRows.map((row) => {
            const type = cashMovementLabel(row?.kind);
            const reason = String(row?.reason || "").trim() || "Sem motivo";
            const employeeName = String(row?.employee_name || "").trim();
            const employeeInfo = employeeName ? ` • Funcionário: ${employeeName}` : "";
            const when = fmtDateTime(row?.created_at);
            const canEdit = row?.can_edit !== false;
            const canDelete = row?.can_delete !== false;
            return `
              <div class="expenseRow">
                <div>
                  <div class="opsTitle">${escapeHtml(type)}</div>
                  <div class="expenseMeta">${escapeHtml(when)} • ${escapeHtml(reason)}${escapeHtml(employeeInfo)}</div>
                </div>
                <div class="expenseRowActions">
                  <div class="expenseAmount">${escapeHtml(brl(Number(row?.amount || 0)))}</div>
                  ${canEdit || canDelete ? `
                    <details class="expenseMenu">
                      <summary class="miniBtn" title="Ações">▾</summary>
                      <div class="expenseMenuList">
                        ${canEdit ? `<button class="miniBtn" type="button" data-launch-action="edit" data-launch-id="${escapeAttr(row.__row_id)}">Editar</button>` : ""}
                        ${canDelete ? `<button class="miniBtn danger" type="button" data-launch-action="delete" data-launch-id="${escapeAttr(row.__row_id)}">Excluir</button>` : ""}
                      </div>
                    </details>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function expensesAnyOpen(){
      return (els.expensesModal && els.expensesModal.style.display === "flex")
        || (els.cashModal && els.cashModal.style.display === "flex");
    }

    function startExpensesLiveUpdates(){
      if (expensesPoll) return;
      expensesPoll = setInterval(() => {
        if (!expensesAnyOpen()){
          clearInterval(expensesPoll);
          expensesPoll = null;
          return;
        }
        loadExpensesData({ silent: true });
      }, 4000);
    }

    function stopExpensesLiveUpdates(){
      if (!expensesAnyOpen() && expensesPoll){
        clearInterval(expensesPoll);
        expensesPoll = null;
      }
    }

    async function editMovementLaunch(row){
      const currentKind = String(row?.kind || "").trim().toLowerCase();
      const kindInput = await safePrompt("Tipo (abertura/sangria/despesa/pagamento_funcionario):", currentKind || "despesa");
      if (kindInput === null) return;
      const kind = String(kindInput || "").trim().toLowerCase();
      if (!["abertura", "sangria", "despesa", "pagamento_funcionario"].includes(kind)){
        toast("Tipo inválido.", "error");
        return;
      }

      const amountInput = await safePrompt("Valor (R$):", String(Number(row?.amount || 0)).replace(".", ","));
      if (amountInput === null) return;
      const amount = parsePrice(amountInput);
      if (!Number.isFinite(amount) || amount <= 0){
        toast("Valor inválido.", "error");
        return;
      }

      const reasonInput = await safePrompt("Motivo:", String(row?.reason || ""));
      if (reasonInput === null) return;
      const reason = String(reasonInput || "").trim();
      if (!reason){
        toast("Informe o motivo.", "error");
        return;
      }

      let employeeName = "";
      if (kind === "pagamento_funcionario"){
        const employeeInput = await safePrompt("Funcionário:", String(row?.employee_name || ""));
        if (employeeInput === null) return;
        employeeName = String(employeeInput || "").trim();
        if (!employeeName){
          toast("Informe o nome do funcionário.", "error");
          return;
        }
      }

      const movementId = Number(row?.entity_id || 0);
      if (!movementId){
        toast("Movimentação inválida.", "error");
        return;
      }

      const resp = await fetch(`/api/cash/movements/${movementId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          amount: roundMoney(amount),
          reason,
          employee_name: employeeName,
        })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || data?.ok === false){
        throw new Error(data?.error || "Erro ao editar movimentação");
      }
    }

    async function editOrderLaunch(row){
      const orderId = Number(row?.entity_id || 0);
      if (!orderId){
        toast("Venda inválida.", "error");
        return;
      }

      const getResp = await fetch(`/api/orders/${orderId}`);
      const getData = await readJsonSafe(getResp);
      if (!getResp.ok || getData?.ok === false){
        throw new Error(getData?.error || "Erro ao carregar venda");
      }
      const order = getData?.order || {};

      const customerInput = await safePrompt("Cliente:", String(order?.customer_name || ""));
      if (customerInput === null) return;
      const customerName = String(customerInput || "").trim();
      if (!customerName){
        toast("Informe o nome do cliente.", "error");
        return;
      }

      const paymentInput = await safePrompt("Pagamento (dinheiro/pix/debito/credito):", String(order?.payment_method || "dinheiro"));
      if (paymentInput === null) return;
      const payment = String(paymentInput || "").trim().toLowerCase();
      if (!["dinheiro", "pix", "debito", "credito"].includes(payment)){
        toast("Pagamento inválido.", "error");
        return;
      }

      const notesInput = await safePrompt("Observação:", String(order?.notes || ""));
      if (notesInput === null) return;

      const payload = {
        order_type: String(order?.order_type || "retirada"),
        table_no: String(order?.table_no || ""),
        customer_name: customerName,
        customer_phone: String(order?.customer_phone || ""),
        address: String(order?.address || ""),
        notes: String(notesInput || ""),
        payment_method: payment,
        payment_splits: [],
      };

      const resp = await fetch(`/api/orders/${orderId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || data?.ok === false){
        throw new Error(data?.error || "Erro ao editar venda");
      }
    }

    async function deleteMovementLaunch(row){
      const movementId = Number(row?.entity_id || 0);
      if (!movementId){
        toast("Movimentação inválida.", "error");
        return;
      }
      const resp = await fetch(`/api/cash/movements/${movementId}/delete`, { method: "POST" });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || data?.ok === false){
        throw new Error(data?.error || "Erro ao excluir movimentação");
      }
    }

    async function deleteOrderLaunch(row){
      const orderId = Number(row?.entity_id || 0);
      if (!orderId){
        toast("Venda inválida.", "error");
        return;
      }
      const resp = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || data?.ok === false){
        throw new Error(data?.error || "Erro ao excluir venda");
      }
    }

    async function handleLaunchAction(action, row){
      if (!row) return;
      const type = String(row?.entity_type || "");
      if (action === "edit"){
        if (type === "movement") {
          await editMovementLaunch(row);
          return;
        }
        if (type === "order") {
          await editOrderLaunch(row);
          return;
        }
        throw new Error("Lançamento sem edição suportada.");
      }

      if (action === "delete"){
        const ok = await openConfirmModal({
          title: "Excluir lançamento",
          message: "Confirmar exclusão deste lançamento?"
        });
        if (!ok) return;
        if (type === "movement") {
          await deleteMovementLaunch(row);
          return;
        }
        if (type === "order") {
          await deleteOrderLaunch(row);
          return;
        }
        throw new Error("Lançamento sem exclusão suportada.");
      }
    }

    async function loadExpensesData(opts = {}){
      if (!els.expensesList) return;
      const silent = !!opts.silent;
      try{
        if (!silent) setButtonLoading(els.expensesRefresh, true);
        const resp = await fetch("/api/cash/movements");
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao carregar movimentações");
        renderExpensesSummary(data);
        renderExpensesList(data?.rows || []);
      } catch (e){
        renderExpensesSummary({});
        els.expensesList.innerHTML = `<div class="opsEmpty">Falha ao carregar movimentações</div>`;
        toast("Falha ao carregar despesas: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        if (!silent) setButtonLoading(els.expensesRefresh, false);
      }
    }

    function openExpensesModal(){
      if (!els.expensesModal) return;
      if (!requireManager()) return;
      closeOtherModals();
      syncExpenseTypeUi();
      if (els.expenseAmount) els.expenseAmount.value = "";
      if (els.expenseReason) els.expenseReason.value = "";
      if (els.expenseEmployee) els.expenseEmployee.value = "";
      els.expensesModal.style.display = "flex";
      setTimeout(() => els.expenseAmount?.focus(), 0);
    }

    function closeExpensesModal(){
      if (els.expensesModal) els.expensesModal.style.display = "none";
      stopExpensesLiveUpdates();
    }

    async function saveExpenseMovement(){
      if (!requireManager()) return;
      const kind = String(els.expenseType?.value || "sangria").trim().toLowerCase();
      const rawAmount = String(els.expenseAmount?.value || "").trim();
      const reason = String(els.expenseReason?.value || "").trim();
      const employeeName = String(els.expenseEmployee?.value || "").trim();
      const amount = parsePrice(rawAmount);

      if (!Number.isFinite(amount) || amount <= 0){
        toast("Informe um valor válido.", "error");
        els.expenseAmount?.focus();
        return;
      }
      if (!reason){
        toast("Informe o motivo.", "error");
        els.expenseReason?.focus();
        return;
      }
      if (kind === "pagamento_funcionario" && !employeeName){
        toast("Informe o nome do funcionário.", "error");
        els.expenseEmployee?.focus();
        return;
      }

      try{
        setButtonLoading(els.expenseSave, true, "Salvando...");
        const resp = await fetch("/api/cash/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            amount: roundMoney(amount),
            reason,
            employee_name: employeeName,
          })
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || "Erro ao salvar movimentação");

        if (els.expenseAmount) els.expenseAmount.value = "";
        if (els.expenseReason) els.expenseReason.value = "";
        if (els.expenseEmployee) els.expenseEmployee.value = "";
        syncExpenseTypeUi();
        loadExpensesData();
        toast("Movimentação registrada com sucesso.", "success");
      } catch (e){
        toast("Falha ao registrar movimentação: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.expenseSave, false);
      }
    }

    if (els.expensesBtn) els.expensesBtn.addEventListener("click", openExpensesModal);
    if (els.expensesClose) els.expensesClose.addEventListener("click", closeExpensesModal);
    if (els.expensesRefresh) els.expensesRefresh.addEventListener("click", loadExpensesData);
    if (els.expenseSave) els.expenseSave.addEventListener("click", saveExpenseMovement);
    if (els.expensesList) els.expensesList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-launch-action]");
      if (!btn) return;
      const action = String(btn.dataset.launchAction || "");
      const rowId = String(btn.dataset.launchId || "");
      const row = launchRowsIndex.get(rowId);
      if (!row) return;

      try{
        setButtonLoading(btn, true);
        await handleLaunchAction(action, row);
        await loadExpensesData();
        if (action === "edit"){
          toast("Lançamento atualizado.", "success");
        } else if (action === "delete"){
          toast("Lançamento excluído.", "success");
        }
      } catch (err){
        toast("Falha ao processar lançamento: " + err.message, "error", { detail: err?.stack || err?.message });
      } finally {
        setButtonLoading(btn, false);
      }
    });
    if (els.expenseType) els.expenseType.addEventListener("change", syncExpenseTypeUi);
    if (els.expensesModal) els.expensesModal.addEventListener("click", (e) => {
      if (e.target === els.expensesModal) closeExpensesModal();
    });
    syncExpenseTypeUi();

    