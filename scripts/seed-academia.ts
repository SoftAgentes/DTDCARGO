/**
 * Seed de la Academia DTD (SDD-0093) — siembra los 4 cursos base + sus módulos
 * + las lecciones del Curso 1 (Domina Yiwu, guionizadas).
 *
 * Idempotente: find-or-insert por (tenant_id, slug) para cursos, (course_id,
 * title) para módulos y (module_id, title) para lecciones. No pisa contenido
 * editado a mano. Los cursos entran en `proximamente`; el precio lo pone
 * Administración aparte (service_configs). Las lecciones del Curso 1 entran
 * `publicado` (las demás se llenan con video/info luego). Requiere la migración
 * 0149 aplicada (columna academy_lessons.widget).
 *
 * Uso (tras aplicar las migraciones 0144 + 0149):
 *   pnpm tsx scripts/seed-academia.ts
 *   # o, si pnpm ignora builds: node --env-file=.env.local node_modules/.bin/tsx scripts/seed-academia.ts
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role
 * para escribir en tablas con RLS).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface LessonSeed {
  title: string;
  min: number;
  /** Visible sin inscripción (gancho de preview). */
  freePreview?: boolean;
  /** Herramienta interactiva embebida en la lección (migr 0149 y 0393). */
  widget?: "alibaba_address" | "alibaba_curso";
}

interface CourseSeed {
  slug: string;
  title: string;
  tier: "gratis" | "inicial" | "core" | "pro" | "complemento";
  summary: string;
  modules: string[];
  /**
   * Lecciones por título de módulo. Opcional: hoy solo el Curso 1 trae lecciones
   * reales (guionizadas, status 'publicado'); el resto se llena luego con video.
   */
  lessons?: Record<string, LessonSeed[]>;
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
    // La guía interactiva (SDD-0099) entra como lección estrella del lead magnet:
    // sola ya es una mini-experiencia completa (9 etapas + calculadoras + avance
    // guardado), y `freePreview` la deja abierta sin inscripción. Requiere la
    // migración 0393 aplicada (CHECK con 'alibaba_curso').
    lessons: {
      "Bienvenida: importar SÍ es para ti": [
        {
          title: "Guía interactiva: comprar en Alibaba paso a paso",
          min: 15,
          freePreview: true,
          widget: "alibaba_curso",
        },
      ],
    },
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
    // Lecciones guionizadas del curso inicial (plan Academia, M1–M6). La lección
    // de dirección lleva la Guía de Alibaba embebida (widget) y es preview.
    lessons: {
      "Importa lo que tu cliente necesita": [
        { title: "¿Por qué China? (y el mito de la mala calidad)", min: 7, freePreview: true },
        { title: "Calidad A / AA / AAA: lo que de verdad pides", min: 6 },
        { title: "Conoce tu producto a fondo", min: 6 },
        { title: "Consideraciones aduaneras básicas (antes de comprar)", min: 8 },
      ],
      "Conéctate con Alibaba": [
        { title: "Crea tu cuenta de comprador", min: 6 },
        { title: "Buscar como un PRO (filtros y fichas)", min: 9 },
        { title: "¿Fábrica o intermediario?", min: 7 },
        { title: "Tu dirección de envío: la bodega DTD en Yiwu", min: 5, freePreview: true, widget: "alibaba_address" },
        { title: "Más allá de Alibaba (1688, ferias, Yiwu)", min: 8 },
      ],
      "La fórmula contra las estafas": [
        { title: "Verificaciones esenciales en Alibaba", min: 8 },
        { title: "Trade Assurance: tu red de seguridad", min: 7 },
        { title: "Verifica al proveedor como un PRO", min: 9 },
        { title: "Banderas rojas que avisan una estafa", min: 6 },
      ],
      "Negocia como un PRO": [
        { title: "El primer contacto que te toma en serio", min: 7 },
        { title: "INCOTERMS sin enredo (FOB, CIF, DDP)", min: 9 },
        { title: "Muestras y precios reales", min: 7 },
        { title: "El contrato simple (tu orden de compra)", min: 6 },
      ],
      "¿Quién valida tu carga?": [
        { title: "Qué es una inspección y cuándo conviene", min: 6 },
        { title: "Tipos de inspección (cuál para ti)", min: 7 },
        { title: "Gestión de muestras", min: 6 },
        { title: "Disputas básicas (recuperar tu dinero)", min: 7 },
      ],
      "Define tu RAC (Rentabilidad·Aduanas·Costos)": [
        { title: "Pagos seguros (y cómo pagar desde Venezuela)", min: 8 },
        { title: "DDP vs ordinaria: pagas al llegar", min: 7 },
        { title: "Costo final con la calculadora DTD", min: 9 },
        { title: "Documentos de tu importación", min: 6 },
        { title: "Tu ruta clara, paso a paso", min: 7 },
        { title: "Cómo DTD te lo resuelve", min: 6 },
      ],
    },
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

/** Lecciones de un curso, agrupadas por título de módulo. Idempotente por
 * (module_id, title): no pisa lecciones editadas a mano. Entran 'publicado'. */
async function seedLessons(
  supabase: SupabaseClient,
  tenantId: string,
  courseId: string,
  lessonsByModule: Record<string, LessonSeed[]>,
): Promise<void> {
  const { data: mods } = await supabase
    .from("academy_modules")
    .select("id, title")
    .eq("course_id", courseId)
    .is("deleted_at", null);
  const moduleId = new Map((mods ?? []).map((m: { id: string; title: string }) => [m.title, m.id]));

  for (const [moduleTitle, lessons] of Object.entries(lessonsByModule)) {
    const mid = moduleId.get(moduleTitle);
    if (!mid) {
      console.error(`[seed-academia] módulo no encontrado para lecciones: "${moduleTitle}"`);
      continue;
    }

    const { data: existing } = await supabase
      .from("academy_lessons")
      .select("title")
      .eq("module_id", mid)
      .is("deleted_at", null);
    const have = new Set((existing ?? []).map((l: { title: string }) => l.title));

    const toInsert = lessons
      .map((l, i) => ({
        tenant_id: tenantId,
        module_id: mid,
        course_id: courseId,
        title: l.title,
        sort: i,
        kind: "video",
        duration_min: l.min,
        free_preview: l.freePreview ?? false,
        status: "publicado",
        widget: l.widget ?? null,
      }))
      .filter((l) => !have.has(l.title));

    if (toInsert.length === 0) continue;
    const { error } = await supabase.from("academy_lessons").insert(toInsert);
    if (error) console.error(`[seed-academia] lecciones de "${moduleTitle}":`, error.message);
  }
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
      if (c.lessons) await seedLessons(supabase, tenant.id, courseId, c.lessons);
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
