import { useEffect, useState } from 'react';
import { Calendar, FileText, Search, FileEdit, Settings, Activity, Type } from 'lucide-react';
import type { ViewName } from '../types';
import { useAppSettings, type FontSize } from './AppSettings';

interface Props {
  current: ViewName;
  onSelect: (v: ViewName) => void;
}

const items: Array<{ id: ViewName; label: string; Icon: any; hint: string; kbd: string }> = [
  { id: 'diary',   label: '日记浏览',    Icon: Calendar, hint: '按日期看 raw_logs / diary', kbd: '⌘1' },
  { id: 'drafts',  label: '选题 & 草稿',  Icon: FileText, hint: 'Notes / Drafts', kbd: '⌘2' },
  { id: 'search',  label: '搜索',         Icon: Search,   hint: '跨日关键词 + 语义检索', kbd: '⌘3' },
  { id: 'prompts', label: 'Prompt 编辑',  Icon: FileEdit, hint: '编辑 / 新建 prompt 版本', kbd: '⌘4' },
  { id: 'config',  label: '配置',         Icon: Settings, hint: '.env / 模块开关 / LLM 测试', kbd: '⌘5' },
  { id: 'status',  label: '状态',         Icon: Activity, hint: 'bot / doctor / 评分', kbd: '⌘6' },
];

export function Sidebar({ current, onSelect }: Props) {
  return (
    <aside className="titlebar-no-drag w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ id, label, Icon, hint, kbd }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
              title={hint}
            >
              <Icon size={16} className={active ? 'text-blue-400' : ''} />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{kbd}</span>
            </button>
          );
        })}
      </nav>

      <SidebarFooter />
    </aside>
  );
}

function SidebarFooter() {
  const { fontSize, setFontSize } = useAppSettings();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.api.appVersion?.().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="border-t border-zinc-800 p-3 space-y-2">
      {/* 字体大小切换 */}
      <div className="flex items-center gap-1.5">
        <Type size={12} className="text-zinc-600" />
        {(['small', 'normal', 'large'] as FontSize[]).map(s => (
          <button
            key={s}
            onClick={() => setFontSize(s)}
            className={`flex-1 text-[10px] py-1 rounded transition-colors ${
              fontSize === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'
            }`}
            title={`字号：${s}`}
          >{s === 'small' ? '小' : s === 'large' ? '大' : '中'}</button>
        ))}
      </div>
      <div className="text-xs text-zinc-600 leading-relaxed">
        <div>echolog desktop</div>
        <div>v{version || '0.2.0'}</div>
      </div>
    </div>
  );
}
