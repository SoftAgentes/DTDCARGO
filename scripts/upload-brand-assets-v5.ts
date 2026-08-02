/**
 * Carga al catálogo de marca (SDD-0238) el material suelto del handoff v5 de
 * Cloud Design: isólogos vectoriales, motivos gráficos, banco de fotos y los
 * renders de aplicaciones.
 *
 * POR QUÉ NO ES `seed:marca`: aquel siembra lo que está EN EL REPO. Esto lee de
 * la carpeta donde se extrajo el handoff, que vive FUERA del árbol del proyecto
 * (regla del repo: los ZIP adentro ya causaron drift de marca).
 *
 * NO SE RE-CODIFICA NADA. Un centro de marca sirve los originales: el diseñador
 * que baja un render lo va a colocar en una pieza. Sumados a los books, el
 * catálogo queda en ~128 MB contra el tope de 180 MB del paquete "todo"
 * (`MAX_BUNDLE_BYTES`), así que entra con margen. Si en el futuro no entra, el
 * endpoint ya responde 413 con texto legible en vez de romper.
 *
 * IDEMPOTENTE: clave de Storage determinista (sin timestamp) + búsqueda previa
 * por `storage_path`. Correrlo dos veces refresca metadatos, no duplica filas.
 *
 * Uso:
 *   pnpm tsx scripts/upload-brand-assets-v5.ts "C:/ruta/al/handoff/project"
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "brand-assets";

type Entrada = {
  seccion: string;
  /** Ruta relativa a la carpeta del handoff. */
  origen: string;
  titulo: string;
  subtitulo: string;
  kind: string;
  mime: string;
  tile: "auto" | "light" | "dark" | "checker";
  orden: number;
};

const MIMES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/** "dtd-linterna-wine" → "Linterna · wine". Nombre legible, no el archivo. */
function tituloDeMotivo(base: string): string {
  const partes = base.replace(/^dtd-/, "").split("-");
  const variante = partes.pop() ?? "";
  const motivo = partes.join(" ");
  return `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)} · ${variante}`;
}

/** "operacion-05-precinto-contenedor" → "Precinto contenedor". */
function tituloDeFoto(base: string): string {
  const limpio = base.replace(/^(estudio|humana|info|operacion|textura)-?\d*-?/, "");
  const texto = limpio.replace(/-/g, " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const FAMILIA_FOTO: Record<string, string> = {
  estudio: "Estudio · producto y medición",
  humana: "Humana · equipo y clientes",
  info: "Infografía · capacidad y CBM",
  operacion: "Operación · bodega, puerto y ruta",
  textura: "Textura · fondo",
};

function construirEntradas(raiz: string): Entrada[] {
  const out: Entrada[] = [];
  const listar = (rel: string, filtro: (f: string) => boolean) => {
    const dir = path.join(raiz, rel);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(filtro).sort();
  };

  // ── Logos: los vectores. Los PNG ya los sembró `seed:marca`. ──────────
  const LOGOS: Record<string, { titulo: string; sub: string; tile: Entrada["tile"] }> = {
    "dtdcargo-isologo-primary.svg": { titulo: "Isólogo Primary · SVG", sub: "Vector · fondos claros", tile: "light" },
    "dtdcargo-isologo-reverse.svg": { titulo: "Isólogo Reverse · SVG", sub: "Vector · fondos oscuros", tile: "dark" },
    "dtdcargo-isologo-mono-light.svg": { titulo: "Isólogo Mono Light · SVG", sub: "Vector · una tinta, fondo oscuro", tile: "dark" },
    "dtdcargo-isologo-mono-dark.svg": { titulo: "Isólogo Mono Dark · SVG", sub: "Vector · una tinta, fondo claro", tile: "light" },
    "dtdcargo-isologo-primary-vector.pdf": { titulo: "Isólogo Primary · PDF vectorial", sub: "Para imprenta · escalable sin pérdida", tile: "light" },
    "dtdcargo-original-8-artboards.pdf": { titulo: "Isólogo · 8 mesas de trabajo", sub: "Todas las variantes en un PDF", tile: "light" },
  };
  let orden = 100;
  for (const [archivo, meta] of Object.entries(LOGOS)) {
    if (!existsSync(path.join(raiz, "assets", archivo))) continue;
    out.push({
      seccion: "logos", origen: `assets/${archivo}`, titulo: meta.titulo,
      subtitulo: meta.sub, kind: "logo",
      mime: MIMES[path.extname(archivo)] ?? "application/octet-stream",
      tile: meta.tile, orden: (orden += 10),
    });
  }

  // ── Iconografía: el contenedor + los motivos del sistema gráfico ──────
  orden = 100;
  if (existsSync(path.join(raiz, "assets", "container.svg"))) {
    out.push({
      seccion: "iconos", origen: "assets/container.svg", titulo: "Contenedor",
      subtitulo: "Ilustración de contenedor", kind: "icono",
      mime: "image/svg+xml", tile: "light", orden: (orden += 10),
    });
  }
  for (const f of listar("recursos-graficos", (f) => f.startsWith("dtd-") && f.endsWith(".svg"))) {
    const base = path.basename(f, ".svg");
    // Los `cream` son claros: sobre papel blanco no se verían.
    const tile: Entrada["tile"] = base.endsWith("-cream") ? "dark" : "light";
    out.push({
      seccion: "iconos", origen: `recursos-graficos/${f}`, titulo: tituloDeMotivo(base),
      subtitulo: "Motivo del sistema gráfico", kind: "icono",
      mime: "image/svg+xml", tile, orden: (orden += 10),
    });
  }

  // ── Fotografía: el banco editorial ────────────────────────────────────
  orden = 100;
  for (const f of listar("assets/photo-editorial", (f) => /\.(jpe?g|png|webp)$/i.test(f))) {
    const base = path.basename(f, path.extname(f));
    const familia = base.split("-")[0];
    out.push({
      seccion: "fotos", origen: `assets/photo-editorial/${f}`, titulo: tituloDeFoto(base),
      subtitulo: FAMILIA_FOTO[familia] ?? "Banco editorial", kind: "foto",
      mime: MIMES[path.extname(f).toLowerCase()] ?? "image/jpeg",
      tile: "auto", orden: (orden += 10),
    });
  }

  // ── Plantillas: los renders de aplicaciones ───────────────────────────
  // Cloud Design es explícito en su LÉEME: son de REFERENCIA, no editables. Se
  // suben con esa etiqueta en el subtítulo — una sección vacía parece un error
  // del sistema; una con referencias marcadas comunica el estado real.
  orden = 100;
  for (const f of listar("assets/aplicaciones", (f) => /\.(png|jpe?g|webp)$/i.test(f))) {
    const base = path.basename(f, path.extname(f));
    const texto = base.replace(/-/g, " ");
    out.push({
      seccion: "plantillas", origen: `assets/aplicaciones/${f}`,
      titulo: texto.charAt(0).toUpperCase() + texto.slice(1),
      subtitulo: "Referencia · no editable",
      kind: "plantilla",
      mime: MIMES[path.extname(f).toLowerCase()] ?? "image/png",
      tile: "auto", orden: (orden += 10),
    });
  }

  return out;
}

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const raiz = process.argv[2];
  if (!raiz) throw new Error('Falta la carpeta del handoff.\n  pnpm tsx scripts/upload-brand-assets-v5.ts "C:/ruta/project"');
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: tenant } = await db.from("tenants").select("id")
    .order("created_at", { ascending: true }).limit(1).maybeSingle<{ id: string }>();
  if (!tenant) throw new Error("No hay ningún tenant en esta base.");

  const { data: secciones } = await db.from("brand_sections").select("id, slug")
    .eq("tenant_id", tenant.id).returns<{ id: string; slug: string }[]>();
  const porSlug = new Map((secciones ?? []).map((s) => [s.slug, s.id]));

  const entradas = construirEntradas(raiz);
  if (entradas.length === 0) throw new Error(`No encontré material en ${raiz}. ¿Es la carpeta correcta?`);

  let nuevos = 0, actualizados = 0, bytes = 0;
  const problemas: string[] = [];
  const porSeccion = new Map<string, number>();

  for (const e of entradas) {
    const sectionId = porSlug.get(e.seccion);
    if (!sectionId) { problemas.push(`${e.origen} (no existe la sección "${e.seccion}")`); continue; }

    const absoluto = path.join(raiz, e.origen);
    if (!existsSync(absoluto)) { problemas.push(`${e.origen} (no está)`); continue; }

    const contenido = await readFile(absoluto);
    const nombre = path.basename(e.origen);
    const storagePath = `${tenant.id}/marca/${e.seccion}/${nombre}`;

    const { error: subida } = await db.storage.from(BUCKET)
      .upload(storagePath, contenido, { contentType: e.mime, upsert: true });
    if (subida) { problemas.push(`${nombre} (Storage: ${subida.message})`); continue; }

    const fila = {
      title: e.titulo, subtitle: e.subtitulo, kind: e.kind, mime: e.mime,
      bytes: contenido.byteLength, tile: e.tile, sort_order: e.orden,
    };

    const { data: existente } = await db.from("brand_assets").select("id")
      .eq("tenant_id", tenant.id).eq("storage_path", storagePath)
      .is("deleted_at", null).maybeSingle<{ id: string }>();

    const { error: dbErr } = existente
      ? await db.from("brand_assets").update(fila).eq("id", existente.id)
      : await db.from("brand_assets").insert({
          ...fila, tenant_id: tenant.id, section_id: sectionId, storage_path: storagePath,
        });
    if (dbErr) { problemas.push(`${nombre} (DB: ${dbErr.message})`); continue; }

    if (existente) actualizados++;
    else nuevos++;
    bytes += contenido.byteLength;
    porSeccion.set(e.seccion, (porSeccion.get(e.seccion) ?? 0) + 1);
  }

  console.log("\nPor sección:");
  for (const [s, n] of [...porSeccion].sort()) console.log(`  ${s.padEnd(12)} ${n}`);
  console.log(`\n${nuevos} nuevo(s) · ${actualizados} actualizado(s) · ${(bytes / 1048576).toFixed(1)} MB`);

  if (problemas.length) {
    console.error(`\n${problemas.length} NO se cargaron:`);
    for (const p of problemas) console.error(`  · ${p}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
