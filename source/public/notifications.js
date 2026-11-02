import { Auth } from './auth.js';

const API_BASE = 'http://localhost:8089';

const params = new URLSearchParams(window.location.search);
const DEMO = params.get('demo') === '1';
const LAB = params.get('lab') === '1' || DEMO;
const DEMO_WORKER_OFF = DEMO && params.get('worker') === 'off';

const rawPoll = Number.parseInt(params.get('autopoll') ?? '', 10);
const POLL_SECONDS = DEMO ? 0 : (Number.isFinite(rawPoll) && rawPoll >= 0 ? rawPoll : 30);
const POLL_MS = POLL_SECONDS * 1000;

const DEFAULT_MOVIE = (() => {
  const raw = Number.parseInt(params.get('movieId') ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
})();

const STEP = (() => {
  const raw = Number.parseInt(params.get('step') ?? '', 10);
  return Number.isFinite(raw) && raw >= 1 && raw <= 7 ? raw : null;
})();

const PAGE_SIZE = 20;

const auth = new Auth(API_BASE);

const state = {
  notifications: [],
  total: 0,
  unread: 0,
  filter: 'all',
  loading: false,
  simulating: false,
  mapInitialized: false,
  log: [],
};

const els = {
  demoBanner: document.getElementById('demo-banner'),
  loginRequired: document.getElementById('login-required'),
  app: document.getElementById('app'),
  badge: document.getElementById('badge-count'),
  authButtons: document.getElementById('auth-buttons'),
  map: document.getElementById('map'),
  mapCaption: document.getElementById('map-caption'),
  nodeDetail: document.getElementById('node-detail'),
  filterGroup: document.getElementById('filter-group'),
  listStatus: document.getElementById('list-status'),
  notifList: document.getElementById('notif-list'),
  btnReadAll: document.getElementById('btn-read-all'),
  btnRefresh: document.getElementById('btn-refresh'),
  simMovie: document.getElementById('sim-movie'),
  simEmail: document.getElementById('sim-email'),
  simRepeat: document.getElementById('sim-repeat'),
  btnSimulate: document.getElementById('btn-simulate'),
  simStatus: document.getElementById('sim-status'),
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

function formatRelative(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';
  const diff = Date.now() - time;
  if (diff < 45_000) return 'hace instantes';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(value).toLocaleDateString();
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

const DEMO_TITLES = {
  1: 'Inception',
  2: 'Interstellar',
  3: 'The Dark Knight',
  4: 'Pulp Fiction',
  5: 'Fight Club',
};

const demo = {
  notifications: [],
  reviews: new Map(),
  seq: 4,
};

function seedDemo() {
  const now = Date.now();
  const readAt = new Date(now - 3 * 60 * 60_000).toISOString();
  demo.notifications = [
    {
      id: '3',
      type: 'review.published',
      payload: { movieId: 2, movieTitle: 'Interstellar', reviewId: '9003' },
      readAt: null,
      createdAt: new Date(now - 2 * 60_000).toISOString(),
    },
    {
      id: '2',
      type: 'review.published',
      payload: { movieId: 3, movieTitle: 'The Dark Knight', reviewId: '9002' },
      readAt: null,
      createdAt: new Date(now - 42 * 60_000).toISOString(),
    },
    {
      id: '1',
      type: 'review.published',
      payload: { movieId: 4, movieTitle: 'Pulp Fiction', reviewId: '9001' },
      readAt,
      createdAt: readAt,
    },
  ];
  demo.reviews = new Map([
    [2, '9003'],
    [3, '9002'],
    [4, '9001'],
  ]);
  demo.seq = 4;
}

function demoRequest(method, path, body) {
  const url = new URL(path, 'http://demo.local');
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/users/me/notifications') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10) || PAGE_SIZE;
    if (rawLimit < 1 || rawLimit > 100) {
      return { status: 400, data: { error: 'El límite debe estar entre 1 y 100' } };
    }
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const all = demo.notifications
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const filtered = unreadOnly ? all.filter((item) => !item.readAt) : all;
    const start = (page - 1) * rawLimit;
    return {
      status: 200,
      data: {
        notifications: filtered.slice(start, start + rawLimit),
        total: filtered.length,
        page,
        limit: rawLimit,
      },
    };
  }

  if (method === 'GET' && pathname === '/users/me/notifications/unread-count') {
    return { status: 200, data: { unread: demo.notifications.filter((item) => !item.readAt).length } };
  }

  if (method === 'PATCH' && pathname === '/users/me/notifications/read-all') {
    let updated = 0;
    const now = new Date().toISOString();
    demo.notifications.forEach((item) => {
      if (!item.readAt) {
        item.readAt = now;
        updated += 1;
      }
    });
    return { status: 200, data: { updated } };
  }

  const readMatch = pathname.match(/^\/users\/me\/notifications\/([^/]+)\/read$/);
  if (method === 'PATCH' && readMatch) {
    const item = demo.notifications.find((entry) => String(entry.id) === readMatch[1]);
    if (!item) return { status: 404, data: { error: 'Notificación no encontrada' } };
    if (!item.readAt) item.readAt = new Date().toISOString();
    return { status: 200, data: { notification: item } };
  }

  if (method === 'PATCH' && pathname === '/users/me/settings') {
    return { status: 200, data: { notifyEmail: body?.notifyEmail ?? true } };
  }

  const reviewMatch = pathname.match(/^\/movies\/(\d+)\/reviews$/);
  if (method === 'POST' && reviewMatch) {
    const movieId = Number(reviewMatch[1]);
    if (demo.reviews.has(movieId)) {
      return {
        status: 200,
        data: { isNew: false, message: 'Reseña actualizada con éxito', data: { movieId } },
      };
    }
    const reviewId = String(9000 + demo.seq);
    demo.reviews.set(movieId, reviewId);
    if (!DEMO_WORKER_OFF) demo.notifications.push({
      id: String(demo.seq),
      type: 'review.published',
      payload: {
        movieId,
        movieTitle: DEMO_TITLES[movieId] ?? `Película #${movieId}`,
        reviewId,
      },
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    demo.seq += 1;
    return {
      status: 201,
      data: { isNew: true, message: 'Reseña creada con éxito', data: { movieId, reviewId } },
    };
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
// Render de la lista y del badge
// ---------------------------------------------------------------------------

function notifTitle(notification) {
  const movieTitle = notification?.payload?.movieTitle;
  if (notification?.type === 'review.published') {
    if (movieTitle) {
      return `Tu review de <strong>${escapeHtml(movieTitle)}</strong> fue publicada`;
    }
    return 'Tu review fue publicada';
  }
  return `Notificación <strong>${escapeHtml(notification?.type ?? 'desconocida')}</strong>`;
}

function renderList() {
  if (!els.notifList) return;
  els.notifList.innerHTML = '';

  if (!state.notifications.length) {
    const message = state.filter === 'unread'
      ? 'No tenés notificaciones sin leer.'
      : 'Todavía no hay notificaciones. Creá una review desde el simulador.';
    els.notifList.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  state.notifications.forEach((notification) => {
    const unread = !notification.readAt;
    const item = document.createElement('div');
    item.className = `notif-item${unread ? ' unread' : ''}`;
    item.innerHTML = `
      <span class="notif-dot"></span>
      <div class="notif-body">
        <div class="notif-title">${notifTitle(notification)}</div>
        <div class="notif-meta">${escapeHtml(formatRelative(notification.createdAt))} · ${escapeHtml(notification.type)} · id ${escapeHtml(notification.id)}</div>
      </div>
      <div class="notif-actions">
        ${unread ? `<button class="btn btn-outline btn-sm" data-read="${escapeHtml(notification.id)}">Marcar leída</button>` : '<span class="muted">Leída</span>'}
      </div>
    `;
    els.notifList.appendChild(item);
  });
}

function renderBadge() {
  if (!els.badge) return;
  els.badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
}

function updateStatus() {
  if (!els.listStatus) return;
  const polling = DEMO
    ? 'modo demo, sin polling'
    : POLL_SECONDS > 0
      ? `polling cada ${POLL_SECONDS}s`
      : 'polling desactivado';
  els.listStatus.textContent = `${state.notifications.length} de ${state.total} · actualizado ${new Date().toLocaleTimeString()} · ${polling}`;
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

async function refreshAll({ silent = false } = {}) {
  if (!isLogged() || state.loading) return;
  state.loading = true;
  if (!silent && els.listStatus) els.listStatus.textContent = 'Cargando…';

  try {
    const query = new URLSearchParams({ page: '1', limit: String(PAGE_SIZE) });
    if (state.filter === 'unread') query.set('unread_only', 'true');

    const list = await callApi('GET', `/users/me/notifications?${query.toString()}`, undefined, state.filter === 'unread' ? 'filtro no leídas' : '');
    if (!list.ok) {
      if (els.listStatus) els.listStatus.textContent = `No se pudo cargar la lista: ${apiError(list.data, list.status)}`;
      return;
    }

    const count = await callApi('GET', '/users/me/notifications/unread-count');

    state.notifications = Array.isArray(list.data?.notifications) ? list.data.notifications : [];
    state.total = Number.isFinite(list.data?.total) ? list.data.total : state.notifications.length;
    if (count.ok) {
      state.unread = Number.isFinite(count.data?.unread) ? count.data.unread : state.unread;
    } else {
      state.unread = state.notifications.filter((item) => !item.readAt).length;
    }

    renderList();
    renderBadge();
    updateStatus();
    if (!state.mapInitialized && !state.simulating) {
      markRestingMap();
      state.mapInitialized = true;
    }
  } finally {
    state.loading = false;
  }
}

async function markRead(id) {
  const result = await callApi('PATCH', `/users/me/notifications/${encodeURIComponent(id)}/read`);
  if (!result.ok) {
    toast(apiError(result.data, result.status), true);
    return;
  }
  const updated = result.data?.notification;
  const local = state.notifications.find((item) => String(item.id) === String(id));
  if (local && updated?.readAt) local.readAt = updated.readAt;
  state.unread = Math.max(0, state.unread - 1);
  renderList();
  renderBadge();
  updateStatus();
}

async function markAllRead() {
  const result = await callApi('PATCH', '/users/me/notifications/read-all');
  if (!result.ok) {
    toast(apiError(result.data, result.status), true);
    return;
  }
  const updated = result.data?.updated ?? 0;
  const now = new Date().toISOString();
  state.notifications.forEach((item) => {
    if (!item.readAt) item.readAt = now;
  });
  state.unread = 0;
  renderList();
  renderBadge();
  toast(`${updated} notificación(es) marcadas como leídas`);
  await refreshAll({ silent: true });
}

// ---------------------------------------------------------------------------
// Mapa de convergencia
// ---------------------------------------------------------------------------

const DEFAULT_MAP_CAPTION = 'El fan-out lee <code>user_settings.notify_email</code> y decide los canales. El in-app es idempotente por <code>UNIQUE (user_id, type, dedupe_key)</code>. Hacé click en un nodo para ver qué lo implementa.';

const NODE_DETAILS = {
  browser: 'public/notifications.html + .js — Auth, polling, simulador y log de peticiones.',
  api: 'routes/notificationRoutes.ts → controllers/notificationController.ts → services/NotificationService.ts → repositories/NotificationRepository.ts. requireAuth en todas.',
  mysql: 'reviews (upsert del POST) y notifications (INSERT IGNORE, UNIQUE (user_id, type, dedupe_key)).',
  redis: 'Colas BullMQ: notification-fanout y notification-inapp. El productor solo encola: no decide canales.',
  workers: 'workers/notificationWorker.ts. Consume fan-out e in-app; necesita un proceso aparte (npm run worker:notifications:dev).',
  resend: 'Cola email-transactional → workers/emailWorker.ts → Resend. Solo si user_settings.notify_email lo habilita.',
};

function setMapNode(name, status) {
  const el = document.querySelector(`.map-node[data-node="${name}"]`);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off', 'error');
  if (status !== 'idle') el.classList.add(status);
}

function setMapConnector(step, status) {
  const el = document.querySelector(`.map-connector[data-step="${step}"]`);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off', 'error');
  if (status !== 'idle') el.classList.add(status);
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
  ['browser', 'api', 'mysql', 'redis', 'workers', 'resend'].forEach((name) => setMapNode(name, 'idle'));
  [1, 2, 3, 4, 5].forEach((step) => {
    setMapConnector(step, 'idle');
    setMapChip(step, 'idle');
  });
  if (els.nodeDetail) {
    els.nodeDetail.classList.add('hidden');
    els.nodeDetail.textContent = '';
  }
  setMapCaption(DEFAULT_MAP_CAPTION);
}

function skipSteps(...steps) {
  steps.forEach((step) => {
    setMapConnector(step, 'off');
    setMapChip(step, 'off');
  });
}

function markRestingMap() {
  setMapNode('browser', 'ok');
  setMapNode('api', 'ok');
  setMapNode('mysql', 'ok');
  setMapConnector(1, 'ok');
  setMapConnector(2, 'ok');
  setMapChip(1, 'ok');
  setMapChip(2, 'ok');
}

async function waitForNewNotification(previousIds, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await refreshAll({ silent: true });
    const found = state.notifications.find((item) => !previousIds.has(String(item.id)));
    if (found) return found;
    await sleep(1000);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Simulador
// ---------------------------------------------------------------------------

async function postReview(movieId) {
  const result = await callApi('POST', `/movies/${movieId}/reviews`, {
    rating: 4.5,
    comment: `Review generada desde el laboratorio F3 (${new Date().toLocaleTimeString()})`,
  });
  if (!result.ok) {
    toast(apiError(result.data, result.status), true);
    return null;
  }
  return result;
}

function describePost(result) {
  return `${result.status} · isNew=${result.data?.isNew === true}`;
}

async function simulate() {
  if (!isLogged()) {
    auth.openModal('login');
    return;
  }
  if (state.simulating) return;

  const movieId = Math.max(1, Number.parseInt(els.simMovie?.value ?? '', 10) || DEFAULT_MOVIE);
  if (els.simMovie) els.simMovie.value = String(movieId);
  const wantEmail = !!els.simEmail?.checked;

  state.simulating = true;
  els.btnSimulate.disabled = true;
  resetMap();
  const before = new Set(state.notifications.map((item) => String(item.id)));

  try {
    if (!DEMO) {
      els.simStatus.textContent = `Actualizando notify_email = ${wantEmail}…`;
      const settings = await callApi('PATCH', '/users/me/settings', { notifyEmail: wantEmail });
      if (!settings.ok) {
        els.simStatus.textContent = `No se pudo actualizar settings: ${apiError(settings.data, settings.status)}`;
        toast(apiError(settings.data, settings.status), true);
        return;
      }
    } else {
      els.simStatus.textContent = `[demo] notify_email = ${wantEmail}`;
    }

    // Paso 1: navegador -> API
    setMapNode('browser', 'active');
    setMapConnector(1, 'active');
    setMapChip(1, 'active');
    setMapCaption('① El navegador envía el <code>POST</code> con el token del usuario.');
    els.simStatus.textContent = `POST /movies/${movieId}/reviews…`;

    const first = await postReview(movieId);
    if (!first) {
      setMapNode('browser', 'error');
      setMapConnector(1, 'error');
      setMapChip(1, 'error');
      setMapCaption('El <code>POST</code> falló. Mirá el log de peticiones.');
      els.simStatus.textContent = 'La review falló. Mirá el log de peticiones.';
      return;
    }
    setMapNode('browser', 'ok');
    setMapNode('api', 'ok');
    setMapConnector(1, 'ok');
    setMapChip(1, 'ok');

    // Paso 2: API -> MySQL
    const isNew = first.data?.isNew === true;
    setMapNode('api', 'active');
    setMapConnector(2, 'active');
    setMapChip(2, 'active');
    setMapCaption(isNew
      ? '② El service hace upsert de la review. <code>isNew=true</code>.'
      : '② La review ya existía: el upsert devuelve <code>isNew=false</code>.');
    els.simStatus.textContent = describePost(first);
    await sleep(360);
    setMapNode('api', 'ok');
    setMapNode('mysql', 'ok');
    setMapConnector(2, 'ok');
    setMapChip(2, 'ok');

    if (!isNew) {
      skipSteps(3, 4, 5);
      setMapNode('redis', 'off');
      setMapNode('workers', 'off');
      setMapNode('resend', 'off');
      setMapCaption('La review ya existía: <code>isNew=false</code>, así que no se emite el evento ni se encola nada.');
      els.simStatus.textContent = `${describePost(first)} — la review ya existía, no se emite evento`;
      return;
    }

    // Paso 3: API -> Redis
    setMapNode('api', 'active');
    setMapConnector(3, 'active');
    setMapChip(3, 'active');
    setMapCaption('③ El productor encola el evento en <code>notification-fanout</code>. El service no conoce canales.');
    await sleep(360);
    setMapNode('api', 'ok');
    setMapNode('redis', 'ok');
    setMapConnector(3, 'ok');
    setMapChip(3, 'ok');

    // Pasos 4 y 5: esperar la notificación nueva (hasta 10 s)
    setMapNode('redis', 'active');
    setMapConnector(4, 'active');
    setMapChip(4, 'active');
    setMapCaption('③ Job encolado en <code>notification-fanout</code>. Esperando que el worker lo consuma (hasta 10 s)...');
    els.simStatus.textContent = `${describePost(first)} — esperando la notificación...`;

    const fresh = await waitForNewNotification(before, 10_000);

    if (fresh) {
      setMapNode('redis', 'ok');
      setMapNode('workers', 'ok');
      setMapConnector(4, 'ok');
      setMapChip(4, 'ok');
      setMapNode('mysql', 'active');
      setMapConnector(5, 'active');
      setMapChip(5, 'active');
      setMapCaption('④⑤ El worker consume el job e inserta la notificación (<code>INSERT IGNORE</code>).');
      await sleep(320);
      setMapNode('mysql', 'ok');
      setMapConnector(5, 'ok');
      setMapChip(5, 'ok');

      if (wantEmail) {
        setMapNode('resend', 'ok');
        setMapCaption('④⑤ Notificación in-app creada. El email va por <code>email-transactional</code> → Resend (entrega no verificable desde la API).');
      } else {
        setMapNode('resend', 'off');
        setMapCaption('④⑤ Notificación in-app creada. El email se omite porque <code>notify_email=false</code>.');
      }
      els.simStatus.textContent = `${describePost(first)} — la notificación ya está en la lista`;
    } else {
      setMapConnector(4, 'waiting');
      setMapChip(4, 'waiting');
      setMapConnector(5, 'waiting');
      setMapChip(5, 'waiting');
      setMapNode('redis', 'waiting');
      setMapNode('workers', 'waiting');
      setMapNode('resend', wantEmail ? 'waiting' : 'off');
      setMapCaption('④ La API respondió <code>201</code> y el job quedó encolado, pero la notificación no apareció en 10 s: <strong>posible worker apagado</strong>. Corré <code>npm run worker:notifications:dev</code>.');
      els.simStatus.textContent = `${describePost(first)} — sin notificación nueva: revisá el worker`;
      toast('La notificación no apareció en 10 s: posible worker apagado.', true);
    }

    if (els.simRepeat?.checked) {
      els.simStatus.textContent = 'Repitiendo el POST (update)...';
      const second = await postReview(movieId);
      if (second) {
        els.simStatus.textContent = `primero: ${describePost(first)} · segundo: ${describePost(second)}`;
        toast(second.data?.isNew === true
          ? 'El segundo POST creó una review: el primer intento no había persistido.'
          : 'Segundo POST idempotente: isNew=false, sin notificación nueva.');
        await refreshAll({ silent: true });
      }
    }
  } finally {
    state.simulating = false;
    els.btnSimulate.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Contratos y casos borde
// ---------------------------------------------------------------------------

async function probe(kind, button) {
  if (!isLogged()) return;
  button.disabled = true;
  try {
    if (kind === 'list') {
      const result = await callApi('GET', '/users/me/notifications?page=1&limit=5');
      if (!result.ok) {
        toast(apiError(result.data, result.status), true);
      } else {
        const count = result.data?.notifications?.length ?? 0;
        toast(`${result.status} · ${count} item(s) en página 1, total ${result.data?.total ?? 0}`);
      }
    }

    if (kind === 'count') {
      const result = await callApi('GET', '/users/me/notifications/unread-count');
      toast(result.ok ? `${result.status} · unread = ${result.data?.unread ?? 0}` : apiError(result.data, result.status), !result.ok);
    }

    if (kind === 'read-first') {
      const target = state.notifications.find((item) => !item.readAt) ?? state.notifications[0];
      if (!target) {
        toast('No hay notificaciones para marcar. Creá una review.', true);
        return;
      }
      const result = await callApi('PATCH', `/users/me/notifications/${encodeURIComponent(target.id)}/read`);
      toast(result.ok ? `${result.status} · id ${target.id} marcada` : apiError(result.data, result.status), !result.ok);
      if (result.ok) await refreshAll({ silent: true });
    }

    if (kind === 'read-all') {
      await markAllRead();
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
    if (kind === 'foreign') {
      const result = await callApi('PATCH', '/users/me/notifications/999999999/read');
      setEdgeResult(`PATCH de un id ajeno → ${result.status} · ${apiError(result.data, result.status)}`, result.status !== 404);
    }

    if (kind === 'limit') {
      const result = await callApi('GET', '/users/me/notifications?limit=500');
      setEdgeResult(`GET con limit=500 → ${result.status} · ${result.ok ? 'inesperado: pasó la validación' : apiError(result.data, result.status)}`, !result.ok);
    }

    if (kind === 'idempotent') {
      const target = state.notifications[0];
      if (!target) {
        setEdgeResult('No hay notificaciones: primero creá una review.', true);
        return;
      }
      const first = await callApi('PATCH', `/users/me/notifications/${encodeURIComponent(target.id)}/read`);
      const second = await callApi('PATCH', `/users/me/notifications/${encodeURIComponent(target.id)}/read`);
      const firstAt = first.data?.notification?.readAt;
      const secondAt = second.data?.notification?.readAt;
      const stable = first.ok && second.ok && firstAt === secondAt;
      setEdgeResult(
        stable
          ? `id ${target.id}: dos PATCH → ${first.status}/${second.status} con readAt estable (${firstAt}).`
          : `id ${target.id}: ${first.status}/${second.status} · readAt ${firstAt ?? '—'} vs ${secondAt ?? '—'}`,
        !stable,
      );
      if (first.ok) await refreshAll({ silent: true });
    }

    if (kind === 'update') {
      const movieId = Number(state.notifications[0]?.payload?.movieId) || Number(els.simMovie?.value) || DEFAULT_MOVIE;
      const result = await callApi('POST', `/movies/${movieId}/reviews`, {
        rating: 4.5,
        comment: `Update simulado desde el laboratorio F3 (${new Date().toLocaleTimeString()})`,
      });
      if (!result.ok) {
        setEdgeResult(`POST sobre movieId=${movieId} → ${result.status} · ${apiError(result.data, result.status)}`, true);
        return;
      }
      const isNew = result.data?.isNew === true;
      setEdgeResult(
        `POST sobre movieId=${movieId} → ${result.status} · isNew=${isNew}. ${isNew ? 'No existía: se creó y notificó.' : 'Ya existía: no se emitió evento ni notificación.'}`,
        isNew,
      );
      await refreshAll({ silent: true });
    }
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Autenticación, polling y arranque
// ---------------------------------------------------------------------------

let pollTimer = null;

function startPolling() {
  stopPolling();
  if (DEMO || POLL_MS <= 0) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshAll({ silent: true });
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function syncAuth() {
  const logged = isLogged();
  els.loginRequired?.classList.toggle('hidden', logged);
  els.app?.classList.toggle('hidden', !logged);

  if (DEMO) els.authButtons?.classList.add('hidden');

  if (logged) {
    refreshAll();
    startPolling();
  } else {
    stopPolling();
    state.notifications = [];
    state.unread = 0;
    renderBadge();
  }
}

function applyStep(step) {
  const section = document.querySelector(`[data-step="${step}"]`);
  if (!section) return;
  document.querySelectorAll('.step-highlight').forEach((el) => el.classList.remove('step-highlight'));
  section.classList.add('step-highlight');
  section.scrollIntoView({ behavior: 'instant', block: 'start' });
  if (step === 2) refreshAll({ silent: true });
}

function bindEvents() {
  els.btnRefresh?.addEventListener('click', () => refreshAll());
  els.btnReadAll?.addEventListener('click', markAllRead);
  els.btnSimulate?.addEventListener('click', simulate);
  els.btnLoginInline?.addEventListener('click', () => auth.openModal('login'));

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

  els.filterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    els.filterGroup.querySelectorAll('button').forEach((item) => {
      item.classList.toggle('active', item === button);
    });
    refreshAll();
  });

  els.notifList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-read]');
    if (button) markRead(button.dataset.read);
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isLogged()) refreshAll({ silent: true });
  });

  auth.onAuthChange(syncAuth);
}

function init() {
  if (LAB) {
    document.querySelectorAll('.lab-only').forEach((el) => el.classList.remove('hidden'));
  }
  if (DEMO) {
    els.demoBanner?.classList.remove('hidden');
    seedDemo();
  }

  if (els.simMovie) els.simMovie.value = String(DEFAULT_MOVIE);

  bindEvents();
  auth.init();
  syncAuth();
  renderLog();

  if (STEP) setTimeout(() => applyStep(STEP), 300);
}

init();
