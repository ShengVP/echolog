import { useState, useCallback } from 'react';
import { Search, Sparkles, Calendar } from 'lucide-react';
import type { SearchHit, SemanticHit, ViewName } from '../types';
import { useToast } from './Toast';

type Mode = 'keyword' | 'semantic';

interface Props {
  onJumpToDate?: (date: string) => void;
  onJumpView?: (v: ViewName) => void;
}

export function SearchView({ onJumpToDate, onJumpView }: Props) {
  const [mode, setMode] = useState<Mode>('keyword');
  const [query, setQuery] = useState('');
  const [includeDiaries, setIncludeDiaries] = useState(true);
  const [keywordHits, setKeywordHits] = useState<SearchHit[] | null>(null);
  const [semanticHits, setSemanticHits] = useState<SemanticHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      if (mode === 'keyword') {
        const hits = await window.api.searchKeyword(query.trim(), { includeDiaries });
        setKeywordHits(hits);
        setSemanticHits(null);
        if (hits.length === 0) toast.info('没找到匹配');
      } else {
        const r = await window.api.searchSemantic(query.trim(), { topK: 10 });
        if (!r.ok) {
          setError(r.error || '语义检索失败');
          toast.error(`语义检索失败：${r.error || '未知'}`);
        }
        setSemanticHits(r.hits);
        setKeywordHits(null);
        if (r.ok && r.hits.length === 0) toast.info('没找到匹配；终端跑 echolog reindex 先建库');
      }
    } finally {
      setSearching(false);
    }
  }, [mode, query, includeDiaries, toast]);

  const jump = (date: string) => {
    if (onJumpToDate) onJumpToDate(date);
    if (onJumpView) onJumpView('diary');
  };

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-bold mb-1">跨日搜索</h1>
        <p className="text-sm text-zinc-500">关键词全文 grep / 语义向量检索（需先 reindex）</p>
      </header>

      <div className="mb-4 flex gap-2 border-b border-zinc-800">
        <ModeTab active={mode === 'keyword'}  onClick={() => setMode('keyword')}  icon={Search}    label="关键词" />
        <ModeTab active={mode === 'semantic'} onClick={() => setMode('semantic')} icon={Sparkles}  label="语义" />
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
          placeholder={mode === 'keyword' ? '输入关键词（≥ 2 字符）...' : '描述你想找的主题，例：飞书 bot 调试'}
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          autoFocus
        />
        <button
          onClick={runSearch}
          disabled={searching || !query.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium"
        >
          {searching ? '搜索中...' : '搜索'}
        </button>
      </div>

      {mode === 'keyword' && (
        <label className="flex items-center gap-2 text-xs text-zinc-500 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDiaries}
            onChange={(e) => setIncludeDiaries(e.target.checked)}
            className="rounded border-zinc-600"
          />
          包含 diary 文件（关掉只搜 raw_logs）
        </label>
      )}

      {error && <div className="bg-rose-950 border border-rose-900 rounded-lg p-3 text-sm text-rose-300 mb-4">{error}</div>}

      {mode === 'keyword' && keywordHits !== null && (
        <KeywordResults hits={keywordHits} query={query} onJumpToDate={jump} />
      )}
      {mode === 'semantic' && semanticHits !== null && (
        <SemanticResults hits={semanticHits} onJumpToDate={jump} />
      )}
    </div>
  );
}

function ModeTab({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
        active ? 'border-blue-400 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function KeywordResults({ hits, query, onJumpToDate }: { hits: SearchHit[]; query: string; onJumpToDate: (d: string) => void }) {
  if (hits.length === 0) return <p className="text-sm text-zinc-500">没匹配到结果</p>;
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">命中 {hits.length} 条（按日期倒序，每文件最多 3 处上下文）</p>
      <div className="space-y-3">
        {hits.map((h, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-xs">
              <button
                onClick={() => onJumpToDate(h.date)}
                className="text-blue-400 hover:underline font-mono flex items-center gap-1"
              >
                <Calendar size={11} /> {h.date}
              </button>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${h.type === 'diary' ? 'bg-amber-900 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                {h.type === 'diary' ? `diary ${h.file.match(/v\d+/)?.[0] || ''}` : 'raw_logs'}
              </span>
            </div>
            {h.snippets.map((s, j) => (
              <div key={j} className="text-sm text-zinc-300 leading-relaxed mb-1.5 last:mb-0">
                {highlightQuery(s, query)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticResults({ hits, onJumpToDate }: { hits: SemanticHit[]; onJumpToDate: (d: string) => void }) {
  if (hits.length === 0) {
    return (
      <div className="text-sm text-zinc-500 leading-relaxed">
        没匹配到。原因可能是：
        <ul className="list-disc pl-5 mt-2 text-zinc-600">
          <li>还没建索引 —— 终端跑 <code className="bg-zinc-800 px-1 rounded text-amber-300">echolog reindex</code></li>
          <li>关键词在已索引内容里相似度 &lt; 0.35</li>
        </ul>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">top {hits.length}（按相似度排）</p>
      <div className="space-y-3">
        {hits.map((h, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-xs">
              <button
                onClick={() => onJumpToDate(h.date)}
                className="text-blue-400 hover:underline font-mono flex items-center gap-1"
              >
                <Calendar size={11} /> {h.date} {h.time}
              </button>
              <span className="text-amber-400">{(h.score * 100).toFixed(0)}%</span>
            </div>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{h.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function highlightQuery(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-amber-500/30 text-amber-200 px-0.5 rounded">{p}</mark>
      : <span key={i}>{p}</span>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
