import { useState, type FormEvent } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import type { SupabaseSession } from "../../lib/auth";
import { grantDiamonds, grantProblem, parseGrantAmount, type DiamondGrantResult } from "../../lib/adminDiamonds";

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const fmt = (n: number) => Math.abs(n).toLocaleString("pt-BR");

/** Creditar ou debitar diamantes de uma conta pelo e-mail, com motivo (fica na auditoria). */
export function DiamondGrantSection({ session }: { session: SupabaseSession }) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiamondGrantResult | null>(null);
  const { confirm, dialog } = useConfirm();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    const input = { email, amount: parseGrantAmount(amount), note };
    const problem = grantProblem(input);
    if (problem) {
      setError(problem);
      return;
    }
    const credit = input.amount > 0;
    const ok = await confirm({
      title: credit ? `Creditar ${fmt(input.amount)} diamantes?` : `Debitar ${fmt(input.amount)} diamantes?`,
      message: `Conta: ${email.trim()}. Motivo: ${note.trim()}. O lançamento aparece como "Ajuste" no extrato da pessoa.`,
      confirmLabel: credit ? "Creditar" : "Debitar",
      danger: !credit,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const done = await grantDiamonds(session, input);
      setResult(done);
      setAmount("");
      setNote("");
    } catch (err) {
      setError(message(err, "Não foi possível lançar os diamantes."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shelf admin-diamond-grant">
      <div className="shelf-head">
        <div>
          <h2>Conceder diamantes</h2>
          <p className="muted">
            Credite (número positivo) ou debite (negativo) diamantes de uma conta. O motivo fica registrado na
            auditoria.
          </p>
        </div>
      </div>
      <form className="admin-filters" onSubmit={(event) => void submit(event)} noValidate>
        <label>
          E-mail da conta
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" required />
        </label>
        <label>
          Quantidade
          <input
            type="text"
            inputMode="numeric"
            placeholder="ex.: 500 ou -100"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label>
          Motivo
          <input
            type="text"
            maxLength={200}
            placeholder="ex.: beta tester"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Lançando…" : "Lançar"}
        </button>
      </form>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="muted" role="status">
          {result.amount > 0 ? `${fmt(result.amount)} diamantes creditados` : `${fmt(result.amount)} diamantes debitados`} para{" "}
          {result.email}. Saldo novo: {result.balance.toLocaleString("pt-BR")}.
        </p>
      ) : null}
      {dialog}
    </section>
  );
}
