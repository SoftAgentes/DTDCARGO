/**
 * SkillCard · card del catálogo de skills (SDD-0020 Fase 2B).
 *
 * Server component puro. Renderiza una skill built-in con icon,
 * categoría, nombre, descripción, costo estimado por run y modelo
 * default. Link al detalle.
 *
 * El campo `icon` viene del DB como string (ej: "mapPin", "spark"),
 * lo resolvemos contra el icon set del Studio con fallback a "spark"
 * si no existe — evita romper el render si el seed usa un nombre que
 * todavía no agregamos a `icons.tsx`.
 */

import Link from "next/link";
import { Icon, type IconName } from "@/app/studio/_components/icons";
import {
  formatCostUsd,
  modelShortLabel,
  modelBadgeTone,
  type Skill,
} from "@/lib/studio/agent-types";
import { Badge } from "@/app/studio/_components/ui/Badge";

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
  const norm = iconKey.toLowerCase();
  return ICON_ALIASES[norm] ?? "spark";
}

export function SkillCard({ skill }: { skill: Skill }) {
  const iconName = resolveIcon(skill.icon);
  const toolCount = skill.tools_required.length;

  return (
    <Link
      href={`/studio/admin/agentes/${skill.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "20px 22px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderTop: "2px solid var(--wine-soft)",
        borderRadius: "var(--r-lg)",
        textDecoration: "none",
        color: "inherit",
        minHeight: 200,
        transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
      }}
    >
      {/* Header: icon + categoría */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--wine-tint)",
            color: "var(--wine)",
            borderRadius: "var(--r-md)",
          }}
        >
          {Icon[iconName]?.(20)}
        </span>
        <span
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            letterSpacing: "0.14em",
            color: "var(--ink-mute)",
            textTransform: "uppercase",
          }}
        >
          {skill.category}
        </span>
      </header>

      {/* Title + description */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div
          className="studio-display"
          style={{
            fontSize: 17,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {skill.name}
        </div>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            // Limitar a ~3 líneas para mantener altura consistente
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {skill.description}
        </p>
      </div>

      {/* Footer: model badge + tools + cost */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge tone={modelBadgeTone(skill.default_model)} size="sm">
            {modelShortLabel(skill.default_model)}
          </Badge>
          <span
            style={{
              font: "500 11.5px/1 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            {toolCount} {toolCount === 1 ? "tool" : "tools"}
          </span>
        </div>
        <div
          style={{
            font: "700 12px/1 var(--f-mono)",
            color: "var(--ink)",
          }}
          title="Costo estimado por run"
        >
          {formatCostUsd(skill.cost_estimate_usd)}
        </div>
      </footer>
    </Link>
  );
}
