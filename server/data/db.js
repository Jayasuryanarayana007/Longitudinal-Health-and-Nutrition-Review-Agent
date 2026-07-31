import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');

export async function getDbConnection() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

export async function initDb() {
  const db = await getDbConnection();
  
  // Enable foreign keys
  await db.get('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      passwordHash TEXT,
      dob TEXT,
      sex TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      goalId TEXT PRIMARY KEY,
      username TEXT,
      version INTEGER,
      targetSleepHours REAL,
      targetDailyCalories REAL,
      targetActivityMinutes INTEGER,
      status TEXT,
      createdAt TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      logId TEXT PRIMARY KEY,
      username TEXT,
      date TEXT,
      weight REAL,
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
      username TEXT,
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
      username TEXT,
      type TEXT,
      durationMinutes INTEGER,
      intensity TEXT,
      createdAt TEXT,
      FOREIGN KEY (logId) REFERENCES daily_logs(logId) ON DELETE CASCADE,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      planId TEXT PRIMARY KEY,
      username TEXT,
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
      username TEXT,
      timestamp TEXT,
      eventType TEXT,
      description TEXT,
      details TEXT,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );
  `);
  
  console.log('Database tables initialized successfully.');
  await db.close();
}
