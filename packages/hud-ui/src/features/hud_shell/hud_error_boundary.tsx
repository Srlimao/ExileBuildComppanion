import { RotateCcw, ShieldAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { HudA11yMessages } from "../i18n/hud_a11y_messages.js";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

interface InnerErrorBoundaryProps {
  variant: "app" | "widget";
  resetKey?: string;
  a11y: HudA11yMessages;
  children: ReactNode;
}

interface InnerErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class HudErrorBoundaryInner extends Component<InnerErrorBoundaryProps, InnerErrorBoundaryState> {
  state: InnerErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): InnerErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    return { hasError: true, errorMessage: msg || null };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // Isolated fallback renders inline without crashing the rest of the HUD
  }

  componentDidUpdate(prevProps: InnerErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private handleReset = () => {
    if (this.props.variant === "app" && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { variant, a11y } = this.props;
    if (variant === "app") {
      return (
        <div className="min-h-screen bg-hud-bg text-hud-text flex items-center justify-center p-6">
          <div
            role="alert"
            className="w-full max-w-md rounded-2xl bg-hud-surface border border-hud-hairline p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5 text-hud-danger font-semibold text-base">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>{a11y.appErrorTitle}</span>
            </div>
            {this.state.errorMessage && (
              <p className="text-xs font-mono text-hud-muted break-words">{this.state.errorMessage}</p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>{a11y.appErrorReload}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="rounded-xl border border-hud-danger/40 bg-hud-subtle p-3.5 space-y-2.5 text-xs"
      >
        <div className="flex items-center gap-2 font-semibold text-hud-danger">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{a11y.widgetErrorTitle}</span>
        </div>
        {this.state.errorMessage && (
          <p className="font-mono text-[11px] text-hud-muted break-words">{this.state.errorMessage}</p>
        )}
        <button
          type="button"
          onClick={this.handleReset}
          className="px-3 py-1.5 rounded-lg bg-hud-surface border border-hud-hairline hover:bg-hud-subtle text-hud-text font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{a11y.widgetErrorRetry}</span>
        </button>
      </div>
    );
  }
}

interface HudErrorBoundaryProps {
  variant: "app" | "widget";
  resetKey?: string;
  children: ReactNode;
}

/** Isolates unexpected render failures at app or per-widget granularity with localized recovery UI. */
export function HudErrorBoundary({ variant, resetKey, children }: HudErrorBoundaryProps) {
  const { msg } = useHudI18n();
  return (
    <HudErrorBoundaryInner variant={variant} resetKey={resetKey} a11y={msg.a11y}>
      {children}
    </HudErrorBoundaryInner>
  );
}
