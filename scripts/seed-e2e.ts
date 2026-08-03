import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";

type AdminClient = ReturnType<typeof createE2EAdminClient>;

async function assertFixtureAbsent(admin: AdminClient): Promise<void> {
  const fixture = SDD_0168_FIXTURE;
  const { data: tenantById, error: tenantByIdError } = await admin
    .from("tenants")
    .select("id")
    .eq("id", fixture.tenantId)
    .maybeSingle();
  await check(tenantByIdError, "No se pudo verificar el tenant fixture por ID");

  const { data: tenantBySlug, error: tenantBySlugError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", fixture.tenantSlug)
    .maybeSingle();
  await check(
    tenantBySlugError,
    "No se pudo verificar el tenant fixture por slug",
  );
  if (tenantById || tenantBySlug) {
    throw new Error(
      "Seed E2E abortado: el proyecto efímero contiene un tenant fixture previo.",
    );
  }

  const expectedEmails = new Set([
    fixture.adminEmail.toLowerCase(),
    fixture.mentionedEmail.toLowerCase(),
  ]);
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const collision = data.users.find(
      (user) =>
        expectedEmails.has(user.email?.toLowerCase() ?? "") ||
        user.app_metadata?.e2e_fixture === "sdd-0168",
    );
    if (collision) {
      throw new Error(
        "Seed E2E abortado: el proyecto efímero contiene un usuario fixture previo.",
      );
    }
    if (data.users.length < 200) return;
  }
  throw new Error("No se pudo completar el inventario de usuarios E2E.");
}

async function ensureUser(
  admin: AdminClient,
  email: string,
  password: string,
): Promise<{ id: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { e2e_fixture: "sdd-0168" },
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

  await assertFixtureAbsent(admin);

  const { error: tenantError } = await admin.from("tenants").insert({
    id: fixture.tenantId,
    slug: fixture.tenantSlug,
    display_name: "DTD Cargo E2E SDD-0168",
  });
  await check(tenantError, "No se pudo preparar el tenant");

  const [adminUser, mentionedUser] = await Promise.all([
    ensureUser(admin, fixture.adminEmail, environment.password),
    ensureUser(admin, fixture.mentionedEmail, environment.password),
  ]);

  const { error: profilesError } = await admin.from("user_profiles").insert([
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
  ]);
  await check(profilesError, "No se pudieron preparar los perfiles");

  const { error: membershipsError } = await admin.from("user_tenants").insert([
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
  ]);
  await check(membershipsError, "No se pudieron preparar las membresías");

  const { error: shipmentError } = await admin.from("shipments").insert({
    id: fixture.shipmentId,
    tenant_id: fixture.tenantId,
    code: fixture.shipmentCode,
    client_name: "Cliente controlado E2E",
    origin: "Yiwu",
    destination: "Valencia",
    shipment_service: "consolidado_lcl",
    status: "draft",
    deleted_at: null,
  });
  await check(shipmentError, "No se pudo preparar el embarque");

  const { error: employeeError } = await admin.from("nomina_employees").insert({
    id: fixture.payrollEmployeeId,
    tenant_id: fixture.tenantId,
    employee_code: fixture.payrollEmployeeCode,
    full_name: "Persona Ficticia E2E",
    position_label: "Analista de pruebas",
    department: "Calidad",
    salary_usd: 1200,
    hire_date: "2024-01-15",
    status: "egresado",
    notes: "Fixture desechable SDD-0226; no corresponde a una persona real.",
    created_by: adminUser.id,
  });
  await check(employeeError, "No se pudo preparar el empleado ficticio de Nómina");

  const { error: journalError } = await admin.from("journal_entries").insert({
    id: fixture.payrollJournalEntryId,
    tenant_id: fixture.tenantId,
    entry_code: fixture.payrollJournalEntryCode,
    entry_date: "2026-07-31",
    memo: "Fixture desechable del finiquito gobernado SDD-0226",
    status: "asentado",
    source: "payroll_settlement",
    posted_at: "2026-07-31T12:00:00.000Z",
  });
  await check(journalError, "No se pudo preparar el asiento ficticio de Nómina");

  const { error: settlementError } = await admin.from("nomina_settlements").insert({
    id: fixture.payrollSettlementId,
    tenant_id: fixture.tenantId,
    settlement_code: fixture.payrollSettlementCode,
    employee_id: fixture.payrollEmployeeId,
    employee_code: fixture.payrollEmployeeCode,
    employee_name: "Persona Ficticia E2E",
    termination_cause: "renuncia_76",
    hire_date: "2024-01-15",
    termination_date: "2026-07-31",
    base_salary_usd: 1200,
    rules_snapshot: { fixture: "SDD-0226", advisory: true },
    status: "confirmado",
    total_prestaciones_usd: 800,
    total_fracciones_usd: 250,
    total_indemnizacion_usd: 0,
    total_intereses_usd: 25,
    total_deductions_usd: 75,
    total_net_usd: 1000,
    salario_integral_usd: 1300,
    journal_entry_id: fixture.payrollJournalEntryId,
    confirmed_at: "2026-07-31T12:00:00.000Z",
    notes: "Fixture desechable SDD-0226; no corresponde a una liquidación real.",
    created_by: adminUser.id,
  });
  await check(settlementError, "No se pudo preparar el finiquito ficticio");

  const { error: settlementLineError } = await admin
    .from("nomina_settlement_lines")
    .insert({
      id: fixture.payrollSettlementLineId,
      tenant_id: fixture.tenantId,
      settlement_id: fixture.payrollSettlementId,
      kind: "prestaciones",
      label: "Prestaciones sociales ficticias E2E",
      days: 20,
      base_usd: 1200,
      amount_usd: 800,
    });
  await check(
    settlementLineError,
    "No se pudo preparar el desglose ficticio del finiquito",
  );

  console.log(
    JSON.stringify({
      ready: true,
      ephemeral: true,
      projectRef: environment.projectRef,
      tenantId: fixture.tenantId,
      shipmentId: fixture.shipmentId,
      payrollSettlementId: fixture.payrollSettlementId,
      payrollSettlementCode: fixture.payrollSettlementCode,
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
