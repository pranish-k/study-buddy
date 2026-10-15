// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readSse } from './sse';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('readSse', () => {
  it('parses events split across chunks', async () => {
    const events = [];
    for await (const e of readSse(
      streamOf(['event: delta\nda', 'ta: {"text":"hi"}\n\nevent: done\n', 'data: {}\n\n']),
    )) {
      events.push(e);
    }
    expect(events).toEqual([
      { event: 'delta', data: '{"text":"hi"}' },
      { event: 'done', data: '{}' },
    ]);
  });
});
