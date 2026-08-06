import { test, expect } from "@playwright/test";

/**
 * Tier 1 · e2e de autenticación — casos de RENDER y NEGATIVOS.
 *
 * Cubre las 4 superficies de login del repo, cada una con su mecanismo:
 *   - Studio   (/studio/login) → email + password (signInWithPassword)
 *   - Back     (/back/login)   → email + password (signInWithPassword)
 *   - Portal   (/portal/login) → magic link / OTP (solo email, sin password)
 *   - Operario (/m/ve/login)   → PIN (signInWithPin, cookie HTTP-only)
 *
 * Estos tests NO requieren seed ni branch de Supabase: solo verifican que el
 * formulario correcto se renderiza y que un submit inválido NO autentica
 * (la URL sigue en el login, no salta al app).
 *
 * El camino POSITIVO (login OK → redirect al app) vive en los specs de
 * journey, que sí requieren el branch efímero + seed-e2e (ver e2e/README.md).
 */

test.describe("Tier 1 · logins (render + negativos)", () => {
  test("Studio: form email+password, submit vacío no autentica", async ({ page }) => {
    await page.goto("/studio/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    await page.locator('button[type="submit"]').click();
    // Sin credenciales válidas, NO debe entrar al ERP.
    await expect(page).toHaveURL(/\/studio\/login/);
    await expect(page).not.toHaveURL(/\/studio\/resumen/);
  });

  /**
   * SDD-0250. El proxy rebota TODO `/studio/**` sin sesión al login — pero la
   * ruta que canjea el enlace de acceso del correo, por definición, se pide SIN
   * sesión (crearla es su trabajo). Si vuelve a quedar detrás del gate, el
   * enlace muere antes de llegar al handler y el usuario aterriza en el login
   * sin explicación: exactamente el bug que este trabajo elimina.
   *
   * Cómo se distingue: el rebote del proxy deja `/studio/login` PELADO (clona
   * la URL, que no trae query). Que llegue con `?error=enlace` prueba que quien
   * redirigió fue nuestro handler, o sea que el proxy lo dejó pasar.
   */
  test("Studio: la ruta del enlace de acceso NO la rebota el proxy", async ({ page }) => {
    await page.goto("/studio/reset/confirmar");
    await expect(page).toHaveURL(/error=enlace/);
  });

  test("Studio: la pantalla de clave nueva sin sesión avisa, no rebota muda", async ({ page }) => {
    await page.goto("/studio/reset");
    await expect(page).toHaveURL(/error=enlace/);
  });

  test("Back: form email+password presente", async ({ page }) => {
    await page.goto("/back/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("Portal: magic link (email, sin password)", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.locator('input[name="email"]').first()).toBeVisible();
    // Portal usa OTP/magic link: NO debe haber campo password.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("Operario VE: numpad de PIN (4 dígitos)", async ({ page }) => {
    await page.goto("/m/ve/login");
    // El login de operario es un numpad de botones (no <input name="pin">):
    // el PIN se arma en estado React y se envía vía hidden field.
    await expect(page.getByText(/Ingresa tu PIN/i)).toBeVisible();
    // Los dígitos 0-9 son botones type="button".
    await expect(page.getByRole("button", { name: "1", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "9", exact: true })).toBeVisible();
  });
});
