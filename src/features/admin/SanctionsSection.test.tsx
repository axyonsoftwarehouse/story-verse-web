import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  listSanctions,
  revokeSanction,
  type AdminSanction,
} from "../../lib/adminSanctions";
import { SanctionsSection } from "./SanctionsSection";

vi.mock("../../lib/adminSanctions", () => ({
  listSanctions: vi.fn(),
  revokeSanction: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const sanction: AdminSanction = {
  id: "s1",
  userId: "u1",
  userName: "Leitor de QA",
  emailMasked: "qa***@example.com",
  kind: "warning",
  reason: "Leia as regras.",
  expiresAt: null,
  createdBy: "admin-1",
  createdByName: "Admin",
  createdAt: "2026-10-24T12:00:00Z",
  revokedBy: null,
  revokedByName: null,
  revokedAt: null,
};

describe("SanctionsSection", () => {
  beforeEach(() => {
    vi.mocked(listSanctions).mockResolvedValue({ items: [sanction], nextCursor: null });
    vi.mocked(revokeSanction).mockResolvedValue({ ...sanction, revokedAt: "2026-10-24T13:00:00Z" });
  });

  it("lista sanções e permite revogar como superadmin", async () => {
    render(<SanctionsSection session={session} roles={["superadmin"]} />);
    expect(await screen.findByText("Leitor de QA")).toBeInTheDocument();
    expect(screen.getAllByText("Aviso").length).toBeGreaterThan(0);
    expect(screen.getByText("qa***@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(revokeSanction).toHaveBeenCalledWith(session, "s1"));
  });

  it("support vê a lista, mas não revoga", async () => {
    render(<SanctionsSection session={session} roles={["support"]} />);
    expect(await screen.findByText("Leitor de QA")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull();
  });

  it("filtra por situação, tipo e conta", async () => {
    render(<SanctionsSection session={session} roles={["superadmin"]} />);
    await screen.findByText("Leitor de QA");
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "revoked" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ban" } });
    fireEvent.change(screen.getByLabelText("Buscar conta"), { target: { value: "qa" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() =>
      expect(listSanctions).toHaveBeenCalledWith(
        session,
        expect.objectContaining({ status: "revoked", kind: "ban", q: "qa", limit: 20 }),
      ),
    );
  });
});
