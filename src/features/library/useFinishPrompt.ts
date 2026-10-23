import { useCallback, useEffect, useState } from "react";
import type { Ebook } from "../../data/types";
import { bookKeyOf } from "../../lib/library";
import { shouldPromptFinish } from "../../lib/libraryStore";

/**
 * Modal de nota/resenha depois da comemoração de livro terminado. O livro entra na fila quando
 * termina e o modal abre quando a comemoração some, seja pelo toque ou pelo timer.
 */
export function useFinishPrompt(celebrating: boolean) {
  const [queued, setQueued] = useState<Ebook | null>(null);
  const [open, setOpen] = useState<Ebook | null>(null);

  useEffect(() => {
    if (celebrating || !queued) return;
    setOpen(queued);
    setQueued(null);
  }, [celebrating, queued]);

  const queue = useCallback((book: Ebook) => {
    const key = bookKeyOf(book);
    if (key && shouldPromptFinish(key)) setQueued(book);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  return { open, queue, close };
}
