/**
 * Contexto de la Dashboard App «Ficha DTD» (SDD-0585, paso 2.4, E2-D30). Pura;
 * corre en el navegador, dentro del iframe que monta Chatwoot.
 *
 * Chatwoot 4.19.1 (`app/javascript/dashboard/components/widgets/DashboardApp/Frame.vue`)
 * manda `postMessage(JSON.stringify({ event: "appContext", data }), "*")` al
 * cargar y cada vez que la app pide `chatwoot-dashboard-app:fetch-info`. `data`
 * trae `conversation`, `contact` (nombre, teléfono, correo), `currentAgent` y
 * `theme`. No viene firmado y va a cualquier origen: NO es una credencial.
 *
 * De acá salen solo dos enteros y el tema, y solo si el mensaje vino del origen
 * del chat Y de la ventana que enmarca la app. El resto del contexto se descarta
 * sin guardarlo: los datos del contacto nunca llegan a Studio.
 */

export const PEDIR_CONTEXTO = "chatwoot-dashboard-app:fetch-info";

export interface ContextoFicha {
  /** `conversation.id` del panel de Chatwoot: el display_id de la cuenta. */
  conversacionId: number;
  /** `currentAgent.id`: el agente con sesión en Chatwoot. */
  agenteId: number;
  tema: "light" | "dark";
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const entero = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;

export function leerContextoChatwoot(
  evento: { data: unknown; origin: string; source: unknown },
  origenChat: string,
  padre: unknown,
): ContextoFicha | null {
  if (!padre || evento.source !== padre) return null;
  if (evento.origin !== origenChat) return null;
  if (typeof evento.data !== "string") return null;

  let crudo: unknown;
  try {
    crudo = JSON.parse(evento.data);
  } catch {
    return null;
  }
  const mensaje = obj(crudo);
  if (mensaje?.event !== "appContext") return null;
  const data = obj(mensaje.data);
  const conversacionId = entero(obj(data?.conversation)?.id);
  const agenteId = entero(obj(data?.currentAgent)?.id);
  if (!conversacionId || !agenteId) return null;
  return { conversacionId, agenteId, tema: data?.theme === "dark" ? "dark" : "light" };
}
