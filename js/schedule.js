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
