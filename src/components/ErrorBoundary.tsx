import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Soul 聊天助手] 页面渲染失败', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full flex items-center justify-center p-6 bg-soul-950 text-gray-100">
          <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-950/20 p-5 space-y-3">
            <h1 className="text-lg font-semibold text-red-200">页面出错了</h1>
            <p className="text-sm text-soul-300 leading-relaxed">
              可以先点「重试」恢复界面。若刚打开就失败，请确认通过{' '}
              <code className="text-pink-300">npm run dev</code> 访问{' '}
              <a className="text-pink-300 underline" href="http://127.0.0.1:5173">
                http://127.0.0.1:5173
              </a>
              ，不要直接双击打开 html。
            </p>
            <pre className="text-xs text-red-300/90 whitespace-pre-wrap break-all bg-black/30 rounded-lg p-3 max-h-40 overflow-auto">
              {this.state.error.message}
            </pre>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="btn-primary flex-1 min-h-[44px]"
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-ghost flex-1 min-h-[44px]"
              >
                重新加载页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
