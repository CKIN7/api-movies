export class Suggest {
  constructor(apiBase = 'http://localhost:8089', auth = null, options = {}) {
    this.API_BASE = apiBase;
    this.auth = auth;
    this.endpoint = options.endpoint || '/movies/suggest';
    this.idPrefix = options.idPrefix || 'suggest';
    this.tabsSelector = options.tabsSelector || '#tabs .tab';
    this.resultsMode = options.resultsMode || 'filter';
    this.currentField = 'title';
    this.timer = null;
    this.els = {};

    this.placeholders = {
      title: 'Escribe un título…',
      director: 'Escribe un director…',
      genre: 'Escribe un género…',
    };

    this.queryKeys = {
      title: 'title',
      director: 'director',
      genre: 'genre',
    };

    this.fieldLabels = {
      title: 'Título',
      director: 'Director',
      genre: 'Género',
    };
  }

  init() {
    this.bindElements();
    this.bindEvents();
  }

  bindElements() {
    this.els = {
      suggestInput: document.getElementById(`${this.idPrefix}-input`),
      suggestDropdown: document.getElementById(`${this.idPrefix}-dropdown`),
      suggestResults: document.getElementById(`${this.idPrefix}-results`),
      suggestTabs: document.querySelectorAll(this.tabsSelector),
    };
  }

  bindEvents() {
    const { els } = this;

    els.suggestTabs?.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab));
    });

    els.suggestInput?.addEventListener('input', () => this.onInput());
    els.suggestInput?.addEventListener('keydown', (e) => this.onKeydown(e));

    document.addEventListener('click', (e) => {
      const wrapper = els.suggestInput?.closest('.autocomplete');
      if (!wrapper || !wrapper.contains(e.target)) this.closeSuggestDropdown();
    });

    if (this.auth) {
      this.auth.onAuthChange(() => {
        // Si hay resultados abiertos, recargar
        if (els.suggestResults?.classList.contains('open')) {
          const value = els.suggestInput?.value?.trim();
          if (value.length >= 3) this.fetchSuggestMovies(value);
        }
      });
    }
  }

  switchTab(tab) {
    const { els } = this;
    els.suggestTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    this.currentField = tab.dataset.field;
    if (els.suggestInput) {
      els.suggestInput.placeholder = this.placeholders[this.currentField];
      els.suggestInput.value = '';
    }
    this.closeSuggestDropdown();
  }

  onInput() {
    const { els } = this;
    clearTimeout(this.timer);
    const q = els.suggestInput?.value?.trim() || '';
    if (q.length < 3) {
      this.closeSuggestDropdown();
      return;
    }
    this.timer = setTimeout(() => this.fetchSuggestions(q), 300);
  }

  onKeydown(e) {
    const { els } = this;
    if (e.key === 'Escape') {
      this.closeSuggestDropdown();
      return;
    }
    if (e.key === 'Enter') {
      const q = els.suggestInput?.value?.trim() || '';
      if (q.length >= 3) {
        this.closeSuggestDropdown();
        this.fetchSuggestMovies(q);
      }
    }
  }

  async fetchSuggestions(q) {
    const { els } = this;
    const url = `${this.API_BASE}${this.endpoint}?q=${encodeURIComponent(q)}&field=${this.currentField}`;
    this.showSuggestLoading();

    try {
      const res = await this.fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.renderSuggestResults(data, q);
    } catch (err) {
      this.showSuggestError(err.message);
    }
  }

  async fetch(url, options = {}) {
    if (this.auth) {
      return this.auth.fetchWithAuth(url, options);
    }
    return fetch(url, options);
  }

  renderSuggestResults(items, q) {
    const { els } = this;
    if (items.length === 0) {
      els.suggestDropdown.innerHTML = `<div class="status">Sin sugerencias para "<strong>${this.escapeHtml(q)}</strong>"</div>`;
      els.suggestDropdown.classList.add('open');
      return;
    }

    els.suggestDropdown.innerHTML = items.map(item =>
      `<div class="item" data-value="${this.escapeHtml(item)}">${this.escapeHtml(item)}</div>`
    ).join('');
    els.suggestDropdown.classList.add('open');

    els.suggestDropdown.querySelectorAll('.item').forEach(el => {
      el.addEventListener('click', () => {
        if (els.suggestInput) els.suggestInput.value = el.dataset.value;
        this.closeSuggestDropdown();
        this.fetchSuggestMovies(el.dataset.value);
      });
    });
  }

  showSuggestLoading() {
    const { els } = this;
    els.suggestDropdown.innerHTML = '<div class="status">Buscando…</div>';
    els.suggestDropdown.classList.add('open');
  }

  showSuggestError(msg) {
    const { els } = this;
    els.suggestDropdown.innerHTML = `<div class="status error">Error: ${this.escapeHtml(msg)}</div>`;
    els.suggestDropdown.classList.add('open');
  }

  closeSuggestDropdown() {
    const { els } = this;
    els.suggestDropdown?.classList.remove('open');
    els.suggestDropdown.innerHTML = '';
  }

  buildResultsUrl(value) {
    if (this.resultsMode === 'search') {
      return `${this.API_BASE}/movies/search?q=${encodeURIComponent(value)}&field=${encodeURIComponent(this.currentField)}&exact=true`;
    }
    const key = this.queryKeys[this.currentField];
    return `${this.API_BASE}/movies?${key}=${encodeURIComponent(value)}`;
  }

  async fetchSuggestMovies(value) {
    const { els } = this;
    const url = this.buildResultsUrl(value);
    this.showSuggestResultsLoading();

    try {
      const res = await this.fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.renderSuggestMovies(data, value);
    } catch (err) {
      this.showSuggestResultsError(err.message);
    }
  }

  renderSuggestMovies(data, value) {
    const { els } = this;
    if (data.data.length === 0) {
      this.showSuggestResultsEmpty(value);
      return;
    }

    const label = this.resultsMode === 'search'
      ? 'Búsqueda'
      : this.fieldLabels[this.currentField];
    const engine = data.meta.source
      ? ` · ${data.meta.source} · ${data.meta.processingTimeMs} ms`
      : '';
    const header = `<div class="results-header">${data.meta.total} película(s) encontradas para ${label}: "${this.escapeHtml(value)}"${engine}</div>`;
    const cards = data.data.map(m => `
      <div class="movie-card">
        <div class="row1">
          <span class="title">${this.escapeHtml(m.title)}</span>
          <span class="year">(${m.year})</span>
        </div>
        <div class="row2">
          <span class="rating">★ ${m.rating}</span>
          <span class="director">${this.escapeHtml(m.director)}</span>
          <span class="genres">${m.genres.map(g => `<span>${this.escapeHtml(g)}</span>`).join('')}</span>
        </div>
      </div>
    `).join('');

    els.suggestResults.innerHTML = header + cards;
    els.suggestResults.classList.add('open');
  }

  showSuggestResultsLoading() {
    const { els } = this;
    els.suggestResults.innerHTML = '<div class="results-status">Buscando películas…</div>';
    els.suggestResults.classList.add('open');
  }

  showSuggestResultsEmpty(value) {
    const { els } = this;
    const label = this.resultsMode === 'search' ? 'Búsqueda' : this.fieldLabels[this.currentField];
    els.suggestResults.innerHTML = `<div class="results-status">Sin películas para ${label}: "${this.escapeHtml(value)}"</div>`;
    els.suggestResults.classList.add('open');
  }

  showSuggestResultsError(msg) {
    const { els } = this;
    els.suggestResults.innerHTML = `<div class="results-status" style="color:#ef5350;">Error: ${this.escapeHtml(msg)}</div>`;
    els.suggestResults.classList.add('open');
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}