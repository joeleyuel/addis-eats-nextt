// A tiny in-memory failure counter for the admin sign-in (no imports, pure, clock injectable
// for tests). It slows down guessing of the access code: after `max` failures inside
// `windowMs` a key is refused until the oldest failure ages out.
//
// HONEST LIMIT: it lives in this process's memory, like the order store. A restart forgets it
// and several server instances each count separately. The access code is long and random, so
// this is a brake, not the lock. A shared store (a database or Redis) is the real fix.
export function createLimiter({ max, windowMs, maxKeys = 5000 }) {
  const failures = new Map(); // key -> [timestamps]

  function recent(key, now) {
    const list = (failures.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  }

  return {
    // Seconds until this key may try again, or 0 if it may try now.
    retryAfter(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length < max) return 0;
      return Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
    },
    fail(key, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      failures.delete(key); // re-insert so the oldest keys are the first to be evicted
      failures.set(key, list);
      while (failures.size > maxKeys) failures.delete(failures.keys().next().value);
    },
    clear(key) {
      failures.delete(key);
    },
    size: () => failures.size,
  };
}
