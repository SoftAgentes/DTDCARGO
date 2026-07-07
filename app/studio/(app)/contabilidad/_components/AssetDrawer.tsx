"use client";

/**
 * AssetDrawer (SDD-0105) — "Registrar activo".
 *
 * Cabecera del bien (nombre, cuenta del activo 1.2.x, costo, residual, fecha de
 * adquisición, vida útil). Preview en vivo de la cuota mensual + cédula a hoy
 * (computeDepreciation, la misma fn pura que el server). Las cuentas de
 * depreciación acumulada (1.2.9) y gasto (6.17) usan default si no se eligen.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeDepreciation,
  DEFAULT_ACCUM_DEP_CODE,
  DEFAULT_DEP_EXPENSE_CODE,
  type AssetActionState,
} from "@/lib/studio/accounting/fixed-asset-types";
import type { Account } from "@/lib/studio/account-types";
import { compareCodes } from "@/lib/studio/account-types";
import { createAsset } from "../assets-actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { fmtAmount } from "./format";

interface Props {
  assetAccounts: Account[];
  /** Todas las cuentas postables (para elegir acumulada/gasto opcionalmente). */
  allPostable?: Account[];
  onClose: () => void;
}

const initialState: AssetActionState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssetDrawer({ assetAccounts, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    createAsset,
    initialState,
  );

  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cost, setCost] = useState("");
  const [salvage, setSalvage] = useState("");
  const [acquiredOn, setAcquiredOn] = useState(todayISO());
  const [lifeMonths, setLifeMonths] = useState("");

  const sortedAccounts = assetAccounts
    .slice()
    .sort((a, b) => compareCodes(a.code, b.code));

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Activo registrado");
    router.refresh();
    onClose();
  }, [state.ok, router, toast, onClose]);

  const costN = Number(cost) || 0;
  const salvageN = Number(salvage) || 0;
  const lifeN = Math.floor(Number(lifeMonths) || 0);

  const preview =
    costN > 0 && lifeN > 0 && salvageN <= costN
      ? computeDepreciation(
          {
            cost: costN,
            salvage_value: salvageN,
            useful_life_months: lifeN,
            acquired_on: acquiredOn,
          },
          todayISO(),
        )
      : null;

  const canSubmit =
    name.trim().length > 0 &&
    Boolean(accountId) &&
    costN > 0 &&
    salvageN >= 0 &&
    salvageN <= costN &&
    lifeN > 0 &&
    Boolean(acquiredOn);

  return (
    <div
      onClick={() => !isPending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="asset-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Registrar activo
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: isPending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="asset-drawer-form"
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <input type="hidden" name="asset_account_id" value={accountId} />
          <input type="hidden" name="cost" value={cost || "0"} />
          <input type="hidden" name="salvage_value" value={salvage || "0"} />
          <input
            type="hidden"
            name="useful_life_months"
            value={lifeMonths || "0"}
          />

          <div>
            <label className="studio-label" htmlFor="asset-name">
              Nombre del activo <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <input
              id="asset-name"
              name="name"
              type="text"
              className="studio-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Camión Hino 300 · placa A12BC3D"
            />
            {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
          </div>

          <div>
            <label className="studio-label" htmlFor="asset-account">
              Cuenta del activo (1.2.x) <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <select
              id="asset-account"
              className="studio-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">— Elige la cuenta —</option>
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.asset_account_id && (
              <FieldError msg={state.fieldErrors.asset_account_id} />
            )}
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="asset-cost">
                Costo <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <NumericInput
                id="asset-cost"
                type="currency"
                currency="USD"
                min={0}
                placeholder="0.00"
                value={cost === "" ? null : Number(cost)}
                onChange={(v) => setCost(v != null ? String(v) : "")}
              />
              {state.fieldErrors?.cost && <FieldError msg={state.fieldErrors.cost} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="asset-salvage">
                Valor residual
              </label>
              <NumericInput
                id="asset-salvage"
                type="currency"
                currency="USD"
                min={0}
                placeholder="0.00"
                value={salvage === "" ? null : Number(salvage)}
                onChange={(v) => setSalvage(v != null ? String(v) : "")}
              />
              {state.fieldErrors?.salvage_value && (
                <FieldError msg={state.fieldErrors.salvage_value} />
              )}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="asset-acquired">
                Fecha de adquisición <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <input
                id="asset-acquired"
                name="acquired_on"
                type="date"
                className="studio-input"
                value={acquiredOn}
                onChange={(e) => setAcquiredOn(e.target.value)}
              />
              {state.fieldErrors?.acquired_on && (
                <FieldError msg={state.fieldErrors.acquired_on} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="asset-life">
                Vida útil (meses) <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <NumericInput
                id="asset-life"
                type="count"
                min={1}
                placeholder="60"
                value={lifeMonths === "" ? null : Number(lifeMonths)}
                onChange={(v) => setLifeMonths(v != null ? String(v) : "")}
              />
              {state.fieldErrors?.useful_life_months && (
                <FieldError msg={state.fieldErrors.useful_life_months} />
              )}
            </div>
          </div>

          {state.error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {state.error}
            </p>
          )}

          {/* Preview de la cédula (navy LIVE) */}
          <div
            style={{
              padding: "16px 20px",
              background: "var(--ink)",
              color: "var(--ink-inv)",
              borderRadius: "var(--r-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            <div
              style={{
                font: "600 10.5px/1 var(--f-sans)",
                color: "var(--ink-inv-mute)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Cédula de depreciación (línea recta)
            </div>
            {preview ? (
              <>
                <PreviewRow label="Cuota mensual" value={preview.monthlyAmount} />
                <PreviewRow
                  label={`Acumulada a hoy (${preview.monthsElapsed} m)`}
                  value={preview.accumulated}
                  color="var(--wine-soft)"
                />
                <div style={{ height: 1, background: "var(--ink-inv-mute)" }} />
                <PreviewRow
                  label="Valor neto en libros"
                  value={preview.netBookValue}
                  color="var(--success)"
                  big
                />
              </>
            ) : (
              <p
                style={{
                  font: "500 12px/1.4 var(--f-sans)",
                  color: "var(--ink-inv-soft)",
                  margin: 0,
                }}
              >
                Completa costo y vida útil para ver la cuota mensual.
              </p>
            )}
          </div>

          <p
            style={{
              font: "500 11px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            El asiento mensual usa por defecto la cuenta {DEFAULT_DEP_EXPENSE_CODE}{" "}
            (gasto) y {DEFAULT_ACCUM_DEP_CODE} (depreciación acumulada).
          </p>

          <div style={{ flex: 1, minHeight: 8 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="asset-drawer-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
          >
            {isPending ? "Guardando…" : "Registrar activo"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  color = "var(--ink-inv)",
  big = false,
}: {
  label: string;
  value: number;
  color?: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        font: "500 13px/1 var(--f-sans)",
        color: "var(--ink-inv-soft)",
      }}
    >
      <span>{label}</span>
      <span style={{ font: `${big ? "800 16px" : "700 13px"}/1 var(--f-mono)`, color }}>
        ${fmtAmount(value)}
      </span>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
