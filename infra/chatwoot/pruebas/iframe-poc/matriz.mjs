// infra/chatwoot/pruebas/iframe-poc/matriz.mjs — matriz navegador × capacidad de la PoC
// del iframe (SDD-0585, paso 2.1). Nunca contra el VPS: usa el Chatwoot local de
// levantar.sh y el frente TLS de frente.mjs, que este script arranca.
//
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright/index.mjs> node matriz.mjs <poc.json> [chrome edge firefox webkit]
//
// Cada comprobación imprime PASÓ, FALLÓ o NO DISPONIBLE. Las de «control» esperan un
// bloqueo: PASÓ quiere decir que el navegador bloqueó lo que tenía que bloquear.
//   I1 iframe desde el origen permitido (mismo sitio, cabeceras propuestas)
//   I2 control frame-ancestors: origen fuera de la lista → bloqueado
//   I3 control frame-src: CSP de Studio de hoy → bloqueado
//   S1 SSO de un solo uso dentro del iframe → panel de la cuenta
//   S2 la sesión sigue en un iframe nuevo, sin token (cookie del chat dentro del marco)
//   S3 el mismo enlace de SSO, usado otra vez → no entra
//   S4 control de sitio: el mismo SSO desde otro sitio (localhost) → se registra lo que pasa
//   S5 (servidor, una vez) con MAX_USER_SESSIONS=5, el 6.º login de navegador → 409
//   M1 micrófono en el panel, dentro del iframe (getUserMedia y botón de nota de voz)
//   M2 control: iframe sin allow="microphone" → NotAllowedError
//   M3 control: Permissions-Policy de Studio de hoy (microphone=()) → NotAllowedError
// Sin navigator.mediaDevices (WebKit de Playwright en Windows), M1–M3 dan NO DISPONIBLE.

import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [pocJson, ...pedidos] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(pocJson, 'utf8'));
const { chromium, firefox, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);

const CHAT = `https://${cfg.hostChat}:18443`;
const MISMO = 'https://studio.localtest.me:18444';
const OTRO = 'https://localhost:18444';
const FUERA = 'https://127.0.0.1:18444';
const PANEL = new RegExp(`^${CHAT.replace(/[.]/g, '\\.')}/app/accounts/\\d+/`);

const MEDIOS_FALSOS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const NAVEGADORES = {
  chrome: { tipo: chromium, opciones: { channel: 'chrome', args: MEDIOS_FALSOS } },
  edge: { tipo: chromium, opciones: { channel: 'msedge', args: MEDIOS_FALSOS } },
  firefox: { tipo: firefox, opciones: { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } } },
  webkit: { tipo: webkit, opciones: {} },
};

const AQUI = dirname(fileURLToPath(import.meta.url));
const frente = spawn(process.execPath, [join(AQUI, 'frente.mjs'), cfg.cert, cfg.clave], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => frente.stdout.once('data', ok));
process.on('exit', () => frente.kill());

function enlaceSso() { // GET /platform/api/v1/users/{id}/login, como lo hará el servidor de Studio
  const token = readFileSync(cfg.tokenArchivo, 'utf8').trim();
  const u = new URL(`${cfg.traefik}/platform/api/v1/users/${cfg.usuario}/login`);
  return new Promise((ok, mal) => {
    request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Host: cfg.hostChat, 'X-Forwarded-Proto': 'https', api_access_token: token } }, (r) => {
      let s = ''; r.on('data', (d) => (s += d)).on('end', () => (r.statusCode === 200 ? ok(JSON.parse(s).url) : mal(new Error(`SSO ${r.statusCode}`))));
    }).on('error', mal).end();
  });
}

// Cierra todas las sesiones de la agente (como «cerrar todas» en Chatwoot). Entre
// navegadores: MAX_USER_SESSIONS=5 (como en el VPS) y cada SSO crea una sesión.
// También vacía los contadores de rack-attack: el login tiene tope de 5 por IP cada 5 min
// y de 10 por correo cada 15 (config/initializers/rack_attack.rb), y la matriz entra más.
function rails(codigo) {
  const r = spawnSync('docker', ['exec', cfg.contenedorRails, 'bundle', 'exec', 'rails', 'runner', codigo], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`rails runner: ${r.stderr.slice(0, 200)}`);
}
const sinSesiones = () => rails(`u = User.find(${cfg.usuario}); u.tokens = {}; u.save!; u.user_sessions.destroy_all; Rack::Attack.reset!`);

function entrar(sso, agente) { // POST /auth/sign_in con el token de SSO, como el login del panel
  const u = new URL(sso);
  const cuerpo = JSON.stringify({ email: u.searchParams.get('email'), sso_auth_token: u.searchParams.get('sso_auth_token') });
  return new Promise((ok, mal) => {
    request({ host: '127.0.0.1', port: 18080, path: '/auth/sign_in', method: 'POST', headers: { Host: cfg.hostChat, 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json', 'User-Agent': agente } }, (r) => {
      r.resume(); r.on('end', () => ok(r.statusCode));
    }).on('error', mal).end(cuerpo);
  });
}

// S5 (una vez, no depende del navegador): con 5 sesiones vivas, el sexto login de un
// navegador recibe 409 y la pantalla para elegir qué sesión cerrar.
async function topeDeSesiones() {
  sinSesiones();
  const codigos = [];
  for (let i = 0; i < 5; i++) codigos.push(await entrar(await enlaceSso(), 'Mozilla/5.0 (PoC SDD-0585)'));
  rails('Rack::Attack.reset!'); // el sexto choca con el tope de sesiones, no con el de intentos
  codigos.push(await entrar(await enlaceSso(), 'Mozilla/5.0 (PoC SDD-0585)'));
  rails('Rack::Attack.reset!');
  const sinNavegador = await entrar(await enlaceSso(), 'curl/8');
  sinSesiones();
  const ok = codigos.slice(0, 5).every((c) => c === 200) && codigos[5] === 409 && sinNavegador === 200;
  console.log(`servidor S5 ${(ok ? 'PASÓ' : 'FALLÓ').padEnd(13)} MAX_USER_SESSIONS=5: logins de navegador → ${codigos.join(',')}; sin «Mozilla» en el agente → ${sinNavegador} (desaloja la más vieja)`);
  return { cod: 'S5', estado: ok ? 'PASÓ' : 'FALLÓ', detalle: `navegador ${codigos.join(',')}; sin navegador ${sinNavegador}` };
}

const bandeja = (origen, caso, src) => `${origen}/bandeja?caso=${caso}&src=${encodeURIComponent(src)}`;
const marco = (page) => page.frames().find((f) => f !== page.mainFrame());

async function cargoElChat(page, ms = 12000) { // ¿el iframe tiene el documento de Chatwoot?
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const f = marco(page);
    if (f?.url().startsWith(CHAT)) {
      const ok = await f.evaluate(() => location.origin + '|' + !!document.querySelector('#app')).catch(() => null);
      if (ok?.endsWith('|true')) return { cargo: true, url: f.url() };
    }
    await page.waitForTimeout(250);
  }
  return { cargo: false, url: marco(page)?.url() ?? '(sin marco)' };
}

async function esperaPanel(page, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const u = marco(page)?.url() ?? '';
    if (PANEL.test(u)) return { panel: true, url: u };
    await page.waitForTimeout(250);
  }
  return { panel: false, url: marco(page)?.url() ?? '(sin marco)' };
}

const controlMic = (m) => (m === 'NotAllowedError' || m === 'SecurityError' ? 'PASÓ' : m.startsWith('TypeError: sin') ? 'NO DISPONIBLE' : 'FALLÓ');
const sinQuery = (u) => u.replace(/\?.*$/, '?…');
const microfono = (f) => f.evaluate(async () => {
  if (!navigator.mediaDevices?.getUserMedia) return 'TypeError: sin navigator.mediaDevices';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    const pistas = s.getAudioTracks().length; s.getTracks().forEach((t) => t.stop());
    return `concedido (${pistas} pista)`;
  } catch (e) { return `${e.name}`; }
}).catch((e) => `sin evaluar: ${e.message.split('\n')[0]}`);

async function correr(id) {
  const n = NAVEGADORES[id];
  const filas = [];
  const fila = (cod, estado, detalle) => { filas.push({ cod, estado, detalle }); console.log(`${id.padEnd(8)} ${cod} ${estado.padEnd(13)} ${detalle}`); };
  let nav;
  try { nav = await n.tipo.launch({ headless: true, ...n.opciones }); }
  catch (e) { fila('—', 'NO DISPONIBLE', `no arranca: ${e.message.split('\n')[0]}`); return { id, filas }; }
  const version = nav.version();
  sinSesiones();
  const contexto = async () => {
    const c = await nav.newContext({ ignoreHTTPSErrors: true });
    // WebKit de Playwright no conoce el permiso «microphone» (y el error sale después,
    // en newPage): ahí el permiso queda como lo deja el navegador.
    if (id !== 'webkit') for (const origin of [MISMO, OTRO, FUERA, CHAT]) await c.grantPermissions(['microphone'], { origin }).catch(() => {});
    return c;
  };

  try {
    // I1–I3: el marco, sin sesión.
    let c = await contexto(); let p = await c.newPage();
    const avisos = []; p.on('console', (m) => /frame|Content Security|ancestors/i.test(m.text()) && avisos.push(m.text().slice(0, 160)));
    await p.goto(bandeja(MISMO, 'propuesta', `${CHAT}/app/login`));
    let r = await cargoElChat(p);
    const seguro = r.cargo ? await marco(p).evaluate(() => isSecureContext) : null;
    fila('I1', r.cargo ? 'PASÓ' : 'FALLÓ', `${MISMO} → ${r.url} (isSecureContext=${seguro})`);
    await p.goto(bandeja(FUERA, 'propuesta', `${CHAT}/app/login`));
    r = await cargoElChat(p, 6000);
    fila('I2', r.cargo ? 'FALLÓ' : 'PASÓ', `control frame-ancestors desde ${FUERA}: ${r.cargo ? 'cargó' : 'bloqueado'} (${r.url})`);
    await p.goto(bandeja(MISMO, 'csp-actual', `${CHAT}/app/login`));
    r = await cargoElChat(p, 6000);
    fila('I3', r.cargo ? 'FALLÓ' : 'PASÓ', `control frame-src (CSP de hoy): ${r.cargo ? 'cargó' : 'bloqueado'} (${r.url})`);
    // M2–M3: controles de micrófono sobre la pantalla de entrada del chat.
    await p.goto(bandeja(MISMO, 'sin-allow', `${CHAT}/app/login`));
    r = await cargoElChat(p);
    let m = r.cargo ? await microfono(marco(p)) : 'sin marco';
    fila('M2', controlMic(m), `control sin allow="microphone": ${m}`);
    await p.goto(bandeja(MISMO, 'pp-actual', `${CHAT}/app/login`));
    r = await cargoElChat(p);
    m = r.cargo ? await microfono(marco(p)) : 'sin marco';
    fila('M3', controlMic(m), `control microphone=() en Studio: ${m}`);
    if (avisos.length) fila('··', 'nota', `consola: ${avisos.slice(0, 3).join(' | ')}`);
    await c.close();

    // S1–S2 y M1: SSO en el iframe desde el mismo sitio.
    c = await contexto(); p = await c.newPage();
    const sso = await enlaceSso();
    await p.goto(bandeja(MISMO, 'propuesta', sso));
    let s = await esperaPanel(p);
    const galletas = (await c.cookies(CHAT)).map((k) => `${k.name}(sameSite=${k.sameSite}${k.secure ? ',secure' : ''})`).join(' ');
    fila('S1', s.panel ? 'PASÓ' : 'FALLÓ', `SSO en el iframe → ${sinQuery(s.url)}; cookies del chat: ${galletas || 'ninguna'}`);
    await p.goto(bandeja(MISMO, 'propuesta', `${CHAT}/app/accounts/${cfg.cuenta}/dashboard`));
    s = await esperaPanel(p, 12000);
    await p.waitForTimeout(2500); // si no hay sesión, el router del panel redirige a /app/login
    const sigue = PANEL.test(marco(p)?.url() ?? '');
    fila('S2', sigue ? 'PASÓ' : 'FALLÓ', `iframe nuevo sin token → ${marco(p)?.url()}`);
    if (sigue) {
      m = await microfono(marco(p));
      await marco(p).goto(`${CHAT}/app/accounts/${cfg.cuenta}/conversations/${cfg.conversacion}`);
      // Botón de nota de voz del cuadro de respuesta (ícono i-ph-microphone en 4.19.1).
      // Grabando, Chatwoot cambia el ícono a i-ph-microphone-slash y muestra i-ph-stop.
      const boton = marco(p).locator('button:has(.i-ph-microphone)').first();
      await boton.waitFor({ timeout: 20000 }).catch(() => {});
      // El ícono de «grabando» aparece aunque el micrófono falle: lo que prueba la nota de
      // voz es que la llamada a getUserMedia que hace el propio botón de Chatwoot se cumpla.
      let ui = 'botón de nota de voz no encontrado';
      if (await boton.count()) {
        await marco(p).evaluate(() => {
          const md = navigator.mediaDevices;
          window.__micPoc = md?.getUserMedia ? 'sin llamada' : 'sin navigator.mediaDevices';
          if (!md?.getUserMedia) return;
          const original = md.getUserMedia.bind(md);
          md.getUserMedia = (c) => original(c).then((s) => { window.__micPoc = 'concedido'; return s; }, (e) => { window.__micPoc = e.name; throw e; });
        });
        await boton.click().catch(() => {});
        const grabando = await marco(p).locator('button:has(.i-ph-stop)').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
        await p.waitForTimeout(1500);
        ui = `${await marco(p).evaluate(() => window.__micPoc)}${grabando ? ', con el botón de parar' : ''}`;
      }
      const sinCaptura = m.startsWith('TypeError') && ui.startsWith('sin navigator.mediaDevices');
      fila('M1', m.startsWith('concedido') && ui.startsWith('concedido') ? 'PASÓ' : (sinCaptura ? 'NO DISPONIBLE' : 'FALLÓ'), `getUserMedia en el panel: ${m}; botón de nota de voz de Chatwoot: ${ui}`);
    } else fila('M1', 'NO EJECUTADO', 'sin sesión en el iframe');
    await c.close();

    // S3: el mismo enlace otra vez, en un contexto limpio.
    c = await contexto(); p = await c.newPage();
    await p.goto(bandeja(MISMO, 'propuesta', sso));
    s = await esperaPanel(p, 10000);
    fila('S3', s.panel ? 'FALLÓ' : 'PASÓ', `SSO reusado → ${sinQuery(s.url)}`);
    await c.close();

    // S4: control de sitio. El mismo flujo desde localhost (otro sitio, permitido en frame-ancestors).
    c = await contexto(); p = await c.newPage();
    await p.goto(bandeja(OTRO, 'propuesta', await enlaceSso()));
    s = await esperaPanel(p, 15000);
    await p.waitForTimeout(2500);
    const final = marco(p)?.url() ?? '(sin marco)';
    const g4 = (await c.cookies(CHAT)).map((k) => k.name).join(' ') || 'ninguna';
    fila('S4', 'control', `desde otro sitio: ${PANEL.test(final) ? 'entra al panel' : 'NO entra'} (${sinQuery(final)}); cookies del chat: ${g4}`);
    await c.close();
  } catch (e) {
    fila('!!', 'FALLÓ', `error del banco: ${e.message.split('\n')[0]}`);
  }
  await nav.close();
  return { id, version, filas };
}

const lista = pedidos.length ? pedidos : Object.keys(NAVEGADORES);
const resultados = [{ id: 'servidor', filas: [await topeDeSesiones()] }];
for (const id of lista) resultados.push(await correr(id));
writeFileSync(join(dirname(pocJson), `matriz-${lista.join('-')}.json`), JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 2));
frente.kill();
