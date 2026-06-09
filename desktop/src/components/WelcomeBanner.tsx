// 首次打开 / 缺核心配置时的 Welcome 引导
import { useEffect, useState } from 'react';
import { Sparkles, Terminal, ArrowRight } from 'lucide-react';
import type { ViewName } from '../types';

interface Props {
  onNavigate: (v: ViewName) => void;
}

export function WelcomeBanner({ onNavigate }: Props) {
  const [missing, setMissing] = useState<string[] | null>(null);

  useEffect(() => {
    window.api.readEnv().then(env => {
      const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'];
      const missingKeys = required.filter(k => !env[k] || env[k] === 'cli_xxxxxxxxxxxxxxxx');
      setMissing(missingKeys);
    });
  }, []);

  if (missing === null) return null;
  if (missing.length === 0) return null; // 配置全有，不显示 banner

  return (
    <div className="bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border-b border-blue-800/60 px-6 py-4 text-sm">
      <div className="max-w-4xl mx-auto flex items-start gap-3">
        <Sparkles size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-blue-200 mb-1">👋 欢迎使用 echolog</h3>
          <p className="text-blue-300/80 text-xs leading-relaxed">
            还缺少核心配置：<code className="font-mono bg-blue-900/50 px-1.5 py-0.5 rounded">{missing.join(', ')}</code>
            。需要先在飞书开放平台拿到 App ID + Secret，再回来填进配置。
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onNavigate('config')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg"
            >
              去配置 <ArrowRight size={11} />
            </button>
            <a
              href="https://open.feishu.cn/app"
              onClick={(e) => { e.preventDefault(); window.api.openExternal?.('https://open.feishu.cn/app'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg cursor-pointer"
            >
              打开飞书开放平台 ↗
            </a>
            <span className="text-xs text-blue-400/60 flex items-center gap-1 ml-auto">
              <Terminal size={11} /> 或终端跑 <code className="font-mono text-amber-300">echolog init</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
