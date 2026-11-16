import { beforeEach, describe, expect, it } from "vitest";
import { installNudgeReady, noteBookOpened, noteVisit } from "./installNudge";

describe("installNudge (U6)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("não convida na primeira visita", () => {
    noteVisit();
    noteVisit(); // recarregar a mesma aba não conta de novo
    expect(installNudgeReady()).toBe(false);
  });

  it("convida depois de abrir um livro", () => {
    noteVisit();
    noteBookOpened();
    expect(installNudgeReady()).toBe(true);
  });

  it("convida na segunda visita", () => {
    noteVisit();
    sessionStorage.clear(); // outra aba ou outro dia
    noteVisit();
    expect(installNudgeReady()).toBe(true);
  });
});
