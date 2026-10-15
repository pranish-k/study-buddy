import { Icon } from './Icon';

interface Props {
  active: boolean;
  onToggleActive: () => void;
  micOn: boolean;
  micAvailable: boolean;
  onToggleMic: () => void;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | undefined;
  onVoiceChange: (uri: string) => void;
}

export function ControlBar({
  active,
  onToggleActive,
  micOn,
  micAvailable,
  onToggleMic,
  voices,
  voiceURI,
  onVoiceChange,
}: Props) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const options = english.length > 0 ? english : voices;
  return (
    <div className="control-bar" role="toolbar" aria-label="Call controls">
      <button
        type="button"
        className="ctrl-btn"
        onClick={onToggleMic}
        disabled={!active || !micAvailable}
        aria-pressed={micOn}
        title={micAvailable ? undefined : 'Speech recognition is not available in this browser'}
      >
        <span className={`ctrl-icon${micOn ? '' : ' muted'}`}>
          <Icon name={micOn ? 'mic' : 'micOff'} />
        </span>
        <span className="ctrl-label">{micOn ? 'Mute' : 'Unmute'}</span>
      </button>

      <button
        type="button"
        className={`active-btn${active ? ' on' : ''}`}
        onClick={onToggleActive}
        data-testid="active-toggle"
      >
        <Icon name="power" />
        {active ? 'Stop' : 'Start Active Mode'}
      </button>

      <label className="voice-picker">
        <span className="ctrl-label">Voice</span>
        <select
          value={voiceURI ?? ''}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={options.length === 0}
        >
          {options.length === 0 && <option value="">Default</option>}
          {options.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
