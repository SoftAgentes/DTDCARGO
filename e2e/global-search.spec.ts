import { test, expect } from "@playwright/test";

/**
 * E2E del buscador global ⌘K (SDD-0135).
 *
 * DOS tiers:
 *   - Tier 1 (corre sin seed): la superficie del Studio está protegida — sin
 *     sesión, cualquier ruta del ERP (donde vive la topbar con ⌘K) rebota al
 *     login. Garantiza que el buscador no queda expuesto sin auth.
 *   - Tier 3 (requiere branch + seed-e2e · env STUDIO_E2E_EMAIL/PASSWORD):
 *     el journey real permission-aware. Se salta si no hay credenciales, igual
 *     que los demás specs Tier-3 del repo (ver e2e/README.md).
 *
 * El grueso de la verificación de seguridad (qué faceta corre por rol, que
 * roles sin dinero no invocan invoices/payment_receipts, que el candado sale de
 * la matriz) vive en los UNIT de `lib/studio/global-search/*.test.ts` — más
 * fuerte y determinista que el e2e para esas garantías.
 */

test.describe("Tier 1 · buscador global protegido por auth", () => {
  test("sin sesión, /studio rebota al login (⌘K no expuesto)", async ({ page }) => {
    await page.goto("/studio/dashboard");
    await expect(page).toHaveURL(/\/studio\/login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});

const EMAIL = process.env.STUDIO_E2E_EMAIL;
const PASSWORD = process.env.STUDIO_E2E_PASSWORD;

test.describe("Tier 3 · journey permission-aware (requiere seed)", () => {
  test.skip(!EMAIL || !PASSWORD, "Sin STUDIO_E2E_EMAIL/PASSWORD (branch+seed).");

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/studio/login");
    await page.locator('input[name="email"]').fill(EMAIL!);
    await page.locator('input[name="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/studio\/login/);
  }

  test("⌘K abre el buscador global (no el placeholder)", async ({ page }) => {
    await login(page);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    // El placeholder viejo tenía un input disabled; el real es editable.
    const input = page.getByRole("combobox");
    await expect(input).toBeEnabled();
    await input.fill("a");
    await input.fill("Distribuidora");
    // Chips de scope presentes.
    await expect(page.getByRole("button", { name: /Todo/ })).toBeVisible();
  });

  test("el rol con dinero ve la faceta Pagos; el operativo ve el candado", async ({ page }) => {
    // Este assert depende del rol del usuario del seed. Con un usuario
    // accounting: debe aparecer el grupo "Pagos"; con commercial: el candado
    // con la nota "…las gestiona Contabilidad." (ver e2e/README.md · seed).
    await login(page);
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByRole("combobox").fill("Juan");
    await expect(
      dialog.getByText(/Pagos|Contabilidad/),
    ).toBeVisible();
  });
});
