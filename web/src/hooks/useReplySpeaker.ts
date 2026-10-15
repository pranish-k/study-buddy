import { useCallback, useRef } from 'react';
import { splitSentences, toSpeakable } from '../lib/speech-text';

/**
 * Speaks a streaming reply sentence by sentence, so Nova starts talking before the whole reply
 * has arrived. Code is never read aloud.
 */
export function useReplySpeaker(speak: (text: string) => void, enabled: boolean) {
  const spoken = useRef(new Map<string, number>());

  const flush = useCallback(
    (id: string, fullText: string, final: boolean) => {
      if (!enabled) return;
      const sentences = splitSentences(toSpeakable(fullText), final);
      const already = spoken.current.get(id) ?? 0;
      for (const sentence of sentences.slice(already)) speak(sentence);
      spoken.current.set(id, Math.max(already, sentences.length));
    },
    [speak, enabled],
  );

  const onDelta = useCallback(
    (id: string, fullText: string) => flush(id, fullText, false),
    [flush],
  );
  const onEnd = useCallback(
    (id: string, fullText: string) => {
      flush(id, fullText, true);
      spoken.current.delete(id);
    },
    [flush],
  );
  const reset = useCallback(() => spoken.current.clear(), []);

  return { enabled, onDelta, onEnd, reset };
}
