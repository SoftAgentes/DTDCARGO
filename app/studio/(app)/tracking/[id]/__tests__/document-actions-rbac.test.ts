// @vitest-environment node
/**
 * Documentos del envío: las dos mutaciones sin gate — SDD-0500.
 *
 * `document-actions.ts` no lo miraba NADIE: el anti-drift de
 * `rbac-actions-guard.test.ts` abría sólo archivos llamados exactamente
 * `actions.ts`, y éste es un `<algo>-actions.ts`. Adentro:
 *
 *   - `uploadShipmentDocumentAction:29` resolvía el tenant leyendo
 *     `user_tenants` a mano, SIN `user_id` y SIN `disabled_at` — la variante
 *     que SDD-0498 vino a borrar del repo;
 *   - `deleteShipmentDocumentAction:95` no resolvía el tenant siquiera, y
 *     además del `deleted_at` en la fila hace `storage.remove()` del objeto.
 *     Eso último NO es borrado lógico: el archivo se va del bucket.
 *
 * El módulo `tracking` admite `commercial/operations/accounting/warehouse` y
 * deja a `support` en read-only (`canEditModule` → `role === "support"` es
 * false). Sin gate, un `support` llegaba al `remove()` del conocimiento de
 * embarque.
 *
 * LADO NEGATIVO: a quien no puede editar no se le escribe una fila NI se le
 * borra un objeto. La evidencia del bucket va aparte de `writes` a propósito
 * (`storageOps`): una prueba que sólo mirara las escrituras de tabla no
 * distingue «denegó» de «denegó la fila pero igual borró el archivo».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SHIPMENT = "44444444-4444-4444-8444-444444444444";
const DOC = "55555555-5555-4555-8555-555555555555";
const OBJETO = `${TENANT}/${SHIPMENT}/bl-original.pdf`;
const SUSPENDIDO = "2026-09-01T12:00:00Z";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => true }));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { uploadShipmentDocumentAction, deleteShipmentDocumentAction } = await import(
  "../document-actions"
);

/** Siembra el envío y el documento para que la action no corte por «no encontrado». */
function conRol(role: string | null, disabled_at: string | null = null, userId: string | null = USER) {
  db = supabaseDouble({
    userId,
    memberships:
      role === null
        ? []
        : [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
    tables: {
      shipments: [{ id: SHIPMENT, tenant_id: TENANT, client_markbox: "DTD-001" }],
      shipment_documents: [
        { id: DOC, tenant_id: TENANT, shipment_id: SHIPMENT, storage_path: OBJETO, deleted_at: null },
      ],
    },
  });
}

function formConArchivo(): FormData {
  const fd = new FormData();
  fd.set("doc_type", "bl");
  fd.set("file", new File([new Uint8Array([1, 2, 3])], "bl.pdf", { type: "application/pdf" }));
  return fd;
}

/** Cada rol NO-editor del módulo `tracking`, con el motivo por el que no edita. */
const SIN_EDICION: [string, () => void][] = [
  ["support (read-only V1)", () => conRol("support")],
  ["marketing (fuera de la matriz de tracking)", () => conRol("marketing")],
  ["admin SUSPENDIDO", () => conRol("admin", SUSPENDIDO)],
  ["sin membresía", () => conRol(null)],
  ["sin sesión", () => conRol("admin", null, null)],
];

beforeEach(() => {
  vi.clearAllMocks();
  conRol("admin");
});

describe("deleteShipmentDocumentAction · gate antes del borrado del bucket (SDD-0500)", () => {
  for (const [quien, montar] of SIN_EDICION) {
    it(`${quien}: no marca deleted_at y NO borra el objeto`, async () => {
      montar();
      const r = await deleteShipmentDocumentAction(SHIPMENT, DOC);

      expect(r.error).toBeTruthy();
      expect(r.ok).toBeUndefined();
      // La evidencia que importa: el archivo sigue en el bucket.
      expect(db.storageOps).toEqual([]);
      expect(db.writes).toEqual([]);
    });
  }

  it("operations sí borra: marca deleted_at y saca el objeto del bucket", async () => {
    conRol("operations");
    const r = await deleteShipmentDocumentAction(SHIPMENT, DOC);

    expect(r.ok).toBe(true);
    expect(db.writes).toEqual([
      expect.objectContaining({ table: "shipment_documents", op: "update" }),
    ]);
    expect(db.storageOps).toEqual([
      expect.objectContaining({ op: "remove", paths: [OBJETO] }),
    ]);
  });

  it("acota el borrado al tenant del gate, no sólo al id del documento", async () => {
    // El documento vive en OTRO tenant: la action no debe tocarlo aunque le
    // pasen su id. Hoy depende enteramente de la RLS; el gate da el tenant
    // para que la consulta también lo diga.
    conRol("operations");
    db = supabaseDouble({
      userId: USER,
      memberships: [
        { user_id: USER, tenant_id: TENANT, role: "operations", disabled_at: null, warehouse_scope: "all" },
      ],
      tables: {
        shipment_documents: [
          { id: DOC, tenant_id: OTRO, shipment_id: SHIPMENT, storage_path: OBJETO, deleted_at: null },
        ],
      },
    });

    const r = await deleteShipmentDocumentAction(SHIPMENT, DOC);

    expect(r.error).toBeTruthy();
    expect(db.storageOps).toEqual([]);
    expect(db.writes).toEqual([]);
  });
});

describe("uploadShipmentDocumentAction · gate antes de subir (SDD-0500)", () => {
  for (const [quien, montar] of SIN_EDICION) {
    it(`${quien}: no sube el objeto ni indexa la fila`, async () => {
      montar();
      const r = await uploadShipmentDocumentAction(SHIPMENT, {}, formConArchivo());

      expect(r.error).toBeTruthy();
      expect(db.storageOps).toEqual([]);
      expect(db.writes).toEqual([]);
    });
  }

  it("operations sí sube: objeto al bucket y fila indexada con el tenant del gate", async () => {
    conRol("operations");
    const r = await uploadShipmentDocumentAction(SHIPMENT, {}, formConArchivo());

    expect(r.ok).toBe(true);
    expect(db.storageOps).toEqual([expect.objectContaining({ op: "upload" })]);
    expect(db.writes).toEqual([
      expect.objectContaining({
        table: "shipment_documents",
        op: "insert",
        row: expect.objectContaining({ tenant_id: TENANT, uploaded_by: USER }),
      }),
    ]);
  });

  it("el tenant sale del gate, no de una relectura de user_tenants sin filtro", async () => {
    // La membresía de OTRO usuario no debe habilitar ni prestar su tenant.
    //
    // OJO con leer este caso como «el bug que había»: en producción la policy
    // de `user_tenants` filtra `user_id = auth.uid() and disabled_at is null`,
    // así que la consulta a mano NUNCA vio la fila de otro. Lo que fija esta
    // prueba es que la APLICACIÓN no dependa de esa policy para acertar el
    // tenant — el doble no implementa RLS justamente para poder afirmarlo.
    db = supabaseDouble({
      userId: USER,
      memberships: [
        { user_id: OTRO, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all" },
      ],
      tables: { shipments: [{ id: SHIPMENT, tenant_id: TENANT, client_markbox: "DTD-001" }] },
    });

    const r = await uploadShipmentDocumentAction(SHIPMENT, {}, formConArchivo());

    expect(r.error).toBeTruthy();
    expect(db.storageOps).toEqual([]);
    expect(db.writes).toEqual([]);
  });
});
