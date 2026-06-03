/**
 * Tipos del motor de verificación de identidad (SDD-0046 · Slice B).
 *
 * El motor coteja el documento del cliente (`clients.rif`: cédula de persona o
 * RIF de empresa) + su nombre (`clients.name`) contra el registro oficial:
 *   - persona → CNE (padrón electoral, por cédula).
 *   - empresa → SENIAT (consulta de RIF) → Slice C; hoy cae al piso manual.
 *
 * El resultado es ADVISORY: nunca bloquea ni auto-rechaza al cliente. Siempre se
 * guarda y muestra `registryName` para que el asesor cotee a ojo aunque el match
 * automático se equivoque.
 */

import type { DocumentKind } from "./document";

/**
 * Proveedor de consulta a un registro oficial. Es la costura intercambiable:
 * la impl gratis (`cne-cedulave`) o la paga (`cne-verifik`) implementan esta
 * interfaz, y el motor (`verifyIdentity`) no sabe cuál usa.
 *
 * `lookup` recibe el documento limpio (lo que pide el registro) y devuelve el
 * nombre/razón social oficial, o `null` si no se encontró. **Puede tirar/timeout**
 * — el motor captura y degrada a `unavailable` (el provider NO tiene que tragar
 * sus propios errores, aunque las impls igual lo hacen por prolijidad).
 */
export interface IdentityProvider {
  lookup(doc: string): Promise<{ registryName: string } | null>;
}

/** Fuente que produjo el resultado de verificación. */
export type VerifySource = "cne" | "seniat" | "manual";

/**
 * Resultado de la verificación (lo que el motor devuelve y la server action
 * persiste en `clients.doc_verify_*`).
 *
 * - `status`:
 *     · `ok`          → el nombre del cliente coincide con el del registro.
 *     · `mismatch`    → el registro devolvió un nombre que NO coincide (dispara alerta).
 *     · `unavailable` → no se pudo consultar (provider caído/null/timeout, doc no
 *                       parseable, o la vía empresa que aún no tiene auto).
 * - `source`: de dónde salió (cne | seniat | manual).
 * - `registryName`: nombre/razón social oficial (solo cuando hubo respuesta).
 * - `score`: similitud 0..1 de `compareNames` (solo cuando se comparó).
 */
export type VerifyResult = {
  status: "ok" | "mismatch" | "unavailable";
  source: VerifySource;
  registryName?: string;
  score?: number;
};

/** Input del motor: lo mínimo que necesita para rutear y comparar. */
export type VerifyIdentityInput = {
  /** Documento del cliente (`clients.rif`: cédula de persona o RIF de empresa). */
  rif: string | null;
  /** Nombre / razón social que cargó el cliente (`clients.name`). */
  name: string;
  /** Tipo persistido (`clients.doc_kind`); si falta, se infiere del `rif`. */
  docKind: DocumentKind | null;
};
