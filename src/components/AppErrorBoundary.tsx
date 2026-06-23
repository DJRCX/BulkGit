import React from "react";
import { commands } from "../bindings";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React render failed", error, info.componentStack);
    commands.logFrontendError(error.message, info.componentStack || "").catch((err) => {
      console.error("Failed to log frontend error to Rust", err);
    });
  }

  private resetAppState = () => {
    window.localStorage.removeItem("bulkgit");
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        aria-label="Application error boundary"
        className="flex h-full items-center justify-center p-6"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <section className="w-full max-w-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h1 className="mb-2 text-[15px] font-semibold">The dashboard failed to render</h1>
          <p className="mb-3 text-[13px] text-[var(--muted-foreground)]">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.resetAppState}
            className="rounded bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-500"
          >
            Reset saved state
          </button>
        </section>
      </main>
    );
  }
}
