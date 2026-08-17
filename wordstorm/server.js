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

const revealState = { tech: false, credit: false };

// Routes

app.get('/api/qr-url', async (req, res) => {
  let playerUrl = `http://localhost:${PORT}/player/`;
  try {
    const ngrokRes = await fetch('http://localhost:4040/api/tunnels');
    if (ngrokRes.ok) {
      const data = await ngrokRes.json();
      if (data.tunnels && data.tunnels.length > 0) {
        const publicUrl = data.tunnels[0].public_url;
        if (publicUrl) {
          playerUrl = publicUrl + (publicUrl.endsWith('/') ? 'player/' : '/player/');
        }
      }
    }
  } catch (e) {
    // ngrok not reachable, fallback to localhost
  }
  res.json({ playerUrl });
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

app.get('/api/moderate/feed', (req, res) => {
  const since = req.query.since ? parseInt(req.query.since, 10) : 0;
  const words = db.getModeratorFeed(since);
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
