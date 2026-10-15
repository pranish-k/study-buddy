import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiMessage } from '../lib/api';
import { useChat } from './useChat';

interface FakeCall {
  body: { messages: ApiMessage[]; kind: string };
  signal: AbortSignal;
  send: (event: string, data: unknown) => void;
  finish: (text?: string) => void;
}

/** Stands in for the server: each /api/chat call gets a stream the test writes to. */
function fakeServer(): FakeCall[] {
  const calls: FakeCall[] = [];
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
      const signal = init.signal!;
      signal.addEventListener('abort', () =>
        controller.error(new DOMException('Aborted', 'AbortError')),
      );
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      calls.push({
        body: JSON.parse(String(init.body)),
        signal,
        send,
        finish: (text) => {
          if (text) send('delta', { text });
          send('done', { usage: { inputTokens: 1, outputTokens: 1 } });
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }),
  );
  return calls;
}

describe('useChat', () => {
  let calls: FakeCall[];
  beforeEach(() => {
    calls = fakeServer();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never loses a message when two questions arrive back to back', async () => {
    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.send('first');
      result.current.send('second');
    });
    expect(result.current.messages.map((m) => `${m.role}:${m.content || m.status}`)).toEqual([
      'user:first',
      'assistant:streaming',
      'user:second',
      'assistant:streaming',
    ]);
    await waitFor(() => expect(result.current.messages[1]?.status).toBe('stopped'));
  });

  it('a new question stops the reply that is still streaming', async () => {
    const onReplyDelta = vi.fn();
    const { result } = renderHook(() => useChat({ onReplyDelta }));
    act(() => result.current.send('first'));
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.send('second'));
    expect(calls[0]!.signal.aborted).toBe(true);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]!.body.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ]);
  });

  it('sends the finished reply text as history for the next question', async () => {
    const { result } = renderHook(() => useChat());
    act(() => result.current.send('q1'));
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => calls[0]!.finish('a1'));
    await waitFor(() => expect(result.current.messages[1]?.status).toBe('done'));
    act(() => result.current.send('q2'));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]!.body.messages).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
  });

  it('skips a break check-in while a reply is in progress', async () => {
    const { result } = renderHook(() => useChat());
    act(() => result.current.send('q1'));
    act(() => result.current.checkIn());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body.kind).toBe('chat');
  });

  it('shows the trim notice only for the newest message', async () => {
    const { result } = renderHook(() => useChat());
    act(() => result.current.send('long paste'));
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => calls[0]!.send('meta', { brain: 'mock', model: 'mock', trimmed: true }));
    await waitFor(() => expect(result.current.trimNotice).toBe(true));
    act(() => calls[0]!.finish('ok'));
    await waitFor(() => expect(result.current.replying).toBe(false));

    act(() => result.current.send('short'));
    await waitFor(() => expect(calls).toHaveLength(2));
    act(() => calls[1]!.send('meta', { brain: 'mock', model: 'mock', trimmed: false }));
    await waitFor(() => expect(result.current.trimNotice).toBe(false));
  });
});
