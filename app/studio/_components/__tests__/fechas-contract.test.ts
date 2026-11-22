import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: recorre `app/studio` entero (como `dark-theme-contrast-contract`).
 */
vi.setConfig({ testTimeout: 120_000 });

/**
 * Contrato del estándar de fechas del Studio (SDD-0660).
 *
 * Todo campo de fecha del Studio es `<DateField>`
 * (`app/studio/_components/ui/DateField.tsx`): formato `dd/mm/aaaa` en gris de
 * fondo, números seguidos, T / + / − y calendario con Alt+↓. Los campos nativos
 * `type="date"`, `type="month"` y `type="datetime-local"` se ven distinto en cada
 * navegador (el de mes pinta «---------- de ----» en Chrome) y quedan prohibidos.
 *
 * La migración va por tandas (spec, «Plan por tandas»). Lo que falta está
 * CONGELADO en `PENDIENTES`, con su cuenta exacta:
 *   - un archivo nuevo con un campo nativo → rojo;
 *   - un archivo de la lista que SUMA campos → rojo;
 *   - un archivo migrado (cuenta menor) que sigue en la lista → rojo: bájale la
 *     cuenta o bórralo de la lista, así la lista nunca miente.
 *
 * `campos` = `type="date|month|datetime-local"` (también `type={"date"}`).
 * `tipo` = una propiedad que declara esos tipos (`type?: "text" | "date"`): es un
 * componente genérico que termina pintando el campo nativo.
 */

type Cuenta = { campos: number; tipo: number };

/** Lista congelada al 2026-11-18 (tanda 1). Solo puede bajar. */
const PENDIENTES: Record<string, Cuenta> = {
  "(app)/academia/_components/CohortDrawer.tsx": { campos: 1, tipo: 0 },
  // Componente genérico de filtros: tanda 4.
  "(app)/admin/_components/AuditLogSection.tsx": { campos: 2, tipo: 1 },
  "(app)/admin/_components/CalendarEventDrawer.tsx": { campos: 2, tipo: 0 },
  "(app)/admin/_components/ExchangeRatesSection.tsx": { campos: 1, tipo: 0 },
  // Bitácora: la toca otra rama a la vez (ajustes de pantalla del 2026-11-18); va en la tanda 2.
  "(app)/bitacora/nueva/_components/ActaReview.tsx": { campos: 1, tipo: 0 },
  "(app)/bitacora/_components/TaskDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/club/_components/ClubEventDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/club/_components/GroupBuyDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/cn/_components/NewReceiptDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/cobranzas/_components/CobranzaDrawer.tsx": { campos: 2, tipo: 0 },
  "(app)/cobranzas/_components/UnidentifiedPaymentDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/contabilidad/_components/AssetDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/contabilidad/_components/ClosingDateDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/contabilidad/_components/EntryDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/contabilidad/_components/LibroDiarioTab.tsx": { campos: 2, tipo: 0 },
  "(app)/cotizador/_components/QuoteDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/crm/_components/LeadDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/crm/_components/TarjetaFichaDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/despacho/reglas/_components/RulesClient.tsx": { campos: 1, tipo: 0 },
  "(app)/facturacion/_components/InvoiceDetailClient.tsx": { campos: 1, tipo: 0 },
  "(app)/facturacion/_components/InvoiceDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/financiero-china/_components/ChargeDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/financiero-china/_components/ClaimOffsetDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/financiero-china/_components/ConversionDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/financiero-china/_components/CreditNoteDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/financiero-china/_components/ImportStatementDrawer.tsx": { campos: 1, tipo: 0 },
  // Componente genérico del constructor de inspecciones: tanda 4.
  "(app)/inspecciones/_components/builder-fields.tsx": { campos: 0, tipo: 1 },
  // Fecha y hora (datetime-local): tanda 3.
  "(app)/mailing/_components/ComposeView.tsx": { campos: 1, tipo: 0 },
  "(app)/naviera/_components/SailingDrawer.tsx": { campos: 3, tipo: 0 },
  // Solo lectura en edición: `<DateField>` todavía no tiene `readOnly`.
  "(app)/nomina/_components/AsistenciaDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/ordenes-compra/_components/PoDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/proveedores/_components/OrderSignalDrawer.tsx": { campos: 2, tipo: 0 },
  "(app)/tesoreria/_components/BillDrawer.tsx": { campos: 3, tipo: 0 },
  "(app)/tms/_components/DriverDrawer.tsx": { campos: 1, tipo: 0 },
  // Fecha y hora (datetime-local): tanda 3.
  "(app)/tms/_components/RouteDrawer.tsx": { campos: 1, tipo: 0 },
  "(app)/tms/_components/TruckDrawer.tsx": { campos: 1, tipo: 0 },
  // Fecha y hora (datetime-local): tanda 3.
  "(app)/tracking/[id]/_components/ShipmentPlanPanel.tsx": { campos: 1, tipo: 0 },
  "(app)/tracking/[id]/_components/TimelinePanel.tsx": { campos: 1, tipo: 0 },
  "(app)/usuarios/_components/acceso/CambiosPendientes.tsx": { campos: 1, tipo: 0 },
  "(app)/usuarios/_components/acceso/DobleAvisoDialog.tsx": { campos: 1, tipo: 0 },
};

const RAIZ = "app/studio";

const CAMPO = /type\s*=\s*(?:\{\s*)?["'`](?:date|month|datetime-local)["'`]/g;
const TIPO = /type\??\s*:[^;\n=]*["'](?:date|month|datetime-local)["']/g;

function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function contar(texto: string): Cuenta {
  const codigo = sinComentarios(texto);
  return {
    campos: codigo.match(CAMPO)?.length ?? 0,
    tipo: codigo.match(TIPO)?.length ?? 0,
  };
}

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) fuentes(rel, acc);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) acc.push(rel);
  }
  return acc;
}

describe("estándar de fechas del Studio · SDD-0660", () => {
  it("el patrón reconoce las formas de escribir un campo nativo (y no otras)", () => {
    expect(contar('<input type="date" />').campos).toBe(1);
    expect(contar("<input type='month' />").campos).toBe(1);
    expect(contar('<input type={"datetime-local"} />').campos).toBe(1);
    expect(contar('<input\n  type="date"\n/>').campos).toBe(1);
    expect(contar('type?: "text" | "date";').tipo).toBe(1);
    expect(contar('<DateField mode="month" />')).toEqual({ campos: 0, tipo: 0 });
    expect(contar('<input type="text" />')).toEqual({ campos: 0, tipo: 0 });
    expect(contar('/* <input type="date"> */\n// type="month"')).toEqual({ campos: 0, tipo: 0 });
  });

  it("ningún campo nativo de fecha fuera de la lista congelada, y la lista solo baja", () => {
    const encontrados = new Map<string, Cuenta>();
    for (const archivo of fuentes(RAIZ)) {
      const cuenta = contar(readFileSync(join(process.cwd(), archivo), "utf8"));
      if (cuenta.campos || cuenta.tipo) encontrados.set(archivo.slice(RAIZ.length + 1), cuenta);
    }

    const nuevos: string[] = [];
    const crecieron: string[] = [];
    for (const [archivo, cuenta] of encontrados) {
      const permitido = PENDIENTES[archivo];
      if (!permitido) {
        nuevos.push(`${archivo} → usa <DateField> (app/studio/_components/ui/DateField.tsx)`);
      } else if (cuenta.campos > permitido.campos || cuenta.tipo > permitido.tipo) {
        crecieron.push(`${archivo}: ${JSON.stringify(cuenta)} > ${JSON.stringify(permitido)}`);
      }
    }
    const desactualizados = Object.entries(PENDIENTES)
      .filter(([archivo, permitido]) => {
        const real = encontrados.get(archivo) ?? { campos: 0, tipo: 0 };
        return real.campos < permitido.campos || real.tipo < permitido.tipo;
      })
      .map(([archivo]) => `${archivo}: ya bajó; actualiza o borra su línea en PENDIENTES`);

    expect({ nuevos, crecieron, desactualizados }).toEqual({
      nuevos: [],
      crecieron: [],
      desactualizados: [],
    });
  });

  it("Conversaciones (lo que vio Sam) usa el campo de mes del estándar", () => {
    const panel = readFileSync(
      join(process.cwd(), "app/studio/(app)/conversaciones/_components/GenerateDigestsPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/<DateField\s+mode="month"\s+name="month"/);
    expect(contar(panel)).toEqual({ campos: 0, tipo: 0 });
  });
});
