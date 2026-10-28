// The app id marks a file as ours. Files from other apps, or other format versions, are refused before any data is read.
const APP_ID = 'seans-takip';
const VERSION = 1;
const REQUIRED_LISTS = ['clients', 'sessions', 'payments'];
const OPTIONAL_LISTS = ['series'];

export function buildBackup({ clients, sessions, payments, series = [] }) {
  return {
    app: APP_ID,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    clients,
    sessions,
    payments,
    series,
  };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Dosya okunamadı: geçerli bir JSON değil.' };
  }
  if (!data || data.app !== APP_ID) {
    return { ok: false, reason: 'Bu dosya Seans Takip yedeği değil.' };
  }
  if (data.version !== VERSION) {
    return { ok: false, reason: 'Yedek sürümü desteklenmiyor.' };
  }
  for (const key of REQUIRED_LISTS) {
    if (!Array.isArray(data[key])) {
      return { ok: false, reason: `Yedekte "${key}" listesi eksik.` };
    }
  }
  for (const key of OPTIONAL_LISTS) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return { ok: false, reason: `Yedekte "${key}" listesi bozuk.` };
    }
    data[key] = data[key] ?? [];
  }
  return { ok: true, data };
}
