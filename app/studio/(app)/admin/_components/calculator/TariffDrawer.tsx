"use client";

/**
 * TariffDrawer — agregar o editar la tarifa de UNA ciudad con un transportista
 * (Administración · Calculadora pública · Transportistas). SDD-0537.
 *
 * Mismo patrón que CityDrawer: panel lateral, `useActionState` con
 * `saveTariffAction`, envío manual para que un error no borre lo escrito.
 *
 * ⚠️ El margen es una RESTA en vivo (venta − costo) y la venta NO se deriva del
 * costo: son dos números negociados por separado (SDD-0236). Nada en este
 * formulario rellena la venta a partir del costo.
 */

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cbmAFt3,
  margenTone,
  referenciaFt3Desfasada,
  tardaMasDeLoNormal,
  usd,
  usdConSigno,
  type CarrierTariff,
  type FreightCarrier,
} from "@/lib/studio/freight-carriers/types";
import { saveTariffAction, type TariffActionState } from "../../carrier-actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Icon } from "@/app/studio/_components/icons";

export type CityOption = { slug: string; label: string };

const initialState: TariffActionState = {};
const FORM_ID = "tariff-drawer-form";

export function TariffDrawer({
  mode,
  carrier,
  tariff,
  cityLabel,
  availableCities = [],
  onClose,
}: {
  mode: "create" | "edit";
  carrier: FreightCarrier;
  /** Obligatoria en `edit`. */
  tariff?: CarrierTariff;
  /** Nombre visible de la ciudad en `edit`. */
  cityLabel?: string;
  /** Ciudades del catálogo que el transportista todavía no tiene (`create`). */
  availableCities?: CityOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveTariffAction, initialState);
  const toast = useToast();
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement>(null);

  const [citySlug, setCitySlug] = useState(tariff?.citySlug ?? "");
  const [costo, setCosto] = useState<number | null>(tariff?.costUsdCbm ?? null);
  const [venta, setVenta] = useState<number | null>(tariff?.priceUsdCbm ?? null);
  const [ft3, setFt3] = useState<number | null>(tariff?.priceUsdFt3 ?? null);
  const [dias, setDias] = useState<number | null>(tariff?.dispatchFrequencyDays ?? null);

  const etiqueta =
    mode === "edit"
      ? (cityLabel ?? tariff?.citySlug ?? "")
      : (availableCities.find((c) => c.slug === citySlug)?.label ?? "");

  useEffect(() => {
    if (!state.ok) return;
    toast.success(
      mode === "create"
        ? `${etiqueta} agregada a ${carrier.name}`
        : `Tarifa de ${etiqueta} actualizada`,
    );
    router.refresh();
    router.push(
      `/studio/admin?section=calculadora&tab=transportistas&highlight=${encodeURIComponent(
        citySlug,
      )}&hl-tone=${mode === "create" ? "warm" : "success"}`,
    );
    onClose();
    // Sólo debe correr cuando la acción responde ok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  const margen = costo != null && venta != null ? Math.round((venta - costo) * 100) / 100 : null;
  const tono = margen == null ? null : margenTone(margen);
  const desfasada = referenciaFt3Desfasada(venta, ft3);
  const sinCiudades = mode === "create" && availableCities.length === 0;

  return (
    <DrawerShell
      title={mode === "create" ? "Agregar ciudad" : `Editar ${etiqueta}`}
      subtitle={`Tarifa con ${carrier.name}`}
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      <form
        id={FORM_ID}
        aria-busy={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (isPending) return;
          // El dispatch manual evita que React borre el borrador ante un error.
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <input type="hidden" name="carrierId" value={carrier.id} />
        {mode === "edit" && tariff && <input type="hidden" name="id" value={tariff.id} />}

        {/* ── Ciudad ── */}
        {mode === "edit" ? (
          <input type="hidden" name="citySlug" value={citySlug} />
        ) : (
          <div>
            <label className="studio-label" htmlFor="tariff-city">
              Ciudad <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <select
              id="tariff-city"
              name="citySlug"
              className="studio-input"
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              required
              disabled={sinCiudades}
              aria-invalid={state.fieldErrors?.citySlug ? true : undefined}
            >
              <option value="">
                {sinCiudades ? "Ya tiene todas las ciudades del catálogo" : "Escoge una ciudad…"}
              </option>
              {availableCities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <Hint>
              Solo aparecen las ciudades de la pestaña Ciudades que este transportista
              todavía no cubre.
            </Hint>
            {state.fieldErrors?.citySlug && <FieldError msg={state.fieldErrors.citySlug} />}
          </div>
        )}

        {/* ── Precio por m³ ── */}
        <Grupo titulo="Precio por m³">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
            <div>
              <label className="studio-label" htmlFor="tariff-cost">
                Costo /m³ <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <NumericInput
                id="tariff-cost"
                name="costUsdCbm"
                type="currency"
                min={0}
                required
                placeholder="80"
                defaultValue={tariff?.costUsdCbm ?? null}
                onChange={setCosto}
                aria-invalid={state.fieldErrors?.costUsdCbm ? true : undefined}
              />
              <Hint>Lo que nos cobra el transportista.</Hint>
              {state.fieldErrors?.costUsdCbm && <FieldError msg={state.fieldErrors.costUsdCbm} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="tariff-price">
                Venta /m³ <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <NumericInput
                id="tariff-price"
                name="priceUsdCbm"
                type="currency"
                min={0}
                required
                placeholder="123,60"
                defaultValue={tariff?.priceUsdCbm ?? null}
                onChange={setVenta}
                aria-invalid={state.fieldErrors?.priceUsdCbm ? true : undefined}
              />
              <Hint>Lo que cotiza la web al cliente.</Hint>
              {state.fieldErrors?.priceUsdCbm && <FieldError msg={state.fieldErrors.priceUsdCbm} />}
            </div>
          </div>

          <div
            role="status"
            aria-live="polite"
            aria-label="Margen por m³"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              background: "var(--bg-elevated)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
              Margen /m³ <span style={{ color: "var(--ink-soft)" }}>(venta − costo)</span>
            </span>
            <span
              data-testid="tariff-margin"
              style={{
                font: "700 15px/1 var(--f-mono)",
                fontVariantNumeric: "tabular-nums",
                // --ink y no --success: el verde como texto da 4,33:1 sobre
                // blanco y no pasa AA (BRAND regla 6). El rojo se queda para
                // el margen negativo, que es lo que hay que ver.
                color: tono === "negative" ? "var(--danger)" : "var(--ink)",
              }}
            >
              {margen == null ? "—" : usdConSigno(margen)}
            </span>
            {venta != null && (
              <span style={{ flexBasis: "100%", font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                La venta equivale a {usd(cbmAFt3(venta))} por ft³.
                {tono === "negative" && " La venta queda por debajo del costo: DTD pone la diferencia."}
              </span>
            )}
          </div>
        </Grupo>

        {/* ── Salidas ── */}
        <Grupo titulo="Salidas">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
            <div>
              <label className="studio-label" htmlFor="tariff-days">
                Cada cuántos días sale
              </label>
              <NumericInput
                id="tariff-days"
                name="dispatchFrequencyDays"
                type="count"
                unit="días"
                min={1}
                placeholder="7"
                defaultValue={tariff?.dispatchFrequencyDays ?? null}
                onChange={setDias}
                aria-invalid={state.fieldErrors?.dispatchFrequencyDays ? true : undefined}
              />
              {tardaMasDeLoNormal(dias) ? (
                <Hint tone="warning">
                  Más de 8 días: la web le avisa al cliente que puede tardar hasta una semana más.
                </Hint>
              ) : (
                <Hint>7 = semanal · 15 = quincenal.</Hint>
              )}
              {state.fieldErrors?.dispatchFrequencyDays && (
                <FieldError msg={state.fieldErrors.dispatchFrequencyDays} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="tariff-departure">
                Días de salida
              </label>
              <input
                id="tariff-departure"
                name="departureFrequency"
                type="text"
                className="studio-input"
                defaultValue={tariff?.departureFrequency ?? ""}
                placeholder="1 vez por semana · lunes"
                maxLength={200}
              />
              <Hint>Como lo dice el transportista.</Hint>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="studio-label" htmlFor="tariff-transit">
              Tránsito
            </label>
            <input
              id="tariff-transit"
              name="transitDays"
              type="text"
              className="studio-input"
              defaultValue={tariff?.transitDays ?? ""}
              placeholder="24 a 72 horas"
              maxLength={120}
            />
          </div>
        </Grupo>

        {/* ── Condiciones ── */}
        <Grupo titulo="Condiciones">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
            <div>
              <label className="studio-label" htmlFor="tariff-min">
                Mínimo por despacho
              </label>
              <NumericInput
                id="tariff-min"
                name="minChargeUsd"
                type="currency"
                min={0}
                placeholder="Sin mínimo"
                defaultValue={tariff?.minChargeUsd ?? null}
                aria-invalid={state.fieldErrors?.minChargeUsd ? true : undefined}
              />
              {state.fieldErrors?.minChargeUsd && <FieldError msg={state.fieldErrors.minChargeUsd} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="tariff-ft3">
                Venta en ft³ (referencia)
              </label>
              <NumericInput
                id="tariff-ft3"
                name="priceUsdFt3"
                type="currency"
                min={0}
                precision={2}
                placeholder="3,50"
                defaultValue={tariff?.priceUsdFt3 ?? null}
                onChange={setFt3}
                aria-invalid={state.fieldErrors?.priceUsdFt3 ? true : undefined}
              />
              {desfasada ? (
                <Hint tone="warning">
                  Ya no coincide con la venta por m³. Actualízala o déjala vacía.
                </Hint>
              ) : (
                <Hint>La oferta original en pie cúbico. No se usa para cobrar.</Hint>
              )}
              {state.fieldErrors?.priceUsdFt3 && <FieldError msg={state.fieldErrors.priceUsdFt3} />}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="studio-label" htmlFor="tariff-conditions">
              Qué exigen para sostener el precio
            </label>
            <textarea
              id="tariff-conditions"
              name="conditions"
              className="studio-input"
              rows={2}
              defaultValue={tariff?.conditions ?? ""}
              maxLength={2000}
              style={{ resize: "vertical" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)", marginTop: 12 }}>
            <div>
              <label className="studio-label" htmlFor="tariff-from">
                Vigente desde
              </label>
              <input
                id="tariff-from"
                name="validFrom"
                type="date"
                className="studio-input"
                defaultValue={tariff?.validFrom ?? ""}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="tariff-to">
                Vigente hasta
              </label>
              <input
                id="tariff-to"
                name="validTo"
                type="date"
                className="studio-input"
                defaultValue={tariff?.validTo ?? ""}
                aria-invalid={state.fieldErrors?.validTo ? true : undefined}
              />
              {state.fieldErrors?.validTo && <FieldError msg={state.fieldErrors.validTo} />}
            </div>
          </div>
          <Hint>Fuera de la vigencia, la web no cotiza esta ciudad y deriva al asesor.</Hint>
        </Grupo>

        {state.error && (
          <p
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink)",
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

        <div style={{ flex: 1, minHeight: 12 }} />
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
          form={FORM_ID}
          className="studio-btn studio-btn-primary"
          disabled={isPending || sinCiudades}
        >
          {isPending ? "Guardando…" : mode === "create" ? "Agregar ciudad" : "Guardar cambios"}
        </button>
      </footer>
    </DrawerShell>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend
        className="studio-eyebrow"
        style={{ color: "var(--ink-soft)", marginBottom: 10, padding: 0 }}
      >
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Ayuda bajo el campo. El tono de advertencia NO pinta el texto de
 * `--warning` (≈3:1 sobre blanco, falla AA): lleva el ícono en ese color y el
 * texto en `--ink` (BRAND regla 6).
 */
function Hint({ children, tone }: { children: React.ReactNode; tone?: "warning" }) {
  return (
    <p
      style={{
        font: `${tone === "warning" ? 500 : 400} 11.5px/1.4 var(--f-sans)`,
        color: tone === "warning" ? "var(--ink)" : "var(--ink-soft)",
        margin: "4px 0 0",
        display: tone === "warning" ? "flex" : undefined,
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      {tone === "warning" && (
        <span aria-hidden="true" style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }}>
          {Icon.warn(12)}
        </span>
      )}
      <span>{children}</span>
    </p>
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
