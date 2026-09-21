// @vitest-environment node
/**
 * SDD-0499 · POST /api/studio/shipments/[id]/events exige EDICIÓN de "tracking".
 *
 * El escenario concreto que esta prueba fija: un usuario con rol `support`
 * —read-only en V1, pero que SÍ ve tracking (`lib/studio/rbac.ts:62`)— mandaba
 * un POST acá y movía el estado de un envío. Los hermanos del mismo recurso ya
 * lo cortaban: `shipments/[id]/route.ts:87` usa `moduleEditDenial` en el PATCH.
 *
 * El gate NO se mockea. La prueba corre el `moduleEditDenial` de verdad sobre un
 * doble de la base que devuelve el rol, para que lo verificado sea la decisión
 * completa y no "la ruta llama a una función que le dijimos que dijera que no".
 *
 * Y comprueba las dos mitades de la promesa: el que no debe recibe la
 * denegación **y** el envío no se toca — ni `shipments`, ni `shipment_events`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/** Rol que devuelve el doble de `user_tenants` en la corrida en curso. */
let rol: string | null = "support";
/** Tablas de DOMINIO que la ruta llegó a tocar, con su operación. */
const tocadas: string[] = [];

/**
 * Doble de PostgREST acotado a lo que estas rutas piden. Registra las tablas de
 * dominio; las del guard (`user_tenants`, overrides) no cuentan como "tocar el
 * envío" porque son justamente el gate.
 */
function makeClient() {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u-support" } } }) },
    rpc: async (fn: string) => {
      if (fn === "get_user_tenant_id") return { data: "t-1", error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const registrar = (op: string) => {
        if (table === "shipments" || table === "shipment_events") {
          tocadas.push(`${table}:${op}`);
        }
      };
      const paso = () => chain;
      chain.select = () => {
        registrar("select");
        return chain;
      };
      chain.update = () => {
        registrar("update");
        return chain;
      };
      chain.insert = () => {
        registrar("insert");
        return chain;
      };
      chain.eq = paso;
      chain.is = paso;
      chain.limit = paso;
      chain.returns = async () => ({ data: [], error: null });
      chain.maybeSingle = async () => {
        if (table === "user_tenants") {
          return { data: rol ? { role: rol, tenant_id: "t-1" } : null, error: null };
        }
        if (table === "shipments") {
          return {
            data: { id: "s-1", shipment_service: "consolidado_lcl", status: "in_warehouse" },
            error: null,
          };
        }
        return { data: null, error: null };
      };
      chain.single = async () => ({ data: { id: "ev-1" }, error: null });
      return chain;
    },
  };
  return client;
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeClient() }));

import { POST } from "../route";

function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = { params: Promise.resolve({ id: "s-1" }) };

describe("POST shipments/[id]/events · gate de edición de tracking", () => {
  beforeEach(() => {
    tocadas.length = 0;
    rol = "support";
  });

  it("support (read-only) → 403 y el envío NO se toca", async () => {
    const res = await POST(req({ status: "shipped" }), params);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "No tienes permiso para realizar esta acción.",
    });
    expect(tocadas).toEqual([]);
  });

  it("sin membership activa → 403 y el envío NO se toca", async () => {
    rol = null;
    const res = await POST(req({ status: "shipped" }), params);
    expect(res.status).toBe(403);
    expect(tocadas).toEqual([]);
  });

  it("operations (sí edita tracking) → pasa el gate y llega al envío", async () => {
    rol = "operations";
    const res = await POST(req({ status: "shipped" }), params);
    expect(res.status).toBe(201);
    // El control de que el 403 de arriba es del GATE y no de un rechazo previo:
    // con el rol correcto la misma petición sí alcanza el dominio.
    expect(tocadas).toContain("shipments:select");
    expect(tocadas).toContain("shipment_events:insert");
  });

  it("estado inválido → 400 antes de cualquier cosa (no lo cambia el gate)", async () => {
    rol = "operations";
    const res = await POST(req({ status: "inventado" }), params);
    expect(res.status).toBe(400);
    expect(tocadas).toEqual([]);
  });
});
