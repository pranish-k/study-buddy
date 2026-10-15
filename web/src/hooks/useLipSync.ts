import { useEffect, useRef, useState } from 'react';
import { FALLBACK_RHYTHM, shapesForWord, type MouthShape } from '../lib/lipsync';

const FRAME_MS = 80;
/** If the voice reports no word timings for this long, fall back to a natural rhythm. */
const FALLBACK_AFTER_MS = 450;

/** Drives the avatar's mouth from word boundary events while speech plays. */
export function useLipSync(
  speaking: boolean,
  onWord: (listener: (word: string) => void) => () => void,
): MouthShape {
  const [shape, setShape] = useState<MouthShape>('rest');
  const queue = useRef<MouthShape[]>([]);
  const lastWordAt = useRef(0);

  useEffect(
    () =>
      onWord((word) => {
        queue.current = shapesForWord(word);
        lastWordAt.current = performance.now();
      }),
    [onWord],
  );

  useEffect(() => {
    if (!speaking) {
      queue.current = [];
      return;
    }
    let beat = 0;
    lastWordAt.current = performance.now();
    const timer = setInterval(() => {
      const next = queue.current.shift();
      if (next) setShape(next);
      else if (performance.now() - lastWordAt.current > FALLBACK_AFTER_MS)
        setShape(FALLBACK_RHYTHM[beat++ % FALLBACK_RHYTHM.length]!);
      else setShape('rest');
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [speaking]);

  return speaking ? shape : 'rest';
}
