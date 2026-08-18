const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'wordstorm.db');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  DROP TABLE IF EXISTS players;
  DROP TABLE IF EXISTS words;

  CREATE TABLE IF NOT EXISTS players (
    serial TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    disqualified INTEGER DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    struck INTEGER DEFAULT 0
  );
`);

// Prepared statements for players
const countPlayersStmt = db.prepare('SELECT COUNT(*) as count FROM players');
const insertPlayerStmt = db.prepare('INSERT INTO players (serial, name, disqualified, created_at) VALUES (?, ?, 0, ?)');
const getPlayerByNameStmt = db.prepare('SELECT * FROM players WHERE LOWER(name) = LOWER(?)');
const getPlayerBySerialStmt = db.prepare('SELECT * FROM players WHERE serial = ?');
const disqualifyPlayerStmt = db.prepare('UPDATE players SET disqualified = 1 WHERE serial = ?');

// Prepared statements for words
const insertWordStmt = db.prepare('INSERT INTO words (serial, text, timestamp, struck) VALUES (?, ?, ?, 0)');
const insertSystemWordStmt = db.prepare('INSERT INTO words (serial, text, timestamp, struck) VALUES (\'SYSTEM\', ?, ?, 0)');
const strikeWordStmt = db.prepare('UPDATE words SET struck = 1 WHERE id = ?');
const strikeAllWordsBySerialStmt = db.prepare('UPDATE words SET struck = 1 WHERE serial = ?');
const getWordsSinceStmt = db.prepare('SELECT * FROM words WHERE struck = 0 AND timestamp > ? ORDER BY timestamp ASC');
const getAllValidWordsStmt = db.prepare('SELECT * FROM words WHERE struck = 0 ORDER BY timestamp ASC');
const getStruckWordIdsStmt = db.prepare('SELECT id FROM words WHERE struck = 1');

const getLeaderboardStmt = db.prepare(`
  SELECT p.serial, p.name, COUNT(w.id) as count 
  FROM players p 
  LEFT JOIN words w ON p.serial = w.serial AND w.struck = 0 AND w.serial != 'SYSTEM'
  WHERE p.disqualified = 0 
  GROUP BY p.serial 
  ORDER BY count DESC 
  LIMIT 10
`);

const getModeratorFeedStmt = db.prepare(`
  SELECT w.id, w.serial, p.name, w.text, w.timestamp, w.struck 
  FROM words w
  JOIN players p ON w.serial = p.serial
  WHERE w.timestamp > ?
  ORDER BY w.timestamp DESC
  LIMIT 100
`);

const getModeratorFeedAllStmt = db.prepare(`
  SELECT w.id, w.serial, p.name, w.text, w.timestamp, w.struck 
  FROM words w
  JOIN players p ON w.serial = p.serial
  ORDER BY w.timestamp DESC
  LIMIT 100
`);

const getAllPlayersStmt = db.prepare(`
  SELECT p.serial, p.name, p.disqualified, COUNT(w.id) as count
  FROM players p
  LEFT JOIN words w ON p.serial = w.serial AND w.struck = 0 AND w.serial != 'SYSTEM'
  GROUP BY p.serial
  ORDER BY p.created_at DESC
`);

// API methods
function registerPlayer(name) {
  const transaction = db.transaction(() => {
    const existing = getPlayerByNameStmt.get(name);
    if (existing) {
      return { serial: existing.serial, name: existing.name };
    }

    const result = countPlayersStmt.get();
    const nextNumber = result.count + 1;
    const serial = `ARC-${nextNumber.toString().padStart(3, '0')}`;

    insertPlayerStmt.run(serial, name, Date.now());
    return { serial, name };
  });
  return transaction();
}

function insertWord(serial, text) {
  const info = insertWordStmt.run(serial, text, Date.now());
  return { id: info.lastInsertRowid, serial, text };
}

function getWords(since) {
  if (since) {
    return getWordsSinceStmt.all(since);
  }
  return getAllValidWordsStmt.all();
}

function getLeaderboard() {
  return getLeaderboardStmt.all();
}

function strikeWord(id) {
  strikeWordStmt.run(id);
}

function disqualifyPlayer(serial) {
  // Use transaction to ensure both updates happen together
  const transaction = db.transaction(() => {
    disqualifyPlayerStmt.run(serial);
    strikeAllWordsBySerialStmt.run(serial);
  });
  transaction();
}

function getModeratorFeed(since) {
  if (since) {
    return getModeratorFeedStmt.all(since);
  }
  return getModeratorFeedAllStmt.all();
}

function getAllPlayers() {
  return getAllPlayersStmt.all();
}

function getPlayer(serial) {
  return getPlayerBySerialStmt.get(serial);
}

function insertSystemWord(text) {
  insertSystemWordStmt.run(text, Date.now());
}

function getStruckWordIds() {
  return getStruckWordIdsStmt.all().map(r => r.id);
}

module.exports = {
  registerPlayer,
  getPlayer,
  insertWord,
  getWords,
  getLeaderboard,
  strikeWord,
  disqualifyPlayer,
  getModeratorFeed,
  getAllPlayers,
  insertSystemWord,
  getStruckWordIds,
  prepare: (sql) => db.prepare(sql)
};
