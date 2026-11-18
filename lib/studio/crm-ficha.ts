/**
 * Ficha de una tarjeta del CRM propio (SDD-0587 · paso 6.3). Tipos que viajan
 * de `cargarFichaTarjetaAction` al drawer. Sin teléfono ni BSUID: la ficha no
 * los muestra (D6, minimización).
 */

import type { CrmTablero } from "@/lib/studio/crm-tablero";

export interface CrmFichaTarjeta {
  id: string;
  nombre: string | null;
  shippingMark: string | null;
  conFicha: boolean;
  etapaLeads: string;
  etapaClientes: string;
  motivoPerdida: string | null;
  fuente: string;
  fuenteDetalle: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  creadaAt: string;
  ultimaActividadAt: string;
  /** Dueño comercial de la tarjeta (Studio, D9). */
  dueno: { id: string | null; nombre: string | null };
  /** Quién puede ser dueño: admin y commercial activos del tenant. */
  asesores: { userId: string; nombre: string }[];
  /** Quién contesta el chat (Chatwoot, D9). null = sin conversación ligada. */
  chat: {
    estado: string;
    asignado: string | null;
    /** El agente de Chatwoot no tiene usuario de Studio vinculado. */
    sinVincular: boolean;
    ultimaActividadAt: string | null;
  } | null;
  historial: {
    id: number;
    tablero: CrmTablero;
    de: string | null;
    a: string;
    origen: string;
    actor: string | null;
    motivo: string | null;
    ocurrioAt: string;
  }[];
  tareas: {
    id: string;
    texto: string;
    venceAt: string | null;
    asignado: string | null;
    completadaAt: string | null;
    origen: string;
  }[];
  notas: {
    id: string;
    texto: string;
    autor: string | null;
    creadaAt: string;
  }[];
}

export const ORIGEN_MOVIMIENTO_LABEL: Record<string, string> = {
  manual: "A mano",
  automatico: "Automático",
  migracion: "Migración",
};

export const ESTADO_CHAT_LABEL: Record<string, string> = {
  open: "Abierta",
  pending: "Pendiente",
  snoozed: "Pospuesta",
  resolved: "Resuelta",
};

/** Fecha y hora cortas en la hora de Caracas. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}
