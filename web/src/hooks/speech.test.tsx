import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecognitionErrorEvent } from './speech-recognition-types';
import { useHealth } from './useHealth';
import { useSpeechRecognition } from './useSpeechRecognition';
import { SPEAKING_HOLD_MS, useSpeechSynthesis } from './useSpeechSynthesis';

afterEach(() => {
  // Unmount before removing the stubbed browser APIs the hooks clean up with.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSpeechRecognition', () => {
  class FakeRecognition {
    static instances: FakeRecognition[] = [];
    continuous = false;
    interimResults = false;
    lang = '';
    starts = 0;
    onresult = null;
    onerror: ((e: RecognitionErrorEvent) => void) | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      FakeRecognition.instances.push(this);
    }
    start() {
      this.starts++;
    }
    stop() {}
    abort() {}
  }

  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  });

  const failWith = (rec: FakeRecognition, error: string) =>
    act(() => {
      rec.onerror?.({ error });
      rec.onend?.();
      vi.advanceTimersByTime(2000);
    });

  it('restarts after the browser ends a quiet session', () => {
    renderHook(() => useSpeechRecognition({ enabled: true, onFinal: () => {} }));
    const rec = FakeRecognition.instances[0]!;
    failWith(rec, 'no-speech');
    expect(rec.starts).toBe(2);
  });

  it('stops retrying on hard errors instead of looping, and clears the error when the mic turns off', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSpeechRecognition({ enabled, onFinal: () => {} }),
      { initialProps: { enabled: true } },
    );
    const rec = FakeRecognition.instances[0]!;
    failWith(rec, 'network');
    expect(rec.starts).toBe(1);
    expect(result.current.error).toContain('network');

    rerender({ enabled: false });
    expect(result.current.error).toBeNull();
  });

  it('explains a blocked microphone', () => {
    const { result } = renderHook(() => useSpeechRecognition({ enabled: true, onFinal: () => {} }));
    failWith(FakeRecognition.instances[0]!, 'not-allowed');
    expect(result.current.error).toMatch(/blocked/);
  });
});

describe('useSpeechSynthesis', () => {
  class FakeUtterance {
    voice: unknown = null;
    rate = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onboundary: (() => void) | null = null;
    constructor(public text: string) {}
  }

  let queued: FakeUtterance[];
  beforeEach(() => {
    vi.useFakeTimers();
    queued = [];
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal(
      'speechSynthesis',
      Object.assign(new EventTarget(), {
        getVoices: () => [],
        speak: (u: FakeUtterance) => queued.push(u),
        cancel: () => {},
      }),
    );
  });

  it('stays "speaking" across a short gap between streamed sentences', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak('First sentence.'));
    act(() => queued[0]!.onend?.());
    act(() => vi.advanceTimersByTime(SPEAKING_HOLD_MS - 100));
    expect(result.current.speaking).toBe(true);

    act(() => result.current.speak('Second sentence.'));
    act(() => queued[1]!.onend?.());
    act(() => vi.advanceTimersByTime(SPEAKING_HOLD_MS + 10));
    expect(result.current.speaking).toBe(false);
  });

  it('stops immediately on cancel', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak('Hello.'));
    act(() => result.current.cancel());
    expect(result.current.speaking).toBe(false);
  });
});

describe('useHealth', () => {
  it('keeps retrying until the server comes up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const health = { ok: true, brain: 'mock', model: 'mock', maxMessageChars: 8000 };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('connection refused'))
      .mockResolvedValue(new Response(JSON.stringify(health), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useHealth());
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', health }));
  });
});
