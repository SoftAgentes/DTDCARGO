/**
 * Gate de EDICIÓN de `deleteShipment` y su fallo mudo (SDD-0497).
 *
 * Era la única de las siete acciones de `tracking/[id]/actions.ts` sin
 * `moduleEditDenial` —las otras seis lo llaman— y la más destructiva: pone
 * `deleted_at` sobre `shipments`, y el trigger `cascade_soft_delete_events`
 * propaga a los eventos. El `requireModuleView("tracking")` del layout protege
 * la página, no la action; y la policy viva de `shipments` sólo compara
 * `tenant_id`.
 *
 * El segundo defecto era peor de leer: si el UPDATE fallaba, un `console.error`
 * se tragaba el error y la action redirigía IGUAL. El operador escribía el
 * código exacto del envío (doble confirmación estilo GitHub), aterrizaba en la
 * lista y se iba creyendo que había borrado. Acá se fija que el redirect ocurra
 * SÓLO cuando el borrado ocurrió.
 *
 * Se usan el guard y la matriz REALES; sólo se reemplazan los bordes. `redirect`
 * se modela como lo que es en Next: una excepción de control de flujo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const SHIPMENT = "shp-1";
const DENIAL = "No tienes permiso para realizar esta acción.";

/** Marcador del `redirect()` de Next, que en producción también lanza. */
const REDIRECT = Symbol("NEXT_REDIRECT");
const redirectMock = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: REDIRECT, url });
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirectMock(u) }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({
  getUser: async () => ({ id: "user-1" }),
  getUserTenantId: async () => TENANT,
}));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
let updateError: { message: string } | null = null;
/** Cada UPDATE que llegó a salir, con la tabla y el patch. */
const updates: { table: string; patch: Record<string, unknown> }[] = [];

type Query = {
  select: () => Query;
  eq: () => Query;
  is: () => Query;
  limit: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from(table: string) {
      const row =
        table === "user_tenants" && role ? { tenant_id: TENANT, role } : null;
      const query: Query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return {
        ...query,
        update: (patch: Record<string, unknown>) => ({
          eq: async () => {
            updates.push({ table, patch });
            return { error: updateError };
          },
        }),
      };
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));

const { deleteShipment } = await import("../[id]/actions");

/**
 * Corre la action absorbiendo el `redirect`, que lanza. Devuelve o el valor
 * devuelto (fallo) o `{ redirectedTo }` (éxito). Que las dos salidas sean
 * distinguibles ES lo que esta spec arregla.
 */
async function correr(): Promise<
  { value: Awaited<ReturnType<typeof deleteShipment>> } | { redirectedTo: string }
> {
  try {
    return { value: await deleteShipment(SHIPMENT) };
  } catch (e) {
    if ((e as { digest?: symbol }).digest === REDIRECT) {
      return { redirectedTo: (e as { url: string }).url };
    }
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "operations";
  updateError = null;
});

/**
 * Los que la matriz deja fuera de `tracking`. `support` sale de esta lista y
 * tiene su propio caso abajo, porque su motivo es otro: SÍ ve el módulo, pero
 * `canEditModule` lo rechaza siempre (read-only V1).
 */
const ROLES_SIN_TRACKING = STUDIO_USER_ROLES.filter(
  (r) =>
    !["admin", "commercial", "operations", "accounting", "warehouse", "support"].includes(
      r,
    ),
);

describe("deleteShipment · el candado que faltaba", () => {
  it.each(ROLES_SIN_TRACKING)(
    "rol %s: no borra el envío y recibe el motivo",
    async (r) => {
      role = r;

      const res = await correr();

      expect(res).toEqual({ value: { error: DENIAL } });
      expect(updates).toHaveLength(0);
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("support ve Tracking pero es read-only: tampoco borra", async () => {
    role = "support";

    const res = await correr();

    expect(res).toEqual({ value: { error: DENIAL } });
    expect(updates).toHaveLength(0);
  });

  it("sin sesión tampoco borra", async () => {
    sessionUser = null;
    role = null;

    const res = await correr();

    expect(res).toEqual({ value: { error: DENIAL } });
    expect(updates).toHaveLength(0);
  });

  it("denegado no revalida ninguna ruta", async () => {
    role = "marketing";

    await correr();

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("deleteShipment · el fallo ya no es mudo", () => {
  it("si el UPDATE falla, devuelve el motivo y NO redirige", async () => {
    updateError = { message: "permission denied for table shipments" };

    const res = await correr();

    expect(res).toEqual({
      value: { error: "No pudimos eliminar el envío. Intenta de nuevo." },
    });
    expect(redirectMock).not.toHaveBeenCalled();
    // Ni siquiera revalida: la lista no cambió.
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("el mensaje del fallo del UPDATE no se confunde con el de permiso", async () => {
    updateError = { message: "boom" };

    const fallo = await correr();
    updateError = null;
    role = "support";
    const permiso = await correr();

    expect(fallo).not.toEqual(permiso);
  });
});

describe("deleteShipment · lado positivo", () => {
  it("operations borra: marca deleted_at y recién ahí redirige", async () => {
    const res = await correr();

    expect(res).toEqual({ redirectedTo: "/studio/tracking" });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("shipments");
    expect(updates[0].patch).toHaveProperty("deleted_at");
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/tracking");
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/resumen");
  });

  it("admin también", async () => {
    role = "admin";

    expect(await correr()).toEqual({ redirectedTo: "/studio/tracking" });
    expect(updates).toHaveLength(1);
  });
});
