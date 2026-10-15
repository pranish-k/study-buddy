import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiHistory, type ChatMessage } from './useChat';
import { initialPomodoro, pomodoroReducer, usePomodoro } from './usePomodoro';

const durations = { workMs: 10_000, breakMs: 4_000 };

describe('pomodoroReducer', () => {
  const reduce = pomodoroReducer(durations);

  it('keeps remaining time across pause and resume', () => {
    let s = reduce(initialPomodoro(durations), { type: 'start', now: 0 });
    s = reduce(s, { type: 'pause', now: 3_000 });
    expect(s).toMatchObject({ running: false, remainingMs: 7_000 });
    s = reduce(s, { type: 'start', now: 50_000 });
    expect(s.endsAt).toBe(57_000);
  });

  it('rolls from work into break and counts the session', () => {
    let s = reduce(initialPomodoro(durations), { type: 'start', now: 0 });
    s = reduce(s, { type: 'tick', now: 10_000 });
    expect(s).toMatchObject({ phase: 'break', remainingMs: 4_000, completed: 1, running: true });
  });

  it('stays accurate after a long background gap', () => {
    let s = reduce(initialPomodoro(durations), { type: 'start', now: 0 });
    s = reduce(s, { type: 'tick', now: 6_500 });
    expect(s.remainingMs).toBe(3_500);
  });
});

describe('usePomodoro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports phase changes as the timer runs', () => {
    const onPhase = vi.fn();
    const { result } = renderHook(() => usePomodoro(durations, onPhase));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(10_300);
    });
    expect(result.current.phase).toBe('break');
    expect(onPhase).toHaveBeenCalledWith('break');
    act(() => {
      vi.advanceTimersByTime(4_300);
    });
    expect(onPhase).toHaveBeenLastCalledWith('work');
  });

  it('does not report a phase change on reset', () => {
    const onPhase = vi.fn();
    const { result } = renderHook(() => usePomodoro(durations, onPhase));
    act(() => result.current.reset());
    expect(onPhase).not.toHaveBeenCalled();
  });
});

describe('toApiHistory', () => {
  const msg = (
    role: ChatMessage['role'],
    content: string,
    extra: Partial<ChatMessage> = {},
  ): ChatMessage => ({
    id: content,
    role,
    content,
    status: 'done',
    ...extra,
  });

  it('keeps real turns and drops local notes, errors and empty replies', () => {
    expect(
      toApiHistory([
        msg('user', 'q1'),
        msg('assistant', 'a1'),
        msg('assistant', 'note', { kind: 'local' }),
        msg('assistant', 'check-in', { kind: 'checkin' }),
        msg('user', 'q2'),
        msg('assistant', 'oops', { status: 'error' }),
        msg('assistant', '', { status: 'stopped' }),
        msg('user', 'q3'),
      ]),
    ).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'assistant', content: 'check-in' },
      { role: 'user', content: 'q2' },
      { role: 'user', content: 'q3' },
    ]);
  });
});
