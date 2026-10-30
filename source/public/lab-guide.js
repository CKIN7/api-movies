const params = new URLSearchParams(window.location.search);
const STEP = (() => {
  const raw = Number.parseInt(params.get('step') ?? '', 10);
  return Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : null;
})();

const SECTION_IDS = ['modos', 'anatomia', 'mapa', 'e2e', 'qa', 'plantilla'];

const els = {
  tabbar: document.getElementById('tabbar'),
  map: document.getElementById('map'),
  caption: document.getElementById('map-caption'),
  nodeDetail: document.getElementById('node-detail'),
  stepsChips: document.getElementById('steps-chips'),
  toggleWorker: document.getElementById('toggle-worker'),
  toggleEmail: document.getElementById('toggle-email'),
  toggleRepeat: document.getElementById('toggle-repeat'),
  btnSimulate: document.getElementById('btn-simulate'),
  btnReset: document.getElementById('btn-reset'),
  e2eBody: document.getElementById('e2e-body'),
  e2eSummary: document.getElementById('e2e-summary'),
  btnRunE2e: document.getElementById('btn-run-e2e'),
  checklist: document.getElementById('checklist'),
  checklistProgress: document.getElementById('checklist-progress'),
  btnCopyChecklist: document.getElementById('btn-copy-checklist'),
  btnClearChecklist: document.getElementById('btn-clear-checklist'),
  btnCopyTemplate: document.getElementById('btn-copy-template'),
  templateSnippet: document.getElementById('template-snippet'),
  log: document.getElementById('log'),
  logCount: document.getElementById('log-count'),
  btnCopyLog: document.getElementById('btn-copy-log'),
  btnClearLog: document.getElementById('btn-clear-log'),
};

const state = {
  running: false,
  events: [],
};

const NODE_DETAILS = {
  browser: 'public/<feature>.html + .js — Auth, polling, acciones y log de peticiones.',
  api: 'routes/*.ts → middleware/requireAuth → controllers/* → services/* → repositories/*. Zod valida entrada y salida.',
  mysql: 'Tablas de la fase (reviews, notifications, …). El worker in-app escribe con INSERT IGNORE.',
  redis: 'Colas BullMQ por fase. El productor solo encola: no decide canales.',
  workers: 'workers/<feature>Worker.ts. Un Worker consume una cola y necesita un proceso aparte de la API.',
  resend: 'Servicio externo. Solo se usa si la preferencia del usuario lo habilita.',
};

const CHECKLIST_ITEMS = [
  'Página en public/ con HTML y JS, sin dependencias ni build',
  'Modo demo determinista y sin red',
  'Modo laboratorio autenticado y marcado',
  'Secciones mínimas: flujo, estado, contratos, casos borde, log',
  'Mapa de convergencia con estados y camino animado',
  'Guion E2E numerado y coincidente con el mapa',
  'Un caso negativo por cada validación relevante',
  'Log exportable o copiable',
  'Enlace en el menú, si la página es de producto',
  'Sección de demo/lab en el doc de la feature',
];

const CHECKLIST_KEY = 'lab-guide-checklist-v1';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function toast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

function addEvent(status, text) {
  state.events.unshift({
    status,
    text,
    time: new Date().toLocaleTimeString(),
  });
  if (state.events.length > 80) state.events.length = 80;
  renderLog();
}

function renderLog() {
  if (!state.events.length) {
    els.log.innerHTML = '<div class="log-empty">Todavía no hay eventos.</div>';
  } else {
    els.log.innerHTML = state.events
      .map((event) => {
        let cls = '';
        let label = String(event.status);
        if (typeof event.status === 'number') {
          cls = event.status >= 400 ? 'err' : 'ok';
        } else if (event.status === 'ok') {
          cls = 'ok';
          label = 'OK';
        } else if (event.status === 'wait') {
          cls = 'warn';
          label = 'WAIT';
        } else if (event.status === 'skip') {
          label = 'SKIP';
        } else {
          label = event.status.toUpperCase();
        }
        return `<div class="log-line"><span class="${cls}">${label}</span> ${event.text} <span class="muted">${event.time}</span></div>`;
      })
      .join('');
  }
  els.logCount.textContent = `${state.events.length} eventos`;
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

function connector(step) {
  return document.querySelector(`.map-connector[data-step="${step}"]`);
}

function chip(step) {
  return document.querySelector(`[data-step-chip="${step}"]`);
}

function setNode(name, status) {
  const el = document.querySelector(`.map-node[data-node="${name}"]`);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off', 'error');
  if (status !== 'idle') el.classList.add(status);
}

function setConnector(step, status) {
  const el = connector(step);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off');
  if (status !== 'idle') el.classList.add(status);
}

function setChip(step, status) {
  const el = chip(step);
  if (!el) return;
  el.classList.remove('active', 'ok', 'waiting', 'off');
  if (status !== 'idle') el.classList.add(status);
}

function setCaption(text) {
  els.caption.textContent = text;
}

function resetMap() {
  ['browser', 'api', 'mysql', 'redis', 'workers', 'resend'].forEach((name) => setNode(name, 'idle'));
  [1, 2, 3, 4, 5].forEach((step) => {
    setConnector(step, 'idle');
    setChip(step, 'idle');
  });
  els.nodeDetail.classList.add('hidden');
  els.nodeDetail.textContent = '';
  setCaption('Elegí los toggles y simulá un `POST /movies/1/reviews`.');
  renderE2E('idle');
  els.e2eSummary.textContent = 'Sin ejecutar';
}

// ---------------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------------

const TIMING = { fetch: 22, sql: 9, enqueue: 4, consume: 6, insert: 5, email: 11 };

async function simulate() {
  if (state.running) return;
  state.running = true;
  els.btnSimulate.disabled = true;

  const workerUp = els.toggleWorker.checked;
  const emailOn = els.toggleEmail.checked;
  const repeat = els.toggleRepeat.checked;
  const statuses = {};

  resetMap();
  addEvent('start', `POST /movies/1/reviews (worker=${workerUp ? 'on' : 'off'}, email=${emailOn ? 'on' : 'off'}, repetir=${repeat ? 'sí' : 'no'})`);

  try {
    // Paso 1: navegador -> API
    setNode('browser', 'active');
    setConnector(1, 'active');
    setChip(1, 'active');
    setCaption('① El navegador envía el request con el token del usuario.');
    await sleep(320);
    setNode('browser', 'ok');
    setNode('api', 'ok');
    setConnector(1, 'ok');
    setChip(1, 'ok');
    statuses[1] = 'ok';
    addEvent(repeat ? 200 : 201, `${repeat ? 200 : 201} POST /movies/1/reviews · ${TIMING.fetch} ms · Authorization: Bearer <token>`);

    // Paso 2: API -> MySQL
    setNode('api', 'active');
    setConnector(2, 'active');
    setChip(2, 'active');
    setCaption(repeat
      ? '② La review ya existía: el upsert actualiza la fila y devuelve isNew=false.'
      : '② El service hace upsert de la review. isNew=true.');
    await sleep(320);
    setNode('api', 'ok');
    setNode('mysql', 'ok');
    setConnector(2, 'ok');
    setChip(2, 'ok');
    statuses[2] = 'ok';
    addEvent('ok', `${repeat ? 'UPDATE' : 'INSERT'} reviews · ${TIMING.sql} ms · isNew=${repeat ? 'false' : 'true'}`);

    if (repeat) {
      [3, 4, 5].forEach((step) => {
        setConnector(step, 'off');
        setChip(step, 'off');
        statuses[step] = 'skip';
      });
      setNode('redis', 'off');
      setNode('workers', 'off');
      setNode('resend', 'off');
      setCaption('La review ya existía: isNew=false, así que no se emite el evento ni se encola nada.');
      addEvent('skip', 'review.published no emitido (isNew=false)');
      return;
    }

    // Paso 3: API -> Redis
    setNode('api', 'active');
    setConnector(3, 'active');
    setChip(3, 'active');
    setCaption('③ El productor encola el evento en notification-fanout. El service no conoce canales.');
    await sleep(320);
    setNode('api', 'ok');
    setNode('redis', 'ok');
    setConnector(3, 'ok');
    setChip(3, 'ok');
    statuses[3] = 'ok';
    addEvent(201, `201 POST /movies/1/reviews · total ${TIMING.fetch + TIMING.sql + TIMING.enqueue} ms`);
    addEvent('ok', `enqueued notification-fanout · jobId=review-published-42 · ${TIMING.enqueue} ms`);

    if (!workerUp) {
      [4, 5].forEach((step) => {
        setConnector(step, 'waiting');
        setChip(step, 'waiting');
        statuses[step] = 'wait';
      });
      setNode('redis', 'waiting');
      setNode('workers', 'waiting');
      setNode('resend', emailOn ? 'waiting' : 'off');
      setCaption('③ El job queda en waiting. La API responde 201, pero nadie consume la cola: posible worker apagado.');
      addEvent('wait', 'notification-fanout: 1 job en waiting · sin worker que consuma');
      return;
    }

    // Paso 4: Redis -> workers
    setConnector(4, 'active');
    setChip(4, 'active');
    setCaption('④ El worker consume el job y lee user_settings.notify_email.');
    await sleep(320);
    setNode('redis', 'ok');
    setNode('workers', 'ok');
    setConnector(4, 'ok');
    setChip(4, 'ok');
    statuses[4] = 'ok';
    addEvent('ok', `[notification-fanout] Job review-published-42 completed · ${TIMING.consume} ms`);

    // Paso 5: worker -> in-app / email
    setConnector(5, 'active');
    setChip(5, 'active');
    setCaption(emailOn
      ? '⑤ El fan-out encola el in-app y el email. El in-app es idempotente (INSERT IGNORE).'
      : '⑤ El fan-out encola solo el in-app: notify_email=false apaga el email.');
    await sleep(320);
    setConnector(5, 'ok');
    setChip(5, 'ok');
    statuses[5] = 'ok';
    addEvent('ok', `[notification-inapp] INSERT IGNORE notification · ${TIMING.insert} ms`);
    setNode('mysql', 'ok');

    if (emailOn) {
      setNode('resend', 'ok');
      addEvent('ok', `[email-transactional] review-published → Resend · ${TIMING.email} ms (entrega no verificable desde la API)`);
    } else {
      setNode('resend', 'off');
      addEvent('skip', 'email omitido: notify_email=false');
    }

    setCaption('La notificación ya está en la lista. El email, si está habilitado, va por su propia cola.');
  } finally {
    els.btnSimulate.disabled = false;
    state.running = false;
    renderE2E('done', statuses, { workerUp, emailOn, repeat });
    if (!workerUp && !repeat) els.e2eSummary.textContent = 'Guion incompleto: worker apagado';
  }
}

// ---------------------------------------------------------------------------
// Guion E2E
// ---------------------------------------------------------------------------

function e2eRows({ workerUp, emailOn, repeat }) {
  const rows = [
    { n: 1, path: 'Navegador → API', expect: 'POST /movies/1/reviews con Authorization' },
    {
      n: 2,
      path: 'API → MySQL',
      expect: repeat ? '200 · isNew=false (update)' : '201 · isNew=true (insert)',
    },
    {
      n: 3,
      path: 'API → Redis',
      expect: repeat ? 'No aplica: la review ya existía' : workerUp ? 'Job en notification-fanout' : 'Job en waiting: worker apagado',
    },
    {
      n: 4,
      path: 'Redis → workers',
      expect: repeat ? 'No aplica' : workerUp ? 'Job consumido por notification-fanout' : 'Nadie consume la cola',
    },
    {
      n: 5,
      path: 'Workers → MySQL / Resend',
      expect: repeat ? 'No aplica' : workerUp ? 'Notificación visible; email según preferencia' : 'Notificación no creada',
    },
  ];
  return rows;
}

function renderE2E(mode, statuses = {}, options = {}) {
  const toggles = {
    workerUp: els.toggleWorker.checked,
    emailOn: els.toggleEmail.checked,
    repeat: els.toggleRepeat.checked,
    ...options,
  };
  const rows = e2eRows(toggles);
  els.e2eBody.innerHTML = '';

  let ok = 0;
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const status = statuses[row.n];
    let label = 'Pendiente';
    let cls = '';
    if (mode === 'done') {
      if (status === 'ok') { label = 'OK'; cls = 'row-ok'; ok += 1; }
      else if (status === 'wait') { label = 'Esperando worker'; cls = 'row-wait'; }
      else { label = 'No aplica'; cls = 'row-skip'; }
    }
    tr.className = cls;
    tr.innerHTML = `
      <td>${row.n}</td>
      <td>${row.path}</td>
      <td>${row.expect}</td>
      <td>${label}</td>
    `;
    els.e2eBody.appendChild(tr);
  });

  if (mode === 'done') {
    els.e2eSummary.textContent = `${ok} de ${rows.length} pasos OK`;
  } else {
    els.e2eSummary.textContent = 'Sin ejecutar';
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

function loadChecklist() {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === CHECKLIST_ITEMS.length) return parsed;
  } catch {
    // ignore
  }
  return CHECKLIST_ITEMS.map(() => false);
}

function renderChecklist() {
  const values = loadChecklist();
  els.checklist.innerHTML = '';
  CHECKLIST_ITEMS.forEach((item, index) => {
    const li = document.createElement('li');
    const id = `check-${index}`;
    li.innerHTML = `
      <label for="${id}">
        <input type="checkbox" id="${id}" data-index="${index}" ${values[index] ? 'checked' : ''}>
        <span>${item}</span>
      </label>
    `;
    els.checklist.appendChild(li);
  });
  updateChecklistProgress(values);
}

function updateChecklistProgress(values = loadChecklist()) {
  const done = values.filter(Boolean).length;
  els.checklistProgress.textContent = `${done} de ${CHECKLIST_ITEMS.length} completados`;
}

function saveChecklist(values) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(values));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------

function activateTab(id) {
  els.tabbar.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.target === id);
  });
}

function bindTabs() {
  els.tabbar?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-target]');
    if (!button) return;
    const section = document.getElementById(button.dataset.target);
    if (!section) return;
    activateTab(button.dataset.target);
    section.scrollIntoView({ behavior: 'instant', block: 'start' });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) activateTab(visible.target.id);
      },
      { rootMargin: '-70px 0px -60% 0px', threshold: [0.1, 0.5] },
    );
    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function bindEvents() {
  els.btnSimulate?.addEventListener('click', simulate);
  els.btnReset?.addEventListener('click', () => {
    resetMap();
    addEvent('ok', 'estado reiniciado');
  });
  els.btnRunE2e?.addEventListener('click', simulate);

  els.map?.addEventListener('click', (event) => {
    const target = event.target.closest('.map-node');
    if (!target) return;
    const name = target.dataset.node;
    const detail = NODE_DETAILS[name];
    if (!detail) return;
    els.nodeDetail.textContent = `${name}: ${detail}`;
    els.nodeDetail.classList.remove('hidden');
  });

  [els.toggleWorker, els.toggleEmail, els.toggleRepeat].forEach((toggle) => {
    toggle?.addEventListener('change', () => {
      resetMap();
      addEvent('ok', `toggles: worker=${els.toggleWorker.checked ? 'on' : 'off'}, email=${els.toggleEmail.checked ? 'on' : 'off'}, repetir=${els.toggleRepeat.checked ? 'sí' : 'no'}`);
    });
  });

  els.checklist?.addEventListener('change', (event) => {
    const input = event.target.closest('input[data-index]');
    if (!input) return;
    const values = loadChecklist();
    values[Number(input.dataset.index)] = input.checked;
    saveChecklist(values);
    updateChecklistProgress(values);
  });

  els.btnClearChecklist?.addEventListener('click', () => {
    saveChecklist(CHECKLIST_ITEMS.map(() => false));
    renderChecklist();
    addEvent('ok', 'checklist limpiado');
  });

  els.btnCopyChecklist?.addEventListener('click', async () => {
    const values = loadChecklist();
    const text = CHECKLIST_ITEMS.map((item, index) => `- [${values[index] ? 'x' : ' '}] ${item}`).join('\n');
    const ok = await copyText(text);
    toast(ok ? 'Checklist copiado' : 'No se pudo copiar', !ok);
  });

  els.btnCopyTemplate?.addEventListener('click', async () => {
    const text = els.templateSnippet?.textContent ?? '';
    const ok = await copyText(text);
    toast(ok ? 'Sección copiada' : 'No se pudo copiar', !ok);
  });

  els.btnCopyLog?.addEventListener('click', async () => {
    const text = state.events
      .slice()
      .reverse()
      .map((event) => `[${event.time}] ${event.status} ${event.text}`)
      .join('\n');
    if (!text) {
      toast('No hay eventos para copiar', true);
      return;
    }
    const ok = await copyText(text);
    toast(ok ? 'Log copiado' : 'No se pudo copiar', !ok);
  });

  els.btnClearLog?.addEventListener('click', () => {
    state.events = [];
    renderLog();
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

function applyStep(step) {
  const section = document.getElementById(SECTION_IDS[step - 1]);
  if (!section) return;
  document.querySelectorAll('.step-highlight').forEach((el) => el.classList.remove('step-highlight'));
  section.classList.add('step-highlight');
  activateTab(section.id);
  section.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function init() {
  renderChecklist();
  renderLog();
  renderE2E('idle');
  bindTabs();
  bindEvents();
  addEvent('ok', 'guía cargada (modo mock, sin backend)');
  if (STEP) setTimeout(() => applyStep(STEP), 250);
}

init();
