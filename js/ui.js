import { getAll, put, remove } from './db.js';
import { computeTotals } from './totals.js';
import { expandSeries, toKey } from './schedule.js';

const DAY_MS = 86400000;
const HORIZON_DAYS = 56;
const TABS = [
  ['program', 'Program'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
];
// Sunday is 0 in Date.getDay(), so the week starts on Monday and ends on Sunday.
const WEEKDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];
const NEW_CLIENT = '__new';

const state = { tab: 'program', clients: [], sessions: [], series: [], programClientId: '', notice: '' };
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
  if (!state.programClientId) state.programClientId = state.clients[0]?.id ?? NEW_CLIENT;
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
    case 'program': return programScreen();
    case 'sessions': return sessionsScreen();
    case 'summary': return summaryScreen();
    default: return programScreen();
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

// The client picker also adds new clients. A new client starts with every field empty.
function programScreen() {
  const selected = state.programClientId;
  const options = state.clients
    .map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const client = state.clients.find((c) => c.id === selected);
  return `
    <h2>Program</h2>
    <label class="card">Danışan
      <select data-field="pick">
        ${options}
        <option value="${NEW_CLIENT}" ${selected === NEW_CLIENT ? 'selected' : ''}>+ Yeni danışan</option>
      </select>
    </label>
    ${selected === NEW_CLIENT
      ? `<form class="card" data-form="newClient">
           <label>Yeni danışanın adı <input name="name" required></label>
           <button type="submit">Danışanı ekle</button>
         </form>`
      : ''}
    ${client ? programCard(client) : ''}
    ${state.notice ? `<p class="notice">${esc(state.notice)}</p>` : ''}`;
}

// A newly chosen day takes the fee of the nearest earlier day in the week that already has one, then the nearest later one.
function defaultFeeFor(w, days) {
  const order = WEEKDAYS.map(([v]) => v);
  const pos = order.indexOf(w);
  const priced = days.filter((d) => d.fee != null);
  const earlier = priced.filter((d) => order.indexOf(d.w) < pos).sort((a, b) => order.indexOf(b.w) - order.indexOf(a.w));
  if (earlier.length) return earlier[0].fee;
  const later = priced.filter((d) => order.indexOf(d.w) > pos).sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w));
  return later[0]?.fee ?? null;
}

// Each weekday is a column: tap it to choose the day, then its fee field appears right under it.
function programCard(client) {
  const byDay = new Map(activeSeriesOf(client.id).map((s) => [s.weekdays[0], s]));
  const days = WEEKDAYS.map(([w, l]) => {
    const series = byDay.get(w);
    return `
      <div class="day">
        <button type="button" data-action="toggle-day" data-w="${w}" aria-pressed="${!!series}" class="${series ? 'active' : ''}">${l}</button>
        ${series ? `<input type="number" min="0" step="1" inputmode="numeric" placeholder="ücret" aria-label="${l} ücreti" data-field="fee" data-w="${w}" value="${esc(series.fee ?? '')}">` : ''}
      </div>`;
  }).join('');
  return `
    <section class="card program" data-client="${esc(client.id)}">
      <h3>${esc(client.name)}</h3>
      <div class="grid2">
        <label>Saat <input type="time" data-field="time" value="${esc(client.time ?? '')}"></label>
        <label>Süre (dk) <input type="number" min="5" step="5" data-field="duration" value="${esc(client.durationMin ?? 50)}"></label>
      </div>
      <p class="hint">Gelen günlere dokunun, altına o günün ücretini yazın. Her değişiklik otomatik kaydedilir.</p>
      <div class="week">${days}</div>
    </section>`;
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
    ${items || '<p class="empty">Henüz seans yok. Program sekmesinden danışanın haftalık programını kaydedin.</p>'}`;
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
    ${perClient || '<p class="empty">Henüz veri yok.</p>'}`;
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

// Every program change goes through here: the client's settings and days are rewritten in one step.
// A day with an empty fee is kept with no fee, and its sessions are billed at 0 until a fee is entered.
async function saveProgram(clientId, { settings = {}, days }) {
  const client = state.clients.find((c) => c.id === clientId);
  const current = activeSeriesOf(clientId).map((s) => ({ w: s.weekdays[0], fee: s.fee }));
  // A program always starts from the day it is saved.
  const next = { startDate: toKey(new Date()), time: client.time ?? '', durationMin: client.durationMin ?? 50, ...settings };
  const nextDays = days ?? current;

  if (nextDays.length && !next.time) {
    state.notice = 'Önce saat girin.';
    return render();
  }

  await put('clients', { ...client, ...next });
  await cancelActiveSeries(clientId);
  for (const d of nextDays) {
    await put('series', {
      id: crypto.randomUUID(),
      clientId,
      startDate: next.startDate,
      time: next.time,
      durationMin: next.durationMin,
      weekdays: [d.w],
      fee: d.fee === '' || d.fee == null ? null : Math.max(0, Number(d.fee) || 0),
      endDate: null,
    });
  }
  state.notice = '';
  return reload();
}

function currentDays(clientId) {
  return activeSeriesOf(clientId).map((s) => ({ w: s.weekdays[0], fee: s.fee }));
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

  const toggle = e.target.closest('[data-action="toggle-day"]');
  if (toggle) {
    const clientId = toggle.closest('[data-client]').dataset.client;
    const w = Number(toggle.dataset.w);
    const days = currentDays(clientId);
    const on = days.some((d) => d.w === w);
    const next = on ? days.filter((d) => d.w !== w) : [...days, { w, fee: defaultFeeFor(w, days) }];
    return saveProgram(clientId, { days: next });
  }

  const card = e.target.closest('[data-session]');
  const action = e.target.closest('[data-action]');
  if (card && action?.dataset.action === 'status') return setStatus(card.dataset.session, action.dataset.value);
  if (card && action?.dataset.action === 'paid') return togglePaid(card.dataset.session);
}

async function onChange(e) {
  const field = e.target.dataset.field;

  if (field === 'pick') {
    state.programClientId = e.target.value;
    state.notice = '';
    return render();
  }

  if (field === 'fee' && e.target.closest('[data-client]')) {
    const clientId = e.target.closest('[data-client]').dataset.client;
    const w = Number(e.target.dataset.w);
    const value = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
    const days = currentDays(clientId).map((d) => (d.w === w ? { ...d, fee: value } : d));
    return saveProgram(clientId, { days });
  }

  if (['time', 'duration'].includes(field) && e.target.closest('[data-client]')) {
    const clientId = e.target.closest('[data-client]').dataset.client;
    const settings = field === 'duration'
      ? { durationMin: Math.max(5, Number(e.target.value) || 50) }
      : { [field]: e.target.value };
    return saveProgram(clientId, { settings });
  }

  if (field === 'fee' && e.target.closest('[data-session]')) {
    const card = e.target.closest('[data-session]');
    const session = state.sessions.find((s) => s.id === card.dataset.session);
    await put('sessions', { ...session, fee: Math.max(0, Number(e.target.value) || 0) });
    return reload();
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.form !== 'newClient') return;

  const name = String(new FormData(form).get('name') ?? '').trim();
  if (!name) return;
  const id = crypto.randomUUID();
  await put('clients', { id, name, startDate: toKey(new Date()), time: '', durationMin: 50 });
  state.programClientId = id;
  return reload();
}
