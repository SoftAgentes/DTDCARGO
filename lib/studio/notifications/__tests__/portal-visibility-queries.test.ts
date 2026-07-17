/**
 * SDD-0156 · Slice D — getHiddenPortalStatuses: qué hitos oculta el stepper del
 * portal según la config, con precedencia override-cliente → default-tenant.
 */
import { describe, it, expect } from "vitest";
import { getHiddenPortalStatuses } from "../portal-visibility-queries";

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
