import { getAll, put, remove } from './db.js';
import { computeTotals } from './totals.js';
import { expandSeries, toKey } from './schedule.js';
import { motivation, surprise } from './messages.js';

const DAY_MS = 86400000;
const HORIZON_DAYS = 56;
const TABS = [
  ['home', 'Ana'],
  ['clients', 'Danışanlar'],
  ['program', 'Program'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
];
// Sunday is 0 in Date.getDay(), so the list starts on Monday and ends with Sunday.
const WEEKDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];

const state = { tab: 'home', clients: [], sessions: [], series: [], notice: '' };
let root;

export async function startUi(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  await reload();
}

async function reload() {
  [state.clients, state.sessions, state.series] = await Promise.all(
    ['clients', 'sessions', 'series'].map(getAll),
  );
  await generateSessions();
  render();
}

// Writes the planned sessions of every weekly series up to HORIZON_DAYS ahead. Sessions that already exist are left alone,
// so statuses, fees and payments recorded on them are never overwritten.
async function generateSessions() {
  const horizon = toKey(new Date(Date.now() + HORIZON_DAYS * DAY_MS));
  const known = new Set(state.sessions.map((s) => s.id));
  const created = [];
  for (const series of state.series) {
    for (const occurrence of expandSeries(series, series.startDate, horizon)) {
      if (!known.has(occurrence.id)) created.push(occurrence);
    }
  }
  for (const session of created) await put('sessions', session);
  state.sessions = [...state.sessions, ...created];
}

function render() {
  root.innerHTML = `
    <section class="screen">${screen()}</section>
    <nav class="tabs">${TABS.map(
      ([id, label]) => `<button type="button" data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`,
    ).join('')}</nav>`;
}

function screen() {
  switch (state.tab) {
    case 'clients': return clientsScreen();
    case 'program': return programScreen();
    case 'sessions': return sessionsScreen();
    case 'summary': return summaryScreen();
    default: return homeScreen();
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function clientName(id) {
  return state.clients.find((c) => c.id === id)?.name ?? '—';
}

function fmtDate(value) {
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

function money(n) {
  return `${Number(n).toLocaleString('tr-TR')} ₺`;
}

function activeSeriesOf(clientId) {
  const todayKey = toKey(new Date());
  return state.series.filter((s) => s.clientId === clientId && (!s.endDate || s.endDate >= todayKey));
}

function homeScreen() {
  const day = Math.floor(Date.now() / DAY_MS);
  const now = Date.now();
  const upcoming = state.sessions
    .filter((s) => s.status === 'planned' && new Date(s.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);
  return `
    <header class="hero">
      <p class="heart">♥</p>
      <h1>${esc(motivation(day))}</h1>
      <p class="note">${esc(surprise(day))}</p>
    </header>
    <h2>Yaklaşan seanslar</h2>
    ${upcoming.map((s) => `
      <article class="card">
        <strong>${esc(clientName(s.clientId))}</strong>
        <span>${esc(fmtDate(s.start))}</span>
      </article>`).join('') || '<p class="empty">Yaklaşan seans yok.</p>'}`;
}

function clientsScreen() {
  const rows = state.clients.map((c) => `
    <form class="card" data-form="client" data-id="${esc(c.id)}">
      <label>Ad <input name="name" value="${esc(c.name)}" required></label>
      <button type="submit">Kaydet</button>
    </form>`).join('');
  return `
    <h2>Danışanlar</h2>
    <form class="card" data-form="newClient">
      <label>Ad <input name="name" required></label>
      <button type="submit">Danışan ekle</button>
    </form>
    ${rows || '<p class="empty">Henüz danışan yok.</p>'}`;
}

// One card per client. A weekday with a fee is a day the client comes; an empty weekday is a day off.
function programScreen() {
  if (!state.clients.length) {
    return '<h2>Program</h2><p class="empty">Önce Danışanlar sekmesinden danışan ekleyin.</p>';
  }
  const todayKey = toKey(new Date());
  const cards = state.clients.map((c) => {
    const active = activeSeriesOf(c.id);
    const time = active[0]?.time ?? '';
    const duration = active[0]?.durationMin ?? 50;
    const feeFor = (w) => active.find((s) => s.weekdays[0] === w)?.fee ?? '';
    return `
      <fieldset class="card program">
        <legend><strong>${esc(c.name)}</strong></legend>
        <div class="grid2">
          <label>Saat <input type="time" name="time-${esc(c.id)}" value="${esc(time)}"></label>
          <label>Süre (dk) <input type="number" min="5" step="5" name="duration-${esc(c.id)}" value="${esc(duration)}"></label>
        </div>
        <p class="hint">Gelen günlerin ücretini yazın. Gelmediği günü boş bırakın.</p>
        <div class="grid-days">
          ${WEEKDAYS.map(([w, l]) => `
            <label>${l} <input type="number" min="0" step="1" name="fee-${esc(c.id)}-${w}" value="${esc(feeFor(w))}" placeholder="—"></label>`).join('')}
        </div>
      </fieldset>`;
  }).join('');
  return `
    <h2>Haftalık program</h2>
    <form data-form="program">
      <label class="card">Başlangıç tarihi <input type="date" name="startDate" value="${todayKey}" required></label>
      ${cards}
      <button type="submit" class="sync">Programı kaydet</button>
    </form>
    ${state.notice ? `<p class="notice">${esc(state.notice)}</p>` : ''}`;
}

function sessionsScreen() {
  const items = [...state.sessions]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const done = s.status === 'done';
      const cancelled = s.status === 'cancelled';
      return `
        <article class="card session" data-session="${esc(s.id)}">
          <div class="row"><strong>${esc(clientName(s.clientId))}</strong><span>${esc(fmtDate(s.start))}</span></div>
          <label>Ücret (₺) <input type="number" min="0" step="1" data-field="fee" value="${esc(s.fee ?? 0)}"></label>
          <div class="status-buttons">
            <button type="button" data-action="status" data-value="done" aria-pressed="${done}" class="${done ? 'active' : ''}">Gerçekleşti</button>
            <button type="button" data-action="status" data-value="cancelled" aria-pressed="${cancelled}" class="${cancelled ? 'active' : ''}">İptal</button>
            <button type="button" data-action="paid" aria-pressed="${!!s.paid}" class="${s.paid ? 'active' : ''}">Ödendi</button>
          </div>
          ${s.paid && s.paidOn ? `<p class="paid-on">Ödeme tarihi: ${esc(new Date(s.paidOn).toLocaleDateString('tr-TR'))}</p>` : ''}
        </article>`;
    })
    .join('');
  return `
    <h2>Seanslar</h2>
    ${state.notice ? `<p class="notice">${esc(state.notice)}</p>` : ''}
    ${items || '<p class="empty">Henüz seans yok. Program sekmesinden haftalık programı kaydedin.</p>'}`;
}

function summaryScreen() {
  const t = computeTotals({ clients: state.clients, sessions: state.sessions });
  const perClient = t.perClient.map((c) => `
    <article class="card">
      <h3>${esc(c.name)}</h3>
      <p>${c.sessionCount} gerçekleşen seans</p>
      <p>Faturalanan ${money(c.billed)} · Alınan ${money(c.paid)} · Kalan ${money(c.outstanding)}</p>
    </article>`).join('');
  return `
    <h2>Özet</h2>
    <section class="card total">
      <p>Faturalanan <strong>${money(t.overall.billed)}</strong></p>
      <p>Alınan <strong>${money(t.overall.paid)}</strong></p>
      <p>Bekleyen <strong>${money(t.overall.outstanding)}</strong></p>
    </section>
    ${perClient || '<p class="empty">Henüz veri yok.</p>'}
  `;
}

// Stops a client's weekly series from today on. Completed, cancelled and paid sessions are kept.
async function cancelActiveSeries(clientId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  for (const series of activeSeriesOf(clientId)) {
    await put('series', { ...series, endDate: toKey(yesterday) });
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  for (const s of state.sessions) {
    if (s.clientId === clientId && s.seriesId && s.status === 'planned' && !s.paid && new Date(s.start) >= startOfToday) {
      await remove('sessions', s.id);
    }
  }
}

async function saveProgram(form) {
  const data = new FormData(form);
  const startDate = data.get('startDate');

  // Validate everything before touching stored data, so a bad row leaves the old program in place.
  const plan = [];
  for (const c of state.clients) {
    const time = data.get(`time-${c.id}`);
    const durationMin = Math.max(5, Number(data.get(`duration-${c.id}`)) || 50);
    const days = WEEKDAYS
      .map(([w]) => ({ w, fee: data.get(`fee-${c.id}-${w}`) }))
      .filter((d) => d.fee !== null && d.fee !== '');
    if (days.length && !time) {
      state.notice = `${c.name} için saat girin.`;
      return render();
    }
    if (days.length) plan.push({ client: c, time, durationMin, days });
  }

  for (const c of state.clients) {
    await cancelActiveSeries(c.id);
  }
  for (const { client, time, durationMin, days } of plan) {
    for (const d of days) {
      await put('series', {
        id: crypto.randomUUID(),
        clientId: client.id,
        startDate,
        time,
        durationMin,
        weekdays: [d.w],
        fee: Math.max(0, Number(d.fee) || 0),
        endDate: null,
      });
    }
  }
  state.notice = 'Program kaydedildi.';
  return reload();
}

async function setStatus(id, value) {
  const session = state.sessions.find((s) => s.id === id);
  // Pressing the active button again clears it.
  const status = session.status === value ? 'planned' : value;
  await put('sessions', { ...session, status });
  return reload();
}

async function togglePaid(id) {
  const session = state.sessions.find((s) => s.id === id);
  const paid = !session.paid;
  await put('sessions', { ...session, paid, paidOn: paid ? toKey(new Date()) : '' });
  return reload();
}

async function onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    state.notice = '';
    return render();
  }

  const card = e.target.closest('[data-session]');
  const action = e.target.closest('[data-action]');
  if (card && action?.dataset.action === 'status') return setStatus(card.dataset.session, action.dataset.value);
  if (card && action?.dataset.action === 'paid') return togglePaid(card.dataset.session);
}

async function onChange(e) {
  if (e.target.dataset.field === 'fee') {
    const card = e.target.closest('[data-session]');
    const session = state.sessions.find((s) => s.id === card.dataset.session);
    await put('sessions', { ...session, fee: Math.max(0, Number(e.target.value) || 0) });
    return reload();
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const kind = form.dataset.form;
  if (kind === 'program') return saveProgram(form);

  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  if (!name) return;

  if (kind === 'newClient') {
    await put('clients', { id: crypto.randomUUID(), name });
  } else if (kind === 'client') {
    await put('clients', { id: form.dataset.id, name });
  }
  return reload();
}
