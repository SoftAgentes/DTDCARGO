import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0603, tramo 4c (Finanzas y compras): los avisos de estas
 * pantallas usan `<Aviso>` (SDD-0628) y no vuelven a pintarse a mano.
 *
 * BD-037: lo que avisa es una franja plana con ícono. Una caja de aviso hecha
 * a mano se reconoce por dos señales en el código fuente:
 *   - un `role="alert"` o `role="note"` literal (el rol lo pone `Aviso`);
 *   - un fondo de estado literal (`background: "var(--danger-bg)"` y sus
 *     hermanos de atención, éxito e información), directo o en un ternario
 *     en la misma línea.
 * Los archivos que conservan una de esas señales por una razón medida están en
 * `EXCEPCIONES`, con su motivo y su cuenta exacta. El detalle está en
 * `docs/specs/0603-claridad-controles/tramo-4c.md`.
 */

const BASE = "app/studio/(app)";

/** Archivos del tramo que deben importar `Aviso`. */
const CONVERTIDOS = [
  "costing/_components/CostEditorDrawer.tsx",
  "costing/_components/TemplateDrawer.tsx",
  "cotizador/[code]/page.tsx",
  "cotizador/_components/QuoteDetailClient.tsx",
  "cotizador/_components/QuoteDrawer.tsx",
  "facturacion/_components/InvoiceDetailClient.tsx",
  "facturacion/_components/InvoiceDrawer.tsx",
  "facturacion/_components/StudioInvoicePaymentReports.tsx",
  "financiero-china/_components/ChargeDrawer.tsx",
  "financiero-china/_components/ChargesTab.tsx",
  "financiero-china/_components/ClaimOffsetDrawer.tsx",
  "financiero-china/_components/ConversionDrawer.tsx",
  "financiero-china/_components/CreditNoteDrawer.tsx",
  "financiero-china/_components/FinancieroChinaClient.tsx",
  "financiero-china/_components/ImportStatementDrawer.tsx",
  "financiero-china/_components/LedgerTab.tsx",
  "financiero-china/_components/PartnerAlertsBanner.tsx",
  "financiero-china/_components/ReconciliationTab.tsx",
  "financiero-china/_components/StatementDetail.tsx",
  "fiscal/_components/FiscalClient.tsx",
  "fiscal/_components/FiscalConfig.tsx",
  "fiscal/_components/WithholdingDrawer.tsx",
  "gastos/_components/GastosClient.tsx",
  "naviera/_components/PlanCargaCard.tsx",
  "naviera/_components/SailingDrawer.tsx",
  "nomina/_components/FiniquitoDetalle.tsx",
  "nomina/_components/RecibosTab.tsx",
  "ordenes-compra/_components/PoDrawer.tsx",
  "ordenes-venta/_components/OvDrawer.tsx",
  "proveedores/_components/OrderSignalDrawer.tsx",
  "proveedores/_components/ProviderLinkDrawer.tsx",
  "proveedores/_components/ServiceRequestDrawer.tsx",
  "proveedores/_components/SupplierClaimDrawer.tsx",
  "proveedores/_components/SupplierDrawer.tsx",
  "rendiciones/_components/EmitDrawer.tsx",
  "rendiciones/_components/VoidDrawer.tsx",
  "reportes/_components/ReportesClient.tsx",
  "seniat/_components/CreateFilingDrawer.tsx",
  "seniat/_components/FilingDetailDrawer.tsx",
  "tarifas/_components/ImportRatesDrawer.tsx",
  "tarifas/_components/RateDrawer.tsx",
  "tesoreria/_components/BillDrawer.tsx",
  "tesoreria/_components/SupplierDrawer.tsx",
] as const;

/** Del tramo, sin aviso que convertir o bloqueados: no importan `Aviso`. */
const SIN_AVISO = [
  "gastos/_components/ExpenseRowActions.tsx",
  "nomina/_components/form-bits.tsx",
  "reportes/_components/BuilderView.tsx",
  "seniat/_components/CustomsFilingsList.tsx",
] as const;

type Cuenta = { roles: number; fondos: number; motivo: string };

/** Señales que quedan a propósito, con su cuenta exacta. */
const EXCEPCIONES: Record<string, Cuenta> = {
  "cotizador/_components/QuoteDrawer.tsx": {
    roles: 0,
    fondos: 1,
    motivo: "pastilla de tarifa sugerida bajo el campo: es lectura, no aviso",
  },
  "fiscal/_components/FiscalClient.tsx": {
    roles: 1,
    fondos: 0,
    motivo: "nota en línea dentro de la fila del badge «Asentado»",
  },
  "fiscal/_components/FiscalConfig.tsx": {
    roles: 1,
    fondos: 0,
    motivo: "nota neutra de permisos, sin color de estado",
  },
  "nomina/_components/form-bits.tsx": {
    roles: 1,
    fondos: 1,
    motivo: "ErrorBox necesita tabIndex={-1} para el foco del diálogo y Aviso no lo acepta",
  },
  "reportes/_components/BuilderView.tsx": {
    roles: 0,
    fondos: 1,
    motivo: "fondo al pasar el cursor por el botón de quitar",
  },
  "seniat/_components/CustomsFilingsList.tsx": {
    roles: 0,
    fondos: 1,
    motivo: "resaltado de una fila con alerta en la lista",
  },
};

const ROL = /role="(?:alert|note)"/g;
/** Fondo de estado en la misma línea que `background:`, directo o en un ternario. */
const FONDO = /background:[^,\n]*"var\(--(?:danger|warning|success|info)-bg\)"/g;
const IMPORTA_AVISO = /import \{ Aviso \} from "@\/app\/studio\/_components\/ui\/Aviso";/;

const leer = (rel: string) => readFileSync(join(process.cwd(), BASE, rel), "utf8");

function contar(fuente: string) {
  return { roles: (fuente.match(ROL) ?? []).length, fondos: (fuente.match(FONDO) ?? []).length };
}

/** Problemas de un archivo del tramo; vacío si cumple. */
function problemas(rel: string, fuente: string, debeImportar: boolean): string[] {
  const out: string[] = [];
  const c = contar(fuente);
  const esperado = EXCEPCIONES[rel] ?? { roles: 0, fondos: 0 };
  if (c.roles !== esperado.roles) out.push(`${rel}: ${c.roles} role alert/note, se esperaban ${esperado.roles}`);
  if (c.fondos !== esperado.fondos) out.push(`${rel}: ${c.fondos} fondos de estado, se esperaban ${esperado.fondos}`);
  if (debeImportar && !IMPORTA_AVISO.test(fuente)) out.push(`${rel}: no importa Aviso`);
  return out;
}

describe("SDD-0603 T4c · avisos de Finanzas y compras en <Aviso>", () => {
  it("cubre los 47 archivos del tramo, sin repetir", () => {
    const todos = [...CONVERTIDOS, ...SIN_AVISO];
    expect(new Set(todos).size).toBe(47);
    for (const rel of Object.keys(EXCEPCIONES)) expect(todos).toContain(rel);
  });

  it("los convertidos importan Aviso y no pintan cajas de aviso a mano", () => {
    const fallas = CONVERTIDOS.flatMap((rel) => problemas(rel, leer(rel), true));
    expect(fallas).toEqual([]);
  });

  it("los que no tienen aviso conservan solo sus excepciones medidas", () => {
    const fallas = SIN_AVISO.flatMap((rel) => problemas(rel, leer(rel), false));
    expect(fallas).toEqual([]);
  });

  describe("mutantes: cada regla rompe si se reintroduce la caja", () => {
    const rel = "proveedores/_components/SupplierDrawer.tsx";
    const fuente = leer(rel);

    it("un <p role=\"alert\"> a mano falla", () => {
      const mutante = fuente.replace("<Aviso tono=\"error\" compacto>", "<p role=\"alert\">");
      expect(mutante).not.toBe(fuente);
      expect(problemas(rel, mutante, true).length).toBeGreaterThan(0);
    });

    it("un fondo de estado literal falla", () => {
      const mutante = `${fuente}\nconst x = { background: "var(--warning-bg)" };`;
      expect(problemas(rel, mutante, true).length).toBeGreaterThan(0);
    });

    it("quitar el import de Aviso falla", () => {
      const mutante = fuente.replace(IMPORTA_AVISO, "");
      expect(mutante).not.toBe(fuente);
      expect(problemas(rel, mutante, true).length).toBeGreaterThan(0);
    });

    it("una excepción que pierde su señal también falla (la cuenta es exacta)", () => {
      const ex = "reportes/_components/BuilderView.tsx";
      const mutante = leer(ex).replace(FONDO, "background: \"transparent\"");
      expect(problemas(ex, mutante, false).length).toBeGreaterThan(0);
    });
  });
});
