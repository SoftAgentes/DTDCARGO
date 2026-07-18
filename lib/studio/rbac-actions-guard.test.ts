/**
 * Anti-drift de RBAC (SDD-0085): toda server action de mutación del Studio debe
 * llamar `moduleEditDenial(...)` como backstop server-side, porque las actions
 * son invocables directo como endpoint (el sidebar + requireModuleView solo
 * cubren la UI). Este test escanea `app/studio/(app)/**​/actions.ts` y falla si
 * un archivo no llama `moduleEditDenial` y no está en la ALLOWLIST justificada.
 *
 * Si agregás un módulo nuevo con mutaciones: agregá el guard. Si de verdad NO
 * lo necesita (auth propia / abierto por diseño / barrel a lib), documentá la
 * excepción acá con su razón. Mantené la lista CORTA — cada entrada es una
 * excepción de seguridad que alguien debería poder defender en un review.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const STUDIO_APP = join(process.cwd(), "app", "studio", "(app)");

// path relativo (con "/") -> razón de por qué NO lleva moduleEditDenial.
const ALLOWLIST: Record<string, string> = {
  "actions.ts": "signOut: cierra la sesión del propio usuario, sin privilegio de módulo.",
  "bugs/actions.ts": "Bug Reporter: cualquier miembro del staff reporta bugs (abierto por diseño).",
  "mis-bugs/actions.ts": "Bugs propios del usuario (abierto por diseño).",
  "ve/actions.ts": "App de operario VE: auth por PIN (operario-session), no por rol de Studio.",
  "debug/actions.ts": "recheckAll: re-corre health checks, no muta datos de negocio.",
  "admin/feature-flags/actions.ts": "toggleFeatureFlag valida role==='admin' inline.",
  "admin/notificaciones/actions.ts":
    "SDD-0156: requireAdmin() valida role==='admin' inline antes de cada mutación; config admin-only, RLS por tenant en client_notification_rules.",
  "dashboard/actions.ts":
    "SDD-0114: cada usuario edita SU PROPIA config de dashboard (fila user_dashboard_prefs, RLS por dueño). No muta datos de negocio ni de otros usuarios; además la action filtra los ids con canAccessModule antes de persistir.",
  "ordenes-compra/actions.ts": "Barrel: las actions con guard viven en lib/studio/purchase-orders/actions.ts.",
  "ordenes-venta/actions.ts": "Barrel: las actions con guard viven en lib/studio/sales-orders/actions.ts.",
  "marketing/noticias-web/actions.ts": "Gateado con requireAdminWithTenant (gate admin propio).",
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
    it(`${rel} llama moduleEditDenial o está en la allowlist`, () => {
      const src = readFileSync(file, "utf8");
      const hasGuard = src.includes("moduleEditDenial");
      const allowed = rel in ALLOWLIST;

      if (!hasGuard && !allowed) {
        throw new Error(
          `${rel} muta sin moduleEditDenial y no está en la ALLOWLIST. ` +
            `Agregá el guard (SDD-0085) al tope de cada mutación, o documentá la excepción en ALLOWLIST.`,
        );
      }
      if (hasGuard && allowed) {
        throw new Error(
          `${rel} ya tiene moduleEditDenial → quitá su entrada obsoleta de la ALLOWLIST.`,
        );
      }
    });
  }
});
