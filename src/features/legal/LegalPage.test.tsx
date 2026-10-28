import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LEGAL_CONTACT, LegalPage, type LegalDoc } from "./LegalPage";

function renderDoc(doc: LegalDoc) {
  return render(
    <MemoryRouter>
      <LegalPage doc={doc} />
    </MemoryRouter>,
  );
}

describe("LegalPage", () => {
  it.each([
    ["termos", "Termos de uso"],
    ["privacidade", "Política de privacidade"],
    ["cancelamento", "Cancelamento e reembolso"],
  ] as const)("%s mostra o título, o contato e links para os outros documentos", (doc, title) => {
    renderDoc(doc);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: LEGAL_CONTACT }).length).toBeGreaterThan(0);
    const links = screen.getByRole("navigation", { name: "Documentos" });
    expect(links.querySelectorAll("a")).toHaveLength(2);
  });

  it("cancelamento promete reembolso integral em até 7 dias da primeira cobrança", () => {
    renderDoc("cancelamento");
    expect(screen.getByText(/Até 7 dias depois da primeira cobrança/)).toBeTruthy();
  });
});
