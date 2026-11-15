"use client";

import { CARACAS_TIME_ZONE } from "@/lib/shared/fechas-caracas";

/**
 * GastosClient — orquestador del módulo Gastos (SDD-0039 · Parte B).
 *
 * - Tabs por scope (Por contenedor / Operativos) sincronizadas con ?scope=
 * - Toolbar: search debounced (?q=) + filtro de mes (?month=) + "+ Nuevo gasto"
 * - Tabla de gastos con highlight tras crear/editar
 * - Drawer 2-pasos (ExpenseDrawer) en modo alta o edición
 */

import { useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  useT,
  useLocale,
  formatNumber,
  formatCurrency,
  resolveErrorMessage,
} from "@/lib/i18n";
import {
  CATEGORY_LABEL_KEYS,
  METHOD_LABEL_KEYS,
  CURRENCY_SYMBOL,
  type Expense,
  type ExpenseScope,
} from "@/lib/studio/expense-types";
import type { ShipmentPick } from "@/lib/studio/expense-queries";
import type { ActiveAlertRow } from "@/lib/studio/expense-alerts-types";
import { resolveExpenseAlertAction, exportExpensesCsvAction } from "../actions";
import { ExpenseDrawer } from "./ExpenseDrawer";
import { ExpenseRowActions } from "./ExpenseRowActions";

interface Props {
  expenses: Expense[];
  shipments: ShipmentPick[];
  scope: ExpenseScope;
  month?: string;
  search?: string;
  fxPrefill: Record<string, { rate: number; setAt: string }>;
  activeAlerts: ActiveAlertRow[];
  /** Si viene (desde el vínculo de Almacén CN), abre el drawer prefilled. */
  openShipmentId?: string;
  attachmentsPilotEnabled: boolean;
  attachmentOwnerKey?: string;
  canVoidExpense: boolean;
}

type DrawerState =
  | { mode: "create"; forceScope?: ExpenseScope; shipmentId?: string }
  | { mode: "edit"; expense: Expense }
  | null;

export function GastosClient({
  expenses,
  shipments,
  scope,
  month,
  search,
  fxPrefill,
  activeAlerts,
  openShipmentId,
  attachmentsPilotEnabled,
  attachmentOwnerKey,
  canVoidExpense,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [exporting, startExport] = useTransition();
  const flashClassFor = useRowHighlight();
  const toast = useToast();

  const onExport = () => {
    startExport(async () => {
      const res = await exportExpensesCsvAction(month);
      if (res.ok && res.csv != null) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename ?? "gastos.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        toast.error(resolveErrorMessage(t, res) ?? t("error.internal_error"));
      }
    });
  };

  const [q, setQ] = useState(search ?? "");
  // Lazy init: si llegamos con ?new_expense=<shipment_id> (vínculo desde
  // Almacén CN), abrir el drawer prefilled sin setState-in-effect.
  const [drawer, setDrawer] = useState<DrawerState>(() =>
    openShipmentId
      ? { mode: "create", forceScope: "shipment", shipmentId: openShipmentId }
      : null,
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cierra el drawer y limpia el param de entrada (?new_expense) si vino.
  const closeDrawer = () => {
    setDrawer(null);
    if (params.get("new_expense")) {
      const sp = new URLSearchParams(params.toString());
      sp.delete("new_expense");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  // Mapa shipment_id → code para la columna "Contenedor".
  const shipmentCodeById = new Map(shipments.map((s) => [s.id, s.code]));

  const pushParams = (next: { scope?: ExpenseScope; q?: string; month?: string }) => {
    const sp = new URLSearchParams(params.toString());
    // limpiar highlight viejo al re-filtrar
    sp.delete("highlight");
    sp.delete("hl-tone");
    if (next.scope !== undefined) sp.set("scope", next.scope);
    if (next.q !== undefined) {
      if (next.q.trim()) sp.set("q", next.q.trim());
      else sp.delete("q");
    }
    if (next.month !== undefined) {
      if (next.month) sp.set("month", next.month);
      else sp.delete("month");
    }
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  // Debounce manejado en el handler (sin setState-in-effect).
  const onSearchChange = (value: string) => {
    setQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => pushParams({ q: value }), 300);
  };

  const switchScope = (s: ExpenseScope) => {
    if (s === scope) return;
    pushParams({ scope: s });
  };

  const onSaved = (info: { code?: string }) => {
    const wasEdit = drawer?.mode === "edit";
    setDrawer(null);
    if (info.code) {
      toast.success(
        t(wasEdit ? "expenses.toast.updated" : "expenses.toast.created", {
          code: info.code,
        }),
      );
      const sp = new URLSearchParams(params.toString());
      sp.delete("new_expense");
      sp.set("highlight", info.code);
      sp.set("hl-tone", wasEdit ? "success" : "warm");
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }
    router.refresh();
  };

  const hasSearch = Boolean(q.trim());

  return (
    <>
      {/* Banner de alertas de consolidado */}
      {activeAlerts.length > 0 && (
        <AlertBanner
          alerts={activeAlerts}
          onLoad={(shipmentId) =>
            setDrawer({ mode: "create", forceScope: "shipment", shipmentId })
          }
        />
      )}

      {/* Tabs por scope */}
      <div
        role="group"
        aria-label="Tipo de gasto"
        className="studio-tabs"
        style={{ marginBottom: 16 }}
      >
        <ScopeTab
          active={scope === "shipment"}
          label={t("expenses.tab.shipment")}
          onClick={() => switchScope("shipment")}
        />
        <ScopeTab
          active={scope === "external"}
          label={t("expenses.tab.external")}
          onClick={() => switchScope("external")}
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 220 }}>
          <label className="studio-label" htmlFor="ex-q">
            {t("expenses.filter.search_label")}
          </label>
          <input
            id="ex-q"
            type="search"
            className="studio-input"
            placeholder={t("expenses.filter.search_ph")}
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 180px" }}>
          <label className="studio-label" htmlFor="ex-month">
            {t("expenses.filter.month_label")}
          </label>
          <input
            id="ex-month"
            type="month"
            className="studio-input"
            value={month ?? ""}
            onChange={(e) => pushParams({ month: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          style={{ marginLeft: "auto" }}
          disabled={exporting || expenses.length === 0}
          onClick={onExport}
        >
          {Icon.download(14)}{" "}
          {exporting ? t("expenses.exporting") : t("expenses.export_btn")}
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setDrawer({ mode: "create" })}
        >
          {Icon.plus(14)} {t("expenses.new_btn")}
        </button>
      </div>

      {/* Tabla o empty */}
      {expenses.length === 0 ? (
        <EmptyState
          eyebrow={t("expenses.page.title")}
          title={
            hasSearch
              ? t("expenses.empty.filtered")
              : scope === "shipment"
                ? t("expenses.empty.shipment_title")
                : t("expenses.empty.external_title")
          }
          description={
            hasSearch
              ? ""
              : scope === "shipment"
                ? t("expenses.empty.shipment_desc")
                : t("expenses.empty.external_desc")
          }
          action={
            !hasSearch ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setDrawer({ mode: "create" })}
              >
                {t("expenses.new_btn")}
              </button>
            ) : null
          }
        />
      ) : (
        <ExpensesTable
          rows={expenses}
          scope={scope}
          locale={locale}
          shipmentCodeById={shipmentCodeById}
          flashClassFor={flashClassFor}
          onEdit={(expense) => setDrawer({ mode: "edit", expense })}
          canVoidExpense={canVoidExpense}
        />
      )}

      {drawer && (
        <ExpenseDrawer
          onClose={closeDrawer}
          onSaved={onSaved}
          shipments={shipments}
          fxPrefill={fxPrefill}
          defaultScope={scope}
          forceScope={drawer.mode === "create" ? drawer.forceScope : undefined}
          defaultShipmentId={drawer.mode === "create" ? drawer.shipmentId : undefined}
          expense={drawer.mode === "edit" ? drawer.expense : undefined}
          attachmentsPilotEnabled={attachmentsPilotEnabled}
          attachmentOwnerKey={attachmentOwnerKey}
        />
      )}
    </>
  );
}

function ScopeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-activa={active ? "true" : undefined}
      onClick={onClick}
      className="studio-tab"
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Banner de alertas de consolidado
// ─────────────────────────────────────────────────────────────

/** Exportado para su prueba (`GastosClient.alertas.test.tsx`). */
export function AlertBanner({
  alerts,
  onLoad,
}: {
  alerts: ActiveAlertRow[];
  onLoad: (shipmentId: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = (alertId: string, code: string | null) => {
    setPendingId(alertId);
    startTransition(async () => {
      const res = await resolveExpenseAlertAction(alertId);
      if (res.ok) {
        toast.success(t("expenses.alert.closed_toast", { code: code ?? "—" }));
        router.refresh();
      } else {
        toast.error(resolveErrorMessage(t, res) ?? t("error.internal_error"));
      }
      setPendingId(null);
    });
  };

  // SDD-0603 · menores del Studio: la región viva lleva solo la frase fija
  // (título y subtítulo). La lista va fuera, debajo: si estuviera dentro, al
  // cerrar una alerta el lector releería todas las que quedan.
  return (
    <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      <Aviso
        tono="atencion"
        titulo={
          alerts.length === 1
            ? t("expenses.alert.banner_title_one")
            : t("expenses.alert.banner_title_many", { count: alerts.length })
        }
      >
        {t("expenses.alert.banner_sub")}
      </Aviso>
      <ul
        style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}
      >
        {alerts.map((a) => (
          <li
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              padding: "8px 10px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <code style={{ font: "800 12px/1 var(--f-mono)", color: "var(--wine-text)" }}>
              {a.shipment_code ?? "—"}
            </code>
            <span
              style={{
                font: "500 11.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              → {a.destination ?? t("expenses.alert.no_destination")}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {/* El vino es de «Nuevo gasto», la acción principal de la pantalla. */}
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                onClick={() => onLoad(a.shipment_id)}
              >
                {Icon.plus(12)} {t("expenses.alert.load_btn")}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                disabled={isPending && pendingId === a.id}
                onClick={() => close(a.id, a.shipment_code)}
              >
                {isPending && pendingId === a.id
                  ? t("expenses.alert.closing")
                  : t("expenses.alert.close_btn")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla
// ─────────────────────────────────────────────────────────────

function ExpensesTable({
  rows,
  scope,
  locale,
  shipmentCodeById,
  flashClassFor,
  onEdit,
  canVoidExpense,
}: {
  rows: Expense[];
  scope: ExpenseScope;
  locale: import("@/lib/i18n").Locale;
  shipmentCodeById: Map<string, string>;
  flashClassFor: (id: string) => string;
  onEdit: (expense: Expense) => void;
  canVoidExpense: boolean;
}) {
  const t = useT();
  const isShipment = scope === "shipment";
  // code+date | [shipment] | category | note | amount | usd | method | receipt | actions
  const cols = isShipment
    ? "130px 130px 130px minmax(160px, 1.4fr) 110px 110px 100px 70px 50px"
    : "130px 130px minmax(180px, 1.6fr) 110px 110px 100px 70px 50px";

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 12,
          padding: "12px 18px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          alignItems: "center",
        }}
      >
        <span>{t("expenses.table.col_code")}</span>
        {isShipment && <span>{t("expenses.table.col_shipment")}</span>}
        <span>{t("expenses.table.col_category")}</span>
        <span>{t("expenses.table.col_note")}</span>
        <span style={{ textAlign: "right" }}>{t("expenses.table.col_amount")}</span>
        <span style={{ textAlign: "right" }}>{t("expenses.table.col_amount_usd")}</span>
        <span>{t("expenses.table.col_method")}</span>
        <span style={{ textAlign: "center" }}>{t("expenses.table.col_receipt")}</span>
        <span style={{ textAlign: "right" }}>·</span>
      </div>

      {rows.map((r, i) => (
        <ExpenseRow
          key={r.id}
          row={r}
          isShipment={isShipment}
          locale={locale}
          shipmentCode={r.shipment_id ? shipmentCodeById.get(r.shipment_id) : undefined}
          cols={cols}
          hasBorderTop={i > 0}
          flashClass={flashClassFor(r.expense_code)}
          onEdit={() => onEdit(r)}
          canVoidExpense={canVoidExpense}
        />
      ))}
    </div>
  );
}

function ExpenseRow({
  row,
  isShipment,
  locale,
  shipmentCode,
  cols,
  hasBorderTop,
  flashClass,
  onEdit,
  canVoidExpense,
}: {
  row: Expense;
  isShipment: boolean;
  locale: import("@/lib/i18n").Locale;
  shipmentCode?: string;
  cols: string;
  hasBorderTop: boolean;
  flashClass: string;
  onEdit: () => void;
  canVoidExpense: boolean;
}) {
  const t = useT();
  const amountDisplay = `${CURRENCY_SYMBOL[row.currency]} ${formatNumber(Number(row.amount), locale, { maximumFractionDigits: 2 })}`;
  const usdDisplay = formatCurrency(Number(row.amount_usd), "USD", locale);

  return (
    <div
      data-row-id={row.expense_code}
      className={`studio-tracking-row ${flashClass}`.trim()}
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        padding: "13px 18px",
        borderTop: hasBorderTop ? "1px solid var(--border)" : 0,
        alignItems: "center",
      }}
    >
      {/* Código + fecha */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <code
          style={{
            font: "800 11.5px/1 var(--f-mono)",
            color: "var(--ink)",
            letterSpacing: "0.02em",
          }}
        >
          {row.expense_code}
        </code>
        <span style={{ font: "500 10.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          {new Intl.DateTimeFormat(locale, { timeZone: CARACAS_TIME_ZONE, year: "numeric", month: "short", day: "numeric" }).format(new Date(row.occurred_at))}
        </span>
      </div>

      {/* Contenedor */}
      {isShipment && (
        <span style={{ minWidth: 0 }}>
          {shipmentCode ? (
            <code
              style={{
                font: "700 11px/1 var(--f-mono)",
                color: "var(--wine-text)",
              }}
            >
              {shipmentCode}
            </code>
          ) : (
            <span style={{ color: "var(--ink-mute)" }}>—</span>
          )}
        </span>
      )}

      {/* Categoría */}
      <span style={{ minWidth: 0 }}>
        <Badge tone="neutral" size="sm">
          {t(CATEGORY_LABEL_KEYS[row.category])}
        </Badge>
      </span>

      {/* Nota */}
      <span
        style={{
          font: "500 12.5px/1.3 var(--f-sans)",
          color: row.note ? "var(--ink)" : "var(--ink-mute)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.note ?? undefined}
      >
        {row.note ?? "—"}
        {row.location && (
          <span style={{ color: "var(--ink-soft)" }}> · {row.location}</span>
        )}
      </span>

      {/* Monto original */}
      <span
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {amountDisplay}
      </span>

      {/* USD normalizado */}
      <span
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: "var(--wine-text)",
          textAlign: "right",
        }}
      >
        {usdDisplay}
      </span>

      {/* Método */}
      <span style={{ font: "500 11.5px/1.2 var(--f-sans)", color: "var(--ink-soft)" }}>
        {t(METHOD_LABEL_KEYS[row.method])}
      </span>

      {/* Recibo (indicador · link diferido a task export) */}
      <span style={{ textAlign: "center", color: row.receipt_path || row.receipt_document_id ? "var(--ink-soft)" : "var(--ink-mute)" }}>
        {row.receipt_path || row.receipt_document_id ? Icon.camera(14) : "—"}
      </span>

      {/* Acciones */}
      <span style={{ textAlign: "right" }}>
        <ExpenseRowActions
          expenseId={row.id}
          expenseCode={row.expense_code}
          onEdit={onEdit}
          canVoid={canVoidExpense}
        />
      </span>
    </div>
  );
}
