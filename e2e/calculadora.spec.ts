import { test, expect, type Page } from "@playwright/test";

/**
 * Regresión de la calculadora pública LCL (/calculadora).
 *
 * Bug de origen (founder 2026-07-11, "a veces no me muestra el cálculo"): el
 * panel "¿No sabes tu CBM? Calcúlalo con las medidas" pisaba el CBM escrito a
 * mano. Al cerrarlo hacía `update("cbmTotal", cbmDesdeMedidas)` sin condición;
 * si no se metían medidas, `cbmDesdeMedidas` era 0 y BORRABA el CBM manual →
 * el estimado desaparecía. Fix: tratar `cbmDesdeMedidas === 0` como "sin
 * override" (abrir/cerrar sin medir conserva el valor manual).
 *
 * Selectores estables: los inputs de CBM/peso se identifican por su placeholder
 * ("12" / "4800"); el estado vacío del panel de resultado por su copy
 * ("Ingresa tu CBM y peso").
 */

const CBM = 'input[placeholder="12"]';
const PESO = 'input[placeholder="4800"]';
const VACIO = /Ingresa tu CBM y peso/i;

async function typeInto(page: Page, sel: string, text: string) {
  const el = page.locator(sel);
  await el.click();
  await el.fill("");
  await el.pressSequentially(text, { delay: 15 });
}

test.describe("calculadora pública · panel de medidas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calculadora");
    await expect(page.locator(CBM)).toBeVisible();
  });

  test("abrir/cerrar el panel SIN medir conserva el CBM manual y el estimado", async ({
    page,
  }) => {
    // Carga manual: el estimado aparece (el estado "vacío" desaparece).
    await typeInto(page, PESO, "800");
    await typeInto(page, CBM, "12");
    await expect(page.getByText(VACIO)).toHaveCount(0);

    // Abrir el panel de medidas (sin escribir ninguna medida).
    await page.getByText(/No sabes tu CBM/i).click();
    // REGRESIÓN: el estimado NO debe desaparecer al abrir el panel.
    await expect(page.getByText(VACIO)).toHaveCount(0);

    // Cerrar el panel sin haber medido nada.
    await page.getByText(/Prefiero escribir el CBM a mano/i).click();
    // REGRESIÓN: el CBM manual (12) sigue en el campo y el estimado sigue vivo.
    await expect(page.locator(CBM)).toHaveValue("12");
    await expect(page.getByText(VACIO)).toHaveCount(0);
  });

  test("medir con el panel deriva el CBM y lo congela al cerrar", async ({
    page,
  }) => {
    // El flujo bueno del panel debe seguir intacto tras el fix.
    await typeInto(page, PESO, "1000");
    await page.getByText(/No sabes tu CBM/i).click();

    // 40 × 30 × 60 cm × 10 cajas = 0,72 m³.
    await page.locator('input[placeholder="40"]').fill("40");
    await page.locator('input[placeholder="30"]').fill("30");
    await page.locator('input[placeholder="60"]').fill("60");
    await page.locator('input[placeholder="1"]').fill("10");

    // Con medidas válidas ya hay estimado (deja de pedir datos).
    await expect(page.getByText(VACIO)).toHaveCount(0);

    // Al cerrar, el CBM derivado (0.72) queda congelado y editable en el campo.
    await page.getByText(/Prefiero escribir el CBM a mano/i).click();
    await expect(page.locator(CBM)).toHaveValue("0.72");
    await expect(page.getByText(VACIO)).toHaveCount(0);
  });

  test("decimales con coma (es-VE) cotizan sin perder el estimado", async ({
    page,
  }) => {
    // El cliente venezolano escribe "2,5". No debe romper ni vaciar el cálculo.
    await typeInto(page, PESO, "800");
    await typeInto(page, CBM, "2,5");
    await expect(page.getByText(VACIO)).toHaveCount(0);
    // Aparece un total en dólares (monto exacto depende de la tarifa pública).
    await expect(
      page.locator("span.num").filter({ hasText: /^\$[\d,]+$/ }).first(),
    ).toBeVisible();
  });
});
