/**
 * SDD-0650 F2 · Reglas puras del panel de conversaciones de la ficha del cliente.
 * Sin red ni base: `ficha-panel.ts` (servidor) les pasa lo que leyó de Chatwoot.
 *
 * Lo que sale de acá es lo único que llega al navegador. El texto del último mensaje
 * se corta a 160 caracteres y solo sale si el usuario puede ver datos de clientes
 * (`canSeeClientNames`, SDD-0531). Nada se guarda ni se registra.
 *
 * D2: todos los que tienen la Bandeja ven lo mismo (cuenta de servicio).
 * D3: las conversaciones del Archivo Kommo se VEN en la ficha (Admin, Comercial y
 *     Soporte), pero el enlace para ABRIR el chat completo solo lo reciben Admin y
 *     Contabilidad. Sin el enlace, la ficha avisa «hay conversaciones que tu rol no
 *     abre», sin decir cuántas.
 */
import type { StudioUserRole } from "@/lib/studio/user-types";

import { interpretarConversacion, nombreVisibleDe, type EstadoConversacion } from "./webhook-events";

export const LARGO_TEXTO = 160;
/** «Las últimas ~6 conversaciones» (D1). */
export const LIMITE_CONVERSACIONES = 6;
/** Contactos leídos por ficha: una llamada a Chatwoot por contacto. */
export const LIMITE_CONTACTOS = 5;

export type AutorMensaje = "cliente" | "equipo" | "bot" | "nota_interna";

export interface ConversacionEnVivo {
  conversationId: number;
  inboxId: number | null;
  estado: EstadoConversacion;
  ultimaActividad: string | null;
  /** Hasta 160 caracteres; null sin texto (adjunto, nota interna o sin mensajes). */
  texto: string | null;
  autor: AutorMensaje | null;
  fechaMensaje: string | null;
  /** El nombre del contacto en Chatwoot (D5), si es un nombre y no un teléfono o correo. */
  nombreContacto: string | null;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

/** Corta por caracteres (no por unidades UTF-16: un emoji no queda partido). */
export function cortarTexto(v: unknown, largo = LARGO_TEXTO): string | null {
  if (typeof v !== "string") return null;
  const limpio = v.replace(/\s+/g, " ").trim();
  if (limpio === "") return null;
  const letras = Array.from(limpio);
  return letras.length <= largo ? limpio : `${letras.slice(0, largo - 1).join("").trimEnd()}…`;
}

function fechaDe(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? new Date(v * 1000).toISOString() : null;
}

/**
 * El último mensaje que no es una actividad. Chatwoot 4.19.1 lo da en
 * `last_non_activity_message`; si no viene, se toma el último de `messages`
 * (`message_type` 2 es actividad).
 */
function ultimoMensaje(c: Obj): Obj | null {
  const directo = obj(c.last_non_activity_message);
  if (directo) return directo;
  const lista = Array.isArray(c.messages) ? c.messages.map(obj).filter((m): m is Obj => m !== null) : [];
  return lista.filter((m) => m.message_type !== 2 && m.message_type !== "activity").at(-1) ?? null;
}

function autorDe(m: Obj): AutorMensaje | null {
  if (m.private === true) return "nota_interna";
  const tipo = m.message_type;
  if (tipo === 0 || tipo === "incoming") return "cliente";
  if (tipo === 1 || tipo === 3 || tipo === "outgoing" || tipo === "template") {
    const remitente = obj(m.sender);
    return remitente?.type === "agent_bot" || m.sender_type === "AgentBot" ? "bot" : "equipo";
  }
  return null;
}

/** Una conversación de `GET /contacts/{id}/conversations`, reducida a lo que muestra la ficha. */
export function resumirConversacion(raw: unknown): ConversacionEnVivo | null {
  const base = interpretarConversacion(raw);
  const c = obj(raw);
  if (!base || !c) return null;
  const m = ultimoMensaje(c);
  const autor = m ? autorDe(m) : null;
  return {
    conversationId: base.id,
    inboxId: base.inboxId,
    estado: base.estado,
    ultimaActividad: base.ultimaActividad,
    // Una nota interna no es del cliente: se dice que la hay, sin su texto.
    texto: m && autor !== "nota_interna" ? cortarTexto(m.content) : null,
    autor,
    fechaMensaje: m ? fechaDe(m.created_at) : null,
    nombreContacto: nombreVisibleDe(obj(obj(c.meta)?.sender)?.name),
  };
}

/** D3: abrir el chat completo del Archivo Kommo. */
export function puedeAbrirArchivoKommo(role: StudioUserRole | null): boolean {
  return role === "admin" || role === "accounting";
}

export interface ItemPanel {
  conversationId: number;
  estado: EstadoConversacion;
  ultimaActividad: string | null;
  texto: string | null;
  autor: AutorMensaje | null;
  fechaMensaje: string | null;
  esArchivoKommo: boolean;
  /** `/studio/bandeja?c=N`, o null si el rol no la abre. */
  abrirHref: string | null;
}

export interface PanelConversaciones {
  items: ItemPanel[];
  /** Alguna de las mostradas no tiene enlace para este rol. No dice cuántas. */
  hayQueNoAbres: boolean;
  /** D5: solo si la ficha no tiene nombre y el usuario puede ver nombres. */
  nombreEnElChat: string | null;
  /** Algún contacto no se pudo leer: la lista puede estar corta. */
  incompleto: boolean;
}

export function armarPanel(args: {
  conversaciones: readonly ConversacionEnVivo[];
  archivoKommoInboxId: number;
  puedeAbrirArchivo: boolean;
  /** `canSeeClientNames` (SDD-0531): sin esto no sale ni el texto ni el nombre. */
  puedeVerDatos: boolean;
  fichaSinNombre: boolean;
  incompleto?: boolean;
  limite?: number;
}): PanelConversaciones {
  const { archivoKommoInboxId, puedeAbrirArchivo, puedeVerDatos, fichaSinNombre } = args;
  const unicas = new Map<number, ConversacionEnVivo>();
  for (const c of args.conversaciones) if (!unicas.has(c.conversationId)) unicas.set(c.conversationId, c);
  const ordenadas = [...unicas.values()].sort((a, b) => (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? ""));

  const items = ordenadas.slice(0, args.limite ?? LIMITE_CONVERSACIONES).map((c): ItemPanel => {
    const esArchivoKommo = c.inboxId !== null && c.inboxId === archivoKommoInboxId;
    return {
      conversationId: c.conversationId,
      estado: c.estado,
      ultimaActividad: c.ultimaActividad,
      texto: puedeVerDatos ? c.texto : null,
      autor: c.autor,
      fechaMensaje: c.fechaMensaje,
      esArchivoKommo,
      abrirHref: esArchivoKommo && !puedeAbrirArchivo ? null : `/studio/bandeja?c=${c.conversationId}`,
    };
  });

  return {
    items,
    hayQueNoAbres: items.some((i) => i.abrirHref === null),
    nombreEnElChat:
      fichaSinNombre && puedeVerDatos ? (ordenadas.find((c) => c.nombreContacto)?.nombreContacto ?? null) : null,
    incompleto: args.incompleto === true,
  };
}
