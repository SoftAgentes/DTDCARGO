import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("entradas estables y render puro", () => {
  it("memoiza posición, carga y formulario efectivo", () => {
    expect(source("app/m/erp/_components/MobileErpClient.tsx")).toContain(
      "const effectivePos = useMemo",
    );
    expect(source("app/studio/(app)/naviera/_components/AssignCargoDrawer.tsx")).toContain(
      "const incoming = useMemo",
    );
    const calculator = source("components/CalculadoraForm.tsx");
    expect(calculator).toContain("const cityList = useMemo");
    expect(calculator).toContain("const effectiveForm = useMemo");
  });

  it("calcula saldos y arcos sin acumuladores mutables", () => {
    const ledger = source("app/studio/(app)/financiero-china/_components/LedgerTab.tsx");
    const charts = source("app/studio/(app)/reportes/_components/charts.tsx");
    expect(ledger).toContain("asc.reduce");
    expect(ledger).not.toContain("runUsd +=");
    expect(charts).toContain("const slices = data.map");
    expect(charts).not.toContain("acc +=");
  });

  it("usa Image para la previsualización POD", () => {
    const code = source("app/m/ve/camionero/_components/PodModal.tsx");
    expect(code).toContain('import Image from "next/image"');
    expect(code).toContain("unoptimized");
    expect(code).not.toContain("<img");
  });
});
