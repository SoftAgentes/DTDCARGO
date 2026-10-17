/**
 * SDD-0526 · Bandeja de avisos del Portal — tipos y reglas puras.
 *
 * Un aviso es una fila ENVIADA de la cola `client_notification_schedule` que la
 * RPC `portal_list_my_notifications` (migración 0479) ya filtró por tenant,
 * Shipping Mark, ancla viva y «Visible en el portal». Acá sólo se le da forma
 * para la pantalla: enlace a su compra o envío, fecha legible en hora de
 * Venezuela y etiqueta del evento.
 *
 * No importa nada del Studio ni de la base: lo usan la campana (componente de
 * cliente) y las páginas del Portal. Las etiquetas salen de `lib/shared`.
 */
import { STATUS_LABELS, type ShipmentStatus } from "@/lib/shared/shipment-public";

export type PortalAvisoAncla = "envio" | "compra";
export type PortalAvisoCanal = "email" | "push" | "both";

export type PortalAviso = {
  id: string;
  title: string;
  body: string;
  /** Cuándo se envió (ISO). */
  sentAt: string;
  /** «15 oct 2026 · 10:30», hora de Venezuela. */
  sentAtLabel: string;
  /** Etiqueta corta del evento («Embarcado», «En bodega»). */
  eventLabel: string;
  channel: PortalAvisoCanal;
  anchorKind: PortalAvisoAncla;
  anchorCode: string;
  /** «Envío» o «Compra». */
  anchorLabel: string;
  href: string;
  /** Enviado después de lo último que el cliente vio en la bandeja. */
  unread: boolean;
};

/** Lo que pinta `PortalNotificationHistory` (historial de una compra o envío). */
export type PortalAvisoHistorial = {
  id: string;
  eventLabel: string;
  channel: PortalAvisoCanal;
  title: string;
  body: string;
  sentAt: string | null;
};

export const AVISO_TITULO_GENERICO = "Actualización de tu carga";
export const AVISO_TEXTO_GENERICO = "Tu carga tuvo una actualización.";

/** Eventos del journey que no son un status de envío (SDD-0156 · Slice D). */
const EVENTOS_PARALELOS: Record<string, string> = {
  consolidated: "Consolidado",
  eta_set: "Fecha de llegada",
  received_ve: "En Venezuela",
};

export function etiquetaDelEvento(trigger: string): string {
  if (trigger.startsWith("status:")) {
    const status = trigger.slice("status:".length) as ShipmentStatus;
    return STATUS_LABELS[status] ?? "Actualización";
  }
  return EVENTOS_PARALELOS[trigger] ?? "Actualización";
}

export function hrefDelAviso(kind: PortalAvisoAncla, code: string): string {
  const base = kind === "compra" ? "/portal/compras/" : "/portal/envios/";
  return base + encodeURIComponent(code);
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * La hora de Venezuela, explícita: el servidor no corre en Caracas y la campana
 * se pinta primero en el servidor y después en el navegador. Con la zona fija las
 * dos pasadas dicen lo mismo.
 */
const PARTES_CARACAS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Caracas",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO → «15 oct 2026 · 10:30» (hora de Venezuela), o null si no se entiende. */
export function fechaDelAviso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const p = Object.fromEntries(
    PARTES_CARACAS.formatToParts(new Date(t)).map((part) => [part.type, part.value]),
  );
  const mes = MESES[Number(p.month) - 1];
  if (!mes) return null;
  return `${Number(p.day)} ${mes} ${p.year} · ${p.hour}:${p.minute}`;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Una fila de la RPC → aviso. Una fila sin lo indispensable (id, ancla, fecha)
 * no se inventa: se descarta.
 */
export function avisoDesdeFila(row: unknown): PortalAviso | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = texto(r.id);
  const anchorCode = texto(r.anchor_code);
  const sentAt = texto(r.sent_at);
  const kind = r.anchor_kind;
  if (!id || !anchorCode || !sentAt) return null;
  if (kind !== "envio" && kind !== "compra") return null;
  const sentAtLabel = fechaDelAviso(sentAt);
  if (!sentAtLabel) return null;
  const channel: PortalAvisoCanal =
    r.channel === "push" || r.channel === "both" ? r.channel : "email";
  return {
    id,
    title: texto(r.title) ?? AVISO_TITULO_GENERICO,
    body: texto(r.body) ?? AVISO_TEXTO_GENERICO,
    sentAt,
    sentAtLabel,
    eventLabel: etiquetaDelEvento(texto(r.trigger_event) ?? ""),
    channel,
    anchorKind: kind,
    anchorCode,
    anchorLabel: kind === "compra" ? "Compra" : "Envío",
    href: hrefDelAviso(kind, anchorCode),
    unread: r.unread === true,
  };
}

/**
 * Los avisos que siguen sin leer: los que la base marcó `unread` y que además
 * son posteriores a lo que esta pestaña ya marcó como visto.
 */
export function avisosSinLeer(
  avisos: readonly PortalAviso[],
  vistoHasta: string | null,
): PortalAviso[] {
  const limite = vistoHasta ? Date.parse(vistoHasta) : Number.NEGATIVE_INFINITY;
  return avisos.filter((a) => a.unread && Date.parse(a.sentAt) > limite);
}

/** La fecha más nueva de una lista de avisos, o null si está vacía. */
export function masReciente(avisos: readonly PortalAviso[]): string | null {
  let mejor: string | null = null;
  for (const a of avisos) {
    if (mejor === null || Date.parse(a.sentAt) > Date.parse(mejor)) mejor = a.sentAt;
  }
  return mejor;
}

/** Lo que dice el contador de la campana: nada, «1»…«9» o «9+». */
export function contadorVisible(n: number): string | null {
  if (n <= 0) return null;
  return n > 9 ? "9+" : String(n);
}

export function historialDesdeAviso(a: PortalAviso): PortalAvisoHistorial {
  return {
    id: a.id,
    eventLabel: a.eventLabel,
    channel: a.channel,
    title: a.title,
    body: a.body,
    sentAt: a.sentAt,
  };
}
