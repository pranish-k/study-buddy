import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarTile } from './components/AvatarTile';
import { ChatPanel } from './components/ChatPanel';
import { ControlBar } from './components/ControlBar';
import { Icon } from './components/Icon';
import { PomodoroTimer } from './components/PomodoroTimer';
import { TopBar } from './components/TopBar';
import { useChat } from './hooks/useChat';
import { useHealth } from './hooks/useHealth';
import { useLipSync } from './hooks/useLipSync';
import { usePomodoro, type Phase } from './hooks/usePomodoro';
import { useReplySpeaker } from './hooks/useReplySpeaker';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { deriveAvatarState } from './lib/avatar-state';
import { durationsFromSearch } from './lib/durations';
import { loadPref, savePref } from './lib/storage';

export function App() {
  const health = useHealth();
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [speakReplies, setSpeakReplies] = useState(() => loadPref('speakReplies', true));
  const [durations] = useState(() => durationsFromSearch(window.location.search));
  const activeRef = useRef(active);

  const tts = useSpeechSynthesis();
  const mouth = useLipSync(tts.speaking, tts.onWord);
  const speaker = useReplySpeaker(tts.speak, active && speakReplies && tts.supported);
  const chat = useChat({ onReplyDelta: speaker.onDelta, onReplyEnd: speaker.onEnd });

  const { cancel: cancelSpeech } = tts;
  const { reset: resetSpeaker } = speaker;
  const { send, stopAll, checkIn, addLocalNote } = chat;

  const sendMessage = useCallback(
    (text: string) => {
      // A new question interrupts whatever Nova was saying.
      cancelSpeech();
      resetSpeaker();
      send(text);
    },
    [cancelSpeech, resetSpeaker, send],
  );

  // The mic pauses while Nova talks so it doesn't hear its own voice.
  const recognition = useSpeechRecognition({
    enabled: active && micOn && !tts.speaking,
    onFinal: sendMessage,
  });

  const onPhaseChange = useCallback(
    (phase: Phase) => {
      if (phase === 'break' && activeRef.current) checkIn();
      if (phase === 'work') addLocalNote("Break's over. Ready for the next focus block?");
    },
    [checkIn, addLocalNote],
  );
  const timer = usePomodoro(durations, onPhaseChange);

  // Active Mode is the master switch: turning it off stops the mic, speech and every request.
  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      stopAll();
      cancelSpeech();
      resetSpeaker();
    }
  }, [active, stopAll, cancelSpeech, resetSpeaker]);

  const toggleSpeak = () => {
    const next = !speakReplies;
    if (!next) cancelSpeech();
    setSpeakReplies(next);
    savePref('speakReplies', next);
  };

  const avatarState = deriveAvatarState({
    active,
    speaking: tts.speaking,
    thinking: chat.thinking,
    hearing: recognition.interim.length > 0,
  });
  const micLive = active && micOn && recognition.supported;
  const voiceNotice = !recognition.supported
    ? 'Voice input needs Chrome or Edge. You can still type to Nova.'
    : recognition.error;

  return (
    <div className="app">
      <TopBar health={health} usage={chat.usage} active={active} />
      <main className="layout">
        <div className="stage">
          <AvatarTile
            state={avatarState}
            mouth={mouth}
            active={active}
            micOn={micLive}
            userCaption={recognition.interim}
            novaCaption={tts.caption}
          />
          {voiceNotice && (
            <div className="notice info" role="status">
              <Icon name="alert" size={15} />
              <span>{voiceNotice}</span>
            </div>
          )}
          <ControlBar
            active={active}
            onToggleActive={() => setActive((a) => !a)}
            micOn={micLive}
            micAvailable={recognition.supported}
            onToggleMic={() => setMicOn((m) => !m)}
            voices={tts.voices}
            voiceURI={tts.voice?.voiceURI}
            onVoiceChange={tts.setVoiceURI}
          />
        </div>
        <aside className="sidebar">
          <PomodoroTimer timer={timer} />
          <ChatPanel
            messages={chat.messages}
            active={active}
            thinking={chat.thinking}
            speakReplies={speakReplies && tts.supported}
            speechSupported={tts.supported}
            onToggleSpeak={toggleSpeak}
            onSend={sendMessage}
            trimNotice={chat.trimNotice}
            onDismissTrimNotice={chat.dismissTrimNotice}
          />
        </aside>
      </main>
    </div>
  );
}
