// Prompt 模块化加载 —— 从 prompts/<name>_<version>.md 读取，按 ## SYSTEM / ## TEMPLATE 切分
//
// 用法：
//   const { system, template } = loadPromptPair('diary');     // 用 .env 的 DIARY_PROMPT_VERSION，没有就 v1
//   const { system, template } = loadPromptPair('diary', 'v1_1');  // 显式版本
//
// 文件格式：prompts/diary_v1.md
//   ---
//   type: diary-prompt
//   version: v1
//   ---
//
//   ## SYSTEM
//
//   ...system prompt content...
//
//   ## TEMPLATE
//
//   ...template content...
//
// 切换：在 .env 改 DIARY_PROMPT_VERSION=v1_1 + echolog restart 即可。
// 回滚：把 .env 改回 DIARY_PROMPT_VERSION=v1。

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

// name → env 变量名（用户改 .env 就能切换版本；不改用 DEFAULT_VERSION）
const ENV_KEY = {
  diary:                'DIARY_PROMPT_VERSION',
  weekly:               'WEEKLY_PROMPT_VERSION',
  drafts_twitter:       'DRAFTS_TWITTER_PROMPT_VERSION',
  drafts_long:          'DRAFTS_LONG_PROMPT_VERSION',
  drafts_video:         'DRAFTS_VIDEO_PROMPT_VERSION',
  self_review_single:   'SELF_REVIEW_SINGLE_PROMPT_VERSION',
  self_review_advice:   'SELF_REVIEW_ADVICE_PROMPT_VERSION',
  vision_describe:      'VISION_DESCRIBE_PROMPT_VERSION',
};

// name → 默认版本（用户不配也能跑）
const DEFAULT_VERSION = {
  diary:                'v1',
  weekly:               'v1',
  drafts_twitter:       'v1',
  drafts_long:          'v1',
  drafts_video:         'v1',
  self_review_single:   'v1',
  self_review_advice:   'v1',
  vision_describe:      'v1',
};

// 给 GUI / doctor 用：列出所有支持的 prompt name + 中文标签
const PROMPT_REGISTRY = [
  { name: 'diary',              label: '日记', description: '每日 /diary 命令的 system + template' },
  { name: 'weekly',             label: '周报', description: '/week 命令；含 {{CORPUS}} 占位符注入数据源' },
  { name: 'drafts_twitter',     label: '草稿 · 推特串', description: '/draft <id>' },
  { name: 'drafts_long',        label: '草稿 · 公众号长文', description: '/draft <id> --long' },
  { name: 'drafts_video',       label: '草稿 · 短视频', description: '/draft <id> --video' },
  { name: 'self_review_single', label: '自审 · 单日审稿', description: 'echolog self-review' },
  { name: 'self_review_advice', label: '自审 · 改 prompt 建议', description: 'echolog self-review 末尾' },
  { name: 'vision_describe',    label: '视觉描述', description: '/diary 视觉模型解析图片用；SYSTEM 段为空' },
];

function listAllPromptNames() {
  return PROMPT_REGISTRY.slice();
}

function resolveVersion(name, override) {
  if (override) return override;
  const envKey = ENV_KEY[name];
  if (envKey && process.env[envKey]) return process.env[envKey];
  return DEFAULT_VERSION[name] || 'v1';
}

function listAvailableVersions(name) {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs.readdirSync(PROMPTS_DIR)
    .filter(f => f.startsWith(`${name}_`) && f.endsWith('.md'))
    .map(f => f.replace(/^.*?_/, '').replace(/\.md$/, ''))
    .sort();
}

// {{KEY}} 占位符替换。未在 vars 里出现的 key 保留原样（不报错，便于增量迁移）。
function interpolate(text, vars = {}) {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
  });
}

// 从 .env 抽出用户身份变量（统一从这里出，避免每个 caller 自己读）
// 所有变量都有 fallback 默认值 → 不填 .env 也能跑（默认是「中性」voice）
function userVars() {
  return {
    USER_NAME: process.env.USER_NAME || '我',
    USER_IDENTITY: process.env.USER_IDENTITY || '独立开发者 / 知识工作者',
    USER_TONE_HINT: process.env.USER_TONE_HINT || '克制理性、有距离感、重证据、不鸡汤',
    USER_CONTENT_FOCUS: process.env.USER_CONTENT_FOCUS || '工作复盘 + 学习沉淀 + 生活观察',
    USER_PROJECTS: process.env.USER_PROJECTS || '（暂未填写）',
  };
}

function loadPromptPair(name, override, extraVars = {}) {
  const version = resolveVersion(name, override);
  const file = path.join(PROMPTS_DIR, `${name}_${version}.md`);
  if (!fs.existsSync(file)) {
    const available = listAvailableVersions(name);
    throw new Error(
      `找不到 prompt 文件 ${file}\n` +
      `已有版本：${available.length ? available.join(', ') : '(无)'}\n` +
      (ENV_KEY[name] ? `修改 .env 的 ${ENV_KEY[name]} 切换版本` : '')
    );
  }
  const raw = fs.readFileSync(file, 'utf8');
  // 砍 frontmatter
  const body = raw.replace(/^---[\s\S]*?---\n+/, '');
  // 切 ## SYSTEM ... ## TEMPLATE ...
  const sysAnchor = '## SYSTEM';
  const tmplAnchor = '## TEMPLATE';
  const sysIdx = body.indexOf(sysAnchor);
  const tmplIdx = body.indexOf(tmplAnchor);
  if (tmplIdx === -1) throw new Error(`${file}: 缺少 ## TEMPLATE 段`);
  // SYSTEM 段可选（例：vision-describe 不需要 system role）—— 缺失时 system = ""
  let rawSystem = '';
  if (sysIdx !== -1) {
    if (tmplIdx < sysIdx) throw new Error(`${file}: ## TEMPLATE 必须在 ## SYSTEM 之后`);
    rawSystem = body.slice(sysIdx + sysAnchor.length, tmplIdx).trim();
    // 「（视觉模型直接走...）」这种纯说明性括号文本视为空
    if (/^[（(].+[）)]$/m.test(rawSystem) && rawSystem.split('\n').length <= 2) {
      rawSystem = '';
    }
  }
  const rawTemplate = body.slice(tmplIdx + tmplAnchor.length).trim();
  const vars = { ...userVars(), ...extraVars };
  return {
    name,
    version,
    file,
    system: interpolate(rawSystem, vars),
    template: interpolate(rawTemplate, vars),
  };
}

// 仅返回当前 prompt 的元信息（doctor 用 / /version 命令用）
function describePrompt(name, override) {
  const version = resolveVersion(name, override);
  const file = path.join(PROMPTS_DIR, `${name}_${version}.md`);
  return {
    name,
    version,
    file,
    exists: fs.existsSync(file),
    available: listAvailableVersions(name),
  };
}

module.exports = {
  loadPromptPair,
  resolveVersion,
  listAvailableVersions,
  describePrompt,
  interpolate,
  userVars,
  listAllPromptNames,
  PROMPT_REGISTRY,
  ENV_KEY,
  DEFAULT_VERSION,
  PROMPTS_DIR,
};
