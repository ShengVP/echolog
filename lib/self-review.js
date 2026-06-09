// bot 自审 —— 让 LLM 审视过去 N 天的 diary，标出「真洞察」vs「水分句」
//
// 用法：echolog self-review [days]   （默认 7 天）
// 输出：Daily_Vault/_weekly/<YYYY>-W<NN>_self_review.md
//
// 设计：**逐天独立调用 LLM**，避免一次塞 N 天 diary 全文导致 LLM 被 priming 进 diary 风格
// 一遍跑 N+1 次：N 天每天一次审稿调用，最后一次合并 + 抽取 prompt 调优建议

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
const ollama = require('./llm');
const ratings = require('./ratings');

dayjs.extend(isoWeek);

const VAULT_DIR = path.join(__dirname, '..', 'Daily_Vault');
const WEEKLY_DIR = path.join(VAULT_DIR, '_weekly');
const TEXT_MODEL = process.env.LLM_TEXT_MODEL || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';

function listDiariesInRange(startDate, endDate) {
  if (!fs.existsSync(VAULT_DIR)) return [];
  const out = [];
  for (const d of fs.readdirSync(VAULT_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (d < startDate || d > endDate) continue;
    const dirPath = path.join(VAULT_DIR, d);
    const versions = fs.readdirSync(dirPath)
      .filter(f => /^02_diary_v\d+\.md$/.test(f))
      .sort();
    if (!versions.length) continue;
    const latest = versions[versions.length - 1];
    out.push({
      date: d,
      version: latest,
      content: fs.readFileSync(path.join(dirPath, latest), 'utf8'),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const promptsLib = require('./prompts');

// ==========================================================================
// 单日审稿 + 批次合并 —— prompt 文件走 prompts/self_review_single_<version>.md
// ==========================================================================
async function reviewSingleDay(diary) {
  const stripped = diary.content
    .replace(/^---[\s\S]*?---\n+/, '')      // 砍 frontmatter
    .replace(/^# .*\n+/, '');                // 砍 h1 标题
  const pair = promptsLib.loadPromptPair('self_review_single', undefined, {
    DIARY_CONTENT: stripped,
  });
  // template 段已经把 stripped 注入了，但 prompt 文件里还说"日期 + 版本"标签 — 拼到 user 头部
  const userPrompt = `日期：${diary.date}（${diary.version}）\n\n${pair.template}`;
  const r = await ollama.chat({
    model: TEXT_MODEL,
    messages: [
      ...(pair.system ? [{ role: 'system', content: pair.system }] : []),
      { role: 'user', content: userPrompt },
    ],
    think: false,
    stream: false,
    options: { temperature: 0.2, num_ctx: 16384 },
  });
  return r.message.content.trim();
}

async function derivePromptAdvice(perDayResults, ratingsList = []) {
  if (!perDayResults.length) return '（无审稿数据，跳过 prompt 调优建议）';
  const compact = perDayResults
    .map(r => `### ${r.date}\n${r.review}`)
    .join('\n\n---\n\n');
  // 把用户人工评分也喂给 LLM 作为外部信号 —— 让低分日的水分被加权关注
  const ratingsBlock = ratingsList.length
    ? `\n\n【用户人工评分（这是真实读者的反馈，比模型自审更权威）】\n` +
      ratingsList.map(r => `- ${r.date} v${r.version}: ${r.score}/5${r.comment ? ' — "' + r.comment + '"' : ''}`).join('\n') +
      `\n\n→ 评分 1-2 的天：水分尤其要重点抓；用户评语里的具体不满**必须**直接转化为 prompt 改动。\n→ 评分 4-5 的天：观察这些 diary 的写作模式，看能不能把「为什么这天好」也写进 prompt。\n`
    : '\n\n（用户尚无人工评分；建议鼓励用户每次 /diary 后用 /rate 留下反馈）\n';

  // 把当前 prompt 喂给 LLM，让它能引用真实文本写 diff（A 部分模块化后才能做这步）
  let currentPromptBlock = '';
  try {
    const prompts = require('./prompts');
    const pair = prompts.loadPromptPair('diary');
    currentPromptBlock = `\n\n【当前 DIARY prompt（${pair.version}）—— 你要改的对象】\n\n## SYSTEM\n${pair.system}\n\n## TEMPLATE\n${pair.template}\n`;
  } catch (err) {
    currentPromptBlock = `\n\n【当前 DIARY prompt 加载失败：${err.message}】\n（LLM 将基于审稿结果给出抽象建议而非可执行 diff）\n`;
  }

  const pair = promptsLib.loadPromptPair('self_review_advice', undefined, {
    DAY_COUNT: String(perDayResults.length),
    PER_DAY_RESULTS: compact,
    RATINGS_BLOCK: ratingsBlock,
    CURRENT_PROMPT_BLOCK: currentPromptBlock,
  });
  const r = await ollama.chat({
    model: TEXT_MODEL,
    messages: [
      ...(pair.system ? [{ role: 'system', content: pair.system }] : []),
      { role: 'user', content: pair.template },
    ],
    think: false,
    stream: false,
    options: { temperature: 0.2, num_ctx: 32768 },
  });
  return r.message.content.trim();
}

// ==========================================================================
// 主流程
// ==========================================================================
async function runSelfReview({ days = 7, today = dayjs() } = {}) {
  const end = today.format('YYYY-MM-DD');
  const start = today.subtract(days - 1, 'day').format('YYYY-MM-DD');
  const diaries = listDiariesInRange(start, end);
  if (!diaries.length) {
    throw new Error(`${start} ~ ${end} 没有任何 02_diary_v*.md`);
  }

  const range = `${start} ~ ${end}`;
  console.log(`🔍 审稿范围：${range}`);
  console.log(`📑 找到 ${diaries.length} 天的 diary`);
  console.log('');

  const perDayResults = [];
  for (let i = 0; i < diaries.length; i++) {
    const d = diaries[i];
    process.stdout.write(`  [${i + 1}/${diaries.length}] 审 ${d.date} (${d.version}) ... `);
    const t0 = Date.now();
    try {
      const review = await reviewSingleDay(d);
      perDayResults.push({ date: d.date, version: d.version, review });
      console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // 拉用户人工评分（喂给 advice prompt 作为外部信号）
  const ratingsList = ratings.loadRatings()
    .filter(r => r.date >= start && r.date <= end);

  console.log('');
  console.log(`🛠 抽取 prompt 调优建议${ratingsList.length ? `（含 ${ratingsList.length} 条用户评分）` : ''}...`);
  let advice = '';
  try {
    advice = await derivePromptAdvice(perDayResults, ratingsList);
  } catch (err) {
    advice = `（生成 prompt 调优建议失败：${err.message}）`;
  }
  const ratingsBlock = ratingsList.length
    ? `\n\n## ⭐ 用户对这几天的 diary 评分\n\n` +
      ratingsList.map(r => `- ${r.date} v${r.version}: ${r.score}/5${r.comment ? ' — ' + r.comment : ''}`).join('\n')
    : '';

  // 拼最终文件
  const reviewSection = perDayResults
    .map(r => `### ${r.date}（${r.version}）\n\n${r.review}`)
    .join('\n\n---\n\n');

  if (!fs.existsSync(WEEKLY_DIR)) fs.mkdirSync(WEEKLY_DIR, { recursive: true });
  const weekId = `${today.format('YYYY')}-W${String(today.isoWeek()).padStart(2, '0')}`;
  const outFile = path.join(WEEKLY_DIR, `${weekId}_self_review.md`);
  const fm = [
    '---',
    `type: self-review`,
    `week: ${weekId}`,
    `range: "${range}"`,
    `days: ${diaries.length}`,
    `model: ${TEXT_MODEL}`,
    `mode: per-day`,
    `generated_at: "${dayjs().format('YYYY-MM-DD HH:mm:ss')}"`,
    `tags: [self-review, ${today.format('YYYY-MM')}]`,
    '---',
    '',
    `# ${weekId} bot 自审（${range}）`,
    '',
    `逐天独立调用 LLM 审稿，避免被 diary 全文 priming。共 ${perDayResults.length} 天 + 末尾 prompt 调优建议。`,
    ratingsBlock,
    '',
    '## 📊 逐天审稿',
    '',
    reviewSection,
    '',
    '---',
    '',
    '## 🛠 Prompt 调优建议',
    '',
    advice,
    '',
  ].join('\n');
  fs.writeFileSync(outFile, fm);
  return { file: outFile, days: perDayResults.length, weekId };
}

if (require.main === module) {
  const days = parseInt(process.argv[2], 10) || 7;
  runSelfReview({ days })
    .then(r => {
      console.log('');
      console.log(`✅ 自审完成 → ${r.file}`);
      console.log(`   覆盖 ${r.days} 天，${r.weekId}`);
    })
    .catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { runSelfReview };
