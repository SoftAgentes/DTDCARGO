/**
 * SDD-0098 · Prealertas: menú de servicios de recepción ("ads") sobre la compra.
 *
 * Tipos + DEFAULTS de código + merge "DB pisa, código respalda" (mismo patrón que
 * service-offer.ts / mergeServiciosPublicados): el catálogo vive en la tabla
 * `prealerta_addons` (migr 0150, configurable por tenant), pero acá van los 7
 * DEFAULTS para que la UI funcione ANTES de aplicar la migración y nunca quede
 * vacía. La copia es la MISMA que el seed de 0150 (marca DTD, cobro advisory).
 *
 * Helpers PUROS + validadores manuales (no Zod, patrón del repo).
 */

import type { BadgeTone } from "./types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Códigos de los 7 servicios (== CHECK de la migr 0150)     ║
// ╚═══════════════════════════════════════════════════════════╝

export const PREALERTA_ADDON_CODES = [
  "verificacion",
  "inspeccion_recepcion",
  "reempaque_unificar",
  "compactar",
  "etiquetado_pieza",
  "cotizar_medir",
  "hold_consolidar",
] as const;

export type PrealertaAddonCode = (typeof PREALERTA_ADDON_CODES)[number];

export function isPrealertaAddonCode(v: unknown): v is PrealertaAddonCode {
  return (
    typeof v === "string" &&
    (PREALERTA_ADDON_CODES as readonly string[]).includes(v)
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Catálogo (fila de prealerta_addons + DEFAULTS de código)  ║
// ╚═══════════════════════════════════════════════════════════╝

/** Un servicio del menú (config). Matchea las columnas de `prealerta_addons`. */
export type PrealertaAddon = {
  code: PrealertaAddonCode;
  label: string;
  description: string;
  /** Guía para el campo de notas del cliente (placeholder). null = sin guía. */
  notasPlaceholder: string | null;
  /** Texto de consentimiento (obligatorio aceptar para pedir). null = sin consent. */
  consentText: string | null;
  /** YouTube Short (vertical) de ayuda. null = "próximamente" (sin iframe roto). */
  videoUrl: string | null;
  /** true = permite listar varios trackings (reempaque/hold). */
  multiTracking: boolean;
  /** orden de presentación. */
  sort: number;
  /** prendido/apagado por el founder (sin deploy). */
  isActive: boolean;
};

/** Fila cruda de `prealerta_addons` (lo que devuelve Supabase). */
export type PrealertaAddonRow = {
  code: string;
  label?: string | null;
  description?: string | null;
  notas_placeholder?: string | null;
  consent_text?: string | null;
  video_url?: string | null;
  multi_tracking?: boolean | null;
  sort?: number | null;
  is_active?: boolean | null;
};

const ADVISORY_CONSENT =
  "Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que mi compra llegue a la bodega.";
const ADVISORY_CONSENT_FIRST =
  "Entiendo que este servicio lo coordina y cotiza mi asesor, y que debo pedirlo antes de que llegue el primer bulto a la bodega.";

/**
 * DEFAULTS de los 7 servicios (idéntico al seed de migr 0150). Sirve de respaldo:
 * si un tenant no tiene filas en `prealerta_addons`, la UI usa esto (la DB pisa).
 */
export const PREALERTA_ADDON_DEFAULTS: readonly PrealertaAddon[] = [
  {
    code: "verificacion",
    label: "Verificación al recibir",
    description:
      "Revisamos tu compra cuando llega a la bodega: abrimos, contamos contra tu factura o packing y te enviamos fotos.",
    notasPlaceholder:
      "Detalla qué debe traer tu compra: cantidades, descripción, tallas, colores y cualquier dato relevante.",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: false,
    sort: 10,
    isActive: true,
  },
  {
    code: "inspeccion_recepcion",
    label: "Inspección de calidad al recibir",
    description:
      "Revisión técnica al recibir: abrimos el producto, revisamos su interior, etiquetado y gramaje según lo que necesites.",
    notasPlaceholder:
      "Indica qué quieres que revisemos del producto (medidas, materiales, gramaje, etiquetado, funcionamiento).",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: false,
    sort: 20,
    isActive: true,
  },
  {
    code: "reempaque_unificar",
    label: "Reempaque (unificar bultos)",
    description:
      "Juntamos varios bultos en un solo empaque para que tu carga viaje ordenada. Esperamos a que lleguen todos y los unimos.",
    notasPlaceholder: "Lista los trackings que quieres unificar en este reempaque.",
    consentText: ADVISORY_CONSENT_FIRST,
    videoUrl: null,
    multiTracking: true,
    sort: 30,
    isActive: true,
  },
  {
    code: "compactar",
    label: "Compactar (reducir volumen)",
    description:
      "Eliminamos el exceso de volumen de tu caja para que viaje más liviana y ahorres en flete. Nuestro equipo evalúa si aplica.",
    notasPlaceholder: "Cuéntanos qué trae la caja para evaluar si se puede compactar.",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: false,
    sort: 40,
    isActive: true,
  },
  {
    code: "etiquetado_pieza",
    label: "Etiquetado por pieza",
    description:
      "Marcamos o etiquetamos tus piezas según tu requerimiento antes de embarcar.",
    notasPlaceholder: "Indica cómo quieres que etiquetemos las piezas.",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: false,
    sort: 50,
    isActive: true,
  },
  {
    code: "cotizar_medir",
    label: "Cotizar / medir",
    description:
      "Medimos tu paquete (CBM) y te decimos cuánto cuesta enviarlo por aéreo y por marítimo, para que elijas la mejor opción.",
    notasPlaceholder: "Agrega cualquier dato útil del paquete (qué trae, fragilidad, urgencia).",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: false,
    sort: 60,
    isActive: true,
  },
  {
    code: "hold_consolidar",
    label: "Hold (retener para consolidar)",
    description:
      "Retenemos tu carga en bodega para juntarla con tu próxima compra y consolidar el envío. Pídelo cuando esperas más mercancía.",
    notasPlaceholder: "Cuéntanos qué estás esperando o con qué compra quieres consolidar.",
    consentText: ADVISORY_CONSENT,
    videoUrl: null,
    multiTracking: true,
    sort: 70,
    isActive: true,
  },
];

const DEFAULTS_BY_CODE: Record<PrealertaAddonCode, PrealertaAddon> =
  PREALERTA_ADDON_DEFAULTS.reduce(
    (acc, a) => {
      acc[a.code] = a;
      return acc;
    },
    {} as Record<PrealertaAddonCode, PrealertaAddon>,
  );

/** El default de un código (o undefined si el código no es de los 7). */
export function defaultAddon(code: string): PrealertaAddon | undefined {
  return isPrealertaAddonCode(code) ? DEFAULTS_BY_CODE[code] : undefined;
}

/**
 * Combina los DEFAULTS de código con las filas de la DB (la DB PISA campo a campo;
 * lo que la DB deje en null cae al default). Devuelve TODOS los servicios (activos
 * e inactivos) ordenados por `sort`. Un código de la DB fuera de los 7 se ignora
 * (la CHECK de la migr lo impide, pero somos defensivos). Patrón idéntico a
 * mergeServiciosPublicados: cero pantalla vacía aunque la tabla no exista.
 */
export function mergePrealertaAddons(
  rows: PrealertaAddonRow[] = [],
): PrealertaAddon[] {
  const byCode = new Map<PrealertaAddonCode, PrealertaAddon>();
  // base: todos los defaults
  for (const d of PREALERTA_ADDON_DEFAULTS) byCode.set(d.code, { ...d });
  // override con la DB
  for (const r of rows) {
    if (!isPrealertaAddonCode(r.code)) continue;
    const base = DEFAULTS_BY_CODE[r.code];
    byCode.set(r.code, {
      code: r.code,
      label: r.label?.trim() || base.label,
      description: r.description?.trim() || base.description,
      notasPlaceholder:
        r.notas_placeholder != null ? r.notas_placeholder : base.notasPlaceholder,
      consentText: r.consent_text != null ? r.consent_text : base.consentText,
      videoUrl: r.video_url?.trim() || null,
      multiTracking: r.multi_tracking ?? base.multiTracking,
      sort: r.sort ?? base.sort,
      isActive: r.is_active ?? base.isActive,
    });
  }
  return [...byCode.values()].sort((a, b) => a.sort - b.sort);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Solicitud de servicio (prealerta_service_requests)        ║
// ╚═══════════════════════════════════════════════════════════╝

export type PrealertaServiceRequestStatus =
  | "solicitada"
  | "en_proceso"
  | "atendida"
  | "descartada"
  | "invalida";

export const PSR_STATUS: Record<
  PrealertaServiceRequestStatus,
  { label: string; tone: BadgeTone }
> = {
  solicitada: { label: "Solicitada", tone: "info" },
  en_proceso: { label: "En proceso", tone: "warning" },
  atendida: { label: "Atendida", tone: "success" },
  descartada: { label: "Descartada", tone: "neutral" },
  invalida: { label: "Inválida", tone: "danger" },
};

export const PSR_STATUSES = Object.keys(
  PSR_STATUS,
) as PrealertaServiceRequestStatus[];

export function psrStatusLabel(status: string): string {
  return PSR_STATUS[status as PrealertaServiceRequestStatus]?.label ?? status;
}
export function psrStatusTone(status: string): BadgeTone {
  return PSR_STATUS[status as PrealertaServiceRequestStatus]?.tone ?? "neutral";
}

export type PrealertaServiceRequestTiming = "a_tiempo" | "tardia";

/** Fila persistida de `prealerta_service_requests`. */
export type PrealertaServiceRequest = {
  id: string;
  tenant_id: string;
  prealerta_id: string;
  client_markbox: string;
  addon_code: PrealertaAddonCode;
  status: PrealertaServiceRequestStatus;
  timing: PrealertaServiceRequestTiming;
  trackings: string[] | null;
  consent_accepted: boolean;
  notes: string | null;
  quoted_amount_usd: number | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Validación del tracking (alfanumérico + guiones, patrón del courier) ──
const TRACKING_RE = /^[A-Za-z0-9-]+$/;
/** Tope de trackings extra por solicitud (evita listas enormes). */
export const MAX_REQUEST_TRACKINGS = 30;

/** Normaliza una lista de trackings: trim, valida alfanum+guiones, dedupe, cap. */
export function cleanTrackings(raw: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const s = (t ?? "").trim();
    if (!s || !TRACKING_RE.test(s)) continue;
    const key = s.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_REQUEST_TRACKINGS) break;
  }
  return out;
}

/** Input de UNA solicitud de servicio (lo que arma la action por cada add-on elegido). */
export type ServiceRequestInput = {
  addonCode: PrealertaAddonCode;
  notes: string | null;
  trackings: string[];
};

/**
 * Valida el input de una solicitud de servicio (sin Zod):
 *  - addonCode debe ser uno de los 7 Y estar activo (se pasa el set de activos).
 *  - notes opcional (se recorta).
 *  - trackings se limpian (alfanum+guiones); solo se conservan si el add-on es multi.
 * Devuelve null si el código no es válido / no está activo (la action lo ignora).
 */
export function validateServiceRequestInput(
  raw: { addonCode: string; notes?: string | null; trackings?: string[] },
  activeCodes: ReadonlySet<string>,
): ServiceRequestInput | null {
  if (!isPrealertaAddonCode(raw.addonCode)) return null;
  if (!activeCodes.has(raw.addonCode)) return null;
  const addon = DEFAULTS_BY_CODE[raw.addonCode];
  return {
    addonCode: raw.addonCode,
    notes: raw.notes?.trim() || null,
    trackings: addon.multiTracking ? cleanTrackings(raw.trackings ?? []) : [],
  };
}

/** Estado de la action de "pedir un servicio" desde el detalle (useActionState). */
export type ServiceRequestActionState = {
  ok?: boolean;
  error?: string;
  /** cuántas solicitudes se registraron (para el toast). */
  requestedCount?: number;
};
