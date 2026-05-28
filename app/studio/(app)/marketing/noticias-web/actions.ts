/**
 * /studio/marketing/noticias-web · Server Actions
 *
 * Acciones server-side que llaman al SDK de Anthropic (claude-sonnet-4-6)
 * para generar artículos SEO paso a paso. Plan v4 — Phase D + E:
 *
 *  1. detectCategory      · sugiere categoría a partir del tema + tipo
 *  2. suggestKeywords     · sugiere focus_keyword + secundarias + pain points
 *  3. generateHeadlines   · 5 titulares con prefix literal de la categoría
 *  4. generateBullets     · 8-10 secciones del artículo
 *  5. generateArticle     · Markdown 800-1200 palabras
 *  6. saveDraft           · UPSERT en seo_drafts (state machine persistido)
 *  7. publishPost         · INSERT en news_posts (Phase E — publish flow)
 *
 * Cada acción:
 *   - Verifica auth + rol admin (patrón compartido con mailing/page.tsx).
 *   - Llama a Anthropic con un prompt acotado (single source of truth en
 *     lib/news/prompts.ts).
 *   - Parsea la respuesta (JSON o Markdown según el paso) y devuelve un
 *     shape estable para el cliente.
 *
 * Modo Manual (sin API): el cliente no llama a estas actions de generación,
 * usa directamente los builders de lib/news/prompts.ts para mostrar el
 * prompt al usuario. Solo saveDraft se usa siempre (UPSERT del state).
 *
 * NO se expone API key al cliente — todo corre en el servidor con
 * `process.env.ANTHROPIC_API_KEY` (ya configurada para SDD-0020).
 */

"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { createClient } from "@/lib/db/server";
import {
  NEWS_CATEGORIES_V4,
  type NewsCategoria,
  type NewsTipo,
} from "@/lib/news/categories";
import {
  buildDetectCategoryPrompt,
  buildSuggestKeywordsPrompt,
  buildGenerateHeadlinesPrompt,
  buildGenerateBulletsPrompt,
  buildGenerateArticlePrompt,
} from "@/lib/news/prompts";
import { slugify, dedupSlug } from "@/lib/news/slugify";
import {
  getNextWriter,
  getActiveWriters,
  getDisclaimer,
  AUTHOR_ROLE_BY_TIPO,
} from "@/lib/news/writers";
import { revalidatePath } from "next/cache";

// ── Tipos compartidos con el cliente ──────────────────────────

export type Tone = "informativo" | "curiosidad" | "polemico";

export interface BulletItem {
  title: string;
  desc: string;
}

export interface HeadlinesResult {
  ok: true;
  headlines: string[]; // 5 alternativas
}

export interface BulletsResult {
  ok: true;
  bullets: BulletItem[]; // 8-10 secciones
}

export interface ArticleResult {
  ok: true;
  markdown: string; // 800-1200 palabras
}

export interface DetectCategoryResult {
  ok: true;
  categoria: NewsCategoria;
  reason: string;
  confidence: number; // 0-100
}

export interface SuggestKeywordsResult {
  ok: true;
  focus_keyword: string;
  secondary_keywords: string[];
  pain_points_addressed: string[];
  reason: string;
}

export interface SaveDraftResult {
  ok: true;
  id: string;
}

export interface PublishPostInput {
  tipo: NewsTipo;
  categoria: NewsCategoria;
  headline: string;
  article_markdown: string;
  focus_keyword?: string | null;
  secondary_keywords?: string[];
  pain_points?: string[];
  /** Override del slug autogenerado (opcional) */
  slug?: string;
  /** Override del writer auto-asignado (opcional · v1.1+) */
  author_override?: { name: string; role: string | null };
  /** Si viene, se marca el draft como status='published' al insertar */
  draft_id?: string;
}

export interface PublishPostResult {
  ok: true;
  slug: string;
  postId: string;
  authorName: string;
}

export interface WriterOption {
  id: string;
  name: string;
  role: string | null;
}

export interface PublishPreviewResult {
  ok: true;
  /** Writer auto-asignado (LRU rotation) — usado por default */
  proposed: { name: string; role: string | null };
  /** Lista de writers activos del tipo (para override) — vacío para especial */
  options: WriterOption[];
  /** Disclaimer que se mostrará al pie del artículo público (null = sin disclaimer) */
  disclaimerPreview: string | null;
}

export interface ErrorResult {
  ok: false;
  error: string;
}

/** Shape mínimo del state del Generador que se persiste en seo_drafts. */
export interface DraftState {
  id?: string;
  topic: string;
  tone: Tone;
  tipo: NewsTipo | null;
  categoria: NewsCategoria | null;
  ai_suggestion_reason?: string | null;
  headlines: string[];
  selected_headline: string;
  bullets: BulletItem[];
  article_markdown: string;
  focus_keyword?: string | null;
  secondary_keywords: string[];
  pain_points: string[];
  current_step: 0 | 1 | 2 | 3;
}

// ── Helpers internos ──────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

/** Mapeo tono → instrucción para Claude (legacy fallback). */
const TONE_INSTRUCTIONS: Record<Tone, string> = {
  informativo:
    "tono informativo, claro y directo, estilo periodístico serio. Sin adjetivos vacíos.",
  curiosidad:
    "tono que despierte curiosidad, con gancho, que haga clic sin caer en clickbait barato.",
  polemico:
    "tono polémico y provocador, que genere debate honesto, sin desinformación.",
};

/** Verifica que el caller esté autenticado y sea admin del tenant. */
async function requireAdmin(): Promise<{ ok: true } | ErrorResult> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { ok: false, error: "No autenticado" };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("role")
    .maybeSingle<{ role: string }>();

  if (!link || link.role !== "admin") {
    return { ok: false, error: "Acceso restringido a admins" };
  }
  return { ok: true };
}

/** Variante que también devuelve el tenant_id (necesario para INSERTs). */
async function requireAdminWithTenant(): Promise<
  { ok: true; tenantId: string } | ErrorResult
> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { ok: false, error: "No autenticado" };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) return { ok: false, error: "Sin tenant asignado" };
  if (link.role !== "admin") {
    return { ok: false, error: "Acceso restringido a admins" };
  }
  return { ok: true, tenantId: link.tenant_id };
}

/** Lazy-init del cliente Anthropic. */
function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Setteala en Vercel env o .env.local.",
    );
  }
  return new Anthropic({ apiKey: key });
}

/**
 * Parsea JSON tolerante a fences markdown y prosa envolvente.
 * Estrategia: limpia fences ```json ... ```, intento directo; si falla,
 * busca primer "{" y último "}".
 */
function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // probamos con sub-string
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/** Extrae el texto plano del primer bloque text de una Message. */
function firstText(content: Anthropic.Messages.ContentBlock[]): string {
  const tb = content.find((b): b is TextBlock => b.type === "text");
  return tb?.text ?? "";
}

// ── Action 1 · Detectar categoría sugerida ────────────────────

export async function detectCategory(
  topic: string,
  tipo: NewsTipo,
): Promise<DetectCategoryResult | ErrorResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const cleanTopic = topic.trim();
  if (!cleanTopic) return { ok: false, error: "Ingresá un tema" };
  if (cleanTopic.length > 500) {
    return { ok: false, error: "El tema es demasiado largo (máx 500 chars)" };
  }

  const prompt = buildDetectCategoryPrompt(cleanTopic, tipo);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = firstText(response.content);
    const parsed = parseJsonLoose<{
      categoria: string;
      reason: string;
      confidence: number;
    }>(text);
    if (!parsed || typeof parsed.categoria !== "string") {
      return {
        ok: false,
        error: "Claude devolvió un formato inesperado. Reintentá.",
      };
    }
    const catInfo = NEWS_CATEGORIES_V4[parsed.categoria as NewsCategoria];
    if (!catInfo || catInfo.tipo !== tipo) {
      return {
        ok: false,
        error: `Categoría sugerida "${parsed.categoria}" no es válida para tipo "${tipo}"`,
      };
    }
    const confidence = Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
      : 70;
    return {
      ok: true,
      categoria: parsed.categoria as NewsCategoria,
      reason: String(parsed.reason ?? "").trim(),
      confidence,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: `Falló la llamada a Claude: ${msg}` };
  }
}

// ── Action 2 · Sugerir keywords SEO ───────────────────────────

export async function suggestKeywords(
  topic: string,
  categoria: NewsCategoria,
): Promise<SuggestKeywordsResult | ErrorResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const cleanTopic = topic.trim();
  if (!cleanTopic) {
    return { ok: false, error: "Ingresá un tema antes de sugerir keywords" };
  }

  const prompt = buildSuggestKeywordsPrompt(cleanTopic, categoria);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = firstText(response.content);
    const parsed = parseJsonLoose<{
      focus_keyword: string;
      secondary_keywords: string[];
      pain_points_addressed: string[];
      reason: string;
    }>(text);
    if (!parsed || typeof parsed.focus_keyword !== "string") {
      return {
        ok: false,
        error: "Claude devolvió un formato inesperado. Reintentá.",
      };
    }
    const focus = parsed.focus_keyword.trim();
    if (!focus) {
      return { ok: false, error: "No se obtuvo focus keyword válida" };
    }
    return {
      ok: true,
      focus_keyword: focus,
      secondary_keywords: (Array.isArray(parsed.secondary_keywords)
        ? parsed.secondary_keywords
        : [])
        .map((k) => String(k).trim())
        .filter((k) => k.length > 0)
        .slice(0, 6),
      pain_points_addressed: (Array.isArray(parsed.pain_points_addressed)
        ? parsed.pain_points_addressed
        : [])
        .map((p) => String(p).trim())
        .filter((p) => p.length > 0)
        .slice(0, 5),
      reason: String(parsed.reason ?? "").trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: `Falló la llamada a Claude: ${msg}` };
  }
}

// ── Action 3 · Generar 5 titulares ────────────────────────────

export async function generateHeadlines(
  topic: string,
  tone: Tone,
  categoria?: NewsCategoria,
  focusKeyword?: string,
  secondaryKeywords?: string[],
): Promise<HeadlinesResult | ErrorResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const cleanTopic = topic.trim();
  if (!cleanTopic) return { ok: false, error: "Ingresá un tema o titular base" };
  if (cleanTopic.length > 500) {
    return { ok: false, error: "El tema es demasiado largo (máx 500 chars)" };
  }

  // Plan v4: si viene categoria, usar el builder con prefix literal + keywords.
  // Sin categoria: fallback al prompt legacy (mientras no se migre todo).
  const prompt = categoria
    ? buildGenerateHeadlinesPrompt(
        cleanTopic,
        tone,
        categoria,
        focusKeyword,
        secondaryKeywords,
      )
    : `Sos editor SEO senior. Generá EXACTAMENTE 5 titulares alternativos para este tema, optimizados para SEO en castellano (Venezuela/Latam):

TEMA: ${cleanTopic}

Restricciones:
- Cada titular entre 50 y 65 caracteres
- Palabras clave naturales (sin keyword stuffing)
- ${TONE_INSTRUCTIONS[tone]}
- Sin comillas envolventes, sin numeración interna, sin emojis
- En castellano neutro Latam

Devolvé SOLO JSON válido con este shape exacto, sin prosa adicional ni bloques de código:
{"headlines": ["titular 1", "titular 2", "titular 3", "titular 4", "titular 5"]}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = firstText(response.content);
    const parsed = parseJsonLoose<{ headlines: string[] }>(text);
    if (!parsed || !Array.isArray(parsed.headlines)) {
      return {
        ok: false,
        error: "Claude devolvió un formato inesperado. Reintentá.",
      };
    }
    const headlines = parsed.headlines
      .map((h) => String(h).trim())
      .filter((h) => h.length > 0)
      .slice(0, 5);
    if (headlines.length === 0) {
      return { ok: false, error: "No se obtuvieron titulares válidos" };
    }
    return { ok: true, headlines };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: `Falló la llamada a Claude: ${msg}` };
  }
}

// ── Action 4 · Generar 8-10 bullets de estructura ─────────────

export async function generateBullets(
  headline: string,
  categoria?: NewsCategoria,
  secondaryKeywords?: string[],
): Promise<BulletsResult | ErrorResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const cleanHeadline = headline.trim();
  if (!cleanHeadline) return { ok: false, error: "Falta el titular elegido" };

  // Si viene categoria, usar el builder v4 con pain points + keywords.
  // Sin categoria: fallback al prompt legacy.
  const prompt = categoria
    ? buildGenerateBulletsPrompt(cleanHeadline, categoria, secondaryKeywords)
    : `Sos editor SEO senior. Generá la estructura de un artículo para este titular:

TITULAR: ${cleanHeadline}

Devolvé entre 8 y 10 secciones (bullets) en orden lógico de lectura. Cada bullet:
- title: subtema concreto, corto (máx 60 chars), optimizado para SEO + intención de búsqueda
- desc: 1 línea (máx 120 chars) que explica qué cubrirá la sección

Devolvé SOLO JSON válido con este shape exacto, sin prosa adicional ni bloques de código:
{"bullets": [{"title": "...", "desc": "..."}, ...]}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = firstText(response.content);
    const parsed = parseJsonLoose<{ bullets: BulletItem[] }>(text);
    if (!parsed || !Array.isArray(parsed.bullets)) {
      return {
        ok: false,
        error: "Claude devolvió un formato inesperado. Reintentá.",
      };
    }
    const bullets = parsed.bullets
      .map((b) => ({
        title: String(b?.title ?? "").trim(),
        desc: String(b?.desc ?? "").trim(),
      }))
      .filter((b) => b.title.length > 0);
    if (bullets.length < 4) {
      return {
        ok: false,
        error: "Se generaron muy pocas secciones. Reintentá.",
      };
    }
    return { ok: true, bullets };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: `Falló la llamada a Claude: ${msg}` };
  }
}

// ── Action 5 · Generar artículo Markdown 800-1200 palabras ────

export async function generateArticle(
  headline: string,
  sections: BulletItem[],
  focusKeyword?: string,
  secondaryKeywords?: string[],
): Promise<ArticleResult | ErrorResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const cleanHeadline = headline.trim();
  if (!cleanHeadline) return { ok: false, error: "Falta el titular" };
  if (sections.length === 0) {
    return { ok: false, error: "Seleccioná al menos 1 sección" };
  }

  const prompt = buildGenerateArticlePrompt(
    cleanHeadline,
    sections,
    focusKeyword,
    secondaryKeywords,
  );

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = firstText(response.content).trim();
    if (!text) {
      return { ok: false, error: "Claude devolvió un artículo vacío" };
    }
    // Limpiar fences si Claude las puso por error
    const markdown = text.replace(/^```(?:markdown|md)?\n?|\n?```$/g, "").trim();
    return { ok: true, markdown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: `Falló la llamada a Claude: ${msg}` };
  }
}

// ── Action 6 · Guardar / actualizar borrador ──────────────────

export async function saveDraft(
  state: DraftState,
): Promise<SaveDraftResult | ErrorResult> {
  const guard = await requireAdminWithTenant();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id;
  if (!userId) return { ok: false, error: "No autenticado" };

  const cleanTopic = state.topic.trim();
  if (!cleanTopic) return { ok: false, error: "Falta tema base" };

  const row = {
    tenant_id: guard.tenantId,
    topic: cleanTopic,
    tone: state.tone,
    tipo: state.tipo,
    categoria: state.categoria,
    ai_suggestion_reason: state.ai_suggestion_reason ?? null,
    headlines: state.headlines,
    selected_headline: state.selected_headline || null,
    bullets: state.bullets,
    article_markdown: state.article_markdown || null,
    focus_keyword: state.focus_keyword ?? null,
    secondary_keywords: state.secondary_keywords,
    pain_points: state.pain_points,
    current_step: state.current_step,
    created_by: userId,
  };

  if (state.id) {
    const { error } = await supabase
      .from("seo_drafts")
      .update(row)
      .eq("id", state.id);
    if (error) {
      return {
        ok: false,
        error: `No se pudo actualizar el borrador: ${error.message}`,
      };
    }
    return { ok: true, id: state.id };
  }

  const { data: inserted, error } = await supabase
    .from("seo_drafts")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) {
    return {
      ok: false,
      error: `No se pudo guardar el borrador: ${error?.message ?? "desconocido"}`,
    };
  }
  return { ok: true, id: inserted.id };
}

// ── Helpers de publishPost ────────────────────────────────────

/** Extrae primer párrafo (no heading) del markdown como excerpt. */
function extractExcerpt(markdown: string, maxLen = 200): string {
  const lines = markdown.split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.startsWith("```")) continue;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) continue;
    // Strip básico de inline markdown (bold/italic/links)
    const clean = trimmed
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/\[(.+?)\]\([^)]+\)/g, "$1");
    if (clean.length > maxLen) return clean.slice(0, maxLen - 1) + "…";
    return clean;
  }
  return "";
}

/** Estima tiempo de lectura en minutos a 200 wpm. */
function calcReadTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ── Action 7 · Preview del publish (writer asignado + opciones) ─

export async function getPublishPreview(input: {
  tipo: NewsTipo;
  headline: string;
}): Promise<PublishPreviewResult | ErrorResult> {
  const guard = await requireAdminWithTenant();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const proposed = await getNextWriter(supabase, guard.tenantId, input.tipo);
    const allActive = await getActiveWriters(
      supabase,
      guard.tenantId,
      input.tipo,
    );
    return {
      ok: true,
      proposed: {
        name: proposed.authorName,
        role: proposed.authorRole,
      },
      options: allActive.map((w) => ({
        id: w.id,
        name: w.name,
        role: AUTHOR_ROLE_BY_TIPO[input.tipo],
      })),
      disclaimerPreview: getDisclaimer(input.tipo, proposed.authorName),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error cargando preview";
    return { ok: false, error: msg };
  }
}

// ── Action 8 · Publicar artículo a news_posts ─────────────────

export async function publishPost(
  input: PublishPostInput,
): Promise<PublishPostResult | ErrorResult> {
  const guard = await requireAdminWithTenant();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id;
  if (!userId) return { ok: false, error: "No autenticado" };

  // ── Validación ──
  const cleanHeadline = input.headline.trim();
  if (!cleanHeadline) return { ok: false, error: "Falta titular" };
  const cleanMarkdown = input.article_markdown.trim();
  if (!cleanMarkdown || cleanMarkdown.length < 200) {
    return {
      ok: false,
      error: "El artículo es muy corto (mínimo 200 chars para publicar)",
    };
  }
  if (!NEWS_CATEGORIES_V4[input.categoria]) {
    return { ok: false, error: `Categoría inválida: ${input.categoria}` };
  }

  // ── Slug · base del titular, dedupe contra DB ──
  let slug: string;
  try {
    const baseSlug = input.slug?.trim() || slugify(cleanHeadline);
    if (!baseSlug) {
      return { ok: false, error: "No se pudo generar slug del titular" };
    }
    slug = await dedupSlug(supabase, baseSlug);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando slug";
    return { ok: false, error: msg };
  }

  // ── Writer · auto-assignment LRU o override ──
  let authorName: string;
  let authorRole: string | null;
  if (input.author_override) {
    authorName = input.author_override.name;
    authorRole = input.author_override.role;
  } else {
    try {
      const assignment = await getNextWriter(
        supabase,
        guard.tenantId,
        input.tipo,
      );
      authorName = assignment.authorName;
      authorRole = assignment.authorRole;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error asignando writer";
      return { ok: false, error: msg };
    }
  }

  // ── Derivados ──
  const excerpt = extractExcerpt(cleanMarkdown);
  if (!excerpt) {
    return { ok: false, error: "No se pudo derivar excerpt del artículo" };
  }
  const readTimeMin = calcReadTime(cleanMarkdown);
  // meta_description = excerpt (v1 — distinto en v1.1+ si se necesita)
  const metaDescription = excerpt;

  // ── INSERT news_posts ──
  const { data: inserted, error: insertErr } = await supabase
    .from("news_posts")
    .insert({
      tenant_id: guard.tenantId,
      slug,
      tipo: input.tipo,
      categoria: input.categoria,
      title: cleanHeadline,
      excerpt,
      body_markdown: cleanMarkdown,
      author_name: authorName,
      author_role: authorRole,
      focus_keyword: input.focus_keyword?.trim() || null,
      secondary_keywords: input.secondary_keywords ?? [],
      meta_description: metaDescription,
      pain_points: input.pain_points ?? [],
      read_time_min: readTimeMin,
      published: true,
      source: "seo-generator",
      created_by: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: `No se pudo publicar: ${insertErr?.message ?? "desconocido"}`,
    };
  }

  // ── Marcar draft como published si vino draft_id ──
  if (input.draft_id) {
    const { error: draftErr } = await supabase
      .from("seo_drafts")
      .update({ status: "published" })
      .eq("id", input.draft_id);
    // No bloqueamos publish si falla esto — log silencioso
    if (draftErr) {
      console.warn(
        `publishPost: no se pudo marcar draft ${input.draft_id} como published:`,
        draftErr.message,
      );
    }
  }

  // Revalidar caches del sitio público
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${slug}`);

  return {
    ok: true,
    slug,
    postId: inserted.id,
    authorName,
  };
}
