import type { ReactNode } from "react";

/**
 * Ícones vetoriais das conquistas e dos presentes (cartão "Substituir emojis nativos por ícones
 * vetoriais").
 *
 * Antes cada conquista e cada presente era um emoji do sistema (📖, 🔥, 🎁…): mudava de desenho entre
 * Windows, Android e iPhone e destoava do dourado da plataforma. Aqui os desenhos são de traço,
 * herdando `currentColor` — no card desbloqueado ficam dourados; no bloqueado o próprio CSS do card
 * já aplica `grayscale` + opacidade.
 *
 * A chave é o **id** da conquista (`src/lib/achievements.ts`) e o id do presente
 * (`gift_catalog`). Presente novo criado pela administração, sem desenho aqui, continua com o
 * emoji que veio do banco — nada quebra.
 */

type IconProps = { size?: number; className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 26, className, color, children }: IconProps & { color?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={color ? { color } : undefined}
      {...STROKE}
    >
      {children}
    </svg>
  );
}

const ACHIEVEMENTS: Record<string, ReactNode> = {
  // Leu pela primeira vez.
  "first-page": (
    <>
      <path d="M12 6.6C10.6 5.4 8.7 4.8 6.5 4.8H4v13.4h2.5c2.2 0 4.1.6 5.5 1.8 1.4-1.2 3.3-1.8 5.5-1.8H20V4.8h-2.5c-2.2 0-4.1.6-5.5 1.8Z" />
      <path d="M12 6.6V20" />
    </>
  ),
  // Primeira mensagem para um personagem.
  "first-chat": <path d="M20.4 11.6a8.3 8.3 0 0 1-8.9 8.3 8.9 8.9 0 0 1-3.8-.8L3.6 21l1.9-4.5a8 8 0 0 1-1.9-4.9A8.4 8.4 0 0 1 11.9 3a8.4 8.4 0 0 1 8.5 8.6Z" />,
  // 7 dias seguidos.
  "streak-7": (
    <path d="M8.6 14.4a2.6 2.6 0 0 0 2.6-2.6c0-1.4-.5-2.1-1-3.1-1.1-2.2-.2-4.1 2-6.1.5 2.6 2 5 4.1 6.6 2 1.6 3.1 3.6 3.1 5.6a7.1 7.1 0 1 1-14.2 0c0-1.2.4-2.3 1-3a2.6 2.6 0 0 0 2.4 2.6Z" />
  ),
  // Terminou o primeiro livro.
  "first-finish": (
    <>
      <path d="M5.2 4v17" />
      <path d="M5.2 5h12l-2.6 4 2.6 4h-12" />
    </>
  ),
  // 10 trechos marcados.
  "marks-10": (
    <>
      <path d="M14 4.4 19.6 10 12 17.6 6 19l1.4-6L14 4.4Z" />
      <path d="M4.5 21h15" />
    </>
  ),
  // Conversou com 5 personagens.
  "cast-5": (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.6 20c0-3 2.4-5.2 5.4-5.2s5.4 2.2 5.4 5.2" />
      <path d="M15.8 5.4a3.2 3.2 0 0 1 0 6" />
      <path d="M17.2 14.9c2 .7 3.2 2.5 3.2 4.6" />
    </>
  ),
  // 10 horas de leitura.
  "hours-10": (
    <>
      <path d="M7 3.6h10M7 20.4h10" />
      <path d="M8.2 3.6v3c0 1.4 3.8 3.4 3.8 5.4s-3.8 4-3.8 5.4v3" />
      <path d="M15.8 3.6v3c0 1.4-3.8 3.4-3.8 5.4s3.8 4 3.8 5.4v3" />
    </>
  ),
  // Recebeu um presente.
  gift: (
    <>
      <rect x="3.6" y="9" width="16.8" height="11" rx="1.8" />
      <path d="M3.6 13.4h16.8M12 9v11" />
      <path d="M12 9C10.6 6.1 9.1 5.1 7.7 5.7c-1.3.6-1 2.3.6 3.3H12Z" />
      <path d="M12 9c1.4-2.9 2.9-3.9 4.3-3.3 1.3.6 1 2.3-.6 3.3H12Z" />
    </>
  ),
  // 100 mensagens trocadas.
  "chat-100": (
    <>
      <path d="M8.4 4h7.9a2 2 0 0 1 2 2v5.1a2 2 0 0 1-2 2h-1.1v3l-3-3h-3.8a2 2 0 0 1-2-2" />
      <path d="M5.6 3.4h4.2a1.8 1.8 0 0 1 1.8 1.8v4.2a1.8 1.8 0 0 1-1.8 1.8H7l-2.6 2.3v-2.3h-.2A1.6 1.6 0 0 1 2.6 9.6V5.2a1.8 1.8 0 0 1 1.8-1.8Z" />
    </>
  ),
  // Terminou 5 livros.
  "finish-5": (
    <>
      <rect x="3.6" y="4.4" width="4" height="15.2" rx="0.6" />
      <rect x="9.2" y="4.4" width="4" height="15.2" rx="0.6" />
      <path d="M15.4 5.6 19.3 4.6l2.1 14.3-3.9 1z" />
    </>
  ),
  // 30 dias seguidos.
  "streak-30": (
    <>
      <path d="M10.6 20.4c3.1 0 5.3-2 5.3-4.9 0-3.7-3.2-5.6-3.7-9.1-1.6 1.3-2.7 2.7-2.7 4.2 0 1.3.8 2.1.8 3.3 0 1-.7 1.8-1.6 1.8" />
      <path d="M18.7 4.2l.9 1.6 1.6.9-1.6.9-.9 1.6-.9-1.6-1.6-.9 1.6-.9z" />
    </>
  ),
  // Deu a primeira nota.
  "first-rating": (
    <path d="M12 4.2l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
  ),
  // 5 notas dadas.
  "ratings-5": (
    <>
      <path d="M12 3.6l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" />
      <path d="M6.2 13.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
      <path d="M17.8 13.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
    </>
  ),
  // Primeira resenha.
  "first-review": (
    <>
      <path d="M13.4 6.4 17.6 10.6" />
      <path d="M4.8 19.2l1-4L15.3 4.7a2.1 2.1 0 0 1 3 3L8.8 18.2l-4 1Z" />
    </>
  ),
  // 3 resenhas.
  "reviews-3": (
    <>
      <path d="M6 3.6h8l4 4v12.8H6z" />
      <path d="M13.8 3.6v4.4H18" />
      <path d="M9 12.6h6M9 16.2h3.8" />
    </>
  ),
  // Livros de 3 gêneros.
  "genres-3": (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m15.2 8.8-2.1 4.3-4.3 2.1 2.1-4.3 4.3-2.1Z" />
    </>
  ),
  // 10 livros no ano.
  "year-10": (
    <>
      <rect x="4" y="5.8" width="16" height="14.2" rx="2" />
      <path d="M4 10.4h16M8.8 3.6v4.2M15.2 3.6v4.2" />
      <path d="M8 13.6h2M13.6 13.6h2M8 17h2" />
    </>
  ),
};

/** Desenhos cheios, com a cor do objeto. O tema do perfil não pinta esses presentes. */
const GIFTS: Record<string, ReactNode> = {
  flor: (
    <>
      <path d="M32 38c2 10 2 16 0 22" fill="none" stroke="#3d8f4a" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 48c-8 2-12 8-10 12" fill="none" stroke="#3d8f4a" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="22" rx="8" ry="14" fill="#e56b93" transform="rotate(0 32 22)" />
      <ellipse cx="32" cy="22" rx="8" ry="14" fill="#f2a0bf" transform="rotate(60 32 22)" />
      <ellipse cx="32" cy="22" rx="8" ry="14" fill="#d4537c" transform="rotate(120 32 22)" />
      <circle cx="32" cy="22" r="5.5" fill="#f6d36b" />
    </>
  ),
  coracao: <path d="M32 54S10 40 10 26a12 12 0 0 1 22-6 12 12 0 0 1 22 6c0 14-22 28-22 28Z" fill="#e5484d" />,
  coroa: (
    <>
      <path d="M10 46h44l-3-24-10 10-9-16-9 16-10-10z" fill="#e4b86a" stroke="#8a5a22" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="18" cy="20" r="3" fill="#e5484d" />
      <circle cx="32" cy="14" r="3.2" fill="#5b8def" />
      <circle cx="46" cy="20" r="3" fill="#3d8f4a" />
    </>
  ),
  trofeu: (
    <>
      <path d="M22 12h20v12a10 10 0 0 1-20 0V12Z" fill="#f0c36a" stroke="#8a5a22" strokeWidth="2" />
      <path d="M22 16H14a8 8 0 0 0 8 10" fill="none" stroke="#e4b86a" strokeWidth="3" />
      <path d="M42 16h8a8 8 0 0 1-8 10" fill="none" stroke="#e4b86a" strokeWidth="3" />
      <path d="M32 34v8M24 54h16M26 42h12l2 12H24z" fill="#c9892a" stroke="#8a5a22" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
};

function GiftSvg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Conquista: desenho vetorial pelo id; id desconhecido cai num selo genérico. */
export function BadgeIcon({ id, size = 26, className }: IconProps & { id: string }) {
  const desenho = ACHIEVEMENTS[id];
  if (desenho) return <Svg size={size} className={className}>{desenho}</Svg>;
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="9.4" r="4.6" />
      <path d="M9 13.4 7.6 20.4l4.4-2 4.4 2-1.4-7" />
    </Svg>
  );
}

/**
 * Presente: desenho vetorial por id do `gift_catalog`. Item novo, criado pela administração, não tem
 * desenho aqui — nesse caso o emoji que veio do banco continua aparecendo.
 */
export function GiftIcon({ id, emoji, size = 18, className }: IconProps & { id: string; emoji: string }) {
  const desenho = GIFTS[id];
  if (desenho) return <GiftSvg size={size} className={className}>{desenho}</GiftSvg>;
  return (
    <span className={className} aria-hidden="true" style={{ fontSize: `${size}px`, lineHeight: 1 }}>
      {emoji}
    </span>
  );
}
