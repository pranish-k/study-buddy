import { useEffect, useState } from 'react';
import { fetchHealth, type Health } from '../lib/api';

export type HealthState =
  { status: 'loading' } | { status: 'ok'; health: Health } | { status: 'error' };

const RETRY_MS = 2000;

/** Checks the local server, retrying until it answers (it may start after the page loads). */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      fetchHealth(controller.signal)
        .then((health) => setState({ status: 'ok', health }))
        .catch(() => {
          if (controller.signal.aborted) return;
          setState({ status: 'error' });
          timer = setTimeout(check, RETRY_MS);
        });
    };
    check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return state;
}
