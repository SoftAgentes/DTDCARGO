import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  INSTRUCCIONES_MOTOR,
  armarPaquete,
  informeSinIa,
  leerInforme,
  mensajeParaMotor,
  type ArchivoChatwoot,
  type ArchivoFuente,
  type Informe,
  type MotivoRespaldo,
  type Paquete,
} from "./analisis";
import { contarAnalisis, guardarAnalisis, ultimoAnalisis, type AnalisisGuardado } from "./analisis-queries";
import { VERSION_RE } from "./versiones";

/**
 * «Analizar con IA» de Administración › Actualizaciones (SDD-0588, paso 3.4).
 *
 * 1. Caché: si el salto ya tiene un análisis **con IA** de los últimos 30 días, se
 *    devuelve ese y no se llama al motor.
 * 2. Tope: como mucho `MAX_ANALISIS_DIA` análisis por tenant en 24 h, y uno a la vez
 *    por tenant en este proceso.
 * 3. Lee el diff público de GitHub (`compare/vA...vB`, sin token) y arma el paquete
 *    solo de código (`armarPaquete`).
 * 4. Lo manda al motor GLM de Z.AI (API compatible con OpenAI) con timeout. Si el
 *    motor no está configurado, falla, tarda o responde algo inválido, guarda el
 *    informe **sin IA**, que solo compara qué archivos cambian.
 *
 * Nunca despliega nada. La llave va en `DTD_CHATWOOT_IA_GLM_KEY`, una variable
 * propia del servidor de Studio; nunca se registra ni viaja en el paquete.
 */

export const MAX_ANALISIS_DIA = 5;
export const CACHE_MS = 30 * 24 * 60 * 60_000;
const DIA_MS = 24 * 60 * 60_000;
const TIMEOUT_DIFF_MS = 20_000;
export const TIMEOUT_MOTOR_MS = 120_000;
/** Tope de la respuesta del motor, en tokens y en caracteres leídos. */
const MAX_TOKENS_RESPUESTA = 4_000;
const MAX_RESPUESTA = 60_000;

export const URL_MOTOR_POR_DEFECTO = "https://api.z.ai/api/coding/paas/v4/chat/completions";
export const MODELO_POR_DEFECTO = "glm-4.6";
const MODELO_RE = /^[A-Za-z0-9._-]{1,64}$/;

type Fetch = typeof fetch;

export interface ConfigMotor {
  llave: string;
  url: string;
  modelo: string;
}

/**
 * La configuración del motor desde el entorno, o null si no está (o está vacía: una
 * línea `X=` del `.env` llega como "" y cuenta como apagado).
 */
export function configMotor(env: Record<string, string | undefined> = process.env): ConfigMotor | null {
  const llave = (env.DTD_CHATWOOT_IA_GLM_KEY ?? "").trim();
  if (!llave) return null;
  const url = (env.DTD_CHATWOOT_IA_GLM_URL ?? "").trim() || URL_MOTOR_POR_DEFECTO;
  const modelo = (env.DTD_CHATWOOT_IA_GLM_MODELO ?? "").trim() || MODELO_POR_DEFECTO;
  if (!url.startsWith("https://") || !MODELO_RE.test(modelo)) return null;
  return { llave, url, modelo };
}

export const compareUrl = (desde: string, hasta: string) =>
  `https://api.github.com/repos/chatwoot/chatwoot/compare/v${desde}...v${hasta}`;

/** El diff público entre dos etiquetas de Chatwoot. Nunca lanza. */
export async function leerDiffChatwoot(
  desde: string,
  hasta: string,
  fetchImpl: Fetch = fetch,
): Promise<{ ok: true; cambios: ArchivoChatwoot[]; total: number } | { ok: false; error: "diff_no_responde" | "diff_formato" }> {
  if (!VERSION_RE.test(desde) || !VERSION_RE.test(hasta)) return { ok: false, error: "diff_formato" };
  let cuerpo: unknown;
  try {
    const res = await fetchImpl(compareUrl(desde, hasta), {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "dtd-studio-vigilante-chatwoot",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_DIFF_MS),
    });
    if (!res.ok) return { ok: false, error: "diff_no_responde" };
    cuerpo = await res.json();
  } catch {
    return { ok: false, error: "diff_no_responde" };
  }
  const files = (cuerpo as { files?: unknown })?.files;
  if (!Array.isArray(files)) return { ok: false, error: "diff_formato" };
  const cambios: ArchivoChatwoot[] = [];
  for (const f of files as Record<string, unknown>[]) {
    if (!f || typeof f.filename !== "string") continue;
    cambios.push({
      ruta: f.filename,
      estado: typeof f.status === "string" ? f.status : "modified",
      parche: typeof f.patch === "string" ? f.patch : null,
    });
  }
  return { ok: true, cambios, total: cambios.length };
}

/** Llama al motor. El informe validado, o el motivo para caer al respaldo. Nunca lanza. */
export async function llamarMotor(
  paquete: Paquete,
  config: ConfigMotor,
  fetchImpl: Fetch = fetch,
): Promise<{ ok: true; informe: Informe } | { ok: false; error: "motor_no_responde" | "motor_formato" }> {
  let texto: string;
  try {
    const res = await fetchImpl(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.llave}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model: config.modelo,
        temperature: 0.2,
        max_tokens: MAX_TOKENS_RESPUESTA,
        messages: [
          { role: "system", content: INSTRUCCIONES_MOTOR },
          { role: "user", content: mensajeParaMotor(paquete) },
        ],
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MOTOR_MS),
    });
    if (!res.ok) return { ok: false, error: "motor_no_responde" };
    const cuerpo = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const contenido = cuerpo?.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") return { ok: false, error: "motor_formato" };
    texto = contenido.slice(0, MAX_RESPUESTA);
  } catch {
    return { ok: false, error: "motor_no_responde" };
  }
  const informe = leerInforme(texto, paquete);
  return informe ? { ok: true, informe } : { ok: false, error: "motor_formato" };
}

export interface ContextoAnalisis {
  admin: SupabaseClient;
  tenantId: string;
  usuarioId: string;
  desde: string;
  hasta: string;
  checkId: number | null;
  superficie: () => ArchivoFuente[];
  env?: Record<string, string | undefined>;
  fetchImpl?: Fetch;
  ahora?: Date;
}

export type SalidaAnalisis =
  | { ok: true; reutilizado: boolean; analisis: AnalisisGuardado | null; motor: "glm" | "sin_ia" }
  | { ok: false; error: "tope" | "en_curso" | "service" };

const enCurso = new Set<string>();

export async function analizarSalto(ctx: ContextoAnalisis): Promise<SalidaAnalisis> {
  const ahora = ctx.ahora ?? new Date();
  const fetchImpl = ctx.fetchImpl ?? fetch;

  const previo = await ultimoAnalisis(ctx.admin, ctx.tenantId, ctx.desde, ctx.hasta, {
    soloConIa: true,
    desdeFecha: new Date(ahora.getTime() - CACHE_MS),
  });
  if (previo) return { ok: true, reutilizado: true, analisis: previo, motor: "glm" };

  const hechos = await contarAnalisis(ctx.admin, ctx.tenantId, new Date(ahora.getTime() - DIA_MS));
  if (hechos === null) return { ok: false, error: "service" };
  if (hechos >= MAX_ANALISIS_DIA) return { ok: false, error: "tope" };
  if (enCurso.has(ctx.tenantId)) return { ok: false, error: "en_curso" };
  enCurso.add(ctx.tenantId);

  try {
    let paquete: Paquete | null = null;
    let informe: Informe;
    let motivo: MotivoRespaldo | null = null;
    const config = configMotor(ctx.env);

    const diff = await leerDiffChatwoot(ctx.desde, ctx.hasta, fetchImpl);
    if (!diff.ok) {
      motivo = diff.error;
      informe = informeSinIa(null, motivo);
    } else {
      paquete = armarPaquete({ desde: ctx.desde, hasta: ctx.hasta, superficie: ctx.superficie(), cambios: diff.cambios, totalCambiados: diff.total });
      if (!config) {
        motivo = "motor_apagado";
        informe = informeSinIa(paquete, motivo);
      } else {
        const r = await llamarMotor(paquete, config, fetchImpl);
        if (r.ok) informe = r.informe;
        else {
          motivo = r.error;
          informe = informeSinIa(paquete, motivo);
        }
      }
    }

    const motor = motivo === null ? "glm" : "sin_ia";
    const guardado = await guardarAnalisis(ctx.admin, {
      tenantId: ctx.tenantId,
      desde: ctx.desde,
      hasta: ctx.hasta,
      checkId: ctx.checkId,
      usuarioId: ctx.usuarioId,
      motor,
      modelo: motor === "glm" ? config!.modelo : null,
      motivoRespaldo: motivo,
      informe,
      archivos: paquete?.archivos.length ?? 0,
      caracteres: paquete?.caracteres ?? 0,
      recortado: paquete?.recortado ?? false,
    });
    if (!guardado) return { ok: false, error: "service" };
    return { ok: true, reutilizado: false, analisis: null, motor };
  } finally {
    enCurso.delete(ctx.tenantId);
  }
}
