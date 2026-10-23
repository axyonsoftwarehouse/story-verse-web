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

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Acervo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fórum" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contas" })).toBeNull();
  });
});
