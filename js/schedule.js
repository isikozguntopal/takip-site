// Expands a weekly series into concrete sessions between two local dates ('YYYY-MM-DD').
// Series never end unless endDate is set (cancelling a series sets it).
export function toKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function expandSeries(series, fromDate, toDate) {
  const last = series.endDate && series.endDate < toDate ? series.endDate : toDate;
  const first = series.startDate > fromDate ? series.startDate : fromDate;
  // A day picked without a time yet is kept, but makes no sessions until the time is entered.
  if (!series.time) return [];
  const [hour, minute] = series.time.split(':').map(Number);
  const out = [];

  for (let d = fromKey(first); toKey(d) <= last; d.setDate(d.getDate() + 1)) {
    if (!series.weekdays.includes(d.getDay())) continue;
    const key = toKey(d);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
    const end = new Date(start.getTime() + series.durationMin * 60000);
    out.push({
      id: `${series.id}_${key}`,
      seriesId: series.id,
      clientId: series.clientId,
      start: start.toISOString(),
      end: end.toISOString(),
      status: 'planned',
      fee: series.fee ?? 0,
      paid: false,
      paidOn: '',
    });
  }
  return out;
}

// A client has at most one active series per weekday. When two overlapping program saves wrote the same day twice,
// the last one is the one the program screen shows, so every earlier active one for that day is an extra.
export function extraSeriesIds(series, todayKey) {
  const lastByDay = new Map();
  for (const s of series) {
    if (s.endDate && s.endDate < todayKey) continue;
    lastByDay.set(`${s.clientId}_${s.weekdays[0]}`, s.id);
  }
  const keep = new Set(lastByDay.values());
  return series.filter((s) => !(s.endDate && s.endDate < todayKey) && !keep.has(s.id)).map((s) => s.id);
}

// The client and the day a weekly session belongs to. Its id ends with the day it was made for, so a moved
// session still counts for that day. Sessions not made by a series give ''.
export function seriesDayKey(session) {
  const day = /_(\d{4}-\d{2}-\d{2})$/.exec(session.id ?? '')?.[1];
  return session.seriesId && day ? `${session.clientId}_${day}` : '';
}

// A client has one weekly session per day. When the program changed on a session day, the new program added a
// second one that day. Of such doubles, the recorded ones (status, payment, move) stay; when none is recorded,
// the copy of the current program stays. Returns the ids of the copies to remove.
export function doubledSessionIds(sessions, isPlain, currentSeriesIds) {
  const byDay = new Map();
  for (const s of sessions) {
    const key = seriesDayKey(s);
    if (!key) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const out = [];
  for (const group of byDay.values()) {
    if (group.length < 2) continue;
    const kept = group.filter((s) => !isPlain(s));
    const plainOnes = group.filter(isPlain);
    if (!kept.length) {
      const keep = plainOnes.find((s) => currentSeriesIds.has(s.seriesId)) ?? plainOnes[plainOnes.length - 1];
      out.push(...plainOnes.filter((s) => s !== keep).map((s) => s.id));
    } else {
      out.push(...plainOnes.map((s) => s.id));
    }
  }
  return out;
}
