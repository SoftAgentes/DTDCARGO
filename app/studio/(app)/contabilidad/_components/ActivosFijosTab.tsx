"use client";

/**
 * Tab "Activos fijos" (SDD-0105).
 *
 * Lista de bienes de uso con su cédula de depreciación (cuota, acumulada con
 * tope, valor neto) calculada PURA a la fecha de hoy. Botón "Registrar
 * depreciación del mes" → postea DR 6.17 / CR 1.2.9 por activo, idempotente,
 * respetando el cierre de período. Dar de baja un activo (status='baja').
 */

import { useState } from "react";
import {
  assetStatusBadgeTone,
  assetStatusLabel,
  computeDepreciation,
  type FixedAsset,
} from "@/lib/studio/accounting/fixed-asset-types";
import type { Account } from "@/lib/studio/account-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { fmtAmount } from "./format";
import { AssetDrawer } from "./AssetDrawer";
import { disposeAsset, postDepreciationAction } from "../assets-actions";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function ActivosFijosTab({
  assets,
  assetAccounts,
  closingDate,
  showCreate,
  onCloseCreate,
}: {
  assets: FixedAsset[];
  assetAccounts: Account[];
  closingDate: string | null;
  showCreate: boolean;
  onCloseCreate: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(thisMonth());

  const asOf = todayISO();
  const activos = assets.filter((a) => a.status === "activo");

  // Totales de la cédula (a hoy).
  let totalCost = 0;
  let totalAccum = 0;
  let totalNet = 0;
  let totalMonthly = 0;
  for (const a of assets) {
    const s = computeDepreciation(
      {
        cost: a.cost,
        salvage_value: a.salvage_value,
        useful_life_months: a.useful_life_months,
        acquired_on: a.acquired_on,
      },
      asOf,
    );
    totalCost += a.cost;
    totalAccum += s.accumulated;
    totalNet += s.netBookValue;
    if (a.status === "activo" && !s.fullyDepreciated) {
      totalMonthly += s.remainingThisMonth;
    }
  }

  if (assets.length === 0) {
    return (
      <>
        <EmptyState
          eyebrow="Sin activos"
          title="Aún no hay activos fijos registrados."
          description={
            assetAccounts.length === 0
              ? "Primero necesitas una cuenta de activo fijo postable en el plan (1.2.x)."
              : "Registra tus bienes de uso (flota, equipos, mobiliario) y el sistema calcula su depreciación lineal y arma el asiento mensual DR 6.17 / CR 1.2.9."
          }
        />
        {showCreate && (
          <AssetDrawer assetAccounts={assetAccounts} onClose={onCloseCreate} />
        )}
      </>
    );
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 12px",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </p>
      )}

      {/* KPIs de la cédula */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KpiCard value={`$${fmtAmount(totalCost)}`} label="Costo total" />
        <KpiCard
          value={`$${fmtAmount(totalAccum)}`}
          label="Depreciación acumulada"
          valueColor="var(--wine)"
        />
        <KpiCard
          value={`$${fmtAmount(totalNet)}`}
          label="Valor neto en libros"
          valueColor="var(--success)"
        />
        <KpiCard
          value={`$${fmtAmount(totalMonthly)}`}
          label="Cuota del mes"
          sub={`${activos.length} activo${activos.length === 1 ? "" : "s"} activo${activos.length === 1 ? "" : "s"}`}
        />
      </div>

      {/* Acción: registrar depreciación del mes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ font: "700 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            Registrar depreciación del mes
          </div>
          <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
            Crea un asiento DR 6.17 / CR 1.2.9 por activo. Idempotente: re-correr el mismo mes no duplica.
            {closingDate && ` Período cerrado al ${closingDate}.`}
          </div>
        </div>
        <input
          type="month"
          className="studio-input"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ width: 150 }}
          aria-label="Mes a depreciar"
        />
        <ActionButton
          variant="dark"
          size="default"
          idleLabel="Depreciar mes"
          loadingLabel="Posteando…"
          successLabel="Depreciado"
          idleIcon={Icon.check(14)}
          disabled={activos.length === 0}
          onAction={async () => {
            setError(null);
            const r = await postDepreciationAction(period);
            if (r.error) throw new Error(r.error);
            const res = r.result;
            if (res) {
              if (res.posted > 0) {
                toast.success(
                  `${res.posted} asiento${res.posted === 1 ? "" : "s"} de depreciación · $${fmtAmount(res.totalAmount)}`,
                );
              } else if (res.failed > 0) {
                throw new Error("No se pudo postear la depreciación. Revisa el plan de cuentas.");
              } else {
                toast.info("Nada que depreciar este mes (ya posteado o activos al día).");
              }
            }
          }}
          onError={setError}
        />
      </div>

      {/* Cédula por activo */}
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
            gridTemplateColumns: GRID,
            gap: 12,
            padding: "12px 20px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          <span>Activo</span>
          <span style={{ textAlign: "right" }}>Costo</span>
          <span style={{ textAlign: "right" }}>Cuota/mes</span>
          <span style={{ textAlign: "right" }}>Acumulada</span>
          <span style={{ textAlign: "right" }}>Valor neto</span>
          <span>Estado</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        {assets.map((a, i) => {
          const s = computeDepreciation(
            {
              cost: a.cost,
              salvage_value: a.salvage_value,
              useful_life_months: a.useful_life_months,
              acquired_on: a.acquired_on,
            },
            asOf,
          );
          return (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "13px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span>
                <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)", display: "block" }}>
                  {a.name}
                </span>
                <span style={{ font: "500 10.5px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                  {a.asset_account_code} · {s.monthsElapsed}/{a.useful_life_months} m
                </span>
              </span>
              <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                ${fmtAmount(a.cost)}
              </span>
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
                ${fmtAmount(s.monthlyAmount)}
              </span>
              <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine)", textAlign: "right" }}>
                ${fmtAmount(s.accumulated)}
              </span>
              <span style={{ font: "800 12.5px/1 var(--f-mono)", color: "var(--success)", textAlign: "right" }}>
                ${fmtAmount(s.netBookValue)}
              </span>
              <span>
                <Badge tone={assetStatusBadgeTone(a.status)} size="sm" dot>
                  {assetStatusLabel(a.status)}
                </Badge>
              </span>
              <span style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                {a.status === "activo" ? (
                  <DisposeButton
                    assetName={a.name}
                    onConfirm={async () => {
                      setError(null);
                      const r = await disposeAsset(a.id);
                      if (r.error) setError(r.error);
                      else toast.info(`${a.name} dado de baja`);
                    }}
                  />
                ) : (
                  <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <AssetDrawer assetAccounts={assetAccounts} onClose={onCloseCreate} />
      )}
    </>
  );
}

const GRID = "1.6fr 110px 100px 110px 120px 120px 110px";

/** Botón de dar de baja con confirmación inline. */
function DisposeButton({
  assetName,
  onConfirm,
}: {
  assetName: string;
  onConfirm: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirm) {
    return (
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        onClick={() => setConfirm(true)}
        aria-label={`Dar de baja ${assetName}`}
      >
        Dar de baja
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <button
        type="button"
        className="studio-btn studio-btn-danger studio-btn-xs"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await onConfirm();
          setPending(false);
          setConfirm(false);
        }}
      >
        {pending ? "…" : "Sí"}
      </button>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        onClick={() => setConfirm(false)}
        disabled={pending}
      >
        No
      </button>
    </span>
  );
}
