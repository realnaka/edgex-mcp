const WINDOW_MS = 10_000;
const MAX_REQUESTS = 50;

const timestamps: number[] = [];

function pruneOld(now: number): void {
  while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
    timestamps.shift();
  }
}

export async function rateLimit(): Promise<void> {
  const now = Date.now();
  pruneOld(now);

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0]!;
    const waitMs = oldest + WINDOW_MS - now + 50;
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
      pruneOld(Date.now());
    }
  }

  timestamps.push(Date.now());
}
