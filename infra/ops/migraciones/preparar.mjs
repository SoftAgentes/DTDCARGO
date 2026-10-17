#!/usr/bin/env node
/**
 * infra/ops/migraciones/preparar.mjs — arma el paquete para aplicar UNA migración
 * en la base de producción del servidor propio (SDD-0546).
 *
 * Corre en un checkout del repo (el servidor no tiene el repo ni node). Lee el
 * blob EXACTO de `supabase/migrations/<nombre>.sql` en <sha> con `git cat-file`
 * y escribe en <salida>:
 *
 *   migracion.sql   el blob tal cual
 *   previa.sql      lectura previa, `begin transaction read only … rollback`:
 *                   ledger, deriva de las funciones que la migración reemplaza
 *                   (cuerpo vivo contra el último cuerpo del repo) y el bloque
 *                   `do $preflight$ … $preflight$;` propio de la migración
 *   aplicar.sql     \set ON_ERROR_STOP on · begin · texto · insert del ledger ·
 *                   commit (el mismo envoltorio que infra/ops/lib/migracion.sh)
 *   verificar.sql   verificación, `begin transaction read only … rollback`:
 *                   una fila en el ledger con el md5 y los bytes del blob, y el
 *                   cuerpo vivo de cada función creada igual al del archivo
 *   IDENTIDAD.txt   sha, blob, md5 y bytes, created_by, md5 de cada script
 *   SHA256SUMS
 *
 * Después, en el VPS: infra/ops/migraciones/aplicar.sh (o desde el equipo del
 * operador, aplicar-remoto.sh). Procedimiento: docs/runbooks/aplicar-migraciones-prod.md.
 *
 * Uso:
 *   node infra/ops/migraciones/preparar.mjs --sha <40 hex> --migracion <NNNN_nombre> \
 *       --sdd <NNNN> --salida <carpeta nueva> [--repo <checkout>] [--proyecto dtd-cargo] \
 *       [--acepta-deriva <esquema.funcion>]... [--sin-preflight-propio]
 *
 * Códigos: 0 listo · 2 uso inválido · 3 rechazado (el archivo no se puede
 * envolver, deriva aceptada que no existe, preflight propio con escritura).
 *
 * No se conecta a ninguna base. Las funciones puras se exportan para las pruebas
 * (infra/ops/tests/migraciones.test.mjs).
 */
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROYECTO_PRODUCCION = process.env.PROD_COMPOSE_PROJECT || "dtd-cargo";
export const VERSION_RELOJ = "to_char(clock_timestamp() at time zone 'utc','YYYYMMDDHH24MISS')";
export const NOMBRE_RE = /^[0-9]{4}[a-z]?_[a-z0-9_]+$/;
/** Estados de la deriva que frenan la lectura previa, salvo --acepta-deriva. */
export const ESTADOS_DERIVA = [
  "falta en vivo",
  "existe sin definición previa en el repo",
  "cuerpo anterior del repo",
  "cuerpo desconocido",
];
/** Palabras de escritura que no pueden ir en el preflight de una lectura previa. */
const ESCRITURA_RE =
  /\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate|copy|refresh|vacuum|reindex|cluster|nextval|setval|comment\s+on)\b/gi;

export class Rechazo extends Error {}

export const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
/** El mismo conjunto que `regexp_replace(prosrc, '[ \t\n\r\f\v]', '', 'g')` en Postgres. */
export const sinEspacios = (s) => s.replace(/[ \t\n\r\f\v]/g, "");
/** El cuerpo sin comentarios `--` ni `/* *\/` (los de dentro de cadenas se quedan) y sin espacios. */
export const sinComentarios = (s) => sinEspacios(enmascarar(s, { soloComentarios: true }).mascara);
export const prefijo = (nombre) => nombre.split("_")[0];
export const delimitador = (nombre) => `$mig${prefijo(nombre)}$`;

// ─── Lectura del SQL ─────────────────────────────────────────────────────────

/**
 * Enmascara comentarios, cadenas y cuerpos entre dólares con espacios (conserva
 * los saltos de línea y las posiciones). Lo que queda visible es el código de
 * nivel superior: ahí se buscan los `create function`, los `drop function` y los
 * `do $preflight$`. Devuelve también los bloques entre dólares, en orden.
 * Con `soloComentarios`, tapa solo los comentarios (las cadenas y los cuerpos
 * se reconocen para no confundir un `--` dentro de ellos, pero quedan visibles).
 */
export function enmascarar(texto, { soloComentarios = false } = {}) {
  const out = texto.split("");
  const bloques = [];
  const n = texto.length;
  const blanquear = (a, b) => {
    for (let k = a; k < b && k < n; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const c = texto[i];
    const d = texto[i + 1];
    if (c === "-" && d === "-") {
      let j = texto.indexOf("\n", i);
      if (j < 0) j = n;
      blanquear(i, j);
      i = j;
      continue;
    }
    if (c === "/" && d === "*") {
      let prof = 1;
      let j = i + 2;
      while (j < n && prof > 0) {
        if (texto[j] === "/" && texto[j + 1] === "*") { prof++; j += 2; }
        else if (texto[j] === "*" && texto[j + 1] === "/") { prof--; j += 2; }
        else j++;
      }
      blanquear(i, j);
      i = j;
      continue;
    }
    if (c === "'") {
      const esE = i > 0 && /[eE]/.test(texto[i - 1]) && (i < 2 || !/[A-Za-z0-9_]/.test(texto[i - 2]));
      let j = i + 1;
      while (j < n) {
        if (esE && texto[j] === "\\") { j += 2; continue; }
        if (texto[j] === "'") {
          if (texto[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j++;
      }
      if (!soloComentarios) blanquear(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "$" && (i === 0 || !/[A-Za-z0-9_$]/.test(texto[i - 1]))) {
      // Etiqueta: letras (también no ASCII), dígitos y _, sin empezar con dígito.
      const m = /^\$((?:[A-Za-z_]|[^\x00-\x7f])(?:[A-Za-z0-9_]|[^\x00-\x7f])*)?\$/.exec(texto.slice(i, i + 80));
      if (m) {
        const etiqueta = m[0];
        const ini = i + etiqueta.length;
        let fin = texto.indexOf(etiqueta, ini);
        const cerrado = fin >= 0;
        if (!cerrado) fin = n;
        const finBloque = cerrado ? fin + etiqueta.length : n;
        bloques.push({ inicio: i, fin: finBloque, etiqueta, contenidoInicio: ini, contenidoFin: fin, cerrado });
        if (!soloComentarios) blanquear(i, finBloque);
        i = finBloque;
        continue;
      }
    }
    i++;
  }
  return { mascara: out.join(""), bloques };
}

/** Del `(` en `abre` a su `)` correspondiente, en la máscara. -1 si no cierra. */
function cerrarParentesis(mascara, abre) {
  let prof = 0;
  for (let k = abre; k < mascara.length; k++) {
    if (mascara[k] === "(") prof++;
    else if (mascara[k] === ")") {
      prof--;
      if (prof === 0) return k;
    }
  }
  return -1;
}

/** Clave de agrupación de los argumentos: minúsculas, sin defaults, espacios colapsados. */
export function claveArgs(args) {
  const partes = [];
  let prof = 0;
  let actual = "";
  for (const ch of args) {
    if (ch === "(") prof++;
    if (ch === ")") prof--;
    if (ch === "," && prof === 0) { partes.push(actual); actual = ""; continue; }
    actual += ch;
  }
  if (actual.trim()) partes.push(actual);
  return partes
    .map((p) => p.toLowerCase().replace(/\s+default\s[\s\S]*$/, "").replace(/\s*=[\s\S]*$/, "").replace(/\s+/g, " ").trim())
    .join(",");
}

/**
 * Los eventos de funciones del archivo, en orden: `crear` (con su cuerpo entre
 * dólares, exacto, o null si no lo tiene) y `borrar`. Solo el nivel superior: un
 * `create function` dentro de un comentario, una cadena o un cuerpo no cuenta.
 */
export function eventosDeFunciones(texto) {
  const { mascara, bloques } = enmascarar(texto);
  const eventos = [];
  const crear = /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s*\(/gi;
  for (let m; (m = crear.exec(mascara)); ) {
    const abre = m.index + m[0].length - 1;
    const cierra = cerrarParentesis(mascara, abre);
    if (cierra < 0) continue;
    const esquema = (m[1] || "public").toLowerCase();
    const nombre = m[2].toLowerCase();
    const args = claveArgs(mascara.slice(abre + 1, cierra));
    const puntoYComa = mascara.indexOf(";", cierra);
    let cuerpo = null;
    let finSentencia = puntoYComa < 0 ? texto.length : puntoYComa + 1;
    for (const b of bloques) {
      if (b.inicio <= cierra) continue;
      if (puntoYComa >= 0 && b.inicio > puntoYComa) break;
      if (/\bas\s*$/i.test(mascara.slice(cierra, b.inicio)) && b.cerrado) {
        cuerpo = texto.slice(b.contenidoInicio, b.contenidoFin);
        break;
      }
    }
    eventos.push({ tipo: "crear", esquema, nombre, args, cuerpo, posicion: m.index, finSentencia });
  }
  const borrar = /\bdrop\s+function\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/gi;
  for (let m; (m = borrar.exec(mascara)); ) {
    eventos.push({ tipo: "borrar", esquema: (m[1] || "public").toLowerCase(), nombre: m[2].toLowerCase(), posicion: m.index });
  }
  return eventos.sort((a, b) => a.posicion - b.posicion);
}

/**
 * Los bloques `do $preflight$ … $preflight$;` del archivo, tal cual, con las
 * palabras de escritura que aparezcan en su código (fuera de cadenas y comentarios).
 */
export function bloquesPreflight(texto) {
  const { mascara, bloques } = enmascarar(texto);
  const salida = [];
  for (const b of bloques) {
    if (b.etiqueta !== "$preflight$" || !b.cerrado) continue;
    const antes = mascara.slice(0, b.inicio);
    const m = /\bdo\s*$/i.exec(antes);
    if (!m) continue;
    const puntoYComa = mascara.indexOf(";", b.fin);
    if (puntoYComa < 0 || mascara.slice(b.fin, puntoYComa).trim() !== "") continue;
    const contenido = texto.slice(b.contenidoInicio, b.contenidoFin);
    const escritura = [...new Set((enmascarar(contenido).mascara.match(ESCRITURA_RE) || []).map((w) => w.toLowerCase().replace(/\s+/g, " ")))];
    salida.push({ texto: texto.slice(m.index, puntoYComa + 1), escritura });
  }
  return salida;
}

/**
 * Lo mismo que `mig_revisar` de infra/ops/lib/migracion.sh: devuelve los motivos
 * por los que el archivo no se puede envolver (lista vacía = se puede).
 */
export function revisarMigracion(buf, nombre) {
  const motivos = [];
  if (!NOMBRE_RE.test(nombre)) return [`nombre de migración inválido: '${nombre}'`];
  const texto = buf.toString("utf8");
  if (!Buffer.from(texto, "utf8").equals(buf)) motivos.push(`${nombre}: el archivo no es UTF-8 válido`);
  const cr = buf.filter((x) => x === 13).length;
  if (cr) motivos.push(`${nombre}: el archivo tiene ${cr} CR (salto de línea de Windows)`);
  const barras = texto.split("\n").filter((l) => l.startsWith("\\")).length;
  if (barras) motivos.push(`${nombre}: ${barras} líneas empiezan con barra invertida (psql las leería como meta-comandos)`);
  if (texto.includes(delimitador(nombre))) motivos.push(`${nombre}: el delimitador ${delimitador(nombre)} aparece dentro del texto`);
  const tx = texto
    .split("\n")
    .filter((l) => /^[ \t]*(begin|commit|rollback|start[ \t]+transaction|abort)([ \t]+(work|transaction))?[ \t]*;/i.test(l)).length;
  if (tx) motivos.push(`${nombre}: el archivo trae su propio begin, commit o rollback (${tx} líneas)`);
  return motivos;
}

/** El mismo envoltorio que `mig_envolver` de infra/ops/lib/migracion.sh, byte a byte. */
export function envolver(texto, nombre, createdBy) {
  if (!/^[A-Za-z0-9:@._-]+$/.test(createdBy)) throw new Rechazo(`created_by inválido: '${createdBy}'`);
  const delim = delimitador(nombre);
  return (
    "\\set ON_ERROR_STOP on\nbegin;\n" +
    texto +
    (texto.endsWith("\n") ? "" : "\n") +
    "insert into supabase_migrations.schema_migrations (version, statements, name, created_by)\n" +
    `values (${VERSION_RELOJ}, array[${delim}` +
    texto +
    `${delim}], '${nombre}', '${createdBy}');\n` +
    "commit;\n"
  );
}

/** created_by según el destino: producción o un `*-staging`. */
export function createdByPara(proyecto, sdd) {
  if (proyecto === PROYECTO_PRODUCCION) return `servidor-propio:psql:SDD-${sdd}`;
  if (proyecto.endsWith("-staging")) return `servidor-propio:psql:prueba:SDD-${sdd}`;
  throw new Rechazo(`--proyecto ${proyecto}: tiene que ser ${PROYECTO_PRODUCCION} o terminar en -staging`);
}

// ─── Deriva y verificación ───────────────────────────────────────────────────

/**
 * Para cada función que crea la migración, qué cuerpos le dio el repo ANTES de
 * ella. `vigentes` = el último cuerpo de cada firma (clave de argumentos);
 * `anteriores` = los que una migración posterior reemplazó. Un `drop function`
 * borra lo conocido de esa función (las firmas no se comparan: ver la spec).
 *
 * @param {string} textoMigracion
 * @param {{archivo: string, texto: string}[]} previas en orden de archivo
 * @param {string[]} aceptadas `esquema.funcion` con --acepta-deriva
 */
export function derivaEsperada(textoMigracion, previas, aceptadas = []) {
  const creadas = [];
  for (const e of eventosDeFunciones(textoMigracion)) {
    const f = `${e.esquema}.${e.nombre}`;
    if (e.tipo === "crear" && !creadas.some((c) => c.funcion === f)) creadas.push({ funcion: f, esquema: e.esquema, nombre: e.nombre });
  }
  const desconocidas = aceptadas.filter((a) => !creadas.some((c) => c.funcion === a));
  if (desconocidas.length) throw new Rechazo(`--acepta-deriva nombra funciones que la migración no crea: ${desconocidas.join(", ")}`);
  if (!creadas.length) return [];
  const estado = new Map(creadas.map((c) => [c.funcion, { defs: [], origen: "" }]));
  for (const { archivo, texto } of previas) {
    if (!creadas.some((c) => texto.toLowerCase().includes(c.nombre))) continue;
    for (const e of eventosDeFunciones(texto)) {
      const s = estado.get(`${e.esquema}.${e.nombre}`);
      if (!s) continue;
      if (e.tipo === "borrar") { s.defs = []; s.origen = ""; continue; }
      s.defs.push({ args: e.args, cuerpo: e.cuerpo, archivo });
      s.origen = archivo;
    }
  }
  return creadas.map((c) => {
    const s = estado.get(c.funcion);
    const ultimo = new Map();
    for (const d of s.defs) ultimo.set(d.args, d);
    const vigentes = [...new Set([...ultimo.values()].map((d) => d.cuerpo).filter((x) => x !== null))];
    const anteriores = [...new Set(s.defs.map((d) => d.cuerpo).filter((x) => x !== null && !vigentes.includes(x)))];
    return {
      ...c,
      previa: s.defs.length > 0,
      origen: s.origen,
      aceptada: aceptadas.includes(c.funcion),
      vigentes: vigentes.map(md5),
      vigentesSinEspacios: vigentes.map((x) => md5(sinEspacios(x))),
      vigentesSinComentarios: vigentes.map((x) => md5(sinComentarios(x))),
      anteriores: anteriores.map(md5),
      anterioresSinEspacios: anteriores.map((x) => md5(sinEspacios(x))),
      anterioresSinComentarios: anteriores.map((x) => md5(sinComentarios(x))),
    };
  });
}

/** El cuerpo final de cada firma que crea la migración (sin las que borra después). */
export function funcionesCreadas(textoMigracion) {
  const ultimo = new Map();
  for (const e of eventosDeFunciones(textoMigracion)) {
    const f = `${e.esquema}.${e.nombre}`;
    if (e.tipo === "borrar") {
      for (const k of [...ultimo.keys()]) if (k.startsWith(`${f}(`)) ultimo.delete(k);
      continue;
    }
    ultimo.set(`${f}(${e.args})`, { funcion: f, esquema: e.esquema, nombre: e.nombre, cuerpo: e.cuerpo });
  }
  return [...ultimo.values()].filter((x) => x.cuerpo !== null).map((x) => ({ ...x, md5: md5(x.cuerpo) }));
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (xs) => (xs.length ? `array[${xs.map(lit).join(", ")}]::text[]` : "array[]::text[]");

function consultaDeriva(deriva) {
  const filas = deriva
    .map(
      (d) =>
        `    (${lit(d.funcion)}, ${lit(d.esquema)}, ${lit(d.nombre)}, ${d.previa}, ${d.aceptada}, ${lit(d.origen)}, ` +
        `${arr(d.vigentes)}, ${arr(d.vigentesSinEspacios)}, ${arr(d.vigentesSinComentarios)}, ` +
        `${arr([...d.anteriores, ...d.anterioresSinEspacios, ...d.anterioresSinComentarios])})`,
    )
    .join(",\n");
  return [
    "with esperado (funcion, esquema, nombre, previa, aceptada, origen, vigentes, vigentes_ns, vigentes_sc, anteriores) as (",
    "  values",
    filas,
    "), vivo as (",
    "  select e.funcion, p.oid::regprocedure::text as firma, md5(p.prosrc) as md5_vivo,",
    "         md5(regexp_replace(p.prosrc, '[ \\t\\n\\r\\f\\v]', '', 'g')) as md5_vivo_ns",
    "    from esperado e",
    "    join pg_catalog.pg_proc p on p.pronamespace = to_regnamespace(e.esquema)::oid and p.proname = e.nombre",
    "), estado as (",
    "  select e.funcion, v.firma, v.md5_vivo, e.aceptada, e.origen,",
    "         case",
    "           when v.firma is null and not e.previa then 'nueva'",
    "           when v.firma is null then 'falta en vivo'",
    "           when not e.previa then 'existe sin definición previa en el repo'",
    "           when v.md5_vivo = any(e.vigentes) then 'igual'",
    "           when v.md5_vivo_ns = any(e.vigentes_ns) then 'igual sin espacios'",
    "           when v.md5_vivo_ns = any(e.vigentes_sc) then 'igual sin comentarios'",
    "           when v.md5_vivo = any(e.anteriores) or v.md5_vivo_ns = any(e.anteriores) then 'cuerpo anterior del repo'",
    "           else 'cuerpo desconocido'",
    "         end as estado",
    "    from esperado e left join vivo v on v.funcion = e.funcion",
    ")",
    "select funcion, coalesce(firma, '-') as firma_viva, estado, aceptada, coalesce(md5_vivo, '') as md5_vivo, origen",
    "  from estado",
  ].join("\n");
}

/** previa.sql: solo lectura, termina en rollback, y dice `PREVIA <nombre> OK` si pasa. */
export function armarPrevia({ nombre, sha, deriva, preflights }) {
  const l = [
    "\\set ON_ERROR_STOP on",
    `-- Lectura previa de ${nombre} (SDD-0546). Generada por infra/ops/migraciones/preparar.mjs`,
    `-- desde ${sha}. Solo lectura: begin transaction read only … rollback. No se edita a mano.`,
    "begin transaction read only;",
    "set local lock_timeout = '5s';",
    "set local statement_timeout = '60s';",
    "select now() as hora_utc, current_database() as base, current_user as usuario;",
    `select count(*) as filas_ledger, max(version) as ultima_version, count(*) filter (where name = ${lit(nombre)}) as ya_en_ledger`,
    "  from supabase_migrations.schema_migrations;",
    "select count(*) filter (where wait_event_type = 'Lock') as esperando_locks,",
    "       count(*) filter (where state <> 'idle' and xact_start < now() - interval '1 minute') as transacciones_largas",
    "  from pg_stat_activity where datname = current_database();",
    "do $previa$",
    "begin",
    `  if exists (select 1 from supabase_migrations.schema_migrations where name = ${lit(nombre)}) then`,
    `    raise exception 'previa: ${nombre} ya está en el ledger';`,
    "  end if;",
    "end",
    "$previa$;",
  ];
  if (deriva.length) {
    const q = consultaDeriva(deriva);
    l.push(
      "-- Deriva: el cuerpo vivo de cada función que la migración crea o reemplaza, contra el",
      "-- último cuerpo que le dio el repo antes de ella (md5 exacto y sin espacios).",
      `${q}\n order by funcion, firma_viva;`,
      "do $deriva$",
      "declare",
      "  r record;",
      "  lista text := '';",
      "begin",
      `  for r in\n${q}\n  loop`,
      `    if r.estado in (${ESTADOS_DERIVA.map(lit).join(", ")}) and not r.aceptada then`,
      "      lista := lista || format(' %s [%s: %s]', r.funcion, r.firma_viva, r.estado);",
      "    end if;",
      "  end loop;",
      "  if lista <> '' then",
      "    raise exception 'deriva: el cuerpo vivo difiere del repo (decide Sam; ver el runbook):%', lista;",
      "  end if;",
      "end",
      "$deriva$;",
    );
  } else {
    l.push("select 'la migración no crea funciones' as deriva;");
  }
  if (preflights.length) {
    l.push("-- Preflight propio de la migración (bloque $preflight$ del archivo, tal cual):");
    for (const p of preflights) l.push(p.texto);
  } else {
    l.push("select 'sin preflight propio en la lectura previa' as preflight;");
  }
  l.push(`select ${lit(`PREVIA ${nombre} OK`)} as resultado;`, "rollback;", "");
  return l.join("\n");
}

/** verificar.sql: solo lectura, termina en rollback, y dice `VERIFICACIÓN <nombre> OK` si pasa. */
export function armarVerificar({ nombre, sha, blobMd5, blobBytes, funciones }) {
  const pares = [...new Set(funciones.map((f) => `(${lit(f.esquema)}, ${lit(f.nombre)})`))];
  const l = [
    "\\set ON_ERROR_STOP on",
    `-- Verificación de ${nombre} (SDD-0546). Generada por infra/ops/migraciones/preparar.mjs`,
    `-- desde ${sha}. Solo lectura: begin transaction read only … rollback. No se edita a mano.`,
    "begin transaction read only;",
    "set local statement_timeout = '60s';",
    "select now() as hora_utc;",
    "select version, name, created_by, array_length(statements, 1) as sentencias,",
    "       md5(array_to_string(statements, '')) as md5_ledger, octet_length(array_to_string(statements, '')) as bytes_ledger",
    `  from supabase_migrations.schema_migrations where name = ${lit(nombre)};`,
    "select count(*) as filas_ledger from supabase_migrations.schema_migrations;",
  ];
  if (funciones.length) {
    l.push(
      "select p.oid::regprocedure as firma, p.prosecdef as definer, p.proconfig as config, md5(p.prosrc) as md5_vivo,",
      `       md5(p.prosrc) = any(${arr(funciones.map((f) => f.md5))}) as igual_al_archivo,`,
      "       case when to_regrole('anon') is null then null else has_function_privilege('anon', p.oid, 'EXECUTE') end as exec_anon,",
      "       case when to_regrole('authenticated') is null then null else has_function_privilege('authenticated', p.oid, 'EXECUTE') end as exec_authenticated",
      "  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace",
      ` where (n.nspname::text, p.proname::text) in (${pares.join(", ")})`,
      " order by p.oid::regprocedure::text;",
    );
  }
  l.push(
    "do $verificar$",
    "declare",
    "  n int;",
    "  m text;",
    "  b bigint;",
    "  faltan text := '';",
    "begin",
    "  select count(*), max(md5(array_to_string(statements, ''))), max(octet_length(array_to_string(statements, '')))",
    `    into n, m, b from supabase_migrations.schema_migrations where name = ${lit(nombre)};`,
    "  if n <> 1 then",
    `    raise exception 'verificar: % filas de ${nombre} en el ledger (se esperaba 1)', n;`,
    "  end if;",
    `  if m is distinct from ${lit(blobMd5)} or b is distinct from ${blobBytes} then`,
    "    raise exception 'verificar: el ledger no coincide con el blob (md5 %, % bytes)', m, b;",
    "  end if;",
  );
  for (const f of funciones) {
    l.push(
      "  if not exists (select 1 from pg_catalog.pg_proc p",
      `                  where p.pronamespace = to_regnamespace(${lit(f.esquema)})::oid and p.proname = ${lit(f.nombre)} and md5(p.prosrc) = ${lit(f.md5)}) then`,
      `    faltan := faltan || ' ${f.funcion}';`,
      "  end if;",
    );
  }
  l.push(
    "  if faltan <> '' then",
    "    raise exception 'verificar: el cuerpo vivo no es el del archivo en:%', faltan;",
    "  end if;",
    "end",
    "$verificar$;",
    "select count(*) filter (where wait_event_type = 'Lock') as esperando_locks from pg_stat_activity where datname = current_database();",
    `select ${lit(`VERIFICACIÓN ${nombre} OK`)} as resultado;`,
    "rollback;",
    "",
  );
  return l.join("\n");
}

// ─── Git ─────────────────────────────────────────────────────────────────────

const git = (repo, args, opts = {}) => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 1 << 28, ...opts });

/** Los blobs pedidos con un solo `git cat-file --batch`. */
function leerBlobs(repo, refs) {
  if (!refs.length) return [];
  const r = spawnSync("git", ["-C", repo, "cat-file", "--batch"], { input: refs.join("\n") + "\n", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git cat-file --batch: ${r.stderr}`);
  const out = r.stdout;
  const blobs = [];
  let pos = 0;
  for (const ref of refs) {
    const nl = out.indexOf(10, pos);
    const cab = out.subarray(pos, nl).toString();
    const m = /^([0-9a-f]+) blob (\d+)$/.exec(cab);
    if (!m) throw new Error(`git cat-file: ${ref} → ${cab}`);
    const tam = Number(m[2]);
    blobs.push(out.subarray(nl + 1, nl + 1 + tam));
    pos = nl + 1 + tam + 1;
  }
  return blobs;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function leerArgs(argv) {
  const o = { repo: ".", proyecto: PROYECTO_PRODUCCION, aceptaDeriva: [], sinPreflightPropio: false };
  const valor = (i, n) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Rechazo(`uso: falta el valor de ${n}`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sha") o.sha = valor(i++, a);
    else if (a === "--migracion") o.migracion = valor(i++, a).replace(/\.sql$/, "");
    else if (a === "--sdd") o.sdd = valor(i++, a);
    else if (a === "--salida") o.salida = valor(i++, a);
    else if (a === "--repo") o.repo = valor(i++, a);
    else if (a === "--proyecto") o.proyecto = valor(i++, a);
    else if (a === "--acepta-deriva") o.aceptaDeriva.push(valor(i++, a).toLowerCase());
    else if (a === "--sin-preflight-propio") o.sinPreflightPropio = true;
    else if (a === "-h" || a === "--help") o.ayuda = true;
    else throw new Rechazo(`uso: argumento desconocido ${a}`);
  }
  return o;
}

export function preparar(o, log = console.log) {
  if (!/^[0-9a-f]{40}$/.test(o.sha || "")) throw new Rechazo("uso: --sha tiene que ser el SHA completo (40 hex)");
  if (!NOMBRE_RE.test(o.migracion || "")) throw new Rechazo("uso: --migracion tiene que ser el nombre exacto del archivo, sin .sql (NNNN_nombre)");
  if (!/^[0-9]{4}$/.test(o.sdd || "")) throw new Rechazo("uso: --sdd tiene que ser el número de la SDD de la migración (4 dígitos)");
  if (!o.salida) throw new Rechazo("uso: falta --salida <carpeta nueva>");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(o.proyecto)) throw new Rechazo(`uso: --proyecto inválido: '${o.proyecto}'`);
  for (const a of o.aceptaDeriva) if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(a)) throw new Rechazo(`uso: --acepta-deriva espera esquema.funcion: '${a}'`);
  const createdBy = createdByPara(o.proyecto, o.sdd);
  const repo = o.repo;
  try {
    git(repo, ["cat-file", "-e", `${o.sha}^{commit}`], { stdio: "ignore" });
  } catch {
    throw new Rechazo(`uso: ${o.sha} no es un commit de ${repo} (¿falta git fetch?)`);
  }
  const ruta = `supabase/migrations/${o.migracion}.sql`;
  const listado = git(repo, ["ls-tree", "--name-only", o.sha, "supabase/migrations/"]).toString().split("\n").filter(Boolean);
  if (!listado.includes(ruta)) throw new Rechazo(`${ruta} no existe en ${o.sha}`);
  if (fs.existsSync(o.salida)) throw new Rechazo(`uso: ${o.salida} ya existe: usa una carpeta nueva`);

  const blobId = git(repo, ["rev-parse", `${o.sha}:${ruta}`]).toString().trim();
  const [buf] = leerBlobs(repo, [`${o.sha}:${ruta}`]);
  const motivos = revisarMigracion(buf, o.migracion);
  if (motivos.length) throw new Rechazo(motivos.join("; "));
  const texto = buf.toString("utf8");

  const previasRutas = listado.filter((r) => r.endsWith(".sql") && path.basename(r) < `${o.migracion}.sql`).sort();
  const previasBlobs = leerBlobs(repo, previasRutas.map((r) => `${o.sha}:${r}`));
  const previas = previasRutas.map((r, i) => ({ archivo: path.basename(r), texto: previasBlobs[i].toString("utf8") }));
  const deriva = derivaEsperada(texto, previas, o.aceptaDeriva);
  const funciones = funcionesCreadas(texto);

  let preflights = bloquesPreflight(texto);
  let preflightPropio = preflights.length ? "incluido" : "no trae";
  if (preflights.length && o.sinPreflightPropio) { preflights = []; preflightPropio = "omitido (--sin-preflight-propio)"; }
  const conEscritura = preflights.filter((p) => p.escritura.length);
  if (conEscritura.length) {
    throw new Rechazo(
      `el bloque $preflight$ menciona escritura (${conEscritura.flatMap((p) => p.escritura).join(", ")}): no puede ir en una lectura previa de solo lectura. ` +
        "Revísalo a mano y, si corresponde, prepara con --sin-preflight-propio (queda en IDENTIDAD.txt)",
    );
  }

  let esperaDeclarada = "no";
  let corte = null;
  try {
    const baseline = JSON.parse(git(repo, ["show", `${o.sha}:supabase/migrations-baseline.json`]).toString());
    corte = baseline.cutoff;
    if (Object.hasOwn(baseline.pendingBelowCutoff ?? {}, o.migracion)) esperaDeclarada = "sí";
  } catch {
    esperaDeclarada = "desconocida (sin migrations-baseline.json en el sha)";
  }

  const archivos = {
    "migracion.sql": buf,
    "previa.sql": armarPrevia({ nombre: o.migracion, sha: o.sha, deriva, preflights }),
    "aplicar.sql": envolver(texto, o.migracion, createdBy),
    "verificar.sql": armarVerificar({ nombre: o.migracion, sha: o.sha, blobMd5: md5(buf), blobBytes: buf.length, funciones }),
  };
  const identidad = [
    `sha=${o.sha}`,
    `archivo=${ruta}`,
    `nombre=${o.migracion}`,
    `sdd=${o.sdd}`,
    `proyecto=${o.proyecto}`,
    `created_by=${createdBy}`,
    `blob=${blobId}`,
    `blob_md5=${md5(buf)}`,
    `blob_bytes=${buf.length}`,
    ...["previa", "aplicar", "verificar"].map((s) => `${s}_md5=${md5(archivos[`${s}.sql`])}`),
    `funciones_reemplazadas=${deriva.map((d) => d.funcion).join(",")}`,
    `funciones_verificadas=${[...new Set(funciones.map((f) => f.funcion))].join(",")}`,
    `deriva_aceptada=${o.aceptaDeriva.join(",")}`,
    `preflight_propio=${preflightPropio}`,
    `espera_declarada=${esperaDeclarada}`,
    `generado=${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
    "",
  ].join("\n");
  archivos["IDENTIDAD.txt"] = identidad;

  fs.mkdirSync(o.salida, { recursive: true });
  const sumas = [];
  for (const [n, contenido] of Object.entries(archivos)) {
    fs.writeFileSync(path.join(o.salida, n), contenido);
    sumas.push(`${sha256(typeof contenido === "string" ? Buffer.from(contenido, "utf8") : contenido)}  ${n}`);
  }
  fs.writeFileSync(path.join(o.salida, "SHA256SUMS"), sumas.join("\n") + "\n");

  const avisos = [];
  if (!texto.includes("NO APLICADA A PRODUCCIÓN")) avisos.push("la cabecera no dice «NO APLICADA A PRODUCCIÓN»: confirma que es la migración correcta");
  const sddCabecera = /SDD-([0-9]{4})/.exec(texto.slice(0, 600));
  if (sddCabecera && sddCabecera[1] !== o.sdd) avisos.push(`la cabecera nombra SDD-${sddCabecera[1]} y pasaste --sdd ${o.sdd}`);
  if (typeof corte === "number" && Number(prefijo(o.migracion).slice(0, 4)) <= corte && esperaDeclarada !== "sí") {
    avisos.push(`el número es ≤ al corte (${corte}) y no está en pendingBelowCutoff: el gate no la vigila`);
  }
  const resumen = {
    nombre: o.migracion,
    sha: o.sha,
    blob: blobId,
    blobMd5: md5(buf),
    blobBytes: buf.length,
    createdBy,
    proyecto: o.proyecto,
    funcionesReemplazadas: deriva.map((d) => `${d.funcion}${d.previa ? ` (último cuerpo en ${d.origen})` : " (nueva)"}${d.aceptada ? " · deriva aceptada" : ""}`),
    funcionesVerificadas: [...new Set(funciones.map((f) => f.funcion))],
    preflightPropio,
    esperaDeclarada,
    aplicarMd5: md5(archivos["aplicar.sql"]),
    salida: o.salida,
  };
  log(`preparar: ${o.migracion} en ${o.sha.slice(0, 12)} → ${o.salida}`);
  log(`  blob ${blobId.slice(0, 12)} · ${buf.length} bytes · md5 ${md5(buf)}`);
  log(`  created_by ${createdBy} · proyecto ${o.proyecto}`);
  log(`  lectura previa: ledger + deriva de ${deriva.length} función(es) + preflight propio: ${preflightPropio}`);
  log(`  verificación: ledger (md5 y bytes) + cuerpo vivo de ${resumen.funcionesVerificadas.length} función(es)`);
  log(`  espera declarada en pendingBelowCutoff: ${esperaDeclarada}`);
  for (const a of avisos) log(`  AVISO: ${a}`);
  log(`  md5 de aplicar.sql: ${resumen.aplicarMd5}`);
  log("siguiente: aplicar-remoto.sh --paso previa (docs/runbooks/aplicar-migraciones-prod.md)");
  return { ...resumen, avisos };
}

// realpath en los dos lados: en Windows una ruta corta 8.3 (AKXGEN~1) no es igual
// a la larga, y el script no correría sin avisar.
function esPrincipal() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync.native(path.resolve(process.argv[1])) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (esPrincipal()) {
  try {
    const o = leerArgs(process.argv.slice(2));
    if (o.ayuda) {
      const fuente = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
      console.log(fuente.split("\n").slice(2, 33).map((l) => l.replace(/^ \* ?/, "")).join("\n"));
      process.exit(0);
    }
    preparar(o);
  } catch (e) {
    if (e instanceof Rechazo) {
      const uso = e.message.startsWith("uso: ");
      console.error(`preparar: ${uso ? "" : "RECHAZADO · "}${e.message}`);
      process.exit(uso ? 2 : 3);
    }
    console.error(`preparar: ${e.stack || e}`);
    process.exit(2);
  }
}
