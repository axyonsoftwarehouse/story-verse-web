/** Avatar de uma pessoa (foto, avatar pronto ou inicial sobre a cor da conta), com a moldura da loja. */
import { AvatarArt, findAvatar } from "../avatars";
import { FaceFrame } from "../features/groups/GroupParts";
import { type Cosmetics } from "../lib/shop";
import { useEffect, useState } from "react";
import { profileColor } from "../lib/profileColor";

/** O mesmo avatar para quem não é a conta atual (ex.: leitores do ranking). */
export function PersonAvatar({
  id,
  name,
  avatar: avatarId,
  photo,
  className,
  cosmetics,
  animate = false,
}: {
  id: string;
  name: string;
  avatar: unknown;
  photo: string | null;
  className: string;
  /** Moldura da loja sobre o rosto (ver cosmetics.css: `.has-frame`). */
  cosmetics?: Cosmetics | null;
  /** Moldura animada: só no perfil. */
  animate?: boolean;
}) {
  const avatar = findAvatar(avatarId);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);
  const framed = cosmetics?.frame ? " has-frame" : "";
  const frame = <FaceFrame cosmetics={cosmetics} animate={animate} />;
  if (photo && !broken) {
    return (
      <span className={`${className} has-photo${framed}`} aria-hidden="true">
        <img src={photo} alt="" loading="lazy" onError={() => setBroken(true)} />
        {frame}
      </span>
    );
  }
  return (
    <span
      className={`${className} ${avatar ? "has-art" : ""}${framed}`}
      style={{ "--c": avatar?.color ?? profileColor(id) } as React.CSSProperties}
      aria-hidden="true"
    >
      {avatar ? <AvatarArt avatar={avatar} /> : name.charAt(0).toUpperCase()}
      {frame}
    </span>
  );
}
