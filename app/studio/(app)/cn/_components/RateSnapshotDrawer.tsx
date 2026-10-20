"use client";

/**
 * RateSnapshotDrawer — la tarifa congelada de una recepción (SDD-0571).
 *
 * Arriba, la tarifa vigente (o «Sin tarifa»). En el medio, congelar: la
 * propuesta automática (estimado aceptado → lista del cliente o aliado → casa),
 * un estimado aceptado elegido a mano o, para admin y contabilidad, un precio a
 * mano o del Excel de Yiwu, con motivo. Abajo, el historial: una tarifa no se
 * edita, se reemplaza y la anterior queda a la vista.
 *
 * Los números los pone la base: lo que se ve en «Quedaría así» es la vista
 * previa de la misma RPC que congela.
 */

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useT, type I18nKey } from "@/lib/i18n";
import { fmtUsd } from "@/lib/money";
import { SERVICE_OPTIONS, type ShipmentService } from "@/lib/studio/shipment-types";
import {
  MOTIVO_MAX,
  MOTIVO_MIN,
  RATE_ORIGIN_LABEL_KEYS,
  RATE_SOURCE_LABEL_KEYS,
  SERVICIO_POR_DEFECTO,
  cbmCambio,
  type FreezeFieldErrors,
  type RateSnapshot,
} from "@/lib/studio/rate-snapshots/types";
import type { PropuestaTarifa } from "@/lib/studio/rate-snapshots/propuesta";
import {
  freezeRateAction,
  loadRateDrawerAction,
  previewRateAction,
  type RateDrawerData,
} from "../rate-snapshot-actions";

type Modo = "propuesta" | "estimado" | "manual" | "excel_yiwu";

const NONE_KEYS: Record<Extract<PropuestaTarifa, { kind: "ninguna" }>["motivo"], I18nKey> = {
  sin_cliente: "warehouse_cn.rate.none.sin_cliente",
  sin_destino: "warehouse_cn.rate.none.sin_destino",
  sin_tarifa: "warehouse_cn.rate.none.sin_tarifa",
  sin_cbm: "warehouse_cn.rate.none.sin_cbm",
};

function fmtCbm(n: number): string {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" });
}

/** Una tarifa en tres líneas: $/m³ y mínimo, a facturar, de dónde salió. */
function Resumen({ s }: { s: RateSnapshot }) {
  const t = useT();
  const fuente =
    s.source === "lista" && s.rate_origin
      ? `${t(RATE_SOURCE_LABEL_KEYS[s.source])} · ${t(RATE_ORIGIN_LABEL_KEYS[s.rate_origin])}`
      : t(RATE_SOURCE_LABEL_KEYS[s.source]);
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: 0 }}>
      <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.per_cbm")}</dt>
      <dd className="mono" style={{ margin: 0, font: "700 13px/1.3 var(--f-mono)" }}>
        {fmtUsd(s.per_cbm)} · {t("warehouse_cn.rate.drawer.min_short", { amount: fmtUsd(s.min_charge) })}
      </dd>
      <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.cbm")}</dt>
      <dd className="mono" style={{ margin: 0, font: "600 13px/1.3 var(--f-mono)" }}>
        {fmtCbm(s.cbm)} m³{s.weight_kg != null ? ` · ${fmtCbm(s.weight_kg)} kg` : ""}
      </dd>
      <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.to_invoice")}</dt>
      <dd className="mono" style={{ margin: 0, font: "800 14px/1.3 var(--f-mono)", color: "var(--wine-text)" }}>
        {fmtUsd(s.amount_to_invoice)}
      </dd>
      <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.source")}</dt>
      <dd style={{ margin: 0, font: "500 12.5px/1.3 var(--f-sans)" }}>{fuente}</dd>
      <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.weight_rule")}</dt>
      <dd style={{ margin: 0, font: "500 12.5px/1.3 var(--f-sans)" }}>
        {t("warehouse_cn.rate.drawer.included_kg", { kg: s.included_kg_per_cbm })}
        {s.excess_weight_kg > 0 && (
          <>
            {" · "}
            <span style={{ color: "var(--ink)", background: "var(--warning-bg)", padding: "0 4px", borderRadius: "var(--r-sm)" }}>
              {t("warehouse_cn.rate.drawer.excess", { kg: fmtCbm(s.excess_weight_kg) })}
            </span>
          </>
        )}
      </dd>
      {s.reason && (
        <>
          <dt className="studio-label" style={{ margin: 0 }}>{t("warehouse_cn.rate.drawer.reason")}</dt>
          <dd style={{ margin: 0, font: "500 12.5px/1.4 var(--f-sans)" }}>{s.reason}</dd>
        </>
      )}
    </dl>
  );
}

export function RateSnapshotDrawer({
  receiptId,
  receiptCode,
  onClose,
}: {
  receiptId: string;
  receiptCode: string;
  onClose: (changed: boolean) => void;
}) {
  const t = useT();
  const toast = useToast();
  const formId = useId();
  const [data, setData] = useState<RateDrawerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [service, setService] = useState<ShipmentService>(SERVICIO_POR_DEFECTO);
  const [modo, setModo] = useState<Modo>("propuesta");
  const [quoteId, setQuoteId] = useState("");
  const [perCbm, setPerCbm] = useState<number | null>(null);
  const [minCharge, setMinCharge] = useState<number | null>(null);
  const [kg, setKg] = useState<500 | 1000>(500);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RateSnapshot | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FreezeFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const mensaje = useCallback(
    (r: { errorKey?: I18nKey; error?: string }) =>
      r.errorKey ? t(r.errorKey) : (r.error ?? t("warehouse_cn.rate.err.generic")),
    [t],
  );

  const cargar = useCallback(
    (svc: ShipmentService) => {
      startLoading(async () => {
        const r = await loadRateDrawerAction(receiptId, svc);
        if (r.ok) {
          setData(r);
          setLoadError(null);
        } else {
          setLoadError(mensaje(r));
        }
      });
    },
    [mensaje, receiptId],
  );

  useEffect(() => {
    cargar(SERVICIO_POR_DEFECTO);
  }, [cargar]);

  const live = data?.live ?? null;
  const reemplazo = live != null;
  const aMano = modo === "manual" || modo === "excel_yiwu";
  const motivoObligatorio = reemplazo || aMano || kg === 1000;

  const entrada = useCallback((): Record<string, unknown> | null => {
    if (!data) return null;
    const base = { receiptId, service, includedKgPerCbm: kg, reason };
    if (modo === "propuesta") {
      const p = data.propuesta;
      if (p.kind === "estimado") return { ...base, source: "estimado", quoteId: p.quoteId };
      if (p.kind === "tarifario") return { ...base, source: "tarifario", rateId: p.rateId };
      return null;
    }
    if (modo === "estimado") return quoteId ? { ...base, source: "estimado", quoteId } : null;
    return { ...base, source: modo, perCbm, minCharge };
  }, [data, kg, minCharge, modo, perCbm, quoteId, reason, receiptId, service]);

  // Vista previa: la misma RPC, sin escribir. Con la propuesta y 500 kg/m³, ya
  // vino con la carga; para lo demás se pide al cambiar los datos.
  const usaPrevistaDeCarga = modo === "propuesta" && kg === 500;
  const hayEntrada = entrada() != null;
  const previewMostrada = !data ? null : usaPrevistaDeCarga ? data.preview : hayEntrada ? preview : null;
  const previewErrorMostrado = !data
    ? null
    : usaPrevistaDeCarga
      ? (data.previewErrorKey ? t(data.previewErrorKey) : null)
      : hayEntrada
        ? previewError
        : null;
  useEffect(() => {
    if (!data || usaPrevistaDeCarga) return;
    const e = entrada();
    if (!e) return;
    let vigente = true;
    const timer = setTimeout(async () => {
      const r = await previewRateAction(e);
      if (!vigente) return;
      if (r.ok) {
        setPreview(r.snapshot);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(r.fieldErrors ? null : mensaje(r));
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
    // `reason` no cambia los números: no se vuelve a pedir la vista previa por él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, modo, quoteId, perCbm, minCharge, kg, service, usaPrevistaDeCarga]);

  const puedeEnviar =
    !!data &&
    !saving &&
    !loading &&
    (reemplazo || aMano || kg === 1000 ? data.canElevate : data.canFreeze) &&
    entrada() != null &&
    (!motivoObligatorio || reason.trim().length >= MOTIVO_MIN);

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = entrada();
    if (!e) return;
    setSubmitError(null);
    setFieldErrors({});
    startSaving(async () => {
      const r = await freezeRateAction(e);
      if (r.ok) {
        setChanged(true);
        toast.show({
          eventKey: reemplazo ? "shipment_rate_snapshot:replaced" : "shipment_rate_snapshot:frozen",
          tone: "success",
          message: t(reemplazo ? "warehouse_cn.rate.toast.replaced" : "warehouse_cn.rate.toast.frozen", {
            code: receiptCode,
            amount: fmtUsd(r.snapshot.amount_to_invoice),
          }),
          priority: "normal",
          scope: "module",
          dedupeKey: `shipment_rate_snapshot:${r.snapshot.id}`,
        });
        setReason("");
        setModo("propuesta");
        setKg(500);
        cargar(service);
      } else if (r.fieldErrors) {
        setFieldErrors(r.fieldErrors);
      } else {
        setSubmitError(mensaje(r));
      }
    });
  };

  const fieldError = (k: keyof FreezeFieldErrors) =>
    fieldErrors[k] ? (
      <p role="alert" style={{ margin: "4px 0 0", font: "500 11.5px/1.3 var(--f-sans)", color: "var(--danger)" }}>
        {t(fieldErrors[k] as I18nKey)}
      </p>
    ) : null;

  const propuestaTexto = (p: PropuestaTarifa): string => {
    if (p.kind === "estimado") return t("warehouse_cn.rate.drawer.proposal_quote", { code: p.quoteCode });
    if (p.kind === "tarifario") {
      return p.origen === "casa"
        ? t("warehouse_cn.rate.drawer.proposal_house")
        : t("warehouse_cn.rate.drawer.proposal_book", { book: p.bookName ?? "—" });
    }
    return t(NONE_KEYS[p.motivo]);
  };

  return (
    <DrawerShell
      title={t("warehouse_cn.rate.drawer.title", { code: receiptCode })}
      subtitle={t("warehouse_cn.rate.drawer.subtitle")}
      onClose={() => onClose(changed)}
      pending={saving}
      width={560}
    >
      <form
        id={formId}
        onSubmit={onSubmit}
        style={{ flex: 1, overflow: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
      >
        {loadError && (
          <p role="alert" style={{ margin: 0, font: "600 12.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
            {loadError}
          </p>
        )}
        {!data && !loadError && (
          <p role="status" style={{ margin: 0, font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {t("warehouse_cn.rate.drawer.loading")}
          </p>
        )}

        {data && (
          <>
            {/* Vigente */}
            <section aria-labelledby={`${formId}-vigente`} style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              <h3 id={`${formId}-vigente`} className="studio-eyebrow" style={{ margin: 0 }}>
                {t("warehouse_cn.rate.drawer.current")}
              </h3>
              {live ? (
                <>
                  <Resumen s={live} />
                  <p style={{ margin: 0, font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {t("warehouse_cn.rate.drawer.frozen_at", { date: fmtFecha(live.frozen_at) })}
                  </p>
                  {cbmCambio(live, data.currentCbm) && (
                    <p
                      role="status"
                      style={{
                        margin: 0,
                        font: "600 12px/1.4 var(--f-sans)",
                        color: "var(--ink)",
                        background: "var(--warning-bg)",
                        padding: "8px 10px",
                        borderRadius: "var(--r-sm)",
                      }}
                    >
                      {t("warehouse_cn.rate.drawer.cbm_changed", {
                        frozen: fmtCbm(live.cbm),
                        now: data.currentCbm == null ? "—" : fmtCbm(data.currentCbm),
                      })}
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <Badge tone="danger" size="sm">{t("warehouse_cn.rate.cell.none")}</Badge>
                </div>
              )}
            </section>

            {/* Congelar o reemplazar */}
            <section aria-labelledby={`${formId}-congelar`} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              <h3 id={`${formId}-congelar`} className="studio-eyebrow" style={{ margin: 0 }}>
                {reemplazo ? t("warehouse_cn.rate.drawer.replace") : t("warehouse_cn.rate.drawer.freeze")}
              </h3>
              {reemplazo && !data.canElevate && (
                <p role="status" style={{ margin: 0, font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {t("warehouse_cn.rate.drawer.replace_only_elevated")}
                </p>
              )}

              <div>
                <label className="studio-label" htmlFor={`${formId}-servicio`}>
                  {t("warehouse_cn.rate.drawer.service")}
                </label>
                <select
                  id={`${formId}-servicio`}
                  className="studio-input"
                  value={service}
                  onChange={(e) => {
                    const svc = e.target.value as ShipmentService;
                    setService(svc);
                    cargar(svc);
                  }}
                >
                  {SERVICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <legend className="studio-label">{t("warehouse_cn.rate.drawer.source")}</legend>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "500 12.5px/1.4 var(--f-sans)" }}>
                  <input type="radio" name="modo" checked={modo === "propuesta"} onChange={() => setModo("propuesta")} />
                  <span>
                    {t("warehouse_cn.rate.drawer.mode_proposal")}
                    <span style={{ display: "block", color: "var(--ink-soft)" }}>{propuestaTexto(data.propuesta)}</span>
                  </span>
                </label>
                {data.acceptedQuotes.length > 0 && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", font: "500 12.5px/1.4 var(--f-sans)" }}>
                    <input type="radio" name="modo" checked={modo === "estimado"} onChange={() => setModo("estimado")} />
                    <span>{t("warehouse_cn.rate.drawer.mode_quote")}</span>
                  </label>
                )}
                {data.canElevate && (
                  <>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", font: "500 12.5px/1.4 var(--f-sans)" }}>
                      <input type="radio" name="modo" checked={modo === "manual"} onChange={() => setModo("manual")} />
                      <span>{t("warehouse_cn.rate.drawer.mode_manual")}</span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", font: "500 12.5px/1.4 var(--f-sans)" }}>
                      <input type="radio" name="modo" checked={modo === "excel_yiwu"} onChange={() => setModo("excel_yiwu")} />
                      <span>{t("warehouse_cn.rate.drawer.mode_excel")}</span>
                    </label>
                  </>
                )}
              </fieldset>
              {fieldError("source")}

              {modo === "estimado" && (
                <div>
                  <label className="studio-label" htmlFor={`${formId}-estimado`}>
                    {t("warehouse_cn.rate.drawer.quote")}
                  </label>
                  <select
                    id={`${formId}-estimado`}
                    className="studio-input"
                    value={quoteId}
                    onChange={(e) => setQuoteId(e.target.value)}
                  >
                    <option value="">{t("warehouse_cn.rate.drawer.quote_pick")}</option>
                    {data.acceptedQuotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quote_code} · {fmtUsd(q.rate_per_cbm)}/m³
                      </option>
                    ))}
                  </select>
                  {fieldError("quoteId")}
                </div>
              )}

              {aMano && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
                  <div>
                    <label className="studio-label" htmlFor={`${formId}-per`}>
                      {t("warehouse_cn.rate.drawer.per_cbm")}
                    </label>
                    <NumericInput id={`${formId}-per`} type="currency" min={0} value={perCbm} onChange={setPerCbm} />
                    {fieldError("perCbm")}
                  </div>
                  <div>
                    <label className="studio-label" htmlFor={`${formId}-min`}>
                      {t("warehouse_cn.rate.drawer.min")}
                    </label>
                    <NumericInput id={`${formId}-min`} type="currency" min={0} value={minCharge} onChange={setMinCharge} />
                    {fieldError("minCharge")}
                  </div>
                </div>
              )}

              <div>
                <label className="studio-label" htmlFor={`${formId}-kg`}>
                  {t("warehouse_cn.rate.drawer.weight_rule")}
                </label>
                <select
                  id={`${formId}-kg`}
                  className="studio-input"
                  value={kg}
                  onChange={(e) => setKg(Number(e.target.value) === 1000 ? 1000 : 500)}
                  aria-describedby={`${formId}-kg-ayuda`}
                >
                  <option value={500}>{t("warehouse_cn.rate.drawer.kg_rule")}</option>
                  {data.canElevate && <option value={1000}>{t("warehouse_cn.rate.drawer.kg_exception")}</option>}
                </select>
                <p id={`${formId}-kg-ayuda`} style={{ margin: "4px 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {t("warehouse_cn.rate.drawer.excess_not_charged")}
                </p>
                {fieldError("includedKgPerCbm")}
              </div>

              {(motivoObligatorio || reason !== "") && (
                <div>
                  <label className="studio-label" htmlFor={`${formId}-motivo`}>
                    {t("warehouse_cn.rate.drawer.reason")}
                  </label>
                  <textarea
                    id={`${formId}-motivo`}
                    className="studio-input"
                    rows={3}
                    maxLength={MOTIVO_MAX}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-describedby={`${formId}-motivo-ayuda`}
                    required={motivoObligatorio}
                  />
                  <p id={`${formId}-motivo-ayuda`} style={{ margin: "4px 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {t("warehouse_cn.rate.drawer.reason_help", { min: MOTIVO_MIN })}
                  </p>
                  {fieldError("reason")}
                </div>
              )}

              {/* Quedaría así */}
              <div
                role="status"
                aria-live="polite"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "12px 14px",
                  background: "var(--bg-elevated)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2)",
                }}
              >
                <span className="studio-eyebrow">{t("warehouse_cn.rate.drawer.preview")}</span>
                {previewMostrada ? (
                  <Resumen s={previewMostrada} />
                ) : (
                  <span style={{ font: "500 12.5px/1.4 var(--f-sans)", color: previewErrorMostrado ? "var(--danger)" : "var(--ink-soft)" }}>
                    {previewErrorMostrado ?? t("warehouse_cn.rate.drawer.preview_empty")}
                  </span>
                )}
              </div>

              {submitError && (
                <p role="alert" style={{ margin: 0, font: "600 12.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
                  {submitError}
                </p>
              )}
            </section>

            {/* Historial */}
            {data.history.some((s) => s.superseded_at != null) && (
              <section aria-labelledby={`${formId}-historial`} style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                <h3 id={`${formId}-historial`} className="studio-eyebrow" style={{ margin: 0 }}>
                  {t("warehouse_cn.rate.drawer.history")}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                  {data.history
                    .filter((s) => s.superseded_at != null)
                    .map((s) => (
                      <li
                        key={s.id}
                        style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--s-2)", font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
                      >
                        <span className="mono" style={{ fontFamily: "var(--f-mono)", color: "var(--ink)" }}>
                          {fmtUsd(s.per_cbm)}/m³ · {fmtUsd(s.amount_to_invoice)}
                        </span>
                        {" · "}
                        {t(RATE_SOURCE_LABEL_KEYS[s.source])}
                        {" · "}
                        {t("warehouse_cn.rate.drawer.replaced_at", { date: fmtFecha(s.superseded_at as string) })}
                        {s.reason && <span style={{ display: "block" }}>{s.reason}</span>}
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </form>
      <DrawerFooter
        formId={formId}
        onClose={() => onClose(changed)}
        isPending={saving}
        canSubmit={puedeEnviar}
        submitLabel={reemplazo ? t("warehouse_cn.rate.drawer.submit_replace") : t("warehouse_cn.rate.drawer.submit_freeze")}
        pendingLabel={t("warehouse_cn.rate.drawer.submitting")}
        cancelLabel={t("warehouse_cn.rate.drawer.close")}
      />
    </DrawerShell>
  );
}
