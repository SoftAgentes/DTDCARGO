import type { User } from "@supabase/supabase-js";
import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";

type AdminClient = ReturnType<typeof createE2EAdminClient>;

async function findUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  throw new Error(`No se pudo resolver el usuario E2E ${email}.`);
}

async function ensureUser(
  admin: AdminClient,
  email: string,
  password: string,
): Promise<User> {
  const existing = await findUserByEmail(admin, email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function check(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function main() {
  const environment = loadE2EEnvironment();
  const admin = createE2EAdminClient(environment);
  const fixture = SDD_0168_FIXTURE;

  const { error: tenantError } = await admin.from("tenants").upsert(
    {
      id: fixture.tenantId,
      slug: fixture.tenantSlug,
      display_name: "DTD Cargo E2E SDD-0168",
    },
    { onConflict: "id" },
  );
  await check(tenantError, "No se pudo preparar el tenant");

  const [adminUser, mentionedUser] = await Promise.all([
    ensureUser(admin, fixture.adminEmail, environment.password),
    ensureUser(admin, fixture.mentionedEmail, environment.password),
  ]);

  const { error: profilesError } = await admin.from("user_profiles").upsert(
    [
      {
        user_id: adminUser.id,
        first_name: "Admin",
        last_name: "E2E",
      },
      {
        user_id: mentionedUser.id,
        first_name: "Mention",
        last_name: "E2E",
      },
    ],
    { onConflict: "user_id" },
  );
  await check(profilesError, "No se pudieron preparar los perfiles");

  const { error: membershipsError } = await admin.from("user_tenants").upsert(
    [
      {
        user_id: adminUser.id,
        tenant_id: fixture.tenantId,
        role: "admin",
        disabled_at: null,
      },
      {
        user_id: mentionedUser.id,
        tenant_id: fixture.tenantId,
        role: "operations",
        disabled_at: null,
      },
    ],
    { onConflict: "user_id,tenant_id" },
  );
  await check(membershipsError, "No se pudieron preparar las membresías");

  const { data: priorComments, error: priorCommentsError } = await admin
    .from("comments")
    .select("id")
    .eq("tenant_id", fixture.tenantId)
    .eq("entity_type", "shipment")
    .eq("entity_id", fixture.shipmentId);
  await check(priorCommentsError, "No se pudieron localizar comentarios previos");

  const priorCommentIds = (priorComments ?? []).map((row) => row.id as string);
  if (priorCommentIds.length > 0) {
    const { error: auditError } = await admin
      .from("entity_audit_log")
      .delete()
      .eq("tenant_id", fixture.tenantId)
      .eq("entity_type", "comment")
      .in("entity_id", priorCommentIds);
    await check(auditError, "No se pudo limpiar la auditoría E2E previa");

    const { error: commentsError } = await admin
      .from("comments")
      .delete()
      .in("id", priorCommentIds);
    await check(commentsError, "No se pudieron limpiar comentarios E2E previos");
  }

  const { error: shipmentError } = await admin.from("shipments").upsert(
    {
      id: fixture.shipmentId,
      tenant_id: fixture.tenantId,
      code: fixture.shipmentCode,
      client_name: "Cliente controlado E2E",
      origin: "Yiwu",
      destination: "Valencia",
      shipment_service: "consolidado_lcl",
      status: "draft",
      deleted_at: null,
    },
    { onConflict: "id" },
  );
  await check(shipmentError, "No se pudo preparar el embarque");

  console.log(
    JSON.stringify({
      ready: true,
      projectRef: environment.projectRef,
      tenantId: fixture.tenantId,
      shipmentId: fixture.shipmentId,
      adminUserId: adminUser.id,
      mentionedUserId: mentionedUser.id,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`Seed E2E falló: ${message}`);
  process.exitCode = 1;
});
