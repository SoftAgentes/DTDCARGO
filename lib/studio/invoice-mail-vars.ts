/**
 * SDD-0305 · Las variables del correo «Factura emitida».
 *
 * Capa pura, separada de la server action a propósito: lo que puede mentirle a
 * un cliente son los **valores** —un monto mal formateado, una tasa que no
 * corresponde, un dato inventado donde falta uno—, y eso se prueba sin base de
 * datos ni render. Mismo reparto que `construirFilas` / `calcularTotales` en el
 * PDF de la factura.
 *
 * Los nombres de las claves NO son libres: tienen que coincidir con los
 * `{{snake_case}}` que el equipo escribe en las plantillas de Studio › Mailing.
 * El vocabulario vive en `lib/studio/mail-sample-vars.ts`, que es lo que ve el
 * editor al previsualizar.
 */

/** Lo que la factura emitida sabe de sí misma, ya leído de la base. */
export type FacturaParaCorreo = {
  invoice_code: string;
  client_name: string | null;
  client_markbox: string;
  shipment_code: string | null;
  currency: string;
  fx_rate: number | null;
  total_amount: number;
  due_date: string | null;
};

/** Guion largo: lo que se imprime donde no hay dato. Nunca un valor inventado. */
const SIN_DATO = "—";

/** Monto con dos decimales y sin separador de miles. */
function monto(v: number | null | undefined): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/**
 * Arma las variables del evento `invoice_emitted`.
 *
 * `issueDate` y `dueDate` se pasan resueltos por el llamador porque los decide
 * la emisión (hoy, y el vencimiento a 30 días si no había uno) — no la factura.
 *
 * 🔴 `total_ves` y `bcv_rate` **sólo salen si la factura es en bolívares**. Si
 * fueran siempre, una plantilla que los use imprimiría la cifra en dólares
 * rotulada como bolívares: el cliente pagaría lo que no es.
 */
export function varsDeFacturaEmitida(
  inv: FacturaParaCorreo,
  issueDate: string,
  dueDate: string,
): Record<string, string> {
  const base: Record<string, string> = {
    customer_name: (inv.client_name ?? "").trim() || "cliente",
    invoice_code: inv.invoice_code,
    markbox: inv.client_markbox,
    shipment_code: (inv.shipment_code ?? "").trim() || SIN_DATO,
    issue_date: issueDate,
    due_date: dueDate,
    total_usd: monto(inv.total_amount),
  };

  if (inv.currency === "VES") {
    base.total_ves = monto(inv.total_amount);
    base.bcv_rate = inv.fx_rate != null ? String(inv.fx_rate) : SIN_DATO;
  }

  return base;
}
