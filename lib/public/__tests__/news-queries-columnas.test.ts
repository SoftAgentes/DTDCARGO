// @vitest-environment node
/**
 * SDD-0611 (C1) · El sitio público no pide columnas que delaten la vía automática.
 *
 * anon tiene SELECT sobre toda `news_posts` (0055). Con `select("*")`, la 0518
 * expone `publish_via`, `seo_draft_id` y `content_sha256`, y
 * `publish_via = 'automatica'` declara la IA, contra §4.7. Esta prueba exige
 * a las cuatro lecturas de filas completas de `lib/public/news-queries.ts` una
 * lista explícita con exactamente las 18 columnas seguras del catálogo de
 * producción. No pide `created_by` ni `tenant_id`, ni las seis que `NewsPostRow`
 * declara y no existen en la base.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pedidos: string[] = [];

/** Archivos .ts/.tsx de una carpeta, sin pruebas. */
function fuentes(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== "__tests__") salida.push(...fuentes(rel));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      salida.push(rel);
    }
  }
  return salida;
}

/**
 * Cada `.from("news_posts")` con el `select` de su misma cadena: hasta el primer
 * `;` o `.from(`, así no se toma el select de otra consulta.
 */
function lecturasDeNoticias(src: string): string[] {
  const salida: string[] = [];
  for (const m of src.matchAll(/\.from\(\s*["']news_posts["']\s*\)/g)) {
    const resto = src.slice(m.index + m[0].length);
    const fin = resto.search(/;|\.from\(/);
    const cadena = fin === -1 ? resto : resto.slice(0, fin);
    const sel = cadena.match(/\.select\(\s*([^)]*)\)/);
    if (sel) salida.push(sel[1].trim());
  }
  return salida;
}

/** Doble encadenable del cliente: anota cada `select` y devuelve vacío. */
function consulta() {
  const resultado = { data: [], error: null };
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = async () => ({ data: null, error: null });
  q.then = (ok: (v: typeof resultado) => unknown, mal?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, mal);
  return q;
}

vi.mock("../supabase-anon", () => ({
  getAnonClient: () => ({
    from: (tabla: string) => ({
      select: (columnas: string) => {
        pedidos.push(`${tabla}:${columnas}`);
        return consulta();
      },
    }),
  }),
}));

/**
 * Catálogo de producción de news_posts, leído por el DG el 2026-11-09 (estructura,
 * sin filas): 24 columnas, anon con SELECT en todas.
 *
 * SEGURAS: las 18 que el sitio lee. `source` existe, pero ninguna página lo usa.
 */
const SEGURAS = new Set([
  "id", "slug", "tipo", "categoria", "title", "excerpt", "body_markdown",
  "author_name", "author_role", "focus_keyword", "secondary_keywords",
  "meta_description", "pain_points", "date", "read_time_min", "published",
  "created_at", "updated_at",
]);

/** Existen y no se piden: delatan la vía automática o son datos internos. */
const PROHIBIDAS = ["publish_via", "seo_draft_id", "content_sha256", "tenant_id", "created_by", "source"];

/**
 * NO existen en producción, aunque lib/news/types.ts las declare opcionales:
 * pedirlas daría error y vaciaría /noticias.
 */
const INEXISTENTES = [
  "content_kind", "cover_image_url", "cover_alt", "featured", "reviewer_name", "reviewer_role",
];

async function leerTodo() {
  const q = await import("../news-queries");
  await q.listPublishedPosts();
  await q.getPostBySlug("una-noticia");
  await q.getRelatedPosts("una-noticia", "operaciones" as never, 3);
}

describe("SDD-0611 C1 · columnas que lee el sitio público de news_posts", () => {
  beforeEach(() => {
    pedidos.length = 0;
  });

  it("mide las cuatro lecturas de filas completas (piso contra una lista vacía)", async () => {
    await leerTodo();
    const deNoticias = pedidos.filter((p) => p.startsWith("news_posts:"));
    expect(deNoticias.length).toBeGreaterThanOrEqual(4);
  });

  it("ninguna pide `*`", async () => {
    await leerTodo();
    for (const p of pedidos) expect(p, p).not.toMatch(/(^|[:,\s])\*($|[,\s])/);
  });

  it("ninguna pide publish_via, seo_draft_id, content_sha256, tenant_id, created_by ni source", async () => {
    await leerTodo();
    for (const p of pedidos) {
      const columnas = p.split(":")[1].split(",").map((c) => c.trim());
      for (const prohibida of PROHIBIDAS) expect(columnas, p).not.toContain(prohibida);
    }
  });

  it("ninguna pide una columna que no existe en producción", async () => {
    await leerTodo();
    for (const p of pedidos) {
      const columnas = p.split(":")[1].split(",").map((c) => c.trim());
      for (const c of INEXISTENTES) expect(columnas, p).not.toContain(c);
    }
  });

  it("las cuatro lecturas de filas completas piden exactamente las 18 seguras", async () => {
    await leerTodo();
    const completas = pedidos.filter((p) => p.startsWith("news_posts:") && p !== "news_posts:slug");
    expect(completas.length).toBe(4);
    for (const p of completas) {
      const columnas = p.split(":")[1].split(",").map((c) => c.trim());
      expect(new Set(columnas), p).toEqual(SEGURAS);
    }
  });
});

describe("SDD-0611 C1 · ninguna lectura de news_posts pide `*` (estático)", () => {
  it("lib/news, lib/public y lib/studio/news nunca hacen select(\"*\") sobre news_posts", () => {
    const lecturas: string[] = [];
    for (const dir of ["lib/news", "lib/public", "lib/studio/news"]) {
      for (const f of fuentes(dir)) {
        for (const sel of lecturasDeNoticias(readFileSync(join(process.cwd(), f), "utf8"))) {
          lecturas.push(`${f}: ${sel}`);
        }
      }
    }
    // Piso: hoy son 10 (news-queries 5, autopublicar 3, slugify 1 y writers 1).
    // Si el recorrido dejara de encontrarlas, no puede salir verde.
    expect(lecturas.length, lecturas.join("\n")).toBeGreaterThanOrEqual(10);
    for (const l of lecturas) expect(l, l).not.toMatch(/:\s*["'`]\s*\*\s*["'`]$/);
  });
});
