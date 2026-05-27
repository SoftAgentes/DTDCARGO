"use client";

/**
 * MobileErpClient · vista móvil del ERP para usuarios full Studio.
 *
 * Portado de Claude Design v1.7 nuevo/mobile/app.jsx · Fases 1-5.
 * 5 screens: Home · Tracking · Clientes · Gastos (placeholder) · Más.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { signOut } from "@/app/studio/(app)/actions";

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
}

export function MobileErpClient({ user, shipments, clients }: Props) {
  const [tab, setTab] = useState<Tab>("home");

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
          <HomeScreen user={user} setTab={setTab} shipmentsCount={shipments.length} clientsCount={clients.length} />
        )}
        {tab === "tracking" && <TrackingScreen shipments={shipments} />}
        {tab === "clients" && <ClientsScreen clients={clients} />}
        {tab === "expenses" && <ExpensesScreen />}
        {tab === "more" && <MoreScreen user={user} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />
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
}: {
  user: UserInfo;
  setTab: (t: Tab) => void;
  shipmentsCount: number;
  clientsCount: number;
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
          value="—"
          sub="próximo SDD"
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
            desc="Próximo SDD"
            tone="wine"
            onClick={() => setTab("expenses")}
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
          filtered.map((s) => <ShipmentCard key={s.id} s={s} />)
        )}
      </div>
    </div>
  );
}

function ShipmentCard({ s }: { s: MobileShipment}) {
  const statusColor = STATUS_COLORS[s.status as ShipmentStatus] ?? "var(--ink-soft)";
  const service = SERVICE_LABELS[s.shipment_service];

  return (
    <Link
      href={`/studio/tracking/${s.id}`}
      style={{
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft:
          s.status === "exception"
            ? "4px solid var(--warning)"
            : "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        textDecoration: "none",
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
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Clients screen
// ─────────────────────────────────────────────────────────────

function ClientsScreen({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        c.markbox.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

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
          marginBottom: 18,
        }}
      >
        {clients.length} en cartera · geo-filter "cerca tuyo" próxima fase
      </div>

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

function ClientCard({ c }: { c: Client }) {
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
        <Badge tone={tierTone} size="sm">
          {c.tier}
        </Badge>
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
// Expenses screen · placeholder pendiente SDD
// ─────────────────────────────────────────────────────────────

function ExpensesScreen() {
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
        Gastos rápidos
      </h1>
      <div
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 6,
          marginBottom: 18,
        }}
      >
        Foto del recibo + monto + categoría · cobrable al cliente o no.
      </div>

      <div
        style={{
          padding: 20,
          background: "var(--wine-tint, var(--bg-elevated))",
          border: "1px solid var(--wine)",
          borderRadius: "var(--r-lg)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Próximo SDD
        </div>
        <div
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            marginBottom: 6,
          }}
        >
          Schema de gastos pendiente
        </div>
        <div
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Falta crear la tabla{" "}
          <code
            style={{
              font: "700 11.5px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            expenses
          </code>{" "}
          + RPC para capturar gastos rápidos de viaje (CN/VE) con foto, monto,
          moneda (USD/VES/CNY), categoría, vinculación opcional a embarque y
          flag &quot;cobrable al cliente&quot;.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PreviewExpense
          icon="🚕"
          label="Taxi/transfer"
          amount="$45 USD"
          context="Hotel → fábrica Ningbo"
        />
        <PreviewExpense
          icon="🍽"
          label="Comida"
          amount="¥280 CNY"
          context="Almuerzo cliente Yiwu Trading"
        />
        <PreviewExpense
          icon="🛣"
          label="Peaje"
          amount="$120 USD"
          context="PBL → Caracas · DTDU-472816 · cobrable"
          billable
        />
      </div>
    </div>
  );
}

function PreviewExpense({
  icon,
  label,
  amount,
  context,
  billable,
}: {
  icon: string;
  label: string;
  amount: string;
  context: string;
  billable?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        opacity: 0.65,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
            {label}
          </div>
          <code
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: "var(--ink)",
            }}
          >
            {amount}
          </code>
        </div>
        <div
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-mute)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {context}
          {billable && (
            <span
              style={{
                marginLeft: 6,
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
