import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AvatarArt, findAvatar } from "../../avatars";
import { GIcon } from "./groupIcons";
import { hueOf } from "./groupHelpers";

/** Rosto de quem escreve: o avatar escolhido no perfil ou a inicial numa cor própria da pessoa. */
export function PersonFace({ id, name, avatar, size = "md" }: { id: string; name: string; avatar?: string | null; size?: "sm" | "md" }) {
  const def = findAvatar(avatar);
  const color = def?.color ?? `hsl(${hueOf(id)} 42% 62%)`;
  return (
    <span className={`group-face group-face-${size}`} style={{ "--c": color } as CSSProperties} aria-hidden="true">
      {def ? <AvatarArt avatar={def} /> : (name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

/** Foto do grupo; sem foto (ou se não carregar), a inicial num degradê com a cor do grupo. */
export function GroupAvatar({ id, name, photo, size = "md" }: { id: string; name: string; photo?: string | null; size?: "sm" | "md" | "lg" | "xl" }) {
  const [broken, setBroken] = useState(false);
  const hue = hueOf(id);
  return (
    <span
      className={`group-avatar group-avatar-${size}`}
      style={{ "--h": hue } as CSSProperties}
      aria-hidden="true"
    >
      {photo && !broken ? (
        <img src={photo} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        (name.trim().charAt(0) || "?").toUpperCase()
      )}
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
        <div className="groups-empty">
          <span className="groups-empty-icon">{GIcon.users}</span>
          <p>{text}</p>
        </div>
      ) : (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando…
        </div>
      )}
    </div>
  );
}
