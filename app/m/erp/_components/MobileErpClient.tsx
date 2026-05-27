"use client";

/**
 * MobileErpClient · vista móvil del ERP para usuarios full Studio.
 *
 * Portado de Claude Design v1.7 nuevo/mobile/app.jsx · Fases 1-5.
 * 5 screens: Home · Tracking · Clientes · Gastos (placeholder) · Más.
 */

import { startTransition, useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  SERVICE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import type { Client } from "@/lib/studio/client-types";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  CURRENCY_SYMBOL,
  formatExpenseAmount,
  type Expense,
  type ExpenseActionState,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseMethod,
} from "@/lib/studio/expense-types";
import {
  formatDistance,
  haversineKm,
  useGeolocation,
} from "@/lib/studio/hooks/use-geolocation";
import { signOut } from "@/app/studio/(app)/actions";
import {
  createExpenseAction,
  softDeleteExpenseAction,
  updateExpenseAction,
} from "../actions";

// Shipment subset que devuelve listShipments (LIST_COLUMNS).
// Mantengo solo los fields que la mobile UI muestra.
type MobileShipment = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
};

type Tab = "home" | "tracking" | "clients" | "expenses" | "more";

interface UserInfo {
  id: string;
  firstName: string;
  fullName: string;
  initials: string;
  role: string;
  email: string;
}

interface Props {
  user: UserInfo;
  shipments: MobileShipment[];
  clients: Client[];
  expenses: Expense[];
  /** Map { receipt_path: signed_url } generado server-side (TTL 1h). */
  receiptUrls: Record<string, string>;
  expensesTodayUsd: number;
  /** HQ operativa del user · fallback "Cerca tuyo" si browser geo denegada. */
  operatingLat: number | null;
  operatingLng: number | null;
}

export function MobileErpClient({
  user,
  shipments,
  clients,
  expenses,
  receiptUrls,
  expensesTodayUsd,
  operatingLat,
  operatingLng,
}: Props) {
  const [tab, setTab] = useState<Tab>("home");
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  return (
    <div
      style={{
        minHeight: "100dvh",
        maxWidth: 480,
        margin: "0 auto",
        background: "var(--bg-base)",
        paddingBottom: "calc(76px + env(safe-area-inset-bottom))",
        position: "relative",
      }}
    >
      <MobileTopBar user={user} />

      <main>
        {tab === "home" && (
          <HomeScreen
            user={user}
            setTab={setTab}
            shipmentsCount={shipments.length}
            clientsCount={clients.length}
            expensesTodayUsd={expensesTodayUsd}
            onNewExpense={() => setExpenseModal(true)}
          />
        )}
        {tab === "tracking" && <TrackingScreen shipments={shipments} />}
        {tab === "clients" && (
          <ClientsScreen
            clients={clients}
            operatingLat={operatingLat}
            operatingLng={operatingLng}
          />
        )}
        {tab === "expenses" && (
          <ExpensesScreen
            expenses={expenses}
            receiptUrls={receiptUrls}
            onNewExpense={() => setExpenseModal(true)}
            onEditExpense={(e) => setEditingExpense(e)}
          />
        )}
        {tab === "more" && <MoreScreen user={user} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {expenseModal && (
        <NewExpenseModal onClose={() => setExpenseModal(false)} />
      )}

      {editingExpense && (
        <EditExpenseSheet
          expense={editingExpense}
          receiptUrl={
            editingExpense.receipt_path
              ? receiptUrls[editingExpense.receipt_path]
              : undefined
          }
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top bar + Bottom nav
// ─────────────────────────────────────────────────────────────

function MobileTopBar({ user }: { user: UserInfo }) {
  return (
    <header
      style={{
        padding: "14px 18px 12px",
        paddingTop: "max(14px, env(safe-area-inset-top))",
        background: "var(--bg-sidebar)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <BrandMark variant="reverse" size={28} isologoOnly />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--ink-inv-mute, rgba(255,255,255,0.55))",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          DTD · Mobile ERP
        </div>
        <div
          style={{
            font: "500 12px/1 var(--f-sans)",
            color: "var(--ink-inv-soft, rgba(255,255,255,0.85))",
            marginTop: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {user.email}
        </div>
      </div>
      <button
        type="button"
        aria-label="Notificaciones"
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--r-pill)",
          background: "var(--wine-tint, rgba(255,255,255,0.1))",
          color: "var(--wine-soft, rgba(255,255,255,0.85))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          border: 0,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {Icon.bell(16)}
      </button>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--r-pill)",
          background: "var(--wine)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          font: "800 13px/1 var(--f-display)",
          flexShrink: 0,
        }}
      >
        {user.initials}
      </div>
    </header>
  );
}

const NAV_ITEMS: { k: Tab; label: string; icon: (s?: number) => React.ReactNode }[] = [
  { k: "home", label: "Inicio", icon: Icon.dashboard },
  { k: "tracking", label: "Tracking", icon: Icon.radar },
  { k: "clients", label: "Clientes", icon: Icon.users },
  { k: "expenses", label: "Gastos", icon: Icon.invoice },
  { k: "more", label: "Más", icon: Icon.more },
];

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        padding: "8px 8px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 30,
      }}
    >
      {NAV_ITEMS.map((it) => {
        const active = tab === it.k;
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => setTab(it.k)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 4px",
              borderRadius: "var(--r-md)",
              color: active ? "var(--wine)" : "var(--ink-mute)",
              font: `${active ? "700" : "500"} 10px/1 var(--f-sans)`,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              transition: "color 160ms ease",
            }}
          >
            <span>{it.icon(20)}</span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// Home screen
// ─────────────────────────────────────────────────────────────

function HomeScreen({
  user,
  setTab,
  shipmentsCount,
  clientsCount,
  expensesTodayUsd,
  onNewExpense,
}: {
  user: UserInfo;
  setTab: (t: Tab) => void;
  shipmentsCount: number;
  clientsCount: number;
  expensesTodayUsd: number;
  onNewExpense: () => void;
}) {
  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            font: "700 11px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Hola · {user.role}
        </div>
        <h1
          style={{
            font: "900 26px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            margin: "6px 0 0",
          }}
        >
          {user.firstName}
        </h1>
        <div
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 6,
          }}
        >
          {shipmentsCount} embarques activos · {clientsCount} clientes en
          cartera.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <MobileMini
          label="Embarques activos"
          value={String(shipmentsCount)}
          sub="tocá para ver"
          tone="wine"
          onClick={() => setTab("tracking")}
        />
        <MobileMini
          label="Clientes"
          value={String(clientsCount)}
          sub="cartera total"
          tone="success"
          onClick={() => setTab("clients")}
        />
        <MobileMini
          label="Facturas vencidas"
          value="—"
          sub="próxima fase"
          tone="warning"
        />
        <MobileMini
          label="Gastos hoy"
          value={expensesTodayUsd > 0 ? `$${expensesTodayUsd}` : "$0"}
          sub="USD equivalente"
          tone="info"
          onClick={() => setTab("expenses")}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Acciones rápidas
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <QuickAction
            icon={Icon.radar}
            label="Tracking"
            desc={`${shipmentsCount} activos`}
            tone="info"
            onClick={() => setTab("tracking")}
          />
          <QuickAction
            icon={Icon.users}
            label="Clientes"
            desc="Búsqueda + contacto"
            tone="success"
            onClick={() => setTab("clients")}
          />
          <QuickAction
            icon={Icon.plus}
            label="Cargar gasto"
            desc="Monto + categoría"
            tone="wine"
            onClick={onNewExpense}
          />
          <QuickAction
            icon={Icon.cog}
            label="Más"
            desc="Perfil · ajustes"
            tone="neutral"
            onClick={() => setTab("more")}
          />
        </div>
      </div>

      <Link
        href="/studio"
        style={{
          display: "block",
          padding: "14px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            font: "700 11px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Ver Studio completo →
        </div>
        <div
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 6,
          }}
        >
          Funciones full en desktop: clientes, despacho, finanzas, mailing.
        </div>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tracking screen
// ─────────────────────────────────────────────────────────────

function TrackingScreen({ shipments }: { shipments: MobileShipment[] }) {
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return shipments;
    const q = search.trim().toLowerCase();
    return shipments.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.client_name ?? "").toLowerCase().includes(q) ||
        (s.client_markbox ?? "").toLowerCase().includes(q) ||
        (s.destination ?? "").toLowerCase().includes(q),
    );
  }, [shipments, search]);

  const detail = detailId ? shipments.find((s) => s.id === detailId) ?? null : null;

  return (
    <div style={{ padding: "20px 18px" }}>
      <h1
        style={{
          font: "900 26px/1.1 var(--f-display)",
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        Tracking
      </h1>
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 6,
          marginBottom: 18,
        }}
      >
        {shipments.length} embarques activos · sin entregados/cancelados
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar por código, cliente, MARKBOX…"
      />

      <div
        style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}
      >
        {filtered.length === 0 ? (
          <EmptyMobile
            title={search ? "Sin resultados" : "Sin embarques activos"}
            desc={
              search
                ? "Probá con otro código o nombre."
                : "Los embarques activos aparecerán acá cuando estén en curso."
            }
          />
        ) : (
          filtered.map((s) => (
            <ShipmentCard key={s.id} s={s} onClick={() => setDetailId(s.id)} />
          ))
        )}
      </div>

      {detail && <ShipmentSheet s={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function ShipmentCard({ s, onClick }: { s: MobileShipment; onClick: () => void }) {
  const statusColor = STATUS_COLORS[s.status as ShipmentStatus] ?? "var(--ink-soft)";
  const service = SERVICE_LABELS[s.shipment_service];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft:
          s.status === "exception"
            ? "4px solid var(--warning)"
            : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <code
          style={{
            font: "800 13px/1 var(--f-mono)",
            color: "var(--ink)",
            letterSpacing: "0.02em",
          }}
        >
          {s.code}
        </code>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: "var(--r-sm)",
            background: "var(--bg-elevated)",
            color: statusColor,
            font: "700 10.5px/1.4 var(--f-sans)",
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
            }}
          />
          {STATUS_LABELS[s.status as ShipmentStatus]}
        </span>
      </div>
      <div>
        <div
          style={{
            font: "700 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          {s.client_name ?? "—"}
        </div>
        <div
          style={{
            font: "500 11.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          {s.origin ?? "—"} → {s.destination ?? "—"} ·{" "}
          <span style={{ color: "var(--wine)", font: "700 11.5px/1.3 var(--f-sans)" }}>
            {service.primary}
            {service.sub && (
              <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                {" "}
                · {service.sub}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ShipmentSheet · bottom modal con mapa + detail + share
// ─────────────────────────────────────────────────────────────

function ShipmentSheet({ s, onClose }: { s: MobileShipment; onClose: () => void }) {
  const statusColor = STATUS_COLORS[s.status as ShipmentStatus] ?? "var(--ink-soft)";
  const service = SERVICE_LABELS[s.shipment_service];

  const shareText = `Hola, tu embarque ${s.code}${s.client_name ? ` (${s.client_name})` : ""} está en estado: ${STATUS_LABELS[s.status as ShipmentStatus]}.${s.destination ? ` Destino: ${s.destination}.` : ""}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // Progress mock derivado del status (0-100). Hasta tener tracking real
  // de eventos, mapeamos status → progress estimado para visualizar el mapa.
  const progress = statusToProgress(s.status as ShipmentStatus);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,61,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Detalle embarque ${s.code}`}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "20px 20px 0 0",
          padding: 18,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
          maxHeight: "88vh",
          overflow: "auto",
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border)",
            borderRadius: 999,
            margin: "0 auto 14px",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 14,
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <code
              style={{
                font: "900 18px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {s.code}
            </code>
            <div
              style={{
                font: "600 13px/1.2 var(--f-sans)",
                color: "var(--ink)",
                marginTop: 6,
              }}
            >
              {s.client_name ?? "—"}
              {s.client_markbox && (
                <span
                  style={{
                    color: "var(--wine)",
                    font: "700 12px/1.2 var(--f-mono)",
                    marginLeft: 8,
                  }}
                >
                  {s.client_markbox}
                </span>
              )}
            </div>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--bg-elevated)",
              color: statusColor,
              font: "700 11px/1.4 var(--f-sans)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: statusColor,
              }}
            />
            {STATUS_LABELS[s.status as ShipmentStatus]}
          </span>
        </div>

        {/* Mock map */}
        <div
          style={{
            position: "relative",
            height: 160,
            marginBottom: 16,
            background: "linear-gradient(135deg, var(--bg-sidebar), #1F3055)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <svg viewBox="0 0 400 160" style={{ width: "100%", height: "100%" }}>
            {/* línea bezier curve overlay */}
            <path
              d="M 60 80 Q 200 30 340 80"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              fill="none"
            />
            {/* línea del progreso */}
            <path
              d={`M 60 80 Q ${60 + (340 - 60) * 0.5} ${80 - 35} ${60 + (340 - 60) * (progress / 100)} ${80 - 35 * Math.sin((progress / 100) * Math.PI)}`}
              stroke="rgba(194,116,127,0.85)"
              strokeWidth="2.5"
              fill="none"
            />
            <circle cx="60" cy="80" r="8" fill="#1F8A5B" />
            <circle cx="340" cy="80" r="8" fill="rgba(194,116,127,0.5)" />
            {/* ship dot animado al progreso */}
            <circle
              cx={60 + (340 - 60) * (progress / 100)}
              cy={80 - 35 * Math.sin((progress / 100) * Math.PI)}
              r="6"
              fill="#C2747F"
            />
            <text
              x="60"
              y="105"
              fontFamily="Archivo, sans-serif"
              fontSize="9.5"
              fontWeight="700"
              fill="rgba(255,255,255,0.7)"
              textAnchor="middle"
            >
              {truncate(s.origin ?? "Origen", 18)}
            </text>
            <text
              x="340"
              y="105"
              fontFamily="Archivo, sans-serif"
              fontSize="9.5"
              fontWeight="700"
              fill="rgba(255,255,255,0.7)"
              textAnchor="middle"
            >
              {truncate(s.destination ?? "Destino", 18)}
            </text>
          </svg>
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              font: "700 9px/1 var(--f-sans)",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Vista mock · progreso estimado
          </div>
        </div>

        {/* Detail fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <DetailField label="Servicio" value={service.primary} sub={service.sub} />
          <DetailField label="Progreso" value={`${progress}%`} mono />
          <DetailField label="Origen" value={s.origin ?? "—"} />
          <DetailField label="Destino" value={s.destination ?? "—"} />
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "12px",
              background: "var(--success)",
              color: "#fff",
              borderRadius: "var(--r-md)",
              textDecoration: "none",
              textAlign: "center",
              font: "700 13px/1 var(--f-sans)",
            }}
          >
            Compartir status
          </a>
          <Link
            href={`/studio/tracking/${s.id}`}
            style={{
              display: "block",
              padding: "12px",
              background: "var(--wine)",
              color: "#fff",
              borderRadius: "var(--r-md)",
              textDecoration: "none",
              textAlign: "center",
              font: "700 13px/1 var(--f-sans)",
            }}
          >
            Ver completo
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `${mono ? "700" : "600"} 13px/1.2 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            font: "500 10.5px/1 var(--f-sans)",
            color: "var(--ink-mute)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function statusToProgress(status: ShipmentStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "in_warehouse":
    case "consolidating":
      return 15;
    case "shipped":
      return 35;
    case "in_transit":
      return 55;
    case "in_customs":
      return 75;
    case "arrived_destination":
    case "delayed_warehouse":
      return 85;
    case "out_for_delivery":
    case "last_mile":
      return 95;
    case "delivered":
      return 100;
    case "exception":
      return 50;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// Clients screen
// ─────────────────────────────────────────────────────────────

type ClientsMode = "nearby" | "all";

const TIER_RANK: Record<string, number> = { premium: 0, vip: 1, regular: 2 };

type ClientWithDistance = Client & { distanceKm: number | null };

function ClientsScreen({
  clients,
  operatingLat,
  operatingLng,
}: {
  clients: Client[];
  operatingLat: number | null;
  operatingLng: number | null;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ClientsMode>("all");
  const geo = useGeolocation();

  // Auto-request geo al entrar en modo nearby (si todavía idle)
  const tryNearby = () => {
    setMode("nearby");
    if (geo.status === "idle") geo.request();
  };

  // Posición efectiva: browser geo > HQ operativa fallback > null
  const effectivePos: {
    lat: number;
    lng: number;
    source: "browser" | "hq";
  } | null =
    geo.status === "granted" && geo.lat != null && geo.lng != null
      ? { lat: geo.lat, lng: geo.lng, source: "browser" }
      : operatingLat != null && operatingLng != null
        ? { lat: operatingLat, lng: operatingLng, source: "hq" }
        : null;

  const enriched = useMemo<ClientWithDistance[]>(() => {
    if (mode !== "nearby" || !effectivePos) {
      return clients.map((c) => ({ ...c, distanceKm: null }));
    }
    return clients.map((c) => ({
      ...c,
      distanceKm:
        c.lat != null && c.lng != null
          ? haversineKm(effectivePos.lat, effectivePos.lng, c.lat, c.lng)
          : null,
    }));
  }, [clients, mode, effectivePos]);

  const filtered = useMemo<ClientWithDistance[]>(() => {
    let list = enriched;
    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.markbox.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q),
      );
    }
    if (mode === "nearby") {
      if (effectivePos) {
        // Sort real por distancia · sin distancia (null) van al final
        list = [...list].sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) {
            // Fallback: tier para los dos sin GPS
            const ta = TIER_RANK[a.tier] ?? 99;
            const tb = TIER_RANK[b.tier] ?? 99;
            return ta - tb;
          }
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
      } else {
        // Fallback mock pre-permission: tier + recent
        list = [...list].sort((a, b) => {
          const tierA = TIER_RANK[a.tier] ?? 99;
          const tierB = TIER_RANK[b.tier] ?? 99;
          if (tierA !== tierB) return tierA - tierB;
          return b.created_at.localeCompare(a.created_at);
        });
      }
    }
    return list;
  }, [enriched, search, mode, effectivePos]);

  const clientsWithGps = clients.filter((c) => c.lat != null && c.lng != null).length;
  const usingHqFallback = effectivePos?.source === "hq";

  return (
    <div style={{ padding: "20px 18px" }}>
      <h1
        style={{
          font: "900 26px/1.1 var(--f-display)",
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        Clientes
      </h1>
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 6,
          marginBottom: 14,
        }}
      >
        {mode === "nearby"
          ? `${filtered.length} prioritarios · tier elevado primero`
          : `${clients.length} en cartera`}
      </div>

      {/* Mode toggle pill */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          padding: 4,
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-md)",
          marginBottom: 14,
        }}
      >
        {(["nearby", "all"] as ClientsMode[]).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => (m === "nearby" ? tryNearby() : setMode("all"))}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: active ? "var(--bg-surface)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                border: 0,
                font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                boxShadow: active ? "var(--shadow-xs)" : "none",
                cursor: "pointer",
                transition: "all 160ms ease",
              }}
            >
              {m === "nearby" ? "📍 Cerca tuyo" : `Todos · ${clients.length}`}
            </button>
          );
        })}
      </div>

      {mode === "nearby" && (
        <GeoStatusBanner
          geo={geo}
          clientsWithGps={clientsWithGps}
          usingHqFallback={usingHqFallback}
        />
      )}

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar por MARKBOX, nombre, email, teléfono…"
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 14,
        }}
      >
        {filtered.length === 0 ? (
          <EmptyMobile
            title={search ? "Sin resultados" : "Sin clientes en cartera"}
            desc={
              search
                ? "Probá con otro nombre o MARKBOX."
                : "Agregá clientes desde /studio/clientes en desktop."
            }
          />
        ) : (
          filtered.map((c) => <ClientCard key={c.id} c={c} />)
        )}
      </div>
    </div>
  );
}

function GeoStatusBanner({
  geo,
  clientsWithGps,
  usingHqFallback,
}: {
  geo: ReturnType<typeof useGeolocation>;
  clientsWithGps: number;
  usingHqFallback: boolean;
}) {
  if (geo.status === "loading") {
    return (
      <BannerLine tone="info" mb={14}>
        Obteniendo tu ubicación…
      </BannerLine>
    );
  }
  if (usingHqFallback) {
    // Browser geo no disponible/denegada PERO el user cargó su HQ operativa
    // en /studio (ProfileModal · Preferencias). Usamos esas coords.
    return (
      <BannerLine tone="info" mb={14}>
        <b>Usando tu HQ operativa</b> · distancia calculada desde las coords
        que cargaste en tu perfil. {clientsWithGps} de cartera con GPS.
      </BannerLine>
    );
  }
  if (geo.status === "denied") {
    return (
      <BannerLine tone="warning" mb={14}>
        <b>Permiso denegado</b> · sin HQ operativa cargada en tu perfil,
        ordenando por tier. Habilitá el permiso o cargá tu HQ desde
        Preferencias para distancia real.
      </BannerLine>
    );
  }
  if (geo.status === "unavailable" || geo.status === "error") {
    return (
      <BannerLine tone="danger" mb={14}>
        <b>Sin geolocalización</b> · {geo.error ?? "browser no soporta"}.
        Cargá tu HQ operativa en Preferencias o usá fallback tier-based.
      </BannerLine>
    );
  }
  if (geo.status === "granted") {
    if (clientsWithGps === 0) {
      return (
        <BannerLine tone="warning" mb={14}>
          <b>0 clientes con lat/lng cargados</b> · cargá las coordenadas
          desde el detalle de cada cliente en /studio para que la
          distancia funcione.
        </BannerLine>
      );
    }
    return (
      <BannerLine tone="success" mb={14}>
        <b>Ubicación OK</b> · {clientsWithGps} de cartera con GPS ordenados
        por distancia real.
      </BannerLine>
    );
  }
  return (
    <BannerLine tone="info" mb={14}>
      Pidiendo permiso de ubicación al browser…
    </BannerLine>
  );
}

function BannerLine({
  tone,
  mb,
  children,
}: {
  tone: "info" | "warning" | "danger" | "success";
  mb?: number;
  children: React.ReactNode;
}) {
  const bgMap = {
    info: "var(--info-bg)",
    warning: "var(--warning-bg)",
    danger: "var(--danger-bg)",
    success: "var(--success-bg)",
  } as const;
  const fgMap = {
    info: "var(--info)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    success: "var(--success)",
  } as const;
  return (
    <div
      style={{
        padding: "10px 12px",
        background: bgMap[tone],
        borderLeft: `3px solid ${fgMap[tone]}`,
        borderRadius: "var(--r-md)",
        marginBottom: mb,
        font: "500 11.5px/1.4 var(--f-sans)",
        color: fgMap[tone],
      }}
    >
      {children}
    </div>
  );
}

function ClientCard({ c }: { c: ClientWithDistance }) {
  const phoneClean = (c.phone ?? "").replace(/[^\d+]/g, "");
  const tierTone =
    c.tier === "premium" ? "wine" : c.tier === "vip" ? "info" : "neutral";

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <code
            style={{
              font: "800 12px/1 var(--f-mono)",
              color: "var(--wine)",
              letterSpacing: "0.02em",
            }}
          >
            {c.markbox}
          </code>
          <div
            style={{
              font: "700 14px/1.2 var(--f-sans)",
              color: "var(--ink)",
              marginTop: 4,
            }}
          >
            {c.name}
          </div>
          {c.email && (
            <div
              style={{
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.email}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
          <Badge tone={tierTone} size="sm">
            {c.tier}
          </Badge>
          {c.distanceKm != null && (
            <span
              style={{
                font: "700 10.5px/1 var(--f-mono)",
                color: "var(--wine)",
                letterSpacing: "0.02em",
              }}
            >
              📍 {formatDistance(c.distanceKm)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {phoneClean ? (
          <>
            <a
              href={`tel:${phoneClean}`}
              style={{
                padding: "10px",
                background: "var(--bg-elevated)",
                color: "var(--ink)",
                borderRadius: "var(--r-sm)",
                textDecoration: "none",
                textAlign: "center",
                font: "700 11px/1 var(--f-sans)",
              }}
            >
              📞 Llamar
            </a>
            <a
              href={`https://wa.me/${phoneClean.replace("+", "")}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "10px",
                background: "var(--success-bg)",
                color: "var(--success)",
                borderRadius: "var(--r-sm)",
                textDecoration: "none",
                textAlign: "center",
                font: "700 11px/1 var(--f-sans)",
              }}
            >
              WhatsApp
            </a>
          </>
        ) : (
          <div
            style={{
              gridColumn: "span 2",
              padding: "10px",
              background: "var(--bg-elevated)",
              color: "var(--ink-mute)",
              borderRadius: "var(--r-sm)",
              textAlign: "center",
              font: "500 11px/1.2 var(--f-sans)",
            }}
          >
            Sin teléfono
          </div>
        )}
        <Link
          href={`/studio/clientes/${c.markbox}`}
          style={{
            padding: "10px",
            background: "var(--wine)",
            color: "#fff",
            borderRadius: "var(--r-sm)",
            textDecoration: "none",
            textAlign: "center",
            font: "700 11px/1 var(--f-sans)",
          }}
        >
          Ver
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Expenses screen · real (SDD Expenses · migración 0047)
// ─────────────────────────────────────────────────────────────

function ExpensesScreen({
  expenses,
  receiptUrls,
  onNewExpense,
  onEditExpense,
}: {
  expenses: Expense[];
  receiptUrls: Record<string, string>;
  onNewExpense: () => void;
  onEditExpense: (e: Expense) => void;
}) {
  const billableCount = expenses.filter((e) => e.billable).length;

  return (
    <div style={{ padding: "20px 18px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <h1
          style={{
            font: "900 26px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Gastos rápidos
        </h1>
        <button
          type="button"
          onClick={onNewExpense}
          aria-label="Nuevo gasto"
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--r-pill)",
            background: "var(--wine)",
            color: "#fff",
            border: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {Icon.plus(18)}
        </button>
      </div>
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginBottom: 18,
        }}
      >
        {expenses.length} gastos · {billableCount} cobrable
        {billableCount === 1 ? "" : "s"} al cliente
      </div>

      {expenses.length === 0 ? (
        <EmptyMobile
          title="Sin gastos cargados"
          desc="Tocá el botón + arriba para cargar tu primer gasto."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expenses.map((e) => (
            <ExpenseRow
              key={e.id}
              e={e}
              receiptUrl={e.receipt_path ? receiptUrls[e.receipt_path] : undefined}
              onClick={() => onEditExpense(e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({
  e,
  receiptUrl,
  onClick,
}: {
  e: Expense;
  receiptUrl?: string;
  onClick: () => void;
}) {
  const date = new Date(e.occurred_at);
  const dateLabel = date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar gasto ${e.expense_code}`}
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
      }}
    >
      {receiptUrl ? (
        <div
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            position: "relative",
            border: "1px solid var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              padding: "1px 4px",
              background: "rgba(15,30,61,0.78)",
              color: "#fff",
              font: "700 9px/1 var(--f-sans)",
              borderTopLeftRadius: "var(--r-sm)",
            }}
            aria-hidden
          >
            {CATEGORY_ICONS[e.category]}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
          {CATEGORY_ICONS[e.category]}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <div
            style={{
              font: "700 12.5px/1.2 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {CATEGORY_LABELS[e.category]}
          </div>
          <code
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: "var(--ink)",
              flexShrink: 0,
            }}
          >
            {formatExpenseAmount(e)}
          </code>
        </div>
        <div
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-mute)",
            marginTop: 3,
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span>{dateLabel}</span>
          {e.note && (
            <>
              <span>·</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {e.note}
              </span>
            </>
          )}
          {e.billable && (
            <span
              style={{
                padding: "1px 6px",
                background: "var(--success-bg)",
                color: "var(--success)",
                borderRadius: "var(--r-sm)",
                font: "700 9.5px/1 var(--f-sans)",
                letterSpacing: "0.06em",
              }}
            >
              COBRABLE
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// NewExpenseModal · form full-screen mobile
// ─────────────────────────────────────────────────────────────

const INITIAL_EXPENSE_STATE: ExpenseActionState = {};

function NewExpenseModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<ExpenseCurrency>("USD");
  const [category, setCategory] = useState<ExpenseCategory>("otro");
  const [method, setMethod] = useState<ExpenseMethod>("cash");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [billable, setBillable] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setReceiptPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError("Foto demasiado pesada (máx 5 MB).");
      e.target.value = "";
      setReceiptPreview(null);
      return;
    }
    setReceiptPreview(URL.createObjectURL(file));
  };

  const [state, formAction, isPending] = useActionState(
    createExpenseAction,
    INITIAL_EXPENSE_STATE,
  );

  if (state?.ok) {
    setTimeout(() => {
      router.refresh();
      onClose();
    }, 100);
  }

  const canSubmit = Number(amount) > 0 && !!category;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,61,0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "20px 20px 0 0",
          padding: 18,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
          maxHeight: "92vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border)",
            borderRadius: 999,
            margin: "0 auto 4px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <h2
            style={{
              font: "900 20px/1.1 var(--f-display)",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Nuevo gasto
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ink-mute)",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Cerrar"
          >
            {Icon.close(18)}
          </button>
        </div>

        {/* Amount + currency */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
          <div>
            <label
              className="studio-label"
              htmlFor="exp-amount"
              style={{ marginBottom: 6, display: "block" }}
            >
              Monto
            </label>
            <input
              id="exp-amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="studio-input studio-input-mono"
              style={{ width: "100%", height: 52, fontSize: 22, textAlign: "right", paddingRight: 14 }}
            />
          </div>
          <div>
            <label
              className="studio-label"
              htmlFor="exp-currency"
              style={{ marginBottom: 6, display: "block" }}
            >
              Moneda
            </label>
            <select
              id="exp-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as ExpenseCurrency)}
              className="studio-input"
              style={{ width: "100%", height: 52, fontSize: 16, textAlign: "center" }}
            >
              <option value="USD">USD {CURRENCY_SYMBOL.USD}</option>
              <option value="VES">VES {CURRENCY_SYMBOL.VES}</option>
              <option value="CNY">CNY {CURRENCY_SYMBOL.CNY}</option>
            </select>
          </div>
        </div>

        {/* Category chips */}
        <div>
          <label className="studio-label" style={{ marginBottom: 8, display: "block" }}>
            Categoría
          </label>
          <input type="hidden" name="category" value={category} />
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => {
              const active = category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  style={{
                    padding: "8px 12px",
                    background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                    color: active ? "var(--wine)" : "var(--ink-soft)",
                    border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                    borderRadius: "var(--r-pill)",
                    font: "700 11px/1 var(--f-sans)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Method */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-method"
            style={{ marginBottom: 6, display: "block" }}
          >
            Método de pago
          </label>
          <select
            id="exp-method"
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as ExpenseMethod)}
            className="studio-input"
            style={{ width: "100%", height: 44 }}
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="usdt">USDT</option>
          </select>
        </div>

        {/* Note */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-note"
            style={{ marginBottom: 6, display: "block" }}
          >
            Nota (opcional)
          </label>
          <textarea
            id="exp-note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Almuerzo cliente Yiwu Trading"
            rows={2}
            className="studio-input"
            style={{ width: "100%", resize: "vertical", padding: "10px 14px" }}
          />
        </div>

        {/* Location */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-location"
            style={{ marginBottom: 6, display: "block" }}
          >
            Ubicación (opcional)
          </label>
          <input
            id="exp-location"
            name="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej: Yiwu, CN"
            className="studio-input"
            style={{ width: "100%", height: 44 }}
          />
        </div>

        {/* Foto del recibo */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-receipt"
            style={{ marginBottom: 6, display: "block" }}
          >
            Foto del recibo (opcional)
          </label>
          {receiptPreview ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptPreview}
                alt="Vista previa del recibo"
                style={{
                  width: "100%",
                  maxHeight: 240,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (receiptPreview) URL.revokeObjectURL(receiptPreview);
                  setReceiptPreview(null);
                  setReceiptError(null);
                  const el = document.getElementById(
                    "exp-receipt",
                  ) as HTMLInputElement | null;
                  if (el) el.value = "";
                }}
                aria-label="Quitar foto"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 28,
                  height: 28,
                  borderRadius: "var(--r-pill)",
                  background: "rgba(15,30,61,0.78)",
                  color: "#fff",
                  border: 0,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                {Icon.close(14)}
              </button>
            </div>
          ) : (
            <label
              htmlFor="exp-receipt"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 16px",
                background: "var(--bg-elevated)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                font: "700 12.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {Icon.plus(14)}
              <span>Tomar foto o adjuntar</span>
            </label>
          )}
          <input
            id="exp-receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleReceiptChange}
            style={{ display: "none" }}
          />
          {(receiptError || state?.fieldErrors?.receipt) && (
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: "6px 0 0",
              }}
            >
              {receiptError ?? state?.fieldErrors?.receipt}
            </p>
          )}
        </div>

        {/* Billable toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="billable"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            style={{ accentColor: "var(--success)" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              Cobrable al cliente
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              Se incluirá en la factura del cliente correspondiente.
            </div>
          </div>
        </label>

        {state?.error && (
          <div
            style={{
              padding: 10,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-sm)",
              font: "600 12px/1.3 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="studio-btn studio-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="studio-btn studio-btn-primary"
          >
            {isPending ? "Guardando…" : "Guardar gasto"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// More screen · cuenta + ajustes + logout
// ─────────────────────────────────────────────────────────────

function MoreScreen({ user }: { user: UserInfo }) {
  return (
    <div style={{ padding: "20px 18px" }}>
      {/* Avatar grande */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 18,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "var(--r-pill)",
            background: "var(--wine)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "900 22px/1 var(--f-display)",
            flexShrink: 0,
          }}
        >
          {user.initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              font: "800 18px/1.2 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            {user.fullName}
          </div>
          <div
            style={{
              font: "500 12px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </div>
          <Badge tone="wine" size="sm" style={{ marginTop: 8 }}>
            {user.role}
          </Badge>
        </div>
      </div>

      {/* Menu Ajustes */}
      <SectionLabel>Ajustes</SectionLabel>
      <MenuLink
        href="/studio"
        label="Mi perfil"
        desc="Datos personales · contraseña · notificaciones"
        icon={Icon.cog}
      />
      <MenuLink
        href="/studio/admin/feature-flags"
        label="Feature flags"
        desc="Módulos activos para el tenant"
        icon={Icon.shield}
      />

      {/* Menu Studio */}
      <SectionLabel style={{ marginTop: 18 }}>Studio</SectionLabel>
      <MenuLink
        href="/studio"
        label="Dashboard completo"
        desc="Visión general del ERP en desktop"
        icon={Icon.dashboard}
      />
      <MenuLink
        href="/studio/usuarios"
        label="Equipo y roles"
        desc="Invitaciones · permisos · scope"
        icon={Icon.users}
      />

      {/* Logout */}
      <form action={signOut} style={{ marginTop: 24 }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "14px",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-md)",
            font: "700 13px/1 var(--f-sans)",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </form>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          font: "500 10.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
        }}
      >
        DTD·CARGO · DoorTuDoor · Mobile ERP Fase 1
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        font: "700 10.5px/1 var(--f-sans)",
        color: "var(--wine)",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MenuLink({
  href,
  label,
  desc,
  icon,
}: {
  href: string;
  label: string;
  desc: string;
  icon: (s?: number) => React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        textDecoration: "none",
        marginBottom: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          background: "var(--bg-elevated)",
          color: "var(--wine)",
          borderRadius: "var(--r-sm)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon(16)}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          {label}
        </div>
        <div
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {desc}
        </div>
      </div>
      <span style={{ color: "var(--ink-mute)" }}>→</span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 14px",
        height: 44,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
        {Icon.search(16)}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 0,
          outline: "none",
          background: "transparent",
          font: "500 14px/1 var(--f-sans)",
          color: "var(--ink)",
          minWidth: 0,
        }}
      />
    </div>
  );
}

function EmptyMobile({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      style={{
        padding: "40px 20px",
        textAlign: "center",
        background: "var(--bg-surface)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div
        style={{
          font: "800 16px/1.2 var(--f-display)",
          color: "var(--ink)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "32ch",
          margin: "0 auto",
        }}
      >
        {desc}
      </div>
    </div>
  );
}

const TONE_BG: Record<MiniTone, string> = {
  wine: "var(--wine-tint)",
  warning: "var(--warning-bg)",
  info: "var(--info-bg)",
  success: "var(--success-bg)",
  neutral: "var(--bg-elevated)",
};

const TONE_FG: Record<MiniTone, string> = {
  wine: "var(--wine)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success)",
  neutral: "var(--ink-soft)",
};

type MiniTone = "wine" | "warning" | "info" | "success" | "neutral";

function MobileMini({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  tone: MiniTone;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        padding: "14px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "900 24px/1 var(--f-display)",
          color: TONE_FG[tone],
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-mute)",
        }}
      >
        {sub}
      </div>
    </Component>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  tone,
  onClick,
}: {
  icon: (s?: number) => React.ReactNode;
  label: string;
  desc: string;
  tone: MiniTone;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "14px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 90,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          background: TONE_BG[tone],
          color: TONE_FG[tone],
          borderRadius: "var(--r-sm)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon(16)}
      </div>
      <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
        {label}
      </div>
      <div style={{ font: "500 10.5px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}>
        {desc}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// EditExpenseSheet · bottom sheet con form pre-filled + delete
// ─────────────────────────────────────────────────────────────

function EditExpenseSheet({
  expense,
  receiptUrl,
  onClose,
}: {
  expense: Expense;
  receiptUrl?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(expense.amount));
  const [currency, setCurrency] = useState<ExpenseCurrency>(expense.currency);
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [method, setMethod] = useState<ExpenseMethod>(expense.method);
  const [note, setNote] = useState(expense.note ?? "");
  const [location, setLocation] = useState(expense.location ?? "");
  const [billable, setBillable] = useState(expense.billable);

  const [newReceiptPreview, setNewReceiptPreview] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const updateBound = updateExpenseAction.bind(null, expense.id);
  const [state, formAction, isPending] = useActionState(
    updateBound,
    INITIAL_EXPENSE_STATE,
  );

  if (state?.ok) {
    setTimeout(() => {
      router.refresh();
      onClose();
    }, 100);
  }

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setNewReceiptPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError("Foto demasiado pesada (máx 5 MB).");
      e.target.value = "";
      setNewReceiptPreview(null);
      return;
    }
    setRemoveReceipt(false);
    setNewReceiptPreview(URL.createObjectURL(file));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await softDeleteExpenseAction(expense.id);
    if (result.ok) {
      router.refresh();
      onClose();
      return;
    }
    setDeleteError(result.error ?? "Error al eliminar.");
    setIsDeleting(false);
  };

  const canSubmit = Number(amount) > 0 && !!category && !isPending && !isDeleting;
  const hasExistingPhoto = !!expense.receipt_path && !removeReceipt && !newReceiptPreview;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,61,0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "20px 20px 0 0",
          padding: 18,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
          maxHeight: "92vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border)",
            borderRadius: 999,
            margin: "0 auto 4px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                font: "900 20px/1.1 var(--f-display)",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Editar gasto
            </h2>
            <code
              style={{
                font: "700 11px/1 var(--f-mono)",
                color: "var(--ink-soft)",
                marginTop: 4,
                display: "inline-block",
              }}
            >
              {expense.expense_code}
            </code>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending || isDeleting}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ink-mute)",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Cerrar"
          >
            {Icon.close(18)}
          </button>
        </div>

        {/* Amount + currency */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
          <div>
            <label
              className="studio-label"
              htmlFor="exp-edit-amount"
              style={{ marginBottom: 6, display: "block" }}
            >
              Monto
            </label>
            <input
              id="exp-edit-amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="studio-input studio-input-mono"
              style={{
                width: "100%",
                height: 52,
                fontSize: 22,
                textAlign: "right",
                paddingRight: 14,
              }}
            />
          </div>
          <div>
            <label
              className="studio-label"
              htmlFor="exp-edit-currency"
              style={{ marginBottom: 6, display: "block" }}
            >
              Moneda
            </label>
            <select
              id="exp-edit-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as ExpenseCurrency)}
              className="studio-input"
              style={{ width: "100%", height: 52, fontSize: 16, textAlign: "center" }}
            >
              <option value="USD">USD {CURRENCY_SYMBOL.USD}</option>
              <option value="VES">VES {CURRENCY_SYMBOL.VES}</option>
              <option value="CNY">CNY {CURRENCY_SYMBOL.CNY}</option>
            </select>
          </div>
        </div>

        {/* Category chips */}
        <div>
          <label className="studio-label" style={{ marginBottom: 8, display: "block" }}>
            Categoría
          </label>
          <input type="hidden" name="category" value={category} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORY_OPTIONS.map((opt) => {
              const active = category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  style={{
                    padding: "8px 12px",
                    background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                    color: active ? "var(--wine)" : "var(--ink-soft)",
                    border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                    borderRadius: "var(--r-pill)",
                    font: "700 11px/1 var(--f-sans)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Method */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-edit-method"
            style={{ marginBottom: 6, display: "block" }}
          >
            Método de pago
          </label>
          <select
            id="exp-edit-method"
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as ExpenseMethod)}
            className="studio-input"
            style={{ width: "100%", height: 44 }}
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="usdt">USDT</option>
          </select>
        </div>

        {/* Note */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-edit-note"
            style={{ marginBottom: 6, display: "block" }}
          >
            Nota (opcional)
          </label>
          <textarea
            id="exp-edit-note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="studio-input"
            style={{ width: "100%", resize: "vertical", padding: "10px 14px" }}
          />
        </div>

        {/* Location */}
        <div>
          <label
            className="studio-label"
            htmlFor="exp-edit-location"
            style={{ marginBottom: 6, display: "block" }}
          >
            Ubicación (opcional)
          </label>
          <input
            id="exp-edit-location"
            name="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="studio-input"
            style={{ width: "100%", height: 44 }}
          />
        </div>

        {/* Foto */}
        <div>
          <label className="studio-label" style={{ marginBottom: 6, display: "block" }}>
            Foto del recibo
          </label>
          <input type="hidden" name="remove_receipt" value={removeReceipt ? "true" : "false"} />

          {newReceiptPreview ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={newReceiptPreview}
                alt="Vista previa nueva"
                style={{
                  width: "100%",
                  maxHeight: 240,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  padding: "3px 8px",
                  background: "rgba(15,30,61,0.78)",
                  color: "#fff",
                  font: "700 9.5px/1 var(--f-sans)",
                  borderRadius: "var(--r-sm)",
                  letterSpacing: "0.06em",
                }}
              >
                NUEVA · REEMPLAZA LA ANTERIOR
              </span>
              <button
                type="button"
                onClick={() => {
                  if (newReceiptPreview) URL.revokeObjectURL(newReceiptPreview);
                  setNewReceiptPreview(null);
                  const el = document.getElementById("exp-edit-receipt") as HTMLInputElement | null;
                  if (el) el.value = "";
                }}
                aria-label="Cancelar reemplazo"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 28,
                  height: 28,
                  borderRadius: "var(--r-pill)",
                  background: "rgba(15,30,61,0.78)",
                  color: "#fff",
                  border: 0,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                {Icon.close(14)}
              </button>
            </div>
          ) : hasExistingPhoto && receiptUrl ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl}
                alt={`Recibo ${expense.expense_code}`}
                style={{
                  width: "100%",
                  maxHeight: 240,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: 8,
                  background:
                    "linear-gradient(to top, rgba(15,30,61,0.78), rgba(15,30,61,0))",
                }}
              >
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.94)",
                    color: "var(--ink)",
                    borderRadius: "var(--r-sm)",
                    font: "700 11px/1 var(--f-sans)",
                    textDecoration: "none",
                  }}
                >
                  Ver original
                </a>
                <button
                  type="button"
                  onClick={() => setRemoveReceipt(true)}
                  style={{
                    padding: "6px 10px",
                    background: "rgba(217,28,28,0.92)",
                    color: "#fff",
                    border: 0,
                    borderRadius: "var(--r-sm)",
                    font: "700 11px/1 var(--f-sans)",
                    cursor: "pointer",
                  }}
                >
                  Quitar foto
                </button>
              </div>
            </div>
          ) : null}

          <label
            htmlFor="exp-edit-receipt"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              marginTop: hasExistingPhoto || newReceiptPreview ? 8 : 0,
              background: "var(--bg-elevated)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              font: "700 12px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {Icon.plus(14)}
            <span>
              {hasExistingPhoto || newReceiptPreview
                ? "Reemplazar foto"
                : "Tomar foto o adjuntar"}
            </span>
          </label>
          <input
            id="exp-edit-receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleReceiptChange}
            style={{ display: "none" }}
          />
          {(receiptError || state?.fieldErrors?.receipt) && (
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: "6px 0 0",
              }}
            >
              {receiptError ?? state?.fieldErrors?.receipt}
            </p>
          )}
          {removeReceipt && expense.receipt_path && !newReceiptPreview && (
            <p
              style={{
                font: "600 11px/1.4 var(--f-sans)",
                color: "var(--warning)",
                margin: "6px 0 0",
              }}
            >
              La foto actual se eliminará al guardar.{" "}
              <button
                type="button"
                onClick={() => setRemoveReceipt(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--wine)",
                  font: "700 11px/1.4 var(--f-sans)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Deshacer
              </button>
            </p>
          )}
        </div>

        {/* Billable */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="billable"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            style={{ accentColor: "var(--success)" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              Cobrable al cliente
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              Se incluirá en la factura del cliente correspondiente.
            </div>
          </div>
        </label>

        {(state?.error || deleteError) && (
          <div
            style={{
              padding: 10,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-sm)",
              font: "600 12px/1.3 var(--f-sans)",
            }}
          >
            {state?.error || deleteError}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending || isDeleting}
            className="studio-btn studio-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="studio-btn studio-btn-primary"
          >
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        {/* Delete con confirm inline */}
        <div
          style={{
            marginTop: 4,
            padding: "12px 0 4px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending || isDeleting}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
            >
              Eliminar este gasto
            </button>
          ) : (
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  font: "600 12px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                ¿Seguro?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="studio-btn studio-btn-danger studio-btn-sm"
              >
                {isDeleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="studio-btn studio-btn-ghost studio-btn-sm"
              >
                No
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
