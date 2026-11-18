// infra/chatwoot/pruebas/iframe-poc/frente.mjs — frente TLS de la PoC (SDD-0585, paso 2.1).
// Nunca en el VPS. Solo Node, sin dependencias.
//
// Dos puertos HTTPS con el mismo certificado de prueba:
//   · 18443 = el «chat»: proxy a Traefik (127.0.0.1:18080) con X-Forwarded-Proto: https,
//     como Cloudflare delante del VPS. Pasa también los websockets (ActionCable).
//   · 18444 = la «página de Studio»: /bandeja?caso=…&src=… sirve un iframe con las
//     cabeceras de Studio que pide cada caso (ver CASOS).
//
// Orígenes (los nombres *.localtest.me resuelven a 127.0.0.1 en DNS público):
//   https://chat.localtest.me:18443    ↔ chat.dtdcargo.com
//   https://studio.localtest.me:18444  ↔ dtdcargo.com/studio: MISMO sitio que el chat
//   https://localhost:18444            control: otro sitio, permitido en frame-ancestors
//   https://127.0.0.1:18444            control: otro sitio, fuera de frame-ancestors
//
// Uso: node frente.mjs <cert.pem> <clave.pem>

import { readFileSync } from 'node:fs';
import { createServer as https } from 'node:https';
import { request } from 'node:http';
import { connect } from 'node:net';

const [cert, key] = process.argv.slice(2).map((p) => readFileSync(p));
const CHAT = 'https://chat.localtest.me:18443';
const TRAEFIK = { host: '127.0.0.1', port: 18080 };

// CSP de Studio de hoy (next.config.ts, `cspHeader`), reducida a lo que decide el iframe:
// sin `frame-src`, los marcos caen a `default-src 'self'`.
const CSP_STUDIO = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
// La Permissions-Policy de Studio de hoy (catch-all de next.config.ts).
const PP_STUDIO = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()';
const PP_PROPUESTA = PP_STUDIO.replace('microphone=()', `microphone=(self "${CHAT}")`);
const CSP_PROPUESTA = `${CSP_STUDIO}; frame-src ${CHAT}`;

const CASOS = {
  propuesta: { csp: CSP_PROPUESTA, pp: PP_PROPUESTA, allow: 'microphone' },
  'csp-actual': { csp: CSP_STUDIO, pp: PP_PROPUESTA, allow: 'microphone' },
  'pp-actual': { csp: CSP_PROPUESTA, pp: PP_STUDIO, allow: 'microphone' },
  'sin-allow': { csp: CSP_PROPUESTA, pp: PP_PROPUESTA, allow: null },
};

function pagina(caso, src) {
  const allow = caso.allow ? ` allow="${caso.allow}"` : '';
  // El src llega por query solo en esta prueba local. En Studio, el servidor pide el
  // enlace de SSO y lo pone en el iframe: nunca pasa por la URL de Studio.
  const seguro = src.startsWith(`${CHAT}/`) ? src.replace(/"/g, '&quot;') : 'about:blank';
  return `<!doctype html><meta charset="utf-8"><title>Bandeja PoC</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<iframe id="cw" src="${seguro}"${allow}></iframe>`;
}

https({ cert, key }, (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  if (url.pathname !== '/bandeja') { res.writeHead(404).end(); return; }
  const caso = CASOS[url.searchParams.get('caso') ?? 'propuesta'];
  if (!caso) { res.writeHead(400).end('caso desconocido'); return; }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': caso.csp,
    'Permissions-Policy': caso.pp,
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store',
  });
  res.end(pagina(caso, url.searchParams.get('src') ?? ''));
}).listen(18444, '127.0.0.1');

function cabecerasHaciaTraefik(req) {
  return { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-port': '18443', 'x-forwarded-for': '127.0.0.1' };
}

const chat = https({ cert, key }, (req, res) => {
  const sale = request({ ...TRAEFIK, method: req.method, path: req.url, headers: cabecerasHaciaTraefik(req) }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.rawHeaders);
    r.pipe(res);
  });
  sale.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(sale);
});
chat.on('upgrade', (req, socket, head) => {
  const destino = connect(TRAEFIK.port, TRAEFIK.host, () => {
    const h = cabecerasHaciaTraefik(req);
    destino.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (head?.length) destino.write(head);
    destino.pipe(socket).pipe(destino);
  });
  const cerrar = () => { socket.destroy(); destino.destroy(); };
  destino.on('error', cerrar); socket.on('error', cerrar);
});
chat.listen(18443, '127.0.0.1');

console.log('frente listo: chat 18443, studio 18444');
