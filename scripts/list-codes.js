// Prints all access codes + status. Usage: npm run codes
const fs = require('fs');
const path = require('path');
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '..', 'data.json');
if (!fs.existsSync(DATA_PATH)) { console.log('No data.json yet. Start server once to generate codes.'); process.exit(0); }
const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const codes = Object.entries(db.codes);
console.log(`Total: ${codes.length}`);
for (const [c, v] of codes) {
  const user = v.userToken ? db.users[v.userToken] : null;
  console.log(`${c}  redeemed=${v.redeemed}  used=${user ? user.tokens_used : 0}`);
}
