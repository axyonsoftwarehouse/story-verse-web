/**
 * Para onde voltar depois do login (`?retorno=`). Só caminhos conhecidos do próprio site, para o
 * parâmetro não virar redirecionamento aberto.
 */
const FIXED = new Set([
  "/assinar",
  "/conta/assinatura",
  // Subpáginas com o topo do site (U3): "Entrar" de lá volta para onde a pessoa estava.
  "/biblioteca",
  "/ouvir",
  "/termos",
  "/privacidade",
  "/cancelamento",
]);
/** Ficha de livro da biblioteca ou página de audiolivro: um segmento só depois do prefixo. */
const BOOK_PAGE = /^\/(ouvir|biblioteca)\/[^/?#\\]+$/;

export function safeLoginReturn(retorno: string | null | undefined): string | null {
  if (!retorno) return null;
  if (FIXED.has(retorno) || BOOK_PAGE.test(retorno)) return retorno;
  return null;
}

/** Link para entrar (ou, com `register`, criar conta) e voltar ao caminho dado. */
export function loginHref(retorno: string, mode: "login" | "register" = "login"): string {
  const params = new URLSearchParams(mode === "register" ? { cadastro: "1" } : { login: "1" });
  if (safeLoginReturn(retorno)) params.set("retorno", retorno);
  return `/?${params.toString()}`;
}

/** `?login=1` / `?cadastro=1` na home: qual janela de entrada abrir, se alguma. */
export function authModalFromUrl(search: string): "login" | "register" | null {
  const params = new URLSearchParams(search);
  if (params.get("cadastro") === "1") return "register";
  if (params.get("login") === "1") return "login";
  return null;
}
