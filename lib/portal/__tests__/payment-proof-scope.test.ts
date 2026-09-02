// @vitest-environment node
/** El firmador real sólo debe firmar el comprobante del contexto autorizado. */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProofSignedUrl, uploadPaymentProof } from "../payment-proof";

const TENANT_ID = "22000000-0000-4000-8000-000000000001";
const INVOICE_ID = "33000000-0000-4000-8000-000000000001";
const REPORT_ID = "44000000-0000-4000-8000-000000000001";
const OBJECT_ID = "55000000-0000-4000-8000-000000000001";
const OTHER_ID = "66000000-0000-4000-8000-000000000002";
const SCOPE = { tenantId: TENANT_ID, invoiceId: INVOICE_ID, reportId: REPORT_ID };
const CANONICAL_PATH = `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.pdf`;
const SIGNED_URL = "https://storage.example.invalid/signed/synthetic-proof";

const scopedSigner = createProofSignedUrl;

function storageStub() {
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: SIGNED_URL }, error: null }));
  const upload = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ createSignedUrl, upload }));
  const admin = { storage: { from } } as unknown as SupabaseClient;
  return { admin, from, createSignedUrl, upload };
}

describe("createProofSignedUrl · contexto exacto del comprobante", () => {
  it.each(["pdf", "jpg", "png", "webp", "heic", "heif"])("permite la extensión canónica .%s", async (extension) => {
    const { admin, createSignedUrl } = storageStub();
    const path = `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.${extension}`;

    await expect(scopedSigner(admin, path, SCOPE)).resolves.toBe(SIGNED_URL);

    expect(createSignedUrl).toHaveBeenCalledWith(path, 300);
  });

  it.each(["html", "exe"])("no firma archivos .%s aunque sus UUID y contexto coincidan", async (extension) => {
    const { admin, from, createSignedUrl } = storageStub();
    const path = `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.${extension}`;

    await expect(scopedSigner(admin, path, SCOPE)).resolves.toBeNull();

    expect(from).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([0, 301, Number.NaN, 1.5])("niega el TTL inválido %s antes de invocar Storage", async (ttl) => {
    const { admin, from, createSignedUrl } = storageStub();

    await expect(scopedSigner(admin, CANONICAL_PATH, SCOPE, ttl)).resolves.toBeNull();

    expect(from).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    { label: "tenant", scope: { ...SCOPE, tenantId: OTHER_ID } },
    { label: "factura", scope: { ...SCOPE, invoiceId: OTHER_ID } },
    { label: "reporte", scope: { ...SCOPE, reportId: OTHER_ID } },
  ])("niega una ruta válida si el contexto autorizado tiene otro $label", async ({ scope }) => {
    const { admin, from, createSignedUrl } = storageStub();

    await expect(scopedSigner(admin, CANONICAL_PATH, scope)).resolves.toBeNull();

    expect(from).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("permite una ruta canónica del tenant, factura y reporte autorizados", async () => {
    const { admin, from, createSignedUrl } = storageStub();

    await expect(scopedSigner(admin, CANONICAL_PATH, SCOPE)).resolves.toBe(SIGNED_URL);

    expect(from).toHaveBeenCalledWith("payment-proofs");
    expect(createSignedUrl).toHaveBeenCalledOnce();
  });

  it("usa 300 segundos por defecto al firmar una ruta autorizada", async () => {
    const { admin, createSignedUrl } = storageStub();

    await scopedSigner(admin, CANONICAL_PATH, SCOPE);

    expect(createSignedUrl).toHaveBeenCalledWith(CANONICAL_PATH, 300);
  });

  it("respeta el TTL explícito después del contexto", async () => {
    const { admin, createSignedUrl } = storageStub();

    await scopedSigner(admin, CANONICAL_PATH, SCOPE, 120);

    expect(createSignedUrl).toHaveBeenCalledWith(CANONICAL_PATH, 120);
  });

  it("acepta la ruta producida por el uploader real para ese contexto", async () => {
    const { admin, createSignedUrl } = storageStub();
    const uploaded = await uploadPaymentProof(admin, {
      ...SCOPE,
      file: new File(["synthetic"], "comprobante.png", { type: "image/png" }),
    });
    expect(uploaded.error).toBeUndefined();
    expect(uploaded.path).toEqual(expect.any(String));

    await expect(scopedSigner(admin, uploaded.path!, SCOPE)).resolves.toBe(SIGNED_URL);

    expect(createSignedUrl).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "otro tenant", path: `${OTHER_ID}/${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.pdf` },
    { label: "otra factura", path: `${TENANT_ID}/${OTHER_ID}/${REPORT_ID}/${OBJECT_ID}.pdf` },
    { label: "otro reporte", path: `${TENANT_ID}/${INVOICE_ID}/${OTHER_ID}/${OBJECT_ID}.pdf` },
    { label: "vacío", path: "" },
    { label: "URL absoluta", path: `https://storage.example.invalid/${CANONICAL_PATH}` },
    { label: "barra inicial", path: `/${CANONICAL_PATH}` },
    { label: "barra final", path: `${CANONICAL_PATH}/` },
    { label: "segmento vacío", path: `${TENANT_ID}//${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.pdf` },
    { label: "segmento faltante", path: `${TENANT_ID}/${INVOICE_ID}/${OBJECT_ID}.pdf` },
    { label: "directorio extra", path: `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/extra/${OBJECT_ID}.pdf` },
    { label: "traversal literal", path: `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/../${OBJECT_ID}.pdf` },
    { label: "traversal codificado", path: `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/%2e%2e/${OBJECT_ID}.pdf` },
    { label: "separador codificado", path: `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/%2f${OBJECT_ID}.pdf` },
    { label: "separadores Windows", path: `${TENANT_ID}\\${INVOICE_ID}\\${REPORT_ID}\\${OBJECT_ID}.pdf` },
    { label: "query string", path: `${CANONICAL_PATH}?download=1` },
    { label: "fragmento URL", path: `${CANONICAL_PATH}#proof` },
    { label: "espacio inicial", path: ` ${CANONICAL_PATH}` },
    { label: "salto de línea final", path: `${CANONICAL_PATH}\n` },
    { label: "CRLF final", path: `${CANONICAL_PATH}\r\n` },
    { label: "nombre sin UUID", path: `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/comprobante.pdf` },
  ])("no firma ni invoca Storage para path $label", async ({ path }) => {
    const { admin, from, createSignedUrl } = storageStub();

    const result = await scopedSigner(admin, path, SCOPE);

    expect.soft(result).toBeNull();
    expect.soft(from).not.toHaveBeenCalled();
    expect.soft(createSignedUrl).not.toHaveBeenCalled();
  });

  it("devuelve null cuando Storage no puede firmar una ruta válida", async () => {
    const createSignedUrl = vi.fn(async () => ({ data: null, error: { message: "synthetic storage failure" } }));
    const admin = { storage: { from: () => ({ createSignedUrl }) } } as unknown as SupabaseClient;

    await expect(scopedSigner(admin, CANONICAL_PATH, SCOPE)).resolves.toBeNull();
  });

  it("convierte una excepción del transporte de Storage en null", async () => {
    const createSignedUrl = vi.fn(async () => { throw new Error("synthetic storage transport failure"); });
    const admin = { storage: { from: () => ({ createSignedUrl }) } } as unknown as SupabaseClient;

    await expect(scopedSigner(admin, CANONICAL_PATH, SCOPE)).resolves.toBeNull();

    expect(createSignedUrl).toHaveBeenCalledOnce();
  });
});
