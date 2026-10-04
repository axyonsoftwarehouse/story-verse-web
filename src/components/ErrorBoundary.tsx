import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { buildDiagnosticsReport, captureError } from "../lib/telemetry";

type Props = { children: ReactNode };
type State = { error: Error | null };

const wrap: CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeContent: "center",
  justifyItems: "center",
  gap: 18,
  padding: 24,
  textAlign: "center",
  background: "#0c0a08",
  color: "#e8e0d4",
  fontFamily: "system-ui, sans-serif",
};

const button: CSSProperties = {
  border: "1px solid rgba(228,184,106,0.5)",
  background: "transparent",
  color: "#e4b86a",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 15,
  cursor: "pointer",
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError("react-render", error, { componentStack: info.componentStack ?? undefined });
  }

  private reload = (): void => {
    location.reload();
  };

  private copyReport = (): void => {
    void navigator.clipboard?.writeText(buildDiagnosticsReport());
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={wrap}>
        <div style={{ fontSize: 40 }} aria-hidden="true">
          📖
        </div>
        <h1 style={{ fontSize: 22, margin: 0 }}>Algo se perdeu na história</h1>
        <p style={{ maxWidth: 420, lineHeight: 1.5, opacity: 0.8, margin: 0 }}>
          Tivemos um problema inesperado ao montar a tela. Recarregue para continuar de onde parou; se
          repetir, avise a equipe com o relatório abaixo.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button style={button} onClick={this.reload}>
            Recarregar
          </button>
          <button style={button} onClick={this.copyReport}>
            Copiar detalhes
          </button>
        </div>
        <code style={{ fontSize: 12, opacity: 0.5, maxWidth: 460, wordBreak: "break-word" }}>
          {error.name}: {error.message}
        </code>
      </div>
    );
  }
}
