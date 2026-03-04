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
        const rawCategoryId = (get("categoria_id") || "").trim();
        const category = normalizeCategoryId(rawCategoryId || rawCategory);
        const subcat = normalizeSubcat(get("subcategoria"));
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
            ...(subcat ? { subcat } : {}),
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

    function xmlEscape(value){
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    function exportMoney(value){
      const n = Number(value);
      const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
      return safe.toFixed(2);
    }

    function categoryLabelForExport(categoryId){
      const id = String(categoryId || "").trim();
      const cat = categories.find((c) => String(c?.id || "") === id);
      if (cat?.label) return String(cat.label).trim();
      return prettyCatLabel(id);
    }

    function buildMenuExportRows(){
      return products
        .map((p) => {
          const categoryId = String(p?.category || "").trim();
          if (!categoryId) return null;
          const isPizza = categoryId === "pizzas";
          const categoryLabel = categoryLabelForExport(categoryId);
          const name = String(p?.name || "").trim();
          if (!name) return null;

          const row = {
            nome: name,
            categoria: categoryLabel,
            categoria_id: categoryId,
            subcategoria: String(p?.subcat || "").trim(),
            emoji: String(p?.emoji || "").trim() || (isPizza ? "🍕" : "🧾"),
            descricao: String(p?.desc || "").trim(),
            cozinha: !!p?.isKitchen,
          };

          if (isPizza){
            row.precos = {
              broto: exportMoney(p?.priceP),
              normal: exportMoney(p?.priceM),
            };
          } else {
            row.preco = exportMoney(p?.price);
          }

          return row;
        })
        .filter(Boolean);
    }

    function buildMenuXml(rows){
      const lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<cardapio>"
      ];

      for (const row of rows){
        lines.push("  <produto>");
        lines.push(`    <nome>${xmlEscape(row.nome)}</nome>`);
        lines.push(`    <categoria>${xmlEscape(row.categoria)}</categoria>`);
        lines.push(`    <categoria_id>${xmlEscape(row.categoria_id)}</categoria_id>`);
        if (row.subcategoria) lines.push(`    <subcategoria>${xmlEscape(row.subcategoria)}</subcategoria>`);
        if (row.emoji) lines.push(`    <emoji>${xmlEscape(row.emoji)}</emoji>`);
        if (row.descricao) lines.push(`    <descricao>${xmlEscape(row.descricao)}</descricao>`);
        lines.push(`    <cozinha>${row.cozinha ? "true" : "false"}</cozinha>`);
        if (row.precos){
          lines.push("    <precos>");
          lines.push(`      <broto>${xmlEscape(row.precos.broto)}</broto>`);
          lines.push(`      <normal>${xmlEscape(row.precos.normal)}</normal>`);
          lines.push("    </precos>");
        } else {
          lines.push(`    <preco>${xmlEscape(row.preco)}</preco>`);
        }
        lines.push("  </produto>");
      }

      lines.push("</cardapio>");
      return lines.join("\n");
    }

    function buildMenuJson(rows){
      const usedCategoryIds = new Set(rows.map((r) => r.categoria_id));
      const exportedCategories = categories
        .filter((c) => usedCategoryIds.has(String(c?.id || "").trim()))
        .map((c) => ({
          id: String(c?.id || "").trim(),
          label: String(c?.label || "").trim(),
          emoji: String(c?.emoji || "").trim() || "🏷️",
        }));

      return JSON.stringify({
        schema: "mvs-cardapio-export-v1",
        exported_at: new Date().toISOString(),
        total_itens: rows.length,
        categorias: exportedCategories,
        produtos: rows,
      }, null, 2);
    }

    function triggerFileDownload(content, mimeType, filename){
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    if (els.exportMenuBtn) els.exportMenuBtn.addEventListener("click", async () => {
      if (!requireManager()) return;
      try{
        setButtonLoading(els.exportMenuBtn, true);
        const rows = buildMenuExportRows();
        if (!rows.length) throw new Error("Nenhum item válido no cardápio para exportar.");

        const format = await openChoiceModal({
          title: "Exportar cardápio",
          message: `Exportar ${rows.length} itens em qual formato?`,
          options: [
            { value: "xml", label: "XML", className: "btn" },
            { value: "json", label: "JSON", className: "btnGhost" },
          ],
          cancelText: "Cancelar",
        });
        if (!format) return;

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const isXml = format === "xml";
        const content = isXml ? buildMenuXml(rows) : buildMenuJson(rows);
        const mimeType = isXml ? "application/xml; charset=utf-8" : "application/json; charset=utf-8";
        const filename = isXml
          ? `mvs_cardapio_${stamp}.xml`
          : `mvs_cardapio_${stamp}.json`;

        triggerFileDownload(content, mimeType, filename);
        toast(`Cardápio exportado em ${isXml ? "XML" : "JSON"} ✅`, "success");
        logEvent("info", "Cardápio exportado", `${isXml ? "XML" : "JSON"} (${rows.length} itens)`);
      } catch (e){
        toast("Falha ao exportar cardápio: " + e.message, "error", { detail: e?.stack || e?.message });
      } finally {
        setButtonLoading(els.exportMenuBtn, false);
      }
    });

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
    scheduleAutoCashClose();
    lockSignaturePosition();
    removeSignatureBackground();
    if (window.__MVS_DEMO_STORAGE) {
      toast("MVS Bem Vindo . Storage local ativo .", "info", { timeout: 4800 });
    }
  
