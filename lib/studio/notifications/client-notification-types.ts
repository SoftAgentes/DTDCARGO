/**
 * Notificaciones al cliente configurables — tipos, catálogo y copy (SDD-0156).
 *
 * El motor cuelga avisos de los eventos del journey China→VE. Cada regla
 * (client_notification_rules) define: canal · ancla · offset (con signo) ·
 * texto · visibilidad. Este módulo NO toca la DB: solo tipos + catálogo de
 * eventos (para la UI de config) + resolución de copy (default / template /
 * override manual).
 */
import type { ShipmentStatus } from "@/lib/shared/shipment-public";
import { STATUS_LABELS } from "@/lib/shared/shipment-public";

// ── Enums de config ──────────────────────────────────────────
export const NOTIFICATION_CHANNELS = ["email", "push", "both", "none"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Canales que SÍ despachan (channel='none' se filtra antes de programar). */
export type DispatchChannel = "email" | "push" | "both";

export const NOTIFICATION_ANCHORS = ["event", "eta", "etd"] as const;
export type NotificationAnchor = (typeof NOTIFICATION_ANCHORS)[number];

export function isNotificationChannel(v: string): v is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(v);
}
export function isNotificationAnchor(v: string): v is NotificationAnchor {
  return (NOTIFICATION_ANCHORS as readonly string[]).includes(v);
}

// ── trigger_event ────────────────────────────────────────────
/** Clave de evento a partir de un status de envío: 'status:shipped'. */
export function statusEvent(status: ShipmentStatus): string {
  return `status:${status}`;
}

export interface JourneyEventDef {
  key: string;
  label: string;
  hint: string;
  /** Slice que enciende el gancho: 'A' = sobre shipments.status (ya cablea). */
  slice: "A" | "D";
}

/**
 * Catálogo de eventos notificables del journey (alimenta la UI de config).
 * Slice A = disparan desde `transitionShipment` (shipments.status). Slice D =
 * máquinas paralelas (consolidado/naviera/recepción VE) — configurables ya,
 * pero disparan cuando se cablee su gancho.
 */
export const CLIENT_JOURNEY_EVENTS: readonly JourneyEventDef[] = [
  { key: "status:in_warehouse", label: "Recibido en bodega China", hint: "La carga llegó al galpón de Yiwu.", slice: "A" },
  { key: "status:consolidating", label: "Consolidando", hint: "Se está armando el contenedor.", slice: "A" },
  { key: "status:shipped", label: "Embarcado", hint: "Zarpó de China.", slice: "A" },
  { key: "status:in_transit", label: "En tránsito", hint: "Va en el mar rumbo a Venezuela.", slice: "A" },
  { key: "status:in_customs", label: "En aduana", hint: "Ideal para ocultar + disparar cobro anticipado.", slice: "A" },
  { key: "status:arrived_destination", label: "En bodega VE", hint: "Llegó a la bodega en Venezuela.", slice: "A" },
  { key: "status:out_for_delivery", label: "En reparto", hint: "Salió a la dirección de entrega.", slice: "A" },
  { key: "status:last_mile", label: "Última milla", hint: "En el tramo final de entrega.", slice: "A" },
  { key: "status:delivered", label: "Entregado", hint: "El envío se entregó.", slice: "A" },
  { key: "status:exception", label: "Alerta / excepción", hint: "Ocurrió una incidencia.", slice: "A" },
  // Máquinas paralelas (ganchos ya cableados en la operación):
  { key: "consolidated", label: "Consolidado (packing CN)", hint: "Al cerrar el contenedor en China.", slice: "D" },
  { key: "eta_set", label: "ETA de la naviera", hint: "Cuando la naviera fija el ETA — ancla del \"va llegando\".", slice: "D" },
  { key: "received_ve", label: "Recibido en Venezuela", hint: "Al crear el recibo de contenedor en Venezuela.", slice: "D" },
  // SDD-0543 · un aviso por cliente y contenedor cuando se carga desde el packing
  // list un contenedor que ya zarpó. Se dispara aparte, con OK de Sam, nunca
  // desde el lote SQL.
  { key: "carga_en_camino", label: "Carga en camino (contenedor cargado)", hint: "Cuando un contenedor ya zarpado se carga desde el packing list: un aviso por cliente, no por envío.", slice: "D" },
] as const;

export const CLIENT_JOURNEY_EVENT_KEYS: ReadonlySet<string> = new Set(
  CLIENT_JOURNEY_EVENTS.map((e) => e.key),
);

export function journeyEventLabel(key: string): string {
  return CLIENT_JOURNEY_EVENTS.find((e) => e.key === key)?.label ?? key;
}

// ── Copy (texto del aviso) ───────────────────────────────────
export interface NotifCopy {
  title: string;
  body: string;
}

/** Copy default por evento (migrado de MILESTONE_COPY, SDD-0132 Slice C). */
export const DEFAULT_EVENT_COPY: Record<string, NotifCopy> = {
  "status:in_warehouse": {
    title: "Tu carga llegó a nuestra bodega en China",
    body: "Recibimos tu mercancía en Yiwu. Ya arrancó el proceso hacia Venezuela.",
  },
  "status:consolidating": {
    title: "Estamos armando tu envío",
    body: "Tu mercancía está entrando al contenedor rumbo a Venezuela.",
  },
  "status:shipped": {
    title: "Tu carga fue embarcada",
    body: "Tu mercancía zarpó de China rumbo a Venezuela. Te avisamos cuando llegue.",
  },
  "status:in_transit": {
    title: "Tu carga va en camino",
    body: "Tu mercancía está en tránsito hacia Venezuela.",
  },
  "status:arrived_destination": {
    title: "Tu carga llegó a Venezuela",
    body: "Tu mercancía llegó a nuestra bodega en Venezuela.",
  },
  "status:out_for_delivery": {
    title: "Tu carga salió a entrega",
    body: "Tu mercancía va en camino a la dirección de entrega. ¡Ya casi!",
  },
  "status:last_mile": {
    title: "Tu carga está en la última milla",
    body: "Tu mercancía está en el tramo final de entrega.",
  },
  "status:delivered": {
    title: "Tu carga fue entregada",
    body: "Tu envío se entregó. Gracias por confiar en DTD Cargo.",
  },
  // Máquinas paralelas (Slice D). Sin estas entradas, el copy caía al genérico
  // "Actualización de tu envío" — feo justo en los hitos del arribo del piloto.
  consolidated: {
    title: "Armamos tu contenedor",
    body: "Tu mercancía ya quedó consolidada en el contenedor rumbo a Venezuela.",
  },
  eta_set: {
    title: "Tu carga ya tiene fecha de llegada",
    body: "La naviera confirmó la fecha estimada de arribo a Venezuela. Te avisamos cuando llegue.",
  },
  received_ve: {
    title: "Tu carga llegó a Venezuela",
    // SDD-0311 · el cuerpo decía "Recibimos tu mercancía en nuestra bodega en
    // Venezuela" y eso deja de ser cierto según CUÁNDO salga el aviso: hoy sale
    // cuando el contenedor arriba al país (naviera → arribado), y de ahí a la
    // bodega todavía faltan el puerto y el traslado. Un cliente al que se le
    // dice que su mercancía ya está en bodega llama ese mismo día a pedir la
    // entrega.
    //
    // El texto nuevo es verdadero en los DOS momentos —arribo al país y
    // recepción en bodega— porque no afirma dónde está más allá de Venezuela.
    // El día que la recepción de contenedor tenga pantalla y convenga separar
    // los dos avisos, esto se parte en dos eventos, no se vuelve a estirar.
    body: "Tu mercancía ya está en Venezuela. Te avisamos apenas coordinemos la entrega.",
  },
  // SDD-0543 · el contenedor ya va en el mar cuando el cliente se entera: el
  // texto no promete bodega ni fecha, eso lo ve en el Portal con el ETA vigente.
  carga_en_camino: {
    title: "Tu carga viene en camino",
    body: "Tu mercancía ya va en un contenedor rumbo a Venezuela. Entra al Portal para ver tus envíos y lo que tienes por aceptar.",
  },
};

/**
 * Templates con nombre (template_key). Copy pensado para escenarios que NO son
 * el default del evento — ej. ocultar "llegó a aduana" y en su lugar pedir el
 * cobro anticipado (ejemplo del founder).
 */
export const TEMPLATE_COPY: Record<string, NotifCopy> = {
  cobro_anticipado: {
    title: "Tu carga está por llegar — coordina el pago",
    body: "Tu mercancía entra en la etapa final. Para agilizar la entrega, coordina el pago con tu asesor antes de que llegue.",
  },
  va_llegando: {
    title: "Tu carga va llegando",
    body: "Tu mercancía está por llegar a Venezuela. Mantente atento a los próximos avisos.",
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_COPY);

/**
 * Resuelve el copy a mostrar, con precedencia:
 *   override manual (custom_title/body) → template_key → default del evento →
 *   fallback genérico por label de status.
 */
export function resolveNotifCopy(input: {
  event: string;
  templateKey?: string | null;
  customTitle?: string | null;
  customBody?: string | null;
}): NotifCopy {
  const base: NotifCopy =
    (input.templateKey ? TEMPLATE_COPY[input.templateKey] : undefined) ??
    DEFAULT_EVENT_COPY[input.event] ??
    genericCopyFor(input.event);

  const title = input.customTitle?.trim() || base.title;
  const body = input.customBody?.trim() || base.body;
  return { title, body };
}

function genericCopyFor(event: string): NotifCopy {
  // 'status:xxx' → usa el label público del status; si no, texto neutro.
  if (event.startsWith("status:")) {
    const status = event.slice("status:".length) as ShipmentStatus;
    const label = STATUS_LABELS[status];
    if (label) {
      return {
        title: `Actualización de tu envío · ${label}`,
        body: "Tu envío tuvo una actualización de estado.",
      };
    }
  }
  return {
    title: "Actualización de tu envío",
    body: "Tu envío tuvo una actualización.",
  };
}

// ── Filas de DB (shape TS) ───────────────────────────────────
export interface ClientNotificationRule {
  id: string;
  tenant_id: string;
  client_id: string | null;
  trigger_event: string;
  channel: NotificationChannel;
  anchor: NotificationAnchor;
  offset_minutes: number;
  template_key: string | null;
  custom_title: string | null;
  custom_body: string | null;
  visible_in_portal: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientNotificationScheduleRow {
  id: string;
  tenant_id: string;
  /**
   * SDD-0283: nullable desde la migr 0389. Un aviso cuelga de un envío O de una
   * compra, nunca de los dos ni de ninguno (CHECK `client_notif_sched_una_ancla`).
   */
  shipment_id: string | null;
  /** SDD-0283: la compra de la que cuelga el aviso cuando todavía no hay envío. */
  prealerta_id?: string | null;
  client_markbox: string;
  rule_id: string;
  trigger_event: string;
  channel: DispatchChannel;
  template_key: string | null;
  custom_title: string | null;
  custom_body: string | null;
  scheduled_for: string;
  payload: Record<string, unknown>;
  status: "scheduled" | "sent" | "skipped" | "canceled" | "failed";
  sent_at: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

/** Formatea un offset en minutos a etiqueta legible: "+5 días", "−2 h", "al instante". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "al instante";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  if (abs % (60 * 24) === 0) return `${sign}${abs / (60 * 24)} día(s)`;
  if (abs % 60 === 0) return `${sign}${abs / 60} h`;
  return `${sign}${abs} min`;
}
