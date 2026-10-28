// Matches a calendar event title to a client name. Longest names are tried first, so "Alişan" wins over "Ali".
// Letters on either side of the name break the match, so "Ali" does not match inside "Alişan".
export function matchClient(title, clients) {
  const byLength = [...clients].sort((a, b) => b.name.length - a.name.length);
  for (const client of byLength) {
    const escaped = client.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'iu');
    if (pattern.test(title)) return client.id;
  }
  return null;
}

// Applies calendar events to the stored sessions. A session is identified by its calendar event id.
// Cancelled events mark the session cancelled, except a session the user already marked done.
export function syncEvents({ events, clients, sessions }) {
  const result = sessions.map((s) => ({ ...s }));
  let added = 0;
  let updated = 0;

  for (const ev of events) {
    const clientId = matchClient(ev.summary ?? '', clients);
    if (!clientId) continue;

    // A second calendar entry for the same client at the same start is the same session, so it is never billed twice.
    const existing =
      result.find((s) => s.eventId === ev.id) ??
      (ev.status === 'cancelled'
        ? undefined
        : result.find((s) => s.clientId === clientId && s.start === ev.start && s.status !== 'cancelled'));

    if (ev.status === 'cancelled') {
      if (existing && existing.status !== 'done') existing.status = 'cancelled';
      continue;
    }

    if (!existing) {
      result.push({
        id: `s-${ev.id}`,
        eventId: ev.id,
        clientId,
        start: ev.start,
        end: ev.end,
        status: 'planned',
      });
      added++;
      continue;
    }

    if (existing.status === 'cancelled') existing.status = 'planned';
    const changed = existing.start !== ev.start || existing.end !== ev.end || existing.clientId !== clientId;
    if (changed) {
      existing.start = ev.start;
      existing.end = ev.end;
      existing.clientId = clientId;
      updated++;
    }
  }

  return { sessions: result, added, updated, removed: 0 };
}
