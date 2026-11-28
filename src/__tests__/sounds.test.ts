import { describe, expect, it } from 'vitest';
import { SOUND_OPTIONS, renderSound } from '@/services/sounds';

const RATE = 44100;
const peak = (s: Float32Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('renderSound', () => {
  const selectable = [...SOUND_OPTIONS.sessionComplete, ...SOUND_OPTIONS.breakComplete].map((o) => o.value);

  it.each([...new Set([...selectable, 'tick'])])('renders "%s" as audible, unclipped audio', (name) => {
    const samples = renderSound(name, RATE);
    expect(samples.length).toBeGreaterThan(RATE * 0.02);
    expect(peak(samples)).toBeCloseTo(0.5, 5);
    expect(samples.every(Number.isFinite)).toBe(true);
  });

  it('gives every selectable option a distinct sound', () => {
    const rendered = [...new Set(selectable)].map((n) => Array.from(renderSound(n, RATE).slice(0, 4000)).join());
    expect(new Set(rendered).size).toBe(rendered.length);
  });

  it('keeps the tick short and the bells long', () => {
    expect(renderSound('tick', RATE).length / RATE).toBeLessThan(0.05);
    expect(renderSound('break', RATE).length / RATE).toBeGreaterThan(1);
  });

  it('falls back to the default sound for unknown names', () => {
    expect(renderSound('no-such-sound', RATE)).toEqual(renderSound('default', RATE));
  });

  it('starts and ends near silence (no clicks)', () => {
    for (const name of ['default', 'chime', 'tick']) {
      const s = renderSound(name, RATE);
      expect(Math.abs(s[0])).toBeLessThan(0.01);
      expect(Math.abs(s[s.length - 1])).toBeLessThan(0.01);
    }
  });
});
