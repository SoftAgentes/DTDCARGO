import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SDD_0168_FIXTURE = {
  tenantId: "01680000-0000-4000-8000-000000000001",
  shipmentId: "01680000-0000-4000-8000-000000000002",
  tenantSlug: "e2e-sdd-0168",
  shipmentCode: "E2E-0168-001",
  adminEmail: "sdd0168-admin@example.com",
  mentionedEmail: "sdd0168-mentioned@example.com",
  commentBody: "SDD-0168 E2E · conservar identidad @Mention E.",
} as const;

const PRODUCTION_PROJECT_REF = "xpfuzqombmjmxvprjgmi";

export type E2EEnvironment = {
  projectRef: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  password: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`);
  return value;
}

export function loadE2EEnvironment(): E2EEnvironment {
  const projectRef = required("E2E_SUPABASE_PROJECT_REF");
  const supabaseUrl = required("E2E_SUPABASE_URL");
  const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");
  const password = required("STUDIO_E2E_PASSWORD");

  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("El seed E2E se niega a ejecutar contra Supabase Producción.");
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

  return { projectRef, supabaseUrl, serviceRoleKey, password };
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
