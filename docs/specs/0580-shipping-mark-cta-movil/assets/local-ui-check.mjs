/** SDD-0580 · adaptado de 0579 d069b5b2. Sólo loopback y respuestas sintéticas. */
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
assert(['baseline', 'fixed', 'attribution', 'e2e', 'verify'].includes(process.argv[2]), 'Modo baseline|fixed|attribution|e2e|verify obligatorio');
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
  VERIFY_SKIP_EDGE: '1',
  VERIFY_SKIP_SQL: '1',
  // La suite E2E general no instala nuestro route guard; se sustituye por ui acotada.
  VERIFY_SKIP_E2E: '1',
});
// La URL canónica forma enlaces y no inicia conexiones. En verify se conserva
// el default del producto para que las pruebas de email mockeado midan su contrato.
delete env.NEXT_PUBLIC_SITE_URL;
if (mode !== 'verify') env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:45800';
env.DTD_UI_PHASE = mode;
env.DTD_UI_PROXY = fixtureUrl;
const require = createRequire(import.meta.url);
for (const name of Object.keys(process.env)) {
  if (!(name in env)) delete process.env[name];
}
Object.assign(process.env, env);
require('./offline-network-guard.cjs');
// Controles negativos previos: fallan antes de DNS/conexión; no prueba salida real.
const negativeLog = path.join(qa, `negative-${mode}.jsonl`);
for (const probe of [
  () => fetch('https://probe.invalid/no-payload'),
  () => require('node:net').connect(443, '203.0.113.1'),
  () => require('node:dns').lookup('probe.invalid', () => {}),
  () => spawn('curl', ['https://probe.invalid']),
  () => spawn('Playwright.exe', ['--curl-proxy=https://proxy.invalid']),
  () => spawn(process.execPath, ['-e', 'require("node:net").connect(443,"probe.invalid")'], { stdio: 'pipe' }),
]) {
  try {
    const attempted = probe();
    if (attempted?.on) {
      const code = await new Promise((resolve) => attempted.on('exit', resolve));
      assert.notEqual(code, 0, 'Un subproceso eludió el preload');
    } else { await attempted; throw new Error('Sonda no bloqueada'); }
  } catch (error) { assert.equal(error.code, 'DTD_OFFLINE_DENIED'); }
}
fs.copyFileSync(networkLog, negativeLog);
fs.writeFileSync(networkLog, '');
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
    // Fallar si el puerto está ocupado: no reutilizar otro servidor/sesión.
    const portProbe = http.createServer();
    await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(45800, '127.0.0.1', resolve); });
    await new Promise((resolve) => portProbe.close(resolve));
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '45800'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    const base = 'http://127.0.0.1:45800';
    const started = Date.now();
    while (true) {
      if (child.exitCode !== null) throw new Error('Servidor local terminó antes de estar listo');
      try { if ((await fetch(`${base}/`)).ok) break; } catch { /* arranque */ }
      if (Date.now() - started > 180000) throw new Error('Timeout de arranque local');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (mode === 'e2e') {
      const args=['node_modules/@playwright/test/cli.js', 'test', '--config', path.join(assets, 'playwright.local.config.ts')];
      if(process.argv[3]) args.push('--grep',process.argv[3]);
      const test = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
      for (const channel of [test.stdout, test.stderr]) channel.on('data', (chunk) => { output.write(chunk); process.stdout.write(chunk); });
      result = await new Promise((resolve) => test.on('exit', (code) => resolve(code ?? 1)));
    } else {
    const engines = await import('@playwright/test');
    const remote = [];
    const checks = [];
    for (const engine of ['chromium', 'webkit']) {
      if (!fs.existsSync(engines[engine].executablePath())) { checks.push({ engine, state: 'NO DISPONIBLE' }); continue; }
      browser = await engines[engine].launch({ headless: true, proxy: { server: fixtureUrl, bypass: '127.0.0.1,localhost,[::1]' } });
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, serviceWorkers: 'block' });
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
        remote.push(url.origin); return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      await page.goto('https://browser-probe.invalid').catch(() => {});
      assert.deepEqual(remote.splice(0), ['https://browser-probe.invalid'], 'Route guard no bloqueó sonda browser');
      for (const width of (mode==='attribution'?[320,375]:[320, 360, 375, 390, 414, 430, 640, 768, 1280])) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        for (const scale of (['fixed','attribution'].includes(mode) && [320, 375, 768, 1280].includes(width) ? [1, 2] : [1])) {
          if (scale === 2) await page.evaluate(() => {
            // Ampliación real de texto200%, sin cambiar viewport ni alturas/anchos.
            const nodes = [...document.querySelectorAll('.home-surface *')].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
            for (const [el, size] of nodes) el.style.fontSize = `${size * 2}px`;
          });
          const geometry = await page.locator('.hero-ctas > a, .final-ctas > a').evaluateAll((links) => links.map((el) => {
            const rect = (n) => { const r = n.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
            const cs = getComputedStyle(el), box = rect(el);
            const spans = [...el.children].filter((s) => s.tagName === 'SPAN').map((s) => ({ text:s.textContent, box:rect(s), decoration:getComputedStyle(s).textDecorationLine, fontSize:getComputedStyle(s).fontSize }));
            const required = spans.reduce((sum,s) => sum+s.box.height,0) + parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)+(spans.length-1)*parseFloat(cs.rowGap||0)+parseFloat(cs.borderTopWidth)+parseFloat(cs.borderBottomWidth);
            return { text:el.textContent, box, spans, href:el.getAttribute('href'), font:cs.fontFamily, color:cs.color,background:cs.backgroundColor, fontLoaded:document.fonts.check(`${cs.fontSize} ${cs.fontFamily}`), overflow:cs.overflow, required, tooSmall:spans.length===2 && box.height+0.5<required, escaped:spans.some(s=>s.box.y<box.y-.5||s.box.bottom>box.bottom+.5||s.box.x<box.x-.5||s.box.right>box.right+.5) };
          }));
          if(mode==='attribution' && scale===2) {
            const attribution=await page.evaluate(()=>{
              const selectors=['.hero-grid','.htext','.hero-ctas','.hero-ctas > a:first-child','.h1','.final-in','.final-copy','.final-ctas'];
              const measure=()=>selectors.map(s=>{const el=document.querySelector(s);const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {s,width:r.width,right:r.right,minWidth:cs.minWidth,grid:cs.gridTemplateColumns};});
              const rangeMeasure=()=>{const el=document.querySelector('.hero-ctas > a:first-child'),r=document.createRange();r.selectNodeContents(el);const b=el.getBoundingClientRect(),t=r.getBoundingClientRect(),cs=getComputedStyle(el);return {box:{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom},text:{y:t.y,height:t.height,bottom:t.bottom},lines:[...r.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom})),paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom};};
              const after=measure(),afterNeighbor=rangeMeasure(); const style=document.createElement('style');style.textContent='.home-surface .hero-grid{grid-template-columns:1fr}.home-surface .hero-ctas > .btn:first-child{height:48px;min-height:0;padding-block:17px}';document.head.append(style);const before=measure(),beforeNeighbor=rangeMeasure();style.textContent='.home-surface .hero-ctas > .btn:first-child{height:48px;min-height:0;padding-block:17px}';const intermediateNeighbor=rangeMeasure();style.remove();return {before,after,beforeNeighbor,intermediateNeighbor,afterNeighbor};
            });fs.writeFileSync(path.join(qa,`attribution-${engine}-${width}.json`),JSON.stringify(attribution,null,2));
          }
          checks.push({ engine, width, scale, geometry, document:await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,faces:[...document.fonts].filter(f=>/archivo/i.test(f.family)).map(f=>({family:f.family,status:f.status,weight:f.weight})),fontResources:performance.getEntriesByType('resource').filter(r=>/woff/.test(r.name)).map(r=>new URL(r.name).pathname),culprits:[...document.querySelectorAll('.home-surface *')].filter(el=>getComputedStyle(el).position!=='fixed'&&el.getBoundingClientRect().right>document.documentElement.clientWidth+.5).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,70),right:el.getBoundingClientRect().right})).slice(0,12)})) });
          fs.writeFileSync(path.join(qa, `${mode}-results.json`), JSON.stringify({ checks, remote, fixtureCalls }, null, 2));
          if (engine === 'chromium' && width === 375 && scale === 1) for (const [selector, name] of [['.hero-ctas', mode==='baseline'?'01-antes-hero.png':'03-despues-hero.png'],['.final-ctas',mode==='baseline'?'02-antes-cierre.png':'04-despues-cierre.png']]) {
            const target = page.locator(selector); await target.scrollIntoViewIfNeeded();
            const b = await target.boundingBox(); await page.screenshot({ path:path.join(assets,name), clip:{ x:0,y:Math.max(0,b.y-100),width:375,height:Math.min(450,900-Math.max(0,b.y-100)) } });
          }
          if (mode === 'fixed') {
            for (const cta of geometry.filter((g)=>g.spans.length===2)) { assert(!cta.tooSmall && !cta.escaped, JSON.stringify({ engine,width,scale,cta })); assert(cta.box.x>=-.5 && cta.box.right<=width+.5, JSON.stringify({engine,width,scale,cta})); assert(cta.box.height>=44 && cta.box.width>=44); }
            if (engine==='chromium' && scale===2 && width===375) { const cta=page.locator('.hero-ctas'); await cta.scrollIntoViewIfNeeded(); await page.screenshot({ path:path.join(assets,'05-texto-200.png') }); }
            if (engine==='chromium' && width===1280 && scale===1) { await page.locator('.hero-ctas').scrollIntoViewIfNeeded(); await page.screenshot({ path:path.join(assets,'06-escritorio.png') }); }
          }
        }
      }
      // Revisión acotada: no acciona WhatsApp ni envía datos.
      if (mode==='fixed') for (const route of ['/', '/tarifas', '/faq']) {
        await page.setViewportSize({width:320,height:780}); await page.goto(`${base}${route}`,{waitUntil:'networkidle'});
        const observations=await page.evaluate(()=>{
          const fab=document.querySelector('[aria-label="Hablar por WhatsApp con DTD Cargo"]'); const f=fab?.getBoundingClientRect();
          const overlaps=[]; if(f) for(const el of document.querySelectorAll('main a, main button, main input')) {const r=el.getBoundingClientRect();if(r.width&&r.height&&r.left<f.right&&r.right>f.left&&r.top<f.bottom&&r.bottom>f.top) overlaps.push(el.textContent?.slice(0,100)||el.getAttribute('aria-label'));}
          return { fab:!!fab, overlaps, cjk:[...document.querySelectorAll('[lang="zh-CN"],.final-mark span')].map(el=>({text:el.textContent,font:getComputedStyle(el).fontFamily,width:el.getBoundingClientRect().width})) };
        });
        observations.scrolledIntersections=[];
        const targets=route==='/' ? page.locator('.hero-ctas > a, .final-ctas > a') : page.locator('main button, main input, main a[href]');
        for(const target of (await targets.all()).slice(0,40)) {
          if(!await target.isVisible()) continue;
          await target.scrollIntoViewIfNeeded();
          const intersection=await target.evaluate(el=>{
            const f=document.querySelector('[aria-label="Hablar por WhatsApp con DTD Cargo"]')?.getBoundingClientRect(),r=el.getBoundingClientRect();
            return {text:(el.textContent||el.getAttribute('aria-label')||el.tagName).slice(0,80),intersects:!!f&&r.left<f.right&&r.right>f.left&&r.top<f.bottom&&r.bottom>f.top};
          });if(intersection.intersects) observations.scrolledIntersections.push(intersection);
        }
        checks.push({engine,route,observations});
      }
      await browser.close(); browser=null;
    }
    assert.deepEqual(remote, [], 'La página intentó una conexión remota; fue bloqueada');
    fs.writeFileSync(path.join(qa, `${mode}-results.json`), JSON.stringify({ checks, remoteAttempts: remote, fixtureCalls, networkLog }, null, 2));
    console.log(JSON.stringify({ mode, cases:checks.length, baselineTooSmall:checks.flatMap(c=>c.geometry||[]).filter(g=>g.tooSmall).length, remoteAttempts:remote.length }));
    }
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
