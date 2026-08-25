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

// ─────────────────────────────────────────────────────────────────────────────
// SDD-0288 rebanada 0b · los VALORES de los campos que deciden el semáforo.
//
// La primera medición (`formaDelCuerpo`) dio la FORMA. Contra tráfico real del
// 2026-08-24/25 aparecieron `message[add]`, `talk[add]`, `talk[update]`,
// `unsorted[add]` y `contacts[note]` — o sea que Kommo SÍ emite mensajería.
//
// Pero la forma no alcanza para escribir el parser: falta saber qué DICE
// `type` (¿"incoming"/"outgoing"?), qué dice `author[type]`, y si `is_read` es
// 0/1 o true/false. De esos valores depende que una tarjeta se pinte roja o
// gris, y adivinarlos sería el error que esta spec viene esquivando desde §1.1.b.
//
// ── Por qué esto NO reabre el problema de la PII ────────────────────────────
//
// 🔴 **Es una LISTA BLANCA, no una lista negra.** Sólo se publica el valor de
// las claves nombradas acá abajo una por una, y todas son enumerados cortos
// (`incoming`, `contact`, `1`, `whatsapp`). Una lista negra —"todo menos
// `text`"— filtraría cualquier campo nuevo que Kommo agregue mañana, y el fallo
// sería silencioso. Con lista blanca, un campo desconocido no se publica por
// omisión: hay que agregarlo a mano.
//
// `text`, `author[name]`, `attachment[link]`, los teléfonos y los ids NO están
// en la lista y no pueden entrar sin que alguien edite este archivo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las ÚNICAS claves cuyo valor se puede registrar. Cada una es un enumerado que
 * el semáforo necesita interpretar; ninguna identifica a una persona.
 */
const CLAVES_ENUM: ReadonlySet<string> = new Set([
  // ¿entrante o saliente? — es la que decide el rojo
  "message[add][N][type]",
  "message[add][N][message_type]",
  // ¿lo escribió el cliente, un asesor o el bot?
  "message[add][N][author][type]",
  // canal (whatsapp / instagram / facebook) — para saber qué cobertura hay
  "message[add][N][origin]",
  "message[add][N][entity_type]",
  "message[add][N][element_type]",
  // la conversación: sin leer / en atención
  "talk[add][N][is_read]",
  "talk[add][N][is_in_work]",
  "talk[add][N][origin]",
  "talk[update][N][is_read]",
  "talk[update][N][is_in_work]",
  "talk[update][N][origin]",
]);

/** Un enumerado es corto. Si llega algo largo, se recorta y se nota. */
const TOPE_VALOR = 32;

/**
 * Valores de los campos enumerados del cuerpo. PURA.
 *
 * Devuelve `{ "message[add][N][type]": "incoming", … }` — sólo claves de
 * `CLAVES_ENUM`. Todo lo demás se descarta sin mirarlo.
 */
export function valoresEnumerados(
  formBody: string | URLSearchParams,
  max = 24,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of toEntries(formBody)) {
    const patron = key.replace(/\[\d+\]/g, "[N]");
    if (!CLAVES_ENUM.has(patron)) continue;
    if (Object.keys(out).length >= max && !(patron in out)) continue;

    const v = String(val ?? "");
    out[patron] = v.length > TOPE_VALOR ? `${v.slice(0, TOPE_VALOR)}…(recortado)` : v;
  }
  return out;
}
