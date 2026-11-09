/**
 * Para onde voltar depois do login (`?retorno=`). Só caminhos conhecidos do próprio site, para o
 * parâmetro não virar redirecionamento aberto.
 */
const FIXED = new Set(["/assinar", "/conta/assinatura"]);
const AUDIOBOOK = /^\/ouvir\/[^/?#\\]+$/;

export function safeLoginReturn(retorno: string | null | undefined): string | null {
  if (!retorno) return null;
  if (FIXED.has(retorno) || AUDIOBOOK.test(retorno)) return retorno;
  return null;
}

/** Link para entrar e voltar ao caminho dado. */
export function loginHref(retorno: string): string {
  return `/?${new URLSearchParams({ login: "1", retorno }).toString()}`;
}
