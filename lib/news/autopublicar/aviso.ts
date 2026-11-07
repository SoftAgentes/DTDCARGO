/**
 * SDD-0611 §4.5 · Texto de los avisos a `#noticias`.
 *
 * Llevan titular, enlace público, resumen de filtros y enlace de retiro (o de la
 * cola de revisión). Nunca el cuerpo del artículo ni datos de clientes. La
 * opinión de riesgo del Revisor viaja recortada, y no viaja si trae algo que
 * parezca un dato personal.
 *
 * El «botón» de retirar es un enlace: un webhook común de Discord no lleva
 * botones interactivos.
 */

import { tieneDatosPersonales } from "./control";
import { FILTROS, type ResultadosFiltros } from "./filtros";

const RIESGO_MAX = 300;

/** Sin menciones masivas ni formato que el texto ajeno pueda inyectar. */
function plano(texto: string): string {
  return texto
    .replace(/@(everyone|here)/gi, "@​$1")
    .replace(/[`*_~|>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resumenFiltros(resultados: ResultadosFiltros): string {
  const fallados = FILTROS.filter((f) => !resultados[f].pasa);
  return fallados.length === 0 ? "F1 a F10 en verde" : `Fallaron: ${fallados.join(", ")}`;
}

export interface RetiradasDeLaSemana {
  cantidad: number;
  motivos: string[];
}

function lineaRetiradas(r: RetiradasDeLaSemana | null): string[] {
  // §4.6: con dos o más retiradas en la semana, el aviso lo dice primero.
  if (!r || r.cantidad < 2) return [];
  const motivos = r.motivos.length > 0 ? ` (${[...new Set(r.motivos)].join(", ")})` : "";
  return [`⚠️ Van ${r.cantidad} retiradas esta semana${motivos}.`];
}

export interface AvisoPublicadaSola {
  titular: string;
  url: string;
  retiroUrl: string;
  semana: { publicadas: number; tope: number };
  resultados: ResultadosFiltros;
  riesgoRevisor: string | null;
  retiradas: RetiradasDeLaSemana | null;
}

export function avisoPublicadaSola(a: AvisoPublicadaSola): string {
  const riesgo = a.riesgoRevisor ? plano(a.riesgoRevisor) : "";
  const lineas = [
    ...lineaRetiradas(a.retiradas),
    `**Publicada sola** · ${a.semana.publicadas} de ${a.semana.tope} esta semana`,
    plano(a.titular),
    a.url,
    `Filtros: ${resumenFiltros(a.resultados)}`,
  ];
  if (riesgo && !tieneDatosPersonales(riesgo)) {
    lineas.push(`Opinión del Revisor: ${riesgo.slice(0, RIESGO_MAX)}`);
  }
  lineas.push(`Retirar: ${a.retiroUrl}`);
  return lineas.join("\n");
}

export interface AvisoPublicadaPorPersona {
  titular: string;
  url: string;
  persona: string;
  retiroUrl: string;
  retiradas: RetiradasDeLaSemana | null;
}

export function avisoPublicadaPorPersona(a: AvisoPublicadaPorPersona): string {
  return [
    ...lineaRetiradas(a.retiradas),
    `**Publicada por una persona** · ${plano(a.persona)}`,
    plano(a.titular),
    a.url,
    `Retirar: ${a.retiroUrl}`,
  ].join("\n");
}

export interface AvisoRetenida {
  titular: string;
  motivos: string[];
  colaUrl: string;
}

export function avisoRetenida(a: AvisoRetenida): string {
  return [
    "**Retenida para revisión**",
    plano(a.titular),
    `Motivos: ${a.motivos.join(", ")}`,
    `Cola de revisión: ${a.colaUrl}`,
  ].join("\n");
}
