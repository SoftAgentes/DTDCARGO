/**
 * SDD-0246 · un bulto rotulado con un Shipping Mark RETIRADO no llega huérfano.
 *
 * El escenario, que es real y caro: el cliente YA existía, se registró de nuevo
 * por la web, el sistema le dio un código nuevo, él se lo pasó a su proveedor en
 * Yiwu — y recién después alguien fusionó las dos fichas. La caja ya salió con
 * el código anulado impreso encima.
 *
 * La ficha retirada queda soft-deleted, así que la consulta normal (que filtra
 * deleted_at) no la ve. Sin el redirect, el bulto entra sin dueño y hay que
 * rastrearlo a mano.
 *
 * PRUEBA DE MUTACIÓN — si borras el bloque de `resolve_markbox` de
 * `resolveClientNameByMarkbox`, el caso "código retirado" se pone rojo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resolveClientNameByMarkbox } from "../warehouse-cn-queries";

const TENANT = "tenant-1";

/** Registra qué se le preguntó a la DB, para poder afirmar el camino rápido. */
const ops = { selects: 0, rpcs: [] as string[] };

/**
 * Fake mínimo de Supabase.
 * `vivo` = markbox de un cliente vigente. `retirado` = markbox de una ficha
 * fusionada, que la consulta normal NO devuelve (está soft-deleted).
 */
function makeSupabase(opts: { vivo?: string; retirado?: string }) {
  return {
    from: () => {
      ops.selects += 1;
      // El builder sólo acumula los filtros; quien decide es maybeSingle().
      const filtros: Record<string, string> = {};
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (col: string, val: string) => {
          filtros[col] = val;
          return c;
        },
        is: () => c,
        maybeSingle: async () => {
          // 1ª consulta: por markbox, con deleted_at is null. Sólo encuentra al
          // cliente VIGENTE — la ficha retirada está soft-deleted.
          if (filtros.markbox && filtros.markbox === opts.vivo) {
            return { data: { name: "Cliente Vigente" }, error: null };
          }
          // 2ª consulta: por id, después de seguir el redirect.
          if (filtros.id === "superviviente-1") {
            return { data: { name: "ELIAS ACOSTA" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return c;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      ops.rpcs.push(name);
      if (name === "resolve_markbox" && args.p_markbox === opts.retirado) {
        return {
          data: [
            {
              client_id: "superviviente-1",
              canonical_markbox: "DTD-Y009",
              was_redirected: true,
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  } as never;
}

beforeEach(() => {
  ops.selects = 0;
  ops.rpcs = [];
});

describe("resolveClientNameByMarkbox · código retirado por fusión", () => {
  it("un código VIGENTE resuelve sin pedir el redirect (camino rápido)", async () => {
    const sb = makeSupabase({ vivo: "DTD-Y009" });

    const nombre = await resolveClientNameByMarkbox(sb, TENANT, "DTD-Y009");

    expect(nombre).toBe("Cliente Vigente");
    // El 99,99% de los bultos trae código vigente: no deben pagar viaje extra.
    expect(ops.rpcs).not.toContain("resolve_markbox");
  });

  it("un código RETIRADO sigue el redirect y encuentra al dueño", async () => {
    const sb = makeSupabase({ retirado: "DTD-9009" });

    const nombre = await resolveClientNameByMarkbox(sb, TENANT, "DTD-9009");

    expect(ops.rpcs).toContain("resolve_markbox");
    // Si esto da null, la caja entra huérfana al almacén.
    expect(nombre).toBe("ELIAS ACOSTA");
  });

  it("un código que no existe sigue dando null (bulto realmente huérfano)", async () => {
    const sb = makeSupabase({});

    expect(await resolveClientNameByMarkbox(sb, TENANT, "DTD-0000")).toBeNull();
  });

  it("sin markbox no consulta nada", async () => {
    const sb = makeSupabase({});

    expect(await resolveClientNameByMarkbox(sb, TENANT, null)).toBeNull();
    expect(await resolveClientNameByMarkbox(sb, TENANT, "   ")).toBeNull();
    expect(ops.selects).toBe(0);
    expect(ops.rpcs).toHaveLength(0);
  });
});
