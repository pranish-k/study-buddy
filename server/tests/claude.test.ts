import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { ClaudeBrain, describeError } from '../src/brain/claude.js';

/** A fake Messages API that streams a two-chunk reply, so no real request (or spend) happens. */
function fakeApi(captured: { body?: Record<string, unknown> }, stopReason = 'end_turn') {
  const events = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-5-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 42, output_tokens: 1 },
        },
      },
    ],
    [
      'content_block_start',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ],
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Base case ' } },
    ],
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'first.' } },
    ],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: 7 },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  ] as const;
  const body = events
    .map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  return async (_url: unknown, init?: { body?: unknown }) => {
    captured.body = JSON.parse(String(init?.body));
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
}

describe('ClaudeBrain', () => {
  it('streams text deltas and reports usage, with a cheap request shape', async () => {
    const captured: { body?: Record<string, unknown> } = {};
    const brain = new ClaudeBrain('sk-test', 'claude-haiku-5-5', {
      fetch: fakeApi(captured),
      maxRetries: 0,
    });
    const chunks: string[] = [];
    const usage = await brain.reply({
      system: 'be nice',
      messages: [{ role: 'user', content: 'help' }],
      signal: new AbortController().signal,
      onDelta: (t) => chunks.push(t),
    });

    expect(chunks.join('')).toBe('Base case first.');
    expect(usage).toEqual({ inputTokens: 42, outputTokens: 7 });
    expect(captured.body).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      stream: true,
      system: 'be nice',
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'help' }],
    });
  });

  it('adds a gentle note when the model declines', async () => {
    const brain = new ClaudeBrain('sk-test', 'claude-haiku-5-5', {
      fetch: fakeApi({}, 'refusal'),
      maxRetries: 0,
    });
    const chunks: string[] = [];
    await brain.reply({
      system: '',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: (t) => chunks.push(t),
    });
    expect(chunks.join('')).toContain("I can't help with that one.");
  });
});

describe('describeError', () => {
  it('explains a rejected API key', () => {
    const err = new Anthropic.AuthenticationError(
      401,
      { type: 'error', error: { type: 'authentication_error', message: 'bad key' } },
      'bad key',
      new Headers(),
    );
    expect(describeError(err)).toMatch(/API key was rejected/);
  });

  it('falls back to a generic message', () => {
    expect(describeError(new Error('boom'))).toBe('Something went wrong while generating a reply.');
  });
});
