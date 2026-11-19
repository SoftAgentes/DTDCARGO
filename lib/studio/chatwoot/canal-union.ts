/**
 * SDD-0676 · El canal de una unión chat ↔ ficha (columna `canal_chat` de `chatwoot_contact_links`).
 *
 * Reglas puras, sin red ni base. El canal sale del tipo de bandeja de Chatwoot
 * (`Channel::…`) en el momento de vincular. No es un dato personal: solo dice
 * por dónde escribe ese contacto, para pintar su logo sin llamar a Chatwoot.
 */

import type { CrmCanal } from "@/lib/studio/crm-canal";

export const CANALES_UNION = ["whatsapp", "instagram", "messenger", "tiktok", "correo", "otro", "portal"] as const;
export type CanalUnion = (typeof CANALES_UNION)[number];

export function esCanalUnion(v: unknown): v is CanalUnion {
  return typeof v === "string" && (CANALES_UNION as readonly string[]).includes(v);
}

/**
 * `portal` no sale de aquí: es el canal de la unión que escribe el chat del portal
 * (`chatwoot_portal_vincular`), nunca el de una unión hecha a mano.
 *
 * `Channel::Whatsapp` → `whatsapp`. Un tipo que no conocemos (API, widget web,
 * SMS…) es `otro`; sin tipo, `null`: mejor sin logo que uno que diga algo que
 * no pasó.
 */
export function canalDeChatwoot(channel: string | null | undefined): CanalUnion | null {
  switch (channel) {
    case "Channel::Whatsapp":
      return "whatsapp";
    case "Channel::Instagram":
      return "instagram";
    case "Channel::FacebookPage":
      return "messenger";
    case "Channel::Tiktok":
      return "tiktok";
    case "Channel::Email":
      return "correo";
    case null:
    case undefined:
    case "":
      return null;
    default:
      return "otro";
  }
}

/** El logo del CRM (SDD-0648) para ese canal; `otro` y nulo no llevan logo. */
export function logoDeCanalUnion(canal: CanalUnion | null | undefined): CrmCanal | null {
  switch (canal) {
    case "whatsapp":
      return "whatsapp";
    case "instagram":
      return "instagram";
    case "messenger":
      return "facebook";
    case "tiktok":
      return "tiktok";
    case "correo":
      return "correo";
    case "portal":
      return "dtd";
    default:
      return null;
  }
}

/** Los últimos 4 dígitos de un teléfono, para reconocer a la persona sin mostrar el número entero. */
export function telefonoFinal(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/[^0-9]/g, "");
  return digitos.length >= 7 ? digitos.slice(-4) : null;
}
