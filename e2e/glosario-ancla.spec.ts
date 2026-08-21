import { test, expect, type Page } from "@playwright/test";

/**
 * Contrato: quien cae en el glosario por un ancla ve CUÁL es su ficha.
 *
 * Desde que la jerga del sitio enlaza acá (LNK-01), al glosario ya no se entra
 * por arriba y se lee en orden: se llega a `/glosario#bl` en una pestaña nueva,
 * a mitad de una página con 15 fichas. Medido en producción el 2026-08-20, la
 * ficha de destino no se distinguía en NADA de las otras catorce — no había una
 * sola regla `:target` en el CSS del sitio. El visitante aterrizaba en un muro
 * de texto y tenía que adivinar cuál había pedido.
 *
 * Lo que se protege acá es CSS puro, que es justo lo que ningún test de unidad
 * ve: un refactor de `app/recursos.css` puede borrar el resalte sin romper nada
 * más, y la página seguiría "funcionando".
 *
 * 🔴 **El contraste es parte del contrato, no un extra.** El primer intento
 * pintaba la ficha con `--wine-tint`, que es translúcido: compuesto sobre el
 * papel dejaba el texto de la definición en 4,35:1, por debajo del 4,5 de la
 * marca. O sea, resaltar la ficha la habría hecho menos legible. Por eso el
 * resalte ACLARA el fondo y el test afirma que el contraste de la ficha
 * marcada **no baja** respecto de una normal.
 */

const ANCLA = "bl";
const OTRA = "cbm";

/** Contraste WCAG entre dos colores ya resueltos por el navegador. */
async function medir(page: Page, id: string) {
  return page.evaluate((termId) => {
    const el = document.getElementById(termId);
    if (!el) return null;
    const def = el.querySelector(".gl-def");
    const cs = getComputedStyle(el);

    // El fondo efectivo: si la ficha es transparente, el que se ve es el del
    // documento. Sin esto se mediría contraste contra rgba(0,0,0,0).
    const propio = cs.backgroundColor;
    const fondo =
      propio === "rgba(0, 0, 0, 0)" || propio === "transparent"
        ? getComputedStyle(document.body).backgroundColor
        : propio;

    const px = (c: string) =>
      (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
    const lum = (rgb: number[]) => {
      const s = rgb.map((v) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    const ratio = (a: string, b: string) => {
      const l1 = lum(px(a));
      const l2 = lum(px(b));
      const hi = Math.max(l1, l2);
      const lo = Math.min(l1, l2);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };

    const r = el.getBoundingClientRect();
    return {
      fondo,
      sombra: cs.boxShadow,
      contraste: def ? ratio(getComputedStyle(def).color, fondo) : 0,
      ancho: Math.round(r.width),
      izquierda: Math.round(r.left),
    };
  }, id);
}

test.describe("glosario · llegar por un ancla", () => {
  test("la ficha de destino se distingue de las demás", async ({ page }) => {
    await page.goto(`/glosario#${ANCLA}`);

    const destino = await medir(page, ANCLA);
    const vecina = await medir(page, OTRA);
    expect(destino, `no existe #${ANCLA} en /glosario`).not.toBeNull();
    expect(vecina).not.toBeNull();

    // Se distingue por fondo Y por la barra lateral: dos señales, no sólo
    // color — quien no percibe el matiz igual ve la barra.
    expect(destino!.fondo).not.toBe(vecina!.fondo);
    expect(destino!.sombra).not.toBe(vecina!.sombra);
    expect(destino!.sombra).toContain("inset");
  });

  test("resaltarla no le baja el contraste al texto", async ({ page }) => {
    await page.goto(`/glosario#${ANCLA}`);
    const destino = await medir(page, ANCLA);
    const vecina = await medir(page, OTRA);

    expect(destino!.contraste).toBeGreaterThanOrEqual(4.5);
    // Lo que mató al primer intento: el resalte empeoraba la legibilidad.
    expect(destino!.contraste).toBeGreaterThanOrEqual(vecina!.contraste);
  });

  // La marca va en `box-shadow: inset` justamente para no ocupar layout. Un
  // `border-left` correría el texto y un margen negativo puede abrir scroll
  // horizontal en pantallas angostas — el bug que se acaba de cerrar a 320px.
  test("no cambia el ancho ni abre scroll horizontal a 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/glosario#${ANCLA}`);

    const destino = await medir(page, ANCLA);
    const vecina = await medir(page, OTRA);
    expect(destino!.ancho).toBe(vecina!.ancho);
    expect(destino!.izquierda).toBe(vecina!.izquierda);

    const desborde = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(desborde.scroll).toBeLessThanOrEqual(desborde.cliente);
  });

  // El ancla tiene que dejar la ficha VISIBLE, no debajo de la barra pegajosa.
  test("el ancla no deja la ficha tapada por la barra", async ({ page }) => {
    await page.goto(`/glosario#${ANCLA}`);
    const visible = await page.evaluate((termId) => {
      const el = document.getElementById(termId);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const barra = document.querySelector("header, nav");
      const b = barra?.getBoundingClientRect();
      return { top: r.top, bajoLaBarra: b ? r.top < b.bottom : false };
    }, ANCLA);
    expect(visible!.bajoLaBarra).toBe(false);
    expect(visible!.top).toBeGreaterThanOrEqual(0);
  });
});
