import { test, expect, type Page } from "@playwright/test";
import { esperarHidratado } from "./_helpers/hidratacion";

/**
 * Contrato: la web pública no tiene scroll horizontal en pantallas angostas.
 *
 * Medido el 2026-08-20 en producción y reproducido en local: a 320px de ancho
 * (iPhone SE de 1ª generación) `/tarifas` daba `scrollWidth` 334 contra
 * `clientWidth` 320. Dos culpables independientes:
 *
 *  1. La barra pública: lockup 167,4 + hamburguesa 44 + gap 8 + CTA 95 = 314,4
 *     dentro de 280px de contenido → "Regístrate" se salía 14px de la pantalla.
 *  2. `.calc-switch` de /tarifas: `grid-template-columns: 1fr` deja el mínimo
 *     automático de la pista en `min-content`, así que la pista creció a 301,9
 *     dentro de un contenedor de 280 y el botón se salió 1,9px.
 *
 * El desborde de la barra afecta a TODA la web pública, no a una página: por
 * eso el barrido no se queda en /tarifas.
 *
 * ⚠️ Ojo con el diagnóstico: el velo y el drawer CERRADO (`fixed`) reportaban
 * 334 de ancho y parecían culpables. No lo eran — un elemento `fixed` no
 * extiende el área de scroll del documento; reportaban 334 porque el ICB ya se
 * había ensanchado por el desborde de la barra. Ocultándolos, el `scrollWidth`
 * se quedaba en 334. Por eso el reporte de abajo IGNORA los `fixed`: son
 * síntoma y mandan a arreglar el elemento equivocado.
 */

const ANCHOS = [320, 360, 375] as const;
const RUTAS = ["/", "/tarifas", "/faq"] as const;

/** Mide el desborde horizontal del documento. */
async function medirDesborde(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;

    const clientWidth = de.clientWidth;
    const scrollWidth = de.scrollWidth;
    const culpables: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      // Los `fixed` no extienden el área de scroll: si se salen, es porque otro
      // elemento ya ensanchó el ICB. Reportarlos es mandar a arreglar el síntoma.
      if (getComputedStyle(el).position === "fixed") continue;
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 && caja.height === 0) continue;
      if (caja.right > clientWidth + 0.5 || caja.left < -0.5) {
        culpables.push(
          `${el.tagName.toLowerCase()}.${String(el.className || "").slice(0, 70)} [${caja.left.toFixed(1)} → ${caja.right.toFixed(1)}]`,
        );
      }
    }

    return { scrollWidth, clientWidth, culpables: culpables.slice(0, 6) };
  });
}

for (const ancho of ANCHOS) {
  test.describe(`sin scroll horizontal a ${ancho}px`, () => {
    test.use({ viewport: { width: ancho, height: 780 } });

    for (const ruta of RUTAS) {
      test(`${ruta} cierra en ${ancho}px`, async ({ page }) => {
        await page.goto(ruta);
        // El lockup del nav se pinta con next/image: sin esperar la carga, su
        // ancho puede medirse antes de que la imagen ocupe su caja.
        await page.waitForLoadState("networkidle");

        const { scrollWidth, clientWidth, culpables } = await medirDesborde(page);
        expect(
          scrollWidth,
          `${ruta} @${ancho}px desborda ${scrollWidth - clientWidth}px.\nSe salen:\n  ${culpables.join("\n  ")}`,
        ).toBe(clientWidth);
      });
    }
  });
}

test.describe("el drawer del menú móvil sigue funcionando a 320px", () => {
  test.use({ viewport: { width: 320, height: 780 } });

  test("abre dentro de la pantalla y cierra con Escape", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const drawer = page.locator("#mobile-drawer");
    const abrir = page.getByRole("button", { name: "Abrir menú" });

    // Cerrado: está fuera de pantalla a la derecha y no suma scroll horizontal.
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    const antes = await medirDesborde(page);
    expect(antes.scrollWidth).toBe(antes.clientWidth);

    // `networkidle` NO es hidratación: la red se calla y React todavía puede no
    // haber tomado el botón. Sin esta espera el clic se pierde y `aria-hidden`
    // se queda en "true" — es lo que hacía flakear este test en mobile-safari.
    // Ver `_helpers/hidratacion.ts`.
    await esperarHidratado(abrir, "el botón del menú móvil");
    await abrir.click();
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(drawer).toBeVisible();

    // Abierto: el panel entra completo en la pantalla (no se sale por la derecha
    // ni queda medio cortado). Va con `poll` porque el drawer entra con una
    // transición de 300ms: `toBeVisible()` resuelve apenas empieza a deslizar y
    // ahí el borde derecho todavía está fuera de pantalla (medido: 352 de 320).
    await expect
      .poll(async () => {
        const c = await drawer.boundingBox();
        return c ? Math.round(c.x + c.width) : null;
      })
      .toBe(320);
    const caja = await drawer.boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    await expect(drawer.getByRole("link", { name: "Tarifas" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    // Y al cerrarse tampoco deja scroll horizontal detrás.
    const despues = await medirDesborde(page);
    expect(despues.scrollWidth).toBe(despues.clientWidth);
  });
});
