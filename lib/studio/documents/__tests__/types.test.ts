/**
 * Tests de los tipos/helpers del Hub de Documentos (SDD-0049 Slice A).
 *
 * Cubre Acceptance §5 Slice A (parte lib):
 *  - deriveDocStatus: vencido / por-vencer / vigente (+ status persistido)
 *  - validateDocumentInput: coherencia entity_type↔entity_id, carpeta, mime,
 *    tamaño, fecha, status (no Zod)
 *  - folder helpers: topOf / subIds / folderLabel + taxonomy fijo del Norte
 *  - extFromMime / isAllowedDocumentMime
 */
import { describe, it, expect } from "vitest";
import {
  FOLDERS,
  FOLDER_SUB_IDS,
  DOCUMENT_ENTITY_TYPES,
  LINK_KIND,
  deriveDocStatus,
  validateDocumentInput,
  topOf,
  subIds,
  folderLabel,
  extFromMime,
  isAllowedDocumentMime,
  formatDocSize,
  buildDocumentStoragePath,
  canonicalContentType,
} from "../types";

describe("deriveDocStatus", () => {
  const today = "2026-06-03";

  it("sin valid_until → devuelve el status persistido", () => {
    expect(deriveDocStatus({ status: "firmado", valid_until: null }, today)).toBe(
      "firmado",
    );
    expect(deriveDocStatus({ status: "borrador", valid_until: null }, today)).toBe(
      "borrador",
    );
  });

  it("valid_until en el pasado → 'vencido' (gana sobre el status)", () => {
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "2026-02-01" }, today),
    ).toBe("vencido");
  });

  it("valid_until dentro de los próximos 30 días → 'por-vencer'", () => {
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "2026-06-20" }, today),
    ).toBe("por-vencer");
    // borde: hoy + 29 días aún es por-vencer
    expect(
      deriveDocStatus({ status: "firmado", valid_until: "2026-07-01" }, today),
    ).toBe("por-vencer");
  });

  it("valid_until lejano → devuelve el status persistido (vigente)", () => {
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "2027-01-01" }, today),
    ).toBe("vigente");
    expect(
      deriveDocStatus({ status: "firmado", valid_until: "2027-01-01" }, today),
    ).toBe("firmado");
  });

  it("ventana configurable (windowDays)", () => {
    // con ventana de 7 días, 2026-06-20 ya no entra en por-vencer
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "2026-06-20" }, today, 7),
    ).toBe("vigente");
  });

  it("acepta Date además de string ISO", () => {
    const d = new Date(Date.UTC(2026, 5, 3));
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "2026-02-01" }, d),
    ).toBe("vencido");
  });

  it("valid_until inválido → cae al status persistido (no rompe)", () => {
    expect(
      deriveDocStatus({ status: "vigente", valid_until: "no-es-fecha" }, today),
    ).toBe("vigente");
  });
});

describe("folder helpers + taxonomy", () => {
  it("FOLDERS tiene los 5 grupos del Norte", () => {
    expect(FOLDERS.map((g) => g.id)).toEqual(["op", "log", "con", "adu", "otr"]);
  });

  it("FOLDER_SUB_IDS junta todas las subcarpetas (~18)", () => {
    const total = FOLDERS.reduce((n, g) => n + g.children.length, 0);
    expect(FOLDER_SUB_IDS.size).toBe(total);
    expect(FOLDER_SUB_IDS.has("log-bl")).toBe(true);
    expect(FOLDER_SUB_IDS.has("op-kyc")).toBe(true);
    expect(FOLDER_SUB_IDS.has("inexistente")).toBe(false);
  });

  it("topOf resuelve el grupo desde una subcarpeta o desde el propio grupo", () => {
    expect(topOf("log-bl")?.id).toBe("log");
    expect(topOf("log")?.id).toBe("log");
    expect(topOf("nope")).toBeUndefined();
  });

  it("subIds expande un grupo a sus subcarpetas; [] si no es grupo", () => {
    expect(subIds("log")).toEqual([
      "log-bl",
      "log-packing",
      "log-origen",
      "log-fotos",
    ]);
    expect(subIds("log-bl")).toEqual([]);
  });

  it("folderLabel da label de grupo y de subcarpeta", () => {
    expect(folderLabel("log")).toBe("Logísticas");
    expect(folderLabel("log-bl")).toBe("BL & conocimiento");
    expect(folderLabel("nope")).toBe("—");
  });
});

describe("LINK_KIND deep-links", () => {
  it("cubre todos los entity types del enum", () => {
    for (const t of DOCUMENT_ENTITY_TYPES) {
      expect(LINK_KIND[t]).toBeTruthy();
      expect(LINK_KIND[t].label.length).toBeGreaterThan(0);
    }
  });

  it("shipment apunta a tracking; client a clientes; none sin ruta", () => {
    expect(LINK_KIND.shipment.route).toBe("/studio/tracking");
    expect(LINK_KIND.client.route).toBe("/studio/clientes");
    expect(LINK_KIND.invoice.route).toBe("/studio/facturacion");
    expect(LINK_KIND.none.route).toBeNull();
    expect(LINK_KIND.none.module).toBeNull();
  });
});

describe("mime + tamaño", () => {
  it("isAllowedDocumentMime acepta pdf/img/office/zip y rechaza otros", () => {
    expect(isAllowedDocumentMime("application/pdf")).toBe(true);
    expect(isAllowedDocumentMime("image/png")).toBe(true);
    expect(
      isAllowedDocumentMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(isAllowedDocumentMime("application/zip")).toBe(true);
    expect(isAllowedDocumentMime("application/x-msdownload")).toBe(false);
    expect(isAllowedDocumentMime("text/html")).toBe(false);
  });

  it("extFromMime mapea a la extensión canónica", () => {
    expect(extFromMime("application/pdf")).toBe("pdf");
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(
      extFromMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(extFromMime("application/zip")).toBe("zip");
    expect(extFromMime("desconocido")).toBe("bin");
  });

  it("formatDocSize legible y vacío para 0/null", () => {
    expect(formatDocSize(null)).toBe("");
    expect(formatDocSize(0)).toBe("");
    expect(formatDocSize(512)).toBe("512 B");
    expect(formatDocSize(2048)).toBe("2 KB");
    expect(formatDocSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("validateDocumentInput", () => {
  const base = {
    entityType: "shipment" as const,
    entityId: "11111111-1111-4111-8111-111111111111",
    folder: "log-bl",
    name: "BL COSCO",
    contentType: "application/pdf",
    sizeBytes: 1024,
    status: "firmado" as const,
    validUntil: null,
    docType: "BL marítimo",
  };

  it("acepta un input válido y lo normaliza", () => {
    const res = validateDocumentInput(base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.entityType).toBe("shipment");
      expect(res.value.folder).toBe("log-bl");
      expect(res.value.docType).toBe("BL marítimo");
    }
  });

  it("'none' fuerza entity_id null aunque venga uno", () => {
    const res = validateDocumentInput({
      ...base,
      entityType: "none",
      entityId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.entityId).toBeNull();
  });

  it("tipo distinto de 'none' exige entity_id", () => {
    const res = validateDocumentInput({ ...base, entityId: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.entityId).toBeTruthy();
  });

  it("rechaza entity_id no-uuid", () => {
    const res = validateDocumentInput({ ...base, entityId: "no-uuid" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.entityId).toBeTruthy();
  });

  it("rechaza carpeta inexistente y carpeta vacía", () => {
    const r1 = validateDocumentInput({ ...base, folder: "carpeta-fantasma" });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.folder).toBeTruthy();

    const r2 = validateDocumentInput({ ...base, folder: "" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.folder).toBeTruthy();
  });

  it("rechaza nombre vacío", () => {
    const res = validateDocumentInput({ ...base, name: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.name).toBeTruthy();
  });

  it("rechaza mime no permitido", () => {
    const res = validateDocumentInput({ ...base, contentType: "text/html" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.contentType).toBeTruthy();
  });

  it("rechaza tamaño sobre el límite de 10 MB", () => {
    const res = validateDocumentInput({
      ...base,
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.sizeBytes).toBeTruthy();
  });

  it("rechaza status fuera del enum", () => {
    const res = validateDocumentInput({
      ...base,
      status: "vencido" as never, // vencido NO es persistible (se deriva)
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.status).toBeTruthy();
  });

  it("rechaza valid_until con formato inválido", () => {
    const res = validateDocumentInput({ ...base, validUntil: "03/06/2026" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.validUntil).toBeTruthy();
  });

  it("acepta valid_until ISO válido", () => {
    const res = validateDocumentInput({ ...base, validUntil: "2026-12-31" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.validUntil).toBe("2026-12-31");
  });
});

// ── buildDocumentStoragePath (Slice B · path construido SERVER-SIDE) ──
describe("buildDocumentStoragePath", () => {
  const TENANT = "11111111-1111-1111-1111-111111111111";
  const ENTITY = "22222222-2222-2222-2222-222222222222";
  const UUID = "33333333-3333-3333-3333-333333333333";

  it("entidad concreta → {tenant}/{type}/{id}/{uuid}.{ext}", () => {
    expect(
      buildDocumentStoragePath({
        tenantId: TENANT,
        entityType: "shipment",
        entityId: ENTITY,
        uuid: UUID,
        ext: "pdf",
      }),
    ).toBe(`${TENANT}/shipment/${ENTITY}/${UUID}.pdf`);
  });

  it("primer segmento del path = tenant (lo re-verifica la Storage RLS)", () => {
    const path = buildDocumentStoragePath({
      tenantId: TENANT,
      entityType: "client",
      entityId: ENTITY,
      uuid: UUID,
      ext: "jpg",
    });
    expect(path.split("/")[0]).toBe(TENANT);
  });

  it("entity_type 'none' → segmento literal 'none' (sin id)", () => {
    expect(
      buildDocumentStoragePath({
        tenantId: TENANT,
        entityType: "none",
        entityId: null,
        uuid: UUID,
        ext: "zip",
      }),
    ).toBe(`${TENANT}/none/none/${UUID}.zip`);
  });

  it("entityId null con type ≠ none → segmento 'none' (defensa)", () => {
    expect(
      buildDocumentStoragePath({
        tenantId: TENANT,
        entityType: "invoice",
        entityId: null,
        uuid: UUID,
        ext: "pdf",
      }),
    ).toBe(`${TENANT}/invoice/none/${UUID}.pdf`);
  });
});

// ── canonicalContentType (Slice B · hardening: MIME servido = canónico del tipo,
// NO el raw.type del cliente · SDD-0049 §9) ──────────────────────────
describe("canonicalContentType", () => {
  it("mapea cada mime de la whitelist a su content-type canónico", () => {
    expect(canonicalContentType("application/pdf")).toBe("application/pdf");
    expect(canonicalContentType("image/jpeg")).toBe("image/jpeg");
    expect(canonicalContentType("image/png")).toBe("image/png");
    expect(canonicalContentType("image/webp")).toBe("image/webp");
    expect(
      canonicalContentType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(
      canonicalContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(canonicalContentType("application/zip")).toBe("application/zip");
  });

  it("tipo renderizable inyectado (text/html, image/svg+xml) NUNCA se sirve como tal → octet-stream", () => {
    // El cliente puede mandar raw.type=text/html aunque la whitelist lo rechace;
    // si por error llegara a upload, el MIME servido jamás sería ejecutable inline.
    expect(canonicalContentType("text/html")).toBe("application/octet-stream");
    expect(canonicalContentType("image/svg+xml")).toBe(
      "application/octet-stream",
    );
    expect(canonicalContentType("")).toBe("application/octet-stream");
  });
});
