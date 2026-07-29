import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";

type AdminClient = ReturnType<typeof createE2EAdminClient>;

async function check(
  error: { message: string } | null,
  context: string,
): Promise<void> {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function deleteFixtureUsers(
  admin: AdminClient,
  memberships: Array<{ user_id: string; role: string }>,
): Promise<number> {
  const fixture = SDD_0168_FIXTURE;
  const expectedEmailByRole = new Map([
    ["admin", fixture.adminEmail],
    ["operations", fixture.mentionedEmail],
  ]);

  if (memberships.length > expectedEmailByRole.size) {
    throw new Error(
      `Limpieza E2E abortada: el tenant contiene ${memberships.length} membresías.`,
    );
  }

  let deleted = 0;
  for (const membership of memberships) {
    const expectedEmail = expectedEmailByRole.get(membership.role);
    if (!expectedEmail) {
      throw new Error(
        `Limpieza E2E abortada: rol inesperado ${membership.role}.`,
      );
    }

    const { data, error } = await admin.auth.admin.getUserById(
      membership.user_id,
    );
    if (error) throw error;
    if (data.user.email !== expectedEmail) {
      throw new Error(
        `Limpieza E2E abortada: la membresía ${membership.role} no corresponde al correo fixture.`,
      );
    }
  }

  for (const membership of memberships) {
    const { error } = await admin.auth.admin.deleteUser(membership.user_id);
    if (error) throw error;
    deleted += 1;
  }

  return deleted;
}

async function main() {
  const environment = loadE2EEnvironment();
  const admin = createE2EAdminClient(environment);
  const fixture = SDD_0168_FIXTURE;

  const { data: tenantById, error: tenantByIdError } = await admin
    .from("tenants")
    .select("id,slug")
    .eq("id", fixture.tenantId)
    .maybeSingle();
  await check(tenantByIdError, "No se pudo validar el tenant fixture por ID");

  const { data: tenantBySlug, error: tenantBySlugError } = await admin
    .from("tenants")
    .select("id,slug")
    .eq("slug", fixture.tenantSlug)
    .maybeSingle();
  await check(
    tenantBySlugError,
    "No se pudo validar el tenant fixture por slug",
  );

  if (tenantById && tenantById.slug !== fixture.tenantSlug) {
    throw new Error(
      "Limpieza E2E abortada: el ID fixture pertenece a otro tenant.",
    );
  }
  if (tenantBySlug && tenantBySlug.id !== fixture.tenantId) {
    throw new Error(
      "Limpieza E2E abortada: el slug fixture pertenece a otro tenant.",
    );
  }

  const { data: membershipsData, error: membershipsError } = await admin
    .from("user_tenants")
    .select("user_id,role")
    .eq("tenant_id", fixture.tenantId);
  await check(
    membershipsError,
    "No se pudieron validar las membresías fixture",
  );
  const memberships = (membershipsData ?? []) as Array<{
    user_id: string;
    role: string;
  }>;

  // Validar todas las identidades antes de borrar el tenant. Si una membresía
  // no corresponde al fixture, el script aborta sin tocar ninguna fila.
  const deletedUsers = await deleteFixtureUsers(admin, memberships);

  let deletedTenants = 0;
  if (tenantById) {
    const { data, error } = await admin
      .from("tenants")
      .delete()
      .eq("id", fixture.tenantId)
      .eq("slug", fixture.tenantSlug)
      .select("id");
    await check(error, "No se pudo eliminar el tenant fixture");
    deletedTenants = data?.length ?? 0;
    if (deletedTenants !== 1) {
      throw new Error(
        `Limpieza E2E abortada: se esperó eliminar 1 tenant y se eliminaron ${deletedTenants}.`,
      );
    }
  }

  const { data: remainingTenant, error: remainingTenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("id", fixture.tenantId)
    .maybeSingle();
  await check(
    remainingTenantError,
    "No se pudo verificar la ausencia del tenant fixture",
  );
  if (remainingTenant) {
    throw new Error("La limpieza E2E dejó el tenant fixture presente.");
  }

  console.log(
    JSON.stringify({
      cleaned: true,
      projectRef: environment.projectRef,
      deletedTenants,
      deletedUsers,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`Cleanup E2E falló: ${message}`);
  process.exitCode = 1;
});
