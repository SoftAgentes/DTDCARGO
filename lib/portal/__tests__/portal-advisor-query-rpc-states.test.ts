/**
 * SDD-0338 · L03 — estados de la RPC `get_portal_advisor` (migración 0403) vistos
 * desde `getPortalAdvisor`. Complementa el test importado del origen
 * (`portal-advisor-query.test.ts`) con los dos caminos que deciden el orden
 * migrate-first:
 *  - RPC presente: sólo la RPC con la sesión, sin ids ni lecturas de tablas, y
 *    únicamente los cuatro campos públicos del asesor.
 *  - RPC ausente (PGRST202), sin permiso o con excepción del transporte: nunca
 *    un asesor inventado; Inicio y Soporte caen al contacto público.
 * Datos ficticios.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPortalAdvisor } from "../portal-queries";

function dbWithRpc(
  impl: (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>,
) {
  const rpc = vi.fn(impl);
  const from = vi.fn(() => {
    throw new Error("getPortalAdvisor no debe leer tablas");
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe("getPortalAdvisor · RPC 0403 presente", () => {
  it("usa sólo la RPC de la sesión y devuelve únicamente los cuatro campos públicos", async () => {
    const { db, rpc, from } = dbWithRpc(async () => ({
      data: [
        {
          name: "  Ana Pérez  ",
          phone: null,
          avatar_url: null,
          position_label: null,
          // La RPC no devuelve estos campos; si aparecieran, no deben propagarse.
          user_id: "00000000-0000-0000-0000-00000000a001",
          tenant_id: "00000000-0000-0000-0000-00000000b001",
        },
      ],
      error: null,
    }));

    const advisor = await getPortalAdvisor(db);

    expect(advisor).toEqual({
      name: "Ana Pérez",
      phone: null,
      avatarUrl: null,
      positionLabel: null,
    });
    expect(Object.keys(advisor ?? {}).sort()).toEqual([
      "avatarUrl",
      "name",
      "phone",
      "positionLabel",
    ]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]).toEqual(["get_portal_advisor"]);
    expect(from).not.toHaveBeenCalled();
  });

  it("acepta la fila como objeto único además de lista", async () => {
    const { db } = dbWithRpc(async () => ({
      data: {
        name: "Luis Díaz",
        phone: "+58 414 000 0002",
        avatar_url: "https://cdn.example.test/luis.png",
        position_label: "Asesor logístico",
      },
      error: null,
    }));

    await expect(getPortalAdvisor(db)).resolves.toEqual({
      name: "Luis Díaz",
      phone: "+58 414 000 0002",
      avatarUrl: "https://cdn.example.test/luis.png",
      positionLabel: "Asesor logístico",
    });
  });
});

describe("getPortalAdvisor · RPC 0403 ausente o con error", () => {
  it.each([
    {
      caso: "RPC ausente (PGRST202)",
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_advisor without parameters in the schema cache",
        details: null,
        hint: null,
      },
    },
    {
      caso: "sin permiso de EXECUTE (42501)",
      error: {
        code: "42501",
        message: "permission denied for function get_portal_advisor",
        details: null,
        hint: null,
      },
    },
  ])("$caso: devuelve null sin reintentar ni leer tablas", async ({ error }) => {
    const { db, rpc, from } = dbWithRpc(async () => ({ data: null, error }));

    await expect(getPortalAdvisor(db)).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it("respuesta sin error ni datos: devuelve null", async () => {
    const { db } = dbWithRpc(async () => ({ data: null, error: null }));

    await expect(getPortalAdvisor(db)).resolves.toBeNull();
  });

  it("una excepción del transporte se propaga para que Inicio y Soporte la contengan", async () => {
    const { db } = dbWithRpc(async () => {
      throw new Error("fetch failed");
    });

    await expect(getPortalAdvisor(db)).rejects.toThrow("fetch failed");
  });
});
