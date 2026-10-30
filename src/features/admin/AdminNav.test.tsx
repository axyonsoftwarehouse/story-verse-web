import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminNav } from "./AdminNav";

describe("AdminNav", () => {
  it("mostra só as seções do papel e marca a atual", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminNav roles={["moderator"]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Grupos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fórum" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Contas" })).toBeNull();
  });

  it("mostra o contador de pendências só quando há algo", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminNav roles={["moderator"]} pending={{ catalog: 3, groups: 0 }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Acervo/ })).toHaveTextContent("3");
    expect(screen.getByLabelText("3 pendente(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grupos" })).toBeInTheDocument();
  });
});
