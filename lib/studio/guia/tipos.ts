/**
 * lib/studio/guia/tipos.ts · Recorridos de la guía como datos tipados
 * (SDD-0589, paso 9.2 del programa SDD-0582).
 *
 * Un recorrido es una lista de pasos. Cada paso dice DÓNDE se ancla (un
 * atributo `data-guia` en la pantalla) y QUÉ texto muestra (una clave base de
 * i18n con sufijos `.title`, `.what`, `.before` y `.now`). No hay código por
 * recorrido: el motor (`motor.ts`) y la tarjeta los recorren igual.
 */

import type { I18nKey } from "@/lib/i18n";

/** Claves base `X` tales que existen `X.title` y `X.what` en el dict. */
type BaseCon<Sufijo extends string> = I18nKey extends infer K
  ? K extends `${infer Base}.${Sufijo}`
    ? Base
    : never
  : never;

export type GuiaClave = Extract<BaseCon<"title">, BaseCon<"what">> &
  `guide.${string}`;

/** Clave de texto obligatoria de una tarjeta (existe por construcción de `GuiaClave`). */
export function textoDe(clave: GuiaClave, sufijo: "title" | "what"): I18nKey {
  return `${clave}.${sufijo}` as I18nKey;
}

export interface GuiaPaso {
  /** Identificador estable del paso dentro del recorrido (guion: «B1», «E2»…). */
  readonly id: string;
  /** Valor del atributo `data-guia` del elemento: `<pantalla>.<elemento>`. */
  readonly ancla: string;
  /** Clave base de i18n de la tarjeta. */
  readonly clave: GuiaClave;
}

export interface GuiaRecorrido {
  /** Identificador del recorrido; es el valor de `?guia=` en la URL. */
  readonly id: string;
  /** Ruta de Studio donde vive el recorrido. Fuera de ella no arranca. */
  readonly ruta: `/studio/${string}`;
  readonly pasos: readonly GuiaPaso[];
}

/**
 * Formato del guion 9.1: `<pantalla>.<elemento>`, minúsculas, dígitos y
 * guiones dentro de cada parte (`bandeja.nota-privada`). Al no admitir
 * comillas ni corchetes, el valor entra seguro en un selector de atributo.
 */
export const ANCLA_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function esAnclaValida(ancla: string): boolean {
  return ANCLA_RE.test(ancla);
}

/** Problemas de forma de un recorrido. Lista vacía = recorrido válido. */
export function validarRecorrido(recorrido: GuiaRecorrido): string[] {
  const errores: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recorrido.id)) {
    errores.push(`id de recorrido inválido: «${recorrido.id}»`);
  }
  if (recorrido.pasos.length === 0) {
    errores.push(`el recorrido «${recorrido.id}» no tiene pasos`);
  }
  const ids = new Set<string>();
  for (const paso of recorrido.pasos) {
    if (ids.has(paso.id)) errores.push(`paso repetido: «${paso.id}»`);
    ids.add(paso.id);
    if (!esAnclaValida(paso.ancla)) {
      errores.push(`ancla inválida en «${paso.id}»: «${paso.ancla}»`);
    }
  }
  return errores;
}
