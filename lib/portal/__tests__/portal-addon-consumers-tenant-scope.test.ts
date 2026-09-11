// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consumers = [
  "proveedores/page.tsx",
  "compras/nueva/page.tsx",
  "compras/[code]/etiquetas/page.tsx",
] as const;

function source(file: string) {
  return readFileSync(
    new URL(`../../../app/portal/(app)/${file}`, import.meta.url),
    "utf8",
  );
}

describe("SDD0402 · tenant del catálogo de servicios Portal", () => {
  it.each(consumers)("%s propaga el tenant del principal al catálogo", (file) => {
    expect(source(file)).toMatch(
      /listActivePrealertaAddons\(supabase,\s*\{\s*tenantId\s*\}\)/,
    );
  });
});
