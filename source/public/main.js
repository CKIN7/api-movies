import { Auth } from './auth.js';
import { Carousel } from './carousel.js';
import { Suggest } from './suggest.js';
import { Watchlist } from './watchlist.js';

const API_BASE = 'http://localhost:8089';

const auth = new Auth(API_BASE);
const carousel = new Carousel(API_BASE, auth);
const suggest = new Suggest(API_BASE, auth);
const watchlist = new Watchlist(API_BASE, auth);

auth.init();
carousel.init();
suggest.init();
watchlist.init();

console.log('Movies API Landing - Inicializado');
console.log('Auth:', auth);
console.log('Carousel:', carousel);
console.log('Suggest:', suggest);
console.log('Watchlist:', watchlist);

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

// Hook "Agregar a watchlist" buttons in Suggest results
const originalRenderSuggestMovies = suggest.renderSuggestMovies.bind(suggest);
suggest.renderSuggestMovies = function(data, value) {
  originalRenderSuggestMovies(data, value);
  const resultsEl = document.getElementById('suggest-results');
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