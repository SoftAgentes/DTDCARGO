"use client";

/**
 * MobileErpClient · vista móvil del ERP para usuarios full Studio.
 *
 * Portado de Claude Design v1.7 nuevo/mobile/app.jsx · Fase 1 alcance:
 *   - TopBar sticky con logo + ubicación user + bell + avatar
 *   - BottomNav 5 ítems sticky (Inicio · Tracking · Clientes · Gastos · Más)
 *   - HomeScreen con 4 KPIs mock + 4 quick actions + activity feed
 *   - Placeholders para las 4 tabs restantes (próximas fases)
 *
 * Mobile-first 480px max-width centrado · safe-area-inset compatible.
 * Sin localStorage (el handoff lo usa para gastos · acá quedan para SDD nuevo).
 */

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/app/studio/_components/icons";

type Tab = "home" | "tracking" | "clients" | "expenses" | "more";

interface UserInfo {
  id: string;
  firstName: string;
  fullName: string;
  initials: string;
  role: string;
  email: string;
}

export function MobileErpClient({ user }: { user: UserInfo }) {
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
        {tab === "home" && <HomeScreen user={user} setTab={setTab} />}
        {tab === "tracking" && <PlaceholderScreen title="Tracking" subtitle="Embarques en vivo · próxima fase" />}
        {tab === "clients" && <PlaceholderScreen title="Clientes" subtitle="Lista geo-localizada · próxima fase" />}
        {tab === "expenses" && <PlaceholderScreen title="Gastos rápidos" subtitle="Foto + monto + cobrable · próxima fase" />}
        {tab === "more" && <MoreScreen user={user} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top bar
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

// ─────────────────────────────────────────────────────────────
// Bottom nav
// ─────────────────────────────────────────────────────────────

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

function HomeScreen({ user, setTab }: { user: UserInfo; setTab: (t: Tab) => void }) {
  return (
    <div style={{ padding: "20px 18px" }}>
      {/* Saludo */}
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
          Vista mobile del ERP · alcance ejecutivo y comercial. Cambiá de
          tab abajo para tracking, clientes, gastos.
        </div>
      </div>

      {/* 4 KPIs grid 2x2 — TODO: queries reales en Fase 2 */}
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
          value="—"
          sub="próxima fase"
          tone="wine"
          onClick={() => setTab("tracking")}
        />
        <MobileMini
          label="Facturas vencidas"
          value="—"
          sub="próxima fase"
          tone="warning"
        />
        <MobileMini
          label="Leads nuevos"
          value="—"
          sub="próxima fase"
          tone="info"
        />
        <MobileMini
          label="Gastos hoy"
          value="—"
          sub="próxima fase"
          tone="success"
          onClick={() => setTab("expenses")}
        />
      </div>

      {/* Quick actions */}
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
            icon={Icon.plus}
            label="Cargar gasto"
            desc="Próximamente"
            tone="wine"
            onClick={() => setTab("expenses")}
          />
          <QuickAction
            icon={Icon.users}
            label="Clientes cerca"
            desc="Próximamente"
            tone="success"
            onClick={() => setTab("clients")}
          />
          <QuickAction
            icon={Icon.radar}
            label="Tracking"
            desc="Próximamente"
            tone="info"
            onClick={() => setTab("tracking")}
          />
          <QuickAction
            icon={Icon.cog}
            label="Configuración"
            desc="Mi perfil · prefs"
            tone="neutral"
            onClick={() => setTab("more")}
          />
        </div>
      </div>

      {/* Link al Studio web (escape hatch a desktop full) */}
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
// More screen
// ─────────────────────────────────────────────────────────────

function MoreScreen({ user }: { user: UserInfo }) {
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
          Mi cuenta
        </div>
        <h1
          style={{
            font: "900 26px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            margin: "6px 0 0",
          }}
        >
          {user.fullName}
        </h1>
        <div
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 6,
          }}
        >
          {user.email} · {user.role}
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
          marginBottom: 10,
        }}
      >
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          Mi perfil completo
        </div>
        <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
          Datos personales · contraseña · notificaciones (en Studio web)
        </div>
      </Link>

      <Link
        href="/studio/admin/feature-flags"
        style={{
          display: "block",
          padding: "14px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textDecoration: "none",
          marginBottom: 10,
        }}
      >
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          Feature flags
        </div>
        <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
          Casos de uso · módulos activos para el tenant
        </div>
      </Link>

      <Link
        href="/studio"
        style={{
          display: "block",
          padding: "14px 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textDecoration: "none",
          marginTop: 18,
          textAlign: "center",
          font: "700 13px/1 var(--f-sans)",
          color: "var(--wine)",
        }}
      >
        ← Volver al Studio
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Placeholders (Fases 2-5)
// ─────────────────────────────────────────────────────────────

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        padding: "60px 18px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          font: "900 22px/1.2 var(--f-display)",
          color: "var(--ink)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "32ch",
          margin: "0 auto",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MobileMini KPI card
// ─────────────────────────────────────────────────────────────

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
