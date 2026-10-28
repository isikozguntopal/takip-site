import { CONFIG } from '../config.js';

// Read-only: the app can list and read calendar events, never change them.
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';

export function signIn() {
  return new Promise((resolve, reject) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.clientId,
      scope: SCOPE,
      callback: (resp) => (resp.error ? reject(new Error(resp.error)) : resolve(resp.access_token)),
    });
    client.requestAccessToken();
  });
}

async function api(path, token) {
  // The token goes in the header, never in the URL.
  const res = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Takvim isteği başarısız: ${res.status}`);
  return res.json();
}

export async function listCalendars(token) {
  const data = await api('users/me/calendarList', token);
  return data.items.map((c) => ({ id: c.id, summary: c.summary }));
}

// singleEvents expands recurring events into single days; showDeleted keeps cancellations visible to the sync.
export async function listEvents({ token, calendarId, timeMin, timeMax }) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    showDeleted: 'true',
    timeMin,
    timeMax,
    maxResults: '2500',
  });
  const data = await api(`calendars/${encodeURIComponent(calendarId)}/events?${params}`, token);
  return data.items.map((e) => ({
    id: e.id,
    summary: e.summary ?? '',
    start: e.start.dateTime ?? e.start.date,
    end: e.end.dateTime ?? e.end.date,
    status: e.status,
  }));
}
