import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDocumentsDouble } from "@/lib/studio/documents/__tests__/documents-double";

/**
 * SDD-0508 · La «Prueba de avance» de Bitácora deja `bucket_id = 'bitacora'` en
 * su fila de `documents`, y la galería y el borrado de la tarea usan el bucket
 * que dice la fila.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getUserTenantId: vi.fn(),
  moduleEditDenial: vi.fn(async () => null as string | null),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: () => mocks.createClient() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  getUser: () => mocks.getUser(),
  getUserTenantId: () => mocks.getUserTenantId(),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioRole: vi.fn(),
  moduleEditDenial: mocks.moduleEditDenial,
}));
vi.mock("@/lib/studio/rbac", () => ({ canSpecial: vi.fn(() => false) }));
vi.mock("@/lib/studio/comments/comments-queries", () => ({
  listComments: vi.fn(async () => []),
  loadTenantUsers: vi.fn(async () => []),
}));

import {
  deleteTaskAttachmentAction,
  listTaskAttachmentsAction,
  registerTaskAttachmentAction,
} from "../collab-actions";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "99999999-9999-4999-8999-999999999999";
const TAREA = "33333333-3333-4333-8333-333333333333";
const DOC = "77777777-7777-4777-8777-777777777777";
const OBJ = "66666666-6666-4666-8666-666666666666";

const PATH = `${TENANT}/bitacora_task/${TAREA}/${OBJ}.jpg`;

function fila(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    tenant_id: TENANT,
    entity_type: "bitacora_task",
    entity_id: TAREA,
    folder: "otr-internos",
    doc_type: "Foto",
    name: "Avance",
    storage_path: PATH,
    bucket_id: "bitacora",
    content_type: "image/jpeg",
    size_bytes: 10,
    status: "vigente",
    is_current: true,
    created_at: "2026-10-13T00:00:00Z",
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
  mocks.getUser.mockResolvedValue({ id: USER });
  mocks.getUserTenantId.mockResolvedValue(TENANT);
  mocks.moduleEditDenial.mockResolvedValue(null);
});

describe("registerTaskAttachmentAction", () => {
  it("la fila queda con bucket_id = 'bitacora' (no el default 'documents' de 0307)", async () => {
    const db = montar([], [`bitacora/${PATH}`]);

    const res = await registerTaskAttachmentAction(TAREA, PATH, {
      name: "Avance",
      mime: "image/jpeg",
      sizeBytes: 10,
    });

    expect(res).toEqual({ ok: true });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({
      entity_type: "bitacora_task",
      entity_id: TAREA,
      storage_path: PATH,
      bucket_id: "bitacora",
    });
    expect(db.rows()[0].bucket_id).toBe("bitacora");
  });

  it("si el insert falla, deshace la subida en `bitacora`", async () => {
    const db = montar([], [`bitacora/${PATH}`], {
      insertError: { message: "documento sobre entidad inexistente" },
    });

    const res = await registerTaskAttachmentAction(TAREA, PATH, { mime: "image/jpeg" });

    expect(res.error).toContain("documento sobre entidad inexistente");
    expect(db.storageCalls).toEqual([{ bucket: "bitacora", op: "remove", paths: [PATH] }]);
  });
});

describe("listTaskAttachmentsAction · firma en el bucket de la fila", () => {
  it("un adjunto en `bitacora` se firma ahí", async () => {
    montar([fila()], [`bitacora/${PATH}`]);

    const [a] = await listTaskAttachmentsAction(TAREA);

    expect(a.signedUrl).toBe(`https://firmada/bitacora/${PATH}`);
  });

  it("una versión que el hub guardó en `documents` se firma en `documents`", async () => {
    const pdf = `${TENANT}/bitacora_task/${TAREA}/${OBJ}.pdf`;
    const db = montar(
      [fila({ storage_path: pdf, bucket_id: "documents", content_type: "application/pdf" })],
      [`documents/${pdf}`],
    );

    const [a] = await listTaskAttachmentsAction(TAREA);

    expect(a.signedUrl).toBe(`https://firmada/documents/${pdf}`);
    expect(db.storageCalls.map((c) => c.bucket)).toEqual(["documents"]);
  });

  it("un bucket que el Studio no maneja no se firma", async () => {
    const db = montar([fila({ bucket_id: "erp-attachments" })], [`erp-attachments/${PATH}`]);

    const [a] = await listTaskAttachmentsAction(TAREA);

    expect(a.signedUrl).toBeNull();
    expect(db.storageCalls).toEqual([]);
  });
});

describe("deleteTaskAttachmentAction · borra en el bucket de la fila", () => {
  it("adjunto en `bitacora`: soft-delete y objeto borrado ahí", async () => {
    const db = montar([fila()], [`bitacora/${PATH}`]);

    expect(await deleteTaskAttachmentAction(DOC)).toEqual({ ok: true });
    expect(db.rows()[0].deleted_at).toEqual(expect.any(String));
    expect(db.storageCalls).toEqual([{ bucket: "bitacora", op: "remove", paths: [PATH] }]);
    expect(db.objects()).toEqual([]);
  });

  it("versión guardada por el hub en `documents`: se borra en `documents`", async () => {
    const pdf = `${TENANT}/bitacora_task/${TAREA}/${OBJ}.pdf`;
    const db = montar([fila({ storage_path: pdf, bucket_id: "documents" })], [`documents/${pdf}`]);

    expect(await deleteTaskAttachmentAction(DOC)).toEqual({ ok: true });
    expect(db.storageCalls).toEqual([{ bucket: "documents", op: "remove", paths: [pdf] }]);
    expect(db.objects()).toEqual([]);
  });

  it("solo alcanza filas bitacora_task", async () => {
    const db = montar([fila({ entity_type: "client" })], [`bitacora/${PATH}`]);

    expect(await deleteTaskAttachmentAction(DOC)).toEqual({ error: "Adjunto no encontrado." });
    expect(db.storageCalls).toEqual([]);
  });
});
