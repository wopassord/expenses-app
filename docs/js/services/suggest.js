// Autocomplete from your own history: type "cant" and get back the last
// "Canteen lunch · Canteen · Parents’ card · 7.10 €" so a whole entry is a
// few keystrokes plus Enter.

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function buildIndex(transactions) {
  const map = new Map();
  // transactions arrive newest first, so the first hit per key is the latest.
  for (const t of transactions) {
    const key = norm(t.description);
    if (!key) continue;
    const entry = map.get(key);
    if (entry) entry.count++;
    else map.set(key, { key, latest: t, count: 1 });
  }
  return [...map.values()];
}

export function suggest(index, query, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(/\s+/);
  return index
    .map((e) => {
      if (!words.every((w) => e.key.includes(w))) return null;
      const score = (e.key.startsWith(q) ? 100 : 0)
        + (e.key.split(/\s+/).some((w) => w.startsWith(words[0])) ? 40 : 0)
        + Math.min(e.count, 30);
      return { ...e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.latest.date.localeCompare(a.latest.date))
    .slice(0, limit)
    .map((e) => e.latest);
}
