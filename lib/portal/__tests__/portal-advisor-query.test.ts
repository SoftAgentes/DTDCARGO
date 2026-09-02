import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPortalAdvisor } from "../portal-queries";

function dbWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("getPortalAdvisor", () => {
  it("consulta la RPC del principal sin enviar clientId", async () => {
    const { db, rpc } = dbWithRpc([
      {
        name: "Ana Pérez",
        phone: "+58 414 000 0000",
        avatar_url: "https://cdn.example.test/ana.png",
        position_label: "Asesora comercial",
      },
    ]);

    await expect(getPortalAdvisor(db)).resolves.toEqual({
      name: "Ana Pérez",
      phone: "+58 414 000 0000",
      avatarUrl: "https://cdn.example.test/ana.png",
      positionLabel: "Asesora comercial",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_advisor");
  });

  it.each([
    { data: [], error: null },
    { data: [{ name: "   " }], error: null },
    { data: null, error: { message: "boom" } },
  ])("degrada a contacto público sin asesor válido", async ({ data, error }) => {
    const { db } = dbWithRpc(data, error);
    await expect(getPortalAdvisor(db)).resolves.toBeNull();
  });
});
