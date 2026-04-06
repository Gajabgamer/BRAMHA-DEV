import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'bugpredictor.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    code TEXT,
    risk_score INTEGER,
    status TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY,
    profile_name TEXT,
    profile_email TEXT,
    profile_bio TEXT,
    two_factor BOOLEAN,
    biometric BOOLEAN,
    session_timeout TEXT,
    api_keys TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    endpoint TEXT,
    status INTEGER,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read_status BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: Check if endpoint column exists in logs
const logsInfo = db.prepare("PRAGMA table_info(logs)").all() as any[];
if (!logsInfo.find(col => col.name === 'endpoint')) {
  db.exec("ALTER TABLE logs ADD COLUMN endpoint TEXT");
  db.exec("ALTER TABLE logs ADD COLUMN status INTEGER");
}

// Check if user_id column exists in analyses (for migration)
const analysesInfo = db.prepare("PRAGMA table_info(analyses)").all() as any[];
if (!analysesInfo.find(col => col.name === 'user_id')) {
  db.exec("ALTER TABLE analyses ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
}

export default db;
