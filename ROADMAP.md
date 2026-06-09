# Roadmap / 路线图

echolog is **actively maintained**. This is a living document of direction, not a
promise of dates. Ideas and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

> 这是方向性的路线图，不承诺具体时间。欢迎在 issue 里提想法、提 PR。

## Shipped / 已落地

- **Dual channels** — Feishu (recommended, no proxy) and Telegram, both archiving to the
  same local Markdown vault
- **Archived by send-time** — messages file under the day they were sent, not received;
  offline-then-sync still lands on the right day
- **Evidence-driven diaries** — `/diary` reads the day's logs + vision-described images
  and writes a structured diary with hard anti-fluff rules
- **Vision + cache** — images described by a vision model, cached by filename, never re-run
- **Voice → text** — local transcription via whisper.cpp, folded into the day's log
- **Search & recall** — `/find` full-text grep across days; `/recall` semantic search over
  a local embedding index
- **Draft pipeline** — `/draft` turns a captured idea into Twitter thread / long-form /
  short-video script, pulling cross-day material from the recall index
- **Weekly reports** — `/week` rolls the past 7 days into a review
- **Three LLM providers** — local Ollama, any OpenAI-compatible endpoint, and native Anthropic Claude
- **Desktop GUI (macOS)** — Electron + React app to browse the vault, search, edit prompts,
  and control the bot
- **Versioned prompts** — prompt templates live in `prompts/` and can be switched/edited per type

## Near-term / 近期

- [ ] **Windows / Linux GUI** — build and validate the desktop app beyond macOS
- [ ] **Fuller docs & demo** — a smoother first-run path and a short walkthrough
- [ ] **English docs parity** — complete the English side of the guides under `docs/`

## Exploring / 探索中

- [ ] **Pluggable embedding providers** — make the recall/embedding backend swappable like the LLM layer
- [ ] **More draft formats** — e.g. 小红书 / B 站 / newsletter presets
- [ ] **Multi-user** — move beyond the single-owner pairing model

## How to help / 怎么参与

- 🐛 Found a bug? Open an issue with the failing command + your OS + relevant logs.
- 💡 Want a feature? Open an issue describing the workflow — concrete use cases shape priorities.
- 🛠️ Sending a PR? Keep `bash tests/run-all.sh` green and never commit secrets or vault data
  (see [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md)).
