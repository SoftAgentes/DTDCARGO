import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const consumers = [
  "app/studio/(app)/_components/StudioSidebar.tsx",
  "app/studio/(app)/ordenes-compra/_components/OrdenesCompraClient.tsx",
  "app/studio/(app)/proveedores/_components/ProveedoresClient.tsx",
  "app/studio/(app)/reportes/_components/BuilderView.tsx",
  "app/studio/_components/bug-reporter/BugFABButton.tsx",
  "app/studio/_components/ui/SplitActionButton.tsx",
  "app/studio/_components/ui/columns/ColumnConfig.tsx",
  "app/studio/_components/wiring/WiringProvider.tsx",
];

describe("hidratación de preferencias del navegador", () => {
  it.each(consumers)("cancela la lectura diferida en %s", (path) => {
    const code = source(path);
    expect(code).toContain("queueMicrotask");
    expect(code).toContain("cancelled = true");
  });

  it("declara los padres del sidebar antes de hidratarlos", () => {
    const code = source(consumers[0]);
    expect(code.indexOf("const [openParents")).toBeLessThan(
      code.indexOf("localStorage.getItem(PARENTS_KEY)"),
    );
  });
});
