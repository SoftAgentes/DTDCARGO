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
    //
    // El clic va dentro de `toPass` porque `click()` espera a que la pestaña sea
    // accionable pero NO a que React haya enganchado el handler: bajo carga
    // aterriza antes de la hidratación, se pierde, y el `toBeVisible()` espera
    // para siempre un panel que ya nadie va a abrir. Se consulta `aria-selected`
    // primero para que el bloque sea idempotente — un toggle reintentado a
    // ciegas volvería a la pestaña A.
    const panelB = page.locator("#panel-consolidado");
    await expect(async () => {
      if ((await tabs.nth(1).getAttribute("aria-selected")) !== "true") {
        await tabs.nth(1).click();
      }
      await expect(panelB).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    await expect(panelB).toContainText(/hasta puerto/i);
    await expect(panelB).toContainText(/Bill of Lading/i);
    // Sin selector de destino: el consolidado llega hasta puerto, no hay ciudad
    // que elegir. Se cuenta `#ciudad` a secas — buscar `select#ciudad` dejó de
    // probar nada el día que el select se volvió un input.
    await expect(panelB.locator("#ciudad")).toHaveCount(0);
  });

  test("/fcl siempre ofrece una vía para cotizar el contenedor", async ({ page }) => {
    // El FCL vive standalone en /fcl, aparte de /tarifas (LCL). Desde SDD-0290 lo
    // alimentan las tarifas PROPIAS de DTD (`public_fcl_rates`), no un proveedor
    // externo.
    //
    // ⚠️ Este test NO afirma que haya un precio en pantalla, y es a propósito: si
    // ninguna tarifa está marcada `is_public`, <FclCalculator> muestra su estado
    // vacío y deriva a WhatsApp. Ambos estados son correctos, y el entorno de CI
    // no controla qué hay publicado en la base. Lo que SÍ tiene que cumplirse
    // siempre es que el cliente pueda cotizar por algún lado.
    //
    // Tampoco busca un <form>: el calculador propio son selects sueltos dentro de
    // un div, no un formulario. Afirmarlo era lo que ataba este test al cotizador
    // viejo.
    await page.goto("/fcl");
    await expect(page).toHaveTitle(/FCL|flete/i);
    await expect(page.locator("body")).toContainText(/contenedor/i);
    // La salida a WhatsApp existe en los dos estados: con tarifas y sin ellas.
    await expect(page.locator('a[href*="wa.me"]').first()).toBeVisible();
  });

  test("las rutas viejas de calc/estimación redirigen (301) a la calc que toca", async ({
    page,
  }) => {
    // CINCO navegaciones completas en un solo test, cada una con su compilación
    // y su render. Con los 60s por defecto el presupuesto alcanza en seco pero
    // no cuando corren tres navegadores en paralelo: el 2026-08-09 murió acá con
    // "Test timeout of 60000ms exceeded" en la tercera. No es lentitud de la
    // app, es el presupuesto del test.
    test.setTimeout(150_000);

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

  test("el rastreo público /track redirige a la puerta", async ({ page }) => {
    // Fase 6: el rastreo público se retiró (vive dentro del portal). El buscador
    // y los deep-links compartidos por WhatsApp → 301 a /entrar, sin 404.
    // SDD-0276: apuntan DIRECTO a /entrar. Si volvieran a pasar por
    // /portal/login serían dos saltos encadenados, y el `toHaveURL` de acá no
    // lo notaría —la URL final sería la misma—, así que además se mide el
    // destino declarado del redirect en el caso de abajo.
    for (const old of ["/track", "/track/S-2026-0142"]) {
      await page.goto(old);
      await expect(page).toHaveURL(/\/entrar/);
    }
  });

  test("el viejo /portal/login redirige permanente a /entrar sin perder el query", async ({
    request,
  }) => {
    // SDD-0276: los correos de bienvenida e invitación ya enviados apuntan a
    // /portal/login?email=… Si el redirect perdiera el query, el cliente
    // llegaría a la puerta con el campo vacío y tendría que escribir su correo
    // a mano.
    // ⚠️ 308, no 301: `permanent: true` de Next emite 308 (medido, no supuesto —
    // el comentario histórico de este archivo decía 301 y nunca se comprobó
    // porque sólo se miraba la URL final).
    const r = await request.get("/portal/login?email=sam%40ejemplo.com", {
      maxRedirects: 0,
    });
    expect(r.status()).toBe(308);
    const destino = r.headers()["location"];
    expect(destino).toContain("/entrar");
    expect(destino).toContain("email=sam%40ejemplo.com");
  });

  test("/track llega a la puerta en UN solo salto", async ({ request }) => {
    const r = await request.get("/track", { maxRedirects: 0 });
    expect(r.status()).toBe(308);
    // Directo a /entrar: encadenar dos permanentes diluye equity SEO y suma un
    // salto a cada enlace que el equipo comparte por WhatsApp.
    expect(r.headers()["location"]).toContain("/entrar");
    expect(r.headers()["location"]).not.toContain("/portal/login");
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
