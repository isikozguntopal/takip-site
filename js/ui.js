import { CONFIG } from '../config.js';
import { getAll, put, replaceAll } from './db.js';
import { computeTotals } from './totals.js';
import { syncEvents } from './calendarSync.js';
import { buildBackup, parseBackup } from './backup.js';
import { signIn, listCalendars, listEvents } from './google.js';
import { motivation, surprise } from './messages.js';

const DAY_MS = 86400000;
const TABS = [
  ['home', 'Ana'],
  ['clients', 'Danışanlar'],
  ['sessions', 'Seanslar'],
  ['summary', 'Özet'],
];
const STATUS_LABELS = { planned: 'Planlandı', done: 'Gerçekleşti', cancelled: 'İptal' };

const state = { tab: 'home', clients: [], sessions: [], payments: [], notice: '', backupNotice: '' };
let root;

export async function startUi(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  await reload();
}

async function reload() {
  [state.clients, state.sessions, state.payments] = await Promise.all(
    ['clients', 'sessions', 'payments'].map(getAll),
  );
  render();
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
  return `
    <h2>Seanslar</h2>
    <form class="card" data-form="newSession">
      <h3>Seans ekle</h3>
      ${state.clients.length
        ? `<label>Danışan <select name="clientId" required>${state.clients
            .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
            .join('')}</select></label>
           <label>Başlangıç <input type="datetime-local" name="start" required></label>
           <label>Bitiş <input type="datetime-local" name="end" required></label>
           <button type="submit">Seansı ekle</button>`
        : '<p class="empty">Seans eklemek için önce bir danışan ekleyin.</p>'}
    </form>
    <button type="button" class="sync" data-action="sync">♥ Takvimden çek</button>
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
  const backup = buildBackup({ clients: state.clients, sessions: state.sessions, payments: state.payments });
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
  const { clients, sessions, payments } = parsed.data;
  const ok = confirm(`Mevcut veriler silinip yedekteki ${clients.length} danışan ve ${sessions.length} seans ile değiştirilecek. Devam edilsin mi?`);
  if (!ok) return;
  await replaceAll({ clients, sessions, payments });
  state.backupNotice = 'Yedek yüklendi.';
  return reload();
}

async function onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    state.notice = '';
    return render();
  }
  if (e.target.closest('[data-action="sync"]')) return syncCalendar();
  if (e.target.closest('[data-action="backup"]')) return downloadBackup();
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
    const start = new Date(data.get('start'));
    const end = new Date(data.get('end'));
    if (!(end > start)) {
      state.notice = 'Bitiş saati başlangıçtan sonra olmalı.';
      return render();
    }
    await put('sessions', {
      id: crypto.randomUUID(),
      clientId: data.get('clientId'),
      start: start.toISOString(),
      end: end.toISOString(),
      status: 'planned',
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

async function syncCalendar() {
  try {
    state.notice = 'Takvim okunuyor…';
    render();
    const token = await signIn();
    const calendars = await listCalendars(token);
    const calendarId = CONFIG.calendarName
      ? calendars.find((c) => c.summary === CONFIG.calendarName)?.id
      : 'primary';
    if (!calendarId) throw new Error(`"${CONFIG.calendarName}" takvimi bulunamadı.`);

    const now = Date.now();
    const events = await listEvents({
      token,
      calendarId,
      timeMin: new Date(now - 60 * DAY_MS).toISOString(),
      timeMax: new Date(now + 120 * DAY_MS).toISOString(),
    });
    const result = syncEvents({ events, clients: state.clients, sessions: state.sessions });
    await replaceAll({ clients: state.clients, sessions: result.sessions, payments: state.payments });
    state.notice = `${result.added} yeni, ${result.updated} güncellendi.`;
    await reload();
  } catch (err) {
    state.notice = `Takvim çekilemedi: ${err.message}`;
    render();
  }
}
