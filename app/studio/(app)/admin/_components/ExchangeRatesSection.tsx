"use client";

/**
 * ExchangeRatesSection — sección "Tasas de cambio" del admin (SDD-0126).
 *
 * Muestra la última tasa por par (CNY/USD, VES/USD), con su fecha de valor y su
 * fuente, y registra la tasa manual de un día en `fx_rates` (SDD-0569). Una
 * segunda del mismo día la reemplaza y queda en la auditoría.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { fechaCaracas, isCalendarDate } from "@/lib/shared/fechas-caracas";
import { recordExchangeRateAction } from "../exchange-rates-actions";
import {
  FX_PAIRS,
  fxPairLabel,
  isFxOutOfRange,
  type ExchangeRateActionState,
  type ExchangeRatesOverview,
  type FxRateLatest,
  type FxPair,
} from "@/lib/studio/exchange-rates-types";

const INITIAL: ExchangeRateActionState = {};

const FUENTE: Record<"bcv" | "manual" | "operacion", string> = {
  bcv: "BCV",
  manual: "manual",
  operacion: "de una operación",
};

/** AAAA-MM-DD → DD/MM/AAAA, sin Date (una fecha sin hora corre un día con zona negativa). */
function fechaCorta(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Hoy con el calendario IANA compartido, como AAAA-MM-DD. */
function hoyEnCaracas(): string {
  return fechaCaracas();
}

/** Solo datos completos permiten atribuir una fecha y una fuente a una tasa. */
function metadataDeTasa(last: FxRateLatest | undefined) {
  if (!last || last.rate == null || !Number.isFinite(last.rate) || last.rate <= 0
    || !isCalendarDate(last.validOn) || !last.source) return null;
  return { validOn: last.validOn, source: last.source };
}

export function ExchangeRatesSection({ data }: { data: ExchangeRatesOverview }) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(recordExchangeRateAction, INITIAL);

  const [pair, setPair] = useState<FxPair>("CNY/USD");
  const [rate, setRate] = useState("");
  const [validOn, setValidOn] = useState(hoyEnCaracas);
  const [note, setNote] = useState("");

  const handled = useRef<ExchangeRateActionState | null>(null);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success("Tasa registrada");
      setRate("");
    }
  }, [state, toast]);

  const rateNum = Number(rate.replace(",", "."));
  const outOfRange = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum > 0 && isFxOutOfRange(pair, rateNum);
  const canSubmit = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum > 0 && validOn !== "";
  const latestVes = metadataDeTasa(data.latest.find((last) => last.pair === "VES/USD"));
  const bcvTodayConfirmed = latestVes?.source === "bcv" && latestVes.validOn === hoyEnCaracas();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Últimas tasas */}
      <Card>
        <CardEyebrow>Tasas vigentes</CardEyebrow>
        {!bcvTodayConfirmed && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{
              display: "flex", alignItems: "flex-start", gap: "var(--s-3)",
              padding: "var(--s-3) var(--s-4)", marginBottom: "var(--s-4)",
              background: "var(--bg-elevated)", color: "var(--ink)",
              borderRadius: "var(--r-md)", font: "400 16px/1.5 var(--f-sans)",
            }}
          >
            <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>{Icon.info(16)}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>BCV: no se confirmó una tasa para hoy.</p>
              <p style={{ margin: 0 }}>
                {latestVes
                  ? `Última tasa informada en esta vista: ${fechaCorta(latestVes.validOn)} · ${FUENTE[latestVes.source]}. `
                  : "La información disponible no permite confirmar una fecha y fuente completas. "}
                Puedes registrar una tasa manual en el formulario.
              </p>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--s-3)" }}>
          {data.latest.map((l) => (
            <div key={l.pair} style={{ padding: "var(--s-4)", background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }}>
              <div style={{ font: "600 11px/1 var(--f-sans)", color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "var(--s-2)" }}>
                {fxPairLabel(l.pair)}
              </div>
              <div style={{ font: "800 26px/1 var(--f-display)", color: "var(--ink)" }}>
                {l.rate != null ? l.rate.toLocaleString("es-VE", { maximumFractionDigits: 4 }) : "—"}
              </div>
              <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 6 }}>
                {metadataDeTasa(l) && l.source ? `del ${fechaCorta(l.validOn)} · ${FUENTE[l.source]}` : "tasa no confirmada"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Registrar tasa */}
      <Card>
        <CardEyebrow>Registrar tasa nueva</CardEyebrow>
        <form
          action={formAction}
          // React resetea el DOM al resolver la acción, incluso si devuelve error.
          // Los campos son controlados; solo el éxito confirmado vacía la tasa.
          onReset={(event) => event.preventDefault()}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-3)", alignItems: "end" }}>
            <div>
              <label className="studio-label" htmlFor="fx-pair">Par de moneda</label>
              <select
                id="fx-pair"
                name="pair"
                value={pair}
                onChange={(e) => setPair(e.target.value as FxPair)}
                className="studio-input"
                style={{ marginTop: 6 }}
              >
                {FX_PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {fxPairLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="studio-label" htmlFor="fx-rate">Tasa (1 USD = ? {pair.split("/")[0]})</label>
              <input
                id="fx-rate"
                name="rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="studio-input studio-input-mono"
                inputMode="decimal"
                placeholder={pair === "CNY/USD" ? "7.24" : "40.00"}
                style={{ marginTop: 6 }}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="fx-valid-on">Fecha de la tasa</label>
              <input
                id="fx-valid-on"
                name="valid_on"
                type="date"
                value={validOn}
                max={hoyEnCaracas()}
                onChange={(e) => setValidOn(e.target.value)}
                className="studio-input"
                style={{ marginTop: 6 }}
              />
            </div>
          </div>

          <div>
            <label className="studio-label" htmlFor="fx-note">Nota (opcional)</label>
            <input
              id="fx-note"
              name="note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="studio-input"
              placeholder="Ej.: BCV del día, o la cotización del banco"
              style={{ marginTop: 6 }}
            />
          </div>

          {outOfRange && (
            <div
              style={{
                padding: "var(--s-3)",
                background: "var(--warning-bg)",
                color: "var(--warning)",
                borderRadius: "var(--r-md)",
                font: "600 12.5px/1.4 var(--f-sans)",
              }}
            >
              Esa tasa está fuera del rango histórico habitual de {pair}. Revisa que no sea un error de tipeo (se
              guarda igual si confirmas).
            </div>
          )}

          {state?.error && (
            <div
              style={{
                padding: "var(--s-3)",
                background: "var(--danger-bg)",
                color: "var(--danger)",
                borderRadius: "var(--r-md)",
                font: "600 13px/1.3 var(--f-sans)",
              }}
            >
              {state.error}
            </div>
          )}

          <p style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Cada tasa vale para su fecha. Si registras otra del mismo día y moneda, reemplaza a la anterior y el
            cambio queda en la auditoría. Las facturas y las cuentas por pagar en bolívares o yuanes toman la
            vigente y la guardan con su fecha.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="studio-btn studio-btn-primary" disabled={isPending || !canSubmit}>
              {isPending ? "Guardando…" : "Registrar tasa"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      {children}
    </section>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 14 }}>
      {children}
    </div>
  );
}
