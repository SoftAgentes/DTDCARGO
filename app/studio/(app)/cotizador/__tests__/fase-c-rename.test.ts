import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RULE_EVENT_LABELS, CATEGORY_DEFAULT_SUBJECT } from "@/lib/studio/mail-types";
import { COMMENT_ENTITY_LABELS } from "@/lib/studio/comments/types";
import { FORECAST_BUCKET_LABEL } from "@/lib/studio/costing/ui";

/**
 * SDD-0061 Fase C — rename interno del ERP: "cotización" → "estimado".
 *
 * Valida (a nivel de fuente + constantes exportadas, sin levantar Next) los
 * criterios de `acceptance` Fase C: la palabra "cotización"/"cotizaciones"/
 * "Cotizador" desaparece de la UI/copy/labels del ERP, el módulo pasa a llamarse
 * "Estimados", y los códigos nuevos se generan con `next_estimate_code` (EST-).
 *
 * NO valida lo que SE MANTIENE a propósito (carpeta `cotizador/`, ruta
 * `/studio/cotizador`, tipos `Quote*`, columna `quote_code`, slugs/eventos de
 * mailing `quote_sent`/`quote_accepted`) — eso es identificador interno, no copy.
 *
 * Corre dentro de `node scripts/verify.mjs` (Vitest), que es el gate.
 */

const root = resolve(__dirname, "..", "..", "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("SDD-0061 Fase C · módulo Estimados (ex-Cotizador)", () => {
  it("el header del listado dice 'Estimados', no 'Cotizador'", () => {
    const client = read(
      "app/studio/(app)/cotizador/_components/CotizadorClient.tsx",
    );
    expect(client).toContain("Estimados.");
    expect(client).toContain("+ Nuevo estimado");
    // sin copy "cotización" en el cuerpo (las únicas "cotiza" restantes son la
    // ruta /studio/cotizador y los nombres de identificador, no copy).
    expect(client).not.toContain("Nueva cotización");
    expect(client).not.toContain("Aún no hay cotizaciones");
  });

  it("metadata del módulo y del detalle usan 'Estimados'/'Detalle estimado'", () => {
    expect(read("app/studio/(app)/cotizador/page.tsx")).toContain(
      'metadata = { title: "Estimados" }',
    );
    expect(read("app/studio/(app)/cotizador/[code]/page.tsx")).toContain(
      'metadata = { title: "Detalle estimado" }',
    );
  });

  it("el drawer crea/edita 'estimado' (título + toasts)", () => {
    const drawer = read(
      "app/studio/(app)/cotizador/_components/QuoteDrawer.tsx",
    );
    expect(drawer).toContain('"Nuevo estimado" : "Editar estimado"');
    expect(drawer).toContain("Estimado ${code} creado");
    expect(drawer).not.toContain("Nueva cotización");
    expect(drawer).not.toContain("Cotización ${code} creada");
  });

  it("el detalle envía/acepta 'estimado', no 'cotización'", () => {
    const detail = read(
      "app/studio/(app)/cotizador/_components/QuoteDetailClient.tsx",
    );
    expect(detail).toContain('idleLabel="Enviar estimado"');
    expect(detail).toContain('successLabel="Estimado aceptado"');
    expect(detail).not.toContain("Enviar cotización");
    expect(detail).not.toContain("Cotización aceptada");
  });
});

describe("SDD-0061 Fase C · códigos EST- (next_estimate_code)", () => {
  it("createQuote genera el código con next_estimate_code (no next_quote_code)", () => {
    const actions = read("app/studio/(app)/cotizador/actions.ts");
    expect(actions).toContain('"next_estimate_code"');
    expect(actions).not.toContain('"next_quote_code"');
  });

  it("la RPC next_estimate_code existe en la migración y devuelve EST-YYYY-NNNN", () => {
    const migr = read("supabase/migrations/0113_estimado_web.sql");
    expect(migr).toContain("function public.next_estimate_code");
    expect(migr).toContain("'EST-'");
  });
});

describe("SDD-0061 Fase C · sidebar + i18n", () => {
  it("el label del sidebar es 'Estimados'", () => {
    // El registro de módulos se extrajo a lib/studio/modules.ts (SDD-0085).
    const registry = read("lib/studio/modules.ts");
    expect(registry).toContain('label: "Estimados", labelKey: "chrome.sidebar.quotes"');
    expect(read("lib/i18n/es-VE/chrome.ts")).toContain(
      '"chrome.sidebar.quotes": "Estimados"',
    );
  });
});

describe("SDD-0061 Fase C · dashboard", () => {
  // SDD-0114 reemplazó el layout FIJO del dashboard por uno configurable: los
  // KPIs ya no son literales en page.tsx sino entradas del KPI_CATALOG. El
  // invariante de terminología (usar "Estimados", nunca "Cotizaciones") se
  // re-ancla al catálogo + la card, sin debilitarse.
  it("la card y el catálogo de KPIs dicen 'Estimados', no 'Cotizaciones'", () => {
    expect(
      read("app/studio/(app)/dashboard/_components/RecentQuotesCard.tsx"),
    ).toContain("Estimados recientes");
    const catalog = read("lib/studio/dashboard/dashboard-catalog.ts");
    expect(catalog).toContain("Estimados aceptados (mes)");
    expect(catalog).not.toMatch(/cotizaci[oó]n/i);
    const page = read("app/studio/(app)/dashboard/page.tsx");
    expect(page).not.toMatch(/cotizaci[oó]n/i);
  });
});

describe("SDD-0061 Fase C · mailing (labels, NO identificadores)", () => {
  it("RULE_EVENT_LABELS usa 'Estimado enviado/aceptado' (keys quote_* intactas)", () => {
    expect(RULE_EVENT_LABELS.quote_sent).toBe("Estimado enviado");
    expect(RULE_EVENT_LABELS.quote_accepted).toBe("Estimado aceptado");
    // los identificadores del evento NO cambian (reglas vivas en prod)
    expect(RULE_EVENT_LABELS).toHaveProperty("quote_sent");
    expect(RULE_EVENT_LABELS).toHaveProperty("quote_accepted");
  });

  it("el subject por defecto comercial dice 'Estimado DTD Cargo…'", () => {
    expect(CATEGORY_DEFAULT_SUBJECT.comercial).toBe(
      "Estimado DTD Cargo para {{customer_name}}",
    );
  });

  it("los templates seed renombran name/subject/body pero MANTIENEN el slug", () => {
    const seed = read("scripts/seed-mail-templates.ts");
    // slugs intactos
    expect(seed).toContain('slug: "quote_sent"');
    expect(seed).toContain('slug: "quote_accepted"');
    // copy renombrada
    expect(seed).toContain('name: "Estimado enviado"');
    expect(seed).toContain('name: "Estimado aceptado · confirmación"');
    expect(seed).not.toContain('name: "Cotización enviada"');
  });
});

describe("SDD-0061 Fase C · helpers de label", () => {
  it("la entidad de comentarios 'quote' se rotula 'Estimado'", () => {
    expect(COMMENT_ENTITY_LABELS.quote.label).toBe("Estimado");
    // href/ruta intacta
    expect(COMMENT_ENTITY_LABELS.quote.href("uuid", "EST-2026-0001")).toBe(
      "/studio/cotizador/EST-2026-0001",
    );
  });

  it("los buckets del forecast concuerdan en género con 'estimado'", () => {
    expect(FORECAST_BUCKET_LABEL.accepted).toBe(
      "Aceptado · pendiente de embarcar",
    );
    expect(FORECAST_BUCKET_LABEL.pending).toBe("Enviado · esperando respuesta");
  });
});

describe("SDD-0061 Fase C · 'cotización' no aparece como copy del módulo", () => {
  // Las apariciones legítimas de "cotiza…" que SE MANTIENEN son: la ruta
  // /studio/cotizador (carpeta de código), los identificadores (CotizadorClient,
  // QuoteDrawer…) y las menciones a "ex-Cotizador" en los doc-comments. Lo que
  // NO debe quedar es COPY de cliente: declinaciones de "cotización/cotizaciones".
  const COPY_TERMS = [/cotizaci[oó]n/i, /cotizaciones/i];
  const moduleFiles = [
    "app/studio/(app)/cotizador/page.tsx",
    "app/studio/(app)/cotizador/_components/CotizadorClient.tsx",
    "app/studio/(app)/cotizador/_components/QuoteDrawer.tsx",
    "app/studio/(app)/cotizador/_components/QuoteDetailClient.tsx",
    "app/studio/(app)/cotizador/[code]/page.tsx",
    "app/studio/(app)/cotizador/actions.ts",
  ];

  it("ningún archivo del módulo contiene la palabra 'cotización'/'cotizaciones'", () => {
    for (const rel of moduleFiles) {
      const src = read(rel);
      for (const term of COPY_TERMS) {
        expect(src, `${rel} no debe contener ${term}`).not.toMatch(term);
      }
    }
  });

  it("las únicas refs a 'cotizador' del módulo son la ruta o el identificador (no la palabra 'Cotizador.' como título)", () => {
    const client = read(
      "app/studio/(app)/cotizador/_components/CotizadorClient.tsx",
    );
    // el viejo h1 "Cotizador." (con punto, como display) ya no existe
    expect(client).not.toContain(">\n            Cotizador.\n");
    expect(client).not.toContain("Cotizador.</h1>");
  });
});
