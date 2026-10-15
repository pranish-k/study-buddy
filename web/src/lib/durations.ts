export interface PomodoroDurations {
  workMs: number;
  breakMs: number;
}

export const DEFAULT_DURATIONS: PomodoroDurations = { workMs: 25 * 60_000, breakMs: 5 * 60_000 };

/** Parses "25" (minutes) or "10s" (seconds). */
function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const match = /^(\d+(?:\.\d+)?)(s|m)?$/.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const ms = match[2] === 's' ? value * 1000 : value * 60_000;
  return ms > 0 ? ms : null;
}

/** `?work=10s&break=5s` shortens the timer for testing. */
export function durationsFromSearch(search: string): PomodoroDurations {
  const params = new URLSearchParams(search);
  return {
    workMs: parseDuration(params.get('work')) ?? DEFAULT_DURATIONS.workMs,
    breakMs: parseDuration(params.get('break')) ?? DEFAULT_DURATIONS.breakMs,
  };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
