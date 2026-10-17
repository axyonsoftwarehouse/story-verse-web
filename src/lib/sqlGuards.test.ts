import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

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
});
