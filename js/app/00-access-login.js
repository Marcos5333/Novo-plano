(() => {
  const ACCESS_SESSION_KEY = "mvs_access_session_v1";
  const ROLE_KEY = "mvs_role_v1";
  const COMPANY_NAME_KEY = "mvs_company_name_v1";
  const COMPANY_LOGO_KEY = "mvs_company_logo_v1";
  const MODES = Object.freeze({
    LOGIN: "login",
    RESET_PASSWORD: "reset_password",
  });

  let accessMode = MODES.LOGIN;

  const ui = {
    modal: document.getElementById("accessLoginModal"),
    signupModal: document.getElementById("accessSignupModal"),
    promptModal: document.getElementById("promptModal"),
    wrap: document.querySelector(".wrap"),
    logo: document.getElementById("accessLogoPreview"),
    companyName: document.getElementById("accessCompanyName"),
    title: document.getElementById("accessLoginTitle"),
    msg: document.getElementById("accessLoginMsg"),
    emailInput: document.getElementById("accessEmailInput"),
    passwordInput: document.getElementById("accessPasswordInput"),
    passwordLabel: document.querySelector('label[for="accessPasswordInput"]'),
    passwordField: document.getElementById("accessPasswordInput")?.closest(".field") || null,
    passwordConfirmField: document.getElementById("accessPasswordConfirmField"),
    passwordConfirmInput: document.getElementById("accessPasswordConfirmInput"),
    loginBtn: document.getElementById("accessLoginBtn"),
    signupBtn: document.getElementById("accessSignupBtn"),
    mainActions: document.getElementById("accessMainActions"),
    recoveryActions: document.getElementById("accessRecoveryActions"),
    recoveryActionBtn: document.getElementById("accessRecoveryActionBtn"),
    backToLoginBtn: document.getElementById("accessBackToLoginBtn"),
    helperRow: document.getElementById("accessHelperRow"),
    forgotBtn: document.getElementById("accessForgotBtn"),
    hint: document.getElementById("accessLoginHint"),
    signupMsg: document.getElementById("accessSignupMsg"),
    signupNameInput: document.getElementById("accessSignupNameInput"),
    signupEmailInput: document.getElementById("accessSignupEmailInput"),
    signupPasswordInput: document.getElementById("accessSignupPasswordInput"),
    signupPasswordConfirmInput: document.getElementById("accessSignupPasswordConfirmInput"),
    signupSubmitBtn: document.getElementById("accessSignupSubmitBtn"),
    signupCancelBtn: document.getElementById("accessSignupCancelBtn"),
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

  function setHidden(el, hidden){
    if (!el) return;
    el.hidden = !!hidden;
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  function setInputDisabled(el, disabled){
    if (!el) return;
    el.disabled = !!disabled;
    el.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function setMsg(text, isError){
    if (!ui.msg) return;
    ui.msg.textContent = String(text || "");
    ui.msg.classList.toggle("error", !!isError);
  }

  function setSignupMsg(text, isError){
    if (!ui.signupMsg) return;
    ui.signupMsg.textContent = String(text || "");
    ui.signupMsg.classList.toggle("error", !!isError);
  }

  function isSignupModalOpen(){
    return ui.signupModal?.style.display === "flex";
  }

  function getFocusTarget(){
    const candidates = accessMode === MODES.RESET_PASSWORD
      ? [ui.passwordInput, ui.passwordConfirmInput, ui.emailInput]
      : [ui.emailInput, ui.passwordInput, ui.passwordConfirmInput];
    return candidates.find((el) => el && !el.disabled && !el.hidden) || null;
  }

  function getSignupFocusTarget(){
    const candidates = [
      ui.signupNameInput,
      ui.signupEmailInput,
      ui.signupPasswordInput,
      ui.signupPasswordConfirmInput,
    ];
    return candidates.find((el) => el && !el.disabled && !el.hidden) || null;
  }

  function focusPrimary(){
    const el = getFocusTarget();
    if (!el) return;
    setTimeout(() => {
      el.focus();
      el.select?.();
    }, 0);
  }

  function focusPrimaryNow(){
    const el = getFocusTarget();
    if (!el) return;
    el.focus();
    el.select?.();
  }

  function focusSignupPrimary(){
    const el = getSignupFocusTarget();
    if (!el) return;
    setTimeout(() => {
      el.focus();
      el.select?.();
    }, 0);
  }

  function focusSignupPrimaryNow(){
    const el = getSignupFocusTarget();
    if (!el) return;
    el.focus();
    el.select?.();
  }

  function getDefaultModeMessage(mode = accessMode){
    if (mode === MODES.RESET_PASSWORD) return "Digite sua nova senha para concluir a recuperação.";
    return "Informe seu e-mail e senha.";
  }

  function getModeTitle(mode = accessMode){
    if (mode === MODES.RESET_PASSWORD) return "Nova senha";
    return "Login";
  }

  function getAuthFlowType(){
    try{
      const url = new URL(window.location.href);
      const searchType = normalizeText(url.searchParams.get("type") || "");
      const hash = normalizeText(String(url.hash || "").replace(/^#/, ""));
      const hashParams = new URLSearchParams(hash);
      return normalizeText(hashParams.get("type") || searchType || "").toLowerCase();
    } catch {
      return "";
    }
  }

  function isRecoveryUrl(){
    const type = getAuthFlowType();
    return type === "recovery" || type === "password_recovery";
  }

  function clearAuthUrlState(){
    try{
      const url = new URL(window.location.href);
      const removableKeys = ["type", "access_token", "refresh_token", "expires_in", "expires_at", "token_type", "code"];
      removableKeys.forEach((key) => url.searchParams.delete(key));

      const hash = normalizeText(String(url.hash || "").replace(/^#/, ""));
      if (hash){
        const hashParams = new URLSearchParams(hash);
        removableKeys.forEach((key) => hashParams.delete(key));
        const nextHash = hashParams.toString();
        url.hash = nextHash ? `#${nextHash}` : "";
      } else {
        url.hash = "";
      }

      window.history.replaceState({}, document.title, url.toString());
    } catch {}
  }

  function getRecoveryRedirectUrl(){
    const configured = normalizeText(window.MVS_SUPABASE?.resetRedirectUrl || window.MVS_SUPABASE_CONFIG?.resetRedirectUrl || "");
    if (configured) return configured;

    try{
      const url = new URL(window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function getPasswordRulesMessage(prefix = "A senha"){
    return `${prefix} precisa ter pelo menos 6 caracteres, com letra maiúscula, letra minúscula e número.`;
  }

  function passwordMeetsRules(password){
    const value = String(password || "");
    return value.length >= 6
      && /[a-z]/.test(value)
      && /[A-Z]/.test(value)
      && /\d/.test(value);
  }

  function getGenericAuthMessage(context){
    if (context === "login") return "Não foi possível entrar. Tente novamente.";
    if (context === "signup") return "Não foi possível criar a conta. Tente novamente.";
    if (context === "recovery") return "Não foi possível enviar o email de recuperação. Tente novamente.";
    if (context === "reset") return "Não foi possível redefinir a senha. Tente novamente.";
    if (context === "session") return "Não foi possível verificar sua sessão. Faça login novamente.";
    return "Ocorreu um erro. Tente novamente.";
  }

  function formatAuthError(error, context = ""){
    const raw = normalizeText(
      error?.message
      || error?.error_description
      || error?.msg
      || ""
    );
    const lowered = raw.toLowerCase();
    const passwordPrefix = context === "reset" ? "A nova senha" : "A senha";

    if (
      lowered.includes("password should contain at least one character of each")
      || lowered.includes("password should contain")
      || lowered.includes("weak password")
    ){
      return getPasswordRulesMessage(passwordPrefix);
    }
    if (lowered.includes("invalid login credentials")) return "Email ou senha incorretos.";
    if (lowered.includes("email not confirmed") || lowered.includes("confirm your email")) {
      return "Confirme seu email antes de entrar.";
    }
    if (lowered.includes("already registered") || lowered.includes("user already registered")) {
      return "Já existe uma conta com esse email.";
    }
    if (lowered.includes("signup is disabled")) return "O cadastro está desativado no momento.";
    if (lowered.includes("invalid email") || lowered.includes("unable to validate email address")) {
      return "Informe um email válido.";
    }
    if (
      lowered.includes("too many requests")
      || lowered.includes("rate limit")
      || lowered.includes("security purposes")
      || lowered.includes("over_email_send_rate_limit")
    ){
      return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.";
    }
    if (
      lowered.includes("failed to fetch")
      || lowered.includes("fetch failed")
      || lowered.includes("networkerror")
      || lowered.includes("network request failed")
    ){
      return "Não foi possível conectar. Verifique sua internet e tente novamente.";
    }
    if (
      lowered.includes("auth session missing")
      || lowered.includes("session not found")
      || lowered.includes("session_missing")
    ){
      return context === "reset"
        ? "Sua sessão de recuperação expirou. Abra novamente o link enviado por email."
        : "Sua sessão expirou. Faça login novamente.";
    }
    if (
      lowered.includes("otp expired")
      || lowered.includes("token has expired")
      || lowered.includes("expired")
      || lowered.includes("invalid token")
      || lowered.includes("otp has expired")
    ){
      return context === "recovery" || context === "reset"
        ? "O link de recuperação expirou ou é inválido. Solicite um novo email."
        : getGenericAuthMessage(context);
    }
    if (
      lowered.includes("same password")
      || lowered.includes("different from the old password")
      || lowered.includes("new password should be different")
    ){
      return "A nova senha precisa ser diferente da senha atual.";
    }
    if (context === "recovery" && lowered.includes("user not found")) {
      return "Se existir uma conta com esse email, o link será enviado.";
    }

    return getGenericAuthMessage(context);
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
    if (!sb?.isConfigured){
      ui.hint.textContent = "Configure o Supabase em js/core/supabase-config.js.";
      return;
    }
    if (accessMode === MODES.RESET_PASSWORD){
      ui.hint.textContent = "Defina a nova senha para concluir a recuperação da conta.";
      return;
    }
    ui.hint.textContent = "Ao criar conta você concorda com os termos de uso.";
  }

  function resetSignupForm(prefillEmail = ""){
    if (ui.signupNameInput) ui.signupNameInput.value = "";
    if (ui.signupEmailInput) ui.signupEmailInput.value = normalizeText(prefillEmail || "");
    if (ui.signupPasswordInput) ui.signupPasswordInput.value = "";
    if (ui.signupPasswordConfirmInput) ui.signupPasswordConfirmInput.value = "";
    setSignupMsg("Preencha seus dados para criar sua conta.", false);
  }

  function openSignupModal(){
    if (!ui.signupModal) return;
    const prefillEmail = normalizeText(ui.emailInput?.value || "");
    resetSignupForm(prefillEmail);
    ui.signupModal.style.display = "flex";
    ui.signupModal.setAttribute("aria-hidden", "false");
    focusSignupPrimary();
  }

  function closeSignupModal(opts = {}){
    if (!ui.signupModal) return;
    ui.signupModal.style.display = "none";
    ui.signupModal.setAttribute("aria-hidden", "true");
    if (opts.reset !== false){
      resetSignupForm("");
    }
    if (opts.restoreFocus !== false && isLocked()){
      focusPrimary();
    }
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

  function setAccessMode(mode, opts = {}){
    accessMode = mode === MODES.RESET_PASSWORD ? MODES.RESET_PASSWORD : MODES.LOGIN;

    const isLogin = accessMode === MODES.LOGIN;
    const isReset = accessMode === MODES.RESET_PASSWORD;

    if (ui.title) ui.title.textContent = getModeTitle(accessMode);
    if (ui.passwordLabel) ui.passwordLabel.textContent = isReset ? "Nova senha" : "Senha";
    if (ui.passwordInput){
      ui.passwordInput.autocomplete = isReset ? "new-password" : "current-password";
      ui.passwordInput.placeholder = isReset ? "Minimo de 6 caracteres" : "••••••••";
      if (!opts.keepPassword) ui.passwordInput.value = "";
    }
    if (ui.passwordConfirmInput && !opts.keepPassword) ui.passwordConfirmInput.value = "";

    setHidden(ui.passwordField, false);
    setHidden(ui.passwordConfirmField, !isReset);
    setHidden(ui.mainActions, isReset);
    setHidden(ui.recoveryActions, !isReset);
    setHidden(ui.helperRow, isReset);

    if (ui.recoveryActionBtn){
      ui.recoveryActionBtn.textContent = "Salvar nova senha";
    }
    if (ui.backToLoginBtn){
      ui.backToLoginBtn.textContent = "Cancelar";
    }

    setInputDisabled(ui.emailInput, isReset);
    updateHint();

    if (!opts.preserveMessage){
      setMsg(getDefaultModeMessage(accessMode), false);
    }
    if (opts.focus !== false){
      focusPrimary();
    }
  }

  function lockScreen(opts = {}){
    clearSessionFlag();
    setLocked(true);
    closeSignupModal({ restoreFocus: false });
    if (!opts.keepMode) {
      setAccessMode(MODES.LOGIN, { preserveMessage: true, focus: false });
    } else {
      updateHint();
    }
    updateBrand();
    setUserInfo(null);
    if (!opts.keepEmail && ui.emailInput) ui.emailInput.value = "";
    if (ui.passwordInput) ui.passwordInput.value = "";
    if (ui.passwordConfirmInput) ui.passwordConfirmInput.value = "";
    setMsg(String(opts.message || "Faça login para continuar."), !!opts.isError);

    forceOperatorRole();
    closeOverlays();

    focusPrimary();
    if (!opts.silent) notify("Tela bloqueada 🔒", "info");
  }

  function unlockScreen(user){
    setSessionFlag();
    closeSignupModal({ restoreFocus: false });
    setAccessMode(MODES.LOGIN, { preserveMessage: true, focus: false });
    setLocked(false);
    setUserInfo(user);
    if (ui.emailInput) ui.emailInput.value = "";
    if (ui.passwordInput) ui.passwordInput.value = "";
    if (ui.passwordConfirmInput) ui.passwordConfirmInput.value = "";
    setInputDisabled(ui.emailInput, false);
    setMsg("Informe seu e-mail e senha.", false);
    clearAuthUrlState();
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

  function enterRecoveryResetMode(user){
    clearSessionFlag();
    setLocked(true);
    closeSignupModal({ restoreFocus: false });
    updateBrand();
    updateHint();
    setUserInfo(user || null);
    if (ui.emailInput) ui.emailInput.value = normalizeText(user?.email || ui.emailInput?.value || "");
    if (ui.passwordInput) ui.passwordInput.value = "";
    if (ui.passwordConfirmInput) ui.passwordConfirmInput.value = "";
    setAccessMode(MODES.RESET_PASSWORD, { preserveMessage: true, focus: false });
    setMsg("Link confirmado. Defina sua nova senha para entrar.", false);

    forceOperatorRole();
    closeOverlays();
    focusPrimary();
  }

  async function requestRecoveryEmail(){
    const defaultEmail = normalizeText(ui.emailInput?.value || "");
    const promptMessage = "Informe o email cadastrado para enviarmos o link de recuperação.";

    if (typeof openPromptModal !== "function"){
      if (!defaultEmail){
        setMsg("Informe um email válido para recuperar a senha.", true);
        ui.emailInput?.focus();
        ui.emailInput?.select?.();
        return;
      }
      await sendRecoveryEmail(defaultEmail);
      return;
    }

    ui.promptModal?.classList.add("accessPromptTheme");
    let value = null;
    try{
      value = await openPromptModal({
        title: "Recuperar senha",
        message: promptMessage,
        label: "Email",
        defaultValue: defaultEmail,
        placeholder: "seuemail@exemplo.com",
        confirmText: "Enviar link",
        cancelText: "Cancelar",
        inputType: "email",
      });
    } finally {
      ui.promptModal?.classList.remove("accessPromptTheme");
    }

    if (value == null) return;

    const email = normalizeText(value);
    if (!email){
      setMsg("Informe um email válido para recuperar a senha.", true);
      return;
    }

    if (ui.emailInput) ui.emailInput.value = email;
    await sendRecoveryEmail(email);
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
    if (!password){
      setMsg("Informe sua senha.", true);
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
      setMsg(formatAuthError(e, "login"), true);
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

    const name = normalizeText(ui.signupNameInput?.value || "");
    const email = normalizeText(ui.signupEmailInput?.value || "");
    const password = String(ui.signupPasswordInput?.value || "");
    const confirmPassword = String(ui.signupPasswordConfirmInput?.value || "");

    if (!name || name.length < 2){
      setSignupMsg("Informe seu nome.", true);
      ui.signupNameInput?.focus();
      ui.signupNameInput?.select?.();
      return;
    }
    if (!email || !email.includes("@")){
      setSignupMsg("Email inválido.", true);
      ui.signupEmailInput?.focus();
      ui.signupEmailInput?.select?.();
      return;
    }
    if (!passwordMeetsRules(password)){
      setSignupMsg(getPasswordRulesMessage(), true);
      ui.signupPasswordInput?.focus();
      ui.signupPasswordInput?.select?.();
      return;
    }
    if (password !== confirmPassword){
      setSignupMsg("As senhas não coincidem.", true);
      ui.signupPasswordConfirmInput?.focus();
      ui.signupPasswordConfirmInput?.select?.();
      return;
    }

    setButtonLoading(ui.signupSubmitBtn, true, "Criando...");
    setButtonLoading(ui.signupCancelBtn, true);
    setSignupMsg("Criando conta...", false);

    try{
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            app: "mfas_pdv",
            full_name: name,
            name,
          },
        },
      });
      if (error) throw error;

      await upsertProfile(client, data?.user);

      if (data?.session){
        unlockScreen(data?.user || data?.session?.user || null);
        notify("Conta criada ✅", "success");
        return;
      }

      if (ui.emailInput) ui.emailInput.value = email;
      setUserInfo(data?.user || null);
      clearSessionFlag();
      closeSignupModal({ restoreFocus: false });
      lockScreen({
        silent: true,
        keepEmail: true,
        message: "Conta criada. Confirme seu email e depois faça login.",
      });
      notify("Conta criada. Verifique seu email.", "info");
    } catch (e){
      setSignupMsg(formatAuthError(e, "signup"), true);
    } finally {
      setButtonLoading(ui.signupSubmitBtn, false);
      setButtonLoading(ui.signupCancelBtn, false);
    }
  }

  async function sendRecoveryEmail(emailValue = ""){
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    const email = normalizeText(emailValue || ui.emailInput?.value || "");
    if (!email || !email.includes("@")){
      setMsg("Informe um email válido para recuperar a senha.", true);
      ui.emailInput?.focus();
      ui.emailInput?.select?.();
      return;
    }

    const redirectTo = getRecoveryRedirectUrl();
    setMsg("Enviando link de recuperação...", false);

    try{
      const options = redirectTo ? { redirectTo } : undefined;
      const { error } = await client.auth.resetPasswordForEmail(email, options);
      if (error) throw error;

      const fallbackNote = redirectTo
        ? ""
        : " Se o link não voltar para esta tela, configure a Site URL do projeto ou o campo resetRedirectUrl.";
      setMsg("Link enviado. Abra o seu email para redefinir a senha." + fallbackNote, false);
      notify("Email de recuperação enviado.", "success");
    } catch (e){
      setMsg(formatAuthError(e, "recovery"), true);
      notify("Não foi possível enviar o email de recuperação.", "error");
    }
  }

  async function saveRecoveredPassword(){
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    const password = String(ui.passwordInput?.value || "");
    const confirm = String(ui.passwordConfirmInput?.value || "");

    if (!passwordMeetsRules(password)){
      setMsg(getPasswordRulesMessage("A nova senha"), true);
      ui.passwordInput?.focus();
      ui.passwordInput?.select?.();
      return;
    }
    if (password !== confirm){
      setMsg("As senhas não coincidem.", true);
      ui.passwordConfirmInput?.focus();
      ui.passwordConfirmInput?.select?.();
      return;
    }

    setButtonLoading(ui.recoveryActionBtn, true, "Salvando...");
    setButtonLoading(ui.backToLoginBtn, true);
    setMsg("Salvando nova senha...", false);

    try{
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      const { data: userData } = await client.auth.getUser();
      unlockScreen(data?.user || userData?.user || null);
      notify("Senha redefinida ✅", "success");
    } catch (e){
      setMsg(formatAuthError(e, "reset"), true);
      notify("Não foi possível redefinir a senha.", "error");
    } finally {
      setButtonLoading(ui.recoveryActionBtn, false);
      setButtonLoading(ui.backToLoginBtn, false);
    }
  }

  async function backToLogin(){
    if (accessMode !== MODES.RESET_PASSWORD){
      setAccessMode(MODES.LOGIN, { preserveMessage: false });
      return;
    }

    const client = getSupabaseClient();
    setButtonLoading(ui.recoveryActionBtn, true);
    setButtonLoading(ui.backToLoginBtn, true, "Saindo...");

    try{
      await client?.auth.signOut();
    } catch {}

    clearAuthUrlState();
    setButtonLoading(ui.recoveryActionBtn, false);
    setButtonLoading(ui.backToLoginBtn, false);
    lockScreen({ silent: true, message: "Faça login para continuar." });
  }

  async function handleRecoveryAction(){
    await saveRecoveredPassword();
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
  if (ui.signupBtn) ui.signupBtn.addEventListener("click", openSignupModal);
  if (ui.signupSubmitBtn) ui.signupSubmitBtn.addEventListener("click", trySignUp);
  if (ui.signupCancelBtn) ui.signupCancelBtn.addEventListener("click", () => closeSignupModal());
  if (ui.forgotBtn) ui.forgotBtn.addEventListener("click", requestRecoveryEmail);
  if (ui.recoveryActionBtn) ui.recoveryActionBtn.addEventListener("click", handleRecoveryAction);
  if (ui.backToLoginBtn) ui.backToLoginBtn.addEventListener("click", backToLogin);
  if (ui.lockBtn) ui.lockBtn.addEventListener("click", logout);
  if (ui.signupModal) ui.signupModal.addEventListener("click", (e) => {
    if (e.target === ui.signupModal) closeSignupModal();
  });

  if (ui.emailInput) ui.emailInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!ui.passwordInput?.value) {
      ui.passwordInput?.focus();
      return;
    }
    tryLogin();
  });
  if (ui.passwordInput) ui.passwordInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (accessMode === MODES.RESET_PASSWORD) {
      saveRecoveredPassword();
      return;
    }
    tryLogin();
  });
  if (ui.passwordConfirmInput) ui.passwordConfirmInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveRecoveredPassword();
  });
  if (ui.signupNameInput) ui.signupNameInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    ui.signupEmailInput?.focus();
  });
  if (ui.signupEmailInput) ui.signupEmailInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    ui.signupPasswordInput?.focus();
  });
  if (ui.signupPasswordInput) ui.signupPasswordInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    ui.signupPasswordConfirmInput?.focus();
  });
  if (ui.signupPasswordConfirmInput) ui.signupPasswordConfirmInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    trySignUp();
  });

  document.addEventListener("focusin", (e) => {
    if (!isLocked()) return;
    if (!ui.modal) return;
    if (ui.promptModal?.style.display === "flex" && ui.promptModal.contains(e.target)) return;
    if (isSignupModalOpen()){
      if (ui.signupModal?.contains(e.target)) return;
      focusSignupPrimaryNow();
      return;
    }
    if (ui.modal.contains(e.target)) return;
    focusPrimaryNow();
  });

  updateBrand();
  updateHint();
  const unlockedFlag = getSessionFlag() === "1";
  if (!unlockedFlag) forceOperatorRole();
  setLocked(!unlockedFlag);
  setAccessMode(MODES.LOGIN, { preserveMessage: true, focus: false });
  setMsg("Informe seu e-mail e senha.", false);
  if (!unlockedFlag) focusPrimary();

  (async () => {
    const client = getSupabaseClient();
    if (!client){
      lockScreen({ silent: true, isError: true, message: "Supabase não configurado. Preencha js/core/supabase-config.js." });
      return;
    }

    try{
      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT"){
          clearAuthUrlState();
          lockScreen({ silent: true, message: "Faça login para continuar." });
          return;
        }
        if (event === "PASSWORD_RECOVERY"){
          enterRecoveryResetMode(session?.user || null);
          return;
        }
        if (session?.user){
          if (isRecoveryUrl()){
            enterRecoveryResetMode(session.user);
            return;
          }
          setUserInfo(session.user);
        }
      });
    } catch {}

    try{
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      if (!session){
        lockScreen({ silent: true, message: "Faça login para continuar." });
        return;
      }
      if (isRecoveryUrl()){
        enterRecoveryResetMode(session.user);
        return;
      }
      setUserInfo(session.user);
      unlockScreen(session.user);
    } catch {
      lockScreen({ silent: true, isError: true, message: "Falha ao verificar sessão. Faça login novamente." });
    }
  })();

  window.MVS_ACCESS = Object.freeze({
    isLocked,
    lockScreen,
    unlockScreen,
  });
})();
