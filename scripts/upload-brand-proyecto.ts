/**
 * Sube el SISTEMA DE MARCA navegable a Storage (SDD-0238).
 *
 * QUÉ RESUELVE. El Brand Book enlaza 35 documentos con rutas relativas
 * (`<a href="Logo Oficial.html">`). Servido como archivo suelto, esos enlaces
 * no van a ningún lado — el founder los reportó como "no abren" el 2026-08-02.
 * Subiendo el proyecto con su estructura de carpetas bajo un prefijo común,
 * `/marca/doc/<ruta>` los resuelve sin reescribir un solo href.
 *
 * QUÉ SUBE. El CIERRE TRANSITIVO desde el Brand Book: se siguen los enlaces y
 * las referencias (`src`, `href`, `url()` del CSS) hasta agotar, arrastrando
 * cada asset que haga falta. Así no se sube el proyecto entero de Cloud Design
 * —1 GB con la v4.6 vieja, duplicados y archivos de trabajo— sino sólo lo que
 * de verdad se alcanza navegando: ~185 archivos, ~92 MB.
 *
 * DOS DESTINOS (SDD-0242). Lo que `sePublica()` excluye —el ERP por dentro, la
 * app del operario, los formularios— ya no se deja afuera: sube a la carpeta
 * `proyecto-interno/`, que la ruta sólo consulta si el visitante trae el segundo
 * código. Antes esas piezas no existían en Storage y ni el founder podía verlas.
 * Lo que alcanzan LOS DOS conjuntos (el isólogo, las tipografías) va al público:
 * ver `cierresDelProyecto()`.
 *
 * ⚠️ SE CORRE SOBRE EL PROYECTO COMPLETO, no sobre la carpeta `Handoff v5.0/`:
 * esa carpeta trae 7 de los 54 documentos que el book enlaza. Con ella, el
 * 79% de los enlaces cae en la página de aviso.
 *
 * IDEMPOTENTE: clave determinista + `upsert`. Correrlo dos veces reemplaza, no
 * duplica. Para publicar una versión nueva se corre otra vez; lo que ya no se
 * alcanza queda huérfano en el bucket (no molesta, no se sirve).
 *
 * Uso:
 *   pnpm tsx scripts/upload-brand-proyecto.ts "C:/ruta/dtd-cargo/project"
 *   pnpm tsx scripts/upload-brand-proyecto.ts "C:/ruta/project" --dry-run
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  claveProyecto,
  PROYECTO_INDICE,
  PROYECTO_PREFIJO,
  PROYECTO_PREFIJO_INTERNO,
  sePublica,
  tipoBase,
} from "../lib/marca/proyecto";

const BUCKET = "brand-assets";

const RE_REF = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const RE_URL = /url\(\s*["']?([^"')]+)/gi;

/**
 * Resuelve una referencia relativa a un archivo real dentro del proyecto.
 * Devuelve `null` para todo lo que no sea un archivo local existente:
 * `data:`, URLs absolutas, anclas, y las rutas armadas en JavaScript
 * (`src="${ISO_PRIMARY}"`), que no se pueden resolver estáticamente.
 */
function resolver(raiz: string, desde: string, ref: string): string | null {
  const limpio = decodeURIComponent(ref.split("?")[0].split("#")[0]);
  if (
    !limpio ||
    /^(data:|https?:|\/\/|mailto:|tel:|javascript:|#)/i.test(limpio) ||
    limpio.includes("${")
  ) {
    return null;
  }
  const destino = path.resolve(path.dirname(desde), limpio);
  const dentro = path.relative(raiz, destino);
  if (dentro.startsWith("..") || path.isAbsolute(dentro)) return null;
  if (!existsSync(destino) || !statSync(destino).isFile()) return null;
  return destino;
}

const rel = (raiz: string, abs: string) =>
  path.relative(raiz, abs).split(path.sep).join("/");

/**
 * Cierre transitivo desde unas semillas. `frena` decide qué documento NO se
 * cruza: se anota como frontera y no se siguen sus enlaces.
 */
function cierre(
  raiz: string,
  semillas: string[],
  frena: (relativa: string) => boolean,
): { alcanzados: Set<string>; frontera: Set<string> } {
  const alcanzados = new Set<string>();
  const frontera = new Set<string>();
  const cola = [...semillas];

  while (cola.length > 0) {
    const actual = cola.pop() as string;
    if (alcanzados.has(actual)) continue;
    alcanzados.add(actual);

    const ext = path.extname(actual).toLowerCase();
    if (ext !== ".html" && ext !== ".css") continue;

    const texto = readFileSync(actual, "utf8");
    for (const re of [RE_REF, RE_URL]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(texto)) !== null) {
        const destino = resolver(raiz, actual, m[1]);
        if (destino === null) continue;
        const r = rel(raiz, destino);
        if (path.extname(destino).toLowerCase() === ".html" && frena(r)) {
          frontera.add(destino);
          continue;
        }
        cola.push(destino);
      }
    }
  }

  return { alcanzados, frontera };
}

/**
 * Los DOS conjuntos que se suben, y por qué se calculan por separado.
 *
 * El público sale del Brand Book y se detiene en cada pieza de producto. El
 * interno arranca justo en esas piezas y sigue desde ahí, arrastrando lo que
 * necesiten para verse.
 *
 * ⚠️ **Un archivo que aparece en los dos va al público**, y esto importa: los
 * mockups del ERP usan el mismo isólogo y la misma tipografía que el book. Si
 * cada conjunto subiera su copia, el mismo logo viviría en dos claves y una
 * quedaría gateada sin razón — y peor, el día que cambie habría que acordarse de
 * las dos. Compartido significa público: ya se sirve sin código desde el book.
 *
 * El sobrante —lo que SÓLO alcanzan las piezas de producto— es lo que de verdad
 * pide el segundo código: las capturas del ERP, los PDF de inspección.
 */
function cierresDelProyecto(raiz: string) {
  const indice = path.join(raiz, PROYECTO_INDICE);
  if (!existsSync(indice)) {
    throw new Error(
      `No encontré "${PROYECTO_INDICE}" en ${raiz}.\n` +
        "Esta es la carpeta del PROYECTO COMPLETO, no la de `Handoff v5.0/`.",
    );
  }

  const pub = cierre(raiz, [indice], (r) => !sePublica(r));

  // Desde las piezas de producto ya no se frena en nada: adentro de esa capa
  // todo se puede ver. Lo que caiga acá y ya sea público, se descarta abajo.
  const int = cierre(raiz, [...pub.frontera], () => false);

  const publicos = [...pub.alcanzados].map((p) => rel(raiz, p));
  const internos = [...int.alcanzados]
    .map((p) => rel(raiz, p))
    .filter((r) => !pub.alcanzados.has(path.join(raiz, r.split("/").join(path.sep))));

  return { publicos: publicos.sort(), internos: internos.sort() };
}

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  const raiz = process.argv[2];
  const seco = process.argv.includes("--dry-run");
  if (!raiz) {
    throw new Error(
      'Falta la carpeta del proyecto.\n' +
        '  pnpm tsx scripts/upload-brand-proyecto.ts "C:/ruta/dtd-cargo/project"',
    );
  }

  const { publicos, internos } = cierresDelProyecto(path.resolve(raiz));
  const peso = (xs: string[]) =>
    xs.reduce((s, a) => s + statSync(path.join(raiz, a)).size, 0) / 1048576;
  const docsDe = (xs: string[]) => xs.filter((a) => a.toLowerCase().endsWith(".html"));

  console.log("=== sistema de marca navegable ===");
  console.log("  marca (abre con el código de marca)");
  console.log(`    documentos : ${docsDe(publicos).length}`);
  console.log(`    archivos   : ${publicos.length}`);
  console.log(`    peso       : ${peso(publicos).toFixed(1)} MB`);
  console.log("  producto (pide además el código interno · SDD-0242)");
  console.log(`    documentos : ${docsDe(internos).length}`);
  console.log(`    archivos   : ${internos.length}`);
  console.log(`    peso       : ${peso(internos).toFixed(1)} MB`);

  if (seco) {
    console.log("\n  se publicarían como marca:");
    for (const d of docsDe(publicos)) console.log(`     · ${d}`);
    console.log("\n  quedarían tras el código interno:");
    for (const d of docsDe(internos)) console.log(`     · ${d}`);
    console.log("\n  (--dry-run: no se subió nada)");
    return;
  }

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!tenant) throw new Error("No hay ningún tenant en esta base.");

  // Dos rutas distintas que produzcan la misma clave se pisarían en silencio y
  // el visor mostraría la pieza equivocada. Con el hash es prácticamente
  // imposible, pero "prácticamente" no es "nunca" y el costo de comprobarlo es
  // un Set.
  const claves = new Map<string, string>();
  for (const r of [...publicos, ...internos]) {
    const k = claveProyecto(r);
    const previo = claves.get(k);
    if (previo !== undefined) {
      throw new Error(`Colisión de clave entre "${previo}" y "${r}" (${k}).`);
    }
    claves.set(k, r);
  }

  const total = publicos.length + internos.length;
  let subidos = 0;
  const fallos: string[] = [];

  async function subir(lista: string[], prefijo: string) {
    for (const r of lista) {
      const clave = `${tenant!.id}/${prefijo}/${claveProyecto(r)}`;
      const cuerpo = readFileSync(path.join(raiz, r));
      let { error } = await db.storage.from(BUCKET).upload(clave, cuerpo, {
        contentType: tipoBase(path.basename(r)),
        upsert: true,
      });
      // El bucket tiene una allowlist de MIME y no incluye `text/javascript`,
      // `text/css` ni `image/x-icon` — 8 archivos del proyecto caían por eso.
      // Se reintenta con un tipo genérico en vez de ampliar la allowlist, que
      // afecta a TODO el catálogo por 8 archivos. No se pierde nada: el
      // `Content-Type` con el que se sirve lo calcula la ruta por extensión, no
      // lo lee de Storage.
      if (error && /mime type/i.test(error.message)) {
        ({ error } = await db.storage.from(BUCKET).upload(clave, cuerpo, {
          contentType: "application/octet-stream",
          upsert: true,
        }));
      }
      if (error) {
        fallos.push(`${r} — ${error.message}`);
      } else {
        subidos += 1;
        if (subidos % 25 === 0) console.log(`  … ${subidos}/${total}`);
      }
    }
  }

  await subir(publicos, PROYECTO_PREFIJO);
  await subir(internos, PROYECTO_PREFIJO_INTERNO);

  console.log(`\n  subidos: ${subidos}/${total}`);
  console.log(`    marca    → ${PROYECTO_PREFIJO}/`);
  console.log(`    producto → ${PROYECTO_PREFIJO_INTERNO}/`);
  if (fallos.length > 0) {
    console.log(`  ⚠ fallos: ${fallos.length}`);
    for (const f of fallos.slice(0, 10)) console.log(`     · ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
