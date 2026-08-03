import { expect, test } from "@playwright/test";

const EMAIL = process.env.STUDIO_E2E_EMAIL;
const PASSWORD = process.env.STUDIO_E2E_PASSWORD;
const SETTLEMENT_CODE = process.env.STUDIO_E2E_PAYROLL_SETTLEMENT_CODE;

test.describe("Tier 3 · anulación gobernada de finiquito", () => {
  test.skip(
    !EMAIL || !PASSWORD || !SETTLEMENT_CODE,
    "Requiere admin E2E y un finiquito confirmado desechable del seed efímero.",
  );

  test("abre confirmación R3 y preserva la decisión antes de mutar", async ({ page }) => {
    // El Studio conserva el estado del sidebar por usuario. Arrancarlo
    // colapsado evita que el rail de escritorio intercepte los controles al
    // ejecutar el mismo journey en los perfiles móviles de Playwright.
    await page.addInitScript(() => {
      localStorage.setItem("studio_sidebar_collapsed", "1");
    });
    await page.goto("/studio/login?next=/studio/nomina");
    await page.locator('input[name="email"]').fill(EMAIL!);
    await page.locator('input[name="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/studio\/nomina/, { timeout: 20_000 });
    const settlementsTab = page.getByRole("button", {
      name: "Liquidaciones",
      exact: true,
    });
    await settlementsTab.focus();
    await expect(settlementsTab).toBeFocused();
    await settlementsTab.press("Enter");
    const row = page
      .getByText(SETTLEMENT_CODE!, { exact: false })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Ver']][1]");
    await row.getByRole("button", { name: "Ver" }).click();

    const voidButton = page.getByRole("button", { name: "Anular" });
    await expect(voidButton).toBeVisible();
    await voidButton.click();

    const dialog = page.getByRole("dialog", { name: /Anular finiquito/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("vínculo contable se conservarán");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();

    await dialog.getByRole("button", { name: "Cancelar" }).press("Enter");
    await expect(dialog).toBeHidden();
    await expect(voidButton).toBeVisible();
  });
});
