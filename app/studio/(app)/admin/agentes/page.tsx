/**
 * /studio/admin/agentes · SDD-0020 Fase 2B
 *
 * Página principal del módulo Agentes y Skills. Server component
 * con tabs URL-state (?tab=catalog|installed|runs).
 *
 *  - Catálogo: lista skills built-in del catálogo global
 *  - Instalados: agentes del tenant (V1 vacío hasta que exista UI de instalar)
 *  - Runs: historial de runs (V1 vacío hasta runtime — Fase 2D)
 *
 * Sin client state: tabs son <Link> con ?tab=, así no inflamos client JS
 * para algo que el SSR hace solo.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  computeAgentKpis,
  listAgentRuns,
  listAgents,
  listSkills,
} from "@/lib/studio/agent-queries";
import {
  agentStatusBadgeTone,
  agentStatusLabel,
  formatCostUsd,
  modelBadgeTone,
  modelShortLabel,
  type AgentRunWithAgent,
  type AgentWithSkill,
} from "@/lib/studio/agent-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { AgentKpisRow } from "./_components/AgentKpisRow";
import { AgentRowActions } from "./_components/AgentRowActions";
import { RunsTable } from "./_components/RunsTable";
import { SkillCard } from "./_components/SkillCard";

export const metadata = { title: "Agentes y Skills" };

type Tab = "catalog" | "installed" | "runs";

const TABS: { key: Tab; label: string }[] = [
  { key: "catalog", label: "Catálogo" },
  { key: "installed", label: "Instalados" },
  { key: "runs", label: "Runs" },
];

function isTab(s: string | undefined): s is Tab {
  return s === "catalog" || s === "installed" || s === "runs";
}

export default async function AgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const active: Tab = isTab(sp.tab) ? sp.tab : "catalog";

  const supabase = await createClient();
  const [skills, kpis, agents, runs] = await Promise.all([
    listSkills(supabase),
    computeAgentKpis(supabase),
    listAgents(supabase),
    listAgentRuns(supabase, { limit: 100 }),
  ]);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine-text)" }}
        >
          Administración · SDD-0020
        </div>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "0 0 8px",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Agentes y Skills
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "72ch",
          }}
        >
          Catálogo de skills built-in, agentes instalados por tenant, runs y
          audit trail. Runtime y ejecución llegan en{" "}
          <strong style={{ color: "var(--ink)" }}>Fase 2D</strong>.
        </p>
      </header>

      {/* KPIs */}
      <section style={{ marginBottom: 24 }}>
        <AgentKpisRow kpis={kpis} />
      </section>

      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Vistas de Agentes y Skills"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 22,
        }}
      >
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/studio/admin/agentes?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              style={{
                padding: "10px 14px",
                font: "600 13px/1 var(--f-sans)",
                color: isActive ? "var(--ink)" : "var(--ink-soft)",
                textDecoration: "none",
                borderBottom: isActive
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                marginBottom: -1,
                transition: "color var(--dur-fast) var(--ease)",
              }}
            >
              {t.label}
              <TabCount
                value={
                  t.key === "catalog"
                    ? skills.length
                    : t.key === "installed"
                      ? agents.length
                      : runs.length
                }
                active={isActive}
              />
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      {active === "catalog" && <CatalogContent skills={skills} />}
      {active === "installed" && <InstalledContent agents={agents} />}
      {active === "runs" && <RunsContent runs={runs} />}
    </div>
  );
}

function TabCount({ value, active }: { value: number; active: boolean }) {
  if (value === 0) return null;
  return (
    <span
      style={{
        marginLeft: 8,
        font: "700 10.5px/1 var(--f-sans)",
        color: active ? "var(--wine)" : "var(--ink-mute)",
      }}
    >
      {value}
    </span>
  );
}

function CatalogContent({ skills }: { skills: Awaited<ReturnType<typeof listSkills>> }) {
  if (skills.length === 0) {
    return (
      <EmptyState
        eyebrow="Catálogo vacío"
        title="No hay skills disponibles"
        description="El seed inicial no se aplicó o todas las skills están desactivadas. Verifica la migración 0015_agents.sql."
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 14,
      }}
    >
      {skills.map((s) => (
        <SkillCard key={s.id} skill={s} />
      ))}
    </div>
  );
}

function InstalledContent({ agents }: { agents: AgentWithSkill[] }) {
  if (agents.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin agentes instalados"
        title="Todavía no instalaste ninguna skill"
        description="Ve al catálogo, elige una skill y presiona 'Instalar'. Quedará en status apagado hasta que tú la actives."
        action={
          <Link
            href="/studio/admin/agentes?tab=catalog"
            className="studio-btn studio-btn-primary studio-btn-sm"
          >
            Ver catálogo →
          </Link>
        }
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          font: "500 13px/1.4 var(--f-sans)",
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Th>Agente</Th>
            <Th>Skill</Th>
            <Th>Estado</Th>
            <Th>Modelo</Th>
            <Th align="right">Gasto MTD</Th>
            <Th align="right">Budget</Th>
            <Th>Último run</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a, idx) => (
            <tr
              key={a.id}
              style={{
                borderTop:
                  idx === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <Td>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                    {a.name}
                  </span>
                  <span style={{ font: "500 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {a.slug}
                  </span>
                </div>
              </Td>
              <Td>
                <span style={{ color: "var(--ink-soft)" }}>{a.skill.name}</span>
              </Td>
              <Td>
                <Badge tone={agentStatusBadgeTone(a.status)} size="sm">
                  {agentStatusLabel(a.status)}
                </Badge>
              </Td>
              <Td>
                <Badge tone={modelBadgeTone(a.model)} size="sm">
                  {modelShortLabel(a.model)}
                </Badge>
              </Td>
              <Td align="right">
                <span style={{ font: "600 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                  {formatCostUsd(a.spend_usd_mtd)}
                </span>
              </Td>
              <Td align="right">
                <span style={{ font: "500 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                  {formatCostUsd(a.budget_usd_monthly)}
                </span>
              </Td>
              <Td>
                <span style={{ color: "var(--ink-soft)" }}>
                  {a.last_run_at
                    ? new Date(a.last_run_at).toLocaleString("es-VE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </Td>
              <Td align="right">
                <AgentRowActions
                  agentId={a.id}
                  agentName={a.name}
                  currentStatus={a.status}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        font: "700 10px/1 var(--f-sans)",
        color: "var(--ink-soft)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "12px 14px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function RunsContent({ runs }: { runs: AgentRunWithAgent[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin runs todavía"
        title="No hay ejecuciones registradas"
        description="Cada vez que un agente ejecute (manual, cron, webhook o evento), queda acá con tokens, costo, latencia, tools usadas y output. Activa un agente y ejecútalo desde Instalados para ver el primer run."
        action={
          <Link
            href="/studio/admin/agentes?tab=installed"
            className="studio-btn studio-btn-primary studio-btn-sm"
          >
            Ver agentes instalados →
          </Link>
        }
      />
    );
  }
  return <RunsTable runs={runs} />;
}
