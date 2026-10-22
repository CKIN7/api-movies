import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';
const labMode = new URLSearchParams(location.search).has('lab');
let labPanel = null;

// ═══════════════════════════════════════════════
//  Toasts
// ═══════════════════════════════════════════════
function toast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function parseIds(value) {
  return value
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => Number.isInteger(n) && n > 0);
}

function uniqueIds(values) {
  return [...new Set(values)];
}

function renderGenreChips(container, genres, selectedGenres, onToggle) {
  container.innerHTML = '';
  for (const g of genres) {
    const id = Number(g.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'genre-chip';
    chip.textContent = g.name;
    chip.dataset.id = id;
    chip.classList.toggle('selected', selectedGenres.has(id));
    chip.addEventListener('click', () => {
      if (selectedGenres.has(id)) {
        selectedGenres.delete(id);
        chip.classList.remove('selected');
      } else {
        selectedGenres.add(id);
        chip.classList.add('selected');
      }
      onToggle?.(id, selectedGenres.has(id));
    });
    container.appendChild(chip);
  }
}

// ═══════════════════════════════════════════════
//  Preferences (F2)
// ═══════════════════════════════════════════════
class Preferences {
  constructor(apiBase, auth) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.genres = [];       // [{ id, name }]
    this.selectedGenres = new Set();
    this.els = {};
  }

  init() {
    this.bindElements();
    this.genresPromise = this.loadGenres();
    this.els.saveBtn?.addEventListener('click', () => this.save());
  }

  bindElements() {
    this.els = {
      genreChips: document.getElementById('genre-chips'),
      favDirectors: document.getElementById('fav-directors'),
      favActors: document.getElementById('fav-actors'),
      saveBtn: document.getElementById('btn-save-prefs'),
      affinityChips: document.getElementById('affinity-chips'),
      updatedAt: document.getElementById('prefs-updated'),
    };
  }

  async loadGenres() {
    try {
      const res = await fetch(`${this.API_BASE}/movies/genres?full=true`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      this.genres = await res.json();
      this.renderGenres();
    } catch (err) {
      this.els.genreChips.innerHTML = `<span class="affinity-empty">Error cargando géneros: ${err.message}</span>`;
    }
    return this.genres;
  }

  renderGenres() {
    renderGenreChips(this.els.genreChips, this.genres, this.selectedGenres);
  }

  async load() {
    try {
      const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/preferences`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const prefs = await res.json();

      this.selectedGenres = new Set(prefs.favoriteGenres || []);
      this.renderSelectedGenres();
      this.els.favDirectors.value = (prefs.favoriteDirectors || []).join(', ');
      this.els.favActors.value = (prefs.favoriteActors || []).join(', ');
      this.renderAffinity(prefs.genreAffinity || {});
      this.els.updatedAt.textContent = prefs.updatedAt
        ? `Última actualización: ${new Date(prefs.updatedAt).toLocaleString()}`
        : '';
    } catch (err) {
      toast(`Error cargando preferencias: ${err.message}`, true);
    }
  }

  renderSelectedGenres() {
    this.els.genreChips.querySelectorAll('.genre-chip').forEach(chip => {
      const id = Number(chip.dataset.id);
      chip.classList.toggle('selected', this.selectedGenres.has(id));
    });
  }

  renderAffinity(affinity) {
    const entries = Object.entries(affinity)
      .map(([id, value]) => {
        if (typeof value === 'number') {
          return { id: Number(id), score: value, updatedAt: null };
        }
        return {
          id: Number(id),
          score: Number(value?.score ?? 0),
          updatedAt: value?.updatedAt || null,
        };
      })
      .filter(entry => Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score);

    if (entries.length === 0) {
      this.els.affinityChips.innerHTML = '<span class="affinity-empty">Sin señales aún — posteá una review, agregá a watchlist o usá feedback</span>';
      return;
    }

    this.els.affinityChips.innerHTML = '';
    for (const { id, score, updatedAt } of entries) {
      const genre = this.genres.find(g => g.id === id);
      const chip = document.createElement('span');
      chip.className = 'affinity-chip';
      const date = updatedAt ? ` · ${new Date(updatedAt).toLocaleDateString()}` : '';
      chip.textContent = `${genre ? genre.name : `#${id}`}: ${score} pts${date}`;
      this.els.affinityChips.appendChild(chip);
    }
    labPanel?.mark('affinity', `${entries.length} géneros`);
  }

  async save() {
    const body = {
      favoriteGenres: [...this.selectedGenres],
      favoriteDirectors: parseIds(this.els.favDirectors.value),
      favoriteActors: parseIds(this.els.favActors.value),
    };

    try {
      const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);

      toast('Preferencias guardadas');
      await this.load();
      onboarding.syncFromPreferences();
    } catch (err) {
      toast(err.message, true);
    }
  }
}

// ═══════════════════════════════════════════════
//  Settings (F3 — solo lectura)
// ═══════════════════════════════════════════════
class Settings {
  constructor(apiBase, auth) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.els = {};
    this.data = null;
  }

  init() {
    this.els = {
      status: document.getElementById('settings-status'),
    };
  }

  async load() {
    if (!this.els.status) return;
    this.els.status.textContent = 'Consultando settings…';
    this.els.status.className = 'settings-badge';

    try {
      const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/settings`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      this.data = data;

      const done = !!data.onboardingCompleted;
      this.els.status.textContent = done ? 'Onboarding completado' : 'Onboarding pendiente';
      this.els.status.classList.add(done ? 'done' : 'pending');

      document.getElementById('section-onboarding')?.classList.toggle('hidden', done && !labMode);
      labPanel?.mark('settings', done ? 'completado' : 'pendiente');
    } catch (err) {
      this.els.status.textContent = `Settings: ${err.message}`;
      this.els.status.classList.add('error');
    }
  }
}

// ═══════════════════════════════════════════════
//  Onboarding (F5)
// ═══════════════════════════════════════════════
class Onboarding {
  constructor(apiBase, auth, preferences, onCompleted) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.preferences = preferences;
    this.onCompleted = onCompleted;
    this.selectedGenres = new Set();
    this.els = {};
  }

  init() {
    this.els = {
      genreChips: document.getElementById('onboarding-genre-chips'),
      directors: document.getElementById('onboarding-directors'),
      btn: document.getElementById('btn-onboarding'),
      result: document.getElementById('onboarding-result'),
    };

    this.els.btn?.addEventListener('click', () => this.complete());
    this.preferences.genresPromise.then(() => this.renderGenres());
  }

  renderGenres() {
    if (!this.els.genreChips) return;
    if (this.preferences.genres.length === 0) {
      this.els.genreChips.innerHTML = '<span class="affinity-empty">No se pudieron cargar los géneros</span>';
      return;
    }
    renderGenreChips(this.els.genreChips, this.preferences.genres, this.selectedGenres);
  }

  syncFromPreferences() {
    this.selectedGenres = new Set(this.preferences.selectedGenres);
    this.els.genreChips?.querySelectorAll('.genre-chip').forEach(chip => {
      chip.classList.toggle('selected', this.selectedGenres.has(Number(chip.dataset.id)));
    });
    if (this.els.directors) {
      this.els.directors.value = this.preferences.els.favDirectors.value;
    }
  }

  async complete() {
    const genres = [...this.selectedGenres];
    if (genres.length < 1 || genres.length > 10) {
      return toast('Elegí entre 1 y 10 géneros para el onboarding', true);
    }

    const directors = uniqueIds(parseIds(this.els.directors.value));
    if (directors.length > 10) {
      return toast('Máximo 10 directores favoritos', true);
    }

    const body = { favoriteGenres: genres };
    if (directors.length > 0) body.favoriteDirectors = directors;

    this.els.btn.disabled = true;
    this.els.result.className = 'onboarding-result';
    this.els.result.textContent = 'Guardando onboarding…';

    try {
      const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);

      this.els.result.textContent = data.seeded
        ? `Onboarding completado. Seed inicial aplicado (${data.favoriteGenres.length} géneros).`
        : `Onboarding actualizado sin volver a aplicar el seed (${data.favoriteGenres.length} géneros).`;
      toast(data.seeded ? 'Onboarding completado (seed aplicado)' : 'Onboarding actualizado');

      this.selectedGenres = new Set(data.favoriteGenres || genres);
      labPanel?.mark('onboarding', data.seeded ? 'seed aplicado' : 'sin seed');

      await this.preferences.load();
      this.syncFromPreferences();
      await this.onCompleted?.();
    } catch (err) {
      this.els.result.className = 'onboarding-result error';
      this.els.result.textContent = err.message;
      toast(err.message, true);
    } finally {
      this.els.btn.disabled = false;
    }
  }
}

// ═══════════════════════════════════════════════
//  Recommendations (HU-11)
// ═══════════════════════════════════════════════
class Recommendations {
  constructor(apiBase, auth, options = {}) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.labMode = !!options.labMode;
    this.onFeedback = options.onFeedback;
    this.els = {};
  }

  init() {
    this.els = {
      type: document.getElementById('recs-type'),
      limit: document.getElementById('recs-limit'),
      loadBtn: document.getElementById('btn-load-recs'),
      grid: document.getElementById('recs-grid'),
      status: document.getElementById('recs-status'),
    };
    this.els.loadBtn?.addEventListener('click', () => this.load());
    this.els.type?.addEventListener('change', () => this.load());
    this.els.limit?.addEventListener('change', () => this.load());
    this.els.grid?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-feedback-action]');
      if (!btn) return;
      const movieId = Number(btn.dataset.movieId);
      this.onFeedback?.(movieId, btn.dataset.feedbackAction, btn);
    });
  }

  async load() {
    const type = this.els.type.value;
    const limit = this.els.limit.value;
    this.showStatus('Cargando recomendaciones…');
    this.els.grid.innerHTML = '';

    try {
      const res = await this.auth.fetchWithAuth(
        `${this.API_BASE}/users/me/recommendations?type=${type}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const items = await res.json();

      if (items.length === 0) {
        this.showStatus('Cold start: no hay señales todavía. Completá el onboarding, configurá preferencias o agregá interacciones.');
        labPanel?.mark('cold-start', 'sin señales');
        return;
      }
      this.hideStatus();
      this.render(items);
    } catch (err) {
      this.showStatus(`Error: ${err.message}`, true);
    }
  }

  render(items) {
    this.els.grid.innerHTML = '';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.dataset.movieId = item.movie.id;

      const genres = (item.movie.genres || [])
        .map(g => `<span>${g}</span>`).join('');

      const actions = this.labMode ? `
        <div class="rec-actions">
          <button type="button" class="btn btn-outline btn-xs" data-feedback-action="view" data-movie-id="${item.movie.id}">Vista</button>
          <button type="button" class="btn btn-outline btn-xs" data-feedback-action="hide" data-movie-id="${item.movie.id}">Ocultar</button>
          <button type="button" class="btn btn-outline btn-xs" data-feedback-action="like" data-movie-id="${item.movie.id}">Me gusta</button>
          <button type="button" class="btn btn-outline btn-xs" data-feedback-action="not_interested" data-movie-id="${item.movie.id}">No me interesa</button>
        </div>
      ` : '';

      card.innerHTML = `
        <div class="title">${item.movie.title}</div>
        <div class="meta">${item.movie.year} · ★ ${item.movie.rating}</div>
        <div class="director">${item.movie.director}</div>
        <div class="genres">${genres}</div>
        <div class="score-row">
          <div class="score-bar"><div class="score-fill" style="width:${Math.min(item.score, 100)}%"></div></div>
          <span class="score-num">${item.score}</span>
        </div>
        <div class="reason">${item.reason}</div>
        ${actions}
      `;
      this.els.grid.appendChild(card);
    }
  }

  async checkExclusion(movieId) {
    if (!this.labMode) return;
    const types = ['hybrid', 'content', 'collab'];

    try {
      const results = await Promise.all(types.map(async (type) => {
        const res = await this.auth.fetchWithAuth(
          `${this.API_BASE}/users/me/recommendations?type=${type}&limit=50`
        );
        if (!res.ok) return { type, present: null };
        const items = await res.json();
        return { type, present: items.some(item => item.movie.id === movieId) };
      }));

      const present = results.filter(result => result.present).map(result => result.type);
      const unknown = results.filter(result => result.present === null).map(result => result.type);

      if (present.length === 0) {
        toast('Excluida en hybrid, content y collab');
        labPanel?.mark('not-interested', 'excluida en 3 tipos');
      } else {
        toast(`Aún aparece en: ${present.join(', ')}`, true);
      }
      if (unknown.length > 0) {
        toast(`No se pudo verificar: ${unknown.join(', ')}`, true);
      }
    } catch (err) {
      toast(`No se pudo verificar la exclusión: ${err.message}`, true);
    }
  }

  showStatus(msg, isError = false) {
    this.els.status.textContent = msg;
    this.els.status.classList.remove('hidden');
    this.els.status.classList.toggle('error', isError);
  }

  hideStatus() {
    this.els.status.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════
//  Feedback (F4)
// ═══════════════════════════════════════════════
class Feedback {
  constructor(apiBase, auth, onApplied) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.onApplied = onApplied;
  }

  async send(movieId, action, btn) {
    const card = btn?.closest('.rec-card');
    const buttons = card ? [...card.querySelectorAll('[data-feedback-action]')] : [];
    buttons.forEach(button => { button.disabled = true; });

    try {
      const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/recommendations/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);

      if (data.applied) {
        toast(`Feedback "${action}" aplicado`);
        if (action === 'like') labPanel?.mark('like', 'aplicado');
        if (action === 'not_interested') labPanel?.mark('not-interested', 'aplicado');
        await this.onApplied?.(action, movieId);
      } else {
        toast(`Ese feedback ya estaba registrado: "${action}"`);
        if (action === 'like') labPanel?.mark('duplicate', 'applied:false');
        buttons.forEach(button => { button.disabled = false; });
      }
    } catch (err) {
      toast(err.message, true);
      buttons.forEach(button => { button.disabled = false; });
    }
  }
}

// ═══════════════════════════════════════════════
//  Lab panel (?lab=1)
// ═══════════════════════════════════════════════
class LabPanel {
  constructor(auth) {
    this.auth = auth;
    this.els = {};
  }

  init() {
    if (!labMode) return;
    this.els = {
      panel: document.getElementById('lab-panel'),
      log: document.getElementById('lab-log'),
      clearBtn: document.getElementById('btn-lab-clear'),
      logoutBtn: document.getElementById('btn-lab-logout'),
    };
    this.els.panel?.classList.remove('hidden');

    this.els.clearBtn?.addEventListener('click', () => {
      if (this.els.log) this.els.log.innerHTML = '';
    });
    this.els.logoutBtn?.addEventListener('click', async () => {
      await this.auth.logout();
      location.reload();
    });

    const toggleLink = document.getElementById('lab-toggle-link');
    if (toggleLink) {
      toggleLink.textContent = 'Volver al modo normal';
      toggleLink.href = '/preferences.html';
    }

    labPanel = this;
  }

  log(method, url, status, ms) {
    if (!this.els.log) return;

    let path = url;
    try {
      const parsed = new URL(url, location.origin);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      path = url;
    }

    const statusClass = status === 'ERR' ? 'err' : status >= 500 ? 'err' : status >= 400 ? 'warn' : 'ok';
    const row = document.createElement('div');
    row.className = 'lab-log-row';
    row.innerHTML = `
      <span class="lab-method">${method}</span>
      <span class="lab-path" title="${path}">${path}</span>
      <span class="lab-status ${statusClass}">${status}</span>
      <span class="lab-ms">${Math.round(ms)} ms</span>
    `;

    this.els.log.prepend(row);
    while (this.els.log.children.length > 100) {
      this.els.log.lastElementChild.remove();
    }
  }

  mark(step, note = '') {
    if (!labMode) return;
    const item = document.querySelector(`[data-lab-step="${step}"]`);
    if (!item) return;
    item.classList.add('done');
    const noteEl = item.querySelector('.lab-note');
    if (noteEl) noteEl.textContent = note ? `— ${note}` : '';
  }
}

// ═══════════════════════════════════════════════
//  InteractionSimulator (puente F2→HU-11)
// ═══════════════════════════════════════════════
class InteractionSimulator {
  constructor(apiBase, auth, onMutated) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.onMutated = onMutated;   // callback: refresca preferences + recommendations
    this.els = {};
  }

  init() {
    this.els = {
      reviewMovie: document.getElementById('sim-review-movie'),
      reviewRating: document.getElementById('sim-review-rating'),
      btnReview: document.getElementById('btn-sim-review'),
      reviewDelMovie: document.getElementById('sim-review-del-movie'),
      btnUnreview: document.getElementById('btn-sim-unreview'),
      watchMovie: document.getElementById('sim-watch-movie'),
      watchPriority: document.getElementById('sim-watch-priority'),
      btnWatch: document.getElementById('btn-sim-watch'),
      watchDelMovie: document.getElementById('sim-watch-del-movie'),
      btnUnwatch: document.getElementById('btn-sim-unwatch'),
    };

    this.els.btnReview?.addEventListener('click', () => this.postReview());
    this.els.btnUnreview?.addEventListener('click', () => this.deleteReview());
    this.els.btnWatch?.addEventListener('click', () => this.addWatchlist());
    this.els.btnUnwatch?.addEventListener('click', () => this.removeWatchlist());
  }

  async postReview() {
    const movieId = Number(this.els.reviewMovie.value);
    const rating = Number(this.els.reviewRating.value);
    if (!movieId || !rating) return toast('Completá movieId y rating', true);

    const res = await this.auth.fetchWithAuth(`${this.API_BASE}/movies/${movieId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || `Error ${res.status}`, true);

    toast(`Review de movie ${movieId} guardada (rating ${rating})`);
    this.onMutated();
  }

  async deleteReview() {
    const movieId = Number(this.els.reviewDelMovie.value);
    if (!movieId) return toast('Completá el movieId a eliminar', true);

    const res = await this.auth.fetchWithAuth(`${this.API_BASE}/movies/${movieId}/reviews`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      return toast(data.error || `Error ${res.status}`, true);
    }

    toast(`Review de movie ${movieId} eliminada`);
    this.onMutated();
  }

  async addWatchlist() {
    const movieId = Number(this.els.watchMovie.value);
    const priority = Number(this.els.watchPriority.value);
    if (!movieId || !priority) return toast('Completá movieId y priority', true);

    const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, priority }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || `Error ${res.status}`, true);

    toast(`Movie ${movieId} agregada a watchlist (priority ${priority})`);
    this.onMutated();
  }

  async removeWatchlist() {
    const movieId = Number(this.els.watchDelMovie.value);
    if (!movieId) return toast('Completá el movieId a quitar', true);

    const res = await this.auth.fetchWithAuth(`${this.API_BASE}/users/me/watchlist/${movieId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      return toast(data.error || `Error ${res.status}`, true);
    }

    toast(`Movie ${movieId} quitada de watchlist`);
    this.onMutated();
  }
}

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════
const auth = new Auth(API_BASE);
const preferences = new Preferences(API_BASE, auth);
const settings = new Settings(API_BASE, auth);
const feedback = new Feedback(API_BASE, auth, async (action, movieId) => {
  await preferences.load();
  await Promise.all([settings.load(), recommendations.load()]);
  if (action === 'not_interested') {
    await recommendations.checkExclusion(movieId);
  }
});
const recommendations = new Recommendations(API_BASE, auth, {
  labMode,
  onFeedback: (movieId, action, btn) => feedback.send(movieId, action, btn),
});
const onboarding = new Onboarding(API_BASE, auth, preferences, async () => {
  await Promise.all([settings.load(), recommendations.load()]);
});
const simulator = new InteractionSimulator(API_BASE, auth, async () => {
  await preferences.load();
  await recommendations.load();
});

auth.init();
labPanel = new LabPanel(auth);
labPanel.init();

if (labMode) {
  const originalFetchWithAuth = auth.fetchWithAuth.bind(auth);
  auth.fetchWithAuth = async (url, options = {}) => {
    const start = performance.now();
    try {
      const res = await originalFetchWithAuth(url, options);
      labPanel.log(options.method || 'GET', url, res.status, performance.now() - start);
      return res;
    } catch (err) {
      labPanel.log(options.method || 'GET', url, 'ERR', performance.now() - start);
      throw err;
    }
  };
}

preferences.init();
settings.init();
recommendations.init();
onboarding.init();
simulator.init();

async function refreshAll() {
  const loggedIn = !!auth.accessToken;
  document.getElementById('app')?.classList.toggle('hidden', !loggedIn);
  document.getElementById('login-required')?.classList.toggle('hidden', loggedIn);
  if (loggedIn) {
    await preferences.load();
    onboarding.syncFromPreferences();
    await Promise.all([settings.load(), recommendations.load()]);
  }
}

auth.onAuthChange(refreshAll);
refreshAll();

console.log(`Preferences & Recommendations — inicializado${labMode ? ' (modo laboratorio)' : ''}`);
