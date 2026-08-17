/**
 * scripts/check-numbering.mjs — dos cosas no pueden llevar el mismo número.
 *
 * SIN SHEBANG a propósito: este módulo se importa desde su test y el `#!` de la
 * línea 1 rompe el parser de Vite (mismo motivo que en
 * `check-migrations-applied.mjs`). `verify.mjs` lo invoca como `node <entry>`.
 *
 * POR QUÉ EXISTE
 * El 2026-07-29 hubo CUATRO colisiones de numeración en un solo día entre las
 * ventanas paralelas: la spec 0172 se duplicó, la migración 0268 se duplicó, la
 * 0174 se esquivó de casualidad y la 0175 se duplicó **después** de haber
 * chequeado `origin/main` — porque entre el chequeo y el push pasaron horas.
 *
 * Ninguna la cazó el gate. `docs:check` junta los números en un `Set` que usa
 * SOLO para detectar huecos, así que dos carpetas con el mismo prefijo se
 * colapsan en silencio; y nunca comparaba el `sdd:` del front-matter contra el
 * prefijo de la carpeta, que es justo el residuo que deja una renumeración a
 * medias (carpeta `0177-`, front-matter `"0175"` → verde).
 *
 * QUÉ VIGILA
 *   1. dos carpetas de spec con el mismo número;
 *   2. `sdd:` del front-matter ≠ número de la carpeta;
 *   3. dos migraciones con el mismo número.
 *
 * QUÉ **NO** HACE
 * Buscar huecos (eso ya lo reporta `docs:check`, y los huecos son normales:
 * números que nunca se usaron) ni mirar la red. **Nunca hace SKIP**: es puro
 * sistema de archivos, así que en un worktree sin `.env.local` corre igual —
 * a diferencia de `migrations-applied` y del e2e.
 *
 * CUÁNDO SALTA
 * Al MERGEAR, que es cuando las dos numeraciones viven en el mismo árbol y
 * todavía estás a tiempo de renumerar. Para evitar la carrera de raíz, reservá
 * el número al abrir la spec: `node scripts/next-number.mjs --reserve <slug>`.
 *
 * Uso:  node scripts/check-numbering.mjs
 * Exit: 0 = sin choques · 1 = hay choques · 2 = bug del check
 */
import fs from "node:fs";
import path from "node:path";

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  nc: "\x1b[0m",
};
const SPECS_DIR = path.join(process.cwd(), "docs", "specs");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/**
 * CHOQUES HISTÓRICOS CONGELADOS — no se arreglan, se declaran.
 *
 * Estos seis pares nacieron duplicados y **ya están aplicados en prod**
 * (verificado el 2026-07-29 contra `supabase_migrations.schema_migrations`; dos
 * viven bajo su nombre libre viejo: `platform_admins` y `seo_drafts_brief_fields`).
 * Una migración aplicada NO se renumera: su cabecera debe seguir diciendo el
 * número con el que corrió (runbook `aplicar-migraciones-prod.md`).
 *
 * Se declaran con la LISTA EXACTA de archivos, no sólo con el número: si mañana
 * aparece un TERCER archivo con el 0247, el set deja de coincidir y el check
 * vuelve a gritar. Congelar el número pelado habría abierto un agujero
 * permanente — que es cómo un gate deja de servir.
 */
const CHOQUES_HISTORICOS = {
  "0057": ["0057_seo_drafts_brief_fields", "0057_user_profiles_locale_nullable"],
  "0058": ["0058_platform_admins", "0058_user_invitations_region"],
  "0243": ["0243_clients_doc_kind_backfill", "0243_warehouse_boxes_seq_partial_unique"],
  "0247": ["0247_client_notifications", "0247_grant_next_consolidation_ref_authenticated"],
  "0277": ["0277_calculator_cities_destinos_faltantes", "0277_version_rls_auto_enable"],
  "0297": ["0297_container_types_activos_y_capacidad_util", "0297_legal_docs_body_hash"],
  // 2026-08-02/05: dos ventanas aplicaron su 0336 con 3 DÍAS de diferencia
  // (pod_closes_shipment 20260802225220 · rate_ddp_850_septiembre_2026
  // 20260805215529). Ambas en el ledger → ninguna se renumera.
  //
  // Detectado el 2026-08-05 mirando el ledger al revés: `pod_closes_shipment`
  // estaba APLICADA en prod y su archivo sólo existía en un worktree sin
  // pushear, así que el número ya estaba quemado y nadie lo veía.
  "0336": ["0336_pod_closes_shipment", "0336_rate_ddp_850_septiembre_2026"],
  // 2026-08-11/12: la ventana del CRM y la de Aliados tomaron los MISMOS dos
  // números el mismo día. `pnpm sdd:next` no falló — devolvió 0362 libre, y la
  // otra ventana lo tomó DESPUÉS y lo aplicó ANTES. Es exactamente el caso que
  // la regla del founder describe: entre numerar y pushear pasan horas.
  //
  // Orden real en el ledger de prod:
  //   20260811223034  0362_kommo_lead_contacts
  //   20260811223239  0363_kommo_contacts_telefono
  //   20260811225120  0362_aliados_base                    (19 min después)
  //   20260812204711  0363_storage_bug_replays_restrictive
  // Las cuatro aplicadas → ninguna se renumera.
  "0362": ["0362_aliados_base", "0362_kommo_lead_contacts"],
  "0363": ["0363_kommo_contacts_telefono", "0363_storage_bug_replays_restrictive"],
  // 2026-08-03: dos ventanas aplicaron su 0342 con ~4 h de diferencia
  // (kommo_contact_link 20260803202130 · phone_match_key_relleno 20260804011156).
  // Ambas en el ledger → ninguna se renumera.
  "0342": ["0342_kommo_contact_link", "0342_phone_match_key_relleno"],
  // 2026-08-14: NUEVE MINUTOS de diferencia — el margen más corto hasta ahora.
  //   20260814213028  0373_lote_legado_con_nombre            (SDD-0258)
  //   20260814213957  0373_kommo_writeback_chequeo_optimista (SDD-0256)
  // Las dos aplicadas → ninguna se renumera.
  //
  // Lo que enseña este caso: la ventana del CRM tenía el gate EN VERDE, porque
  // en su árbol existía una sola 0373 — la otra estaba en `main` y ella todavía
  // no había mergeado. El choque sólo se hace visible al mergear, que es
  // justamente cuando ya es tarde para renumerar si ambas se aplicaron. Con
  // nueve minutos entre una y otra, ningún `sdd:next` lo habría evitado:
  // el hueco no está en pedir el número, está en aplicar a prod antes de
  // pushear el archivo.
  "0373": ["0373_kommo_writeback_chequeo_optimista", "0373_lote_legado_con_nombre"],
};

/** Prefijo numérico de 4 dígitos, o null si el nombre no arranca con uno. */
export function numberOf(name) {
  const m = name.match(/^(\d{4})/);
  return m ? m[1] : null;
}

/**
 * LA DECISIÓN DEL CHECK, pura y testeable.
 *
 * @param {{name: string, sdd: string|null}[]} specs  carpetas de spec + su `sdd:`
 *        de front-matter (`null` si no se pudo leer — eso lo reporta docs:check,
 *        acá no se duplica el error)
 * @param {string[]} migrations  basenames de supabase/migrations (sin .sql)
 * @param {Record<string,string[]>} historicos  choques ya aplicados en prod que
 *        no se pueden renumerar; se exime el número SÓLO si el set de archivos
 *        coincide EXACTO (un tercer archivo con ese número vuelve a fallar)
 * @returns {{kind: string, number: string, detail: string}[]} choques encontrados
 */
export function findClashes(specs, migrations, historicos = CHOQUES_HISTORICOS) {
  const clashes = [];

  // 1. Dos carpetas de spec con el mismo número.
  const byNumber = new Map();
  for (const s of specs) {
    const n = numberOf(s.name);
    if (!n) continue;
    byNumber.set(n, [...(byNumber.get(n) ?? []), s.name]);
  }
  for (const [n, dirs] of byNumber) {
    if (dirs.length > 1) {
      clashes.push({
        kind: "spec-duplicada",
        number: n,
        detail: `${dirs.length} carpetas con el número ${n}: ${dirs.join(" · ")}`,
      });
    }
  }

  // 2. `sdd:` del front-matter ≠ número de la carpeta. El residuo típico de una
  //    renumeración a medias: se movió la carpeta y se olvidó el front-matter
  //    (o al revés). Se ignora `sdd: null` — la falta de campo la reporta
  //    docs:check y duplicar el error sería ruido.
  for (const s of specs) {
    const n = numberOf(s.name);
    if (!n || s.sdd == null) continue;
    if (s.sdd !== n) {
      clashes.push({
        kind: "sdd-no-coincide",
        number: n,
        detail: `${s.name}/spec.md dice sdd: "${s.sdd}" pero vive en la carpeta ${n}`,
      });
    }
  }

  // 3. Dos migraciones con el mismo número. Ojo: `0006b_...` cuenta como 0006 a
  //    propósito — el sufijo de letra es una CONTINUACIÓN deliberada de la
  //    misma migración (0006 → 0006b), no un choque. Por eso se agrupa por los
  //    4 dígitos y se exige que difieran en algo más que el sufijo.
  const migByNumber = new Map();
  for (const m of migrations) {
    const n = numberOf(m);
    if (!n) continue;
    migByNumber.set(n, [...(migByNumber.get(n) ?? []), m]);
  }
  for (const [n, files] of migByNumber) {
    if (files.length < 2) continue;
    // `0006_x` y `0006b_x` conviven; dos `0006_*` sin sufijo, no.
    const sinSufijo = files.filter((f) => /^\d{4}_/.test(f)).sort();
    if (sinSufijo.length < 2) continue;
    // Choque histórico ya aplicado → exento SÓLO si el set coincide exacto.
    const declarado = historicos[n];
    if (
      declarado &&
      declarado.length === sinSufijo.length &&
      [...declarado].sort().every((f, i) => f === sinSufijo[i])
    ) {
      continue;
    }
    clashes.push({
      kind: "migracion-duplicada",
      number: n,
      detail: `${sinSufijo.length} migraciones con el número ${n}: ${sinSufijo.join(" · ")}`,
    });
  }

  return clashes.sort((a, b) => a.number.localeCompare(b.number));
}

/** Lee `sdd:` del front-matter sin parsear YAML entero. null si no está. */
function readSdd(specPath) {
  let raw;
  try {
    raw = fs.readFileSync(specPath, "utf8");
  } catch {
    return null;
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // BOM de PowerShell
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  for (const rawLine of raw.slice(3, end).split(/\r?\n/)) {
    const m = rawLine.replace(/\r+$/, "").match(/^sdd:\s*(.*)$/);
    if (m) {
      const v = m[1].trim().replace(/^["']|["']$/g, "");
      return v === "" || v === "null" ? null : v;
    }
  }
  return null;
}

function readSpecs() {
  return fs
    .readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-/.test(d.name))
    .map((d) => ({
      name: d.name,
      sdd: readSdd(path.join(SPECS_DIR, d.name, "spec.md")),
    }));
}

function readMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""));
}

function main() {
  const specs = readSpecs();
  const migrations = readMigrations();
  const clashes = findClashes(specs, migrations);

  console.log(
    `${C.dim}   ${specs.length} specs · ${migrations.length} migraciones${C.nc}`,
  );
  for (const [n, files] of Object.entries(CHOQUES_HISTORICOS)) {
    console.log(
      `${C.yellow}   ⏸ ${n}${C.nc} — choque histórico ya aplicado en prod, NO se renumera:` +
        `${C.dim} ${files.join(" · ")}${C.nc}`,
    );
  }

  if (clashes.length > 0) {
    console.log(
      `${C.red}[FAIL]${C.nc} ${clashes.length} choque(s) de numeración:`,
    );
    for (const c of clashes) console.log(`${C.red}   🔴 ${c.detail}${C.nc}`);
    console.log(
      `${C.dim}\n   Qué hacer:\n` +
        `   1. La que se mueve es la que NO está en main (la otra ventana ya publicó).\n` +
        `   2. Pedí el próximo libre con: node scripts/next-number.mjs\n` +
        `   3. Al renumerar, movés la carpeta Y el 'sdd:' del front-matter Y las\n` +
        `      referencias en código. Este check te avisa si te falta alguna.\n` +
        `   ⚠️ Una migración YA APLICADA no se renumera: su cabecera debe seguir\n` +
        `      diciendo el número con el que corrió.${C.nc}`,
    );
    return 1;
  }

  console.log(`${C.green}[OK]${C.nc}   numbering: sin números repetidos`);
  return 0;
}

// Solo corre cuando este archivo ES el entry point (si no, el test que importa
// findClashes dispararía main() al importar). Se compara con
// `import.meta.filename` en vez de pathToFileURL: importar `node:url` acá rompe
// el test bajo Vite.
const isEntryPoint =
  process.argv[1] && import.meta.filename === path.resolve(process.argv[1]);

if (isEntryPoint) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.log(
      `${C.red}[FAIL]${C.nc} numbering: error inesperado → ${e?.stack ?? e}`,
    );
    process.exitCode = 2;
  }
}
