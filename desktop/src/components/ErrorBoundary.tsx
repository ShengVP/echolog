// React ErrorBoundary —— 防止单视图崩塌带整个 app down
import React from 'react';

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-8">
          <div className="max-w-2xl w-full bg-zinc-900 border border-rose-900 rounded-xl p-6 space-y-4">
            <h1 className="text-xl font-bold text-rose-400">⚠️ 桌面应用发生异常</h1>
            <p className="text-sm text-zinc-300">
              这是 React 渲染层的错误，不影响你的 bot 进程和数据。可以重置 UI 继续用，或退出 app 再开。
            </p>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-rose-300 max-h-64 overflow-auto">
              <div className="font-bold mb-1">{this.state.error.name}: {this.state.error.message}</div>
              {this.state.error.stack && (
                <pre className="whitespace-pre-wrap text-zinc-500 mt-2">{this.state.error.stack}</pre>
              )}
              {this.state.errorInfo?.componentStack && (
                <pre className="whitespace-pre-wrap text-zinc-600 mt-2 border-t border-zinc-800 pt-2">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white"
              >
                重置 UI
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-200"
              >
                整窗口重载
              </button>
              <a
                href="https://github.com/BillLucky/echolog/issues/new"
                onClick={(e) => { e.preventDefault(); window.api.openExternal?.('https://github.com/BillLucky/echolog/issues/new'); }}
                className="ml-auto text-sm text-zinc-500 hover:text-zinc-200 self-center"
              >
                提交 issue →
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
