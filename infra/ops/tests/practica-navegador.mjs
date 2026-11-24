// Dos orígenes HTTPS ficticios en Chromium. La red responde dentro de Playwright.
// La suite acceso.test.ts comprueba los mismos endpoints con el handler y SQL reales.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const herramientasTsx = createRequire(require.resolve("tsx/package.json"));
const { build } = herramientasTsx("esbuild");
const real = "https://studio.example.test";
const prueba = "https://practica.example.test";
const pase = "e".repeat(64);
const vista = { espacio:"00000000-0000-4000-8000-000000000713", permisos:[{ id:"cn", edicion:true }] };
const paquete = await build({
  stdin:{
    contents:`
      import { createRoot } from "react-dom/client";
      import { EntradaPractica } from "./app/studio/_components/wiring/EntradaPractica";
      import { PracticaPersonal } from "./app/studio/practica/PracticaPersonal";
      import { AvisoEntornoPrueba } from "./components/AvisoEntornoPrueba";
      import "./app/studio/tokens.css";
      import "./app/studio/studio.css";
      const contenido = location.origin === ${JSON.stringify(real)}
        ? <EntradaPractica origen={${JSON.stringify(prueba)}} />
        : <><AvisoEntornoPrueba env={{APP_ENV:"staging"}} /><PracticaPersonal real={${JSON.stringify(real)}} /></>;
      createRoot(document.getElementById("app")).render(contenido);
    `,
    loader:"tsx", resolveDir:process.cwd(),
  },
  jsx:"automatic", bundle:true, write:false, outdir:"salida", minify:false,
  define:{"process.env.NODE_ENV":'"production"'},
});
const js = paquete.outputFiles.find(f => f.path.endsWith(".js")).text;
// Usa las reglas reales del aviso raíz, sin copiar sus dimensiones al ensayo.
const globales = readFileSync("app/globals.css", "utf8");
const tokensGlobales = globales.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1];
const inicioAviso = globales.indexOf("\n.entorno-prueba {");
const finAviso = globales.indexOf("\n/*", inicioAviso);
// Incluye el detalle responsive, que viene después del comentario intermedio.
const finDetalle = globales.indexOf("\n/*", globales.indexOf("@media (min-width: 640px)", inicioAviso));
assert.ok(inicioAviso >= 0 && finAviso > inicioAviso && finDetalle > finAviso);
assert.ok(tokensGlobales);
const css = `:root {${tokensGlobales}}` + paquete.outputFiles.find(f => f.path.endsWith(".css")).text + globales.slice(inicioAviso, finDetalle);
const browser = await chromium.launch({ executablePath:process.env.PRACTICA_CHROMIUM || undefined, headless:true });
try {
  for (const width of [390, 1280]) {
    const contexto = await browser.newContext({ viewport:{width, height:760}, serviceWorkers:"block" });
    try {
      let activo = false;
      let indisponible = false;
      const inesperadas = [];
      await contexto.route("**/*", async ruta => {
        const req = ruta.request();
        const u = new URL(req.url());
        if (![real,prueba].includes(u.origin)) throw new Error("Destino imprevisto");
        if (u.pathname === "/app.js") return ruta.fulfill({ contentType:"application/javascript",body:js });
        if (u.pathname === "/app.css") return ruta.fulfill({ contentType:"text/css",body:css });
        if (u.pathname === "/studio/perfil" || u.pathname === "/studio/practica") return ruta.fulfill({
          contentType:"text/html", body:'<html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body class="studio-sys"><div id="app"></div><script src="/app.js"></script></body></html>',
        });
        if (u.origin === real && u.pathname === "/studio/dashboard") return ruta.fulfill({contentType:"text/html", body:"<h1>Studio real</h1>"});
        if (req.method() === "POST" && u.pathname.startsWith("/api/practica/")) {
          const op = u.pathname.slice("/api/practica/".length);
          assert.equal(req.headers().origin, u.origin);
          if (op === "emitir" && u.origin === real) return ruta.fulfill({status:indisponible ? 503 : 200, json:{pase}});
          if (op === "canjear" && u.origin === prueba && req.postDataJSON().pase === pase) {
            activo = true;
            return ruta.fulfill({json:vista});
          }
          if (op === "estado" && u.origin === prueba) return ruta.fulfill({status:activo && req.postDataJSON().espacio === vista.espacio ? 200 : 403,json:vista});
          if (op === "salir" && u.origin === prueba) {
            assert.equal(req.postDataJSON().espacio, vista.espacio);
            activo = false;
            return ruta.fulfill({json:{ok:true}});
          }
        }
        inesperadas.push(req.method() + " " + u.pathname);
        return ruta.abort();
      });
      const perfil = await contexto.newPage();
      await perfil.goto(real + "/studio/perfil");
      const boton = perfil.getByRole("button",{name:"Entrar a modo de prueba"});
      const abrir = perfil.waitForEvent("popup");
      await boton.focus();
      await boton.press("Enter");
      const practica = await abrir;
      await expect(practica.getByRole("heading",{name:"Permisos de tu práctica"})).toBeVisible();
      assert.equal(practica.url(),prueba + "/studio/practica");
      assert.equal(await practica.evaluate(() => window.opener === null),true);
      await expect(practica.getByText("Almacén China")).toBeVisible();
      await expect(practica.getByText("Facturación")).toHaveCount(0);
      await practica.reload();
      await expect(practica.getByText("Consulta y edición")).toBeVisible();
      await expect(practica.getByText("Modo de prueba · Datos inventados")).toBeVisible();
      const salir = practica.getByRole("button",{name:"Volver al Studio real"});
      const comprobarAvisos = async () => {
        const aviso = practica.getByRole("note", {name:"Entorno de prueba"});
        const texto = practica.getByText("Modo de prueba · Datos inventados");
        await expect(aviso).toBeVisible();
        await expect(texto).toBeVisible();
        await expect(salir).toBeVisible();
        const [global, franja, rect] = await Promise.all([aviso.boundingBox(), texto.boundingBox(), salir.boundingBox()]);
        assert.ok(global && franja && rect);
        for (const caja of [global, franja, rect]) {
          assert.ok(caja.x >= 0 && caja.x + caja.width <= width && caja.y >= 0 && caja.y + caja.height <= 760);
        }
        assert.ok(franja.y >= global.y + global.height, "El aviso global no tapa la franja personal");
        assert.ok(rect.y >= global.y + global.height, "El aviso global no tapa el regreso");
        assert.ok(franja.y + franja.height <= rect.y || rect.y + rect.height <= franja.y || franja.x + franja.width <= rect.x || rect.x + rect.width <= franja.x, "El texto y el botón no se solapan");
        assert.equal(await salir.evaluate(boton => document.elementFromPoint(boton.getBoundingClientRect().x + boton.clientWidth / 2, boton.getBoundingClientRect().y + boton.clientHeight / 2) === boton), true);
      };
      await comprobarAvisos();
      // Comprueba la reserva al cambiar el alto real del aviso y al hacer scroll.
      const altoInicial = await practica.locator("main").evaluate(pagina => parseFloat(pagina.style.getPropertyValue("--practica-aviso-global")));
      await practica.getByRole("note", {name:"Entorno de prueba"}).evaluate(aviso => { aviso.style.paddingBottom = "24px"; });
      await expect.poll(() => practica.locator("main").evaluate(pagina => parseFloat(pagina.style.getPropertyValue("--practica-aviso-global")))).toBeGreaterThan(altoInicial);
      await practica.locator("main").evaluate(pagina => { pagina.style.minHeight = "200vh"; });
      await practica.evaluate(() => window.scrollTo(0, 300));
      await comprobarAvisos();
      await practica.keyboard.press("Tab");
      await expect(salir).toBeFocused();
      await salir.press("Enter");
      await expect(practica).toHaveURL(real + "/studio/dashboard");
      assert.equal(activo,false);

      indisponible = true;
      await perfil.bringToFront();
      await boton.click();
      await expect(perfil.getByRole("alert")).toContainText("Vuelve a intentarlo desde tu perfil");
      await expect(boton).toBeEnabled();
      assert.equal(perfil.url(),real + "/studio/perfil");
      assert.deepEqual(inesperadas,[]);
      console.log("PASÓ · " + width + " px · avisos sin solapamiento, cambio de altura, scroll, Tab/Enter, dos pestañas, recarga, regreso y destino indisponible");
    } finally { await contexto.close(); }
  }
} finally { await browser.close(); }
