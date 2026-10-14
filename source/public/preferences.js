import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';

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

// ═══════════════════════════════════════════════
//  Preferences (F1)
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
    this.loadGenres();
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
  }

  renderGenres() {
    this.els.genreChips.innerHTML = '';
    for (const g of this.genres) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'genre-chip';
      chip.textContent = g.name;
      chip.dataset.id = g.id;
      chip.addEventListener('click', () => {
        if (this.selectedGenres.has(g.id)) {
          this.selectedGenres.delete(g.id);
          chip.classList.remove('selected');
        } else {
          this.selectedGenres.add(g.id);
          chip.classList.add('selected');
        }
      });
      this.els.genreChips.appendChild(chip);
    }
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
      .map(([id, points]) => ({ id: Number(id), points }))
      .sort((a, b) => b.points - a.points);

    if (entries.length === 0) {
      this.els.affinityChips.innerHTML = '<span class="affinity-empty">Sin interacciones aún — posteá una review o agregá a watchlist</span>';
      return;
    }

    this.els.affinityChips.innerHTML = '';
    for (const { id, points } of entries) {
      const genre = this.genres.find(g => g.id === id);
      const chip = document.createElement('span');
      chip.className = 'affinity-chip';
      chip.textContent = `${genre ? genre.name : `#${id}`}: ${points} pts`;
      this.els.affinityChips.appendChild(chip);
    }
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
    } catch (err) {
      toast(err.message, true);
    }
  }
}

// ═══════════════════════════════════════════════
//  Recommendations (F2)
// ═══════════════════════════════════════════════
class Recommendations {
  constructor(apiBase, auth) {
    this.API_BASE = apiBase;
    this.auth = auth;
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
        this.showStatus('Cold start: no hay señales todavía. Posteá una review o agregá películas a tu watchlist.');
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

      const genres = (item.movie.genres || [])
        .map(g => `<span>${g}</span>`).join('');

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
      `;
      this.els.grid.appendChild(card);
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
//  InteractionSimulator (puente F1→F2)
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
const recommendations = new Recommendations(API_BASE, auth);
const simulator = new InteractionSimulator(API_BASE, auth, () => {
  preferences.load();
  recommendations.load();
});

auth.init();
preferences.init();
recommendations.init();
simulator.init();

function refreshAll() {
  const loggedIn = !!auth.accessToken;
  document.getElementById('app')?.classList.toggle('hidden', !loggedIn);
  document.getElementById('login-required')?.classList.toggle('hidden', loggedIn);
  if (loggedIn) {
    preferences.load();
    recommendations.load();
  }
}

auth.onAuthChange(refreshAll);
refreshAll();

console.log('Preferences & Recommendations — inicializado');
