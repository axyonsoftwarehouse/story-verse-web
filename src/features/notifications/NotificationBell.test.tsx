import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AppNotification } from "../../lib/notifications";

const item: AppNotification = {
  id: 1,
  kind: "follow",
  group_id: null,
  group_name: null,
  message_id: null,
  emoji: null,
  created_at: "2026-11-12T10:00:00Z",
  read: false,
  actor_id: "u1",
  actor_name: "Ana",
  actor_avatar: "",
  actor_photo: null,
  actor_cosmetics: { frame: { image: "/shop/f-ouro.png", animated: "/shop/f-ouro.webp", tier: "epic" }, badge: null, name_color: null },
  message_body: null,
  message_media_kind: null,
};

vi.mock("../../lib/notifications", () => ({
  fetchNotifications: vi.fn(async () => ({ items: [item], unread: 0 })),
  markNotificationsRead: vi.fn(async () => {}),
  clearNotifications: vi.fn(async () => {}),
}));

import { NotificationBell } from "./NotificationBell";

describe("NotificationBell com enfeites", () => {
  it("desenha a moldura (parada) no rosto de quem fez a ação", async () => {
    render(
      <MemoryRouter>
        <NotificationBell groups={[]} activity={0} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));
    await waitFor(() => expect(screen.getByText("Ana começou a seguir você")).toBeInTheDocument());
    const frame = document.querySelector(".notif-item img.face-frame");
    expect(frame?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
  });
});
