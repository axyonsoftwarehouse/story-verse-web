import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import type { AdminUserDetail } from "../../lib/adminUsers";
import { getCatalog } from "../../lib/adminFeatures";
import { getUser, revokeSessions, setRole } from "../../lib/adminUsers";
import { applySanction, revokeSanction, type AdminSanction } from "../../lib/adminSanctions";
import { AccountDetail } from "./AccountDetail";

vi.mock("../../lib/adminUsers", () => ({
  getUser: vi.fn(),
  revokeSessions: vi.fn(),
  setRole: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("../../lib/adminSanctions", () => ({
  applySanction: vi.fn(),
  revokeSanction: vi.fn(),
}));

vi.mock("../../lib/adminFeatures", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminFeatures")>()),
  getCatalog: vi.fn(),
  setFeature: vi.fn(),
  listFeatureUsers: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const detail: AdminUserDetail = {
  id: "u1",
  name: "Leitora",
  email: "leitora@example.com",
  emailConfirmed: true,
  createdAt: "2026-01-01T00:00:00Z",
  lastSignInAt: null,
  roles: ["moderator"],
  features: [],
  activeSessions: 2,
  recentAudit: null,
  sanctions: [],
};

const sanction: AdminSanction = {
  id: "s1",
  userId: "u1",
  userName: "Leitora",
  emailMasked: "le***@example.com",
  kind: "warning",
  reason: "Leia as regras.",
  expiresAt: null,
  createdBy: "admin-1",
  createdByName: "Admin",
  createdAt: "2026-01-02T00:00:00Z",
  revokedBy: null,
  revokedByName: null,
  revokedAt: null,
};

function renderDetail(roles: string[]) {
  return render(
    <MemoryRouter initialEntries={["/admin/contas/u1"]}>
      <Routes>
        <Route
          path="/admin/contas/:id"
          element={<AccountDetail session={session} roles={roles} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountDetail", () => {
  beforeEach(() => {
    vi.mocked(getUser).mockResolvedValue(detail);
    vi.mocked(getCatalog).mockResolvedValue([{ feature: "library", enabledCount: 1 }]);
    vi.mocked(revokeSessions).mockResolvedValue({ revoked: 2 });
    vi.mocked(setRole).mockResolvedValue({ roles: ["moderator"] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("não encerra as sessões se a confirmação for cancelada", async () => {
    renderDetail(["superadmin"]);
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar sessões" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(revokeSessions).not.toHaveBeenCalled();
  });

  it("encerra as sessões confirmadas e mostra o total", async () => {
    renderDetail(["superadmin"]);
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar sessões" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(await screen.findByText("2 sessões encerradas.")).toBeInTheDocument();
    expect(revokeSessions).toHaveBeenCalledTimes(1);
  });

  it("mostra sanções e revoga como superadmin", async () => {
    vi.mocked(getUser).mockResolvedValue({ ...detail, roles: [], sanctions: [sanction] });
    vi.mocked(revokeSanction).mockResolvedValue({ ...sanction, revokedAt: "2026-01-03T00:00:00Z" });
    renderDetail(["superadmin"]);
    expect(await screen.findByText("Leia as regras.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(revokeSanction).toHaveBeenCalledWith(session, "s1"));
  });

  it("aplica sanção pelo diálogo", async () => {
    vi.mocked(getUser).mockResolvedValue({ ...detail, roles: [], sanctions: [] });
    vi.mocked(applySanction).mockResolvedValue(sanction);
    renderDetail(["superadmin"]);
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar sanção" }));
    const dialog = await screen.findByRole("dialog", { name: /Aplicar sanção a Leitora/ });
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: "Leia as regras." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar sanção" }));
    await waitFor(() =>
      expect(applySanction).toHaveBeenCalledWith(
        session,
        "u1",
        expect.objectContaining({ kind: "warning", reason: "Leia as regras." }),
      ),
    );
  });

  it("support não aplica nem revoga sanção", async () => {
    vi.mocked(getUser).mockResolvedValue({ ...detail, roles: [], sanctions: [sanction] });
    renderDetail(["support"]);
    expect(await screen.findByText("Leia as regras.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aplicar sanção" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull();
  });

  it("não mostra controles de papel nem de feature para support", async () => {
    renderDetail(["support"]);
    expect(await screen.findByRole("heading", { name: "Leitora" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Moderador" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /library/ })).toBeNull();
    expect(getCatalog).not.toHaveBeenCalled();
  });

  it("só mostra a auditoria quando o detalhe traz ações", async () => {
    renderDetail(["superadmin"]);
    expect(await screen.findByRole("heading", { name: "Leitora" })).toBeInTheDocument();
    expect(screen.queryByText("Últimas ações")).toBeNull();

    vi.mocked(getUser).mockResolvedValue({
      ...detail,
      recentAudit: [{ action: "feature.set", actorName: "Admin", createdAt: "2026-01-01T00:00:00Z" }],
      sanctions: [],
    });
    renderDetail(["superadmin"]);
    expect(await screen.findByText("Últimas ações")).toBeInTheDocument();
    expect(await screen.findByText("feature.set")).toBeInTheDocument();
  });
});
