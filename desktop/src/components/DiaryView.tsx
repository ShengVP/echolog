import { useEffect, useState } from 'react';
import { Markdown } from './Markdown';
import { FolderOpen, Sparkles } from 'lucide-react';
import { useToast } from './Toast';

type Tab = 'raw' | 'diary';

interface Props {
  pendingDate?: string | null;
  onConsumePending?: () => void;
}

export function DiaryView({ pendingDate, onConsumePending }: Props = {}) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayData, setDayData] = useState<{
    rawLogs: string | null;
    diaries: { version: number; file: string; content: string; mtime: number }[];
    assets: string[];
  } | null>(null);
  const [tab, setTab] = useState<Tab>('raw');
  const [diaryVersion, setDiaryVersion] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  async function refreshDay() {
    if (!selectedDate) return;
    const d = await window.api.readDay(selectedDate);
    setDayData(d);
  }

  async function generateDiary() {
    if (!selectedDate) return;
    setGenerating(true);
    const r = await window.api.triggerCommand('diary', selectedDate);
    if (r.ok) {
      toast.success(`已触发 /diary ${selectedDate}（30s ~ 2min 内出新版本，自动刷新）`);
      // 30s 后 + 60s 后 + 120s 后各刷新一次
      setTimeout(() => refreshDay(), 30_000);
      setTimeout(() => refreshDay(), 60_000);
      setTimeout(() => { refreshDay(); setGenerating(false); }, 120_000);
    } else {
      toast.error(`触发失败：${r.error}（确认 bot 在运行 + 看 status 视图日志）`);
      setGenerating(false);
    }
  }

  useEffect(() => {
    window.api.listDates().then(ds => {
      setDates(ds);
      if (ds.length && !selectedDate) setSelectedDate(ds[0]);
    });
  }, []);

  // 跨视图跳转：SearchView → DiaryView 时带过来的日期
  useEffect(() => {
    if (pendingDate && dates.includes(pendingDate)) {
      setSelectedDate(pendingDate);
      onConsumePending?.();
    }
  }, [pendingDate, dates, onConsumePending]);

  useEffect(() => {
    if (!selectedDate) return;
    setDayData(null);
    window.api.readDay(selectedDate).then(d => {
      setDayData(d);
      // 默认 tab：有 diary 就先看 diary，没有就看 raw
      if (d.diaries.length) {
        setTab('diary');
        setDiaryVersion(d.diaries[d.diaries.length - 1].version);
      } else {
        setTab('raw');
        setDiaryVersion(null);
      }
    });
  }, [selectedDate]);

  return (
    <div className="flex h-full">
      {/* 日期列表 */}
      <div className="w-44 flex-shrink-0 border-r border-zinc-800 overflow-y-auto bg-zinc-950/70">
        <div className="sticky top-0 bg-zinc-950 px-3 py-2 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-medium">
          日期（{dates.length}）
        </div>
        {dates.length === 0 ? (
          <div className="p-4 text-xs text-zinc-600">
            还没有任何归档日期。
            <br />
            发条消息给飞书 bot 试试。
          </div>
        ) : (
          <ul>
            {dates.map(d => (
              <li key={d}>
                <button
                  onClick={() => setSelectedDate(d)}
                  className={`w-full text-left px-3 py-1.5 text-sm font-mono ${
                    selectedDate === d
                      ? 'bg-zinc-800 text-zinc-50 border-l-2 border-blue-400'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border-l-2 border-transparent'
                  }`}
                >
                  {d}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDate ? (
          <div className="h-full flex items-center justify-center text-zinc-600">
            从左边挑一天
          </div>
        ) : !dayData ? (
          <div className="h-full flex items-center justify-center text-zinc-600">
            加载中...
          </div>
        ) : (
          <div className="px-8 py-6 max-w-4xl mx-auto">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-zinc-100">{selectedDate}</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateDiary}
                  disabled={generating}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${
                    generating
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="调 bot 端 /diary 生成新版本"
                >
                  <Sparkles size={13} /> {generating ? '生成中（最多 2min）...' : '生成 / 重生成日记'}
                </button>
                <button
                  onClick={() => window.api.openInFinder(`Daily_Vault/${selectedDate}`)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800"
                  title="在 Finder 中打开"
                >
                  <FolderOpen size={13} /> 打开目录
                </button>
              </div>
            </div>

            {/* 元信息 */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-zinc-500">
              <span>raw_logs: {dayData.rawLogs ? `${dayData.rawLogs.length.toLocaleString()} 字符` : '无'}</span>
              <span>diary 版本: {dayData.diaries.length}</span>
              <span>媒体: {dayData.assets.length} 个</span>
            </div>

            {/* Tab 切换 */}
            <div className="flex items-center gap-1 mb-4 border-b border-zinc-800">
              <TabButton
                active={tab === 'raw'}
                onClick={() => setTab('raw')}
                label="raw_logs"
                badge={dayData.rawLogs ? '●' : ''}
              />
              <TabButton
                active={tab === 'diary'}
                onClick={() => dayData.diaries.length && setTab('diary')}
                label="diary"
                badge={dayData.diaries.length ? String(dayData.diaries.length) : ''}
                disabled={!dayData.diaries.length}
              />
              {tab === 'diary' && dayData.diaries.length > 1 && (
                <select
                  value={diaryVersion ?? ''}
                  onChange={(e) => setDiaryVersion(parseInt(e.target.value, 10))}
                  className="ml-auto bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 mb-1"
                >
                  {dayData.diaries.map(d => (
                    <option key={d.version} value={d.version}>v{d.version}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 内容 */}
            {tab === 'raw' && (
              dayData.rawLogs
                ? <Markdown content={dayData.rawLogs} dateContext={selectedDate} />
                : <div className="text-zinc-600">（无 raw_logs）</div>
            )}
            {tab === 'diary' && (
              dayData.diaries.length === 0
                ? <div className="text-zinc-600">还没生成 diary，飞书发 /diary 试试</div>
                : (() => {
                    const d = dayData.diaries.find(x => x.version === diaryVersion) || dayData.diaries[dayData.diaries.length - 1];
                    return <Markdown content={d.content} dateContext={selectedDate} />;
                  })()
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, label, badge, disabled,
}: { active: boolean; onClick: () => void; label: string; badge?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
        active
          ? 'border-blue-400 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {label}
      {badge && (
        <span className={`text-xs ${active ? 'text-blue-400' : 'text-zinc-600'}`}>{badge}</span>
      )}
    </button>
  );
}
