import { describe, expect, it } from "vitest";
import {
  analyzeRepositoryData,
  applyRelationColumns,
  extractCreatedSymbols,
  extractFunctionRelations,
  extractImportSpecifiers,
  findPendingOnlySymbols,
  findReachableModules,
  relationColumnsAfter,
} from "./check-pending-migration-symbols.mjs";

const EMPTY_DECLARATIONS = { schemaVersion: 1, degradations: [] };

function atLine(line, contents) {
  return `${"\n".repeat(line - 1)}${contents}\n`;
}

function names(items) {
  return items.map((item) => item.symbol?.displayName ?? item.displayName).sort();
}

describe("extractCreatedSymbols", () => {
  it("extrae las cuatro formas DDL del contrato y no lee DDL comentado o dinámico", () => {
    const sql = `
      -- create table public.commented_out(id uuid);
      create or replace function public.compute_widget(p_id uuid)
      returns void language plpgsql as $$
      begin
        execute 'create table public.dynamic_only(id uuid)';
      end $$;
      create table if not exists public.widgets(id uuid);
      create view reporting.active_widgets as select * from public.widgets;
      alter table only public.widgets
        add column if not exists status text,
        add column quantity integer;
    `;

    expect(extractCreatedSymbols(sql, "0451_fixture").map((symbol) => symbol.key)).toEqual([
      "column:public.widgets.quantity",
      "column:public.widgets.status",
      "function:public.compute_widget",
      "table:public.widgets",
      "view:reporting.active_widgets",
    ]);
  });
});

describe("findPendingOnlySymbols", () => {
  it("no trata una redefinición pendiente como ausencia si el símbolo nació en una aplicada", () => {
    const migrations = [
      { name: "0400_applied", sql: "create function public.existing_rpc() returns void language sql as 'select';" },
      { name: "0450_pending", sql: "create or replace function public.existing_rpc() returns void language sql as 'select';" },
    ];

    expect(findPendingOnlySymbols(migrations, ["0450_pending"])).toEqual([]);
  });
});

describe("grafo de imports", () => {
  it("sigue imports relativos, alias, reexports y dinámicos, pero ignora comentarios", () => {
    const sources = {
      "app/demo/page.tsx": `import { feature } from "./feature";`,
      "app/demo/feature.ts": `export { query } from "@/lib/query";`,
      "lib/query.ts": `const lazy = () => import("@/lib/deep");`,
      "lib/deep.ts": `export const ok = true;`,
      "lib/dead.ts": `// import "@/lib/ghost";`,
      "lib/ghost.ts": `export const ghost = true;`,
    };

    expect([...findReachableModules(sources)].sort()).toEqual([
      "app/demo/feature.ts",
      "app/demo/page.tsx",
      "lib/deep.ts",
      "lib/query.ts",
    ]);
    expect(extractImportSpecifiers(sources["lib/dead.ts"])).toEqual([]);
  });
});

describe("regresión del árbol 94a94f2d", () => {
  it("da ROJO por las tres dependencias fusionadas antes de aplicar 0449", () => {
    const migrations = [{
      name: "0449_prealerta_exact_box_reception",
      sql: `
        create or replace function public.receive_prealerta_boxes_as_operario() returns void language sql as 'select';
        create table public.shipping_label_versions(id uuid);
        create function public.save_shipping_label_presentation() returns void language sql as 'select';
      `,
    }];
    const sourceFiles = {
      "app/m/cn/recibir/page.tsx": `import { RecibirClient } from "./_components/RecibirClient";`,
      "app/m/cn/recibir/_components/RecibirClient.tsx": `import { receiveBoxes } from "../actions";`,
      "app/m/cn/recibir/actions.ts": atLine(
        186,
        `const result = await admin.rpc("receive_prealerta_boxes_as_operario", payload);`,
      ),
      "app/studio/(app)/admin/etiquetas/page.tsx": [
        `import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";`,
        `import { LabelEditor } from "./LabelEditor";`,
      ].join("\n"),
      "app/studio/(app)/admin/etiquetas/LabelEditor.tsx": `import { saveLabelPresentation } from "./actions";`,
      "app/studio/(app)/admin/etiquetas/actions.ts": atLine(
        13,
        `const result = await db.rpc("save_shipping_label_presentation", payload);`,
      ),
      "lib/studio/label-presentation-queries.ts": atLine(
        5,
        `const result = await db.from("shipping_label_versions").select("*");`,
      ),
    };

    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: ["0449_prealerta_exact_box_reception"],
      sourceFiles,
      declarations: EMPTY_DECLARATIONS,
    });

    expect(result.declarationErrors).toEqual([]);
    expect(names(result.red)).toEqual([
      "receive_prealerta_boxes_as_operario",
      "save_shipping_label_presentation",
      "shipping_label_versions",
    ]);
    expect(result.red.flatMap((item) => item.reachableReferences.map((reference) => reference.site))).toContain(
      "app/m/cn/recibir/actions.ts:186",
    );
  });
});

describe("clasificación declarada", () => {
  const migrationName = "0449_prealerta_exact_box_reception";
  const migrations = [{
    name: migrationName,
    sql: `
      create or replace function public.receive_prealerta_boxes_as_operario() returns void language sql as 'select';
      create table public.shipping_label_versions(id uuid);
      create function public.save_shipping_label_presentation() returns void language sql as 'select';
    `,
  }];
  const sourceFiles = {
    "app/studio/admin/page.tsx": [
      `import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";`,
      `import { LabelEditor } from "./LabelEditor";`,
    ].join("\n"),
    "app/studio/admin/LabelEditor.tsx": [
      `import { saveLabelPresentation } from "./actions";`,
      ...Array(23).fill(""),
      `<ActionButton disabled={!available} />`,
      `if (!available) return { error: "not available" };`,
    ].join("\n"),
    "app/studio/admin/actions.ts": atLine(
      13,
      `const result = await db.rpc("save_shipping_label_presentation", payload);`,
    ),
    "lib/studio/label-presentation-queries.ts": [
      "",
      "",
      "",
      "",
      `const row = await db.from("shipping_label_versions").select("*");`,
      "",
      "",
      `const settings = parsed ?? DEFAULT_LABEL_PRESENTATION;`,
      "",
      `const available = !error;`,
    ].join("\n"),
  };
  const declarations = {
    schemaVersion: 1,
    degradations: [{
      id: "labels",
      primarySymbol: "shipping_label_versions",
      migration: migrationName,
      symbols: [
        { kind: "table", name: "shipping_label_versions", callSites: ["lib/studio/label-presentation-queries.ts:5"] },
        { kind: "function", name: "save_shipping_label_presentation", callSites: ["app/studio/admin/actions.ts:13"] },
      ],
      evidence: [
        {
          site: "lib/studio/label-presentation-queries.ts:8",
          contains: "DEFAULT_LABEL_PRESENTATION",
          degradation: "usa defaults",
        },
        {
          site: "app/studio/admin/LabelEditor.tsx:25",
          contains: "disabled={!available}",
          degradation: "deshabilita guardar",
        },
      ],
    }],
  };

  it("agrupa símbolos nombrados en un solo AMARILLO y deja en silencio lo no importado", () => {
    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: [migrationName],
      sourceFiles,
      declarations,
    });

    expect(result.declarationErrors).toEqual([]);
    expect(result.red).toEqual([]);
    expect(result.yellow.map((group) => group.primarySymbol)).toEqual(["shipping_label_versions"]);
    expect(names(result.silent)).toEqual(["receive_prealerta_boxes_as_operario"]);
  });

  it("rechaza una declaración que no enumera exactamente los sitios reales", () => {
    const stale = structuredClone(declarations);
    stale.degradations[0].symbols[0].callSites = [];
    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: [migrationName],
      sourceFiles,
      declarations: stale,
    });

    expect(result.declarationErrors.join("\n")).toContain("shipping_label_versions declara []");
  });
});

describe("modelo de columnas por relación (SDD-0464)", () => {
  it("lee cuerpos de create table, add/drop/rename column y drop table en orden textual", () => {
    const relations = applyRelationColumns(`
      create table public.dispatch_orders (
        id                uuid primary key default gen_random_uuid(),
        tenant_id         uuid not null references public.tenants (id) on delete cascade,
        status            text not null default 'creada', -- 'OD-2026-0142'
        amount            numeric(12, 2) default 0,
        cancelled_at      timestamptz,
        "Quoted Col"      text,
        constraint dispatch_orders_code unique (tenant_id, order_code),
        primary key (id),
        check (amount >= 0)
      );
      create temporary table _pares(id uuid, cancelled_at timestamptz);
      create view public.active_orders as select * from public.dispatch_orders;
      alter table public.dispatch_orders add column if not exists cancelled_by uuid, drop column if exists status;
      alter table public.dispatch_orders rename column amount to total_amount;
      create table public.gone(id uuid, cancelled_at timestamptz);
      drop table if exists public.gone;
    `);

    expect([...relations.get("public.dispatch_orders")].sort()).toEqual([
      "Quoted Col",
      "cancelled_at",
      "cancelled_by",
      "id",
      "tenant_id",
      "total_amount",
    ]);
    expect(relations.get("public.active_orders")).toEqual(new Set());
    expect(relations.has("public._pares")).toBe(false);
    expect(relations.has("public.gone")).toBe(false);
  });

  it("aplica las migraciones por nombre: una columna borrada después deja de constar", () => {
    const relations = relationColumnsAfter([
      { name: "0300_drop", sql: "alter table public.t drop column c;" },
      { name: "0100_create", sql: "create table public.t(id uuid, c text);" },
    ]);

    expect([...relations.get("public.t")]).toEqual(["id"]);
  });

  it("lee qué funciones devuelven filas de una relación; returns table(…) no nombra ninguna", () => {
    const relations = extractFunctionRelations(`
      create or replace function public.confirm_payment_report(p_id uuid, p_note text default coalesce(null, 'x'))
      returns public.payment_reports language plpgsql as $$ begin return null; end $$;
      create function public.find_client_by_cedula(p text) returns setof public.clients language sql as 'select';
      create function public.list_things() returns table(id uuid, cancelled_at timestamptz) language sql as 'select';
      create function public.as_json() returns jsonb language sql as 'select';
    `);

    expect(relations.get("public.confirm_payment_report")).toBe("public.payment_reports");
    expect(relations.get("public.find_client_by_cedula")).toBe("public.clients");
    expect(relations.has("public.list_things")).toBe(false);
    // Un tipo escalar queda en el mapa; el consumidor lo filtra contra las relaciones conocidas.
    expect(relations.get("public.as_json")).toBe("public.jsonb");
  });
});

/**
 * Forma real del caso L14 (PR #104, head 93f1cbed): 0421 agrega a payment_reports
 * tres columnas cuyos nombres ya existen en dispatch_orders, qr_print_orders y
 * expense_alerts. Con la asociación por nombre, esos módulos exigían declaración.
 */
describe("asociación columna → relación: caso L14", () => {
  const PENDING_MIGRATION = "0421_payment_report_commands";
  const migrations = [
    {
      name: "0024_dispatch_core",
      sql: `create table public.dispatch_orders (
        id uuid primary key default gen_random_uuid(),
        status text not null default 'creada',
        cancelled_at timestamptz,
        cancel_reason text,
        cancelled_by uuid references auth.users(id)
      );`,
    },
    {
      name: "0027_qr_print_orders",
      sql: "create table if not exists public.qr_print_orders(id uuid, cancelled_at timestamptz, cancelled_by uuid);",
    },
    {
      name: "0075_expense_alerts",
      sql: `create table public.expense_alerts (
        id uuid,
        resolved_at timestamptz, -- null = activa
        resolution_reason public.expense_alert_resolution
      );`,
    },
    {
      name: "0195_payment_reports",
      sql: `create table public.payment_reports (id uuid, status text);
        create function public.confirm_payment_report(p_id uuid) returns public.payment_reports language sql as 'select';`,
    },
    {
      name: PENDING_MIGRATION,
      sql: `alter table public.payment_reports
          add column cancelled_at timestamptz,
          add column cancelled_by uuid,
          add column resolution_reason text;
        create function public.create_portal_payment_report(p_request_id uuid) returns jsonb language sql as 'select';`,
    },
  ];
  const sourceFiles = {
    "app/portal/(app)/facturas/[code]/page.tsx": `import { listMyInvoiceReports } from "@/lib/portal/payment-report-queries";`,
    "lib/portal/payment-report-queries.ts": [
      `import type { PaymentReport } from "@/lib/portal/payment-report-types";`,
      `const REPORT_COLS = "id, status, cancelled_at, cancelled_by, resolution_reason";`,
      `export function mapPaymentReportRow(row) {`,
      `  return { cancelledAt: row.cancelled_at, cancelledBy: row.cancelled_by, reason: row.resolution_reason };`,
      `}`,
      `export async function listMyInvoiceReports(db) {`,
      `  const { data, error } = await db.from("payment_reports").select(REPORT_COLS).is("cancelled_at", null);`,
      `  if (error || !Array.isArray(data)) return null;`,
      `  return data.map(mapPaymentReportRow);`,
      `}`,
    ].join("\n"),
    "lib/portal/payment-report-types.ts": `export type PaymentReport = { cancelledAt: string | null };`,
    "app/studio/(app)/despacho/page.tsx": `import { listDispatchOrders } from "@/lib/studio/dispatch-queries";`,
    "lib/studio/dispatch-queries.ts": [
      `import type { DispatchOrder } from "./dispatch-types";`,
      `const OD_COLUMNS = "id, status, cancelled_at, cancelled_by, cancel_reason";`,
      `export async function listDispatchOrders(db, weekAgoIso) {`,
      `  return db.from("dispatch_orders").select(OD_COLUMNS).gte("cancelled_at", weekAgoIso);`,
      `}`,
    ].join("\n"),
    "lib/studio/dispatch-types.ts": [
      `export type DispatchOrder = {`,
      `  cancelled_at: string | null;`,
      `  cancelled_by: string | null;`,
      `};`,
    ].join("\n"),
    "app/studio/(app)/cola-qr/page.tsx": `import { listQrOrders } from "@/lib/studio/qr-queue-queries";`,
    "lib/studio/qr-queue-queries.ts": [
      `import type { QrOrder } from "./qr-queue-types";`,
      `const QR_COLUMNS = "id, status, cancelled_at, cancelled_by";`,
      `export const listQrOrders = (db) => db.from("qr_print_orders").select(QR_COLUMNS);`,
    ].join("\n"),
    "lib/studio/qr-queue-types.ts": [
      `export type QrOrder = {`,
      `  cancelled_at: string | null;`,
      `  cancelled_by: string | null;`,
      `};`,
    ].join("\n"),
    "app/studio/(app)/cn/page.tsx": `import { countActiveAlerts } from "@/lib/studio/expense-alerts-queries";`,
    "lib/studio/expense-alerts-queries.ts": [
      `import type { ExpenseAlert } from "./expense-alerts-types";`,
      `export const countActiveAlerts = (db) => db.from("expense_alerts").select("id", { count: "exact", head: true });`,
      `export const resolveAuto = (admin) => admin.from("expense_alerts").update({ resolution_reason: "auto" });`,
    ].join("\n"),
    "lib/studio/expense-alerts-types.ts": [
      `export type ExpenseAlert = {`,
      `  resolution_reason: "manual" | "auto" | "reverted" | null;`,
      `};`,
    ].join("\n"),
  };
  const PAYMENT_SITES = {
    cancelled_at: [
      "lib/portal/payment-report-queries.ts:2",
      "lib/portal/payment-report-queries.ts:4",
      "lib/portal/payment-report-queries.ts:7",
    ],
    cancelled_by: ["lib/portal/payment-report-queries.ts:2", "lib/portal/payment-report-queries.ts:4"],
    resolution_reason: ["lib/portal/payment-report-queries.ts:2", "lib/portal/payment-report-queries.ts:4"],
  };
  const declarations = {
    schemaVersion: 1,
    degradations: [{
      id: "l14-payment-report-columns-pending",
      primarySymbol: "payment_reports.cancelled_at",
      migration: PENDING_MIGRATION,
      symbols: Object.entries(PAYMENT_SITES).map(([column, callSites]) => ({
        kind: "column",
        name: `payment_reports.${column}`,
        callSites,
      })),
      evidence: [{
        site: "lib/portal/payment-report-queries.ts:8",
        contains: "return null;",
        degradation: "Sin las columnas, PostgREST rechaza el select y la lectura devuelve null.",
      }],
    }],
  };

  function analysisOf(result, displayName) {
    return result.analyses.find((analysis) => analysis.symbol.displayName === displayName);
  }

  it("no exige los sitios homónimos de otras relaciones y los reporta con su dueña", () => {
    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: [PENDING_MIGRATION],
      sourceFiles,
      declarations: EMPTY_DECLARATIONS,
    });

    expect(result.declarationErrors).toEqual([]);
    expect(names(result.red)).toEqual([
      "payment_reports.cancelled_at",
      "payment_reports.cancelled_by",
      "payment_reports.resolution_reason",
    ]);
    for (const [column, sites] of Object.entries(PAYMENT_SITES)) {
      const analysis = analysisOf(result, `payment_reports.${column}`);
      expect(analysis.reachableReferences.map((reference) => reference.site).sort()).toEqual(sites);
    }
    const homonym = (column) =>
      analysisOf(result, `payment_reports.${column}`).homonymReferences
        .map((reference) => `${reference.site} → ${reference.relation}`)
        .sort();
    expect(homonym("cancelled_at")).toEqual([
      "lib/studio/dispatch-queries.ts:2 → dispatch_orders",
      "lib/studio/dispatch-queries.ts:4 → dispatch_orders",
      "lib/studio/dispatch-types.ts:2 → dispatch_orders",
      "lib/studio/qr-queue-queries.ts:2 → qr_print_orders",
      "lib/studio/qr-queue-types.ts:2 → qr_print_orders",
    ]);
    expect(homonym("cancelled_by")).toEqual([
      "lib/studio/dispatch-queries.ts:2 → dispatch_orders",
      "lib/studio/dispatch-types.ts:3 → dispatch_orders",
      "lib/studio/qr-queue-queries.ts:2 → qr_print_orders",
      "lib/studio/qr-queue-types.ts:3 → qr_print_orders",
    ]);
    expect(homonym("resolution_reason")).toEqual([
      "lib/studio/expense-alerts-queries.ts:3 → expense_alerts",
      "lib/studio/expense-alerts-types.ts:2 → expense_alerts",
    ]);
  });

  it("una declaración con solo los sitios de payment_reports asciende a AMARILLO", () => {
    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: [PENDING_MIGRATION],
      sourceFiles,
      declarations,
    });

    expect(result.declarationErrors).toEqual([]);
    expect(result.red).toEqual([]);
    expect(result.yellow.map((group) => group.primarySymbol)).toEqual(["payment_reports.cancelled_at"]);
  });

  it("una declaración que aún enumera un sitio homónimo se rechaza con la lista real", () => {
    const stale = structuredClone(declarations);
    stale.degradations[0].symbols[0].callSites.push("lib/studio/dispatch-queries.ts:2");
    const result = analyzeRepositoryData({
      migrations,
      pendingMigrationNames: [PENDING_MIGRATION],
      sourceFiles,
      declarations: stale,
    });

    expect(result.declarationErrors.join("\n")).toMatch(
      /payment_reports\.cancelled_at declara \[.*dispatch-queries\.ts:2\] pero hoy llama desde \[lib\/portal\/payment-report-queries\.ts:2, lib\/portal\/payment-report-queries\.ts:4, lib\/portal\/payment-report-queries\.ts:7\]/,
    );
  });
});

describe("asociación columna → relación: la columna de su propia relación siempre se exige", () => {
  const PENDING_MIGRATION = "0421_payment_report_commands";
  const migrations = [
    { name: "0024_dispatch_core", sql: "create table public.dispatch_orders(id uuid, cancelled_at timestamptz);" },
    {
      name: "0195_payment_reports",
      sql: `create table public.payment_reports (id uuid);
        create function public.confirm_payment_report(p_id uuid) returns public.payment_reports language sql as 'select';`,
    },
    { name: PENDING_MIGRATION, sql: "alter table public.payment_reports add column cancelled_at timestamptz;" },
  ];

  function redSites(sourceFiles, extraMigrations = []) {
    const result = analyzeRepositoryData({
      migrations: [...migrations, ...extraMigrations],
      pendingMigrationNames: [PENDING_MIGRATION],
      sourceFiles,
      declarations: EMPTY_DECLARATIONS,
    });
    return result.red.flatMap((analysis) => analysis.reachableReferences.map((reference) => reference.site)).sort();
  }

  it("en el mapper que importa el módulo que nombra la relación (select * no menciona la columna)", () => {
    expect(redSites({
      "app/portal/page.tsx": `import { list } from "@/lib/portal/payment-report-queries";`,
      "lib/portal/payment-report-queries.ts": [
        `import { mapRow } from "./payment-report-mapper";`,
        `export const list = (db) => db.from("payment_reports").select("*").then((rows) => rows.map(mapRow));`,
      ].join("\n"),
      "lib/portal/payment-report-mapper.ts": `export const mapRow = (row) => ({ cancelledAt: row.cancelled_at });`,
    })).toEqual(["lib/portal/payment-report-mapper.ts:1"]);
  });

  it("en un módulo que no nombra relación alguna ni tiene vecino que aporte otra dueña: falla cerrado", () => {
    expect(redSites({
      "app/portal/page.tsx": `import { when } from "@/lib/shared/format";`,
      "lib/shared/format.ts": `export const when = (row) => row.cancelled_at;`,
    })).toEqual(["lib/shared/format.ts:1"]);
  });

  it("cuando el módulo nombra a la vez la relación pendiente y otra dueña", () => {
    expect(redSites({
      "app/studio/page.tsx": `import { both } from "@/lib/studio/mixed";`,
      "lib/studio/mixed.ts": [
        `export const a = (db) => db.from("dispatch_orders").select("cancelled_at");`,
        `export const b = (db) => db.from("payment_reports").select("cancelled_at");`,
        `export const both = [a, b];`,
      ].join("\n"),
    })).toEqual(["lib/studio/mixed.ts:1", "lib/studio/mixed.ts:2"]);
  });

  it("cuando el módulo consume una función que devuelve la relación (returns relación)", () => {
    expect(redSites({
      "app/studio/page.tsx": `import { confirm } from "./actions";`,
      "app/studio/actions.ts": [
        `export async function confirm(db, id) {`,
        `  const { data } = await db.rpc("confirm_payment_report", { p_id: id });`,
        `  return data.cancelled_at;`,
        `}`,
      ].join("\n"),
    })).toEqual(["app/studio/actions.ts:3"]);
  });

  it("a dos saltos de un módulo que nombra otra dueña: el vecindario es directo", () => {
    expect(redSites({
      "app/studio/page.tsx": `import { a } from "@/lib/a";`,
      "lib/a.ts": `import { b } from "./b";\nexport const a = (db) => db.from("dispatch_orders").select("id").then(b);`,
      "lib/b.ts": `import { c } from "./c";\nexport const b = c;`,
      "lib/c.ts": `export const c = (row) => row.cancelled_at;`,
    })).toEqual(["lib/c.ts:1"]);
  });

  it("cuando otra migración aplicada ya borró la columna homónima de la otra dueña", () => {
    const sources = {
      "app/studio/page.tsx": `import { list } from "@/lib/studio/dispatch-queries";`,
      "lib/studio/dispatch-queries.ts": `export const list = (db) => db.from("dispatch_orders").select("id").gte("cancelled_at", "x");`,
    };

    expect(redSites(sources)).toEqual([]);
    expect(redSites(sources, [
      { name: "0300_dispatch_orders_drop_cancelled_at", sql: "alter table public.dispatch_orders drop column cancelled_at;" },
    ])).toEqual(["lib/studio/dispatch-queries.ts:1"]);
  });
});

describe("las funciones pendientes siguen asociándose por nombre", () => {
  it("exige la llamada RPC aunque el módulo solo nombre otra relación", () => {
    const result = analyzeRepositoryData({
      migrations: [
        { name: "0024_dispatch_core", sql: "create table public.dispatch_orders(id uuid, cancelled_at timestamptz);" },
        { name: "0195_payment_reports", sql: "create table public.payment_reports (id uuid);" },
        {
          name: "0421_payment_report_commands",
          sql: `alter table public.payment_reports add column cancelled_at timestamptz;
            create function public.create_portal_payment_report(p_request_id uuid) returns jsonb language sql as 'select';`,
        },
      ],
      pendingMigrationNames: ["0421_payment_report_commands"],
      sourceFiles: {
        "app/studio/page.tsx": `import { cancel, report } from "@/lib/studio/dispatch-actions";`,
        "lib/studio/dispatch-actions.ts": [
          `export const cancel = (db, now) => db.from("dispatch_orders").update({ cancelled_at: now });`,
          `export const report = (db) => db.rpc("create_portal_payment_report", {});`,
        ].join("\n"),
      },
      declarations: EMPTY_DECLARATIONS,
    });

    expect(names(result.red)).toEqual(["create_portal_payment_report"]);
    expect(result.red[0].reachableReferences.map((reference) => reference.site)).toEqual(["lib/studio/dispatch-actions.ts:2"]);
    const column = result.analyses.find((analysis) => analysis.symbol.displayName === "payment_reports.cancelled_at");
    expect(column.reachableReferences).toEqual([]);
    expect(column.homonymReferences.map((reference) => `${reference.site} → ${reference.relation}`)).toEqual([
      "lib/studio/dispatch-actions.ts:1 → dispatch_orders",
    ]);
  });
});

describe("silencio sin importador transitivo", () => {
  it("mantiene silenciosas las seis tablas no_olvidar_* cuando su módulo no llega desde app/**", () => {
    const tableNames = [
      "no_olvidar_items",
      "no_olvidar_user_keys",
      "no_olvidar_access_log",
      "no_olvidar_recovery_requests",
      "no_olvidar_kek_versions",
      "no_olvidar_config",
    ];
    const result = analyzeRepositoryData({
      migrations: [{
        name: "0017_no_olvidar",
        sql: tableNames.map((name) => `create table public.${name}(id uuid);`).join("\n"),
      }],
      pendingMigrationNames: ["0017_no_olvidar"],
      sourceFiles: {
        "app/page.tsx": `export default function Page() { return null; }`,
        "lib/studio/no-olvidar-queries.ts": tableNames
          .map((name) => `const ${name} = db.from("${name}");`)
          .join("\n"),
      },
      declarations: EMPTY_DECLARATIONS,
    });

    expect(result.red).toEqual([]);
    expect(names(result.silent)).toEqual([...tableNames].sort());
  });
});
