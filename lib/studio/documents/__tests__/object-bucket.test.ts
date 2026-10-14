import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  documentObjectBucket,
  type DocumentObjectRow,
} from "../object-bucket";

/**
 * SDD-0508 · El bucket del objeto sale de la fila (`documents.bucket_id`).
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTRO_TENANT = "22222222-2222-4222-8222-222222222222";
const TAREA = "33333333-3333-4333-8333-333333333333";
const OTRA_TAREA = "44444444-4444-4444-8444-444444444444";
const ACTA = "55555555-5555-4555-8555-555555555555";
const OBJ = "66666666-6666-4666-8666-666666666666";

const adjunto = (tenant = TENANT, tarea = TAREA, ext = "jpg") =>
  `${tenant}/bitacora_task/${tarea}/${OBJ}.${ext}`;

const fila = (over: Partial<DocumentObjectRow> = {}): DocumentObjectRow => ({
  bucket_id: "bitacora",
  tenant_id: TENANT,
  entity_type: "bitacora_task",
  entity_id: TAREA,
  storage_path: adjunto(),
  ...over,
});

describe("documentObjectBucket", () => {
  it("un adjunto de Bitácora en su carpeta → bucket bitacora", () => {
    expect(documentObjectBucket(fila())).toBe("bitacora");
    expect(documentObjectBucket(fila({ storage_path: adjunto(TENANT, TAREA, "pdf") }))).toBe("bitacora");
  });

  it("una fila del hub → bucket documents, sea cual sea la entidad", () => {
    expect(
      documentObjectBucket(
        fila({
          bucket_id: "documents",
          entity_type: "shipment",
          storage_path: `${TENANT}/shipment/${TAREA}/${OBJ}.xlsx`,
        }),
      ),
    ).toBe("documents");
    // El hub también indexa un bitacora_task en su propio bucket: manda la fila.
    expect(
      documentObjectBucket(
        fila({ bucket_id: "documents", storage_path: `${TENANT}/bitacora_task/${TAREA}/${OBJ}.docx` }),
      ),
    ).toBe("documents");
  });

  it("bitacora: no alcanza el audio de un acta del mismo bucket", () => {
    expect(
      documentObjectBucket(
        fila({ storage_path: `${TENANT}/bitacora_meeting/${ACTA}/${OBJ}.webm` }),
      ),
    ).toBeNull();
  });

  it("bitacora: no alcanza la carpeta de otra tarea ni de otro tenant", () => {
    expect(documentObjectBucket(fila({ storage_path: adjunto(TENANT, OTRA_TAREA) }))).toBeNull();
    expect(documentObjectBucket(fila({ storage_path: adjunto(OTRO_TENANT, TAREA) }))).toBeNull();
    expect(documentObjectBucket(fila({ tenant_id: OTRO_TENANT }))).toBeNull();
  });

  it("bitacora: exige que la fila sea un bitacora_task con tarea", () => {
    expect(documentObjectBucket(fila({ entity_type: "client" }))).toBeNull();
    expect(documentObjectBucket(fila({ entity_id: null }))).toBeNull();
    expect(documentObjectBucket(fila({ storage_path: `${adjunto()}/../x.jpg` }))).toBeNull();
  });

  it("erp-attachments y cualquier otro valor → null (no se firma ni se borra)", () => {
    for (const bucket_id of ["erp-attachments", "Documents", "bitacora ", "", null, undefined]) {
      expect(documentObjectBucket(fila({ bucket_id }))).toBeNull();
    }
  });
});

// ─── Propiedad: ningún consumidor de `documents` usa un bucket fijo ───
//
// Si una acción lee una fila de `documents` y firma o borra su `storage_path`
// con `storage.from(CONSTANTE)`, vuelve el defecto de esta SDD. El escaneo cubre
// todo `app/` y `lib/` (sin pruebas) que consulte la tabla.

const RAIZ = join(__dirname, "..", "..", "..", "..");
const BUCKET_FIJO_CON_PATH_DE_FILA =
  /storage\s*\.from\(\s*(?:[A-Z][A-Z0-9_]*|["'][^"']+["'])\s*\)\s*\.(?:remove|createSignedUrls?|download)\(\s*\[?\s*[\w.]*storage_path/g;

function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__") continue;
      out.push(...fuentes(ruta));
    } else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
      out.push(ruta);
    }
  }
  return out;
}

const consumidores = ["app", "lib"]
  .flatMap((d) => fuentes(join(RAIZ, d)))
  .filter((f) => /\.from\(\s*["']documents["']\s*\)/.test(readFileSync(f, "utf8")))
  .map((f) => relative(RAIZ, f).split("\\").join("/"))
  .sort();

describe("propiedad · el bucket de una fila de documents nunca es una constante", () => {
  it("el escaneo encuentra a los consumidores conocidos (no pasa en vacío)", () => {
    expect(consumidores).toEqual(
      expect.arrayContaining([
        "app/studio/(app)/bitacora/collab-actions.ts",
        "app/studio/(app)/documentos/actions.ts",
        "lib/studio/attachments/service.ts",
        "lib/studio/documents/queries.ts",
      ]),
    );
  });

  it("control rojo: el código anterior a la SDD-0508 cae", () => {
    const viejo = [
      "await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);",
      "const { data } = await supabase.storage\n  .from(BITACORA_BUCKET)\n  .createSignedUrl(d.storage_path, 3600);",
      'await supabase.storage.from("bitacora").remove([doc.storage_path]);',
    ];
    for (const s of viejo) expect(s.match(BUCKET_FIJO_CON_PATH_DE_FILA)).not.toBeNull();
    // Una subida recién hecha (path propio, no de una fila) sí puede usar la constante.
    expect(
      "await supabase.storage.from(BITACORA_BUCKET).remove([storagePath]);".match(
        BUCKET_FIJO_CON_PATH_DE_FILA,
      ),
    ).toBeNull();
  });

  it("ningún consumidor firma ni borra el storage_path de una fila con un bucket fijo", () => {
    const hallazgos = consumidores.flatMap((f) =>
      [...readFileSync(join(RAIZ, f), "utf8").matchAll(BUCKET_FIJO_CON_PATH_DE_FILA)].map(
        (m) => `${f}: ${m[0].replace(/\s+/g, " ")}`,
      ),
    );
    expect(hallazgos).toEqual([]);
  });
});
