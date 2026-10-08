export function slope(samples, key) {
  if (samples.length < 2) return 0;
  const mx = samples.reduce((n, s) => n + s.round, 0) / samples.length;
  const my = samples.reduce((n, s) => n + s[key], 0) / samples.length;
  const numerator = samples.reduce((n, s) => n + (s.round - mx) * (s[key] - my), 0);
  const denominator = samples.reduce((n, s) => n + (s.round - mx) ** 2, 0);
  return numerator / denominator;
}
// Exclude module loading/JIT warmup; require both positive slope and material growth.
export function trends(samples) {
  const tail = samples.slice(Math.min(5, Math.floor(samples.length / 5)));
  const allowances = {
    heap: 4096,
    roots: 0.01,
    boundaries: 0.01,
    routines: 0.05,
    domNodes: 0.1,
    pendingPromises: 0.05,
    eventsInFlight: 0.05,
    eventQueueDepth: 0
  };
  return Object.fromEntries(
    Object.entries(allowances).map(([key, threshold]) => {
      const fit = slope(tail, key);
      const growth = fit * Math.max(0, tail.length - 1);
      const minimum = key === "heap" ? Math.max(1024 * 1024, (tail[0]?.heap ?? 0) * 0.05) : 3;
      return [
        key,
        {
          slope: fit,
          threshold,
          growth,
          flagged: tail.length >= 10 && fit > threshold && growth > minimum
        }
      ];
    })
  );
}
