// @vitest-environment node
/**
 * SDD-0507 · `firmarAdjuntoAction`: el «Ver» de «Todos los adjuntos».
 *
 * LADO NEGATIVO: a quien no puede ver, o a una ruta que no tiene la forma de
 * las subidas de hoy, no se le firma NADA. La evidencia es `storageOps`: una
 * prueba que sólo mirara el `null` no distinguiría «no firmó» de «firmó y tiró
 * la URL».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const CLIENTE = "44444444-4444-4444-8444-444444444444";
const EMBARQUE = "55555555-5555-4555-8555-555555555555";
const ARCHIVO = "66666666-6666-4666-8666-666666666666";
const RUTA_CLIENTE = `${TENANT}/client/${CLIENTE}/${ARCHIVO}.pdf`;
const RUTA_INTERNA_EMBARQUE = `${TENANT}/shipment/${EMBARQUE}/${ARCHIVO}.pdf`;
const RUTA_PORTAL = `${TENANT}/${EMBARQUE}/${ARCHIVO}.pdf`;

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => false }));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { firmarAdjuntoAction } = await import("../adjuntos-actions");

function conRol(role: string | null, disabled_at: string | null = null, userId: string | null = USER) {
  db = supabaseDouble({
    userId,
    memberships:
      role === null ? [] : [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
  });
}

beforeEach(() => {
  overrides = {};
  conRol("commercial");
});

describe("firmarAdjuntoAction · candados antes de firmar", () => {
  const SIN_CLIENTES: [string, () => void][] = [
    ["warehouse (tracking sí, clients no)", () => conRol("warehouse")],
    ["marketing", () => conRol("marketing")],
    ["commercial SUSPENDIDO", () => conRol("commercial", "2026-09-01T12:00:00Z")],
    ["sin membresía", () => conRol(null)],
    ["sin sesión", () => conRol("commercial", null, null)],
  ];

  for (const [quien, montar] of SIN_CLIENTES) {
    it(`${quien}: no firma nada, ni siquiera un documento del cliente`, async () => {
      montar();
      expect(await firmarAdjuntoAction("documents", RUTA_CLIENTE)).toBeNull();
      expect(db.storageOps).toEqual([]);
    });
  }

  it("con clients y SIN tracking (override): firma la ficha, no los del embarque", async () => {
    overrides = { "commercial:tracking": { view: false, edit: false } };
    conRol("commercial");

    expect(await firmarAdjuntoAction("documents", RUTA_CLIENTE)).toMatch(/^https:/);
    expect(await firmarAdjuntoAction("documents", RUTA_INTERNA_EMBARQUE)).toBeNull();
    expect(await firmarAdjuntoAction("shipment-docs", RUTA_PORTAL)).toBeNull();
    expect(db.storageOps).toEqual([
      { bucket: "documents", op: "createSignedUrl", paths: [RUTA_CLIENTE] },
    ]);
  });

  it("rechaza buckets y rutas con otra forma antes de tocar Storage", async () => {
    const malas: [string, string][] = [
      ["payment-proofs", RUTA_PORTAL],
      ["documents", `${TENANT}/invoice/${CLIENTE}/${ARCHIVO}.pdf`],
      ["documents", `${TENANT}/client/${CLIENTE}/../${ARCHIVO}.pdf`],
      ["shipment-docs", `${TENANT}/${EMBARQUE}/otra/${ARCHIVO}.pdf`],
      ["documents", ""],
    ];
    for (const [bucket, ruta] of malas) {
      expect(await firmarAdjuntoAction(bucket, ruta), `${bucket} · ${ruta}`).toBeNull();
    }
    expect(db.storageOps).toEqual([]);
  });

  it("commercial con la matriz de siempre firma las tres formas, cada una en su bucket", async () => {
    expect(await firmarAdjuntoAction("documents", RUTA_CLIENTE)).toMatch(/^https:/);
    expect(await firmarAdjuntoAction("documents", RUTA_INTERNA_EMBARQUE)).toMatch(/^https:/);
    expect(await firmarAdjuntoAction("shipment-docs", RUTA_PORTAL)).toMatch(/^https:/);
    expect(db.storageOps).toEqual([
      { bucket: "documents", op: "createSignedUrl", paths: [RUTA_CLIENTE] },
      { bucket: "documents", op: "createSignedUrl", paths: [RUTA_INTERNA_EMBARQUE] },
      { bucket: "shipment-docs", op: "createSignedUrl", paths: [RUTA_PORTAL] },
    ]);
  });
});
