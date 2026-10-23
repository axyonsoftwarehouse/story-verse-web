/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Opcional. Base da API própria (Marco 2). Definida, ela passa a servir o login/cadastro/sessão. */
  readonly VITE_API_URL?: string;
  /** Opcional. "qa" no build do ambiente de QA: mostra a faixa "Ambiente de QA". */
  readonly VITE_APP_ENV?: string;
  /** Opcional. "false" deixa ler e conversar sem conta (a conta vira opcional). */
  readonly VITE_LOGIN_REQUIRED?: string;
  /** Opcional. DSN do projeto Storyverse Web no Sentry; sem ele o SDK não envia eventos. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  /** Opcional. "true" pede o código de 6 números no cadastro (OTP configurado no Supabase). */
  readonly VITE_SUPABASE_EMAIL_OTP_ENABLED?: string;
  readonly VITE_GROQ_API_KEY?: string;
  /** Opcional. Lista separada por vírgula; cada modelo tem cota própria no Groq. */
  readonly VITE_GROQ_MODELS?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  /** Opcional. Um ou mais modelos separados por vírgula. Ex.: gemini-3.5-flash-lite,gemini-flash-lite-latest */
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  /** Opcional. Modelos gratuitos do OpenRouter terminam em ":free". */
  readonly VITE_OPENROUTER_MODELS?: string;
  /** Opcional. Link do app na Google Play (sem ele, "Baixar app" instala o site). */
  readonly VITE_ANDROID_APP_URL?: string;
  /** Opcional. Link do app na App Store. */
  readonly VITE_IOS_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
