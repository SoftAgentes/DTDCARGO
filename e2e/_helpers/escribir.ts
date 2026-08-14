import type { Locator } from "@playwright/test";

/**
 * Escribe en un input **controlado por React**, de forma que WebKit también lo vea.
 *
 * ⚠️ NO uses `.fill()` en los campos de la calculadora. Medido el 2026-08-14 en
 * `mobile-safari` (WebKit) contra `/tarifas`:
 *
 * | Método                    | Valor en el DOM | ¿React lo recibe? |
 * |---------------------------|-----------------|-------------------|
 * | `.fill("12")`             | "12"            | ❌ no             |
 * | `.pressSequentially("12")`| "12"            | ✅ sí             |
 *
 * `fill()` asigna `.value` y dispara un `input`, pero el rastreador de valor de
 * React lo ve como "no cambió" y nunca corre el `onChange` sintético. El estado
 * se queda en 0 y la calculadora muestra el estado vacío — con el campo lleno en
 * pantalla. En Chromium no pasa, así que el test verde miente sobre iPhone.
 *
 * **Esto NO es un bug del producto:** un cliente real teclea, y tecleando
 * funciona. Es una incompatibilidad entre `fill()` y React en WebKit.
 *
 * El `delay` es a propósito: sin él, WebKit a veces agrupa las teclas y se
 * pierde algún `onChange` intermedio.
 */
export async function escribir(input: Locator, valor: string): Promise<void> {
  await input.click();
  await input.fill("");
  await input.pressSequentially(valor, { delay: 30 });
}
