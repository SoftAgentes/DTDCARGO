/**
 * Anti-drift de RBAC (SDD-0085): toda server action de mutación del Studio debe
 * apoyarse en un guard de `rbac-guard.ts` como backstop server-side, porque las
 * actions son invocables directo como endpoint (el sidebar + requireModuleView
 * solo cubren la UI). Este test escanea `app/studio/(app)/**​/actions.ts` y falla
 * si un archivo no llama a ninguno y no está en la ALLOWLIST justificada.
 *
 * Si agregás un módulo nuevo con mutaciones: agregá el guard. Si de verdad NO
 * lo necesita (auth propia / abierto por diseño / barrel a lib), documentá la
 * excepción acá con su razón. Mantené la lista CORTA — cada entrada es una
 * excepción de seguridad que alguien debería poder defender en un review.
 *
 * ⚠️ El escáner abre sólo archivos llamados EXACTAMENTE `actions.ts`. Las
 * actions que viven en `<algo>-actions.ts` (carrier, calculator, calendar,
 * company, exchange-rates…) no las mira nadie: ahí se coló la variante sin
 * `disabled_at` que arregló SDD-0498. Ampliar el barrido es tarea aparte —
 * hoy pondría en rojo a una docena de archivos de una vez.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


const STUDIO_APP = join(process.cwd(), "app", "studio", "(app)");

/**
 * Guards de `rbac-guard.ts` que valen como backstop. Todos resuelven el rol por
 * `getStudioAccess`, o sea con el filtro `disabled_at` de la 0200; lo que este
 * contrato exige es que la action use UNO de ellos y no su propia lectura de
 * `user_tenants`, que es la que se olvida de actualizar (SDD-0498).
 */
const GUARDS = ["moduleEditDenial", "moduleEditGate", "tenantAdminGate", "capabilityDenial"];

// path relativo (con "/") -> razón de por qué NO lleva ningún guard de rbac-guard.
const ALLOWLIST: Record<string, string> = {
  "actions.ts": "signOut: cierra la sesión del propio usuario, sin privilegio de módulo.",
  "bugs/actions.ts": "Bug Reporter: cualquier miembro del staff reporta bugs (abierto por diseño).",
  "mis-bugs/actions.ts": "Bugs propios del usuario (abierto por diseño).",
  "debug/actions.ts": "recheckAll: re-corre health checks, no muta datos de negocio.",
  "admin/feature-flags/actions.ts": "toggleFeatureFlag valida role==='admin' inline.",
  "admin/alertas-telegram/actions.ts":
    "SDD-0271: requireAdmin() valida role==='admin' inline en las 4 mutaciones, y es MÁS estricto que moduleEditDenial('admin'), que resuelve por la matriz y admite overrides por rol (SDD-0252). Acá se decide a qué chat de Telegram llegan los avisos internos: un override no debería poder abrirlo. RLS admin-only por tenant en telegram_destinations / telegram_alert_routes (migr 0386).",
  "dashboard/actions.ts":
    "SDD-0114: cada usuario edita SU PROPIA config de dashboard (fila user_dashboard_prefs, RLS por dueño). No muta datos de negocio ni de otros usuarios; además la action filtra los ids con canAccessModule antes de persistir.",
  "ordenes-compra/actions.ts": "Barrel: las actions con guard viven en lib/studio/purchase-orders/actions.ts.",
  "ordenes-venta/actions.ts": "Barrel: las actions con guard viven en lib/studio/sales-orders/actions.ts.",
};

function findActions(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "_components") continue;
      findActions(full, acc);
    } else if (entry === "actions.ts") {
      acc.push(full);
    }
  }
  return acc;
}

describe("RBAC anti-drift · server actions del Studio (SDD-0085)", () => {
  const files = findActions(STUDIO_APP);

  it("encuentra los archivos de actions (sanity)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const rel = relative(STUDIO_APP, file).split(sep).join("/");
    it(`${rel} llama a un guard de rbac-guard o está en la allowlist`, () => {
      const src = readFileSync(file, "utf8");
      const hasGuard = GUARDS.some((guard) => src.includes(guard));
      const allowed = rel in ALLOWLIST;

      if (!hasGuard && !allowed) {
        throw new Error(
          `${rel} muta sin ningún guard de rbac-guard (${GUARDS.join(" / ")}) y no está en ` +
            `la ALLOWLIST. Agregá el guard (SDD-0085) al tope de cada mutación, o documentá ` +
            `la excepción en ALLOWLIST.`,
        );
      }
      if (hasGuard && allowed) {
        throw new Error(
          `${rel} ya tiene un guard de rbac-guard → quitá su entrada obsoleta de la ALLOWLIST.`,
        );
      }
    });
  }
});
