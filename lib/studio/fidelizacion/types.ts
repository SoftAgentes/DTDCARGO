/**
 * Tipos + motor del módulo Fidelización & Referidos (SDD-0051 · Slice A).
 *
 * Dos piezas:
 *  - Niveles (tiers): DERIVADOS de la facturación trailing-12m (USD-normalizada)
 *    de `invoices`. No se almacenan. Espejo exacto de
 *    `docs/design/studio/_norte/erp/modules/fidelizacion-data.jsx`.
 *  - Referidos: tabla `referrals` (migración 0098). Reglas de recompensa =
 *    constantes en código (REFERRAL_RULES); créditos advisory en V1.
 *
 * Puro (sin Zod, sin Supabase). Coexiste con `client.tier` manual
 * (regular/vip/premium, SDD-0010) — son conceptos distintos; esta capa NO toca
 * ese campo.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";
import type { Invoice } from "@/lib/studio/invoice-types";

// ── Niveles (tiers) · umbral por facturación anual (USD) ──────
export type TierId = "bronze" | "silver" | "gold" | "platinum";

export type Tier = {
  id: TierId;
  label: string;
  tone: BadgeTone;
  /** Umbral mínimo de facturación anual (USD) para alcanzar el nivel. */
  min: number;
  benefits: string[];
};

/** Espejo exacto de TIERS en fidelizacion-data.jsx (mismos min/labels/benefits). */
export const TIERS: Tier[] = [
  {
    id: "bronze",
    label: "Bronze",
    tone: "neutral",
    min: 0,
    benefits: ["Soporte estándar", "Tracking en portal", "Etiquetas bilingües"],
  },
  {
    id: "silver",
    label: "Silver",
    tone: "info",
    min: 50000,
    benefits: [
      "−5% en almacenaje",
      "Prioridad media en consolidación",
      "Estimado en 12 h",
    ],
  },
  {
    id: "gold",
    label: "Gold",
    tone: "warning",
    min: 150000,
    benefits: [
      "−10% en almacenaje",
      "Agente comercial dedicado",
      "Cupo prioritario en contenedor",
      "Crédito 15 días",
    ],
  },
  {
    id: "platinum",
    label: "Platinum",
    tone: "wine",
    min: 300000,
    benefits: [
      "−15% en almacenaje",
      "Gerente de cuenta",
      "White-label en correos",
      "Cupo garantizado",
      "Crédito 30 días",
    ],
  },
];

/** Nivel correspondiente a una facturación (USD). Espejo del Norte. */
export function tierOf(billedUsd: number): Tier {
  const b = Number(billedUsd) || 0;
  return [...TIERS].reverse().find((t) => b >= t.min) ?? TIERS[0];
}

/** Siguiente nivel, o null si ya es el máximo (Platinum). */
export function nextTier(tier: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === tier.id);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export type TierProgress = {
  /** Progreso (%) hacia el siguiente nivel; 100 si ya es el máximo. */
  pct: number;
  /** USD que faltan para el siguiente nivel; 0 si es el máximo. */
  toNext: number;
  tier: Tier;
  next: Tier | null;
};

/** Progreso hacia el siguiente nivel. Espejo exacto de tierProgress() del Norte. */
export function tierProgress(billedUsd: number): TierProgress {
  const b = Number(billedUsd) || 0;
  const t = tierOf(b);
  const nt = nextTier(t);
  if (!nt) return { pct: 100, toNext: 0, tier: t, next: null };
  const span = nt.min - t.min;
  const pct = Math.min(100, ((b - t.min) / span) * 100);
  return { pct, toNext: Math.max(0, nt.min - b), tier: t, next: nt };
}

// ── Reglas del programa de referidos (constantes V1) ──────────
export const REFERRAL_RULES = {
  /** USD de crédito para quien refiere, al primer embarque del referido. */
  referrerReward: 80,
  /** USD de descuento para el referido en su primer embarque. */
  referredReward: 60,
  currency: "USD" as const,
};

// ── Estados del referido ──────────────────────────────────────
// invitado→registrado→primer-embarque→acreditado = PIPELINE del referido.
// 'aplicado' (SDD-0137) = estado TERMINAL de dinero: el crédito acreditado se
// aplicó a una factura del referidor (con asiento contable). Se llega SOLO por
// la acción con gate de dinero (applyReferralCredit), nunca por avance manual
// → por eso NO figura en REFERRAL_STEPS (el stepper/validador del pipeline).
export type ReferralStatus =
  | "invitado"
  | "registrado"
  | "primer-embarque"
  | "acreditado"
  | "aplicado";

export const REFERRAL_STATUS: Record<
  ReferralStatus,
  { label: string; tone: BadgeTone; step: number }
> = {
  invitado: { label: "Invitado", tone: "neutral", step: 0 },
  registrado: { label: "Registrado", tone: "info", step: 1 },
  "primer-embarque": { label: "Primer embarque", tone: "warning", step: 2 },
  acreditado: { label: "Acreditado", tone: "success", step: 3 },
  aplicado: { label: "Aplicado", tone: "wine", step: 4 },
};

/** Orden del timeline de estados del PIPELINE (no incluye 'aplicado', que es de dinero). */
export const REFERRAL_STEPS: ReferralStatus[] = [
  "invitado",
  "registrado",
  "primer-embarque",
  "acreditado",
];

const VALID_REFERRAL_STATUS: ReferralStatus[] = REFERRAL_STEPS;

/**
 * Código para compartir, determinístico y puro (NO se persiste).
 * `DTD-5452 → REF-5452`. Distinto del referral_code secuencial (REF-YYYY-NNNN)
 * que genera la RPC next_referral_code al registrar el referido.
 */
export function referralShareCode(markbox: string): string {
  return "REF-" + String(markbox || "").replace(/^DTD-/, "");
}

// ── Tipos de la tabla referrals (migración 0098) ──────────────
export type Referral = {
  id: string;
  tenant_id: string;
  referral_code: string;
  referrer_client_id: string | null;
  referrer_markbox: string;
  referred_name: string;
  referred_company: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  referred_client_id: string | null;
  status: ReferralStatus;
  reward_usd: number;
  lead_id: string | null;
  notes: string | null;
  // SDD-0137 · rastro de aplicación del crédito (Opción A).
  applied_invoice_id: string | null;
  applied_entry_id: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Lo que el operador edita (sin id, code, timestamps). */
export type ReferralInput = {
  referrer_client_id: string | null;
  referrer_markbox: string;
  referred_name: string;
  referred_company: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  status: ReferralStatus;
  lead_id: string | null;
  notes: string | null;
};

export type ReferralActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ReferralInput, string>>;
  /** En registerReferral el server devuelve el code generado para redirect. */
  createdCode?: string;
};

// Email laxo pero suficiente: algo@algo.tld sin espacios.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validación manual (sin Zod, patrón del repo).
 * - referrer_markbox no vacío
 * - referred_name no vacío, ≤ 200
 * - referred_email válido si viene
 * - status ∈ enum (default 'invitado' si falta/ inválido al crear)
 */
export function validateReferralInput(raw: Partial<ReferralInput>): {
  input?: ReferralInput;
  fieldErrors?: ReferralActionState["fieldErrors"];
} {
  const errors: ReferralActionState["fieldErrors"] = {};

  const referrerMarkbox = String(raw.referrer_markbox ?? "").trim();
  if (!referrerMarkbox) {
    errors.referrer_markbox = "Indica el Shipping Mark del cliente que refiere.";
  }

  const referredName = String(raw.referred_name ?? "").trim();
  if (!referredName) {
    errors.referred_name = "Indica el nombre del referido.";
  } else if (referredName.length > 200) {
    errors.referred_name = "El nombre no puede superar los 200 caracteres.";
  }

  const referredEmail = raw.referred_email?.trim() || null;
  if (referredEmail && !EMAIL_RE.test(referredEmail)) {
    errors.referred_email = "Correo del referido inválido.";
  }

  const status: ReferralStatus =
    raw.status && VALID_REFERRAL_STATUS.includes(raw.status)
      ? raw.status
      : "invitado";
  if (raw.status != null && !VALID_REFERRAL_STATUS.includes(raw.status)) {
    errors.status = "Estado de referido inválido.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      referrer_client_id: raw.referrer_client_id?.trim() || null,
      referrer_markbox: referrerMarkbox,
      referred_name: referredName,
      referred_company: raw.referred_company?.trim() || null,
      referred_email: referredEmail,
      referred_phone: raw.referred_phone?.trim() || null,
      status,
      lead_id: raw.lead_id?.trim() || null,
      notes: raw.notes?.trim() || null,
    },
  };
}

// ── Normalización a USD para el motor de niveles (decisión §3.2) ──
/**
 * Monto de una factura normalizado a USD (decisión §3.2 del spec):
 *  - USD / USDT → total_amount 1:1
 *  - VES → total_amount / fx_rate (si fx_rate > 0; sino 0 → se omite del cómputo)
 *  - CNY → 0 (omitida en V1; raro)
 * Devuelve un número (0 cuando no contribuye).
 */
export function invoiceUsdAmount(
  invoice: Pick<Invoice, "currency" | "total_amount" | "fx_rate">,
): number {
  const total = Number(invoice.total_amount);
  const amount = Number.isFinite(total) ? total : 0;

  switch (invoice.currency) {
    case "USD":
    case "USDT":
      return amount;
    case "VES": {
      const fx = Number(invoice.fx_rate);
      return Number.isFinite(fx) && fx > 0 ? amount / fx : 0;
    }
    case "CNY":
    default:
      return 0;
  }
}
