import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production or prototype, can log to console or error monitor
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isTe = localStorage.getItem('kirana_language') === 'te';

      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-ink-200 text-center space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-danger-50 text-danger-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-black text-ink-900 tracking-tight">
                {isTe ? 'ఏదో తప్పు జరిగింది' : 'Something went wrong'}
              </h1>
              <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                {isTe
                  ? 'అనుకోని లోపం సంభవించింది. దయచేసి పేజీని రీఫ్రెష్ చేయండి లేదా హోమ్ పేజీకి తిరిగి వెళ్లండి.'
                  : 'An unexpected application error occurred. Please try reloading the page or go back to home.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isTe ? 'పేజీ రీఫ్రెష్ చేయండి' : 'Reload Page'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-ink-100 hover:bg-ink-200 text-ink-800 font-bold text-xs rounded-xl transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>{isTe ? 'హోమ్‌కు వెళ్లండి' : 'Go Home'}</span>
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mt-4 p-3 bg-ink-50 rounded-xl border border-ink-200 text-[11px] text-danger-700 font-mono overflow-auto max-h-40">
                <summary className="cursor-pointer font-bold text-ink-600 select-none">
                  Technical Details (Dev Only)
                </summary>
                <p className="mt-2 font-bold">{this.state.error.toString()}</p>
                <pre className="mt-1 text-[10px] whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
