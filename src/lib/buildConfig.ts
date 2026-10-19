export function validateProductionConfig(env: Record<string, string | undefined>): void {
  const api = env.VITE_API_URL?.trim();
  if (!api) throw new Error("Configure VITE_API_URL com a API pública antes de publicar.");
  if (env.VITE_SUPABASE_URL?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim())
    throw new Error("Remova as variáveis do Supabase: a produção usa somente a API própria.");
  const url = new URL(api);
  if (url.protocol !== "https:" || url.username || url.password || url.hostname.endsWith(".localhost")
    || /^(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/.test(url.hostname))
    throw new Error("O build de produção exige um backend HTTPS público, sem loopback.");
  for (const key of ["VITE_GROQ_API_KEY", "VITE_GEMINI_API_KEY", "VITE_OPENROUTER_API_KEY"])
    if (env[key]?.trim()) throw new Error("Chaves privadas de IA devem ficar somente no servidor.");
}
