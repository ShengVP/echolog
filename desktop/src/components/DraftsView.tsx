import { useEffect, useState } from 'react';
import { Markdown } from './Markdown';
import { Sprout, TreeDeciduous, Leaf } from 'lucide-react';
import type { NoteSummary, DraftSummary } from '../types';

type Mode = 'notes' | 'drafts';

export function DraftsView() {
  const [mode, setMode] = useState<Mode>('notes');
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    window.api.listNotes().then(setNotes);
    window.api.listDrafts().then(setDrafts);
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setContent(null);
      return;
    }
    setContent(null);
    const fn = mode === 'notes' ? window.api.readNote : window.api.readDraft;
    fn(selectedFile).then(setContent);
  }, [selectedFile, mode]);

  return (
    <div className="flex h-full">
      <div className="w-72 flex-shrink-0 border-r border-zinc-800 overflow-y-auto bg-zinc-950/70">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 flex">
          <ModeTab active={mode === 'notes'} onClick={() => { setMode('notes'); setSelectedFile(null); }} label="选题" count={notes.length} />
          <ModeTab active={mode === 'drafts'} onClick={() => { setMode('drafts'); setSelectedFile(null); }} label="草稿" count={drafts.length} />
        </div>
        {mode === 'notes' ? (
          notes.length === 0 ? (
            <Empty hint="还没积累选题。每次 /diary 会产出 3-5 条进 Notes/" />
          ) : (
            <ul>
              {notes.map(n => (
                <li key={n.filename}>
                  <button
                    onClick={() => setSelectedFile(n.filename)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 border-l-2 ${
                      selectedFile === n.filename
                        ? 'bg-zinc-800 text-zinc-50 border-blue-400'
                        : 'text-zinc-400 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MaturityIcon maturity={n.maturity} />
                      <span className="truncate flex-1">{n.title}</span>
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">{n.created} · {n.category || '未分类'}</div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          drafts.length === 0 ? (
            <Empty hint="还没生成草稿。飞书发 /draft <id> 试试" />
          ) : (
            <ul>
              {drafts.map(d => (
                <li key={d.filename}>
                  <button
                    onClick={() => setSelectedFile(d.filename)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 border-l-2 ${
                      selectedFile === d.filename
                        ? 'bg-zinc-800 text-zinc-50 border-blue-400'
                        : 'text-zinc-400 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                      <FormatBadge format={d.format} />
                      <span className="text-zinc-600">{d.charCount} 字</span>
                    </div>
                    <div className="truncate">{d.sourceTitle}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{d.sourceDate}</div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedFile ? (
          <div className="h-full flex items-center justify-center text-zinc-600">
            从左边挑一条
          </div>
        ) : !content ? (
          <div className="h-full flex items-center justify-center text-zinc-600">
            加载中...
          </div>
        ) : (
          <div className="px-8 py-6 max-w-4xl mx-auto">
            <Markdown content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm border-b-2 transition-colors ${
        active ? 'border-blue-400 text-zinc-100 bg-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label} <span className="text-xs text-zinc-600">{count}</span>
    </button>
  );
}

function MaturityIcon({ maturity }: { maturity: string }) {
  if (maturity.includes('🌳')) return <TreeDeciduous size={14} className="text-emerald-400 flex-shrink-0" />;
  if (maturity.includes('🌿')) return <Leaf size={14} className="text-lime-400 flex-shrink-0" />;
  if (maturity.includes('🌱')) return <Sprout size={14} className="text-yellow-500 flex-shrink-0" />;
  return <span className="w-3.5 inline-block flex-shrink-0" />;
}

function FormatBadge({ format }: { format: string }) {
  const map: Record<string, { label: string; color: string }> = {
    twitter: { label: '推特串', color: 'bg-sky-900 text-sky-300' },
    long: { label: '长文', color: 'bg-amber-900 text-amber-300' },
    video: { label: '短视频', color: 'bg-rose-900 text-rose-300' },
  };
  const m = map[format] || { label: format || '?', color: 'bg-zinc-800 text-zinc-400' };
  return <span className={`px-1.5 py-0.5 rounded text-xs ${m.color}`}>{m.label}</span>;
}

function Empty({ hint }: { hint: string }) {
  return <div className="p-4 text-xs text-zinc-600 leading-relaxed">{hint}</div>;
}
