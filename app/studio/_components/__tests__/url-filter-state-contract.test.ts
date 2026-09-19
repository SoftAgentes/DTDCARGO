// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "app/studio/(app)/clientes/_components/ClientsClient.tsx",
  "app/studio/(app)/cotizador/_components/CotizadorClient.tsx",
  "app/studio/(app)/facturacion/_components/FacturacionClient.tsx",
  "app/studio/(app)/crm/_components/KommoClient.tsx",
  "app/studio/(app)/crm/_components/RecoveryTab.tsx",
  "app/studio/(app)/seniat/_components/SeniatClient.tsx",
  "app/studio/(app)/tarifas/_components/TarifasClient.tsx",
] as const;

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("filtros URL", () => {
  it.each(FILES)("no copia query desde efectos ni silencia dependencias en %s", (path) => {
    const code = source(path);
    expect(code).not.toContain("eslint-disable");
    expect(code).toContain("useEffectEvent");
  });

  it.each(FILES.filter((path) => !path.endsWith("RecoveryTab.tsx")))(
    "absorbe navegación por identidad de query en %s",
    (path) => {
      expect(source(path)).toContain("filtersKey !== paramsKey");
    },
  );

  it("fusiona datos convertidos del servidor sin perder optimismo", () => {
    const code = source(
      "app/studio/(app)/crm/_components/KommoClient.tsx",
    );
    expect(code).toContain("{ ...convertedLeads, ...prev }");
  });
});
