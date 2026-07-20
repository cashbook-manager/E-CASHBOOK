import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-800">Something went wrong</p>
              <p className="mt-2 text-sm text-slate-500">
                The app hit an unexpected error. Please refresh the page to try again.
              </p>
              <button
                className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
