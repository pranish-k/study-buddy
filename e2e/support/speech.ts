import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export interface SpeechTestHooks {
  spoken: string[];
  recognizing: boolean;
  say(text: string): void;
}

const STUB_PATH = fileURLToPath(new URL('./speech-stub.js', import.meta.url));

/** Installs fake speech recognition and synthesis. `wordMs` sets how long each spoken word takes. */
export async function installSpeech(page: Page, wordMs = 60): Promise<void> {
  await page.addInitScript(`window.__SPEECH_WORD_MS = ${wordMs};`);
  await page.addInitScript({ path: STUB_PATH });
}

export function say(page: Page, text: string): Promise<void> {
  return page.evaluate(
    (t) => (window as unknown as { __speech: SpeechTestHooks }).__speech.say(t),
    text,
  );
}

export function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...(window as unknown as { __speech: SpeechTestHooks }).__speech.spoken,
  ]);
}

export function recognizing(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as { __speech: SpeechTestHooks }).__speech.recognizing,
  );
}
