import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, type ApiMessage, type Usage } from '../lib/api';
import { trimForSend } from '../lib/limits';

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

/** Converts the visible history into what the API needs: finished turns only, alternating roles. */
export function toApiHistory(messages: ChatMessage[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const m of messages) {
    if (m.kind === 'local' || m.status === 'error' || !m.content.trim()) continue;
    const last = out.at(-1);
    if (last?.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
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
    messagesRef.current = messages;
    callbacksRef.current = callbacks;
  });

  const update = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const requestReply = useCallback(
    async (history: ChatMessage[], kind: 'chat' | 'checkin') => {
      const id = nextId();
      const controller = new AbortController();
      controllers.current.add(controller);
      setMessages((prev) => [
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
              if (meta.trimmed) setTrimNotice(true);
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
    [update],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const { text: content, trimmed } = trimForSend(text);
      setTrimNotice(trimmed);
      const userMessage: ChatMessage = { id: nextId(), role: 'user', content, status: 'done' };
      const history = [...messagesRef.current, userMessage];
      messagesRef.current = history;
      setMessages(history);
      void requestReply(history, 'chat');
    },
    [requestReply],
  );

  const checkIn = useCallback(() => {
    void requestReply(messagesRef.current, 'checkin');
  }, [requestReply]);

  const addLocalNote = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'assistant', content, status: 'done', kind: 'local' },
    ]);
  }, []);

  /** Aborts every in-flight request. The server aborts its upstream call when the connection drops. */
  const stopAll = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
  }, []);

  const dismissTrimNotice = useCallback(() => setTrimNotice(false), []);

  useEffect(() => stopAll, [stopAll]);

  return {
    messages,
    thinking: thinkingId !== null,
    usage,
    trimNotice,
    dismissTrimNotice,
    send,
    checkIn,
    addLocalNote,
    stopAll,
  };
}
