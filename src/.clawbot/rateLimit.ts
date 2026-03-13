const requestWindows = new Map<string, number[]>();

export function checkAssistantRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = (requestWindows.get(key) || []).filter((ts) => now - ts < windowMs);
  if (current.length >= limit) {
    const oldest = current[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    requestWindows.set(key, current);
    return { allowed: false as const, retryAfter };
  }
  current.push(now);
  requestWindows.set(key, current);
  return { allowed: true as const, retryAfter: 0 };
}
