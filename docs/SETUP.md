# echolog 从零部署指南

> 给第一次拿到这套代码的朋友。**全程 15-30 分钟**，跑完你就能在飞书上发消息让 bot 帮你写日记了。

## 如果你拿到的是 .dmg 安装包（不需要看代码）

1. 双击 `echolog-0.x.x.dmg` → 把 echolog 拖进 Applications
2. **首次打开必须右键**：右键 echolog → 「打开」→ 「打开」（绕过 macOS 「未签名」提示，只需做一次）
3. 之后双击即可正常启动
4. 桌面 app 打开后，按引导走完 5 步：硬件检测 → LLM 选择（默认本地 Ollama，省钱省私密）→ 飞书 App → 用户身份 → 完成

> 提示：dmg 是免费签名版本（个人使用），所以 macOS 第一次会拦截。这是正常现象，跟「病毒」无关。

---

## 0. 你需要先了解的硬件现实

这套 bot 的「重头戏」是用大模型给你写日记。模型可以跑在两个地方：

| 跑模型的地方 | 数据私密性 | 成本 | 硬件要求 |
|---|---|---|---|
| **本地 Ollama** | ⭐⭐⭐⭐⭐ 完全离线 | 免费 | Apple Silicon ≥ 24GB 内存最舒服；16GB 勉强；Intel Mac 不建议 |
| **云端 LLM**（DeepSeek / OpenAI / ...） | ⭐⭐ 内容会发给云端 | 极低（DeepSeek ≈ ¥0.001/1K token，一天日记 ≈ ¥0.05） | 无要求，4GB 内存的 Mac 都能跑 |

**你需要先做一个决定**：

- 想完全离线 + Apple Silicon ≥ 16GB → 走「本地 Ollama」
- 想要写得好 / 跑得快 / 设备老 → 走「云端 LLM」
- 不确定 → 先选**云端**，跑顺了再换本地

向导（`echolog init`）会检测你的硬件，给推荐。但**最终选择权在你**。

---

## 1. 装依赖（5 分钟）

仅 macOS，其他平台没验过。Windows 用户建议先装 WSL。

```bash
# Node.js（>= 18，bot 跑在 node 上）
brew install node

# ffmpeg（语音转录前的格式转换）
brew install ffmpeg

# whisper-cpp（语音转文字，可选 —— 不发语音可以跳过）
brew install whisper-cpp

# Ollama（仅当你要跑本地模型时装）
brew install ollama
brew services start ollama   # 让 ollama 开机自启
```

### 如果你选了「本地 Ollama」，还要拉模型

```bash
ollama pull qwen3.5:9b                      # 文本模型（约 6GB）
ollama pull openbmb/minicpm-o2.6:latest     # 视觉模型（约 5GB，解析图片用）
ollama pull bge-large                       # embedding（约 670MB，跨日 /recall 用）
```

内存紧张（< 16GB）改更小的模型：
```bash
ollama pull qwen2.5:3b                      # 文本模型小一点（约 2GB）
# 视觉模型如果跑不动就别拉，配置时跳过即可
```

### Whisper 模型（仅当装了 whisper-cpp）

```bash
mkdir -p ~/.whisper-models
curl -L -o ~/.whisper-models/ggml-large-v3-turbo-q5_0.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
```

---

## 2. 拿飞书凭证（5 分钟）

1. 打开 [https://open.feishu.cn/app](https://open.feishu.cn/app) → 「创建企业自建应用」
2. 起个名字（自己看得懂就行，比如「我的日记 bot」）
3. 进应用 → 「凭证与基础信息」→ 复制 **App ID**（`cli_xxx`）和 **App Secret**
4. 「权限管理」开这些权限：
   - `im:message`（接收消息）
   - `im:message:send_as_bot`（回复消息）
   - `im:resource`（下图片/文件）
   - `im:chat`（群信息）
   - `im:message.reaction:write`（给已读消息打表情，可选）
5. 「事件订阅」：
   - 推送方式选**「使用长连接接收」**（这是关键！否则 bot 收不到消息）
   - 订阅事件：搜 `im.message.receive_v1` 并勾选
6. 「版本管理」→ 创建版本 → 提交审核（自己审核自己，秒过）→ 启用应用

---

## 3. 克隆代码 + 装 npm 依赖（2 分钟）

```bash
git clone <repo-url> echolog
cd echolog
npm install

# 把 echolog 命令注册到全局 PATH（这样可以在任何目录用 echolog xxx）
npm link
```

如果 `npm link` 报权限错，加 sudo 或者改 npm 的全局目录（`npm config set prefix ~/.npm-global`，再把 `~/.npm-global/bin` 加进 PATH）。

---

## 4. 跑配置向导（5 分钟）

```bash
echolog init
```

这会问你 5 类问题：

1. **硬件 + LLM provider 选择** —— 向导会探测你的内存 / 芯片，给推荐
2. **provider 详细配置**：
   - 选了云端 → 填 `LLM_API_BASE`（如 `https://api.deepseek.com/v1`）+ `LLM_API_KEY` + 模型名，当场测连通
   - 选了本地 → 提示你 `ollama pull` 哪几个模型
3. **飞书 App ID + Secret** —— 当场测试 token 是否能换出来
4. **你是谁** —— 名字、身份、在做的项目、内容定位、语气偏好。这几个会注入 prompt 模板，让 diary 更贴你
5. 写入 `.env`（如果你已经有了，会备份成 `.env.backup-<时间戳>`）

跑完之后你会看到这样的提示：
```
1) 启动后台进程：echolog start
2) 跟踪日志：     echolog logs -f
3) 验证全链路：    echolog doctor
```

---

## 5. 启动 + 验证

```bash
echolog start    # 后台启动
echolog doctor   # 看整体健康度
```

`doctor` 输出会带几个区段：硬件 / 进程 / 飞书 / 滴答 / 本地依赖 / 索引 / vault / 评分。

**第一次用前的最小验证**：

1. 在飞书上找到你刚建的 bot（在「工作台」搜应用名），点头像 → 「单聊」
2. 发条消息「你好」
3. 看 bot 是否给你的消息打了 OK 表情
4. 终端跑 `ls Daily_Vault/$(date +%Y-%m-%d)/` 应该能看到 `01_raw_logs.md`
5. 再多发几条素材（文字、图片、语音都可以），然后发 `/diary` —— bot 会调用 LLM 写日记并回发

---

## 6. 进阶：滴答清单（可选）

让 `/diary` 自动注入今日任务上下文 + 把生成的 Action Items 同步到滴答的 Notes 项目。

1. 在 [https://developer.dida365.com/manage](https://developer.dida365.com/manage) 创建应用
2. **Redirect URI** 一定要填：`http://127.0.0.1:8765/callback`
3. 把 client id + secret 填进 `.env`：
   ```
   TICKTICK_CLIENT_ID=xxx
   TICKTICK_CLIENT_SECRET=xxx
   ```
4. 终端跑 `echolog ticktick-auth` —— 自动开浏览器走 OAuth 授权
5. 授权后 token 进 `.ticktick-state.json`（gitignored，180 天有效）

---

## 7. 进阶：手机灌内容（可选）

Android 用户：装 [HTTP Shortcuts](https://github.com/Waboodoo/HTTP-Shortcuts) 或 Tasker，可以直接 POST 给 bot，绕开飞书。详见 `docs/XIAOMI_INTEGRATION.md`。

---

## 常见坑

| 现象 | 原因 + 修复 |
|---|---|
| `echolog: command not found` | `npm link` 没生效。`cd echolog && npm link` 重跑，或用相对路径 `./bin/echolog start` |
| 飞书发消息 bot 没反应 | 99% 是「事件订阅」没选「长连接」。回开放平台改一下，应用要重新发版 |
| `echolog start` 起来又秒死 | 看 `echolog logs` 的报错。常见：1. `.env` 缺 FEISHU_APP_ID；2. 模型没拉；3. cloud key 错了 |
| `/diary` 卡在 "调用 xxx 写日记..." 然后报 fetch failed | 模型 cold start 超时（5 分钟）。**已经在 v1.2 修了** —— ollama 端开了 keep_alive + warmup。检查 `echolog logs` 有没有 `[🔥 warmup] xxx ready` |
| 飞书 bot 跟其他人聊不通 | 设计如此 —— bot 首次收到的 p2p 消息把 sender_id 锁死，之后非该 ID 全部静默丢弃。要重置就删 `.feishu_state.json` 里的 `paired_open_id` |
| TickTick 创建任务报 401 | token 过期了（180 天），重跑 `echolog ticktick-auth` |

---

## 下一步

- 看 [README.md](../README.md) 了解所有 `/xxx` 命令
- 看 [CLAUDE.md](../CLAUDE.md) 了解代码结构（给开发者）
- 看 [docs/XIAOMI_INTEGRATION.md](XIAOMI_INTEGRATION.md) 跨设备灌内容
