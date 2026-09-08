const buckets = new Map();

export function guardBlocked(key, max) {
  const b = buckets.get(key);
  if (!b || Date.now() > b.resetAt) return false;
  return b.count >= max;
}

export function guardFail(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1 >= max;
  }
  b.count++;
  return b.count >= max;
}

export function guardClear(key) {
  buckets.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref();
