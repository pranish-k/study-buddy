import type { HealthState } from '../hooks/useHealth';
import type { SessionUsage } from '../hooks/useChat';
import { estimateCost, formatUsd } from '../lib/cost';

export function TopBar({
  health,
  usage,
  active,
}: {
  health: HealthState;
  usage: SessionUsage;
  active: boolean;
}) {
  const isMock = health.status === 'ok' && health.health.brain === 'mock';
  const model = health.status === 'ok' ? health.health.model : '';
  const cost = isMock ? 0 : estimateCost(usage, model);
  const tokens = usage.inputTokens + usage.outputTokens;
  // The mock brain reports no tokens, so "0 tokens - $0.00" would only be noise.
  const showTokens = !isMock || tokens > 0;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Study Buddy</h1>
        <span className={`live-pill${active ? ' on' : ''}`} data-testid="active-pill">
          <i />
          {active ? 'Active' : 'Off'}
        </span>
      </div>
      <div className="topbar-right">
        <span
          className={`badge${health.status === 'error' ? ' error' : ''}`}
          data-testid="brain-badge"
        >
          {health.status === 'loading' && 'Connecting...'}
          {health.status === 'error' && 'Server offline'}
          {health.status === 'ok' && (isMock ? 'Mock brain' : `Claude · ${model}`)}
        </span>
        <span className="usage" data-testid="usage" title="Usage for this session">
          <span>{usage.requests === 1 ? '1 reply' : `${usage.requests} replies`}</span>
          {showTokens && (
            <span className="tokens-part">
              <span className="dot" aria-hidden="true" />
              <span>{tokens.toLocaleString()} tokens</span>
            </span>
          )}
          <span className="dot" aria-hidden="true" />
          <strong>{isMock ? 'mock, no cost' : cost === null ? 'cost n/a' : formatUsd(cost)}</strong>
        </span>
      </div>
    </header>
  );
}
