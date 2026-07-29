/**
 * SDD-0172 · Tests de `updatePrealertaDetalleAction` (paso 2 del asistente).
 *
 * Lo que se protege acá no es el formulario, son las dos puertas:
 *  - la compra tiene que ser DEL cliente logueado (`getPrealertaByCode` va
 *    scopeada por markbox → una compra ajena simplemente no existe);
 *  - y tiene que seguir en `anunciada`: apenas la carga entra a bodega, el
 *    detalle lo manda el operario con la mercancía delante, no el cliente.
 *
 * Más el contrato del paso 2: los campos son OPCIONALES (la compra ya existe),
 * pero el formato se sigue validando duro.
 *
 * Todas las dependencias server están stubbeadas — sin red ni DB real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const MARKBOX = "DTD-5452";
const CODE = "DTD-5452-1-1";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Client de sesión: sólo necesita resolver markbox/tenant y capturar el update.
let updatedRows: Array<Record<string, unknown>>;
let updateFilters: Array<Record<string, unknown>>;

const sessionClient = {
  rpc: async (fn: string) => {
    if (fn === "get_portal_client_markbox") return { data: MARKBOX, error: null };
    if (fn === "get_portal_client_tenant") return { data: "tn", error: null };
    return { data: null, error: null };
  },
  from: () => {
    const filters: Record<string, unknown> = {};
    const chain = {
      update(row: Record<string, unknown>) {
        updatedRows.push(row);
        return chain;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return chain;
      },
      is(col: string, val: unknown) {
        filters[col] = val;
        updateFilters.push({ ...filters });
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  },
};

vi.mock("@/lib/db/server", () => ({
  createClient: async () => sessionClient,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    throw new Error("sin adjuntos en estos tests");
  },
}));

const getPrealertaByCodeMock = vi.fn();
vi.mock("@/lib/studio/prealertas/queries", () => ({
  getPrealertaByCode: (...a: unknown[]) => getPrealertaByCodeMock(...a),
  listActivePrealertaAddons: async () => [],
}));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({
  fireWorkflowEvent: async () => {},
}));

const { updatePrealertaDetalleAction } = await import("../actions");

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("prealertaCode", CODE);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const compra = (over: Record<string, unknown> = {}) => ({
  id: "pre-1",
  code: CODE,
  supplier_id: "sup-1",
  status: "anunciada",
  share_token: "tok-1",
  ...over,
});

beforeEach(() => {
  updatedRows = [];
  updateFilters = [];
  getPrealertaByCodeMock.mockReset();
});

describe("updatePrealertaDetalleAction · las dos puertas", () => {
  it("compra de otro cliente → rechazo y CERO escrituras", async () => {
    // Scopeada por markbox: para esta sesión, la compra ajena no existe.
    getPrealertaByCodeMock.mockResolvedValue(null);
    const res = await updatePrealertaDetalleAction({}, form({ boxes: "3" }));
    expect(res.error).toBeTruthy();
    expect(res.ok).toBeUndefined();
    expect(updatedRows).toHaveLength(0);
  });

  it("la consulta va scopeada por el markbox de la SESIÓN, no por el form", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    const fd = form({ boxes: "2" });
    fd.set("markbox", "DTD-0001"); // markbox forjado en el body
    await updatePrealertaDetalleAction({}, fd);
    expect(getPrealertaByCodeMock).toHaveBeenCalledWith(
      expect.anything(),
      CODE,
      { markbox: MARKBOX },
    );
  });

  it("compra ya en bodega (no 'anunciada') → rechazo y CERO escrituras", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra({ status: "recibida" }));
    const res = await updatePrealertaDetalleAction({}, form({ boxes: "3" }));
    expect(res.error).toContain("ya está en proceso");
    expect(updatedRows).toHaveLength(0);
  });

  it("sin código de compra → rechazo antes de tocar la DB", async () => {
    const fd = new FormData();
    const res = await updatePrealertaDetalleAction({}, fd);
    expect(res.error).toBeTruthy();
    expect(getPrealertaByCodeMock).not.toHaveBeenCalled();
  });
});

describe("updatePrealertaDetalleAction · contrato del paso 2", () => {
  it("guarda el detalle y devuelve el código + token de la compra", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    const res = await updatePrealertaDetalleAction(
      {},
      form({
        description: "  3 cajas de zapatos  ",
        boxes: "3",
        estValueUsd: "450.5",
        trackingCn: " SF123 ",
      }),
    );
    expect(res.ok).toBe(true);
    expect(res.prealertaCode).toBe(CODE);
    expect(res.shareToken).toBe("tok-1");
    expect(updatedRows[0]).toMatchObject({
      description: "3 cajas de zapatos",
      boxes: 3,
      est_value_usd: 450.5,
      tracking_cn: "SF123",
    });
  });

  it("el update queda scopeado por id + markbox + no borrada", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    await updatePrealertaDetalleAction({}, form({ boxes: "1" }));
    expect(updateFilters[0]).toMatchObject({
      id: "pre-1",
      client_markbox: MARKBOX,
      deleted_at: null,
    });
  });

  it("todo vacío se acepta: la compra ya existe, el detalle es opcional", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    const res = await updatePrealertaDetalleAction({}, form());
    expect(res.ok).toBe(true);
    expect(updatedRows[0].boxes).toBe(1);
  });

  it("pero el formato se sigue validando: 0 cajas es error", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    const res = await updatePrealertaDetalleAction({}, form({ boxes: "0" }));
    expect(res.fieldErrors?.boxes).toBeTruthy();
    expect(updatedRows).toHaveLength(0);
  });

  it("valor negativo es error", async () => {
    getPrealertaByCodeMock.mockResolvedValue(compra());
    const res = await updatePrealertaDetalleAction(
      {},
      form({ estValueUsd: "-5" }),
    );
    expect(res.fieldErrors?.estValueUsd).toBeTruthy();
    expect(updatedRows).toHaveLength(0);
  });
});
