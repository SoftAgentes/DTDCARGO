"use client";

/**
 * Orquestador client de Fidelización & Referidos (SDD-0051, Slice B).
 *
 * Header + 4 tabs in-memory (React state) calcando el Norte
 * (erp/modules/fidelizacion.jsx) con las primitivas reales del repo:
 *
 *   - Dashboard  · 4 KPI + distribución por nivel + top referidores + "cómo funciona".
 *   - Niveles    · cards de los 4 TIERS con beneficios + count de clientes.
 *   - Referidos  · toolbar (filtro estado) + tabla + drawer con timeline + acreditar.
 *   - Clientes   · tabla con tier + facturado + progreso al siguiente + créditos + nº referidos.
 *
 * Solo primitivas del sistema (KpiCard/Badge/EmptyState/DrawerShell) + tokens
 * var(--*). El motor de niveles es DERIVADO (no toca client.tier manual).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Icon } from "@/app/studio/_components/icons";
import {
  REFERRAL_RULES,
  REFERRAL_STATUS,
  REFERRAL_STEPS,
  TIERS,
  referralShareCode,
  tierProgress,
  type Referral,
  type ReferralStatus,
  type Tier,
} from "@/lib/studio/fidelizacion/types";
import type {
  ClientWithTier,
  ProgramStats,
  TierCount,
  TopReferrer,
} from "@/lib/studio/fidelizacion/queries";
import { fmtUsd } from "../format";
import { RegisterReferralDrawer } from "./RegisterReferralDrawer";
import { ReferralDrawer } from "./ReferralDrawer";

type Tab = "dashboard" | "niveles" | "referidos" | "clientes";

const TABS: { value: Tab; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "niveles", label: "Niveles" },
  { value: "referidos", label: "Referidos" },
  { value: "clientes", label: "Clientes" },
];

/** Color sólido del tono de un nivel (para barras/acentos). */
function tierColor(tone: BadgeTone): string {
  switch (tone) {
    case "wine":
      return "var(--wine)";
    case "warning":
      return "var(--warning)";
    case "info":
      return "var(--info)";
    case "success":
      return "var(--success)";
    case "danger":
      return "var(--danger)";
    default:
      return "var(--ink-mute)";
  }
}

export function FidelizacionClient({
  clients,
  tierCounts,
  referrals,
  stats,
  topReferrers,
}: {
  clients: ClientWithTier[];
  tierCounts: TierCount[];
  referrals: Referral[];
  stats: ProgramStats;
  topReferrers: TopReferrer[];
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showRegister, setShowRegister] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(
    null,
  );

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Comercial · Lealtad</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Fidelización & Referidos.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Construyendo confianza cliente a cliente, contenedor a contenedor.
            Niveles derivados de la facturación real + programa de referidos con
            créditos.
          </p>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setShowRegister(true)}
        >
          + Registrar referido
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          const count =
            tDef.value === "referidos" && referrals.length > 0
              ? referrals.length
              : null;
          return (
            <button
              key={tDef.value}
              type="button"
              onClick={() => setTab(tDef.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: active
                  ? "700 13px/1 var(--f-sans)"
                  : "500 13px/1 var(--f-sans)",
                cursor: "pointer",
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {tDef.label}
              {count != null && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9,
                    background: "var(--bg-elevated)",
                    color: "var(--ink-soft)",
                    font: "700 10px/1 var(--f-mono)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <DashboardTab
          tierCounts={tierCounts}
          stats={stats}
          topReferrers={topReferrers}
          onGoReferidos={() => setTab("referidos")}
          onGoNiveles={() => setTab("niveles")}
        />
      )}
      {tab === "niveles" && <NivelesTab tierCounts={tierCounts} />}
      {tab === "referidos" && (
        <ReferidosTab
          referrals={referrals}
          onNew={() => setShowRegister(true)}
          onSelect={setSelectedReferral}
        />
      )}
      {tab === "clientes" && (
        <ClientesTab clients={clients} referrals={referrals} />
      )}

      {/* Drawers */}
      {showRegister && (
        <RegisterReferralDrawer onClose={() => setShowRegister(false)} />
      )}
      {selectedReferral && (
        <ReferralDrawer
          referral={selectedReferral}
          onClose={() => setSelectedReferral(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Dashboard
// ════════════════════════════════════════════════════════════════

const PROGRAM_STEPS = [
  {
    n: "1",
    t: "El cliente comparte su código",
    d: "Cada Shipping Mark tiene un código de referido único (ej. REF-5452) que comparte por WhatsApp o el portal.",
  },
  {
    n: "2",
    t: "El referido importa",
    d: `Al registrarse y hacer su primer embarque, el referido recibe ${fmtUsd(REFERRAL_RULES.referredReward)} de descuento.`,
  },
  {
    n: "3",
    t: "Ambos ganan",
    d: `Quien refiere recibe ${fmtUsd(REFERRAL_RULES.referrerReward)} de crédito para aplicar en su próxima factura.`,
  },
];

function DashboardTab({
  tierCounts,
  stats,
  topReferrers,
  onGoReferidos,
  onGoNiveles,
}: {
  tierCounts: TierCount[];
  stats: ProgramStats;
  topReferrers: TopReferrer[];
  onGoReferidos: () => void;
  onGoNiveles: () => void;
}) {
  const totalClients = tierCounts.reduce((s, c) => s + c.count, 0);
  const platinum = tierCounts.find((c) => c.tier.id === "platinum")?.count ?? 0;
  const gold = tierCounts.find((c) => c.tier.id === "gold")?.count ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          value={totalClients}
          label="Clientes activos"
          sub={`${platinum} Platinum · ${gold} Gold`}
        />
        <KpiCard
          value={stats.activos}
          label="Referidos activos"
          valueColor={stats.activos > 0 ? "var(--info)" : "var(--ink)"}
          sub={`${stats.total} en el programa`}
        />
        <KpiCard
          value={fmtUsd(stats.creditsIssued)}
          label="Créditos emitidos"
          valueColor={stats.creditsIssued > 0 ? "var(--success)" : "var(--ink)"}
          sub={`${stats.acreditados} acreditados`}
        />
        <KpiCard
          value={`${stats.convRate.toFixed(0)}%`}
          label="Tasa de conversión"
          valueColor={stats.convRate > 0 ? "var(--warning)" : "var(--ink)"}
          sub="referido → acreditado"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        {/* Distribución por nivel */}
        <Card>
          <div style={{ padding: "18px 20px" }}>
            <div className="studio-eyebrow" style={{ marginBottom: 16 }}>
              Distribución por nivel
            </div>
            {totalClients === 0 ? (
              <p
                style={{
                  font: "500 12.5px/1.5 var(--f-sans)",
                  color: "var(--ink-mute)",
                  margin: 0,
                }}
              >
                Todavía no hay facturación que clasifique clientes en niveles.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {tierCounts.map(({ tier, count }) => {
                  const pct = totalClients ? (count / totalClients) * 100 : 0;
                  const color = tierColor(tier.tone);
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={onGoNiveles}
                      style={{
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              background: color,
                            }}
                          />
                          <span
                            style={{
                              font: "700 13px/1 var(--f-sans)",
                              color: "var(--ink)",
                            }}
                          >
                            {tier.label}
                          </span>
                        </div>
                        <span
                          style={{
                            font: "800 13px/1 var(--f-mono)",
                            color: "var(--ink)",
                          }}
                        >
                          {count}
                        </span>
                      </div>
                      <ProgressBar pct={pct} color={color} height={8} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Top referidores */}
        <Card>
          <div
            style={{
              padding: "16px 20px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="studio-eyebrow">Embajadores · Top referidores</div>
            <button
              type="button"
              onClick={onGoReferidos}
              style={{
                font: "600 12px/1 var(--f-sans)",
                color: "var(--wine)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Ver todos {Icon.arrowR(11)}
            </button>
          </div>
          {topReferrers.length === 0 ? (
            <div
              style={{
                padding: "24px 20px",
                font: "500 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Sin referidores todavía. Registra el primer referido para empezar.
            </div>
          ) : (
            <div>
              {topReferrers.map((r, i) => (
                <div
                  key={r.markbox}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 20px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <span
                    style={{
                      font: "900 14px/1 var(--f-display)",
                      color: i === 0 ? "var(--wine)" : "var(--ink-mute)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <code
                      style={{
                        font: "700 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {r.markbox}
                    </code>
                    <div
                      style={{
                        font: "500 10.5px/1 var(--f-mono)",
                        color: "var(--wine)",
                        marginTop: 3,
                      }}
                    >
                      {referralShareCode(r.markbox)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        font: "800 13px/1 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {r.acreditados}
                      <span
                        style={{
                          font: "500 10px var(--f-sans)",
                          color: "var(--ink-mute)",
                        }}
                      >
                        /{r.total}
                      </span>
                    </div>
                    <div
                      style={{
                        font: "600 9.5px/1 var(--f-sans)",
                        color: r.credits > 0 ? "var(--success)" : "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {fmtUsd(r.credits)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Cómo funciona */}
      <Card>
        <div style={{ padding: "18px 20px" }}>
          <div className="studio-eyebrow" style={{ marginBottom: 16 }}>
            Cómo funciona el programa
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {PROGRAM_STEPS.map((s) => (
              <div
                key={s.n}
                style={{
                  padding: "16px 18px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--wine)",
                    color: "var(--ink-inv)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "800 13px/1 var(--f-display)",
                    marginBottom: 10,
                  }}
                >
                  {s.n}
                </span>
                <div
                  style={{
                    font: "700 13px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    marginBottom: 5,
                  }}
                >
                  {s.t}
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {s.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Niveles
// ════════════════════════════════════════════════════════════════

function NivelesTab({ tierCounts }: { tierCounts: TierCount[] }) {
  const countOf = (id: Tier["id"]) =>
    tierCounts.find((c) => c.tier.id === id)?.count ?? 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {TIERS.map((t, i) => {
        const count = countOf(t.id);
        const color = tierColor(t.tone);
        const next = TIERS[i + 1];
        return (
          <div
            key={t.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderTop: `3px solid ${color}`,
              borderRadius: "var(--r-lg)",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  font: "900 20px/1 var(--f-display)",
                  color,
                }}
              >
                {t.label}
              </span>
              <Badge tone={t.tone} size="sm">
                {count} {count === 1 ? "cliente" : "clientes"}
              </Badge>
            </div>
            <div
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginBottom: 14,
              }}
            >
              {t.min === 0 && next
                ? `Hasta ${fmtUsd(next.min)}`
                : `Desde ${fmtUsd(t.min)}`}{" "}
              <span style={{ color: "var(--ink-mute)" }}>
                · facturación anual
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {t.benefits.map((b) => (
                <div
                  key={b}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span style={{ color, flexShrink: 0, marginTop: 1 }}>
                    {Icon.check(13)}
                  </span>
                  <span
                    style={{
                      font: "500 12.5px/1.4 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Referidos
// ════════════════════════════════════════════════════════════════

const REFERRAL_GRID = "130px 130px 1fr 120px 110px";

function ReferidosTab({
  referrals,
  onNew,
  onSelect,
}: {
  referrals: Referral[];
  onNew: () => void;
  onSelect: (r: Referral) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "all">(
    "all",
  );

  const filtered = useMemo(
    () =>
      referrals.filter(
        (r) => statusFilter === "all" || r.status === statusFilter,
      ),
    [referrals, statusFilter],
  );

  if (referrals.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin referidos"
        title="Todavía no hay referidos en el programa."
        description="Registra un referido (quien refiere es un cliente existente; el referido aún no lo es). El crédito se acredita a mano cuando hace su primer embarque."
        action={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onNew}
          >
            + Registrar referido
          </button>
        }
      />
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <select
          className="studio-input"
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReferralStatus | "all")
          }
          style={{ minWidth: 200, maxWidth: 240 }}
        >
          <option value="all">Todos los estados</option>
          {REFERRAL_STEPS.map((s) => (
            <option key={s} value={s}>
              {REFERRAL_STATUS[s].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={onNew}
        >
          + Registrar referido
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          eyebrow="Sin coincidencias"
          title="Ningún referido con ese estado."
          description="Prueba con otro filtro o registra un referido nuevo."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: REFERRAL_GRID,
              gap: 14,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Referido</span>
            <span>Quien refiere</span>
            <span>Nuevo cliente</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Crédito</span>
          </div>
          {filtered.map((r, i) => {
            const stt = REFERRAL_STATUS[r.status];
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(r);
                  }
                }}
                className="studio-tracking-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: REFERRAL_GRID,
                  gap: 14,
                  padding: "14px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <code
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {r.referral_code}
                </code>
                <code
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--wine)",
                  }}
                >
                  {r.referrer_markbox}
                </code>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.referred_name}
                  </div>
                  {r.referred_company && (
                    <div
                      style={{
                        font: "500 10.5px/1.3 var(--f-sans)",
                        color: "var(--ink-mute)",
                        marginTop: 3,
                      }}
                    >
                      {r.referred_company}
                    </div>
                  )}
                </div>
                <span>
                  <Badge tone={stt.tone} size="sm" dot>
                    {stt.label}
                  </Badge>
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color:
                      r.status === "acreditado"
                        ? "var(--success)"
                        : "var(--ink-mute)",
                  }}
                >
                  {r.status === "acreditado" ? fmtUsd(r.reward_usd) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Clientes
// ════════════════════════════════════════════════════════════════

const CLIENT_GRID = "1fr 110px 130px 1.3fr 120px 90px";

function ClientesTab({
  clients,
  referrals,
}: {
  clients: ClientWithTier[];
  referrals: Referral[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Conteos por referidor (créditos acreditados + nº de referidos), in-memory.
  const byReferrer = useMemo(() => {
    const map = new Map<string, { credits: number; count: number }>();
    for (const r of referrals) {
      const m = map.get(r.referrer_markbox) ?? { credits: 0, count: 0 };
      m.count += 1;
      if (r.status === "acreditado") m.credits += r.reward_usd;
      map.set(r.referrer_markbox, m);
    }
    return map;
  }, [referrals]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q),
    );
  }, [clients, search]);

  if (clients.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin clientes"
        title="Todavía no hay clientes para clasificar."
        description="El nivel de lealtad se deriva de la facturación real de cada cliente (últimos 12 meses). Carga clientes y facturas para verlos acá."
      />
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <input
          className="studio-input"
          aria-label="Buscar cliente o Shipping Mark"
          placeholder="Buscar cliente o Shipping Mark…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: CLIENT_GRID,
            gap: 14,
            padding: "12px 20px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          <span>Cliente</span>
          <span>Nivel</span>
          <span style={{ textAlign: "right" }}>Facturado</span>
          <span>Progreso al siguiente</span>
          <span style={{ textAlign: "right" }}>Créditos</span>
          <span style={{ textAlign: "right" }}>Referidos</span>
        </div>
        {rows.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            Ningún cliente coincide con “{search}”.
          </div>
        ) : (
          rows.map((c, i) => {
            const prog = tierProgress(c.billedUsd);
            const agg = byReferrer.get(c.markbox);
            const credits = agg?.credits ?? 0;
            const refs = agg?.count ?? 0;
            const goToClient = () =>
              router.push(`/studio/clientes/${c.markbox}`);
            return (
              <div
                key={c.id || c.markbox}
                role="button"
                tabIndex={0}
                onClick={goToClient}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToClient();
                  }
                }}
                className="studio-tracking-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: CLIENT_GRID,
                  gap: 14,
                  padding: "14px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name || "—"}
                  </div>
                  <code
                    style={{
                      font: "500 10.5px/1 var(--f-mono)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {c.markbox}
                  </code>
                </div>
                <span>
                  <Badge tone={c.tier.tone} size="sm">
                    {c.tier.label}
                  </Badge>
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {fmtUsd(c.billedUsd)}
                </span>
                <div>
                  {prog.next ? (
                    <>
                      <ProgressBar
                        pct={prog.pct}
                        color={tierColor(prog.next.tone)}
                        height={6}
                      />
                      <div
                        style={{
                          font: "500 9.5px/1 var(--f-sans)",
                          color: "var(--ink-mute)",
                          marginTop: 4,
                        }}
                      >
                        {fmtUsd(prog.toNext)} para {prog.next.label}
                      </div>
                    </>
                  ) : (
                    <Badge tone="wine" size="sm">
                      Nivel máximo
                    </Badge>
                  )}
                </div>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: credits > 0 ? "var(--success)" : "var(--ink-mute)",
                  }}
                >
                  {credits > 0 ? fmtUsd(credits) : "—"}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: refs > 0 ? "var(--wine)" : "var(--ink-mute)",
                  }}
                >
                  {refs || "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Primitivas locales
// ════════════════════════════════════════════════════════════════

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({
  pct,
  color,
  height,
}: {
  pct: number;
  color: string;
  height: number;
}) {
  return (
    <div
      style={{
        height,
        background: "var(--bg-elevated)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: color,
          borderRadius: 999,
          transition: "width var(--dur-slow) var(--ease)",
        }}
      />
    </div>
  );
}
