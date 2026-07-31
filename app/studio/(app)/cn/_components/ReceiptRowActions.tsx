"use client";

/**
 * ReceiptRowActions — menú "..." en cada row de la tabla para cambiar status.
 *
 * Acciones: marcar pendiente / consolidado / incidencia.
 *
 * Consolidar (2026-05-27 · Opción A SDD-0029): muestra mini-form inline
 * pidiendo ciudad destino (required). Cities cargadas del catálogo
 * per-tenant (dispatch_city_catalog). Si tenant catalog vacío, fallback
 * a input text libre. La city queda guardada en warehouse_receipts_cn
 * y alimenta el scoring del módulo Despacho.
 *
 * Llama changeReceiptStatusAction y refresca la ruta.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  changeReceiptPaymentStatusAction,
  changeReceiptStatusAction,
  markReceiptVerifiedAction,
} from "../actions";
import type {
  PaymentStatus,
  WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";
import {
  PAYMENT_STATUS_LABEL_KEYS,
  RECEIPT_STATUS_LABEL_KEYS,
  RECEIPT_STATUS_OPTIONS,
} from "@/lib/studio/warehouse-cn-types";
import type { DispatchCity } from "@/lib/studio/dispatch-routes-types";
import { Icon } from "@/app/studio/_components/icons";
import { useT, resolveErrorMessage } from "@/lib/i18n";

const PAYMENT_OPTIONS: PaymentStatus[] = ["pagado", "parcial", "pendiente"];

interface Props {
  receiptId: string;
  currentStatus: WarehouseReceiptStatus;
  cities?: DispatchCity[];
  currentDestinationCity?: string | null;
  currentPaymentStatus?: PaymentStatus;
  /** SDD-0072 Fase 3: instante de verificación para auto-facturar (null = no verificada). */
  invoiceVerifiedAt?: string | null;
}

type View = "menu" | "consolidate-form";
type InitialMenuFocus = "first" | "last";
type MenuDirection = "up" | "down";

const ESTIMATED_MENU_HEIGHT = 420;

function enabledMenuItems(menu: HTMLDivElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(
    menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).filter(
    (item) =>
      item.getAttribute("aria-disabled") !== "true" &&
      (!(item instanceof HTMLButtonElement) || !item.disabled),
  );
}

export function ReceiptRowActions({
  receiptId,
  currentStatus,
  cities = [],
  currentDestinationCity = null,
  currentPaymentStatus = "pendiente",
  invoiceVerifiedAt = null,
}: Props) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [menuDirection, setMenuDirection] = useState<MenuDirection>("down");
  const [destinationCity, setDestinationCity] = useState(
    currentDestinationCity ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialMenuFocusRef = useRef<InitialMenuFocus | null>(null);

  const sortedCities = useMemo(() => {
    return cities
      .filter((c) => c.active)
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [cities]);

  const isVerified = invoiceVerifiedAt != null;

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setView("menu");
    setError(null);
    initialMenuFocusRef.current = null;
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (view === "menu" && initialMenuFocusRef.current) {
      const items = enabledMenuItems(menuRef.current);
      const nextIndex =
        initialMenuFocusRef.current === "last" ? items.length - 1 : 0;
      initialMenuFocusRef.current = null;
      items[nextIndex]?.focus();
    }

    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [closeMenu, open, view]);

  const openMenu = (initialFocus: InitialMenuFocus) => {
    initialMenuFocusRef.current = initialFocus;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setMenuDirection(
        spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow
          ? "up"
          : "down",
      );
    }
    setView("menu");
    setError(null);
    setOpen(true);
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (view !== "menu") return;
    const items = enabledMenuItems(menuRef.current);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length;
      items[previousIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "Tab") {
      requestAnimationFrame(() => closeMenu(false));
    }
  };

  const submit = (
    newStatus: WarehouseReceiptStatus,
    opts?: { destinationCity?: string },
  ) => {
    setError(null);
    startTransition(async () => {
      const res = await changeReceiptStatusAction(receiptId, newStatus, opts);
      // Prioridad: errorCode traducido > error legacy string
      const msg = resolveErrorMessage(t, res);
      if (msg) {
        setError(msg);
      } else if (res.ok) {
        closeMenu();
        router.refresh();
      }
    });
  };

  const handleMenuPick = (newStatus: WarehouseReceiptStatus) => {
    if (newStatus === "consolidado") {
      // Abrir mini-form inline en lugar de invocar directo
      setView("consolidate-form");
      return;
    }
    submit(newStatus);
  };

  const handlePaymentPick = (newPayment: PaymentStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await changeReceiptPaymentStatusAction(receiptId, newPayment);
      const msg = resolveErrorMessage(t, res);
      if (msg) {
        setError(msg);
      } else if (res.ok) {
        closeMenu();
        router.refresh();
      }
    });
  };

  const handleVerifyToggle = (verified: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await markReceiptVerifiedAction(receiptId, verified);
      const msg = resolveErrorMessage(t, res);
      if (msg) {
        setError(msg);
      } else if (res.ok) {
        closeMenu();
        router.refresh();
      }
    });
  };

  const handleConsolidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const city = destinationCity.trim();
    if (!city) {
      setError(t("warehouse_cn.row.destination_required"));
      return;
    }
    submit("consolidado", { destinationCity: city });
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            closeMenu();
          } else {
            openMenu("first");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("last");
          }
        }}
        disabled={pending}
        aria-label={t("warehouse_cn.row.aria_actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `receipt-actions-${receiptId}` : undefined}
        style={{
          width: 32,
          height: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-soft)",
          cursor: pending ? "wait" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!pending) {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--ink)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-soft)";
        }}
      >
        {Icon.more(14)}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={`receipt-actions-${receiptId}`}
          role={view === "menu" ? "menu" : undefined}
          aria-label={
            view === "menu" ? t("warehouse_cn.row.aria_actions") : undefined
          }
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleMenuKeyDown}
          style={{
            position: "absolute",
            ...(menuDirection === "up"
              ? { bottom: "calc(100% + 4px)" }
              : { top: "calc(100% + 4px)" }),
            right: 0,
            minWidth: view === "menu" ? 220 : 280,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            padding: view === "menu" ? 4 : 12,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            gap: view === "menu" ? 2 : 10,
          }}
        >
          {view === "menu" ? (
            <>
              <div
                style={{
                  padding: "6px 10px 4px",
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {t("warehouse_cn.row.action_change_status")}
              </div>
              {RECEIPT_STATUS_OPTIONS.map((opt) => {
                const isCurrent = opt.value === currentStatus;
                return (
                  <button
                    key={opt.value}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                    onClick={() => handleMenuPick(opt.value)}
                    disabled={isCurrent || pending}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      minHeight: 32,
                      border: 0,
                      background: isCurrent ? "var(--bg-elevated)" : "transparent",
                      color: isCurrent ? "var(--ink-mute)" : "var(--ink)",
                      font: "500 12.5px/1.2 var(--f-sans)",
                      cursor: isCurrent || pending ? "default" : "pointer",
                      borderRadius: "var(--r-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--s-2)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent && !pending) {
                        e.currentTarget.style.background = "var(--wine-tint)";
                        e.currentTarget.style.color = "var(--wine)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent && !pending) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ink)";
                      }
                    }}
                  >
                    <span style={{ width: 14, display: "inline-flex" }}>
                      {isCurrent ? Icon.check(13) : null}
                    </span>
                    <span>{t(RECEIPT_STATUS_LABEL_KEYS[opt.value])}</span>
                  </button>
                );
              })}

              {/* Separador + sección Cambiar pago */}
              <div
                role="separator"
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "6px 0",
                }}
              />
              <div
                style={{
                  padding: "6px 10px 4px",
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {t("warehouse_cn.row.action_change_payment")}
              </div>
              {PAYMENT_OPTIONS.map((p) => {
                const isCurrent = p === currentPaymentStatus;
                return (
                  <button
                    key={p}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                    onClick={() => handlePaymentPick(p)}
                    disabled={isCurrent || pending}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      minHeight: 32,
                      border: 0,
                      background: isCurrent ? "var(--bg-elevated)" : "transparent",
                      color: isCurrent ? "var(--ink-mute)" : "var(--ink)",
                      font: "500 12.5px/1.2 var(--f-sans)",
                      cursor: isCurrent || pending ? "default" : "pointer",
                      borderRadius: "var(--r-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--s-2)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent && !pending) {
                        e.currentTarget.style.background = "var(--wine-tint)";
                        e.currentTarget.style.color = "var(--wine)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent && !pending) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ink)";
                      }
                    }}
                  >
                    <span style={{ width: 14, display: "inline-flex" }}>
                      {isCurrent ? Icon.check(13) : null}
                    </span>
                    <span>{t(PAYMENT_STATUS_LABEL_KEYS[p])}</span>
                  </button>
                );
              })}

              {/* Separador + sección Facturación (SDD-0072 Fase 3 · flag humano) */}
              <div
                role="separator"
                style={{ height: 1, background: "var(--border)", margin: "6px 0" }}
              />
              <div
                style={{
                  padding: "6px 10px 4px",
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {t("warehouse_cn.row.action_invoicing")}
              </div>
              {/* Estado actual (no clickeable) — mismo lenguaje visual que el ítem
                  isCurrent de las otras secciones: check + texto apagado. El verde
                  vive SOLO acá como indicador de estado, nunca como color idle de un
                  botón (Regla 1 del Studio · ui-ux review Fase 3). */}
              {isVerified && (
                <div
                  style={{
                    padding: "8px 10px",
                    font: "500 12.5px/1.2 var(--f-sans)",
                    color: "var(--ink-mute)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-2)",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      display: "inline-flex",
                      color: "var(--success)",
                    }}
                  >
                    {Icon.check(13)}
                  </span>
                  <span>{t("warehouse_cn.row.invoice_verified_state")}</span>
                </div>
              )}
              {/* Acción — verbo neutro, mismo estilo/hover que los demás menuitem. */}
              <button
                role="menuitem"
                tabIndex={-1}
                type="button"
                onClick={() => handleVerifyToggle(!isVerified)}
                disabled={pending}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  minHeight: 32,
                  border: 0,
                  background: "transparent",
                  color: "var(--ink)",
                  font: "500 12.5px/1.2 var(--f-sans)",
                  cursor: pending ? "default" : "pointer",
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
                }}
                onMouseEnter={(e) => {
                  if (!pending) {
                    e.currentTarget.style.background = "var(--wine-tint)";
                    e.currentTarget.style.color = "var(--wine)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                <span style={{ width: 14, display: "inline-flex" }} />
                <span>
                  {pending
                    ? t("warehouse_cn.row.verifying")
                    : isVerified
                      ? t("warehouse_cn.row.action_unverify_invoice")
                      : t("warehouse_cn.row.action_verify_invoice")}
                </span>
              </button>
            </>
          ) : (
            <form onSubmit={handleConsolidateSubmit}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--s-2)",
                }}
              >
                <span
                  style={{
                    font: "700 9.5px/1 var(--f-sans)",
                    color: "var(--wine-text)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("warehouse_cn.row.action_consolidate")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setView("menu");
                    setError(null);
                  }}
                  style={{
                    color: "var(--ink-soft)",
                    background: "transparent",
                    border: 0,
                    font: "600 11px/1 var(--f-sans)",
                    cursor: "pointer",
                  }}
                >
                  {t("warehouse_cn.row.back")}
                </button>
              </div>

              <label
                className="studio-label"
                htmlFor={`dest-city-${receiptId}`}
                style={{ display: "block", marginBottom: "var(--s-1)" }}
              >
                {t("warehouse_cn.row.destination_city_label")}
              </label>

              {sortedCities.length > 0 ? (
                <select
                  id={`dest-city-${receiptId}`}
                  className="studio-input"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  required
                  autoFocus
                  style={{ width: "100%", height: 34 }}
                >
                  <option value="">
                    {t("warehouse_cn.row.destination_choose_option")}
                  </option>
                  {sortedCities.map((c) => (
                    <option key={c.id} value={c.city}>
                      {c.city} · {c.state_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`dest-city-${receiptId}`}
                  type="text"
                  className="studio-input"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  placeholder={t("warehouse_cn.row.city_placeholder")}
                  required
                  autoFocus
                  style={{ width: "100%", height: 34 }}
                />
              )}
              {sortedCities.length === 0 && (
                <p
                  style={{
                    font: "500 10.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "6px 0 0",
                  }}
                >
                  {t("warehouse_cn.row.empty_catalog_hint")}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "var(--s-2)",
                  justifyContent: "flex-end",
                  marginTop: "var(--s-3)",
                }}
              >
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => {
                    setView("menu");
                    setError(null);
                  }}
                  disabled={pending}
                >
                  {t("chrome.action.cancel")}
                </button>
                <button
                  type="submit"
                  className="studio-btn studio-btn-primary studio-btn-sm"
                  disabled={pending || !destinationCity.trim()}
                >
                  {pending
                    ? t("warehouse_cn.row.consolidating")
                    : t("warehouse_cn.row.consolidate_submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            padding: "6px 10px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            whiteSpace: "nowrap",
            zIndex: 31,
            maxWidth: 300,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
