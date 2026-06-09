// 在线更新事件 → 横幅通知（顶部，主菜单下方）
import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

type State =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

export function UpdaterBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    const off = window.appEvents?.onUpdaterEvent?.((event, payload) => {
      if (event === 'available') setState({ kind: 'available', version: payload.version });
      else if (event === 'progress') setState({ kind: 'progress', percent: payload.percent });
      else if (event === 'downloaded') setState({ kind: 'downloaded', version: payload.version });
      else if (event === 'error') setState({ kind: 'error', message: payload.message });
      else if (event === 'not-available') setState({ kind: 'idle' }); // 别打扰
    });
    return off;
  }, []);

  if (state.kind === 'idle' || state.kind === 'error') return null;

  const install = () => window.api.installUpdate?.();
  const dismiss = () => setState({ kind: 'idle' });

  return (
    <div className="bg-indigo-900/40 border-b border-indigo-700/60 px-4 py-2 text-sm flex items-center gap-3">
      {state.kind === 'available' && (
        <>
          <Download size={14} className="text-indigo-300" />
          <span className="text-indigo-200">发现新版本 <strong>v{state.version}</strong>，正在后台下载...</span>
        </>
      )}
      {state.kind === 'progress' && (
        <>
          <RefreshCw size={14} className="text-indigo-300 animate-spin" />
          <span className="text-indigo-200">下载中 {state.percent.toFixed(1)}%</span>
          <div className="flex-1 h-1.5 bg-indigo-950 rounded overflow-hidden max-w-xs">
            <div className="h-full bg-indigo-400 transition-all" style={{ width: `${state.percent}%` }} />
          </div>
        </>
      )}
      {state.kind === 'downloaded' && (
        <>
          <Download size={14} className="text-emerald-300" />
          <span className="text-emerald-200">新版本 <strong>v{state.version}</strong> 已下载，重启即可安装</span>
          <button onClick={install} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded ml-2">
            立即重启安装
          </button>
        </>
      )}
      <button onClick={dismiss} className="ml-auto text-zinc-500 hover:text-zinc-300" title="关闭横幅">
        <X size={13} />
      </button>
    </div>
  );
}
