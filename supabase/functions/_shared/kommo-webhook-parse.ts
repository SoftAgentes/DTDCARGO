// SDD-0043 Alcance B · parser del payload de webhook de Kommo.
//
// Kommo POSTea form-urlencoded con claves ANIDADAS, p.ej.:
//   leads[add][0][id]=123 · leads[update][0][id]=124 · leads[status][0][id]=125 ·
//   leads[delete][0][id]=126 · contacts[add][0][id]=900 · contacts[update][0][id]=901 ·
//   account[subdomain]=doortudoor · account[id]=31234567
//
// Salida: lista de eventos {entity, action, id} deduplicados por (entity,id)
// quedándose con la acción MÁS FUERTE (delete > status > update > add), más el
// subdomain y accountId de la cuenta. Función PURA (sin globals de Deno) para
// que tanto la Edge Function como Vitest la importen.

export type KommoEntity = "lead" | "contact";
export type KommoAction = "add" | "update" | "status" | "delete";

export interface KommoWebhookEvent {
  entity: KommoEntity;
  action: KommoAction;
  id: number;
}

export interface ParsedKommoWebhook {
  events: KommoWebhookEvent[];
  subdomain: string | null;
  accountId: number | null;
}

// Prioridad de acción: la más fuerte gana cuando hay varias para el mismo id.
const ACTION_RANK: Record<KommoAction, number> = {
  add: 0,
  update: 1,
  status: 2,
  delete: 3,
};

// Kommo manda las entidades en plural; las normalizamos a singular.
const ENTITY_MAP: Record<string, KommoEntity> = {
  leads: "lead",
  contacts: "contact",
};

const ACTION_SET = new Set<KommoAction>(["add", "update", "status", "delete"]);

/** Convierte el body a un iterable de pares [clave, valor] sin asumir el tipo de entrada. */
function toEntries(formBody: string | URLSearchParams): Iterable<[string, string]> {
  const params =
    typeof formBody === "string" ? new URLSearchParams(formBody) : formBody;
  return params.entries();
}

/**
 * Parsea el payload del webhook de Kommo.
 * Robusto: ignora claves que no matcheen el patrón esperado, valores no numéricos,
 * y dedup por (entity,id) con la acción más fuerte.
 */
export function parseKommoWebhookPayload(
  formBody: string | URLSearchParams,
): ParsedKommoWebhook {
  let subdomain: string | null = null;
  let accountId: number | null = null;

  // Mapa (entity:id) → mejor evento visto hasta ahora.
  const best = new Map<string, KommoWebhookEvent>();

  // Matchea p.ej.  leads[add][0][id]  ·  contacts[update][3][id]
  // Grupo 1 = entidad plural · 2 = acción · 3 = índice (ignorado).
  const eventKeyRe = /^(leads|contacts)\[(add|update|status|delete)\]\[(\d+)\]\[id\]$/;

  for (const [rawKey, rawVal] of toEntries(formBody)) {
    const key = rawKey.trim();

    // Cuenta: account[subdomain] / account[id].
    if (key === "account[subdomain]") {
      const v = (rawVal ?? "").trim();
      subdomain = v.length > 0 ? v : null;
      continue;
    }
    if (key === "account[id]") {
      const n = Number((rawVal ?? "").trim());
      accountId = Number.isFinite(n) && n > 0 ? n : accountId;
      continue;
    }

    const m = eventKeyRe.exec(key);
    if (!m) continue; // ruido → ignorar

    const entity = ENTITY_MAP[m[1]];
    const action = m[2] as KommoAction;
    if (!entity || !ACTION_SET.has(action)) continue;

    const id = Number((rawVal ?? "").trim());
    if (!Number.isInteger(id) || id <= 0) continue; // id inválido → ignorar

    const dedupKey = `${entity}:${id}`;
    const prev = best.get(dedupKey);
    if (!prev || ACTION_RANK[action] > ACTION_RANK[prev.action]) {
      best.set(dedupKey, { entity, action, id });
    }
  }

  return { events: [...best.values()], subdomain, accountId };
}

// ─────────────────────────────────────────────────────────────────────────────
// SDD-0288 rebanada 0 · MEDIR qué nos manda Kommo que hoy tiramos a la basura.
//
// Medido el 2026-08-24 en la cuenta real: nuestro webhook tiene marcado
// **"Todos"**, no los 6 eventos que dice `docs/runbooks/setup-kommo-webhook.md`.
// O sea que Kommo YA nos está mandando todos los eventos que soporta —incluidos
// los de mensajería, si existen— y `parseKommoWebhookPayload` los descarta en
// silencio: el índice devuelve `events: []` y el handler responde 200 sin mirar.
//
// Para diseñar la señal de "el cliente escribió" hace falta el nombre de las
// claves, no el contenido. Por eso esto devuelve **la FORMA y nada más**:
//
//   message[add][0][text]=Hola  →  "message[add][N][text]"
//
// ⭐ **Las claves sí, los valores NUNCA.** El body de un webhook de mensajería
// lleva el texto de la conversación, el teléfono y el nombre del cliente. Un
// log de valores sería PII de clientes en los logs de una edge function, sin
// retención definida y sin razón: para saber CÓMO se llama el campo del texto
// no hace falta leer el texto.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del cuerpo: patrones de clave únicos, con los índices numéricos
 * normalizados a `N` para que 50 mensajes no produzcan 50 patrones distintos.
 *
 * PURA y sin valores. `max` acota la salida: un body inesperadamente enorme no
 * puede inundar el log.
 */
export function formaDelCuerpo(
  formBody: string | URLSearchParams,
  max = 60,
): string[] {
  const patrones = new Set<string>();
  for (const [key] of toEntries(formBody)) {
    // `[0]`, `[12]` → `[N]`. Un índice es posición, no información.
    patrones.add(key.replace(/\[\d+\]/g, "[N]"));
    if (patrones.size >= max) break;
  }
  return [...patrones].sort();
}
