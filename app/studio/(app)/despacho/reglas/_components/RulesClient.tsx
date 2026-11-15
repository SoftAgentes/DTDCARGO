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

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
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
import {
  evaluatePolicy,
  scoreBreakdown,
  scoreLevel,
  SCORE_LEVEL_COLORS,
  SCORE_LEVEL_LABELS,
} from "@/lib/studio/dispatch-scoring";
import type { EligiblePackage } from "@/lib/studio/dispatch-types";

// 4 sample packages para Preview Live · cubren casos típicos
const PREVIEW_SAMPLES: EligiblePackage[] = [
  {
    id: "preview-1",
    package_kind: "warehouse_receipt_cn",
    markbox: "DTD-5392",
    client_name: "Luis Fernández",
    city: "Caracas",
    pay: "pagado",
    description: null,
    boxes_total: 4,
    weight_kg: 80,
    cbm: 1.5,
    hs_code: null,
    aes_code: null,
    received_at: "",
    route_proximity: 3,
    tier: "Platinum",
    days_in_warehouse: 8,
    score: 0,
  },
  {
    id: "preview-2",
    package_kind: "warehouse_receipt_cn",
    markbox: "DTD-5452",
    client_name: "Carlos Méndez",
    city: "Valencia",
    pay: "pagado",
    description: null,
    boxes_total: 6,
    weight_kg: 150,
    cbm: 2.8,
    hs_code: null,
    aes_code: null,
    received_at: "",
    route_proximity: 5,
    tier: "Gold",
    days_in_warehouse: 18,
    score: 0,
  },
  {
    id: "preview-3",
    package_kind: "warehouse_receipt_cn",
    markbox: "DTD-5263",
    client_name: "Sofía Linares",
    city: "Caracas",
    pay: "pendiente",
    description: null,
    boxes_total: 2,
    weight_kg: 40,
    cbm: 0.6,
    hs_code: null,
    aes_code: null,
    received_at: "",
    route_proximity: 3,
    tier: null,
    days_in_warehouse: 19,
    score: 0,
  },
  {
    id: "preview-4",
    package_kind: "warehouse_receipt_cn",
    markbox: "DTD-5241",
    client_name: "José Hernández",
    city: "Maturín",
    pay: "parcial",
    description: null,
    boxes_total: 10,
    weight_kg: 220,
    cbm: 4.2,
    hs_code: null,
    aes_code: null,
    received_at: "",
    route_proximity: 1,
    tier: "Gold",
    days_in_warehouse: 28,
    score: 0,
  },
];

const INITIAL_STATE: DispatchRulesActionState = {};

export function RulesClient({
  initialRules,
  tierClientsCount,
}: {
  initialRules: DispatchRules;
  tierClientsCount: number;
}) {
  const [policy, setPolicy] = useState<DispatchPaymentPolicy>(initialRules.payment_policy);
  const [whitelist, setWhitelist] = useState<string>(initialRules.whitelist_markboxes.join(", "));
  const [weights, setWeights] = useState<DispatchWeights>(initialRules.weights ?? DEFAULT_WEIGHTS);
  const [optionalTier, setOptionalTier] = useState<boolean>(initialRules.optional_rules?.tier ?? false);
  const [optionalRoutes, setOptionalRoutes] = useState<boolean>(initialRules.optional_rules?.routes ?? true);
  const [vipMarkboxes, setVipMarkboxes] = useState<string>(initialRules.vip_markboxes.join(", "));
  const [holdUntil, setHoldUntil] = useState<string>(initialRules.hold_until ?? "");
  const [holdReason, setHoldReason] = useState<string>(initialRules.hold_reason ?? "");

  const [state, formAction, isPending] = useActionState(updateDispatchRulesAction, INITIAL_STATE);

  const applyPreset = (preset: DispatchWeights) => setWeights(preset);

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hidden inputs for weights (controlled state via JSON-safe value attrs) */}
      <input type="hidden" name="payment_policy" value={policy} />
      <input type="hidden" name="whitelist_markboxes" value={whitelist} />
      <input type="hidden" name="vip_markboxes" value={vipMarkboxes} />
      <input type="hidden" name="hold_until" value={policy === "hold" ? holdUntil : ""} />
      <input type="hidden" name="hold_reason" value={policy === "hold" ? holdReason : ""} />
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
              ` · ${whitelist.split(/[,\n]/).filter((s) => s.trim()).length} Shipping Marks en whitelist`}
            {policy === "hold" && holdUntil && ` · vence ${holdUntil}`}
            {policy === "hold" && !holdUntil && ` · sin fecha · indefinido`}
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
                    Solo los Shipping Mark en la whitelist pueden despacharse sin pago completo.
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        {policy === "credito_whitelist" && (
          <div style={{ marginTop: 16 }}>
            <label className="studio-label" htmlFor="whitelist-input">
              Shipping Marks habilitados sin pago
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
              Separa por coma o nueva línea. Formato esperado: <code>DTD-XXXX</code>.
            </p>
          </div>
        )}

        {policy === "hold" && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "var(--warning-bg)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                font: "700 11px/1 var(--f-sans)",
                color: "var(--warning)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Hold temporal · vence automáticamente
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                alignItems: "start",
              }}
            >
              <div>
                <label className="studio-label" htmlFor="hold-until">
                  Hasta cuándo
                </label>
                <input
                  id="hold-until"
                  type="date"
                  className="studio-input"
                  value={holdUntil}
                  onChange={(e) => setHoldUntil(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{ marginTop: 6 }}
                />
                {holdUntil && (
                  <p style={{ ...hintStyle, marginTop: 6 }}>
                    Vencida la fecha, vuelve a Estricto automáticamente.
                  </p>
                )}
              </div>
              <div>
                <label className="studio-label" htmlFor="hold-reason">
                  Razón (visible al equipo)
                </label>
                <textarea
                  id="hold-reason"
                  className="studio-input"
                  rows={3}
                  placeholder="Ej: Cierre fiscal Q2 · contabilidad revisando facturación · feriado SENIAT"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  style={{ resize: "vertical", marginTop: 6 }}
                />
              </div>
            </div>
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
        eyebrow="ACTIVA SI VALE"
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
            hint="Suma el peso VIP a clientes con tier elevado (vip/premium en el módulo Clientes)."
            checked={optionalTier}
            onChange={setOptionalTier}
          />

          {optionalTier && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--wine-tint)",
                border: "1px solid var(--wine)",
                borderRadius: "var(--r-sm)",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--wine-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginLeft: 26,
              }}
            >
              <span>
                <b>{tierClientsCount}</b> cliente{tierClientsCount === 1 ? "" : "s"} con tier elevado · recibirá{tierClientsCount === 1 ? "" : "n"} <b>+{weights.vip} pts</b>
              </span>
              <Link
                href="/studio/clientes?tier=vip"
                style={{
                  font: "700 11px/1 var(--f-sans)",
                  color: "var(--wine-text)",
                  textDecoration: "underline",
                }}
              >
                Ver lista →
              </Link>
            </div>
          )}
          <Toggle
            label="Cercanía a ruta"
            hint="Aplica el peso route_proximity (0-5 calculado por backend)."
            checked={optionalRoutes}
            onChange={setOptionalRoutes}
          />
        </div>
      </Card>

      {/* Preview Live · scoring en vivo contra samples */}
      <Card
        title="Preview Live"
        eyebrow="VER CÓMO QUEDARÍA LA COLA"
        collapsible
        defaultOpen={false}
        summary={<>4 paquetes ejemplo · pinch test antes de guardar</>}
      >
        <PreviewLive
          weights={weights}
          policy={policy}
          whitelist={whitelist
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)}
          vipList={vipMarkboxes
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)}
          optionalTier={optionalTier}
          optionalRoutes={optionalRoutes}
          holdUntil={holdUntil || null}
          holdReason={holdReason || null}
        />
      </Card>

      {/* VIP markboxes · plegable */}
      <Card
        title="Shipping Mark VIP"
        eyebrow="LISTA MANUAL · ALTERNATIVA AL TIER"
        collapsible
        defaultOpen={false}
        summary={
          <>
            {vipMarkboxes.split(/[,\n]/).filter((s) => s.trim()).length} Shipping Marks
            cargados
          </>
        }
      >
        <p style={hintStyle}>
          Shipping Marks que reciben el peso VIP aunque no estén marcados como Gold/Platinum
          en Clientes. Útil si el módulo de tiers no está alineado con tu prioridad real.
        </p>
        <label className="studio-label" htmlFor="vip-input" style={{ marginTop: 12 }}>
          Shipping Marks VIP
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
        <Aviso tono="error">{state.error}</Aviso>
      )}
      {state?.ok && (
        <Aviso tono="exito">Reglas guardadas. Se aplican al instante en la cola.</Aviso>
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
                style={{ color: "var(--wine-text)", marginBottom: 6 }}
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
        <code style={{ font: "800 14px/1 var(--f-mono)", color: "var(--wine-text)" }}>{value}</code>
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

// ─────────────────────────────────────────────────────────────
// Preview Live
// ─────────────────────────────────────────────────────────────

function PreviewLive({
  weights,
  policy,
  whitelist,
  vipList,
  optionalTier,
  optionalRoutes,
  holdUntil,
  holdReason,
}: {
  weights: DispatchWeights;
  policy: DispatchPaymentPolicy;
  whitelist: string[];
  vipList: string[];
  optionalTier: boolean;
  optionalRoutes: boolean;
  holdUntil: string | null;
  holdReason: string | null;
}) {
  const [selectedId, setSelectedId] = useState(PREVIEW_SAMPLES[0].id);
  const selected = PREVIEW_SAMPLES.find((p) => p.id === selectedId) ?? PREVIEW_SAMPLES[0];

  // Sintetizar un DispatchRules-like para reusar las funciones puras
  const liveRules = useMemo<DispatchRules>(
    () => ({
      tenant_id: "",
      payment_policy: policy,
      whitelist_markboxes: whitelist,
      weights,
      optional_rules: { tier: optionalTier, routes: optionalRoutes },
      vip_markboxes: vipList,
      hold_until: holdUntil,
      hold_reason: holdReason,
      updated_by: null,
      updated_at: "",
    }),
    [policy, whitelist, weights, optionalTier, optionalRoutes, vipList, holdUntil, holdReason],
  );

  const breakdown = useMemo(() => scoreBreakdown(selected, liveRules), [selected, liveRules]);
  const policyEval = useMemo(() => evaluatePolicy(selected, liveRules), [selected, liveRules]);
  const level = scoreLevel(breakdown.total);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Selector de samples */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PREVIEW_SAMPLES.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: "var(--s-2) var(--s-3)",
                background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                color: active ? "var(--wine)" : "var(--ink-soft)",
                border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                borderRadius: "var(--r-pill)",
                font: "700 11px/1 var(--f-sans)",
                cursor: "pointer",
                display: "inline-flex",
                gap: 6,
              }}
            >
              <code style={{ font: "700 11px/1 var(--f-mono)" }}>{s.markbox}</code>
              <span>·</span>
              <span>{s.city}</span>
              <span>·</span>
              <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.pay}</span>
            </button>
          );
        })}
      </div>

      {/* Scoreboard */}
      <div
        style={{
          padding: 16,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            font: "900 38px/1 var(--f-display)",
            color: SCORE_LEVEL_COLORS[level],
            letterSpacing: "-0.02em",
            minWidth: 70,
          }}
        >
          {breakdown.total}
        </div>
        <div>
          <div
            style={{
              font: "800 14px/1.2 var(--f-display)",
              color: "var(--ink)",
            }}
          >
            {selected.client_name} · {selected.markbox}
          </div>
          <div
            style={{
              font: "500 12px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 3,
            }}
          >
            {selected.city} · {selected.boxes_total} cajas · {selected.weight_kg} kg ·{" "}
            {selected.days_in_warehouse} días en bodega
            {selected.tier && ` · ${selected.tier}`}
          </div>
        </div>
        <div
          style={{
            padding: "6px 12px",
            background: SCORE_LEVEL_COLORS[level],
            color: "white",
            borderRadius: "var(--r-pill)",
            font: "800 11px/1 var(--f-sans)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {SCORE_LEVEL_LABELS[level]}
        </div>
      </div>

      {/* Breakdown */}
      <div
        style={{
          padding: 14,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Cómo se compone el score
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {breakdown.lines.map((line) => (
            <div
              key={line.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "6px 10px",
                background: line.muted ? "transparent" : "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                font: "500 12.5px/1.2 var(--f-sans)",
                color: line.muted ? "var(--ink-mute)" : "var(--ink)",
                textDecoration: line.muted ? "line-through" : "none",
              }}
            >
              <span>{line.label}</span>
              <code
                style={{
                  font: "800 13px/1 var(--f-mono)",
                  color: line.muted ? "var(--ink-mute)" : "var(--wine)",
                }}
              >
                {line.pts > 0 ? `+${line.pts}` : "0"} pts
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Policy evaluation */}
      <div
        style={{
          padding: 12,
          background:
            policyEval.state === "blocked"
              ? "var(--danger-bg)"
              : policyEval.state === "credit-ok"
                ? "var(--info-bg)"
                : "var(--success-bg)",
          color:
            policyEval.state === "blocked"
              ? "var(--danger)"
              : policyEval.state === "credit-ok"
                ? "var(--info)"
                : "var(--success)",
          borderRadius: "var(--r-md)",
          font: "600 12.5px/1.4 var(--f-sans)",
        }}
      >
        <div style={{ font: "800 10.5px/1 var(--f-sans)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          {policyEval.state === "blocked" ? "Bloqueado por política" : policyEval.state === "credit-ok" ? "Excepción crédito" : "OK"}
        </div>
        {policyEval.reason}
      </div>
    </div>
  );
}
