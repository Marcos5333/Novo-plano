(() => {
  const STORAGE_URL_KEY = "mvs_supabase_url_v1";
  const STORAGE_ANON_KEY = "mvs_supabase_anon_key_v1";

  function safeGet(storage, key){
    try{ return storage.getItem(key); }catch{ return null; }
  }

  const cfg = window.MVS_SUPABASE_CONFIG || {};
  const url = String(cfg.url || safeGet(localStorage, STORAGE_URL_KEY) || "").trim();
  const anonKey = String(cfg.anonKey || safeGet(localStorage, STORAGE_ANON_KEY) || "").trim();
  const resetRedirectUrl = String(cfg.resetRedirectUrl || "").trim();

  let client = null;
  let initError = "";

  if (!url || !anonKey){
    initError = "missing_config";
  } else if (!window.supabase || typeof window.supabase.createClient !== "function"){
    initError = "missing_sdk";
  } else {
    try{
      client = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: localStorage,
          storageKey: "mvs_supabase_auth_v1",
        },
      });
    } catch (e){
      initError = e?.message || "createClient_failed";
      client = null;
    }
  }

  window.MVS_SUPABASE = Object.freeze({
    client,
    url,
    resetRedirectUrl,
    isConfigured: !!client,
    initError,
    STORAGE_URL_KEY,
    STORAGE_ANON_KEY,
  });
})();
