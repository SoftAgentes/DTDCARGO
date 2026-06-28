"use client";

/**
 * EmpClient · app del empleado (SDD-0113 Slice C/D). 4 tabs mobile-first:
 * Inicio · Recibo · Mensajes · Perfil. Tokens var(--*) (sobre navy
 * --ink-inv-soft/--ink-inv-mute, nunca rgba inline). Toda la data llega del
 * server acotada al propio empleado; la interacción usa las actions de /m/emp.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/app/studio/_components/icons";
import type { MyEmployee, MyPayslip, MyPayslipPeriod, MyBankChange } from "@/lib/studio/nomina/employee-self-queries";
import type { EmployeeComm } from "@/lib/studio/nomina/comms-types";
import { commIsUnread, commNeedsAck } from "@/lib/studio/nomina/comms-types";
import { ReciboTab } from "./ReciboTab";
import { MensajesTab } from "./MensajesTab";
import { PerfilTab } from "./PerfilTab";

type Tab = "inicio" | "recibo" | "mensajes" | "perfil";

export function fmtUsd(n: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);
}

export function EmpClient({
  me,
  payslip,
  periods,
  comms: initialComms,
  pendingBank,
}: {
  me: MyEmployee;
  payslip: MyPayslip | null;
  periods: MyPayslipPeriod[];
  comms: EmployeeComm[];
  pendingBank: MyBankChange | null;
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [comms, setComms] = useState<EmployeeComm[]>(initialComms);

  const unreadCount = useMemo(() => comms.filter((c) => commIsUnread(c)).length, [comms]);
  const pendingAck = useMemo(() => comms.filter((c) => commNeedsAck(c)).length, [comms]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        maxWidth: 520,
        margin: "0 auto",
        // Altura real de la tab bar fija + safe-area (no un valor mágico).
        paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header navy */}
      <header
        className="m-safe-top"
        style={{ background: "var(--ink)", padding: "18px 18px 16px", color: "var(--ink-inv-soft)" }}
      >
        <span style={{ font: "600 11px/1.2 var(--f-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-inv-mute)" }}>
          DTD Cargo · Mi espacio
        </span>
        <div style={{ font: "800 19px/1.2 var(--f-display)", marginTop: 4 }}>{me.full_name}</div>
        <div style={{ font: "400 12.5px/1.3 var(--f-sans)", color: "var(--ink-inv-mute)", marginTop: 2 }}>
          {me.position_label ?? "Empleado"} · {me.employee_code}
        </div>
      </header>

      <main style={{ flex: 1, padding: "16px 16px 8px" }}>
        {tab === "inicio" && (
          <InicioTab
            me={me}
            payslip={payslip}
            unreadCount={unreadCount}
            pendingAck={pendingAck}
            onGoRecibo={() => setTab("recibo")}
            onGoMensajes={() => setTab("mensajes")}
          />
        )}
        {tab === "recibo" && <ReciboTab me={me} initialPayslip={payslip} periods={periods} />}
        {tab === "mensajes" && <MensajesTab comms={comms} setComms={setComms} />}
        {tab === "perfil" && <PerfilTab me={me} pendingBank={pendingBank} />}
      </main>

      {/* Tab bar */}
      <nav
        className="m-safe-bottom"
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 520,
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          minHeight: 56,
        }}
      >
        <TabButton label="Inicio" icon={Icon.dashboard(20)} active={tab === "inicio"} onClick={() => setTab("inicio")} />
        <TabButton label="Recibo" icon={Icon.invoice(20)} active={tab === "recibo"} onClick={() => setTab("recibo")} />
        <TabButton
          label="Mensajes"
          icon={Icon.bell(20)}
          active={tab === "mensajes"}
          onClick={() => setTab("mensajes")}
          badge={unreadCount}
        />
        <TabButton label="Perfil" icon={Icon.users(20)} active={tab === "perfil"} onClick={() => setTab("perfil")} />
      </nav>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: "10px 4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        color: active ? "var(--wine)" : "var(--ink-mute)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <span style={{ position: "relative" }}>
        {icon}
        {badge != null && badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -9,
              minWidth: 15,
              height: 15,
              padding: "0 4px",
              borderRadius: 8,
              background: "var(--danger)",
              color: "var(--ink-inv)",
              font: "700 9.5px/15px var(--f-sans)",
              textAlign: "center",
            }}
          >
            {badge}
          </span>
        )}
      </span>
      <span style={{ font: "600 10px/1 var(--f-sans)" }}>{label}</span>
    </button>
  );
}

function InicioTab({
  me,
  payslip,
  unreadCount,
  pendingAck,
  onGoRecibo,
  onGoMensajes,
}: {
  me: MyEmployee;
  payslip: MyPayslip | null;
  unreadCount: number;
  pendingAck: number;
  onGoRecibo: () => void;
  onGoMensajes: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {pendingAck > 0 && (
        <button
          type="button"
          onClick={onGoMensajes}
          style={{
            textAlign: "left",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px",
            cursor: "pointer",
          }}
        >
          <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            Tienes {pendingAck} {pendingAck === 1 ? "comunicación" : "comunicaciones"} por confirmar
          </div>
          <div style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
            Toca para revisar y acusar recibo.
          </div>
        </button>
      )}

      {/* Card del último recibo */}
      <button
        type="button"
        onClick={onGoRecibo}
        style={{
          textAlign: "left",
          background: "var(--ink)",
          borderRadius: "var(--r-lg)",
          border: "none",
          padding: "16px 16px",
          cursor: "pointer",
          color: "var(--ink-inv-soft)",
        }}
      >
        <div style={{ font: "600 11px/1.2 var(--f-sans)", color: "var(--ink-inv-mute)", textTransform: "uppercase", letterSpacing: ".05em" }}>
          {payslip ? `Recibo ${payslip.period_label}` : "Recibo"}
        </div>
        {payslip ? (
          <>
            <div style={{ font: "800 26px/1.1 var(--f-display)", margin: "6px 0 2px", color: "var(--ink-inv)" }}>
              {fmtUsd(payslip.net_usd)}
            </div>
            <div style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--ink-inv-mute)" }}>
              Neto a cobrar · {payslip.run_status === "pagado" ? "Pagado" : "Confirmado"}
            </div>
          </>
        ) : (
          <div style={{ font: "400 13px/1.4 var(--f-sans)", marginTop: 6, color: "var(--ink-inv-mute)" }}>
            Aún no hay un recibo confirmado para mostrar.
          </div>
        )}
      </button>

      {/* Resumen ficha */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "14px 14px",
        }}
      >
        <Row label="Cargo" value={me.position_label ?? "—"} />
        <Row label="Departamento" value={me.department ?? "—"} />
        <Row label="Ingreso" value={me.hire_date ?? "—"} />
        <Row label="Mensajes nuevos" value={String(unreadCount)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", gap: 12 }}>
      <span style={{ font: "400 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>{label}</span>
      <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
