import type Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('focus','shortBreak','longBreak')),
      session_number INTEGER NOT NULL,
      planned_duration INTEGER NOT NULL,
      actual_duration INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      paused_time INTEGER NOT NULL DEFAULT 0,
      completion_status TEXT NOT NULL CHECK(completion_status IN ('completed','interrupted','skipped')),
      remaining_time INTEGER NOT NULL DEFAULT 0,
      plan_id TEXT,
      created_date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_created_date ON sessions(created_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_sessions_plan_id ON sessions(plan_id);

    CREATE TABLE IF NOT EXISTS daily_history (
      date TEXT PRIMARY KEY NOT NULL,
      total_focus_time INTEGER NOT NULL DEFAULT 0,
      total_break_time INTEGER NOT NULL DEFAULT 0,
      completed_sessions INTEGER NOT NULL DEFAULT 0,
      interrupted_sessions INTEGER NOT NULL DEFAULT 0,
      skipped_sessions INTEGER NOT NULL DEFAULT 0,
      average_session_length REAL NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      day_start_time INTEGER,
      day_end_time INTEGER,
      session_plan_ids TEXT NOT NULL DEFAULT '[]',
      total_planned_time INTEGER NOT NULL DEFAULT 0,
      total_actual_time INTEGER NOT NULL DEFAULT 0,
      completion_rate REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_plans (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','completed','interrupted','abandoned')),
      current_segment_index INTEGER NOT NULL DEFAULT -1,
      settings TEXT NOT NULL,
      expected_end_time INTEGER NOT NULL,
      actual_end_time INTEGER,
      interrupted_at INTEGER,
      total_planned_duration INTEGER NOT NULL,
      total_elapsed INTEGER NOT NULL DEFAULT 0,
      last_updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_plans_created_at ON session_plans(created_at);
    CREATE INDEX IF NOT EXISTS idx_session_plans_status ON session_plans(status);

    CREATE TABLE IF NOT EXISTS plan_segments (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL REFERENCES session_plans(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('focus','shortBreak','longBreak')),
      planned_duration INTEGER NOT NULL,
      actual_duration INTEGER,
      expected_start_time INTEGER NOT NULL,
      expected_end_time INTEGER NOT NULL,
      actual_start_time INTEGER,
      actual_end_time INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped','interrupted')),
      paused_time INTEGER NOT NULL DEFAULT 0,
      elapsed_at_last_update INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_plan_segments_plan_id ON plan_segments(plan_id);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      user_agent TEXT,
      app_version TEXT,
      session_context TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp);

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','completed','failed','paused')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_days INTEGER NOT NULL DEFAULT 0,
      failed_days INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS challenge_days (
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','skipped')),
      note TEXT,
      marked_at TEXT,
      PRIMARY KEY (challenge_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_challenge_days_challenge ON challenge_days(challenge_id);

    CREATE TABLE IF NOT EXISTS active_snapshot (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      plan TEXT NOT NULL,
      last_updated INTEGER NOT NULL
    );
  `);
}
