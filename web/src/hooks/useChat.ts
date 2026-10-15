import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, type ApiMessage, type Usage } from '../lib/api';

export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  /** `checkin` replies come from the timer; `local` notes never leave the browser. */
  kind?: 'checkin' | 'local';
  error?: string;
}

export interface SessionUsage extends Usage {
  requests: number;
}

interface Callbacks {
  onReplyDelta?: (id: string, fullText: string) => void;
  onReplyEnd?: (id: string, fullText: string) => void;
}

/** Side effects like speech must never turn a good reply into a failed one. */
function notify(callback: () => void): void {
  try {
    callback();
  } catch (err) {
    console.error('[chat] reply listener failed:', err);
  }
}

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * Converts the visible history into what the API needs: real turns with content. The server trims
 * each turn and merges same-role neighbours, so that logic lives in one place.
 */
export function toApiHistory(messages: ChatMessage[]): ApiMessage[] {
  return messages
    .filter((m) => m.kind !== 'local' && m.status !== 'error' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
}

export function useChat(callbacks: Callbacks = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinkingId, setThinkingId] = useState<string | null>(null);
  const [usage, setUsage] = useState<SessionUsage>({
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
  });
  const [trimNotice, setTrimNotice] = useState(false);
  const messagesRef = useRef(messages);
  const callbacksRef = useRef(callbacks);
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // The ref is the source of truth and every change goes through here, so the history sent to the
  // API is never stale and no queued update can be overwritten.
  const commit = useCallback((change: (prev: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = change(messagesRef.current);
    setMessages(messagesRef.current);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      commit((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [commit],
  );

  const requestReply = useCallback(
    async (history: ChatMessage[], kind: 'chat' | 'checkin') => {
      const id = nextId();
      const controller = new AbortController();
      controllers.current.add(controller);
      commit((prev) => [
        ...prev,
        {
          id,
          role: 'assistant',
          content: '',
          status: 'streaming',
          ...(kind === 'checkin' ? { kind } : {}),
        },
      ]);
      setThinkingId(id);

      let full = '';
      try {
        const result = await streamChat(
          { messages: toApiHistory(history), kind },
          {
            onMeta: (meta) => {
              if (kind === 'chat') setTrimNotice(meta.trimmed);
            },
            onDelta: (text) => {
              full += text;
              setThinkingId((current) => (current === id ? null : current));
              update(id, { content: full });
              notify(() => callbacksRef.current.onReplyDelta?.(id, full));
            },
          },
          controller.signal,
        );
        setUsage((u) => ({
          inputTokens: u.inputTokens + result.inputTokens,
          outputTokens: u.outputTokens + result.outputTokens,
          requests: u.requests + 1,
        }));
        update(id, { status: 'done' });
        notify(() => callbacksRef.current.onReplyEnd?.(id, full));
      } catch (err) {
        if (controller.signal.aborted) {
          update(id, { status: 'stopped' });
        } else {
          update(id, { status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        controllers.current.delete(controller);
        setThinkingId((current) => (current === id ? null : current));
      }
    },
    [update, commit],
  );

  /** Aborts every in-flight request. The server aborts its upstream call when the connection drops. */
  const stopAll = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
  }, []);

  /** A new question supersedes any reply still streaming, so two answers never overlap. */
  const send = useCallback(
    (raw: string) => {
      const content = raw.trim();
      if (!content) return;
      stopAll();
      const userMessage: ChatMessage = { id: nextId(), role: 'user', content, status: 'done' };
      commit((prev) => [...prev, userMessage]);
      void requestReply(messagesRef.current, 'chat');
    },
    [requestReply, stopAll, commit],
  );

  /** Skipped while a reply is in progress: Nova is already talking with the user. */
  const checkIn = useCallback(() => {
    if (controllers.current.size > 0) return;
    void requestReply(messagesRef.current, 'checkin');
  }, [requestReply]);

  const addLocalNote = useCallback(
    (content: string) => {
      commit((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content, status: 'done', kind: 'local' },
      ]);
    },
    [commit],
  );

  const dismissTrimNotice = useCallback(() => setTrimNotice(false), []);

  useEffect(() => stopAll, [stopAll]);

  return {
    messages,
    thinking: thinkingId !== null,
    replying: messages.some((m) => m.status === 'streaming'),
    usage,
    trimNotice,
    dismissTrimNotice,
    send,
    checkIn,
    addLocalNote,
    stopAll,
  };
}
