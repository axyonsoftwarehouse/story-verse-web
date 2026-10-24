#!/usr/bin/env bash
set -euo pipefail

# Contas de teste do QA (idempotente). Rode em /home/deploy/storyverse-qa: bash seed-qa.sh
#   qa-leitor@example.com       — com a estante (feature library)
#   qa-sem-estante@example.com  — sem a estante
#   qa-admin@example.com        — superadmin
#   qa-moderador@example.com    — moderator
#   qa-suporte@example.com      — support
# Todas com a senha QA_TEST_PASSWORD do .env (nunca impressa). example.com não recebe e-mail.
. "$(dirname "$0")/qa-guard.sh"
qa_guard

API_URL="${QA_API_URL:-https://api.qa.storyverse.2.29.42.104.sslip.io}"
[ -n "${QA_TEST_PASSWORD:-}" ] || qa_die "defina QA_TEST_PASSWORD no .env"

existing=$(qa_compose exec -T qa-db psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select email from auth.users where email like 'qa-%@example.com'")

# Só cadastra quem falta: a API limita cadastros por IP (5 por hora), e o seed roda de novo a cada reset.
json_str() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  printf '%s' "$s"
}

signup() {
  local email="$1" name="$2" body code
  if grep -qx "$email" <<<"$existing"; then
    echo "conta: $email (já existia)"
    return
  fi
  body=$(printf '{"email":"%s","password":"%s","name":"%s"}' \
    "$(json_str "$email")" "$(json_str "$QA_TEST_PASSWORD")" "$(json_str "$name")")
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/v1/auth/signup" \
    -H 'Content-Type: application/json' --data-binary @- <<<"$body")
  case "$code" in
    200|201|202|409) echo "conta: $email" ;;
    *) qa_die "cadastro de $email respondeu $code" ;;
  esac
}

signup qa-leitor@example.com "Leitor de QA"
signup qa-sem-estante@example.com "Leitor sem estante"
signup qa-admin@example.com "Admin de QA"
signup qa-moderador@example.com "Moderador de QA"
signup qa-suporte@example.com "Suporte de QA"

qa_compose exec -T qa-db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
insert into public.feature_access (user_id, feature, enabled)
select id, 'library', true from auth.users where email = 'qa-leitor@example.com'
on conflict (user_id, feature) do update set enabled = true, updated_at = now();
delete from public.feature_access
 where feature = 'library' and user_id in (select id from auth.users where email = 'qa-sem-estante@example.com');
insert into public.user_roles (user_id, role)
select id, 'superadmin' from auth.users where email = 'qa-admin@example.com'
on conflict do nothing;
insert into public.user_roles (user_id, role)
select id, 'moderator' from auth.users where email = 'qa-moderador@example.com'
on conflict do nothing;
insert into public.user_roles (user_id, role)
select id, 'support' from auth.users where email = 'qa-suporte@example.com'
on conflict do nothing;
SQL
# A conta suspensa usa o mesmo hash do qa-leitor (evita o limite de cadastros por IP) e ganha uma
# suspens?o ativa. O seed ? idempotente: n?o recria a conta nem duplica a san??o.
qa_compose exec -T qa-db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
select 'qa-suspenso@example.com', u.encrypted_password, '{"name":"Leitor suspenso"}'::jsonb, now()
  from auth.users u
 where u.email = 'qa-leitor@example.com'
   and not exists (select 1 from auth.users where email = 'qa-suspenso@example.com');

insert into public.user_sanctions (user_id, kind, reason, expires_at, created_by)
select u.id, 'suspension', 'Conta de teste do QA', now() + interval '30 days', a.id
  from auth.users u
  left join auth.users a on a.email = 'qa-admin@example.com'
 where u.email = 'qa-suspenso@example.com'
   and not exists (
     select 1 from public.user_sanctions s
      where s.user_id = u.id and s.kind in ('suspension', 'ban')
        and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
   );
SQL

echo "Contas de teste prontas (senha: QA_TEST_PASSWORD no .env)."
