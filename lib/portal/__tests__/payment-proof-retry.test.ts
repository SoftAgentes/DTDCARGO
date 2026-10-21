// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROOF_MAX_BYTES } from "../payment-report-types";
import { uploadPaymentProof } from "../payment-proof";

const SCOPE = {
  tenantId: "22000000-0000-4000-8000-000000000001",
  invoiceId: "33000000-0000-4000-8000-000000000001",
  reportId: "44000000-0000-4000-8000-000000000001",
};
const OTHER_ID = "66000000-0000-4000-8000-000000000001";
const RAW_ERROR = "synthetic internal storage path/token: NEVER_SHOW";
const proof = (body = "%PDF-1.4 synthetic receipt", name = "proof.pdf", type = "application/pdf") =>
  new File([body], name, { type });

/** Fake de Storage conserva bytes; no simula el código del helper. */
function storage(options: { loseResponse?: boolean; throwAfterWrite?: boolean; failUpload?: boolean; failDownload?: boolean } = {}) {
  const objects = new Map<string, Buffer>();
  const upload = vi.fn(async (path: string, bytes: Buffer, settings: { upsert: boolean; cacheControl: string; contentType: string }) => {
    if (settings.upsert) throw new Error("No se permite reemplazar evidencia");
    if (options.failUpload) return { data: null, error: { message: RAW_ERROR } };
    if (objects.has(path)) return { data: null, error: { message: "Duplicate", statusCode: "409" } };
    objects.set(path, Buffer.from(bytes));
    if (options.throwAfterWrite) throw new Error(RAW_ERROR);
    if (options.loseResponse) return { data: null, error: { message: RAW_ERROR } };
    return { data: { path }, error: null };
  });
  const download = vi.fn(async (path: string) => {
    if (options.failDownload) throw new Error(RAW_ERROR);
    const bytes = objects.get(path);
    return bytes
      ? { data: new Blob([new Uint8Array(bytes)]), error: null }
      : { data: null, error: { message: RAW_ERROR } };
  });
  const remove = vi.fn(() => { throw new Error("No se permite eliminar evidencia"); });
  const from = vi.fn(() => ({ upload, download, remove }));
  return { admin: { storage: { from } } as unknown as SupabaseClient, objects, upload, download, remove, from };
}

describe("uploadPaymentProof · reintento conservando evidencia", () => {
  it("rechaza evidencia distinta del path original antes de tocar Storage", async () => {
    const io = storage();
    const original = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof("original") });
    io.from.mockClear();
    const retry = { ...SCOPE, file: proof("distinto"), expectedPath: original.path };
    const result = await uploadPaymentProof(io.admin, retry);
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(io.from).not.toHaveBeenCalled();
    expect(io.objects.size).toBe(1);
  });

  it("recupera el mismo comprobante cuando el path original sí coincide", async () => {
    const io = storage();
    const original = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    io.upload.mockClear();
    const retry = { ...SCOPE, file: proof(), expectedPath: original.path };
    expect(await uploadPaymentProof(io.admin, retry)).toEqual(original);
    expect(io.objects.size).toBe(1);
    expect(io.upload).not.toHaveBeenCalled();
    expect(io.download).toHaveBeenCalledWith(original.path);
  });

  it("C1 · recovery no reconstruye evidencia faltante", async () => {
    const io = storage();
    const original = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    io.objects.clear();
    io.upload.mockClear();
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof(), expectedPath: original.path });
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(io.upload).not.toHaveBeenCalled();
    expect(io.objects.size).toBe(0);
  });

  it("C1 · recovery rechaza bytes distintos de igual tamaño bajo el path autorizado", async () => {
    const io = storage();
    const first = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof("contenido A") });
    expect(first.path).toEqual(expect.any(String));
    const originalPath = first.path as string;
    io.objects.set(originalPath, Buffer.from("contenido B"));
    io.upload.mockClear();
    const retry = await uploadPaymentProof(io.admin, {
      ...SCOPE, file: proof("contenido A"), expectedPath: originalPath,
    });
    expect(retry.path).toBeUndefined();
    expect(retry.error).toEqual(expect.any(String));
    expect(io.download).toHaveBeenCalledWith(originalPath);
    expect(io.upload).not.toHaveBeenCalled();
    expect(io.remove).not.toHaveBeenCalled();
    expect(io.objects.get(originalPath)?.toString()).toBe("contenido B");
  });

  it("reutiliza objeto para mismo scope y bytes, aunque cambie el nombre local", async () => {
    const io = storage();
    const first = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    const second = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof(undefined, "nombre-nuevo.pdf") });
    expect(first.path).toEqual(expect.any(String));
    expect(second).toEqual(first);
    expect(io.objects.size).toBe(1);
    expect(io.download).toHaveBeenCalledOnce();
    expect(io.download).toHaveBeenCalledWith(first.path);
    expect(io.remove).not.toHaveBeenCalled();
    for (const [, , settings] of io.upload.mock.calls) expect(settings).toMatchObject({ upsert: false, cacheControl: "0" });
  });

  it("conserva el archivo anterior cuando cambian los bytes", async () => {
    const io = storage();
    const first = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof("contenido A") });
    const second = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof("contenido B") });
    expect(second.path).not.toBe(first.path);
    expect(io.objects.get(first.path!)?.toString()).toBe("contenido A");
    expect(io.objects.get(second.path!)?.toString()).toBe("contenido B");
    expect(io.objects.size).toBe(2);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it.each(["tenantId", "invoiceId", "reportId"] as const)("aísla el mismo contenido por %s", async (field) => {
    const io = storage();
    const first = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    const second = await uploadPaymentProof(io.admin, { ...SCOPE, [field]: OTHER_ID, file: proof() });
    expect(second.path).toEqual(expect.any(String));
    expect(second.path).not.toBe(first.path);
    expect(io.objects.size).toBe(2);
  });

  it.each([
    ["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"],
    ["image/webp", "webp"], ["image/heic", "heic"], ["image/heif", "heif"],
  ])("produce path canónico para %s", async (mime, ext) => {
    const io = storage();
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof("fixture", "ignorado.exe", mime) });
    const parts = result.path?.split("/");
    expect(parts?.slice(0, 3)).toEqual(Object.values(SCOPE));
    expect(parts?.[3]).toMatch(new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\." + ext + "$"));
    expect(io.upload.mock.calls[0][2]).toMatchObject({ contentType: mime, upsert: false });
  });

  it.each([{ loseResponse: true }, { throwAfterWrite: true }])("recupera respuesta perdida sólo si verifica bytes guardados: %j", async (options) => {
    const io = storage(options);
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    expect(result.path).toEqual(expect.any(String));
    expect(result.error).toBeUndefined();
    expect(io.objects.size).toBe(1);
    expect(io.download).toHaveBeenCalledWith(result.path);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("un Duplicate no prueba igualdad: niega bytes distintos guardados en el mismo path", async () => {
    const io = storage();
    const first = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    io.objects.set(first.path!, Buffer.from("objeto distinto"));
    const retry = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    expect(retry.path).toBeUndefined();
    expect(retry.error).toEqual(expect.any(String));
    expect(io.objects.get(first.path!)?.toString()).toBe("objeto distinto");
    expect(io.objects.size).toBe(1);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it.each([{ failUpload: true }, { loseResponse: true, failDownload: true }])("no declara éxito sin verificación ni revela errores internos: %j", async (options) => {
    const io = storage(options);
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file: proof() });
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(result.error).not.toContain(RAW_ERROR);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it.each(["", "../otra", SCOPE.tenantId + "\n", SCOPE.tenantId + "/extra"])("rechaza scope inválido antes de Storage: %j", async (tenantId) => {
    const io = storage();
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, tenantId, file: proof() });
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(io.from).not.toHaveBeenCalled();
  });

  it.each([
    { label: "vacío", file: proof("") },
    { label: "MIME no permitido", file: proof("fixture", "proof.html", "text/html") },
    { label: "demasiado grande", file: new File([new Uint8Array(PROOF_MAX_BYTES + 1)], "grande.pdf", { type: "application/pdf" }) },
  ])("rechaza archivo $label antes de Storage", async ({ file }) => {
    const io = storage();
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file });
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(io.from).not.toHaveBeenCalled();
  });

  it("contiene un error de lectura local y no envía bytes incompletos", async () => {
    const io = storage();
    const file = proof();
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error(RAW_ERROR));
    const result = await uploadPaymentProof(io.admin, { ...SCOPE, file });
    expect(result.path).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(result.error).not.toContain(RAW_ERROR);
    expect(io.from).not.toHaveBeenCalled();
  });
});
