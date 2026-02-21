// Compat legado:
// Se uma versão antiga do index.html ainda carregar somente app.js,
// este loader injeta os arquivos divididos na ordem correta.
(function legacyAppLoader(){
  if (window.__MVS_SPLIT_APP_LOADER_DONE) return;
  window.__MVS_SPLIT_APP_LOADER_DONE = true;

  const scripts = [
    "js/core/helpers.js",
    "js/app/01-bootstrap-demo.js",
    "js/app/02-logs-state-products.js",
    "js/app/03-ui-ops-reports-expenses.js",
    "js/app/04-system-products-cart-checkout.js",
    "js/app/05-import-init.js",
  ];

  function hasScript(src){
    return Array.from(document.querySelectorAll("script[src]"))
      .some((el) => (el.getAttribute("src") || "").trim() === src);
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      if (hasScript(src)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(s);
    });
  }

  (async () => {
    try{
      for (const src of scripts){
        await loadScript(src);
      }
    } catch (err){
      console.error("[MVS] Falha no loader legado:", err);
    }
  })();
})();
