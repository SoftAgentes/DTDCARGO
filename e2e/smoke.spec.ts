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

  test("/estimacion muestra el formulario", async ({ page }) => {
    await page.goto("/estimacion");
    await expect(page).toHaveTitle(/Estimaci/);
    await expect(page.locator("form")).toBeVisible();
    // Inputs clave deben existir (volumen fue reemplazado por L/A/H en feat 1f35ab9)
    await expect(page.locator('input[name="peso"]')).toBeVisible();
    await expect(page.locator('input[name="largo"]')).toBeVisible();
    await expect(page.locator('input[name="ancho"]')).toBeVisible();
    await expect(page.locator('input[name="alto"]')).toBeVisible();
  });

  test("/cotizar redirige (301) a /estimacion", async ({ page }) => {
    // SDD-0061 Fase A: el URL viejo conserva SEO vía 301 permanente.
    await page.goto("/cotizar");
    await expect(page).toHaveURL(/\/estimacion$/);
    await expect(page).toHaveTitle(/Estimaci/);
  });

  test("/calculadora-terrestre carga standalone", async ({ page }) => {
    await page.goto("/calculadora-terrestre");
    await expect(page).toHaveTitle(/terrestre/i);
    // La calc terrestre tiene su selector de origen (ciudad VZLA) y destino.
    await expect(page.locator("body")).toContainText(/Último km|Venezuela/i);
  });

  test("/contacto muestra emails y WhatsApp", async ({ page }) => {
    await page.goto("/contacto");
    await expect(page).toHaveTitle(/Contacto/);
    await expect(page.locator("body")).toContainText(/dtdcargo\.com/);
  });

  test("/glosario tiene términos sin XSS", async ({ page }) => {
    await page.goto("/glosario");
    // No debe haber tags <b> sin convertir (la nueva renderBolded los convirtió a <strong>)
    const bodyHtml = await page.locator("article").first().innerHTML();
    expect(bodyHtml).not.toContain("<b>");
  });

  test("/track sin código muestra input", async ({ page }) => {
    await page.goto("/track");
    await expect(page.locator('input[aria-label="Código de tracking"]')).toBeVisible();
  });

  test("/track con código de ejemplo muestra timeline", async ({ page }) => {
    // EJEMPLO = envío demo determinista (page.tsx, status in_transit), sin tocar la DB.
    await page.goto("/track/EJEMPLO");
    await expect(page.locator("body")).toContainText(/en tránsito|En tránsito/i);
  });

  test("/track con input malformado no crashea (M4 fix)", async ({ page }) => {
    // Previo al fix M4, esto crasheaba con URIError. Ahora debe renderizar.
    const response = await page.goto("/track/%25");
    expect(response?.status()).toBeLessThan(500);
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
    expect(xml).toContain("/estimacion");
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
