/**
 * One-time import of the JSON files written by pre-SQLite versions.
 * Schema migrations live in migrationRunner.ts.
 */
import type Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { createLogger } from '../logger';

const log = createLogger('migrations');

export function migrateLegacyData(db: Database.Database): void {
  // Check if already migrated
  const status = db.prepare("SELECT value FROM kv_store WHERE key = 'migration_status'").get() as
    { value: string } | undefined;

  if (status) {
    const parsed = JSON.parse(status.value);
    if (parsed.completed) return;
  }

  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');

  if (!fs.existsSync(dataDir)) {
    // No legacy data to migrate, mark as done
    db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'migration_status',
      JSON.stringify({ completed: true, timestamp: Date.now(), source: 'no_legacy_data' }),
      Date.now(),
    );
    return;
  }

  log.info('Starting legacy data migration from JSON files...');

  const readJsonFile = (filePath: string): string | null => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  };

  db.transaction(() => {
    // 1. Migrate AppState
    const appStateRaw = readJsonFile(path.join(dataDir, 'focus_sessions_app_state.json'));
    if (appStateRaw) {
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
        'app_state',
        appStateRaw,
        Date.now(),
      );
    }

    // 2. Migrate sessions
    const sessionsRaw = readJsonFile(path.join(dataDir, 'focus_sessions_sessions.json'));
    if (sessionsRaw) {
      const sessions = JSON.parse(sessionsRaw);
      const insertSession = db.prepare(`
        INSERT OR IGNORE INTO sessions (id, type, session_number, planned_duration, actual_duration,
          start_time, end_time, paused_time, completion_status, remaining_time, plan_id, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of sessions) {
        const typeMap: Record<string, string> = {
          FOCUS: 'focus',
          SHORT_BREAK: 'shortBreak',
          LONG_BREAK: 'longBreak',
        };
        const statusMap: Record<string, string> = {
          COMPLETED: 'completed',
          INTERRUPTED: 'interrupted',
          SKIPPED: 'skipped',
        };
        const startDate = new Date(s.startTime).toISOString().split('T')[0];
        insertSession.run(
          s.id,
          typeMap[s.type] || s.type || 'focus',
          s.sessionNumber || 0,
          s.plannedDuration || 0,
          s.actualDuration || 0,
          new Date(s.startTime).toISOString(),
          s.endTime ? new Date(s.endTime).toISOString() : null,
          s.pausedTime || 0,
          statusMap[s.completionStatus] || s.completionStatus || 'completed',
          s.remainingTime || 0,
          null,
          startDate,
        );
      }
    }

    // 3. Migrate daily history
    const historyRaw = readJsonFile(path.join(dataDir, 'focus_sessions_daily_history.json'));
    if (historyRaw) {
      const histories = JSON.parse(historyRaw);
      const insertHistory = db.prepare(`
        INSERT OR IGNORE INTO daily_history (date, total_focus_time, total_break_time, completed_sessions,
          interrupted_sessions, skipped_sessions, average_session_length, longest_streak,
          created_at, updated_at, day_start_time, day_end_time, session_plan_ids,
          total_planned_time, total_actual_time, completion_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const h of histories) {
        insertHistory.run(
          h.date,
          h.totalFocusTime || 0,
          h.totalBreakTime || 0,
          h.completedSessions || 0,
          h.interruptedSessions || 0,
          h.skippedSessions || 0,
          h.averageSessionLength || 0,
          h.longestStreak || 0,
          new Date(h.createdAt).toISOString(),
          new Date(h.updatedAt).toISOString(),
          h.dayStartTime || null,
          h.dayEndTime || null,
          JSON.stringify(h.sessionPlanIds || []),
          h.totalPlannedTime || 0,
          h.totalActualTime || 0,
          h.completionRate || 0,
        );
      }
    }

    // 4. Migrate plans + segments
    const plansRaw = readJsonFile(path.join(dataDir, 'focus_sessions_plans.json'));
    if (plansRaw) {
      const plans = JSON.parse(plansRaw);
      const insertPlan = db.prepare(`
        INSERT OR IGNORE INTO session_plans (id, created_at, status, current_segment_index, settings,
          expected_end_time, actual_end_time, interrupted_at, total_planned_duration, total_elapsed, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSegment = db.prepare(`
        INSERT OR IGNORE INTO plan_segments (id, plan_id, idx, type, planned_duration, actual_duration,
          expected_start_time, expected_end_time, actual_start_time, actual_end_time, status, paused_time, elapsed_at_last_update)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const typeMap: Record<string, string> = {
        FOCUS: 'focus',
        SHORT_BREAK: 'shortBreak',
        LONG_BREAK: 'longBreak',
      };

      for (const p of plans) {
        insertPlan.run(
          p.id,
          p.createdAt,
          p.status,
          p.currentSegmentIndex,
          JSON.stringify(p.settings),
          p.expectedEndTime,
          p.actualEndTime || null,
          p.interruptedAt || null,
          p.totalPlannedDuration,
          p.totalElapsed,
          p.lastUpdated,
        );
        if (p.segments) {
          for (const seg of p.segments) {
            insertSegment.run(
              seg.id,
              p.id,
              seg.index,
              typeMap[seg.type] || seg.type || 'focus',
              seg.plannedDuration,
              seg.actualDuration || null,
              seg.expectedStartTime,
              seg.expectedEndTime,
              seg.actualStartTime || null,
              seg.actualEndTime || null,
              seg.status || 'pending',
              seg.pausedTime || 0,
              seg.elapsedAtLastUpdate || 0,
            );
          }
        }
      }
    }

    // 5. Migrate challenges + days
    const challengesRaw = readJsonFile(path.join(dataDir, 'focus_sessions_challenges.json'));
    if (challengesRaw) {
      const challenges = JSON.parse(challengesRaw);
      const insertChallenge = db.prepare(`
        INSERT OR IGNORE INTO challenges (id, name, description, start_date, end_date, duration_days,
          status, created_at, updated_at, completed_days, failed_days, current_streak, longest_streak)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertDay = db.prepare(`
        INSERT OR IGNORE INTO challenge_days (challenge_id, date, status, note, marked_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const c of challenges) {
        insertChallenge.run(
          c.id,
          c.name,
          c.description || null,
          c.startDate,
          c.endDate,
          c.durationDays,
          c.status,
          new Date(c.createdAt).toISOString(),
          new Date(c.updatedAt).toISOString(),
          c.completedDays || 0,
          c.failedDays || 0,
          c.currentStreak || 0,
          c.longestStreak || 0,
        );
        if (c.days) {
          for (const d of c.days) {
            insertDay.run(
              c.id,
              d.date,
              d.status || 'pending',
              d.note || null,
              d.markedAt ? new Date(d.markedAt).toISOString() : null,
            );
          }
        }
      }
    }

    // Feedback (focus_sessions_feedback.json) is no longer imported: the feature was removed (ADR 0007)

    // 7. Migrate lifetime stats
    const statsRaw = readJsonFile(path.join(dataDir, 'focus_sessions_lifetime_stats.json'));
    if (statsRaw) {
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
        'lifetime_stats',
        statsRaw,
        Date.now(),
      );
    }

    // Mark migration complete
    db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'migration_status',
      JSON.stringify({
        completed: true,
        timestamp: Date.now(),
        source: 'legacy_json_files',
      }),
      Date.now(),
    );
  })();

  // Rename legacy data directory (preserve as backup)
  const backupDir = path.join(userDataPath, 'data_backup_pre_sqlite');
  try {
    if (!fs.existsSync(backupDir)) {
      fs.renameSync(dataDir, backupDir);
      log.info('Legacy data migrated and backed up to:', backupDir);
    }
  } catch (err) {
    log.warn('Could not rename legacy data dir (non-critical):', err);
  }
}
