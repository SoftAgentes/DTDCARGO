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
    await page.goto("/login");
    await page.getByLabel(/correo/i).fill(EMAIL!);
    await page.getByLabel(/contraseña/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.goto("/studio/nomina");
    await page.getByRole("tab", { name: "Liquidaciones" }).click();
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

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(voidButton).toBeVisible();
  });
});
