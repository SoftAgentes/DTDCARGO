/**
 * Anti-drift de RBAC (SDD-0085 · hardening 2026-07-02): todo módulo del
 * registro (`MODULES`) debe tener su gate de VISTA server-side
 * (`requireModuleView`) en el `layout.tsx` o `page.tsx` de su carpeta (o de un
 * ancestro — un layout por carpeta cubre el subtree), salvo excepción
 * justificada en la ALLOWLIST.
 *
 * Es el test espejo de `rbac-actions-guard.test.ts` (que cubre las
 * mutaciones): el sidebar solo ESCONDE links; sin este gate, cualquier rol
 * tipea la URL y ve el módulo. Ese fue el hueco del hardening 2026-06-24 —
 * este test evita la regresión: un módulo nuevo sin gate rompe el gate de
 * `verify.mjs`.
 *
 * Si agregás un módulo: creá `<carpeta>/layout.tsx` con
 * `await requireModuleView("<id>")` (patrón cobranzas/layout.tsx). Si de
 * verdad debe quedar abierto, documentá la excepción acá. Mantené la lista
 * CORTA — cada entrada es una excepción de seguridad defendible en review.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULES } from "@/lib/studio/modules";

const STUDIO_APP = join(process.cwd(), "app", "studio", "(app)");

// module id -> razón de por qué NO lleva requireModuleView.
const ALLOWLIST: Record<string, string> = {
  dashboard:
    "Destino del redirect ?denied= (rbac-guard). Gatearlo crearía loop para roles fuera de su matriz (ej. marketing). Contenido: KPIs generales sin data sensible por rol.",
  mentions:
    "Menciones propias del usuario (@menciones): data scoped al user por diseño, abierto al staff.",
  bugs:
    "Bug Tracker: cualquier miembro del staff reporta/consulta bugs (abierto por diseño, igual que sus actions).",
  "mis-bugs": "Bugs propios del usuario (abierto por diseño).",
};

/** ¿Algún layout.tsx/page.tsx de la carpeta del módulo (o ancestro) llama requireModuleView(? */
function hasViewGate(slug: string): boolean {
  const rel = slug.replace(/^\/studio\//, ""); // "despacho/reglas"
  const segments = rel.split("/");
  // Del más profundo al más superficial: la carpeta propia y sus ancestros.
  for (let depth = segments.length; depth >= 1; depth--) {
    const dir = join(STUDIO_APP, ...segments.slice(0, depth));
    for (const file of ["layout.tsx", "page.tsx"]) {
      const full = join(dir, file);
      if (existsSync(full) && readFileSync(full, "utf8").includes("requireModuleView(")) {
        return true;
      }
    }
  }
  return false;
}

describe("RBAC anti-drift · gate de vista por módulo (SDD-0085)", () => {
  it("el registro de módulos no está vacío (sanity)", () => {
    expect(MODULES.length).toBeGreaterThan(30);
  });

  for (const m of MODULES) {
    it(`${m.id} (${m.slug}) tiene requireModuleView o está en la allowlist`, () => {
      const gated = hasViewGate(m.slug);
      const allowed = m.id in ALLOWLIST;

      if (!gated && !allowed) {
        throw new Error(
          `El módulo "${m.id}" (${m.slug}) no tiene gate de vista. ` +
            `Creá ${m.slug.replace(/^\/studio\//, "app/studio/(app)/")}/layout.tsx ` +
            `con requireModuleView("${m.id}") (SDD-0085), o documentá la excepción en ALLOWLIST.`,
        );
      }
      if (gated && allowed) {
        throw new Error(
          `El módulo "${m.id}" ya tiene gate de vista → quitá su entrada obsoleta de la ALLOWLIST.`,
        );
      }
    });
  }
});
