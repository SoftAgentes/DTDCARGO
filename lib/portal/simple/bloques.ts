/**
 * SDD-0654 fase 2 · Armado de los seis bloques del inicio simple (§6, AC-8).
 *
 * Función pura: recibe lo que el portal ya lee y devuelve qué pinta cada
 * bloque. Los seis bloques salen SIEMPRE, en el mismo orden; un bloque sin datos
 * no desaparece, dice que no hay nada. No lee la base ni usa el cliente de
 * administración (AC-10): el cargador (`cargar.ts`) le pasa los datos.
 *
 *   1. ¿Dónde está tu carga?      → /portal/envios
 *   2. Lo que te toca hacer       → la pantalla de cada tarea
 *   3. Cuánto debes               → /portal/facturas
 *   4. Tus papeles                → /portal/documentos
 *   5. Envíale esto a tu proveedor → /portal/proveedores
 *   6. ¿Te quedó una duda?        → /portal/soporte
 */
import type { HiddenPortalStatusesStrict } from "@/lib/studio/notifications/portal-visibility-queries";
import {
  SERVICE_SHORT_LABELS,
  effectiveVisibleStatus,
  formatInvoiceAmount,
  type PortalAdvisor,
  type PortalDashboardKpis,
  type PortalDocument,
  type PortalNextArrival,
  type PortalShipmentRow,
  type ProfileCompleteness,
} from "@/lib/portal/portal-types";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";
import { SHIPMENT_DOC_TYPE_OPTIONS } from "@/lib/studio/shipment-document-types";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import { ETAPAS_RUTA, FRASE_ESTADO } from "./contenido/estados";

export type IdBloque = "donde" | "tareas" | "saldo" | "papeles" | "proveedor" | "duda";

/** El orden fijo de los bloques. No se reordena ni se acorta. */
export const ORDEN_BLOQUES: readonly IdBloque[] = Object.freeze([
  "donde",
  "tareas",
  "saldo",
  "papeles",
  "proveedor",
  "duda",
]);

export const ENLACE_PRO: Readonly<Record<IdBloque, { href: string; texto: string }>> = Object.freeze({
  donde: { href: "/portal/envios", texto: "Ver todos mis envíos en la Vista Pro" },
  tareas: { href: "/portal/perfil", texto: "Ver mi perfil en la Vista Pro" },
  saldo: { href: "/portal/facturas", texto: "Ver mis facturas en la Vista Pro" },
  papeles: { href: "/portal/documentos", texto: "Ver todos mis papeles en la Vista Pro" },
  proveedor: { href: "/portal/proveedores", texto: "Ver mis compras en la Vista Pro" },
  duda: { href: "/portal/soporte", texto: "Ver mis conversaciones en la Vista Pro" },
});

export type DatosInicioSimple = {
  nombre: string;
  markbox: string;
  nextArrival: PortalNextArrival | null;
  shipments: readonly PortalShipmentRow[];
  ocultos: HiddenPortalStatusesStrict;
  kpis: PortalDashboardKpis;
  profile: ProfileCompleteness;
  /** Órdenes de compra por aceptar (código para el enlace). */
  pendingAcceptanceCodes: readonly string[];
  /** null = módulo bloqueado hasta completar el perfil. */
  documentos: readonly PortalDocument[] | null;
  proveedores: readonly SupplierView[];
  asesor: PortalAdvisor | null;
  seguimientoEnConstruccion: boolean;
};

export type EtapaPintada = { id: string; nombre: string; estado: "hecha" | "actual" | "pendiente" };

export type BloqueDonde = {
  principal: {
    code: string;
    servicio: string;
    /** Frase del estado visible; null si no se pudo leer qué hitos están ocultos. */
    frase: string | null;
    /** Ruta de etapas; null si no se dibuja (en construcción, oculto ilegible o estado sin etapa). */
    ruta: EtapaPintada[] | null;
    etaIso: string | null;
  } | null;
  otros: { code: string; servicio: string; frase: string | null }[];
  /** Mostrar el aviso de seguimiento en construcción. */
  enConstruccion: boolean;
};

export type Tarea = { id: string; titulo: string; texto: string; href: string; accion: string };

export type BloqueSaldo =
  | { disponible: false }
  | {
      disponible: true;
      debe: boolean;
      monto: string;
      facturasPorPagar: number;
      variasMonedas: boolean;
    };

export type BloquePapeles =
  | { bloqueado: true }
  | { bloqueado: false; ultimos: { id: string; nombre: string; tipo: string; envio: string | null }[]; total: number };

export type ProveedorSimple = {
  id: string;
  numero: number;
  nombre: string;
  compras: number;
  codigo: string;
};

export type InicioSimple = {
  saludo: { nombre: string; markbox: string };
  donde: BloqueDonde;
  tareas: Tarea[];
  saldo: BloqueSaldo;
  papeles: BloquePapeles;
  proveedores: ProveedorSimple[];
  asesor: { nombre: string; cargo: string | null } | null;
};

/** Nombre de pila para el saludo: la primera palabra, sin forzar mayúsculas. */
export function nombreDePila(nombre: string): string {
  const primera = String(nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return primera;
}

function estadoVisible(
  status: ShipmentStatus,
  service: PortalShipmentRow["service"],
  ocultos: HiddenPortalStatusesStrict,
): ShipmentStatus | null {
  if (!ocultos.ok) return null;
  const visible = effectiveVisibleStatus(status, service, ocultos.ocultos);
  // `effectiveVisibleStatus` deja el mismo estado si no hay uno visible antes o
  // si está fuera del flujo: aquí eso no se nombra (FC-14).
  return ocultos.ocultos.has(visible) ? null : visible;
}

/**
 * La ruta de etapas. Solo se dibuja con el seguimiento encendido y con la
 * lectura estricta de ocultos bien: una etapa con todos sus estados ocultos no
 * aparece, y el estado actual es siempre el visible.
 */
export function armarRuta(
  visible: ShipmentStatus | null,
  ocultos: HiddenPortalStatusesStrict,
  enConstruccion: boolean,
): EtapaPintada[] | null {
  if (enConstruccion || !ocultos.ok || visible === null) return null;
  const etapas = ETAPAS_RUTA.filter((e) => e.estados.some((s) => !ocultos.ocultos.has(s)));
  const actual = etapas.findIndex((e) => e.estados.includes(visible));
  if (actual < 0) return null;
  return etapas.map((e, i) => ({
    id: e.id,
    nombre: e.nombre,
    estado: i < actual ? "hecha" : i === actual ? "actual" : "pendiente",
  }));
}

function armarDonde(d: DatosInicioSimple): BloqueDonde {
  const principal = d.nextArrival
    ? (() => {
        const visible = estadoVisible(d.nextArrival.status, d.nextArrival.service, d.ocultos);
        return {
          code: d.nextArrival.code,
          servicio: SERVICE_SHORT_LABELS[d.nextArrival.service] ?? "",
          frase: visible ? FRASE_ESTADO[visible] : null,
          ruta: armarRuta(visible, d.ocultos, d.seguimientoEnConstruccion),
          etaIso: d.nextArrival.etaIso,
        };
      })()
    : null;
  const otros = d.shipments
    .filter((s) => s.code !== principal?.code && s.status !== "cancelled")
    .slice(0, 3)
    .map((s) => {
      const visible = estadoVisible(s.status, s.service, d.ocultos);
      return {
        code: s.code,
        servicio: SERVICE_SHORT_LABELS[s.service] ?? "",
        frase: visible ? FRASE_ESTADO[visible] : null,
      };
    });
  return { principal, otros, enConstruccion: d.seguimientoEnConstruccion };
}

function armarTareas(d: DatosInicioSimple): Tarea[] {
  const tareas: Tarea[] = [];
  for (const code of d.pendingAcceptanceCodes) {
    tareas.push({
      id: `aceptar-${code}`,
      titulo: "Acepta tu orden de compra",
      texto: `La orden ${code} espera tu aceptación para seguir.`,
      href: `/portal/facturas/${encodeURIComponent(code)}/aceptar`,
      accion: "Revisar y aceptar",
    });
  }
  if (!d.profile.complete) {
    const falta =
      !d.profile.hasPhoto && !d.profile.hasAddress
        ? "la foto de tu cédula o RIF y tu dirección de entrega"
        : !d.profile.hasPhoto
          ? "la foto de tu cédula o RIF"
          : "tu dirección de entrega";
    tareas.push({
      id: "perfil",
      titulo: "Completa tu perfil",
      texto: `Nos falta ${falta}. La pedimos antes de tu primera compra.`,
      href: "/portal/perfil",
      accion: "Completar mi perfil",
    });
  }
  if (d.kpis.invoicesAvailable && d.kpis.outstandingBalance > 0) {
    tareas.push({
      id: "pagar",
      titulo: "Paga tu saldo pendiente",
      texto: "Hazlo antes de que llegue tu carga para no retrasar la entrega.",
      href: "/portal/facturas",
      accion: "Ver cómo pagar",
    });
  }
  return tareas;
}

function armarSaldo(k: PortalDashboardKpis): BloqueSaldo {
  if (!k.invoicesAvailable) return { disponible: false };
  return {
    disponible: true,
    debe: k.outstandingBalance > 0,
    monto: formatInvoiceAmount(k.outstandingBalance, k.currency),
    facturasPorPagar: k.pendingInvoiceCount,
    variasMonedas: k.mixedCurrencies,
  };
}

const ETIQUETA_DOC = new Map(SHIPMENT_DOC_TYPE_OPTIONS.map((o) => [o.value, o.label]));

function armarPapeles(docs: readonly PortalDocument[] | null): BloquePapeles {
  if (docs === null) return { bloqueado: true };
  return {
    bloqueado: false,
    total: docs.length,
    ultimos: docs.slice(0, 3).map((doc) => ({
      id: doc.id,
      nombre: doc.fileName,
      tipo: ETIQUETA_DOC.get(doc.docType) ?? "Documento",
      envio: doc.shipmentCode,
    })),
  };
}

/** Solo proveedores que existen en la cuenta, con su próximo código (AC-14). */
export function armarProveedores(views: readonly SupplierView[]): ProveedorSimple[] {
  return views
    .filter((v) => Number.isInteger(v.supplierSeq) && v.supplierSeq >= 1 && Boolean(v.nextCode))
    .map((v) => ({
      id: v.id,
      numero: v.supplierSeq,
      nombre: v.name,
      compras: v.orderCount,
      codigo: v.nextCode,
    }))
    .sort((a, b) => a.numero - b.numero);
}

export function armarInicioSimple(d: DatosInicioSimple): InicioSimple {
  return {
    saludo: { nombre: nombreDePila(d.nombre), markbox: d.markbox },
    donde: armarDonde(d),
    tareas: armarTareas(d),
    saldo: armarSaldo(d.kpis),
    papeles: armarPapeles(d.documentos),
    proveedores: armarProveedores(d.proveedores),
    asesor: d.asesor ? { nombre: d.asesor.name, cargo: d.asesor.positionLabel } : null,
  };
}

/**
 * Las partes del código de una compra, para explicarlas una por una:
 * `DTD-{cliente}-{proveedor}-{compra}` (`buildPrealertaCode`).
 */
export type PartesCodigo = { prefijo: string; cliente: string; proveedor: string; compra: string };

export function partesCodigo(codigo: string): PartesCodigo | null {
  const m = /^([A-Z]+)-(\d+)-(\d+)-(\d+)$/.exec(String(codigo ?? "").trim());
  if (!m) return null;
  return { prefijo: m[1], cliente: m[2], proveedor: m[3], compra: m[4] };
}
