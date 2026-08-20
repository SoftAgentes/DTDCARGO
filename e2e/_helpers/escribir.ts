import { expect, type Locator } from "@playwright/test";
import { esperarHidratado, sondearReact } from "./hidratacion";

/**
 * Escribe en un input **controlado por React**, de forma que React lo vea.
 *
 * Hay DOS maneras distintas de teclear en un campo y que el estado se quede en
 * 0 con el campo lleno en pantalla. El helper cubre las dos:
 *
 * ── 1) `.fill()` en WebKit ──────────────────────────────────────────────────
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
 * El `delay` es a propósito: sin él, WebKit a veces agrupa las teclas y se
 * pierde algún `onChange` intermedio.
 *
 * ── 2) Teclear antes de que React hidrate ──────────────────────────────────
 *
 * MISMO síntoma, otra causa, y esta sí pega en los tres navegadores. Playwright
 * espera a que el campo sea "accionable" —visible, estable, habilitado— y un
 * `<input>` recién servido por el servidor ya lo es, mucho antes de que React lo
 * tome. Teclear ahí es teclear contra HTML muerto.
 *
 * Con el caché de `.next` frío la hidratación llega tarde y los specs de la
 * calculadora fallaban en el primer intento y pasaban al reintentar: Playwright
 * los marcaba "flaky" y el gate salía verde con el problema adentro. Ver el
 * detalle, los números y el guardián en `./hidratacion.ts` y
 * `../calculadora-hidratacion.spec.ts`.
 *
 * Por eso acá se espera a que React sea dueño del campo ANTES de la primera
 * tecla, y después se comprueba que de verdad lo recibió. Nada de
 * `waitForTimeout`: un número fijo esconde el problema en la máquina rápida y
 * lo deja intacto en la lenta.
 *
 * **Ninguna de las dos es un bug del producto:** un cliente real teclea, y para
 * cuando encuentra el campo React ya llegó. Son dos maneras en que el robot
 * llega antes que nadie.
 */

/** Valor centinela del sondeo: cualquier otra cosa es el motivo del desfase. */
const EN_SINCRONIA = "en sincronía";

export async function escribir(input: Locator, valor: string): Promise<void> {
  // 1) Que React sea dueño del campo antes de la PRIMERA tecla.
  await esperarHidratado(input, "el campo");

  // 2) El tecleo (ver arriba por qué es `pressSequentially` y no `fill`).
  await input.click();
  await input.fill("");
  await input.pressSequentially(valor, { delay: 30 });

  // 3) Que React lo haya RECIBIDO. Mirar el DOM acá no serviría: el campo se ve
  //    lleno tanto si el `onChange` corrió como si no — ese es justo el bug. Lo
  //    que se compara son las dos versiones de la verdad sobre el mismo nodo.
  await expect
    .poll(
      async () => {
        const s = await sondearReact(input);
        if (!s.hidratado) return "React soltó el campo: ya no tiene sus props";
        if (s.react !== s.dom)
          return `React ve "${s.react}" y la pantalla "${s.dom}"`;
        if (valor !== "" && s.dom === "") return "el campo quedó vacío";
        return EN_SINCRONIA;
      },
      {
        timeout: 5_000,
        intervals: [50, 100, 200, 400],
        message: `React nunca recibió "${valor}" (el tecleo se perdió)`,
      },
    )
    .toBe(EN_SINCRONIA);
}
