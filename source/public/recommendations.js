import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';

const params = new URLSearchParams(window.location.search);
const DEMO = params.get('demo') === '1';
const LAB = params.get('lab') === '1' || DEMO;
const DEMO_WORKER_OFF = DEMO && params.get('worker') === 'off';

const DEFAULT_MOVIE = (() => {
  const raw = Number.parseInt(params.get('movieId') ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
})();

const DEFAULT_TYPE = ['hybrid', 'content', 'collab'].includes(params.get('type') ?? '')
  ? params.get('type')
  : 'hybrid';

const DEFAULT_LIMIT = (() => {
  const raw = Number.parseInt(params.get('limit') ?? '', 10);
  return [5, 10, 20, 50].includes(raw) ? raw : 10;
})();

const STEP = (() => {
  const raw = Number.parseInt(params.get('step') ?? '', 10);
  return Number.isFinite(raw) && raw >= 1 && raw <= 8 ? raw : null;
})();

const auth = new Auth(API_BASE);

const state = {
  recommendations: [],
  loading: false,
  running: false,
  mapInitialized: false,
  log: [],
};

const els = {
  demoBanner: document.getElementById('demo-banner'),
  loginRequired: document.getElementById('login-required'),
  app: document.getElementById('app'),
  authButtons: document.getElementById('auth-buttons'),
  map: document.getElementById('map'),
  mapCaption: document.getElementById('map-caption'),
  nodeDetail: document.getElementById('node-detail'),
  recsType: document.getElementById('recs-type'),
  recsLimit: document.getElementById('recs-limit'),
  btnLoadRecs: document.getElementById('btn-load-recs'),
  recsStatus: document.getElementById('recs-status'),
  recsGrid: document.getElementById('recs-grid'),
  simReviewMovie: document.getElementById('sim-review-movie'),
  simReviewRating: document.getElementById('sim-review-rating'),
  btnSimReview: document.getElementById('btn-sim-review'),
  btnSimUnreview: document.getElementById('btn-sim-unreview'),
  simWatchMovie: document.getElementById('sim-watch-movie'),
  simWatchPriority: document.getElementById('sim-watch-priority'),
  btnSimWatch: document.getElementById('btn-sim-watch'),
  btnSimUnwatch: document.getElementById('btn-sim-unwatch'),
  simWorker: document.getElementById('sim-worker'),
  btnSimCron: document.getElementById('btn-sim-cron'),
  btnResetSignals: document.getElementById('btn-reset-signals'),
  simStatus: document.getElementById('sim-status'),
  demoNotificationsWrap: document.getElementById('demo-notifications-wrap'),
  demoNotifications: document.getElementById('demo-notifications'),
  realWorkerNote: document.getElementById('real-worker-note'),
  edgeResult: document.getElementById('edge-result'),
  logCount: document.getElementById('log-count'),
  requestLog: document.getElementById('request-log'),
  btnClearLog: document.getElementById('btn-clear-log'),
  btnLoginInline: document.getElementById('btn-login-inline'),
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function toast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(data, status) {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (status === 429) return 'Demasiadas solicitudes. Esperá un momento.';
  if (status === 0) return 'No se pudo conectar con la API.';
  return `Error ${status}`;
}

function isLogged() {
  return DEMO || !!auth.accessToken;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function minuteBucket(now = Date.now()) {
  return String(Math.floor(now / 60_000));
}

// ---------------------------------------------------------------------------
// Log de peticiones
// ---------------------------------------------------------------------------

function logRequest(method, path, status, ms, note = '') {
  state.log.unshift({
    method,
    path,
    status,
    ms,
    note,
    time: new Date().toLocaleTimeString(),
    ok: status >= 200 && status < 300,
  });
  if (state.log.length > 60) state.log.length = 60;
  renderLog();
}

function renderLog() {
  if (!els.requestLog) return;
  if (!state.log.length) {
    els.requestLog.innerHTML = '<div class="log-empty">Todavía no hay peticiones.</div>';
  } else {
    els.requestLog.innerHTML = state.log
      .map((entry) => {
        const status = entry.status || 'ERR';
        const cls = entry.ok ? 'ok' : 'err';
        const note = entry.note ? ` · ${escapeHtml(entry.note)}` : '';
        return `<div class="log-line"><span class="${cls}">${status}</span> ${escapeHtml(entry.method)} ${escapeHtml(entry.path)} · ${entry.ms} ms <span class="muted">${escapeHtml(entry.time)}</span>${note}</div>`;
      })
      .join('');
  }
  if (els.logCount) els.logCount.textContent = `${state.log.length} peticiones`;
}

// ---------------------------------------------------------------------------
// Cliente HTTP + mock de demo
// ---------------------------------------------------------------------------

const DEMO_CATALOG = [
  { id: 1, title: 'Inception', year: 2010, rating: 8.8, director: 'Christopher Nolan', genres: ['action', 'sci-fi'], content: 0.91, collab: 0.74 },
  { id: 2, title: 'Interstellar', year: 2014, rating: 8.6, director: 'Christopher Nolan', genres: ['adventure', 'sci-fi'], content: 0.94, collab: 0.69 },
  { id: 3, title: 'The Dark Knight', year: 2008, rating: 9.0, director: 'Christopher Nolan', genres: ['action', 'crime'], content: 0.88, collab: 0.82 },
  { id: 4, title: 'The Matrix', year: 1999, rating: 8.7, director: 'Lana Wachowski', genres: ['action', 'sci-fi'], content: 0.90, collab: 0.78 },
  { id: 5, title: 'Pulp Fiction', year: 1994, rating: 8.9, director: 'Quentin Tarantino', genres: ['crime', 'drama'], content: 0.72, collab: 0.71 },
  { id: 6, title: 'Fight Club', year: 1999, rating: 8.8, director: 'David Fincher', genres: ['drama'], content: 0.70, collab: 0.76 },
  { id: 7, title: 'Arrival', year: 2016, rating: 7.9, director: 'Denis Villeneuve', genres: ['drama', 'sci-fi'], content: 0.86, collab: 0.62 },
  { id: 8, title: 'Whiplash', year: 2014, rating: 8.5, director: 'Damien Chazelle', genres: ['drama', 'music'], content: 0.68, collab: 0.58 },
];

const demo = {
  hidden: new Set(),
  liked: new Map(),
  reviews: new Map(),
  watchlist: new Map(),
  cache: { hybrid: false, content: false, collab: false, ttl: 0 },
  notifications: [],
  notifiedDates: new Set(),
  seq: 1,
  workerOn: !DEMO_WORKER_OFF,
  date: '2026-11-01',
  lastJob: null,
};

function seedDemo() {
  demo.reviews = new Map([[1, { rating: 5 }]]);
  demo.watchlist = new Map([[3, { priority: 5 }]]);
  demo.cache = { hybrid: false, content: false, collab: false, ttl: 0 };
  demo.notifications = [];
  demo.notifiedDates = new Set();
  demo.hidden = new Set();
  demo.liked = new Map();
  demo.lastJob = null;
  demo.seq = 1;
}

function demoHasSignals() {
  return demo.reviews.size > 0 || demo.watchlist.size > 0 || demo.liked.size > 0;
}

function demoScore(movie, type) {
  const base = type === 'content'
    ? movie.content
    : type === 'collab'
      ? movie.collab
      : (movie.content + movie.collab) / 2;
  const liked = demo.liked.get(movie.id) ?? 0;
  const reviewed = demo.reviews.has(movie.id) ? 0.05 : 0;
  const watched = demo.watchlist.has(movie.id) ? 0.03 : 0;
  return base + liked + reviewed + watched;
}

function demoReason(movie, type) {
  if (type === 'content') return `Afinidad de género (${movie.genres.join(', ')}) y director.`;
  if (type === 'collab') return 'Usuarios con gustos parecidos interactuaron con esta película.';
  return `Combina afinidad (${movie.genres[0]}) con señales de usuarios similares.`;
}

function demoList(type, limit) {
  if (!demoHasSignals()) return [];
  return DEMO_CATALOG
    .filter((movie) => !demo.hidden.has(movie.id))
    .map((movie) => ({
      movie: {
        id: movie.id,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        director: movie.director,
        genres: movie.genres,
      },
      score: round2(demoScore(movie, type)),
      reason: demoReason(movie, type),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function demoInvalidate() {
  demo.cache = { hybrid: false, content: false, collab: false, ttl: 0 };
}

function demoWarmCache() {
  demo.cache = { hybrid: true, content: true, collab: true, ttl: 86_400 };
}

function demoRequest(method, path, body) {
  const url = new URL(path, 'http://demo.local');
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/users/me/recommendations') {
    const type = url.searchParams.get('type') ?? 'hybrid';
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
    if (!['hybrid', 'content', 'collab'].includes(type)) {
      return { status: 400, data: { error: 'Invalid enum value: type' } };
    }
    if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
      return { status: 400, data: { error: 'El límite debe estar entre 1 y 50' } };
    }
    // El GET real hace lazy fill del cache cuando falta.
    if (!demo.cache[type] && demoHasSignals()) demoWarmCache();
    return { status: 200, data: demoList(type, limit) };
  }

  if (method === 'POST' && pathname === '/users/me/recommendations/feedback') {
    const movieId = Number(body?.movieId);
    const action = body?.action;
    if (!Number.isInteger(movieId) || movieId <= 0) {
      return { status: 400, data: { error: 'movieId debe ser un entero positivo' } };
    }
    if (!['view', 'hide', 'like', 'not_interested'].includes(action)) {
      return { status: 400, data: { error: 'Invalid enum value: action' } };
    }
    if (action === 'like') {
      demo.liked.set(movieId, (demo.liked.get(movieId) ?? 0) + 0.4);
    }
    if (action === 'hide' || action === 'not_interested') {
      demo.hidden.add(movieId);
    }
    if (action !== 'view') demoInvalidate();
    return { status: 201, data: { movieId, action, applied: true } };
  }

  const reviewMatch = pathname.match(/^\/movies\/(\d+)\/reviews(?:\/me)?$/);
  if (method === 'POST' && reviewMatch) {
    const movieId = Number(reviewMatch[1]);
    const rating = Number(body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { status: 400, data: { error: 'El rating debe estar entre 1 y 5' } };
    }
    const isNew = !demo.reviews.has(movieId);
    demo.reviews.set(movieId, { rating });
    demoInvalidate();
    return {
      status: isNew ? 201 : 200,
      data: { isNew, message: isNew ? 'Reseña creada con éxito' : 'Reseña actualizada con éxito', data: { movieId } },
    };
  }

  if (method === 'DELETE' && reviewMatch) {
    const movieId = Number(reviewMatch[1]);
    demo.reviews.delete(movieId);
    demoInvalidate();
    return { status: 200, data: { message: 'Reseña eliminada con éxito' } };
  }

  if (method === 'POST' && pathname === '/users/me/watchlist') {
    const movieId = Number(body?.movieId);
    const priority = Number(body?.priority ?? 3);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      return { status: 400, data: { error: 'movieId debe ser un entero positivo' } };
    }
    demo.watchlist.set(movieId, { priority });
    demoInvalidate();
    return { status: 201, data: { message: 'Película agregada a tu watchlist', data: { movieId, priority } } };
  }

  const watchMatch = pathname.match(/^\/users\/me\/watchlist\/(\d+)$/);
  if (method === 'DELETE' && watchMatch) {
    demo.watchlist.delete(Number(watchMatch[1]));
    demoInvalidate();
    return { status: 204, data: null };
  }

  return { status: 404, data: { error: 'Ruta no simulada en modo demo' } };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function callApi(method, path, body, note = '') {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let data = null;
  let failed = false;

  try {
    if (DEMO) {
      const mock = demoRequest(method, path, body);
      status = mock.status;
      ok = status >= 200 && status < 300;
      data = mock.data;
    } else {
      const options = { method, headers: {} };
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await auth.fetchWithAuth(`${API_BASE}${path}`, options);
      status = response.status;
      ok = response.ok;
      data = await readJson(response);
    }
  } catch {
    failed = true;
  }

  const ms = Math.round(performance.now() - started);
  logRequest(method, path, status, ms, failed ? 'error de red' : note);

  if (status === 401 && !DEMO) auth.clearAuth();

  return { status, ok, data, ms, failed };
}

// ---------------------------------------------------------------------------
// Recomendaciones
// ---------------------------------------------------------------------------

function renderRecommendations() {
  if (!els.recsGrid) return;
  els.recsGrid.innerHTML = '';

  if (!state.recommendations.length) {
    els.recsGrid.innerHTML = '<div class="empty">Sin recomendaciones todavía. Posteá una review o agregá algo a la watchlist.</div>';
    return;
  }

  state.recommendations.forEach((item) => {
    const movie = item?.movie ?? {};
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.innerHTML = `
      <div class="rec-head">
        <span class="rec-title">${escapeHtml(movie.title ?? '—')} <small>${escapeHtml(movie.year ?? '')}</small></span>
        <span class="rec-score">${Number(item?.score ?? 0).toFixed(2)}</span>
      </div>
      <div class="rec-reason">${escapeHtml(item?.reason ?? '')}</div>
      <div class="rec-actions">
        <button type="button" class="btn btn-outline btn-sm" data-feedback-action="view" data-movie-id="${escapeHtml(movie.id)}">Ya la vi</button>
        <button type="button" class="btn btn-outline btn-sm" data-feedback-action="like" data-movie-id="${escapeHtml(movie.id)}">Me gusta</button>
        <button type="button" class="btn btn-outline btn-sm" data-feedback-action="hide" data-movie-id="${escapeHtml(movie.id)}">Menos como esta</button>
        <button type="button" class="btn btn-outline btn-sm" data-feedback-action="not_interested" data-movie-id="${escapeHtml(movie.id)}">No recomendar</button>
      </div>
    `;
    els.recsGrid.appendChild(card);
  });
}

async function loadRecommendations({ silent = false } = {}) {
  if (!isLogged() || state.loading) return;
  state.loading = true;
  const type = els.recsType?.value ?? DEFAULT_TYPE;
  const limit = els.recsLimit?.value ?? String(DEFAULT_LIMIT);
  if (!silent && els.recsStatus) els.recsStatus.textContent = 'Cargando…';

  try {
    const result = await callApi('GET', `/users/me/recommendations?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`);
    if (!result.ok) {
      state.recommendations = [];
      renderRecommendations();
      if (els.recsStatus) els.recsStatus.textContent = `No se pudo cargar: ${apiError(result.data, result.status)}`;
      return;
    }

    state.recommendations = Array.isArray(result.data) ? result.data : [];
    if (els.recsStatus) {
      els.recsStatus.textContent = `${state.recommendations.length} ${type} · actualizado ${new Date().toLocaleTimeString()}`;
    }
    renderRecommendations();

    if (!state.mapInitialized && !state.running) {
      markRestingMap();
      state.mapInitialized = true;
    }
  } finally {
    state.loading = false;
  }
}

async function sendFeedback(movieId, action) {
  return runPipeline(action === 'view' ? 'view' : `feedback:${action}`, {
    method: 'POST',
    path: '/users/me/recommendations/feedback',
    body: { movieId, action },
  });
}

// ---------------------------------------------------------------------------
// Mapa de convergencia
// ---------------------------------------------------------------------------

const DEFAULT_MAP_CAPTION = 'El service invalida el cache en el mismo request y encola el recompute best-effort. Sin worker, la invalidación ya deja el cache limpio y el próximo <code>GET</code> recalcula de forma lazy. Hacé click en un nodo para ver qué lo implementa.';

const NODE_DETAILS = {
  browser: 'public/recommendations.html + .js — Auth, lista de recomendaciones, feedback y log de peticiones.',
  api: 'routes/recommendationRoutes.ts, reviewRoutes.ts y watchlistRoutes.ts → controllers → services. La invalidación corre en el request; el encolado es best-effort.',
  mysql: 'reviews, user_watchlists y recommendation_feedback. El recompute lee interacciones y preferencias, pero el GET nunca escribe acá.',
  'cache-read': 'utils/cache.ts invalidateUserRecommendations borra recs:user:<id>:* de forma síncrona. Es la garantía de frescura cuando el worker está apagado.',
  redis: 'queues/recommendationQueue.ts. recs-recompute-user (por invalidación) y recs-recompute-all (cron o npm run recs:compute). Dedupe por usuario y minuto.',
  workers: 'workers/recommendationWorker.ts. Consume ambas colas y registra el cron con upsertJobScheduler; necesita proceso aparte (npm run worker:recs:dev).',
  'cache-write': 'RecommendationService.recomputeForUser precachea hybrid, content y collab (TTL 24 h, RECS_PRECOMPUTE_LIMIT=50). Sin señales o sin Redis termina skipped.',
  notify: 'jobs/notificationInAppJob.ts con type recs.ready. Solo lo emite el job masivo, con dedupeKey = date (una notificación por día).',
};

function setMapNode(name, status) {
  document.querySelectorAll(`.map-node[data-node="${name}"]`).forEach((el) => {
    el.classList.remove('active', 'ok', 'waiting', 'off', 'error');
    if (status !== 'idle') el.classList.add(status);
  });
}

function setMapConnector(step, status) {
  document.querySelectorAll(`.map-connector[data-step="${step}"]`).forEach((el) => {
    el.classList.remove('active', 'ok', 'waiting', 'off', 'error');
    if (status !== 'idle') el.classList.add(status);
  });
}

function setMapChip(step, status) {
  const el = document.querySelector(`[data-step-chip="${step}"]`);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off');
  if (status !== 'idle') el.classList.add(status);
}

function setMapCaption(html) {
  if (els.mapCaption) els.mapCaption.innerHTML = html;
}

function resetMap() {
  ['browser', 'api', 'mysql', 'cache-read', 'redis', 'workers', 'cache-write', 'notify'].forEach((name) => setMapNode(name, 'idle'));
  [1, 2, 3, 4, 5, 6].forEach((step) => {
    setMapConnector(step, 'idle');
    setMapChip(step, 'idle');
  });
  if (els.nodeDetail) {
    els.nodeDetail.classList.add('hidden');
    els.nodeDetail.textContent = '';
  }
  setMapCaption(DEFAULT_MAP_CAPTION);
}

function markStep(step, status) {
  setMapConnector(step, status);
  setMapChip(step, status);
}

function skipSteps(...steps) {
  steps.forEach((step) => markStep(step, 'off'));
}

function markRestingMap() {
  setMapNode('browser', 'ok');
  setMapNode('api', 'ok');
  setMapNode('mysql', 'ok');
  setMapNode('cache-read', 'ok');
  markStep(1, 'ok');
  markStep(2, 'ok');
}

// ---------------------------------------------------------------------------
// Pipeline: acción real o demo
// ---------------------------------------------------------------------------

const ACTION_TEXT = {
  feedback: {
    label: 'feedback',
    sql: 'El service registra el feedback y actualiza la afinidad de género.',
    invalidates: true,
  },
  'feedback:view': {
    label: 'feedback (view)',
    sql: 'La acción view no cambia afinidad ni invalida el cache.',
    invalidates: false,
  },
  'feedback:like': {
    label: 'feedback (like)',
    sql: 'El like suma afinidad y marca el cache como obsoleto.',
    invalidates: true,
  },
  'feedback:hide': {
    label: 'feedback (hide)',
    sql: 'El hide resta afinidad y excluye la película de las próximas listas.',
    invalidates: true,
  },
  'feedback:not_interested': {
    label: 'feedback (not_interested)',
    sql: 'not_interested resta afinidad y excluye la película.',
    invalidates: true,
  },
  review: {
    label: 'review',
    sql: 'El upsert de la review actualiza el rating y la afinidad de género.',
    invalidates: true,
  },
  unreview: {
    label: 'delete review',
    sql: 'El delete borra la review y su señal de interacción.',
    invalidates: true,
  },
  watchlist: {
    label: 'watchlist',
    sql: 'El alta en watchlist guarda la prioridad como señal positiva.',
    invalidates: true,
  },
  unwatchlist: {
    label: 'delete watchlist',
    sql: 'La baja de watchlist quita esa señal del historial.',
    invalidates: true,
  },
};

async function runPipeline(kind, request) {
  if (!isLogged()) {
    auth.openModal('login');
    return null;
  }
  if (state.running) return null;

  const meta = ACTION_TEXT[kind] ?? ACTION_TEXT.feedback;
  state.running = true;
  state.mapInitialized = true;
  if (els.simStatus) els.simStatus.textContent = `Ejecutando ${meta.label}…`;
  resetMap();

  try {
    // Paso 1: navegador -> API.
    setMapNode('browser', 'active');
    markStep(1, 'active');
    setMapCaption(`① El navegador envía <code>${escapeHtml(request.method)} ${escapeHtml(request.path)}</code> con el token.`);

    const result = await callApi(request.method, request.path, request.body);
    if (!result.ok) {
      setMapNode('browser', 'error');
      markStep(1, 'error');
      setMapCaption('La acción falló. Mirá el log de peticiones.');
      if (els.simStatus) els.simStatus.textContent = `Falló: ${apiError(result.data, result.status)}`;
      toast(apiError(result.data, result.status), true);
      return result;
    }

    setMapNode('browser', 'ok');
    setMapNode('api', 'ok');
    markStep(1, 'ok');

    // Paso 2: SQL + invalidación síncrona.
    setMapNode('api', 'active');
    markStep(2, 'active');
    setMapCaption(`② ${meta.sql}`);
    await sleep(DEMO ? 360 : 160);
    setMapNode('api', 'ok');
    setMapNode('mysql', 'ok');

    if (!meta.invalidates) {
      setMapNode('cache-read', 'off');
      skipSteps(2, 3, 4, 5, 6);
      setMapNode('redis', 'off');
      setMapNode('workers', 'off');
      setMapNode('cache-write', 'off');
      setMapNode('notify', 'off');
      setMapCaption('La acción <code>view</code> no invalida el cache: no hay recompute que encolar.');
      if (els.simStatus) els.simStatus.textContent = `${result.status} · ${meta.label} sin invalidación`;
      return result;
    }

    setMapNode('cache-read', 'ok');
    markStep(2, 'ok');

    if (!DEMO) {
      // Opción A: el navegador no puede observar colas ni cache.
      setMapNode('redis', 'waiting');
      setMapNode('workers', 'waiting');
      setMapNode('cache-write', 'waiting');
      setMapNode('notify', 'off');
      markStep(3, 'waiting');
      markStep(4, 'waiting');
      markStep(5, 'waiting');
      markStep(6, 'off');
      setMapCaption('③④⑤ La invalidación fue síncrona, pero el encolado y el worker <strong>no son observables desde el navegador</strong>. Abrí <a href="/admin/queues" target="_blank" rel="noopener">Bull Board</a> y buscá <code>recs-recompute-user</code>.');
      if (els.simStatus) els.simStatus.textContent = `${result.status} · ${meta.label} · verificado en Bull Board`;
      await loadRecommendations({ silent: true });
      return result;
    }

    // Pasos 3-5: encolado, worker y precache (solo demo).
    setMapNode('api', 'active');
    setMapNode('redis', 'active');
    markStep(3, 'active');
    setMapCaption('③ El productor encola <code>recs-recompute-user</code> con un jobId por usuario y minuto.');
    await sleep(380);
    setMapNode('api', 'ok');
    setMapNode('redis', 'ok');
    markStep(3, 'ok');

    demo.lastJob = {
      id: `recs-user-demo-${minuteBucket()}`,
      queue: 'user',
      state: 'waiting',
    };

    if (!demo.workerOn) {
      setMapNode('redis', 'waiting');
      setMapNode('workers', 'waiting');
      setMapNode('cache-write', 'waiting');
      markStep(4, 'waiting');
      markStep(5, 'waiting');
      markStep(6, 'off');
      setMapCaption('③ Job en cola, pero <code>worker-recs</code> está apagado. La invalidación síncrona ya dejó el cache limpio: el próximo <code>GET</code> recalcula de forma lazy.');
      if (els.simStatus) els.simStatus.textContent = `${result.status} · ${meta.label} · worker apagado`;
      toast('Job en cola: worker-recs apagado (demo).', true);
      return result;
    }

    setMapNode('redis', 'active');
    setMapNode('workers', 'active');
    markStep(4, 'active');
    setMapCaption('④ <code>worker-recs</code> consume el job y llama a <code>recomputeForUser</code>.');
    await sleep(480);
    setMapNode('redis', 'ok');
    setMapNode('workers', 'ok');
    markStep(4, 'ok');

    setMapNode('workers', 'active');
    setMapNode('cache-write', 'active');
    markStep(5, 'active');
    setMapCaption('⑤ El worker precachea <code>hybrid</code>, <code>content</code> y <code>collab</code> (TTL 24 h).');
    await sleep(420);
    demoWarmCache();
    demo.lastJob.state = 'completed';
    setMapNode('workers', 'ok');
    setMapNode('cache-write', 'ok');
    markStep(5, 'ok');
    setMapNode('notify', 'off');
    markStep(6, 'off');
    setMapCaption('⑤ Cache repoblado. <code>recs.ready</code> no se emite por una invalidación: solo lo hace el job masivo.');
    if (els.simStatus) els.simStatus.textContent = `${result.status} · ${meta.label} · cache repoblado`;

    await loadRecommendations({ silent: true });
    return result;
  } finally {
    state.running = false;
  }
}

async function runCronDemo() {
  if (!DEMO || state.running) return;
  state.running = true;
  state.mapInitialized = true;
  resetMap();
  if (els.simStatus) els.simStatus.textContent = 'Cron 3 AM → recs-recompute-all…';

  try {
    skipSteps(1, 2);
    ['browser', 'api', 'mysql', 'cache-read'].forEach((name) => setMapNode(name, 'off'));
    setMapNode('redis', 'active');
    markStep(3, 'active');
    setMapCaption('③ El cron registrado con <code>upsertJobScheduler</code> encola <code>recs-recompute-all</code> a las 3 AM.');
    await sleep(400);
    setMapNode('redis', 'ok');
    markStep(3, 'ok');

    if (!demo.workerOn) {
      setMapNode('redis', 'waiting');
      setMapNode('workers', 'waiting');
      setMapNode('cache-write', 'waiting');
      markStep(4, 'waiting');
      markStep(5, 'waiting');
      markStep(6, 'waiting');
      setMapCaption('③ Job masivo en cola, pero <code>worker-recs</code> está apagado: el recompute no corre hasta levantarlo.');
      if (els.simStatus) els.simStatus.textContent = 'cron encolado · worker apagado';
      toast('Cron encolado: worker-recs apagado (demo).', true);
      return;
    }

    setMapNode('redis', 'active');
    setMapNode('workers', 'active');
    markStep(4, 'active');
    setMapCaption('④ El worker recorre los usuarios con interacciones en lotes de <code>RECS_RECOMPUTE_BATCH_SIZE</code>.');
    await sleep(520);
    setMapNode('redis', 'ok');
    setMapNode('workers', 'ok');
    markStep(4, 'ok');

    setMapNode('workers', 'active');
    setMapNode('cache-write', 'active');
    markStep(5, 'active');
    setMapCaption('⑤ Precaches de las tres listas por usuario; el progreso se reporta en Bull Board.');
    await sleep(460);
    demoWarmCache();
    demo.lastJob = { id: `recs-all-cron-2026-11-01`, queue: 'all', state: 'completed' };
    setMapNode('workers', 'ok');
    setMapNode('cache-write', 'ok');
    markStep(5, 'ok');

    const list = demoList('hybrid', 50);
    const alreadyNotified = demo.notifiedDates.has(demo.date);

    setMapNode('workers', 'active');
    setMapNode('notify', 'active');
    markStep(6, 'active');
    setMapCaption('⑥ Si la lista hybrid quedó con items, se emite <code>recs.ready</code> con dedupe por fecha.');
    await sleep(420);

    if (list.length && !alreadyNotified) {
      demo.notifiedDates.add(demo.date);
      demo.seq += 1;
      demo.notifications.unshift({
        id: String(demo.seq),
        type: 'recs.ready',
        payload: { count: list.length, date: demo.date },
        readAt: null,
        createdAt: new Date().toISOString(),
      });
      renderDemoNotifications();
      setMapNode('notify', 'ok');
      markStep(6, 'ok');
      setMapCaption(`⑥ <code>recs.ready</code> emitido: ${list.length} recomendaciones · dedupeKey=${demo.date}.`);
      if (els.simStatus) els.simStatus.textContent = `cron complete · ${list.length} recomendaciones · recs.ready`;
    } else if (alreadyNotified) {
      setMapNode('notify', 'waiting');
      markStep(6, 'waiting');
      setMapCaption(`⑥ Ya existe una notificación con dedupeKey=${demo.date}: <code>INSERT IGNORE</code> la descarta.`);
      if (els.simStatus) els.simStatus.textContent = 'cron complete · recs.ready ya emitido hoy';
    } else {
      setMapNode('notify', 'off');
      markStep(6, 'off');
      setMapCaption('⑥ La lista hybrid quedó vacía: no se emite <code>recs.ready</code>.');
      if (els.simStatus) els.simStatus.textContent = 'cron complete · sin recomendaciones para avisar';
    }

    await loadRecommendations({ silent: true });
  } finally {
    state.running = false;
  }
}

// ---------------------------------------------------------------------------
// Formularios de acción
// ---------------------------------------------------------------------------

function movieIdFrom(input, fallback = DEFAULT_MOVIE) {
  const raw = Number.parseInt(input?.value ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

async function submitReview() {
  const movieId = movieIdFrom(els.simReviewMovie);
  if (els.simReviewMovie) els.simReviewMovie.value = String(movieId);
  const rating = Number(els.simReviewRating?.value ?? 4.5);
  await runPipeline('review', {
    method: 'POST',
    path: `/movies/${movieId}/reviews`,
    body: {
      rating: Number.isFinite(rating) ? rating : 4.5,
      comment: `Review del laboratorio F4 (${new Date().toLocaleTimeString()})`,
    },
  });
}

async function deleteReview() {
  const movieId = movieIdFrom(els.simReviewMovie);
  await runPipeline('unreview', {
    method: 'DELETE',
    path: `/movies/${movieId}/reviews/me`,
  });
}

async function addWatchlist() {
  const movieId = movieIdFrom(els.simWatchMovie, 3);
  if (els.simWatchMovie) els.simWatchMovie.value = String(movieId);
  const priority = Number.parseInt(els.simWatchPriority?.value ?? '5', 10) || 5;
  await runPipeline('watchlist', {
    method: 'POST',
    path: '/users/me/watchlist',
    body: { movieId, priority },
  });
}

async function removeWatchlist() {
  const movieId = movieIdFrom(els.simWatchMovie, 3);
  await runPipeline('unwatchlist', {
    method: 'DELETE',
    path: `/users/me/watchlist/${movieId}`,
  });
}

// ---------------------------------------------------------------------------
// Notificaciones de demo
// ---------------------------------------------------------------------------

function renderDemoNotifications() {
  if (!els.demoNotifications) return;
  if (!demo.notifications.length) {
    els.demoNotifications.innerHTML = '<div class="empty">Sin notificaciones todavía. Simulá el cron nocturno.</div>';
    return;
  }
  els.demoNotifications.innerHTML = demo.notifications
    .map((notification) => {
      const count = notification.payload?.count ?? 0;
      return `<div class="notif-item">Nuevas recomendaciones: <strong>${escapeHtml(count)}</strong> disponibles
        <span class="meta">recs.ready · dedupeKey ${escapeHtml(notification.payload?.date ?? '')}</span></div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Contratos y casos borde
// ---------------------------------------------------------------------------

async function probe(kind, button) {
  if (!isLogged()) return;
  button.disabled = true;
  try {
    if (kind === 'recs') {
      const result = await callApi('GET', '/users/me/recommendations?type=hybrid&limit=5');
      toast(result.ok
        ? `${result.status} · ${result.data?.length ?? 0} items`
        : apiError(result.data, result.status), !result.ok);
      if (result.ok) await loadRecommendations({ silent: true });
    }

    if (kind === 'feedback') {
      const target = state.recommendations[0]?.movie;
      if (!target) {
        toast('No hay recomendaciones: primero generá señales.', true);
        return;
      }
      const result = await callApi('POST', '/users/me/recommendations/feedback', { movieId: target.id, action: 'view' });
      toast(result.ok ? `${result.status} · view sobre ${target.id} (sin invalidar)` : apiError(result.data, result.status), !result.ok);
    }

    if (kind === 'review') {
      const movieId = movieIdFrom(els.simReviewMovie);
      const result = await callApi('POST', `/movies/${movieId}/reviews`, {
        rating: 4.5,
        comment: `Probe de contrato F4 (${new Date().toLocaleTimeString()})`,
      });
      toast(result.ok ? `${result.status} · isNew=${result.data?.isNew === true}` : apiError(result.data, result.status), !result.ok);
      if (result.ok) await loadRecommendations({ silent: true });
    }

    if (kind === 'watchlist') {
      const movieId = movieIdFrom(els.simWatchMovie, 3);
      const result = await callApi('POST', '/users/me/watchlist', { movieId, priority: 5 });
      toast(result.ok ? `${result.status} · movieId ${movieId} agregado` : apiError(result.data, result.status), !result.ok);
      if (result.ok) await loadRecommendations({ silent: true });
    }
  } finally {
    button.disabled = false;
  }
}

function setEdgeResult(message, isError = false) {
  if (!els.edgeResult) return;
  els.edgeResult.textContent = message;
  els.edgeResult.style.color = isError ? 'var(--error)' : 'var(--ok)';
}

async function edge(kind, button) {
  if (!isLogged()) return;
  button.disabled = true;
  try {
    if (kind === 'limit') {
      const result = await callApi('GET', '/users/me/recommendations?limit=500');
      setEdgeResult(`GET con limit=500 → ${result.status} · ${result.ok ? 'inesperado: pasó la validación' : apiError(result.data, result.status)}`, !result.ok);
    }

    if (kind === 'type') {
      const result = await callApi('GET', '/users/me/recommendations?type=romance');
      setEdgeResult(`GET con type=romance → ${result.status} · ${result.ok ? 'inesperado: pasó la validación' : apiError(result.data, result.status)}`, !result.ok);
    }

    if (kind === 'signals') {
      if (DEMO) {
        demo.reviews.clear();
        demo.watchlist.clear();
        demo.liked.clear();
        demo.hidden.clear();
        demoInvalidate();
        await loadRecommendations({ silent: true });
        setEdgeResult('Sin interacciones ni preferencias: recomputeForUser termina skipped y el GET devuelve [].');
      } else {
        setEdgeResult('Sin señales, recomputeForUser no pega contra MySQL y el job queda skipped (caso B6). Para reproducirlo usá una cuenta nueva o ?demo=1.');
      }
    }

    if (kind === 'dedupe') {
      const bucket = minuteBucket();
      const id = `recs-user-<uuid>-${bucket}`;
      setEdgeResult(`Dos eventos en el mismo minuto comparten jobId: ${id}. El siguiente minuto usa ${minuteBucket(Date.now() + 60_000)}.`);
    }
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Autenticación, arranque y eventos
// ---------------------------------------------------------------------------

function syncAuth() {
  const logged = isLogged();
  els.loginRequired?.classList.toggle('hidden', logged);
  els.app?.classList.toggle('hidden', !logged);

  if (DEMO) els.authButtons?.classList.add('hidden');

  if (logged) {
    loadRecommendations();
  } else {
    state.recommendations = [];
    renderRecommendations();
  }
}

function applyStep(step) {
  const section = document.querySelector(`section[data-step="${step}"]`);
  if (!section) return;
  document.querySelectorAll('.step-highlight').forEach((el) => el.classList.remove('step-highlight'));
  section.classList.add('step-highlight');
  section.scrollIntoView({ behavior: 'instant', block: 'start' });
  if (step === 2) loadRecommendations({ silent: true });
}

function bindEvents() {
  els.btnLoadRecs?.addEventListener('click', () => loadRecommendations());
  els.recsType?.addEventListener('change', () => loadRecommendations());
  els.recsLimit?.addEventListener('change', () => loadRecommendations());
  els.btnSimReview?.addEventListener('click', submitReview);
  els.btnSimUnreview?.addEventListener('click', deleteReview);
  els.btnSimWatch?.addEventListener('click', addWatchlist);
  els.btnSimUnwatch?.addEventListener('click', removeWatchlist);
  els.btnSimCron?.addEventListener('click', runCronDemo);
  els.btnLoginInline?.addEventListener('click', () => auth.openModal('login'));

  els.simWorker?.addEventListener('change', () => {
    demo.workerOn = !!els.simWorker.checked;
    if (els.simStatus) els.simStatus.textContent = demo.workerOn ? 'worker-recs encendido (demo)' : 'worker-recs apagado (demo)';
  });

  els.btnResetSignals?.addEventListener('click', async () => {
    seedDemo();
    demo.workerOn = !!els.simWorker?.checked;
    renderDemoNotifications();
    await loadRecommendations({ silent: true });
    if (els.simStatus) els.simStatus.textContent = 'Señales de demo reiniciadas.';
    toast('Señales de demo reiniciadas');
  });

  els.recsGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-feedback-action]');
    if (!button) return;
    sendFeedback(Number(button.dataset.movieId), button.dataset.feedbackAction);
  });

  els.map?.addEventListener('click', (event) => {
    const node = event.target.closest('.map-node');
    if (!node || !els.nodeDetail) return;
    const detail = NODE_DETAILS[node.dataset.node];
    if (!detail) return;
    els.nodeDetail.textContent = `${node.dataset.node}: ${detail}`;
    els.nodeDetail.classList.remove('hidden');
  });

  els.btnClearLog?.addEventListener('click', () => {
    state.log = [];
    renderLog();
  });

  document.addEventListener('click', (event) => {
    const probeButton = event.target.closest('button[data-probe]');
    if (probeButton) {
      probe(probeButton.dataset.probe, probeButton);
      return;
    }
    const edgeButton = event.target.closest('button[data-edge]');
    if (edgeButton) edge(edgeButton.dataset.edge, edgeButton);
  });

  auth.onAuthChange(syncAuth);
}

function init() {
  if (LAB) {
    document.querySelectorAll('.lab-only').forEach((el) => el.classList.remove('hidden'));
  }
  if (DEMO) {
    els.demoBanner?.classList.remove('hidden');
    document.querySelectorAll('.demo-only').forEach((el) => el.classList.remove('hidden'));
    els.realWorkerNote?.classList.add('hidden');
    seedDemo();
    demo.workerOn = !DEMO_WORKER_OFF;
    if (els.simWorker) els.simWorker.checked = demo.workerOn;
    renderDemoNotifications();
  }

  if (els.recsType) els.recsType.value = DEFAULT_TYPE;
  if (els.recsLimit) els.recsLimit.value = String(DEFAULT_LIMIT);
  if (els.simReviewMovie) els.simReviewMovie.value = String(DEFAULT_MOVIE);

  bindEvents();
  auth.init();
  syncAuth();
  renderLog();

  if (STEP) setTimeout(() => applyStep(STEP), 300);
}

init();
