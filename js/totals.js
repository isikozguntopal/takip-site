// Room share (oda payı) is a percentage of each completed session's fee, taken per client.
export function roomOf(fee, pct) {
  return Math.round((Number(fee) || 0) * pct / 100);
}

export function roomPctOf(client) {
  return Math.min(100, Math.max(0, Number(client?.roomPct) || 0));
}

// Legacy sessions only had a boolean `paid`; new ones carry `payState` ('none' | 'due' | 'paid') and `payDate`.
export function payStateOf(session) {
  return session.payState ?? (session.paid ? 'paid' : 'none');
}

export function payDateOf(session) {
  return session.payDate ?? session.paidOn ?? '';
}

export function monthOfIso(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthOfDay(key) {
  return key ? key.slice(0, 7) : '';
}

// Sessions are counted in the month they happen. A payment is counted in the month of its payment date, so a late payment
// lands in the month it was actually received. Money still owed is counted across all months.
export function computeSummary({ clients, sessions, month }) {
  const perClient = clients.map((client) => {
    const pct = roomPctOf(client);
    const done = sessions.filter((s) => s.clientId === client.id && s.status === 'done');
    const net = (s) => (Number(s.fee) || 0) - roomOf(s.fee, pct);

    const inMonth = done.filter((s) => monthOfIso(s.start) === month);
    const billed = inMonth.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
    const room = inMonth.reduce((sum, s) => sum + roomOf(s.fee, pct), 0);

    const received = done
      .filter((s) => payStateOf(s) === 'paid' && monthOfDay(payDateOf(s)) === month)
      .reduce((sum, s) => sum + net(s), 0);
    const outstanding = done
      .filter((s) => payStateOf(s) !== 'paid')
      .reduce((sum, s) => sum + net(s), 0);

    return {
      clientId: client.id,
      name: client.name,
      pct,
      sessionCount: inMonth.length,
      billed,
      room,
      net: billed - room,
      received,
      outstanding,
    };
  });

  const overall = perClient.reduce(
    (acc, c) => ({
      billed: acc.billed + c.billed,
      room: acc.room + c.room,
      net: acc.net + c.net,
      received: acc.received + c.received,
      outstanding: acc.outstanding + c.outstanding,
    }),
    { billed: 0, room: 0, net: 0, received: 0, outstanding: 0 },
  );

  return { perClient, overall };
}
