/**
 * Contrato del catálogo de feature flags (SDD-0240).
 *
 * El catálogo vive DUPLICADO a propósito: el de TypeScript tipa el cliente,
 * el de SQL (`feature_flag_catalog()` en 0337) siembra las filas. Ninguno
 * puede hacer el trabajo del otro. Lo que no puede pasar es que DIVERJAN —
 * así nació el bug de `marketing_news`: se agregó al catálogo de TS sin
 * migración que lo sembrara, la RPC de toggle hace UPDATE sobre una fila
 * inexistente, y el módulo Noticias Web quedó inalcanzable en silencio.
 *
 * Estos tests son el detector de esa clase de bug, no de ese bug puntual.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_EFFECT,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_LABELS,
  MODULE_FLAG_MAP,
  type FeatureFlagKey,
} from "../feature-flags-types";

const RAIZ = process.cwd();
const MIGRACIONES = join(RAIZ, "supabase", "migrations");

/** Lee el cuerpo de `feature_flag_catalog()` y devuelve key → default. */
function catalogoSql(): Map<string, boolean> {
  const archivo = readdirSync(MIGRACIONES).find((f) =>
    f.startsWith("0337_feature_flags_seed_and_trigger"),
  );
  if (!archivo) {
    throw new Error(
      "No encontré la migración 0337 del catálogo de feature flags. " +
        "Si se renumeró, actualizá este contrato.",
    );
  }
  const sql = readFileSync(join(MIGRACIONES, archivo), "utf8");

  const desde = sql.indexOf("create or replace function public.feature_flag_catalog");
  expect(desde, "0337 debe definir feature_flag_catalog()").toBeGreaterThan(-1);
  const hasta = sql.indexOf("$$;", desde);
  const cuerpo = sql.slice(desde, hasta);

  // Filas del VALUES: ('key', true|false, 'descripción')
  const out = new Map<string, boolean>();
  for (const m of cuerpo.matchAll(/\(\s*'([a-z0-9_.]+)'\s*,\s*(true|false)\s*,/g)) {
    out.set(m[1], m[2] === "true");
  }
  return out;
}

describe("Catálogo de feature flags · TS ↔ SQL (SDD-0240)", () => {
  const sql = catalogoSql();

  it("el catálogo SQL no está vacío (sanity del parser)", () => {
    expect(sql.size).toBeGreaterThan(15);
  });

  it("toda key del código está sembrada por una migración", () => {
    const faltantes = FEATURE_FLAG_KEYS.filter((k) => !sql.has(k));
    expect(
      faltantes,
      `Estas keys existen en FEATURE_FLAG_DEFAULTS pero NINGUNA migración las ` +
        `siembra: ${faltantes.join(", ")}. La RPC de toggle (0289) hace UPDATE, ` +
        `no UPSERT: sin fila el interruptor levanta invalid_state y falla para ` +
        `siempre. Agregalas a feature_flag_catalog() en 0337.`,
    ).toEqual([]);
  });

  it("toda key sembrada existe en el código", () => {
    const sobrantes = [...sql.keys()].filter(
      (k) => !(FEATURE_FLAG_KEYS as string[]).includes(k),
    );
    expect(
      sobrantes,
      `La migración siembra keys que el código no conoce: ${sobrantes.join(", ")}. ` +
        `Quedarían como filas huérfanas, invisibles en el panel de admin.`,
    ).toEqual([]);
  });

  it("los defaults coinciden entre TS y SQL", () => {
    const divergentes = FEATURE_FLAG_KEYS.filter(
      (k) => sql.has(k) && sql.get(k) !== FEATURE_FLAG_DEFAULTS[k],
    ).map((k) => `${k}: TS=${FEATURE_FLAG_DEFAULTS[k]} SQL=${sql.get(k)}`);
    expect(
      divergentes,
      `Un tenant nuevo arrancaría con un valor distinto al que el código asume ` +
        `como fallback: ${divergentes.join(" · ")}`,
    ).toEqual([]);
  });
});

describe("Catálogo de feature flags · metadatos completos", () => {
  it("toda key tiene label y efecto declarado", () => {
    const sinLabel = FEATURE_FLAG_KEYS.filter((k) => !FEATURE_FLAG_LABELS[k]);
    const sinEfecto = FEATURE_FLAG_KEYS.filter((k) => !FEATURE_FLAG_EFFECT[k]);
    expect(sinLabel, "keys sin label").toEqual([]);
    expect(sinEfecto, "keys sin efecto declarado").toEqual([]);
  });
});

describe("Catálogo de feature flags · el efecto declarado es verdad", () => {
  // Sin esto FEATURE_FLAG_EFFECT es un comentario con sintaxis de TypeScript:
  // alguien cablea un flag, no actualiza el mapa, y el panel sigue diciendo
  // "sin efecto" sobre un interruptor que ahora apaga algo de verdad.
  const guardsDeRuta = (() => {
    const out = new Set<string>();
    const raiz = join(RAIZ, "app", "studio", "(app)");
    const caminar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) caminar(p);
        else if (e.name === "page.tsx" || e.name === "layout.tsx") {
          const src = readFileSync(p, "utf8");
          if (!src.includes("listFeatureFlags")) continue;
          for (const k of FEATURE_FLAG_KEYS) {
            // `if (!flags.marketing_news)` / `flags["…"]`
            if (
              new RegExp(`flags\\.${k.replace(/\./g, "\\.")}\\b`).test(src) ||
              src.includes(`flags["${k}"]`)
            ) {
              out.add(k);
            }
          }
        }
      }
    };
    caminar(raiz);
    return out;
  })();

  const enSidebar = new Set<string>(
    Object.values(MODULE_FLAG_MAP).filter(Boolean) as string[],
  );

  it("ningún flag marcado 'ninguno' está cableado en realidad", () => {
    const mentirosos = FEATURE_FLAG_KEYS.filter(
      (k) => FEATURE_FLAG_EFFECT[k] === "ninguno" && (guardsDeRuta.has(k) || enSidebar.has(k)),
    );
    expect(
      mentirosos,
      `Estos flags están marcados "sin efecto" pero SÍ se consumen: ` +
        `${mentirosos.join(", ")}. El panel de admin le está mintiendo al ` +
        `founder. Actualizá FEATURE_FLAG_EFFECT.`,
    ).toEqual([]);
  });

  it("todo flag marcado 'ruta' tiene un guard de ruta de verdad", () => {
    const sinGuard = FEATURE_FLAG_KEYS.filter(
      (k) => FEATURE_FLAG_EFFECT[k] === "ruta" && !guardsDeRuta.has(k),
    );
    expect(
      sinGuard,
      `Estos flags prometen bloquear la ruta pero ninguna page/layout los lee: ` +
        `${sinGuard.join(", ")}. El admin cree que apagó el acceso y la URL ` +
        `sigue abriendo.`,
    ).toEqual([]);
  });

  it("todo flag marcado 'sidebar' está en MODULE_FLAG_MAP", () => {
    const huerfanos = FEATURE_FLAG_KEYS.filter(
      (k) => FEATURE_FLAG_EFFECT[k] === "sidebar" && !enSidebar.has(k),
    );
    expect(huerfanos, "flags 'sidebar' que no esconden ningún módulo").toEqual([]);
  });

  it("el detector de guards de ruta encuentra al menos uno (anti-falso-verde)", () => {
    // Si el walk se rompe (ruta cambiada, refactor de carpetas), los dos tests
    // de arriba pasarían por vacío. Este los ancla.
    expect(
      guardsDeRuta.size,
      "El detector no encontró NINGÚN guard de ruta por flag. Antes existía " +
        "marketing_news en marketing/noticias-web/page.tsx: si se movió, " +
        "arreglá el walk en vez de aceptar el verde.",
    ).toBeGreaterThan(0);
  });
});

describe("Catálogo de feature flags · siembra para tenants nuevos", () => {
  it("existe el trigger que siembra al crear un tenant", () => {
    const archivo = readdirSync(MIGRACIONES).find((f) =>
      f.startsWith("0337_feature_flags_seed_and_trigger"),
    )!;
    const sql = readFileSync(join(MIGRACIONES, archivo), "utf8");
    expect(
      /create trigger trg_seed_feature_flags_for_tenant[\s\S]*?after insert on public\.tenants/i.test(
        sql,
      ),
      "Sin trigger, un tenant nuevo (aliado white-label) nace con cero filas y " +
        "TODOS los toggles del panel levantan invalid_state.",
    ).toBe(true);
  });
});

/** Type guard de compilación: si se agrega una key sin efecto, tsc falla. */
const _cobertura: Record<FeatureFlagKey, unknown> = FEATURE_FLAG_EFFECT;
void _cobertura;
