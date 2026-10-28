// Each completed session is billed at its own fee. A session counts as paid only when it was completed and marked paid.
export function computeTotals({ clients, sessions }) {
  const perClient = clients.map((client) => {
    const done = sessions.filter((s) => s.clientId === client.id && s.status === 'done');
    const billed = done.reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
    const paid = done.filter((s) => s.paid).reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
    return {
      clientId: client.id,
      name: client.name,
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
