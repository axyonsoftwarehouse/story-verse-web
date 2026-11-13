import { nameColorStyle, shopAssetUrl, type Cosmetics } from "../../lib/shop";
import "./cosmetics.css";

/** Nome da pessoa com a cor comprada e a insígnia ao lado; nome longo trunca antes da insígnia. */
export function PersonName({ name, cosmetics, className }: { name: string; cosmetics?: Cosmetics | null; className?: string }) {
  const badge = cosmetics?.badge ?? null;
  const badgeSrc = badge ? shopAssetUrl(badge.image) : "";
  return (
    <span className={`person-name${className ? ` ${className}` : ""}`}>
      <span className="person-name-text" style={nameColorStyle(cosmetics?.name_color ?? null)}>
        {name}
      </span>
      {badge && badgeSrc ? (
        <img className="person-name-badge" src={badgeSrc} alt={badge.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : null}
    </span>
  );
}
