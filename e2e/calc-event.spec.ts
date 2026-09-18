import { test, expect } from "@playwright/test";
import { escribir } from "./_helpers/escribir";

/**
 * SDD-0259 · el evento anónimo sale al tocar el CTA, y no lleva nada personal.
 *
 * Se intercepta la request en el navegador en vez de mirar la DB: lo que hay
 * que probar es que **el disparador existe y manda lo correcto**. Que la fila
 * llegue y quede cerrada ya lo prueba el contrato SQL (0368).
 *
 * El caso que más importa es el segundo: sin peso. Es el que mide SDD-0257, y
 * el que un `if (!peso) return` mataría en silencio.
 */
test.describe("SDD-0259 · telemetría de la calculadora", () => {
  test("al tocar el CTA sale el evento, con el CBM y sin datos personales", async ({
    page,
  }) => {
    const enviados: Record<string, unknown>[] = [];
    // Se responde 204 desde el test: no queremos escribir en la DB real ni
    // depender de que el endpoint esté disponible para probar el disparador.
    await page.route("**/api/public/calc-event", async (route) => {
      enviados.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/tarifas");
    const panel = page.locator("#panel-ddp");
    await escribir(panel.locator('input[placeholder="12"]'), "12");
    await escribir(panel.locator('input[placeholder="4800"]'), "4800");

    // El CTA es un <a> a wa.me: se bloquea la navegación para no abrir WhatsApp.
    await page.route("**/wa.me/**", (route) => route.abort());
    await panel.locator('a[href*="wa.me"]').click({ noWaitAfter: true });

    await expect.poll(() => enviados.length).toBeGreaterThan(0);
    const ev = enviados[0];

    expect(ev.cbm).toBe(12);
    expect(ev.weightKg).toBe(4800);
    expect(ev.modo).toBe("ddp");
    // 12 m³ × $850. Sin Supabase el e2e cotiza con `CONFIG.tarifaBaseCBM`, así
    // que este número se mueve con esa constante (SDD-0475).
    expect(ev.totalUsd).toBe(10200);

    // Lo que NO puede viajar. Si alguien agrega un campo personal al payload,
    // este test cae antes de que llegue a producción.
    const claves = Object.keys(ev).join(",").toLowerCase();
    for (const prohibida of [
      "email",
      "correo",
      "phone",
      "tel",
      "nombre",
      "ip",
      "cookie",
      "session",
      "agent",
    ]) {
      expect(claves).not.toContain(prohibida);
    }
  });

  test("sin peso también se registra, y viaja en null", async ({ page }) => {
    const enviados: Record<string, unknown>[] = [];
    await page.route("**/api/public/calc-event", async (route) => {
      enviados.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/wa.me/**", (route) => route.abort());

    await page.goto("/tarifas");
    const panel = page.locator("#panel-ddp");
    await escribir(panel.locator('input[placeholder="12"]'), "12");
    await expect(panel).toContainText(/Desde/);

    await panel.locator('a[href*="wa.me"]').click({ noWaitAfter: true });

    await expect.poll(() => enviados.length).toBeGreaterThan(0);
    // `null`, no `0` ni ausente: es la métrica de SDD-0257 — cada cuánto el
    // cliente no sabe el peso. Un `0` se leería como "pesa cero".
    expect(enviados[0].weightKg).toBeNull();
    expect(enviados[0].cbm).toBe(12);
  });
});
