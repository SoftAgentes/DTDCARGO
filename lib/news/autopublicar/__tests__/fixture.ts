/**
 * SDD-0611 · Borrador sintético que pasa los diez filtros. Cada prueba le mete
 * UN defecto y comprueba que ese, y solo ese, lo retiene: así un mutante que
 * quita un filtro no puede morir por otro camino.
 *
 * Sin datos reales: textos de relleno, ids fijos y un nombre prohibido inventado.
 */
import { huellaDe } from "../huella";
import type { EntradaFiltros, PostAEvaluar } from "../filtros";
import { LINEAS_ROJAS_REVISOR } from "../control";

export const TENANT = "10000000-0000-4000-8000-000000000001";
export const OTRO_TENANT = "10000000-0000-4000-8000-000000000002";
export const DRAFT = "30000000-0000-4000-8000-000000000001";
export const NOMBRES_PROHIBIDOS = ["Consolidadora Ficticia Andina"];

/** Martes 2026-11-17, 11:00 en Caracas. */
export const AHORA = new Date("2026-11-17T15:00:00Z");

const RELLENO = [
  "la", "carga", "sale", "del", "galpon", "con", "su", "guia", "y", "llega",
  "al", "deposito", "sin", "apuro", "cuando", "el", "pedido", "se", "reparte", "bien",
];

export interface OpcionesCuerpo {
  palabras: number;
  subtitulos: number;
  palabraClave?: string;
  ocurrencias?: number;
}

/**
 * Markdown con exactamente `palabras` palabras de cuerpo (los subtítulos no
 * cuentan), `subtitulos` subtítulos de segundo nivel, un primer párrafo de tres
 * oraciones (tesis) y la palabra clave `ocurrencias` veces, repartida.
 */
export function cuerpo(o: OpcionesCuerpo): string {
  const clave = o.palabraClave ?? "importador";
  const ocurrencias = o.ocurrencias ?? 0;
  const palabras: string[] = [];
  const paso = ocurrencias > 0 ? Math.floor(o.palabras / ocurrencias) : 0;
  for (let i = 0; i < o.palabras; i++) {
    const esClave = ocurrencias > 0 && i % paso === Math.floor(paso / 2) && i / paso < ocurrencias;
    palabras.push(esClave ? clave : RELLENO[i % RELLENO.length]);
  }
  // Una oración cada diez palabras.
  for (let i = 9; i < palabras.length; i += 10) palabras[i] = `${palabras[i]}.`;
  palabras[palabras.length - 1] = palabras[palabras.length - 1].replace(/\.?$/, ".");

  const intro = palabras.slice(0, 30).join(" ");
  const resto = palabras.slice(30);
  const porSeccion = Math.ceil(resto.length / Math.max(o.subtitulos, 1));
  const secciones: string[] = [];
  const NOMBRES = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"];
  for (let s = 0; s < o.subtitulos; s++) {
    const trozo = resto.slice(s * porSeccion, (s + 1) * porSeccion).join(" ");
    secciones.push(`## Parte ${NOMBRES[s] ?? "otra"}\n\n${trozo}`);
  }
  if (o.subtitulos === 0 && resto.length > 0) secciones.push(resto.join(" "));
  return [intro, ...secciones].join("\n\n");
}

export const TITULAR = "Importa · Cómo repartir tus compras grandes en el año";

export function postFeliz(over: Partial<PostAEvaluar> = {}): PostAEvaluar {
  const body = cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 });
  return {
    title: TITULAR,
    slug: "como-repartir-tus-compras-grandes-en-el-ano",
    tipo: "informativo",
    categoria: "importa-sin-perder-plata",
    excerpt: "Repartir las compras del trimestre deja la caja respirar.",
    meta_description: "Repartir las compras del trimestre deja la caja respirar.",
    body_markdown: body,
    focus_keyword: "importador",
    ...over,
  };
}

export function huellaDePost(p: PostAEvaluar): string {
  return huellaDe({
    tipo: p.tipo,
    categoria: p.categoria,
    title: p.title,
    focus_keyword: p.focus_keyword,
    secondary_keywords: [],
    meta_description: p.meta_description,
    body_markdown: p.body_markdown,
  });
}

/** Entrada que pasa F1 a F10. `post` cambia el texto; el veredicto se ata al feliz. */
export function entradaFeliz(over: Partial<EntradaFiltros> = {}): EntradaFiltros {
  const post = postFeliz();
  const huella = huellaDePost(post);
  return {
    tenantId: TENANT,
    tenantDuenoId: TENANT,
    interruptor: { enabled: true, topeDia: 1, topeSemana: 2 },
    borrador: {
      id: DRAFT,
      status: "en_revision",
      ideaTipo: "guia",
      testNoticia: {
        busca_google: true,
        ia_responde: true,
        sirve_6_meses: true,
        ensena_resuelve: false,
        parece_experto: false,
      },
      searchConsole: { consulta: "como importar de china", fecha: "2026-11-10" },
      sources: [],
      contentKind: "guide",
      coverImageUrl: null,
      writerAgent: { agente: "redactor-noticias", modelo: "modelo-sintetico", version: "1.0" },
      reviewerVerdict: {
        veredicto: "aprobado",
        agente: "revisor",
        modelo: "modelo-sintetico",
        version: "1.0",
        draft_id: DRAFT,
        huella,
        lineas_rojas: Object.fromEntries(LINEAS_ROJAS_REVISOR.map((k) => [k, "cumple"])),
        riesgo: "Sin riesgos a la vista.",
      },
    },
    post,
    huella,
    nombresProhibidos: NOMBRES_PROHIBIDOS,
    ahora: AHORA,
    automaticasPublicadas: [],
    avisoAnterior: "ninguna",
    yaPublicado: false,
    slugOcupado: false,
    versiones: { prompts: "prompts-v1", control: "0611-control-v1" },
    ...over,
  };
}

/** Cambia el texto del post y recalcula la huella del servidor (el veredicto queda atado al viejo). */
export function conPost(e: EntradaFiltros, over: Partial<PostAEvaluar>): EntradaFiltros {
  const post = { ...e.post, ...over };
  return { ...e, post, huella: huellaDePost(post) };
}

/** Cambia el texto Y vuelve a atar el veredicto, para aislar un filtro de contenido de F3. */
export function conPostRevisado(e: EntradaFiltros, over: Partial<PostAEvaluar>): EntradaFiltros {
  const n = conPost(e, over);
  return {
    ...n,
    borrador: {
      ...n.borrador,
      reviewerVerdict: { ...n.borrador.reviewerVerdict!, huella: n.huella },
    },
  };
}

export function conBorrador(
  e: EntradaFiltros,
  over: Partial<EntradaFiltros["borrador"]>,
): EntradaFiltros {
  return { ...e, borrador: { ...e.borrador, ...over } };
}
