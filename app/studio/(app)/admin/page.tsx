/**
 * Hub de Administración del Studio (SDD-0020 Fase 2A).
 *
 * Grid de cards de configuración. V1: solo "Agentes y Skills" es clickable
 * (SDD-0020). Las 11 cards restantes son placeholders disabled con tag
 * "Próximamente" — se irán habilitando en SDDs futuros (0021 cron/eventos,
 * 0024 usuarios, 0026 mailing, 0030 configuración general, etc.).
 *
 * Patrón visual: cards estilo dashboard, eyebrow + título + descripción
 * + chip de status. Active card tiene border wine, disabled tiene border
 * dashed neutral.
 */

import Link from "next/link";
import { Icon, type IconName } from "@/app/studio/_components/icons";

export const metadata = { title: "Administración" };

type AdminCard = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  href?: string;
  sdd?: string;
};

const ACTIVE_CARDS: AdminCard[] = [
  {
    id: "agentes",
    label: "Agentes y Skills",
    description:
      "Catálogo de skills, agentes instalados, runs y audit trail.",
    icon: "spark",
    href: "/studio/admin/agentes",
    sdd: "SDD-0020",
  },
];

const PLACEHOLDER_CARDS: AdminCard[] = [
  {
    id: "usuarios",
    label: "Usuarios",
    description: "Invitaciones, roles asignados, 2FA y sesiones activas.",
    icon: "users",
    sdd: "SDD-0024",
  },
  {
    id: "roles",
    label: "Roles y permisos",
    description: "Roles por módulo, scope por almacén y permisos finos.",
    icon: "shield",
    sdd: "SDD-0024",
  },
  {
    id: "integraciones",
    label: "Integraciones",
    description: "WhatsApp Business, Anthropic, Supabase, SENIAT, Stripe.",
    icon: "link",
    sdd: "SDD-0021",
  },
  {
    id: "tenants",
    label: "Tenants",
    description: "Multi-empresa, switch de tenant y catálogo de organizaciones.",
    icon: "globe",
    sdd: "SDD-0030",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logo, colores y tono por tenant — overrides del Brand Book.",
    icon: "tag",
    sdd: "SDD-0030",
  },
  {
    id: "plantillas",
    label: "Plantillas",
    description: "Templates de correos, contratos, facturas y notas de débito.",
    icon: "doc",
    sdd: "SDD-0026",
  },
  {
    id: "notificaciones",
    label: "Notificaciones",
    description: "Reglas de alertas — embarques demorados, facturas vencidas.",
    icon: "bell",
    sdd: "SDD-0026",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    description: "Endpoints salientes para sincronizar con sistemas externos.",
    icon: "cog",
    sdd: "SDD-0021",
  },
  {
    id: "logs",
    label: "Logs y auditoría",
    description: "Audit log con drill-down por usuario, módulo y acción.",
    icon: "chart",
    sdd: "Sprint C",
  },
  {
    id: "backups",
    label: "Backups",
    description: "Snapshots periódicos y restore point-in-time del tenant.",
    icon: "download",
    sdd: "Backlog",
  },
  {
    id: "billing",
    label: "Facturación SaaS",
    description: "Plan, ciclo de pago, uso de API y métodos de cobro.",
    icon: "invoice",
    sdd: "Backlog",
  },
];

export default function AdminPage() {
  return (
    <div style={{ maxWidth: 1280 }}>
      <header style={{ marginBottom: 28 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine)" }}
        >
          Configuración · Studio
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 8px", color: "var(--ink)" }}
        >
          Administración
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "72ch",
          }}
        >
          Hub de configuración del Studio. La sección{" "}
          <strong style={{ color: "var(--ink)" }}>Agentes y Skills</strong> ya
          está disponible. El resto se va habilitando con SDDs futuros.
        </p>
      </header>

      {/* Disponibles */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Disponibles
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {ACTIVE_CARDS.map((card) => (
            <AdminCardActive key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* Próximamente */}
      <section>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 12, color: "var(--ink-mute)" }}
        >
          Próximamente
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {PLACEHOLDER_CARDS.map((card) => (
            <AdminCardPlaceholder key={card.id} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminCardActive({ card }: { card: AdminCard }) {
  if (!card.href) return null;
  return (
    <Link
      href={card.href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "20px 22px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--wine)",
        borderRadius: "var(--r-lg)",
        textDecoration: "none",
        color: "inherit",
        minHeight: 152,
        transition: "background var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--wine)", display: "inline-flex" }}>
          {Icon[card.icon]?.(22)}
        </span>
        {card.sdd && (
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.14em",
              color: "var(--wine)",
              textTransform: "uppercase",
            }}
          >
            {card.sdd}
          </span>
        )}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div
          className="studio-display"
          style={{ fontSize: 17, color: "var(--ink)", letterSpacing: "-0.01em" }}
        >
          {card.label}
        </div>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {card.description}
        </p>
      </div>
      <div
        style={{
          marginTop: "auto",
          font: "600 12px/1 var(--f-sans)",
          color: "var(--wine)",
        }}
      >
        Abrir →
      </div>
    </Link>
  );
}

function AdminCardPlaceholder({ card }: { card: AdminCard }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "20px 22px",
        background: "var(--bg-surface)",
        border: "2px dashed var(--border-strong)",
        borderRadius: "var(--r-lg)",
        minHeight: 152,
        opacity: 0.78,
      }}
      aria-disabled="true"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
          {Icon[card.icon]?.(22)}
        </span>
        {card.sdd && (
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.14em",
              color: "var(--ink-mute)",
              textTransform: "uppercase",
            }}
          >
            {card.sdd}
          </span>
        )}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div
          className="studio-display"
          style={{ fontSize: 17, color: "var(--ink-soft)", letterSpacing: "-0.01em" }}
        >
          {card.label}
        </div>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: 0,
          }}
        >
          {card.description}
        </p>
      </div>
      <div
        style={{
          marginTop: "auto",
          font: "600 11px/1 var(--f-sans)",
          color: "var(--ink-mute)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Próximamente
      </div>
    </div>
  );
}
