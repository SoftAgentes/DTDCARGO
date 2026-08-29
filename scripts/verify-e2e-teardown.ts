import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  createE2EAuthenticatedClient,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";
import { listGovernedAuditEvents } from "../lib/studio/audit-queries";

async function check(
  error: { message: string } | null,
  context: string,
): Promise<void> {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function checkCount(
  actual: number | null,
  expected: number,
  context: string,
): void {
  if (actual !== expected) {
    throw new Error(`${context}: esperado ${expected}, recibido ${actual ?? 0}.`);
  }
}

async function main() {
  const environment = loadE2EEnvironment();
  const admin = createE2EAdminClient(environment);
  const auditReader = await createE2EAuthenticatedClient(environment);
  const fixture = SDD_0168_FIXTURE;

  const [
    { count: tenantCount, error: tenantError },
    { count: membershipCount, error: membershipError },
    { count: expenseCount, error: expenseError },
    auditResult,
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
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("id", fixture.expenseId)
      .eq("tenant_id", fixture.tenantId),
    listGovernedAuditEvents(auditReader),
  ]);

  await check(tenantError, "No se pudo verificar el tenant fixture");
  await check(membershipError, "No se pudieron verificar las membresías");
  await check(expenseError, "No se pudo verificar el gasto fixture");
  checkCount(tenantCount, 1, "Conteo inválido de tenants fixture");
  checkCount(membershipCount, 2, "Conteo inválido de membresías fixture");
  checkCount(expenseCount, 1, "Conteo inválido de gastos fixture");
  if (!auditResult.ok) {
    throw new Error(
      `No se pudo verificar la auditoría gobernada: ${auditResult.code}`,
    );
  }

  console.log(
    JSON.stringify({
      verified: true,
      projectRef: environment.projectRef,
      environmentKind: environment.environmentKind,
      fixture: {
        tenants: tenantCount ?? 0,
        memberships: membershipCount ?? 0,
        expenses: expenseCount ?? 0,
        auditEventsVisible: auditResult.events.length,
        auditEventsHasMore: auditResult.hasMore,
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
