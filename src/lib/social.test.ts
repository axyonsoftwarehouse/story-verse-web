import { describe, expect, it } from "vitest";
import { followLabel, relationOf } from "./social";

describe("relationOf", () => {
  it("pedido esperando vira 'Pedido enviado'", () => {
    const relation = relationOf({ is_following: false, follows_me: false, requested: true });
    expect(relation).toBe("requested");
    expect(followLabel(relation)).toBe("Pedido enviado");
  });

  it("seguir vale mais que o pedido (pedido aceito)", () => {
    expect(relationOf({ is_following: true, follows_me: false, requested: true })).toBe("following");
    expect(relationOf({ is_following: true, follows_me: true })).toBe("connection");
  });

  it("quem só segue a conta vê 'Seguir de volta'; sem nada, 'Seguir'", () => {
    expect(followLabel(relationOf({ is_following: false, follows_me: true }))).toBe("Seguir de volta");
    expect(followLabel(relationOf({ is_following: false, follows_me: false }))).toBe("Seguir");
  });
});
