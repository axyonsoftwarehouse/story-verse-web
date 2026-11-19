import { nameBadges, nameColorStyle, shopAssetUrl, type Cosmetics } from "../../lib/shop";
import "./cosmetics.css";

/** Nome da pessoa com a cor comprada e até quatro insígnias ao lado. */
export function PersonName({ name, cosmetics, className }: { name: string; cosmetics?: Cosmetics | null; className?: string }) {
  const badges = nameBadges(cosmetics)
    .map((badge) => ({ ...badge, src: shopAssetUrl(badge.image) }))
    .filter((badge) => badge.src);
  return (
    <span className={`person-name${className ? ` ${className}` : ""}`}>
      <span className="person-name-text" style={nameColorStyle(cosmetics?.name_color ?? null)}>
        {name}
      </span>
      {badges.map((badge) => (
        <img
          key={badge.src}
          className="person-name-badge"
          src={badge.src}
          alt={badge.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ))}
    </span>
  );
}
