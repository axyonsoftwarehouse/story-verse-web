import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { ApiHttpError } from "../../lib/backend";
import { sanctionMessage } from "./sanctionNotice";
import {
  EMAIL_OTP_ENABLED,
  resendSignupCode,
  requestPasswordReset,
  resetPasswordWithToken,
  validateResetToken,
  updatePassword,
  signInWithPassword,
  signUpWithPassword,
  type SupabaseSession,
  verifySignupCode,
} from "../../lib/auth";
import { PasswordInput } from "../../components/PasswordInput";

/** O Supabase só deixa reenviar e-mail para o mesmo endereço depois de 60 s. */
const RESEND_COOLDOWN = 60;

export function AuthModal({
  mode,
  onClose,
  onAuthenticated,
}: {
  mode: "login" | "register";
  onClose: () => void;
  onAuthenticated: (session: SupabaseSession) => void;
}) {
  const [kind, setKind] = useState<"login" | "register" | "forgot">(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  /** Depois do envio: tela de "confira seu e-mail" (link de cadastro, código ou link de senha nova). */
  const [sent, setSent] = useState<"confirm" | "code" | "reset" | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // O foco fica no livro clicado atrás do modal e deixaria o carrossel parado depois de fechar.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  function goTo(next: "login" | "register" | "forgot") {
    setKind(next);
    setSent(null);
    setError("");
    setSuccess("");
  }

  function showSent(next: "confirm" | "code" | "reset") {
    setSent(next);
    setVerificationCode("");
    setCooldown(RESEND_COOLDOWN);
  }

  async function confirmEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Digite os 6 números do código que enviamos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onAuthenticated(await verifySignupCode(normalizedEmail, verificationCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível verificar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (sent === "reset") await requestPasswordReset(normalizedEmail);
      else await resendSignupCode(normalizedEmail);
      setSuccess(sent === "code" ? "Código novo enviado." : "E-mail enviado de novo.");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar agora.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }
    if (kind !== "forgot" && (!password || (kind === "register" && password.length < 8))) {
      setError(
        kind === "register" ? "A senha precisa ter pelo menos 8 caracteres." : "Informe sua senha.",
      );
      return;
    }
    if (kind === "register" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (kind === "forgot") {
        // Mesma resposta exista ou não a conta (não revela quais e-mails estão cadastrados).
        await requestPasswordReset(normalizedEmail);
        showSent("reset");
      } else if (kind === "register") {
        const result = await signUpWithPassword(normalizedEmail, password, name.trim());
        if (result) onAuthenticated(result);
        // Sem OTP, o link do e-mail volta para o app já logado.
        else showSent(EMAIL_OTP_ENABLED ? "code" : "confirm");
      } else {
        onAuthenticated(await signInWithPassword(normalizedEmail, password));
      }
    } catch (err) {
      if (err instanceof ApiHttpError && err.code === "ACCOUNT_SANCTIONED") {
        setError(sanctionMessage(err.body));
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível concluir a autenticação.");
      }
    } finally {
      setLoading(false);
    }
  }

  const feedback = (
    <>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="auth-success" role="status">
          {success}
        </p>
      ) : null}
    </>
  );

  const resendButton = (
    <button
      type="button"
      className="btn auth-resend"
      onClick={() => void resend()}
      disabled={loading || cooldown > 0}
    >
      {cooldown > 0
        ? `Reenviar em ${cooldown}s`
        : sent === "code"
          ? "Reenviar código"
          : "Reenviar e-mail"}
    </button>
  );

  let body: React.ReactNode;
  if (sent) {
    body = (
      <>
        <span className="auth-sent-icon" aria-hidden="true">
          {Icon.mail}
        </span>
        <h2 id="auth-title">{sent === "code" ? "Digite o código" : "Confira seu e-mail"}</h2>
        <p className="auth-subtitle">
          {sent === "code"
            ? "Enviamos um código de 6 números para"
            : sent === "confirm"
              ? "Se este e-mail puder ser usado, enviamos as instruções para"
              : "Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova em"}
          <strong className="auth-email">{normalizedEmail}</strong>
        </p>
        {sent === "code" ? (
          <form onSubmit={confirmEmail} className="auth-form">
            <input
              className="auth-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              aria-label="Código de verificação de seis números"
              autoFocus
              required
              disabled={loading}
            />
            {feedback}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? "Verificando..." : "Confirmar e-mail"}
            </button>
          </form>
        ) : null}
        <p className="auth-hint">
          {sent === "confirm" ? (
            <>
              Toque em <strong>Confirmar conta</strong> no e-mail para entrar.{" "}
            </>
          ) : sent === "reset" ? (
            "O link vale por 1 hora. "
          ) : null}
          Não chegou? Veja a pasta de spam.
        </p>
        {sent !== "code" ? feedback : null}
        {resendButton}
        <p className="auth-switch">
          <button
            type="button"
            className="inline-link"
            onClick={() => goTo(sent === "reset" ? "login" : kind)}
            disabled={loading}
          >
            Usar outro e-mail
          </button>
          {" · "}
          <button
            type="button"
            className="inline-link"
            onClick={() => goTo("login")}
            disabled={loading}
          >
            Voltar para o login
          </button>
        </p>
      </>
    );
  } else {
    body = (
      <>
        <span className="eyebrow">Storyverse</span>
        <h2 id="auth-title">
          {kind === "login"
            ? "Entre para continuar lendo"
            : kind === "register"
              ? "Crie sua conta gratuita"
              : "Esqueceu a senha?"}
        </h2>
        <p className="auth-subtitle">
          {kind === "login"
            ? "Acesse seus livros, progresso e conversas com os personagens."
            : kind === "register"
              ? "Salve seu progresso e converse com os personagens no seu ritmo."
              : "Informe o e-mail da sua conta e enviaremos um link para criar uma senha nova."}
        </p>
        <form onSubmit={submit} className="auth-form">
          {kind === "register" ? (
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                disabled={loading}
              />
            </label>
          ) : null}
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </label>
          {kind !== "forgot" ? (
            <label>
              Senha
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={kind === "login" ? "current-password" : "new-password"}
                minLength={kind === "register" ? 8 : undefined}
                required
                disabled={loading}
              />
            </label>
          ) : null}
          {kind === "login" ? (
            <button
              type="button"
              className="inline-link auth-forgot"
              onClick={() => goTo("forgot")}
              disabled={loading}
            >
              Esqueci minha senha
            </button>
          ) : null}
          {feedback}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading
              ? "Aguarde..."
              : kind === "login"
                ? "Fazer login"
                : kind === "register"
                  ? "Criar conta"
                  : "Enviar link"}
          </button>
          {kind === "register" ? (
            <p className="auth-legal">
              Ao criar a conta, você concorda com os <Link to="/termos">Termos de uso</Link> e a{" "}
              <Link to="/privacidade">Política de privacidade</Link>.
            </p>
          ) : null}
        </form>
        <p className="auth-switch">
          {kind === "register"
            ? "Já tem uma conta?"
            : kind === "forgot"
              ? "Lembrou a senha?"
              : "Ainda não tem conta?"}{" "}
          <button
            type="button"
            className="inline-link"
            onClick={() => goTo(kind === "login" ? "register" : "login")}
            disabled={loading}
          >
            {kind === "login" ? "Criar conta" : "Fazer login"}
          </button>
        </p>
      </>
    );
  }

  return (
    <div
      className="auth-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar">
          {Icon.close}
        </button>
        {/* A key troca o conteúdo com um fade curto ao ir de login para cadastro etc. */}
        <div key={sent ?? kind} className={`auth-view ${sent ? "auth-view-sent" : ""}`}>
          {body}
        </div>
      </section>
    </div>
  );
}

/** Tela de senha nova, aberta pelo link de "esqueci minha senha" (já logado por ele). */
export function NewPasswordModal({
  session,
  token,
  onDone,
  onCancel,
}: {
  session?: SupabaseSession;
  token?: string;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /** O link do e-mail é conferido antes de pedir a senha: não adianta digitar se ele já venceu. */
  const [link, setLink] = useState<"checking" | "valid" | "expired">(token ? "checking" : "valid");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void validateResetToken(token).then((valid) => {
      if (alive) setLink(valid ? "valid" : "expired");
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setLoading(true);
    setError("");
    try {
      if (token) {
        await resetPasswordWithToken(token, password);
        onDone("Senha nova salva. Entre com a senha nova.");
        return;
      }
      if (!session) throw new Error("Link de recupera\u00e7\u00e3o inv\u00e1lido.");
      await updatePassword(session, "", password);
      onDone("Senha nova salva. Você já está conectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha nova.");
    } finally {
      setLoading(false);
    }
  }

  if (link !== "valid") {
    const expired = link === "expired";
    return (
      <div className="auth-backdrop" role="presentation">
        <section
          className="auth-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-password-title"
        >
          <span className="eyebrow">Storyverse</span>
          <h2 id="new-password-title">
            {expired ? "Link inválido ou expirado" : "Conferindo o link…"}
          </h2>
          <p className="auth-subtitle">
            {expired
              ? "Este link de recuperação já foi usado ou passou do prazo. Peça um novo em “Esqueci minha senha”."
              : "Só um instante enquanto confirmamos o seu link."}
          </p>
          {expired && onCancel ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={onCancel}>
              Voltar para o login
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="auth-backdrop" role="presentation">
      <section
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-password-title"
      >
        <span className="eyebrow">Storyverse</span>
        <h2 id="new-password-title">Crie uma senha nova</h2>
        <p className="auth-subtitle">
          Escolha a senha que você vai usar para entrar daqui para frente.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Senha nova
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={loading}
            />
          </label>
          <label>
            Repita a senha
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "Aguarde..." : "Salvar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}
