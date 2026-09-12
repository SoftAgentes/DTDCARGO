/**
 * SDD-0156 · Slice D — getHiddenPortalStatuses: qué hitos oculta el stepper del
 * portal según la config, con precedencia override-cliente → default-tenant.
 *
 * SDD-0337 — el Portal consulta los hitos ocultos por una RPC sin parámetros y
 * degrada mostrando todo ante cualquier error, incluida la RPC todavía ausente.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getHiddenPortalStatuses,
  getHiddenPortalStatusesForPortal,
} from "../portal-visibility-queries";

type RuleRow = {
  trigger_event: string;
  client_id: string | null;
  visible_in_portal: boolean;
};

/** Admin mock que devuelve `rows` para la query de reglas (o error). */
function makeAdmin(rows: RuleRow[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          like: () => ({
            or: () => Promise.resolve({ data: error ? null : rows, error }),
          }),
        }),
      }),
    }),
  } as never;
}

describe("getHiddenPortalStatuses", () => {
  it("oculta el status con visible_in_portal=false (default del tenant)", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:in_customs", client_id: null, visible_in_portal: false },
      { trigger_event: "status:shipped", client_id: null, visible_in_portal: true },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", null);
    expect(hidden.has("in_customs")).toBe(true);
    expect(hidden.has("shipped")).toBe(false);
  });

  it("el override del cliente gana al default (default oculta, override muestra)", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:in_customs", client_id: null, visible_in_portal: false },
      { trigger_event: "status:in_customs", client_id: "c-1", visible_in_portal: true },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", "c-1");
    expect(hidden.has("in_customs")).toBe(false); // el override lo re-muestra
  });

  it("el override oculta aunque el default muestre", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:delivered", client_id: null, visible_in_portal: true },
      { trigger_event: "status:delivered", client_id: "c-1", visible_in_portal: false },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", "c-1");
    expect(hidden.has("delivered")).toBe(true);
  });

  it("sin reglas → nada oculto (todo visible)", async () => {
    const hidden = await getHiddenPortalStatuses(makeAdmin([]), "t-1", null);
    expect(hidden.size).toBe(0);
  });

  it("falla-seguro: ante error devuelve set vacío (no oculta de más)", async () => {
    const admin = makeAdmin([], { message: "boom" });
    const hidden = await getHiddenPortalStatuses(admin, "t-1", null);
    expect(hidden.size).toBe(0);
  });
});

function makePortal(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("getHiddenPortalStatusesForPortal", () => {
  it("consulta la RPC ligada al principal sin enviar ids", async () => {
    const { db, rpc } = makePortal([
      { status: "in_customs" },
      { status: "delivered" },
    ]);

    const hidden = await getHiddenPortalStatusesForPortal(db);

    expect([...hidden]).toEqual(["in_customs", "delivered"]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_hidden_shipment_statuses");
  });

  it.each([
    { data: [], error: null },
    { data: null, error: { message: "boom" } },
  ])("falla-seguro mostrando todos los hitos", async ({ data, error }) => {
    const { db } = makePortal(data, error);
    await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
  });

  // Ids ficticios: si el log volcara el objeto del error, aparecerían aquí.
  const CLIENT_ID = "10000000-0000-0000-0000-000000000001";
  const TENANT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
  const USER_ID = "20000000-0000-0000-0000-000000000001";

  /** El log sólo lleva la etiqueta del sitio y el código o mensaje: ningún id. */
  function expectLogWithoutIds(calls: unknown[][]) {
    const logged = JSON.stringify(calls);
    for (const id of [CLIENT_ID, TENANT_ID, USER_ID]) {
      expect(logged).not.toContain(id);
    }
    expect(logged).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  }

  // 0402 ya está aplicada, pero el lector sigue tolerando PGRST202 (caché de
  // esquema sin recargar, entorno sin la RPC): la página no rompe y el set
  // vacío MUESTRA todos los hitos. El fallo queda registrado, sin ids.
  it("RPC ausente (PGRST202): set vacío, muestra todos los hitos y lo registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { db, rpc } = makePortal(null, {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_hidden_shipment_statuses without parameters in the schema cache",
        details: `cliente ${CLIENT_ID} · tenant ${TENANT_ID}`,
        hint: `usuario ${USER_ID}`,
      });

      await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
      expect(rpc).toHaveBeenCalledOnce();
      expect(rpc).toHaveBeenCalledWith("get_portal_hidden_shipment_statuses");
      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(
        "[client-notif] getHiddenPortalStatusesForPortal falló:",
        "PGRST202",
      );
      expectLogWithoutIds(log.mock.calls);
    } finally {
      log.mockRestore();
    }
  });

  it("fallo de transporte (promesa rechazada): set vacío sin propagar y lo registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failure = Object.assign(new Error("fetch failed"), {
        cause: { clientId: CLIENT_ID, tenantId: TENANT_ID, userId: USER_ID },
      });
      const rpc = vi.fn().mockRejectedValue(failure);
      const db = { rpc } as unknown as SupabaseClient;

      await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
      expect(rpc).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(
        "[client-notif] getHiddenPortalStatusesForPortal falló:",
        "fetch failed",
      );
      expectLogWithoutIds(log.mock.calls);
    } finally {
      log.mockRestore();
    }
  });
});
