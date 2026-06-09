import { useEffect, useState } from 'react';
import { Save, Eye, EyeOff, FileEdit, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from './Toast';
import type { LlmPingResult, ViewName, PromptRegistryEntry } from '../types';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'multiline' | 'bool' | 'number';
  options?: string[];
  hint?: string;
  required?: boolean;
}

interface Section {
  id: string;
  title: string;
  description: string;
  fields: FieldDef[];
}

const SECTIONS: Section[] = [
  {
    id: 'identity',
    title: '🧑 你是谁',
    description: '注入到 prompts/diary_*.md 模板 + drafts.js 的写作 voice',
    fields: [
      { key: 'USER_NAME', label: '名字 / 昵称', type: 'text', hint: '出现在 prompt 里" 名字：xxx"' },
      { key: 'USER_IDENTITY', label: '一句话身份', type: 'text', hint: '例：独立开发者 / 产品经理 / 学生 / 工程师' },
      { key: 'USER_PROJECTS', label: '在做的项目', type: 'text', hint: '多个用顿号；例：[[ProjectA]]、[[example-saas.com]]' },
      { key: 'USER_CONTENT_FOCUS', label: '想沉淀什么内容', type: 'text', hint: '例：工作复盘 + 学习沉淀 + 生活观察' },
      { key: 'USER_TONE_HINT', label: '写作语气偏好', type: 'text', hint: '例：克制理性、有距离感、重证据、不鸡汤' },
    ],
  },
  {
    id: 'feishu',
    title: '💬 飞书',
    description: '飞书开放平台 → 你的应用 → 凭证与基础信息',
    fields: [
      { key: 'FEISHU_APP_ID', label: 'App ID', type: 'text', required: true, hint: 'cli_xxx' },
      { key: 'FEISHU_APP_SECRET', label: 'App Secret', type: 'password', required: true },
    ],
  },
  {
    id: 'llm',
    title: '🧠 LLM Provider',
    description: '决定 /diary、/draft、/week 等命令用哪个大模型',
    fields: [
      { key: 'LLM_PROVIDER', label: 'Provider', type: 'select', options: ['ollama', 'openai'], hint: 'ollama=本地 / openai=云端兼容（DeepSeek/OpenAI/...）' },
      { key: 'LLM_API_BASE', label: 'API Base URL', type: 'text', hint: '云端 provider 时填，例: https://api.deepseek.com/v1' },
      { key: 'LLM_API_KEY', label: 'API Key', type: 'password', hint: 'sk-xxx' },
      { key: 'LLM_TEXT_MODEL', label: '文本模型', type: 'text', hint: '例: deepseek-chat / qwen3.5:9b' },
      { key: 'LLM_VISION_MODEL', label: '视觉模型', type: 'text', hint: '可空；不填则跳过图片解析' },
      { key: 'LLM_EMBED_MODEL', label: 'Embedding 模型', type: 'text', hint: '跨日 /recall 用' },
    ],
  },
  // 'prompt' section dynamically built below from PromptRegistryEntry[]
  {
    id: 'modules',
    title: '🎛 功能开关',
    description: '关掉用不到的模块（缺省都启用）',
    fields: [
      { key: 'ENABLE_TICKTICK',    label: '滴答清单集成',    type: 'bool', hint: '关掉则 /diary 不拉任务上下文 + 不同步 action items；/tasks /todo 禁用' },
      { key: 'ENABLE_DRAFTS',      label: '选题→写作流水线',  type: 'bool', hint: '关掉则 /draft 命令禁用（提醒：还要改 prompt 移除「选题」段）' },
      { key: 'ENABLE_URL_ENRICH',  label: '链接自动抓 og',    type: 'bool', hint: '关掉则发链接时不自动抓 title/description' },
      { key: 'ENABLE_ASR',         label: '语音转文字',       type: 'bool', hint: '关掉则收语音只存档' },
      { key: 'ENABLE_EMBEDDINGS',  label: '跨日记忆索引',     type: 'bool', hint: '关掉则 /diary 不异步索引 + /recall 禁用' },
    ],
  },
  {
    id: 'weekly',
    title: '📅 周报配置',
    description: '/week 命令的范围。从 (今天 + endOffset) 往前数 rangeDays 天',
    fields: [
      { key: 'WEEKLY_RANGE_DAYS',       label: '范围天数',  type: 'number', hint: '默认 7（一周）；5=工作周；14=双周报' },
      { key: 'WEEKLY_RANGE_END_OFFSET', label: '结束偏移',  type: 'number', hint: '默认 0=截至今天；-1=截至昨天（让今天还在记的不进周报）' },
    ],
  },
  {
    id: 'ticktick',
    title: '📋 滴答清单（可选）',
    description: '不用滴答清单可以全留空，所有 TickTick 功能会静默跳过',
    fields: [
      { key: 'TICKTICK_CLIENT_ID', label: 'Client ID', type: 'text' },
      { key: 'TICKTICK_CLIENT_SECRET', label: 'Client Secret', type: 'password' },
      { key: 'TICKTICK_TASKS_PROJECT_ID', label: 'Tasks 项目 ID', type: 'text', hint: '不设进 Notes / inbox / 具体 project_id' },
    ],
  },
  {
    id: 'tg',
    title: '✈️ Telegram（可选）',
    description: '只跑飞书可以留空',
    fields: [
      { key: 'TG_BOT_TOKEN', label: 'Bot Token', type: 'password' },
      { key: 'TG_OWNER_ID', label: 'Owner numeric ID', type: 'text' },
      { key: 'TG_PROXY_URL', label: '代理 URL', type: 'text', hint: '大陆访问 TG 用，例 http://127.0.0.1:7897' },
    ],
  },
  {
    id: 'ingest',
    title: '📲 HTTP /ingest（可选）',
    description: '让 Android 端 Tasker / HTTP Shortcuts 直接灌内容',
    fields: [
      { key: 'INGEST_TOKEN', label: 'Token', type: 'password', hint: '≥ 16 字符随机串，openssl rand -hex 24' },
      { key: 'INGEST_PORT', label: 'Port', type: 'text', hint: '默认 8766' },
    ],
  },
];

interface Props {
  onNavigate?: (v: ViewName) => void;
}

export function ConfigView({ onNavigate }: Props = {}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [promptRegistry, setPromptRegistry] = useState<PromptRegistryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [pingResult, setPingResult] = useState<LlmPingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const toast = useToast();

  useEffect(() => {
    window.api.readEnv().then(env => {
      setValues(env);
      setOriginal(env);
    });
    window.api.listPromptRegistry().then(setPromptRegistry);
  }, []);

  // 动态构建 Prompt 版本段
  const promptSection: typeof SECTIONS[number] | null = promptRegistry.length ? {
    id: 'prompt',
    title: '📜 Prompt 版本',
    description: '切换每个 prompt 用的版本。完整编辑去「Prompt 编辑」视图',
    fields: promptRegistry.map(r => ({
      key: r.envKey,
      label: r.label,
      type: 'select' as const,
      options: r.versions,
      hint: `${r.description}（默认 ${r.defaultVersion}）`,
    })),
  } : null;

  const isDirty = JSON.stringify(values) !== JSON.stringify(original);

  async function save() {
    setSaving(true);
    const r = await window.api.writeEnv(values);
    setSaving(false);
    if (r.ok) {
      toast.success('✓ 已保存到 .env（旧版自动备份）。bot 需要 echolog restart 才生效');
      setOriginal({ ...values });
    } else {
      toast.error(`保存失败：${r.error || '未知错误'}`);
    }
  }

  async function pingLlm() {
    setPinging(true);
    setPingResult(null);
    const r = await window.api.pingLlm();
    setPingResult(r);
    setPinging(false);
    if (r.ok) toast.success(`✓ ${r.provider}/${r.model} 通了（${r.durationSec}s，回复 "${r.reply?.slice(0, 30)}"）`);
    else toast.error(`✗ LLM 连接失败：${r.error}`);
  }

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-1">配置</h1>
          <p className="text-sm text-zinc-500">改完点保存。bot 需要 <code className="bg-zinc-800 px-1.5 rounded text-amber-300">echolog restart</code> 才生效</p>
        </div>
        <button
          onClick={save}
          disabled={!isDirty || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isDirty && !saving
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <Save size={14} /> {saving ? '保存中...' : isDirty ? '保存' : '无修改'}
        </button>
      </header>

      <div className="space-y-6">
        {[...SECTIONS, ...(promptSection ? [promptSection] : [])].map(section => (
          <section key={section.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{section.title}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{section.description}</p>
              </div>
              {section.id === 'llm' && (
                <button
                  onClick={pingLlm}
                  disabled={pinging}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200"
                  title="按当前 .env 配置调一次小请求"
                >
                  <Zap size={12} /> {pinging ? '测试中...' : '测连通'}
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              {section.id === 'llm' && pingResult && (
                <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  pingResult.ok ? 'bg-emerald-950 border border-emerald-900 text-emerald-300' : 'bg-rose-950 border border-rose-900 text-rose-300'
                }`}>
                  {pingResult.ok ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {pingResult.ok ? (
                      <>
                        <div><strong>{pingResult.provider}</strong> / <code className="font-mono">{pingResult.model}</code> · {pingResult.durationSec}s</div>
                        <div className="text-xs mt-0.5 truncate">reply: {pingResult.reply}</div>
                      </>
                    ) : (
                      <div className="break-words">{pingResult.error}</div>
                    )}
                  </div>
                </div>
              )}
              {section.fields.map(f => (
                <Field
                  key={f.key}
                  def={f}
                  value={values[f.key] ?? ''}
                  showSecret={showSecrets[f.key] || false}
                  onChange={v => setValues({ ...values, [f.key]: v })}
                  onToggleSecret={() => setShowSecrets({ ...showSecrets, [f.key]: !showSecrets[f.key] })}
                  selectOptions={f.options}
                />
              ))}
              {section.id === 'prompt' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">完整编辑（含 Monaco 高亮）：</span>
                  <button
                    onClick={() => onNavigate?.('prompts')}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <FileEdit size={12} /> 进入 Prompt 编辑视图
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {isDirty && (
        <div className="sticky bottom-4 mt-6 flex justify-center pointer-events-none">
          <button
            onClick={save}
            disabled={saving}
            className="pointer-events-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-medium shadow-lg flex items-center gap-2"
          >
            <Save size={16} /> {saving ? '保存中...' : '保存 .env 改动'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  def, value, showSecret, onChange, onToggleSecret, selectOptions,
}: {
  def: FieldDef;
  value: string;
  showSecret: boolean;
  onChange: (v: string) => void;
  onToggleSecret: () => void;
  selectOptions?: string[];
}) {
  const isSecret = def.type === 'password';
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        {def.label}
        {def.required && <span className="text-rose-400 ml-1">*</span>}
        <span className="ml-2 text-xs font-mono text-zinc-600">{def.key}</span>
      </label>
      {def.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
        >
          <option value="">（未设置 / 用默认）</option>
          {(selectOptions || []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : def.type === 'bool' ? (
        <BoolToggle value={value} onChange={onChange} />
      ) : def.type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.hint || ''}
          className="w-32 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none font-mono"
        />
      ) : (
        <div className="relative">
          <input
            type={isSecret && !showSecret ? 'password' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.hint || ''}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none font-mono pr-9"
          />
          {isSecret && (
            <button
              type="button"
              onClick={onToggleSecret}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              title={showSecret ? '隐藏' : '显示'}
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      )}
      {def.hint && <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{def.hint}</p>}
    </div>
  );
}

function BoolToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // .env 里的 bool 是 "true" / "false" 字符串；空字符串视为「用默认」
  const state: 'true' | 'false' | '' =
    value === 'true' || value === '1' ? 'true' :
    value === 'false' || value === '0' ? 'false' : '';
  return (
    <div className="inline-flex bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden text-sm">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`px-3 py-1.5 ${state === '' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
        title="未显式设置；用代码默认值"
      >默认</button>
      <button
        type="button"
        onClick={() => onChange('true')}
        className={`px-3 py-1.5 border-l border-zinc-700 ${state === 'true' ? 'bg-emerald-700 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
      >启用</button>
      <button
        type="button"
        onClick={() => onChange('false')}
        className={`px-3 py-1.5 border-l border-zinc-700 ${state === 'false' ? 'bg-rose-700 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
      >关闭</button>
    </div>
  );
}
