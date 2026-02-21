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
        const mode = await openChoiceModal({
          title: "Importar XML",
          message: `Importar ${imported.length} itens. Escolha como aplicar os dados.`,
          options: [
            { value: "merge", label: "Mesclar / atualizar", className: "btn" },
            { value: "replace", label: "Substituir tudo", className: "btnGhost" },
          ],
          cancelText: "Cancelar",
        });
        if (!mode) return;

        products = mode === "merge" ? mergeProducts(products, imported) : imported;
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
      toast("MVS Bem Vindo . Storage local ativo .", "info", { timeout: 4800 });
    }
  
