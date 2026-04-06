import React from "react";
import { Link } from "react-router-dom";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[app/error-boundary] Render failure", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="section-wrap grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(245,197,24,0.08),transparent_25%),linear-gradient(180deg,#080b12_0%,#101520_100%)] px-5">
          <div className="surface-card max-w-2xl p-8 text-center">
            <div className="section-label">Playback Interrupted</div>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[0.04em] text-white">SOMETHING WENT WRONG</h1>
            <p className="mt-4 text-sm leading-7 text-muted">
              The app hit an unexpected runtime error. Your session and rentals are still safe.
            </p>
            <p className="mt-3 text-xs text-rose-200">{this.state.error?.message || "Unknown render error."}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="btn-primary" type="button" onClick={() => window.location.reload()}>
                Reload App
              </button>
              <Link className="btn-secondary" to="/">
                Go Home
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
