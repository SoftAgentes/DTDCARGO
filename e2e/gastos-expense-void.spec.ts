import { expect, test } from "@playwright/test";

const EMAIL = process.env.STUDIO_E2E_EMAIL;
const PASSWORD = process.env.STUDIO_E2E_PASSWORD;
const EXPENSE_CODE = process.env.STUDIO_E2E_EXPENSE_CODE;

test.describe("Tier 3 · anulación gobernada de gastos", () => {
  test.skip(
    !EMAIL || !PASSWORD || !EXPENSE_CODE,
    "Requiere accounting/admin E2E y un gasto vivo del fixture efímero.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("studio_sidebar_collapsed", "1");
    });
    await page.goto("/studio/login?next=/studio/gastos");
    await page.locator('input[name="email"]').fill(EMAIL!);
    await page.locator('input[name="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/studio\/gastos/, { timeout: 20_000 });
  });

  test("Studio abre la decisión R3 sin mutar y restaura el foco", async ({ page }) => {
    const row = page
      .getByText(EXPENSE_CODE!, { exact: true })
      .locator("xpath=ancestor::tr[1]");
    const trigger = row.getByRole("button", { name: "Acciones" });
    await trigger.focus();
    await trigger.press("ArrowDown");
    await expect(row.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    await row.getByRole("menuitem", { name: "Anular gasto" }).click();

    const dialog = page.getByRole("dialog", { name: new RegExp(`Anular gasto ${EXPENSE_CODE}`) });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("El registro y su recibo se conservarán");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).press("Enter");
    await expect(dialog).toBeHidden();
  });

  test("Móvil reutiliza la misma confirmación y conserva el recibo", async ({ page }) => {
    await page.goto("/m/erp?tab=expenses");
    await page.getByRole("button", { name: `Editar gasto ${EXPENSE_CODE}` }).click();
    await page.getByRole("button", { name: "Anular este gasto" }).click();
    const dialog = page.getByRole("dialog", { name: `Anular gasto ${EXPENSE_CODE}` });
    await expect(dialog).toContainText("El registro y su recibo se conservarán");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });
});
