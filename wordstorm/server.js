const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./db');
const { isClean } = require('./badwords');

const app = express();
const PORT = process.env.PORT || 4521;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Reset DB on startup handled by db.js
let contestOpen = true;
const revealState = { tech: false, credit: false };

// Routes
app.get('/api/qr-url', (req, res) => {
  res.json({ playerUrl: 'http://172.31.3.109:4521/player/' });
});

const SESSION_ID = Date.now().toString();
app.get('/api/session', (req, res) => {
  res.json({ sessionId: SESSION_ID });
});

app.post('/api/register', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid name' });
  }

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 40 || /[^a-zA-Z0-9 ]/.test(cleanName)) {
    return res.status(400).json({ error: 'Name must be 2-40 characters, letters and numbers only.' });
  }

  const result = db.registerPlayer(cleanName);
  res.json(result);
});

app.post('/api/word', (req, res) => {
  if (!contestOpen) {
    return res.json({ accepted: false, reason: 'closed' });
  }

  const { serial, text } = req.body;

  if (!serial || !text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const player = db.getPlayer(serial);
  if (!player) {
    return res.status(400).json({ error: 'Player not found' });
  }
  if (player.disqualified) {
    return res.status(403).json({ error: 'Player disqualified' });
  }

  const cleanText = text.trim();
  if (cleanText.length < 2 || cleanText.length > 20 || cleanText.includes(' ')) {
    return res.status(400).json({ error: 'Word must be 2-20 characters, single word only.' });
  }

  if (!isClean(cleanText)) {
    // Return false silently as requested
    return res.json({ accepted: false, reason: 'filtered' });
  }

  const recentDuplicate = db.prepare(`
    SELECT id FROM words 
    WHERE serial = ? AND text = ? AND timestamp > ?
  `).get(serial, cleanText, Date.now() - 10000);

  if (recentDuplicate) {
    return res.json({ accepted: false, reason: 'duplicate' });
  }

  const result = db.insertWord(serial, cleanText);
  res.json({ accepted: true, word: result.text });
});

app.get('/api/words', (req, res) => {
  const since = req.query.since ? parseInt(req.query.since, 10) : 0;
  const words = db.getWords(since);
  res.json({ words, serverTime: Date.now() });
});

app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.getLeaderboard();
  res.json({ leaderboard });
});

// Moderator Routes
let flowInterval = null;
let fallbackIndex = 0;

app.post('/api/moderate/flow', (req, res) => {
  const { active } = req.body;

  if (active) {
    if (flowInterval) clearInterval(flowInterval);
    flowInterval = setInterval(() => {
      const { fallbackWords } = require('./fallback-words');
      const word = fallbackWords[fallbackIndex % fallbackWords.length];
      fallbackIndex++;
      db.insertSystemWord(word);
    }, 150);
    res.json({ active: true });
  } else {
    if (flowInterval) {
      clearInterval(flowInterval);
      flowInterval = null;
    }
    res.json({ active: false });
  }
});

app.get('/api/words/struck', (req, res) => {
  const struckIds = db.getStruckWordIds();
  res.json({ struckIds });
});

app.post('/api/moderate/strike', (req, res) => {
  const { wordId } = req.body;
  if (!wordId) return res.status(400).json({ error: 'Missing wordId' });

  db.strikeWord(wordId);
  res.json({ success: true });
});

app.post('/api/moderate/disqualify', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'Missing serial' });

  db.disqualifyPlayer(serial);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM players WHERE disqualified = 0) as activePlayers,
      (SELECT COUNT(*) FROM players WHERE disqualified = 1) as dqPlayers,
      (SELECT COUNT(*) FROM players) as totalPlayers,
      (SELECT COUNT(*) FROM words WHERE struck = 0 AND serial != 'SYSTEM') as acceptedWords,
      (SELECT COUNT(*) FROM words WHERE struck = 1) as struckWords,
      (SELECT COUNT(*) FROM words WHERE timestamp > ? AND serial != 'SYSTEM') as recentWords
  `).get(Date.now() - 60000);
  
  res.json({
    ...stats,
    flowActive: flowInterval !== null,
    wordsPerMinute: stats.recentWords
  });
});

app.post('/api/contest/toggle', (req, res) => {
  contestOpen = req.body.open;
  res.json({ contestOpen });
});

app.get('/api/contest/state', (req, res) => {
  res.json({ contestOpen });
});

app.get('/api/leaderboard/full', (req, res) => {
  const players = db.prepare(`
    SELECT p.serial, p.name,
      COUNT(w.id) as wordCount
    FROM players p
    LEFT JOIN words w ON p.serial = w.serial 
      AND w.struck = 0
    WHERE p.disqualified = 0 
      AND p.serial != 'SYSTEM'
    GROUP BY p.serial
    ORDER BY wordCount DESC
  `).all();
  res.json({ players });
});

app.get('/api/moderate/feed', (req, res) => {
  const since = req.query.since ? parseInt(req.query.since, 10) : 0;
  const words = db.getModeratorFeed(since);
  res.json({ words });
});

app.get('/api/moderate/player-words/:serial', (req, res) => {
  const words = db.prepare(`
    SELECT id, text, struck, flagged, timestamp 
    FROM words 
    WHERE serial = ? 
    ORDER BY timestamp ASC
  `).all(req.params.serial);
  res.json({ words });
});

app.get('/api/moderate/players', (req, res) => {
  const players = db.getAllPlayers();
  res.json({ players });
});

app.post('/api/reveal/tech', (req, res) => {
  if (req.body.active) revealState.tech = true;
  res.json({ success: true });
});

app.post('/api/reveal/credit', (req, res) => {
  if (req.body.active) revealState.credit = true;
  res.json({ success: true });
});

app.get('/api/reveal/state', (req, res) => {
  res.json(revealState);
});

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`- Player: /player/`);
  console.log(`- Projector: /projector/`);
  console.log(`- Moderator: /mod/`);
});
