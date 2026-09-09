import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CalcParams } from "../../lib/calculadora";

export type E2ECalculatorSettings = {
  peso_incluido_kg: number;
  recargo_excedente_kg: number;
  descuento_valencia: number;
  recargo_embalaje_especial: number;
  recargo_bateria_mult: number;
  threshold_casco_km: number;
  tarifa_km_fuera_casco: number;
  cbm_max_contenedor: number;
  peso_max_contenedor_kg: number;
  peso_max_envio_kg: number;
};

/**
 * Traduce los defaults vigentes del calculador al contrato persistido.
 *
 * Los branches efímeros reconstruyen el seed histórico de 0103 (500 kg/CBM y
 * USD 50 de descuento). El E2E debe medir el código actual, no esas constantes
 * obsoletas, por lo que seed-e2e sincroniza exclusivamente la fila pública del
 * tenant dtd antes de abrir el navegador.
 */
export function buildE2ECalculatorSettings(
  params: CalcParams,
): E2ECalculatorSettings {
  return {
    peso_incluido_kg: params.pesoIncluidoKg,
    recargo_excedente_kg: params.recargoExcedenteKg,
    descuento_valencia: params.descuentoValencia,
    recargo_embalaje_especial: params.recargoEmbalajeEspecial,
    recargo_bateria_mult: params.recargoBateriaMult,
    threshold_casco_km: params.thresholdCascoKm,
    tarifa_km_fuera_casco: params.tarifaKmFueraCasco,
    cbm_max_contenedor: params.cbmMaxContenedor,
    peso_max_contenedor_kg: params.pesoMaxContenedorKg,
    peso_max_envio_kg: params.pesoMaxEnvioKg,
  };
}

/** Único tenant ajeno al fixture que el seed puede tocar. */
export const E2E_PUBLIC_TENANT_SLUG = "dtd";

/** Columnas que el seed sobrescribe; el orden fija la salida auditable. */
export const E2E_CALCULATOR_SETTINGS_COLUMNS = [
  "peso_incluido_kg",
  "recargo_excedente_kg",
  "descuento_valencia",
  "recargo_embalaje_especial",
  "recargo_bateria_mult",
  "threshold_casco_km",
  "tarifa_km_fuera_casco",
  "cbm_max_contenedor",
  "peso_max_contenedor_kg",
  "peso_max_envio_kg",
] as const satisfies readonly (keyof E2ECalculatorSettings)[];

export type E2ECalculatorSettingsBaseline = {
  step: "calculator-settings-baseline";
  tenantSlug: string;
  tenantId: string;
  previous: Record<string, unknown>;
};

/**
 * Deja por escrito lo que el seed está a punto de sobrescribir.
 *
 * Normalizar `calculator_settings` es la única escritura del seed fuera del
 * tenant de fixture y no lleva respaldo ni restauración: el branch efímero se
 * destruye entero al terminar. Emitir el estado previo mantiene el costo en
 * una línea de log y hace diagnosticable un apuntado equivocado, en vez de
 * depender de la memoria de quien corrió el gate. Un valor ausente se emite
 * como `null` para que la clave no desaparezca del registro.
 */
export function buildE2ECalculatorSettingsBaseline(
  tenantId: string,
  previous: Record<string, unknown> | null | undefined,
  tenantSlug: string = E2E_PUBLIC_TENANT_SLUG,
): E2ECalculatorSettingsBaseline {
  const snapshot: Record<string, unknown> = {};
  for (const column of E2E_CALCULATOR_SETTINGS_COLUMNS) {
    snapshot[column] = previous?.[column] ?? null;
  }
  return {
    step: "calculator-settings-baseline",
    tenantSlug,
    tenantId,
    previous: snapshot,
  };
}

export const SDD_0168_FIXTURE = {
  tenantId: "01680000-0000-4000-8000-000000000001",
  shipmentId: "01680000-0000-4000-8000-000000000002",
  expenseId: "02430000-0000-4000-8000-000000000001",
  payrollEmployeeId: "02260000-0000-4000-8000-000000000001",
  payrollJournalEntryId: "02260000-0000-4000-8000-000000000002",
  payrollSettlementId: "02260000-0000-4000-8000-000000000003",
  payrollSettlementLineId: "02260000-0000-4000-8000-000000000004",
  tenantSlug: "e2e-sdd-0168",
  shipmentCode: "E2E-0168-001",
  expenseCode: "EXP-E2E-0243",
  payrollEmployeeCode: "EMP-E2E-0226",
  payrollJournalEntryCode: "A-E2E-0226",
  payrollSettlementCode: "LIQ-E2E-0226",
  adminEmail: "sdd0168-admin@example.com",
  mentionedEmail: "sdd0168-mentioned@example.com",
  commentBody: "SDD-0168 E2E · conservar identidad @Mention E.",
} as const;

export const SDD_0168_TIER3_ALIASES = {
  STUDIO_E2E_EMAIL: SDD_0168_FIXTURE.adminEmail,
  STUDIO_E2E_EXPENSE_CODE: SDD_0168_FIXTURE.expenseCode,
  STUDIO_E2E_PAYROLL_SETTLEMENT_CODE:
    SDD_0168_FIXTURE.payrollSettlementCode,
} as const;

const E2E_MENTION_TOKEN = "@Mention E.";

export function getE2ECommentBody(
  projectName: string,
  retry = 0,
  repeatEachIndex = 0,
): string {
  const executionIdentity = `${projectName} · retry-${retry} · repeat-${repeatEachIndex}`;
  return SDD_0168_FIXTURE.commentBody.replace(
    E2E_MENTION_TOKEN,
    `[${executionIdentity}] ${E2E_MENTION_TOKEN}`,
  );
}

export function getE2EExpenseOccurredAt(
  referenceDate = new Date(),
): string {
  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      15,
      12,
    ),
  ).toISOString();
}

export const E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS = 10;
export const E2E_SCHEMA_PREFLIGHT_RETRY_MS = 2_000;

export function isRetryableE2ESchemaError(error: {
  code?: string;
  message: string;
}): boolean {
  return (
    ["PGRST204", "PGRST205", "42703", "42P01"].includes(error.code ?? "") ||
    error.message.toLowerCase().includes("schema cache")
  );
}

export function getE2ESchemaRetryDelayMs(
  failedAttempt: number,
): number | null {
  return Number.isInteger(failedAttempt) &&
    failedAttempt >= 1 &&
    failedAttempt < E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS
    ? E2E_SCHEMA_PREFLIGHT_RETRY_MS
    : null;
}

const PRODUCTION_PROJECT_REF = "xpfuzqombmjmxvprjgmi";
const EPHEMERAL_ENVIRONMENT_KIND = "ephemeral";

export type E2EEnvironment = {
  projectRef: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  password: string;
  environmentKind: typeof EPHEMERAL_ENVIRONMENT_KIND;
};

type E2EProcessEnvironment = Record<string, string | undefined>;

function required(env: E2EProcessEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`);
  return value;
}

export function loadE2EEnvironment(
  env: E2EProcessEnvironment = process.env,
): E2EEnvironment {
  const projectRef = required(env, "E2E_SUPABASE_PROJECT_REF");
  const supabaseUrl = required(env, "E2E_SUPABASE_URL");
  const anonKey = required(env, "E2E_SUPABASE_ANON_KEY");
  const serviceRoleKey = required(env, "E2E_SUPABASE_SERVICE_ROLE_KEY");
  const password = required(env, "STUDIO_E2E_PASSWORD");
  const environmentKind = required(env, "E2E_ENVIRONMENT_KIND");
  const confirmedProjectRef = required(env, "E2E_EPHEMERAL_PROJECT_REF");

  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error(
      "Las fixtures E2E están prohibidas en Supabase Producción.",
    );
  }
  if (environmentKind !== EPHEMERAL_ENVIRONMENT_KIND) {
    throw new Error(
      `E2E_ENVIRONMENT_KIND debe ser ${EPHEMERAL_ENVIRONMENT_KIND}.`,
    );
  }
  if (confirmedProjectRef !== projectRef) {
    throw new Error(
      "E2E_EPHEMERAL_PROJECT_REF no coincide con E2E_SUPABASE_PROJECT_REF.",
    );
  }

  const url = new URL(supabaseUrl);
  const expectedOrigin = `https://${projectRef}.supabase.co`;
  // El origen compara el host completo; la entrada completa impide ocultar
  // userinfo, :443, paths normalizados (a/..), query o hash detrás de URL.origin.
  // Sólo se admite la raíz canónica, con slash opcional, nunca un host alterno.
  if (
    url.origin !== expectedOrigin ||
    (supabaseUrl !== expectedOrigin && supabaseUrl !== `${expectedOrigin}/`)
  ) {
    throw new Error(
      "E2E_SUPABASE_URL no corresponde al E2E_SUPABASE_PROJECT_REF autorizado.",
    );
  }
  if (password.length < 12) {
    throw new Error("STUDIO_E2E_PASSWORD debe tener al menos 12 caracteres.");
  }

  return {
    projectRef,
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    password,
    environmentKind,
  };
}

export function applyE2ETier3FixtureAliases(
  env: E2EProcessEnvironment = process.env,
): boolean {
  if (env.E2E_ENVIRONMENT_KIND?.trim() !== EPHEMERAL_ENVIRONMENT_KIND) {
    return false;
  }

  loadE2EEnvironment(env);

  for (const [name, expected] of Object.entries(SDD_0168_TIER3_ALIASES)) {
    const current = env[name]?.trim();
    if (current && current !== expected) {
      throw new Error(`${name} no coincide con el fixture SDD-0168 sembrado.`);
    }
    env[name] = expected;
  }

  return true;
}

export function createE2EAdminClient(
  environment = loadE2EEnvironment(),
): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createE2EAuthenticatedClient(
  environment = loadE2EEnvironment(),
  email = SDD_0168_FIXTURE.adminEmail,
): Promise<SupabaseClient> {
  const client = createClient(environment.supabaseUrl, environment.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: environment.password,
  });
  if (error) {
    throw new Error(`No se pudo autenticar el lector E2E: ${error.message}`);
  }
  return client;
}
