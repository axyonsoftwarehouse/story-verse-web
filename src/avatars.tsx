/**
 * Avatares prontos do perfil: símbolos literários desenhados no mesmo traço dos ícones do app.
 * Na conta fica só o id (user_metadata.avatar), sem upload de imagem.
 */

type AvatarDef = { id: string; label: string; color: string; art: React.ReactNode };

export const AVATARS: AvatarDef[] = [
  {
    id: "pena",
    label: "Pena",
    color: "#e4b86a",
    art: (
      <>
        <path d="M20 4c-7 0-12 4.5-14 11l-1 5 5-1c6.5-2 10-7 10-15z" />
        <path d="M5 20l8-8M9.5 15.5h4M12 12.5h4" />
      </>
    ),
  },
  {
    id: "morcego",
    label: "Morcego",
    color: "#c98a9a",
    art: (
      <path d="M12 7c.6 1 .9 2 .9 3 1-.8 2.5-1.2 4-.8 1.4.4 2.6 1.3 4.1 1-.8 2.2-2.6 3.6-4.6 3.8-1 .1-1.9.5-2.6 1.2L12 17l-1.8-1.8c-.7-.7-1.6-1.1-2.6-1.2-2-.2-3.8-1.6-4.6-3.8 1.5.3 2.7-.6 4.1-1 1.5-.4 3 0 4 .8 0-1 .3-2 .9-3z" />
    ),
  },
  {
    id: "lupa",
    label: "Lupa",
    color: "#a8b8e0",
    art: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5.5 5.5M8 9a3 3 0 0 1 2.5-1.5" />
      </>
    ),
  },
  {
    id: "rosa",
    label: "Rosa",
    color: "#e8a0a8",
    art: (
      <>
        <path d="M12 13c-3 0-5-2-5-5 0-1 .5-2 1.5-2.5C9 7 10.5 7.5 12 6c1.5 1.5 3 1 3.5-.5 1 .5 1.5 1.5 1.5 2.5 0 3-2 5-5 5z" />
        <path d="M12 13v8M12 18c-2 0-3.5-1-4-2.5M12 17c2 0 3.5-1 4-2.5" />
      </>
    ),
  },
  {
    id: "corvo",
    label: "Corvo",
    color: "#9aa4b5",
    art: (
      <>
        <path d="M3.5 14.5c3-1 5.5-4 6.5-7 .8-2.2 3-3.5 5-3.5 1.5 0 2.5.7 3 1.5L21 6l-2.5 1c0 4.5-3 8.5-8 10L6 20.5l1-3.5c-1.5-.5-2.5-1.3-3.5-2.5z" />
        <circle cx="15.5" cy="6.8" r=".4" fill="currentColor" />
      </>
    ),
  },
  {
    id: "vela",
    label: "Vela",
    color: "#e0a36a",
    art: (
      <>
        <path d="M12 3c1.6 2 2.2 3.1 2.2 4.2a2.2 2.2 0 0 1-4.4 0C9.8 6.1 10.4 5 12 3z" />
        <rect x="9" y="11" width="6" height="9.5" rx="1" />
        <path d="M12 9.4V11M7 20.5h10" />
      </>
    ),
  },
  {
    id: "coruja",
    label: "Coruja",
    color: "#b7c98a",
    art: (
      <>
        <path d="M6 5l2.5 2.5a5.5 5.5 0 0 1 7 0L18 5v9a6 6 0 0 1-12 0z" />
        <circle cx="9.5" cy="11.5" r="1.8" />
        <circle cx="14.5" cy="11.5" r="1.8" />
        <path d="m12 13.8-.9 1.4h1.8z" />
      </>
    ),
  },
  {
    id: "chave",
    label: "Chave",
    color: "#d8c27a",
    art: (
      <>
        <circle cx="8" cy="12" r="3.8" />
        <path d="M11.8 12H21M18.5 12v3M15.5 12v2" />
      </>
    ),
  },
  {
    id: "lua",
    label: "Lua",
    color: "#9bc4b5",
    art: (
      <>
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
        <path d="M17 3.5v2.5M15.75 4.75h2.5M20.5 8v1.6M19.7 8.8h1.6" />
      </>
    ),
  },
  {
    id: "xicara",
    label: "Xícara",
    color: "#c9a27e",
    art: (
      <>
        <path d="M4.5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
        <path d="M15.5 11H17a2.5 2.5 0 0 1 0 5h-1.5M8.5 3c-1 1.5 1 2.5 0 4.5M12 3c-1 1.5 1 2.5 0 4.5M4 21h13" />
      </>
    ),
  },
  {
    id: "barco",
    label: "Barco",
    color: "#8fb8d0",
    art: (
      <>
        <path d="M3 16h18l-2.5 4.5h-13z" />
        <path d="M12 3v13M12 4.5l6 10h-6M12 7l-4.5 7.5H12" />
      </>
    ),
  },
  {
    id: "coroa",
    label: "Coroa",
    color: "#f0c870",
    art: (
      <>
        <path d="m4 8 4 4 4-6.5 4 6.5 4-4-1.5 9.5h-13z" />
        <path d="M5.5 20.5h13" />
      </>
    ),
  },
  {
    id: "gato",
    label: "Gato",
    color: "#d7a0c8",
    art: (
      <>
        <path d="M5 18V9.5L6 4l4 3.2h4L18 4l1 5.5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path d="M9 12v.5M15 12v.5M11 15h2l-1 1zM3 14.5l4 .5M3 17l4-.5M21 14.5l-4 .5M21 17l-4-.5" />
      </>
    ),
  },
  {
    id: "mascara",
    label: "Máscara",
    color: "#e6b48a",
    art: (
      <>
        <path d="M4 5c3 1 5 1 8 0 3 1 5 1 8 0 0 7-3 12-8 14C7 17 4 12 4 5z" />
        <path d="M7.8 10c.8-.6 1.7-.6 2.5 0M13.7 10c.8-.6 1.7-.6 2.5 0M9 14c1.8 1.5 4.2 1.5 6 0" />
      </>
    ),
  },
  {
    id: "ampulheta",
    label: "Ampulheta",
    color: "#b0c4d8",
    art: (
      <path d="M6.5 3h11M6.5 21h11M8 3v2a4 4 0 0 0 1.5 3.1L12 10l2.5-1.9A4 4 0 0 0 16 5V3M8 21v-2a4 4 0 0 1 1.5-3.1L12 14l2.5 1.9A4 4 0 0 1 16 19v2" />
    ),
  },
];

export function findAvatar(id: unknown): AvatarDef | undefined {
  return typeof id === "string" ? AVATARS.find((a) => a.id === id) : undefined;
}

export function AvatarArt({ avatar }: { avatar: AvatarDef }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {avatar.art}
    </svg>
  );
}
