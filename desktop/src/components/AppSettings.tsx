// 全局应用设置（区别于 .env 业务配置）：字体大小、视图偏好等
// 持久化到 localStorage
import { createContext, useContext, useEffect, useState } from 'react';

export type FontSize = 'small' | 'normal' | 'large';

interface Settings {
  fontSize: FontSize;
}

interface AppSettingsApi extends Settings {
  setFontSize: (s: FontSize) => void;
}

const DEFAULTS: Settings = { fontSize: 'normal' };
const KEY = 'echolog.appSettings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

const Ctx = createContext<AppSettingsApi | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    save(settings);
    // 把 fontSize 注入 :root，让 CSS 全局响应
    const root = document.documentElement;
    root.dataset.fontSize = settings.fontSize;
    const fs = settings.fontSize === 'small' ? '13px' : settings.fontSize === 'large' ? '16px' : '14px';
    root.style.setProperty('--app-base-font-size', fs);
  }, [settings]);

  const api: AppSettingsApi = {
    ...settings,
    setFontSize: (s) => setSettings(prev => ({ ...prev, fontSize: s })),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppSettings(): AppSettingsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppSettings must be inside <AppSettingsProvider>');
  return ctx;
}
