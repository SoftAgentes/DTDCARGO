import { test, expect } from "@playwright/test";
import { escribir } from "./_helpers/escribir";
import { esperarHidratado } from "./_helpers/hidratacion";

/**
 * El guardián de la hidratación de `/tarifas`.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE.
 *
 * `calculadora-sin-peso.spec.ts` y `calc-event.spec.ts` fallaban en el PRIMER
 * intento con el caché de `.next` frío y pasaban al reintentar. Playwright los
 * marcaba "flaky", el gate salía verde, y el problema quedaba invisible: hoy
 * ese verde depende del reintento. Medido el 2026-08-20, mismos dos specs:
 * caché frío → 9 flaky y 6 passed; caché caliente → 15 passed.
 *
 * La causa no es el caché: es la CARRERA que el caché frío destapa. Playwright
 * teclea en cuanto el `<input>` es accionable, y un input servido por el
 * servidor lo es mucho antes de que React lo hidrate — las teclas caen en el
 * DOM sin disparar el `onChange` sintético, el estado se queda en 0 y la
 * calculadora muestra "Ingresa tu CBM" con el campo lleno.
 *
 * Esperar a que la máquina se ponga lenta no sirve como reproducción: el
 * 2026-08-20 el mismo par de specs en frío dio 15/15 en una máquina ociosa. Por
 * eso acá la carrera se FUERZA: `waitUntil: "commit"` devuelve el control apenas
 * responde el servidor, SIN esperar el `load` — o sea, con el HTML llegando y el
 * JS de React todavía en camino. Es el peor caso, y ocurre en TODAS las
 * corridas, en cualquier máquina.
 *
 * Medido el 2026-08-20, este mismo archivo contra el helper VIEJO (`click` +
 * `pressSequentially` a secas):
 *
 * | test                          | helper viejo                  | helper nuevo |
 * |-------------------------------|-------------------------------|--------------|
 * | teclear el CBM                | 2 failed + 1 flaky (3/3 mal)  | 3 passed     |
 * | tocar el toggle (ya con gate) | 3 passed                      | 3 passed     |
 *
 * El "flaky" de chromium es el enmascaramiento en vivo: falló, se reintentó y
 * pasó. Si mañana alguien simplifica `escribir()` y le quita la espera, este
 * archivo se pone rojo — que es el punto.
 */
test.describe("hidratación · tocar la calculadora antes de que React llegue", () => {
  test("el CBM tecleado antes del JS igual produce precio", async ({
    page,
  }) => {
    await page.goto("/tarifas", { waitUntil: "commit" });

    const panel = page.locator("#panel-ddp");
    await escribir(panel.locator('input[placeholder="12"]'), "12");

    // 12 m³ × $800. Si el tecleo se perdió, acá sigue el estado vacío.
    await expect(panel).toContainText("9,600");
  });

  test("el toggle tocado antes del JS igual abre el consolidado", async ({
    page,
  }) => {
    await page.goto("/tarifas", { waitUntil: "commit" });

    // Un clic perdido no se recupera solo: el panel nunca abre y el
    // `escribir()` de abajo se queda esperando un campo que jamás se ve.
    const toggle = page.getByRole("tab").nth(1);
    await esperarHidratado(toggle, "el toggle de modalidad");
    await toggle.click();

    const panel = page.locator("#panel-consolidado");
    await expect(panel).toBeVisible();

    await escribir(panel.locator('input[placeholder="12"]'), "4");
    await expect(panel).toContainText("2,320");
  });
});
