import type { usePomodoro } from '../hooks/usePomodoro';
import { formatClock } from '../lib/durations';
import { Icon } from './Icon';

type Pomodoro = ReturnType<typeof usePomodoro>;

export function PomodoroTimer({ timer }: { timer: Pomodoro }) {
  const total = timer.phase === 'work' ? timer.durations.workMs : timer.durations.breakMs;
  const progress = 1 - timer.remainingMs / total;
  const isBreak = timer.phase === 'break';
  return (
    <section className="panel pomodoro" data-phase={timer.phase} aria-label="Pomodoro timer">
      <div
        className="pomo-ring"
        style={{ ['--progress' as string]: progress }}
        aria-hidden="true"
      />
      <div className="pomo-info">
        <span className="pomo-phase">{isBreak ? 'Break' : 'Focus'}</span>
        <span className="pomo-clock" data-testid="pomodoro-clock" role="timer" aria-live="off">
          {formatClock(timer.remainingMs)}
        </span>
        <span className="pomo-count">
          {timer.completed === 1 ? '1 session done' : `${timer.completed} sessions done`}
        </span>
      </div>
      <div className="pomo-actions">
        {timer.running ? (
          <button
            type="button"
            className="icon-btn lg"
            onClick={timer.pause}
            aria-label="Pause timer"
          >
            <Icon name="pause" />
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn lg primary"
            onClick={timer.start}
            aria-label="Start timer"
          >
            <Icon name="play" />
          </button>
        )}
        <button
          type="button"
          className="icon-btn lg"
          onClick={timer.reset}
          aria-label="Reset timer"
        >
          <Icon name="reset" />
        </button>
      </div>
    </section>
  );
}
