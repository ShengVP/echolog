# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via GitHub's
[Security Advisories](https://github.com/BillLucky/echolog/security/advisories/new).
Include steps to reproduce and the affected version. We aim to acknowledge reports
within a few days.

## Local-first by design

echolog is **local-first** — it runs on your own machine and stores everything locally.
Nothing is uploaded by default. Specifically:

- **Your data stays local.** Raw logs, images, voice, generated diaries, and the
  semantic index all live in `Daily_Vault*/` on your machine. These directories are
  **gitignored** and never committed.
- **Secrets live in `.env`.** `FEISHU_APP_SECRET`, `TG_BOT_TOKEN`, TickTick credentials,
  and any cloud `LLM_API_KEY` go in `.env`, which is **gitignored**. Never hardcode a
  secret in source or commit `.env`.
- **State files are gitignored too.** `.feishu_state.json` (pairing + processed-message
  state), `.ticktick-state.json` (OAuth token + sync state), and `.diary_ratings.jsonl`
  hold private identifiers and tokens — never commit them.
- **Channel access is locked to you.** The Telegram channel hard-allowlists your own
  numeric user id; the Feishu channel locks to the first person who DMs the bot. All
  other senders are silently dropped.
- **Cloud LLM caveat.** If you configure an OpenAI-compatible or Anthropic provider
  instead of local Ollama, only the **diary/weekly text** sent for synthesis goes to
  that provider, under their terms. Run fully offline with Ollama to keep even that local.
- **Local HTTP endpoints bind to loopback.** The optional `/ingest` server and the
  TickTick OAuth callback listen on `127.0.0.1` only — never exposed to LAN/public. Use
  a private overlay (e.g. Tailscale) for cross-device access, not a public port.

## Supported versions

The latest released version receives security fixes.
