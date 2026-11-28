import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorageService } from '../storage';

describe('createStorageService (browser fallback)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips JSON through localStorage', async () => {
    const store = createStorageService<{ n: number }>('test_key');
    expect(await store.load()).toBeNull();

    await store.save({ n: 3 });
    expect(localStorage.getItem('test_key')).toBe('{"n":3}');
    expect(await store.load()).toEqual({ n: 3 });

    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('returns null for corrupt data instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('broken', '{not json');
    expect(await createStorageService('broken').load()).toBeNull();
  });
});
