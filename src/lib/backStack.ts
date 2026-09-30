/**
 * Botão "voltar" do celular (e do navegador): cada tela ou janela aberta (livro, perfil, login,
 * chat…) empilha um passo no histórico. Voltar fecha a de cima em vez de sair do app. Quando a
 * janela é fechada pelo próprio app (X, Cancelar), o passo dela sai do histórico também.
 */

type Layer = { id: number; close: () => void };

const stack: Layer[] = [];
let seq = 0;
/** Voltas disparadas pelo próprio app (para tirar o passo do histórico): não fecham nada. */
let ignorePops = 0;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    stack.pop()?.close();
  });
}

export function pushLayer(close: () => void): number {
  const id = ++seq;
  stack.push({ id, close });
  history.pushState({ storyverseLayer: id }, "");
  return id;
}

export function removeLayer(id: number) {
  const i = stack.findIndex((l) => l.id === id);
  if (i < 0) return;
  stack.splice(i, 1);
  ignorePops++;
  history.back();
}
