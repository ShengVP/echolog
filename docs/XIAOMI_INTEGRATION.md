# 小米手机 / 小米手环 → echolog 接入指南

把小米手机和小米手环上的数据灌进 echolog，主要走两条路：

1. **HTTP /ingest 端点**（推荐）—— 用 Android 上的 [HTTP Shortcuts](https://http-shortcuts.rmy.ch/) App 一键发送文本/图片/录音
2. **飞书 Android 客户端**（已能用）—— 任何 App「分享 → 飞书私聊 echolog」直接落档

小米手环数据走「**App 截屏 → 发飞书 → 视觉模型 OCR**」最稳定（Zepp Life API 反爬严，token 经常失效）。

---

## 一、配置 `INGEST_TOKEN`

在 `.env` 加一行（≥ 16 字符的随机串）：

```bash
# 用 openssl 生成一个：
openssl rand -hex 24
```

把生成的字符串塞到 `.env`：

```
INGEST_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

然后重启：

```bash
echolog restart
echolog logs -f
```

看到 `[ingest] HTTP server: http://127.0.0.1:8766/ingest` 就启动成功。

> 安全：server 只监听 `127.0.0.1`，**不暴露到 LAN/公网**。跨设备（小米手机 → Mac）必须走 Tailscale / WireGuard / SSH tunnel 这种「认证后才能进入回环网络」的方案，否则你的日记 endpoint 就是公开的。

---

## 二、跨设备网络方案

### 方案 A：Tailscale（推荐，最简单）

1. Mac 装 Tailscale，登录账号
2. 小米手机装 Tailscale Android，登录同一个账号
3. 在 Tailscale 后台开 **MagicDNS**，记下 Mac 的 hostname（例：`bill-mac.tail-scale.ts.net`）
4. 在 Mac 上：让 echolog 同时监听 Tailscale 接口（默认只听 127.0.0.1，需要改一行）

如果想最简单：在 `.env` 加一行 `INGEST_PORT=8766`，然后用 `socat` 把 Tailscale 接口的 8766 转发到 127.0.0.1:8766：

```bash
# Mac 上跑（让小米手机能通过 Tailscale 访问到本机的 ingest）
socat TCP-LISTEN:8767,fork TCP:127.0.0.1:8766 &
```

之后小米手机访问 `http://bill-mac.tail-scale.ts.net:8767/ingest` 即可。

### 方案 B：同 Wi-Fi 局域网（开发/快速验证）

把 echolog 改成监听 `0.0.0.0`（**只在你的家庭 Wi-Fi 信任环境**做）。在 `lib/ingest-server.js` 第 73 行 `server.listen(port, '127.0.0.1', ...)` 改成 `server.listen(port, '0.0.0.0', ...)`。然后 Mac 命令 `ipconfig getifaddr en0` 拿到 IP，小米手机就能访问 `http://192.168.1.x:8766/ingest`。

> 这种方式只在受信家庭 Wi-Fi 用；公司/咖啡馆 Wi-Fi 上立刻有人能扫到。

---

## 三、HTTP Shortcuts (小米手机端)

Play Store 装 [HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts)（开源，免费，无广告）。

### 3.1 「快速记一笔」shortcut

最常用：长按桌面 → 弹输入框 → 输入文字 → 立即写到今天的 raw_logs。

**新建 Shortcut → HTTP**:
- Method: `POST`
- URL: `http://bill-mac.tail-scale.ts.net:8767/ingest`（替换为你的 Tailscale 域名 + socat 端口）
- Headers:
  - `X-Echolog-Token: <你的 INGEST_TOKEN>`
  - `Content-Type: application/json`
- Request Body (JSON):
  ```json
  {
    "text": "{{askText}}",
    "source": "quick"
  }
  ```
- Variables: 加一个 `askText`，类型选 `Text input`（执行时弹输入框）

执行测试。回 echolog 终端看 `[📥 ingest]` 日志确认。

### 3.2 「健康打卡」shortcut（每日 22:00 自动）

每天晚上自动问能量分 + 今日体感，写入 logs：

- Trigger: Time-based, 22:00 每天
- Body:
  ```json
  {
    "text": "今日能量 {{askEnergy}}/10；体感 {{askFeel}}",
    "source": "checkin",
    "tags": "#mood/checkin"
  }
  ```

### 3.3 「图片归档」shortcut

- 配「分享菜单 intent」让此 shortcut 出现在系统分享列表
- Body:
  ```json
  {
    "text": "{{shared_text}}",
    "source": "share"
  }
  ```
- 选图片分享时拿不到原图二进制（HTTP Shortcuts 限制），所以**图片仍走飞书**：分享图片到「飞书 → echolog 私聊」。

---

## 四、小米手环数据 → echolog

### 重要事实

- **小米官方对个人开发者关闭 OpenAPI**（2022 年起）。所以「像滴答清单那样 OAuth + HTTP API 拿数据」这条路**不存在**
- Mi Fitness（国际版 `com.xiaomi.wearable`）和「小米运动健康」（中国版 `com.mi.health`）是两个不同 App，数据不互通
- 第三方逆向库（huami-token 等）每隔几个月就因 token 流程改动失效，**不要依赖**

### 三条可走的路径，按 ROI 排序

#### 🏆 路径 A：截屏 + 视觉模型 OCR（**0 开发，已能用，今天就能跑**）

`Mi Fitness → 今日总览 / 睡眠详情 / 心率曲线 → 右上角分享按钮 → 飞书 → echolog 私聊`

bot 自动：
1. 落档到 `Daily_Vault/<date>/assets/`
2. `/diary` 时本地视觉模型 minicpm-o2.6 做描述（识别中文数字 95%+ 准确率）
3. 描述进入 `00_image_cache.json` + 作为身体上下文喂给日记 prompt

每天 5 秒：早上分享一张「今日总览」就够；想更细就再来一张「睡眠详情」。

**此为推荐方案**——零成本、无需维护、视觉模型本地跑不上云。

#### 🥈 路径 B：Strava OpenAPI（**只对运动数据有用，30 分钟开发**）

如果你跑步/骑行/越野/游泳频繁：
1. Mi Fitness 国际版 → 设置 → 第三方应用 → 同步到 Strava（仅国际版支持）
2. [Strava 开发者后台](https://developers.strava.com) 创建个人 app，OAuth 拿 token
3. echolog 写一个 `lib/strava.js`（套路跟 `lib/ticktick.js` 一样），每天定时拉前一天活动列表 → 写到 `Daily_Vault/<date>/99_workout.md`

效果：跑了几公里、配速、心率曲线、海拔、cadence——全自动入 logs，`/diary` 自动消费。

**前提**：Mi Fitness 必须是国际版。**国内版小米运动健康不支持同步到 Strava**，这条路就死。

#### 🥉 路径 C：每日健康打卡（**HTTP Shortcuts 模板，10 分钟配置**）

不指望自动同步，每天 quick tile 主动打卡：
- 早上：「今日睡眠 X.X / 醒来心率 / 主观能量 1-10」
- 直接 POST 到 `/ingest`

数据量少但**主观打分往往比客观数据更有用**（"为什么 7 小时睡眠还是累"才是真问题）。

### 不做的事 ❌

- **Health Connect 桥接**：要写一个 Android Companion App + 后台 service 定时读 → POST `/ingest`。维护成本高，Mi Fitness 跟 Health Connect 的数据同步本身也只覆盖部分指标（步数 / 心率 / 睡眠基本指标，不含训练详情）。**ROI 不够，不做**。
- **逆向 Zepp Life API**：账号密码强制 SMS、token 周期短、字段每年改。短期能跑，但每隔几个月就要修。**fail-safe 不如截屏 OCR**。
- **自己写 Mi 账号 web 抓取**：mi.com 有 captcha + 风控，做了也活不久。

### 进阶：导出官方 CSV

小米运动健康 App 内「设置 → 关于 → 数据导出」（入口因版本不同），可以一次性导出过去 30 天数据为 CSV。把 CSV 放到 `Daily_Vault/_health/` 目录下，echolog 后续可以加 reader（**v1.2 计划，按需实现**）。

---

## 五、常用命令对照

| 操作 | 操作位置 | 走的路径 |
|---|---|---|
| 临时记一句话 | 小米手机 HTTP Shortcuts 桌面磁贴 | `/ingest` |
| 发图（手环数据截屏 / 拍照 / 截图） | 飞书 Android → echolog 私聊 | 飞书 Bot |
| 日记复盘 | 飞书 → 发 `/diary` | 飞书 Bot |
| 跨日回忆 | 飞书 → `/recall <主题>` | 飞书 Bot |
| 写选题草稿 | 飞书 → `/draft <编号>` | 飞书 Bot |
| 链接归档 | 飞书 / HTTP Shortcuts，发 URL | 自动 fetch title/desc |

---

## 六、故障排查

| 现象 | 原因 / 修法 |
|---|---|
| `echolog logs -f` 没看到 `[ingest]` 启动 | `.env` 没设 `INGEST_TOKEN` 或长度 < 16；重启 bot |
| HTTP Shortcuts 报 401 | Header `X-Echolog-Token` 与 `.env` 不匹配 |
| HTTP Shortcuts 报 connection refused | Tailscale 没连上 / socat 没启动 / 端口写错 |
| 发送成功但 raw_logs 没新增 | 看 `echolog logs`；可能 `ts` 字段格式错（应是 ISO 8601） |
| 截屏发飞书后视觉模型没解析 | 视觉模型要 `/diary` 时才会调 —— 实时不解析，懒加载 |

---

## 七、安全清单

- [ ] `INGEST_TOKEN` ≥ 24 字符随机串（用 `openssl rand -hex 24` 生成）
- [ ] echolog 只监听 127.0.0.1（默认）；不要改 0.0.0.0 除非家庭 Wi-Fi 信任环境
- [ ] 跨设备走 Tailscale，不要开公网
- [ ] HTTP Shortcuts 里的 token 当机密看待；不要分享 shortcut export
- [ ] 任何 HTTP 请求失败时不要暴露 token 到日志（`lib/ingest-server.js` 已经处理）
