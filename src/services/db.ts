/**
 * The app's data store, as the renderer sees it: the SQLite bridge from the
 * IPC contract (ADR 0002). Outside Electron (unit tests, a plain browser) an
 * in-memory store with the same interface stands in; nothing is persisted.
 */
import type { ElectronAPI, KvKey, KvValues, PlanSnapshot } from '../../electron/ipc/contract';
import type { Challenge, DailyHistory, SessionPlan, SessionRecord } from '@/features/timer/types';
import { createLogger } from '@/services/logger';

export type FocusDb = ElectronAPI['db'];

/** Values cross the IPC boundary by structured clone; the memory store copies the same way. */
const copy = <T>(value: T): T => structuredClone(value);

/** `YYYY-MM-DD` of a session's start, as the sessions table stores it (UTC). */
const sessionDate = (s: SessionRecord) => new Date(s.startTime).toISOString().split('T')[0];

/** Local-time bounds of a date range, as the plans repository queries them. */
const localRange = (start: string, end: string): [number, number] => [
  new Date(`${start}T00:00:00`).getTime(),
  new Date(`${end}T23:59:59.999`).getTime(),
];

/** An in-memory `FocusDb` with the same semantics as the SQLite repositories. */
export function createMemoryDb(): FocusDb {
  const sessions = new Map<string, SessionRecord>();
  const plans = new Map<string, SessionPlan>();
  const histories = new Map<string, DailyHistory>();
  const challenges = new Map<string, Challenge>();
  const kv = new Map<KvKey, unknown>();
  let snapshot: PlanSnapshot | null = null;

  const sessionsOn = (date: string) =>
    [...sessions.values()]
      .filter((s) => sessionDate(s) === date)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const plansBetween = (start: string, end: string) => {
    const [from, to] = localRange(start, end);
    return [...plans.values()]
      .filter((p) => p.createdAt >= from && p.createdAt <= to)
      .sort((a, b) => a.createdAt - b.createdAt);
  };

  // The repository keeps sessions in their own table; stored history has none
  const withoutSessions = (h: DailyHistory): DailyHistory => ({ ...h, sessions: [] });

  return {
    sessions: {
      save: async (s) => void sessions.set(s.id, copy(s)),
      getByDate: async (date) => copy(sessionsOn(date)),
      getHistory: async (limit) => {
        const all = [...sessions.values()].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        );
        return copy(limit === undefined ? all : all.slice(0, limit));
      },
      delete: async (id) => void sessions.delete(id),
    },
    plans: {
      save: async (p) => void plans.set(p.id, copy(p)),
      get: async (id) => copy(plans.get(id) ?? null),
      getByDate: async (date) => copy(plansBetween(date, date)),
      getByDateRange: async (start, end) => copy(plansBetween(start, end)),
      update: async (id, updates) => {
        const existing = plans.get(id);
        if (!existing) return null;
        const merged = { ...existing, ...copy(updates), id, lastUpdated: Date.now() };
        plans.set(id, merged);
        return copy(merged);
      },
    },
    history: {
      save: async (h) => void histories.set(h.date, withoutSessions(copy(h))),
      getByDate: async (date) => copy(histories.get(date) ?? null),
      getByRange: async (start, end) =>
        copy(
          [...histories.values()]
            .filter((h) => h.date >= start && h.date <= end)
            .sort((a, b) => a.date.localeCompare(b.date)),
        ),
      getAllDates: async () => [...histories.keys()].sort((a, b) => b.localeCompare(a)),
      clearToday: async (date) => {
        histories.delete(date);
        for (const s of sessionsOn(date)) sessions.delete(s.id);
      },
      resetAll: async () => {
        sessions.clear();
        histories.clear();
      },
    },
    challenges: {
      getAll: async () =>
        copy(
          [...challenges.values()].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        ),
      getById: async (id) => copy(challenges.get(id) ?? null),
      save: async (c) => void challenges.set(c.id, copy(c)),
      delete: async (id) => void challenges.delete(id),
    },
    kv: {
      get: async <K extends KvKey>(key: K) => copy((kv.get(key) as KvValues[K]) ?? null),
      set: async <K extends KvKey>(key: K, value: KvValues[K]) => void kv.set(key, copy(value)),
    },
    snapshot: {
      save: async (plan) => {
        snapshot = { plan: copy(plan), lastUpdated: Date.now() };
      },
      load: async () => copy(snapshot),
      clear: async () => {
        snapshot = null;
      },
    },
  };
}

/** The SQLite bridge in Electron; an in-memory stand-in anywhere else. */
function resolveDb(): FocusDb {
  const bridge = typeof window !== 'undefined' ? window.electronAPI?.db : undefined;
  if (bridge) return bridge;
  if (import.meta.env.MODE !== 'test') {
    createLogger('db').warn('No Electron bridge: using an in-memory store; nothing is saved.');
  }
  return createMemoryDb();
}

export const db: FocusDb = resolveDb();
