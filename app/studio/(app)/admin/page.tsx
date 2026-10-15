/**
 * Administración · /studio/admin (refactor maestro-detalle)
 *
 * Layout sidenav 240px + content 1fr, alineado al handoff Claude Design
 * el Norte (docs/design/studio/_norte/erp/modules/admin.jsx).
 *
 * 13 secciones agrupadas en 3 niveles (BÁSICO / INTERMEDIO / PRO).
 * URL state via ?section= (server component, sin client JS).
 *
 * V1 acá: shell + placeholders informativos por sección. La única
 * sección con implementación real es "Agentes y Skills" (SDD-0020),
 * que linkea al módulo dedicado /admin/agentes.
 *
 * Las 12 secciones restantes irán implementándose en SDDs futuros
 * con su contenido real del handoff (forms de empresa, feature flags,
 * tabla de master data, etc.).
 */

import Link from "next/link";
import { Icon, type IconName } from "@/app/studio/_components/icons";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import { createClient } from "@/lib/db/server";
import { listContainerTypes } from "@/lib/studio/naviera/queries";
import type { ContainerType } from "@/lib/studio/naviera/types";
import { getCompanyData } from "@/lib/studio/company-queries";
import { CompanySection } from "./_components/CompanySection";
import { AppearanceSection } from "./_components/AppearanceSection";
import { NumberingSection } from "./_components/NumberingSection";
import { AuditLogSection } from "./_components/AuditLogSection";
import { MasterDataSection } from "./_components/MasterDataSection";
import { ExchangeRatesSection } from "./_components/ExchangeRatesSection";
import { CalendarSection } from "./_components/CalendarSection";
import { ApiIntegrationSection } from "./_components/ApiIntegrationSection";
import { WorkflowsSection } from "./_components/WorkflowsSection";
import { ImportExportSection } from "./_components/ImportExportSection";
import { CalculatorSection } from "./_components/calculator/CalculatorSection";
import { RecepcionAddonsSection } from "./_components/RecepcionAddonsSection";
import { listPrealertaAddonsConfig } from "@/lib/studio/prealertas/queries";
import { PortalBackfillSection } from "./_components/PortalBackfillSection";
import {
  listPortalInviteCandidates,
  getPortalAdoptionStats,
  listPortalColdInvitees,
  listPortalContactlessClients,
  type PortalInviteCandidate,
  type PortalAdoptionStats,
  type PortalColdInvitee,
  type PortalContactlessClient,
} from "@/lib/studio/client-queries";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { getNumberingOverview } from "@/lib/studio/numbering-queries";
import {
  listGovernedAuditEvents,
  parseAuditFilters,
  type AuditSearchParams,
} from "@/lib/studio/audit-queries";
import { getExchangeRatesOverview } from "@/lib/studio/exchange-rates-queries";
import { getOperationalCalendar } from "@/lib/studio/op-calendar-queries";
import { getApiIntegration } from "@/lib/studio/api-integration-queries";
import { getCalculatorSettings } from "@/lib/studio/calculator-settings-queries";
import { listCalculatorCities } from "@/lib/studio/calculator-cities-queries";
import {
  listAllTariffs,
  listFreightCarriers,
} from "@/lib/studio/freight-carriers/queries";
import {
  listLegalDocs,
  listAcceptances,
  legalOverview,
} from "@/lib/studio/legal/queries";
import { LEGAL_GATE_HARD_BLOCK } from "@/lib/studio/legal/gate-config";
import type { LegalAcceptance, LegalDoc } from "@/lib/studio/legal/types";
import {
  LegalDocsRepo,
  LegalAcceptancesLog,
} from "../legal/_components/LegalClient";
import type { CompanyData } from "@/lib/studio/company-types";
import type { NumberingOverview } from "@/lib/studio/numbering-types";
import type {
  AuditListFilters,
  AuditListResult,
} from "@/lib/studio/audit-types";
import type { ExchangeRatesOverview } from "@/lib/studio/exchange-rates-types";
import type { CalendarEvent } from "@/lib/studio/op-calendar-types";
import type { ApiIntegrationData } from "@/lib/studio/api-integration-types";
import type { CalculatorSettings } from "@/lib/studio/calculator-settings-types";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import type {
  CarrierTariff,
  FreightCarrier,
} from "@/lib/studio/freight-carriers/types";

export const metadata = { title: "Administración" };

type SectionGroup = "BÁSICO" | "MARCA" | "INTERMEDIO" | "PRO";

/** Datos de las dos secciones legales (SDD-0054, parity Norte admin-legal). */
type LegalSectionData = {
  docs: LegalDoc[];
  acceptances: LegalAcceptance[];
  currentVersions: Record<string, string>;
  kpis: { total: number; thisMonth: number; onCurrent: number };
  gateHardBlock: boolean;
};

interface AdminSection {
  id: string;
  group: SectionGroup;
  label: string;
  icon: IconName;
  description: string;
  /** Si está definido, la sección es navegable a una ruta externa
   *  (módulo dedicado). Si no, renderiza placeholder informativo. */
  href?: string;
  /** SDD donde se implementará. Mostrado en el placeholder. */
  sddRef?: string;
}

const SECTIONS: AdminSection[] = [
  { id: "shipping-labels", group: "BÁSICO", label: "Edición de etiquetas", icon: "tag", description: "Vista previa e impresión por código, con presentación versionada.", href: "/studio/admin/etiquetas" },
  // ─── BÁSICO ──────────────────────────────────────────────
  {
    id: "company",
    group: "BÁSICO",
    label: "Datos de la empresa",
    icon: "shield",
    description:
      "Identificación fiscal (RIF, razón social), oficinas CN/VE, datos bancarios que aparecen en facturas, impuestos (IVA / ISLR / IGTF).",
    sddRef: "SDD-0120",
  },
  {
    id: "features",
    group: "BÁSICO",
    label: "Casos de uso · ON/OFF",
    icon: "flag",
    description:
      "Feature flags por módulo. Enciende/apaga WhatsApp Business, SENIAT, No-Olvidar, Mailing y otros sin tocar código.",
    href: "/studio/admin/feature-flags",
  },
  {
    id: "client-notifications",
    group: "BÁSICO",
    label: "Notificaciones al cliente",
    icon: "bell",
    description:
      "Avisos del viaje China→VE: por cada hito define canal (correo/push), cuándo (offset ± respecto al hito o al ETA) y si se muestra u oculta en el portal. Ej: aduana → ocultar “llegó” + disparar cobro anticipado. Override por cliente.",
    href: "/studio/admin/notificaciones",
    sddRef: "SDD-0156",
  },
  {
    id: "telegram-alerts",
    group: "BÁSICO",
    label: "Alertas de Telegram",
    icon: "bell",
    description:
      "A qué chat de Telegram llega cada aviso INTERNO (no al cliente: al equipo). Registro de clientes, conversaciones del portal, bugs, el reporte diario de operaciones y el resto de avisos, cada uno a su destino. Un chat se enlaza mandándole /start al bot.",
    href: "/studio/admin/alertas-telegram",
    sddRef: "SDD-0271",
  },
  {
    id: "masterdata",
    group: "BÁSICO",
    label: "Master data",
    icon: "tag",
    description:
      "Catálogos editables: segmentos de cliente, tiers, servicios (LCL/FCL), estados del workflow, tipos de documento, HS codes OMA, AES arancel VE.",
    sddRef: "SDD-0125",
  },
  {
    id: "rates",
    group: "BÁSICO",
    label: "Tasas de cambio",
    icon: "invoice",
    description:
      "BCV, paralelo y CNY. Historial diario y configuración de qué tasa usa cada flujo (facturación, costing, estado de cuenta).",
    sddRef: "SDD-0126",
  },
  {
    id: "fiscal",
    group: "BÁSICO",
    label: "Impuestos · IVA/SENIAT",
    icon: "shield",
    description:
      "Configuración fiscal: alícuotas IVA, retenciones ISLR/IGTF, contribuyente especial, resoluciones SENIAT. Vive en el módulo Fiscal · SENIAT.",
    href: "/studio/fiscal",
  },
  {
    id: "holidays",
    group: "BÁSICO",
    label: "Feriados CN/VE",
    icon: "clock",
    description:
      "Calendario operativo CN/VE: feriados (días no laborables) y ferias comerciales (Cantón/Yiwu). Afecta lead times y SLAs de despacho y almacén.",
    sddRef: "SDD-0127",
  },
  {
    id: "appearance",
    group: "BÁSICO",
    label: "Apariencia",
    icon: "sun",
    description:
      "Theme (light/dark), densidad (compact/normal/spacious), branding por tenant (logo, color de acento). Persistido por usuario.",
    sddRef: "SDD-0121",
  },
  {
    id: "routes",
    group: "BÁSICO",
    label: "Administrar rutas",
    icon: "truck",
    description:
      "Rutas CN→VE y ciudades de destino: alta/edición, ciudades cubiertas y su relación con tarifas y despacho. Módulo dedicado.",
    href: "/studio/admin/rutas",
  },
  // ─── MARCA ───────────────────────────────────────────────
  {
    id: "brand-system",
    group: "MARCA",
    label: "Sistema de marca",
    icon: "spark",
    description:
      "Tokens, tipografía, paleta y componentes de la identidad DTD Cargo. Fuente de verdad = el Norte (docs/design/studio/_norte) y el Brand Book vigente.",
  },
  {
    id: "brand-icons",
    group: "MARCA",
    label: "Íconos de perfil",
    icon: "users",
    description:
      "Set de avatares/íconos de perfil por rol y por persona. Los assets viven en el Norte (assets/profile-icons, assets/role-icons).",
  },
  {
    id: "brand-apps",
    group: "MARCA",
    label: "Aplicaciones de marca",
    icon: "tag",
    description:
      "Aplicaciones del logo y plantillas de marca (portadas de redes, colateral impreso, membrete, tarjeta). Catálogo en el Brand Book.",
  },
  {
    id: "brand-ads",
    group: "MARCA",
    label: "Publicidad activa",
    icon: "flame",
    description:
      "Estado de las campañas pagas (Google Ads) y piezas activas. Fuente de verdad del negocio = docs/marketing.",
  },
  {
    id: "brand-studio",
    group: "MARCA",
    label: "Estudio de Redes",
    icon: "radar",
    description:
      "Generador de piezas para redes (feed, stories, portadas) a partir de embarques y plantillas de marca. Relacionado con el módulo Marketing.",
  },
  // ─── INTERMEDIO ──────────────────────────────────────────
  {
    id: "permissions",
    group: "INTERMEDIO",
    label: "Permisos por rol",
    icon: "lock",
    description:
      "Se mudó a Usuarios y roles (SDD-0274). La matriz vive junto a la gente a la que le aplica, en vez de en otro módulo. Acá queda el atajo.",
    sddRef: "SDD-0252 → SDD-0274",
  },
  {
    id: "audit",
    group: "INTERMEDIO",
    label: "Audit log",
    icon: "eye",
    description:
      "Drill-down de quién hizo qué, cuándo y desde dónde. Filtros por usuario, módulo, acción y rango de fechas.",
    sddRef: "SDD-0123",
  },
  {
    id: "recepcion-addons",
    group: "INTERMEDIO",
    label: "Servicios de recepción",
    icon: "box",
    description:
      "Los 7 servicios que el cliente puede pedir sobre su compra al llegar a bodega (verificar, inspeccionar, reempacar, compactar, etiquetar, medir, retener). Prende/apaga cada uno y pega su video de ayuda de YouTube — sin tocar código.",
  },
  {
    id: "portal-invites",
    group: "INTERMEDIO",
    label: "Invitaciones al portal",
    icon: "users",
    description:
      "Adopción: invita por lotes al portal a los clientes sin acceso, reenvía el enlace a los invitados que nunca entraron, y captura correo/teléfono a los que no tienen contacto. Filtra, excluye demos y manda los correos en tandas. Envía correos reales.",
  },
  {
    id: "numbering",
    group: "INTERMEDIO",
    label: "Numeración & legal",
    icon: "doc",
    description:
      "Correlativos por documento (factura, nota de débito/crédito, control SENIAT) con prefijo y zero-padding configurables.",
    sddRef: "SDD-0122",
  },
  {
    id: "legal-docs",
    group: "INTERMEDIO",
    label: "Documentación legal",
    icon: "doc",
    description:
      "Repositorio versionado de los documentos que el cliente acepta al cotizar (Términos y Condiciones y Condiciones del Operador). Cada versión con su fecha de vigencia e historial de cambios.",
  },
  {
    id: "acceptances",
    group: "INTERMEDIO",
    label: "Aceptaciones T&C",
    icon: "shield",
    description:
      "Bitácora inmutable de qué versión de los documentos aceptó cada cliente, cuándo y desde dónde. Traza de consentimiento con valor probatorio.",
  },
  // ─── PRO ─────────────────────────────────────────────────
  {
    id: "api",
    group: "PRO",
    label: "API keys & webhooks",
    icon: "link",
    description:
      "Tokens para integrar con sistemas externos (CRM, BI, contabilidad). Webhooks salientes para sincronizar embarques / facturas / pagos.",
    sddRef: "SDD-0128",
  },
  {
    id: "workflows",
    group: "PRO",
    label: "Workflows custom",
    icon: "radar",
    description:
      "Reglas de automatización por tenant (cron, eventos, triggers). Disparan agents, mailing, alertas o cambios de estado.",
    sddRef: "SDD-0129",
  },
  {
    id: "import",
    group: "PRO",
    label: "Importar / Exportar",
    icon: "upload",
    description:
      "CSV/XLSX bulk: clientes, tarifas, embarques históricos. Export para BI o backup manual.",
    sddRef: "SDD-0130",
  },
  {
    id: "calculadora",
    group: "PRO",
    label: "Calculadora pública",
    icon: "calc",
    description:
      "Reglas del calculador de precios del sitio (LCL DDP): parámetros de peso y distancia + ciudades de destino. Config administrativa que se edita muy pocas veces. La tarifa base ($/CBM) sigue en el módulo Tarifas.",
  },
  {
    id: "agents",
    group: "PRO",
    label: "Agentes y Skills",
    icon: "spark",
    description:
      "Catálogo de skills built-in, agentes instalados por tenant, audit trail de runs y métricas de costo. Runtime con Anthropic SDK + tools read-only sobre el ERP. (No figura en el Norte; se conserva por ser feature LIVE — SDD-0020.)",
    sddRef: "SDD-0020",
    href: "/studio/admin/agentes",
  },
];

const GROUP_ORDER: SectionGroup[] = ["BÁSICO", "MARCA", "INTERMEDIO", "PRO"];

function isSection(s: string | undefined): s is string {
  return !!s && SECTIONS.some((sec) => sec.id === s);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  const role = await requireModuleView("admin");
  const sp = await searchParams;
  const sectionParam = Array.isArray(sp.section) ? sp.section[0] : sp.section;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const activeId: string = isSection(sectionParam) ? sectionParam : "company";
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
  const calcInitialTab =
    tabParam === "ciudades" || tabParam === "transportistas" ? tabParam : "parametros";
  const auditFilters = parseAuditFilters(sp);

  // Solo la sección "company" tiene implementación real (SDD-0120): fetch acá
  // para no pegarle a la DB en las secciones que aún son placeholder.
  let companyData: CompanyData | null = null;
  let numberingData: NumberingOverview | null = null;
  let auditResult: AuditListResult | null = null;
  let ratesData: ExchangeRatesOverview | null = null;
  let calendarEvents: CalendarEvent[] | null = null;
  let apiData: ApiIntegrationData | null = null;
  let importData: { calendar: CalendarEvent[]; company: CompanyData } | null = null;
  let legalData: LegalSectionData | null = null;
  let calcData: { settings: CalculatorSettings | null; cities: CalculatorCity[]; carriers: FreightCarrier[]; tariffs: CarrierTariff[] } | null = null;
  let addonsData: PrealertaAddon[] | null = null;
  let containerTypes: ContainerType[] | null = null;
  let inviteCandidates: PortalInviteCandidate[] | null = null;
  let adoptionStats: PortalAdoptionStats | null = null;
  let coldInvitees: PortalColdInvitee[] | null = null;
  let contactlessClients: PortalContactlessClient[] | null = null;
  if (active.id === "legal-docs" || active.id === "acceptances") {
    const supabase = await createClient();
    // RLS ya acota al tenant del admin logueado; listLegalDocs sin tenantId se
    // apoya en RLS (a diferencia del gate, que corre como service_role).
    const [docs, acceptances] = await Promise.all([
      listLegalDocs(supabase),
      listAcceptances(supabase),
    ]);
    const { currentVersions, kpis } = legalOverview(docs, acceptances);
    legalData = {
      docs,
      acceptances,
      currentVersions,
      kpis,
      gateHardBlock: LEGAL_GATE_HARD_BLOCK,
    };
  } else if (active.id === "company") {
    const supabase = await createClient();
    companyData = await getCompanyData(supabase);
  } else if (active.id === "numbering") {
    const supabase = await createClient();
    numberingData = await getNumberingOverview(supabase);
  } else if (active.id === "audit") {
    const supabase = await createClient();
    auditResult = canSpecial(role, "audit_view")
      ? await listGovernedAuditEvents(supabase, auditFilters)
      : { ok: false, events: [], code: "forbidden" };
  } else if (active.id === "rates") {
    const supabase = await createClient();
    ratesData = await getExchangeRatesOverview(supabase);
  } else if (active.id === "holidays") {
    const supabase = await createClient();
    calendarEvents = await getOperationalCalendar(supabase);
  } else if (active.id === "api") {
    const supabase = await createClient();
    apiData = await getApiIntegration(supabase);
  } else if (active.id === "import") {
    const supabase = await createClient();
    const [calendar, company] = await Promise.all([
      getOperationalCalendar(supabase),
      getCompanyData(supabase),
    ]);
    importData = { calendar, company };
  } else if (active.id === "calculadora") {
    const supabase = await createClient();
    const [settings, cities, carriers, tariffs] = await Promise.all([
      getCalculatorSettings(supabase),
      listCalculatorCities(supabase),
      listFreightCarriers(supabase),
      listAllTariffs(supabase),
    ]);
    calcData = { settings, cities, carriers, tariffs };
  } else if (active.id === "masterdata") {
    const supabase = await createClient();
    containerTypes = await listContainerTypes(supabase);
  } else if (active.id === "recepcion-addons") {
    const supabase = await createClient();
    addonsData = await listPrealertaAddonsConfig(supabase);
  } else if (active.id === "portal-invites") {
    const supabase = await createClient();
    [inviteCandidates, adoptionStats, coldInvitees, contactlessClients] =
      await Promise.all([
        listPortalInviteCandidates(supabase),
        getPortalAdoptionStats(supabase),
        listPortalColdInvitees(supabase),
        listPortalContactlessClients(supabase),
      ]);
  }

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: SECTIONS.filter((s) => s.group === g),
  }));

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="studio-eyebrow"
            style={{ marginBottom: 10, color: "var(--wine-text)" }}
          >
            Configuración · Studio
          </div>
          <h1
            className="studio-display"
            style={{
              fontSize: 28,
              margin: "0 0 6px",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Administración
          </h1>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            Configuración global del Studio. Solo accesible para rol Admin.
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "var(--wine-tint)",
            color: "var(--wine-text)",
            borderRadius: "var(--r-pill)",
            font: "700 11px/1 var(--f-sans)",
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--wine)",
            }}
          />
          Acceso restringido · Admin
        </span>
      </header>

      {/* Layout sidenav + content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0, 1fr)",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <SideNav grouped={grouped} activeId={activeId} />
        <Content
          section={active}
          companyData={companyData}
          numberingData={numberingData}
          auditResult={auditResult}
          auditFilters={auditFilters}
          ratesData={ratesData}
          calendarEvents={calendarEvents}
          apiData={apiData}
          importData={importData}
          legalData={legalData}
          calcData={calcData}
          calcInitialTab={calcInitialTab}
          addonsData={addonsData}
          containerTypes={containerTypes}
          inviteCandidates={inviteCandidates}
          adoptionStats={adoptionStats}
          coldInvitees={coldInvitees}
          contactlessClients={contactlessClients}
        />
      </div>
    </div>
  );
}

function SideNav({
  grouped,
  activeId,
}: {
  grouped: Array<{ group: SectionGroup; items: AdminSection[] }>;
  activeId: string;
}) {
  return (
    <nav
      aria-label="Secciones de Administración"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        position: "sticky",
        top: 16,
      }}
    >
      {grouped.map(({ group, items }) => (
        <div key={group}>
          <div
            style={{
              padding: "12px 14px 6px",
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {group}
          </div>
          {items.map((s) => {
            const isActive = s.id === activeId;
            return (
              <Link
                key={s.id}
                href={`/studio/admin?section=${s.id}`}
                aria-current={isActive ? "page" : undefined}
                className="studio-adminnav-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: isActive ? "var(--wine-tint)" : "transparent",
                  color: isActive ? "var(--wine)" : "var(--ink)",
                  font: `${isActive ? "700" : "500"} 13px/1 var(--f-sans)`,
                  textDecoration: "none",
                  position: "relative",
                }}
              >
                {isActive && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      background: "var(--wine)",
                      borderRadius: 2,
                    }}
                  />
                )}
                <span
                  style={{
                    color: isActive ? "var(--wine)" : "var(--ink-soft)",
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  {Icon[s.icon]?.(15)}
                </span>
                <span style={{ flex: 1 }}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Content({
  section,
  companyData,
  numberingData,
  auditResult,
  auditFilters,
  ratesData,
  calendarEvents,
  apiData,
  importData,
  legalData,
  calcData,
  calcInitialTab,
  addonsData,
  containerTypes,
  inviteCandidates,
  adoptionStats,
  coldInvitees,
  contactlessClients,
}: {
  section: AdminSection;
  companyData: CompanyData | null;
  numberingData: NumberingOverview | null;
  auditResult: AuditListResult | null;
  auditFilters: AuditListFilters;
  ratesData: ExchangeRatesOverview | null;
  calendarEvents: CalendarEvent[] | null;
  apiData: ApiIntegrationData | null;
  importData: { calendar: CalendarEvent[]; company: CompanyData } | null;
  legalData: LegalSectionData | null;
  calcData: { settings: CalculatorSettings | null; cities: CalculatorCity[]; carriers: FreightCarrier[]; tariffs: CarrierTariff[] } | null;
  calcInitialTab: "parametros" | "ciudades" | "transportistas";
  addonsData: PrealertaAddon[] | null;
  containerTypes: ContainerType[] | null;
  inviteCandidates: PortalInviteCandidate[] | null;
  adoptionStats: PortalAdoptionStats | null;
  coldInvitees: PortalColdInvitee[] | null;
  contactlessClients: PortalContactlessClient[] | null;
}) {
  return (
    <div key={section.id}>
      {/* Header del content */}
      <div style={{ marginBottom: 20 }}>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--wine-text)", marginBottom: 6 }}
        >
          {section.group}
        </div>
        <h2
          className="studio-display"
          style={{
            fontSize: 22,
            margin: "0 0 8px",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          {section.label}
        </h2>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "72ch",
          }}
        >
          {section.description}
        </p>
      </div>

      {section.id === "legal-docs" && legalData ? (
        <LegalDocsRepo
          docs={legalData.docs}
          acceptances={legalData.acceptances}
          gateHardBlock={legalData.gateHardBlock}
        />
      ) : section.id === "acceptances" && legalData ? (
        <LegalAcceptancesLog
          acceptances={legalData.acceptances}
          docs={legalData.docs}
          currentVersions={legalData.currentVersions}
          kpis={legalData.kpis}
        />
      ) : section.id === "company" && companyData ? (
        <CompanySection data={companyData} />
      ) : section.id === "appearance" ? (
        <AppearanceSection />
      ) : section.id === "numbering" && numberingData ? (
        <NumberingSection data={numberingData} />
      ) : section.id === "audit" && auditResult ? (
        <AuditLogSection
          result={auditResult}
          filters={auditFilters}
          governedViewerEnabled={process.env.AUDIT_GOVERNED_VIEWER !== "false"}
        />
      ) : section.id === "permissions" ? (
        <PermisosMudados />
      ) : section.id === "masterdata" ? (
        <MasterDataSection containerTypes={containerTypes} />
      ) : section.id === "rates" && ratesData ? (
        <ExchangeRatesSection data={ratesData} />
      ) : section.id === "holidays" && calendarEvents ? (
        <CalendarSection events={calendarEvents} />
      ) : section.id === "api" && apiData ? (
        <ApiIntegrationSection data={apiData} />
      ) : section.id === "workflows" ? (
        <WorkflowsSection />
      ) : section.id === "calculadora" && calcData ? (
        <CalculatorSection
          settings={calcData.settings}
          cities={calcData.cities}
          carriers={calcData.carriers}
          tariffs={calcData.tariffs}
          isAdmin
          initialTab={calcInitialTab}
        />
      ) : section.id === "recepcion-addons" && addonsData ? (
        <RecepcionAddonsSection addons={addonsData} />
      ) : section.id === "portal-invites" && inviteCandidates ? (
        <PortalBackfillSection
          candidates={inviteCandidates}
          stats={adoptionStats}
          coldInvitees={coldInvitees ?? []}
          contactlessClients={contactlessClients ?? []}
        />
      ) : section.id === "import" && importData ? (
        <ImportExportSection
          calendar={importData.calendar}
          offices={importData.company.offices}
          bankAccounts={importData.company.bankAccounts}
        />
      ) : section.href ? (
        <LinkedSectionCTA section={section} />
      ) : (
        <PendingSectionPanel section={section} />
      )}
    </div>
  );
}

function LinkedSectionCTA({ section }: { section: AdminSection }) {
  if (!section.href) return null;
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--wine)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 260 }}>
        <div
          className="studio-display"
          style={{
            fontSize: 16,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          Esta sección tiene su módulo dedicado
        </div>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {section.label} corre como módulo separado para mantener el área de
          configuración liviana.{" "}
          {section.sddRef && (
            <>
              Implementación cubierta por{" "}
              <strong style={{ color: "var(--ink)" }}>{section.sddRef}</strong>.
            </>
          )}
        </p>
      </div>
      <Link
        href={section.href}
        className="studio-btn studio-btn-primary studio-btn-sm"
      >
        Abrir {section.label} →
      </Link>
    </section>
  );
}

function PendingSectionPanel({ section }: { section: AdminSection }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "2px dashed var(--border-strong)",
        borderRadius: "var(--r-lg)",
        padding: "26px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Por implementar
        </div>
        {section.sddRef && (
          <span
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {section.sddRef}
          </span>
        )}
      </div>
      <div
        className="studio-display"
        style={{
          fontSize: 17,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        El shell está listo, falta el contenido.
      </div>
      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
          maxWidth: "62ch",
        }}
      >
        El diseño viene del Norte de diseño (sección{" "}
        <code style={{ font: "600 12px/1 var(--f-mono)" }}>
          {section.id}
        </code>{" "}
        en{" "}
        <code style={{ font: "600 12px/1 var(--f-mono)" }}>
          erp/modules/admin.jsx
        </code>
        ). Implementación queda para{" "}
        {section.sddRef ? (
          <strong style={{ color: "var(--ink)" }}>{section.sddRef}</strong>
        ) : (
          "el SDD correspondiente"
        )}
        .
      </p>
    </section>
  );
}

/**
 * SDD-0274 · la matriz de permisos se mudó a «Usuarios y roles».
 *
 * La sección se queda en Administración —quien la buscaba acá la sigue
 * encontrando— pero ya no renderiza una segunda copia editable: dos superficies
 * escribiendo la misma tabla es exactamente cómo se desincronizan.
 */
function PermisosMudados() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        alignItems: "flex-start",
      }}
    >
      <p style={{ font: "600 14px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
        Los permisos por rol se administran en Usuarios y roles
      </p>
      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
          maxWidth: "62ch",
        }}
      >
        La matriz quedó junto a la gente a la que le aplica, en la pestaña
        «Roles y permisos». Entra la misma gente que antes: los dos módulos son
        admin-only.
      </p>
      <a href="/studio/usuarios?tab=roles" className="studio-btn studio-btn-ghost studio-btn-sm">
        Ir a Roles y permisos
      </a>
    </div>
  );
}
