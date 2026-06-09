// 一次性脚手架：把 Daily_Vault 配置成可用的 Obsidian Vault
//   1. 创建推荐目录骨架（_MOCs / _Templates / _Dataview / 100_Projects 等）
//   2. 铺种子内容（4 个起始 MOC、3 个回顾模板、4 个 Dataview 查询）
//   3. 下载并安装 Obsidian 社区插件（Dataview / Templater / Calendar / Periodic Notes / Tag Wrangler）
//   4. 写 .obsidian/community-plugins.json 启用它们
//
// 入口：echolog setup-vault
// 幂等：再次执行时已存在的文件/插件不会被覆盖（除非手动删除后重跑）

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const { VAULT_DIR } = require('./paths');

const DIRS = [
  '_MOCs',
  '_Templates',
  '_Dataview',
  '_weekly',
  '100_Projects',
  '200_Areas',
  '300_Resources',
  '400_Archive',
  'Notes',
];

const PLUGINS = [
  { id: 'dataview',           repo: 'blacksmithgu/obsidian-dataview',           hasStyles: true  },
  { id: 'templater-obsidian', repo: 'SilentVoid13/Templater',                   hasStyles: true  },
  { id: 'calendar',           repo: 'liamcain/obsidian-calendar-plugin',        hasStyles: true  },
  { id: 'periodic-notes',     repo: 'liamcain/obsidian-periodic-notes',         hasStyles: false },
  { id: 'tag-wrangler',       repo: 'pjeby/tag-wrangler',                       hasStyles: false },
];

// ---------- 工具 ----------

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`  ⏭ 已存在，跳过：${path.relative(VAULT_DIR, filePath)}`);
    return false;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ 写入：${path.relative(VAULT_DIR, filePath)}`);
  return true;
}

async function downloadFile(url, savePath) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const buf = await r.arrayBuffer();
  fs.writeFileSync(savePath, Buffer.from(buf));
}

// ---------- 步骤 1 + 2：目录骨架 + 种子内容 ----------

async function setupDirsAndSeeds() {
  console.log('\n📁 创建目录骨架...');
  ensureDir(VAULT_DIR);
  for (const d of DIRS) ensureDir(path.join(VAULT_DIR, d));

  console.log('\n📝 铺种子内容...');

  // ----- MOCs -----
  writeIfMissing(path.join(VAULT_DIR, '_MOCs', '🤖 AI 商业笔记 MOC.md'), `---
type: moc
topic: AI 商业笔记
tags: [moc, category/AI改变商业, category/AIBuilder实操]
---

# 🤖 AI 商业笔记 MOC

> 我对 AI × 商业的核心观点和素材入口。echolog 自动归档的散点 + 手动维护的中枢。

## 我的核心观点
- AI 不是替换人，是改变成本结构
- 独立开发者是 AI-native 业态最大的受益者
- 全球化 SaaS 的窗口期还在打开
- （持续补充）

## 进行中的核心问题
- ⏳ 怎么让 AI Builder 的工具组合从"拼接"走向"集成"？
- ⏳ ProjectA / ProjectB 下一步如何用 AI 重做？

## 链接到的笔记（手动）
- [[2026-05-01/02_diary_v3]] —— 调试 bot 时关于 API 限制的发现

## 自动 Dataview：按 #category/AI改变商业 拉相关日记
\`\`\`dataview
LIST
FROM #category/AI改变商业 OR #category/AIBuilder实操
SORT date DESC
LIMIT 30
\`\`\`

## 待沉淀的散点
- [ ] 整理「AI Builder 工具组合 v1」
- [ ] 写一篇「90% SaaS 创业者忽视的 AI API 隐藏限制」
`);

  writeIfMissing(path.join(VAULT_DIR, '_MOCs', '🚀 产品复盘 MOC.md'), `---
type: moc
topic: 产品复盘
tags: [moc, project/ProjectA, project/ProjectB, category/真实创业暴露]
---

# 🚀 产品复盘 MOC（ProjectA + example-saas.com）

> 真实暴露的产品复盘。坑、教训、转型决策。

## ProjectA
（在这里展开 ProjectA 的关键里程碑、PMF 信号、流量数据）

## example-saas.com
（同上）

## 决策日志（重要决策）
\`\`\`dataview
TABLE date, status, domain
FROM "_Templates" OR ""
WHERE type = "decision-log"
SORT date DESC
\`\`\`

## 自动 Dataview：按 #project 拉相关日记
\`\`\`dataview
LIST
FROM #project/ProjectA OR #project/ProjectB
SORT date DESC
LIMIT 30
\`\`\`
`);

  writeIfMissing(path.join(VAULT_DIR, '_MOCs', '🌱 个人成长 MOC.md'), `---
type: moc
topic: 个人成长
tags: [moc, category/长期主义思考, category/数字游民日常]
---

# 🌱 个人成长 MOC

> 长期主义 / 修心 / 决策框架 / 元认知。

## 我相信的事
- 长期主义 + 知行合一
- 修心 + 搞钱 + 看世界
- 真实暴露 > 包装成功

## 关注的核心议题
- [ ] 如何在调试工具和真正交付之间分配时间（避免假勤奋）
- [ ] 数字游民模式下的家庭参与
- [ ] 如何持续输出而不被流量焦虑绑架

## 自动 Dataview：状态自审摘录
\`\`\`dataview
LIST WITHOUT ID
  "**" + date + "**"
FROM ""
WHERE type = "daily-diary" AND date >= date(today) - dur(30 days)
SORT date DESC
\`\`\`
`);

  writeIfMissing(path.join(VAULT_DIR, '_MOCs', '💡 选题素材库 MOC.md'), `---
type: moc
topic: 选题素材库
tags: [moc, status/选题库]
---

# 💡 选题素材库 MOC

> echolog 每天自动新增的选题落到 \`Notes/\`。这里是选题的总入口和成熟度看板。

## 🌳 成熟（可直接动手）
\`\`\`dataview
TABLE WITHOUT ID
  file.link as 选题,
  category as 主题,
  format as 形式,
  created as 加入时间
FROM "Notes"
WHERE type = "content-idea" AND contains(maturity, "🌳")
SORT created DESC
\`\`\`

## 🌿 雏形（需要补数据/截图）
\`\`\`dataview
TABLE WITHOUT ID
  file.link as 选题,
  category as 主题,
  created as 加入时间
FROM "Notes"
WHERE type = "content-idea" AND contains(maturity, "🌿")
SORT created DESC
\`\`\`

## 🌱 萌芽（需要孵化角度）
\`\`\`dataview
LIST
FROM "Notes"
WHERE type = "content-idea" AND contains(maturity, "🌱")
SORT created DESC
LIMIT 50
\`\`\`

## 主题分布
\`\`\`dataview
TABLE WITHOUT ID
  category as 主题,
  length(rows) as 数量
FROM "Notes"
WHERE type = "content-idea"
GROUP BY category
SORT length(rows) DESC
\`\`\`
`);

  // ----- Templates -----
  writeIfMissing(path.join(VAULT_DIR, '_Templates', 'Weekly Review.md'), `---
type: weekly-review
week: <% tp.date.now("YYYY-[W]ww") %>
range: <% tp.date.now("YYYY-MM-DD", -6) %> ~ <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.date.now("YYYY-[W]ww") %> 周回顾

## ⏪ 跑 echolog
- 终端：\`echolog logs\` 看本周日志
- 飞书发 \`/week\` 让 bot 生成结构化周报

## 📊 本周数据
（从 echolog frontmatter 聚合）
\`\`\`dataview
TABLE date, action_items, content_ideas, ticktick_tasks_synced
FROM ""
WHERE type = "daily-diary" AND date >= date(today) - dur(7 days)
SORT date DESC
\`\`\`

## 🌟 本周高光（3-5 个）

## 🪞 模式识别
- 反复出现的拖延：
- 反复出现的情绪：
- 新尝试的：

## 💡 沉淀到 Evergreen Notes 的观点

## 📝 选题进度
- 🌱 萌芽：
- 🌿 雏形：
- 🌳 成熟（可动手）：

## 🎯 下周锚点（3 件最重要的）
- [ ]
- [ ]
- [ ]
`);

  writeIfMissing(path.join(VAULT_DIR, '_Templates', 'Monthly Retro.md'), `---
type: monthly-retro
month: <% tp.date.now("YYYY-MM") %>
---

# <% tp.date.now("YYYY-MM") %> 月度复盘

## 📊 数据扫描
\`\`\`dataview
TABLE date, action_items, content_ideas, ticktick_notes_synced
FROM ""
WHERE type = "daily-diary" AND startswith(string(date), "<% tp.date.now('YYYY-MM') %>")
SORT date DESC
\`\`\`

## 🌳 这个月成型的选题
\`\`\`dataview
LIST
FROM "Notes"
WHERE type = "content-idea" AND contains(maturity, "🌳") AND startswith(string(created), "<% tp.date.now('YYYY-MM') %>")
\`\`\`

## 🏗 决策日志
- **决策**：
  **当时考虑**：
  **预期结果**：
  **半年后回看（待填）**：

## 📈 PARA 大扫除
- Projects → 是否还在推进？要不要进 Archive？
- Areas → 状态健康吗？
- Resources → 收的素材消化了多少？

## 🎯 下月 OKR

## 💭 给三个月后的我留张便条
`);

  writeIfMissing(path.join(VAULT_DIR, '_Templates', 'Decision Log.md'), `---
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
`);

  writeIfMissing(path.join(VAULT_DIR, '_Templates', 'Content Idea Maturation.md'), `---
type: content-idea
title:
status: 🌱 萌芽
created: <% tp.date.now("YYYY-MM-DD") %>
target_format:
target_platform:
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
- 雏形 → 成熟：
- 成熟 → 成稿：
- 发布：

## 💬 试讲
（自己念一遍录下来听是否顺，不顺的地方就是逻辑断点）

## 🔗 相关
- [[]] —— 灵感来源
`);

  // ----- Dataview queries (single files for easy copy) -----
  writeIfMissing(path.join(VAULT_DIR, '_Dataview', '过去 30 天数据扫描.md'), `# 📊 过去 30 天数据扫描

\`\`\`dataview
TABLE
  date as 日期,
  action_items as 任务,
  content_ideas as 选题,
  ticktick_tasks_synced as 同步任务,
  image_count as 图片
FROM ""
WHERE type = "daily-diary"
SORT date DESC
LIMIT 30
\`\`\`
`);

  writeIfMissing(path.join(VAULT_DIR, '_Dataview', '待办落地率追踪.md'), `# 🎯 待办落地率追踪

> 重复率高 = 你反复给自己加同样的 Action Item 但都没做。这是个**强信号**。

\`\`\`dataview
TABLE
  date as 日期,
  ticktick_tasks_synced as 创建,
  ticktick_tasks_skipped as 重复跳过,
  default(round((ticktick_tasks_skipped / (ticktick_tasks_synced + ticktick_tasks_skipped)) * 100), 0) as "重复率%"
FROM ""
WHERE type = "daily-diary" AND ticktick_tasks_synced > 0
SORT date DESC
\`\`\`
`);

  writeIfMissing(path.join(VAULT_DIR, '_Dataview', '选题成熟度分布.md'), `# 💡 选题成熟度分布

\`\`\`dataview
TABLE WITHOUT ID
  file.link as 选题,
  category as 主题,
  maturity as 成熟度,
  created as 加入日期
FROM "Notes"
WHERE type = "content-idea"
SORT created DESC
LIMIT 50
\`\`\`

## 按主题分组
\`\`\`dataview
TABLE WITHOUT ID
  category as 主题,
  length(filter(rows, (r) => contains(r.maturity, "🌳"))) as "🌳 成熟",
  length(filter(rows, (r) => contains(r.maturity, "🌿"))) as "🌿 雏形",
  length(filter(rows, (r) => contains(r.maturity, "🌱"))) as "🌱 萌芽"
FROM "Notes"
WHERE type = "content-idea"
GROUP BY category
\`\`\`
`);

  writeIfMissing(path.join(VAULT_DIR, '_Dataview', '反复出现的拖延.md'), `# 🔁 反复出现的拖延

> 用全局搜索更直接：Cmd+Shift+F → \`逾期 \\d+ 天\`
> 然后这里手动归纳哪些任务名反复出现。

## 提示
1. 在 Obsidian 里 Cmd+Shift+F（全局搜索）
2. 搜索 \`逾期 \\d+ 天\`（启用正则模式）
3. 看哪个任务名出现 3+ 次 = 真·拖延清单
4. 每个搬到下面手动追踪

## 反复出现的任务

| 任务 | 第一次出现 | 最近出现 | 处理 |
|---|---|---|---|
|  |  |  |  |
`);

  // ----- README in vault root -----
  writeIfMissing(path.join(VAULT_DIR, 'README.md'), `# Daily Vault

> echolog 自动归档 + Obsidian 知识管理系统的 Vault 根目录。

## 目录说明

- \`YYYY-MM-DD/\` —— echolog 每天自动落档（raw_logs / diary / assets）
- \`_weekly/\` —— \`/week\` 命令生成的周报
- \`Notes/\` —— 自动从滴答清单 Notes 项目镜像过来的选题
- \`_MOCs/\` —— Maps of Content：主题中枢，**手动维护**
- \`_Templates/\` —— Templater 模板（周回顾 / 月复盘 / 决策日志）
- \`_Dataview/\` —— 跨日期统计查询，一键看模式
- \`100_Projects/\` —— PARA: 当前推进的项目
- \`200_Areas/\` —— PARA: 持续职责
- \`300_Resources/\` —— PARA: 收藏素材
- \`400_Archive/\` —— PARA: 已完成 / 不再相关

## 使用 Tips

1. 每天发 \`/diary\` 让 echolog 生成深度复盘
2. 每周日跑 \`/week\` + 用 \`_Templates/Weekly Review.md\` 模板做周回顾
3. 每月 1 号用 \`_Templates/Monthly Retro.md\` 做月度复盘
4. \`_Dataview/\` 里的查询每周打开看一次

## 推荐插件（已自动安装）

- **Dataview** —— 跨日期查询
- **Templater** —— 模板系统
- **Calendar** —— 日历视图
- **Periodic Notes** —— 周/月/季/年笔记
- **Tag Wrangler** —— 标签批量管理

详细使用方法见 \`OBSIDIAN_GUIDE.md\`（项目根目录）。
`);

  console.log('✅ 目录骨架 + 种子内容完成');
}

// ---------- 步骤 3：下载 Obsidian 插件 ----------

async function installPlugins() {
  console.log('\n🧩 下载 Obsidian 社区插件...');
  const obsidianDir = path.join(VAULT_DIR, '.obsidian');
  const pluginsDir = path.join(obsidianDir, 'plugins');
  ensureDir(pluginsDir);

  for (const p of PLUGINS) {
    const dest = path.join(pluginsDir, p.id);
    if (fs.existsSync(path.join(dest, 'main.js')) && fs.existsSync(path.join(dest, 'manifest.json'))) {
      console.log(`  ⏭ 已安装：${p.id}`);
      continue;
    }
    ensureDir(dest);
    const baseUrl = `https://github.com/${p.repo}/releases/latest/download`;
    try {
      console.log(`  ⬇️  ${p.id} (from ${p.repo})`);
      await downloadFile(`${baseUrl}/main.js`, path.join(dest, 'main.js'));
      await downloadFile(`${baseUrl}/manifest.json`, path.join(dest, 'manifest.json'));
      if (p.hasStyles) {
        try {
          await downloadFile(`${baseUrl}/styles.css`, path.join(dest, 'styles.css'));
        } catch (err) {
          // styles.css 是可选的，下载失败不致命
          console.log(`     (无 styles.css，跳过)`);
        }
      }
      console.log(`     ✅ ${p.id} 安装成功`);
    } catch (err) {
      console.error(`     ❌ ${p.id} 失败: ${err.message}`);
    }
  }

  // 安装本地自建插件 echolog-ai
  const localPluginSrc = path.join(__dirname, 'obsidian-plugin', 'echolog-ai');
  if (fs.existsSync(localPluginSrc)) {
    const localPluginDest = path.join(pluginsDir, 'echolog-ai');
    ensureDir(localPluginDest);
    for (const f of ['main.js', 'manifest.json']) {
      const srcF = path.join(localPluginSrc, f);
      const destF = path.join(localPluginDest, f);
      if (fs.existsSync(srcF)) fs.copyFileSync(srcF, destF);
    }
    console.log(`  ✅ echolog-ai (本地自建) 安装成功`);
  }

  // 启用插件
  const cpFile = path.join(obsidianDir, 'community-plugins.json');
  let enabled = [];
  if (fs.existsSync(cpFile)) {
    try { enabled = JSON.parse(fs.readFileSync(cpFile, 'utf8')); } catch {}
  }
  for (const p of PLUGINS) {
    if (!enabled.includes(p.id) && fs.existsSync(path.join(pluginsDir, p.id, 'main.js'))) {
      enabled.push(p.id);
    }
  }
  // 启用 echolog-ai
  if (!enabled.includes('echolog-ai') && fs.existsSync(path.join(pluginsDir, 'echolog-ai', 'main.js'))) {
    enabled.push('echolog-ai');
  }
  fs.writeFileSync(cpFile, JSON.stringify(enabled, null, 2));
  console.log(`\n✅ 已在 .obsidian/community-plugins.json 启用 ${enabled.length} 个插件`);

  // 写最简版 app.json，关掉受限模式（restricted mode），让插件能跑
  const appFile = path.join(obsidianDir, 'app.json');
  if (!fs.existsSync(appFile)) {
    fs.writeFileSync(appFile, JSON.stringify({
      promptDelete: false,
      alwaysUpdateLinks: true,
    }, null, 2));
  }
}

// ---------- 主入口 ----------

async function run() {
  console.log('🛠  echolog setup-vault');
  console.log(`📂 Vault: ${VAULT_DIR}`);

  await setupDirsAndSeeds();

  try {
    await installPlugins();
  } catch (err) {
    console.error(`\n⚠️  插件安装失败：${err.message}`);
    console.error('  你可以稍后再跑一次 echolog setup-vault 重试，或在 Obsidian 里手动从 Community Plugins 安装。');
  }

  console.log('\n✨ 完成！');
  console.log('\n下一步：');
  console.log('  1. 用 Obsidian 打开 vault：open -a Obsidian "' + VAULT_DIR + '"');
  console.log('  2. 第一次打开会询问"信任作者"——选信任，让插件运行');
  console.log('  3. 看 README.md 了解目录结构和用法');
}

if (require.main === module) {
  run().catch(err => {
    console.error('\n❌ setup-vault 失败:', err);
    process.exit(1);
  });
}

module.exports = { run, setupDirsAndSeeds, installPlugins };
