// 功能开关 —— 让用户在 .env / GUI 里关掉不需要的模块
//
// 设计：所有 flag 函数每次现读 process.env，方便测试和热改 .env（虽然 bot 还是要 restart）
// 不缓存，避免静态求值踩到 dotenv.config() 顺序问题。

function readBool(name, defaultValue) {
  const v = (process.env[name] || '').toLowerCase().trim();
  if (v === '') return defaultValue;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  return defaultValue;
}

function readInt(name, defaultValue) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) ? v : defaultValue;
}

module.exports = {
  // —— 模块开关 ——
  enableTickTick: () => readBool('ENABLE_TICKTICK', true),     // false → /diary 跳过任务上下文 + 不同步 action items
  enableDrafts: () => readBool('ENABLE_DRAFTS', true),         // false → /draft 命令禁用（提示用户）
  enableUrlEnrich: () => readBool('ENABLE_URL_ENRICH', true),  // false → 发链接时不去抓 og 信息
  enableAsr: () => readBool('ENABLE_ASR', true),               // false → 收语音不调 whisper（只存档）
  enableEmbeddings: () => readBool('ENABLE_EMBEDDINGS', true), // false → /diary 不异步索引 + /recall 跳过

  // —— 周报配置 ——
  // 周报从 now + endOffset 那一天算起，往前数 rangeDays 天
  // 例：rangeDays=7, endOffset=0  → 今天前 7 天（默认）
  // 例：rangeDays=5, endOffset=0  → 今天前 5 天（仅工作日感）
  // 例：rangeDays=7, endOffset=-1 → 昨天前 7 天（让今天没满的不进周报）
  // 例：rangeDays=14, endOffset=0 → 双周报
  weeklyRangeDays: () => Math.max(1, Math.min(60, readInt('WEEKLY_RANGE_DAYS', 7))),
  weeklyEndOffset: () => readInt('WEEKLY_RANGE_END_OFFSET', 0),
};
