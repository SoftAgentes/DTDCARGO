import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  const urlProjectRef = url.hostname.split(".")[0];
  if (url.protocol !== "https:" || urlProjectRef !== projectRef) {
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
