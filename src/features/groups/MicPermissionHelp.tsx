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
export function MicPermissionHelp({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const platform = useMemo(() => currentPlatform(), []);
  const steps = micSteps(platform);
  const desktop = platform.startsWith("desktop");

  // Liberou nas configurações: volta direto para a gravação.
  useEffect(() => watchMicPermission((state) => state === "granted" && onRetry()), [onRetry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="mic-help-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {desktop ? (
        <div className="mic-help-pointer" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40">
            <path d="M30 34 C 22 26, 14 20, 8 8 M8 8 L 8 18 M8 8 L 18 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Aqui, ao lado do endereço</span>
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
          O microfone está bloqueado para o Storyverse neste navegador. Por segurança, só você pode liberar, assim:
        </p>
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
