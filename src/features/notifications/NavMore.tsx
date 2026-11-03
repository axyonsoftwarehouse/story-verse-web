import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import "./notifications.css";

export type NavMoreItem = { key: string; label: string; icon?: ReactNode; to?: string; onClick?: () => void };

/**
 * "Mais" do topo: nas telas estreitas, os botões menos usados saem da barra (que nunca quebra
 * linha) e ficam aqui. Nas largas o botão some e eles aparecem na própria barra.
 */
export function NavMore({ items }: { items: NavMoreItem[] }) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const r = button.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn nav-more"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais opções"
        aria-expanded={open}
        title="Mais"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div className="notif-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <nav className="nav-more-panel" style={pos} aria-label="Mais opções">
                {items.map((item) =>
                  item.to ? (
                    <Link key={item.key} to={item.to} onClick={() => setOpen(false)}>
                      {item.icon}
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ),
                )}
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
