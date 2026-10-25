/**
 * SDD-0557 · «Cashflow» pasa a llamarse «Facturado contra cobrado».
 *
 * No era un flujo de caja: es facturado contra cobrado (SDD-0052; el Norte lo
 * rotula así). El slug `?rep=cashflow` se conserva para no romper enlaces.
 *
 * Dos capas: el rótulo de la pestaña (dato exportado) y un contrato sobre el
 * AST de ReportesClient: ningún TEXTO que se pinte (string, template o texto
 * JSX) dice «Cashflow»; la única cadena que puede nombrarlo es el slug exacto.
 * Los comentarios y los identificadores (`CashflowView`) no cuentan.
 *
 * El «Facturado» de esta vista es el total CON IVA (se compara con lo cobrado):
 * el KPI, la leyenda y la nota lo dicen, para no confundirlo con la cifra
 * oficial sin IVA del Estado de resultados. Se prueba por texto, pintando la
 * vista.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { buildViewCsv } from "@/lib/studio/reports/export-csv";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CashflowView, TABS_BY_CATEGORY } from "../_components/ReportesClient";

const ARCHIVO = join(process.cwd(), "app", "studio", "(app)", "reportes", "_components", "ReportesClient.tsx");

/** Textos que se pintan y nombran «cashflow» en cualquier caja. */
function textosConCashflow(source: string): string[] {
  const ast = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const hallados: string[] = [];
  const visitar = (n: ts.Node) => {
    let texto: string | null = null;
    if (ts.isStringLiteralLike(n)) texto = n.text;
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) texto = n.text;
    else if (ts.isJsxText(n)) texto = n.text;
    if (texto !== null && /cashflow/i.test(texto)) hallados.push(texto);
    ts.forEachChild(n, visitar);
  };
  visitar(ast);
  return hallados;
}

describe("Facturado contra cobrado", () => {
  it("la pestaña contable se rotula así y conserva el slug cashflow", () => {
    expect(TABS_BY_CATEGORY.con).toContainEqual({ value: "cashflow", label: "Facturado contra cobrado" });
  });

  it("ninguna pestaña de ninguna categoría se rotula «Cashflow»", () => {
    const rotulos = Object.values(TABS_BY_CATEGORY).flat().map((t) => t.label);
    expect(rotulos.filter((l) => /cashflow/i.test(l))).toEqual([]);
  });

  it("ningún texto de ReportesClient dice «Cashflow»: solo el slug exacto", () => {
    const hallados = textosConCashflow(readFileSync(ARCHIVO, "utf8"));
    expect(hallados.length).toBeGreaterThan(0); // el slug sigue ahí
    expect(hallados.filter((t) => t !== "cashflow")).toEqual([]);
  });

  it("el detector ve atributos, texto JSX y templates, y no mira comentarios", () => {
    expect(
      textosConCashflow(`// Cashflow en un comentario
        const a = <Empty eyebrow="Cashflow" />;
        const b = <p>Cashflow mensual</p>;
        const c = \`ver \${x} Cashflow\`;
        const d = "cashflow";`),
    ).toEqual(["Cashflow", "Cashflow mensual", " Cashflow", "cashflow"]);
  });

  it("el facturado va «con IVA» en el KPI, la leyenda y la nota", () => {
    render(
      createElement(CashflowView, {
        cashflow: {
          series: [{ month: "2025-03", label: "MAR 25", billed: 1160, collected: 500 }],
          totalBilled: 1160,
          totalCollected: 500,
          outstanding: 660,
          overdue: 0,
        },
      }),
    );
    // KPI y leyenda: el mismo rótulo, dos veces.
    expect(screen.getAllByText("Facturado con IVA")).toHaveLength(2);
    expect(screen.queryByText("Facturado")).toBeNull();
    expect(screen.getByTestId("facturado-cobrado-nota")).toHaveTextContent(
      /^Facturado con IVA y cobrado del período se normalizan a USD/,
    );
    expect(screen.getByTestId("facturado-cobrado-nota")).toHaveTextContent(/el ingreso sin IVA está en el Estado de resultados/);
    expect(screen.getByRole("img", { name: "Facturado con IVA contra cobrado por mes" })).toBeInTheDocument();
  });

  it("el CSV de la vista se llama facturado-contra-cobrado", () => {
    const csv = buildViewCsv({
      category: "con",
      rep: "cashflow",
      cashflow: { series: [], totalBilled: 1, totalCollected: 0, outstanding: 0, overdue: 0 },
      today: new Date("2025-03-18T12:00:00Z"),
    });
    expect(csv!.filename).toBe("reporte-contable-facturado-contra-cobrado-2025-03-18.csv");
  });
});
