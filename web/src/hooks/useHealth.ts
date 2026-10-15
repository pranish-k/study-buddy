import { useEffect, useState } from 'react';
import { fetchHealth, type Health } from '../lib/api';

export type HealthState =
  { status: 'loading' } | { status: 'ok'; health: Health } | { status: 'error' };

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((health) => setState({ status: 'ok', health }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, []);
  return state;
}
