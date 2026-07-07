/**
 * /studio/admin/agentes/[skillSlug] · Detalle de skill (SDD-0020 Fase 2B)
 *
 * Server component. Carga la skill por slug y renderiza:
 *  - Header con back link, icon, categoría, nombre, descripción
 *  - Resumen (modelo default + trigger default + costo estimado)
 *  - Tools que usa
 *  - Footer con botón "Instalar skill" (disabled V1 — flujo real en Fase 2C)
 *
 * Si la skill no existe → notFound() (404).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSkillBySlug } from "@/lib/studio/agent-queries";
import { Icon, type IconName } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  formatCostUsd,
  modelLabel,
  modelBadgeTone,
  triggerLabel,
} from "@/lib/studio/agent-types";
import { InstallSkillButton } from "../_components/InstallSkillButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ skillSlug: string }>;
}) {
  const { skillSlug } = await params;
  const supabase = await createClient();
  const skill = await getSkillBySlug(supabase, skillSlug);
  return { title: skill ? `${skill.name} · Agentes` : "Skill no encontrada" };
}

const ICON_ALIASES: Record<string, IconName> = {
  mappin: "pin",
  map: "pin",
  pin: "pin",
  radar: "radar",
  spark: "spark",
  box: "box",
  truck: "truck",
  cn: "cn",
  chart: "chart",
  mail: "mail",
  doc: "doc",
  shield: "shield",
  tag: "tag",
  invoice: "invoice",
  warehouse: "warehouse",
};

function resolveIcon(iconKey: string | null | undefined): IconName {
  if (!iconKey) return "spark";
  return ICON_ALIASES[iconKey.toLowerCase()] ?? "spark";
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillSlug: string }>;
}) {
  const { skillSlug } = await params;
  const supabase = await createClient();
  const skill = await getSkillBySlug(supabase, skillSlug);

  if (!skill) notFound();

  const iconName = resolveIcon(skill.icon);

  return (
    <div style={{ maxWidth: 880 }}>
      {/* Back link */}
      <Link
        href="/studio/admin/agentes?tab=catalog"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "600 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          marginBottom: 18,
        }}
      >
        <span style={{ display: "inline-flex" }}>{Icon.arrowL(14)}</span>
        Volver al catálogo
      </Link>

      {/* Hero */}
      <header
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--wine-tint)",
            color: "var(--wine)",
            borderRadius: "var(--r-lg)",
          }}
        >
          {Icon[iconName]?.(32)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="studio-eyebrow"
            style={{ marginBottom: 8, color: "var(--wine)" }}
          >
            {skill.category} · v{skill.version}
          </div>
          <h1
            className="studio-display"
            style={{
              fontSize: 28,
              margin: "0 0 10px",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            {skill.name}
          </h1>
          <p
            style={{
              font: "400 14px/1.6 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "72ch",
            }}
          >
            {skill.description}
          </p>
        </div>
      </header>

      {/* Resumen: modelo / trigger / costo */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <SummaryCard label="Modelo default">
          <Badge tone={modelBadgeTone(skill.default_model)} size="md">
            {modelLabel(skill.default_model)}
          </Badge>
        </SummaryCard>
        <SummaryCard label="Trigger default">
          <span
            style={{ font: "500 14px/1 var(--f-sans)", color: "var(--ink)" }}
          >
            {triggerLabel(skill.default_trigger)}
          </span>
        </SummaryCard>
        <SummaryCard label="Costo estimado por run">
          <span
            style={{ font: "700 16px/1 var(--f-mono)", color: "var(--wine)" }}
          >
            {formatCostUsd(skill.cost_estimate_usd)}
          </span>
        </SummaryCard>
      </section>

      {/* Tools que usa */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Tools que usa
        </div>
        {skill.tools_required.length === 0 ? (
          <div
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              padding: "16px 18px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            Esta skill no requiere tools — solo razona sobre su input.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            {skill.tools_required.map((toolKey, idx) => (
              <li
                key={toolKey}
                style={{
                  padding: "12px 16px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--wine-tint)",
                    color: "var(--wine)",
                    borderRadius: "var(--r-sm)",
                    font: "700 11px/1 var(--f-mono)",
                  }}
                >
                  {idx + 1}
                </span>
                <code
                  style={{
                    font: "600 13px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {toolKey}
                </code>
                <Badge tone="neutral" size="sm">
                  read-only
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer: Install CTA */}
      <section
        style={{
          padding: "20px 22px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--wine)",
          borderRadius: "var(--r-lg)",
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
              marginBottom: 4,
            }}
          >
            Instalar esta skill en tu tenant
          </div>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Configura nombre, modelo y presupuesto mensual. El agente arranca
            en{" "}
            <strong style={{ color: "var(--ink)" }}>status &ldquo;Apagado&rdquo;</strong>{" "}
            — activalo desde la lista de instalados cuando quieras correrlo.
          </p>
        </div>
        <InstallSkillButton skill={skill} />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
