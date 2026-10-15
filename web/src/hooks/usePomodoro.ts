import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { PomodoroDurations } from '../lib/durations';

export type Phase = 'work' | 'break';

export interface PomodoroState {
  phase: Phase;
  running: boolean;
  /** Wall-clock end time while running; time is tracked by timestamp so background tabs stay accurate. */
  endsAt: number | null;
  remainingMs: number;
  completed: number;
}

type Action =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'reset' }
  | { type: 'tick'; now: number };

export function pomodoroReducer(durations: PomodoroDurations) {
  const lengthOf = (phase: Phase) => (phase === 'work' ? durations.workMs : durations.breakMs);
  return (state: PomodoroState, action: Action): PomodoroState => {
    switch (action.type) {
      case 'start':
        return state.running
          ? state
          : { ...state, running: true, endsAt: action.now + state.remainingMs };
      case 'pause':
        return state.running && state.endsAt !== null
          ? {
              ...state,
              running: false,
              endsAt: null,
              remainingMs: Math.max(0, state.endsAt - action.now),
            }
          : state;
      case 'reset':
        return initialPomodoro(durations, state.completed);
      case 'tick': {
        if (!state.running || state.endsAt === null) return state;
        const remainingMs = state.endsAt - action.now;
        if (remainingMs > 0) return { ...state, remainingMs };
        // Phase over: roll straight into the next one so a forgotten timer keeps cycling.
        const phase: Phase = state.phase === 'work' ? 'break' : 'work';
        const length = lengthOf(phase);
        return {
          phase,
          running: true,
          endsAt: action.now + length,
          remainingMs: length,
          completed: state.phase === 'work' ? state.completed + 1 : state.completed,
        };
      }
    }
  };
}

export function initialPomodoro(durations: PomodoroDurations, completed = 0): PomodoroState {
  return { phase: 'work', running: false, endsAt: null, remainingMs: durations.workMs, completed };
}

export function usePomodoro(durations: PomodoroDurations, onPhaseChange: (phase: Phase) => void) {
  const [state, dispatch] = useReducer(pomodoroReducer(durations), durations, (d) =>
    initialPomodoro(d),
  );
  const onPhaseChangeRef = useRef(onPhaseChange);
  const previousPhase = useRef(state.phase);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  useEffect(() => {
    if (!state.running) return;
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => clearInterval(timer);
  }, [state.running]);

  useEffect(() => {
    if (previousPhase.current !== state.phase && state.running)
      onPhaseChangeRef.current(state.phase);
    previousPhase.current = state.phase;
  }, [state.phase, state.running]);

  const start = useCallback(() => dispatch({ type: 'start', now: Date.now() }), []);
  const pause = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { ...state, durations, start, pause, reset };
}
