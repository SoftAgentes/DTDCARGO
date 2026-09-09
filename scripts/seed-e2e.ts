import {
  E2E_PUBLIC_TENANT_SLUG,
  E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS,
  SDD_0168_FIXTURE,
  buildE2ECalculatorSettings,
  buildE2ECalculatorSettingsBaseline,
  createE2EAdminClient,
  getE2EExpenseOccurredAt,
  getE2ESchemaRetryDelayMs,
  isRetryableE2ESchemaError,
  loadE2EEnvironment,
} from "./e2e/sdd-0168-fixture";
import { DEFAULT_PARAMS } from "../lib/calculadora";

type AdminClient = ReturnType<typeof createE2EAdminClient>;
type SchemaError = { code?: string; message: string };

const REQUIRED_SCHEMA = [
  { table: "tenants", columns: "id, slug, display_name" },
  {
    table: "user_profiles",
    columns: "user_id, first_name, last_name",
  },
  {
    table: "user_tenants",
    columns: "user_id, tenant_id, role, disabled_at",
  },
  {
    table: "shipments",
    columns:
      "id, tenant_id, code, client_name, origin, destination, shipment_service, status, created_at, deleted_at",
  },
  {
    table: "expenses",
    columns:
      "id, tenant_id, user_id, expense_code, amount, currency, amount_usd, fx_rate, category, scope, method, shipment_id, note, location, billable, receipt_path, receipt_document_id, account_id, occurred_at, created_at, updated_at, deleted_at",
  },
  {
    table: "nomina_employees",
    columns:
      "id, tenant_id, employee_code, full_name, national_id, position_label, department, position_id, phone, email, salary_usd, hire_date, birth_date, bank_name, bank_account_type, bank_account, status, notes, auth_user_id, created_by, created_at, updated_at, deleted_at",
  },
  {
    table: "journal_entries",
    columns:
      "id, tenant_id, entry_code, entry_date, memo, status, source, expense_id, posted_at, deleted_at",
  },
  {
    table: "nomina_settlements",
    columns:
      "id, tenant_id, settlement_code, employee_id, employee_code, employee_name, termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot, status, total_prestaciones_usd, total_fracciones_usd, total_indemnizacion_usd, total_intereses_usd, total_deductions_usd, total_net_usd, salario_integral_usd, pdf_path, journal_entry_id, confirmed_at, notes, created_by, created_at, updated_at, deleted_at",
  },
  {
    table: "nomina_settlement_lines",
    columns:
      "id, tenant_id, settlement_id, kind, label, days, base_usd, amount_usd, created_at",
  },
  {
    table: "calculator_settings",
    columns:
      "tenant_id, peso_incluido_kg, recargo_excedente_kg, descuento_valencia, recargo_embalaje_especial, recargo_bateria_mult, threshold_casco_km, tarifa_km_fuera_casco, cbm_max_contenedor, peso_max_contenedor_kg, peso_max_envio_kg",
  },
] as const;

type SchemaFailure = {
  table: (typeof REQUIRED_SCHEMA)[number]["table"];
  error: SchemaError;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function inspectRequiredSchema(
  admin: AdminClient,
): Promise<SchemaFailure[]> {
  const checks = await Promise.all(
    REQUIRED_SCHEMA.map(async ({ table, columns }): Promise<SchemaFailure | null> => {
      const { error } = await admin
        .from(table)
        // No usar HEAD: PostgREST puede devolver el fallo sin cuerpo y
        // postgrest-js pierde `code`/`message`, impidiendo distinguir de forma
        // fail-closed una caché tardía de un error real.
        .select(columns)
        .limit(1);
      return error
        ? { table, error: { code: error.code, message: error.message } }
        : null;
    }),
  );
  return checks.filter((check): check is SchemaFailure => check !== null);
}

function schemaFailureSummary(failures: SchemaFailure[]): string {
  return failures
    .map(({ table, error }) => `${table}:${error.code ?? "sin-código"}`)
    .join(", ");
}

async function waitForRequiredSchema(admin: AdminClient): Promise<void> {
  for (
    let attempt = 1;
    attempt <= E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const failures = await inspectRequiredSchema(admin);
    if (failures.length === 0) return;

    const summary = schemaFailureSummary(failures);
    const unexpected = failures.find(
      ({ error }) => !isRetryableE2ESchemaError(error),
    );
    if (unexpected) {
      throw new Error(
        `Preflight E2E abortado por un error no reintentable (${summary}): ${unexpected.error.message}`,
      );
    }

    const delayMs = getE2ESchemaRetryDelayMs(attempt);
    if (delayMs === null) {
      throw new Error(
        `Preflight E2E abortado: la caché de esquema no convergió tras ${attempt} intentos (${summary}).`,
      );
    }
    console.warn(
      `[schema-preflight] Caché de PostgREST incompleta (${summary}); reintento ${attempt + 1}/${E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS} en ${delayMs} ms.`,
    );
    await sleep(delayMs);
  }
}

async function assertFixtureAbsent(admin: AdminClient): Promise<void> {
  const fixture = SDD_0168_FIXTURE;
  const { data: expenseById, error: expenseByIdError } = await admin
    .from("expenses")
    .select("id")
    .eq("id", fixture.expenseId)
    .maybeSingle();
  await check(
    expenseByIdError,
    "No se pudo verificar el gasto fixture por ID",
  );
  if (expenseById) {
    throw new Error(
      "Seed E2E abortado: el proyecto efímero contiene un gasto fixture previo.",
    );
  }

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

async function normalizePublicCalculatorSettings(
  admin: AdminClient,
): Promise<void> {
  const settings = buildE2ECalculatorSettings(DEFAULT_PARAMS);
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", E2E_PUBLIC_TENANT_SLUG)
    .single();
  await check(tenantError, "No se pudo resolver el tenant público dtd");
  if (!tenant?.id) {
    throw new Error("El branch efímero no contiene el tenant público dtd.");
  }

  const selectedColumns = Object.keys(settings).join(", ");
  // Única escritura del seed fuera del tenant de fixture, sin respaldo ni
  // restauración: el estado previo se lee y se emite ANTES de sobrescribir,
  // para que un apuntado equivocado quede diagnosticable en el log. Si esa
  // lectura falla se aborta: no se sobrescribe a ciegas.
  const { data: baseline, error: baselineError } = await admin
    .from("calculator_settings")
    .select(selectedColumns)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  await check(
    baselineError,
    "No se pudo leer la calculadora pública antes de normalizarla",
  );
  console.log(
    JSON.stringify(
      buildE2ECalculatorSettingsBaseline(
        String(tenant.id),
        baseline as Record<string, unknown> | null,
      ),
    ),
  );

  const { data, error } = await admin
    .from("calculator_settings")
    .update(settings)
    .eq("tenant_id", tenant.id)
    .select(selectedColumns)
    .single();
  await check(error, "No se pudo normalizar la calculadora pública E2E");

  const stored = data as Record<string, unknown> | null;
  for (const [column, expected] of Object.entries(settings)) {
    if (Number(stored?.[column]) !== expected) {
      throw new Error(
        `La calculadora E2E no confirmó ${column}=${expected}.`,
      );
    }
  }
}

async function main() {
  const environment = loadE2EEnvironment();
  const admin = createE2EAdminClient(environment);
  const fixture = SDD_0168_FIXTURE;
  const expenseOccurredAt = getE2EExpenseOccurredAt();

  await waitForRequiredSchema(admin);
  await assertFixtureAbsent(admin);
  await normalizePublicCalculatorSettings(admin);

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

  const { data: expense, error: expenseError } = await admin
    .from("expenses")
    .insert({
      id: fixture.expenseId,
      tenant_id: fixture.tenantId,
      user_id: adminUser.id,
      expense_code: fixture.expenseCode,
      amount: 24.3,
      currency: "USD",
      amount_usd: 24.3,
      fx_rate: 1,
      category: "otro",
      scope: "shipment",
      method: "cash",
      shipment_id: fixture.shipmentId,
      note: "Fixture desechable SDD-0243; no corresponde a un gasto real.",
      location: "Entorno efímero E2E",
      billable: false,
      occurred_at: expenseOccurredAt,
      created_at: expenseOccurredAt,
      updated_at: expenseOccurredAt,
    })
    .select("id, expense_code, deleted_at")
    .single();
  await check(expenseError, "No se pudo preparar el gasto ficticio");
  if (
    expense?.id !== fixture.expenseId ||
    expense.expense_code !== fixture.expenseCode ||
    expense.deleted_at !== null
  ) {
    throw new Error(
      "El gasto ficticio no cumple la postcondición determinista del seed E2E.",
    );
  }

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
    // El guard de 0316 sólo permite crear renglones mientras el finiquito
    // sigue abierto. El fixture reproduce el orden real: borrador, desglose y
    // recién entonces confirmación.
    status: "borrador",
    total_prestaciones_usd: 800,
    total_fracciones_usd: 250,
    total_indemnizacion_usd: 0,
    total_intereses_usd: 25,
    total_deductions_usd: 75,
    total_net_usd: 1000,
    salario_integral_usd: 1300,
    journal_entry_id: fixture.payrollJournalEntryId,
    confirmed_at: null,
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

  const { error: confirmSettlementError } = await admin
    .from("nomina_settlements")
    .update({
      status: "confirmado",
      confirmed_at: "2026-07-31T12:00:00.000Z",
    })
    .eq("id", fixture.payrollSettlementId);
  await check(
    confirmSettlementError,
    "No se pudo confirmar el finiquito ficticio",
  );

  console.log(
    JSON.stringify({
      ready: true,
      ephemeral: true,
      projectRef: environment.projectRef,
      tenantId: fixture.tenantId,
      shipmentId: fixture.shipmentId,
      expenseId: fixture.expenseId,
      expenseCode: fixture.expenseCode,
      expenseOccurredAt,
      calculatorSettingsNormalized: true,
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
