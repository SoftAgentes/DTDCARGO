/**
 * Catálogo de secciones de Administración (SDD-0708).
 *
 * Dato puro: lo leen la página (`/studio/admin?section=`), el layout que pinta el
 * menú alrededor de `/studio/admin/*` y las pruebas. Sam eligió el 2026-11-22 la
 * opción B («el menú acompaña») con el orden por tema (R1) y sin los marcadores
 * de Marca (M-a).
 *
 * Reglas:
 * - El `id` es la llave de `?section=` en enlaces viejos: no se renombra nunca.
 * - Una sección con `href` no se pinta en `/studio/admin`: el menú enlaza directo
 *   ahí y `?section=<id>` redirige. Sin tarjeta puente.
 * - `external` marca lo que vive fuera de `/studio/admin` (sale del panel).
 * - `superadminOnly` esconde el ítem a quien no es superadministrador. La ruta y
 *   la base conservan su propio candado; esto es solo el menú.
 */
import type { IconName } from "@/app/studio/_components/icons";

export type AdminSectionGroup =
  | "Empresa"
  | "Operación"
  | "Clientes y portal"
  | "Equipo y seguridad"
  | "Integraciones"
  | "Inteligencia artificial";

export interface AdminSection {
  id: string;
  group: AdminSectionGroup;
  label: string;
  icon: IconName;
  description: string;
  /** Ruta real de la sección cuando no se pinta dentro de `/studio/admin`. */
  href?: string;
  /** La ruta vive fuera de `/studio/admin` (otro módulo del Studio). */
  external?: boolean;
  /** Solo la ve en el menú el superadministrador (`is_platform_admin`). */
  superadminOnly?: boolean;
}

export const ADMIN_GROUP_ORDER: readonly AdminSectionGroup[] = [
  "Empresa",
  "Operación",
  "Clientes y portal",
  "Equipo y seguridad",
  "Integraciones",
  "Inteligencia artificial",
];

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  // ─── Empresa ─────────────────────────────────────────────
  {
    id: "company",
    group: "Empresa",
    label: "Datos de la empresa",
    icon: "shield",
    description:
      "Identificación fiscal (RIF, razón social), oficinas CN/VE, datos bancarios que aparecen en facturas, impuestos (IVA / ISLR / IGTF).",
  },
  {
    id: "fiscal",
    group: "Empresa",
    label: "Impuestos · IVA/SENIAT",
    icon: "shield",
    description: "Alícuotas IVA, retenciones ISLR/IGTF, contribuyente especial y resoluciones SENIAT. Vive en el módulo Fiscal.",
    href: "/studio/fiscal",
    external: true,
  },
  {
    id: "rates",
    group: "Empresa",
    label: "Tasas de cambio",
    icon: "invoice",
    description:
      "Bolívares y yuanes: la tasa de cada día, con su fuente. Las facturas y las cuentas por pagar toman la vigente y la guardan.",
  },
  {
    id: "numbering",
    group: "Empresa",
    label: "Numeración de documentos",
    icon: "doc",
    description:
      "Correlativos por documento (factura, nota de débito/crédito, control SENIAT) con prefijo y zero-padding configurables.",
  },
  {
    id: "holidays",
    group: "Empresa",
    label: "Feriados CN/VE",
    icon: "clock",
    description:
      "Calendario operativo CN/VE: feriados (días no laborables) y ferias comerciales (Cantón/Yiwu). Afecta lead times y SLAs de despacho y almacén.",
  },
  // ─── Operación ───────────────────────────────────────────
  {
    id: "masterdata",
    group: "Operación",
    label: "Catálogos",
    icon: "tag",
    description:
      "Dónde vive cada catálogo: segmentos de cliente, tiers, servicios (LCL/FCL), estados del workflow, tipos de documento, HS codes y arancel.",
  },
  {
    id: "routes",
    group: "Operación",
    label: "Rutas y ciudades",
    icon: "truck",
    description: "Rutas CN→VE y ciudades de destino: alta, edición y su relación con tarifas y despacho.",
    href: "/studio/admin/rutas",
  },
  {
    id: "recepcion-addons",
    group: "Operación",
    label: "Servicios de recepción",
    icon: "box",
    description:
      "Los 7 servicios que el cliente puede pedir sobre su compra al llegar a bodega (verificar, inspeccionar, reempacar, compactar, etiquetar, medir, retener). Prende/apaga cada uno y pega su video de ayuda de YouTube — sin tocar código.",
  },
  {
    id: "shipping-labels",
    group: "Operación",
    label: "Edición de etiquetas",
    icon: "tag",
    description: "Vista previa e impresión por código, con presentación versionada.",
    href: "/studio/admin/etiquetas",
  },
  {
    id: "calculadora",
    group: "Operación",
    label: "Calculadora pública",
    icon: "calc",
    description:
      "Reglas del calculador de precios del sitio (LCL DDP): parámetros de peso y distancia + ciudades de destino. Config administrativa que se edita muy pocas veces. La tarifa base ($/CBM) sigue en el módulo Tarifas.",
  },
  // ─── Clientes y portal ───────────────────────────────────
  {
    id: "client-notifications",
    group: "Clientes y portal",
    label: "Notificaciones al cliente",
    icon: "bell",
    description: "Avisos del viaje China→VE: canal, cuándo y si se muestra en el portal, por hito.",
    href: "/studio/admin/notificaciones",
  },
  {
    id: "portal-invites",
    group: "Clientes y portal",
    label: "Invitaciones al portal",
    icon: "users",
    description:
      "Adopción: invita por lotes al portal a los clientes sin acceso, reenvía el enlace a los invitados que nunca entraron, y captura correo/teléfono a los que no tienen contacto. Filtra, excluye demos y manda los correos en tandas. Envía correos reales.",
  },
  {
    id: "legal-docs",
    group: "Clientes y portal",
    label: "Documentos legales",
    icon: "doc",
    description:
      "Repositorio versionado de los documentos que el cliente acepta al cotizar (Términos y Condiciones y Condiciones del Operador). Cada versión con su fecha de vigencia e historial de cambios.",
  },
  {
    id: "acceptances",
    group: "Clientes y portal",
    label: "Aceptaciones T&C",
    icon: "shield",
    description:
      "Bitácora inmutable de qué versión de los documentos aceptó cada cliente, cuándo y desde dónde. Traza de consentimiento con valor probatorio.",
  },
  // ─── Equipo y seguridad ──────────────────────────────────
  {
    id: "permissions",
    group: "Equipo y seguridad",
    label: "Permisos por rol",
    icon: "lock",
    description: "La matriz de permisos vive en Usuarios y roles (SDD-0274).",
    href: "/studio/usuarios?tab=roles",
    external: true,
  },
  {
    id: "telegram-alerts",
    group: "Equipo y seguridad",
    label: "Alertas del equipo",
    icon: "bell",
    description: "A qué canal de Discord llega cada aviso interno del equipo.",
    href: "/studio/admin/alertas-telegram",
  },
  {
    id: "audit",
    group: "Equipo y seguridad",
    label: "Registro de actividad",
    icon: "eye",
    description:
      "Quién hizo qué, cuándo y desde dónde. Filtros por usuario, módulo, acción y rango de fechas.",
  },
  {
    id: "appearance",
    group: "Equipo y seguridad",
    label: "Apariencia",
    icon: "sun",
    description:
      "Tema (claro/oscuro) y densidad de tu sesión, más la paleta de marca de referencia. Se guarda por usuario.",
  },
  // ─── Integraciones ───────────────────────────────────────
  {
    id: "features",
    group: "Integraciones",
    label: "Casos de uso · ON/OFF",
    icon: "flag",
    description: "Enciende y apaga funciones por módulo sin tocar código.",
    href: "/studio/admin/feature-flags",
  },
  {
    id: "api",
    group: "Integraciones",
    label: "API y webhooks",
    icon: "link",
    description:
      "Tokens para integrar con sistemas externos (CRM, BI, contabilidad). Webhooks salientes para sincronizar embarques / facturas / pagos.",
  },
  {
    id: "workflows",
    group: "Integraciones",
    label: "Flujos automáticos",
    icon: "radar",
    description: "El editor de flujos vive en Servicios, pestaña Flujo (SDD-0091).",
    href: "/studio/servicios",
    external: true,
  },
  {
    id: "import",
    group: "Integraciones",
    label: "Importar / Exportar",
    icon: "upload",
    description: "Export CSV de los catálogos de Administración. La carga masiva llega en su propia spec.",
  },
  {
    id: "chatwoot-updates",
    group: "Integraciones",
    label: "Actualizaciones de Chatwoot",
    icon: "refresh",
    description: "Versión instalada de la Bandeja, la publicada y qué trae cada una.",
    href: "/studio/admin/actualizaciones",
  },
  // ─── Inteligencia artificial ─────────────────────────────
  {
    id: "ia",
    group: "Inteligencia artificial",
    label: "IA",
    icon: "spark",
    description: "Gasto del mes, tope de la Oficina_Virtual y lo que cobra cada cuenta de IA.",
    href: "/studio/admin/ia",
    superadminOnly: true,
  },
  {
    id: "agents",
    group: "Inteligencia artificial",
    label: "Agentes y Skills",
    icon: "spark",
    description: "Catálogo de skills, agentes instalados, runs y costo.",
    href: "/studio/admin/agentes",
  },
  {
    id: "oficina-virtual",
    group: "Inteligencia artificial",
    label: "Oficina Virtual",
    icon: "chat",
    description: "Revisión de borradores de la Oficina_Virtual.",
    href: "/studio/admin/oficina-virtual",
    superadminOnly: true,
  },
];

export const DEFAULT_ADMIN_SECTION = "company";

export function findAdminSection(id: string | undefined | null): AdminSection | undefined {
  return id ? ADMIN_SECTIONS.find((s) => s.id === id) : undefined;
}

/** Destino del ítem del menú: la ruta real o la sección en línea. */
export function adminSectionHref(section: AdminSection): string {
  return section.href ?? `/studio/admin?section=${section.id}`;
}

/** Secciones visibles en el menú, agrupadas en el orden de Sam. */
export function groupedAdminSections(isSuperadmin: boolean) {
  return ADMIN_GROUP_ORDER.map((group) => ({
    group,
    items: ADMIN_SECTIONS.filter(
      (s) => s.group === group && (isSuperadmin || !s.superadminOnly),
    ),
  })).filter((g) => g.items.length > 0);
}

/**
 * Qué ítem marcar como activo. En `/studio/admin` manda `?section=`; en una
 * subruta, la sección cuyo `href` es el prefijo más largo de la ruta.
 */
export function activeAdminSectionId(pathname: string, sectionParam: string | null): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/studio/admin") {
    const s = findAdminSection(sectionParam);
    return s && !s.href ? s.id : DEFAULT_ADMIN_SECTION;
  }
  let best: AdminSection | null = null;
  for (const s of ADMIN_SECTIONS) {
    if (!s.href || s.external) continue;
    if (path === s.href || path.startsWith(`${s.href}/`)) {
      if (!best || s.href.length > (best.href?.length ?? 0)) best = s;
    }
  }
  return best?.id ?? null;
}
