// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("pureza de render", () => {
  it("captura una referencia estable para edades de bugs", () => {
    const code = source("app/studio/(app)/bugs/_components/BugTable.tsx");
    expect(code).toContain("BUG_TABLE_REFERENCE_MS");
    expect(code.indexOf("const BUG_TABLE_REFERENCE_MS")).toBeLessThan(
      code.indexOf("export function BugTable"),
    );
  });

  it("calcula la vigencia por defecto fuera del render", () => {
    const code = source(
      "app/studio/(app)/cotizador/_components/QuoteDrawer.tsx",
    );
    expect(code).toContain("quote?.valid_until ?? DEFAULT_VALID_UNTIL");
    // Lo que se protege es que la sugerencia se limpie EN EL HANDLER, no que el
    // setter se llame de una forma. Con el nombre literal, este contrato se
    // ponía rojo por un rename que no cambiaba una coma del comportamiento
    // (pasó en SDD-0269, al pasar la sugerencia a traer también su origen).
    expect(code).toMatch(/if \(!next\.trim\(\)\) set\w+\(null\)/);
  });

  it("usa referencia estable en mailing y fecha absoluta en tracking", () => {
    expect(
      source("app/studio/(app)/mailing/_components/MailingClient.tsx"),
    ).toContain("MAILING_REFERENCE_MS");
    expect(source("app/studio/(app)/tracking/[id]/page.tsx")).toContain(
      'timeZone: "America/Caracas"',
    );
  });
});
