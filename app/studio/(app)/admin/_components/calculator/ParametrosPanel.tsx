"use client";

/**
 * ParametrosPanel — sub-pestaña "Parámetros" de la sección Calculadora pública
 * (Administración · grupo PRO). Movido desde el módulo Tarifas.
 *
 * Edita las REGLAS escalares del calculador público LCL DDP (peso incluido,
 * $/kg excedente, descuento Valencia, ×baterías, embalaje especial y los topes
 * de cotización automática). El precio de la ENTREGA NACIONAL no se toca acá:
 * vive en el tarifario del transportista (sub-pestaña Transportistas), porque
 * desde SDD-0237 se cobra por m³ y no por kilómetro.
 * La tarifa base ($/CBM) y el piso NO se editan acá — son la tarifa
 * pública del calculador, en el módulo Tarifas (marca una tarifa como
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
import { saveCalculatorSettingsAction } from "../../calculator-actions";
import { WeightModelExplainer } from "./WeightModelExplainer";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Icon } from "@/app/studio/_components/icons";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const initialState: CalculatorSettingsActionState = {};

type FieldKey = keyof CalculatorSettingsInput;

/**
 * Agrupación visual de los parámetros (jerarquía para el operador). Dos familias:
 * las que ajustan el PRECIO (siempre cotiza) y los "Límites de cotización
 * automática" — topes por encima de los cuales la máquina NO cotiza y deriva al
 * asesor (peso por envío + límites físicos del contenedor).
 */
const GROUPS: { title: string; keys: FieldKey[] }[] = [
  {
    title: "Modelo de peso",
    keys: ["pesoIncluidoKg", "recargoExcedenteKg"],
  },
  {
    title: "Recargos y descuentos",
    keys: ["descuentoValencia", "recargoEmbalajeEspecial", "recargoBateriaMult"],
  },
  {
    title: "Límites de cotización automática",
    keys: ["pesoMaxEnvioKg", "cbmMaxContenedor", "pesoMaxContenedorKg"],
  },
];

/**
 * Parámetros que YA NO MUEVEN UN CENTAVO (SDD-0237) y por eso salieron del form.
 *
 * El "radio del casco central" y el "$/km fuera del casco" fijaban la entrega
 * nacional con `max(0, km − 200) × $1`. Esa fórmula murió: hoy se cobra
 * `CBM × precio del tramo`. Dejarlos editables era peor que inútil — invitaba
 * al operador a "arreglar" un precio moviendo un número que el motor ignora.
 *
 * Las columnas SIGUEN en `calculator_settings` (quitarlas es una migración
 * destructiva que no vale la pena), y `validateCalculatorSettingsInput` exige
 * las 10 claves. Por eso viajan como hidden con su valor guardado: el form
 * guarda sin tocarlas. Si algún día se borran de la DB, esto se va con ellas.
 */
const LEGACY_KEYS: FieldKey[] = ["thresholdCascoKm", "tarifaKmFueraCasco"];

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
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDirty(false);
    });
    return () => {
      cancelled = true;
    };
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
      <WeightModelExplainer />

      {/* Aviso: dónde vive la tarifa base (no acá) */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "var(--s-3) var(--s-4)",
          marginBottom: "var(--s-5)",
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
          Acá editas las <strong style={{ color: "var(--ink)" }}>reglas</strong> del
          calculador público. La <strong style={{ color: "var(--ink)" }}>tarifa
          base ($/CBM)</strong> y el <strong style={{ color: "var(--ink)" }}>piso
          mínimo</strong> viven en el módulo <em>Tarifas</em>: marca una tarifa por
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
                  gap: "var(--s-4)",
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

        {/* Legacy sin UI: se repostean tal cual para que el guardado no los
            pise ni falle la validación. Ver LEGACY_KEYS arriba. */}
        {LEGACY_KEYS.map((key) => (
          <input
            key={key}
            type="hidden"
            name={key}
            value={values[key] ?? DEFAULT_CALCULATOR_SETTINGS[key]}
          />
        ))}

        {/* Error global de la action */}
        {!dirty && state.error && (
          <div style={{ marginTop: 20 }}>
            <Aviso tono="error" compacto>
              {state.error}
            </Aviso>
          </div>
        )}

        {/* Footer · ghost a la izquierda, primary a la derecha (Regla 8) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--s-3)",
            marginTop: 28,
            paddingTop: "var(--s-5)",
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
