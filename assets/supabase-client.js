// Connexion Supabase — client global disponible via window.togwSupabase
(function initSupabase() {
  window.TOGW_SUPABASE_STATUS = { ready: false, reason: 'unknown' };

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    window.TOGW_SUPABASE_STATUS = { ready: false, reason: 'missing_config' };
    console.error('Configuration Supabase manquante dans assets/supabase-config.js');
    return;
  }
  if (window.SUPABASE_ANON_KEY.includes('VOTRE_CLE')) {
    window.TOGW_SUPABASE_STATUS = { ready: false, reason: 'missing_key' };
    console.warn('Ajoutez votre clé anon Supabase dans assets/supabase-config.js');
    return;
  }
  if (!window.supabase) {
    window.TOGW_SUPABASE_STATUS = { ready: false, reason: 'sdk_missing' };
    console.error('SDK Supabase non chargé');
    return;
  }

  window.togwSupabase = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
  window.TOGW_SUPABASE_STATUS = { ready: true, reason: '' };
})();
