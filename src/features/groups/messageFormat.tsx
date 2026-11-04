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

const DRAFT_CLASS = { "*": "fmt-b", _: "fmt-i", "~": "fmt-s" } as const;

/** Texto solto do rascunho; dentro de itálico cada palavra vira um bloco inclinado (ver {@link formatDraft}). */
function draftText(text: string, italic: boolean, key: () => number): ReactNode[] {
  if (!italic) return [text];
  return text.split(/(\s+)/).map((part) =>
    !part || /^\s+$/.test(part) ? part : (
      <span key={key()} className="fmt-i-word">
        {part}
      </span>
    ),
  );
}

/**
 * O rascunho da caixa de texto já formatado, como no WhatsApp: os marcadores continuam lá (apagados)
 * e nada muda a largura das letras, para a camada ficar exatamente atrás do texto digitado. O negrito
 * é um contorno (não troca a fonte) e o itálico inclina cada palavra sem mexer no espaço dela.
 */
export function formatDraft(text: string): ReactNode[] {
  let n = 0;
  const key = () => n++;
  const walk = (value: string, inItalic: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    let last = 0;
    for (const match of value.matchAll(FORMAT_MARK)) {
      const [whole, before, mark, inner] = match;
      const start = match.index + before.length;
      if (start > last) out.push(...draftText(value.slice(last, start), inItalic, key));
      const nextItalic = inItalic || mark === "_";
      out.push(
        <span key={key()} className={DRAFT_CLASS[mark as keyof typeof DRAFT_CLASS]}>
          <span className="fmt-mark">{mark}</span>
          {walk(inner, nextItalic)}
          <span className="fmt-mark">{mark}</span>
        </span>,
      );
      last = match.index + whole.length;
    }
    if (last < value.length) out.push(...draftText(value.slice(last), inItalic, key));
    return out;
  };
  return walk(text, false);
}
