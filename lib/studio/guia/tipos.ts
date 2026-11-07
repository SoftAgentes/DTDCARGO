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
import type { StudioUserRole } from "@/lib/studio/user-types";

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
  /**
   * Ancla de Studio donde se pone la tarjeta si `ancla` no aparece (9.4): las
   * anclas de Chatwoot caen al marco de la Bandeja, como pide el guion. El paso
   * se salta solo si faltan las dos.
   */
  readonly respaldo?: string;
  /** Roles que ven este paso (9.5). Sin la lista, lo ve quien entra a la pantalla. */
  readonly roles?: readonly StudioUserRole[];
}

export interface GuiaRecorrido {
  /** Identificador del recorrido; es el valor de `?guia=` en la URL. */
  readonly id: string;
  /** Ruta de Studio donde vive el recorrido. Fuera de ella no arranca. */
  readonly ruta: `/studio/${string}`;
  readonly pasos: readonly GuiaPaso[];
  /** Roles que ven el recorrido (9.5). Sin la lista, vale el permiso de la pantalla. */
  readonly roles?: readonly StudioUserRole[];
  /**
   * Si abre solo la primera vez (9.3). Por defecto sí. Los recorridos de 9.5 lo
   * apagan hasta la prueba de 9.6 y el OK de Sam (SDD-0589, D11).
   */
  readonly arranqueAutomatico?: boolean;
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
  if (recorrido.roles !== undefined && recorrido.roles.length === 0) {
    errores.push(`el recorrido «${recorrido.id}» tiene una lista de roles vacía`);
  }
  const ids = new Set<string>();
  for (const paso of recorrido.pasos) {
    if (ids.has(paso.id)) errores.push(`paso repetido: «${paso.id}»`);
    ids.add(paso.id);
    if (!esAnclaValida(paso.ancla)) {
      errores.push(`ancla inválida en «${paso.id}»: «${paso.ancla}»`);
    }
    if (paso.respaldo !== undefined) {
      if (!esAnclaValida(paso.respaldo)) {
        errores.push(`respaldo inválido en «${paso.id}»: «${paso.respaldo}»`);
      } else if (paso.respaldo === paso.ancla) {
        errores.push(`el respaldo de «${paso.id}» es su misma ancla`);
      }
    }
    if (paso.roles !== undefined && paso.roles.length === 0) {
      errores.push(`el paso «${paso.id}» tiene una lista de roles vacía`);
    }
  }
  return errores;
}
