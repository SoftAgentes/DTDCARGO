/**
 * SDD-0626 §3.2/§3.3 · El almacén de la bandeja sobre Supabase (service_role), y las dos corridas
 * programadas del cable: el filtro nivel 1 y el vaciado diario del resumen.
 *
 * Sin la 0541 (la tabla o la función no existen) o sin la 0544 (el filtro) NADA FALLA EN VOZ ALTA:
 * se devuelve `sin_migracion` y se anota una sola vez en el log por proceso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ConfigWebhookOficina, vaciadoActivo } from "./config";
import { avisarUnaVez, faltaLaMigracion } from "./escritura";
import { CUOTA_TRIAJE_POR_HORA } from "./filtro-nivel1";
import type { BandejaStore, FilaBandeja, ResultadoGuardado } from "./webhook-chatwoot";

/** Un error de la base con solo su código (el mensaje puede traer valores de una fila). */
export class ErrorDeBandeja extends Error {
  readonly code: string;
  constructor(code: string | null | undefined) {
    super(`la bandeja del cable no respondió (${code ?? "sin código"})`);
    this.name = "ErrorDeBandeja";
    this.code = code ?? "desconocido";
  }
}

export function crearAlmacenSupabase(admin: SupabaseClient): BandejaStore {
  return {
    async guardar(fila: FilaBandeja): Promise<ResultadoGuardado> {
      // ON CONFLICT (clave_dedupe) DO NOTHING: un duplicado no inserta nada y no devuelve filas.
      const { data, error } = await admin
        .from("event_inbox")
        .upsert(fila, { onConflict: "clave_dedupe", ignoreDuplicates: true })
        .select("id");
      if (error) {
        if (faltaLaMigracion(error)) return "sin_migracion";
        throw new ErrorDeBandeja(error.code);
      }
      return (data?.length ?? 0) > 0 ? "guardado" : "duplicado";
    },
  };
}

export type ResultadoCorrida =
  | { estado: "apagado" | "sin_migracion" }
  | { estado: "ok"; cantidad: number };

/**
 * El filtro nivel 1 (§3.3): `office_filtrar_bandeja()` pasa a «triaje» hasta 20 por hora. Con el
 * interruptor apagado no llama a la base. Con la oficina pausada la función devuelve 0 y no mueve nada.
 */
export async function correrFiltroDeLaBandeja(
  admin: SupabaseClient,
  config: Pick<ConfigWebhookOficina, "activo">,
): Promise<ResultadoCorrida> {
  if (!config.activo) return { estado: "apagado" };
  const { data, error } = await admin.rpc("office_filtrar_bandeja", { p_cuota: CUOTA_TRIAJE_POR_HORA });
  if (error) {
    if (faltaLaMigracion(error)) {
      avisarUnaVez("filtro-sin-migracion", "[oficina-cable] el filtro no mueve nada: falta la 0541 o la 0544 en esta base (SDD-0626)");
      return { estado: "sin_migracion" };
    }
    throw new ErrorDeBandeja(error.code);
  }
  return { estado: "ok", cantidad: typeof data === "number" ? data : 0 };
}

/**
 * La purga diaria de borradores (Paso 3a, D3): `office_purgar_borradores_viejos()` (0548) borra los borradores
 * del agente de más de 90 días. Va con el vaciado (mismo interruptor `OFICINA_VACIADO_ACTIVO`) y, como él,
 * corre aunque la oficina esté pausada. Sin la 0548 devuelve `sin_migracion` y lo anota una vez.
 */
export async function correrPurgaDeBorradores(
  admin: SupabaseClient,
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ResultadoCorrida> {
  if (!vaciadoActivo(env)) return { estado: "apagado" };
  const { data, error } = await admin.rpc("office_purgar_borradores_viejos");
  if (error) {
    if (faltaLaMigracion(error)) {
      avisarUnaVez("purga-borradores-sin-migracion", "[oficina-cable] la purga de borradores no hace nada: falta la 0548 en esta base (SDD-0626)");
      return { estado: "sin_migracion" };
    }
    throw new ErrorDeBandeja(error.code);
  }
  return { estado: "ok", cantidad: typeof data === "number" ? data : 0 };
}

/**
 * El vaciado diario (privacidad, decisión A de Sam del 15/11/2026): `office_vaciar_resumenes_viejos()`
 * pone `task_events.resumen = null` en las filas de más de 90 días. Es privacidad, no trabajo de
 * agentes: corre aunque la oficina esté pausada. Tiene su propio interruptor (`OFICINA_VACIADO_ACTIVO`).
 */
export async function correrVaciadoDeResumenes(
  admin: SupabaseClient,
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ResultadoCorrida> {
  if (!vaciadoActivo(env)) return { estado: "apagado" };
  const { data, error } = await admin.rpc("office_vaciar_resumenes_viejos");
  if (error) {
    if (faltaLaMigracion(error)) {
      avisarUnaVez("vaciado-sin-migracion", "[oficina-cable] el vaciado no hace nada: falta la 0541 en esta base (SDD-0626)");
      return { estado: "sin_migracion" };
    }
    throw new ErrorDeBandeja(error.code);
  }
  return { estado: "ok", cantidad: typeof data === "number" ? data : 0 };
}
