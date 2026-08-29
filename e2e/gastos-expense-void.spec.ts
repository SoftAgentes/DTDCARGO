import { expect, test, type Page } from "@playwright/test";
import { esperarHidratado } from "./_helpers/hidratacion";

const EMAIL = process.env.STUDIO_E2E_EMAIL;
const PASSWORD = process.env.STUDIO_E2E_PASSWORD;
const EXPENSE_CODE = process.env.STUDIO_E2E_EXPENSE_CODE;
const AUTH_LANDING = "/studio/gastos";

async function navigateFromAuthLanding(page: Page, next: string) {
  const navigate = () => page.goto(next, { waitUntil: "domcontentloaded" as const });

  try {
    await navigate();
  } catch (error) {
    const interruptedByLanding =
      error instanceof Error &&
      error.message.includes("is interrupted by another navigation") &&
      error.message.includes(AUTH_LANDING);

    if (!interruptedByLanding) throw error;

    // Al cruzar por primera vez del layout /studio al layout /m, el runtime de
    // desarrollo puede hacer un full reload y volver al documento anterior.
    // La navegación es idempotente y aún no ocurrió ninguna acción de negocio:
    // esperamos ese aterrizaje concreto y repetimos sólo el cambio de documento.
    await page.waitForURL((url) => url.pathname === AUTH_LANDING, {
      timeout: 20_000,
    });
    await navigate();
  }

  await expect(page).toHaveURL(
    (url) => `${url.pathname}${url.search}` === next,
    { timeout: 20_000 },
  );
}

async function login(page: Page, next: string) {
  // Aterrizar primero en una ruta estable evita /studio/dashboard: su autosave
  // de desarrollo puede seguir activo cuando comienza la navegación móvil.
  // También deja que la Server Action de login termine antes del page.goto
  // explícito; ir directo a /m/erp puede observar un redirect transitorio.
  await page.goto(`/studio/login?next=${encodeURIComponent(AUTH_LANDING)}`);
  const email = page.locator('input[name="email"]');
  await esperarHidratado(email, "el campo Email del login");
  await email.fill(EMAIL!);
  await page.locator('input[name="password"]').fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(
    (url) => url.pathname === AUTH_LANDING,
    { timeout: 20_000 },
  );
  await page.waitForLoadState("networkidle");

  if (next !== AUTH_LANDING) {
    // Next dev puede hacer varias recargas de recuperación al abrir por primera
    // vez el bundle móvil. `networkidle` queda esperando una calma que no es la
    // señal contractual; el control hidratado de abajo sí lo es.
    await navigateFromAuthLanding(page, next);
  }
}

test.describe("Tier 3 · anulación gobernada de gastos", () => {
  test.skip(
    !EMAIL || !PASSWORD || !EXPENSE_CODE,
    "Requiere accounting/admin E2E y un gasto vivo del fixture efímero.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("studio_sidebar_collapsed", "1");
    });
  });

  test("Studio abre la decisión R3 sin mutar y restaura el foco", async ({ page }) => {
    await login(page, "/studio/gastos");
    const row = page.locator(`[data-row-id="${EXPENSE_CODE}"]`);
    await expect(row).toBeVisible();
    const trigger = row.getByRole("button", { name: "Acciones" });
    await esperarHidratado(trigger, "el botón Acciones del gasto");
    await trigger.focus();
    await trigger.press("ArrowDown");
    const editItem = row.getByRole("menuitem", { name: "Editar" });
    await expect(editItem).toBeFocused();
    await editItem.press("ArrowDown");
    const voidItem = row.getByRole("menuitem", { name: "Anular gasto" });
    await expect(voidItem).toBeFocused();
    await voidItem.press("Enter");

    const dialog = page.getByRole("dialog", { name: new RegExp(`Anular gasto ${EXPENSE_CODE}`) });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("El registro y su recibo se conservarán");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).press("Enter");
    await expect(dialog).toBeHidden();
  });

  test("Móvil reutiliza la misma confirmación y conserva el recibo", async ({ page }) => {
    await login(page, "/m/erp?tab=expenses");
    const editExpense = page.getByRole("button", {
      name: `Editar gasto ${EXPENSE_CODE}`,
    });
    await expect(editExpense).toBeVisible({ timeout: 20_000 });
    await esperarHidratado(editExpense, "el botón Editar gasto móvil");
    await editExpense.click();
    await page.getByRole("button", { name: "Anular este gasto" }).click();
    const dialog = page.getByRole("dialog", { name: `Anular gasto ${EXPENSE_CODE}` });
    await expect(dialog).toContainText("El registro y su recibo se conservarán");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });
});
