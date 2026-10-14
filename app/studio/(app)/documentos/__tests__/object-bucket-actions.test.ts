import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDocumentsDouble } from "@/lib/studio/documents/__tests__/documents-double";

/**
 * SDD-0508 · El borrado y la firma del hub usan el bucket de la fila.
 *
 * Antes, `deleteDocument` borraba siempre en `documents` y `signDocumentUrl`
 * firmaba siempre en `documents`: el objeto de un adjunto de Bitácora quedaba
 * huérfano en `bitacora` y el «Ver» del historial no abría nada.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  moduleEditDenial: vi.fn(async () => null as string | null),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: () => mocks.createClient() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: mocks.moduleEditDenial }));

import { deleteDocument, signDocumentUrl } from "../actions";

const TENANT = "11111111-1111-4111-8111-111111111111";
const TAREA = "33333333-3333-4333-8333-333333333333";
const ACTA = "55555555-5555-4555-8555-555555555555";
const DOC = "77777777-7777-4777-8777-777777777777";
const OBJ = "66666666-6666-4666-8666-666666666666";

const PATH_BITACORA = `${TENANT}/bitacora_task/${TAREA}/${OBJ}.jpg`;
const PATH_HUB = `${TENANT}/shipment/${TAREA}/${OBJ}.pdf`;

function fila(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    tenant_id: TENANT,
    entity_type: "bitacora_task",
    entity_id: TAREA,
    storage_path: PATH_BITACORA,
    bucket_id: "bitacora",
    deleted_at: null,
    ...over,
  };
}

function montar(rows: Record<string, unknown>[], objects: string[], extra = {}) {
  const db = makeDocumentsDouble({ rows, objects, ...extra });
  mocks.createClient.mockResolvedValue(db.supabase);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.moduleEditDenial.mockResolvedValue(null);
});

describe("deleteDocument · bucket de la fila", () => {
  it("un adjunto de Bitácora: soft-delete y el objeto se borra en `bitacora`", async () => {
    const db = montar([fila()], [`bitacora/${PATH_BITACORA}`]);

    expect(await deleteDocument(DOC)).toEqual({ ok: true });

    expect(db.rows()[0].deleted_at).toEqual(expect.any(String));
    expect(db.storageCalls).toEqual([
      { bucket: "bitacora", op: "remove", paths: [PATH_BITACORA] },
    ]);
    expect(db.objects()).toEqual([]);
  });

  it("un documento del hub sigue borrándose en `documents`", async () => {
    const db = montar(
      [fila({ entity_type: "shipment", storage_path: PATH_HUB, bucket_id: "documents" })],
      [`documents/${PATH_HUB}`],
    );

    expect(await deleteDocument(DOC)).toEqual({ ok: true });
    expect(db.storageCalls).toEqual([
      { bucket: "documents", op: "remove", paths: [PATH_HUB] },
    ]);
  });

  it("erp-attachments: soft-delete sí, el objeto no se toca (su ciclo es de SDD-0224)", async () => {
    const key = `${TENANT}/expense/${TAREA}/${OBJ}.pdf`;
    const db = montar(
      [fila({ entity_type: "expense", storage_path: key, bucket_id: "erp-attachments" })],
      [`erp-attachments/${key}`],
    );

    expect(await deleteDocument(DOC)).toEqual({ ok: true });
    expect(db.rows()[0].deleted_at).toEqual(expect.any(String));
    expect(db.storageCalls).toEqual([]);
    expect(db.objects()).toEqual([`erp-attachments/${key}`]);
  });

  it("una fila `bitacora` que apunta al audio de un acta no lo borra", async () => {
    const audio = `${TENANT}/bitacora_meeting/${ACTA}/${OBJ}.webm`;
    const db = montar([fila({ storage_path: audio })], [`bitacora/${audio}`]);

    expect(await deleteDocument(DOC)).toEqual({ ok: true });
    expect(db.storageCalls).toEqual([]);
    expect(db.objects()).toEqual([`bitacora/${audio}`]);
  });

  it("si el soft-delete falla, no borra ningún objeto", async () => {
    const db = montar([fila()], [`bitacora/${PATH_BITACORA}`], {
      updateError: { message: "permission denied" },
    });

    expect(await deleteDocument(DOC)).toEqual({
      error: "No se pudo eliminar: permission denied",
    });
    expect(db.storageCalls).toEqual([]);
  });

  it("una fila ya borrada no se encuentra ni toca Storage", async () => {
    const db = montar([fila({ deleted_at: "2026-10-13T00:00:00Z" })], [`bitacora/${PATH_BITACORA}`]);

    expect(await deleteDocument(DOC)).toEqual({ error: "Documento no encontrado." });
    expect(db.storageCalls).toEqual([]);
  });
});

describe("signDocumentUrl · por id, en el bucket de la fila", () => {
  it("un adjunto de Bitácora se firma en `bitacora`", async () => {
    const db = montar([fila()], [`bitacora/${PATH_BITACORA}`]);

    expect(await signDocumentUrl(DOC)).toBe(`https://firmada/bitacora/${PATH_BITACORA}`);
    expect(db.storageCalls).toEqual([
      { bucket: "bitacora", op: "createSignedUrl", paths: [PATH_BITACORA] },
    ]);
  });

  it("un documento del hub se firma en `documents`", async () => {
    montar(
      [fila({ entity_type: "shipment", storage_path: PATH_HUB, bucket_id: "documents" })],
      [`documents/${PATH_HUB}`],
    );

    expect(await signDocumentUrl(DOC)).toBe(`https://firmada/documents/${PATH_HUB}`);
  });

  it("erp-attachments no se firma desde el hub (saltaría el scan_status)", async () => {
    const key = `${TENANT}/expense/${TAREA}/${OBJ}.pdf`;
    const db = montar(
      [fila({ entity_type: "expense", storage_path: key, bucket_id: "erp-attachments" })],
      [`erp-attachments/${key}`],
    );

    expect(await signDocumentUrl(DOC)).toBeNull();
    expect(db.storageCalls).toEqual([]);
  });

  it("id inválido → null sin consultar; fila inexistente o borrada → null", async () => {
    const db = montar([fila({ deleted_at: "2026-10-13T00:00:00Z" })], [`bitacora/${PATH_BITACORA}`]);

    expect(await signDocumentUrl(PATH_BITACORA)).toBeNull();
    expect(db.selects).toEqual([]);

    expect(await signDocumentUrl(DOC)).toBeNull();
    expect(await signDocumentUrl("88888888-8888-4888-8888-888888888888")).toBeNull();
    expect(db.storageCalls).toEqual([]);
  });
});
