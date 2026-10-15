import { describe, expect, it } from 'vitest';
import { MockBrain, pickMockReply } from '../src/brain/mock.js';
import { CHECKIN_PROMPT } from '../src/brain/prompt.js';

describe('pickMockReply', () => {
  it('answers recursion questions with a code example', () => {
    expect(pickMockReply("I'm stuck on recursion")).toContain('```python');
  });

  it('handles pasted errors', () => {
    expect(pickMockReply('TypeError: x is undefined')).toMatch(/error/i);
  });

  it('answers break check-ins', () => {
    expect(pickMockReply(CHECKIN_PROMPT)).toMatch(/break|stretch/i);
  });
});

describe('MockBrain', () => {
  it('streams the reply in chunks that add up to the whole reply', async () => {
    const chunks: string[] = [];
    await new MockBrain(0).reply({
      system: '',
      messages: [{ role: 'user', content: 'recursion please' }],
      signal: new AbortController().signal,
      onDelta: (t) => chunks.push(t),
    });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.join('')).toBe(pickMockReply('recursion please'));
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const chunks: string[] = [];
    const pending = new MockBrain(5).reply({
      system: '',
      messages: [{ role: 'user', content: 'recursion' }],
      signal: controller.signal,
      onDelta: (t) => {
        chunks.push(t);
        if (chunks.length === 2) controller.abort();
      },
    });
    await expect(pending).rejects.toBeDefined();
    expect(chunks).toHaveLength(2);
  });
});
