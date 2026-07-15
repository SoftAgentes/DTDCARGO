/**
 * Clasificación contable del premio del referido ($80, SDD-0137). SIN imports.
 *
 * ⚠️ ESTO NO TIENE NADA DE FISCAL. Decisión del founder (2026-07-15): el módulo
 * Fiscal está apagado, maneja su propio libro y NADA se ata a él; cuando se
 * trabaje fiscal en el futuro se verá qué se conecta y qué no. Antes esto era un
 * setting en `fiscal_settings` y mandaba al usuario a "Fiscal · SENIAT" —un módulo
 * de impuestos— a configurar algo de referidos. Se cortó ese cordón.
 * (La COLUMNA fiscal_settings.referral_credit_mode sigue existiendo en la DB pero
 * YA NO SE LEE NI SE ESCRIBE — se deja por si la re-espec la reusa; borrarla es
 * DDL destructivo y no hace falta.)
 *
 * Clasificación FIJA, sin configuración: el premio es una REBAJA DE PRECIO sobre la
 * próxima venta (palabras del founder: "se le pone como un descuento al cliente
 * para su próxima compra") → cuenta 4.9 Descuentos sobre ventas, contra-ingreso.
 * No hay opción que elegir: el negocio ya decidió qué es.
 *
 * 🔜 Este archivo es TRANSITORIO. La re-espec de SDD-0137 (modelo "Delayed Credit"
 * de QuickBooks: la promesa NO toca los libros hasta que aterriza como línea en una
 * factura futura) probablemente lo elimine entero — si el crédito baja el total de
 * la factura, la venta se registra por lo que vale y no hay asiento aparte que
 * clasificar. Ver el handoff de la ronda 2026-07-15.
 */

/** Cuenta del DEBE: gasto de incentivo (plan de cuentas, seed 0078). */
export const REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE = "6.11";

/** Cuenta del HABER: siempre la CxC del cliente (baja el saldo del referidor). */
export const REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE = "1.1.2";

/** Glosa de la línea del debe. Sin jerga fiscal: esto no es un crédito fiscal. */
export const REFERRAL_CREDIT_DEBIT_MEMO =
  "Premio de referido (gasto de promoción)";
