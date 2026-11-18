import { test, expect } from "@playwright/test";

/**
 * SDD-0646 · Registro al portal por link, la cara pública sin base.
 *
 * El camino feliz (completar la ficha y entrar al portal) necesita una base con
 * la migración 0552 y Auth: lo cubren el contrato SQL y las pruebas de la
 * acción. Aquí se protege lo que sólo ve el navegador:
 *   - un link que no sirve muestra UN mensaje y ningún formulario;
 *   - la página no se indexa (link personal);
 *   - un Shipping Mark puesto en la URL no abre nada: el link no lo lleva.
 */

const INVALIDO = "Este enlace ya no está disponible";

test.describe("registro por link", () => {
  test("un token inventado muestra el aviso y ningún formulario", async ({ page }) => {
    await page.goto(`/registro/link/${"Z".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Enlace no disponible" })).toBeVisible();
    await expect(page.getByText(INVALIDO)).toBeVisible();
    await expect(page.getByRole("button", { name: /Guardar y entrar/ })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("un Shipping Mark en la URL no abre ninguna ficha", async ({ page }) => {
    await page.goto("/registro/link/DTD-8001");
    await expect(page.getByText(INVALIDO)).toBeVisible();
    await expect(page.getByText("DTD-8001")).toHaveCount(0);
  });
});
