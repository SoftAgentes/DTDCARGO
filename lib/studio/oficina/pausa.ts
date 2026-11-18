/**
 * SDD-0626 §3.1 · SGE-AG-01 §7 · El botón de pausa de la oficina (el kill switch, en pantalla).
 *
 * - **Cambiar la pausa.** `cambiarPausa` llama a `office_cambiar_pausa(pausada, motivo)` (0541) con la SESIÓN DEL
 *   USUARIO, nunca con el cliente de servicio: la base exige `auth.uid()` e `is_platform_admin()`, pide el motivo y
 *   agrega una fila con quién y cuándo. Aquí no se decide nada de permisos.
 * - **Leer el estado.** `office_paused` solo la lee `service_role` (0541: RLS sin policies), así que `leerPausa` usa el
 *   cliente de servicio con el mismo candado que la mini-vista (`mini-vista.ts`): ese cliente solo se crea después de
 *   que la base contestó que quien mira es `is_platform_admin()`. Lee UNA fila, la última.
 * - **Falla cerrado.** Sin filas, la oficina se trata como pausada (lo mismo que `office_esta_pausada()`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaLaMigracion } from "./escritura";
import { COLUMNAS, type CambioDePausa, cambioDePausa } from "./mini-vista";

export type LecturaPausa =
  /** `vigente` = la última fila; `null` = sin filas (se trata como pausada). */
  | { ok: true; pausada: boolean; vigente: CambioDePausa | null }
  | { ok: false; motivo: "sin_permiso" | "sin_migracion" | "error" };

export interface DependenciasPausa {
  /** ¿La base dice que quien mira es `is_platform_admin()`? Cualquier fallo cuenta como «no». */
  esAdmin: () => Promise<boolean>;
  /** El cliente de servicio. Solo se llama después de un «sí» de `esAdmin`. */
  crearAdmin: () => SupabaseClient;
  registrar?: (mensaje: string) => void;
}

export async function leerPausa(deps: DependenciasPausa): Promise<LecturaPausa> {
  // EL CANDADO: sin el «sí» de la base no se crea el cliente de servicio.
  let admite = false;
  try {
    admite = (await deps.esAdmin()) === true;
  } catch {
    admite = false;
  }
  if (!admite) return { ok: false, motivo: "sin_permiso" };

  const registrar = deps.registrar ?? ((m: string) => console.error(m));
  try {
    const admin = deps.crearAdmin();
    const { data, error } = await admin
      .from("office_paused")
      .select(COLUMNAS.office_paused)
      .order("id", { ascending: false })
      .limit(1);
    if (error) {
      if (faltaLaMigracion(error)) return { ok: false, motivo: "sin_migracion" };
      // Solo el código: el mensaje del error puede repetir un valor de la fila.
      registrar(`[oficina-pausa] no se pudo leer office_paused (código ${error.code ?? "?"})`);
      return { ok: false, motivo: "error" };
    }
    const fila = (Array.isArray(data) ? data[0] : null) as unknown as Record<string, unknown> | null | undefined;
    if (!fila) return { ok: true, pausada: true, vigente: null };
    const vigente = cambioDePausa(fila);
    return { ok: true, pausada: vigente.pausada, vigente };
  } catch {
    // Sin el mensaje: puede traer la URL o un valor de configuración.
    registrar("[oficina-pausa] no se pudo abrir la lectura (¿falta la configuración del cliente de servicio?)");
    return { ok: false, motivo: "error" };
  }
}

export type CodigoPausa = "sin_tablas" | "sin_permiso" | "invalido" | "error";
export type ResultadoPausa = { ok: true; pausada: boolean } | { ok: false; codigo: CodigoPausa };

/**
 * Pausa o despausa la oficina. `supabase` es el cliente de la SESIÓN del usuario: la fila queda a su nombre
 * (`cambiado_por = auth.uid()`). Con el cliente de servicio la base lo rechaza (no hay `auth.uid()`).
 */
export async function cambiarPausa(
  supabase: SupabaseClient,
  c: { pausar: boolean; motivo: string },
): Promise<ResultadoPausa> {
  const { data, error } = await supabase.rpc("office_cambiar_pausa", { p_pausada: c.pausar, p_motivo: c.motivo });
  if (!error) {
    // La función devuelve el valor nuevo. Si no es el pedido, no se da por hecho.
    return data === c.pausar ? { ok: true, pausada: c.pausar } : { ok: false, codigo: "error" };
  }
  if (faltaLaMigracion(error)) return { ok: false, codigo: "sin_tablas" };
  switch (error.code) {
    case "42501":
      return { ok: false, codigo: "sin_permiso" };
    case "22023":
    case "22004":
      return { ok: false, codigo: "invalido" };
    default:
      return { ok: false, codigo: "error" };
  }
}
