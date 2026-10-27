import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Sem \r: no Windows (autocrlf) a cópia local pode ter CRLF.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

describe("garantias de SQL", () => {
  it("não promove admin a partir do e-mail informado no cadastro", () => {
    for (const path of ["database/schema.sql", "supabase/community-books.sql"]) {
      const sql = read(path);
      expect(sql).not.toMatch(/businesscodeplus/i);
      // O exemplo comentado (`-- insert ...`) é permitido; uma promoção ativa não.
      expect(sql).not.toMatch(/^insert into public\.admins/m);
    }
  });

  it("o schema da API valida a posse do text_path no insert", () => {
    const sql = read("database/schema.sql");
    expect(sql).toContain("text_path ~ ('^' || auth.uid()::text");
  });

  it("capa e foto exigem a URL inteira do Storage da pessoa, e a capa só muda em análise", () => {
    const sql = read("database/schema.sql");
    expect(sql).not.toMatch(/position\('\/profile-media\/'/);
    expect(sql).not.toMatch(/like '%\/profile-media\/'/);
    expect(sql).toContain("is_own_media_url(new_cover, auth.uid(), 'livros/[A-Za-z0-9-]+')");
    expect(sql).toContain("user_id = auth.uid() and status = 'pending'");
  });

  it("o heartbeat usa o lado compartilhado do lock do fechamento semanal", () => {
    for (const path of ["database/schema.sql", "database/reading-clock.sql"]) {
      const sql = read(path);
      expect(sql).toContain("pg_advisory_xact_lock_shared(664332)");
      expect(sql.match(/pg_advisory_xact_lock\(664332\)/g)?.length ?? 0).toBe(path.endsWith("schema.sql") ? 1 : 0);
    }
  });

  it.each([
    ["deploy/storyverse-qa/sql/2026-10-26-revisao-seguranca.sql", "https://api.qa.storyverse.2.29.42.104.sslip.io"],
    ["deploy/sql/2026-10-26-revisao-seguranca-producao.sql", "https://api.storyverse.2.29.42.104.sslip.io"],
  ])("o patch %s traz as funções iguais às do schema e a origem certa", (path, origin) => {
    const schema = read("database/schema.sql");
    const patch = read(path);
    const fns = patch.match(/^create or replace function[\s\S]*?^\$\$;$/gm) ?? [];
    expect(fns.length).toBe(5);
    for (const fn of fns) expect(schema).toContain(fn);
    expect(patch).toContain(`current_database(), '${origin}')`);
  });
});
