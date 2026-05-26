/**
 * Tipos + defaults + validators del motor de reglas de Despacho (SDD-0029 §3.6).
 * Matchea tabla dispatch_rules (1 row por tenant).
 */

export type DispatchPaymentPolicy = "estricto" | "hold" | "credito_whitelist";

export type DispatchWeights = {
  valencia: number;            // Ciudad principal (Valencia/Caracas)
  full_pay: number;            // Pago completo
  partial_pay: number;         // Abono
  fifo: number;                // FIFO antigüedad (0-15 lineal saturado 21 días)
  vip: number;                 // Cliente VIP (Gold/Platinum)
  route_proximity: number;     // Cercanía a ruta del día (0-5)
};

export type DispatchOptionalRules = {
  tier: boolean;               // Aplicar peso adicional por tier de cliente
  routes: boolean;             // Aplicar peso por cercanía a ruta
};

export type DispatchRules = {
  tenant_id: string;
  payment_policy: DispatchPaymentPolicy;
  whitelist_markboxes: string[];
  weights: DispatchWeights;
  optional_rules: DispatchOptionalRules;
  vip_markboxes: string[];
  updated_by: string | null;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: DispatchWeights = {
  valencia: 40,
  full_pay: 30,
  partial_pay: 15,
  fifo: 15,
  vip: 10,
  route_proximity: 5,
};

export const DEFAULT_OPTIONAL_RULES: DispatchOptionalRules = {
  tier: false,
  routes: true,
};

export const DEFAULT_DISPATCH_RULES: Omit<DispatchRules, "tenant_id" | "updated_by" | "updated_at"> = {
  payment_policy: "estricto",
  whitelist_markboxes: [],
  weights: DEFAULT_WEIGHTS,
  optional_rules: DEFAULT_OPTIONAL_RULES,
  vip_markboxes: [],
};

// ─────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────

export const PRESET_EQUILIBRADO: DispatchWeights = {
  valencia: 40,
  full_pay: 30,
  partial_pay: 15,
  fifo: 15,
  vip: 10,
  route_proximity: 5,
};

export const PRESET_FIFO: DispatchWeights = {
  valencia: 10,
  full_pay: 20,
  partial_pay: 10,
  fifo: 45,
  vip: 5,
  route_proximity: 10,
};

// ─────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────

export const PAYMENT_POLICY_LABELS: Record<DispatchPaymentPolicy, string> = {
  estricto: "Estricto — solo pagados",
  hold: "Hold — no-pagados greyed-out",
  credito_whitelist: "Whitelist — clientes elegibles sin pago",
};

export const WEIGHT_LABELS: Record<keyof DispatchWeights, string> = {
  valencia: "Ciudad principal (Valencia/Caracas)",
  full_pay: "Pago completo",
  partial_pay: "Pago parcial",
  fifo: "Antigüedad FIFO",
  vip: "Cliente VIP",
  route_proximity: "Cercanía a ruta del día",
};

export const WEIGHT_HINTS: Record<keyof DispatchWeights, string> = {
  valencia: "Sube el score si la ciudad destino es Valencia o Caracas.",
  full_pay: "Sube el score si el cliente pagó completo.",
  partial_pay: "Sube el score si hay abono parcial registrado.",
  fifo: "Lineal saturado a 21 días en bodega. Penaliza demoras.",
  vip: "Boost para clientes Gold/Platinum.",
  route_proximity: "0-5 precalculado por la cercanía geográfica a la ruta del día.",
};

// Max para sliders
export const WEIGHT_MAX = 50;

// ─────────────────────────────────────────────────────────────
// Action state + validators
// ─────────────────────────────────────────────────────────────

export type DispatchRulesActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type UpdateDispatchRulesInput = {
  payment_policy: DispatchPaymentPolicy;
  whitelist_markboxes: string[];
  weights: DispatchWeights;
  optional_rules: DispatchOptionalRules;
  vip_markboxes: string[];
};

const POLICIES: DispatchPaymentPolicy[] = ["estricto", "hold", "credito_whitelist"];

export function validateUpdateDispatchRulesInput(
  input: Partial<UpdateDispatchRulesInput>,
): { input?: UpdateDispatchRulesInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.payment_policy || !POLICIES.includes(input.payment_policy)) {
    errors.payment_policy = "Política de pago inválida.";
  }

  const w = input.weights;
  if (!w) {
    errors.weights = "Faltan los pesos.";
  } else {
    for (const k of Object.keys(DEFAULT_WEIGHTS) as Array<keyof DispatchWeights>) {
      const v = Number(w[k]);
      if (!Number.isFinite(v) || v < 0 || v > WEIGHT_MAX) {
        errors[`weights.${k}`] = `Peso ${k} debe estar entre 0 y ${WEIGHT_MAX}.`;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      payment_policy: input.payment_policy!,
      whitelist_markboxes: input.whitelist_markboxes ?? [],
      weights: input.weights!,
      optional_rules: input.optional_rules ?? DEFAULT_OPTIONAL_RULES,
      vip_markboxes: input.vip_markboxes ?? [],
    },
  };
}
