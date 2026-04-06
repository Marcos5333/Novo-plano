(() => {
  const brl = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const escapeHtml = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const escapeAttr = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function applyMobilePreset(){
    const ua = String(navigator.userAgent || "");
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle("platform-ios", isIOS);
    root.classList.toggle("platform-android", isAndroid);
    root.classList.toggle("platform-mobile", isIOS || isAndroid);
  }

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
      if (typeof toast === "function"){
        toast("Falha ao abrir impressao: " + e.message, "error");
      } else {
        console.error("Falha ao abrir impressao:", e);
      }
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
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let count = 0;
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
    return (crypto?.randomUUID?.() ?? ("id-" + Math.random().toString(16).slice(2)));
  }

  function parsePrice(input){
    const normalized = String(input ?? "").trim().replace(/\./g, "").replace(",", ".");
    const v = Number(normalized);
    return Number.isFinite(v) ? v : NaN;
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
    const key = String(method || "").toLowerCase();
    if (PAYMENT_METHOD_LABELS[key]) return PAYMENT_METHOD_LABELS[key];
    return (typeof prettyType === "function") ? prettyType(key) : key;
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
    if (CASH_MOVEMENT_LABELS[key]) return CASH_MOVEMENT_LABELS[key];
    return (typeof prettyType === "function") ? prettyType(key) : key;
  }

  function describeCashMovement(entry){
    const key = String(entry?.kind || entry || "").trim().toLowerCase();
    const reason = String(entry?.reason || "").trim();
    const employee = String(entry?.employee_name || "").trim();
    const baseReason = reason || "Sem motivo";

    if (key === "pagamento_funcionario"){
      const parts = ["Pagamento de funcionário"];
      if (employee) parts.push(`Funcionário: ${employee}`);
      if (reason && !/^pagamento\s+de\s+funcion[aá]rio\b/i.test(reason)) {
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

  function roundMoney(value){
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  applyMobilePreset();

  window.MVS_HELPERS = Object.freeze({
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
  });
})();
