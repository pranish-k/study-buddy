import { useEffect, useRef, useState } from 'react';
import type { AvatarState } from '../lib/avatar-state';
import { MOUTH_PARAMS, type MouthParams, type MouthShape } from '../lib/lipsync';
import { f, mouthPaths } from '../lib/mouth-paths';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Random blinks every few seconds, with the occasional double blink. */
function useBlink(): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const blink = (count: number) => {
      setClosed(true);
      timer = setTimeout(() => {
        setClosed(false);
        if (count > 1) timer = setTimeout(() => blink(count - 1), 140);
        else schedule();
      }, 120);
    };
    const schedule = () => {
      timer = setTimeout(() => blink(Math.random() < 0.15 ? 2 : 1), 2200 + Math.random() * 3800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return closed;
}

/** Where the eyes look. Idle eyes drift a little; listening eyes hold your gaze; thinking eyes look up. */
function useGaze(state: AvatarState): { x: number; y: number } {
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (prefersReducedMotion() || state === 'listening' || state === 'thinking') return;
    const range = state === 'speaking' ? 1 : 2.2;
    let timer: ReturnType<typeof setTimeout>;
    const move = () => {
      setDrift(
        Math.random() < 0.45
          ? { x: 0, y: 0 }
          : { x: (Math.random() * 2 - 1) * range, y: (Math.random() * 2 - 1) * range * 0.5 },
      );
      timer = setTimeout(move, 1400 + Math.random() * 2600);
    };
    timer = setTimeout(move, 1000);
    return () => clearTimeout(timer);
  }, [state]);
  if (state === 'thinking') return { x: 3.2, y: -2.8 };
  if (state === 'listening') return { x: 0, y: 0 };
  return drift;
}

/** Eases the mouth toward its target shape every frame, so shape changes look like motion. */
function useAnimatedMouth(target: MouthParams): MouthParams {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);
  const reduced = prefersReducedMotion();
  useEffect(() => {
    if (reduced) {
      currentRef.current = target;
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - last) / 55);
      last = now;
      const c = currentRef.current;
      const next = {
        w: c.w + (target.w - c.w) * k,
        h: c.h + (target.h - c.h) * k,
        smile: c.smile + (target.smile - c.smile) * k,
      };
      currentRef.current = next;
      setCurrent(next);
      const settled =
        Math.abs(next.w - target.w) < 0.05 &&
        Math.abs(next.h - target.h) < 0.05 &&
        Math.abs(next.smile - target.smile) < 0.05;
      if (!settled) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return reduced ? target : current;
}

const EYE_SHAPE = 'M -16 0 C -10 -9.5 10 -9.5 16 0 C 10 6.5 -10 6.5 -16 0 Z';

function Eye({
  cx,
  gaze,
  closed,
  side,
}: {
  cx: number;
  gaze: { x: number; y: number };
  closed: boolean;
  side: 'l' | 'r';
}) {
  const clipId = `nova-eye-${side}`;
  return (
    <g transform={`translate(${cx} 178)`}>
      {closed ? (
        <path
          d="M -16 1 C -8 6 8 6 16 1"
          fill="none"
          stroke="#3a2620"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ) : (
        <>
          <clipPath id={clipId}>
            <path d={EYE_SHAPE} />
          </clipPath>
          <path d={EYE_SHAPE} fill="#f6f1eb" />
          <g clipPath={`url(#${clipId})`}>
            {/* Shadow cast by the upper lid keeps the eye from looking flat. */}
            <path d="M -17 -10 H 17 V -2 C 8 -6 -8 -6 -17 -2 Z" fill="#c9a08a" opacity={0.35} />
            <g transform={`translate(${f(gaze.x)} ${f(gaze.y)})`}>
              <circle r={7.4} fill="url(#nova-iris)" />
              <circle r={7.4} fill="none" stroke="#2a1b12" strokeWidth={0.9} opacity={0.6} />
              <circle r={3.3} fill="#160e0a" />
              <circle cx={-2.3} cy={-2.6} r={1.7} fill="#fff" opacity={0.9} />
              <circle cx={2.4} cy={2.1} r={0.8} fill="#fff" opacity={0.5} />
            </g>
          </g>
          <path
            d="M -17.5 1 C -11 -10.5 11 -10.5 17.5 -1"
            fill="none"
            stroke="#2c1c16"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <path
            d="M -13 4.6 C -5 7.6 6 7.6 13 3.6"
            fill="none"
            stroke="#9b6a55"
            strokeWidth={1}
            opacity={0.45}
            strokeLinecap="round"
          />
        </>
      )}
      <path
        d="M -14 -9.5 C -6 -15.5 8 -15.5 15.5 -8.5"
        fill="none"
        stroke="#a8735c"
        strokeWidth={1.2}
        opacity={0.5}
        strokeLinecap="round"
      />
    </g>
  );
}

function Brow({ side, lift }: { side: 'l' | 'r'; lift: number }) {
  const d = 'M 156 162 C 164 152.5 179 150 192 154.5 L 191 158 C 179 155 166 157 158 164.5 Z';
  return (
    <path
      d={d}
      fill="#3b2820"
      transform={`${side === 'r' ? 'translate(400 0) scale(-1 1) ' : ''}translate(0 ${f(-lift)})`}
      style={{ transition: 'transform 300ms ease' }}
    />
  );
}

export function NovaFace({ state, mouth }: { state: AvatarState; mouth: MouthShape }) {
  const blinking = useBlink();
  const gaze = useGaze(state);
  const params = useAnimatedMouth(MOUTH_PARAMS[mouth]);
  const lips = mouthPaths(params);
  const browLift = state === 'thinking' ? 3 : state === 'listening' ? 1.6 : 0;
  const teethVisible = params.h > 3.5;

  return (
    <svg className="nova" viewBox="0 0 400 400" role="img" aria-label="Nova, your study companion">
      <defs>
        <radialGradient id="nova-skin" cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#f5cfb2" />
          <stop offset="0.62" stopColor="#e7b391" />
          <stop offset="1" stopColor="#cf9273" />
        </radialGradient>
        <linearGradient id="nova-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b97e61" />
          <stop offset="0.45" stopColor="#d9a283" />
          <stop offset="1" stopColor="#e2ad8e" />
        </linearGradient>
        <linearGradient id="nova-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3226" />
          <stop offset="1" stopColor="#24160f" />
        </linearGradient>
        <linearGradient id="nova-hair-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a3d2e" />
          <stop offset="1" stopColor="#2e1d15" />
        </linearGradient>
        <radialGradient id="nova-iris" cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#9a7448" />
          <stop offset="0.6" stopColor="#6a4a2c" />
          <stop offset="1" stopColor="#3a2716" />
        </radialGradient>
        <linearGradient id="nova-sweater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d7f86" />
          <stop offset="1" stopColor="#2f565c" />
        </linearGradient>
        <radialGradient id="nova-blush" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e9877a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#e9877a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="nova-mouth-clip">
          <path d={lips.opening} />
        </clipPath>
      </defs>

      <g className="nova-body">
        {/* Hair behind the head and shoulders */}
        <path
          d="M 200 74 C 130 74 104 128 108 188 C 111 238 110 270 120 298 C 134 310 158 306 168 292 L 232 292 C 242 306 266 310 280 298 C 290 270 289 238 292 188 C 296 128 270 74 200 74 Z"
          fill="url(#nova-hair)"
        />
        <path
          d="M 66 400 C 68 342 106 306 164 293 Q 200 326 236 293 C 294 306 332 342 334 400 Z"
          fill="url(#nova-sweater)"
        />
        <path
          d="M 164 293 Q 200 326 236 293"
          fill="none"
          stroke="#28484d"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d="M 120 352 C 130 372 132 388 132 400 M 280 352 C 270 372 268 388 268 400"
          stroke="#2b4f55"
          strokeWidth={2}
          opacity={0.5}
          fill="none"
        />
        <path d="M 178 236 L 178 296 Q 200 322 222 296 L 222 236 Z" fill="url(#nova-neck)" />

        <g className="nova-head">
          <ellipse cx={132} cy={184} rx={9} ry={17} fill="#d99c7c" />
          <ellipse cx={268} cy={184} rx={9} ry={17} fill="#d99c7c" />
          <path
            d="M 131 176 C 128 182 129 190 133 194"
            fill="none"
            stroke="#b47a5e"
            strokeWidth={1.5}
            opacity={0.6}
          />
          <path
            d="M 269 176 C 272 182 271 190 267 194"
            fill="none"
            stroke="#b47a5e"
            strokeWidth={1.5}
            opacity={0.6}
          />
          <path
            d="M 200 90 C 246 90 268 124 268 168 C 268 206 255 233 236 249 C 222 261 212 267 200 267 C 188 267 178 261 164 249 C 145 233 132 206 132 168 C 132 124 154 90 200 90 Z"
            fill="url(#nova-skin)"
          />
          {/* Soft jaw shadow */}
          <path
            d="M 150 228 C 164 252 182 266 200 267 C 218 266 236 252 250 228 C 236 258 218 272 200 272 C 182 272 164 258 150 228 Z"
            fill="#b8795d"
            opacity={0.35}
          />

          <ellipse cx={160} cy={214} rx={17} ry={10} fill="url(#nova-blush)" />
          <ellipse cx={240} cy={214} rx={17} ry={10} fill="url(#nova-blush)" />

          <Eye cx={175} gaze={gaze} closed={blinking} side="l" />
          <Eye cx={225} gaze={gaze} closed={blinking} side="r" />
          <Brow side="l" lift={browLift} />
          <Brow side="r" lift={browLift} />

          {/* Nose */}
          <path
            d="M 196 184 C 195 198 191 209 189 216"
            fill="none"
            stroke="#b07457"
            strokeWidth={1.4}
            opacity={0.35}
            strokeLinecap="round"
          />
          <path
            d="M 189 219 C 193 225.5 207 225.5 211 219"
            fill="none"
            stroke="#a96d52"
            strokeWidth={1.9}
            opacity={0.6}
            strokeLinecap="round"
          />
          <ellipse cx={194} cy={221.5} rx={2.4} ry={1.3} fill="#8f5642" opacity={0.4} />
          <ellipse cx={206} cy={221.5} rx={2.4} ry={1.3} fill="#8f5642" opacity={0.4} />
          <ellipse cx={201} cy={208} rx={2.5} ry={6} fill="#fbe0cb" opacity={0.35} />

          {/* Mouth */}
          <g transform="translate(200 242)" data-testid="nova-mouth">
            <path d={lips.opening} fill="#5a2a2a" />
            {teethVisible && (
              <g clipPath="url(#nova-mouth-clip)">
                <rect
                  x={-params.w}
                  y={-params.h * 0.3 - params.smile - 2}
                  width={params.w * 2}
                  height={Math.min(params.h * 0.45, 4.6) + 2}
                  fill="#f3ede6"
                />
                <ellipse
                  cx={0}
                  cy={params.h * 0.75}
                  rx={params.w * 0.55}
                  ry={params.h * 0.35}
                  fill="#b75a5c"
                />
              </g>
            )}
            <path d={lips.upperLip} fill="#bc6a60" />
            <path d={lips.lowerLip} fill="#cd7a6f" />
            <path
              d={lips.seam}
              fill="none"
              stroke="#7d3c37"
              strokeWidth={1.3}
              strokeLinecap="round"
            />
            <ellipse
              cx={0}
              cy={params.h * 0.7 + 3.4}
              rx={params.w * 0.35}
              ry={1.2}
              fill="#f2b3a6"
              opacity={0.55}
            />
          </g>

          {/* Hair in front: a soft side part with locks framing the face */}
          <path
            d="M 178 88 C 158 94 140 116 134 150 C 132 162 132 172 133 184 C 139 160 151 140 168 128 C 175 116 178 102 178 88 Z"
            fill="url(#nova-hair-front)"
          />
          <path
            d="M 176 88 C 212 80 256 96 266 140 C 269 154 269 168 268 182 C 261 160 247 142 228 132 C 206 122 188 110 176 88 Z"
            fill="url(#nova-hair-front)"
          />
          <path
            d="M 133 172 C 127 212 130 252 141 282 C 145 262 143 220 140 178 Z"
            fill="url(#nova-hair-front)"
          />
          <path
            d="M 267 172 C 273 212 270 252 259 282 C 255 262 257 220 260 178 Z"
            fill="url(#nova-hair-front)"
          />
          <path
            d="M 186 94 C 212 98 240 114 256 146 M 182 102 C 200 114 222 124 244 134 M 172 98 C 156 110 144 128 138 152"
            fill="none"
            stroke="#7a5442"
            strokeWidth={1.3}
            opacity={0.4}
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
