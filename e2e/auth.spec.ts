import { test, expect } from "@playwright/test";
import { requiereSupabase } from "./_helpers/supabase";

/**
 * Tier 1 · e2e de autenticación — casos de RENDER y NEGATIVOS.
 *
 * Cubre las 4 superficies de login del repo, cada una con su mecanismo:
 *   - Studio   (/studio/login) → email + password (signInWithPassword)
 *   - Back     (/back/login)   → email + password (signInWithPassword)
 *   - Portal   (/entrar) → magic link / OTP (solo email, sin password)
 *   - Operario (/m/ve/login)   → PIN (signInWithPin, cookie HTTP-only)
 *
 * Estos tests NO requieren seed ni branch de Supabase: solo verifican que el
 * formulario correcto se renderiza y que un submit inválido NO autentica
 * (la URL sigue en el login, no salta al app).
 *
 * El camino POSITIVO (login OK → redirect al app) vive en los specs de
 * journey, que sí requieren el branch efímero + seed-e2e (ver e2e/README.md).
 *
 * SDD-0470: Studio, Back y las dos del Portal pasan por el matcher de
 * `proxy.ts`, que necesita Supabase público (URL + anon key) aunque no haya
 * seed. Sin esas variables se omiten con motivo (`requiereSupabase()`) en vez
 * de fallar; `/acceso` y el PIN del operario quedan fuera del matcher y corren.
 */

test.describe("Tier 1 · logins (render + negativos)", () => {
  test("Studio: form email+password, submit vacío no autentica", async ({ page }) => {
    requiereSupabase();
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
   * SDD-0250 · migr 0354. El enlace de acceso vive en `/acceso/<token>`, FUERA
   * de `/studio`, porque quien lo abre no tiene sesión. Si alguna vez lo mueven
   * bajo `/studio`, el proxy lo rebotaría al login y el enlace moriría antes de
   * llegar a su pantalla — el bug que este trabajo elimina.
   *
   * Con un token inventado debe RENDERIZAR su mensaje, no redirigir: que se
   * quede en `/acceso/...` prueba que el gate no lo tocó.
   */
  test("Acceso: la pantalla del enlace NO la rebota el proxy al login", async ({ page }) => {
    await page.goto("/acceso/tokenquenoexiste000000000000000000000000000000");
    await expect(page).toHaveURL(/\/acceso\//);
    await expect(page).not.toHaveURL(/\/studio\/login/);
    await expect(page.getByText(/enlace no existe/i)).toBeVisible();
  });

  /**
   * ⚠️ EL CONTRATO CENTRAL DEL ARREGLO: abrir el enlace NO lo consume.
   *
   * La versión anterior canjeaba el token en el GET, y el escáner de correo de
   * Gmail —que abre los enlaces del mensaje apenas llega— lo gastaba antes de
   * que la persona hiciera clic. Ningún enlace llegó vivo a su destinatario.
   *
   * ⚠️ LO QUE ESTE TEST **NO** PRUEBA, y antes decía que sí.
   *
   * Usa un token INEXISTENTE, así que no puede detectar la regresión: si alguien
   * devuelve el consumo al GET, el `update` no encuentra fila que gastar, las dos
   * cargas muestran el mismo mensaje y esto se queda VERDE. La invariante se
   * vigila donde vive —en el código— con
   * `lib/studio/__tests__/token-get-idempotente.test.ts`, que se pone rojo si
   * aparece un `.update()` en el `page.tsx`.
   *
   * Lo que sí prueba, y vale: que la ruta pública renderiza su mensaje de error
   * de forma determinista, sin 500 ni pantalla en blanco, para un token basura
   * repetido.
   *
   * Antes comparaba `body.innerText()` ENTERO entre las dos cargas. Eso lo hacía
   * flakear por la razón equivocada: en la primera carga Next todavía compila y
   * el texto no coincide con el de la segunda (falló así el 2026-08-09). Ahora
   * afirma el marcador estable de la página.
   */
  test("Acceso: un token inválido renderiza el mismo error las dos veces", async ({ page }) => {
    const url = "/acceso/tokenquenoexiste000000000000000000000000000000";
    for (const vuelta of ["primera", "segunda"]) {
      await page.goto(url);
      // Se afirma el ROL, no sólo el texto: `AccesoError` pintaba el título en
      // un <p>, así que un lector de pantalla no encontraba encabezado alguno y
      // la persona quedaba sin punto de entrada. Ya es un <h1>; pedir el rol
      // acá deja fijo ese arreglo — si alguien lo devuelve a <p>, esto cae.
      await expect(
        page.getByRole("heading", { name: /Este enlace no existe/i }),
        `${vuelta} carga: el token basura debe caer en el mensaje de "no existe", y como ENCABEZADO`,
      ).toBeVisible();
      // Y nunca el formulario de clave: eso sería tratar un token inválido como bueno.
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    }
  });

  test("Back: form email+password presente", async ({ page }) => {
    requiereSupabase();
    await page.goto("/back/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("Portal: magic link (email, sin password)", async ({ page }) => {
    requiereSupabase();
    await page.goto("/entrar");
    await expect(page.locator('input[name="email"]').first()).toBeVisible();
    // Portal usa OTP/magic link: NO debe haber campo password.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("Portal: /entrar ofrece las dos puertas, y crear cuenta es un botón", async ({
    page,
  }) => {
    requiereSupabase();
    // SDD-0276. Acá se mide en un navegador de verdad lo que el unit test mide
    // en jsdom: que la fila de crear cuenta EXISTA y tenga tamaño de botón. Era
    // un enlace de 12,5 px, y con la anti-enumeración del login eso dejaba sin
    // salida a quien todavía no tiene cuenta.
    await page.goto("/entrar");

    await expect(
      page.getByRole("heading", { name: /ingresar a mi portal/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /crear mi cuenta y shipping mark/i }),
    ).toBeVisible();

    const crear = page.getByRole("link", { name: /crear mi cuenta/i });
    await expect(crear).toBeVisible();
    await expect(crear).toHaveAttribute("href", "/registro");

    // Altura real de `.btn` (48 px). Un enlace de texto mide ~18.
    const caja = await crear.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(40);
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
