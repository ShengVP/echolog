# Contributing to echolog

> **English** below · [中文见下半部分](#贡献指南中文)

Thanks for your interest! echolog is a local-first journaling bot built on Node.js +
local/cloud LLMs + whisper.cpp. Contributions of all sizes are welcome — bug fixes,
new commands, prompt improvements, docs, new LLM providers, performance.

## Dev setup

```bash
git clone https://github.com/BillLucky/echolog.git && cd echolog
npm install
npm link                 # installs the `echolog` CLI (no sudo with a user node prefix)
cp .env.example .env     # then configure one LLM (see below)
echolog start            # run the Feishu channel in the background
# or, without the CLI:
npm run feishu           # = node index-7-feishu.js  (foreground)
npm run tg               # = node index-6-tg.js       (Telegram, needs a local proxy)
```

You need **Node ≥ 22** (undici 8 requires it). For LLM features configure exactly one
provider in `.env` — local **Ollama** (fully private), any **OpenAI-compatible** endpoint
(DeepSeek / Moonshot / OpenAI / MiniMax / OpenRouter / vLLM), or **Anthropic Claude**.
Voice transcription additionally needs `whisper-cpp` + `ffmpeg` (`brew install whisper-cpp ffmpeg`).

## Project layout

```
index-7-feishu.js     Feishu channel entry (recommended — images/video/voice/ASR/cards/backfill)
index-6-tg.js         Telegram channel entry (fallback — needs a local proxy)
bin/echolog         CLI (a lightweight bash script; PID/logs under ~/.echolog/)
lib/*.js              shared libraries:
                        llm.js (provider router: ollama / openai / anthropic),
                        embeddings.js (semantic recall index), drafts.js (writing pipeline),
                        ticktick.js, ratings.js, self-review.js, url-enrich.js,
                        ingest-server.js, prompts.js, doctor.js, init-wizard.js, …
prompts/*.md          versioned prompt templates (diary / drafts / weekly / vision / self-review)
desktop/              optional Electron + React GUI (browse vault, search, edit prompts, run bot)
tests/*.test.js       node:test unit tests; tests/run-all.sh runs bot + desktop + syntax checks
docs/                 setup guides, prompt customization, integrations
```

The two channel entries share a fair amount of logic (date archiving, image-cache,
diary prompt) by intentional copy-paste while the Feishu side evolves — see `CLAUDE.md`
for the architecture and the rules that hold both sides together.

## Before you open a PR

1. **No secrets or personal data.** Never commit API keys, tokens, real names, `open_id`s,
   `user_id`s, or any `Daily_Vault*/` content. All secrets go in `.env` (gitignored).
2. **It runs.** `node --check` passes on every file you touched (`bash tests/run-all.sh`
   runs the unit tests + syntax checks for bot and desktop; add/extend tests for logic changes).
3. **Style matches.** Keep changes focused and match the surrounding code style and comment density.
4. **Clear commit message** describing the technical reason for the change.

## Tips

- Archive date is always the message **send time** in `Asia/Shanghai` — never "now". This is
  load-bearing for offline-then-sync; see `CLAUDE.md`.
- New chat command? Add a branch in `tryDispatchCommand` (Feishu side).
- New `msg_type`? Add a branch in the `handleMessage` if/else chain.
- LLM calls go through `lib/llm.js` so all three providers stay swappable — don't hardcode a client.

---

<a name="贡献指南中文"></a>

# 贡献指南（中文）

感谢关注！echolog 是基于 Node.js + 本地/云端 LLM + whisper.cpp 的本地优先日记 bot。欢迎任何
大小的贡献 —— 修 bug、加命令、优化 prompt、补文档、加 LLM provider、做性能优化。

## 开发环境

```bash
git clone https://github.com/BillLucky/echolog.git && cd echolog
npm install
npm link                 # 安装 `echolog` CLI（用户态 node prefix 下无需 sudo）
cp .env.example .env     # 然后配一个 LLM（见下）
echolog start            # 后台启动飞书通道
# 不用 CLI 时直接跑：
npm run feishu           # = node index-7-feishu.js（前台）
npm run tg               # = node index-6-tg.js（Telegram，需本地代理）
```

需要 **Node ≥ 22**（undici 8 的硬要求）。LLM 功能在 `.env` 里配**一个** provider 即可：本地
**Ollama**（完全私密）、任意 **OpenAI 兼容**端点（DeepSeek / Moonshot / OpenAI / MiniMax /
OpenRouter / vLLM），或 **Anthropic Claude**。语音转写额外需要 `whisper-cpp` + `ffmpeg`
（`brew install whisper-cpp ffmpeg`）。

## 项目结构

```
index-7-feishu.js     飞书通道入口（主推 —— 图片/视频/语音/ASR/卡片/离线追写）
index-6-tg.js         Telegram 通道入口（备用 —— 需本地代理）
bin/echolog         CLI（轻量 bash 脚本；PID/日志在 ~/.echolog/）
lib/*.js              共享库：
                        llm.js（provider 路由：ollama / openai / anthropic）、
                        embeddings.js（语义检索索引）、drafts.js（写作流水线）、
                        ticktick.js、ratings.js、self-review.js、url-enrich.js、
                        ingest-server.js、prompts.js、doctor.js、init-wizard.js …
prompts/*.md          多版本 prompt 模板（diary / drafts / weekly / vision / self-review）
desktop/              可选 Electron + React GUI（浏览 vault、搜索、改 prompt、控制 bot）
tests/*.test.js       node:test 单测；tests/run-all.sh 跑 bot + desktop + 语法检查
docs/                 配置指南、prompt 定制、集成说明
```

两个通道入口在飞书侧持续演进期间，刻意保留了部分逻辑的复制粘贴（日期归档、图片缓存、diary
prompt）—— 架构和约束见 `CLAUDE.md`。

## 提 PR 前

1. **绝不含 secret 或个人数据。** 不要提交 API key、token、真实姓名、`open_id`、`user_id`，
   或任何 `Daily_Vault*/` 内容。所有 secret 走 `.env`（已 gitignore）。
2. **能跑。** 改过的每个文件 `node --check` 能过（`bash tests/run-all.sh` 跑单测 + bot/desktop
   语法检查；逻辑改动配单测）。
3. **风格一致。** 改动聚焦，匹配周围代码风格与注释密度。
4. **commit message 写清**改动的技术原因。

## 小提示

- 归档日期一律用消息**发送时间** `Asia/Shanghai`，绝不用「现在」。这是离线后同步能落对日期的关键，
  见 `CLAUDE.md`。
- 加新聊天命令：在 `tryDispatchCommand`（飞书侧）加分支。
- 加新 `msg_type`：在 `handleMessage` 的 if/else 链里加分支。
- LLM 调用统一走 `lib/llm.js`，保证三种 provider 可互换 —— 别硬编码某个 client。
