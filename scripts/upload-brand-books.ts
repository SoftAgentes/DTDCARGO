/**
 * Sube los HTML del Brand Book al catálogo de marca (SDD-0238).
 *
 * POR QUÉ ES UN SCRIPT APARTE DE `seed:marca`: aquel siembra lo que está EN EL
 * REPO. Los books no están — salieron de git a Storage por peso (founder
 * 2026-08-02): cada versión son 15-27 MB, y en git eso es permanente sobre un
 * `.git` que ya iba en 172 MB. Este lee de una carpeta local que le pasas por
 * argumento, así que sirve tanto para la carga inicial como para un NORTE-SYNC
 * hecho desde la máquina de quien recibió el ZIP.
 *
 * La vía NORMAL para publicar un book nuevo es **Studio › Marketing › HUB de
 * marca** (subir por la UI, sin desplegar). Este script existe para la primera
 * carga y para cuando son varios archivos de golpe.
 *
 * IDEMPOTENTE: la clave de Storage es determinista (sin timestamp) y antes de
 * insertar se busca por `storage_path`. Correrlo dos veces re-sube el binario y
 * refresca los metadatos, no duplica filas.
 *
 * Uso:
 *   pnpm tsx scripts/upload-brand-books.ts "C:/ruta/a/la/carpeta"
 *
 * Requiere en `.env.local` (o en el shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (el bucket es privado y las tablas tienen RLS)
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BRAND_BOOK_STORAGE_NAME } from "../lib/marca/brand-book";

const BUCKET = "brand-assets";
const SECTION = "brand-book";

type Book = {
  /** Nombre del archivo tal como llegó de Cloud Design. */
  source: string;
  /** Nombre dentro del bucket. Kebab-case, sin acentos (convención del repo). */
  filename: string;
  title: string;
  subtitle: string;
  /**
   * Orden dentro de la sección. El maestro primero — es el que el visor abre a
   * pantalla completa, y también el primero que ve quien entra a leer.
   */
  sortOrder: number;
};

const BOOKS: Book[] = [
  {
    source: "Brand Book DTD v5.0 · OFFLINE.html",
    filename: BRAND_BOOK_STORAGE_NAME,
    title: "Brand Book DTD v5.0",
    subtitle: "Documento maestro · se abre a pantalla completa",
    sortOrder: 10,
  },
  {
    source: "Manual de Producción · DTD-Cargo · OFFLINE.html",
    filename: "manual-de-produccion-dtd-v5.0.html",
    title: "Manual de Producción",
    subtitle: "Para imprenta y proveedores · qué archivo, qué técnica, qué tamaño",
    sortOrder: 20,
  },
  {
    source: "ERP Studio Brand Book.html",
    filename: "erp-studio-brand-book-v5.0.html",
    title: "ERP Studio Brand Book",
    subtitle: "La capa del ERP · Nunito Sans + Sora (BD-035)",
    sortOrder: 30,
  },
];

/** Carga `.env.local` si las variables no vienen ya del shell. */
function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    throw new Error(
      'Falta la carpeta de origen.\n  pnpm tsx scripts/upload-brand-books.ts "C:/ruta/a/la/carpeta"',
    );
  }

  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. El bucket es privado y las tablas tienen RLS.",
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Mismo criterio que /registro y /marca: el tenant operativo es el más antiguo.
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!tenant) throw new Error("No hay ningún tenant en esta base.");

  const { data: section } = await db
    .from("brand_sections")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("slug", SECTION)
    .maybeSingle<{ id: string }>();
  if (!section) {
    throw new Error(
      `No existe la sección "${SECTION}". ¿Se aplicó la migración 0334 en esta base?`,
    );
  }

  const problemas: string[] = [];

  for (const book of BOOKS) {
    const absolute = path.join(sourceDir, book.source);
    if (!existsSync(absolute)) {
      problemas.push(`${book.source} (no está en ${sourceDir})`);
      continue;
    }

    const bytes = await readFile(absolute);

    /**
     * Guarda de autonomía. Un book con referencias a archivos vecinos abre roto
     * adentro del visor y el fallo es MUDO: el iframe carga, el HTML está, y
     * sólo faltan las imágenes. Es lo que pasó con el Manual de Producción del
     * v5.0.
     *
     * DOS SEVERIDADES, porque no todo lo relativo duele igual:
     *   · **Atributo HTML** (`<img src>`, `<link href>`, `url()` en CSS) → BLOQUEA.
     *     El navegador lo pide al pintar y lo que se ve es un hueco.
     *   · **Referencia armada por JavaScript** (`el.src = 'otro.html?x='`) → AVISA.
     *     Son los botones de descarga internos que traen los books (el ZIP de
     *     app-icons, el generador de avatares). Degradan con su propio mensaje
     *     de error en vez de romper la lectura — y en `/marca` son redundantes,
     *     porque descargar es justamente lo que hace el catálogo.
     */
    const html = bytes.toString("utf8");
    // `%23` = `#` codificado. Aparece dentro de los SVG en `data:` URI, donde una
    // máscara o un degradado se referencian por id (`url(%23mask-a)`). Es una
    // referencia INTERNA al propio documento, no un archivo vecino.
    const esRelativa = (ref: string) =>
      !/^(?:data:|https?:|\/\/|mailto:|tel:|#|%23|\{)/i.test(ref);

    /**
     * Sólo atributos de etiquetas que el navegador RESUELVE al pintar.
     *
     * La lista de etiquetas es explícita a propósito. Con un `<[a-z]` genérico
     * el patrón se envenena con el JavaScript embebido: un `for (i<FILES.length)`
     * abre un falso tag y el `[^>]*?` corre hasta el próximo `href=` que
     * encuentre, dentro de una cadena de JS. Eso reportaba como "referencia
     * rota" nombres de variables (`pageBlob`, `blob`, `u`) en documentos que
     * están perfectos.
     */
    const enAtributo = [
      ...html.matchAll(
        /<(?:img|link|script|iframe|source|embed|object|video|audio|track|use|image)\b[^>]*?\b(?:src|href|data|xlink:href)\s*=\s*["']([^"']+)["']/gi,
      ),
    ]
      .map((m) => m[1])
      .filter(esRelativa);
    // `(?<![a-z])` es obligatorio: sin él, y con la bandera insensible, `url(`
    // matchea dentro de `URL.createObjectURL(pageBlob)` y reporta el nombre de
    // la variable como si fuera un archivo faltante.
    const enCss = [...html.matchAll(/(?<![a-z])url\(\s*["']?([^"')]+)["']?\s*\)/gi)]
      .map((m) => m[1])
      .filter(esRelativa);

    const rompen = [...new Set([...enAtributo, ...enCss])];
    if (rompen.length > 0) {
      problemas.push(
        `${book.source}: NO es autocontenido — ${rompen.length} referencia(s) que el navegador pide al pintar (${rompen.slice(0, 3).join(", ")}${rompen.length > 3 ? "…" : ""}). Abriría con huecos.`,
      );
      continue;
    }

    const enScript = [
      ...new Set(
        [...html.matchAll(/\.(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
          .map((m) => m[1])
          .filter(esRelativa),
      ),
    ];
    if (enScript.length > 0) {
      console.warn(
        `  ⚠ ${book.source}: ${enScript.length} descarga(s) interna(s) que no van a funcionar offline (${enScript.join(", ")}). Se sube igual — el documento se lee bien.`,
      );
    }

    // Determinista: sin timestamp, para que correr esto dos veces no duplique.
    const storagePath = `${tenant.id}/marca/${SECTION}/${book.filename}`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "text/html", upsert: true });
    if (uploadError) {
      problemas.push(`${book.filename} (Storage: ${uploadError.message})`);
      continue;
    }

    const row = {
      title: book.title,
      subtitle: book.subtitle,
      kind: "documento",
      mime: "text/html",
      bytes: bytes.byteLength,
      tile: "light",
      sort_order: book.sortOrder,
    };

    const { data: existing } = await db
      .from("brand_assets")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("storage_path", storagePath)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();

    const { error: dbError } = existing
      ? await db.from("brand_assets").update(row).eq("id", existing.id)
      : await db.from("brand_assets").insert({
          ...row,
          tenant_id: tenant.id,
          section_id: section.id,
          storage_path: storagePath,
        });

    if (dbError) {
      problemas.push(`${book.filename} (DB: ${dbError.message})`);
      continue;
    }

    console.log(
      `  ✓ ${book.filename}  ${(bytes.byteLength / 1048576).toFixed(2)} MB  ${
        existing ? "(actualizado)" : "(nuevo)"
      }`,
    );
  }

  if (problemas.length > 0) {
    // Se sale en error: un "verde" al que le faltó la mitad del catálogo es
    // exactamente el tipo de silencio que después cuesta caro.
    console.error(`\n${problemas.length} archivo(s) NO se cargaron:`);
    for (const p of problemas) console.error(`  · ${p}`);
    process.exit(1);
  }

  console.log(`\nBrand Book: ${BOOKS.length} documento(s) en /marca.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
