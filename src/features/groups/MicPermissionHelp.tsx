import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { currentPlatform, micSteps, watchMicPermission } from "../../lib/micPermission";
import { GIcon } from "./groupIcons";

/** "**negrito**" dos passos vira <strong>. */
function rich(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/**
 * Microfone bloqueado: o navegador não deixa um site abrir as configurações nem pedir de novo.
 * Mostra o caminho exato do aparelho (no computador, uma seta aponta o ícone ao lado do endereço)
 * e, assim que a pessoa libera, fecha e já começa a gravar.
 */
/** Ícone que o navegador mostra à esquerda do endereço: ajustes (Chrome/Edge) ou microfone riscado (Firefox). */
function SiteIcon({ firefox }: { firefox: boolean }) {
  return firefox ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 10V5a3 3 0 0 0-5.9-.7" />
      <path d="M19 11a7 7 0 0 1-.9 3.4M5 11a7 7 0 0 0 11.3 5.5M12 18v3M3 3l18 18" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </svg>
  );
}

export function MicPermissionHelp({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const platform = useMemo(() => currentPlatform(), []);
  const steps = micSteps(platform);
  // Seta e barra desenhada só onde existe a barra de endereço com o ícone do site à esquerda
  // (Chrome, Edge, Firefox). Safari usa o menu; o app instalado não tem barra de endereço.
  const standalone = useMemo(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(display-mode: standalone)").matches),
    [],
  );
  const addressBar = (platform === "desktop-chrome" || platform === "desktop-firefox") && !standalone;
  const host = typeof window === "undefined" ? "storyverse" : window.location.host;

  // Liberou nas configurações: volta direto para a gravação.
  useEffect(() => watchMicPermission((state) => state === "granted" && onRetry()), [onRetry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="mic-help-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {addressBar ? (
        // O site não sabe onde fica o ícone: a seta aponta para cima, na altura em que ele costuma
        // ficar (depois de voltar, avançar e recarregar). A barra desenhada no diálogo mostra qual é.
        <div className="mic-help-pointer" aria-hidden="true">
          <svg viewBox="0 0 24 40" width="24" height="40">
            <path d="M12 38 V 4 M12 4 L 4 12 M12 4 L 20 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Lá em cima, à esquerda do endereço</span>
        </div>
      ) : null}
      <section className="mic-help" role="dialog" aria-modal="true" aria-labelledby="mic-help-title">
        <button type="button" className="group-icon-btn mic-help-close" onClick={onClose} aria-label="Fechar">
          {GIcon.close}
        </button>
        <span className="mic-help-icon" aria-hidden="true">
          {GIcon.mic}
          <i />
        </span>
        <h2 id="mic-help-title">Libere o microfone</h2>
        <p className="mic-help-sub">
          O navegador está bloqueando o microfone para o Storyverse. Só você pode liberar, e leva poucos segundos:
        </p>
        {addressBar ? (
          <figure className="mic-help-bar" aria-hidden="true">
            <span className="mic-help-bar-url">
              <span className="mic-help-bar-target">
                <SiteIcon firefox={platform === "desktop-firefox"} />
              </span>
              <span className="mic-help-bar-host">{host}</span>
            </span>
            <figcaption>Este ícone, à esquerda do endereço do site, no topo da janela</figcaption>
          </figure>
        ) : null}
        <ol className="mic-help-steps">
          {steps.map((step, i) => (
            <li key={i} style={{ "--i": i } as React.CSSProperties}>
              <span className="mic-help-n">{i + 1}</span>
              <span>{rich(step)}</span>
            </li>
          ))}
        </ol>
        <p className="mic-help-wait" role="status">
          <span className="mic-help-pulse" aria-hidden="true" /> Assim que você liberar, a gravação começa sozinha.
        </p>
        <div className="mic-help-actions">
          <button type="button" className="btn" onClick={onClose}>
            Agora não
          </button>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {GIcon.mic} Tentar de novo
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
