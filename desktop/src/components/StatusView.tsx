import { useEffect, useState } from 'react';
import { Stethoscope, RefreshCcw, Play, Square, RotateCw, ScrollText } from 'lucide-react';
import type { BotStatus, RatingsSummary, IndexStats } from '../types';
import { useToast } from './Toast';

export function StatusView() {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [ratings, setRatings] = useState<RatingsSummary | null>(null);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [doctorOutput, setDoctorOutput] = useState<string>('');
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorRanOnce, setDoctorRanOnce] = useState(false);
  const [botBusy, setBotBusy] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [logLines, setLogLines] = useState<string>('');
  const [logVisible, setLogVisible] = useState(false);
  const [logBusy, setLogBusy] = useState(false);
  const [logFollow, setLogFollow] = useState(false);
  const toast = useToast();

  function refresh() {
    window.api.getBotStatus().then(setBot);
    window.api.getRatings().then(setRatings);
    window.api.getIndexStats().then(setIndexStats);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(() => window.api.getBotStatus().then(setBot), 5000);
    return () => clearInterval(id);
  }, []);

  async function runDoctor() {
    setDoctorRunning(true);
    setDoctorOutput('');
    const r = await window.api.runDoctor();
    setDoctorOutput(stripAnsi(r.stdout || r.stderr || ''));
    setDoctorRunning(false);
    setDoctorRanOnce(true);
  }

  async function controlBot(action: 'start' | 'stop' | 'restart') {
    setBotBusy(action);
    const fn = action === 'start' ? window.api.botStart : action === 'stop' ? window.api.botStop : window.api.botRestart;
    const r = await fn();
    setBotBusy(null);
    if (r.ok) {
      const label = action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启';
      toast.success(`✓ ${label}命令已发出`);
      // 短暂等下让 PID 文件更新
      setTimeout(refresh, 1500);
    } else {
      toast.error(`bot 操作失败：${r.error || '未知'}`);
    }
  }

  async function refreshLog() {
    setLogBusy(true);
    const lines = await window.api.tailLog(120);
    setLogLines(stripAnsi(lines));
    setLogBusy(false);
  }

  // 「跟随」模式：开启时每 3s 拉一次新内容
  useEffect(() => {
    if (!logVisible || !logFollow) return;
    const id = setInterval(() => {
      window.api.tailLog(120).then(s => setLogLines(stripAnsi(s)));
    }, 3000);
    return () => clearInterval(id);
  }, [logVisible, logFollow]);

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">状态</h1>
          <p className="text-sm text-zinc-500">bot 进程 / 评分概览 / 索引规模 / 全链路 doctor</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
        >
          <RefreshCcw size={14} /> 刷新
        </button>
      </header>

      {/* bot 状态 + 控制 */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🤖 bot 进程</h2>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              bot?.running ? 'bg-emerald-900 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
            }`}>{bot?.running ? '运行中' : '未运行'}</span>
          </div>
        </div>
        {bot?.running && (
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm mb-4">
            <Item label="PID" value={String(bot.pid)} />
            <Item label="内存" value={bot.memMB ? `${bot.memMB.toFixed(1)} MB` : '-'} />
            <Item label="日志文件" value={bot.logFile || '-'} mono small />
          </dl>
        )}
        {!bot?.running && (
          <p className="text-sm text-zinc-500 mb-4">
            点下面按钮启动，或在终端跑 <code className="bg-zinc-800 px-1.5 rounded text-amber-300">echolog start</code>
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-800">
          <BotBtn
            disabled={bot?.running || !!botBusy}
            onClick={() => controlBot('start')}
            label={botBusy === 'start' ? '启动中...' : '启动'}
            Icon={Play}
            color="emerald"
          />
          <BotBtn
            disabled={!bot?.running || !!botBusy}
            onClick={() => controlBot('stop')}
            label={botBusy === 'stop' ? '停止中...' : '停止'}
            Icon={Square}
            color="rose"
          />
          <BotBtn
            disabled={!!botBusy}
            onClick={() => controlBot('restart')}
            label={botBusy === 'restart' ? '重启中...' : '重启'}
            Icon={RotateCw}
            color="blue"
          />
          <button
            onClick={() => { setLogVisible(!logVisible); if (!logVisible) refreshLog(); }}
            className="ml-auto flex items-center gap-1.5 text-sm text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
          >
            <ScrollText size={14} /> {logVisible ? '隐藏日志' : '看今日日志'}
          </button>
        </div>
        {logVisible && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">today log · 最近 120 行</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logFollow}
                    onChange={(e) => setLogFollow(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  跟随（每 3s 刷新）
                </label>
                <button onClick={refreshLog} disabled={logBusy} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                  <RefreshCcw size={11} /> {logBusy ? '刷新中...' : '手动刷新'}
                </button>
              </div>
            </div>
            <pre className="text-[11px] font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-zinc-400 leading-relaxed">
              {logLines || '（暂无日志输出）'}
            </pre>
          </div>
        )}
      </section>

      {/* 评分 */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h2 className="font-semibold mb-3">⭐ /rate 评分</h2>
        {!ratings || ratings.total === 0 ? (
          <p className="text-sm text-zinc-500">还没评分。飞书发 <code className="bg-zinc-800 px-1.5 rounded text-amber-300">/rate 4 评语...</code> 累积</p>
        ) : (
          <div>
            <div className="text-3xl font-bold text-zinc-100 mb-1">{ratings.avg} / 5</div>
            <div className="text-xs text-zinc-500 mb-3">共 {ratings.total} 条</div>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map(s => {
                const n = ratings.byScore[s] || 0;
                const pct = ratings.total ? (n / ratings.total) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-zinc-400">{s}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-zinc-500">{n}</span>
                  </div>
                );
              })}
            </div>
            {ratings.recent.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <div className="text-xs text-zinc-500 mb-2">最近 5 条：</div>
                <ul className="space-y-1.5 text-sm">
                  {ratings.recent.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="font-mono text-zinc-500 text-xs">{r.date}</span>
                      <span className="text-amber-400">{r.score}/5</span>
                      {r.comment && <span className="text-zinc-400 truncate">— {r.comment}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 索引 */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h2 className="font-semibold mb-3">🧠 跨日记忆索引</h2>
        {!indexStats || indexStats.totalChunks === 0 ? (
          <p className="text-sm text-zinc-500">索引为空。终端跑 <code className="bg-zinc-800 px-1.5 rounded text-amber-300">echolog reindex</code></p>
        ) : (
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <Item label="模型" value={indexStats.model} />
            <Item label="chunk 数" value={indexStats.totalChunks.toLocaleString()} />
            <Item label="覆盖天数" value={String(indexStats.days)} />
            <Item label="日期范围" value={`${indexStats.earliest || '-'} ~ ${indexStats.latest || '-'}`} />
          </dl>
        )}
      </section>

      {/* doctor */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🩺 echolog doctor</h2>
          <button
            onClick={runDoctor}
            disabled={doctorRunning}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${
              doctorRunning ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Stethoscope size={14} /> {doctorRunning ? '运行中...' : doctorRanOnce ? '再跑一次' : '跑'}
          </button>
        </div>
        {doctorRanOnce ? (
          <pre className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap text-zinc-300">{doctorOutput || '（无输出）'}</pre>
        ) : (
          <p className="text-sm text-zinc-500">点上方按钮跑一次全链路体检（约 5-30 秒）</p>
        )}
      </section>
    </div>
  );
}

function Item({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <>
      <dt className="text-zinc-500 text-sm">{label}</dt>
      <dd className={`text-zinc-200 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'} truncate`} title={value}>{value}</dd>
    </>
  );
}

// 简易 ANSI 颜色码剥离（doctor 输出含 \x1b[31m 等）
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function BotBtn({ disabled, onClick, label, Icon, color }: {
  disabled?: boolean; onClick: () => void; label: string; Icon: any;
  color: 'emerald' | 'rose' | 'blue';
}) {
  const colorClass = disabled
    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
    : color === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
    : color === 'rose'    ? 'bg-rose-700 hover:bg-rose-600 text-white'
    : 'bg-blue-700 hover:bg-blue-600 text-white';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${colorClass}`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
