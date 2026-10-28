import { getAll, put, remove, replaceAll } from './db.js';
import { computeTotals } from './totals.js';
import { buildBackup, parseBackup } from './backup.js';
import { expandSeries, toKey } from './schedule.js';
import { motivation, surprise } from './messages.js';

const DAY_MS = 86400000;
const HORIZON_DAYS = 56;
const TABS = [
  ['home', 'Ana'],
  ['clients', 'Danışanlar'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
];
const STATUS_LABELS = { planned: 'Planlandı', done: 'Gerçekleşti', cancelled: 'İptal' };
// Sunday is 0 in Date.getDay(), so the list starts on Monday and ends with Sunday.
const WEEKDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];

const state = { tab: 'home', clients: [], sessions: [], payments: [], series: [], notice: '', backupNotice: '' };
let root;

export async function startUi(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  await reload();
}

async function reload() {
  [state.clients, state.sessions, state.payments, state.series] = await Promise.all(
    ['clients', 'sessions', 'payments', 'series'].map(getAll),
  );
  await generateSessions();
  render();
}

// Writes the planned sessions of every weekly series up to HORIZON_DAYS ahead. Sessions that already exist are left alone,
// so statuses and payments recorded on them are never overwritten.
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

function paymentFor(sessionId) {
  return state.payments.find((p) => p.sessionId === sessionId);
}

function fmtDate(value) {
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

function money(n) {
  return `${Number(n).toLocaleString('tr-TR')} ₺`;
}

function dayLabels(weekdays) {
  return WEEKDAYS.filter(([v]) => weekdays.includes(v)).map(([, l]) => l).join(', ');
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
      <label>Seans ücreti (₺) <input name="fee" type="number" min="0" step="1" value="${esc(c.fee ?? '')}"></label>
      <button type="submit">Kaydet</button>
    </form>`).join('');
  return `
    <h2>Danışanlar</h2>
    <form class="card" data-form="newClient">
      <label>Ad <input name="name" required></label>
      <label>Seans ücreti (₺) <input name="fee" type="number" min="0" step="1"></label>
      <button type="submit">Danışan ekle</button>
    </form>
    ${rows || '<p class="empty">Henüz danışan yok.</p>'}`;
}

function sessionsScreen() {
  const items = [...state.sessions]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const p = paymentFor(s.id);
      const fee = state.clients.find((c) => c.id === s.clientId)?.fee ?? 0;
      const options = Object.entries(STATUS_LABELS)
        .map(([v, l]) => `<option value="${v}" ${s.status === v ? 'selected' : ''}>${l}</option>`)
        .join('');
      return `
        <article class="card session" data-session="${esc(s.id)}">
          <div class="row"><strong>${esc(clientName(s.clientId))}</strong><span>${esc(fmtDate(s.start))}</span></div>
          <label>Durum <select data-field="status">${options}</select></label>
          <div class="payment">
            <label>Tutar (₺) <input type="number" min="0" step="1" data-field="amount" value="${esc(p?.amount ?? fee)}"></label>
            <label class="check"><input type="checkbox" data-field="paid" ${p?.paid ? 'checked' : ''}> Ödendi</label>
            <label>Ödeme tarihi <input type="date" data-field="paidOn" value="${esc(p?.paidOn ?? '')}"></label>
          </div>
        </article>`;
    })
    .join('');

  const todayKey = toKey(new Date());
  const activeSeries = state.series
    .filter((s) => !s.endDate || s.endDate >= todayKey)
    .map((s) => `
      <article class="card">
        <div class="row"><strong>${esc(clientName(s.clientId))}</strong><span>${esc(s.time)} · ${esc(s.durationMin)} dk</span></div>
        <p>${esc(dayLabels(s.weekdays))} · ${esc(s.startDate)} tarihinden beri, iptal edilene kadar</p>
        <button type="button" data-action="cancel-series" data-id="${esc(s.id)}">Seriyi iptal et</button>
      </article>`)
    .join('');

  return `
    <h2>Seanslar</h2>
    <form class="card" data-form="newSession">
      <h3>Tekrarlayan seans ekle</h3>
      ${state.clients.length
        ? `<label>Danışan <select name="clientId" required>${state.clients
            .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
            .join('')}</select></label>
           <label>Başlangıç tarihi <input type="date" name="startDate" required></label>
           <label>Saat <input type="time" name="time" required></label>
           <label>Süre (dakika) <input type="number" name="duration" min="5" step="5" value="50" required></label>
           <fieldset class="days">
             <legend>Haftanın günleri</legend>
             ${WEEKDAYS.map(([v, l]) => `<label class="check"><input type="checkbox" name="weekday" value="${v}"> ${l}</label>`).join('')}
           </fieldset>
           <button type="submit">Seriyi kaydet</button>`
        : '<p class="empty">Seans eklemek için önce bir danışan ekleyin.</p>'}
    </form>
    ${activeSeries ? `<h3>Aktif seriler</h3>${activeSeries}` : ''}
    ${state.notice ? `<p class="notice">${esc(state.notice)}</p>` : ''}
    ${items || '<p class="empty">Henüz seans yok.</p>'}`;
}

function summaryScreen() {
  const t = computeTotals({ clients: state.clients, sessions: state.sessions, payments: state.payments });
  const perClient = t.perClient.map((c) => `
    <article class="card">
      <h3>${esc(c.name)} ♥</h3>
      <p>${c.sessionCount} seans × ${money(c.fee)}</p>
      <p>Alınan ${money(c.paid)} · Kalan ${money(c.outstanding)}</p>
    </article>`).join('');
  return `
    <h2>Özet</h2>
    <section class="card total">
      <p>Faturalanan <strong>${money(t.overall.billed)}</strong></p>
      <p>Alınan <strong>${money(t.overall.paid)}</strong></p>
      <p>Bekleyen <strong>${money(t.overall.outstanding)}</strong></p>
    </section>
    ${perClient || '<p class="empty">Henüz veri yok.</p>'}
    <section class="card backup">
      <h3>Yedek</h3>
      <p>Veriler sadece bu telefonda tutulur. Düzenli olarak yedek alın.</p>
      <button type="button" data-action="backup">Yedek al</button>
      <label>Yedekten yükle <input type="file" accept="application/json,.json" data-field="restore"></label>
      ${state.backupNotice ? `<p class="notice">${esc(state.backupNotice)}</p>` : ''}
    </section>`;
}

function downloadBackup() {
  const backup = buildBackup({
    clients: state.clients,
    sessions: state.sessions,
    payments: state.payments,
    series: state.series,
  });
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function restoreBackup(file) {
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    state.backupNotice = parsed.reason;
    return render();
  }
  const { clients, sessions, payments, series } = parsed.data;
  const ok = confirm(`Mevcut veriler silinip yedekteki ${clients.length} danışan ve ${sessions.length} seans ile değiştirilecek. Devam edilsin mi?`);
  if (!ok) return;
  await replaceAll({ clients, sessions, payments, series });
  state.backupNotice = 'Yedek yüklendi.';
  return reload();
}

async function cancelSeries(id) {
  const series = state.series.find((s) => s.id === id);
  if (!series) return;
  const ok = confirm('Bu seri iptal edilsin mi? Geçmiş seanslar korunur, ileri tarihli planlanan seanslar silinir.');
  if (!ok) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await put('series', { ...series, endDate: toKey(yesterday) });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  for (const s of state.sessions) {
    if (s.seriesId === id && s.status === 'planned' && new Date(s.start) >= startOfToday) {
      await remove('sessions', s.id);
    }
  }
  state.notice = 'Seri iptal edildi.';
  return reload();
}

async function onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    state.notice = '';
    return render();
  }
  if (e.target.closest('[data-action="backup"]')) return downloadBackup();
  const cancel = e.target.closest('[data-action="cancel-series"]');
  if (cancel) return cancelSeries(cancel.dataset.id);
}

async function onChange(e) {
  if (e.target.dataset.field === 'restore') {
    const file = e.target.files[0];
    if (file) await restoreBackup(file);
    return;
  }
  const card = e.target.closest('[data-session]');
  if (!card) return;
  const id = card.dataset.session;
  const session = state.sessions.find((s) => s.id === id);

  if (e.target.dataset.field === 'status') {
    await put('sessions', { ...session, status: e.target.value });
    return reload();
  }

  // Any payment field change rewrites the whole payment record for this session.
  const paid = card.querySelector('[data-field="paid"]').checked;
  const paidOnInput = card.querySelector('[data-field="paidOn"]').value;
  const payment = {
    id: `p-${id}`,
    sessionId: id,
    amount: Math.max(0, Number(card.querySelector('[data-field="amount"]').value) || 0),
    paid,
    paidOn: paid ? paidOnInput || new Date().toISOString().slice(0, 10) : '',
  };
  await put('payments', payment);
  return reload();
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const kind = form.dataset.form;
  const data = new FormData(form);

  if (kind === 'newSession') {
    const weekdays = data.getAll('weekday').map(Number);
    if (!weekdays.length) {
      state.notice = 'En az bir gün seçin.';
      return render();
    }
    await put('series', {
      id: crypto.randomUUID(),
      clientId: data.get('clientId'),
      startDate: data.get('startDate'),
      time: data.get('time'),
      durationMin: Math.max(5, Number(data.get('duration')) || 50),
      weekdays,
      endDate: null,
    });
    state.notice = '';
    return reload();
  }

  const name = String(data.get('name') ?? '').trim();
  if (!name) return;
  const fee = Math.max(0, Number(data.get('fee')) || 0);

  if (kind === 'newClient') {
    await put('clients', { id: crypto.randomUUID(), name, fee });
  } else if (kind === 'client') {
    await put('clients', { id: form.dataset.id, name, fee });
  }
  return reload();
}
