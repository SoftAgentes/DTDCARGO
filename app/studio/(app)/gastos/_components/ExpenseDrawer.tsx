"use client";

/**
 * ExpenseDrawer — alta/edición de un gasto (SDD-0039 · Parte B).
 *
 * Flujo 2 pasos (solo en alta):
 *   1. Elegir scope (gasto de contenedor vs gasto operativo) con 2 cards.
 *   2. Form filtrado al scope elegido.
 *
 * Moneda dual: la contadora carga en CNY/USD/VES; si la moneda no es USD
 * aparece el campo "Tipo de cambio (X/USD)" con prefill del último usado +
 * sanity warning + preview "= US$…" en vivo. El server normaliza a USD.
 *
 * Submit via createExpenseAction / updateExpenseAction (errorCode contract).
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Icon } from "@/app/studio/_components/icons";
import {
  useT,
  useLocale,
  useRegion,
  formatCurrency,
  visibleCurrenciesFor,
  currencyDefaultForRegion,
} from "@/lib/i18n";
import {
  CATEGORIES_BY_SCOPE,
  CATEGORY_LABEL_KEYS,
  METHOD_LABEL_KEYS,
  CURRENCY_SYMBOL,
  FX_RATE_SANITY_RANGE,
  currencyPair,
  toAmountUsd,
  type Expense,
  type ExpenseActionState,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseMethod,
  type ExpenseScope,
} from "@/lib/studio/expense-types";
import type { ShipmentPick } from "@/lib/studio/expense-queries";
import { createExpenseAction, updateExpenseAction } from "../actions";

const METHODS: ExpenseMethod[] = ["cash", "card", "transfer", "usdt"];
const initialState: ExpenseActionState = {};

interface Props {
  onClose: () => void;
  /** Llamado tras guardar OK · el padre hace toast + highlight + refresh. */
  onSaved: (info: { code?: string }) => void;
  shipments: ShipmentPick[];
  fxPrefill: Record<string, { rate: number; setAt: string }>;
  /** Scope sugerido al abrir (tab activa). */
  defaultScope: ExpenseScope;
  /** Fuerza el scope y abre directo al form (ej: desde alerta de contenedor). */
  forceScope?: ExpenseScope;
  /** Prefill del contenedor (link desde Almacén CN / alerta). */
  defaultShipmentId?: string;
  /** Si viene, el drawer está en modo edición. */
  expense?: Expense;
}

export function ExpenseDrawer({
  onClose,
  onSaved,
  shipments,
  fxPrefill,
  defaultScope,
  forceScope,
  defaultShipmentId,
  expense,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const region = useRegion() ?? "ve";
  const isEdit = !!expense;

  const action = isEdit
    ? updateExpenseAction.bind(null, expense!.id)
    : createExpenseAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const initialScope: ExpenseScope = expense?.scope ?? forceScope ?? defaultScope;
  const [view, setView] = useState<"scope" | "form">(
    isEdit || forceScope ? "form" : "scope",
  );
  const [scope, setScope] = useState<ExpenseScope>(initialScope);
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? CATEGORIES_BY_SCOPE[initialScope][0],
  );
  const [shipmentId, setShipmentId] = useState(
    expense?.shipment_id ?? defaultShipmentId ?? "",
  );
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? null);
  const initialCurrency: ExpenseCurrency =
    expense?.currency ?? currencyDefaultForRegion(region);
  const [currency, setCurrency] = useState<ExpenseCurrency>(initialCurrency);
  const [fxRate, setFxRate] = useState<number | null>(() => {
    if (expense) return expense.fx_rate;
    const p = currencyPair(initialCurrency);
    return p ? fxPrefill[p]?.rate ?? null : null;
  });
  const [method, setMethod] = useState<ExpenseMethod>(expense?.method ?? "cash");
  const [note, setNote] = useState(expense?.note ?? "");
  const [location, setLocation] = useState(expense?.location ?? "");
  const [billable, setBillable] = useState(expense?.billable ?? false);

  const currencies = visibleCurrenciesFor(region);
  const cats = CATEGORIES_BY_SCOPE[scope];
  const pair = currencyPair(currency); // null si USD
  const needsFx = currency !== "USD";

  // Cerrar al guardar OK.
  useEffect(() => {
    if (state.ok) onSaved({ code: state.expenseCode ?? expense?.expense_code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const chooseScope = (s: ExpenseScope) => {
    setScope(s);
    setCategory(CATEGORIES_BY_SCOPE[s][0]);
    if (s === "external") setShipmentId("");
    setView("form");
  };

  // Preview USD en vivo + sanity warning.
  const effectiveFx = currency === "USD" ? 1 : fxRate ?? 0;
  const usdPreview =
    amount != null && amount > 0 && (currency === "USD" || effectiveFx > 0)
      ? toAmountUsd(amount, currency, effectiveFx)
      : null;
  const sanityRange = pair ? FX_RATE_SANITY_RANGE[pair] : undefined;
  const fxOutOfRange =
    !!sanityRange &&
    fxRate != null &&
    fxRate > 0 &&
    (fxRate < sanityRange[0] || fxRate > sanityRange[1]);

  const canSubmit = useMemo(() => {
    if (amount == null || amount <= 0) return false;
    if (scope === "shipment" && !shipmentId) return false;
    if (needsFx && (fxRate == null || fxRate <= 0)) return false;
    return true;
  }, [amount, scope, shipmentId, needsFx, fxRate]);

  const lastFx = pair ? fxPrefill[pair] : undefined;

  const scopeLabel =
    scope === "shipment"
      ? t("expenses.scope.shipment")
      : t("expenses.scope.external");

  return (
    <DrawerShell
      title={isEdit ? t("expenses.drawer.edit_title") : t("expenses.drawer.title")}
      subtitle={view === "form" ? scopeLabel : t("expenses.drawer.step1_legend")}
      onClose={onClose}
      pending={isPending}
      width={620}
    >
      {view === "scope" ? (
        // ── Paso 1 · elegir scope ─────────────────────────────
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <ScopeCard
            icon={Icon.box(20)}
            title={t("expenses.scope.shipment")}
            desc={t("expenses.scope.shipment_desc")}
            onClick={() => chooseScope("shipment")}
          />
          <ScopeCard
            icon={Icon.warehouse(20)}
            title={t("expenses.scope.external")}
            desc={t("expenses.scope.external_desc")}
            onClick={() => chooseScope("external")}
          />
        </div>
      ) : (
        // ── Paso 2 · form ─────────────────────────────────────
        <>
          <form
            id="expense-drawer-form"
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
            {/* Hidden · valores controlados */}
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="currency" value={currency} />
            <input
              type="hidden"
              name="fx_rate"
              value={currency === "USD" ? 1 : fxRate ?? ""}
            />
            <input type="hidden" name="method" value={method} />
            <input
              type="hidden"
              name="billable"
              value={billable ? "true" : "false"}
            />
            {scope === "shipment" && (
              <input type="hidden" name="shipment_id" value={shipmentId} />
            )}

            {/* Cambiar tipo de gasto (solo alta) */}
            {!isEdit && (
              <button
                type="button"
                onClick={() => setView("scope")}
                style={{
                  alignSelf: "flex-start",
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: 0,
                }}
              >
                {Icon.arrowL(12)} {scopeLabel}
              </button>
            )}

            {/* Contenedor (solo shipment) */}
            {scope === "shipment" && (
              <div>
                <label htmlFor="ex-shipment" className="studio-label">
                  {t("expenses.field.shipment")}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <select
                  id="ex-shipment"
                  className="studio-input studio-input-mono"
                  value={shipmentId}
                  onChange={(e) => setShipmentId(e.target.value)}
                  required
                >
                  <option value="">{t("expenses.field.shipment_ph")}</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Categoría */}
            <div>
              <label htmlFor="ex-category" className="studio-label">
                {t("expenses.field.category")}{" "}
                <span style={{ color: "var(--wine)" }}>*</span>
              </label>
              <select
                id="ex-category"
                className="studio-input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_LABEL_KEYS[c])}
                  </option>
                ))}
              </select>
            </div>

            {/* Monto + Moneda */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="ex-amount" className="studio-label">
                  {t("expenses.field.amount")}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <NumericInput
                  id="ex-amount"
                  name="amount"
                  type="decimal"
                  required
                  min={0}
                  precision={2}
                  placeholder="0.00"
                  value={amount}
                  onChange={setAmount}
                />
              </div>
              <div>
                <label htmlFor="ex-currency" className="studio-label">
                  {t("expenses.field.currency")}
                </label>
                <select
                  id="ex-currency"
                  className="studio-input"
                  value={currency}
                  onChange={(e) => {
                    const next = e.target.value as ExpenseCurrency;
                    setCurrency(next);
                    if (next === "USD") {
                      setFxRate(null);
                    } else if (fxRate == null) {
                      const p = currencyPair(next);
                      const last = p ? fxPrefill[p] : undefined;
                      if (last) setFxRate(last.rate);
                    }
                  }}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_SYMBOL[c]} {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo de cambio (solo non-USD) */}
            {needsFx && pair && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <label htmlFor="ex-fx" className="studio-label" style={{ margin: 0 }}>
                  {t("expenses.fx.label", { pair })}{" "}
                  <span style={{ color: "var(--wine)" }}>*</span>
                </label>
                <NumericInput
                  id="ex-fx"
                  name="fx_rate_visible"
                  type="decimal"
                  min={0}
                  precision={4}
                  placeholder="7.24"
                  value={fxRate}
                  onChange={setFxRate}
                />
                <p
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    margin: 0,
                  }}
                >
                  {lastFx
                    ? t("expenses.fx.prefill_recent", {
                        date: formatDateShort(lastFx.setAt, locale),
                      })
                    : t("expenses.fx.no_history")}
                </p>
                {fxOutOfRange && sanityRange && (
                  <p
                    style={{
                      font: "600 11.5px/1.4 var(--f-sans)",
                      color: "var(--warning)",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {Icon.warn(13)}
                    {t("expenses.fx.sanity_warning", {
                      min: sanityRange[0],
                      max: sanityRange[1],
                    })}
                  </p>
                )}
                {usdPreview != null && (
                  <p
                    style={{
                      font: "700 13px/1 var(--f-mono)",
                      color: "var(--wine)",
                      margin: 0,
                    }}
                  >
                    {t("expenses.fx.preview", {
                      usd: formatCurrency(usdPreview, "USD", locale),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Método de pago */}
            <div>
              <label htmlFor="ex-method" className="studio-label">
                {t("expenses.field.method")}
              </label>
              <select
                id="ex-method"
                className="studio-input"
                value={method}
                onChange={(e) => setMethod(e.target.value as ExpenseMethod)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(METHOD_LABEL_KEYS[m])}
                  </option>
                ))}
              </select>
            </div>

            {/* Detalle */}
            <div>
              <label htmlFor="ex-note" className="studio-label">
                {t("expenses.field.note")}
              </label>
              <textarea
                id="ex-note"
                name="note"
                rows={2}
                className="studio-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("expenses.field.note_ph")}
                style={{ resize: "vertical" }}
              />
            </div>

            {/* Ubicación */}
            <div>
              <label htmlFor="ex-location" className="studio-label">
                {t("expenses.field.location")}
              </label>
              <input
                id="ex-location"
                name="location"
                type="text"
                className="studio-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("expenses.field.location_ph")}
              />
            </div>

            {/* Recibo (adjunto) · solo alta */}
            {!isEdit && (
              <div>
                <label htmlFor="ex-receipt" className="studio-label">
                  {t("expenses.field.receipt")}
                </label>
                <input
                  id="ex-receipt"
                  name="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="studio-input"
                  style={{ padding: "8px 10px" }}
                />
                <p
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    margin: "4px 0 0",
                  }}
                >
                  {t("expenses.field.receipt_hint")}
                </p>
              </div>
            )}

            {/* Cobrable al cliente */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                font: "600 12.5px/1 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                style={{ accentColor: "var(--wine)", width: 16, height: 16 }}
              />
              {t("expenses.field.billable")}
            </label>

            <ErrorAlert state={state} />
            <div style={{ flex: 1, minHeight: 8 }} />
          </form>

          <DrawerFooter
            formId="expense-drawer-form"
            onClose={onClose}
            isPending={isPending}
            canSubmit={canSubmit}
            submitLabel={t("expenses.drawer.submit")}
            pendingLabel={t("expenses.drawer.saving")}
          />
        </>
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Card de scope (paso 1)
// ─────────────────────────────────────────────────────────────
function ScopeCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        textAlign: "left",
        padding: "18px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        cursor: "pointer",
        transition: "border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--wine)";
        e.currentTarget.style.background = "var(--wine-tint)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--bg-surface)";
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--r-md)",
          background: "var(--wine-tint)",
          color: "var(--wine)",
        }}
      >
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          className="studio-display"
          style={{ fontSize: 15, color: "var(--ink)" }}
        >
          {title}
        </span>
        <span
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {desc}
        </span>
      </span>
    </button>
  );
}

/** Fecha corta locale-aware para el hint del fx (sin segundos). */
function formatDateShort(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
