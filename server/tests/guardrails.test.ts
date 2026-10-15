import { describe, expect, it } from 'vitest';
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  prepareMessages,
  trimText,
} from '../src/guardrails.js';
import type { ChatMessage } from '../src/types.js';

const turns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i}`,
  }));

describe('trimText', () => {
  it('leaves short text alone', () => {
    expect(trimText('hello')).toEqual({ text: 'hello', trimmed: false });
  });

  it('cuts long text and says how much was dropped', () => {
    const result = trimText('x'.repeat(MAX_MESSAGE_CHARS + 50));
    expect(result.trimmed).toBe(true);
    expect(result.text.startsWith('x'.repeat(MAX_MESSAGE_CHARS))).toBe(true);
    expect(result.text).toContain('trimmed 50 characters');
  });
});

describe('prepareMessages', () => {
  it('keeps only the most recent messages', () => {
    const { messages } = prepareMessages(turns(31));
    expect(messages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(messages.at(-1)?.content).toBe('m30');
  });

  it('always starts with a user turn after capping', () => {
    const { messages } = prepareMessages(turns(14));
    expect(messages[0]?.role).toBe('user');
  });

  it('flags when any message was trimmed', () => {
    const { trimmed } = prepareMessages([
      { role: 'user', content: 'y'.repeat(MAX_MESSAGE_CHARS + 1) },
    ]);
    expect(trimmed).toBe(true);
  });
});
