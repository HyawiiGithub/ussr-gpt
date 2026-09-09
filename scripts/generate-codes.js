// Exports unused codes to codes.txt for distribution. Usage: npm run gen-codes
const fs = require('fs');
const path = require('path');
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '..', 'data.json');
const OUT = path.join(__dirname, '..', 'codes.txt');
if (!fs.existsSync(DATA_PATH)) { console.log('No data.json yet. Start server once first.'); process.exit(1); }
const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const fresh = Object.entries(db.codes).filter(([c, v]) => !v.redeemed).map(([c]) => c);
fs.writeFileSync(OUT, fresh.join('\n') + '\n');
console.log(`Wrote ${fresh.length} unused codes to codes.txt`);
