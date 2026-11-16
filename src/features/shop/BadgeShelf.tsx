import type { CSSProperties } from "react";
import { shopAssetUrl } from "../../lib/shop";
import type { ShelfBadge } from "../../lib/social";
import "./cosmetics.css";

/** Estante de insígnias da loja no perfil (separada das conquistas de leitura). */
export function BadgeShelf({ items }: { items: ShelfBadge[] }) {
  const shown = items.map((b) => ({ ...b, src: shopAssetUrl(b.image) })).filter((b) => b.src);
  if (shown.length === 0) return null;
  return (
    <ul className="badge-shelf">
      {shown.map((b, i) => (
        <li key={b.id} className="badge-shelf-item" style={{ "--i": i } as CSSProperties} title={b.name}>
          <img src={b.src} alt={b.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          <small>{b.name}</small>
        </li>
      ))}
    </ul>
  );
}
