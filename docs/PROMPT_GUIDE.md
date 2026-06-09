# Prompt 配置指南

> v0.4+ 把所有 LLM 调用都抽到了 `prompts/` 目录文件 + GUI 可视化编辑。
> 这一页教你怎么用 GUI 改、怎么新建版本、怎么针对不同朋友定制 voice。

## 8 个 prompt 都在哪

| Prompt | 用途 | 文件 | env 切换 |
|---|---|---|---|
| `diary` | 每日 `/diary` | `prompts/diary_v1.md` / `diary_v1_1.md` | `DIARY_PROMPT_VERSION` |
| `weekly` | 每周 `/week` | `prompts/weekly_v1.md` | `WEEKLY_PROMPT_VERSION` |
| `drafts_twitter` | `/draft <id>` 推特串 | `prompts/drafts_twitter_v1.md` | `DRAFTS_TWITTER_PROMPT_VERSION` |
| `drafts_long` | `/draft <id> --long` 公众号长文 | `prompts/drafts_long_v1.md` | `DRAFTS_LONG_PROMPT_VERSION` |
| `drafts_video` | `/draft <id> --video` 短视频脚本 | `prompts/drafts_video_v1.md` | `DRAFTS_VIDEO_PROMPT_VERSION` |
| `self_review_single` | `echolog self-review` 单日审稿 | `prompts/self_review_single_v1.md` | `SELF_REVIEW_SINGLE_PROMPT_VERSION` |
| `self_review_advice` | `self-review` 末尾 prompt 建议 | `prompts/self_review_advice_v1.md` | `SELF_REVIEW_ADVICE_PROMPT_VERSION` |
| `vision_describe` | 视觉模型解析图片 | `prompts/vision_describe_v1.md` | `VISION_DESCRIBE_PROMPT_VERSION` |

**不配 env = 用默认 v1**（每个 prompt 都保证有 v1 baseline，开箱即用）。

## 在 GUI 里改 prompt（推荐）

1. 打开桌面 app → 左侧 `Prompt 编辑`（快捷键 `⌘4`）
2. **左上方下拉** 切到要改的 prompt 类型（8 选 1）
3. 右侧 Monaco 编辑器里改（markdown 高亮 + 行号 + ⌘S 保存）
4. 保存自动备份旧版到 `prompts/<name>_<version>.md.backup-<时间戳>`
5. `echolog restart` 让 bot 主进程重新加载

## 新建版本（针对不同朋友定制 voice）

场景：朋友 A 想要正经一点的 voice，朋友 B 想要轻松一点的 —— 用版本机制隔离。

1. GUI「Prompt 编辑」→ 选要复制的版本（如 `diary_v1`）
2. 左下角 `从当前复制新建版本` → 起个名（如 `friend1` 或 `formal`）
3. Monaco 里改成朋友 A 的 voice → 保存
4. 切「配置」页 → 「Prompt 版本」段 → `DIARY_PROMPT_VERSION` 下拉选 `friend1`
5. `echolog restart`

之后想切回默认：再回去 `DIARY_PROMPT_VERSION=v1` 即可。

## 占位符（{{XXX}}）—— bot 启动时自动注入

写 prompt 时可以用 `{{XXX}}` 占位符，bot 会从 `.env` 拿值：

| 占位符 | 来源 | 默认值 |
|---|---|---|
| `{{USER_NAME}}` | `.env` USER_NAME | `我` |
| `{{USER_IDENTITY}}` | `.env` USER_IDENTITY | `独立开发者 / 知识工作者` |
| `{{USER_PROJECTS}}` | `.env` USER_PROJECTS | `（暂未填写）` |
| `{{USER_CONTENT_FOCUS}}` | `.env` USER_CONTENT_FOCUS | `工作复盘 + 学习沉淀 + 生活观察` |
| `{{USER_TONE_HINT}}` | `.env` USER_TONE_HINT | `克制理性、有距离感、重证据、不鸡汤` |

加上调用方注入的特殊占位符：

| Prompt | 特殊占位符 | 含义 |
|---|---|---|
| `weekly` | `{{CORPUS}}` | 过去 N 天的 raw_logs / diary 数据源 |
| `self_review_single` | `{{DIARY_CONTENT}}` | 单日 diary 全文（已剥离 frontmatter） |
| `self_review_advice` | `{{DAY_COUNT}}` / `{{PER_DAY_RESULTS}}` / `{{RATINGS_BLOCK}}` / `{{CURRENT_PROMPT_BLOCK}}` | N 天审稿结果 + 用户评分 + 当前 prompt 文本 |

## prompt 文件格式

```markdown
---
type: <prompt-type>
version: v1
created: 2026-05-28
description: 一句话说这个版本的特征
---

## SYSTEM

（这里写 system 角色的内容；对 vision-describe 这种不需要 system 的可以省略 SYSTEM 段，
 或者写「（说明文本）」之类的纯说明文本——bot 会识别为空）

## TEMPLATE

（这里是 user 角色的内容。可以用 {{XXX}} 占位符）
```

**硬规则**：
- **`## TEMPLATE` 段必填**
- `## SYSTEM` 段可选（vision 之类的用例）
- frontmatter（开头的 `---` 块）会被砍掉

## 常见定制场景

### 场景 1：朋友只要日报 + 周报，不要自媒体选题

`prompts/diary_v1.md` 里有「📝 自媒体选题（Content Ideas）」段。直接在 GUI 复制 v1 → 新建 `simple` 版本 → 删掉选题段 → 设 `DIARY_PROMPT_VERSION=simple`。

### 场景 2：朋友想要更短的日报（3 段就够）

复制 `diary_v1` → 新建 `short`，删到只剩：
- `## 📋 事实清单` 
- `## ✅ 今天的实际产出` 
- `## ❓ 明天的我会问什么`

设 `DIARY_PROMPT_VERSION=short` + restart。

### 场景 3：周报截止改成上周日

`.env` 设：
```
WEEKLY_RANGE_DAYS=7
WEEKLY_RANGE_END_OFFSET=-1   # 截至昨天（避免「今天还在记的不进周报」）
```

### 场景 4：朋友的工作语气更轻松（不要"克制理性"的硬规则）

最简方案：改 `.env` 的 `USER_TONE_HINT=轻松幽默、有人情味、会自嘲`。这一行会自动注入 8 个 prompt 的 system 段。

进阶方案：复制 `diary_v1` 起新版本，把开头「你是「五年后的我」」改成「你是我自己的小本本」之类的，把禁词清单也放宽。

## 我把朋友的 prompt 改坏了怎么办

每次保存都会备份。打开 `prompts/` 目录看 `*.backup-<时间戳>` 文件，把内容 cp 回去即可。

或者直接 `git checkout prompts/<name>_<version>.md` 回到原版（每个 baseline v1 都在 git 里）。

## 进阶：通过 `echolog prompt` 命令查看版本状态

```bash
echolog prompt
# 输出当前所有 prompt 的版本 + 切换说明
```
