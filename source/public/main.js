import { Auth } from './auth.js';
import { Carousel } from './carousel.js';
import { Suggest } from './suggest.js';
import { Watchlist } from './watchlist.js';

const API_BASE = 'http://localhost:8089';

const auth = new Auth(API_BASE);
const carousel = new Carousel(API_BASE, auth);
const suggest = new Suggest(API_BASE, auth);
const suggestMeili = new Suggest(API_BASE, auth, {
  endpoint: '/movies/search/suggest',
  idPrefix: 'suggest-meili',
  tabsSelector: '#tabs-meili .tab',
  resultsMode: 'search',
});
const watchlist = new Watchlist(API_BASE, auth);

auth.init();
carousel.init();
suggest.init();
suggestMeili.init();
watchlist.init();

console.log('Movies API Landing - Inicializado');
console.log('Auth:', auth);
console.log('Carousel:', carousel);
console.log('Suggest:', suggest);
console.log('Suggest Meilisearch:', suggestMeili);
console.log('Watchlist:', watchlist);

// Expose for debugging
window.watchlist = watchlist;

// === Section Switching ===
window.switchSection = function(sectionName) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('open'));
  document.querySelectorAll('.main-tabs .tab').forEach(t => t.classList.remove('active'));
  
  const targetSection = document.getElementById(`section-${sectionName}`);
  const targetTab = document.getElementById(`tab-${sectionName}`);
  
  if (targetSection) targetSection.classList.add('open');
  if (targetTab) targetTab.classList.add('active');
  
  if (sectionName === 'watchlist' && auth.accessToken) {
    watchlist.refresh();
  }
};

document.querySelectorAll('.main-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => switchSection(tab.dataset.section));
});

// Hook "Agregar a watchlist" buttons in Carousel
const originalRenderSlide = carousel.renderSlide.bind(carousel);
carousel.renderSlide = function(index) {
  originalRenderSlide(index);
  const viewport = document.getElementById('slider-viewport');
  const slide = viewport?.querySelector('.slide');
  if (slide && !slide.querySelector('.wl-btn-add')) {
    const movie = carousel.movies[index];
    if (movie) {
      const btn = document.createElement('button');
      btn.className = 'wl-btn-add';
      btn.textContent = '+ Watchlist';
      btn.style.cssText = 'margin-top: 12px; padding: 8px 16px; font-size: 0.85rem; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer;';
      btn.addEventListener('click', () => watchlist.openAddModalForMovie(movie.id, movie.title));
      slide.appendChild(btn);
    }
  }
};

// Hook "Agregar a watchlist" buttons in Suggest results (ambas cajas)
function hookSuggestWatchlist(suggestInstance) {
  const originalRenderSuggestMovies = suggestInstance.renderSuggestMovies.bind(suggestInstance);
  suggestInstance.renderSuggestMovies = function(data, value) {
    originalRenderSuggestMovies(data, value);
    const resultsEl = suggestInstance.els.suggestResults;
    resultsEl?.querySelectorAll('.movie-card').forEach(card => {
      if (card.querySelector('.wl-btn-add')) return;
      const titleEl = card.querySelector('.title');
      if (!titleEl) return;
      const movie = data.data.find(m => m.title === titleEl.textContent);
      if (movie) {
        const btn = document.createElement('button');
        btn.className = 'wl-btn-add';
        btn.textContent = '+ Watchlist';
        btn.style.cssText = 'margin-top: 8px; padding: 6px 12px; font-size: 0.75rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;';
        btn.addEventListener('click', () => watchlist.openAddModalForMovie(movie.id, movie.title));
        card.appendChild(btn);
      }
    });
  };
}
hookSuggestWatchlist(suggest);
hookSuggestWatchlist(suggestMeili);

// === Mobile Menu Toggle ===
const tabsToggle = document.getElementById('main-tabs-toggle');
const tabsList = document.getElementById('main-tabs-list');
if (tabsToggle && tabsList) {
  tabsToggle.addEventListener('click', () => {
    const isOpen = tabsList.classList.toggle('open');
    tabsToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close menu when clicking a tab
  tabsList.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabsList.classList.remove('open');
      tabsToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (!tabsToggle.contains(e.target) && !tabsList.contains(e.target)) {
      tabsList.classList.remove('open');
      tabsToggle.setAttribute('aria-expanded', 'false');
    }
  });
}