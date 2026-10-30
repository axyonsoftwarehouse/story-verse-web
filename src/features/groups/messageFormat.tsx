import type { ReactNode } from "react";
import { FORMAT_MARK } from "../../lib/groups";

const TAG = { "*": "strong", _: "em", "~": "s" } as const;

/** Texto da mensagem com *negrito*, _itálico_ e ~riscado~ (regras em {@link FORMAT_MARK}). */
export function formatMessage(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(FORMAT_MARK)) {
    const [whole, before, mark, inner] = match;
    const start = match.index + before.length;
    if (start > last) out.push(text.slice(last, start));
    const Tag = TAG[mark as keyof typeof TAG];
    out.push(<Tag key={key++}>{formatMessage(inner)}</Tag>);
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
