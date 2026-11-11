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
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** ⏱️ I/O-BOUND: recorre app/studio y app/m. Undécimo contrato de esa clase. */
vi.setConfig({ testTimeout: 120_000 });

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

const DEFINE_CATALOGO = "create or replace function public.feature_flag_catalog";

/**
 * Lee el cuerpo de la ÚLTIMA definición de `feature_flag_catalog()` y devuelve
 * key → default. Nació en 0337; un flag nuevo la redefine en su propia
 * migración (0503, SDD-0585), porque una migración aplicada no se edita. Lo que
 * vale en la base es la última que corrió, así que es la que se compara.
 */
function catalogoSql(): Map<string, boolean> {
  const archivo = readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => readFileSync(join(MIGRACIONES, f), "utf8").includes(DEFINE_CATALOGO))
    .at(-1);
  if (!archivo) {
    throw new Error("Ninguna migración define feature_flag_catalog(); debería ser al menos 0337.");
  }
  const sql = readFileSync(join(MIGRACIONES, archivo), "utf8");

  const desde = sql.indexOf(DEFINE_CATALOGO);
  expect(desde, `${archivo} debe definir feature_flag_catalog()`).toBeGreaterThan(-1);
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
        `siempre. Agrégalas a feature_flag_catalog() en una migración nueva que la redefina desde su última definición.`,
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
  /**
   * Quita comentarios antes de buscar. Sin esto el detector matchea el
   * DOCBLOCK: el layout de `seniat` documenta el guard citando la llamada
   * literal, así que el contrato se daba por satisfecho con la explicación en
   * vez del código. Lo cazó una mutación —borré la llamada real y siguió
   * verde— igual que en `studio-api-auth-guard.test.ts`. Un contrato que lee
   * comentarios no verifica comportamiento: verifica prosa.
   */
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // Dos formas legítimas de gatear una ruta por flag:
  //   a) la page lee `flags.<key>` directo (patrón de noticias-web);
  //   b) el layout llama `requireFeatureEnabled("<moduleId>")`, que resuelve la
  //      key vía MODULE_FLAG_MAP (patrón de seniat / cola-qr / operarios).
  // El detector tiene que ver las DOS: si sólo mirara (a), promover un flag a
  // `ruta` con el guard nuevo daría rojo por un falso hueco.
  const guardsDeRuta = (() => {
    const out = new Set<string>();
    const raiz = join(RAIZ, "app", "studio", "(app)");
    const caminar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) caminar(p);
        else if (e.name === "page.tsx" || e.name === "layout.tsx") {
          const src = sinComentarios(readFileSync(p, "utf8"));

          // (b) guard por módulo. Se busca la LLAMADA con su argumento, no el
          // nombre suelto: un archivo que sólo importe el guard no gatea nada.
          for (const m of src.matchAll(/requireFeatureEnabled\(\s*"([a-z0-9-]+)"/g)) {
            const key = MODULE_FLAG_MAP[m[1]];
            if (key) out.add(key);
          }

          // (a) lectura directa del flag en la propia página.
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

  /**
   * Consumo desde la PWA (`app/m/**`), que NO usa el guard del Studio: lee la
   * fila directo con `.eq("key", "<flag>")`. Sin mirar acá,
   * `dispatch.show_warehouse_location` —que el bodeguero sí respeta— habría que
   * marcarlo "ninguno", y el panel volvería a mentir en la otra dirección.
   */
  const enMovil = (() => {
    const out = new Set<string>();
    const raiz = join(RAIZ, "app", "m");
    const caminar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) caminar(p);
        else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
          const src = sinComentarios(readFileSync(p, "utf8"));
          for (const m of src.matchAll(/\.eq\(\s*"key"\s*,\s*"([a-z0-9_.]+)"/g)) {
            out.add(m[1]);
          }
        }
      }
    };
    caminar(raiz);
    return out;
  })();

  /**
   * Consumo desde el servidor sin pantalla propia (SDD-0586, 10.5): una cola, un cron o
   * un manejador en `lib/**` o `app/api/**` que lee `flags.<key>` después de
   * `listFeatureFlags`. Sin esto, `chatwoot_portal` —que detiene la ida del chat del portal
   * a Chatwoot— habría que marcarlo "ninguno", y el panel diría que nada lo consulta.
   */
  const enServidor = (() => {
    const out = new Set<string>();
    const caminar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") caminar(p);
        } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          const src = sinComentarios(readFileSync(p, "utf8"));
          if (!src.includes("listFeatureFlags")) continue;
          for (const k of FEATURE_FLAG_KEYS) {
            if (new RegExp(`flags\\.${k.replace(/\./g, "\\.")}\\b`).test(src)) out.add(k);
          }
        }
      }
    };
    caminar(join(RAIZ, "lib"));
    caminar(join(RAIZ, "app", "api"));
    return out;
  })();

  it("todo flag marcado 'servidor' lo lee de verdad el servidor", () => {
    const sinConsumo = FEATURE_FLAG_KEYS.filter(
      (k) => FEATURE_FLAG_EFFECT[k] === "servidor" && !enServidor.has(k),
    );
    expect(
      sinConsumo,
      `Estos flags dicen que detienen algo del servidor y nada de lib/ ni app/api los ` +
        `lee: ${sinConsumo.join(", ")}.`,
    ).toEqual([]);
  });

  it("el detector del servidor encuentra chatwoot_portal (anti-falso-verde)", () => {
    expect(enServidor.has("chatwoot_portal")).toBe(true);
  });

  it("todo flag marcado 'movil' lo consume de verdad la PWA", () => {
    const sinConsumo = FEATURE_FLAG_KEYS.filter(
      (k) => FEATURE_FLAG_EFFECT[k] === "movil" && !enMovil.has(k),
    );
    expect(
      sinConsumo,
      `Estos flags dicen que los respeta la PWA y ningún archivo de app/m los ` +
        `lee: ${sinConsumo.join(", ")}.`,
    ).toEqual([]);
  });

  it("ningún flag marcado 'ninguno' está cableado en realidad", () => {
    const mentirosos = FEATURE_FLAG_KEYS.filter(
      (k) =>
        FEATURE_FLAG_EFFECT[k] === "ninguno" &&
        (guardsDeRuta.has(k) || enSidebar.has(k) || enMovil.has(k) || enServidor.has(k)),
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
