// USSR GPT gateway. Gateway key stays SERVER-SIDE ONLY.
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const GATEWAY_KEY = (process.env.AI_GATEWAY_KEY || process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_API_KEY || '').trim();
const MODEL_ID = (process.env.MODEL_ID || 'muse-spark-1.3-contributor-free').trim();
const GATEWAY_URL = (process.env.GATEWAY_URL || process.env.ZEN_URL || 'https://opencode.ai/zen/v1/responses').trim();
const TOKEN_BUDGET = parseInt(process.env.TOKEN_BUDGET || '100000', 10);
const NUM_CODES = parseInt(process.env.NUM_CODES || '100', 10);
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || 'You are USSR GPT, a helpful assistant. Be concise, practical, and friendly. Answer in the user\'s language.';

if (!GATEWAY_KEY) console.warn('[WARN] Gateway key not set. Set AI_GATEWAY_KEY env. Proxy returns 500 until set.');

function defaultDB() { return { codes: {}, users: {} }; }
function loadDB() {
  try { if (fs.existsSync(DATA_PATH)) return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch (e) { console.error('DB load failed:', e.message); }
  return defaultDB();
}
function saveDB(db) {
  try { fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true }); fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('DB save failed:', e.message); }
}
function makeCode() {
  const p = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `USSR-${p()}-${p()}`;
}
function parseSeedCodes() {
  const raw = process.env.ACCESS_CODES || '';
  return [...new Set(raw.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 4))].slice(0, 500);
}

let db = loadDB();
if (Object.keys(db.codes).length === 0) {
  const seed = parseSeedCodes();
  const list = seed.length ? seed : Array.from({ length: NUM_CODES }, () => { let c = makeCode(); return c; });
  const finalCodes = [];
  for (const c of list) { let code = c; while (db.codes[code] || finalCodes.includes(code)) code = makeCode(); finalCodes.push(code); }
  while (finalCodes.length < (seed.length ? seed.length : NUM_CODES)) { let c = makeCode(); if (!db.codes[c] && !finalCodes.includes(c)) finalCodes.push(c); }
  for (const c of finalCodes) db.codes[c] = { redeemed: false, userToken: null, createdAt: new Date().toISOString() };
  saveDB(db);
  console.log(`[INIT] Ready with ${finalCodes.length} single-use access codes${seed.length ? ' (from ACCESS_CODES)' : ''}.`);
}

const estimateTokens = t => t ? Math.ceil(String(t).length / 4) : 0;
function extractText(j) {
  if (!j) return '';
  if (typeof j.output_text === 'string' && j.output_text) return j.output_text;
  if (Array.isArray(j.output)) {
    const parts = [];
    for (const item of j.output) for (const c of (item && item.content) || []) {
      if (typeof c.text === 'string') parts.push(c.text);
    }
    if (parts.length) return parts.join('');
  }
  if (j.choices && j.choices[0] && j.choices[0].message) return j.choices[0].message.content || '';
  return '';
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const hits = new Map();
app.use((req, res, next) => {
  const now = Date.now();
  const arr = ((hits.get(req.ip)) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(req.ip, arr);
  if (arr.length > 30) return res.status(429).json({ error: 'Too many requests. Slow down and retry.' });
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, budget: TOKEN_BUDGET }));

app.post('/api/redeem', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Code required.' });
  const entry = db.codes[code];
  if (!entry) return res.status(404).json({ error: 'Invalid code.' });
  if (entry.redeemed) return res.status(410).json({ error: 'Code already used.' });
  const token = 'usr_' + crypto.randomBytes(16).toString('hex');
  entry.redeemed = true; entry.userToken = token; entry.redeemedAt = new Date().toISOString();
  db.users[token] = { code, tokens_used: 0, budget: TOKEN_BUDGET, createdAt: new Date().toISOString() };
  saveDB(db);
  res.json({ token, budget: TOKEN_BUDGET, remaining: TOKEN_BUDGET });
});

app.get('/api/me', (req, res) => {
  const u = db.users[String(req.query.token || '')];
  if (!u) return res.status(401).json({ error: 'Invalid session.' });
  res.json({ tokens_used: u.tokens_used, budget: u.budget, remaining: Math.max(0, u.budget - u.tokens_used) });
});

app.post('/api/chat', async (req, res) => {
  const token = String(req.body?.token || '');
  const message = String(req.body?.message || '').slice(0, 12000);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-20) : [];
  const u = db.users[token];
  if (!u) return res.status(401).json({ error: 'Invalid session.' });
  const remaining = u.budget - u.tokens_used;
  if (remaining <= 0) return res.status(403).json({ error: 'Token budget exhausted.', tokens_used: u.tokens_used });
  if (!message) return res.status(400).json({ error: 'Message required.' });
  if (!GATEWAY_KEY) return res.status(500).json({ error: 'Server not configured. Contact administrator.' });
  const estIn = estimateTokens(SYSTEM_PROMPT) + estimateTokens(message) + history.reduce((a, m) => a + estimateTokens(m.content || ''), 0);
  if (estIn >= remaining) return res.status(403).json({ error: 'Not enough tokens left for this request.', remaining });

  const input = [];
  for (const m of history) {
    const content = String(m.content || '').slice(0, 8000);
    if (content) input.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'input_text', text: content }] });
  }
  input.push({ role: 'user', content: [{ type: 'input_text', text: message }] });

  let zj, status;
  try {
    const r = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GATEWAY_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'ussr-gpt/1.0', 'X-Title': 'ussr-gpt' },
      body: JSON.stringify({ model: MODEL_ID, instructions: SYSTEM_PROMPT, input, stream: false, max_output_tokens: 2000 })
    });
    status = r.status;
    try { zj = JSON.parse(await r.text()); } catch { zj = {}; }
    if (!r.ok) {
      if (status === 429) return res.status(429).json({ error: 'Shared capacity is busy. Try again in a bit.' });
      return res.status(502).json({ error: 'Service temporarily unavailable. Try again.' });
    }
  } catch (e) { return res.status(502).json({ error: 'Service temporarily unavailable. Try again.' }); }

  const reply = extractText(zj) || '(empty response, try again)';
  const usage = zj.usage || {};
  const total = usage.total_tokens || ((usage.input_tokens || 0) + (usage.output_tokens || 0)) || (estIn + estimateTokens(reply));
  u.tokens_used += total; saveDB(db);
  res.json({ reply, tokens_used: u.tokens_used, remaining: Math.max(0, u.budget - u.tokens_used) });
});

app.listen(PORT, '0.0.0.0', () => console.log(`USSR GPT on :${PORT} | budget=${TOKEN_BUDGET} | codes=${Object.keys(db.codes).length}`));
