/** SDD-0579 · node <este archivo> ui|verify. Sólo localhost y respuestas sintéticas. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const assets = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(assets, '../../../../');
assert.equal(process.cwd(), root, 'Ejecutar desde la raíz del worktree asignado');
assert(['ui', 'verify'].includes(process.argv[2]), 'Modo ui o verify obligatorio');
const mode = process.argv[2];
const qa = path.join(root, '.codex/qa');
fs.mkdirSync(qa, { recursive: true });
const networkLog = path.join(qa, `network-${mode}.jsonl`);
fs.writeFileSync(networkLog, '');
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/SUPABASE|KOMMO|API_KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|HAILUWAY|NEXT_PUBLIC_GA|GOOGLE|ANTHROPIC|OPENAI|GEMINI|NODE_OPTIONS/.test(name)));
assert.deepEqual(fs.readdirSync(root).filter((name) => /^\.env/.test(name) && name !== '.env.example'), [], 'No se permiten .env reales');

const fixtureCalls = [];
const fixture = http.createServer((req, res) => {
  fixtureCalls.push({ method: req.method, path: new URL(req.url, 'http://localhost').pathname });
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(req.url === '/next-dist-tags' ? JSON.stringify({ latest: '16.2.11', canary: '16.2.11' }) : '[]');
});
await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
Object.assign(env, {
  NODE_OPTIONS: `--require="${path.join(assets, 'offline-network-guard.cjs').replaceAll('\\', '/')}"`,
  DTD_OFFLINE_LOG: networkLog,
  DTD_NEXT_DIST_TAGS_FIXTURE: `${fixtureUrl}/next-dist-tags`,
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_GA_ID: 'off',
  NEXT_PUBLIC_HAILUWAY_API: fixtureUrl,
  NEXT_PUBLIC_SUPABASE_URL: fixtureUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-local-anon-no-business-data',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:45790',
  VERIFY_SKIP_EDGE: '1',
  VERIFY_SKIP_SQL: '1',
  // La suite E2E general no instala nuestro route guard; se sustituye por ui acotada.
  VERIFY_SKIP_E2E: '1',
});
const require = createRequire(import.meta.url);
for (const name of Object.keys(process.env)) {
  if (!(name in env)) delete process.env[name];
}
Object.assign(process.env, env);
require('./offline-network-guard.cjs');
let child;
let browser;
let result = 0;
const logFile = path.join(qa, `${mode}.log`);
const output = fs.createWriteStream(logFile);
try {
  if (mode === 'verify') {
    child = spawn(process.execPath, ['scripts/verify.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const channel of [child.stdout, child.stderr]) channel.on('data', (chunk) => {
      output.write(chunk);
      const text = chunk.toString();
      if (/\[(?:OK|FAIL|SKIP)\]|VEREDICTO|CRÍTIC|RESUMEN/.test(text)) process.stdout.write(text);
    });
    result = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
  } else {
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--port', '45790'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    const base = 'http://127.0.0.1:45790';
    const started = Date.now();
    while (true) {
      if (child.exitCode !== null) throw new Error('Servidor local terminó antes de estar listo');
      try { if ((await fetch(`${base}/faq`)).ok) break; } catch { /* arranque */ }
      if (Date.now() - started > 180000) throw new Error('Timeout de arranque local');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true, proxy: { server: fixtureUrl, bypass: '127.0.0.1,localhost,[::1]' } });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const remote = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return route.continue();
      if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
      remote.push(url.origin);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const checks = [];
    for (const [url, image, target] of [
      ['/faq', '01-faq-local.png', '¿Puedo hacerle seguimiento a mi envío para saber dónde va?'],
      ['/shipping-mark', '02-shipping-mark-local.png', '¿Cómo me registro y qué obtengo al instante?'],
      ['/privacidad', '03-privacidad-local.png', 'Seguimiento de envío'],
      ['/puerta-a-puerta', null, 'Puerta a puerta: dudas comunes.'],
    ]) {
      await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const item = page.getByText(target, { exact: true });
      await item.scrollIntoViewIfNeeded();
      if (url === '/faq' || url === '/shipping-mark') {
        const detail = item.locator('xpath=ancestor::details');
        await detail.locator('summary').click();
        assert.match(await detail.textContent(), /El seguimiento de la carga dentro del portal está en construcción/);
      }
      if (url === '/privacidad') assert(await page.getByText('El Shipping Mark o el número de envío que nos indicas al consultar con nuestro equipo el estado de tu carga.', { exact: true }).isVisible());
      const entities = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent)).find((s) => s['@type'] === 'FAQPage')?.mainEntity ?? []);
      if (url === '/faq') assert.equal(entities.length, 42);
      if (url === '/shipping-mark') assert(entities.length > 0);
      if (url === '/puerta-a-puerta') assert.equal(entities.length, 6);
      if (image) await page.screenshot({ path: path.join(assets, image) });
      checks.push({ path: url, faqEntities: entities.length, passed: true });
    }
    assert.deepEqual(remote, [], 'La página intentó una conexión remota; fue bloqueada');
    fs.writeFileSync(path.join(qa, 'ui-results.json'), JSON.stringify({ checks, remoteAttempts: remote, fixtureCalls, networkLog }, null, 2));
    console.log(JSON.stringify({ mode, checks, remoteAttempts: remote.length }));
  }
  // Cualquier intento Node remoto inesperado hace fallar la corrida aunque la app tenga fallback.
  if (fs.readFileSync(networkLog, 'utf8').trim()) throw new Error('Hubo intentos remotos bloqueados; revisar log');
} catch (error) {
  console.error(error);
  result = 1;
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  await new Promise((resolve) => fixture.close(resolve));
  output.end();
  fs.writeFileSync(path.join(qa, `fixtures-${mode}.json`), JSON.stringify(fixtureCalls, null, 2));
}
process.exitCode = result;
