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
