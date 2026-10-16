// infra/ops/tests/revisar-compose-prueba.mjs — reglas del overlay de prueba (SDD-0540, Fase 1).
//
// Revisa un compose YA RESUELTO con la forma de `docker compose config --format json`
// (services → labels como mapa, deploy.resources.limits.memory, environment,
// command, profiles). Lo usan:
//   · infra/ops/tests/prueba-compose-prueba.sh, con la salida real de
//     `docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml
//      -f compose.staging.yml config --format json` (necesita Docker);
//   · scripts/__tests__/entorno-prueba-compose.test.ts, con los tres YAML unidos
//     en memoria (sin Docker, corre en CI).
//
//   node infra/ops/tests/revisar-compose-prueba.mjs < config.json
//
// Reglas: suma de límites de memoria ≤ 3.072 MiB (D10) y todos los servicios con
// límite; `X-Robots-Tag: noindex` en TODOS los routers; clave (basicAuth) en los
// routers del web y del buzón, y no en el de la API (D4); sin listas de IP;
// Mailpit sin relay; GoTrue entrega en Mailpit; Postgres con su config_file y la
// memoria de prueba.

export const TOPE_MIB = 3072;

/** "576m", "1g", "1024k", 603979776 o "603979776" → MiB. */
export function aMiB(valor) {
  if (valor === undefined || valor === null || valor === "") return NaN;
  if (typeof valor === "number") return valor / 1048576;
  const m = String(valor).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([bkmg]?)b?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  const factor = { "": 1 / 1048576, b: 1 / 1048576, k: 1 / 1024, m: 1, g: 1024 }[m[2]];
  return n * factor;
}

function etiquetas(servicio) {
  const l = servicio?.labels ?? {};
  if (Array.isArray(l)) {
    return Object.fromEntries(l.map((x) => { const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1)]; }));
  }
  return l;
}

function entorno(servicio) {
  const e = servicio?.environment ?? {};
  if (Array.isArray(e)) {
    return Object.fromEntries(e.map((x) => { const i = x.indexOf("="); return i < 0 ? [x, ""] : [x.slice(0, i), x.slice(i + 1)]; }));
  }
  return e;
}

/**
 * @param {{services: Record<string, any>}} config
 * @returns {{lineas: {ok: boolean, msg: string}[], fallas: number, totalMiB: number}}
 */
export function revisar(config) {
  const lineas = [];
  const ok = (cond, msg) => lineas.push({ ok: Boolean(cond), msg });
  const activos = Object.entries(config.services ?? {}).filter(([, s]) => !(s.profiles?.length));

  // 1. Memoria.
  let total = 0;
  const sinLimite = [];
  for (const [nombre, s] of activos) {
    const mib = aMiB(s.deploy?.resources?.limits?.memory);
    if (Number.isNaN(mib)) sinLimite.push(nombre);
    else total += mib;
  }
  ok(sinLimite.length === 0, `todos los servicios activos tienen límite de memoria${sinLimite.length ? ` (faltan: ${sinLimite.join(", ")})` : ""}`);
  ok(total <= TOPE_MIB, `suma de límites ${Math.round(total)} MiB ≤ ${TOPE_MIB} MiB (${activos.length} servicios)`);

  // 2. Routers y middlewares de todos los servicios (Traefik los junta).
  const todas = {};
  for (const [, s] of activos) Object.assign(todas, etiquetas(s));
  const routers = [];
  for (const [nombre, s] of activos) {
    const l = etiquetas(s);
    for (const k of Object.keys(l)) {
      const m = k.match(/^traefik\.http\.routers\.([^.]+)\.rule$/);
      if (m) routers.push({ servicio: nombre, router: m[1], middlewares: (l[`traefik.http.routers.${m[1]}.middlewares`] ?? "").split(",").map((x) => x.trim()).filter(Boolean) });
    }
  }
  ok(routers.length >= 3, `${routers.length} routers (web, API y buzón)`);
  const def = (mw, sufijo) => todas[`traefik.http.middlewares.${mw.replace(/@docker$/, "")}.${sufijo}`];
  for (const r of routers) {
    const noindex = r.middlewares.some((mw) => /noindex/i.test(def(mw, "headers.customresponseheaders.X-Robots-Tag") ?? ""));
    ok(noindex, `router ${r.router}: X-Robots-Tag noindex`);
    const clave = r.middlewares.some((mw) => Boolean(def(mw, "basicauth.users")));
    const esApi = /-supabase$/.test(r.router);
    if (esApi) ok(!clave, `router ${r.router} (API): sin basicAuth, supabase-js manda su propio Authorization`);
    else ok(clave, `router ${r.router}: detrás de la clave del web (basicAuth)`);
  }
  const allowlist = Object.keys(todas).filter((k) => /ipallowlist|ipwhitelist/i.test(k));
  ok(allowlist.length === 0, "sin listas de IP (D4: clave en el web mientras haya solo datos sintéticos)");

  // 3. Correo.
  const mailpit = config.services?.mailpit;
  ok(Boolean(mailpit), "existe el servicio mailpit");
  const relay = Object.keys(entorno(mailpit)).filter((k) => /^MP_SMTP_RELAY/i.test(k));
  ok(relay.length === 0, "Mailpit sin MP_SMTP_RELAY_*: no reenvía nada hacia afuera");
  ok(entorno(config.services?.auth).GOTRUE_SMTP_HOST === "mailpit", "GoTrue entrega en mailpit");

  // 4. Postgres.
  const cmd = (config.services?.db?.command ?? []).join(" ");
  ok(cmd.includes("config_file=/etc/postgresql/postgresql.conf"), "db conserva config_file (pg_cron, pg_net y vault cargan)");
  ok(/shared_buffers=256MB/.test(cmd) && /max_connections=60/.test(cmd), "db con shared_buffers 256MB y 60 conexiones");

  return { lineas, fallas: lineas.filter((l) => !l.ok).length, totalMiB: total };
}

// Uso directo (`node revisar-compose-prueba.mjs < config.json`); importado, no corre.
if (process.argv[1]?.endsWith("revisar-compose-prueba.mjs")) {
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const { lineas, fallas } = revisar(JSON.parse(s));
    for (const l of lineas) console.log(`${l.ok ? "PASÓ " : "FALLÓ"} · ${l.msg}`);
    process.exit(fallas ? 1 : 0);
  });
}
