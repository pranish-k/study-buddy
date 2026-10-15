import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MockBrain } from '../src/brain/mock.js';
import { CHECKIN_PROMPT } from '../src/brain/prompt.js';
import type { Brain, BrainRequest } from '../src/types.js';

function parseSse(body: string): { event: string; data: unknown }[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
      const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}

class RecordingBrain implements Brain {
  readonly name = 'mock';
  readonly model = 'test';
  last?: BrainRequest;
  async reply(req: BrainRequest) {
    this.last = req;
    req.onDelta('Hello ');
    req.onDelta('there');
    return { inputTokens: 12, outputTokens: 3 };
  }
}

describe('GET /api/health', () => {
  it('reports which brain is active', async () => {
    const res = await request(createApp(new MockBrain(0))).get('/api/health');
    expect(res.body).toEqual({ ok: true, brain: 'mock', model: 'mock' });
  });
});

describe('POST /api/chat', () => {
  it('streams meta, deltas and a done event with usage', async () => {
    const res = await request(createApp(new RecordingBrain()))
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(parseSse(res.text)).toEqual([
      { event: 'meta', data: { brain: 'mock', model: 'test', trimmed: false } },
      { event: 'delta', data: { text: 'Hello ' } },
      { event: 'delta', data: { text: 'there' } },
      { event: 'done', data: { usage: { inputTokens: 12, outputTokens: 3 } } },
    ]);
  });

  it('appends the check-in prompt for break check-ins', async () => {
    const brain = new RecordingBrain();
    await request(createApp(brain)).post('/api/chat').send({ kind: 'checkin', messages: [] });
    expect(brain.last?.messages.at(-1)?.content).toBe(CHECKIN_PROMPT);
  });

  it('trims oversized pastes and tells the client', async () => {
    const brain = new RecordingBrain();
    const res = await request(createApp(brain))
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'z'.repeat(20000) }] });
    expect(parseSse(res.text)[0]?.data).toMatchObject({ trimmed: true });
    expect(brain.last!.messages[0]!.content.length).toBeLessThan(9000);
  });

  it('rejects malformed requests', async () => {
    const app = createApp(new RecordingBrain());
    expect((await request(app).post('/api/chat').send({ messages: 'nope' })).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/chat')
          .send({ messages: [{ role: 'assistant', content: 'x' }] })
      ).status,
    ).toBe(400);
  });

  it('reports brain failures as an error event', async () => {
    const failing: Brain = {
      name: 'mock',
      model: 'test',
      reply: () => Promise.reject(new Error('boom')),
    };
    const res = await request(createApp(failing))
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(parseSse(res.text).at(-1)?.event).toBe('error');
  });

  it('aborts the upstream reply when the client disconnects', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const slow: Brain = {
      name: 'mock',
      model: 'test',
      reply: ({ signal, onDelta }) =>
        new Promise((_resolve, reject) => {
          upstreamSignal = signal;
          onDelta('thinking...');
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    };
    const server = createApp(slow).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const client = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: client.signal,
    });
    await res.body!.getReader().read();
    client.abort();
    await expect.poll(() => upstreamSignal?.aborted).toBe(true);
    server.close();
  });
});
