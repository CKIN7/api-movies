export class Carousel {
  constructor(apiBase = 'http://localhost:8089', auth = null) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.movies = [];
    this.currentIndex = 0;
    this.els = {};
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.loadGenres();
    this.fetchCarousel();
  }

  bindElements() {
    this.els = {
      sliderViewport: document.getElementById('slider-viewport'),
      sliderStatus: document.getElementById('slider-status'),
      slideCurrent: document.getElementById('slide-current'),
      slideTotal: document.getElementById('slide-total'),
      dotsEl: document.getElementById('dots'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),
      btnRefresh: document.getElementById('btn-refresh'),
      filterGenre: document.getElementById('filter-genre'),
      filterMinYear: document.getElementById('filter-minYear'),
      filterMaxYear: document.getElementById('filter-maxYear'),
      filterMinRating: document.getElementById('filter-minRating'),
      filterCount: document.getElementById('filter-count'),
    };
  }

  bindEvents() {
    const { els } = this;
    els.btnPrev?.addEventListener('click', () => this.navigate(-1));
    els.btnNext?.addEventListener('click', () => this.navigate(1));
    els.btnRefresh?.addEventListener('click', () => this.fetchCarousel());
    els.filterGenre?.addEventListener('change', () => this.fetchCarousel());
    els.filterMinYear?.addEventListener('change', () => this.fetchCarousel());
    els.filterMaxYear?.addEventListener('change', () => this.fetchCarousel());
    els.filterMinRating?.addEventListener('change', () => this.fetchCarousel());
    els.filterCount?.addEventListener('change', () => this.fetchCarousel());

    if (this.auth) {
      this.auth.onAuthChange(() => this.fetchCarousel());
    }
  }

  async loadGenres() {
    try {
      const res = await this.fetch(`${this.API_BASE}/movies/genres`);
      const genres = await res.json();
      genres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        this.els.filterGenre?.appendChild(opt);
      });
    } catch {
      // Silencioso
    }
  }

  getFilters() {
    const { els } = this;
    const params = {};
    if (els.filterGenre?.value) params.genre = els.filterGenre.value;
    if (els.filterMinYear?.value) params.minYear = Number(els.filterMinYear.value);
    if (els.filterMaxYear?.value) params.maxYear = Number(els.filterMaxYear.value);
    if (els.filterMinRating?.value) params.minRating = Number(els.filterMinRating.value);
    if (els.filterCount?.value) params.count = Number(els.filterCount.value);
    return params;
  }

  async fetchCarousel() {
    const { els } = this;
    const params = new URLSearchParams();
    const filters = this.getFilters();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });

    els.sliderStatus.textContent = 'Cargando...';
    els.sliderStatus.className = 'status-msg';

    try {
      const res = await this.fetch(`${this.API_BASE}/movies/random?${params}`);
      const result = await res.json();
      this.movies = result.data || [];
      this.currentIndex = 0;
      this.renderCarousel();
    } catch (err) {
      els.sliderStatus.textContent = `Error: ${err.message}`;
      els.sliderStatus.className = 'status-msg error';
      this.clearCarousel();
    }
  }

  async fetch(url, options = {}) {
    if (this.auth) {
      return this.auth.fetchWithAuth(url, options);
    }
    return fetch(url, options);
  }

  renderCarousel() {
    const { els } = this;
    if (this.movies.length === 0) {
      els.sliderStatus.textContent = 'Sin películas con esos filtros';
      els.sliderStatus.className = 'status-msg';
      this.clearCarousel();
      return;
    }

    els.slideTotal.textContent = String(this.movies.length);
    this.renderSlide(this.currentIndex);
    this.renderDots();
  }

  clearCarousel() {
    const { els } = this;
    els.slideCurrent.textContent = '0';
    els.slideTotal.textContent = '0';
    els.dotsEl.innerHTML = '';
    els.sliderViewport.innerHTML = '';
  }

  renderSlide(index) {
    const { els } = this;
    const movie = this.movies[index];
    els.slideCurrent.textContent = String(index + 1);

    const posterHtml = movie.poster
      ? `<img src="${this.escapeHtml(movie.poster)}" alt="${this.escapeHtml(movie.title)}">`
      : '🎬';

    els.sliderViewport.innerHTML = `
      <div class="slide">
        <div class="poster">${posterHtml}</div>
        <div class="title">${this.escapeHtml(movie.title)}</div>
        <div class="year">${movie.year}</div>
        <div class="director">${this.escapeHtml(movie.director)}</div>
        <div class="rating">★ ${movie.rating}</div>
        <div class="genres">${movie.genres.map(g => `<span>${this.escapeHtml(g)}</span>`).join('')}</div>
      </div>
    `;
  }

  renderDots() {
    const { els } = this;
    els.dotsEl.innerHTML = this.movies.map((_, i) =>
      `<span class="dot${i === this.currentIndex ? ' active' : ''}" data-index="${i}"></span>`
    ).join('');
    els.dotsEl.querySelectorAll('.dot').forEach(el => {
      el.addEventListener('click', () => {
        this.currentIndex = Number(el.dataset.index);
        this.renderSlide(this.currentIndex);
        this.renderDots();
      });
    });
  }

  navigate(direction) {
    if (this.movies.length === 0) return;
    this.currentIndex = (this.currentIndex + direction + this.movies.length) % this.movies.length;
    this.renderSlide(this.currentIndex);
    this.renderDots();
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}