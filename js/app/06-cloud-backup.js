(() => {
  const TABLE = "mvs_cloud_backups";
  const APP_ID = "mfas_pdv";

  const BACKUP_KEYS = [
    "mvs_demo_backend_v1",
    "mvs_products_v3",
    "mvs_categories_v1",
    "mvs_category_addons_v1",
    "mvs_pizza_subcats_v1",
    "mvs_shift_state_v1",
    "mvs_last_order_id_v1",
    "mvs_role_v1",
    "mvs_manager_pin_v1",
    "mvs_company_name_v1",
    "mvs_company_logo_v1",
    "mvs_theme_v1",
    "mvs_logs_v1",
    "mvs_auto_cash_close_mark_v1",
  ];
  const BACKUP_KEY_SET = new Set(BACKUP_KEYS);

  const ui = {
    saveBtn: document.getElementById("cloudBackupSaveBtn"),
    restoreBtn: document.getElementById("cloudBackupRestoreBtn"),
    hint: document.getElementById("cloudBackupHint"),
    systemBtn: document.getElementById("systemBtn"),
  };

  function client(){
    return window.MVS_SUPABASE?.client || null;
  }

  function isConfigured(){
    return !!window.MVS_SUPABASE?.client;
  }

  function hasManagerGate(){
    return (typeof requireManager === "function");
  }

  function canRunManagerActions(){
    if (!hasManagerGate()) return true;
    return requireManager();
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function safeLocalGet(key){
    try{ return localStorage.getItem(key); }catch{ return null; }
  }
  function safeLocalSet(key, value){
    try{ localStorage.setItem(key, value); return true; }catch{ return false; }
  }
  function safeLocalRemove(key){
    try{ localStorage.removeItem(key); return true; }catch{ return false; }
  }

  function collectSnapshot(){
    const keys = {};
    for (const key of BACKUP_KEYS){
      const raw = safeLocalGet(key);
      if (raw == null) continue;
      keys[key] = String(raw);
    }
    return {
      schema_version: 1,
      app: APP_ID,
      created_at: nowIso(),
      keys,
    };
  }

  function applySnapshot(snapshot){
    const keys = snapshot?.keys;
    if (!keys || typeof keys !== "object") throw new Error("Backup inválido (sem keys).");

    for (const key of BACKUP_KEYS){
      safeLocalRemove(key);
    }

    for (const [key, value] of Object.entries(keys)){
      if (!BACKUP_KEY_SET.has(key)) continue;
      safeLocalSet(key, String(value ?? ""));
    }
  }

  async function getCurrentUser(sb){
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function latestBackup(sb){
    const { data, error } = await sb
      .from(TABLE)
      .select("id, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return row || null;
  }

  function formatWhen(iso){
    try{
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      return d.toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }

  function setHint(text){
    if (!ui.hint) return;
    ui.hint.textContent = String(text || "");
  }

  async function refreshHint(){
    if (!ui.hint) return;
    if (!isConfigured()){
      setHint("Backup na nuvem: configure o Supabase.");
      return;
    }

    const sb = client();
    if (!sb){
      setHint("Backup na nuvem: Supabase indisponível.");
      return;
    }

    try{
      const user = await getCurrentUser(sb);
      if (!user){
        setHint("Backup na nuvem: faça login.");
        return;
      }

      const row = await latestBackup(sb);
      if (!row){
        setHint("Backup na nuvem: nenhum backup salvo ainda.");
        return;
      }
      setHint(`Backup na nuvem: ${formatWhen(row.created_at)}`);
    } catch (e){
      setHint("Backup na nuvem: erro ao consultar.");
      if (typeof toast === "function"){
        toast("Falha ao consultar backup na nuvem: " + (e?.message || "erro"), "error", { detail: e?.stack || e?.message });
      }
    }
  }

  async function saveCloudBackup(){
    if (!canRunManagerActions()) return;

    if (!isConfigured()){
      if (typeof toast === "function") toast("Supabase não configurado.", "error");
      setHint("Backup na nuvem: configure o Supabase.");
      return;
    }

    const sb = client();
    if (!sb){
      if (typeof toast === "function") toast("Supabase indisponível.", "error");
      return;
    }

    try{
      if (typeof setButtonLoading === "function"){
        setButtonLoading(ui.saveBtn, true, "Salvando...");
        setButtonLoading(ui.restoreBtn, true);
      } else {
        ui.saveBtn && (ui.saveBtn.disabled = true);
        ui.restoreBtn && (ui.restoreBtn.disabled = true);
      }

      const user = await getCurrentUser(sb);
      if (!user) throw new Error("Sem sessão ativa.");

      const payload = collectSnapshot();
      const { error } = await sb.from(TABLE).upsert({
        user_id: user.id,
        created_at: nowIso(),
        payload,
      }, { onConflict: "user_id" });
      if (error) throw error;

      if (typeof toast === "function") toast("Backup na nuvem salvo ✅ (substituiu o anterior)", "success");
      await refreshHint();
    } catch (e){
      if (typeof toast === "function"){
        toast("Falha ao salvar backup na nuvem: " + (e?.message || "erro"), "error", { detail: e?.stack || e?.message });
      }
    } finally {
      if (typeof setButtonLoading === "function"){
        setButtonLoading(ui.saveBtn, false);
        setButtonLoading(ui.restoreBtn, false);
      } else {
        ui.saveBtn && (ui.saveBtn.disabled = false);
        ui.restoreBtn && (ui.restoreBtn.disabled = false);
      }
    }
  }

  async function restoreCloudBackup(){
    if (!canRunManagerActions()) return;

    if (!isConfigured()){
      if (typeof toast === "function") toast("Supabase não configurado.", "error");
      setHint("Backup na nuvem: configure o Supabase.");
      return;
    }

    const sb = client();
    if (!sb){
      if (typeof toast === "function") toast("Supabase indisponível.", "error");
      return;
    }

    let ok = true;
    try{
      if (typeof openConfirmModal === "function"){
        ok = await openConfirmModal({
          title: "Restaurar backup (nuvem)",
          message: "Restaurar o último backup da nuvem? Isso substitui os dados atuais neste dispositivo.",
          okText: "Restaurar",
          cancelText: "Cancelar",
        });
      } else {
        ok = confirm("Restaurar o último backup da nuvem? Isso substitui os dados atuais neste dispositivo.");
      }
    } catch {
      ok = false;
    }
    if (!ok) return;

    try{
      if (typeof setButtonLoading === "function"){
        setButtonLoading(ui.restoreBtn, true, "Restaurando...");
        setButtonLoading(ui.saveBtn, true);
      } else {
        ui.saveBtn && (ui.saveBtn.disabled = true);
        ui.restoreBtn && (ui.restoreBtn.disabled = true);
      }

      const user = await getCurrentUser(sb);
      if (!user) throw new Error("Sem sessão ativa.");

      const row = await latestBackup(sb);
      if (!row) throw new Error("Nenhum backup salvo ainda.");

      applySnapshot(row.payload);
      if (typeof toast === "function") toast("Backup restaurado. Recarregando...", "success");
      await refreshHint();
      setTimeout(() => location.reload(), 400);
    } catch (e){
      if (typeof toast === "function"){
        toast("Falha ao restaurar backup: " + (e?.message || "erro"), "error", { detail: e?.stack || e?.message });
      }
    } finally {
      if (typeof setButtonLoading === "function"){
        setButtonLoading(ui.saveBtn, false);
        setButtonLoading(ui.restoreBtn, false);
      } else {
        ui.saveBtn && (ui.saveBtn.disabled = false);
        ui.restoreBtn && (ui.restoreBtn.disabled = false);
      }
    }
  }

  if (ui.saveBtn) ui.saveBtn.addEventListener("click", saveCloudBackup);
  if (ui.restoreBtn) ui.restoreBtn.addEventListener("click", restoreCloudBackup);

  if (ui.systemBtn){
    ui.systemBtn.addEventListener("click", () => {
      setTimeout(refreshHint, 0);
    });
  }

  setTimeout(refreshHint, 0);

  window.MVS_CLOUD_BACKUP = Object.freeze({
    refreshHint,
    saveCloudBackup,
    restoreCloudBackup,
    collectSnapshot,
  });
})();
