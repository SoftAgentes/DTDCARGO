import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("contratos de estado visibles", () => {
  it.each([
    "app/studio/(app)/clientes/_components/ClientDrawer.tsx",
    "app/studio/(app)/tarifas/_components/RateDrawer.tsx",
  ])("muestra errores del action y del flujo crear en %s", (path) => {
    const code = source(path);
    expect(code).toContain("state.error || createError");
    expect(code).toContain("state.error ?? createError");
  });

  it("usa el tono de fondo entregado a CategoryBar", () => {
    const code = source("app/studio/(app)/bugs/_components/BugStats.tsx");
    const categoryBar = code.slice(code.indexOf("function CategoryBar"));
    expect(categoryBar).toContain("background: bg");
  });

  it("no conserva un setter imposible de disparar en InvoiceDrawer", () => {
    const code = source(
      "app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx",
    );
    expect(code).not.toContain("setCreateError");
    expect(code).not.toContain("createError");
  });

  it("remonta Almacén VE desde la query sin efectos de copia", () => {
    const code = source(
      "app/studio/(app)/ve/_components/AlmacenVeClient.tsx",
    );
    expect(code).toContain("key={params.toString()}");
    expect(code).not.toContain("eslint-disable");
    expect(code).not.toContain('setQ(params.get("q")');
  });

  it("captura el contexto del bug una sola vez al abrir el modal", () => {
    const code = source(
      "app/studio/_components/bug-reporter/BugReportModal.tsx",
    );
    expect(code).toContain("const [captureSnapshot] = useState");
    expect(code).not.toContain("setBrowserInfo");
  });
});
