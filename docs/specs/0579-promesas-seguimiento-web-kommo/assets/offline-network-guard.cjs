/* SDD-0579 · preload local. No cambia la aplicación ni configuración global. */
const fs = require('node:fs');
const net = require('node:net');
const dns = require('node:dns');
const dgram = require('node:dgram');
const cp = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const { syncBuiltinESMExports } = require('node:module');

const log = process.env.DTD_OFFLINE_LOG;
function deny(kind, host) {
  // Sólo origen/host. Nunca query, cabeceras, tokens ni payloads.
  if (log) fs.appendFileSync(log, JSON.stringify({ pid: process.pid, kind, host: String(host) }) + '\n');
  const error = new Error(`DTD_OFFLINE_DENIED ${kind}: ${host}`);
  error.code = 'DTD_OFFLINE_DENIED';
  throw error;
}
const local = (host) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host).toLowerCase());
const check = (kind, host) => { if (host && !local(host)) deny(kind, host); };
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const opts = Array.isArray(args[0]) ? args[0] : args;
  const first = opts[0];
  // Named pipes y sockets UNIX son locales. Puerto sin host implica loopback.
  const host = typeof first === 'object' ? first.host : typeof first === 'number' ? opts[1] : null;
  if (typeof host === 'string') check('socket', host);
  return originalConnect.apply(this, args);
};
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveTxt', 'reverse']) {
  if (typeof dns[key] !== 'function') continue;
  const original = dns[key];
  dns[key] = function (host, ...rest) { check('dns', host); return original.call(this, host, ...rest); };
}
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveTxt', 'reverse']) {
  if (typeof dns.promises[key] !== 'function') continue;
  const original = dns.promises[key];
  dns.promises[key] = async function (host, ...rest) { check('dns-promise', host); return original.call(this, host, ...rest); };
}
const send = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (...args) {
  // No tráfico UDP necesario para los ensayos; no abre DNS ni telemetría.
  deny('udp', 'disabled');
  return send.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  // Next dev consulta su versión npm al arrancar; fixture exacto de metadatos,
  // nunca permiso de salida ni sustitución de datos del producto.
  if (url.href === 'https://registry.npmjs.org/-/package/next/dist-tags' && process.env.DTD_NEXT_DIST_TAGS_FIXTURE) {
    const fixture = new URL(process.env.DTD_NEXT_DIST_TAGS_FIXTURE);
    check('version-fixture', fixture.hostname);
    return originalFetch(fixture, init);
  }
  check('fetch', url.hostname);
  return originalFetch(input, init);
};

// Cada hijo Node vuelve a cargar el preload, incluso si el caller entrega env propio.
// Los binarios nativos de red no están permitidos en esta tarea. Git sólo opera local.
function childOptions(file, args, options) {
  const command = [String(file), ...(args ?? []).map(String)].join(' ');
  if (/\b(?:curl|wget|ssh|scp|sftp|docker|deno|gh|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(command)) deny('child-native-network', String(file));
  if (/\bgit(?:\.exe)?\s+(?:fetch|pull|push|ls-remote|clone)\b/i.test(command)) {
    const cwd = path.resolve(options?.cwd ?? process.cwd());
    const relative = path.relative(os.tmpdir(), cwd);
    // Única excepción: repos desechables de la suite de numeración. Git sólo
    // tiene permitido protocolo file; nunca push/fetch de esta rama real.
    if (relative.startsWith('..') || path.isAbsolute(relative) || !/^dtd-number-test-[^\\/]+(?:[\\/]|$)/.test(relative)) deny('child-git-remote', 'git');
    if ((args ?? []).some((arg) => /^(?:\\\\|\/\/|file:\/\/[^/])/i.test(String(arg)))) deny('child-git-unc', 'git');
  }
  const opts = { ...(options ?? {}) };
  const env = { ...(opts.env ?? process.env) };
  const filename = __filename.replaceAll('\\', '/');
  const preload = `--require="${filename}"`;
  if (!String(env.NODE_OPTIONS ?? '').replaceAll('\\', '/').includes(filename)) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} ${preload}`.trim();
  env.DTD_OFFLINE_LOG = process.env.DTD_OFFLINE_LOG;
  env.GIT_ALLOW_PROTOCOL = 'file';
  opts.env = env;
  return opts;
}
for (const key of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const original = cp[key];
  cp[key] = function (file, args, options, callback) {
    // Conserva las sobrecargas nativas (callbacks y args opcionales).
    if (typeof args === 'function') return original.call(this, file, childOptions(file, [], {}), args);
    if (!Array.isArray(args)) {
      if (typeof options === 'function') return original.call(this, file, childOptions(file, [], args), options);
      return original.call(this, file, childOptions(file, [], args));
    }
    if (typeof options === 'function') return original.call(this, file, args, childOptions(file, args, {}), options);
    return original.call(this, file, args, childOptions(file, args, options), callback);
  };
}
for (const key of ['exec', 'execSync']) {
  const original = cp[key];
  cp[key] = function (command, options, callback) {
    if (typeof options === 'function') return original.call(this, command, childOptions(command, [], {}), options);
    return original.call(this, command, childOptions(command, [], options), callback);
  };
}
syncBuiltinESMExports();
