import type { MouthParams } from './lipsync';

export const f = (n: number) => n.toFixed(2);

/** Builds lip and mouth-opening paths around (0, 0) from width, opening and smile. */
export function mouthPaths({ w, h, smile }: MouthParams) {
  const cornerY = -smile;
  const topY = -h * 0.3;
  const bottomY = h * 0.7;
  // Control point that puts a quadratic curve's midpoint at the given y.
  const ctrl = (midY: number) => 2 * midY - cornerY;
  const L = `${f(-w)} ${f(cornerY)}`;
  const R = `${f(w)} ${f(cornerY)}`;
  const upperOuter = topY - 4.6;
  return {
    opening: `M ${L} Q 0 ${f(ctrl(topY))} ${R} Q 0 ${f(ctrl(bottomY))} ${L} Z`,
    seam: `M ${L} Q 0 ${f(ctrl(topY))} ${R}`,
    upperLip:
      `M ${L} C ${f(-w * 0.55)} ${f(upperOuter - 1)} ${f(-w * 0.2)} ${f(upperOuter - 2)} 0 ${f(upperOuter)} ` +
      `C ${f(w * 0.2)} ${f(upperOuter - 2)} ${f(w * 0.55)} ${f(upperOuter - 1)} ${R} Q 0 ${f(ctrl(topY))} ${L} Z`,
    lowerLip: `M ${R} Q 0 ${f(ctrl(bottomY + 6.5))} ${L} Q 0 ${f(ctrl(bottomY))} ${R} Z`,
  };
}
