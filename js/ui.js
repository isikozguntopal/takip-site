import { getAll, put, remove } from './db.js';
import { computeSummary, payStateOf, payDateOf, monthOfIso, monthlyNet, debtorsOf, roomPctOf, shiftMonth } from './totals.js';
import { expandSeries, toKey } from './schedule.js';
import { dailyMotivation } from './motivation.js';
import { buildReminder, shouldRemind, readPrefs, writePrefs, showReminder, serverReady, subscribeToServer, unsubscribeFromServer } from './reminder.js';
import { CONFIG } from '../config.js';

const DAY_MS = 86400000;
// Sessions are written this far ahead, so any month in the next year shows its sessions.
const HORIZON_DAYS = 400;
const ICON = {
  program: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
  sessions: '<path d="M4 12l5 5L20 6"/>',
  summary: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  clients: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4.5a4 4 0 0 1 0 7M22 21c0-3-2-5-5-5.5"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
};
const TABS = [
  ['program', 'Program'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
  ['clients', 'Danışanlar'],
  ['me', 'Ben'],
];
// How often the open app checks whether the evening reminder is due.
const REMINDER_CHECK_MS = 60000;
// Sunday is 0 in Date.getDay(), so the week starts on Monday and ends on Sunday.
const WEEKDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];
const NEW_CLIENT = '__new';
const DEFAULT_DURATION = 40;
const MONTH_RANGE = { back: 6, forward: 12 };

const state = {
  tab: 'program',
  clients: [],
  sessions: [],
  series: [],
  programClientId: '',
  month: toKey(new Date()).slice(0, 7),
  rescheduleId: '',
  clientId: '',
  search: '',
  notice: '',
};
let root;
// Only the first render of a tab plays the entrance animation, so typing and saving do not replay it.
let lastTab = null;

export async function startUi(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: true });
  await reload();
  // The reminder is checked on open, every minute while open, and when the app comes back to the front.
  checkReminder();
  setInterval(checkReminder, REMINDER_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkReminder();
  });
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
  const enter = lastTab !== state.tab;
  lastTab = state.tab;
  root.innerHTML = `
    <section class="screen ${enter ? 'enter' : ''}">
      ${motto()}
      ${screen()}
    </section>
    <nav class="tabs">${TABS.map(
      ([id, label]) => `
        <button type="button" data-tab="${id}" class="${state.tab === id ? 'active' : ''}" aria-current="${state.tab === id}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg>
          <span>${label}</span>
        </button>`,
    ).join('')}</nav>`;
}

// The daily sentence, shown at the top of every screen.
function motto() {
  return `
    <aside class="motto">
      <span class="heart" aria-hidden="true">♥</span>
      <p>${esc(dailyMotivation())}</p>
    </aside>`;
}

function screen() {
  switch (state.tab) {
    case 'sessions': return sessionsScreen();
    case 'summary': return summaryScreen();
    case 'clients': return clientsScreen();
    case 'me': return meScreen();
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

function money(n) {
  return `${Number(n).toLocaleString('tr-TR')} ₺`;
}

function hm(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "3 Kas 2026 09:00 - 3 Kas 2026 09:50", the end follows from the session length.
function fmtRange(s) {
  const day = (iso) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return s.end ? `${day(s.start)} ${hm(s.start)} - ${day(s.end)} ${hm(s.end)}` : `${day(s.start)} ${hm(s.start)}`;
}

function durationMinOf(s) {
  return s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : DEFAULT_DURATION;
}

function activeSeriesOf(clientId) {
  const todayKey = toKey(new Date());
  return state.series.filter((s) => s.clientId === clientId && (!s.endDate || s.endDate >= todayKey));
}

// One entry per weekday: the time, length and fee of the client's session on that day.
function currentDays(clientId) {
  return activeSeriesOf(clientId).map((s) => ({
    w: s.weekdays[0],
    time: s.time ?? '',
    duration: s.durationMin ?? DEFAULT_DURATION,
    fee: s.fee ?? null,
  }));
}

// A newly chosen day takes the value of the nearest earlier day that has one, then the nearest later one.
function nearestValue(w, days, key) {
  const order = WEEKDAYS.map(([v]) => v);
  const pos = order.indexOf(w);
  const has = days.filter((d) => d[key] != null && d[key] !== '');
  const earlier = has.filter((d) => order.indexOf(d.w) < pos).sort((a, b) => order.indexOf(b.w) - order.indexOf(a.w));
  if (earlier.length) return earlier[0][key];
  const later = has.filter((d) => order.indexOf(d.w) > pos).sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w));
  return later[0]?.[key] ?? null;
}

// Accepts 9:30 or 09:30 and returns 09:30, or null when it is not a valid time.
function normalizeTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

// One month at a time: arrows on either side, or swipe left and right on the screen.
function monthStrip() {
  return `
    <div class="month-bar">
      <button type="button" data-action="prev-month" aria-label="Önceki ay">‹</button>
      <strong>${monthLabel(state.month)}</strong>
      <button type="button" data-action="next-month" aria-label="Sonraki ay">›</button>
    </div>`;
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

// Days are listed top to bottom. A selected day opens its time, length and fee in a row under its name.
function programCard(client) {
  const byDay = new Map(currentDays(client.id).map((d) => [d.w, d]));
  const days = WEEKDAYS.map(([w, l]) => {
    const day = byDay.get(w);
    return `
      <div class="day ${day ? 'on' : ''}">
        <button type="button" data-action="toggle-day" data-w="${w}" aria-pressed="${!!day}" class="${day ? 'active' : ''}">
          <span>${l}</span>
          <span class="day-state">${day ? (day.time || 'saat seç') : 'boş'}</span>
        </button>
        ${day ? `
          <div class="day-fields">
            <label>Saat <input type="text" inputmode="numeric" placeholder="09:00" maxlength="5" aria-label="${l} saati" data-field="time" data-w="${w}" value="${esc(day.time)}"></label>
            <label>Süre (dk) <input type="number" min="5" step="5" inputmode="numeric" aria-label="${l} süresi (dk)" data-field="duration" data-w="${w}" value="${esc(day.duration)}"></label>
            <label>Ücret (₺) <input type="number" min="0" step="1" inputmode="numeric" placeholder="ücret" aria-label="${l} ücreti" data-field="fee" data-w="${w}" value="${esc(day.fee ?? '')}"></label>
          </div>` : ''}
      </div>`;
  }).join('');
  return `
    <section class="card program" data-client="${esc(client.id)}">
      <h3>${esc(client.name)}</h3>
      <label>Oda payı (%) <input type="number" min="0" max="100" step="1" inputmode="numeric" data-field="pct" value="${esc(client.roomPct ?? '')}"></label>
      <p class="hint">Gelen günlere dokunun. Seçilen günün altına saati, süreyi ve ücreti yazın. Her değişiklik otomatik kaydedilir.</p>
      <div class="week">${days}</div>
    </section>`;
}

function sessionsScreen() {
  const inMonth = [...state.sessions]
    .filter((s) => monthOfIso(s.start) === state.month)
    .sort((a, b) => a.start.localeCompare(b.start));
  const items = inMonth.map((s) => {
    const status = s.status;
    const pay = payStateOf(s);
    const date = payDateOf(s);
    const payControls = status === 'done'
      ? `<div class="pay">
           <div class="status-buttons">
             <button type="button" data-action="pay-state" data-value="due" aria-pressed="${pay === 'due'}" class="${pay === 'due' ? 'active' : ''}">Ödenmedi</button>
             <button type="button" data-action="pay-state" data-value="paid" aria-pressed="${pay === 'paid'}" class="${pay === 'paid' ? 'active' : ''}">Ödendi</button>
           </div>
           ${pay === 'due' || pay === 'paid'
             ? `<label>${pay === 'paid' ? 'Ödeme tarihi' : 'Ödenecek tarih (isteğe bağlı)'} <input type="date" data-field="payDate" value="${esc(date)}"></label>`
             : ''}
         </div>`
      : '';
    const reschedule = status === 'cancelled'
      ? (state.rescheduleId === s.id
          ? `<div class="reschedule">
               <label>Yeni tarih <input type="date" data-field="rsDate" value="${toKey(new Date(s.start))}"></label>
               <label>Yeni saat <input type="text" inputmode="numeric" placeholder="09:00" maxlength="5" data-field="rsTime" value="${hm(s.start)}"></label>
               <div class="status-buttons">
                 <button type="button" data-action="confirm-reschedule">Planla</button>
                 <button type="button" data-action="cancel-reschedule">Vazgeç</button>
               </div>
             </div>`
          : `<button type="button" class="wide" data-action="reschedule">Yeniden planla</button>`)
      : '';
    return `
      <article class="card session ${status === 'cancelled' ? 'cancelled' : ''}" data-session="${esc(s.id)}">
        <div class="row"><strong>${esc(clientName(s.clientId))}</strong><span>${esc(fmtRange(s))}</span></div>
        ${status === 'cancelled' ? '<p class="cancel-mark">✕ İptal</p>' : ''}
        <label>Ücret (₺) <input type="number" min="0" step="1" inputmode="numeric" data-field="fee" value="${esc(s.fee ?? 0)}"></label>
        <div class="status-buttons">
          <button type="button" data-action="status" data-value="done" aria-pressed="${status === 'done'}" class="ok ${status === 'done' ? 'active' : ''}">✓ Gerçekleşti</button>
          <button type="button" data-action="status" data-value="cancelled" aria-pressed="${status === 'cancelled'}" class="bad ${status === 'cancelled' ? 'active' : ''}">✕ İptal</button>
        </div>
        ${reschedule}
        ${payControls}
      </article>`;
  }).join('');
  return `
    <h2>Seanslar</h2>
    ${monthStrip()}
    ${items || '<p class="empty">Bu ayda seans yok.</p>'}`;
}

function summaryScreen() {
  const t = computeSummary({ clients: state.clients, sessions: state.sessions, month: state.month });
  // Tapping a client's name opens the breakdown: sessions, what was received, the room share paid, and what is left.
  const perClient = t.perClient
    .filter((c) => c.sessionCount)
    .map((c) => `
      <details class="card client-sum">
        <summary><strong>${esc(c.name)}</strong><span>${money(c.net)}</span></summary>
        <dl class="sum-detail">
          <div><dt>Seans</dt><dd>${c.sessionCount}</dd></div>
          <div><dt>Alınan</dt><dd>${money(c.gross)}</dd></div>
          <div><dt>Oda payı (%${c.pct})</dt><dd>${money(c.room)}</dd></div>
          <div class="sum-net"><dt>Kalan</dt><dd>${money(c.net)}</dd></div>
        </dl>
      </details>`).join('');
  return `
    <h2>Özet</h2>
    ${monthStrip()}
    <section class="card total">
      <p>Net toplam <strong>${money(t.overall.net)}</strong></p>
    </section>
    ${trendChart()}
    ${perClient || '<p class="empty">Bu ayda gerçekleşen seans yok.</p>'}`;
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
    if (s.clientId === clientId && s.seriesId && !s.moved && s.status === 'planned' && new Date(s.start) >= startOfToday) {
      await remove('sessions', s.id);
    }
  }
}

// Every program change goes through here: the client's days are rewritten in one step.
// A day with no time is kept but makes no sessions until its time is entered.
async function saveProgram(clientId, days) {
  const startDate = toKey(new Date());
  await cancelActiveSeries(clientId);
  for (const d of days) {
    await put('series', {
      id: crypto.randomUUID(),
      clientId,
      startDate,
      time: d.time || null,
      durationMin: Math.max(5, Number(d.duration) || DEFAULT_DURATION),
      weekdays: [d.w],
      fee: d.fee === '' || d.fee == null ? null : Math.max(0, Number(d.fee) || 0),
      endDate: null,
    });
  }
  state.notice = '';
  return reload();
}

async function saveClient(clientId, changes) {
  const client = state.clients.find((c) => c.id === clientId);
  await put('clients', { ...client, ...changes });
  return reload();
}

async function setStatus(id, value) {
  const session = state.sessions.find((s) => s.id === id);
  // Pressing the active button again clears it.
  const status = session.status === value ? 'planned' : value;
  await put('sessions', { ...session, status });
  return reload();
}

// Moves a cancelled session to a new day and time, keeping its length. It becomes planned again and is marked moved,
// so a later program change does not delete it.
async function rescheduleSession(card) {
  const session = state.sessions.find((s) => s.id === card.dataset.session);
  const date = card.querySelector('[data-field="rsDate"]').value;
  const time = normalizeTime(card.querySelector('[data-field="rsTime"]').value);
  if (!date) {
    state.notice = 'Yeni tarihi seçin.';
    return render();
  }
  if (time === null) {
    state.notice = 'Saati 09:30 biçiminde yazın.';
    return render();
  }
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + durationMinOf(session) * 60000);
  await put('sessions', { ...session, start: start.toISOString(), end: end.toISOString(), status: 'planned', moved: true });
  state.rescheduleId = '';
  state.notice = '';
  state.month = monthOfIso(start.toISOString());
  return reload();
}

async function setPayState(id, value) {
  const session = state.sessions.find((s) => s.id === id);
  const current = payStateOf(session);
  const next = current === value ? 'none' : value;
  // Paying with no date entered counts as paid today; a due date is optional.
  const payDate = next === 'paid' ? toKey(new Date()) : '';
  await put('sessions', { ...session, payState: next, payDate });
  return reload();
}

async function onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    state.notice = '';
    state.clientId = '';
    return render();
  }

  const action = e.target.closest('[data-action]');
  if (!action) return;

  if (action.dataset.action === 'open-client') {
    state.clientId = action.dataset.id;
    return render();
  }
  if (action.dataset.action === 'close-client') {
    state.clientId = '';
    return render();
  }
  if (action.dataset.action === 'pick-month') {
    state.month = action.dataset.month;
    return render();
  }
  if (action.dataset.action === 'toggle-reminder') return toggleReminder();
  if (action.dataset.action === 'test-reminder') return testReminder();

  if (action.dataset.action === 'prev-month') {
    state.month = shiftMonth(state.month, -1);
    return render();
  }
  if (action.dataset.action === 'next-month') {
    state.month = shiftMonth(state.month, 1);
    return render();
  }

  const card = e.target.closest('[data-session]');
  if (card && action.dataset.action === 'status') return setStatus(card.dataset.session, action.dataset.value);
  if (card && action.dataset.action === 'pay-state') return setPayState(card.dataset.session, action.dataset.value);

  if (card && action.dataset.action === 'reschedule') {
    state.rescheduleId = card.dataset.session;
    return render();
  }
  if (action.dataset.action === 'cancel-reschedule') {
    state.rescheduleId = '';
    return render();
  }
  if (card && action.dataset.action === 'confirm-reschedule') return rescheduleSession(card);

  const clientEl = e.target.closest('[data-client]');
  if (clientEl && action.dataset.action === 'toggle-day') {
    const clientId = clientEl.dataset.client;
    const w = Number(action.dataset.w);
    const days = currentDays(clientId);
    const on = days.some((d) => d.w === w);
    const next = on
      ? days.filter((d) => d.w !== w)
      : [...days, {
          w,
          time: nearestValue(w, days, 'time') ?? '',
          duration: nearestValue(w, days, 'duration') ?? DEFAULT_DURATION,
          fee: nearestValue(w, days, 'fee'),
        }];
    return saveProgram(clientId, next);
  }
}

// Swiping left goes to the next month, swiping right to the previous one. Only on the screens that have a month.
let touchStartX = null;
let touchStartY = null;

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

function onTouchEnd(e) {
  if (touchStartX === null || !['sessions', 'summary'].includes(state.tab)) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;
  state.month = shiftMonth(state.month, dx < 0 ? 1 : -1);
  render();
}

// Typing digits fills in the colon: 0900 shows as 09:00 while the user types.
function formatTyping(value, deleting) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  // While deleting, a lone two-digit hour keeps no colon, so the user can still erase it.
  if (digits.length <= 2) return digits.length === 2 && !deleting ? `${digits}:` : digits;
  if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function onInput(e) {
  // Search only redraws the list, so the field keeps its focus while typing.
  if (e.target.dataset.field === 'search') {
    state.search = e.target.value;
    const list = root.querySelector('#client-list');
    if (list) list.innerHTML = clientList();
    return;
  }
  if (e.target.dataset.field !== 'time' && e.target.dataset.field !== 'rsTime') return;
  e.target.value = formatTyping(e.target.value, e.inputType?.startsWith('delete'));
}

async function onChange(e) {
  const field = e.target.dataset.field;

  if (field === 'pick') {
    state.programClientId = e.target.value;
    state.notice = '';
    return render();
  }

  const clientEl = e.target.closest('[data-client]');
  if (clientEl) {
    const clientId = clientEl.dataset.client;

    if (field === 'pct') {
      const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
      return saveClient(clientId, { roomPct: pct });
    }

    if (['time', 'duration', 'fee'].includes(field)) {
      const w = Number(e.target.dataset.w);
      const days = currentDays(clientId);
      let value = e.target.value;

      if (field === 'time') {
        value = normalizeTime(value);
        if (value === null) {
          state.notice = 'Saati 09:30 biçiminde yazın.';
          return render();
        }
      }
      if (field === 'duration') value = Math.max(5, Number(value) || DEFAULT_DURATION);
      if (field === 'fee') value = value === '' ? null : Math.max(0, Number(value) || 0);

      const key = field;
      return saveProgram(clientId, days.map((d) => (d.w === w ? { ...d, [key]: value } : d)));
    }
    return;
  }

  const card = e.target.closest('[data-session]');
  if (card && field === 'fee') {
    const session = state.sessions.find((s) => s.id === card.dataset.session);
    await put('sessions', { ...session, fee: Math.max(0, Number(e.target.value) || 0) });
    return reload();
  }
  if (card && field === 'payDate') {
    const session = state.sessions.find((s) => s.id === card.dataset.session);
    const value = e.target.value;
    // A paid session always keeps a date; clearing it falls back to today.
    const payDate = payStateOf(session) === 'paid' ? value || toKey(new Date()) : value;
    await put('sessions', { ...session, payDate });
    return reload();
  }
}

// ---- Danışanlarım: list with search, and one client's detail page ----

function clientsScreen() {
  if (state.clientId) return clientDetail(state.clientId);
  return `
    <h2>Danışanlarım</h2>
    <label class="card search">Ara
      <input type="search" placeholder="İsme göre ara" data-field="search" value="${esc(state.search)}">
    </label>
    <div id="client-list">${clientList()}</div>`;
}

function clientList() {
  const q = state.search.trim().toLocaleLowerCase('tr-TR');
  const debtors = new Map(debtorsOf({ clients: state.clients, sessions: state.sessions }).map((d) => [d.clientId, d]));
  const shown = state.clients.filter((c) => c.name.toLocaleLowerCase('tr-TR').includes(q));
  if (!shown.length) {
    return `<p class="empty">${state.clients.length ? 'Bu isimde danışan yok.' : 'Henüz danışan yok. Program sekmesinden ekleyebilirsiniz.'}</p>`;
  }
  return shown.map((c) => {
    const debt = debtors.get(c.id);
    const held = state.sessions.filter((s) => s.clientId === c.id && s.status === 'done').length;
    return `
      <button type="button" class="client-item" data-action="open-client" data-id="${esc(c.id)}">
        <span><strong>${esc(c.name)}</strong><small>%${roomPctOf(c)} oda payı · ${held} seans</small></span>
        ${debt ? `<span class="owe-badge">${money(debt.owed)}</span>` : ''}
      </button>`;
  }).join('');
}

function clientDetail(id) {
  const client = state.clients.find((c) => c.id === id);
  if (!client) {
    state.clientId = '';
    return clientsScreen();
  }
  const sessions = state.sessions
    .filter((s) => s.clientId === id)
    .sort((a, b) => b.start.localeCompare(a.start));
  const held = sessions.filter((s) => s.status === 'done');
  const paid = held.filter((s) => payStateOf(s) === 'paid');
  const owing = held.filter((s) => payStateOf(s) !== 'paid');
  const total = (list) => list.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
  const rows = sessions.map((s) => `
    <article class="card session-row">
      <div class="row"><strong>${esc(fmtRange(s))}</strong></div>
      <p>${esc(sessionStateText(s))}</p>
    </article>`).join('');
  return `
    <button type="button" class="back" data-action="close-client">‹ Danışanlarım</button>
    <h2>${esc(client.name)}</h2>
    <section class="card" data-client="${esc(client.id)}">
      <label>Oda payı (%) <input type="number" min="0" max="100" step="1" inputmode="numeric" data-field="pct" value="${esc(client.roomPct ?? '')}"></label>
    </section>
    <section class="card stats">
      <div><span>Seans</span><strong>${held.length}</strong></div>
      <div><span>Alınan</span><strong>${money(total(paid))}</strong></div>
      <div><span>Borç</span><strong>${money(total(owing))}</strong></div>
    </section>
    <h3>Seanslar</h3>
    ${rows || '<p class="empty">Henüz seans yok.</p>'}`;
}

function sessionStateText(s) {
  if (s.status === 'cancelled') return 'İptal edildi';
  if (s.status !== 'done') return 'Planlı';
  return payStateOf(s) === 'paid' ? `Ödendi · ${fmtDay(payDateOf(s))}` : 'Ödenmedi';
}

function fmtDay(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---- Özet: last twelve months of net income as bars ----

function monthShort(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'short' });
}

function trendChart() {
  const months = monthlyNet({
    clients: state.clients,
    sessions: state.sessions,
    endMonth: toKey(new Date()).slice(0, 7),
    count: 12,
  });
  const max = Math.max(1, ...months.map((m) => m.net));
  const selected = computeSummary({ clients: state.clients, sessions: state.sessions, month: state.month }).overall.net;
  const bars = months.map((m, i) => {
    const height = Math.max(4, Math.round((m.net / max) * 100));
    return `
      <button type="button" class="bar ${m.month === state.month ? 'current' : ''}" data-action="pick-month" data-month="${m.month}"
        style="--h:${height}%;--d:${i * 45}ms" aria-label="${monthLabel(m.month)}: ${money(m.net)}">
        <span class="bar-track"><span class="bar-fill"></span></span>
        <span class="bar-label">${monthShort(m.month)}</span>
      </button>`;
  }).join('');
  return `
    <section class="card chart">
      <h3>Son 12 ay net gelir</h3>
      <p class="chart-note">${monthLabel(state.month)}: <strong>${money(selected)}</strong></p>
      <div class="bars">${bars}</div>
    </section>`;
}

// ---- Ben: debtors and the evening reminder ----

function meScreen() {
  const debtors = debtorsOf({ clients: state.clients, sessions: state.sessions });
  const list = debtors.map((d) => `
    <button type="button" class="client-item" data-action="open-client" data-id="${esc(d.clientId)}">
      <span><strong>${esc(d.name)}</strong><small>${d.count} seans ödenmedi</small></span>
      <span class="owed"><strong>${money(d.owed)}</strong></span>
    </button>`).join('');
  return `
    <h2>Ben</h2>
    <h3>Borçlular</h3>
    ${list || '<p class="empty">Ödenmemiş seans yok. Harika!</p>'}
    <h3>Hatırlatma</h3>
    <section class="card reminder">
      <p>Her akşam 21:00'de yarının seanslarını hatırlatır. Ödemesi bekleyen danışanlar bildirimde ayrıca yazılır.</p>
      ${reminderControls()}
      ${state.notice ? `<p class="notice">${esc(state.notice)}</p>` : ''}
    </section>`;
}

function reminderControls() {
  if (!('Notification' in window)) {
    return '<p class="hint">Bu cihazda bildirim desteklenmiyor. Uygulamayı ana ekrana ekleyip oradan açın.</p>';
  }
  const on = readPrefs().enabled && Notification.permission === 'granted';
  return `
    <div class="status-buttons two">
      <button type="button" data-action="toggle-reminder" aria-pressed="${on}" class="${on ? 'active' : ''}">${on ? 'Bildirimler açık' : 'Bildirimler kapalı'}</button>
      <button type="button" data-action="test-reminder">Önizleme</button>
    </div>`;
}

// The message for the sessions of tomorrow, built from what is on the phone.
function tomorrowMessage() {
  const now = new Date();
  const tomorrow = toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const sessions = state.sessions
    .filter((s) => s.status === 'planned' && toKey(new Date(s.start)) === tomorrow)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => ({ clientId: s.clientId, name: clientName(s.clientId), time: hm(s.start) }));
  return buildReminder({ sessions, debtors: debtorsOf({ clients: state.clients, sessions: state.sessions }) });
}

// Runs the reminder once a day after the reminder hour, while reminders are switched on and permission is granted.
async function checkReminder() {
  // With the server running, the 21:00 push comes from it, so the phone must not show a second one.
  if (serverReady(CONFIG)) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const prefs = readPrefs();
  const now = new Date();
  const todayKey = toKey(now);
  if (!shouldRemind({ now, enabled: prefs.enabled, lastDay: prefs.lastDay, todayKey })) return;
  writePrefs({ ...prefs, lastDay: todayKey });
  await showReminder(tomorrowMessage());
}

async function toggleReminder() {
  const prefs = readPrefs();
  if (prefs.enabled) {
    writePrefs({ ...prefs, enabled: false });
    if (serverReady(CONFIG)) await unsubscribeFromServer(CONFIG).catch(() => {});
    state.notice = 'Bildirimler kapatıldı.';
    return render();
  }
  if (!('Notification' in window)) {
    state.notice = 'Bildirimler bu cihazda desteklenmiyor. Uygulamayı ana ekrana ekleyip oradan açın.';
    return render();
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    state.notice = 'Bildirim izni verilmedi. Telefon ayarlarından Takip için bildirimlere izin verebilirsiniz.';
    return render();
  }
  writePrefs({ ...prefs, enabled: true });
  if (serverReady(CONFIG)) {
    try {
      await subscribeToServer(CONFIG);
    } catch {
      state.notice = 'Bildirim sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
      return render();
    }
  }
  state.notice = "Bildirimler açıldı. Her akşam 21:00'de yarının seanslarını hatırlatacağım.";
  return render();
}

async function testReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    state.notice = 'Önizleme için önce bildirimleri açın.';
    return render();
  }
  await showReminder(tomorrowMessage());
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.form !== 'newClient') return;

  const name = String(new FormData(form).get('name') ?? '').trim();
  if (!name) return;
  const id = crypto.randomUUID();
  await put('clients', { id, name });
  state.programClientId = id;
  return reload();
}
