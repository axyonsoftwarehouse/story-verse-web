import { type SupabaseUser } from "./auth";

/** Nome mostrado no perfil: o do cadastro ou, sem ele, o começo do e-mail. */
export function displayNameOf(user: SupabaseUser): string {
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  return name || user.email.split("@")[0];
}

/** Avatar escolhido (dos prontos) ou a inicial do nome sobre a cor da conta. */
export function metaString(user: SupabaseUser, key: string): string | null {
  const v = user.user_metadata?.[key];
  return typeof v === "string" && v ? v : null;
}
