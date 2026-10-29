// Room share (oda payı) is a percentage of each session fee, taken per client.
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

// The month's net is only what was actually received that month: a session counts once it is paid,
// in the month of its payment date. Unpaid and due sessions add nothing until they are paid.
export function computeSummary({ clients, sessions, month }) {
  const perClient = clients.map((client) => {
    const pct = roomPctOf(client);
    const received = sessions.filter(
      (s) => s.clientId === client.id
        && s.status === 'done'
        && payStateOf(s) === 'paid'
        && monthOfDay(payDateOf(s)) === month,
    );
    const gross = received.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
    const room = received.reduce((sum, s) => sum + roomOf(s.fee, pct), 0);
    return { clientId: client.id, name: client.name, pct, sessionCount: received.length, gross, room, net: gross - room };
  });

  const overall = {
    sessionCount: perClient.reduce((sum, c) => sum + c.sessionCount, 0),
    gross: perClient.reduce((sum, c) => sum + c.gross, 0),
    room: perClient.reduce((sum, c) => sum + c.room, 0),
    net: perClient.reduce((sum, c) => sum + c.net, 0),
  };
  return { perClient, overall };
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Net income for each of the last `count` months, oldest first, ending with `endMonth`.
export function monthlyNet({ clients, sessions, endMonth, count }) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) months.push(shiftMonth(endMonth, -i));
  return months.map((month) => ({ month, net: computeSummary({ clients, sessions, month }).overall.net }));
}

// Held sessions that are not paid yet, per client, largest debt first. Planned and cancelled sessions are not debts.
export function debtorsOf({ clients, sessions }) {
  return clients
    .map((client) => {
      const owing = sessions.filter((s) => s.clientId === client.id && s.status === 'done' && payStateOf(s) !== 'paid');
      return {
        clientId: client.id,
        name: client.name,
        count: owing.length,
        owed: owing.reduce((sum, s) => sum + (Number(s.fee) || 0), 0),
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.owed - a.owed);
}
