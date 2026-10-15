import type { ChatMessage } from './types.js';

/** Only the most recent messages are sent upstream, so cost stays flat in long sessions. */
export const MAX_HISTORY_MESSAGES = 12;
/** Any single message longer than this is cut down before it reaches the model. */
export const MAX_MESSAGE_CHARS = 8000;

export interface PreparedMessages {
  messages: ChatMessage[];
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

export function prepareMessages(input: ChatMessage[]): PreparedMessages {
  let messages = input.slice(-MAX_HISTORY_MESSAGES);
  // The API expects the conversation to start with a user turn.
  const firstUser = messages.findIndex((m) => m.role === 'user');
  messages = firstUser === -1 ? [] : messages.slice(firstUser);

  let trimmed = false;
  messages = messages.map((m) => {
    const result = trimText(m.content);
    trimmed ||= result.trimmed;
    return { role: m.role, content: result.text };
  });
  return { messages, trimmed };
}
