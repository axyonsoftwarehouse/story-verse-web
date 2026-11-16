import { useEffect, useRef } from "react";
import { pushLayer, removeLayer } from "./backStack";

/**
 * Enquanto `open`, o botão voltar do celular fecha esta tela/janela (chama `close`) em vez de
 * sair do app. Fechada pelo próprio app, o passo sai do histórico sozinho.
 */
export function useBackClose(open: boolean, close: () => void, url?: string) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const urlRef = useRef(url);
  urlRef.current = url;
  useEffect(() => {
    if (!open) return;
    let closedByBack = false;
    const id = pushLayer(() => {
      closedByBack = true;
      closeRef.current();
    }, urlRef.current);
    return () => {
      if (!closedByBack) removeLayer(id);
    };
  }, [open]);
}
