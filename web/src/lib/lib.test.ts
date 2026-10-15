import { describe, expect, it } from 'vitest';
import { deriveAvatarState } from './avatar-state';
import { estimateCost, formatUsd } from './cost';
import { durationsFromSearch, formatClock } from './durations';
import { MAX_MESSAGE_CHARS, trimForSend } from './limits';
import { shapesForWord } from './lipsync';
import { CODE_PLACEHOLDER, splitSentences, toSpeakable } from './speech-text';

describe('toSpeakable', () => {
  it('replaces code blocks with a short spoken note', () => {
    const text = toSpeakable('Try this:\n\n```js\nconst x = 1;\n```\n\nThen run it.');
    expect(text).toBe(`Try this: ${CODE_PLACEHOLDER} Then run it.`);
  });

  it('treats an unclosed code block as code while it streams in', () => {
    expect(toSpeakable('Look:\n```py\ndef f(')).toBe(`Look: ${CODE_PLACEHOLDER}`);
  });

  it('strips markdown formatting', () => {
    expect(toSpeakable('## Tip\n- **Base case** first, see [docs](http://x) and `n - 1`.')).toBe(
      'Tip Base case first, see docs and n - 1.',
    );
  });
});

describe('splitSentences', () => {
  it('holds back an incomplete trailing sentence while streaming', () => {
    expect(splitSentences('One. Two! Thr', false)).toEqual(['One.', 'Two!']);
  });

  it('returns everything once final', () => {
    expect(splitSentences('One. Two! Thr', true)).toEqual(['One.', 'Two!', 'Thr']);
  });
});

describe('deriveAvatarState', () => {
  const base = { active: true, speaking: false, thinking: false, hearing: false };
  it('prioritises speaking, then thinking, then listening', () => {
    expect(deriveAvatarState({ ...base, speaking: true, thinking: true, hearing: true })).toBe(
      'speaking',
    );
    expect(deriveAvatarState({ ...base, thinking: true, hearing: true })).toBe('thinking');
    expect(deriveAvatarState({ ...base, hearing: true })).toBe('listening');
    expect(deriveAvatarState(base)).toBe('idle');
  });

  it('is idle when Active Mode is off', () => {
    expect(deriveAvatarState({ ...base, active: false, thinking: true, hearing: true })).toBe(
      'idle',
    );
  });
});

describe('shapesForWord', () => {
  it('maps vowels and lip consonants to mouth shapes', () => {
    expect(shapesForWord('map')).toEqual(['closed', 'open', 'closed']);
    expect(shapesForWord('you')).toEqual(['wide', 'round']);
  });

  it('always moves the mouth', () => {
    expect(shapesForWord('xyz').length).toBeGreaterThan(0);
    expect(shapesForWord('shh')).toEqual(['open']);
  });
});

describe('durations', () => {
  it('defaults to 25/5 minutes', () => {
    expect(durationsFromSearch('')).toEqual({ workMs: 1_500_000, breakMs: 300_000 });
  });

  it('accepts seconds and minutes overrides', () => {
    expect(durationsFromSearch('?work=10s&break=2')).toEqual({ workMs: 10_000, breakMs: 120_000 });
  });

  it('ignores bad values', () => {
    expect(durationsFromSearch('?work=abc&break=0')).toEqual({
      workMs: 1_500_000,
      breakMs: 300_000,
    });
  });

  it('formats a countdown clock', () => {
    expect(formatClock(1_500_000)).toBe('25:00');
    expect(formatClock(61_001)).toBe('01:02');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('cost', () => {
  it('estimates Haiku cost per token', () => {
    expect(
      estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, 'claude-haiku-5-5'),
    ).toBeCloseTo(0.6);
  });

  it('returns null for unknown models', () => {
    expect(estimateCost({ inputTokens: 1, outputTokens: 1 }, 'mock')).toBeNull();
  });

  it('shows tiny amounts with more precision', () => {
    expect(formatUsd(0.0012)).toBe('$0.0012');
    expect(formatUsd(1.5)).toBe('$1.50');
  });
});

describe('trimForSend', () => {
  it('trims oversized pastes', () => {
    const { text, trimmed } = trimForSend('a'.repeat(MAX_MESSAGE_CHARS + 10));
    expect(trimmed).toBe(true);
    expect(text).toContain('trimmed 10 characters');
  });
});
