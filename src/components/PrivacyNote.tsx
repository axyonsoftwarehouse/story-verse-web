import { useState } from "react";
import { Icon } from "./Icon";

/** Aviso curto de privacidade, com "Saiba mais" para o detalhe. */
export function PrivacyNote({
  children,
  details,
}: {
  children: React.ReactNode;
  details: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="privacy-note">
      <p>
        {Icon.lock}
        <span>
          {children}{" "}
          <button
            type="button"
            className="link-btn"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Fechar" : "Saiba mais"}
          </button>
        </span>
      </p>
      {open ? <p className="privacy-note-more">{details}</p> : null}
    </div>
  );
}
