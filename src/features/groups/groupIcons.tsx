import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** Ícones das telas de grupo (traço, na cor do texto). */
export const GIcon = {
  back: svg(<path d="M15 18l-6-6 6-6" />),
  info: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>,
  ),
  send: svg(<path d="M5 12l14-7-5 15-3-6-6-2z" />),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  search: svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>,
  ),
  lock: svg(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  camera: svg(
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>,
  ),
  bell: svg(<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />),
  users: svg(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20h3.5a5.5 5.5 0 0 0-4-5.3" />
    </>,
  ),
  book: svg(<path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5z" />),
  reply: svg(<path d="M10 8L5 12l5 4M5 12h9a5 5 0 0 1 5 5v1" />),
  trash: svg(<path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" />),
  flag: svg(<path d="M6 21V4M6 4h10l-2 4 2 4H6" />),
  close: svg(<path d="M6 6l12 12M18 6L6 18" />),
  eyeOff: svg(<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6" />),
  link: svg(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />),
  pencil: svg(<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />),
  copy: svg(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </>,
  ),
  smile: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </>,
  ),
  image: svg(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="M4 17l4.5-4.5 3.5 3.5 2.5-2.5L20 18" />
    </>,
  ),
  mic: svg(
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>,
  ),
  play: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
  chat: svg(<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.6A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" />),
};
