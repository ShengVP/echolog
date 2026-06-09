// 全局 Toast 通知系统 —— 用 React Context + 自定义 hook
// 用法：const toast = useToast(); toast.success('已保存'); toast.error('xx');
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  ttl: number;
}

interface ToastApi {
  success: (msg: string, ttl?: number) => void;
  error: (msg: string, ttl?: number) => void;
  info: (msg: string, ttl?: number) => void;
  warning: (msg: string, ttl?: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string, ttl = 4000) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, kind, message, ttl }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const api: ToastApi = {
    success: (m, t) => push('success', m, t),
    error: (m, t) => push('error', m, t || 8000),
    info: (m, t) => push('info', m, t),
    warning: (m, t) => push('warning', m, t || 6000),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md pointer-events-none">
        {items.map(t => (
          <ToastView key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    if (item.ttl > 0) {
      const id = setTimeout(onClose, item.ttl);
      return () => clearTimeout(id);
    }
  }, [item.ttl, onClose]);

  const map = {
    success: { Icon: CheckCircle2, bg: 'bg-emerald-950 border-emerald-800', icon: 'text-emerald-400' },
    error:   { Icon: XCircle,      bg: 'bg-rose-950 border-rose-800',       icon: 'text-rose-400' },
    info:    { Icon: Info,         bg: 'bg-zinc-900 border-zinc-700',       icon: 'text-blue-400' },
    warning: { Icon: AlertCircle,  bg: 'bg-amber-950 border-amber-800',     icon: 'text-amber-400' },
  };
  const { Icon, bg, icon } = map[item.kind];

  return (
    <div className={`${bg} border rounded-lg p-3 shadow-lg flex items-start gap-2 pointer-events-auto animate-in fade-in slide-in-from-right`}>
      <Icon size={16} className={`${icon} flex-shrink-0 mt-0.5`} />
      <span className="text-sm text-zinc-200 flex-1 break-words whitespace-pre-line">{item.message}</span>
      <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
