/**
 * Canal de una tarjeta del CRM, para pintar su logo (SDD-0648 §2).
 *
 * Sale de `crm_tarjetas.fuente` (0506), que la entrada de Chatwoot llena desde
 * el tipo de bandeja y no se pisa nunca, y de `utm_source` para TikTok (D4):
 * TikTok no es una fuente posible, así que solo se reconoce cuando un registro
 * web llega con esa marca de campaña. Sin migración.
 *
 * Puro y sin dependencias: lo usan el tablero, la Lista y sus pruebas.
 */

export type CrmCanal = "whatsapp" | "instagram" | "facebook" | "tiktok" | "dtd" | "correo";

export const CANAL_LABEL: Record<CrmCanal, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  dtd: "Canales DTD",
  correo: "Correo",
};

/** Fuentes que nacen en la web propia: portal, registro y cotizador. */
const FUENTES_WEB: ReadonlySet<string> = new Set(["portal", "web_registro", "cotizador"]);

/**
 * `null` = sin logo (Kommo, alta manual o una fuente desconocida): mejor nada
 * que un logo que diga algo que no pasó.
 */
export function canalDeTarjeta(
  fuente: string | null | undefined,
  utmSource?: string | null,
): CrmCanal | null {
  if (!fuente) return null;
  if (FUENTES_WEB.has(fuente)) {
    return utmSource && /tiktok/i.test(utmSource) ? "tiktok" : "dtd";
  }
  switch (fuente) {
    case "whatsapp_leads":
    case "whatsapp_clientes":
      return "whatsapp";
    case "instagram":
      return "instagram";
    case "messenger":
      return "facebook";
    case "correo":
      return "correo";
    // 0553 (SDD-0647): cliente con carga en el ERP que nunca escribió. No vino
    // por un canal de terceros: es de la casa, así que lleva el isólogo DTD.
    case "carga_erp":
      return "dtd";
    default:
      return null;
  }
}

/** ¿El canal es una conversación de Chatwoot? Solo entonces se ofrece «Abrir chat» sin ficha. */
export function canalConChat(canal: CrmCanal | null): boolean {
  return canal === "whatsapp" || canal === "instagram" || canal === "facebook" || canal === "correo";
}
