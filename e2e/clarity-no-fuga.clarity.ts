import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Microsoft Clarity · no-fuga (fase 1). Config: `playwright.clarity.config.ts`.
 *
 * Falla si aparece una petición a `*.clarity.ms`:
 *  · al abrir directamente una ruta privada o excluida, aun con consentimiento;
 *  · después de pasar del sitio público a una zona privada con navegación
 *    cliente (enlace de Next y `router.push`).
 *
 * La etiqueta de Clarity es FALSA (nada sale a Microsoft): procesa la cola y
 * late cada 200 ms contra `https://e.clarity.ms/collect` mientras siga viva.
 * Si el corte no funcionara, el latido seguiría tras entrar a la zona privada.
 *
 * Además mide el consentimiento (evaluación §3.4): en público carga sin cookies
 * y la primera señal es `consentv2` denegado, salvo con `granted` exacto; el
 * banner manda `consentv2` concedido al aceptar y `consent false` al rechazar.
 */

const FAKE_TAG = `(function(){
  var q=(window.clarity&&window.clarity.q)||[];
  window.__clarityCalls=q.map(function(a){return Array.prototype.slice.call(a);});
  var stopped=false;
  window.clarity=function(){var a=Array.prototype.slice.call(arguments);window.__clarityCalls.push(a);if(a[0]==='consent'&&a[1]===false)stopped=true;};
  function beat(){if(stopped)return;fetch('https://e.clarity.ms/collect',{method:'POST',body:location.pathname+location.search,mode:'no-cors',keepalive:true}).catch(function(){});}
  beat();setInterval(beat,200);
})();`;

type Hit = { url: string; at: number };

/**
 * Corta la red y, salvo que se pida lo contrario, deja la cookie de
 * consentimiento en `granted`: así las rutas excluidas se prueban en el caso
 * más exigente (la persona aceptó y aun así no se carga).
 */
async function aislar(context: BrowserContext, { consent = "granted" as string | null } = {}): Promise<Hit[]> {
  const hits: Hit[] = [];
  if (consent) {
    const base = test.info().project.use.baseURL ?? "http://localhost:3071";
    await context.addCookies([{ name: "dtd_cookie_consent", value: consent, url: base }]);
  }
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.continue();
    if (url.hostname === "clarity.ms" || url.hostname.endsWith(".clarity.ms")) {
      hits.push({ url: url.href, at: Date.now() });
      if (url.hostname === "www.clarity.ms" && url.pathname.startsWith("/tag/")) {
        return route.fulfill({ contentType: "text/javascript", body: FAKE_TAG });
      }
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" });
    }
    return route.abort("blockedbyclient");
  });
  return hits;
}

/** Espera la carga del documento y un margen para `lazyOnload` y el latido. */
async function asentar(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1_500);
}

async function publicaConClarityViva(page: Page, hits: Hit[]) {
  await page.goto("/servicios");
  // Sin esto la prueba sería vacía: hay que ver la etiqueta y el latido.
  await expect.poll(() => hits.some((h) => h.url.includes("/tag/synthetic00")), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => hits.some((h) => h.url.includes("/collect")), { timeout: 10_000 }).toBe(true);
  expect(await page.evaluate(() => typeof window.clarity)).toBe("function");
}

for (const [consent, analytics] of [
  [null, "denied"],
  ["denied", "denied"],
  ["granted-x", "denied"],
  ["granted", "granted"],
] as const) {
  test(`público con cookie ${consent ?? "ausente"}: carga y la primera señal es analytics_Storage=${analytics}`, async ({ page, context }) => {
    const hits = await aislar(context, { consent });
    await publicaConClarityViva(page, hits);
    const calls = await page.evaluate(() => (window as unknown as { __clarityCalls: unknown[][] }).__clarityCalls);
    expect(calls[0]).toEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: analytics }]);
  });
}

test("público: aceptar y después rechazar en el banner llama a consentv2 y a consent false", async ({ page, context }) => {
  const hits = await aislar(context, { consent: null });
  await publicaConClarityViva(page, hits);
  // `dispatchEvent`: en `next dev` el overlay de errores (`nextjs-portal`) puede
  // tapar el banner y robar el clic por coordenadas.
  const prefs = page.getByRole("button", { name: /preferencias de cookies/i }).first();
  await prefs.dispatchEvent("click");
  await page.getByRole("button", { name: "Aceptar", exact: true }).dispatchEvent("click");
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("dtd_cookie_consent=granted");
  await prefs.dispatchEvent("click");
  await page.getByRole("button", { name: "Rechazar", exact: true }).dispatchEvent("click");
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("dtd_cookie_consent=denied");
  const calls = await page.evaluate(() => (window as unknown as { __clarityCalls: unknown[][] }).__clarityCalls);
  expect(calls.slice(1)).toEqual([
    ["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }],
    ["consent", false],
  ]);
});

for (const path of [
  "/portal",
  "/studio",
  "/registro",
  "/entrar",
  "/abrir?token_hash=SYNTHETIC&type=magiclink",
  "/servicios?email=SYNTHETIC",
  "/servicios#access_token=SYNTHETIC",
]) {
  test(`ruta excluida ${path}: ninguna petición a *.clarity.ms`, async ({ page, context }) => {
    const hits = await aislar(context);
    await page.goto(path);
    await asentar(page);
    // El runtime de Clarity montó (hubo hidratación): sin esto un 0 no probaría nada.
    expect(await page.evaluate(() => typeof window.__dtdClarityAllowed)).toBe("function");
    expect(hits).toEqual([]);
    expect(await page.evaluate(() => typeof window.clarity)).toBe("undefined");
  });
}

test("público → /entrar por el enlace del pie (next/link): el latido se corta", async ({ page, context }) => {
  const hits = await aislar(context);
  await publicaConClarityViva(page, hits);
  await page.locator("footer a[href='/entrar']").first().click();
  // En `next dev` la primera visita a /entrar compila la ruta: puede tardar.
  await expect(page).toHaveURL(/\/entrar$/, { timeout: 60_000 });
  const corte = Date.now();
  await asentar(page);
  expect(hits.filter((h) => h.at > corte)).toEqual([]);
  expect(await page.evaluate(() => typeof window.clarity)).toBe("undefined");
});

test("público → /portal con router.push (navegación cliente): el latido se corta", async ({ page, context }) => {
  const hits = await aislar(context);
  await publicaConClarityViva(page, hits);
  const hasRouter = await page.evaluate(
    () => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function",
  );
  expect(hasRouter, "window.next.router.push debe existir para simular la navegación cliente").toBe(true);
  await page.evaluate(() =>
    (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push("/portal"),
  );
  await page.waitForURL((url) => !url.pathname.startsWith("/servicios"));
  const corte = Date.now();
  // La red de seguridad recarga: esperar al documento nuevo (runtime montado y
  // sin Clarity). Mientras recarga, `evaluate` puede perder el contexto.
  await expect
    .poll(
      () =>
        page
          .evaluate(() => typeof window.__dtdClarityAllowed === "function" && typeof window.clarity === "undefined")
          .catch(() => false),
      { timeout: 60_000 },
    )
    .toBe(true);
  await asentar(page);
  expect(hits.filter((h) => h.at > corte)).toEqual([]);
  expect(await page.evaluate(() => typeof window.clarity)).toBe("undefined");
});
