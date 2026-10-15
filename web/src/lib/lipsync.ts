export type MouthShape = 'rest' | 'closed' | 'open' | 'wide' | 'round';

export interface MouthParams {
  /** Half width of the mouth. */
  w: number;
  /** How far the lips are parted. */
  h: number;
  /** How far the corners lift. */
  smile: number;
}

export const MOUTH_PARAMS: Record<MouthShape, MouthParams> = {
  rest: { w: 17, h: 0, smile: 2.5 },
  closed: { w: 15, h: 0, smile: 0.5 },
  open: { w: 15, h: 11, smile: 1 },
  wide: { w: 20, h: 6, smile: 2 },
  round: { w: 10, h: 9, smile: 0 },
};

/** A rough viseme sequence for a word, good enough for a 2D face. */
export function shapesForWord(word: string): MouthShape[] {
  const shapes: MouthShape[] = [];
  for (const ch of word.toLowerCase()) {
    let shape: MouthShape | undefined;
    if (ch === 'a') shape = 'open';
    else if ('eiy'.includes(ch)) shape = 'wide';
    else if ('ouw'.includes(ch)) shape = 'round';
    else if ('mbp'.includes(ch)) shape = 'closed';
    if (shape && shapes.at(-1) !== shape) shapes.push(shape);
  }
  return shapes.length > 0 ? shapes.slice(0, 6) : ['open'];
}

/** Used when the voice gives no word timing, so the mouth still moves naturally. */
export const FALLBACK_RHYTHM: MouthShape[] = [
  'open',
  'rest',
  'wide',
  'open',
  'round',
  'rest',
  'wide',
  'closed',
];
