/**
 * Siembra el catálogo de marca (SDD-0238) con lo que YA existe en el repo.
 *
 * POR QUÉ EXISTE: la migración 0334 crea las secciones pero no puede crear
 * assets — los archivos actuales (los 4 isólogos, el OG, el favicon y el Brand
 * Book standalone) viven en `public/brand/` y `private/marca/`, o sea en git, y
 * una migración SQL no sube binarios a Storage. Sin este paso, `/marca` abre con
 * las secciones vacías el primer día, que es peor que lo que había.
 *
 * De acá en adelante los archivos se suben por la UI (Studio › Marketing › HUB).
 * Esto es sólo el arranque.
 *
 * IDEMPOTENTE: la clave de Storage es determinista (sin timestamp, a diferencia
 * de las subidas por UI) y antes de insertar se busca por `storage_path`. Correrlo
 * dos veces no duplica nada.
 *
 * Uso:
 *   pnpm seed:marca
 *
 * Requiere en `.env.local` (o en el shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (el bucket es privado y las tablas tienen RLS)
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BRAND_BOOK_FILE, BRAND_BOOK_VERSION } from "../lib/marca/brand-book";

const BUCKET = "brand-assets";

type SeedAsset = {
  /** Slug de la sección donde cae. */
  section: string;
  /** Ruta en el repo, relativa a la raíz. */
  source: string;
  /** Nombre del archivo dentro del bucket. */
  filename: string;
  title: string;
  subtitle: string;
  kind: string;
  mime: string;
  /**
   * Fondo de la miniatura (migr 0335). Se declara acá porque el sembrador SÍ
   * sabe cuál es cada variante — dejarlo en `auto` haría que las versiones
   * claras del isólogo se pintaran sobre papel blanco y se vieran vacías.
   */
  tile: "auto" | "light" | "dark" | "checker";
  width?: number;
  height?: number;
};

const ASSETS: SeedAsset[] = [
  {
    section: "logos",
    source: "public/brand/dtdcargo-isologo-primary.png",
    filename: "dtdcargo-isologo-primary.png",
    title: "Isólogo Primary",
    subtitle: "Fondos claros · paper, blanco",
    kind: "logo",
    mime: "image/png",
    tile: "light",
    width: 741,
    height: 764,
  },
  {
    section: "logos",
    source: "public/brand/dtdcargo-isologo-reverse.png",
    filename: "dtdcargo-isologo-reverse.png",
    title: "Isólogo Reverse",
    subtitle: "Fondos oscuros · navy, sidebar",
    kind: "logo",
    mime: "image/png",
    tile: "dark",
    width: 741,
    height: 764,
  },
  {
    section: "logos",
    source: "public/brand/dtdcargo-isologo-mono-light.png",
    filename: "dtdcargo-isologo-mono-light.png",
    title: "Isólogo Mono light",
    subtitle: "Sobre wine · CTAs, alertas",
    kind: "logo",
    mime: "image/png",
    tile: "dark",
    width: 741,
    height: 764,
  },
  {
    section: "logos",
    source: "public/brand/dtdcargo-isologo-mono-dark.png",
    filename: "dtdcargo-isologo-mono-dark.png",
    title: "Isólogo Mono dark",
    subtitle: "B&N · sello, imprenta",
    kind: "logo",
    mime: "image/png",
    tile: "light",
    width: 741,
    height: 764,
  },
  {
    section: "logos",
    source: "public/brand/og-image.png",
    filename: "og-image.png",
    title: "OG image",
    subtitle: "Redes y previews de link",
    kind: "fondo",
    mime: "image/png",
    tile: "light",
    width: 1200,
    height: 630,
  },
  {
    section: "logos",
    source: "public/brand/favicon-32.png",
    filename: "favicon-32.png",
    title: "Favicon",
    subtitle: "Pestaña del navegador",
    kind: "icono",
    mime: "image/png",
    tile: "light",
    width: 32,
    height: 32,
  },
  {
    section: "iconos",
    source: "public/brand/container.svg",
    filename: "container.svg",
    title: "Contenedor",
    subtitle: "Ilustración de contenedor",
    kind: "icono",
    mime: "image/svg+xml",
    tile: "light",
  },
  {
    section: "iconos",
    source: "public/brand/dtdcargo-dimensions-box.svg",
    filename: "dtdcargo-dimensions-box.svg",
    title: "Caja con dimensiones",
    subtitle: "Usado por la calculadora de CBM",
    kind: "icono",
    mime: "image/svg+xml",
    tile: "light",
  },
  {
    section: "brand-book",
    source: `private/marca/${BRAND_BOOK_FILE}`,
    filename: BRAND_BOOK_FILE,
    title: `Brand Book DTD ${BRAND_BOOK_VERSION}`,
    subtitle: "Documento maestro · HTML autocontenido",
    kind: "documento",
    mime: "text/html",
    tile: "light",
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

  const { data: sections } = await db
    .from("brand_sections")
    .select("id, slug")
    .eq("tenant_id", tenant.id)
    .returns<{ id: string; slug: string }[]>();
  if (!sections?.length) {
    throw new Error(
      "No hay secciones de marca. ¿Se aplicó la migración 0334 en esta base?",
    );
  }
  const sectionBySlug = new Map(sections.map((s) => [s.slug, s.id]));

  let subidos = 0;
  let actualizados = 0;
  const faltantes: string[] = [];

  for (const asset of ASSETS) {
    const sectionId = sectionBySlug.get(asset.section);
    if (!sectionId) {
      faltantes.push(`${asset.filename} (no existe la sección "${asset.section}")`);
      continue;
    }

    const absolute = path.join(process.cwd(), asset.source);
    if (!existsSync(absolute)) {
      faltantes.push(`${asset.source} (no está en el repo)`);
      continue;
    }

    // Determinista: sin timestamp, para que correr esto dos veces no duplique.
    const storagePath = `${tenant.id}/marca/${asset.section}/${asset.filename}`;

    const { data: existing } = await db
      .from("brand_assets")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("storage_path", storagePath)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();

    if (existing) {
      // Ya está: no se re-sube el binario, pero SÍ se refrescan los metadatos de
      // los que este archivo es la fuente de verdad. Sin esto, las filas
      // sembradas antes de la migr 0335 se quedarían para siempre en
      // `tile = 'auto'` y sin dimensiones — el sembrador saltaría en silencio y
      // el logo claro seguiría invisible sobre papel blanco.
      const { error: updateError } = await db
        .from("brand_assets")
        .update({
          tile: asset.tile,
          width: asset.width ?? null,
          height: asset.height ?? null,
          subtitle: asset.subtitle,
        })
        .eq("id", existing.id);
      if (updateError) {
        faltantes.push(`${asset.filename} (DB update: ${updateError.message})`);
        continue;
      }
      actualizados++;
      continue;
    }

    const bytes = await readFile(absolute);
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: asset.mime, upsert: true });
    if (uploadError) {
      faltantes.push(`${asset.filename} (Storage: ${uploadError.message})`);
      continue;
    }

    const { error: insertError } = await db.from("brand_assets").insert({
      tenant_id: tenant.id,
      section_id: sectionId,
      title: asset.title,
      subtitle: asset.subtitle,
      kind: asset.kind,
      storage_path: storagePath,
      mime: asset.mime,
      bytes: bytes.byteLength,
      tile: asset.tile,
      width: asset.width ?? null,
      height: asset.height ?? null,
    });
    if (insertError) {
      // Se limpia el objeto para no dejar un binario huérfano en el bucket.
      await db.storage.from(BUCKET).remove([storagePath]);
      faltantes.push(`${asset.filename} (DB: ${insertError.message})`);
      continue;
    }

    console.log(`  ✓ ${asset.section}/${asset.filename}`);
    subidos++;
  }

  console.log(
    `\nCatálogo de marca: ${subidos} subido(s), ${actualizados} actualizado(s).`,
  );
  if (faltantes.length > 0) {
    // Se reporta y se sale en error: un seed "verde" al que le faltó la mitad
    // del catálogo es exactamente el tipo de silencio que después cuesta caro.
    console.error(`\n${faltantes.length} archivo(s) NO se cargaron:`);
    for (const f of faltantes) console.error(`  · ${f}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
