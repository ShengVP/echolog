# 给朋友的快速上手单页（拷过去就能用）

> 收到 echolog 安装包的朋友看这一份就够了。**15-20 分钟跑通**。

## 你会拿到什么

一个 `echolog-X.X.X-arm64.dmg`（Apple Silicon）或 `echolog-X.X.X-x64.dmg`（Intel）文件。这是一个完整的 macOS 桌面应用 + 后台机器人。

## 1. 装应用（2 分钟）

1. 双击 `.dmg` → 把 `echolog` 拖进 `Applications`
2. **首次打开必须用右键**：
   - 在 Applications 里右键 `echolog` → 「打开」→ 弹窗里再点「打开」
   - 这一步只做一次。macOS 因为这个 app 没付费签名（个人工具，不付 99 美元/年），第一次会拦下
3. 之后双击图标即可

## 2. 装本地 LLM 引擎（5 分钟）

bot 默认让大模型完全跑在你自己电脑上，**数据不出本机**。你需要装 Ollama：

```bash
# 在终端执行
brew install ollama
brew services start ollama   # 让 ollama 开机自启
```

如果没有 brew，先装它：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 3. 拿飞书 App ID + Secret（5 分钟）

bot 通过你**自己**的飞书机器人收发消息（你跟你的 bot 私聊就行，没人能看到）。

1. 打开 [https://open.feishu.cn/app](https://open.feishu.cn/app) → 用飞书账号登录
2. 「创建企业自建应用」→ 起个名字（比如「我的日记 bot」）
3. 「凭证与基础信息」→ 复制 **App ID**（`cli_xxx`）和 **App Secret**
4. 「权限管理」→ 勾选这些权限并发布：
   - `im:message`
   - `im:message:send_as_bot`
   - `im:resource`
   - `im:chat`
   - `im:message.reaction:write`（可选）
5. 「事件订阅」：**推送方式选「使用长连接接收」**（这是关键！）→ 订阅事件搜 `im.message.receive_v1` 勾选
6. 「版本管理」→ 创建版本 → 提交审核（自己审核自己，秒过）→ 启用

## 4. 配置 + 跑起来（5 分钟）

1. 打开 echolog 桌面应用
2. 顶部蓝色横幅提示「还缺少核心配置」→ 点「去配置」
3. 在「配置」页：
   - **🧑 你是谁** —— 填名字、身份、在做的项目、想沉淀什么内容、写作语气偏好（这些会注入 prompt，让日记更贴你）
   - **💬 飞书** —— 填刚拿到的 App ID + Secret
   - **🧠 LLM Provider** —— 默认 `ollama`，不改即可
4. 点底部「保存 .env 改动」
5. 去「状态」页 → 点「启动」按钮
6. **第一次启动会自动拉模型**（约 5-10 分钟，看网速）—— 看「跟随」日志面板
7. 等到日志里出现 `[🔥 warmup] xxx ready` 就 OK 了

## 5. 给 bot 发消息验证

1. 飞书里搜你刚建的应用名 → 单聊
2. 发条消息「你好」给它
3. 你的消息会被 OK 表情回复 + 落档（在桌面 app 的「日记浏览」里能看到）
4. 多发几条素材（文字 / 图片 / 语音都行），发完发个 `/diary`
5. bot 调本地 Ollama 写日记，30s ~ 2min 给你一份结构化复盘

## 常用命令

直接在飞书私聊里发：

| 命令 | 干什么 |
|---|---|
| `/diary` | 生成今天日报（也可以在桌面 app 点「生成 / 重生成日记」按钮） |
| `/today` `/yesterday` `/show 2026-05-28` | 看某天 raw_logs |
| `/find 关键词` | 跨日全文搜（桌面 app 的「搜索」页更好用） |
| `/recall 主题` | 跨日语义搜 |
| `/week` | 过去一周周报 |
| `/rate 4 评语` | 给最近一份日记打分 |
| `/help` | 完整命令列表 |

## 常见坑

| 现象 | 修 |
|---|---|
| 「无法打开 echolog —— 来自身份不明的开发者」 | **右键** → 打开 → 弹窗再点打开（详见上面「装应用」段） |
| 飞书 bot 不回 OK | 99% 是「事件订阅」没选「使用长连接接收」。回开放平台改完要重新发版 |
| 启动后台进程后秒退 | 看「状态」页的日志面板。常见：配置没填全、模型还没 pull |
| /diary 报错「fetch failed」 | 系统代理（ClashX/Mihomo）干扰飞书 SDK —— 已修，更新到最新版即可 |
| Ollama 模型拉不下来 | `export ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/`；或重启代理 |
| 我电脑跑不动大模型 | 桌面 app「配置」页改 LLM Provider 为 `openai`，填 DeepSeek 的 API key（¥0.001/1K token，一天日记 ≈ ¥0.05） |

## 私密性提醒

- **本地模式（默认）**：所有数据（消息原文 / 图片 / 日记）都只在你这台 Mac 上。Ollama 模型本地推理，不联网
- **云端模式**（你主动改 LLM_PROVIDER=openai）：raw_logs 内容会发给 LLM provider（DeepSeek / OpenAI / 等），有隐私 trade-off
- 飞书 / Telegram 走 bot 私聊，他们服务器有消息副本（这是平台机制无法绕开）

## 进阶：定制你的 voice（v0.4+）

bot 默认的日记 / 周报模板是「克制理性、技术视角」。想换风格？两种方式：

**方式 1：改 .env 的语气字段（最轻）**
打开「配置」→ 「🧑 你是谁」→ 修改 `USER_TONE_HINT`，例如：
- 「轻松幽默、有人情味、会自嘲」
- 「严肃认真、商务正式、重数据」
- 「随性洒脱、不正经、爱吐槽」

**方式 2：完整改 prompt 模板（最灵活）**
打开「Prompt 编辑」视图：
- 8 类 prompt（日记 / 周报 / 推特 / 长文 / 短视频 / 自审 × 2 / 视觉）任选
- Monaco 编辑器 ⌘S 保存
- 可以「从当前复制新建版本」隔离测试

详见 [docs/PROMPT_GUIDE.md](PROMPT_GUIDE.md)。

## 任何问题

提 issue：[https://github.com/BillLucky/echolog/issues](https://github.com/BillLucky/echolog/issues)
