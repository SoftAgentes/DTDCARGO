import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SDD_0168_FIXTURE = {
  tenantId: "01680000-0000-4000-8000-000000000001",
  shipmentId: "01680000-0000-4000-8000-000000000002",
  payrollEmployeeId: "02260000-0000-4000-8000-000000000001",
  payrollJournalEntryId: "02260000-0000-4000-8000-000000000002",
  payrollSettlementId: "02260000-0000-4000-8000-000000000003",
  payrollSettlementLineId: "02260000-0000-4000-8000-000000000004",
  tenantSlug: "e2e-sdd-0168",
  shipmentCode: "E2E-0168-001",
  payrollEmployeeCode: "EMP-E2E-0226",
  payrollJournalEntryCode: "A-E2E-0226",
  payrollSettlementCode: "LIQ-E2E-0226",
  adminEmail: "sdd0168-admin@example.com",
  mentionedEmail: "sdd0168-mentioned@example.com",
  commentBody: "SDD-0168 E2E · conservar identidad @Mention E.",
} as const;

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

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`);
  return value;
}

export function loadE2EEnvironment(): E2EEnvironment {
  const projectRef = required("E2E_SUPABASE_PROJECT_REF");
  const supabaseUrl = required("E2E_SUPABASE_URL");
  const anonKey = required("E2E_SUPABASE_ANON_KEY");
  const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");
  const password = required("STUDIO_E2E_PASSWORD");
  const environmentKind = required("E2E_ENVIRONMENT_KIND");
  const confirmedProjectRef = required("E2E_EPHEMERAL_PROJECT_REF");

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
