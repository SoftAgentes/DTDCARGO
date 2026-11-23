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
import { KpiCard, KpiEstado } from "../ui/KpiCard";
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

/** Bloques `style={{ … }}` de una fuente, con llaves balanceadas, y su línea. */
function bloquesDeEstilo(src: string): { linea: number; txt: string }[] {
  const out: { linea: number; txt: string }[] = [];
  let i = 0;
  while ((i = src.indexOf("style={{", i)) !== -1) {
    let prof = 0;
    let j = i + 7;
    for (; j < src.length; j++) {
      if (src[j] === "{") prof++;
      else if (src[j] === "}" && --prof === 0) break;
    }
    out.push({ linea: src.slice(0, i).split("\n").length, txt: src.slice(i, j + 1) });
    i = j;
  }
  return out;
}

const FUENTE_GRANDE = /font:\s*["`](?:800|900)\s+(?:(\d+(?:\.\d+)?)px|var\(--kpi-fs\))/;
const COLOR_DE_ESTADO = /var\(--(?:success|warning|danger|info)\b/;

/**
 * Excepciones por ruta, con cuenta exacta: el check de un paso cumplido, un
 * círculo verde con icono que no es una cifra. Se excluye por ruta y no por forma
 * (nota N1 de la revisión de la #748): con `borderRadius: "50%"` una cifra puesta
 * en un círculo se colaría.
 */
const CIRCULOS_CON_ICONO: Record<string, number> = {
  "app/studio/_components/wiring/OAuthFlowModal.tsx": 1,
  "app/m/ve/camionero/_components/PodModal.tsx": 1,
};

/**
 * Cifras destacadas fuera de KpiCard (peso 800/900 y 18 px o más) cuyo `color`
 * lleva un color de estado (H1 y N2 de la revisión de la #748). La cifra va en
 * tinta y el estado aparte con `KpiEstado`.
 */
function cifrasGrandesConEstado(fuente: (ruta: string) => string): string[] {
  const hallados = cifrasGrandesConEstadoSinExcepciones(fuente);
  const porArchivo = new Map<string, number>();
  for (const h of hallados) {
    const ruta = h.replace(/:\d+$/, "");
    porArchivo.set(ruta, (porArchivo.get(ruta) ?? 0) + 1);
  }
  // Una excepción vale solo con su cuenta exacta: una cifra nueva en el mismo archivo rompe.
  return hallados.filter((h) => {
    const ruta = h.replace(/:\d+$/, "");
    return porArchivo.get(ruta) !== CIRCULOS_CON_ICONO[ruta];
  });
}

function cifrasGrandesConEstadoSinExcepciones(fuente: (ruta: string) => string): string[] {
  return ["app/studio", "app/portal", "app/m"]
    .flatMap((b) => {
      try {
        return fuentesDe(join(RAIZ, b), /\.tsx$/);
      } catch {
        return [];
      }
    })
    .filter((ruta) => !/\.test\.tsx$/.test(ruta))
    .flatMap((ruta) =>
      bloquesDeEstilo(fuente(ruta))
        .filter(({ txt }) => {
          const m = FUENTE_GRANDE.exec(txt);
          if (!m || (m[1] && Number(m[1]) < 18)) return false;
          const color = /\bcolor:([\s\S]*?)(?:,\s*\n|\n\s*\}\})/.exec(txt)?.[1] ?? "";
          return COLOR_DE_ESTADO.test(color);
        })
        .map(({ linea }) => `${rel(ruta)}:${linea}`),
    );
}

describe("SDD-0686 · cifras KPI en tinta (Sam, opción A)", () => {
  it("ninguna cifra destacada fuera de KpiCard lleva color de estado", () => {
    expect(cifrasGrandesConEstado((ruta) => readFileSync(ruta, "utf8"))).toEqual([]);
  });

  // SDD-0680 (adenda del 2026-11-23): el estado del chat del portal dejó de tener cifras grandes
  // (pasó a una pastilla en la fila con un detalle de 14 px); su caso salió de esta lista.
  it.each([
    [
      "app/studio/(app)/facturacion/[code]/page.tsx",
      'font: "900 42px/1 var(--f-display)",\n                color: "var(--ink-side-strong)",\n                letterSpacing: "-0.02em",\n                marginTop: 8,\n              }}\n            >\n              ${fmt(balance)}',
      'font: "900 42px/1 var(--f-display)",\n                color: balance > 0 ? "var(--ink-side-strong)" : "var(--success)",\n                letterSpacing: "-0.02em",\n                marginTop: 8,\n              }}\n            >\n              ${fmt(balance)}',
    ],
  ])("mutante: una cifra destacada en color de estado se detecta (%s)", (objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original.split(de).length - 1).toBe(1);
    const mutado = original.replace(de, a);
    const encontrados = cifrasGrandesConEstado((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0]).toMatch(new RegExp(`^${objetivo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\d+$`));
  });

  it("mutante N2: el «Vencido» de 18 px de Reportes en rojo se detecta", () => {
    const objetivo = "app/studio/(app)/reportes/_components/ReportesClient.tsx";
    const de = 'font: "800 18px/1 var(--f-mono)",\n                  color: "var(--ink)",';
    const original = leer(objetivo);
    expect(original.split(de).length - 1).toBe(1);
    const mutado = original.replace(de, 'font: "800 18px/1 var(--f-mono)",\n                  color: side.overdue > 0 ? "var(--danger)" : "var(--ink-soft)",');
    const encontrados = cifrasGrandesConEstado((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].startsWith(`${objetivo}:`)).toBe(true);
  });

  it("mutante N1: una cifra en círculo dentro de un archivo exceptuado se detecta (la excepción es por cuenta)", () => {
    const objetivo = "app/studio/_components/wiring/OAuthFlowModal.tsx";
    const original = leer(objetivo);
    // Las excepciones son exactamente las de la lista: el check de cada archivo.
    expect(cifrasGrandesConEstadoSinExcepciones((ruta) => readFileSync(ruta, "utf8")).map((h) => h.replace(/:\d+$/, "")).sort()).toEqual(
      Object.keys(CIRCULOS_CON_ICONO).sort(),
    );
    const cifra = '\n<div style={{\n  borderRadius: "50%",\n  font: "900 24px/1 var(--f-display)",\n  color: "var(--danger)",\n}}>3</div>\n';
    const mutado = original + cifra;
    const encontrados = cifrasGrandesConEstado((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(encontrados.every((h) => h.startsWith(`${objetivo}:`))).toBe(true);
    expect(encontrados).toHaveLength(2);
  });

  it("el saldo de la factura dice «Saldo a favor» si es negativo y «Pagada» si es cero", () => {
    const pagina = leer("app/studio/(app)/facturacion/[code]/page.tsx");
    expect(pagina).toContain('texto: balance < 0 ? "Saldo a favor" : "Pagada"');
    expect(pagina).toContain("{balance <= 0 && (");
  });

  it("KpiEstado sobre el navy usa --ink-side y el rojo para fondo oscuro", () => {
    render(
      <>
        <KpiEstado status={{ tono: "success", texto: "Pagada" }} sobreOscuro />
        <KpiEstado status={{ tono: "danger", texto: "Requiere acción" }} sobreOscuro />
      </>,
    );
    expect(screen.getByText("Pagada").getAttribute("style")).toContain("color: var(--ink-side)");
    expect(screen.getByText("Requiere acción").getAttribute("style")).toContain("color: var(--color-status-danger-on-dark)");
  });

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
