import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { SanctionKind } from "../../lib/adminSanctions";
import "./admin.css";

const KIND_LABEL: Record<SanctionKind, string> = {
  warning: "Aviso",
  suspension: "Suspensão",
  ban: "Banimento",
};

const PRESETS = [
  { id: "1", label: "1 dia" },
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "custom", label: "Personalizado" },
  { id: "none", label: "Sem prazo" },
];

function defaultCustom(): string {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function expiresAtFor(kind: SanctionKind, preset: string, custom: string): string | null {
  if (kind === "ban") return null;
  if (kind === "warning" && preset === "none") return null;
  if (preset === "custom") {
    return custom ? new Date(custom).toISOString() : null;
  }
  const days = Number(preset);
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function SanctionDialog({
  userName,
  onClose,
  onApply,
}: {
  userName: string;
  onClose: () => void;
  onApply: (input: { kind: SanctionKind; reason: string; expiresAt: string | null }) => Promise<void>;
}) {
  const [kind, setKind] = useState<SanctionKind>("warning");
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState("7");
  const [custom, setCustom] = useState(defaultCustom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError("Informe o motivo da sanção.");
      return;
    }
    const expiresAt = expiresAtFor(kind, preset, custom);
    if (kind === "suspension" && !expiresAt) {
      setError("Escolha o prazo da suspensão.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onApply({ kind, reason: text, expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aplicar a sanção.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="auth-card sanction-dialog" role="dialog" aria-modal="true" aria-labelledby="sanction-title">
        <span className="eyebrow">Sanção de conta</span>
        <h2 id="sanction-title">Aplicar sanção a {userName}</h2>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Tipo
            <select
              value={kind}
              onChange={(event) => {
                const next = event.target.value as SanctionKind;
                setKind(next);
                if (next === "suspension" && preset === "none") setPreset("7");
              }}
            >
              {(Object.keys(KIND_LABEL) as SanctionKind[]).map((item) => (
                <option key={item} value={item}>
                  {KIND_LABEL[item]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Motivo
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explique o motivo; fica no histórico e na auditoria."
            />
            <small aria-live="polite">{reason.length}/500</small>
          </label>

          {kind !== "ban" ? (
            <label>
              Prazo
              <select value={preset} onChange={(event) => setPreset(event.target.value)}>
                {PRESETS.filter((item) => item.id !== "none" || kind === "warning").map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {preset === "custom" && kind !== "ban" ? (
            <label>
              Até
              <input
                type="datetime-local"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                required
              />
            </label>
          ) : null}

          {kind === "ban" ? (
            <p className="muted">O banimento não tem prazo e só termina quando for revogado.</p>
          ) : null}

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="profile-pw-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary is-danger" disabled={busy}>
              {busy ? "Aplicando…" : "Aplicar sanção"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
