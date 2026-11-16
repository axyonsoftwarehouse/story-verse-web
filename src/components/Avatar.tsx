import { useEffect, useState } from "react";
import type { StoryCharacter } from "../data/types";
import { cachedPortrait, requestPortrait } from "../lib/portraits";
import { shortNameOf } from "../lib/characterName";

/**
 * Avatar do personagem: a inicial do nome e, por cima, o retrato (ilustração livre ou gerada),
 * quando houver. `generate` pede o retrato se ainda não existir (no leitor); sem ele, só mostra
 * retratos já guardados neste aparelho (página inicial, para não disparar dezenas de pedidos).
 */
export function Avatar({
  character,
  size = "md",
  bookTitle,
  generate = false,
}: {
  character: StoryCharacter;
  size?: "sm" | "md" | "lg";
  bookTitle?: string;
  generate?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(() => (bookTitle ? cachedPortrait(character, bookTitle) : null));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!bookTitle) return;
    const cached = cachedPortrait(character, bookTitle);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(null);
    setLoaded(false);
    if (!generate) return;
    let alive = true;
    void requestPortrait(character, bookTitle).then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
    // O objeto do personagem muda a cada render; nome e id bastam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id, character.name, bookTitle, generate]);

  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ "--c": character.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {shortNameOf(character).replace(/^(O|A|Mr\.|Mrs\.|Dr\.)\s+/i, "").charAt(0).toUpperCase()}
      {src ? (
        <img
          className={`avatar-photo ${loaded ? "is-loaded" : ""}`}
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setSrc(null)}
        />
      ) : null}
    </span>
  );
}
