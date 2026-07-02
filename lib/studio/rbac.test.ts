import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODULES } from "@/lib/studio/modules";
import {
  ROLE_MODULE_ACCESS,
  canAccessModule,
  canEditModule,
  moduleIdForPath,
  isKnownModule,
} from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

// DERIVADO del registro de roles (no hardcodear): cuando se agregue un rol
// nuevo (como pasó con `marketing`, SDD-0119) los candados de gobernanza lo
// cubren automáticamente. La 1ª versión hardcodeaba 5 roles y `marketing`
// quedó fuera de los checks (hallazgo auditoría 2026-07-02).
const NON_ADMIN: StudioUserRole[] = STUDIO_USER_ROLES.filter(
  (r) => r !== "admin",
);

describe("RBAC anti-drift: matriz ↔ registro de módulos", () => {
  it("todo módulo del registro tiene entrada en la matriz", () => {
    const missing = MODULES.filter((m) => !(m.id in ROLE_MODULE_ACCESS));
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it("toda entrada de la matriz corresponde a un módulo real", () => {
    const ghost = Object.keys(ROLE_MODULE_ACCESS).filter((id) => !isKnownModule(id));
    expect(ghost).toEqual([]);
  });

  it("los roles de la matriz son válidos y no listan admin (es implícito)", () => {
    for (const [id, roles] of Object.entries(ROLE_MODULE_ACCESS)) {
      for (const r of roles) {
        expect(STUDIO_USER_ROLES, `${id} usa rol desconocido "${r}"`).toContain(r);
        expect(r, `${id} no debe listar admin (es implícito)`).not.toBe("admin");
      }
    }
  });

  it("módulo marcado adminOnly ⇒ matriz vacía (solo admin)", () => {
    for (const m of MODULES) {
      if (m.adminOnly) {
        expect(ROLE_MODULE_ACCESS[m.id], `adminOnly ${m.id}`).toEqual([]);
      }
    }
  });
});

describe("RBAC: candados de gobernanza (separación de poderes)", () => {
  // Dinero: solo accounting (+admin). El doc estructura-perfiles lo exige.
  const MONEY = [
    "treasury",
    "accounting",
    "invoices",
    "collections",
    "costing",
    "reports",
    "fiscal",
    "nomina", // SDD-0103: dinero + PII de empleados → solo accounting (+admin)
  ];
  // Admin-only duro (gestión de roles, plata internacional, recovery, legal).
  const ADMIN_ONLY = [
    "users",
    "admin",
    "direccion",
    "renditions",
    "financiero-china",
    "legal",
    "no-olvidar",
    "mailing",
  ];

  it("módulos de dinero: SOLO accounting entre los no-admin", () => {
    for (const id of MONEY) {
      for (const r of NON_ADMIN.filter((x) => x !== "accounting")) {
        expect(canAccessModule(r, id), `${r} no debe ver ${id}`).toBe(false);
      }
    }
  });

  it("módulos de dinero: accounting SÍ y admin SÍ", () => {
    for (const id of MONEY) {
      expect(canAccessModule("accounting", id), `accounting debe ver ${id}`).toBe(true);
      expect(canAccessModule("admin", id)).toBe(true);
    }
  });

  it("módulos admin-only: ningún rol no-admin los ve", () => {
    for (const id of ADMIN_ONLY) {
      for (const r of NON_ADMIN) {
        expect(canAccessModule(r, id), `${r} no debe ver ${id}`).toBe(false);
      }
      expect(canAccessModule("admin", id)).toBe(true);
    }
  });

  it("usuarios (gestión de roles) es admin-only — Yolimar=accounting NO admin", () => {
    expect(canAccessModule("accounting", "users")).toBe(false);
    expect(canEditModule("accounting", "users")).toBe(false);
    expect(canAccessModule("admin", "users")).toBe(true);
  });
});

describe("RBAC: helpers", () => {
  it("admin ve y edita todo; rol nulo/undefined no ve nada", () => {
    expect(canAccessModule("admin", "treasury")).toBe(true);
    expect(canEditModule("admin", "users")).toBe(true);
    expect(canAccessModule(null, "dashboard")).toBe(false);
    expect(canAccessModule(undefined, "dashboard")).toBe(false);
  });

  it("support ve lo permitido pero NUNCA edita (read-only V1)", () => {
    expect(canAccessModule("support", "dashboard")).toBe(true);
    expect(canEditModule("support", "dashboard")).toBe(false);
    expect(canEditModule("support", "clients")).toBe(false);
  });

  it("fail-closed: módulo desconocido = solo admin", () => {
    expect(canAccessModule("operations", "modulo-fantasma")).toBe(false);
    expect(canAccessModule("admin", "modulo-fantasma")).toBe(true);
  });

  it("moduleIdForPath: exacto, por prefijo, y más específico gana", () => {
    expect(moduleIdForPath("/studio/tesoreria")).toBe("treasury");
    expect(moduleIdForPath("/studio/clientes/DTD-0001")).toBe("clients");
    expect(moduleIdForPath("/studio/despacho/reglas")).toBe("despacho-rules");
    expect(moduleIdForPath("/studio/despacho")).toBe("despacho");
    expect(moduleIdForPath("/studio/admin/rutas")).toBe("admin-rutas");
    expect(moduleIdForPath("/studio/admin")).toBe("admin");
    expect(moduleIdForPath("/studio/resumen")).toBe(null);
  });
});

describe("RBAC anti-drift: gate de acción en módulos sensibles", () => {
  // El view gate NO frena el bypass de server actions (RLS scope-a por tenant,
  // NO por rol). Cada actions.ts de un módulo de dinero/sensible DEBE referenciar
  // `moduleEditDenial`. Si una mutación nueva olvida el guard, este test cae —
  // es justo el hueco que la primera pasada dejó (lo cazó el auditor adversarial).
  const root = resolve(__dirname, "..", "..");
  const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
  const GUARDED_ACTIONS = [
    "app/studio/(app)/usuarios/actions.ts",
    "app/studio/(app)/tesoreria/actions.ts",
    "app/studio/(app)/contabilidad/actions.ts",
    "app/studio/(app)/facturacion/actions.ts",
    "app/studio/(app)/cobranzas/actions.ts",
    "app/studio/(app)/costing/actions.ts",
    "app/studio/(app)/financiero-china/actions.ts",
    "app/studio/(app)/operarios/actions.ts",
    "app/studio/(app)/nomina/actions.ts",
    "lib/studio/sales-orders/actions.ts",
    "lib/studio/purchase-orders/actions.ts",
  ];

  it("cada actions.ts sensible referencia moduleEditDenial", () => {
    for (const rel of GUARDED_ACTIONS) {
      expect(
        read(rel),
        `${rel} debe gatear sus mutaciones con moduleEditDenial`,
      ).toContain("moduleEditDenial");
    }
  });
});
