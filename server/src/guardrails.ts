import type { ChatMessage } from './types.js';

/** Only the most recent messages are sent upstream, so cost stays flat in long sessions. */
export const MAX_HISTORY_MESSAGES = 12;
/** Any single message longer than this is cut down before it reaches the model. */
export const MAX_MESSAGE_CHARS = 8000;

export interface PreparedMessages {
  messages: ChatMessage[];
  /** True when the newest message was cut down, so the UI can warn about that paste only. */
  trimmed: boolean;
}

export function trimText(
  text: string,
  limit = MAX_MESSAGE_CHARS,
): { text: string; trimmed: boolean } {
  if (text.length <= limit) return { text, trimmed: false };
  const dropped = text.length - limit;
  return { text: `${text.slice(0, limit)}\n\n[...trimmed ${dropped} characters]`, trimmed: true };
}

/**
 * Caps history, trims each turn, then merges neighbouring turns from the same speaker (left behind
 * when a reply fails or a check-in follows a question). Trimming happens per turn before merging,
 * so a long earlier paste can never push the newest question out.
 */
export function prepareMessages(input: ChatMessage[]): PreparedMessages {
  const recent = input
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, ...trimText(m.content) }));
  const trimmed = recent.at(-1)?.trimmed ?? false;

  const messages: ChatMessage[] = [];
  for (const m of recent) {
    const last = messages.at(-1);
    if (last?.role === m.role) last.content += `\n\n${m.text}`;
    else messages.push({ role: m.role, content: m.text });
  }
  // The API expects the conversation to start with a user turn.
  while (messages[0]?.role === 'assistant') messages.shift();
  return { messages, trimmed };
}
