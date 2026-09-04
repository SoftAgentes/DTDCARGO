// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consumers = [
  "proveedores/page.tsx",
  "compras/page.tsx",
  "compras/nueva/page.tsx",
  "compras/[code]/page.tsx",
  "compras/[code]/detalle/page.tsx",
  "compras/[code]/etiquetas/page.tsx",
] as const;

function source(file: string) {
  return readFileSync(
    new URL(`../../../app/portal/(app)/${file}`, import.meta.url),
    "utf8",
  );
}

describe("SDD0399 · principal canónico en consumidores de compras", () => {
  it.each(consumers)("%s conserva client + tenantId", (file) => {
    const text = source(file);
    expect(text).toContain("getPortalClientPrincipal");
    expect(text).not.toMatch(/\bgetPortalClient\s*\(/);
    expect(text).toMatch(/const\s+\{\s*client,\s*tenantId\s*\}\s*=\s*principal/);
  });

  it.each(consumers)("%s propaga tenantId al ámbito de sus lecturas", (file) => {
    expect(source(file)).toMatch(
      /\{\s*tenantId,\s*markbox:\s*client\.markbox,?\s*\}/,
    );
  });

  it("la lectura documental filtra el tenant antes de firmar", () => {
    const text = readFileSync(
      new URL("../../studio/prealertas/queries.ts", import.meta.url),
      "utf8",
    );
    const start = text.indexOf("export async function listPrealertaDocuments");
    const end = text.indexOf("export type PrealertaDocumentPresence", start);
    const implementation = text.slice(start, end);
    expect(implementation).toContain('.eq("tenant_id", opts.tenantId)');
  });
});
