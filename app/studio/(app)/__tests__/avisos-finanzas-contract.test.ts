import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0603, tramo 4c (Finanzas y compras): los avisos de estas
 * pantallas usan `<Aviso>` (SDD-0628) y no vuelven a pintarse a mano.
 *
 * BD-037: lo que avisa es una franja plana con ícono. Por archivo se cuentan,
 * con cuenta exacta:
 *   - los `<Aviso` (los convertidos no pueden volver a una caja propia);
 *   - los `role="alert"` o `role="note"` literales (el rol lo pone `Aviso`);
 *   - los fondos de estado (`background` o `backgroundColor` con
 *     `var(--danger-bg)` y sus hermanos), directos o en un ternario en la
 *     misma línea;
 *   - los bordes de estado (`border*`, `borderColor` u `outline` con
 *     `var(--danger)` y sus hermanos).
 * Lo que queda a propósito está en `EXCEPCIONES`, con su motivo. El detalle
 * está en `docs/specs/0603-claridad-controles/tramo-4c.md`.
 */

const BASE = "app/studio/(app)";

/** Archivo del tramo → cuántos `<Aviso` lleva. 0 = sin aviso que convertir o bloqueado. */
const AVISOS: Record<string, number> = {
  "costing/_components/CostEditorDrawer.tsx": 2,
  "costing/_components/TemplateDrawer.tsx": 1,
  "cotizador/[code]/page.tsx": 1,
  "cotizador/_components/QuoteDetailClient.tsx": 2,
  "cotizador/_components/QuoteDrawer.tsx": 1,
  "facturacion/_components/InvoiceDetailClient.tsx": 4,
  "facturacion/_components/InvoiceDrawer.tsx": 1,
  "facturacion/_components/StudioInvoicePaymentReports.tsx": 2,
  "financiero-china/_components/ChargeDrawer.tsx": 1,
  "financiero-china/_components/ChargesTab.tsx": 1,
  "financiero-china/_components/ClaimOffsetDrawer.tsx": 1,
  "financiero-china/_components/ConversionDrawer.tsx": 1,
  "financiero-china/_components/CreditNoteDrawer.tsx": 1,
  "financiero-china/_components/FinancieroChinaClient.tsx": 1,
  "financiero-china/_components/ImportStatementDrawer.tsx": 1,
  "financiero-china/_components/LedgerTab.tsx": 1,
  "financiero-china/_components/PartnerAlertsBanner.tsx": 1,
  "financiero-china/_components/ReconciliationTab.tsx": 1,
  "financiero-china/_components/StatementDetail.tsx": 1,
  "fiscal/_components/FiscalClient.tsx": 1,
  "fiscal/_components/FiscalConfig.tsx": 1,
  "fiscal/_components/WithholdingDrawer.tsx": 1,
  "gastos/_components/ExpenseRowActions.tsx": 0,
  "gastos/_components/GastosClient.tsx": 1,
  "naviera/_components/PlanCargaCard.tsx": 2,
  "naviera/_components/SailingDrawer.tsx": 1,
  "nomina/_components/FiniquitoDetalle.tsx": 3,
  "nomina/_components/RecibosTab.tsx": 2,
  "nomina/_components/form-bits.tsx": 0,
  "ordenes-compra/_components/PoDrawer.tsx": 2,
  "ordenes-venta/_components/OvDrawer.tsx": 2,
  "proveedores/_components/OrderSignalDrawer.tsx": 1,
  "proveedores/_components/ProviderLinkDrawer.tsx": 1,
  "proveedores/_components/ServiceRequestDrawer.tsx": 1,
  "proveedores/_components/SupplierClaimDrawer.tsx": 1,
  "proveedores/_components/SupplierDrawer.tsx": 2,
  "rendiciones/_components/EmitDrawer.tsx": 1,
  "rendiciones/_components/VoidDrawer.tsx": 1,
  "reportes/_components/BuilderView.tsx": 0,
  "reportes/_components/ReportesClient.tsx": 1,
  "seniat/_components/CreateFilingDrawer.tsx": 2,
  "seniat/_components/CustomsFilingsList.tsx": 0,
  "seniat/_components/FilingDetailDrawer.tsx": 2,
  "tarifas/_components/ImportRatesDrawer.tsx": 3,
  "tarifas/_components/RateDrawer.tsx": 2,
  "tesoreria/_components/BillDrawer.tsx": 2,
  "tesoreria/_components/SupplierDrawer.tsx": 1,
};

type Senales = { roles: number; fondos: number; bordes: number };
type Excepcion = Partial<Senales> & { motivo: string };

/** Señales que quedan a propósito. Lo no listado vale 0. */
const EXCEPCIONES: Record<string, Excepcion> = {
  "costing/_components/TemplateDrawer.tsx": {
    bordes: 1,
    motivo: "contorno del botón destructivo «Eliminar»",
  },
  "cotizador/_components/QuoteDrawer.tsx": {
    fondos: 1,
    bordes: 1,
    motivo: "pastilla de tarifa sugerida bajo el campo: es lectura, no aviso",
  },
  "fiscal/_components/FiscalClient.tsx": {
    roles: 1,
    motivo: "nota en línea dentro de la fila del badge «Asentado»",
  },
  "fiscal/_components/FiscalConfig.tsx": {
    roles: 1,
    motivo: "nota neutra de permisos, sin color de estado",
  },
  "nomina/_components/form-bits.tsx": {
    roles: 1,
    fondos: 1,
    bordes: 1,
    motivo: "ErrorBox necesita tabIndex={-1} para el foco del diálogo y Aviso no lo acepta",
  },
  "proveedores/_components/ProviderLinkDrawer.tsx": {
    bordes: 1,
    motivo: "contorno del botón destructivo «Desactivar link»",
  },
  "reportes/_components/BuilderView.tsx": {
    fondos: 1,
    motivo: "fondo al pasar el cursor por el botón de quitar",
  },
  "seniat/_components/FilingDetailDrawer.tsx": {
    bordes: 1,
    motivo: "contorno de la casilla de un paso hecho en la lista de tareas",
  },
  "seniat/_components/CustomsFilingsList.tsx": {
    fondos: 1,
    motivo: "resaltado de una fila con alerta en la lista",
  },
};

const ESTADO = "(?:danger|warning|success|info)";
const AVISO = /<Aviso\b/g;
const ROL = /role="(?:alert|note)"/g;
const FONDO = new RegExp(`background(?:Color)?:[^,\\n]*"var\\(--${ESTADO}-bg\\)"`, "g");
const BORDE = new RegExp(`(?:border(?:Left|Top|Right|Bottom|Color)?|outline):[^,\\n]*var\\(--${ESTADO}\\)`, "g");
const IMPORTA_AVISO = /import \{ Aviso \} from "@\/app\/studio\/_components\/ui\/Aviso";/;

const leer = (rel: string) => readFileSync(join(process.cwd(), BASE, rel), "utf8");
const cuenta = (fuente: string, re: RegExp) => (fuente.match(re) ?? []).length;

/** Problemas de un archivo del tramo; vacío si cumple. */
function problemas(rel: string, fuente: string): string[] {
  const out: string[] = [];
  const avisos = AVISOS[rel];
  const ex = EXCEPCIONES[rel] ?? { motivo: "" };
  const medido = { avisos: cuenta(fuente, AVISO), roles: cuenta(fuente, ROL), fondos: cuenta(fuente, FONDO), bordes: cuenta(fuente, BORDE) };
  const esperado = { avisos, roles: ex.roles ?? 0, fondos: ex.fondos ?? 0, bordes: ex.bordes ?? 0 };
  for (const k of Object.keys(esperado) as (keyof typeof esperado)[]) {
    if (medido[k] !== esperado[k]) out.push(`${rel}: ${medido[k]} ${k}, se esperaban ${esperado[k]}`);
  }
  if (avisos > 0 && !IMPORTA_AVISO.test(fuente)) out.push(`${rel}: no importa Aviso`);
  return out;
}

describe("SDD-0603 T4c · avisos de Finanzas y compras en <Aviso>", () => {
  it("cubre los 47 archivos del tramo, con 43 convertidos y 62 avisos", () => {
    const archivos = Object.keys(AVISOS);
    expect(archivos).toHaveLength(47);
    expect(archivos.filter((rel) => AVISOS[rel] > 0)).toHaveLength(43);
    expect(Object.values(AVISOS).reduce((s, n) => s + n, 0)).toBe(62);
    for (const rel of Object.keys(EXCEPCIONES)) expect(archivos).toContain(rel);
  });

  it("cada archivo tiene su cuenta exacta de avisos y solo las señales medidas", () => {
    const fallas = Object.keys(AVISOS).flatMap((rel) => problemas(rel, leer(rel)));
    expect(fallas).toEqual([]);
  });

  describe("mutantes: cada regla rompe si se reintroduce la caja", () => {
    const rel = "proveedores/_components/SupplierClaimDrawer.tsx";
    const fuente = leer(rel);

    it("cambiar un <Aviso> por un <p> falla aunque no lleve rol", () => {
      const mutante = fuente.replace("<Aviso tono=\"error\" compacto>", "<p>").replace("</Aviso>", "</p>");
      expect(mutante).not.toBe(fuente);
      expect(problemas(rel, mutante).length).toBeGreaterThan(0);
    });

    it("un <p role=\"alert\"> a mano falla", () => {
      const mutante = fuente.replace("<Aviso tono=\"error\" compacto>", "<p role=\"alert\">");
      expect(mutante).not.toBe(fuente);
      expect(problemas(rel, mutante).length).toBeGreaterThan(0);
    });

    it("un fondo de estado literal falla, también como backgroundColor", () => {
      expect(problemas(rel, `${fuente}\nconst x = { background: "var(--warning-bg)" };`).length).toBeGreaterThan(0);
      expect(problemas(rel, `${fuente}\nconst x = { backgroundColor: "var(--info-bg)" };`).length).toBeGreaterThan(0);
    });

    it("un borde de estado literal falla", () => {
      const mutante = `${fuente}\nconst x = { border: "1px solid var(--danger)" };`;
      expect(problemas(rel, mutante).length).toBeGreaterThan(0);
    });

    it("quitar el import de Aviso falla", () => {
      const mutante = fuente.replace(IMPORTA_AVISO, "");
      expect(mutante).not.toBe(fuente);
      expect(problemas(rel, mutante).length).toBeGreaterThan(0);
    });

    it("una excepción que pierde su señal también falla (la cuenta es exacta)", () => {
      const ex = "reportes/_components/BuilderView.tsx";
      const mutante = leer(ex).replace(FONDO, "background: \"transparent\"");
      expect(problemas(ex, mutante).length).toBeGreaterThan(0);
    });
  });
});
