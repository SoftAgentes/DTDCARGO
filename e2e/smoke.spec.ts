import { test, expect } from "@playwright/test";

/**
 * Smoke tests E2E — apenas verifican que cada página crítica responde 200
 * y tiene su <h1>/<title> correcto. No testean lógica de negocio, solo
 * que el deploy básico funciona.
 *
 * Si esto falla → algo grande se rompió (build, routing, imports).
 */

test.describe("rutas públicas críticas", () => {
  test("/ renderiza hero con DTD Cargo (wordmark + tagline del brand book)", async ({ page }) => {
    await page.goto("/");
    // Brand book: "DTD Cargo" (dos palabras, Cargo capitalizado). Antes era
    // "DTD·CARGO" (con middot, CARGO todo mayúsculas).
    await expect(page).toHaveTitle(/DTD\s+Cargo/);
    // H1 = tagline-headline (founder 2026-06-14): "Con Confianza, desde China hasta tu puerta."
    await expect(page.locator("h1")).toContainText("Con Confianza");
    await expect(page.locator("h1")).toContainText("tu puerta");
    // Venezuela pasó del H1 al subtítulo (el H1 lidera el beneficio, no el destino).
    await expect(page.locator("body")).toContainText("Venezuela");
    // El cuerpo del hero sigue mencionando China.
    await expect(page.locator("body")).toContainText(/China|Yiwu|cotizar/i);
  });

  test("/servicios lista los 16 servicios", async ({ page }) => {
    await page.goto("/servicios");
    await expect(page).toHaveTitle(/Servicios/);
    // Servicios mencionan FCL y DDP — proxies para "se cargaron los datos"
    await expect(page.locator("body")).toContainText(/FCL|DDP/);
  });

  test("/tarifas monta la calculadora CBM/LCL con sus 2 pestañas", async ({
    page,
  }) => {
    await page.goto("/tarifas");
    await expect(page).toHaveTitle(/Tarifas|calculadora/i);
    // Toggle de modalidad: Puerta a Puerta (DDP) ↔ LCL Consolidado.
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toContainText(/Puerta a Puerta/i);
    await expect(tabs.nth(1)).toContainText(/Consolidado/i);

    // Pestaña A (por default) = puerta a puerta: pide CBM/peso y ciudad destino.
    await expect(page.locator("body")).toContainText(/CBM total/i);
    await expect(page.locator("#ciudad")).toBeVisible();

    // Pestaña B = consolidado: sin ciudad, hasta puerto y con BL propio.
    await tabs.nth(1).click();
    const panelB = page.locator("#panel-consolidado");
    await expect(panelB).toBeVisible();
    await expect(panelB).toContainText(/hasta puerto/i);
    await expect(panelB).toContainText(/Bill of Lading/i);
    await expect(panelB.locator("select#ciudad")).toHaveCount(0);
  });

  test("/fcl muestra el cotizador FCL (contenedor completo)", async ({ page }) => {
    // El FCL sigue standalone en /fcl (cotizador SeaRates), aparte de /tarifas.
    await page.goto("/fcl");
    await expect(page).toHaveTitle(/FCL|flete/i);
    // El form del cotizador FCL es visible (selects origen/destino/contenedor).
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator("body")).toContainText(/FCL|contenedor/i);
  });

  test("las rutas viejas de calc/estimación redirigen (301) a la calc que toca", async ({
    page,
  }) => {
    // CBM/LCL: /cotizar, /estimacion y /calculadora → /tarifas.
    for (const old of ["/cotizar", "/estimacion", "/calculadora"]) {
      await page.goto(old);
      await expect(page).toHaveURL(/\/tarifas$/);
    }
    await expect(page).toHaveTitle(/Tarifas|calculadora/i);

    // FCL: /calculadora-fcl y /cotizador-flete → /fcl (sin cambios).
    for (const old of ["/calculadora-fcl", "/cotizador-flete"]) {
      await page.goto(old);
      await expect(page).toHaveURL(/\/fcl$/);
    }
    await expect(page).toHaveTitle(/FCL|flete/i);
  });

  test("/markbox redirige (301) a /shipping-mark", async ({ page }) => {
    await page.goto("/markbox");
    await expect(page).toHaveURL(/\/shipping-mark$/);
    await expect(page).toHaveTitle(/Shipping Mark/i);
    await expect(page.locator("h1")).toContainText(/identificada/i);
  });

  test("/calculadora-terrestre carga standalone", async ({ page }) => {
    await page.goto("/calculadora-terrestre");
    await expect(page).toHaveTitle(/terrestre/i);
    // La calc terrestre tiene su selector de origen (ciudad VZLA) y destino.
    await expect(page.locator("body")).toContainText(/Último km|Venezuela/i);
  });

  test("/contacto muestra emails y WhatsApp", async ({ page }) => {
    await page.goto("/contacto");
    // Fase 5: la página se renombró a "Contáctenos".
    await expect(page).toHaveTitle(/Contáctenos/);
    await expect(page.locator("body")).toContainText(/dtdcargo\.com/);
  });

  test("/glosario tiene términos sin XSS", async ({ page }) => {
    await page.goto("/glosario");
    // No debe haber tags <b> sin convertir (la nueva renderBolded los convirtió a <strong>)
    const bodyHtml = await page.locator("article").first().innerHTML();
    expect(bodyHtml).not.toContain("<b>");
  });

  test("el rastreo público /track redirige (301) al portal", async ({ page }) => {
    // Fase 6: el rastreo público se retiró (vive dentro del portal). El buscador
    // y los deep-links compartidos por WhatsApp → 301 a /portal/login, sin 404.
    for (const old of ["/track", "/track/S-2026-0142"]) {
      await page.goto(old);
      await expect(page).toHaveURL(/\/portal\/login/);
    }
  });
});

test.describe("SEO essentials", () => {
  test("robots.txt responde 200", async ({ request }) => {
    const r = await request.get("/robots.txt");
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("Sitemap:");
  });

  test("sitemap.xml lista las rutas", async ({ request }) => {
    const r = await request.get("/sitemap.xml");
    expect(r.status()).toBe(200);
    const xml = await r.text();
    expect(xml).toContain("/servicios");
    expect(xml).toContain("/tarifas");
    expect(xml).toContain("/fcl");
    expect(xml).toContain("/shipping-mark");
    expect(xml).toContain("/calculadora-terrestre");
    expect(xml).not.toContain("/cotizar");
  });
});

test.describe("security headers (M2 fix)", () => {
  test("CSP, X-Frame-Options, Referrer-Policy, HSTS presentes", async ({
    request,
  }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["content-security-policy"]).toBeTruthy();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("CSP bloquea iframe externos (frame-ancestors none)", async ({
    request,
  }) => {
    const r = await request.get("/servicios");
    const csp = r.headers()["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
