"use client";

/**
 * RulesClient — orquestador del editor de reglas del Despacho (SDD-0029 Vista 2).
 *
 * - Card política de pago (radio buttons + whitelist editor)
 * - Card pesos (6 sliders 0-50)
 * - Card opcionales (toggles tier + routes)
 * - Card VIP markboxes (textarea CSV)
 * - Botones de preset (Equilibrado / FIFO / Personalizado)
 * - Submit via useActionState
 */

import { useActionState, useState } from "react";
import { updateDispatchRulesAction } from "../actions";
import {
  DEFAULT_WEIGHTS,
  PAYMENT_POLICY_LABELS,
  PRESET_EQUILIBRADO,
  PRESET_FIFO,
  WEIGHT_HINTS,
  WEIGHT_LABELS,
  WEIGHT_MAX,
  type DispatchPaymentPolicy,
  type DispatchRules,
  type DispatchRulesActionState,
  type DispatchWeights,
} from "@/lib/studio/dispatch-rules-types";

const INITIAL_STATE: DispatchRulesActionState = {};

export function RulesClient({ initialRules }: { initialRules: DispatchRules }) {
  const [policy, setPolicy] = useState<DispatchPaymentPolicy>(initialRules.payment_policy);
  const [whitelist, setWhitelist] = useState<string>(initialRules.whitelist_markboxes.join(", "));
  const [weights, setWeights] = useState<DispatchWeights>(initialRules.weights ?? DEFAULT_WEIGHTS);
  const [optionalTier, setOptionalTier] = useState<boolean>(initialRules.optional_rules?.tier ?? false);
  const [optionalRoutes, setOptionalRoutes] = useState<boolean>(initialRules.optional_rules?.routes ?? true);
  const [vipMarkboxes, setVipMarkboxes] = useState<string>(initialRules.vip_markboxes.join(", "));

  const [state, formAction, isPending] = useActionState(updateDispatchRulesAction, INITIAL_STATE);

  const applyPreset = (preset: DispatchWeights) => setWeights(preset);

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hidden inputs for weights (controlled state via JSON-safe value attrs) */}
      <input type="hidden" name="payment_policy" value={policy} />
      <input type="hidden" name="whitelist_markboxes" value={whitelist} />
      <input type="hidden" name="vip_markboxes" value={vipMarkboxes} />
      {(Object.keys(weights) as Array<keyof DispatchWeights>).map((k) => (
        <input key={k} type="hidden" name={`weights.${k}`} value={weights[k]} />
      ))}
      <input type="hidden" name="optional_rules.tier" value={optionalTier ? "on" : "off"} />
      <input type="hidden" name="optional_rules.routes" value={optionalRoutes ? "on" : "off"} />

      {/* Política de pago (anclada arriba · plegable) */}
      <Card
        title="Política de pago"
        eyebrow="REGLA ANCLADA · NO SE PUEDE APAGAR"
        collapsible
        defaultOpen
        summary={
          <>
            Modo: <b>{PAYMENT_POLICY_LABELS[policy]}</b>
            {policy === "credito_whitelist" &&
              ` · ${whitelist.split(/[,\n]/).filter((s) => s.trim()).length} markboxes en whitelist`}
          </>
        }
      >
        <p style={hintStyle}>
          Es el filtro estructural sobre la cola. Determina qué paquetes pueden
          aparecer (o aparecen greyed-out). No se le da slider porque no es un peso
          más — es un decisor binario.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {(Object.keys(PAYMENT_POLICY_LABELS) as DispatchPaymentPolicy[]).map((p) => (
            <label
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                background: policy === p ? "var(--wine-tint)" : "var(--bg-elevated)",
                border: `1.5px solid ${policy === p ? "var(--wine)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                checked={policy === p}
                onChange={() => setPolicy(p)}
                style={{ accentColor: "var(--wine)" }}
              />
              <div>
                <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                  {PAYMENT_POLICY_LABELS[p]}
                </div>
                {p === "credito_whitelist" && (
                  <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
                    Solo los MARKBOX en la whitelist pueden despacharse sin pago completo.
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        {policy === "credito_whitelist" && (
          <div style={{ marginTop: 16 }}>
            <label className="studio-label" htmlFor="whitelist-input">
              Markboxes habilitados sin pago
            </label>
            <textarea
              id="whitelist-input"
              className="studio-input"
              rows={3}
              placeholder="DTD-5452, DTD-5392, DTD-5340"
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              style={{ resize: "vertical", marginTop: 6 }}
            />
            <p style={{ ...hintStyle, marginTop: 6 }}>
              Separá por coma o nueva línea. Formato esperado: <code>DTD-XXXX</code>.
            </p>
          </div>
        )}
      </Card>

      {/* Pesos del scoring */}
      <Card
        title="Pesos del scoring"
        eyebrow={`SUMA TOTAL · ${totalWeight}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => applyPreset(PRESET_EQUILIBRADO)} className="studio-btn studio-btn-ghost studio-btn-sm">
              Preset Equilibrado
            </button>
            <button type="button" onClick={() => applyPreset(PRESET_FIFO)} className="studio-btn studio-btn-ghost studio-btn-sm">
              Preset FIFO
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {(Object.keys(weights) as Array<keyof DispatchWeights>).map((k) => (
            <WeightSlider
              key={k}
              label={WEIGHT_LABELS[k]}
              hint={WEIGHT_HINTS[k]}
              value={weights[k]}
              onChange={(v) => setWeights({ ...weights, [k]: v })}
            />
          ))}
        </div>
      </Card>

      {/* Opcionales · plegable */}
      <Card
        title="Reglas opcionales"
        eyebrow="ACTIVÁ SI VALE"
        collapsible
        defaultOpen={false}
        summary={
          <>
            {[optionalTier && "Tier", optionalRoutes && "Rutas"]
              .filter(Boolean)
              .join(" · ") || "Ninguna activa"}{" "}
            · {[optionalTier, optionalRoutes].filter(Boolean).length} de 2
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Toggle
            label="Tier de cliente"
            hint="Suma el peso VIP a clientes Gold/Platinum (tier del módulo Clientes)."
            checked={optionalTier}
            onChange={setOptionalTier}
          />
          <Toggle
            label="Cercanía a ruta"
            hint="Aplica el peso route_proximity (0-5 calculado por backend)."
            checked={optionalRoutes}
            onChange={setOptionalRoutes}
          />
        </div>
      </Card>

      {/* VIP markboxes · plegable */}
      <Card
        title="MARKBOX VIP"
        eyebrow="LISTA MANUAL · ALTERNATIVA AL TIER"
        collapsible
        defaultOpen={false}
        summary={
          <>
            {vipMarkboxes.split(/[,\n]/).filter((s) => s.trim()).length} markboxes
            cargados
          </>
        }
      >
        <p style={hintStyle}>
          Markboxes que reciben el peso VIP aunque no estén marcados como Gold/Platinum
          en Clientes. Útil si el módulo de tiers no está alineado con tu prioridad real.
        </p>
        <label className="studio-label" htmlFor="vip-input" style={{ marginTop: 12 }}>
          Markboxes VIP
        </label>
        <textarea
          id="vip-input"
          className="studio-input"
          rows={3}
          placeholder="DTD-5392, DTD-5452"
          value={vipMarkboxes}
          onChange={(e) => setVipMarkboxes(e.target.value)}
          style={{ resize: "vertical", marginTop: 6 }}
        />
      </Card>

      {/* Feedback + submit */}
      {state?.error && (
        <div
          style={{
            padding: 12,
            background: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: "var(--r-md)",
            font: "600 13px/1.3 var(--f-sans)",
          }}
        >
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div
          style={{
            padding: 12,
            background: "var(--success-bg)",
            color: "var(--success)",
            borderRadius: "var(--r-md)",
            font: "600 13px/1.3 var(--f-sans)",
          }}
        >
          Reglas guardadas. Se aplican al instante en la cola.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="submit"
          className="studio-btn studio-btn-primary"
          disabled={isPending}
        >
          {isPending ? "Guardando…" : "Guardar reglas"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────

function Card({
  title,
  eyebrow,
  action,
  collapsible = false,
  defaultOpen = true,
  summary,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  /** Si true, el body es plegable con chevron clickeable. */
  collapsible?: boolean;
  /** Estado inicial cuando collapsible=true. Ignorado si !collapsible. */
  defaultOpen?: boolean;
  /** Sub-line visible cuando colapsado (resumen del estado · ej: "Modo: Estricto"). */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open;

  return (
    <div
      style={{
        padding: 20,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: isOpen ? 14 : 0,
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={collapsible ? () => setOpen(!open) : undefined}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: collapsible ? "pointer" : "default",
            textAlign: "left",
          }}
          aria-expanded={collapsible ? isOpen : undefined}
        >
          {collapsible && (
            <span
              style={{
                color: "var(--ink-mute)",
                marginTop: 4,
                fontSize: 12,
                transform: `rotate(${isOpen ? 90 : 0}deg)`,
                transition: "transform 160ms ease",
                display: "inline-flex",
                flexShrink: 0,
              }}
              aria-hidden
            >
              ▸
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {eyebrow && (
              <div
                className="studio-eyebrow"
                style={{ color: "var(--wine)", marginBottom: 6 }}
              >
                {eyebrow}
              </div>
            )}
            <div style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)" }}>
              {title}
            </div>
            {collapsible && !isOpen && summary && (
              <div
                style={{
                  font: "500 12px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 6,
                }}
              >
                {summary}
              </div>
            )}
          </div>
        </button>
        {action}
      </div>
      {isOpen && children}
    </div>
  );
}

function WeightSlider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--ink)" }}>{label}</span>
        <code style={{ font: "800 14px/1 var(--f-mono)", color: "var(--wine)" }}>{value}</code>
      </div>
      <input
        type="range"
        min={0}
        max={WEIGHT_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--wine)" }}
      />
      <p style={{ ...hintStyle, marginTop: 4 }}>{hint}</p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, accentColor: "var(--wine)" }}
      />
      <div>
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{label}</div>
        <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 3 }}>
          {hint}
        </div>
      </div>
    </label>
  );
}

const hintStyle: React.CSSProperties = {
  font: "500 11.5px/1.4 var(--f-sans)",
  color: "var(--ink-soft)",
  margin: 0,
};
