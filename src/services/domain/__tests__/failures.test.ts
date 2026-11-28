import { describe, expect, it, vi } from 'vitest';
import type { FocusDb } from '../../db';
import { createServices } from '..';
import { emptyLifetimeStats } from '@/features/stats/stats';
import { DEFAULT_SETTINGS } from '@/features/timer/types';

/** A store whose every call fails, as when the database is unavailable. */
function brokenDb(): FocusDb {
  const fail = () => Promise.reject(new Error('database unavailable'));
  const group = () => new Proxy({}, { get: () => fail }) as Record<string, () => Promise<never>>;
  return new Proxy({}, { get: () => group() }) as unknown as FocusDb;
}

describe('domain services when storage fails', () => {
  it('fall back to safe defaults for reads and log the error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const services = createServices(brokenDb());

    expect((await services.settings.load()).settings).toEqual(DEFAULT_SETTINGS);
    expect(await services.history.byDate('2026-03-10')).toBeNull();
    expect((await services.history.today()).sessions).toEqual([]);
    expect(await services.history.forPeriod('2026-03-01', '2026-03-10')).toEqual([]);
    expect(await services.plans.forDate('2026-03-10')).toEqual([]);
    expect(await services.plans.reconcileOrphans()).toEqual([]);
    expect(await services.stats.get()).toEqual(emptyLifetimeStats());
    expect(await services.challenges.list()).toEqual([]);
    expect(await services.challenges.byId('c')).toBeNull();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('let writes fail loudly so callers can report them', async () => {
    const services = createServices(brokenDb());
    await expect(services.plans.save({} as never)).rejects.toThrow('database unavailable');
    await expect(services.settings.save({} as never)).rejects.toThrow('database unavailable');
    await expect(services.challenges.remove('c')).rejects.toThrow('database unavailable');
  });
});
