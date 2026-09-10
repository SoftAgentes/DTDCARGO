import { describe, expect, it } from "vitest";
import {
  analyzeRepositoryData,
  extractCreatedSymbols,
  extractImportSpecifiers,
  findPendingOnlySymbols,
  findReachableModules,
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
