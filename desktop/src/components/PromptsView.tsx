import { useEffect, useState, useMemo } from 'react';
import { FileEdit, Save, Plus, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useToast } from './Toast';
import { useAppSettings } from './AppSettings';
import type { PromptRegistryEntry } from '../types';

export function PromptsView() {
  const [registry, setRegistry] = useState<PromptRegistryEntry[]>([]);
  const [activeName, setActiveName] = useState<string>('diary');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const toast = useToast();
  const { fontSize } = useAppSettings();

  const activeEntry = useMemo(() => registry.find(r => r.name === activeName), [registry, activeName]);

  const refresh = async () => {
    const reg = await window.api.listPromptRegistry();
    setRegistry(reg);
    if (reg.length === 0) return;
    // 默认选 active 那个；若 active 没了就选第一个
    const entry = reg.find(r => r.name === activeName) || reg[0];
    if (!selectedVersion && entry.versions.length) {
      const latest = entry.versions[entry.versions.length - 1];
      await openVersion(entry.name, latest);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function openVersion(name: string, v: string) {
    const c = await window.api.readPrompt(name, v);
    if (c == null) {
      toast.error(`读取 prompts/${name}_${v}.md 失败`);
      return;
    }
    setActiveName(name);
    setSelectedVersion(v);
    setContent(c);
    setOriginalContent(c);
  }

  async function save() {
    if (!selectedVersion) return;
    // 校验：必须含 ## TEMPLATE（## SYSTEM 是可选的，vision-describe 可以没有）
    if (!content.includes('## TEMPLATE')) {
      toast.error('prompt 必须含 "## TEMPLATE" 段');
      return;
    }
    setSaving(true);
    const r = await window.api.writePrompt(activeName, selectedVersion, content);
    setSaving(false);
    if (r.ok) {
      toast.success(`已保存 ${r.file}（旧版自动备份）。bot 需要 restart 加载新内容`);
      setOriginalContent(content);
      refresh();
    } else {
      toast.error(`保存失败：${r.error}`);
    }
  }

  async function createNew() {
    const name = newVersionName.trim();
    if (!/^[a-z0-9_]+$/.test(name)) {
      toast.error('版本名只能含小写字母/数字/下划线，例 v1_2、v2、prod');
      return;
    }
    if (activeEntry?.versions.includes(name)) {
      toast.error(`版本 ${name} 已存在`);
      return;
    }
    const r = await window.api.writePrompt(activeName, name, content);
    if (r.ok) {
      toast.success(`新版本 ${r.file} 已创建。启用：去「配置」改 ${activeEntry?.envKey}=${name}`);
      setCreating(false);
      setNewVersionName('');
      await refresh();
      await openVersion(activeName, name);
    } else {
      toast.error(`创建失败：${r.error}`);
    }
  }

  const isDirty = content !== originalContent;
  const editorFontSize = fontSize === 'small' ? 12 : fontSize === 'large' ? 15 : 13;

  return (
    <div className="flex h-full">
      {/* 左侧：prompt name 选择 + 版本列表 */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-950/70 flex flex-col">
        <PromptNameSelector
          registry={registry}
          activeName={activeName}
          isDirty={isDirty}
          onSelect={(name) => {
            const entry = registry.find(r => r.name === name);
            if (!entry || !entry.versions.length) {
              setActiveName(name);
              setSelectedVersion(null);
              setContent('');
              setOriginalContent('');
              return;
            }
            const latest = entry.versions[entry.versions.length - 1];
            if (isDirty && !confirm('当前编辑未保存，切换会丢失改动。要切吗？')) return;
            openVersion(name, latest);
          }}
        />

        <div className="px-3 py-2 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">版本</span>
          <button onClick={refresh} className="text-zinc-500 hover:text-zinc-200" title="刷新">
            <RefreshCw size={12} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {(activeEntry?.versions || []).map(v => (
            <li key={v}>
              <button
                onClick={() => isDirty
                  ? confirm(`${selectedVersion} 还没保存，切换会丢失改动。要切吗？`) && openVersion(activeName, v)
                  : openVersion(activeName, v)
                }
                className={`w-full text-left px-3 py-2 text-sm font-mono border-l-2 ${
                  selectedVersion === v
                    ? 'bg-zinc-800 text-zinc-50 border-blue-400'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border-transparent'
                }`}
              >
                {activeName}_{v}.md
                {selectedVersion === v && isDirty && <span className="text-amber-400 ml-1.5" title="未保存">●</span>}
              </button>
            </li>
          ))}
          {activeEntry?.versions.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-600">该类型还没有 prompt 文件</li>
          )}
        </ul>

        <div className="border-t border-zinc-800 p-2">
          {!creating ? (
            <button
              onClick={() => { setCreating(true); setNewVersionName(''); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 py-2 rounded"
            >
              <Plus size={12} /> 从当前复制新建版本
            </button>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="新版本名 (如 v1_2)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') createNew(); if (e.key === 'Escape') setCreating(false); }}
              />
              <div className="flex gap-1">
                <button onClick={createNew} className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white py-1 rounded">建</button>
                <button onClick={() => setCreating(false)} className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1 rounded">取消</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：Monaco 编辑器 */}
      <div className="flex-1 flex flex-col">
        {!selectedVersion ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600 px-8 text-center">
            {activeEntry
              ? `「${activeEntry.label}」还没有任何版本文件。点左下「从当前复制新建版本」可以建第一个。`
              : '左上方选一个 prompt 类型'}
          </div>
        ) : (
          <>
            <header className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileEdit size={14} className="text-zinc-500 flex-shrink-0" />
                <span className="font-mono text-sm truncate">prompts/{activeName}_{selectedVersion}.md</span>
                {isDirty && <span className="text-xs text-amber-400">●  未保存</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.api.openInFinder(`prompts/${activeName}_${selectedVersion}.md`)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
                  title="在 Finder 中打开"
                >
                  <ExternalLink size={12} /> Finder
                </button>
                <button
                  onClick={save}
                  disabled={!isDirty || saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                    isDirty && !saving ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Save size={13} /> {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </header>
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={content}
                onChange={(v) => setContent(v || '')}
                theme="vs-dark"
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                  tabSize: 2,
                  bracketPairColorization: { enabled: true },
                  padding: { top: 12, bottom: 12 },
                }}
                onMount={(editor, monaco) => {
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
                }}
              />
            </div>
            <footer className="border-t border-zinc-800 px-5 py-2 text-xs text-zinc-500 flex items-center justify-between font-mono">
              <span>{content.length.toLocaleString()} 字符 · {content.split('\n').length} 行 · ⌘S 保存</span>
              <span className="truncate ml-4">必须含 ## TEMPLATE；支持 {`{{USER_NAME}}`} / {`{{CORPUS}}`} 等占位符</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function PromptNameSelector({
  registry, activeName, isDirty, onSelect,
}: {
  registry: PromptRegistryEntry[];
  activeName: string;
  isDirty: boolean;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = registry.find(r => r.name === activeName);
  return (
    <div className="px-3 py-3 border-b border-zinc-800 relative">
      <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium block mb-1.5">Prompt 类型</span>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
      >
        <span className="truncate text-left flex-1">
          {active ? active.label : activeName}
          <span className="text-xs text-zinc-500 ml-1.5">({active?.versions.length || 0} 版)</span>
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-10 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {registry.map(r => (
            <button
              key={r.name}
              onClick={() => { onSelect(r.name); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 ${
                r.name === activeName ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{r.label}</span>
                <span className="text-xs text-zinc-500 flex-shrink-0">{r.versions.length} 版</span>
              </div>
              <div className="text-xs text-zinc-600 truncate">{r.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
