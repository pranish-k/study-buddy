import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../hooks/useChat';
import { Icon } from './Icon';
import { Markdown } from './Markdown';

interface Props {
  messages: ChatMessage[];
  active: boolean;
  thinking: boolean;
  speakReplies: boolean;
  speechSupported: boolean;
  onToggleSpeak: () => void;
  onSend: (text: string) => void;
  trimNotice: boolean;
  onDismissTrimNotice: () => void;
  /** The server's per-message limit, or null until the server has answered. */
  maxChars: number | null;
}

export function ChatPanel(props: Props) {
  const {
    messages,
    active,
    thinking,
    speakReplies,
    speechSupported,
    onToggleSpeak,
    onSend,
    trimNotice,
    onDismissTrimNotice,
    maxChars,
  } = props;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const tooLong = maxChars !== null && draft.length > maxChars;
  const limit = (maxChars ?? 0).toLocaleString();

  // Keep the newest message in view while replies stream in.
  const lastContent = messages.at(-1)?.content;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, lastContent]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!active || !draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className="panel chat" aria-label="Chat with Nova">
      <header className="panel-head">
        <h2>Chat</h2>
        <button
          type="button"
          className="chip-toggle"
          aria-pressed={speakReplies}
          onClick={onToggleSpeak}
          disabled={!speechSupported}
          title={speechSupported ? undefined : 'This browser has no built-in voice'}
        >
          <Icon name={speakReplies ? 'volume' : 'volumeOff'} size={15} />
          {speakReplies ? 'Speak replies' : 'Text only'}
        </button>
      </header>

      <div className="messages" ref={listRef} data-testid="messages">
        {messages.length === 0 && (
          <div className="empty">
            <Icon name="sparkle" size={22} />
            <p>Ask Nova anything, or paste code, an error message or your notes.</p>
            <p className="muted">Long code answers are shown here instead of read aloud.</p>
          </div>
        )}
        {messages.map((m) => (
          <article
            key={m.id}
            className={`msg ${m.role}${m.kind ? ` ${m.kind}` : ''}`}
            data-status={m.status}
          >
            {m.role === 'assistant' && m.kind === 'checkin' && (
              <span className="msg-tag">Break check-in</span>
            )}
            {m.content ? (
              m.role === 'assistant' ? (
                <Markdown text={m.content} />
              ) : (
                <p className="plain">{m.content}</p>
              )
            ) : m.status === 'streaming' ? (
              <span className="typing" aria-label="Nova is typing">
                <i />
                <i />
                <i />
              </span>
            ) : null}
            {m.status === 'stopped' && <span className="msg-note">Stopped</span>}
            {m.status === 'error' && (
              <span className="msg-note error" role="alert">
                <Icon name="alert" size={14} /> {m.error}
              </span>
            )}
          </article>
        ))}
      </div>

      {(trimNotice || tooLong) && (
        <div className="notice warn" role="status">
          <Icon name="alert" size={15} />
          <span>
            {tooLong
              ? `This is ${draft.length.toLocaleString()} characters. Only the first ${limit} will be sent, to keep the cost of one message low.`
              : 'Your last message was too long, so only its beginning was sent, to keep costs low.'}
          </span>
          {!tooLong && (
            <button
              type="button"
              className="icon-btn"
              onClick={onDismissTrimNotice}
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            active
              ? 'Type or paste here. Enter to send, Shift+Enter for a new line.'
              : 'Start Active Mode to chat with Nova'
          }
          disabled={!active}
          rows={3}
          aria-label="Message to Nova"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!active || !draft.trim() || thinking}
          aria-label="Send message"
        >
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}
