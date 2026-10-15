export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Speaking wins over thinking, which wins over hearing the user. */
export function deriveAvatarState(input: {
  active: boolean;
  speaking: boolean;
  thinking: boolean;
  hearing: boolean;
}): AvatarState {
  if (input.speaking) return 'speaking';
  if (!input.active) return 'idle';
  if (input.thinking) return 'thinking';
  if (input.hearing) return 'listening';
  return 'idle';
}
