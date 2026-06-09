# Obsidian + echolog 实战指南

> 写给：知识工作者 / 独立开发者 / 内容创业者 / CEO 等需要长期管理碎片信息 + 系统化思考的人。
>
> 核心问题：怎么把 echolog 收集到的**每日碎片**和 Obsidian 这种**长期知识库**有机结合，让两边互相增强？

---

## 一、知识工作者怎么用 Obsidian（先看大家在玩什么）

理解了主流流派，再决定自己怎么用，比直接照抄一个模板要稳。

### 1.1 四大流派

| 流派 | 核心思想 | 谁在用 | 适合场景 |
|---|---|---|---|
| **PARA** | 按"行动距离"分四类：**P**rojects（有 deadline）/ **A**reas（持续职责）/ **R**esources（参考素材）/ **A**rchive（归档） | Tiago Forte、大量产品经理 / 顾问 | 项目驱动型工作，有明确交付物 |
| **Zettelkasten / 卡片盒** | 每条笔记**原子化** + **永久编号** + **密集互链**，让笔记之间产生意外连接 | Niklas Luhmann、学者、研究员 | 长期写作（书 / 论文）、深度研究 |
| **Evergreen Notes** | 笔记反复打磨成"长青"状态，每条都是独立观点 | Andy Matuschak、深度思考者 | 思想工作者，想沉淀核心观点 |
| **LYT (Linking Your Thinking)** | 用 **MOC（Map of Content）** 当索引中枢，让笔记自下而上聚簇 | Nick Milo、内容创作者 | 多主题穿插，需要快速 jump 视角 |

**实操观察**：99% 的人**最后都是混搭** —— 用 PARA 管项目 + 用 LYT 管知识 + 在 Daily Note 里捕捉碎片。

### 1.2 周期性回顾节奏（这是被低估的关键）

```
每日 (5 min)  ←  echolog /diary 的"事实清单 + 状态自审"自动覆盖
每周 (30 min) ←  echolog /week + 手动整理本周 MOC
每月 (1 hr)   ←  Dataview 跑 30 天统计 + 调整 PARA
每季 (3 hr)   ←  PARA 大扫除 + Areas 反思 + 下季 OKR
每年 (1 day)  ←  人生方向校准
```

很多人卡在"日记写了一堆没人看" —— 因为没有上层的回顾节奏把碎片**收上去**。**周回顾是最重要的一环**：把过去 7 天 Daily Note 里值得保留的观点提取成长青笔记 / MOC 节点。

### 1.3 知名玩家的实际打法（参考）

#### 独立开发者 / Indie Hackers
- **Pieter Levels (NomadList, RemoteOK)**：极简派，纯 plain text + 命令行 grep。证明了"工具不重要，长期写才重要"。
- **Sahil Lavingia (Gumroad)**：Roam → Obsidian 迁移者，用 daily note 记产品决策 + 反思，定期发 Twitter / 长文。
- **国内独立开发者圈**：很多人用 Obsidian 写「indie 周记」公开发，强迫自己每周思考 PMF / 增长。

#### 思想家 / 研究者
- **Andy Matuschak**（[andymatuschak.org](https://andymatuschak.org/)）：Evergreen Notes 标杆，**笔记直接公开**作为输出。"working with the garage door up"。
- **Linus Lee**：LLM + 个人笔记 hybrid，用 embedding 做 personal RAG。
- **Maggie Appleton**：Visual Essays + 笔记可视化。

#### 内容创业者 / 媒体人
- **Tim Ferriss / Naval / James Clear**：素材库 + 选题库 + 成稿库 三段式。每天采集，每周筛选，每月成稿。
- **国内自媒体大号**：用 Obsidian 管选题池（按"已发 / 待写 / 想法"分），用 Dataview 看选题成熟度分布，避免"灵感来了写不动 / 想写时没素材"的两难。

#### 创业者 / CEO
- **公开案例较少**（多数 CEO 不晒系统），但模式相对一致：
  - **每周 1-1 笔记** 单独一个文件夹，每个直接下属一份
  - **决策日志**（Decision Log）记录大决策的当时思路 + 半年后回看
  - **客户访谈库** 用 tag 系统标注 pain points
  - **战略素材** 按主题打 tag，季度复盘时用 Dataview 聚合

### 1.4 一个被低估的事实

**笔记多 ≠ 用得好**。看到 Reddit 上有人 5000 篇笔记但每天还是焦虑、健忘 —— 因为他们卡在"采集"环节，没有进入"提炼 → 输出"。

**真正有效的人都做到了下面三件事之一**：
- **公开输出**（被迫精炼思路 → 推特 / 博客 / newsletter）
- **教别人**（被问到 → 笔记反向找答案 → 暴露漏洞 → 补全）
- **跟自己历史对话**（Dataview 翻 1 年前的我，看打脸 / 印证）

echolog 的 `/diary` 输出 + Obsidian 的 Dataview 把后两件事自动化了 —— 这是它的核心价值。

---

## 二、推荐的 Vault 结构（直接 copy 改）

把 `Daily_Vault/` 直接挂成 Obsidian Vault（你已经在做了），下面是建议增补的目录结构。**带 `_` 前缀的目录排在最上面方便找，不带的就是 daily 入口**。

```
Daily_Vault/                       ← Obsidian Vault root
├── 2026-05-01/                    ← echolog 自动写
│   ├── 01_raw_logs.md
│   ├── 02_diary_v1.md
│   ├── 02_diary_v2.md
│   └── assets/
├── _weekly/                       ← echolog /week 写
│   └── 2026-W18.md
│
├── _MOCs/                         ← Maps of Content：主题中枢
│   ├── 🤖 AI 商业笔记 MOC.md       ← 链接到所有相关 daily 节点
│   ├── 🚀 产品推广 MOC.md
│   ├── 🌱 个人成长 MOC.md
│   ├── 💡 选题素材库 MOC.md
│   └── 🏗 决策日志 MOC.md
│
├── _Templates/                    ← Templater 插件用
│   ├── Weekly Review.md
│   ├── Monthly Retro.md
│   ├── Quarterly OKR.md
│   ├── Decision Log.md
│   └── Content Idea Maturation.md
│
├── _Dataview/                     ← 保存的查询，一键查看模式
│   ├── 待办落地率.md
│   ├── 选题成熟度分布.md
│   ├── 月度情绪曲线.md
│   └── 反复出现的拖延.md
│
├── 100_Projects/                  ← PARA - P：当前推进中的具体项目
│   ├── echolog 私密日记/
│   └── ProjectB 增长实验/
│
├── 200_Areas/                     ← PARA - A：持续职责（无 deadline）
│   ├── 健康/
│   ├── 学习/
│   └── 财务/
│
├── 300_Resources/                 ← PARA - R：值得收藏的素材
│   ├── 优质长文/
│   ├── 工具/
│   └── 行业观察/
│
└── 400_Archive/                   ← PARA - A：已完成 / 不再相关
```

> 不需要一开始就齐全，**先开 `_MOCs/` + `_Templates/`**，其他按需开。

---

## 三、echolog 跟 Obsidian 怎么咬合

### 3.1 自动化层（已经实现，无需配置）

| echolog 产物 | Obsidian 怎么用 |
|---|---|
| `Daily_Vault/<date>/01_raw_logs.md` | Daily Note 自动入口，按时间戳 append |
| `Daily_Vault/<date>/02_diary_v{N}.md` | 当日深度复盘，带 `action_items` / `content_ideas` frontmatter |
| `Daily_Vault/_weekly/<YYYY>-W<NN>.md` | 周报，frontmatter 标记 `range` |
| `Daily_Vault/<date>/assets/` | 图片 / 语音 / 视频原文件，markdown 直接 inline |
| 滴答清单同步 | Action Items 在 TT 主 Inbox；选题在 TT Notes 项目 |

### 3.2 Obsidian 侧需要装的插件

**必装**：
- **Dataview** —— 跨日期查询（这是 echolog frontmatter 的杀手锏）
- **Templater** —— 周回顾 / 月回顾模板
- **Calendar** —— 日历视图，一眼看哪天有 diary

**强烈推荐**：
- **Periodic Notes** —— Daily / Weekly / Monthly / Quarterly / Yearly 一键创建
- **Tag Wrangler** —— 把 raw_logs 里散落的 tag 集中管理
- **Excalidraw** —— 画思维图（适合月度回顾）
- **Smart Connections** —— 本地 embedding 做语义相关推荐

**进阶**：
- **DB Folder** —— 把 daily diary frontmatter 当数据库视图
- **Tasks** —— 跨日期 task 聚合（虽然主任务在滴答，但 Obsidian 侧可做对照）

### 3.3 关键 Dataview 查询（直接 copy 到 `_Dataview/` 下）

#### 📊 「过去 30 天我都做了什么」

````markdown
```dataview
TABLE 
  date as 日期,
  action_items as 任务数,
  content_ideas as 选题数,
  ticktick_tasks_synced as 同步任务,
  image_count as 图片数,
  file.size as 字数
FROM ""
WHERE type = "daily-diary"
SORT date DESC
LIMIT 30
```
````

#### 🎯 「待办落地率追踪」

````markdown
```dataview
TABLE 
  date as 日期,
  ticktick_tasks_synced as 创建,
  ticktick_tasks_skipped as 重复跳过,
  round((ticktick_tasks_skipped / (ticktick_tasks_synced + ticktick_tasks_skipped)) * 100) as 重复率
FROM ""
WHERE type = "daily-diary" AND ticktick_tasks_synced > 0
SORT date DESC
```
````
> 重复率高 = 你反复给自己加同样的 Action Item 但都没做。这是个**强信号**。

#### 💡 「选题成熟度分布」

````markdown
```dataview
TABLE WITHOUT ID
  L.text as 选题,
  date as 加入日期
FROM ""
WHERE type = "daily-diary"
FLATTEN file.lists as L
WHERE contains(L.text, "🌳") OR contains(L.text, "🌿")
SORT date DESC
LIMIT 50
```
````
> 成熟（🌳）和雏形（🌿）的选题集中视图，方便挑成稿。

#### 🪞 「最近一周的状态自审摘录」

````markdown
```dataview
LIST WITHOUT ID
  "**" + date + "**: " + (file.frontmatter.tags)
FROM ""
WHERE type = "daily-diary" AND date >= date(today) - dur(7 days)
SORT date DESC
```
````

#### 🔁 「反复出现的拖延」

打开命令面板搜 "Search in folder"，搜全文 `逾期\d+天` 或 `(逾期 \d+ 天)`。
然后用 Dataview 把出现频次最高的任务挑出来 —— 这就是你的**真·拖延清单**。

---

## 四、推荐的周期性回顾模板

### 4.1 每周 — `_Templates/Weekly Review.md`

```markdown
---
type: weekly-review
week: <% tp.date.now("YYYY-[W]ww") %>
range: <% tp.date.now("YYYY-MM-DD", -6) %> ~ <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.date.now("YYYY-[W]ww") %> 周回顾

## ⏪ 跑一下 echolog
在终端执行:
- `echolog logs -f` 看本周日志
- 或在飞书发 `/week` 让 bot 生成结构化周报

## 📊 本周数据
（从 echolog frontmatter 聚合）
- 总文字量：
- 总任务创建：
- 总选题创建：
- 已完成任务：
- 平均每天 logs 长度：

## 🎯 上周遗留 → 本周完成情况

## 🌟 本周高光（3-5 个）

## 🪞 模式识别
- 这周反复出现的拖延：
- 这周反复出现的情绪：
- 这周新尝试的：

## 💡 沉淀到 Evergreen Notes 的观点

## 📝 选题进度
（从 Notes 项目搬过来还活的选题）
- 🌱 萌芽：
- 🌿 雏形：
- 🌳 成熟（可动手）：

## 🎯 下周锚点（3 件最重要的）
- [ ] 
- [ ] 
- [ ] 
```

### 4.2 每月 — `_Templates/Monthly Retro.md`

```markdown
---
type: monthly-retro
month: <% tp.date.now("YYYY-MM") %>
---

# <% tp.date.now("YYYY-MM") %> 月度复盘

## 📊 数据扫描
（用 Dataview 从 30 天 daily-diary 聚合）

## 🌳 这个月成型的选题（已发 / 待发）

## 🏗 决策日志（这个月做的关键决策）
- **决策**：……
  **当时考虑**：……
  **预期结果**：……
  **半年后回看（待填）**：

## 📈 PARA 大扫除
- Projects → 是否还在推进？要不要进 Archive？
- Areas → 状态健康吗？
- Resources → 收的素材消化了多少？

## 🎯 下月 OKR

## 💭 给三个月后的我留张便条
```

### 4.3 决策日志 — `_Templates/Decision Log.md`

```markdown
---
type: decision-log
date: <% tp.date.now("YYYY-MM-DD") %>
status: pending
domain: 
---

# 决策：[标题]

## 背景
（为什么需要决策）

## 选项
- A: 
- B: 
- C: 

## 选择
**选 [X]**

## 理由 & 当时心智
（写下你**当下**怎么想 —— 重要的是**心智**，不是结论）

## 假设
（如果哪些假设错了，决策就该重做）

## 复盘节点
- 1 周后：
- 1 个月后：
- 3 个月后：
- 半年后：
- 1 年后：
```

> 决策日志是 CEO / 创业者最该写的东西。半年后回看你会发现 50% 的决策当时理由根本不成立 —— 这才是认知升级的起点。

---

## 五、内容创业者专属：从 echolog 选题到成稿的工作流

这是给做内容的人（公众号 / 推特 / 视频 / 自媒体）的特别说明。

### 5.1 三阶段漏斗

```
echolog /diary 自动产出
        ↓
    [📝 选题]  ← 写到滴答清单 Notes 项目（成熟度: 🌱 / 🌿 / 🌳）
        ↓
   每周筛选（Obsidian _MOCs/💡 选题素材库.md）
        ↓
   🌳 成熟选题进入 Drafts/ 下笔
        ↓
   成稿后归 _Resources/ + 发布平台 frontmatter
```

### 5.2 选题成熟度的判断（直接抄）

| 等级 | 判断标准 |
|---|---|
| 🌱 **萌芽** | 只有一个有趣的点，但角度还没想清楚、结构没出来 |
| 🌿 **雏形** | 有清晰的"独特视角 + 反常识钩子 + 3-5 段骨架" |
| 🌳 **成熟** | 上面 + **数据/案例/截图都已经收齐**，可以直接坐下来 1 小时写完 |

echolog 的 prompt 已经强制每条选题标注成熟度。**回顾时的关键动作**：把 🌱 的选题往 🌿 推（补角度），把 🌿 的往 🌳 推（补数据）。

### 5.3 选题孵化模板 — `_Templates/Content Idea Maturation.md`

```markdown
---
type: content-idea
title: 
status: 🌱 萌芽
created: <% tp.date.now("YYYY-MM-DD") %>
target_format: 
target_platform: 
target_word_count: 
---

# [选题标题]

## 🪝 钩子（3 句话内勾住读者）

## 🎯 独特视角
我作为什么人 + 看到了什么别人没看到

## 📋 结构（3-5 段骨架）
1. 引子：
2. 转折/反常识：
3. 核心论点：
4. 例证（数据/截图/case）：
5. 启发/行动：

## 🧪 数据/案例素材清单
- [ ] 数据 1
- [ ] 截图 1
- [ ] 引用 1

## 📅 deadline
- 雏形 → 成熟：YYYY-MM-DD
- 成熟 → 成稿：YYYY-MM-DD
- 发布：YYYY-MM-DD

## 💬 试讲（自己念一遍录下来听是否顺）
[空 / 录音链接]

## 🔗 相关（链接到 echolog 里的源素材）
- [[2026-05-01/02_diary_v3]] — 灵感来源
```

### 5.4 一个关键习惯：选题"试讲"

写出来不一定能讲明白，讲明白也不一定能写出来。**🌳 成熟选题在动笔前用手机录一段 3 分钟自己念一遍**，听一下哪里磕巴 —— 那里就是逻辑断点。

---

## 六、echolog + Obsidian 的"特殊用法"

### 6.1 公开学习（Build in Public）
把 `Daily_Vault/` 的某一部分（_MOCs/ 或 _weekly/）放到一个 public Vault，自动同步发 GitHub Pages / Quartz / Obsidian Publish。
- 优点：被动 accountability + 网络效应
- 注意：daily diary 不要发，太私密。只发**沉淀过的**周/月回顾 + 公开选题 + 成稿。

### 6.2 跨年对话（Time Capsule）
每年 12 月跑一次：
```dataview
TABLE date, file.frontmatter as 当时
FROM ""
WHERE type = "decision-log" AND date <= date(today) - dur(365 days)
```
看 1 年前的决策日志，**别人很难给你的反馈，过去的你能给**。

### 6.3 Personal RAG（高阶）
把 Daily_Vault 整个 vault 喂给本地 Ollama embedding (`embeddinggemma:300m` 或 `qwen3-embedding:4b`)，存到 lance / chroma 向量库，做 `/recall <主题>` 跨年语义检索。

> 这是 echolog 后续可以加的功能。如果你想做告诉我，加一个 `/recall` 命令、本地 embed + retrieval 全套大概 200 行代码。

### 6.4 Public Notes for Topics
把选题成熟度 🌳 的笔记**同步到 Notion / 飞书文档 public 链接**，用作"公开思考"。这能把 echolog 当成你**公开思考的引擎**，逐步建立个人品牌。

---

## 七、给不同身份的"开张套餐"

### 7.1 独立开发者 / 技术创业者
**最少做这几件**：
1. `Daily_Vault/` 挂成 Vault
2. 每天 18:00 设置一个手机提醒 → DM bot `/diary`（强制每日复盘）
3. 周日晚跑 `/week` + 在 `_MOCs/💡 选题素材库.md` 里把 🌳 选题搬出来
4. 每月 1 号跑 `_Templates/Monthly Retro.md`
5. （可选）公开 `_weekly/` 到 GitHub repo

### 7.2 内容创作者
**额外做**：
1. 滴答 Notes 项目设为最常看的列表
2. 每周筛 🌳 选题，进入 `100_Projects/写作/` 单独建文件孵化
3. 成稿发布后把 echolog 里的源选题链回成稿（`backlink`）—— 形成「灵感 → 成稿」的可追溯链

### 7.3 CEO / 团队 leader
**重点放**：
1. **决策日志**（每周 2-3 条）— 这是你最贵的资产
2. **1-1 笔记** 每个直接下属一个文件夹
3. **客户访谈库** 用 tag 标注（`#客户痛点 #ICP特征 #价格敏感度`）
4. 季度跑 `_Templates/Quarterly OKR.md`，对照决策日志校准

### 7.4 研究员 / 学者
**额外做**：
1. 用 Zettelkasten 风格在 `_Resources/读书/` 下建 atomic notes
2. echolog 当 inbox 用，每周提取观点进永久笔记
3. 配 Smart Connections 插件做语义聚类

---

## 八、网状图（Graph View）怎么炼成 —— Obsidian 最被低估的能力

打开 Obsidian 看到那个**点连成线**的图谱，多数人觉得"好看但没用"。事实上它是 PKM 工具里最有价值的视图，前提是：**你的笔记必须能互相找到对方**。下面解释机制 + 怎么让 echolog 自动产出"图谱友好"的笔记。

### 8.1 三种连接方式（理解机制）

Obsidian 里**三件事**让两个笔记产生关联：

| 连接方式 | 写法 | 强度 | 出现在 graph view |
|---|---|:---:|:---:|
| **内部链接** \`[[xxx]]\` | 在文中写 \`[[飞书]]\` | 强（实线） | ✅ |
| **标签** \`#xxx\` | 文中或 frontmatter 写 \`#mood/低能量\` | 弱（标签层） | ✅（同标签的节点自动聚簇） |
| **frontmatter 字段** | YAML 里写 \`project: echolog\` | 中（需 Dataview 查询激活） | ✅（DB View / Dataview 才显） |

**关键洞察**：内部链接是**主力**。如果你的日记里只有纯文本，graph 就是一堆孤点；只要把"飞书 / 滴答清单 / ProjectA / 大秦帝国"等关键实体用 \`[[xxx]]\` 包一下，graph 立刻活起来。

### 8.2 echolog 已经为你做了什么

新版 prompt 强制 LLM 在 \`/diary\` 输出里：
1. **关键实体自动用 \`[[xxx]]\`**：项目名（[[ProjectA]] / [[example-saas.com]]）/ 工具名（[[滴答清单]] / [[飞书]] / [[Ollama]] / [[whisper.cpp]]）/ 概念词（[[PARA]] / [[Zettelkasten]] / [[SaaS]]）
2. **每段加 hashtag**：\`#mood/低能量\` / \`#theme/AI工具调试\` / \`#project/echolog\` / \`#category/AI赚钱实操\`

意思是你**不需要手动加任何东西**，每天的 echolog 输出落进 vault 后，graph 视图自动有节点 + 边。一周后打开 graph 就能看到主题聚簇。

### 8.3 标签的层级化设计（这是关键）

平铺的标签（\`#焦虑 #工作 #AI\`）一多就乱。**用斜杠分层**：

```
mood/        ← 情绪
  ├── 低能量
  ├── 焦虑
  ├── 兴奋
  └── 平静

theme/       ← 主题
  ├── AI工具调试
  ├── 选题构思
  ├── 客户访谈
  └── 财务复盘

project/     ← 项目（对应 PARA 的 P）
  ├── ProjectA
  ├── ProjectB
  ├── echolog
  └── ...

category/    ← 内容方向（对应你的自媒体定位）
  ├── 真实创业暴露
  ├── AI赚钱实操
  ├── 长期主义思考
  └── 数字游民日常

status/      ← 任务/选题状态
  ├── 萌芽
  ├── 雏形
  └── 成熟
```

Obsidian 里 \`Tags\` 面板会自动按斜杠折叠成树，找的时候点 \`mood/\` 就能看到所有情绪相关的笔记。

### 8.4 实战：建立"主题 MOC + 入口节点"

光有 graph 还不够，要有**手动维护的主题入口**让你能从 graph 跳进具体专题。这就是 Map of Content（MOC）。

例：在 \`_MOCs/🤖 AI 商业笔记 MOC.md\` 里写：

```markdown
---
type: moc
topic: AI 商业笔记
---

# 🤖 AI 商业笔记 MOC

## 我对这个主题的核心观点
- AI 不是替换人，是改变成本结构
- 独立开发者是 AI-native 业态最大的受益者
- 全球化 SaaS 的窗口期还在打开

## 链接到的笔记（手动维护）
- [[2026-05-01/02_diary_v3]] — 调试 bot 时关于 API 限制的发现
- [[2026-04-28/02_diary_v1]] — 关于 PMF 的反思
- [[300_Resources/AI Builder 工具表]]

## 自动 Dataview 查询（按 #category/AI赚钱实操 拉相关日记）
\`\`\`dataview
LIST
FROM #category/AI赚钱实操
SORT date DESC
LIMIT 30
\`\`\`

## 待沉淀的散点
- [ ] 整理「AI Builder 工具组合 v1」
- [ ] 写一篇「90% 的 SaaS 创业者忽视了 AI API 隐藏限制」
```

MOC 是你**手动管的中枢**，echolog 每天产出的散点是**自动入库的卫星**。两者咬合 = 真正可复用的知识网。

### 8.5 怎么看 graph view 才有用

Obsidian 默认的 graph 是"全宇宙图"，意义不大。**用过滤器**：

打开 graph view 右上角设置：
- **Filters** → 输入 \`tag:#category/AI赚钱实操\` → 只看这个内容方向
- **Groups** → 按文件夹分颜色（PARA 的 100/200/300/400 各一种色）
- **Display** → 关掉 attachments / orphans

每个项目 / 内容方向开一张专属 graph 视图，比看全图有用 100 倍。

### 8.6 一个高阶玩法：Local Graph

每个笔记右上角点 "Open Local Graph" → 显示**当前笔记 1-3 度链接的小图**。打开 \`今日日记\` 看 local graph，能立刻看到今天的事跟 vault 里哪些主题有连接。

这是知识工作者最常用的视图 —— 比 global graph 实用。

### 8.7 一个反例：避免标签泛滥

不要给每个动词都加标签：
```
❌ #想 #试图 #尝试 #考虑 #打算
```

标签 = 类目，不是动词。一个 vault 全生命周期 50-100 个标签是上限。超过就是污染。

---

## 九、常见误区（避坑）

| 误区 | 说明 |
|---|---|
| **"我先把工具配齐了再开始用"** | 永远配不齐。先用 echolog 跑一周，再决定加什么。 |
| **"笔记越多越好"** | 错。笔记多到自己不想看，价值就归零。**周回顾比每日采集重要 10 倍**。 |
| **"我要追求一个完美的目录结构"** | 也错。结构是用出来的，不是设计出来的。先按上面的结构开工，1-2 个月后自然会知道哪里要调。 |
| **"标签 vs 文件夹之争"** | 都用。文件夹管"它属于哪"（PARA），标签管"它涉及什么"（主题、情绪、状态）。 |
| **"我得每天都写"** | 重要的是**节奏**不是密度。一周 3-4 天高质量比每天流水账强 100 倍。 |

---

## 十、把这份指南变成你的"开机仪式"

读完之后，建议这么做：

```bash
# 1. 进入 vault 目录
cd Daily_Vault

# 2. 创建上面提到的目录骨架
mkdir -p _MOCs _Templates _Dataview 100_Projects 200_Areas 300_Resources 400_Archive

# 3. 在 Obsidian 里打开 Daily_Vault 作为 vault
open -a Obsidian

# 4. 装上必装插件
#    Settings → Community plugins → Browse → Dataview / Templater / Calendar / Periodic Notes

# 5. 把上面的 Dataview 查询逐个 copy 到 _Dataview/ 下保存

# 6. 把上面的模板 copy 到 _Templates/ 下，配置 Templater 指向这个目录
```

然后每周日跑一次回顾，每月 1 号跑一次复盘，每季最后一周做大扫除。坚持 3 个月，你会突然发现：echolog 不是个工具，是你的**第二大脑外挂**。

---

## 参考资源

- Tiago Forte《Building a Second Brain》 —— PARA 系统的圣经
- Sönke Ahrens《How to Take Smart Notes》 —— Zettelkasten 入门
- Andy Matuschak [evergreen notes](https://notes.andymatuschak.org/Evergreen_notes) —— 长青笔记
- Nick Milo [Linking Your Thinking](https://www.linkingyourthinking.com/) —— LYT 方法论
- Obsidian 官方[文档](https://help.obsidian.md/)
- Dataview [文档](https://blacksmithgu.github.io/obsidian-dataview/)
