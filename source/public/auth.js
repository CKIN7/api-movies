export class Auth {
  constructor(apiBase = 'http://localhost:8089') {
    this.API_BASE = apiBase;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.listeners = new Set();

    this.els = {};
  }

  init() {
    this.loadFromStorage();
    this.bindElements();
    this.bindEvents();
    this.updateUI();
  }

  loadFromStorage() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch {
        this.clearStorage();
      }
    }
  }

  saveToStorage() {
    if (this.accessToken) localStorage.setItem('accessToken', this.accessToken);
    if (this.refreshToken) localStorage.setItem('refreshToken', this.refreshToken);
    if (this.user) localStorage.setItem('user', JSON.stringify(this.user));
  }

  clearStorage() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  bindElements() {
    this.els = {
      btnLogin: document.getElementById('btn-login'),
      btnRegister: document.getElementById('btn-register'),
      btnLogout: document.getElementById('btn-logout'),
      userMenu: document.getElementById('user-menu'),
      userEmail: document.getElementById('user-email'),
      verificationBadge: document.getElementById('verification-badge'),
      authButtons: document.getElementById('auth-buttons'),
      modalLogin: document.getElementById('modal-login'),
      modalRegister: document.getElementById('modal-register'),
      modalOverlay: document.getElementById('modal-overlay'),
      formLogin: document.getElementById('form-login'),
      formRegister: document.getElementById('form-register'),
      switchToRegister: document.getElementById('switch-to-register'),
      switchToLogin: document.getElementById('switch-to-login'),
      loginError: document.getElementById('login-error'),
      registerError: document.getElementById('register-error'),
    };
  }

  bindEvents() {
    const { els } = this;

    els.btnLogin?.addEventListener('click', () => this.openModal('login'));
    els.btnRegister?.addEventListener('click', () => this.openModal('register'));
    els.btnLogout?.addEventListener('click', () => this.logout());

    els.switchToRegister?.addEventListener('click', () => this.switchModal('register'));
    els.switchToLogin?.addEventListener('click', () => this.switchModal('login'));

    els.modalOverlay?.addEventListener('click', () => this.closeModals());

    els.formLogin?.addEventListener('submit', (e) => this.handleLogin(e));
    els.formRegister?.addEventListener('submit', (e) => this.handleRegister(e));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModals();
    });
  }

  openModal(type) {
    this.closeModals();
    this.clearErrors();
    if (type === 'login') {
      this.els.modalLogin?.classList.add('open');
    } else {
      this.els.modalRegister?.classList.add('open');
    }
    this.els.modalOverlay?.classList.add('open');
    setTimeout(() => {
      const input = type === 'login'
        ? this.els.formLogin?.querySelector('input')
        : this.els.formRegister?.querySelector('input');
      input?.focus();
    }, 50);
  }

  switchModal(type) {
    this.closeModals();
    this.openModal(type);
  }

  closeModals() {
    this.els.modalLogin?.classList.remove('open');
    this.els.modalRegister?.classList.remove('open');
    this.els.modalOverlay?.classList.remove('open');
    this.clearErrors();
  }

  clearErrors() {
    this.els.loginError.innerHTML = '';
    this.els.registerError.innerHTML = '';
  }

  setError(element, message, email = null) {
    if (email && message.includes('Verifica tu email')) {
      element.innerHTML = `
        <span>${message}</span>
        <button type="button" class="btn-resend" data-email="${email}" style="margin-left: 8px; padding: 2px 8px; font-size: 0.75rem;">Reenviar verificación</button>
      `;
      element.querySelector('.btn-resend')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleResendVerification(e.target.dataset.email, element);
      });
    } else {
      element.textContent = message;
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(this.els.formLogin);
    const email = formData.get('email').trim();
    const password = formData.get('password');

    this.setError(this.els.loginError, '');

    try {
      const res = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Backend usa "error" o "message"
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }

      this.setAuth(data.accessToken, data.refreshToken, data.user);
      this.closeModals();
      this.els.formLogin.reset();
      this.notifyChange();
    } catch (err) {
      this.setError(this.els.loginError, err.message, email);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(this.els.formRegister);
    const email = formData.get('email').trim();
    const password = formData.get('password');

    this.setError(this.els.registerError, '');

    try {
      const res = await fetch(`${this.API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }

      // Registro exitoso: mostrar mensaje, no hay login automático (requiere verificación)
      this.els.registerError.innerHTML = `<span style="color: #8ab4f8;">${data.message || data.error}</span>`;
      this.els.formRegister.reset();
      setTimeout(() => this.closeModals(), 2000);
    } catch (err) {
      this.setError(this.els.registerError, err.message, email);
    }
  }

  async handleResendVerification(email, errorElement) {
    const btn = errorElement.querySelector('.btn-resend');
    const originalText = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    try {
      const res = await fetch(`${this.API_BASE}/auth/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Error ${res.status}`);
      }

      errorElement.innerHTML = `<span style="color: #8ab4f8;">${data.message}</span>`;
    } catch (err) {
      errorElement.innerHTML = `<span>${err.message}</span>`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  setAuth(accessToken, refreshToken, user) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;
    this.saveToStorage();
    this.updateUI();
  }

  async logout() {
    if (!this.refreshToken) {
      this.clearAuth();
      return;
    }

    try {
      await fetch(`${this.API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
    } catch {
      // Ignorar errores de red al hacer logout
    } finally {
      this.clearAuth();
    }
  }

  clearAuth() {
    this.clearStorage();
    this.updateUI();
    this.notifyChange();
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return null;

    try {
      const res = await fetch(`${this.API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) {
        this.clearAuth();
        return null;
      }

      const data = await res.json();
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.saveToStorage();
      return this.accessToken;
    } catch {
      this.clearAuth();
      return null;
    }
  }

  getAuthHeader() {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  async fetchWithAuth(url, options = {}) {
    const headers = {
      ...options.headers,
      ...this.getAuthHeader(),
    };

    let res = await fetch(url, { ...options, headers });

    if (res.status === 401 && this.refreshToken) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        res = await fetch(url, { ...options, headers });
      }
    }

    return res;
  }

  updateUI() {
    const { els } = this;
    const isLoggedIn = !!this.accessToken;

    els.authButtons?.classList.toggle('hidden', isLoggedIn);
    els.userMenu?.classList.toggle('hidden', !isLoggedIn);

    if (isLoggedIn && this.user) {
      els.userEmail.textContent = this.user.email;
      els.verificationBadge.textContent = this.user.isVerified ? 'Verificado' : 'Sin verificar';
      els.verificationBadge.classList.toggle('verified', this.user.isVerified);
    }
  }

  onAuthChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyChange() {
    this.listeners.forEach(cb => cb(this.user));
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUser() {
    return this.user;
  }
}