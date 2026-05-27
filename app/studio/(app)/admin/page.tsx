/**
 * Administración · /studio/admin (refactor maestro-detalle)
 *
 * Layout sidenav 240px + content 1fr, alineado al handoff Claude Design
 * v1.3.1 (docs/design/studio/v1.3.1-claude-design/proyecto/erp/modules/admin.jsx).
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

export const metadata = { title: "Administración" };

type SectionGroup = "BÁSICO" | "INTERMEDIO" | "PRO";

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
  // ─── BÁSICO ──────────────────────────────────────────────
  {
    id: "company",
    group: "BÁSICO",
    label: "Datos de la empresa",
    icon: "shield",
    description:
      "Identificación fiscal (RIF, razón social), oficinas CN/VE, datos bancarios que aparecen en facturas, impuestos (IVA / ISLR / IGTF).",
    sddRef: "SDD-0030",
  },
  {
    id: "features",
    group: "BÁSICO",
    label: "Casos de uso · ON/OFF",
    icon: "flag",
    description:
      "Feature flags por módulo. Encendé/apagá WhatsApp Business, SENIAT, No-Olvidar, Mailing y otros sin tocar código.",
    href: "/studio/admin/feature-flags",
  },
  {
    id: "masterdata",
    group: "BÁSICO",
    label: "Master data",
    icon: "tag",
    description:
      "Catálogos editables: segmentos de cliente, tiers, servicios (LCL/FCL), estados del workflow, tipos de documento, HS codes OMA, AES arancel VE.",
    sddRef: "SDD-0030",
  },
  {
    id: "rates",
    group: "BÁSICO",
    label: "Tasas de cambio",
    icon: "invoice",
    description:
      "BCV, paralelo y CNY. Historial diario y configuración de qué tasa usa cada flujo (facturación, costing, estado de cuenta).",
    sddRef: "SDD-0030",
  },
  {
    id: "holidays",
    group: "BÁSICO",
    label: "Feriados CN/VE",
    icon: "clock",
    description:
      "Calendario de feriados de ambos países usado por TMS, almacén y SLAs. Sincronizado con el calendario operativo.",
    sddRef: "SDD-0030",
  },
  {
    id: "appearance",
    group: "BÁSICO",
    label: "Apariencia",
    icon: "sun",
    description:
      "Theme (light/dark), densidad (compact/normal/spacious), branding por tenant (logo, color de acento). Persistido por usuario.",
    sddRef: "SDD-0030",
  },
  // ─── INTERMEDIO ──────────────────────────────────────────
  {
    id: "permissions",
    group: "INTERMEDIO",
    label: "Permisos por rol",
    icon: "lock",
    description:
      "Roles del tenant (Admin, Comercial, Operaciones, Bodega) con scope por módulo y por almacén. Granularidad de read/write/approve.",
    sddRef: "SDD-0024",
  },
  {
    id: "audit",
    group: "INTERMEDIO",
    label: "Audit log",
    icon: "eye",
    description:
      "Drill-down de quién hizo qué, cuándo y desde dónde. Filtros por usuario, módulo, acción y rango de fechas.",
    sddRef: "Sprint C",
  },
  {
    id: "numbering",
    group: "INTERMEDIO",
    label: "Numeración & legal",
    icon: "doc",
    description:
      "Correlativos por documento (factura, nota de débito/crédito, control SENIAT) con prefijo y zero-padding configurables.",
    sddRef: "SDD-0030",
  },
  // ─── PRO ─────────────────────────────────────────────────
  {
    id: "agents",
    group: "PRO",
    label: "Agentes y Skills",
    icon: "spark",
    description:
      "Catálogo de skills built-in, agentes instalados por tenant, audit trail de runs y métricas de costo. Runtime con Anthropic SDK + tools read-only sobre el ERP.",
    sddRef: "SDD-0020",
    href: "/studio/admin/agentes",
  },
  {
    id: "api",
    group: "PRO",
    label: "API keys & webhooks",
    icon: "link",
    description:
      "Tokens para integrar con sistemas externos (CRM, BI, contabilidad). Webhooks salientes para sincronizar embarques / facturas / pagos.",
    sddRef: "SDD-0021",
  },
  {
    id: "workflows",
    group: "PRO",
    label: "Workflows custom",
    icon: "radar",
    description:
      "Reglas de automatización por tenant (cron, eventos, triggers). Disparan agents, mailing, alertas o cambios de estado.",
    sddRef: "SDD-0021",
  },
  {
    id: "import",
    group: "PRO",
    label: "Importar / Exportar",
    icon: "upload",
    description:
      "CSV/XLSX bulk: clientes, tarifas, embarques históricos. Export para BI o backup manual.",
    sddRef: "Backlog",
  },
];

const GROUP_ORDER: SectionGroup[] = ["BÁSICO", "INTERMEDIO", "PRO"];

function isSection(s: string | undefined): s is string {
  return !!s && SECTIONS.some((sec) => sec.id === s);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const sp = await searchParams;
  const activeId: string = isSection(sp.section) ? sp.section : "company";
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

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
            style={{ marginBottom: 10, color: "var(--wine)" }}
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
            color: "var(--wine)",
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
        <Content section={active} />
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
              color: "var(--ink-mute)",
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

function Content({ section }: { section: AdminSection }) {
  return (
    <div key={section.id}>
      {/* Header del content */}
      <div style={{ marginBottom: 20 }}>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--wine)", marginBottom: 6 }}
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

      {section.href ? (
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
            color: "var(--wine)",
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
              color: "var(--ink-mute)",
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
        El diseño viene del handoff Claude Design v1.3.1 (sección{" "}
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
