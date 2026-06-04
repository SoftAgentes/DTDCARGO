"use client";

/**
 * ParametrosPanel — pestaña "Parámetros" del módulo Tarifas (calculadora Fase 3 Slice A).
 *
 * Edita las REGLAS escalares del calculador público LCL DDP (peso incluido,
 * $/kg excedente, descuento Valencia, ×baterías, km del casco, $/km, embalaje
 * especial). La tarifa base ($/CBM) y el piso NO se editan acá — son la tarifa
 * pública del calculador, en la pestaña Tarifas (marcá una tarifa como
 * "Pública · calc"). Publicación instantánea: al guardar, revalidatePath
 * refresca el calculador del sitio.
 *
 * Form submit estándar (useActionState + saveCalculatorSettingsAction). Los
 * NumericInput postean el value canónico via hidden input (name = key).
 */

import { useActionState, useEffect, useState } from "react";
import {
  CALC_FIELDS,
  DEFAULT_CALCULATOR_SETTINGS,
  type CalcFieldMeta,
  type CalculatorSettings,
  type CalculatorSettingsActionState,
  type CalculatorSettingsInput,
} from "@/lib/studio/calculator-settings-types";
import { saveCalculatorSettingsAction } from "../actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Icon } from "@/app/studio/_components/icons";

const initialState: CalculatorSettingsActionState = {};

type FieldKey = keyof CalculatorSettingsInput;

/** Agrupación visual de los 8 parámetros (jerarquía para el operador). */
const GROUPS: { title: string; keys: FieldKey[] }[] = [
  {
    title: "Peso por CBM",
    keys: ["pesoIncluidoKg", "pesoMaxKg", "recargoExcedenteKg"],
  },
  {
    title: "Recargos y descuentos",
    keys: ["descuentoValencia", "recargoEmbalajeEspecial", "recargoBateriaMult"],
  },
  {
    title: "Distancia · casco central",
    keys: ["thresholdCascoKm", "tarifaKmFueraCasco"],
  },
];

const FIELD_BY_KEY = Object.fromEntries(
  CALC_FIELDS.map((f) => [f.key, f]),
) as Record<FieldKey, CalcFieldMeta>;

export function ParametrosPanel({
  settings,
}: {
  settings: CalculatorSettings | null;
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    saveCalculatorSettingsAction,
    initialState,
  );

  // Valores iniciales: los guardados o los defaults (= CONFIG histórico).
  // Tomamos SOLO las 8 claves de CalcParams (settings trae además tenant_id /
  // timestamps que no van al form).
  const source = settings ?? DEFAULT_CALCULATOR_SETTINGS;
  const initialValues = Object.fromEntries(
    CALC_FIELDS.map((f) => [f.key, source[f.key]]),
  ) as Record<FieldKey, number | null>;
  const [values, setValues] =
    useState<Record<FieldKey, number | null>>(initialValues);

  // ¿El usuario editó/restauró desde el último submit? Si sí, ocultamos los
  // errores server-side viejos (que ya no aplican a los valores actuales).
  const [dirty, setDirty] = useState(false);

  // Cada resultado nuevo de la action (ok o error) revalida los valores
  // actuales → limpiamos dirty para volver a mostrar errores si los hubo.
  useEffect(() => {
    setDirty(false);
  }, [state]);

  // Feedback de guardado (sin row → solo toast, Regla 4 de trazabilidad).
  useEffect(() => {
    if (state.ok) {
      toast.success("Parámetros guardados · el calculador del sitio ya los toma.");
    }
  }, [state, toast]);

  const setField = (key: FieldKey, v: number | null) => {
    setDirty(true);
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const restoreDefaults = () => {
    setDirty(true);
    setValues({ ...DEFAULT_CALCULATOR_SETTINGS });
  };

  const usingDefaults = settings == null;

  return (
    <div style={{ maxWidth: 880 }}>
      {/* Aviso: dónde vive la tarifa base (no acá) */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "12px 16px",
          marginBottom: 20,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span
          style={{
            color: "var(--ink-soft)",
            flexShrink: 0,
            marginTop: 1,
            display: "inline-flex",
          }}
        >
          {Icon.info(15)}
        </span>
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Acá editás las <strong style={{ color: "var(--ink)" }}>reglas</strong> del
          calculador público. La <strong style={{ color: "var(--ink)" }}>tarifa
          base ($/CBM)</strong> y el <strong style={{ color: "var(--ink)" }}>piso
          mínimo</strong> viven en la pestaña <em>Tarifas</em>: marcá una tarifa por
          CBM como <em>Pública · calc</em>.
          {usingDefaults && (
            <>
              {" "}Todavía no guardaste parámetros — el sitio usa los valores por
              defecto.
            </>
          )}
        </p>
      </div>

      <form action={formAction}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {GROUPS.map((group) => (
            <fieldset
              key={group.title}
              style={{ border: 0, margin: 0, padding: 0 }}
            >
              <legend
                className="studio-eyebrow"
                style={{ marginBottom: 14, color: "var(--ink-soft)" }}
              >
                {group.title}
              </legend>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                {group.keys.map((key) => {
                  const f = FIELD_BY_KEY[key];
                  const err = dirty ? undefined : state.fieldErrors?.[key];
                  return (
                    <div key={key}>
                      <label
                        className="studio-label"
                        htmlFor={`calc-${key}`}
                        style={{ display: "block", marginBottom: 6 }}
                      >
                        {f.label}
                      </label>
                      <NumericInput
                        id={`calc-${key}`}
                        name={key}
                        type={f.kind}
                        unit={f.unit}
                        precision={f.precision}
                        required
                        min={f.min}
                        value={values[key]}
                        onChange={(v) => setField(key, v)}
                        aria-invalid={!!err}
                      />
                      <p
                        style={{
                          // --ink-soft (no --ink-mute): el hint es texto legible y
                          // --ink-mute (#9B9B9B) no pasa WCAG AA sobre fondo claro.
                          font: "400 11.5px/1.4 var(--f-sans)",
                          color: err ? "var(--danger)" : "var(--ink-soft)",
                          margin: "4px 0 0",
                        }}
                      >
                        {err ?? f.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* Error global de la action */}
        {!dirty && state.error && (
          <p
            role="alert"
            style={{
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: "20px 0 0",
            }}
          >
            {state.error}
          </p>
        )}

        {/* Footer · ghost a la izquierda, primary a la derecha (Regla 8) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={restoreDefaults}
            disabled={isPending}
          >
            Restaurar valores por defecto
          </button>
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "Guardando…" : "Guardar parámetros"}
          </button>
        </div>
      </form>
    </div>
  );
}
