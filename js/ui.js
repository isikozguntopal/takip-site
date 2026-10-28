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
// The calendar runs from 08:00 in half-hour slots. ROW is the height of one slot in pixels.
const FIRST_SLOT = 8 * 60;
const SLOT_MIN = 30;
const SLOTS = 28;
const ROW = 22;

const state = { tab: 'program', clients: [], sessions: [], series: [], programClientId: '', selected: '', notice: '' };
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

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(n) {
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

function activeSeriesOf(clientId) {
  const todayKey = toKey(new Date());
  return state.series.filter((s) => s.clientId === clientId && (!s.endDate || s.endDate >= todayKey));
}

// A block is one weekly session slot: a weekday and a start time, with its own fee.
function currentBlocks(clientId) {
  const order = WEEKDAYS.map(([v]) => v);
  return activeSeriesOf(clientId)
    .map((s) => ({ w: s.weekdays[0], time: s.time, fee: s.fee }))
    .sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w) || a.time.localeCompare(b.time));
}

function blockKey(b) {
  return `${b.w}-${b.time}`;
}

// A new block takes the fee of the nearest block already priced: the same day first, then earlier days, then later ones.
function defaultFeeFor(w, blocks) {
  const order = WEEKDAYS.map(([v]) => v);
  const pos = order.indexOf(w);
  const priced = blocks.filter((b) => b.fee != null);
  const sameDay = priced.filter((b) => b.w === w);
  if (sameDay.length) return sameDay[0].fee;
  const earlier = priced.filter((b) => order.indexOf(b.w) < pos).sort((a, b) => order.indexOf(b.w) - order.indexOf(a.w));
  if (earlier.length) return earlier[0].fee;
  const later = priced.filter((b) => order.indexOf(b.w) > pos).sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w));
  return later[0]?.fee ?? null;
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

// A Google Calendar style week: hours down the side, days across. Tap an empty slot to add a session for the client,
// tap a session to set its fee or remove it.
function programCard(client) {
  const blocks = currentBlocks(client.id);
  const duration = client.durationMin ?? 50;
  const slotTimes = Array.from({ length: SLOTS }, (_, i) => minutesToTime(FIRST_SLOT + i * SLOT_MIN));
  const hourLabels = slotTimes
    .map((t, i) => (t.endsWith(':00') ? `<span style="top:${i * ROW}px">${t}</span>` : ''))
    .join('');
  const columns = WEEKDAYS.map(([w, l]) => {
    const slots = slotTimes
      .map((t, i) => `<button type="button" class="slot" data-action="add-block" data-w="${w}" data-time="${t}" style="top:${i * ROW}px" aria-label="${l} ${t}"></button>`)
      .join('');
    const dayBlocks = blocks
      .filter((b) => b.w === w)
      .map((b) => {
        const top = ((timeToMinutes(b.time) - FIRST_SLOT) / SLOT_MIN) * ROW;
        const height = Math.max(ROW, (duration / SLOT_MIN) * ROW - 2);
        const active = state.selected === blockKey(b) ? 'active' : '';
        return `<button type="button" class="block ${active}" data-action="select-block" data-w="${w}" data-time="${b.time}" style="top:${top}px;height:${height}px">${b.time}</button>`;
      })
      .join('');
    return `
      <div class="cal-col">
        <div class="cal-head">${l}</div>
        <div class="cal-body" style="height:${SLOTS * ROW}px">${slots}${dayBlocks}</div>
      </div>`;
  }).join('');

  const chosen = blocks.find((b) => blockKey(b) === state.selected);
  const panel = chosen
    ? `<div class="block-panel">
         <p><strong>${WEEKDAYS.find(([v]) => v === chosen.w)[1]} ${esc(chosen.time)}</strong></p>
         <label>Ücret (₺) <input type="number" min="0" step="1" inputmode="numeric" data-field="block-fee" data-w="${chosen.w}" data-time="${esc(chosen.time)}" value="${esc(chosen.fee ?? '')}"></label>
         <button type="button" data-action="remove-block">Bu seansı kaldır</button>
       </div>`
    : '<p class="hint">Boş bir saate dokunun, seans eklensin. Bir seansa dokunup ücretini girin ya da kaldırın.</p>';

  return `
    <section class="card program" data-client="${esc(client.id)}">
      <h3>${esc(client.name)}</h3>
      <label>Süre (dk) <input type="number" min="5" step="5" data-field="duration" value="${esc(duration)}"></label>
      <div class="cal">
        <div class="cal-times">
          <div class="cal-head"></div>
          <div class="cal-body" style="height:${SLOTS * ROW}px">${hourLabels}</div>
        </div>
        ${columns}
      </div>
      ${panel}
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

// Every program change goes through here: the client's settings and blocks are rewritten in one step.
// A block with an empty fee is kept with no fee, and its sessions are billed at 0 until a fee is entered.
async function saveProgram(clientId, { settings = {}, blocks }) {
  const client = state.clients.find((c) => c.id === clientId);
  const next = { startDate: toKey(new Date()), durationMin: client.durationMin ?? 50, ...settings };
  const nextBlocks = blocks ?? currentBlocks(clientId);

  await put('clients', { ...client, ...next });
  await cancelActiveSeries(clientId);
  for (const b of nextBlocks) {
    await put('series', {
      id: crypto.randomUUID(),
      clientId,
      startDate: next.startDate,
      time: b.time,
      durationMin: next.durationMin,
      weekdays: [b.w],
      fee: b.fee === '' || b.fee == null ? null : Math.max(0, Number(b.fee) || 0),
      endDate: null,
    });
  }
  state.notice = '';
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

  const action = e.target.closest('[data-action]');
  const clientEl = e.target.closest('[data-client]');
  if (action && clientEl) {
    const clientId = clientEl.dataset.client;
    const w = Number(action.dataset.w);
    const time = action.dataset.time;

    if (action.dataset.action === 'add-block') {
      const blocks = currentBlocks(clientId);
      const key = `${w}-${time}`;
      if (blocks.some((b) => blockKey(b) === key)) {
        state.selected = key;
        return render();
      }
      state.selected = key;
      return saveProgram(clientId, { blocks: [...blocks, { w, time, fee: defaultFeeFor(w, blocks) }] });
    }

    if (action.dataset.action === 'select-block') {
      state.selected = blockKey({ w, time });
      return render();
    }

    if (action.dataset.action === 'remove-block') {
      const blocks = currentBlocks(clientId).filter((b) => blockKey(b) !== state.selected);
      state.selected = '';
      return saveProgram(clientId, { blocks });
    }
  }

  const card = e.target.closest('[data-session]');
  if (card && action?.dataset.action === 'status') return setStatus(card.dataset.session, action.dataset.value);
  if (card && action?.dataset.action === 'paid') return togglePaid(card.dataset.session);
}

async function onChange(e) {
  const field = e.target.dataset.field;

  if (field === 'pick') {
    state.programClientId = e.target.value;
    state.selected = '';
    state.notice = '';
    return render();
  }

  if (field === 'duration' && e.target.closest('[data-client]')) {
    const clientId = e.target.closest('[data-client]').dataset.client;
    return saveProgram(clientId, { settings: { durationMin: Math.max(5, Number(e.target.value) || 50) } });
  }

  if (field === 'block-fee' && e.target.closest('[data-client]')) {
    const clientId = e.target.closest('[data-client]').dataset.client;
    const key = `${Number(e.target.dataset.w)}-${e.target.dataset.time}`;
    const value = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
    const blocks = currentBlocks(clientId).map((b) => (blockKey(b) === key ? { ...b, fee: value } : b));
    return saveProgram(clientId, { blocks });
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
  await put('clients', { id, name, startDate: toKey(new Date()), durationMin: 50 });
  state.programClientId = id;
  state.selected = '';
  return reload();
}
