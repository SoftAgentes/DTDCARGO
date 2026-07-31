import { test, expect } from "@playwright/test";

/**
 * Regresión del panel de ayuda del CBM (`components/CbmAyuda.tsx`).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE: el panel se publicó con la clase `flex` de
 * Tailwind encima. Un popover cerrado se oculta con el `display:none` del
 * user-agent, y cualquier clase de display de autor le gana por especificidad,
 * así que el panel quedaba visible PARA SIEMPRE: aparecía apenas cargaba la
 * página, la × cambiaba el estado interno pero no lo ocultaba, y ni Esc ni el
 * clic afuera lo cerraban. Tapaba la calculadora entera.
 *
 * Los tests de Vitest NO lo habrían agarrado: el bug vive en la cascada CSS
 * real (globals.css + user-agent), y jsdom no aplica ninguna de las dos. Por
 * eso la verificación es e2e y mira `display` computado, no el estado de React:
 * el estado interno SIEMPRE decía "cerrado" mientras el panel se veía.
 */

const AYUDA = 'button[aria-label="¿Qué es el CBM?"]';

test.describe("ayuda del CBM en la calculadora", () => {
  test("el panel arranca oculto y se cierra de verdad por los 3 caminos", async ({
    page,
  }) => {
    await page.goto("/tarifas");

    const boton = page.locator(AYUDA).first();
    await expect(boton).toBeVisible();

    const panelId = await boton.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);

    // 1) Al cargar no se ve nada. Este es el corazón de la regresión: antes
    //    `display` era `flex` desde el primer frame, sin que nadie tocara nada.
    await expect(panel).toBeHidden();
    await expect(panel).toHaveCSS("display", "none");

    // 2) Abre con el "?"
    await boton.click();
    await expect(panel).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "true");

    // 3) Cierra con la ×  (antes: seguía visible)
    await panel.getByRole("button", { name: "Cerrar" }).click();
    await expect(panel).toBeHidden();
    await expect(panel).toHaveCSS("display", "none");

    // 4) Cierra con Esc  (antes: seguía visible)
    await boton.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    // 5) Cierra con clic afuera  (antes: seguía visible)
    await boton.click();
    await expect(panel).toBeVisible();
    await page.locator("h1").first().click({ force: true });
    await expect(panel).toBeHidden();
  });

  test("abierto, no tapa el campo que el visitante vino a llenar", async ({
    page,
  }) => {
    await page.goto("/tarifas");

    const boton = page.locator(AYUDA).first();
    const panelId = await boton.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);

    await boton.click();
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const campoBox = await page
      .locator(`${AYUDA} >> xpath=ancestor::label[1]`)
      .first()
      .locator("input")
      .first()
      .boundingBox();
    expect(panelBox).not.toBeNull();
    expect(campoBox).not.toBeNull();

    // El campo de CBM está JUSTO debajo del botón: abrir hacia abajo le tapa al
    // visitante exactamente lo que vino a llenar. Por eso el panel prefiere ir
    // arriba.
    const seSolapan = !(
      panelBox!.x + panelBox!.width < campoBox!.x ||
      panelBox!.x > campoBox!.x + campoBox!.width ||
      panelBox!.y + panelBox!.height < campoBox!.y ||
      panelBox!.y > campoBox!.y + campoBox!.height
    );
    expect(seSolapan).toBe(false);

    // Y entero dentro de la ventana: el panel viejo se salía por abajo.
    const vp = page.viewportSize()!;
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.y).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(vp.width);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(vp.height);
  });
});
