/**
 * Tests del login MARKBOX + contraseña (SDD-0042 Fase 6 · slice 10.2).
 *
 * Cubre los criterios de la spec §10.2:
 *  - lookup markbox→email: resuelve el email del cliente del portal a partir de su
 *    MARKBOX (sólo `client_users` con status='active'), normalizando el MARKBOX a
 *    mayúsculas.
 *  - markbox inexistente → null (el caller responde con error GENÉRICO, sin revelar
 *    si el MARKBOX existe · anti-enumeración).
 *
 * `lookupEmailByMarkbox` recibe un SupabaseClient — usamos un stub mínimo que
 * encadena `from().select().eq().eq().limit().maybeSingle()` y registra los filtros
 * aplicados, igual que el resto de la suite del portal.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupEmailByMarkbox } from "../portal-queries";

type Filters = Record<string, unknown>;

function stub(opts: {
  row?: { email: string } | null;
  error?: boolean;
}): { supabase: SupabaseClient; filters: () => Filters; queried: () => boolean } {
  const filters: Filters = {};
  let queried = false;
  const supabase = {
    from(table: string) {
      queried = true;
      filters.table = table;
      const chain = {
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({
            data: opts.row ?? null,
            error: opts.error ? { message: "fail" } : null,
          });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { supabase, filters: () => filters, queried: () => queried };
}

describe("lookupEmailByMarkbox — login MARKBOX → email", () => {
  it("devuelve el email del cliente con ese MARKBOX activo", async () => {
    const { supabase, filters } = stub({ row: { email: "carlos@empresa.com" } });
    const email = await lookupEmailByMarkbox(supabase, "DTD-1234");

    expect(email).toBe("carlos@empresa.com");
    expect(filters().table).toBe("client_users");
    expect(filters().status).toBe("active"); // sólo accesos activos
    expect(filters()["clients.markbox"]).toBe("DTD-1234");
  });

  it("normaliza el MARKBOX a mayúsculas antes de buscar", async () => {
    const { supabase, filters } = stub({ row: { email: "x@y.com" } });
    await lookupEmailByMarkbox(supabase, "  dtd-2048 ");
    expect(filters()["clients.markbox"]).toBe("DTD-2048");
  });

  it("MARKBOX inexistente → null (error genérico aguas arriba)", async () => {
    const { supabase } = stub({ row: null });
    expect(await lookupEmailByMarkbox(supabase, "DTD-9999")).toBeNull();
  });

  it("MARKBOX vacío → null sin consultar la DB", async () => {
    const { supabase, queried } = stub({ row: { email: "x@y.com" } });
    expect(await lookupEmailByMarkbox(supabase, "   ")).toBeNull();
    expect(queried()).toBe(false);
  });

  it("error de la query → null", async () => {
    const { supabase } = stub({ error: true });
    expect(await lookupEmailByMarkbox(supabase, "DTD-1234")).toBeNull();
  });
});
