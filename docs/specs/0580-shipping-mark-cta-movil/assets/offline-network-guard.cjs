/* SDD-0580 (adaptado de SDD-0579 d069b5b2) · preload local. No cambia la aplicación ni configuración global. */
const fs = require('node:fs');
const net = require('node:net');
const dns = require('node:dns');
const dgram = require('node:dgram');
const cp = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
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
  dns[key] = function (host, ...rest) {
    // listen(0, '0.0.0.0') resuelve una IP literal de bind, sin consultar DNS.
    // connect a ese host sigue denegado por Socket.connect.
    if (!(key === 'lookup' && host === '0.0.0.0')) check('dns', host);
    return original.call(this, host, ...rest);
  };
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
  const inspectedArgs = (args ?? []).filter((arg) => {
    // WebKit usa una bandera --curl-proxy; no es el ejecutable curl. Se permite
    // sólo con proxy loopback y bypass exacto del runner; no abre salida externa.
    if (path.basename(String(file)).toLowerCase() !== 'playwright.exe') return true;
    if (String(arg).startsWith('--curl-proxy=')) {
      const proxy = new URL(String(arg).slice(13));
      if (proxy.protocol !== 'http:' || !local(proxy.hostname)) deny('webkit-proxy', proxy.hostname || proxy.protocol);
      return false;
    }
    return String(arg) !== '--curl-noproxy=127.0.0.1,localhost,[::1]';
  });
  const command = [String(file), ...inspectedArgs.map(String)].join(' ');
  if (/\b(?:curl|wget|ssh|scp|sftp|docker|deno|gh|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(command)) deny('child-native-network', String(file));
  if (/\bgit(?:\.exe)?\s+(?:fetch|pull|push|ls-remote|clone)\b/i.test(command)) {
    const cwd = fs.realpathSync(path.resolve(options?.cwd ?? process.cwd()));
    const relative = path.relative(fs.realpathSync(os.tmpdir()), cwd);
    const outside = relative.startsWith('..') || path.isAbsolute(relative);
    const numbering = !outside && /^dtd-number-test-[^\\/]+(?:[\\/]|$)/.test(relative);
    const bareRoot = !outside && /^dtd-harness-bare-[^\\/]+$/.test(relative);
    let bareClone = false;
    if (bareRoot && args?.length === 5 && args[0] === 'clone' && args[1] === '-q' && args[2] === '--bare') {
      const [source, destination] = args.slice(3).map(String);
      const isRemote = (value) => /^(?:\\\\|\/\/|[a-z][a-z0-9+.-]*:\/\/|[^\\/]+@[^:]+:)/i.test(value);
      if (!isRemote(source) && !isRemote(destination)) {
        const origin = fs.realpathSync(path.resolve(cwd, source));
        const target = path.resolve(cwd, destination);
        const within = (file) => { const rel = path.relative(cwd, file); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
        // Origen real y padre real del destino dentro del mismo fixture. Nunca
        // una URL, UNC, junction exterior o un destino que ya exista.
        bareClone = within(origin) && within(target) &&
          fs.realpathSync(path.dirname(target)) === cwd && !fs.existsSync(target);
      }
    }
    // Excepciones de pruebas desechables: numeración o el clone bare exacto.
    // Git conserva protocolo file únicamente; el worktree real no se habilita.
    if (!numbering && !bareClone) deny('child-git-remote', 'git');
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
// Node exec/execFile prometen {stdout,stderr}, no sólo stdout. Mantener el
// contrato sin reutilizar el custom original (que eludiría childOptions).
for (const key of ['exec', 'execFile']) {
  cp[key][promisify.custom] = (...args) => {
    let child;
    const promise = new Promise((resolve, reject) => {
      child = cp[key](...args, (error, stdout, stderr) => {
        if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
        else resolve({ stdout, stderr });
      });
    });
    promise.child = child;
    return promise;
  };
}
syncBuiltinESMExports();
