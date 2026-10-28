// Only completed sessions are billed; a payment counts as received only when it is marked paid.
export function computeTotals({ clients, sessions, payments }) {
  const perClient = clients.map((client) => {
    const fee = Number.isFinite(client.fee) ? client.fee : 0;
    const done = sessions.filter((s) => s.clientId === client.id && s.status === 'done');
    const doneIds = new Set(done.map((s) => s.id));
    const paid = payments
      .filter((p) => p.paid && doneIds.has(p.sessionId))
      .reduce((sum, p) => sum + p.amount, 0);
    const billed = done.length * fee;
    return {
      clientId: client.id,
      name: client.name,
      fee,
      sessionCount: done.length,
      billed,
      paid,
      outstanding: billed - paid,
    };
  });

  const overall = perClient.reduce(
    (acc, c) => ({
      billed: acc.billed + c.billed,
      paid: acc.paid + c.paid,
      outstanding: acc.outstanding + c.outstanding,
    }),
    { billed: 0, paid: 0, outstanding: 0 },
  );

  return { perClient, overall };
}
