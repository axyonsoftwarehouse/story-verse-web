import type { KeyboardEvent } from "react";
import { formatRating } from "./useShelf";
import "./library.css";

const HALVES = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);

/**
 * Nota de 0,5 a 5 em meias estrelas. Teclado: ←/→ mudam meia estrela, Delete limpa.
 * O mouse clica na metade esquerda ou direita de cada estrela.
 */
export function RatingStars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
}) {
  const label = value === null ? "Sem nota" : `Nota ${formatRating(value)} de 5`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readOnly || !onChange) return;
    const current = value ?? 0;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") onChange(Math.min(5, Math.max(0.5, current + 0.5)));
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") onChange(current <= 0.5 ? null : current - 0.5);
    else if (event.key === "Delete" || event.key === "Backspace") onChange(null);
    else return;
    event.preventDefault();
  }

  return (
    <div className={`rating-stars ${readOnly ? "is-readonly" : ""}`}>
      <div
        role="slider"
        tabIndex={readOnly ? -1 : 0}
        aria-label={label}
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={label}
        aria-readonly={readOnly || undefined}
        className="rating-track"
        onKeyDown={onKeyDown}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = value === null ? 0 : Math.max(0, Math.min(1, value - (star - 1)));
          return (
            <span key={star} className="rating-star" aria-hidden="true">
              <span className="rating-star-fill" style={{ width: `${fill * 100}%` }}>
                ★
              </span>
              ★
            </span>
          );
        })}
      </div>
      {readOnly || !onChange ? null : (
        <div className="rating-hit">
          {HALVES.map((half) => (
            <button
              key={half}
              type="button"
              tabIndex={-1}
              aria-label={`Dar ${formatRating(half)}`}
              onClick={() => onChange(half)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
