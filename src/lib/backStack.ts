/**
 * Botão "voltar" do celular (e do navegador): cada tela ou janela aberta (livro, perfil, login,
 * chat…) empilha um passo no histórico. Voltar fecha a de cima em vez de sair do app. Quando a
 * janela é fechada pelo próprio app (X, Cancelar), o passo dela sai do histórico também.
 *
 * history.back() não é imediato: se uma janela fecha e outra abre no mesmo instante (ex.: importar
 * → abre o livro), o novo passo só entra depois que o "voltar" terminar. Sem essa fila o voltar
 * apagava o passo novo e, mais tarde, o app voltava um passo a mais e saía do site.
 */

type Layer = { id: number; close: () => void; pushed: boolean };

const stack: Layer[] = [];
let seq = 0;
/** Voltas disparadas pelo próprio app ainda não concluídas (não fecham nada). */
let pendingBacks = 0;
/** Passos esperando essas voltas terminarem para entrar no histórico. */
const queued: Layer[] = [];

function push(layer: Layer) {
  layer.pushed = true;
  history.pushState({ storyverseLayer: layer.id }, "");
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (pendingBacks > 0) {
      pendingBacks--;
      if (pendingBacks === 0) for (const l of queued.splice(0)) push(l);
      return;
    }
    stack.pop()?.close();
  });
}

export function pushLayer(close: () => void): number {
  const layer: Layer = { id: ++seq, close, pushed: false };
  stack.push(layer);
  if (pendingBacks > 0) queued.push(layer);
  else push(layer);
  return layer.id;
}

export function removeLayer(id: number) {
  const i = stack.findIndex((l) => l.id === id);
  if (i < 0) return;
  const [layer] = stack.splice(i, 1);
  const q = queued.indexOf(layer);
  if (q >= 0) {
    // Ainda nem entrou no histórico: só sai da fila.
    queued.splice(q, 1);
    return;
  }
  if (!layer.pushed) return;
  pendingBacks++;
  history.back();
}
