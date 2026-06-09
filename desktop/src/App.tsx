import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DiaryView } from './components/DiaryView';
import { DraftsView } from './components/DraftsView';
import { SearchView } from './components/SearchView';
import { PromptsView } from './components/PromptsView';
import { ConfigView } from './components/ConfigView';
import { StatusView } from './components/StatusView';
import { ToastProvider } from './components/Toast';
import { AppSettingsProvider } from './components/AppSettings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeBanner } from './components/WelcomeBanner';
import { UpdaterBanner } from './components/UpdaterBanner';
import type { ViewName } from './types';

const VIEWS: ViewName[] = ['diary', 'drafts', 'search', 'prompts', 'config', 'status'];

export default function App() {
  const [view, setView] = useState<ViewName>(() => {
    try {
      const v = localStorage.getItem('echolog.view') as ViewName;
      if (v && VIEWS.includes(v)) return v;
    } catch {}
    return 'diary';
  });
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const navigate = useCallback((v: ViewName) => {
    setView(v);
    try { localStorage.setItem('echolog.view', v); } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= VIEWS.length) {
        e.preventDefault();
        navigate(VIEWS[n - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  useEffect(() => {
    const off = window.appEvents?.onNavigate((v) => {
      if (VIEWS.includes(v as ViewName)) navigate(v as ViewName);
    });
    return off;
  }, [navigate]);

  return (
    <AppSettingsProvider>
      <ToastProvider>
        <ErrorBoundary>
          <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans">
            <div className="titlebar-drag h-9 flex-shrink-0 border-b border-zinc-900 flex items-center justify-center text-xs text-zinc-500 select-none">
              <span className="font-medium">echolog · 极客日记</span>
            </div>

            <UpdaterBanner />
            <WelcomeBanner onNavigate={navigate} />

            <div className="flex flex-1 overflow-hidden">
              <Sidebar current={view} onSelect={navigate} />
              <main className="flex-1 overflow-y-auto selectable">
                {view === 'diary' && <DiaryView pendingDate={pendingDate} onConsumePending={() => setPendingDate(null)} />}
                {view === 'drafts' && <DraftsView />}
                {view === 'search' && (
                  <SearchView
                    onJumpToDate={(d) => { setPendingDate(d); navigate('diary'); }}
                    onJumpView={navigate}
                  />
                )}
                {view === 'prompts' && <PromptsView />}
                {view === 'config' && <ConfigView onNavigate={navigate} />}
                {view === 'status' && <StatusView />}
              </main>
            </div>
          </div>
        </ErrorBoundary>
      </ToastProvider>
    </AppSettingsProvider>
  );
}
