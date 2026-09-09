# USSR GPT — private access portal (Coolify)

Single-use access codes, 100,000 tokens per seat, key stays server-side.

## Local test
```powershell
cd ussr-gpt
npm install
$env:AI_GATEWAY_KEY="paste-key-here"
$env:DATA_PATH="$PWD\data.json"
node server.js
# http://localhost:3000
npm run codes   # list codes + usage
```

## Fixed codes (recommended)
Set `ACCESS_CODES` env to your comma-separated code list before first boot.
The server seeds exactly those codes. Keep the list private.

## Coolify deploy
1. New Project → Application → this repo, build pack Dockerfile.
2. Env vars: `AI_GATEWAY_KEY`, `TOKEN_BUDGET=100000`, `DATA_PATH=/data/data.json`, `ACCESS_CODES=<your 100 codes>`.
3. Volume `/data` for persistence. Port `3000`. Enable HTTPS.
4. First boot seeds codes from `ACCESS_CODES`. If unset, random codes are generated — read via `npm run codes` inside the container.

## Notes
- 429 = shared capacity busy. App returns a friendly retry message and does not burn budget on failures.
- Tell users: no passwords/secrets in chat.
