import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';
const publicId = new URLSearchParams(location.search).get('id');

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

function hasHtml(value) {
  return /<[^>]*>/i.test(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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

function initials(name) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function setChips(container, items, labelKey) {
  container.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'chip empty';
    empty.textContent = 'Sin datos';
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${item[labelKey]} (${item.count})`;
    container.appendChild(chip);
  }
}

class ProfilePage {
  constructor(apiBase, auth, publicIdValue) {
    this.apiBase = apiBase;
    this.auth = auth;
    this.publicId = publicIdValue;
    this.mode = publicIdValue ? 'public' : 'own';
    this.profile = null;
    this.original = null;
    this.saving = false;
    this.els = {};
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.setBirthYearLimit();

    if (this.mode === 'public') {
      this.els.pageTitle.textContent = 'Perfil público';
      this.els.pageSubtitle.textContent = 'Vista pública del perfil';
      this.els.loginRequired.classList.add('hidden');
      this.els.app.classList.add('hidden');
      this.els.publicView.classList.remove('hidden');
    }
  }

  bindElements() {
    this.els = {
      pageTitle: document.getElementById('page-title'),
      pageSubtitle: document.getElementById('page-subtitle'),
      loginRequired: document.getElementById('login-required'),
      app: document.getElementById('app'),
      form: document.getElementById('profile-form'),
      displayName: document.getElementById('profile-display-name'),
      displayNameCount: document.getElementById('display-name-count'),
      errorDisplayName: document.getElementById('error-display-name'),
      bio: document.getElementById('profile-bio'),
      bioCount: document.getElementById('bio-count'),
      errorBio: document.getElementById('error-bio'),
      avatarUrl: document.getElementById('profile-avatar-url'),
      errorAvatarUrl: document.getElementById('error-avatar-url'),
      avatarPreview: document.getElementById('avatar-preview'),
      avatarFallback: document.getElementById('avatar-fallback'),
      country: document.getElementById('profile-country'),
      errorCountry: document.getElementById('error-country'),
      birthYear: document.getElementById('profile-birth-year'),
      birthYearHint: document.getElementById('birth-year-hint'),
      errorBirthYear: document.getElementById('error-birth-year'),
      isPublic: document.getElementById('profile-is-public'),
      saveBtn: document.getElementById('btn-save-profile'),
      saveStatus: document.getElementById('profile-save-status'),
      formError: document.getElementById('profile-form-error'),
      updated: document.getElementById('profile-updated'),
      publicLinkWrap: document.getElementById('profile-public-link-wrap'),
      publicLink: document.getElementById('profile-public-link'),
      publicView: document.getElementById('public-view'),
      publicStatus: document.getElementById('public-status'),
      publicCard: document.getElementById('public-card'),
      publicAvatar: document.getElementById('public-avatar'),
      publicAvatarFallback: document.getElementById('public-avatar-fallback'),
      publicName: document.getElementById('public-profile-name'),
      publicCountry: document.getElementById('public-profile-country'),
      publicBio: document.getElementById('public-profile-bio'),
      privateNote: document.getElementById('public-private-note'),
      publicStats: document.getElementById('public-stats'),
      publicTopGenres: document.getElementById('public-top-genres'),
      publicTopDirectors: document.getElementById('public-top-directors'),
      publicTotalReviews: document.getElementById('public-total-reviews'),
      publicTotalWatchlist: document.getElementById('public-total-watchlist'),
    };
  }

  bindEvents() {
    this.els.form?.addEventListener('submit', event => this.save(event));

    this.els.displayName?.addEventListener('input', () => {
      this.updateCounters();
      this.updateAvatarPreview(
        this.els.avatarUrl.value,
        this.els.avatarPreview,
        this.els.avatarFallback,
        this.els.displayName.value,
      );
      this.updateDirty();
    });

    this.els.bio?.addEventListener('input', () => {
      this.updateCounters();
      this.updateDirty();
    });

    this.els.avatarUrl?.addEventListener('input', () => {
      this.updateAvatarPreview(
        this.els.avatarUrl.value,
        this.els.avatarPreview,
        this.els.avatarFallback,
        this.els.displayName.value,
      );
      this.updateDirty();
    });

    this.els.country?.addEventListener('input', () => {
      this.els.country.value = this.els.country.value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);
      this.updateDirty();
    });

    this.els.birthYear?.addEventListener('input', () => this.updateDirty());
    this.els.isPublic?.addEventListener('change', () => this.updateDirty());
  }

  setBirthYearLimit() {
    const max = new Date().getFullYear() - 13;
    if (this.els.birthYear) this.els.birthYear.max = String(max);
    if (this.els.birthYearHint) {
      this.els.birthYearHint.textContent = `Debés tener al menos 13 años (máximo ${max}).`;
    }
  }

  async refresh() {
    if (this.mode === 'public') return;

    const loggedIn = !!this.auth.accessToken;
    this.els.loginRequired.classList.toggle('hidden', loggedIn);
    this.els.app.classList.toggle('hidden', !loggedIn);

    if (!loggedIn) {
      this.profile = null;
      this.original = null;
      return;
    }

    await this.loadOwn();
  }

  async loadOwn() {
    this.setFormError('');
    try {
      const res = await this.auth.fetchWithAuth(`${this.apiBase}/users/me/profile`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        this.auth.clearAuth();
        throw new Error('Tu sesión expiró. Iniciá sesión de nuevo.');
      }
      if (!res.ok) throw new Error(apiError(data, res.status));

      this.profile = data;
      this.renderOwn(data);
    } catch (err) {
      this.els.app.classList.add('hidden');
      this.els.loginRequired.classList.remove('hidden');
      this.setFormError(err.message);
      toast(err.message, true);
    }
  }

  renderOwn(profile) {
    this.els.displayName.value = profile.displayName || '';
    this.els.bio.value = profile.bio || '';
    this.els.avatarUrl.value = profile.avatarUrl || '';
    this.els.country.value = profile.country || '';
    this.els.birthYear.value = profile.birthYear ?? '';
    this.els.isPublic.checked = !!profile.isPublic;

    this.updateCounters();
    this.updateAvatarPreview(
      this.els.avatarUrl.value,
      this.els.avatarPreview,
      this.els.avatarFallback,
      this.els.displayName.value,
    );
    this.updatePublicLink(profile);
    this.clearErrors();
    this.setFormError('');
    this.els.saveStatus.textContent = '';

    const dates = [];
    if (profile.createdAt) dates.push(`Creado: ${formatDate(profile.createdAt)}`);
    if (profile.updatedAt) dates.push(`Actualizado: ${formatDate(profile.updatedAt)}`);
    this.els.updated.textContent = dates.join(' · ') || 'Perfil sin guardar';

    this.original = this.readForm();
    this.updateDirty();
  }

  updatePublicLink(profile) {
    const userId = this.auth.user?.id;
    const canShare = !!profile.isPublic && !!userId;
    this.els.publicLinkWrap.classList.toggle('hidden', !canShare);
    if (canShare) {
      this.els.publicLink.href = `/profile.html?id=${encodeURIComponent(userId)}`;
    } else {
      this.els.publicLink.removeAttribute('href');
    }
  }

  updateCounters() {
    this.els.displayNameCount.textContent = String(this.els.displayName.value.length);
    this.els.bioCount.textContent = String(this.els.bio.value.length);
  }

  updateAvatarPreview(url, image, fallback, name) {
    const value = normalizeText(url);
    const showImage = !!value && isHttpUrl(value);

    image.classList.toggle('hidden', !showImage);
    fallback.classList.toggle('hidden', showImage);
    fallback.textContent = initials(name);

    if (!showImage) {
      image.removeAttribute('src');
      image.onerror = null;
      return;
    }

    image.onerror = () => {
      image.classList.add('hidden');
      fallback.classList.remove('hidden');
    };
    image.src = value;
  }

  readForm() {
    const birthYearValue = this.els.birthYear.value.trim();
    return {
      displayName: normalizeText(this.els.displayName.value) || null,
      bio: normalizeText(this.els.bio.value) || null,
      avatarUrl: normalizeText(this.els.avatarUrl.value) || null,
      country: normalizeText(this.els.country.value).toUpperCase() || null,
      birthYear: birthYearValue === '' ? null : Number(birthYearValue),
      isPublic: this.els.isPublic.checked,
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
    const fields = [
      ['displayName', this.els.errorDisplayName],
      ['bio', this.els.errorBio],
      ['avatarUrl', this.els.errorAvatarUrl],
      ['country', this.els.errorCountry],
      ['birthYear', this.els.errorBirthYear],
    ];
    for (const [name, errorEl] of fields) {
      errorEl.textContent = '';
      const input = this.els[name];
      input?.setAttribute('aria-invalid', 'false');
    }
    this.setFormError('');
  }

  setFieldError(name, message) {
    const errorMap = {
      displayName: this.els.errorDisplayName,
      bio: this.els.errorBio,
      avatarUrl: this.els.errorAvatarUrl,
      country: this.els.errorCountry,
      birthYear: this.els.errorBirthYear,
    };
    const inputMap = {
      displayName: this.els.displayName,
      bio: this.els.bio,
      avatarUrl: this.els.avatarUrl,
      country: this.els.country,
      birthYear: this.els.birthYear,
    };
    const errorEl = errorMap[name];
    const input = inputMap[name];
    if (errorEl) errorEl.textContent = message;
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  setFormError(message) {
    this.els.formError.textContent = message;
  }

  validate(values) {
    this.clearErrors();
    let valid = true;
    const maxYear = new Date().getFullYear() - 13;

    if (values.displayName !== null) {
      if (values.displayName.length < 2 || values.displayName.length > 50) {
        this.setFieldError('displayName', 'El nombre debe tener entre 2 y 50 caracteres.');
        valid = false;
      } else if (hasHtml(values.displayName)) {
        this.setFieldError('displayName', 'El nombre no puede contener HTML.');
        valid = false;
      }
    }

    if (values.bio !== null) {
      if (values.bio.length > 300) {
        this.setFieldError('bio', 'La bio no puede superar los 300 caracteres.');
        valid = false;
      } else if (hasHtml(values.bio)) {
        this.setFieldError('bio', 'La bio no puede contener HTML.');
        valid = false;
      }
    }

    if (values.avatarUrl !== null) {
      if (values.avatarUrl.length > 500) {
        this.setFieldError('avatarUrl', 'La URL no puede superar los 500 caracteres.');
        valid = false;
      } else if (!isHttpUrl(values.avatarUrl)) {
        this.setFieldError('avatarUrl', 'La URL debe empezar con http:// o https://.');
        valid = false;
      }
    }

    if (values.country !== null && !/^[A-Z]{2}$/.test(values.country)) {
      this.setFieldError('country', 'Usá un código de país de 2 letras.');
      valid = false;
    }

    if (values.birthYear !== null) {
      if (!Number.isInteger(values.birthYear) || values.birthYear < 1900 || values.birthYear > maxYear) {
        this.setFieldError('birthYear', `Ingresá un año entre 1900 y ${maxYear}.`);
        valid = false;
      }
    }

    if (!valid) this.setFormError('Revisá los campos marcados.');
    return valid;
  }

  setSaving(saving) {
    this.saving = saving;
    this.els.saveBtn.textContent = saving ? 'Guardando...' : 'Guardar perfil';
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
      const res = await this.auth.fetchWithAuth(`${this.apiBase}/users/me/profile`, {
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

      this.profile = data;
      this.renderOwn(data);
      toast('Perfil actualizado');
    } catch (err) {
      this.setFormError(err.message);
      toast(err.message, true);
    } finally {
      this.setSaving(false);
    }
  }

  async loadPublic() {
    this.els.publicStatus.textContent = 'Cargando perfil...';
    this.els.publicStatus.classList.remove('error');
    this.els.publicCard.classList.add('hidden');

    try {
      const res = await fetch(`${this.apiBase}/users/${encodeURIComponent(this.publicId)}/profile`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = res.status === 404
          ? 'Perfil no encontrado.'
          : res.status === 400
            ? 'El identificador del perfil no es válido.'
            : apiError(data, res.status);
        throw new Error(message);
      }

      this.renderPublic(data);
    } catch (err) {
      this.els.publicStatus.textContent = err.message;
      this.els.publicStatus.classList.add('error');
    }
  }

  renderPublic(profile) {
    this.els.publicStatus.textContent = '';
    this.els.publicStatus.classList.remove('error');
    this.els.publicCard.classList.remove('hidden');

    const isPublic = !!profile.isPublic;
    this.els.publicName.textContent = isPublic
      ? (profile.displayName || 'Usuario sin nombre')
      : 'Perfil privado';
    this.els.publicCountry.textContent = isPublic ? (profile.country || '') : '';
    this.els.publicBio.textContent = isPublic ? (profile.bio || 'Sin bio.') : '';
    this.els.publicBio.classList.toggle('hidden', !isPublic);
    this.els.privateNote.classList.toggle('hidden', isPublic);
    this.els.publicStats.classList.toggle('hidden', !isPublic);

    this.updateAvatarPreview(
      isPublic ? profile.avatarUrl : null,
      this.els.publicAvatar,
      this.els.publicAvatarFallback,
      profile.displayName,
    );

    if (!isPublic) return;

    const stats = profile.stats || {};
    setChips(this.els.publicTopGenres, stats.topGenres, 'genreName');
    setChips(this.els.publicTopDirectors, stats.topDirectors, 'directorName');
    this.els.publicTotalReviews.textContent = String(stats.totalReviews ?? 0);
    this.els.publicTotalWatchlist.textContent = String(stats.totalWatchlist ?? 0);
  }
}

const auth = new Auth(API_BASE);
const page = new ProfilePage(API_BASE, auth, publicId);

auth.init();
page.init();

if (publicId) {
  page.loadPublic();
} else {
  auth.onAuthChange(() => page.refresh());
  page.refresh();
}
