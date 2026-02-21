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

    async function safePrompt(message, def = ""){
      try{
        const cleanMessage = String(message || "Informe o valor.");
        const fieldLabel = cleanMessage.replace(/[:?]\s*$/, "").trim() || "Valor";
        const value = await openPromptModal({
          title: "Informar dado",
          message: cleanMessage,
          label: fieldLabel,
          defaultValue: String(def ?? ""),
          placeholder: "",
        });
        return value;
      } catch (e){
        toast("Falha ao abrir modal de entrada.", "error", { detail: e?.stack || e?.message });
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

    function updateSystemLock(){
      const cards = document.querySelectorAll("#systemModal .sysCard");
      const locked = !isManager();
      cards.forEach((card, idx) => {
        if (idx === 0) return; // keep Access card enabled
        card.classList.toggle("locked", locked);
        card.style.pointerEvents = locked ? "none" : "auto";
      });
    }

    function formatMiniBytes(bytes){
      const b = Number(bytes || 0);
      if (b < 1024) return `${b} B`;
      const kb = b / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if (mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }

    function updateMiniStatus(){
      const miniRole = document.getElementById("miniRole");
      const miniCash = document.getElementById("miniCash");
      const miniStorage = document.getElementById("miniStorage");
      const miniOnline = document.getElementById("miniOnline");
      if (!miniRole || !miniCash || !miniStorage || !miniOnline) return;

      miniRole.textContent = isManager() ? "Gerente" : "Operador";
      miniCash.textContent = shiftState.open ? "Aberto" : "Fechado";

      try{
        if (DEMO_STORAGE_MODE) {
          const raw = localStorage.getItem("mvs_demo_backend_v1") || "";
          const size = (typeof Blob !== "undefined") ? new Blob([raw]).size : raw.length;
          miniStorage.textContent = `Local (${formatMiniBytes(size)})`;
        } else {
          miniStorage.textContent = "Servidor";
        }
      } catch {
        miniStorage.textContent = DEMO_STORAGE_MODE ? "Local" : "Servidor";
      }

      miniOnline.textContent = navigator.onLine ? "Online" : "Offline";
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

document.getElementById("newSubcatBtn")?.addEventListener("click", async () => {
  const name = await safePrompt("Nome da subcategoria (ex: doces, especiais, veganas):");
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
        if (!Array.isArray(parsed)) throw new Error("bad");
        const normalizedRaw = parsed
          .map((c) => ({
            id: normalizeCategoryId(c?.id || c?.label || ""),
            label: String(c?.label || c?.id || "").trim(),
            emoji: String(c?.emoji || "").trim() || "🏷️",
          }))
          .filter((c) => c.id && c.label);
        const seen = new Set();
        const normalized = [];
        for (const c of normalizedRaw){
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          normalized.push(c);
        }
        localStorage.setItem(LS_CATS, JSON.stringify(normalized));
        return normalized;
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
        activeCategory = categories[0]?.id || "";
      }
    }

    function renderCategoryTabs(){
      if (!els.categoryTabs) return;
      ensureActiveCategory();
      const hasPizzas = categories.some((c) => c.id === "pizzas");
      if (activeCategory === "pizzas" && hasPizzas){
        if (!pizzaSubcats.includes(activePizzaSubcat)) activePizzaSubcat = pizzaSubcats[0];
      }

      const catChips = categories.map(c => `
        <div class="chip ${c.id === activeCategory ? "active" : ""}" data-cat="${c.id}">
          ${escapeHtml(c.emoji || "🏷️")} ${escapeHtml(c.label)}
        </div>
      `).join("");

      const subChips = (activeCategory === "pizzas" && hasPizzas) ? pizzaSubcats.map(sc => `
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

    function removeCategoryAndProducts(categoryId){
      const id = String(categoryId || "").trim();
      if (!id) return { removedProducts: 0 };

      const removedProductIds = products
        .filter((p) => String(p.category || "") === id)
        .map((p) => String(p.id || ""));
      const removedProductIdSet = new Set(removedProductIds);
      const removedProducts = removedProductIds.length;

      products = products.filter((p) => String(p.category || "") !== id);
      saveProducts(products);

      for (const key of Array.from(cart.keys())){
        let remove = false;
        for (const productId of removedProductIdSet){
          if (!productId) continue;
          if (key === `item|${productId}` || key.startsWith(`item|${productId}|`)){
            remove = true;
            break;
          }
        }
        if (remove) cart.delete(key);
      }

      categories = categories.filter((c) => String(c.id || "") !== id);
      saveCategories(categories);

      if (categoryAddons && Object.prototype.hasOwnProperty.call(categoryAddons, id)){
        delete categoryAddons[id];
        saveCategoryAddons(categoryAddons);
      }

      ensureActiveCategory();
      renderCategoryEditor();
      renderCategoryTabs();
      renderCategorySelect();
      refreshAddonManager();
      syncTabs();
      renderProducts();
      renderCart();
      return { removedProducts };
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

    function addonCategoryVariants(category){
      const key = String(category || "").trim().toLowerCase();
      const variants = [];
      if (key) variants.push(key);
      if (key.endsWith("s")) variants.push(key.slice(0, -1));
      if (key && !key.endsWith("s")) variants.push(`${key}s`);
      if (key === "pizza") variants.push("pizzas");
      if (key === "lanche") variants.push("lanches");
      if (key === "bebida") variants.push("bebidas");
      if (key === "sobremesa") variants.push("sobremesas");
      if (key === "extra") variants.push("extras");
      if (key === "açai") variants.push("acai");
      if (key === "acai") variants.push("açai");
      return Array.from(new Set(variants.filter(Boolean)));
    }

    function resolveAddonCategoryKey(category){
      const variants = addonCategoryVariants(category);
      for (const candidate of variants){
        if (Array.isArray(categoryAddons?.[candidate])) return candidate;
      }
      return variants[0] || "_default";
    }

    function defaultAddonPriceForCategory(categoryKey, addonName){
      const key = String(categoryKey || "_default").trim().toLowerCase();
      const name = normalizeAddonName(addonName).toLowerCase();
      if (!name) return 0;
      const variants = addonCategoryVariants(key);
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
      const variants = addonCategoryVariants(category);
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
      const noteTxt = String(rawNote || "").trim();
      if (Array.isArray(addon)){
        const labels = addon
          .map((entry) => {
            const name = normalizeAddonName(entry?.name || "");
            const price = roundMoney(Math.max(0, Number(entry?.price || 0)));
            if (!name || name.toLowerCase() === "sem adicional") return "";
            return addonOptionLabel({ name, price });
          })
          .filter(Boolean);
        if (labels.length){
          parts.push(`Acomp.: ${labels.join(", ")}`);
        }
      } else {
        const addonName = normalizeAddonName(typeof addon === "string" ? addon : (addon?.name || ""));
        const addonPriceRaw = typeof addon === "string" ? 0 : Number(addon?.price || 0);
        const addonPrice = roundMoney(Math.max(0, addonPriceRaw));
        if (addonName && addonName.toLowerCase() !== "sem adicional"){
          const addonLabel = addonOptionLabel({ name: addonName, price: addonPrice });
          parts.push(`Acomp.: ${addonLabel}`);
        }
      }
      if (noteTxt){
        parts.push(noteTxt);
      }
      return parts.join(" • ");
    }

    
