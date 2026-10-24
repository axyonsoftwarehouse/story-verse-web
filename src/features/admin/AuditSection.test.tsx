import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { exportAudit, listAudit, type AuditEntry } from "../../lib/adminAudit";
import { AuditSection } from "./AuditSection";

vi.mock("../../lib/adminAudit", () => ({
  listAudit: vi.fn(),
  exportAudit: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const entry: AuditEntry = {
  id: 1,
  actorId: "admin-1",
  actorName: "Admin",
  action: "user.view",
  targetType: "user",
  targetId: "u1",
  metadata: {},
  createdAt: "2026-10-24T12:00:00Z",
};

function renderSection() {
  return render(
    <MemoryRouter>
      <AuditSection session={session} />
    </MemoryRouter>,
  );
}

describe("AuditSection", () => {
  beforeEach(() => {
    vi.mocked(listAudit).mockResolvedValue({ items: [entry], nextBefore: null });
    vi.mocked(exportAudit).mockResolvedValue(new Blob(["id;createdAt\n1;x"], { type: "text/csv" }));
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("exporta respeitando o período aplicado", async () => {
    renderSection();
    expect(await screen.findByText("Conta consultada")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Exportar CSV" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-24" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);
    await waitFor(() =>
      expect(exportAudit).toHaveBeenCalledWith(session, expect.objectContaining({ from: "2026-10-01", to: "2026-10-24" })),
    );
  });

  it("mostra o erro da exportação", async () => {
    vi.mocked(exportAudit).mockRejectedValueOnce(new Error("Máximo de 31 dias."));
    renderSection();
    await screen.findByText("Conta consultada");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-24" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Máximo de 31 dias."));
  });
});
