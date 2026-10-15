export const CODE_PLACEHOLDER = "I've put the code in the chat.";

/**
 * Turns markdown into text that sounds natural when read aloud. Code blocks are never read out;
 * an unclosed block (still streaming) counts as code too, so the result is stable as text streams in.
 */
export function toSpeakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, ` ${CODE_PLACEHOLDER} `)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits speakable text into sentences. The last one is incomplete unless `final` is set. */
export function splitSentences(text: string, final: boolean): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!final && parts.length > 0 && !/[.!?]$/.test(text)) parts.pop();
  return parts;
}
