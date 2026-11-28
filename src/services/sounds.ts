/**
 * Notification sounds, synthesized in code rather than shipped as audio files:
 * no licensing, no asset loading, identical in dev and the packaged app.
 *
 * `renderSound` is pure (sample rate in, PCM samples out) so it can be unit
 * tested without an AudioContext.
 */

export const SOUND_OPTIONS = {
  sessionComplete: [
    { value: 'default', label: 'Default' },
    { value: 'complete', label: 'Achievement' },
    { value: 'chime', label: 'Chime' },
  ],
  breakComplete: [
    { value: 'default', label: 'Default' },
    { value: 'break', label: 'Gentle Bell' },
    { value: 'soft', label: 'Soft Chime' },
  ],
} as const;

export type SoundName = 'default' | 'complete' | 'chime' | 'break' | 'soft' | 'tick';

interface Note {
  /** Fundamental frequency in Hz */
  freq: number;
  /** Start offset in seconds */
  at: number;
  /** Length in seconds */
  dur: number;
  /** Peak amplitude before normalization */
  amp?: number;
  /** Exponential decay rate (1/s); higher is shorter */
  decay?: number;
  /** Attack time in seconds */
  attack?: number;
  /** Overtones as [frequency ratio, relative amplitude] */
  partials?: [number, number][];
}

const BELL: [number, number][] = [[1, 1], [2, 0.5], [2.76, 0.35], [5.4, 0.15]];
const SOFT: [number, number][] = [[1, 1], [2, 0.15]];
const PURE: [number, number][] = [[1, 1]];

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, E6 = 1318.51;

const RECIPES: Record<SoundName, Note[]> = {
  // Two-note ping
  default: [
    { freq: A5, at: 0, dur: 0.25, decay: 14, partials: SOFT },
    { freq: E6, at: 0.12, dur: 0.35, decay: 10, partials: SOFT },
  ],
  // Rising C-major arpeggio, last note rings
  complete: [
    { freq: C5, at: 0, dur: 0.25, decay: 12, partials: SOFT },
    { freq: E5, at: 0.11, dur: 0.25, decay: 12, partials: SOFT },
    { freq: G5, at: 0.22, dur: 0.25, decay: 12, partials: SOFT },
    { freq: C6, at: 0.33, dur: 0.8, decay: 4, partials: SOFT },
  ],
  // Single bright bell strike
  chime: [{ freq: G5, at: 0, dur: 1.4, decay: 3, partials: BELL }],
  // Low, slowly decaying bell
  break: [{ freq: C5, at: 0, dur: 1.8, decay: 2.2, amp: 0.8, attack: 0.01, partials: BELL }],
  // Two overlapping soft tones with a gentle attack
  soft: [
    { freq: E5, at: 0, dur: 1.2, decay: 3, attack: 0.04, partials: SOFT },
    { freq: B5, at: 0.15, dur: 1.1, decay: 3, attack: 0.04, amp: 0.7, partials: SOFT },
  ],
  // Short click
  tick: [{ freq: 2000, at: 0, dur: 0.03, decay: 120, partials: PURE }],
};

const PEAK = 0.5;

export function isSoundName(name: string): name is SoundName {
  return name in RECIPES;
}

/** Render a named sound to mono PCM samples in [-1, 1]. Unknown names render `default`. */
export function renderSound(name: string, sampleRate: number): Float32Array {
  const notes = RECIPES[isSoundName(name) ? name : 'default'];
  const length = Math.ceil(Math.max(...notes.map((n) => n.at + n.dur)) * sampleRate);
  const out = new Float32Array(length);

  for (const { freq, at, dur, amp = 1, decay = 6, attack = 0.005, partials = PURE } of notes) {
    const start = Math.floor(at * sampleRate);
    const count = Math.floor(dur * sampleRate);
    const fadeOut = Math.min(count, Math.floor(0.01 * sampleRate)); // avoid an end click
    for (let i = 0; i < count && start + i < length; i++) {
      const t = i / sampleRate;
      let env = amp * Math.exp(-decay * t) * Math.min(1, t / attack);
      if (i > count - fadeOut) env *= (count - i) / fadeOut;
      let s = 0;
      for (const [ratio, weight] of partials) s += weight * Math.sin(2 * Math.PI * freq * ratio * t);
      out[start + i] += env * s;
    }
  }

  let max = 0;
  for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) for (let i = 0; i < length; i++) out[i] = (out[i] / max) * PEAK;
  return out;
}
