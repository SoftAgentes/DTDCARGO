import { test, expect, type Page } from "@playwright/test";
import { esperarHidratado } from "./_helpers/hidratacion";

/**
 * Contrato: la web pública no tiene scroll horizontal en pantallas angostas.
 *
 * Medido el 2026-08-20 en producción y reproducido en local: a 320px de ancho
 * (iPhone SE de 1ª generación) `/tarifas` daba `scrollWidth` 334 contra
 * `clientWidth` 320. Dos culpables independientes:
 *
 *  1. La barra pública: lockup 167,4 + hamburguesa 44 + gap 8 + CTA 95 = 314,4
 *     dentro de 280px de contenido → "Regístrate" se salía 14px de la pantalla.
 *  2. `.calc-switch` de /tarifas: `grid-template-columns: 1fr` deja el mínimo
 *     automático de la pista en `min-content`, así que la pista creció a 301,9
 *     dentro de un contenedor de 280 y el botón se salió 1,9px.
 *
 * El desborde de la barra afecta a TODA la web pública, no a una página: por
 * eso el barrido no se queda en /tarifas.
 *
 * ⚠️ Ojo con el diagnóstico: el velo y el drawer CERRADO (`fixed`) reportaban
 * 334 de ancho y parecían culpables. No lo eran — un elemento `fixed` no
 * extiende el área de scroll del documento; reportaban 334 porque el ICB ya se
 * había ensanchado por el desborde de la barra. Ocultándolos, el `scrollWidth`
 * se quedaba en 334. Por eso el reporte de abajo IGNORA los `fixed`: son
 * síntoma y mandan a arreglar el elemento equivocado.
 */

const ANCHOS = [320, 360, 375] as const;
const RUTAS = ["/", "/tarifas", "/faq"] as const;

// El runner cerrado de SDD-0580 instala también el proxy local. El contrato
// normal conserva el entorno general; en ensayo nunca salen solicitudes.
test.beforeEach(async ({ context }) => {
  if (!process.env.DTD_UI_PROXY) return;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        ["data:", "blob:"].includes(url.protocol)) return route.continue();
    throw new Error(`Solicitud externa bloqueada: ${url.origin}`);
  });
});

for (const width of [320, 360, 375, 390, 414, 430, 640, 768, 1280]) {
  test(`Shipping Mark íntegro a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await comprobarShippingMark(page);
  });
}

for (const width of [320, 375, 768, 1280]) {
  test(`Shipping Mark con texto 200% a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await esperarHidratado(page.locator('.hero-ctas > a[href="/registro"]'), "CTA antes de ampliar texto");
    await page.evaluate(() => {
      // Ampliación de texto exclusivamente; no CSS zoom ni zoom nativo.
      const sizes = [...document.querySelectorAll<HTMLElement>(".home-surface *")]
        .map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }));
      for (const { el, size } of sizes) el.style.fontSize = `${size * 2}px`;
    });
    await comprobarShippingMark(page);
  });
}

async function comprobarShippingMark(page: Page) {
  const vecino = await page.locator('.hero-ctas > a[href="/tarifas"]').evaluate((el) => {
    const box = el.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(el);
    return { width:box.width,height:box.height,font:parseFloat(getComputedStyle(el).fontSize),
      inside:[...range.getClientRects()].every(r => r.left >= box.left-.5 && r.right <= box.right+.5 && r.top >= box.top-.5 && r.bottom <= box.bottom+.5) };
  });
  expect(vecino.inside, JSON.stringify(vecino)).toBe(true);
  if (vecino.font === 17) expect(vecino.height).toBe(48);
  const ctas = page.locator(".hero-ctas > a, .final-ctas > a")
    .filter({ hasText: "Regístrate y obtén tu Shipping Mark" });
  await expect(ctas).toHaveCount(2);
  for (const cta of await ctas.all()) {
    await expect(cta).toHaveAccessibleName('Regístrate y obtén tu Shipping Mark "Casillero"');
    await expect(cta).toHaveAttribute("href", "/registro");
    const measured = await cta.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const [label, casillero] = [...el.children].map((s) => s.getBoundingClientRect());
      const required = label.height + casillero.height + parseFloat(cs.rowGap) +
        parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      return {
        width:b.width, height:b.height, required,
        textInside:[label,casillero].every((r) => r.left >= b.left - .5 && r.right <= b.right + .5 && r.top >= b.top - .5 && r.bottom <= b.bottom + .5),
        below:casillero.top >= label.bottom,
        strike:getComputedStyle(el.children[1]).textDecorationLine,
        fontLoaded:document.fonts.check(`${cs.fontSize} ${cs.fontFamily}`) &&
          [...document.fonts].some((face) => face.family.replaceAll('"', '') === "archivo" && face.status === "loaded"),
        viewportInside:b.left >= -.5 && b.right <= document.documentElement.clientWidth + .5,
      };
    });
    expect(measured.fontLoaded).toBe(true);
    expect(measured.height, JSON.stringify(measured)).toBeGreaterThanOrEqual(measured.required - .5);
    expect(measured.textInside, JSON.stringify(measured)).toBe(true);
    expect(measured.below).toBe(true);
    expect(measured.strike).toContain("line-through");
    expect(measured.viewportInside).toBe(true);
    expect(measured.width).toBeGreaterThanOrEqual(44);
    expect(measured.height).toBeGreaterThanOrEqual(44);
    await cta.focus();
    await expect(cta).toBeFocused();
    const focus = await cta.evaluate((el) => ({ visible:el.matches(":focus-visible"), style:getComputedStyle(el).outlineStyle, width:parseFloat(getComputedStyle(el).outlineWidth) }));
    expect(focus.visible).toBe(true);
    expect(focus.style).not.toBe("none");
    expect(focus.width).toBeGreaterThanOrEqual(2);
  }
}

test.describe("activación de Shipping Mark", () => {
test.use({ hasTouch: true });
test("los dos CTA navegan a registro con teclado y toque sin enviar datos", async ({ page }, testInfo) => {
  const navigation: { selector:string; method:string; milliseconds:number }[] = [];
  for (const selector of [".hero-ctas", ".final-ctas"]) {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const cta = page.locator(`${selector} > a[href='/registro']`);
    await esperarHidratado(cta, "CTA Shipping Mark");
    await cta.focus();
    await expect(cta).toBeFocused();
    let start = Date.now();
    await Promise.all([page.waitForURL(/\/registro$/, { timeout:20_000 }), cta.press("Enter")]);
    navigation.push({selector,method:"Enter",milliseconds:Date.now()-start});
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const touchCta = page.locator(`${selector} > a[href='/registro']`);
    await esperarHidratado(touchCta, "CTA Shipping Mark para toque");
    start = Date.now();
    await Promise.all([page.waitForURL(/\/registro$/, { timeout:20_000 }), touchCta.tap()]);
    navigation.push({selector,method:"tap",milliseconds:Date.now()-start});
  }
  await testInfo.attach("navegaciones-locales", { body:JSON.stringify(navigation),contentType:"application/json" });
});
});

/**
 * Mide el desborde horizontal del documento.
 *
 * Oculta antes el toolbar de Agentation, que `app/layout.tsx` monta SOLO con
 * `NODE_ENV === "development"` — y el webServer de este config corre
 * `next dev`. Sin ocultarlo, el test mediría un artefacto que producción no
 * tiene. (Medido: hoy no mueve el `scrollWidth`, pero es dev-only igual.)
 */
async function medirDesborde(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const toolbar = document.querySelector('[class*="styles-module__toolbar"]');
    let agentation = toolbar;
    while (agentation && agentation.parentElement !== document.body) {
      agentation = agentation.parentElement;
    }
    const previo = agentation ? (agentation as HTMLElement).style.display : null;
    if (agentation) (agentation as HTMLElement).style.display = "none";

    const clientWidth = de.clientWidth;
    const scrollWidth = de.scrollWidth;
    const culpables: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (agentation?.contains(el)) continue;
      // Los `fixed` no extienden el área de scroll: si se salen, es porque otro
      // elemento ya ensanchó el ICB. Reportarlos es mandar a arreglar el síntoma.
      if (getComputedStyle(el).position === "fixed") continue;
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 && caja.height === 0) continue;
      if (caja.right > clientWidth + 0.5 || caja.left < -0.5) {
        culpables.push(
          `${el.tagName.toLowerCase()}.${String(el.className || "").slice(0, 70)} [${caja.left.toFixed(1)} → ${caja.right.toFixed(1)}]`,
        );
      }
    }

    if (agentation) (agentation as HTMLElement).style.display = previo ?? "";
    return { scrollWidth, clientWidth, culpables: culpables.slice(0, 6) };
  });
}

for (const ancho of ANCHOS) {
  test.describe(`sin scroll horizontal a ${ancho}px`, () => {
    test.use({ viewport: { width: ancho, height: 780 } });

    for (const ruta of RUTAS) {
      test(`${ruta} cierra en ${ancho}px`, async ({ page }) => {
        await page.goto(ruta);
        // El lockup del nav se pinta con next/image: sin esperar la carga, su
        // ancho puede medirse antes de que la imagen ocupe su caja.
        await page.waitForLoadState("networkidle");

        const { scrollWidth, clientWidth, culpables } = await medirDesborde(page);
        expect(
          scrollWidth,
          `${ruta} @${ancho}px desborda ${scrollWidth - clientWidth}px.\nSe salen:\n  ${culpables.join("\n  ")}`,
        ).toBe(clientWidth);
      });
    }
  });
}

test.describe("el drawer del menú móvil sigue funcionando a 320px", () => {
  test.use({ viewport: { width: 320, height: 780 } });

  test("abre dentro de la pantalla y cierra con Escape", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const drawer = page.locator("#mobile-drawer");
    const abrir = page.getByRole("button", { name: "Abrir menú" });

    // Cerrado: está fuera de pantalla a la derecha y no suma scroll horizontal.
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    const antes = await medirDesborde(page);
    expect(antes.scrollWidth).toBe(antes.clientWidth);

    // `networkidle` NO es hidratación: la red se calla y React todavía puede no
    // haber tomado el botón. Sin esta espera el clic se pierde y `aria-hidden`
    // se queda en "true" — es lo que hacía flakear este test en mobile-safari.
    // Ver `_helpers/hidratacion.ts`.
    await esperarHidratado(abrir, "el botón del menú móvil");
    await abrir.click();
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(drawer).toBeVisible();

    // Abierto: el panel entra completo en la pantalla (no se sale por la derecha
    // ni queda medio cortado). Va con `poll` porque el drawer entra con una
    // transición de 300ms: `toBeVisible()` resuelve apenas empieza a deslizar y
    // ahí el borde derecho todavía está fuera de pantalla (medido: 352 de 320).
    await expect
      .poll(async () => {
        const c = await drawer.boundingBox();
        return c ? Math.round(c.x + c.width) : null;
      })
      .toBe(320);
    const caja = await drawer.boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    await expect(drawer.getByRole("link", { name: "Tarifas" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    // Y al cerrarse tampoco deja scroll horizontal detrás.
    const despues = await medirDesborde(page);
    expect(despues.scrollWidth).toBe(despues.clientWidth);
  });
});
