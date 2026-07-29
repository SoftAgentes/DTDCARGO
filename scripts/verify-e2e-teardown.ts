import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";

async function check(
  error: { message: string } | null,
  context: string,
): Promise<void> {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function main() {
  const environment = loadE2EEnvironment();
  const admin = createE2EAdminClient(environment);
  const fixture = SDD_0168_FIXTURE;

  const [
    { count: tenantCount, error: tenantError },
    { count: membershipCount, error: membershipError },
    { count: auditCount, error: auditError },
  ] = await Promise.all([
    admin
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("id", fixture.tenantId),
    admin
      .from("user_tenants")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", fixture.tenantId),
    admin
      .from("entity_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", fixture.tenantId),
  ]);

  await check(tenantError, "No se pudo verificar el tenant fixture");
  await check(membershipError, "No se pudieron verificar las membresías");
  await check(auditError, "No se pudo verificar la auditoría fixture");

  console.log(
    JSON.stringify({
      verified: true,
      projectRef: environment.projectRef,
      environmentKind: environment.environmentKind,
      fixture: {
        tenants: tenantCount ?? 0,
        memberships: membershipCount ?? 0,
        auditEvents: auditCount ?? 0,
      },
      databaseCleanupPerformed: false,
      teardownRequired: true,
      teardownScope: "supabase-project",
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`Verificación de teardown E2E falló: ${message}`);
  process.exitCode = 1;
});
