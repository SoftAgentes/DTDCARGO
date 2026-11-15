/**
 * SDD-0626 §3.2 y §3.3 · Configuración del webhook de Chatwoot, el filtro y el vaciado del cable.
 *
 * TODO NACE APAGADO. Los dos interruptores solo valen con `1` o `true`: vacío, ausente,
 * «0», «false», «si», «on» o cualquier otra cosa = apagado. Se leen del entorno en cada llamada (sin caché),
 * así que apagar uno no pide reiniciar nada más que el proceso. Los valores no se registran.
 *
 * - `OFICINA_WEBHOOK_ACTIVO`: enciende el webhook (§3.2) y el filtro (§3.3). Apagado = el webhook
 *   responde sin hacer nada y no escribe en la base; el filtro tampoco mueve nada.
 * - `OFICINA_WEBHOOK_SECRET`: el secreto del webhook de Chatwoot que apunta a este endpoint (el
 *   `secret` que firma cada entrega). PROPIO del cable: no se reutiliza el del webhook de la Bandeja.
 * - `OFICINA_CHATWOOT_INBOX_PRUEBA`: id numérico de la ÚNICA bandeja que el cable atiende (la de
 *   prueba). Vacía o inválida = se rechaza todo. Cualquier otra bandeja se ignora.
 * - `OFICINA_ETIQUETAS_DINERO` y `OFICINA_ETIQUETAS_INTERNO` (opcionales): etiquetas de Chatwoot,
 *   separadas por comas, que clasifican un evento como dinero (3) o interno (1). Sin ellas valen
 *   las de `ETIQUETAS_DINERO_POR_DEFECTO` y `ETIQUETAS_INTERNO_POR_DEFECTO`.
 * - `OFICINA_VACIADO_ACTIVO`: enciende el vaciado diario de `task_events.resumen` (privacidad,
 *   decisión A de Sam del 15/11/2026). Interruptor PROPIO: corre aunque la oficina esté pausada.
 */
import { firstConfiguredSecret } from "@/lib/runtime/server-secret";

import { type ReglasPrioridad, reglasDeEntorno } from "./filtro-nivel1";

type Entorno = Readonly<Record<string, string | undefined>>;

const SI = new Set(["1", "true"]);

/** Solo `1` o `true` (sin importar mayúsculas ni espacios) enciende. Todo lo demás, apagado. */
export function interruptorEncendido(valor: string | undefined | null): boolean {
  return typeof valor === "string" && SI.has(valor.trim().toLowerCase());
}

export interface ConfigWebhookOficina {
  activo: boolean;
  /** Secreto del webhook; null si falta (la ruta rechaza todo). */
  secreto: string | null;
  /** Id de la bandeja de prueba; null si falta o es inválido (se rechaza todo). */
  bandejaPrueba: number | null;
  /** Cuenta de Chatwoot (`CHATWOOT_ACCOUNT_ID`); si está, los eventos de otra cuenta se ignoran. */
  cuenta: number | null;
  reglas: ReglasPrioridad;
}

const ID = /^[1-9][0-9]{0,9}$/;

/**
 * Las bandejas que ya atiende otro flujo del ERP (portal, clientes, leads). El cable nunca comparte
 * bandeja con ellas (un solo contestador por bandeja, spec §3.5): si la de prueba coincide con una,
 * se rechaza todo (`bandejaPrueba` = null).
 */
function bandejasDelERP(env: Entorno): Set<string> {
  return new Set(
    [env.CHATWOOT_INBOX_PORTAL_ID, env.CHATWOOT_INBOX_CLIENTES_ID, env.CHATWOOT_INBOX_LEADS_ID]
      .map((v) => (v ?? "").trim())
      .filter(Boolean),
  );
}

export function configWebhookOficina(env: Entorno = process.env): ConfigWebhookOficina {
  const bandeja = (env.OFICINA_CHATWOOT_INBOX_PRUEBA ?? "").trim();
  const cuenta = (env.CHATWOOT_ACCOUNT_ID ?? "").trim();
  return {
    activo: interruptorEncendido(env.OFICINA_WEBHOOK_ACTIVO),
    secreto: firstConfiguredSecret(env.OFICINA_WEBHOOK_SECRET),
    bandejaPrueba: ID.test(bandeja) && !bandejasDelERP(env).has(bandeja) ? Number(bandeja) : null,
    cuenta: ID.test(cuenta) ? Number(cuenta) : null,
    reglas: reglasDeEntorno(env.OFICINA_ETIQUETAS_DINERO, env.OFICINA_ETIQUETAS_INTERNO),
  };
}

export function vaciadoActivo(env: Entorno = process.env): boolean {
  return interruptorEncendido(env.OFICINA_VACIADO_ACTIVO);
}
