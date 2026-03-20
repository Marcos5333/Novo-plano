(() => {
  const ACCESS_SESSION_KEY = "mvs_access_session_v1";
  const ROLE_KEY = "mvs_role_v1";
  const COMPANY_NAME_KEY = "mvs_company_name_v1";
  const COMPANY_LOGO_KEY = "mvs_company_logo_v1";

  const ui = {
    modal: document.getElementById("accessLoginModal"),
    wrap: document.querySelector(".wrap"),
    logo: document.getElementById("accessLogoPreview"),
    companyName: document.getElementById("accessCompanyName"),
    msg: document.getElementById("accessLoginMsg"),
    emailInput: document.getElementById("accessEmailInput"),
    passwordInput: document.getElementById("accessPasswordInput"),
    loginBtn: document.getElementById("accessLoginBtn"),
    signupBtn: document.getElementById("accessSignupBtn"),
    hint: document.getElementById("accessLoginHint"),
    lockBtn: document.getElementById("lockScreenBtn"),
    userInfo: document.getElementById("accessUserInfo"),
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

  function normalizeText(value){
    return String(value ?? "").trim();
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

  function focusPrimary(){
    const el = ui.emailInput || ui.passwordInput;
    if (!el) return;
    setTimeout(() => {
      el.focus();
      el.select?.();
    }, 0);
  }

  function focusPrimaryNow(){
    const el = ui.emailInput || ui.passwordInput;
    if (!el) return;
    el.focus();
    el.select?.();
  }

  function updateBrand(){
    try{
      const storedName = normalizeText(localStorage.getItem(COMPANY_NAME_KEY) || "");
      if (storedName && ui.companyName) ui.companyName.textContent = storedName.slice(0, 60);
    } catch {}

    try{
      const storedLogo = normalizeText(localStorage.getItem(COMPANY_LOGO_KEY) || "");
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
    const sb = window.MVS_SUPABASE;
    ui.hint.textContent = sb?.isConfigured
      ? "Ao criar conta, seus dados ficam salvos no Supabase."
      : "Configure o Supabase em js/core/supabase-config.js.";
  }

  function setUserInfo(user){
    if (!ui.userInfo) return;
    const email = normalizeText(user?.email || "");
    ui.userInfo.textContent = email ? `Conectado como: ${email}` : "Não autenticado.";
  }

  function forceOperatorRole(){
    try{ localStorage.setItem(ROLE_KEY, "operador"); } catch {}
    if (typeof setRole === "function") {
      try{ setRole("operador"); } catch {}
    }
  }

  function closeOverlays(){
    if (typeof closeAnyModal === "function") {
      try{ closeAnyModal(); } catch {}
    }
    if (typeof closeSystemModal === "function") {
      try{ closeSystemModal(); } catch {}
    } else {
      try{ document.getElementById("systemModal")?.style && (document.getElementById("systemModal").style.display = "none"); } catch {}
    }
  }

  function lockScreen(opts = {}){
    clearSessionFlag();
    setLocked(true);
    updateBrand();
    updateHint();
    setUserInfo(null);
    if (ui.emailInput) ui.emailInput.value = "";
    if (ui.passwordInput) ui.passwordInput.value = "";
    setMsg(String(opts.message || "Faça login para continuar."), !!opts.isError);

    forceOperatorRole();
    closeOverlays();

    focusPrimary();
    if (!opts.silent) notify("Tela bloqueada 🔒", "info");
  }

  function unlockScreen(user){
    setSessionFlag();
    setLocked(false);
    setUserInfo(user);
    if (ui.emailInput) ui.emailInput.value = "";
    if (ui.passwordInput) ui.passwordInput.value = "";
    setMsg("Informe seu e-mail e senha.", false);
  }

  function setButtonLoading(btn, loading, label){
    if (!btn) return;
    if (loading){
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      if (label) btn.textContent = label;
      btn.classList.add("loading");
      btn.disabled = true;
      return;
    }
    const original = btn.dataset.label;
    if (original) btn.textContent = original;
    btn.classList.remove("loading");
    btn.disabled = false;
  }

  function getSupabaseClient(){
    return window.MVS_SUPABASE?.client || null;
  }

  async function tryLogin(){
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    const email = normalizeText(ui.emailInput?.value || "");
    const password = String(ui.passwordInput?.value || "");

    if (!email || !email.includes("@")){
      setMsg("Email inválido.", true);
      ui.emailInput?.focus();
      ui.emailInput?.select?.();
      return;
    }
    if (!password || password.length < 6){
      setMsg("Senha inválida (mín. 6).", true);
      ui.passwordInput?.focus();
      ui.passwordInput?.select?.();
      return;
    }

    setButtonLoading(ui.loginBtn, true, "Entrando...");
    setButtonLoading(ui.signupBtn, true);
    setMsg("Entrando...", false);

    try{
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      unlockScreen(data?.user || data?.session?.user || null);
      notify("Acesso liberado ✅", "success");
    } catch (e){
      setMsg("Falha no login: " + (e?.message || "erro"), true);
      if (ui.passwordInput) ui.passwordInput.value = "";
      ui.passwordInput?.focus();
      ui.passwordInput?.select?.();
    } finally {
      setButtonLoading(ui.loginBtn, false);
      setButtonLoading(ui.signupBtn, false);
    }
  }

  async function upsertProfile(client, user){
    if (!client || !user?.id) return;
    try{
      const payload = {
        id: user.id,
        email: user.email || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await client.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    } catch {}
  }

  async function trySignUp(){
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    const email = normalizeText(ui.emailInput?.value || "");
    const password = String(ui.passwordInput?.value || "");

    if (!email || !email.includes("@")){
      setMsg("Email inválido.", true);
      ui.emailInput?.focus();
      ui.emailInput?.select?.();
      return;
    }
    if (!password || password.length < 6){
      setMsg("Senha inválida (mín. 6).", true);
      ui.passwordInput?.focus();
      ui.passwordInput?.select?.();
      return;
    }

    setButtonLoading(ui.loginBtn, true);
    setButtonLoading(ui.signupBtn, true, "Criando...");
    setMsg("Criando conta...", false);

    try{
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { app: "mfas_pdv" } },
      });
      if (error) throw error;

      await upsertProfile(client, data?.user);

      if (data?.session){
        unlockScreen(data?.user || data?.session?.user || null);
        notify("Conta criada ✅", "success");
        return;
      }

      setUserInfo(data?.user || null);
      clearSessionFlag();
      setLocked(true);
      if (ui.passwordInput) ui.passwordInput.value = "";
      setMsg("Conta criada. Confirme seu email e depois faça login.", false);
      notify("Conta criada. Verifique seu email.", "info");
    } catch (e){
      setMsg("Falha ao criar conta: " + (e?.message || "erro"), true);
    } finally {
      setButtonLoading(ui.loginBtn, false);
      setButtonLoading(ui.signupBtn, false);
    }
  }

  async function logout(){
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, message: "Faça login para continuar." });
      return;
    }
    setButtonLoading(ui.lockBtn, true, "Saindo...");
    try{
      await client.auth.signOut();
    } catch {}
    setButtonLoading(ui.lockBtn, false);
    lockScreen({ message: "Você saiu. Faça login novamente.", silent: true });
    notify("Sessão encerrada.", "info");
  }

  if (ui.loginBtn) ui.loginBtn.addEventListener("click", tryLogin);
  if (ui.signupBtn) ui.signupBtn.addEventListener("click", trySignUp);
  if (ui.lockBtn) ui.lockBtn.addEventListener("click", logout);

  if (ui.emailInput) ui.emailInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!ui.passwordInput?.value) {
      e.preventDefault();
      ui.passwordInput?.focus();
      return;
    }
    e.preventDefault();
    tryLogin();
  });
  if (ui.passwordInput) ui.passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryLogin();
    }
  });

  document.addEventListener("focusin", (e) => {
    if (!isLocked()) return;
    if (!ui.modal) return;
    if (ui.modal.contains(e.target)) return;
    focusPrimaryNow();
  });

  // Estado inicial (também corrige qualquer flash do head script)
  updateBrand();
  updateHint();
  const unlockedFlag = getSessionFlag() === "1";
  if (!unlockedFlag) forceOperatorRole();
  setLocked(!unlockedFlag);
  setMsg("Informe seu e-mail e senha.", false);
  if (!unlockedFlag) focusPrimary();

  (async () => {
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    try{
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      if (!session){
        lockScreen({ silent: true, message: "Faça login para continuar." });
        return;
      }
      setUserInfo(session.user);
      unlockScreen(session.user);
    } catch {
      lockScreen({ silent: true, isError: true, message: "Falha ao verificar sessão. Faça login novamente." });
    }

    try{
      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT"){
          lockScreen({ silent: true, message: "Faça login para continuar." });
          return;
        }
        if (session?.user) setUserInfo(session.user);
      });
    } catch {}
  })();

  window.MVS_ACCESS = Object.freeze({
    isLocked,
    lockScreen,
    unlockScreen,
  });
})();
