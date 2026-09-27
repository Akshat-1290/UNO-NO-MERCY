import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleClearAndHome = () => {
    localStorage.removeItem('uno_current_room');
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[100dvh] w-full bg-[#08080c] text-white flex items-center justify-center p-4 font-mono-hud">
          <div className="clip-chamfer-lg bg-[#0f0d15] border-2 border-red-600 p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0px_#000] text-center space-y-4 animate-fadeIn">
            <div className="w-14 h-14 clip-chamfer-btn bg-red-950/80 border-2 border-red-500 text-red-400 flex items-center justify-center mx-auto text-2xl shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display font-black text-2xl uppercase tracking-wider text-white">
                Arena Hiccup Detected
              </h2>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                A temporary rendering issue was safely caught. Your player identity and room session have been preserved.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-stamp-slam clip-chamfer-btn flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resume Game</span>
              </button>
              <button
                type="button"
                onClick={this.handleClearAndHome}
                className="btn-stamp-secondary clip-chamfer-btn py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-mono-hud font-bold text-xs border border-neutral-700 uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Lobby</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
