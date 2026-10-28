// The app id marks a file as ours. Files from other apps, or other format versions, are refused before any data is read.
const APP_ID = 'seans-takip';
const VERSION = 1;
const LISTS = ['clients', 'sessions', 'payments'];

export function buildBackup({ clients, sessions, payments }) {
  return {
    app: APP_ID,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    clients,
    sessions,
    payments,
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
  for (const key of LISTS) {
    if (!Array.isArray(data[key])) {
      return { ok: false, reason: `Yedekte "${key}" listesi eksik.` };
    }
  }
  return { ok: true, data };
}
