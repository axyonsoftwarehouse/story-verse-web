import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./confirmDialog.css";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação destrutiva: o botão de confirmar fica na cor de perigo. */
  danger?: boolean;
};

/**
 * Confirmação no visual do app (não o `window.confirm` nativo, que não sai em print e é
 * suprimido em PWA no iOS). Uso:
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Apagar?", danger: true }))) return;
 *   ...
 *   {dialog}
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = useCallback((ok: boolean) => {
    setOptions(null);
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }, []);

  const dialog = options ? (
    <ConfirmDialog {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />
  ) : null;

  return { confirm, dialog };
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        className="auth-card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? "confirm-dialog-message" : undefined}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        {message ? <p id="confirm-dialog-message">{message}</p> : null}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn-primary${danger ? " is-danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
