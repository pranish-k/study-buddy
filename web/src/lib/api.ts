import { readSse } from './sse';

export type BrainName = 'claude' | 'mock';

export interface Health {
  brain: BrainName;
  model: string;
  /** Longest message the server sends to the model before trimming it. */
  maxMessageChars: number;
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReplyMeta {
  brain: BrainName;
  model: string;
  trimmed: boolean;
}

export interface StreamHandlers {
  onMeta?: (meta: ReplyMeta) => void;
  onDelta: (text: string) => void;
}

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`Server health check failed (${res.status})`);
  return (await res.json()) as Health;
}

/** Sends the conversation and streams the reply. Resolves with token usage when the reply is complete. */
export async function streamChat(
  body: { messages: ApiMessage[]; kind: 'chat' | 'checkin' },
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<Usage> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `The server returned an error (${res.status}).`);
  }

  for await (const { event, data } of readSse(res.body)) {
    const payload: unknown = JSON.parse(data);
    switch (event) {
      case 'meta':
        handlers.onMeta?.(payload as ReplyMeta);
        break;
      case 'delta':
        handlers.onDelta((payload as { text: string }).text);
        break;
      case 'done':
        return (payload as { usage: Usage }).usage;
      case 'error':
        throw new Error((payload as { message: string }).message);
    }
  }
  throw new Error('The reply ended unexpectedly.');
}
