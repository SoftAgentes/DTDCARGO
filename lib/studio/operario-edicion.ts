/**
 * Editar un operario desde el Studio (SDD-0529) · módulo puro, apto para el cliente.
 *
 * LA REGLA DEL ROL NO SE ESCRIBE AQUÍ. Los roles que se le pueden dar a un
 * operario de cada región salen de `public.operario_roles_por_region()` (migr
 * 0480), la misma función con que `admin_update_operario` valida. La página la
 * lee (`getOperarioRolesPorRegion`) y el cajón arma el selector con lo que
 * llegue; si no llega, no deja guardar. Este módulo valida la forma de lo que
 * devuelve la base, dice qué opciones ve el cajón y traduce los rechazos de la
 * base al campo que toca.
 *
 * El almacén tampoco se decide aquí: China lo lleva y Venezuela no, y eso lo
 * exige la RPC con la región de la fila (no la del formulario).
 */

import { isOperarioRol, type OperarioRegion, type OperarioRol } from "./operario-pin";

/** Lo que devuelve `operario_roles_por_region()`: los roles de cada región, en el orden del selector. */
export type OperarioRolesPorRegion = Readonly<Record<OperarioRegion, readonly OperarioRol[]>>;

/** Cómo se nombra cada región en el Studio y qué hace allá el operario. */
export const OPERARIO_REGION: Readonly<Record<OperarioRegion, { label: string; ambito: string }>> = {
  cn: { label: "China", ambito: "almacén" },
  ve: { label: "Venezuela", ambito: "despacho" },
};

/**
 * La respuesta de la base, validada: un objeto con una lista no vacía, sin
 * repetidos y de roles conocidos para cada región. Cualquier otra forma es
 * `null`: el cajón no inventa una lista.
 */
export function parseOperarioRolesPorRegion(data: unknown): OperarioRolesPorRegion | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const source = data as Record<string, unknown>;
  const out = {} as Record<OperarioRegion, OperarioRol[]>;
  for (const region of Object.keys(OPERARIO_REGION) as OperarioRegion[]) {
    const roles = source[region];
    if (!Array.isArray(roles) || roles.length === 0) return null;
    if (!roles.every(isOperarioRol) || new Set(roles).size !== roles.length) return null;
    out[region] = [...roles];
  }
  return out;
}

export type OperarioRolOpciones = {
  /** Los roles que el selector ofrece, en el orden de la base. Vacío si la base no los dio. */
  opciones: readonly OperarioRol[];
  /** El rol de hoy está entre las opciones; si no, hay que elegir uno para poder guardar. */
  actualValido: boolean;
};

/** Las opciones de rol del cajón para un operario de `region` que hoy tiene `actual`. */
export function operarioRolOpciones(
  roles: OperarioRolesPorRegion | null,
  region: OperarioRegion,
  actual: string,
): OperarioRolOpciones {
  const opciones = roles?.[region] ?? [];
  return { opciones, actualValido: opciones.some((rol) => rol === actual) };
}

/**
 * SQLSTATE con que `admin_update_operario` rechaza cada campo (0351 y 0480):
 * nombre vacío (P0011) o repetido en el almacén (P0013), rol que no es de la
 * región o fuera de sus modos (P0012), almacén que no corresponde (P0023).
 */
export const OPERARIO_UPDATE_FIELD_BY_CODE = {
  P0011: "display_name",
  P0013: "display_name",
  P0012: "role",
  P0023: "warehouse_id",
} as const;

export type OperarioUpdateField = (typeof OPERARIO_UPDATE_FIELD_BY_CODE)[keyof typeof OPERARIO_UPDATE_FIELD_BY_CODE];

/** El campo del cajón al que va un rechazo de la base, o `null` si es un error general. */
export function operarioUpdateField(error: { code?: string } | null | undefined): OperarioUpdateField | null {
  const code = error?.code;
  if (!code || !Object.hasOwn(OPERARIO_UPDATE_FIELD_BY_CODE, code)) return null;
  return OPERARIO_UPDATE_FIELD_BY_CODE[code as keyof typeof OPERARIO_UPDATE_FIELD_BY_CODE];
}

/** Copy del Studio para lo que el formulario revisa antes de llamar a la base (tuteo). */
export const OPERARIO_UPDATE_MESSAGE = {
  /** El mismo texto que da la base con P0011. */
  nombre: "Escribe el nombre del operario.",
  rol: "Elige un rol de la lista.",
} as const;
