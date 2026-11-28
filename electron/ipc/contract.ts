/**
 * The IPC contract between the main process, the preload bridge and the
 * renderer: every channel with its argument tuple and resolved value, plus the
 * `window.electronAPI` shape derived from them. Type-only, so the sandboxed
 * preload and the renderer pull in no runtime code from here.
 *
 * Changing a payload here fails compilation wherever the channel is handled
 * (electron/main), exposed (electron/preload) or called (src/).
 */
import type {
  AppState,
  Challenge,
  DailyHistory,
  LifetimeStats,
  SessionPlan,
  SessionRecord,
} from '../../src/features/timer/types';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type PlanUpdate = Partial<Omit<SessionPlan, 'id'>>;

export interface PlanSnapshot {
  plan: SessionPlan;
  lastUpdated: number;
}

/** Documents kept in the key-value store, by key. */
export interface KvValues {
  app_state: AppState;
  lifetime_stats: LifetimeStats;
}
export type KvKey = keyof KvValues;

/** A key together with its value, as `db:kv:set` receives it. */
export type KvEntry = { [K in KvKey]: [key: K, value: KvValues[K]] }[KvKey];

export interface SessionNotificationPayload {
  title: string;
  body: string;
}

/** Request/response channels (`ipcRenderer.invoke` → `ipcMain.handle`). */
export interface InvokeChannels {
  // Window and tray
  'minimize-to-tray': { args: []; result: void };
  'show-window': { args: []; result: void };
  'update-tray-status': { args: [status: string]; result: void };
  'session-notification': { args: [notification: SessionNotificationPayload]; result: void };
  'app:reportProblem': { args: []; result: void };

  // Sessions
  'db:sessions:save': { args: [session: SessionRecord]; result: void };
  'db:sessions:getByDate': { args: [date: string]; result: SessionRecord[] };
  'db:sessions:getHistory': { args: [limit?: number]; result: SessionRecord[] };
  'db:sessions:delete': { args: [id: string]; result: void };

  // Session plans
  'db:plans:save': { args: [plan: SessionPlan]; result: void };
  'db:plans:get': { args: [id: string]; result: SessionPlan | null };
  'db:plans:getByDate': { args: [date: string]; result: SessionPlan[] };
  'db:plans:getByDateRange': { args: [start: string, end: string]; result: SessionPlan[] };
  'db:plans:update': { args: [id: string, updates: PlanUpdate]; result: SessionPlan | null };

  // Daily history
  'db:history:save': { args: [history: DailyHistory]; result: void };
  'db:history:getByDate': { args: [date: string]; result: DailyHistory | null };
  'db:history:getByRange': { args: [start: string, end: string]; result: DailyHistory[] };
  'db:history:getAllDates': { args: []; result: string[] };
  'db:history:clearToday': { args: [date: string]; result: void };
  'db:history:resetAll': { args: []; result: void };

  // Challenges
  'db:challenges:getAll': { args: []; result: Challenge[] };
  'db:challenges:getById': { args: [id: string]; result: Challenge | null };
  'db:challenges:save': { args: [challenge: Challenge]; result: void };
  'db:challenges:delete': { args: [id: string]; result: void };

  // Key-value documents
  'db:kv:get': { args: [key: KvKey]; result: KvValues[KvKey] | null };
  'db:kv:set': { args: KvEntry; result: void };

  // Active plan snapshot (crash recovery)
  'db:snapshot:save': { args: [plan: SessionPlan]; result: void };
  'db:snapshot:load': { args: []; result: PlanSnapshot | null };
  'db:snapshot:clear': { args: []; result: void };
}

export type InvokeChannel = keyof InvokeChannels;
export type InvokeArgs<C extends InvokeChannel> = InvokeChannels[C]['args'];
export type InvokeResult<C extends InvokeChannel> = InvokeChannels[C]['result'];

/** Fire-and-forget channels (`ipcRenderer.send` → `ipcMain.on`). */
export interface SendChannels {
  'log:write': [level: LogLevel, scope: string, args: unknown[]];
}

/** Events pushed from main to the renderer (`webContents.send`). */
export type EventChannel =
  | 'tray-start-session'
  | 'tray-open-settings'
  | 'tray-open-history'
  | 'global-shortcut-start-session';

type Invoker<C extends InvokeChannel> = (...args: InvokeArgs<C>) => Promise<InvokeResult<C>>;
type Unsubscribe = () => void;
type Subscriber = (callback: () => void) => Unsubscribe;

/** The API the preload exposes as `window.electronAPI`. */
export interface ElectronAPI {
  log: (...args: SendChannels['log:write']) => void;

  minimizeToTray: Invoker<'minimize-to-tray'>;
  showWindow: Invoker<'show-window'>;
  updateTrayStatus: Invoker<'update-tray-status'>;
  sessionNotification: Invoker<'session-notification'>;
  reportProblem: Invoker<'app:reportProblem'>;

  onTrayStartSession: Subscriber;
  onTrayOpenSettings: Subscriber;
  onTrayOpenHistory: Subscriber;
  onGlobalShortcutStartSession: Subscriber;

  db: {
    sessions: {
      save: Invoker<'db:sessions:save'>;
      getByDate: Invoker<'db:sessions:getByDate'>;
      getHistory: Invoker<'db:sessions:getHistory'>;
      delete: Invoker<'db:sessions:delete'>;
    };
    plans: {
      save: Invoker<'db:plans:save'>;
      get: Invoker<'db:plans:get'>;
      getByDate: Invoker<'db:plans:getByDate'>;
      getByDateRange: Invoker<'db:plans:getByDateRange'>;
      update: Invoker<'db:plans:update'>;
    };
    history: {
      save: Invoker<'db:history:save'>;
      getByDate: Invoker<'db:history:getByDate'>;
      getByRange: Invoker<'db:history:getByRange'>;
      getAllDates: Invoker<'db:history:getAllDates'>;
      clearToday: Invoker<'db:history:clearToday'>;
      resetAll: Invoker<'db:history:resetAll'>;
    };
    challenges: {
      getAll: Invoker<'db:challenges:getAll'>;
      getById: Invoker<'db:challenges:getById'>;
      save: Invoker<'db:challenges:save'>;
      delete: Invoker<'db:challenges:delete'>;
    };
    kv: {
      get: <K extends KvKey>(key: K) => Promise<KvValues[K] | null>;
      set: <K extends KvKey>(key: K, value: KvValues[K]) => Promise<void>;
    };
    snapshot: {
      save: Invoker<'db:snapshot:save'>;
      load: Invoker<'db:snapshot:load'>;
      clear: Invoker<'db:snapshot:clear'>;
    };
  };
}
