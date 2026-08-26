/**
 * SDD-0306 · A quién se le manda el recordatorio de cobranza, y a quién NO.
 *
 * Capa pura: recibe la cola de cuentas por cobrar y devuelve **dos listas** —
 * a quién escribirle y a quién no, **con el motivo**. Ninguna consulta, ningún
 * envío.
 *
 * ## Por qué devuelve los omitidos, y no sólo los elegidos
 *
 * Un filtro silencioso es lo que hace que nadie confíe en la herramienta: el
 * operador ve 2 destinatarios donde esperaba 5 y no sabe si el sistema los
 * descartó bien o se los comió. Cada omitido sale con su razón para que la
 * decisión sea revisable antes de mandar nada.
 *
 * ## Las reglas, y por qué cada una
 *
 * Un recordatorio de cobranza es un correo que **incomoda a un cliente que
 * paga**. Cada regla existe para no mandarlo cuando sería injusto o dañino:
 *
 *  1. **Sólo vencidas.** Recordarle una factura que todavía no vence es
 *     apurar a alguien que no debe nada.
 *  2. **Sólo con saldo.** Una pagada no se recuerda.
 *  3. 🔴 **Nunca si hay una promesa de pago vigente.** El cliente se
 *     comprometió a una fecha; escribirle antes rompe el acuerdo que el propio
 *     equipo aceptó. Es la regla que más protege la relación.
 *  4. **No repetir dentro de la ventana.** Dos correos en tres días no cobran
 *     más rápido; queman el remitente y al cliente.
 *  5. 🔴 **Nunca a quien marcó spam.** Un `complained_at` es una decisión del
 *     destinatario. Volver a escribirle es, además de grosero, la vía rápida a
 *     que el dominio entero deje de entregar.
 *  6. **Sin correo no hay envío.** 136 de 488 clientes vivos no lo tienen
 *     cargado (medido 2026-08-26): eso es trabajo de datos, no un fallo del
 *     recordatorio.
 */

import type { Receivable } from "@/lib/studio/payment-queries";

/** Días por defecto entre dos recordatorios al mismo cliente. */
export const VENTANA_DIAS = 7;

export type MotivoOmision =
  | "no_vencida"
  | "sin_saldo"
  | "promesa_vigente"
  | "recordada_hace_poco"
  | "marco_spam"
  | "sin_correo";

export const MOTIVO_LABEL: Record<MotivoOmision, string> = {
  no_vencida: "Todavía no vence",
  sin_saldo: "Sin saldo pendiente",
  promesa_vigente: "Prometió pagar y la fecha no llegó",
  recordada_hace_poco: "Ya se le recordó hace poco",
  marco_spam: "Marcó el correo como spam",
  sin_correo: "El cliente no tiene correo cargado",
};

export type Omitido = { code: string; markbox: string; motivo: MotivoOmision };

export type Seleccion = {
  aEnviar: Receivable[];
  omitidos: Omitido[];
};

/** Lo que el llamador resuelve desde la base y esta función sólo consulta. */
export type ContextoEnvio = {
  /** Markboxes que tienen correo cargado. */
  conCorreo: ReadonlySet<string>;
  /** Markboxes que marcaron spam alguna vez. Nunca vuelven a recibir. */
  marcaronSpam: ReadonlySet<string>;
  /**
   * Último recordatorio por código de factura, en ISO (`YYYY-MM-DD`). Lo que
   * decide es la FACTURA, no el cliente: dos facturas vencidas del mismo
   * cliente son dos deudas distintas.
   */
  ultimoRecordatorio: ReadonlyMap<string, string>;
};

/** Días entre dos fechas ISO (`b - a`). Negativo si `b` es anterior. */
function diasEntre(a: string, b: string): number {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

/**
 * Decide, para UNA fila, si se le manda recordatorio.
 *
 * El orden importa: se evalúa de lo más objetivo (¿debe algo?) a lo más
 * humano (¿prometió pagar?) y por último lo operativo (¿tiene correo?). Así el
 * motivo que se muestra es el más informativo de los que aplican.
 */
export function motivoDeOmision(
  r: Receivable,
  hoy: string,
  ctx: ContextoEnvio,
  ventanaDias: number = VENTANA_DIAS,
): MotivoOmision | null {
  if (r.daysOverdue == null || r.daysOverdue <= 0) return "no_vencida";
  if (r.balance <= 0) return "sin_saldo";

  // La promesa manda sobre el vencimiento: el equipo aceptó una fecha nueva.
  if (r.promiseDate && diasEntre(hoy, r.promiseDate) >= 0) return "promesa_vigente";

  const markbox = r.invoice.client_markbox;
  if (ctx.marcaronSpam.has(markbox)) return "marco_spam";

  const ultimo = ctx.ultimoRecordatorio.get(r.invoice.invoice_code);
  if (ultimo && diasEntre(ultimo, hoy) < ventanaDias) return "recordada_hace_poco";

  if (!ctx.conCorreo.has(markbox)) return "sin_correo";

  return null;
}

/** Parte la cola en a-quién-sí y a-quién-no-y-por-qué. */
export function seleccionarParaRecordatorio(
  cola: readonly Receivable[],
  hoy: string,
  ctx: ContextoEnvio,
  ventanaDias: number = VENTANA_DIAS,
): Seleccion {
  const aEnviar: Receivable[] = [];
  const omitidos: Omitido[] = [];

  for (const r of cola) {
    const motivo = motivoDeOmision(r, hoy, ctx, ventanaDias);
    if (motivo) {
      omitidos.push({
        code: r.invoice.invoice_code,
        markbox: r.invoice.client_markbox,
        motivo,
      });
    } else {
      aEnviar.push(r);
    }
  }

  return { aEnviar, omitidos };
}

/**
 * Resumen para la pantalla de confirmación. Se muestra **antes** de mandar:
 * quien aprieta el botón tiene que ver a cuántos le va a escribir y por qué el
 * resto se queda afuera.
 */
export function resumirSeleccion(s: Seleccion): string {
  const porMotivo = new Map<MotivoOmision, number>();
  for (const o of s.omitidos) {
    porMotivo.set(o.motivo, (porMotivo.get(o.motivo) ?? 0) + 1);
  }
  const detalle = [...porMotivo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${n} ${MOTIVO_LABEL[m].toLowerCase()}`)
    .join(" · ");

  const cabeza =
    s.aEnviar.length === 1
      ? "Se le escribe a 1 cliente"
      : `Se le escribe a ${s.aEnviar.length} clientes`;

  return s.omitidos.length === 0 ? cabeza : `${cabeza} — fuera: ${detalle}`;
}

/**
 * Cruza lo que pidió el cliente con lo que el servidor volvió a calcular.
 *
 * 🔴 **La lista que llega del navegador sólo puede ACOTAR, nunca ampliar.** Si
 * viniera un código que hoy no corresponde —porque ya pagó, porque prometió
 * pagar, porque marcó spam— se descarta acá aunque el cliente lo mande.
 *
 * Confiar en la lista del navegador convertiría el botón de recordatorios en un
 * vector para escribirle a cualquiera: basta con editar la petición.
 */
export function intersectarPedido(
  aEnviar: readonly Receivable[],
  pedidos: readonly string[],
): Receivable[] {
  const set = new Set(pedidos.filter((c) => typeof c === "string" && c.length > 0));
  return aEnviar.filter((r) => set.has(r.invoice.invoice_code));
}
