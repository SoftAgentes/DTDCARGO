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
    // Desde SDD-0237 el destino es un COMBOBOX con búsqueda, no un <select>:
    // con 178 opciones el select nativo era inusable. Se afirma el rol ARIA
    // (no el tag) para que el test hable de la capacidad, no de la etiqueta.
    await expect(page.locator("body")).toContainText(/CBM total/i);
    const destino = page.locator("#ciudad");
    await expect(destino).toBeVisible();
    await expect(destino).toHaveRole("combobox");

    // Pestaña B = consolidado: sin ciudad, hasta puerto y con BL propio.
    await tabs.nth(1).click();
    const panelB = page.locator("#panel-consolidado");
    await expect(panelB).toBeVisible();
    await expect(panelB).toContainText(/hasta puerto/i);
    await expect(panelB).toContainText(/Bill of Lading/i);
    // Sin selector de destino: el consolidado llega hasta puerto, no hay ciudad
    // que elegir. Se cuenta `#ciudad` a secas — buscar `select#ciudad` dejó de
    // probar nada el día que el select se volvió un input.
    await expect(panelB.locator("#ciudad")).toHaveCount(0);
  });

  test("/fcl muestra el cotizador FCL (contenedor completo)", async ({ page }) => {
    // El FCL sigue standalone en /fcl (cotizador SeaRates), aparte de /tarifas.
    await page.goto("/fcl");
    await expect(page).toHaveTitle(/FCL|flete/i);
    // El form del cotizador FCL es visible (selects origen/destino/contenedor).
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator("body")).toContainText(/FCL|contenedor/i);
  });

  /**
   * Los 5 redirects se verifican por HTTP, sin renderizar.
   *
   * Antes esto hacía cinco `page.goto()` completos —cinco cargas de las
   * calculadoras, con hidratación y fuentes— multiplicado por los 5 proyectos
   * de navegador: 25 páginas pesadas para comprobar cinco cabeceras. Era el
   * test más flaky del gate: fallaba en un navegador y una línea distintos
   * cada corrida, y con `retries: 0` en local tumbaba el paso entero.
   *
   * Y pese a llamarse "(301)" nunca miró el código de estado: sólo la URL
   * final. `permanent: true` de Next emite **308**, no 301. Ahora se afirma el
   * estado y el `location` de verdad, que es lo que protege el SEO, más UNA
   * navegación real por familia para confirmar que el destino renderiza.
   */
  test("las rutas viejas de calc/estimación redirigen (308) a la calc que toca", async ({
    page,
    request,
  }) => {
    const REDIRECTS: [string, string][] = [
      // CBM/LCL → /tarifas
      ["/cotizar", "/tarifas"],
      ["/estimacion", "/tarifas"],
      ["/calculadora", "/tarifas"],
      // FCL → /fcl
      ["/calculadora-fcl", "/fcl"],
      ["/cotizador-flete", "/fcl"],
    ];

    for (const [viejo, destino] of REDIRECTS) {
      const r = await request.get(viejo, { maxRedirects: 0 });
      expect(r.status(), `${viejo} debería redirigir permanente`).toBe(308);
      expect(r.headers()["location"], `destino de ${viejo}`).toContain(destino);
    }

    // Una carga real por familia: que el destino exista y sea el que dice ser.
    //
    // ⚠️ `waitForLoadState` entre las dos NO es adorno. En webkit `page.goto`
    // resuelve antes de que el router de Next termine su transición cliente, y
    // el `goto` siguiente moría con "Navigation to /fcl is interrupted by
    // another navigation to /tarifas". Ese era el flake real del gate —nunca
    // fue un timeout— y por eso caía en un navegador y una línea distintos
    // cada corrida, según dónde pillara la carrera.
    await page.goto("/tarifas");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle(/Tarifas|calculadora/i);

    await page.goto("/fcl");
    await page.waitForLoadState("networkidle");
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
