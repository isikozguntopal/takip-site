// The evening reminder about tomorrow's sessions. The reminder server sends it at 21:00 only on evenings before a session
// day; the only thing it learns from the phone is which dates have a session.
export const REMIND_HOUR = 21;
const KEY = 'takip-reminder';

const money = (n) => `${Number(n).toLocaleString('tr-TR')} ₺`;

// sessions: [{ clientId, name, time }] sorted by time. debtors: [{ clientId, name, count, owed }].
// A client who has money still owed and a session tomorrow gets a line of their own.
export function buildReminder({ sessions, debtors }) {
  if (!sessions.length) {
    return {
      title: 'Yarın seansınız yok ♥',
      body: 'Bu akşam dinlenin. Yeni bir gün sizi bekliyor.',
    };
  }
  const lines = sessions.map((s) => `${s.time}  ${s.name}`);
  const owed = debtors
    .filter((d) => sessions.some((s) => s.clientId === d.clientId))
    .map((d) => `⚠ ${d.name}: ${d.count} seans, ${money(d.owed)} ödenmedi. Yarın hatırlatın.`);
  return {
    title: `Yarın ${sessions.length} seansınız var ♥`,
    body: [...lines, ...owed, 'Yarın da birinin hayatına dokunacaksınız.'].join('\n'),
  };
}

// True once per day, after the reminder hour, while reminders are on.
export function shouldRemind({ now, enabled, lastDay, todayKey }) {
  return enabled && now.getHours() >= REMIND_HOUR && lastDay !== todayKey;
}

export function readPrefs() {
  try {
    return { enabled: false, lastDay: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { enabled: false, lastDay: '' };
  }
}

export function writePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private windows can block storage; the reminder then simply stays off after a reload.
  }
}

// The dates, 'YYYY-MM-DD' in local time, that have a session that is not cancelled, from fromKey for `days` days.
// These dates are all the server gets: no names, times or fees.
export function sessionDays(sessions, fromKey, days = 120) {
  const [y, m, d] = fromKey.split('-').map(Number);
  const last = new Date(y, m - 1, d + days);
  const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const lastKey = key(last);
  const found = new Set();
  for (const s of sessions) {
    if (s.status === 'cancelled') continue;
    const day = key(new Date(s.start));
    if (day >= fromKey && day <= lastKey) found.add(day);
  }
  return [...found].sort();
}

// Tells the server the session dates, so it reminds only the evening before a session day.
export async function sendSessionDays(config, days) {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  const response = await fetch(`${config.pushServer}/days`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, days }),
  });
  return response.ok;
}

// The server needs the phone's push address and the session dates. Nothing about clients leaves the phone.
export function serverReady(config) {
  return Boolean(config.pushServer) && !config.pushServer.startsWith('REPLACE') && Boolean(config.vapidPublicKey);
}

function keyBytes(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function subscribeToServer(config) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(config.vapidPublicKey),
  });
  await fetch(`${config.pushServer}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
}

export async function unsubscribeFromServer(config) {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch(`${config.pushServer}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

// Installed home-screen apps show notifications through the service worker, which keeps working when the page is closed.
export async function showReminder({ title, body }) {
  const options = {
    body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'yarin-seanslar',
    renotify: true,
  };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) return registration.showNotification(title, options);
  return new Notification(title, options);
}
