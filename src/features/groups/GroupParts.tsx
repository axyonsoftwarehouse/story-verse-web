import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AvatarArt, findAvatar } from "../../avatars";

/** Rosto de quem escreve: o avatar escolhido no perfil ou a inicial do nome. */
export function PersonFace({ name, avatar, size = "md" }: { name: string; avatar?: string | null; size?: "sm" | "md" }) {
  const def = findAvatar(avatar);
  return (
    <span
      className={`group-face group-face-${size}`}
      style={{ "--c": def?.color ?? "var(--accent)" } as CSSProperties}
      aria-hidden="true"
    >
      {def ? <AvatarArt avatar={def} /> : (name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

export function GroupsBlocked({ text }: { text: string | null }) {
  return (
    <div className="home groups-page">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        <span className="wordmark">Grupos</span>
      </nav>
      {text ? (
        <p className="profile-empty groups-blocked">{text}</p>
      ) : (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando…
        </div>
      )}
    </div>
  );
}
