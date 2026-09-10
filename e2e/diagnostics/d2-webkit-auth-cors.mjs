/** Opt-in network diagnosis. Never loaded by the E2E test collector. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { chromium, webkit } from "@playwright/test";
import configModule from "../../playwright.config.ts";

const config = configModule.default ?? configModule;

const configPath = process.env.D2_PUBLIC_CONFIG;
const outputPath = process.env.D2_OUTPUT;
if (!configPath || !outputPath) throw new Error("D2_PUBLIC_CONFIG and D2_OUTPUT are required");
const publicConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(publicConfig.url)) throw new Error("Expected Supabase HTTPS origin");
function assertAnon(key) {
  if (typeof key !== "string" || !key.startsWith("eyJ") || JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role !== "anon") {
    throw new Error("Only a legacy anon key is accepted; never a user token/service-role/PAT");
  }
}
assertAnon(publicConfig.key);
if (publicConfig.localKey) assertAnon(publicConfig.localKey);
const selectedHeaders = (headers) => Object.fromEntries(Object.entries(headers).filter(([name]) => /^(access-control-|vary$|content-type$|server$)/i.test(name)));
const report = {
  startedAt: new Date().toISOString(), node: process.version, platform: process.platform,
  probeSha256: createHash("sha256").update(fs.readFileSync(new URL(import.meta.url))).digest("hex"),
  publicConfigSource: publicConfig.source, productionOrigin: publicConfig.url,
  scope: "GET /auth/v1/user only; no session, no body consumption, no product navigation",
  transport: process.env.D2_LOCAL_TRANSPORT ?? "existing listener (no provision or mutation)",
  rows: [], controls: [], controlRequests: [],
};
function save() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
}
const serveDocument = (_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
  res.end("<!doctype html><title>D2 anonymous CORS diagnostic</title>");
};
const server = http.createServer(serveDocument);
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const port = server.address().port;
const serverV6 = http.createServer(serveDocument);
try {
  await new Promise((resolve, reject) => { serverV6.once("error", reject); serverV6.listen({ port, host: "::1", ipv6Only: true }, resolve); });
} catch (error) {
  server.close();
  throw error;
}
report.documentListeners = [{ host: "127.0.0.1", port }, { host: "::1", port }];
const controlServer = http.createServer((req, res) => {
  report.controlRequests.push({ method: req.method, path: req.url, origin: req.headers.origin, requestedHeaders: req.headers["access-control-request-headers"] ?? null });
  const headers = req.url === "/missing-origin" ? {} : { "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") {
    Object.assign(headers, { "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": req.url === "/missing-authorization" ? "apikey" : (req.headers["access-control-request-headers"] ?? "apikey") });
  }
  res.writeHead(req.method === "OPTIONS" ? 204 : 401, headers);
  res.end();
});
await new Promise((resolve, reject) => { controlServer.once("error", reject); controlServer.listen(0, "127.0.0.1", resolve); });
async function nativeFetch(page, url, headers) {
  return page.evaluate(async ({ url, headers }) => {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { method: "GET", headers, mode: "cors", credentials: "omit", redirect: "error", signal: controller.signal });
      return { outcome: "http-response-visible", status: response.status, type: response.type, ms: performance.now() - start, bodyRead: false };
    } catch (error) {
      return { outcome: "fetch-rejected", name: error.name, message: error.message, ms: performance.now() - start };
    } finally { clearTimeout(timer); }
  }, { url, headers });
}
const destinations = [
  { name: "local-ip", origin: "http://127.0.0.1:55431", key: publicConfig.localKey ?? publicConfig.key, keySource: publicConfig.localKey ? "local anon" : "real anon (local unavailable preflight control)" },
  { name: "local-name", origin: "http://localhost:55431", key: publicConfig.localKey ?? publicConfig.key, keySource: publicConfig.localKey ? "local anon" : "real anon (local unavailable preflight control)" },
  { name: "real-https", origin: publicConfig.url, key: publicConfig.key, keySource: "real anon" },
];
let activeBrowser;
try {
  for (const projectName of ["mobile-chrome", "mobile-safari"]) {
    const project = config.projects.find((entry) => entry.name === projectName);
    if (!project) throw new Error(`Missing configured project ${projectName}`);
    const { defaultBrowserType, ...device } = project.use;
    const engine = defaultBrowserType === "webkit" ? webkit : chromium;
    const launchStart = performance.now();
    activeBrowser = await engine.launch({ headless: true, timeout: 30_000 });
    const browserVersion = activeBrowser.version();
    const launchMs = performance.now() - launchStart;
    for (const name of ["ok", "missing-origin", "missing-authorization"]) {
      const context = await activeBrowser.newContext({ ...device, serviceWorkers: "block" });
      try {
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/control`);
        const result = await nativeFetch(page, `http://127.0.0.1:${controlServer.address().port}/${name}`, { apikey: "diagnostic-not-a-key", Authorization: "Bearer diagnostic-not-a-user" });
        const expected = name === "ok" ? result.status === 401 : result.outcome === "fetch-rejected" && result.name === "TypeError";
        report.controls.push({ project: projectName, name, result, passed: expected });
        save();
        if (!expected) throw new Error(`Invalid CORS instrument: ${projectName}/${name}`);
      } finally { await context.close(); }
    }
    for (const documentOrigin of [`http://localhost:${port}`, `http://127.0.0.1:${port}`, "https://dtdcargo.com"]) {
      for (const destination of destinations) {
        // The additional real source origin is meaningful for real HTTPS only.
        if (documentOrigin.startsWith("https:") && destination.name !== "real-https") continue;
        for (const headerProfile of ["apikey-only", "sdk-anon-headers"]) {
          const row = { project: projectName, browserVersion, device, launchMs, documentOrigin, destination: destination.name, url: `${destination.origin}/auth/v1/user`, keySource: destination.keySource, headerProfile, events: [] };
          report.rows.push(row);
          save();
          const contextStart = performance.now();
          const context = await activeBrowser.newContext({ ...device, serviceWorkers: "block" });
          row.contextMs = performance.now() - contextStart;
          const headers = { apikey: destination.key };
          if (headerProfile === "sdk-anon-headers") Object.assign(headers, { Authorization: `Bearer ${destination.key}`, "X-Client-Info": "supabase-ssr/0.5.2", "X-Supabase-Api-Version": "2024-01-01" });
          const documentUrl = `${documentOrigin}/__d2-anonymous-cors-probe`;
          // Only bootstrap a blank HTTPS document. Remove interception BEFORE fetch:
          // Playwright request routing can alter native preflight behavior.
          if (documentOrigin.startsWith("https:")) await context.route(documentUrl, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>D2 anonymous origin control</title>" }));
          const pageStart = performance.now();
          const page = await context.newPage();
          row.newPageMs = performance.now() - pageStart;
          const hookStart = performance.now();
          await page.addInitScript(() => { try { localStorage.setItem("studio_sidebar_collapsed", "1"); } catch { /* about:blank has no storage origin */ } });
          row.addInitScriptMs = performance.now() - hookStart;
          page.on("console", (message) => row.events.push({ kind: "console", type: message.type(), text: message.text() }));
          page.on("pageerror", (error) => row.events.push({ kind: "pageerror", name: error.name, message: error.message }));
          page.on("requestfailed", (request) => row.events.push({ kind: "requestfailed", method: request.method(), url: request.url(), failure: request.failure() }));
          const responseTasks = [];
          page.on("response", (response) => { if (response.url() === row.url) responseTasks.push((async () => {
            row.events.push({ kind: "response", method: response.request().method(), status: response.status(), headers: selectedHeaders(await response.allHeaders()) });
          })()); });
          try {
            await page.goto(documentUrl, { waitUntil: "load", timeout: 15_000 });
            await context.unrouteAll();
            row.source = { origin: await page.evaluate(() => location.origin), synthetic: true, secureContext: await page.evaluate(() => isSecureContext) };
            row.result = await nativeFetch(page, row.url, headers);
            await Promise.all(responseTasks);
          } catch (error) {
            row.runnerError = { name: error.name, message: error.message };
          } finally {
            const closeStart = performance.now();
            await context.close();
            row.contextCloseMs = performance.now() - closeStart;
            save();
            console.log(JSON.stringify({ project: projectName, source: documentOrigin, destination: destination.name, headerProfile, result: row.result, runnerError: row.runnerError }));
          }
        }
      }
    }
    await activeBrowser.close();
    activeBrowser = undefined;
  }
} finally {
  await activeBrowser?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => serverV6.close(resolve));
  await new Promise((resolve) => controlServer.close(resolve));
  report.finishedAt = new Date().toISOString();
  save();
}
if (report.rows.some((row) => row.runnerError || row.events.some((event) => event.kind === "blocked-outside-scope"))) process.exitCode = 1;
