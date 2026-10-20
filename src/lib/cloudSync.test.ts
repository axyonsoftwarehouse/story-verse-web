import { describe, expect, it } from "vitest";
import { merge } from "./cloudSync";

const STATS = "storyverse:reading-stats";
const stats = (days: Record<string, number>) => JSON.stringify(days);

describe("merge da sincronização", () => {
  it("não apaga os dados locais quando a nuvem está vazia", () => {
    const local = { [STATS]: stats({ "2026-10-19": 120 }) };
    const base = { ...local };
    expect(merge(local, {}, base)[STATS]).toBe(local[STATS]);
  });

  it("não apaga os dados locais quando a chave sumiu só da nuvem", () => {
    const local = { [STATS]: stats({ "2026-10-19": 120 }) };
    const base = { [STATS]: stats({ "2026-10-18": 60 }) };
    expect(merge(local, {}, base)[STATS]).toBe(local[STATS]);
  });

  it("aplica o valor da nuvem quando o local não mudou", () => {
    const local = { [STATS]: stats({ "2026-10-18": 60 }) };
    const remote = { [STATS]: stats({ "2026-10-18": 60, "2026-10-19": 60 }) };
    expect(merge(local, remote, local)[STATS]).toBe(remote[STATS]);
  });

  it("junta os minutos por dia quando os dois lados mudaram", () => {
    const local = { [STATS]: stats({ "2026-10-18": 60, "2026-10-19": 120 }) };
    const remote = { [STATS]: stats({ "2026-10-18": 90, "2026-10-20": 30 }) };
    const base = { [STATS]: stats({ "2026-10-18": 60 }) };
    const merged = JSON.parse(merge(local, remote, base)[STATS]) as Record<string, number>;
    expect(merged["2026-10-18"]).toBe(90);
    expect(merged["2026-10-19"]).toBe(120);
    expect(merged["2026-10-20"]).toBe(30);
  });
});
