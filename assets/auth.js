(function initTogwAuth() {
  const SESSION_KEY = 'togw_auth_session';
  let session = null;
  const listeners = new Set();

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(nextSession) {
    session = nextSession;
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    notify();
  }

  function notify() {
    listeners.forEach((listener) => listener(session));
    applyUi();
  }

  function isLoggedIn() {
    return Boolean(session?.userId);
  }

  function isAdmin() {
    return Boolean(session?.isAdmin);
  }

  function getUser() {
    return session ? { ...session } : null;
  }

  function logout() {
    writeSession(null);
  }

  async function login(username, password) {
    if (!window.togwSupabase) {
      throw new Error('Connexion Supabase indisponible.');
    }

    const { data, error } = await window.togwSupabase.rpc('verify_togw_login', {
      p_username: username,
      p_password: password,
    });

    if (error) {
      if (error.message?.includes('Could not find the function')) {
        throw new Error(
          'Connexion non configurée : exécutez le script supabase/users-auth.sql dans Supabase (SQL Editor), puis réessayez.'
        );
      }
      throw error;
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    if (!result?.success) {
      throw new Error(result?.error || 'Identifiants invalides.');
    }

    writeSession({
      userId: result.user_id,
      username: result.username,
      isAdmin: Boolean(result.is_admin),
      loggedInAt: new Date().toISOString(),
    });

    return getUser();
  }

  function ensureModal() {
    if (document.getElementById('loginModal')) return;

    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'hidden fixed inset-0 z-[100] items-center justify-center bg-black/70 backdrop-blur-sm px-4';
    modal.innerHTML = `
      <div class="w-full max-w-md bg-surface-container-low border border-outline-variant/30 p-8 shadow-2xl relative">
        <button type="button" id="btn-close-login" class="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors" aria-label="Fermer">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h2 class="text-2xl font-black font-headline uppercase text-primary mb-2">Connexion</h2>
        <p class="text-sm text-on-surface-variant mb-6">Accès organisateur / administrateur</p>
        <form id="loginForm" class="space-y-5">
          <div>
            <label for="loginUsername" class="block text-sm font-black uppercase tracking-widest text-secondary mb-2">Nom d'utilisateur</label>
            <input id="loginUsername" name="username" type="text" required autocomplete="username" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface px-4 py-3 outline-none focus:border-primary" placeholder="username"/>
          </div>
          <div>
            <label for="loginPassword" class="block text-sm font-black uppercase tracking-widest text-primary mb-2">Mot de passe</label>
            <input id="loginPassword" name="password" type="password" required autocomplete="current-password" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface px-4 py-3 outline-none focus:border-primary" placeholder="••••••••"/>
          </div>
          <p id="loginError" class="hidden text-sm text-error"></p>
          <button id="btn-submit-login" type="submit" class="w-full py-4 bg-gradient-to-br from-secondary to-secondary-container text-on-secondary font-black uppercase tracking-[0.15em] hover:scale-[1.02] transition-transform">
            Se connecter
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.getElementById('btn-close-login')?.addEventListener('click', closeModal);
    document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  }

  function openModal() {
    ensureModal();
    const modal = document.getElementById('loginModal');
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
    }
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    document.getElementById('loginUsername')?.focus();
  }

  function closeModal() {
    const modal = document.getElementById('loginModal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('btn-submit-login');
    const errorEl = document.getElementById('loginError');
    const username = document.getElementById('loginUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value || '';

    if (!submitBtn) return;
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'CONNEXION...';

    try {
      await login(username, password);
      closeModal();
      event.target.reset();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Connexion impossible.';
        errorEl.classList.remove('hidden');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }

  function applyUi() {
    const loginBtn = document.getElementById('btn-open-login');
    const authBadge = document.getElementById('authUserBadge');
    const admin = isAdmin();

    if (loginBtn) {
      loginBtn.classList.toggle('hidden', isLoggedIn());
    }

    if (authBadge) {
      if (isLoggedIn()) {
        authBadge.classList.remove('hidden');
        authBadge.innerHTML = `
          <span class="text-xs uppercase tracking-widest text-on-surface-variant">${session.username}${admin ? ' · Admin' : ''}</span>
          <button type="button" id="btn-logout" class="text-xs font-black uppercase tracking-widest text-error hover:text-error-container transition-colors">Déconnexion</button>
        `;
        document.getElementById('btn-logout')?.addEventListener('click', logout, { once: true });
      } else {
        authBadge.classList.add('hidden');
        authBadge.innerHTML = '';
      }
    }

    document.querySelectorAll('[data-inscription-cta]').forEach((el) => {
      const textEl = el.querySelector('[data-cta-text]');
      if (!textEl) return;
      const publicLabel = textEl.dataset.publicLabel || textEl.textContent.trim();
      const adminLabel = el.dataset.adminLabel || 'INSCRIRE UN JOUEUR';
      textEl.dataset.publicLabel = publicLabel;
      textEl.textContent = admin ? adminLabel : publicLabel;
    });

    if (typeof window.applyTogwAdminInscriptionUi === 'function') {
      window.applyTogwAdminInscriptionUi(admin);
    }
  }

  function onAuthChange(callback) {
    listeners.add(callback);
    callback(session);
    return () => listeners.delete(callback);
  }

  function setup() {
    session = readSession();
    ensureModal();
    document.getElementById('btn-open-login')?.addEventListener('click', openModal);
    applyUi();
  }

  window.TOGWAuth = {
    login,
    logout,
    isLoggedIn,
    isAdmin,
    getUser,
    onAuthChange,
    openModal,
    closeModal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
