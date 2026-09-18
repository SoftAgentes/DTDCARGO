import { test, expect } from "@playwright/test";
import { escribir } from "./_helpers/escribir";
import { esperarHidratado } from "./_helpers/hidratacion";

/**
 * SDD-0257 · la calculadora cotiza SIN el peso.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE, Y NO SOLO LOS TESTS UNITARIOS.
 *
 * El motor ya está cubierto de sobra por `__tests__/calculadora-sin-peso.test.ts`
 * (23 casos). Lo que NO estaba cubierto es lo único que el cliente toca: que al
 * escribir el CBM y dejar el peso vacío **aparezca un precio en la pantalla**.
 * Esa parte vivía detrás de un booleano del componente (`tieneCarga`), y un
 * booleano de UI no lo ve ningún test de motor.
 *
 * El 2026-08-13 el founder reportó "escribo el CBM y no pasa nada" con el código
 * ya en `main` — porque producción servía un build viejo. El gate no podía
 * verlo: nada recorría la página de verdad. Este spec es ese eslabón.
 *
 * Recorre las DOS pestañas porque son dos `<CalculadoraForm>` distintos montados
 * a la vez (el oculto también existe en el DOM) y las dos tienen que cotizar.
 */
test.describe("SDD-0257 · precio sin el peso", () => {
  test("con CBM y sin peso: hay precio, «Desde», el techo en kg y CTA", async ({
    page,
  }) => {
    await page.goto("/tarifas");

    const panel = page.locator("#panel-ddp");
    const cbm = panel.locator('input[placeholder="12"]');
    const peso = panel.locator('input[placeholder="4800"]');

    // Estado de partida: sin CBM no hay estimado, y el copy ya NO pide el peso.
    await expect(panel).toContainText(/Ingresa tu CBM para ver el estimado/i);
    await expect(panel).not.toContainText(/Ingresa tu CBM y peso/i);

    await escribir(cbm, "12");
    await expect(peso).toHaveValue("");

    // 12 m³ × $850 = $10.200. Se afirma el número: si el precio deja de salir,
    // este test cae — que es justo el bug que motivó la spec. Sin Supabase el
    // e2e cotiza con `CONFIG.tarifaBaseCBM`: el número se mueve con esa
    // constante (SDD-0475).
    await expect(panel).toContainText("10,200");
    await expect(panel).toContainText(/Desde/);
    await expect(panel).toContainText(/Falta el peso/i);

    // El techo son 9.000 kg y NO 12.000: por encima de 9.000 en 12 m³ la carga
    // ya derivaría al asesor (anti-monopolio). Es el número que sostiene el
    // "Desde", así que se afirma explícitamente.
    await expect(panel).toContainText(/hasta 9\.000 kg/);
    await expect(panel).not.toContainText(/hasta 12\.000 kg/);

    // La fila fantasma del desglose: la línea existe, el monto todavía no.
    await expect(panel).toContainText(/falta el peso de tu carga/i);

    // Y lo que era el punto de todo el cambio: se puede enviar.
    const cta = panel.locator('a[href*="wa.me"]');
    await expect(cta).toBeVisible();
    const href = decodeURIComponent((await cta.getAttribute("href")) ?? "");
    expect(href).toContain("Peso total: sin indicar");
    expect(href).not.toContain("Peso total: 0 kg");
  });

  test("al escribir el peso, el estimado deja de ser un piso", async ({
    page,
  }) => {
    await page.goto("/tarifas");

    const panel = page.locator("#panel-ddp");
    await escribir(panel.locator('input[placeholder="12"]'), "12");
    await expect(panel).toContainText(/Desde/);

    await escribir(panel.locator('input[placeholder="4800"]'), "4800");

    // 4.800 kg en 12 m³ no llega al techo → mismo total, pero ya es precio
    // cerrado: se van el "Desde", la píldora y la fila fantasma.
    await expect(panel).toContainText("10,200");
    await expect(panel).not.toContainText(/Falta el peso/i);
    await expect(panel).not.toContainText(/falta el peso de tu carga/i);

    const href = decodeURIComponent(
      (await panel.locator('a[href*="wa.me"]').getAttribute("href")) ?? "",
    );
    expect(href).toContain("Peso total: 4800 kg");
  });

  test("el consolidado también cotiza sin peso, y su puerta de 1 m³ sigue", async ({
    page,
  }) => {
    await page.goto("/tarifas");

    // El toggle es React: si el clic aterriza antes de la hidratación se pierde
    // y el panel no abre nunca — y a diferencia del tecleo, un clic perdido no
    // se recupera solo. Ver `_helpers/hidratacion.ts`.
    const consolidado = page.getByRole("tab").nth(1);
    await esperarHidratado(consolidado, "el toggle de modalidad");
    await consolidado.click();

    const panel = page.locator("#panel-consolidado");
    await expect(panel).toBeVisible();
    const cbm = panel.locator('input[placeholder="12"]');

    // 4 m³ × $580 = $2.320, techo 4 × 1.000 = 4.000 kg (por debajo del tope
    // por envío, así que acá manda el recargo por densidad).
    await escribir(cbm, "4");
    await expect(panel).toContainText("2,320");
    await expect(panel).toContainText(/hasta 4\.000 kg/);

    // Por debajo de 1 m³ NO cotiza, con peso o sin él: el BL propio es un gasto
    // fijo que no baja con el volumen. Eso no lo relajó SDD-0257.
    await escribir(cbm, "0,5");
    await expect(panel).not.toContainText(/Desde/);
    await expect(panel).toContainText(/asesor/i);
  });
});
