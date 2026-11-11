/**
 * SDD-0611 §4.2 · Los diez filtros de la publicación automática.
 *
 * Una sola pasada, sobre el texto exacto que se va a publicar. Falla cerrada: un
 * filtro que no puede evaluarse (dato faltante, error) cuenta como fallado con su
 * código. Si cualquiera falla, el borrador queda `retenido`.
 *
 * Esta función no toca la base. F1, F3 (huella), F7, F9 y F10 se reevalúan
 * además dentro de la transacción de la base (`news_evaluacion_automatica`), con
 * bloqueo, para que ninguna otra ruta se los salte.
 *
 * El borrador es contenido no confiable (§4.3.2): nada de lo que diga cambia
 * estos filtros, porque ninguno lo lee un modelo.
 */

import { CEREBRO_A_EDITORIAL, scoreFromTest, TEST_NOTICIA_KEYS, type CerebroTipo } from "@/lib/news/cerebro";
import type { NewsCategoria, NewsTipo } from "@/lib/news/categories";
import { controlLineasRojas, lineasRojasDelRevisor, type FuenteBorrador } from "./control";
import { tieneMarca } from "./marcas";
import { evaluarPuntaje } from "./puntaje";
import { evaluarRitmo } from "./ritmo";

export const FILTROS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"] as const;
export type Filtro = (typeof FILTROS)[number];

/** Código con que falla cada filtro cuando no se pudo evaluar. */
const CODIGO_POR_DEFECTO: Record<Filtro, string> = {
  F1: "interruptor_apagado",
  F2: "fuera_de_alcance",
  F3: "sin_revisor",
  F4: "marca_pendiente",
  F5: "linea_roja:no_evaluada",
  F6: "puntaje:no_evaluado",
  F7: "tope_dia",
  F8: "aviso_pendiente",
  F9: "sin_auditoria",
  F10: "duplicado",
};

export interface ResultadoFiltro {
  pasa: boolean;
  codigos: string[];
}

export type ResultadosFiltros = Record<Filtro, ResultadoFiltro>;

export interface AgenteVersion {
  agente?: string | null;
  modelo?: string | null;
  version?: string | null;
}

export interface VeredictoRevisor extends AgenteVersion {
  veredicto?: string | null;
  draft_id?: string | null;
  huella?: string | null;
  lineas_rojas?: Record<string, unknown> | null;
  riesgo?: string | null;
}

export interface PostAEvaluar {
  title: string;
  slug: string;
  tipo: NewsTipo;
  categoria: NewsCategoria;
  excerpt: string;
  meta_description: string | null;
  body_markdown: string;
  focus_keyword: string | null;
}

export interface EntradaFiltros {
  /** Tenant del borrador y el único tenant dueño del sitio y del canal. */
  tenantId: string;
  tenantDuenoId: string | null;
  interruptor: { enabled: boolean; topeDia: number; topeSemana: number } | null;
  borrador: {
    id: string;
    status: string;
    ideaTipo: string | null;
    testNoticia: Record<string, unknown> | null;
    searchConsole: { consulta?: unknown; fecha?: unknown } | null;
    sources: FuenteBorrador[] | null;
    contentKind: string | null;
    coverImageUrl: string | null;
    writerAgent: AgenteVersion | null;
    reviewerVerdict: VeredictoRevisor | null;
  };
  post: PostAEvaluar;
  /** Huella calculada en el servidor sobre `post` (huella.ts). */
  huella: string;
  nombresProhibidos: ReadonlyArray<string> | null;
  ahora: Date;
  automaticasPublicadas: ReadonlyArray<Date>;
  /** Estado del aviso de la automática anterior; `ninguna` si no hubo. */
  avisoAnterior: string | null;
  yaPublicado: boolean;
  slugOcupado: boolean;
  versiones: { prompts: string | null; control: string | null };
}

export interface EvaluacionFiltros {
  resultados: ResultadosFiltros;
  motivos: string[];
  publicable: boolean;
}

const TIPOS_AUTOMATICOS: ReadonlySet<NewsTipo> = new Set(["informativo", "curiosidad", "polemica"]);
const CATEGORIAS_FUERA: ReadonlySet<NewsCategoria> = new Set(["novedades-dtd", "historias-reales"]);
const AVISOS_QUE_DEJAN_SEGUIR: ReadonlySet<string> = new Set(["entregado", "confirmado_a_mano", "ninguna"]);

/** Cifras, porcentajes o fechas concretas: piden al menos una fuente (F4). */
const CIFRAS = [
  /\d+(?:[.,]\d+)?\s*(?:%|por ?ciento)/i,
  /\b\d+[.,]\d+\b/,
  /\b\d{2,}\b/,
  /\b\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i,
];

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function completo(a: AgenteVersion | null | undefined): boolean {
  return !!a && texto(a.agente) !== "" && texto(a.modelo) !== "" && texto(a.version) !== "";
}

export type Evaluador = (e: EntradaFiltros) => string[];

/** Un evaluador por filtro. Exportado para los mutantes de las pruebas. */
export const EVALUADORES: Readonly<Record<Filtro, Evaluador>> = {
  F1: (e) => (e.interruptor?.enabled === true ? [] : ["interruptor_apagado"]),

  F2: (e) => {
    const b = e.borrador;
    const fuera =
      e.tenantDuenoId === null ||
      e.tenantId !== e.tenantDuenoId ||
      b.status !== "en_revision" ||
      !TIPOS_AUTOMATICOS.has(e.post.tipo) ||
      CATEGORIAS_FUERA.has(e.post.categoria) ||
      b.ideaTipo === null ||
      !(b.ideaTipo in CEREBRO_A_EDITORIAL) ||
      CEREBRO_A_EDITORIAL[b.ideaTipo as CerebroTipo] === null ||
      b.testNoticia === null ||
      // El Test de Noticia lo recalcula el Studio: solo cuentan los «sí» de verdad.
      scoreFromTest(
        Object.fromEntries(TEST_NOTICIA_KEYS.map((k) => [k, b.testNoticia?.[k] === true])) as Record<
          (typeof TEST_NOTICIA_KEYS)[number],
          boolean
        >,
      ) < 3;
    if (fuera) return ["fuera_de_alcance"];
    const fecha = texto(b.searchConsole?.fecha);
    if (texto(b.searchConsole?.consulta) === "" || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      return ["sin_dato_de_busqueda"];
    }
    return [];
  },

  F3: (e) => {
    const v = e.borrador.reviewerVerdict;
    if (!v || v.veredicto !== "aprobado" || !completo(v)) return ["sin_revisor"];
    if (v.huella !== e.huella || v.draft_id !== e.borrador.id) return ["revision_vencida"];
    return [];
  },

  F4: (e) => {
    const p = e.post;
    if (tieneMarca(p.title, p.excerpt, p.meta_description, p.body_markdown)) return ["marca_pendiente"];
    const fuentes = (e.borrador.sources ?? []).filter((f) => texto(f?.url) !== "" || texto(f?.titulo) !== "");
    if (e.borrador.sources === null) return ["sin_fuentes"];
    const conCifras = CIFRAS.some((re) => re.test(`${p.title}\n${p.body_markdown}`));
    if (conCifras && fuentes.length === 0) return ["sin_fuentes"];
    return [];
  },

  F5: (e) => {
    const p = e.post;
    return [
      ...controlLineasRojas({
        textos: [p.title, p.excerpt, p.meta_description ?? "", p.body_markdown],
        fuentes: e.borrador.sources ?? [],
        nombresProhibidos: e.nombresProhibidos,
      }),
      ...lineasRojasDelRevisor(e.borrador.reviewerVerdict?.lineas_rojas),
    ];
  },

  F6: (e) =>
    evaluarPuntaje({
      titular: e.post.title,
      markdown: e.post.body_markdown,
      tipo: e.post.tipo,
      categoria: e.post.categoria,
      focusKeyword: e.post.focus_keyword,
      coverImageUrl: e.borrador.coverImageUrl,
      contentKind: e.borrador.contentKind,
    }),

  F7: (e) =>
    e.interruptor
      ? evaluarRitmo({
          ahora: e.ahora,
          automaticas: e.automaticasPublicadas,
          topeDia: e.interruptor.topeDia,
          topeSemana: e.interruptor.topeSemana,
        })
      : ["tope_dia"],

  F8: (e) => (AVISOS_QUE_DEJAN_SEGUIR.has(e.avisoAnterior ?? "") ? [] : ["aviso_pendiente"]),

  // La fila de auditoría tiene que poder escribirse completa: agente, modelo y
  // versión de quien redactó y de quien revisó, y las versiones de prompts y
  // control. La base la escribe en la misma transacción (y la rechaza si falta).
  F9: (e) =>
    completo(e.borrador.writerAgent) &&
    completo(e.borrador.reviewerVerdict) &&
    texto(e.versiones.prompts) !== "" &&
    texto(e.versiones.control) !== ""
      ? []
      : ["sin_auditoria"],

  F10: (e) => (e.yaPublicado || e.slugOcupado ? ["duplicado"] : []),
};

/** Evalúa F1 a F10. Ninguno se salta: todos corren y se informan. */
export function evaluarFiltros(
  e: EntradaFiltros,
  evaluadores: Readonly<Record<Filtro, Evaluador>> = EVALUADORES,
): EvaluacionFiltros {
  const resultados = {} as ResultadosFiltros;
  const motivos: string[] = [];
  for (const f of FILTROS) {
    let codigos: string[];
    try {
      codigos = evaluadores[f](e);
    } catch {
      codigos = [CODIGO_POR_DEFECTO[f]];
    }
    resultados[f] = { pasa: codigos.length === 0, codigos };
    for (const c of codigos) if (!motivos.includes(c)) motivos.push(c);
  }
  return { resultados, motivos, publicable: motivos.length === 0 };
}
