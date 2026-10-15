/** Mirrors the server guardrail so the user is warned before a giant paste is sent. */
export const MAX_MESSAGE_CHARS = 8000;

export function trimForSend(text: string): { text: string; trimmed: boolean } {
  if (text.length <= MAX_MESSAGE_CHARS) return { text, trimmed: false };
  const dropped = text.length - MAX_MESSAGE_CHARS;
  return {
    text: `${text.slice(0, MAX_MESSAGE_CHARS)}\n\n[...trimmed ${dropped} characters]`,
    trimmed: true,
  };
}
