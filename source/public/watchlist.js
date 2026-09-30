export class Watchlist {
  constructor(apiBase = 'http://localhost:8089', auth = null) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.movies = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalItems = 0;
    this.filters = this.loadFilters();
    this.els = {};
    this.toastContainer = null;
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.applyFiltersToUI();
    this.createToastContainer();
    this.loadGenres();
    this.auth?.onAuthChange(() => {
      if (this.auth?.accessToken) {
        this.refresh();
      } else {
        this.movies = [];
        this.render();
      }
    });
  }

  bindElements() {
    this.els = {
      section: document.getElementById('section-watchlist'),
      grid: document.getElementById('watchlist-grid'),
      status: document.getElementById('watchlist-status'),
      emptyCta: document.getElementById('watchlist-empty-cta'),
      filterGenre: document.getElementById('filter-wl-genre'),
      filterSortBy: document.getElementById('filter-wl-sortBy'),
      filterSortOrder: document.getElementById('filter-wl-sortOrder'),
      btnPrev: document.getElementById('wl-btn-prev'),
      btnNext: document.getElementById('wl-btn-next'),
      pageInfo: document.getElementById('wl-page-info'),
      modal: document.getElementById('modal-add-watchlist'),
      modalOverlay: document.getElementById('modal-overlay-watchlist'),
      modalTitle: document.getElementById('wl-modal-title'),
      modalMovieId: document.getElementById('wl-modal-movieId'),
      modalNotes: document.getElementById('wl-modal-notes'),
      modalNotesCount: document.getElementById('wl-modal-notes-count'),
      modalPriority: document.getElementById('wl-modal-priority'),
      modalPriorityStars: document.getElementById('wl-modal-priority-stars'),
      formAdd: document.getElementById('form-add-watchlist'),
      btnCancel: document.getElementById('wl-btn-cancel'),
    };
  }

  bindEvents() {
    const { els } = this;

    // Filtros
    els.filterGenre?.addEventListener('change', () => this.onFilterChange());
    els.filterSortBy?.addEventListener('change', () => this.onFilterChange());
    els.filterSortOrder?.addEventListener('change', () => this.onFilterChange());

    // Paginación
    els.btnPrev?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    els.btnNext?.addEventListener('click', () => this.goToPage(this.currentPage + 1));

    // Modal agregar
    els.btnCancel?.addEventListener('click', () => this.closeAddModal());
    els.modalOverlay?.addEventListener('click', () => this.closeAddModal());
    els.formAdd?.addEventListener('submit', (e) => this.handleAddSubmit(e));

    // Notes contador
    els.modalNotes?.addEventListener('input', () => this.updateNotesCount());

    // Prioridad estrellas visuales
    els.modalPriority?.addEventListener('change', () => this.updatePriorityStars());

    // CTA empty state
    els.emptyCta?.addEventListener('click', () => {
      if (window.switchSection) window.switchSection('explore');
    });

    // Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.els.modal?.classList.contains('open')) {
        this.closeAddModal();
      }
    });
  }

  async loadGenres() {
    try {
      const res = await this.fetch(`${this.API_BASE}/movies/genres`);
      const genres = await res.json();
      const { filterGenre } = this.els;
      if (filterGenre) {
        const currentValue = filterGenre.value;
        filterGenre.innerHTML = '<option value="">Todos</option>';
        genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g;
          opt.textContent = g.charAt(0).toUpperCase() + g.slice(1);
          filterGenre.appendChild(opt);
        });
        filterGenre.value = currentValue;
      }
    } catch {
      // Silencioso
    }
  }

  // ===== Toast System =====
  createToastContainer() {
    if (!document.getElementById('toast-container')) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 1000;
        display: flex; flex-direction: column; gap: 8px; pointer-events: none;
      `;
      document.body.appendChild(this.toastContainer);
    } else {
      this.toastContainer = document.getElementById('toast-container');
    }
  }

  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    const colors = {
      info: '#0066cc',
      success: '#2e7d32',
      error: '#c62828',
      warning: '#ef6c00'
    };
    toast.style.cssText = `
      background: #1a1a1a; border: 1px solid ${colors[type]};
      border-radius: 8px; padding: 12px 16px; color: #eee;
      font-size: 0.85rem; max-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,.5);
      animation: slideIn .3s ease; pointer-events: auto;
    `;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ===== Filtros & Persistencia =====
  loadFilters() {
    try {
      const saved = localStorage.getItem('watchlistFilters');
      if (saved) return JSON.parse(saved);
    } catch { }
    return { genre: '', sortBy: 'addedAt', sortOrder: 'desc' };
  }

  saveFilters() {
    localStorage.setItem('watchlistFilters', JSON.stringify(this.filters));
  }

  applyFiltersToUI() {
    if (this.els.filterGenre) this.els.filterGenre.value = this.filters.genre;
    if (this.els.filterSortBy) this.els.filterSortBy.value = this.filters.sortBy;
    if (this.els.filterSortOrder) this.els.filterSortOrder.value = this.filters.sortOrder;
  }

  onFilterChange() {
    this.filters = {
      genre: this.els.filterGenre?.value || '',
      sortBy: this.els.filterSortBy?.value || 'addedAt',
      sortOrder: this.els.filterSortOrder?.value || 'desc'
    };
    this.saveFilters();
    this.currentPage = 1;
    this.refresh();
  }

  // ===== API =====
  async fetch(url, options = {}) {
    if (this.auth) return this.auth.fetchWithAuth(url, options);
    return fetch(url, options);
  }

  async refresh() {
    await this.fetchPage(this.currentPage);
  }

  async fetchPage(page) {
    const { els } = this;
    els.status.textContent = 'Cargando...';
    els.status.className = 'status-msg';
    els.grid.innerHTML = '';

    const params = new URLSearchParams({
      page: String(page),
      limit: '12',
      ...this.filters
    });

    try {
      const res = await this.fetch(`${this.API_BASE}/users/me/watchlist?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this.movies = data.data || [];
      this.totalPages = data.meta?.totalPages || 1;
      this.totalItems = data.meta?.total || 0;
      this.currentPage = data.meta?.page || 1;

      this.render();
    } catch (err) {
      els.status.textContent = `Error: ${err.message}`;
      els.status.className = 'status-msg error';
      this.showToast(err.message, 'error');
    }
  }

  // ===== Render =====
  render() {
    const { els } = this;

    if (this.movies.length === 0) {
      els.grid.innerHTML = '';
      els.status.textContent = this.auth?.accessToken
        ? 'Tu watchlist está vacía'
        : 'Inicia sesión para ver tu watchlist';
      els.status.className = 'status-msg';
      els.grid.classList.add('hidden');
      els.emptyCta?.parentElement?.classList.remove('hidden');
      this.updatePagination();
      return;
    }

    els.status.textContent = '';
    els.grid.classList.remove('hidden');
    els.emptyCta?.parentElement?.classList.add('hidden');
    els.grid.innerHTML = this.movies.map(m => this.renderCard(m)).join('');
    this.bindCardEvents();
    this.updatePagination();
  }

  renderCard(movie) {
    const priority = movie.priority ?? 3;
    const stars = '★'.repeat(priority) + '☆'.repeat(5 - priority);
    const notes = movie.notes ? `<div class="wl-notes">${this.escapeHtml(movie.notes)}</div>` : '';
    const poster = movie.movie?.poster
      ? `<img src="${this.escapeHtml(movie.movie.poster)}" alt="${this.escapeHtml(movie.movie.title)}" loading="lazy">`
      : '🎬';

    return `
      <article class="wl-card" data-movie-id="${movie.movieId}" data-entry-id="${movie.id}">
        <div class="wl-poster">${poster}</div>
        <div class="wl-info">
          <h3 class="wl-title">${this.escapeHtml(movie.movie?.title || 'Sin título')}</h3>
          <div class="wl-meta">
            <span class="wl-year">${movie.movie?.year || ''}</span>
            <span class="wl-rating">★ ${movie.movie?.rating || 'N/A'}</span>
          </div>
          <div class="wl-priority" title="Prioridad: ${priority}/5">${stars}</div>
          ${notes}
          <div class="wl-genres">${(movie.movie?.genres || []).map(g => `<span>${this.escapeHtml(g)}</span>`).join('')}</div>
        </div>
        <button class="wl-btn-delete" aria-label="Eliminar de watchlist" title="Eliminar">✕</button>
      </article>
    `;
  }

  bindCardEvents() {
    this.els.grid?.querySelectorAll('.wl-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.wl-card');
        const movieId = Number(card.dataset.movieId);
        this.confirmDelete(movieId);
      });
    });
  }

  updatePagination() {
    const { els } = this;
    els.pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages || 1}`;
    els.btnPrev.disabled = this.currentPage <= 1;
    els.btnNext.disabled = this.currentPage >= this.totalPages;
  }

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.fetchPage(page);
  }

  // ===== Modal Agregar =====
  openAddModal(movieId, movieTitle) {
    const { els } = this;
    els.modalMovieId.value = String(movieId);
    els.modalTitle.textContent = `Agregar a watchlist: ${this.escapeHtml(movieTitle)}`;
    els.modalNotes.value = '';
    els.modalPriority.value = '3';
    this.updateNotesCount();
    this.updatePriorityStars();
    els.modal.classList.add('open');
    els.modalOverlay.classList.add('open');
    setTimeout(() => els.modalNotes.focus(), 50);
  }

  closeAddModal() {
    this.els.modal?.classList.remove('open');
    this.els.modalOverlay?.classList.remove('open');
  }

  updateNotesCount() {
    const { els } = this;
    const len = els.modalNotes?.value?.length || 0;
    els.modalNotesCount.textContent = `${len}/2000`;
    els.modalNotesCount.style.color = len > 1800 ? '#ef5350' : '#888';
  }

  updatePriorityStars() {
    const { els } = this;
    const val = Number(els.modalPriority?.value || 3);
    els.modalPriorityStars.textContent = '★'.repeat(val) + '☆'.repeat(5 - val);
  }

  async handleAddSubmit(e) {
    e.preventDefault();
    const { els } = this;
    const movieId = Number(els.modalMovieId.value);
    const notes = els.modalNotes.value.trim() || null;
    const priority = Number(els.modalPriority.value);

    const submitBtn = els.formAdd.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Agregando...';

    try {
      const res = await this.fetch(`${this.API_BASE}/users/me/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, notes, priority })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }

      this.showToast('Película agregada a tu watchlist', 'success');
      this.closeAddModal();
      this.refresh();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Agregar';
    }
  }

  // ===== Eliminar =====
  confirmDelete(movieId) {
    if (!confirm('¿Eliminar esta película de tu watchlist?')) return;
    this.delete(movieId);
  }

  async delete(movieId) {
    try {
      const res = await this.fetch(`${this.API_BASE}/users/me/watchlist/${movieId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }

      this.showToast('Película eliminada de tu watchlist', 'success');
      this.refresh();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ===== Public API para botones externos =====
  openAddModalForMovie(movieId, movieTitle) {
    if (!this.auth?.accessToken) {
      this.showToast('Debes iniciar sesión para agregar a watchlist', 'warning');
      this.auth?.openModal?.('login');
      return;
    }
    this.openAddModal(movieId, movieTitle);
  }

  // ===== Utils =====
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}