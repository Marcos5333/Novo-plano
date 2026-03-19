(() => {
  const ACCESS_PIN_KEY = "mvs_access_pin_v1";
  const ACCESS_SESSION_KEY = "mvs_access_session_v1";
  const ROLE_KEY = "mvs_role_v1";
  const COMPANY_NAME_KEY = "mvs_company_name_v1";
  const COMPANY_LOGO_KEY = "mvs_company_logo_v1";
  const DEFAULT_ACCESS_PIN = "0000";
  const MIN_PIN_LEN = 4;

  const ui = {
    modal: document.getElementById("accessLoginModal"),
    wrap: document.querySelector(".wrap"),
    logo: document.getElementById("accessLogoPreview"),
    companyName: document.getElementById("accessCompanyName"),
    msg: document.getElementById("accessLoginMsg"),
    pinInput: document.getElementById("accessPinInput"),
    loginBtn: document.getElementById("accessLoginBtn"),
    clearBtn: document.getElementById("accessPinClearBtn"),
    hint: document.getElementById("accessLoginHint"),
    lockBtn: document.getElementById("lockScreenBtn"),
    newPinInput: document.getElementById("accessNewPinInput"),
    setPinBtn: document.getElementById("accessSetPinBtn"),
  };

  function notify(message, type = "info"){
    if (typeof toast === "function") {
      toast(String(message || ""), type);
    } else {
      console[type === "error" ? "error" : "log"](message);
    }
  }

  function safeGet(storage, key){
    try{ return storage.getItem(key); }catch{ return null; }
  }
  function safeSet(storage, key, value){
    try{ storage.setItem(key, value); return true; }catch{ return false; }
  }
  function safeRemove(storage, key){
    try{ storage.removeItem(key); return true; }catch{ return false; }
  }

  function getSessionFlag(){
    return safeGet(sessionStorage, ACCESS_SESSION_KEY) || safeGet(localStorage, ACCESS_SESSION_KEY) || "";
  }

  function setSessionFlag(){
    if (safeSet(sessionStorage, ACCESS_SESSION_KEY, "1")) return true;
    return safeSet(localStorage, ACCESS_SESSION_KEY, "1");
  }

  function clearSessionFlag(){
    safeRemove(sessionStorage, ACCESS_SESSION_KEY);
    safeRemove(localStorage, ACCESS_SESSION_KEY);
  }

  function normalizePin(value){
    return String(value || "").trim();
  }

  function getAccessPin(){
    try{
      const raw = normalizePin(localStorage.getItem(ACCESS_PIN_KEY) || "");
      if (raw) return raw;
      localStorage.setItem(ACCESS_PIN_KEY, DEFAULT_ACCESS_PIN);
      return DEFAULT_ACCESS_PIN;
    } catch {
      return DEFAULT_ACCESS_PIN;
    }
  }

  function setAccessPin(pin){
    try{
      localStorage.setItem(ACCESS_PIN_KEY, normalizePin(pin));
      return true;
    } catch {
      return false;
    }
  }

  function isLocked(){
    return document.documentElement.classList.contains("access-locked");
  }

  function setLocked(locked){
    document.documentElement.classList.toggle("access-locked", !!locked);
    if (ui.wrap){
      if (locked){
        ui.wrap.setAttribute("inert", "");
        ui.wrap.setAttribute("aria-hidden", "true");
      } else {
        ui.wrap.removeAttribute("inert");
        ui.wrap.removeAttribute("aria-hidden");
      }
    }
  }

  function setMsg(text, isError){
    if (!ui.msg) return;
    ui.msg.textContent = String(text || "");
    ui.msg.classList.toggle("error", !!isError);
  }

  function focusPin(){
    if (!ui.pinInput) return;
    setTimeout(() => {
      ui.pinInput.focus();
      ui.pinInput.select?.();
    }, 0);
  }

  function focusPinNow(){
    if (!ui.pinInput) return;
    ui.pinInput.focus();
    ui.pinInput.select?.();
  }

  function updateBrand(){
    try{
      const storedName = normalizePin(localStorage.getItem(COMPANY_NAME_KEY) || "");
      if (storedName && ui.companyName) ui.companyName.textContent = storedName.slice(0, 60);
    } catch {}

    try{
      const storedLogo = normalizePin(localStorage.getItem(COMPANY_LOGO_KEY) || "");
      if (storedLogo && ui.logo) ui.logo.src = storedLogo;
    } catch {}

    if (ui.logo){
      ui.logo.addEventListener("error", () => {
        ui.logo.src = "mvs-logo.png";
      }, { once: true });
    }
  }

  function updateHint(){
    if (!ui.hint) return;
    const isDefaultPin = getAccessPin() === DEFAULT_ACCESS_PIN;
    ui.hint.textContent = isDefaultPin
      ? "Primeiro acesso: PIN padrão 0000 (altere em Sistema → Acesso)."
      : "PIN configurado. Para trocar: Sistema → Acesso (gerente).";
  }

  function forceOperatorRole(){
    try{ localStorage.setItem(ROLE_KEY, "operador"); } catch {}
    if (typeof setRole === "function") {
      try{ setRole("operador"); } catch {}
    }
  }

  function lockScreen(opts = {}){
    clearSessionFlag();
    setLocked(true);
    updateBrand();
    updateHint();
    if (ui.pinInput) ui.pinInput.value = "";
    setMsg(String(opts.message || "Informe seu PIN de acesso."), false);

    forceOperatorRole();

    if (typeof closeAnyModal === "function") {
      try{ closeAnyModal(); } catch {}
    }
    if (typeof closeSystemModal === "function") {
      try{ closeSystemModal(); } catch {}
    } else if (ui.lockBtn) {
      // fallback: fecha o modal do sistema se conseguir achar
      try{ document.getElementById("systemModal")?.style && (document.getElementById("systemModal").style.display = "none"); } catch {}
    }

    focusPin();
    if (!opts.silent) notify("Tela bloqueada 🔒", "info");
  }

  function unlockScreen(){
    setSessionFlag();
    setLocked(false);
    if (ui.pinInput) ui.pinInput.value = "";
    setMsg("Informe seu PIN de acesso.", false);
  }

  function tryLogin(){
    const pin = normalizePin(ui.pinInput?.value || "");

    if (pin.length < MIN_PIN_LEN){
      setMsg(`PIN inválido (mín. ${MIN_PIN_LEN}).`, true);
      focusPin();
      return;
    }

    if (pin !== getAccessPin()){
      setMsg("PIN incorreto. Tente novamente.", true);
      if (ui.pinInput) ui.pinInput.value = "";
      focusPin();
      return;
    }

    unlockScreen();
    notify("Acesso liberado ✅", "success");
  }

  function trySetNewPin(){
    if (typeof requireManager === "function" && !requireManager()) return;

    const newPin = normalizePin(ui.newPinInput?.value || "");
    if (newPin.length < MIN_PIN_LEN){
      notify(`PIN inválido (mín. ${MIN_PIN_LEN}).`, "error");
      ui.newPinInput?.focus();
      ui.newPinInput?.select?.();
      return;
    }

    if (!setAccessPin(newPin)){
      notify("Falha ao salvar PIN (storage indisponível).", "error");
      return;
    }

    if (ui.newPinInput) ui.newPinInput.value = "";
    updateHint();
    notify("PIN de acesso atualizado ✅", "success");
  }

  if (ui.loginBtn) ui.loginBtn.addEventListener("click", tryLogin);
  if (ui.clearBtn) ui.clearBtn.addEventListener("click", () => {
    if (ui.pinInput) ui.pinInput.value = "";
    setMsg("Informe seu PIN de acesso.", false);
    focusPin();
  });
  if (ui.pinInput) ui.pinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });

  if (ui.lockBtn) ui.lockBtn.addEventListener("click", () => lockScreen());
  if (ui.setPinBtn) ui.setPinBtn.addEventListener("click", trySetNewPin);

  document.addEventListener("focusin", (e) => {
    if (!isLocked()) return;
    if (!ui.modal) return;
    if (ui.modal.contains(e.target)) return;
    focusPinNow();
  });

  // Estado inicial (também corrige qualquer flash do head script)
  updateBrand();
  updateHint();
  const unlocked = getSessionFlag() === "1";
  if (!unlocked) forceOperatorRole();
  setLocked(!unlocked);
  setMsg("Informe seu PIN de acesso.", false);
  if (!unlocked) focusPin();

  window.MVS_ACCESS = Object.freeze({
    isLocked,
    lockScreen,
    unlockScreen,
    getAccessPin,
    setAccessPin,
  });
})();
