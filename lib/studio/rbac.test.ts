import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODULES } from "@/lib/studio/modules";
import {
  ADMIN_ONLY_MODULES,
  CAPABILITIES,
  LOCKED_MODULES,
  MONEY_MODULES,
  ROLE_MODULE_ACCESS,
  SUPERADMIN_ONLY_MODULES,
  WAREHOUSE_SCOPED_MODULES,
  canAccessModule,
  canEditModule,
  canSpecial,
  isKnownModule,
  moduleIdForPath,
  scopeAllowsModule,
  type RoleModuleOverrides,
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
  // Snapshot INDEPENDIENTE de los sets exportados: si alguien edita
  // MONEY_MODULES/ADMIN_ONLY_MODULES en rbac.ts, este test lo caza (doble
  // registro a propósito — SDD-0139).
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

  it("los sets exportados (SDD-0139) coinciden con el snapshot del test", () => {
    expect([...MONEY_MODULES].sort()).toEqual([...MONEY].sort());
    expect([...ADMIN_ONLY_MODULES].sort()).toEqual([...ADMIN_ONLY].sort());
    expect([...LOCKED_MODULES].sort()).toEqual([...MONEY, ...ADMIN_ONLY].sort());
    for (const id of LOCKED_MODULES) {
      expect(isKnownModule(id), `LOCKED contiene módulo fantasma "${id}"`).toBe(true);
    }
  });

  it("matriz de módulos LOCKED: dinero = exactamente ['accounting']; admin-only = []", () => {
    for (const id of MONEY_MODULES) {
      expect(ROLE_MODULE_ACCESS[id], `dinero ${id}`).toEqual(["accounting"]);
    }
    for (const id of ADMIN_ONLY_MODULES) {
      expect(ROLE_MODULE_ACCESS[id], `admin-only ${id}`).toEqual([]);
    }
  });

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

describe("RBAC: capabilities (SDD-0139)", () => {
  it("roles de cada capability son válidos y no listan admin (implícito)", () => {
    for (const [cap, roles] of Object.entries(CAPABILITIES)) {
      for (const r of roles) {
        expect(STUDIO_USER_ROLES, `${cap} usa rol desconocido "${r}"`).toContain(r);
        expect(r, `${cap} no debe listar admin`).not.toBe("admin");
      }
    }
  });

  it("approve_money (causar CxP): SOLO accounting entre los no-admin", () => {
    expect(canSpecial("accounting", "approve_money")).toBe(true);
    expect(canSpecial("admin", "approve_money")).toBe(true);
    for (const r of NON_ADMIN.filter((x) => x !== "accounting")) {
      expect(canSpecial(r, "approve_money"), `${r} no debe aprobar plata`).toBe(false);
    }
    expect(canSpecial(null, "approve_money")).toBe(false);
    expect(canSpecial(undefined, "approve_money")).toBe(false);
  });

  it("delete_shipments y delete_warehouse_receipts (SDD-0522): SOLO admin, como exige la 0476", () => {
    for (const cap of ["delete_shipments", "delete_warehouse_receipts"] as const) {
      expect(CAPABILITIES[cap]).toEqual([]);
      expect(canSpecial("admin", cap)).toBe(true);
      for (const r of NON_ADMIN) {
        expect(canSpecial(r, cap), `${r} no debe ${cap}`).toBe(false);
      }
      expect(canSpecial(null, cap)).toBe(false);
      expect(canSpecial(undefined, cap)).toBe(false);
    }
  });

  it("escucha_activa (SDD-0150): SOLO admin hoy (extensible por rol)", () => {
    expect(canSpecial("admin", "escucha_activa")).toBe(true);
    for (const r of NON_ADMIN) {
      expect(canSpecial(r, "escucha_activa"), `${r} no debe correr Escucha Activa`).toBe(
        false,
      );
    }
    expect(canSpecial(null, "escucha_activa")).toBe(false);
  });

  it("view_defense_file (SDD-0070): commercial + support (asesor de reclamos) + admin", () => {
    expect(canSpecial("admin", "view_defense_file")).toBe(true);
    expect(canSpecial("commercial", "view_defense_file")).toBe(true);
    expect(canSpecial("support", "view_defense_file")).toBe(true);
    for (const r of NON_ADMIN.filter((x) => x !== "commercial" && x !== "support")) {
      expect(canSpecial(r, "view_defense_file"), `${r} no debe ver el expediente`).toBe(
        false,
      );
    }
    expect(canSpecial(null, "view_defense_file")).toBe(false);
  });

  it("ciclo de comentarios (SDD-0168): moderar y restaurar son admin-only", () => {
    for (const capability of ["moderate_comments", "restore_comments"] as const) {
      expect(canSpecial("admin", capability)).toBe(true);
      for (const role of NON_ADMIN) {
        expect(canSpecial(role, capability), `${role} no debe usar ${capability}`).toBe(
          false,
        );
      }
      expect(canSpecial(null, capability)).toBe(false);
    }
  });

  it("auditoría gobernada (SDD-0166 Corte C): lista y reveal son admin-only", () => {
    for (const capability of ["audit_view", "audit_view_sensitive"] as const) {
      expect(canSpecial("admin", capability)).toBe(true);
      for (const role of NON_ADMIN) {
        expect(canSpecial(role, capability), `${role} no debe usar ${capability}`).toBe(
          false,
        );
      }
      expect(canSpecial(null, capability)).toBe(false);
    }
  });

  it("anulación de finiquito (SDD-0226): solo admin", () => {
    expect(canSpecial("admin", "void_payroll_settlement")).toBe(true);
    for (const role of NON_ADMIN) {
      expect(
        canSpecial(role, "void_payroll_settlement"),
        `${role} no debe anular finiquitos`,
      ).toBe(false);
    }
    expect(canSpecial(null, "void_payroll_settlement")).toBe(false);
  });

  it("anulación de gasto (SDD-0243): accounting + admin", () => {
    expect(canSpecial("accounting", "void_expense")).toBe(true);
    expect(canSpecial("admin", "void_expense")).toBe(true);
    for (const role of NON_ADMIN.filter((value) => value !== "accounting")) {
      expect(canSpecial(role, "void_expense"), `${role} no debe anular gastos`).toBe(
        false,
      );
    }
    expect(canSpecial(null, "void_expense")).toBe(false);
  });
});

describe("RBAC: scope de almacén (SDD-0139)", () => {
  it("los módulos con scope existen en el registro y tienen lado cn|ve", () => {
    for (const [id, side] of Object.entries(WAREHOUSE_SCOPED_MODULES)) {
      expect(isKnownModule(id), `scoped módulo fantasma "${id}"`).toBe(true);
      expect(["cn", "ve"]).toContain(side);
    }
  });

  it("scope restringe solo el lado contrario; 'all'/null no restringen", () => {
    expect(scopeAllowsModule("cn", "cn")).toBe(true);
    expect(scopeAllowsModule("cn", "qrqueue")).toBe(true);
    expect(scopeAllowsModule("cn", "ve")).toBe(false);
    expect(scopeAllowsModule("ve", "ve")).toBe(true);
    expect(scopeAllowsModule("ve", "cn")).toBe(false);
    expect(scopeAllowsModule("ve", "labels")).toBe(false);
    expect(scopeAllowsModule("all", "cn")).toBe(true);
    expect(scopeAllowsModule("all", "ve")).toBe(true);
    expect(scopeAllowsModule(null, "cn")).toBe(true);
    expect(scopeAllowsModule(undefined, "ve")).toBe(true);
  });

  it("módulos sin lado geográfico no se ven afectados por ningún scope", () => {
    for (const scope of ["cn", "ve", "all"] as const) {
      expect(scopeAllowsModule(scope, "treasury")).toBe(true);
      expect(scopeAllowsModule(scope, "clients")).toBe(true);
      expect(scopeAllowsModule(scope, "dashboard")).toBe(true);
    }
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

describe("RBAC: SUPERADMIN_ONLY_MODULES (SDD-0252, corte 2 tras 0355)", () => {
  it("es subconjunto de ADMIN_ONLY_MODULES — no tiene sentido subir un módulo que no es admin-only", () => {
    for (const id of SUPERADMIN_ONLY_MODULES) {
      expect(ADMIN_ONLY_MODULES.has(id), `${id} debe estar en ADMIN_ONLY_MODULES`).toBe(true);
    }
  });

  it("es EXACTAMENTE lo que aprobó el founder — Dirección y Mailing se quedan afuera", () => {
    expect([...SUPERADMIN_ONLY_MODULES].sort()).toEqual(
      ["financiero-china", "legal", "no-olvidar", "renditions"].sort(),
    );
  });

  it("todos son módulos reales", () => {
    for (const id of SUPERADMIN_ONLY_MODULES) {
      expect(isKnownModule(id), `SUPERADMIN_ONLY_MODULES contiene módulo fantasma "${id}"`).toBe(true);
    }
  });
});

describe("RBAC: documents + marketing (SDD-0252)", () => {
  it("Fiorella (marketing) ahora ve Documentos, igual que el resto de roles transversales", () => {
    expect(canAccessModule("marketing", "documents")).toBe(true);
  });
});

describe("RBAC: overrides de la matriz editable (SDD-0252, migr 0357)", () => {
  it("sin overrides, el comportamiento es IDÉNTICO al de siempre", () => {
    expect(canAccessModule("marketing", "documents", undefined)).toBe(
      canAccessModule("marketing", "documents"),
    );
    expect(canEditModule("commercial", "quotes", undefined)).toBe(
      canEditModule("commercial", "quotes"),
    );
  });

  it("un override sobre un módulo LOCKED se IGNORA — el candado no se abre desde la matriz", () => {
    const overrides: RoleModuleOverrides = {
      "marketing:nomina": { view: true, edit: true }, // dinero
      "marketing:legal": { view: true, edit: true }, // admin-only
    };
    expect(canAccessModule("marketing", "nomina", overrides)).toBe(false);
    expect(canAccessModule("marketing", "legal", overrides)).toBe(false);
    expect(canEditModule("marketing", "nomina", overrides)).toBe(false);
  });

  it("un override REVOKE explícito (false,false) cierra un módulo que el default sí daba", () => {
    const overrides: RoleModuleOverrides = { "marketing:dashboard": { view: false, edit: false } };
    expect(canAccessModule("marketing", "dashboard")).toBe(true); // default: sí lo ve
    expect(canAccessModule("marketing", "dashboard", overrides)).toBe(false); // override lo cierra
  });

  it("un override VIEW+EDIT en un módulo NO locked funciona en ambas direcciones", () => {
    const grant: RoleModuleOverrides = { "warehouse:reclamos": { view: true, edit: true } };
    expect(canAccessModule("warehouse", "reclamos")).toBe(false); // default: warehouse no está en reclamos
    expect(canAccessModule("warehouse", "reclamos", grant)).toBe(true);
    expect(canEditModule("warehouse", "reclamos", grant)).toBe(true);
  });

  it("support NUNCA edita, ni con un override que le dé edit=true (read-only V1 inmutable)", () => {
    const overrides: RoleModuleOverrides = { "support:tracking": { view: true, edit: true } };
    expect(canAccessModule("support", "tracking", overrides)).toBe(true);
    expect(canEditModule("support", "tracking", overrides)).toBe(false);
  });

  it("admin ignora overrides por completo (siempre TOTAL)", () => {
    const overrides: RoleModuleOverrides = { "admin:users": { view: false, edit: false } };
    expect(canAccessModule("admin", "users", overrides)).toBe(true);
    expect(canEditModule("admin", "users", overrides)).toBe(true);
  });
});
