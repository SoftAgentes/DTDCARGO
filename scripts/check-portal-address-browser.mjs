#!/usr/bin/env node
/**
 * Navegador sintético local del PortalAddresses REAL; NO es E2E con Postgres.
 * node scripts/check-portal-address-browser.mjs
 *
 * No carga .env, Next, sesión ni servicios externos. Compila el componente y
 * globals.css con dependencias ya instaladas; sólo sustituye Server Actions.
 * Puerto loopback efímero + Chromium propio, cerrados siempre en finally.
 * Artefactos generados: outputs/playwright/portal-address-browser-<fecha>/.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const tailwind = require("@tailwindcss/postcss");
// PostCSS es transitivo. No instala nada ni modifica package.json/lockfile.
const postcssPackages = (await readdir(path.join(root, "node_modules/.pnpm")))
  .filter((name) => /^postcss@\d/.test(name));
assert.equal(postcssPackages.length, 1, "Se requiere una única versión local de PostCSS");
const postcss = require(path.join(root, "node_modules/.pnpm", postcssPackages[0], "node_modules/postcss"));
const componentFile = path.join(root, "app/portal/(app)/perfil/PortalAddresses.tsx");
const output = path.join(root, "outputs/playwright", `portal-address-browser-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await mkdir(output, { recursive: true });

const fakeActions = `
export async function deleteAddressAction(previous, formData) {
  const response = await fetch('/__delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addressId: formData.get('addressId') })
  });
  const body = await response.json();
  if (body.rejected) throw new Error('detalle-ficticio-no-publicable');
  return body;
}
export async function setDefaultAddressAction() { throw new Error('Acción fuera de esta prueba'); }
export async function addAddressAction() { throw new Error('Acción fuera de esta prueba'); }
`;

console.log("Compilando componente real y globals.css para la prueba local…");
const bundle = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/e2e/portal-address-browser-fixture.tsx"],
  bundle: true,
  write: false,
  metafile: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "acciones-locales-controladas",
    setup(build) {
      build.onResolve({ filter: /^\.\/address-actions$/ }, (args) => {
        assert.equal(path.resolve(args.importer), componentFile);
        return { path: "acciones-ficticias", namespace: "fixture" };
      });
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: fakeActions, loader: "js" }));
    },
  }],
});
const bundleInputs = Object.keys(bundle.metafile.inputs);
assert.equal(bundleInputs.some((input) => /lib[\\/]db[\\/]|@supabase|address-actions\.ts$/.test(input)), false, "El bundle no puede incluir backend real");
const globalsFile = path.join(root, "app/globals.css");
const globalsSource = await readFile(globalsFile, "utf8");
const stylesheet = await postcss([tailwind({ base: root, optimize: false })])
  .process(globalsSource, { from: globalsFile });
assert.equal(stylesheet.warnings().length, 0, "La compilación CSS no debe emitir avisos");

const pending = [];
const calls = [];
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "POST" && request.url === "/__delete") {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1024) { response.writeHead(413).end(); return; }
    }
    try {
      const data = JSON.parse(body);
      if (!["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"].includes(data.addressId)) {
        response.writeHead(400).end(); return;
      }
      calls.push(data);
      pending.push(response);
    } catch { response.writeHead(400).end(); }
    return;
  }
  if (request.method !== "GET") { response.writeHead(405).end(); return; }
  if (request.url === "/fixture.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }).end(bundle.outputFiles[0].contents);
  } else if (request.url === "/fixture.css") {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }).end(stylesheet.css);
  } else if (request.url === "/favicon.ico") {
    response.writeHead(204).end();
  } else if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'none'" }).end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PortalAddresses · prueba sintética local</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  } else { response.writeHead(404).end(); }
});

const report = {
  kind: "componente-real-navegador-backend-sintetico",
  componentSha256: createHash("sha256").update(await readFile(componentFile)).digest("hex"),
  globalsSha256: createHash("sha256").update(globalsSource).digest("hex"),
  css: "app/globals.css compilado con Tailwind/PostCSS instalados",
  limitations: ["No valida Next, autenticación, revalidación ni Postgres/RLS.", "Contenedor de prueba; no valida el shell completo ni las fuentes next/font (fallback system-ui).", "Chromium de escritorio con dos tamaños; no equivale a Safari/iOS ni a lector de pantalla."],
  viewports: [],
};
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`Servidor efímero: ${origin}`);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    const unexpectedRequests = [];
    const consoleIssues = [];
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        unexpectedRequests.push(route.request().url());
        await route.abort();
      } else { await route.continue(); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));
    const measurements = [];
    const capture = async (state) => {
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll("main *")].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
            ? [{ tag: element.tagName, className: element.className, left: rect.left, right: rect.right }]
            : [];
        }),
      }));
      measurements.push({ state, ...layout });
      await page.screenshot({ path: path.join(output, `${width}-${state}.png`), fullPage: true });
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${width}/${state}: overflow horizontal ${JSON.stringify(layout)}`);
      assert.equal(layout.overflow.length, 0, `${width}/${state}: elementos fuera del viewport`);
    };
    const answer = (state) => {
      assert.equal(pending.length, 1, "Debe existir una sola solicitud pendiente");
      pending.shift().writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(state));
    };
    const first = page.getByRole("listitem").filter({ hasText: "Casa de prueba" });
    const second = page.getByRole("listitem").filter({ hasText: "Oficina de prueba" });
    const callCount = calls.length;
    await page.goto(origin, { waitUntil: "networkidle" });
    await expect(first).toBeVisible();
    await capture("inicial");
    await first.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(first.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    assert.equal(calls.length, callCount);
    // Cancelar sin enviar devuelve el foco al disparador de la misma fila.
    await page.keyboard.press("Enter");
    await expect(first.getByRole("button", { name: "Eliminar", exact: true })).toBeFocused();
    assert.equal(calls.length, callCount);
    await page.keyboard.press("Enter");
    await expect(first.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    await first.getByRole("button", { name: "Cancelar", exact: true }).press("Shift+Tab");
    await expect(first.getByRole("button", { name: "Sí, eliminar", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => calls.length).toBe(callCount + 1);
    await expect(first.getByRole("button", { name: "Eliminando…", exact: true })).toBeDisabled();
    await expect(first.getByRole("button", { name: "Eliminando…", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(first.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled();
    await page.keyboard.press("Enter");
    assert.equal(calls.length, callCount + 1);
    await capture("pendiente");
    await second.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(second.getByRole("button", { name: "Cancelar", exact: true })).toBeEnabled();
    await second.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(second.getByRole("button", { name: "Eliminar", exact: true })).toBeFocused();
    assert.equal(calls.length, callCount + 1);
    answer({ error: "No se pudo eliminar la dirección. Intenta de nuevo.", correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await expect(first.getByRole("alert")).toHaveText(/no se pudo eliminar/i);
    await expect(first.locator('[tabindex="-1"]')).toBeFocused();
    await capture("error");
    await second.getByRole("button", { name: "Eliminar", exact: true }).click();
    await second.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(second.getByRole("button", { name: "Eliminar", exact: true })).toBeFocused();
    await expect(first.getByRole("alert")).toBeVisible();
    await expect(second.getByRole("alert")).toHaveCount(0);
    await first.getByRole("button", { name: "Sí, eliminar", exact: true }).click();
    await expect.poll(() => calls.length).toBe(callCount + 2);
    await expect(first).toBeVisible();
    answer({ ok: true });
    await expect(first.getByRole("status")).toHaveText(/dirección eliminada/i);
    await expect(first.getByRole("status")).toBeFocused();
    await expect(first.getByRole("button")).toHaveCount(0);
    await expect(second.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();
    await capture("exito");
    assert.ok(calls.slice(callCount).every((call) => call.addressId === "11111111-1111-4111-8111-111111111111"));

    // Rechazo del transporte simulado: debe quedar recuperable en la misma fila.
    await page.reload({ waitUntil: "networkidle" });
    await first.getByRole("button", { name: "Eliminar", exact: true }).click();
    await first.getByRole("button", { name: "Sí, eliminar", exact: true }).click();
    await expect.poll(() => calls.length).toBe(callCount + 3);
    answer({ rejected: true });
    await expect(first.getByRole("alert")).toHaveText(/no se pudo completar/i);
    await expect(first.locator('[tabindex="-1"]')).toBeFocused();
    await expect(first.getByRole("button", { name: "Cancelar", exact: true })).toBeEnabled();
    await expect(page.getByText("detalle-ficticio-no-publicable")).toHaveCount(0);
    await capture("rechazo");
    await writeFile(path.join(output, `${width}-accessibility.yml`), await page.locator("main").ariaSnapshot());
    assert.deepEqual(consoleIssues, [], `Consola ${width}`);
    assert.deepEqual(unexpectedRequests, [], `Red externa ${width}`);
    report.viewports.push({ width, height: 900, result: "PASS", measurements, consoleIssues, unexpectedRequests });
    console.log(`PASS ${width}×900: confirmación, teclado, cancelación con retorno de foco, espera, error, foco, reintento, éxito, rechazo, aislamiento y overflow`);
    await context.close();
  }
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const response of pending.splice(0)) response.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  report.resourcesClosed = true;
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.result}: ${path.join(output, "report.json")}`);
  if (report.error) console.error(report.error);
}
