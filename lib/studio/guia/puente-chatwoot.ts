/**
 * lib/studio/guia/puente-chatwoot.ts · Lado Studio del puente con el panel de
 * Chatwoot (SDD-0589, paso 9.4). Funciones puras, sin DOM ni React.
 *
 * El script del panel (`infra/chatwoot/panel/guia-panel.html`, en
 * `DASHBOARD_SCRIPTS`) solo mide: Studio le manda las anclas con sus selectores
 * (`chatwoot-selectores.json`, el único archivo de selectores) y el script le
 * devuelve un rectángulo por ancla, en coordenadas del marco. Aquí se arma el
 * pedido, se valida la respuesta y se pasa a coordenadas de la página.
 *
 * Protocolo (spec, §9.4): `dtd:guia:listo`, `dtd:guia:mirar`, `dtd:guia:cajas`,
 * `dtd:guia:mostrar` y `dtd:guia:parar`. Los mensajes viajan como JSON en texto,
 * igual que el cierre de sesión de 2.7.
 */

import datos from "./chatwoot-selectores.json";
import type { Caja } from "./posicion";
import { esAnclaValida } from "./tipos";

/** Topes que también impone el script del panel. */
export const MAX_ANCLAS = 20;
export const MAX_SELECTORES = 4;
export const MAX_LARGO_SELECTOR = 200;
const CERCA_RE = /^[a-z][a-z0-9-]{0,39}$/;

export interface SelectorAncla {
  /** Selectores CSS, en orden: gana el primero que encuentra algo. */
  readonly css: readonly string[];
  /** Si está, se sube con `closest(cerca)` desde lo encontrado (por ejemplo, del icono al botón). */
  readonly cerca?: string;
  /** El smoke de E3 falla si una obligatoria no aparece. */
  readonly obligatoria: boolean;
  /** Qué tiene que estar a la vista para que el ancla exista. */
  readonly condicion: string;
  /** De qué archivo de Chatwoot sale el selector. */
  readonly fuente: string;
}

export interface ArchivoSelectores {
  readonly version: string;
  readonly medido: string;
  readonly anclas: Readonly<Record<string, SelectorAncla>>;
}

export const SELECTORES_CHATWOOT = datos as ArchivoSelectores;

/** Problemas de forma del archivo de selectores. Lista vacía = válido. */
export function validarSelectores(archivo: ArchivoSelectores): string[] {
  const errores: string[] = [];
  if (typeof archivo.version !== "string" || !/^v\d+\.\d+\.\d+/.test(archivo.version)) {
    errores.push("versión de Chatwoot inválida");
  }
  const anclas = Object.entries(archivo.anclas ?? {});
  if (anclas.length === 0) errores.push("no hay anclas");
  if (anclas.length > MAX_ANCLAS) errores.push(`más de ${MAX_ANCLAS} anclas`);
  for (const [ancla, s] of anclas) {
    if (!esAnclaValida(ancla)) errores.push(`ancla inválida: «${ancla}»`);
    if (!Array.isArray(s.css) || s.css.length === 0 || s.css.length > MAX_SELECTORES) {
      errores.push(`«${ancla}»: entre 1 y ${MAX_SELECTORES} selectores`);
      continue;
    }
    for (const css of s.css) {
      if (typeof css !== "string" || css.trim() === "" || css.length > MAX_LARGO_SELECTOR) {
        errores.push(`«${ancla}»: selector vacío o de más de ${MAX_LARGO_SELECTOR} caracteres`);
      }
    }
    if (s.cerca !== undefined && !CERCA_RE.test(s.cerca)) errores.push(`«${ancla}»: «cerca» inválido`);
    if (typeof s.obligatoria !== "boolean") errores.push(`«${ancla}»: falta «obligatoria»`);
    if (!s.condicion || !s.fuente) errores.push(`«${ancla}»: falta la condición o la fuente`);
  }
  return errores;
}

export type MensajeMirar = {
  evento: "dtd:guia:mirar";
  anclas: Record<string, { css: string[]; cerca?: string }>;
};

/** Pedido de medir todas las anclas del archivo. */
export function pedidoMirar(archivo: ArchivoSelectores = SELECTORES_CHATWOOT): MensajeMirar {
  const anclas: MensajeMirar["anclas"] = {};
  for (const [ancla, s] of Object.entries(archivo.anclas)) {
    anclas[ancla] = s.cerca ? { css: [...s.css], cerca: s.cerca } : { css: [...s.css] };
  }
  return { evento: "dtd:guia:mirar", anclas };
}

export function pedidoMostrar(ancla: string, suave: boolean) {
  return { evento: "dtd:guia:mostrar" as const, ancla, suave };
}

export const PEDIDO_PARAR = { evento: "dtd:guia:parar" as const };

export type MensajePanel =
  | { tipo: "listo" }
  | { tipo: "cajas"; cajas: Map<string, Caja | null> };

function numero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function leerCaja(v: unknown): Caja | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const { top, left, width, height } = v as Record<string, unknown>;
  if (!numero(top) || !numero(left) || !numero(width) || !numero(height)) return undefined;
  if (width < 0 || height < 0) return undefined;
  return { top, left, width, height };
}

/**
 * Lee un mensaje del panel. Solo acepta las anclas del archivo de selectores y
 * cajas con números finitos. Cualquier otra cosa da `null`. Nunca lanza.
 */
export function leerMensajePanel(
  data: unknown,
  archivo: ArchivoSelectores = SELECTORES_CHATWOOT,
): MensajePanel | null {
  let d: unknown = data;
  if (typeof d === "string") {
    if (d.length > 20_000) return null;
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== "object") return null;
  const evento = (d as { evento?: unknown }).evento;
  if (evento === "dtd:guia:listo") return { tipo: "listo" };
  if (evento !== "dtd:guia:cajas") return null;
  const crudas = (d as { cajas?: unknown }).cajas;
  if (!crudas || typeof crudas !== "object" || Array.isArray(crudas)) return null;
  const cajas = new Map<string, Caja | null>();
  for (const [ancla, valor] of Object.entries(crudas as Record<string, unknown>)) {
    if (!Object.hasOwn(archivo.anclas, ancla)) continue;
    const caja = leerCaja(valor);
    if (caja !== undefined) cajas.set(ancla, caja);
  }
  return { tipo: "cajas", cajas };
}

/**
 * Pasa una caja del marco a la página. `vista` es el área de contenido del marco
 * en la página (su rectángulo menos el borde: `clientTop`, `clientLeft`,
 * `clientWidth` y `clientHeight`). La caja se recorta a esa área; si queda fuera
 * de la vista, da `null`.
 */
export function cajaEnPagina(interna: Caja, vista: Caja): Caja | null {
  const izq = Math.max(vista.left + interna.left, vista.left);
  const arr = Math.max(vista.top + interna.top, vista.top);
  const der = Math.min(vista.left + interna.left + interna.width, vista.left + vista.width);
  const abajo = Math.min(vista.top + interna.top + interna.height, vista.top + vista.height);
  if (der <= izq || abajo <= arr) return null;
  return { top: arr, left: izq, width: der - izq, height: abajo - arr };
}
