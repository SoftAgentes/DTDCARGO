/**
 * SDD-0686 · cifras KPI en tinta. Decisión de Sam (2026-11-21): «Cifras KPI:
 * opción A, cifra en tinta y estado con punto y texto».
 *
 * - `KpiCard` ya no acepta color libre para la cifra: la cifra va siempre en
 *   `--ink` (en la variante destacada, `--ink-side-strong` sobre el navy).
 * - El estado va aparte, bajo la etiqueta: un punto de 7 px del color de estado
 *   y una palabra en `--ink-soft`. En peligro, la palabra va en `--danger-text`
 *   con icono de alerta. Sin estado no hay punto.
 * - Ninguna pantalla vuelve a pasar `valueColor`; las barras «Cobrado» de
 *   Reportes y la cobertura de Dirección van en tinta.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KpiCard } from "../ui/KpiCard";
import { fuentesDe, RAIZ, rel } from "./vino-detector";

afterEach(cleanup);

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/** Archivos que le pasan `valueColor` a un `KpiCard` (en cualquier línea del elemento). */
function conValueColor(fuente: (ruta: string) => string): string[] {
  return ["app/studio", "app/portal", "app/m"]
    .flatMap((b) => {
      try {
        return fuentesDe(join(RAIZ, b), /\.tsx$/);
      } catch {
        return [];
      }
    })
    .filter((ruta) => {
      // El atributo mismo (`valueColor="…"` o `valueColor={…}`): no depende de dónde
      // quede dentro del elemento. `const valueColor =` (Step3Article) no es atributo.
      return /\bvalueColor=["{]/.test(fuente(ruta));
    })
    .map(rel);
}

describe("SDD-0686 · cifras KPI en tinta (Sam, opción A)", () => {
  it("KpiCard no tiene prop de color libre para la cifra", () => {
    const fuente = leer("app/studio/_components/ui/KpiCard.tsx");
    expect(fuente).not.toMatch(/valueColor/);
    expect(fuente).toContain('const valColor = feature ? "var(--ink-side-strong)" : "var(--ink)";');
  });

  it("ninguna pantalla le pasa valueColor a un KpiCard", () => {
    expect(conValueColor((ruta) => readFileSync(ruta, "utf8"))).toEqual([]);
  });

  it("mutante: volver a pasar valueColor semántico se detecta", () => {
    const objetivo = "app/studio/(app)/cobranzas/_components/CobranzasClient.tsx";
    const original = leer(objetivo);
    expect(original).toContain("<KpiCard");
    // Después de una condición con «>», donde una búsqueda por elemento se cortaría.
    const mutado = original.replace(/(status=\{kpis\.vencido > 0 \?[^\n]*\n)/, '$1          valueColor={kpis.vencido > 0 ? "var(--danger)" : "var(--ink)"}\n');
    expect(mutado).not.toBe(original);
    const encontrados = conValueColor((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(encontrados).toEqual([objetivo]);
  });

  it("la cifra va en tinta aunque el KPI tenga estado de peligro", () => {
    render(<KpiCard value="12" label="Vencido" status={{ tono: "danger", texto: "Requiere cobro" }} />);
    expect(screen.getByText("12").getAttribute("style")).toContain("color: var(--ink)");
    const estado = screen.getByText("Requiere cobro");
    expect(estado.getAttribute("data-kpi-estado")).toBe("danger");
    expect(estado.getAttribute("style")).toContain("color: var(--danger-text)");
    // En peligro va el icono de alerta, no el punto.
    expect(estado.querySelector("svg")).not.toBeNull();
  });

  it("un estado de atención lleva punto de 7 px y la palabra en --ink-soft", () => {
    render(<KpiCard value="3" label="Pendientes" status={{ tono: "warning", texto: "Pendiente" }} />);
    const estado = screen.getByText("Pendiente");
    expect(estado.getAttribute("style")).toContain("color: var(--ink-soft)");
    const punto = estado.querySelector("span[aria-hidden]") as HTMLElement;
    expect(punto.style.width).toBe("7px");
    expect(punto.style.background).toBe("var(--warning)");
  });

  it("sin estado no hay punto", () => {
    const { container } = render(<KpiCard value="5" label="Activos" />);
    expect(container.querySelector("[data-kpi-estado]")).toBeNull();
  });

  it("las barras «Cobrado» de Reportes y la cobertura de Dirección van en tinta", () => {
    const reportes = leer("app/studio/(app)/reportes/_components/ReportesClient.tsx");
    expect(reportes).not.toMatch(/height=\{Math\.max\(0, ch\)\} fill="var\(--success\)"/);
    expect(reportes).not.toContain('<LegendDot color="var(--success)" label="Cobrado" />');
    const cobertura = leer("app/studio/(app)/direccion/_components/FinanceHealthCard.tsx");
    expect(cobertura).not.toContain("coverTone");
    expect(cobertura).toContain('{cubre ? "Cubre los pagos" : "No alcanza para los pagos"}');
  });
});
