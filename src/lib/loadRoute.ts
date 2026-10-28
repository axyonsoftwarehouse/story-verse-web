const RELOAD_KEY = "storyverse:route-reload";

/**
 * Baixa o arquivo de uma rota carregada sob demanda. Depois de um deploy o arquivo antigo some
 * do servidor: a página recarrega uma vez para pegar a versão nova; se falhar de novo, o erro segue.
 */
export function loadRoute<T>(
  load: () => Promise<T>,
  reload = () => window.location.reload(),
): Promise<T> {
  return load().then(
    (module) => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        // Sem armazenamento.
      }
      return module;
    },
    (error: unknown) => {
      let reloaded = true;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) !== null;
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        // Sem armazenamento não dá para evitar recarregar em laço: mostra o erro.
      }
      if (reloaded) throw error;
      reload();
      return new Promise<never>(() => {});
    },
  );
}
