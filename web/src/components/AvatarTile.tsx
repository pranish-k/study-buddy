import type { AvatarState } from '../lib/avatar-state';
import type { MouthShape } from '../lib/lipsync';
import { Icon } from './Icon';
import { NovaFace } from './NovaFace';

const STATUS_TEXT: Record<AvatarState, string> = {
  idle: '',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

interface Props {
  state: AvatarState;
  mouth: MouthShape;
  active: boolean;
  micOn: boolean;
  /** What the user is saying right now. */
  userCaption: string;
  /** What Nova is saying right now. */
  novaCaption: string;
}

export function AvatarTile({ state, mouth, active, micOn, userCaption, novaCaption }: Props) {
  const caption = userCaption
    ? { who: 'You', text: userCaption }
    : novaCaption
      ? { who: 'Nova', text: novaCaption }
      : null;
  return (
    <section
      className="tile"
      data-state={state}
      data-mouth={mouth}
      data-active={active}
      data-testid="avatar-tile"
      aria-label="Nova video tile"
    >
      <div className="tile-room" aria-hidden="true" />
      <NovaFace state={state} mouth={mouth} />

      {state === 'thinking' && (
        <div className="thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <div className="tile-label">
        {state === 'speaking' && (
          <span className="speaking-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="tile-name">Nova</span>
        {STATUS_TEXT[state] && <span className="tile-status">{STATUS_TEXT[state]}</span>}
      </div>

      <div
        className="self-tile"
        data-hearing={state === 'listening'}
        aria-label={micOn ? 'Your microphone is on' : 'Your microphone is off'}
      >
        <span className="self-avatar">You</span>
        <span className={`self-mic${micOn ? '' : ' off'}`}>
          <Icon name={micOn ? 'mic' : 'micOff'} size={14} />
        </span>
      </div>

      {!active && (
        <div className="tile-paused">
          <p>Nova is waiting. Start Active Mode to study together.</p>
        </div>
      )}

      <div className="captions" aria-live="polite">
        {caption && (
          <p data-testid="caption">
            <strong>{caption.who}:</strong> {caption.text}
          </p>
        )}
      </div>
    </section>
  );
}
