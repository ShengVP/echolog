// 纯字符串处理工具 —— 不依赖 fs / electron，独立可测
// 从 ipc.ts 抽出，让 vitest 在 jsdom 环境下不踩 vite-plugin-electron-renderer 的 node 模块 wrapper

export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  // 允许空 frontmatter (---\n---)，让 [\s\S]*  零或多
  const m = content.match(/^---\n([\s\S]*?)\n?---\n?/);
  if (!m) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[kv[1]] = val;
  }
  return { meta, body: content.slice(m[0].length).replace(/^\n+/, '') };
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

export function serializeEnv(values: Record<string, string>, header?: string): string {
  const lines: string[] = [];
  if (header) lines.push(header);
  const groups: Array<{ label: string; keys: string[] }> = [
    { label: '# 用户身份（注入 prompt 模板）', keys: ['USER_NAME', 'USER_IDENTITY', 'USER_PROJECTS', 'USER_CONTENT_FOCUS', 'USER_TONE_HINT'] },
    { label: '# 飞书', keys: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'] },
    { label: '# LLM Provider', keys: ['LLM_PROVIDER', 'LLM_API_BASE', 'LLM_API_KEY', 'LLM_TEXT_MODEL', 'LLM_VISION_MODEL', 'LLM_EMBED_MODEL'] },
    { label: '# Ollama (本地模型 fallback)', keys: ['OLLAMA_TEXT_MODEL', 'OLLAMA_VISION_MODEL', 'OLLAMA_EMBED_MODEL'] },
    { label: '# Telegram (可选)', keys: ['TG_BOT_TOKEN', 'TG_OWNER_ID', 'TG_PROXY_URL'] },
    { label: '# TickTick (可选)', keys: ['TICKTICK_CLIENT_ID', 'TICKTICK_CLIENT_SECRET', 'TICKTICK_TASKS_PROJECT_ID'] },
    { label: '# Prompt 版本（8 个 prompt 都能独立切版本）', keys: [
      'DIARY_PROMPT_VERSION', 'WEEKLY_PROMPT_VERSION',
      'DRAFTS_TWITTER_PROMPT_VERSION', 'DRAFTS_LONG_PROMPT_VERSION', 'DRAFTS_VIDEO_PROMPT_VERSION',
      'SELF_REVIEW_SINGLE_PROMPT_VERSION', 'SELF_REVIEW_ADVICE_PROMPT_VERSION',
      'VISION_DESCRIBE_PROMPT_VERSION',
    ] },
    { label: '# 功能开关', keys: ['ENABLE_TICKTICK', 'ENABLE_DRAFTS', 'ENABLE_URL_ENRICH', 'ENABLE_ASR', 'ENABLE_EMBEDDINGS'] },
    { label: '# 周报配置', keys: ['WEEKLY_RANGE_DAYS', 'WEEKLY_RANGE_END_OFFSET'] },
    { label: '# HTTP /ingest', keys: ['INGEST_TOKEN', 'INGEST_PORT'] },
  ];
  const handledKeys = new Set<string>();
  for (const g of groups) {
    const presentKeys = g.keys.filter(k => k in values);
    if (presentKeys.length === 0) continue;
    lines.push('');
    lines.push(g.label);
    for (const k of presentKeys) {
      const v = values[k] ?? '';
      const needQuote = /[#\s]/.test(v);
      lines.push(`${k}=${needQuote ? JSON.stringify(v) : v}`);
      handledKeys.add(k);
    }
  }
  const leftoverKeys = Object.keys(values).filter(k => !handledKeys.has(k));
  if (leftoverKeys.length) {
    lines.push('');
    lines.push('# 其它（GUI 未识别的 key）');
    for (const k of leftoverKeys) {
      const v = values[k] ?? '';
      const needQuote = /[#\s]/.test(v);
      lines.push(`${k}=${needQuote ? JSON.stringify(v) : v}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
