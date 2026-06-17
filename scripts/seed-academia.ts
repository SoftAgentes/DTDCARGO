/**
 * Seed de la Academia DTD (SDD-0093) — siembra los 4 cursos base + sus módulos.
 *
 * Idempotente: find-or-insert por (tenant_id, slug) para cursos y
 * (course_id, title) para módulos. No pisa contenido editado a mano.
 * Los cursos entran en `proximamente`; el precio lo pone Administración aparte
 * (service_configs). Las lecciones se llenan con video/info luego.
 *
 * Uso (tras aplicar la migración 0144):
 *   pnpm tsx scripts/seed-academia.ts
 *   # o, si pnpm ignora builds: node --env-file=.env.local node_modules/.bin/tsx scripts/seed-academia.ts
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role
 * para escribir en tablas con RLS).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface CourseSeed {
  slug: string;
  title: string;
  tier: "gratis" | "inicial" | "core" | "pro" | "complemento";
  summary: string;
  modules: string[];
}

const COURSES: CourseSeed[] = [
  {
    slug: "curso-0-guia-rapida",
    title: "Importar desde China: Guía Rápida para Venezolanos",
    tier: "gratis",
    summary: "Lead magnet gratis: el camino completo de un vistazo, para arrancar.",
    modules: [
      "Bienvenida: importar SÍ es para ti",
      "El mapa completo: del clic a tu puerta",
      "¿Qué se importa bien desde Venezuela?",
      "El miedo #1: las estafas (y cómo se evitan)",
      "¿Cuánto cuesta de verdad? (costo puesto en VE)",
      "Tu siguiente paso (hacerlo solo vs con DTD)",
    ],
  },
  {
    slug: "curso-1-domina-yiwu",
    title: "Domina Yiwu: De la Pantalla al Contenedor",
    tier: "inicial",
    summary: "El curso inicial: tu primera importación de prueba, sin intermediarios.",
    modules: [
      "Importa lo que tu cliente necesita",
      "Conéctate con Alibaba",
      "La fórmula contra las estafas",
      "Negocia como un PRO",
      "¿Quién valida tu carga?",
      "Define tu RAC (Rentabilidad·Aduanas·Costos)",
    ],
  },
  {
    slug: "curso-2-de-0-a-contenedor",
    title: "De 0 a Contenedor en 4 Semanas",
    tier: "core",
    summary: "Cohorte de 4 semanas + sesiones en vivo: del cero a embarcar tu contenedor.",
    modules: [
      "Estrategia de producto",
      "Plataformas a fondo (Alibaba, 1688, Yiwu)",
      "Verificación avanzada de proveedores",
      "Negociación + contrato",
      "Inspección y control de calidad",
      "RAC: Rentabilidad, Aduanas, Costos",
      "Viajando a Yiwu (preparación)",
      "Logística, escala y tu equipo DTD",
    ],
  },
  {
    slug: "masterclass-1688",
    title: "MasterClass 1688: Compra como los chinos",
    tier: "complemento",
    summary: "Compra directa en 1688 (30-50% más barato) y cómo DTD resuelve la fricción.",
    modules: [
      "Por qué 1688 (y por qué casi nadie lo usa)",
      "Crear y configurar tu cuenta en 1688",
      "Ubicar y verificar proveedores",
      "Una compra real en 1688",
      "El puente: cómo DTD resuelve 1688",
    ],
  },
];

async function findOrInsertCourse(
  supabase: SupabaseClient,
  tenantId: string,
  c: CourseSeed,
  sort: number,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("academy_courses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", c.slug)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("academy_courses")
    .insert({
      tenant_id: tenantId,
      slug: c.slug,
      title: c.title,
      tier: c.tier,
      summary: c.summary,
      status: "proximamente",
      sort,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    console.error(`[seed-academia] curso ${c.slug}:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function ensureModules(
  supabase: SupabaseClient,
  tenantId: string,
  courseId: string,
  titles: string[],
): Promise<void> {
  const { data: existing } = await supabase
    .from("academy_modules")
    .select("title")
    .eq("course_id", courseId)
    .is("deleted_at", null);
  const have = new Set((existing ?? []).map((m: { title: string }) => m.title));

  const toInsert = titles
    .map((title, i) => ({ tenant_id: tenantId, course_id: courseId, title, sort: i }))
    .filter((m) => !have.has(m.title));

  if (toInsert.length === 0) return;
  const { error } = await supabase.from("academy_modules").insert(toInsert);
  if (error) console.error(`[seed-academia] módulos de ${courseId}:`, error.message);
}

export async function seedAcademia(supabase: SupabaseClient): Promise<void> {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "dtd")
    .maybeSingle<{ id: string }>();
  if (error || !tenant?.id) {
    throw new Error("[seed-academia] No se encontró el tenant 'dtd'.");
  }

  for (let i = 0; i < COURSES.length; i++) {
    const c = COURSES[i];
    const courseId = await findOrInsertCourse(supabase, tenant.id, c, i);
    if (courseId) {
      await ensureModules(supabase, tenant.id, courseId, c.modules);
      console.log(`[seed-academia] ✓ ${c.title}`);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed-academia] Iniciando…");
  await seedAcademia(supabase);
  console.log("[seed-academia] Terminado.");
}

// Permite `pnpm tsx scripts/seed-academia.ts` (standalone) y reuso vía import.
if (process.argv[1] && process.argv[1].includes("seed-academia")) {
  main().catch((err) => {
    console.error("[seed-academia] Falló:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
