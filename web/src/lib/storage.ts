/** localStorage can throw (private mode, blocked storage), so preferences degrade to defaults. */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`study-buddy:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`study-buddy:${key}`, JSON.stringify(value));
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}
