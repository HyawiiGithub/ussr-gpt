# USSR GPT — private access portal

Single-use access codes, 100,000 tokens per seat, key stays server-side.

## Run on your PC (localhost)

Same system you already use: site runs at `http://localhost:3000`, only your machine can open it.

```powershell
cd ussr-gpt
npm install
$env:PROVIDER="openrouter"
$env:AI_GATEWAY_KEY="<your existing key>"
$env:OPENROUTER_MODEL="qwen/qwen3.8-27b:free"  # any model id works
node server.js
# open http://localhost:3000
npm run codes   # list codes + usage
```

Note: your configured `stealth/ox-alpha` id no longer exists on the provider
(only `stealth/space-bunny-alpha` matches), so set `OPENROUTER_MODEL` explicitly.

### Fully offline (no key, no internet)

```powershell
ollama pull llama3.1:8b
$env:PROVIDER="ollama"
$env:OLLAMA_MODEL="llama3.1:8b"
node server.js
```

## Fixed codes

Set `ACCESS_CODES` env (comma-separated) before first boot to seed an exact list.
Otherwise random codes generate — read them via `npm run codes`.

## Coolify deploy (for other people)

1. New Project → Application → this repo, build pack Dockerfile.
2. Env: `PROVIDER=gateway`, `AI_GATEWAY_KEY`, `TOKEN_BUDGET=100000`,
   `DATA_PATH=/data/data.json`, `ACCESS_CODES=<your 100 codes>`.
3. Volume `/data`, port `3000`, HTTPS on.
4. If `/api/redeem` returns non-JSON `403 Forbidden.`, the request never reached
   the container — check domain routing, proxy auth, or Cloudflare in front.
   `/api/debug` should return JSON with `codesLoaded`.

## Notes
- 429 / busy message = shared capacity throttled. Budget is not burned on failures.
- Tell users: no passwords/secrets in chat.
