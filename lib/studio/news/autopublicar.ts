/**
 * SDD-0611 · La vía automática: evalúa un borrador `en_revision` y lo publica o
 * lo retiene, y avisa en `#noticias`.
 *
 * Orden:
 *   1. lee el borrador, el interruptor, las automáticas recientes, el aviso
 *      anterior y si el borrador o el slug ya existen;
 *   2. evalúa F1 a F10 en código (lib/news/autopublicar/filtros.ts) sobre el texto
 *      exacto que se publicaría;
 *   3. llama a `news_evaluacion_automatica` (migración 0518), que reevalúa F1, F3,
 *      F7 y F10 con bloqueo y escribe la auditoría (F9) en la misma transacción;
 *   4. manda el aviso a Discord y registra si llegó (F8 lo lee la próxima vez).
 *
 * Quien llama pasa un cliente con `service_role`: la función de la base solo la
 * ejecuta ese rol. Nada de esto está enganchado a una ruta todavía (ver el
 * handoff de la 0611): la 0518 tiene que estar aplicada antes.
 *
 * Sin datos de clientes: el borrador es contenido de la oficina, y el aviso
 * lleva titular, enlace, filtros y enlace de retiro, nunca el cuerpo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsCategoria, NewsTipo } from "@/lib/news/categories";
import { avisoPublicadaSola, avisoRetenida } from "@/lib/news/autopublicar/aviso";
import { CONTROL_VERSION } from "@/lib/news/autopublicar/control";
import {
  evaluarFiltros,
  type AgenteVersion,
  type EvaluacionFiltros,
  type VeredictoRevisor,
} from "@/lib/news/autopublicar/filtros";
import { huellaDe } from "@/lib/news/autopublicar/huella";
import { automaticasDeLaSemana, lunesCaracas } from "@/lib/news/autopublicar/ritmo";
import { extraerExtracto, tiempoDeLectura } from "@/lib/news/derivados";
import { slugify } from "@/lib/news/slugify";
import { discordEnabled, discordTenantAuthorized } from "@/lib/studio/discord/channels";
import {
  isDiscordWebhookUrl,
  sendDiscordWebhook,
  type DiscordDeliveryState,
} from "@/lib/studio/discord/send-webhook";
import type { EnvSource } from "@/lib/runtime/app-env";

/** Variable del servidor con el webhook de `#noticias` (§4.5). */
export const NOTICIAS_WEBHOOK_ENV = "DISCORD_WEBHOOK_NOTICIAS";
/** Variable del servidor con los nombres prohibidos (§4.3.1): uno por línea o separados por «;». */
export const NOMBRES_PROHIBIDOS_ENV = "NEWS_NOMBRES_PROHIBIDOS";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface DependenciasAutopublicacion {
  /** Cliente con service_role. */
  db: SupabaseClient;
  env?: EnvSource;
  ahora?: Date;
  fetchImpl?: typeof fetch;
}

export type DecisionAutomatica = "publicada" | "retenida" | "ignorada";

export interface ResultadoAutopublicacion {
  ok: boolean;
  error?: string;
  decision?: DecisionAutomatica;
  motivos?: string[];
  postId?: string | null;
  aviso?: DiscordDeliveryState | "sin_canal" | "no_aplica";
  evaluacion?: EvaluacionFiltros;
}

interface FilaBorrador {
  id: string;
  tenant_id: string;
  status: string;
  tipo: NewsTipo | null;
  categoria: NewsCategoria | null;
  selected_headline: string | null;
  article_markdown: string | null;
  focus_keyword: string | null;
  secondary_keywords: unknown;
  reviewer_verdict: VeredictoRevisor | null;
  autopub_sources: unknown;
  search_console: { consulta?: unknown; fecha?: unknown } | null;
  idea_tipo: string | null;
  autopub_test_noticia: Record<string, unknown> | null;
  autopub_content_kind: string | null;
  autopub_cover_image_url: string | null;
  writer_agent: AgenteVersion | null;
}

const COLUMNAS_BORRADOR =
  "id, tenant_id, status, tipo, categoria, selected_headline, article_markdown, focus_keyword, " +
  "secondary_keywords, reviewer_verdict, autopub_sources, search_console, idea_tipo, " +
  "autopub_test_noticia, autopub_content_kind, autopub_cover_image_url, writer_agent";

function sitio(env: EnvSource): string {
  return (env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com").replace(/\/+$/, "");
}

/** Nombres prohibidos de la configuración del servidor; `null` si no hay (F5 falla cerrado). */
export function nombresProhibidosDe(env: EnvSource): string[] | null {
  const raw = env[NOMBRES_PROHIBIDOS_ENV]?.trim();
  if (!raw) return null;
  const nombres = raw.split(/[\n;]+/).map((n) => n.trim()).filter(Boolean);
  return nombres.length > 0 ? nombres : null;
}

/** Webhook de `#noticias`, solo para el tenant dueño y fuera de prueba. */
export function webhookNoticias(tenantId: string, env: EnvSource): string | null {
  if (!discordEnabled(env) || !discordTenantAuthorized(tenantId, env)) return null;
  const url = env[NOTICIAS_WEBHOOK_ENV]?.trim();
  return url && isDiscordWebhookUrl(url) ? url : null;
}

function textos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function evaluarBorradorAutomatico(
  deps: DependenciasAutopublicacion,
  draftId: string,
): Promise<ResultadoAutopublicacion> {
  const env = deps.env ?? process.env;
  const ahora = deps.ahora ?? new Date();
  const { db } = deps;

  const { data: b, error: errBorrador } = await db
    .from("seo_drafts")
    .select(COLUMNAS_BORRADOR)
    .eq("id", draftId)
    .maybeSingle<FilaBorrador>();
  if (errBorrador) return { ok: false, error: `No se pudo leer el borrador: ${errBorrador.message}` };
  if (!b) return { ok: false, error: "Borrador inexistente" };
  if (b.status !== "en_revision") return { ok: true, decision: "ignorada", motivos: [], aviso: "no_aplica" };

  const title = (b.selected_headline ?? "").trim();
  const body = (b.article_markdown ?? "").trim();
  const excerpt = extraerExtracto(body);
  const secundarias = textos(b.secondary_keywords);
  const post = {
    slug: slugify(title),
    tipo: (b.tipo ?? "especial") as NewsTipo,
    categoria: (b.categoria ?? "novedades-dtd") as NewsCategoria,
    title,
    excerpt,
    meta_description: excerpt,
    body_markdown: body,
    focus_keyword: b.focus_keyword?.trim() || null,
    secondary_keywords: secundarias,
    pain_points: [] as string[],
    read_time_min: tiempoDeLectura(body),
  };
  const huella = huellaDe(post);

  const [conf, recientes, anterior, mismoBorrador, mismoSlug] = await Promise.all([
    db
      .from("news_autopublish_settings")
      .select("enabled, daily_cap, weekly_cap")
      .eq("tenant_id", b.tenant_id)
      .maybeSingle<{ enabled: boolean; daily_cap: number; weekly_cap: number }>(),
    db
      .from("news_posts")
      .select("created_at")
      .eq("tenant_id", b.tenant_id)
      .eq("publish_via", "automatica")
      .gte("created_at", new Date(ahora.getTime() - 8 * DIA_MS).toISOString()),
    db
      .from("news_publication_audit")
      .select("notice_state")
      .eq("tenant_id", b.tenant_id)
      .eq("via", "automatica")
      .eq("decision", "publicada")
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ notice_state: string | null }>(),
    db.from("news_posts").select("id").eq("seo_draft_id", b.id).maybeSingle<{ id: string }>(),
    db.from("news_posts").select("id").eq("slug", post.slug).maybeSingle<{ id: string }>(),
  ]);
  const errLectura = [conf, recientes, anterior, mismoBorrador, mismoSlug].find((r) => r.error)?.error;
  if (errLectura) return { ok: false, error: `No se pudo leer el estado: ${errLectura.message}` };

  const automaticas = ((recientes.data ?? []) as Array<{ created_at: string }>).map((r) => new Date(r.created_at));
  const writer = b.writer_agent;
  const evaluacion = evaluarFiltros({
    tenantId: b.tenant_id,
    tenantDuenoId: env.DISCORD_TENANT_ID?.trim() || null,
    interruptor: conf.data
      ? { enabled: conf.data.enabled, topeDia: conf.data.daily_cap, topeSemana: conf.data.weekly_cap }
      : null,
    borrador: {
      id: b.id,
      status: b.status,
      ideaTipo: b.idea_tipo,
      testNoticia: b.autopub_test_noticia,
      searchConsole: b.search_console,
      sources: Array.isArray(b.autopub_sources) ? (b.autopub_sources as Array<{ url?: string; titulo?: string }>) : null,
      contentKind: b.autopub_content_kind,
      coverImageUrl: b.autopub_cover_image_url,
      writerAgent: writer,
      reviewerVerdict: b.reviewer_verdict,
    },
    post,
    huella,
    nombresProhibidos: nombresProhibidosDe(env),
    ahora,
    automaticasPublicadas: automaticas,
    avisoAnterior: anterior.data ? anterior.data.notice_state : "ninguna",
    yaPublicado: !!mismoBorrador.data,
    slugOcupado: !!mismoSlug.data,
    // La versión de los prompts es la del perfil del Redactor que los lleva.
    versiones: {
      prompts: writer?.agente && writer?.version ? `${writer.agente}@${writer.version}` : null,
      control: CONTROL_VERSION,
    },
  });

  const v = b.reviewer_verdict;
  const { data: rpc, error: errRpc } = await db.rpc("news_evaluacion_automatica", {
    p_tenant_id: b.tenant_id,
    p_draft_id: b.id,
    p_post: post,
    p_auditoria: {
      content_sha256: huella,
      correlation_id: crypto.randomUUID(),
      writer: writer ? { agente: writer.agente, modelo: writer.modelo, version: writer.version } : null,
      reviewer: v ? { agente: v.agente, modelo: v.modelo, version: v.version, veredicto: v.veredicto } : null,
      prompts_version: evaluacion.resultados.F9.pasa ? `${writer?.agente}@${writer?.version}` : null,
      control_version: CONTROL_VERSION,
    },
    p_filtros: evaluacion.resultados,
    p_motivos: evaluacion.motivos,
  });
  // F9: si la base no pudo escribir la auditoría, no se publicó nada.
  if (errRpc || !rpc) {
    return { ok: false, error: `La base no publicó: ${errRpc?.message ?? "sin respuesta"}`, evaluacion };
  }
  const r = rpc as {
    decision: DecisionAutomatica;
    post_id?: string | null;
    audit_id?: string;
    motivos?: string[];
    semana?: number;
  };
  if (r.decision === "ignorada") return { ok: true, decision: "ignorada", motivos: [], aviso: "no_aplica", evaluacion };

  const aviso = await avisar(deps, env, ahora, b.tenant_id, r, {
    titular: title,
    draftId: b.id,
    slug: post.slug,
    evaluacion,
    riesgo: typeof v?.riesgo === "string" ? v.riesgo : null,
    topeSemana: conf.data?.weekly_cap ?? 0,
    automaticas,
  });

  return {
    ok: true,
    decision: r.decision,
    motivos: r.motivos ?? [],
    postId: r.post_id ?? null,
    aviso,
    evaluacion,
  };
}

async function avisar(
  deps: DependenciasAutopublicacion,
  env: EnvSource,
  ahora: Date,
  tenantId: string,
  r: { decision: DecisionAutomatica; post_id?: string | null; audit_id?: string; motivos?: string[] },
  datos: {
    titular: string;
    draftId: string;
    slug: string;
    evaluacion: EvaluacionFiltros;
    riesgo: string | null;
    topeSemana: number;
    automaticas: Date[];
  },
): Promise<DiscordDeliveryState | "sin_canal"> {
  const base = sitio(env);
  let texto: string;
  if (r.decision === "publicada") {
    const { data: salidas } = await deps.db
      .from("news_post_exits")
      .select("reason")
      .eq("tenant_id", tenantId)
      .eq("publish_via", "automatica")
      .gte("created_at", `${lunesCaracas(ahora)}T04:00:00Z`);
    const motivos = ((salidas ?? []) as Array<{ reason: string | null }>).map((s) => s.reason ?? "motivo_pendiente");
    texto = avisoPublicadaSola({
      titular: datos.titular,
      url: `${base}/noticias/${datos.slug}`,
      retiroUrl: `${base}/studio/marketing/noticias-web/retirar/${r.post_id}`,
      semana: { publicadas: automaticasDeLaSemana(ahora, datos.automaticas) + 1, tope: datos.topeSemana },
      resultados: datos.evaluacion.resultados,
      riesgoRevisor: datos.riesgo,
      retiradas: { cantidad: motivos.length, motivos },
    });
  } else {
    texto = avisoRetenida({
      titular: datos.titular,
      motivos: r.motivos ?? [],
      colaUrl: `${base}/studio/marketing/noticias-web?estado=retenido`,
      codigoBorrador: datos.draftId,
    });
  }

  const url = webhookNoticias(tenantId, env);
  const envio = url ? await sendDiscordWebhook(url, texto, { fetchImpl: deps.fetchImpl }) : null;
  const estado: DiscordDeliveryState | "sin_canal" = envio ? envio.estado : "sin_canal";
  if (r.audit_id) {
    // Sin canal cuenta como no entregado: F8 frena la siguiente hasta que Sam confirme.
    await deps.db.rpc("news_registrar_aviso", {
      p_audit_id: r.audit_id,
      p_estado: estado === "sin_canal" ? "rechazado" : estado,
      p_message_id: envio?.messageId ?? null,
    });
  }
  return estado;
}
