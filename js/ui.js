import { getAll, put, remove } from './db.js';
import { computeSummary, payStateOf, payDateOf, monthOfIso } from './totals.js';
import { expandSeries, toKey } from './schedule.js';

const DAY_MS = 86400000;
// Sessions are written this far ahead, so any month in the next year shows its sessions.
const HORIZON_DAYS = 400;
const TABS = [
  ['program', 'Program'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
];
// Sunday is 0 in Date.getDay(), so the week starts on Monday and ends on Sunday.
const WEEKDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];
const NEW_CLIENT = '__new';
const DEFAULT_DURATION = 50;
const MONTH_RANGE = { back: 6, forward: 12 };

const state = {
  tab: 'program',
  clients: [],
  sessions: [],
  series: [],
  programClientId: '',
  month: toKey(new Date()).slice(0, 7),
  rescheduleId: '',
  notice: '',
};
let root;

export async function startUi(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: true });
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

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

// Each weekday is a button. A selected day opens its own time, length and fee, stacked under it.
function programCard(client) {
  const byDay = new Map(currentDays(client.id).map((d) => [d.w, d]));
  const days = WEEKDAYS.map(([w, l]) => {
    const day = byDay.get(w);
    return `
      <div class="day">
        <button type="button" data-action="toggle-day" data-w="${w}" aria-pressed="${!!day}" class="${day ? 'active' : ''}">${l}</button>
        ${day ? `
          <input type="text" inputmode="numeric" placeholder="09:00" maxlength="5" aria-label="${l} saati" data-field="time" data-w="${w}" value="${esc(day.time)}">
          <input type="number" min="5" step="5" inputmode="numeric" aria-label="${l} süresi (dk)" data-field="duration" data-w="${w}" value="${esc(day.duration)}">
          <input type="number" min="0" step="1" inputmode="numeric" placeholder="ücret" aria-label="${l} ücreti" data-field="fee" data-w="${w}" value="${esc(day.fee ?? '')}">` : ''}
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
  const perClient = t.perClient
    .filter((c) => c.sessionCount)
    .map((c) => `
      <article class="card">
        <div class="row"><strong>${esc(c.name)}</strong><span>${money(c.net)}</span></div>
      </article>`).join('');
  return `
    <h2>Özet</h2>
    ${monthStrip()}
    <section class="card total">
      <p>Net toplam <strong>${money(t.overall.net)}</strong></p>
    </section>
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
    return render();
  }

  const action = e.target.closest('[data-action]');
  if (!action) return;

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
  if (touchStartX === null || state.tab === 'program') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;
  state.month = shiftMonth(state.month, dx < 0 ? 1 : -1);
  render();
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
