import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');

export async function getDbConnection() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  // Enable foreign key constraints on every connection (SQLite PRAGMA is per-connection)
  await db.run('PRAGMA foreign_keys = ON');
  return db;
}

export async function ensureUserExists(db, username) {
  if (!username) return null;
  const userStr = String(username).trim().toLowerCase();
  
  let user = await db.get('SELECT username FROM users WHERE LOWER(username) = ?', [userStr]);
  if (!user) {
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT OR IGNORE INTO users (username, name, email, passwordHash, dob, sex, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userStr, userStr, `${userStr}@app.com`, 'hash_placeholder', '1995-01-01', 'Other', createdAt]
    );
    user = { username: userStr };
  }
  return user.username;
}

export async function initDb() {
  const db = await getDbConnection();

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      name TEXT,
      email TEXT UNIQUE,
      passwordHash TEXT,
      dob TEXT,
      sex TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      goalId TEXT PRIMARY KEY,
      username TEXT COLLATE NOCASE,
      version INTEGER,
      targetSleepHours REAL,
      targetDailyCalories REAL,
      targetActivityMinutes INTEGER,
      targetWeight REAL,
      targetActivities TEXT,
      status TEXT,
      createdAt TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      logId TEXT PRIMARY KEY,
      username TEXT COLLATE NOCASE,
      date TEXT,
      weight REAL,
      height REAL,
      sleepHours REAL,
      moodScore INTEGER,
      energyScore INTEGER,
      createdAt TEXT,
      UNIQUE(username, date),
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meals (
      mealId TEXT PRIMARY KEY,
      logId TEXT,
      username TEXT COLLATE NOCASE,
      textInput TEXT,
      aiEstimates TEXT,
      correctedEstimates TEXT,
      isUserCorrected INTEGER,
      isAiUncertain INTEGER,
      createdAt TEXT,
      FOREIGN KEY (logId) REFERENCES daily_logs(logId) ON DELETE CASCADE,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      activityId TEXT PRIMARY KEY,
      logId TEXT,
      username TEXT COLLATE NOCASE,
      type TEXT,
      durationMinutes INTEGER,
      quantity REAL,
      unit TEXT,
      intensity TEXT,
      createdAt TEXT,
      FOREIGN KEY (logId) REFERENCES daily_logs(logId) ON DELETE CASCADE,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      planId TEXT PRIMARY KEY,
      username TEXT COLLATE NOCASE,
      version INTEGER,
      status TEXT,
      suggestions TEXT,
      createdAt TEXT,
      responseAt TEXT,
      userRejectionReason TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      logId TEXT PRIMARY KEY,
      username TEXT COLLATE NOCASE,
      timestamp TEXT,
      eventType TEXT,
      description TEXT,
      details TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );
  `);

  // Migration: Ensure targetActivities column exists in goals table
  try {
    const goalsTableInfo = await db.all(`PRAGMA table_info(goals)`);
    const hasTargetActivities = goalsTableInfo.some(col => col.name === 'targetActivities');
    if (!hasTargetActivities) {
      await db.exec(`ALTER TABLE goals ADD COLUMN targetActivities TEXT`);
    }
  } catch (err) {
    // Ignore migration error if already exists
  }

  await db.close();
}
