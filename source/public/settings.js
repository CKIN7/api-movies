import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';
const THEMES = ['light', 'dark', 'system'];
const PRIVACY_LEVELS = ['public', 'friends', 'private'];

function toast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function apiError(data, status) {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (status === 429) return 'Demasiadas solicitudes. Esperá un momento.';
  return `Error ${status}`;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
}

class SettingsPage {
  constructor(apiBase, auth) {
    this.apiBase = apiBase;
    this.auth = auth;
    this.settings = null;
    this.original = null;
    this.saving = false;
    this.els = {};
  }

  init() {
    this.bindElements();
    this.bindEvents();
  }

  bindElements() {
    this.els = {
      loginRequired: document.getElementById('login-required'),
      app: document.getElementById('app'),
      form: document.getElementById('settings-form'),
      language: document.getElementById('settings-language'),
      errorLanguage: document.getElementById('error-language'),
      theme: document.getElementById('settings-theme'),
      region: document.getElementById('settings-region'),
      errorRegion: document.getElementById('error-region'),
      notifyEmail: document.getElementById('settings-notify-email'),
      notifyPush: document.getElementById('settings-notify-push'),
      privacyReviews: document.getElementById('settings-privacy-reviews'),
      privacyWatchlist: document.getElementById('settings-privacy-watchlist'),
      privacyActivity: document.getElementById('settings-privacy-activity'),
      spoilerFree: document.getElementById('settings-spoiler-free'),
      onboardingStatus: document.getElementById('settings-onboarding-status'),
      updated: document.getElementById('settings-updated'),
      saveBtn: document.getElementById('btn-save-settings'),
      saveStatus: document.getElementById('settings-save-status'),
      formError: document.getElementById('settings-form-error'),
    };
  }

  bindEvents() {
    this.els.form?.addEventListener('submit', event => this.save(event));

    for (const el of this.editableElements()) {
      el?.addEventListener('input', () => this.updateDirty());
      el?.addEventListener('change', () => this.updateDirty());
    }

    this.els.theme?.addEventListener('change', () => {
      applyTheme(this.els.theme.value);
      this.updateDirty();
    });

    this.els.region?.addEventListener('input', () => {
      this.els.region.value = this.els.region.value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);
      this.updateDirty();
    });
  }

  editableElements() {
    return [
      this.els.language,
      this.els.region,
      this.els.notifyEmail,
      this.els.notifyPush,
      this.els.privacyReviews,
      this.els.privacyWatchlist,
      this.els.privacyActivity,
      this.els.spoilerFree,
    ];
  }

  async refresh() {
    const loggedIn = !!this.auth.accessToken;
    this.els.loginRequired.classList.toggle('hidden', loggedIn);
    this.els.app.classList.toggle('hidden', !loggedIn);

    if (!loggedIn) {
      this.settings = null;
      this.original = null;
      return;
    }

    await this.loadSettings();
  }

  async loadSettings() {
    this.setFormError('');
    try {
      const res = await this.auth.fetchWithAuth(`${this.apiBase}/users/me/settings`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        this.auth.clearAuth();
        throw new Error('Tu sesión expiró. Iniciá sesión de nuevo.');
      }
      if (!res.ok) throw new Error(apiError(data, res.status));

      this.settings = data;
      this.render(data);
    } catch (err) {
      this.els.app.classList.add('hidden');
      this.els.loginRequired.classList.remove('hidden');
      this.setFormError(err.message);
      toast(err.message, true);
    }
  }

  render(settings) {
    this.els.language.value = settings.language || 'es';
    this.els.theme.value = THEMES.includes(settings.theme) ? settings.theme : 'system';
    this.els.region.value = settings.region || '';
    this.els.notifyEmail.checked = !!settings.notifyEmail;
    this.els.notifyPush.checked = !!settings.notifyPush;
    this.els.privacyReviews.value = settings.privacyReviews || 'public';
    this.els.privacyWatchlist.value = settings.privacyWatchlist || 'public';
    this.els.privacyActivity.value = settings.privacyActivity || 'friends';
    this.els.spoilerFree.checked = !!settings.spoilerFree;

    this.els.onboardingStatus.textContent = settings.onboardingCompleted ? 'Completado' : 'Pendiente';
    this.els.onboardingStatus.className = `badge ${settings.onboardingCompleted ? 'done' : 'pending'}`;
    this.els.updated.textContent = settings.updatedAt
      ? `Última actualización: ${formatDate(settings.updatedAt)}`
      : 'Configuración sin guardar.';

    applyTheme(this.els.theme.value);
    this.clearErrors();
    this.setFormError('');
    this.els.saveStatus.textContent = '';
    this.original = this.readForm();
    this.updateDirty();
  }

  readForm() {
    return {
      language: this.els.language.value,
      theme: this.els.theme.value,
      region: normalizeText(this.els.region.value).toUpperCase() || null,
      notifyEmail: this.els.notifyEmail.checked,
      notifyPush: this.els.notifyPush.checked,
      privacyReviews: this.els.privacyReviews.value,
      privacyWatchlist: this.els.privacyWatchlist.value,
      privacyActivity: this.els.privacyActivity.value,
      spoilerFree: this.els.spoilerFree.checked,
    };
  }

  diff(values) {
    if (!this.original) return {};
    const changed = {};
    for (const key of Object.keys(values)) {
      if (JSON.stringify(values[key]) !== JSON.stringify(this.original[key])) {
        changed[key] = values[key];
      }
    }
    return changed;
  }

  updateDirty() {
    if (!this.original) {
      this.els.saveBtn.disabled = true;
      return;
    }
    const changed = this.diff(this.readForm());
    this.els.saveBtn.disabled = this.saving || Object.keys(changed).length === 0;
  }

  clearErrors() {
    this.els.errorLanguage.textContent = '';
    this.els.errorRegion.textContent = '';
    this.els.language.setAttribute('aria-invalid', 'false');
    this.els.region.setAttribute('aria-invalid', 'false');
    this.setFormError('');
  }

  setFieldError(name, message) {
    if (name === 'language') {
      this.els.errorLanguage.textContent = message;
      this.els.language.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    if (name === 'region') {
      this.els.errorRegion.textContent = message;
      this.els.region.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  setFormError(message) {
    this.els.formError.textContent = message;
  }

  validate(values) {
    this.clearErrors();
    let valid = true;

    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(values.language)) {
      this.setFieldError('language', 'Elegí un idioma válido.');
      valid = false;
    }

    if (!THEMES.includes(values.theme)) {
      this.setFormError('Elegí un tema válido.');
      valid = false;
    }

    if (values.region !== null && !/^[A-Z]{2}$/.test(values.region)) {
      this.setFieldError('region', 'Usá un código de región de 2 letras.');
      valid = false;
    }

    for (const key of ['privacyReviews', 'privacyWatchlist', 'privacyActivity']) {
      if (!PRIVACY_LEVELS.includes(values[key])) {
        this.setFormError('Elegí un nivel de privacidad válido.');
        valid = false;
      }
    }

    if (!valid && !this.els.formError.textContent) {
      this.setFormError('Revisá los campos marcados.');
    }
    return valid;
  }

  setSaving(saving) {
    this.saving = saving;
    this.els.saveBtn.textContent = saving ? 'Guardando...' : 'Guardar configuración';
    this.els.saveStatus.textContent = saving ? 'Guardando...' : '';
    this.els.saveBtn.disabled = saving;
    if (!saving) this.updateDirty();
  }

  async save(event) {
    event.preventDefault();
    if (!this.original) return;

    const values = this.readForm();
    if (!this.validate(values)) return;

    const payload = this.diff(values);
    if (Object.keys(payload).length === 0) {
      toast('No hay cambios para guardar');
      return;
    }

    this.setSaving(true);
    this.setFormError('');

    try {
      const res = await this.auth.fetchWithAuth(`${this.apiBase}/users/me/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        this.auth.clearAuth();
        throw new Error('Tu sesión expiró. Iniciá sesión de nuevo.');
      }
      if (!res.ok) throw new Error(apiError(data, res.status));

      this.settings = data;
      this.render(data);
      toast('Configuración actualizada');
    } catch (err) {
      this.setFormError(err.message);
      toast(err.message, true);
    } finally {
      this.setSaving(false);
    }
  }
}

const auth = new Auth(API_BASE);
const page = new SettingsPage(API_BASE, auth);

auth.init();
page.init();
auth.onAuthChange(() => page.refresh());
page.refresh();
