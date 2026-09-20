// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const consumers = [
  "app/studio/(app)/_components/StudioSidebar.tsx",
  "app/portal/(app)/compras/nueva/SupplierPicker.tsx",
  "app/studio/(app)/admin/_components/calculator/ParametrosPanel.tsx",
  "app/studio/(app)/conversaciones/_components/ConversacionesClient.tsx",
  "app/studio/(app)/marketing/noticias-web/_components/CategoryDetector.tsx",
  "app/studio/(app)/tms/_components/RouteDrawer.tsx",
  "app/studio/_components/wiring/ProfileModal.tsx",
  "components/EstimadoModal.tsx",
];

describe("reconciliación de estado por frontera", () => {
  it.each(consumers)("difiere y cancela la reconciliación en %s", (path) => {
    const code = source(path);
    expect(code).toContain("queueMicrotask");
    expect(code).toContain("cancelled = true");
  });

  it("mantiene el debounce remoto separado de la limpieza local", () => {
    const code = source(consumers[4]);
    expect(code).toContain("window.setTimeout");
    expect(code).toContain("detectCategory(trimmed, tipo)");
  });
});
