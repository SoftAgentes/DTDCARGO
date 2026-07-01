/**
 * Tests del clasificador de término y la matriz de facetas del buscador global
 * (SDD-0135). Espejo de `rbac.test.ts`: verifica que el gate por faceta se
 * derive SOLO de la matriz RBAC y que roles sin dinero no puedan correr las
 * facetas de dinero. PURO — sin red, sin DB.
 */

import { describe, it, expect } from "vitest";
import { isKnownModule } from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { classifyTerm, parseAmount, facetForCode } from "./classify";
import {
  FACETS,
  MONEY_FACETS,
  canRunFacet,
  getFacet,
  runnableFacets,
} from "./facets";
import type { GlobalSearchFacetId } from "./types";

const FACET_IDS: GlobalSearchFacetId[] = [
  "clients",
  "shipments",
  "quotes",
  "invoices",
  "payments",
];

describe("classifyTerm", () => {
  it("código con prefijo del dominio → code", () => {
    for (const t of ["DTD-0001", "S-2024-001", "Q-2026-9", "F-2026-0001", "R-2026-0001"]) {
      expect(classifyTerm(t), t).toBe("code");
    }
  });

  it("fecha dd/mm(/aaaa) → date", () => {
    expect(classifyTerm("15/03")).toBe("date");
    expect(classifyTerm("5/3/2026")).toBe("date");
    expect(classifyTerm("15/03/26")).toBe("date");
  });

  it("cédula/RIF con prefijo o dígitos largos → cedula", () => {
    expect(classifyTerm("V-12345678")).toBe("cedula");
    expect(classifyTerm("J-50648869-8")).toBe("cedula");
    expect(classifyTerm("12345678")).toBe("cedula"); // 8 dígitos, sin separador
  });

  it("monto ($ o separadores o número corto) → amount", () => {
    expect(classifyTerm("$1.500")).toBe("amount");
    expect(classifyTerm("1500")).toBe("amount"); // corto → no es cédula
    expect(classifyTerm("1500,50")).toBe("amount");
    expect(classifyTerm("$250")).toBe("amount");
  });

  it("texto libre → text", () => {
    expect(classifyTerm("Juan Pérez")).toBe("text");
    expect(classifyTerm("")).toBe("text");
    expect(classifyTerm("   ")).toBe("text");
  });
});

describe("parseAmount", () => {
  it("parsea formato venezolano (punto=miles, coma=decimal)", () => {
    expect(parseAmount("$1.500,50")).toBeCloseTo(1500.5);
    expect(parseAmount("250")).toBe(250);
    expect(parseAmount("1.000")).toBe(1000);
  });
  it("null si no parsea", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("facetForCode", () => {
  it("rutea por prefijo a la faceta correcta", () => {
    expect(facetForCode("DTD-0001")).toBe("clients");
    expect(facetForCode("S-2024-1")).toBe("shipments");
    expect(facetForCode("Q-1")).toBe("quotes");
    expect(facetForCode("F-1")).toBe("invoices");
    expect(facetForCode("R-1")).toBe("payments");
  });
  it("prefijo desconocido → null", () => {
    expect(facetForCode("X-1")).toBeNull();
    expect(facetForCode("sinprefijo")).toBeNull();
  });
});

describe("matriz de facetas: anti-drift con modules/roles", () => {
  it("cada faceta declarada existe en el registro de ids", () => {
    expect(FACETS.map((f) => f.id).sort()).toEqual([...FACET_IDS].sort());
  });

  it("cada faceta apunta a un módulo real de modules.ts", () => {
    for (const f of FACETS) {
      expect(isKnownModule(f.module), `${f.id} → ${f.module}`).toBe(true);
    }
  });

  it("viewerRoles usa roles válidos y NUNCA admin (implícito)", () => {
    for (const f of FACETS) {
      for (const r of f.viewerRoles ?? []) {
        expect(STUDIO_USER_ROLES).toContain(r);
        expect(r).not.toBe("admin");
      }
    }
  });

  it("las facetas de dinero son exactamente facturas y pagos", () => {
    expect([...MONEY_FACETS].sort()).toEqual(["invoices", "payments"]);
  });
});

describe("canRunFacet: gate derivado SOLO de la matriz RBAC", () => {
  it("accounting y admin corren las facetas de dinero", () => {
    for (const id of MONEY_FACETS) {
      expect(canRunFacet("accounting", getFacet(id)), id).toBe(true);
      expect(canRunFacet("admin", getFacet(id)), id).toBe(true);
    }
  });

  it("commercial, operations, warehouse NO corren facetas de dinero", () => {
    const noMoney: StudioUserRole[] = ["commercial", "operations", "warehouse"];
    for (const role of noMoney) {
      for (const id of MONEY_FACETS) {
        expect(canRunFacet(role, getFacet(id)), `${role} × ${id}`).toBe(false);
      }
    }
  });

  it("marketing corre Cliente (read-only) pero NINGUNA faceta de dinero", () => {
    expect(canRunFacet("marketing", getFacet("clients"))).toBe(true);
    for (const id of MONEY_FACETS) {
      expect(canRunFacet("marketing", getFacet(id)), id).toBe(false);
    }
  });

  it("marketing NO obtiene el módulo clients completo (solo la faceta)", () => {
    // El acceso viene de viewerRoles de la faceta, no de ROLE_MODULE_ACCESS.clients.
    const clientsFacet = getFacet("clients");
    expect(clientsFacet.viewerRoles).toContain("marketing");
  });

  it("rol nulo/undefined no corre nada (fail-closed)", () => {
    for (const f of FACETS) {
      expect(canRunFacet(null, f)).toBe(false);
      expect(canRunFacet(undefined, f)).toBe(false);
    }
  });
});

describe("runnableFacets por rol", () => {
  it("accounting ve las 5 facetas", () => {
    expect(runnableFacets("accounting").map((f) => f.id).sort()).toEqual(
      [...FACET_IDS].sort(),
    );
  });

  it("commercial ve operativas, ninguna de dinero", () => {
    const ids = runnableFacets("commercial").map((f) => f.id);
    expect(ids).toContain("clients");
    expect(ids).toContain("shipments");
    expect(ids).toContain("quotes");
    expect(ids).not.toContain("invoices");
    expect(ids).not.toContain("payments");
  });

  it("marketing solo ve la faceta Cliente", () => {
    expect(runnableFacets("marketing").map((f) => f.id)).toEqual(["clients"]);
  });

  it("warehouse ve Cliente y Embarques, no Estimados ni dinero", () => {
    const ids = runnableFacets("warehouse").map((f) => f.id);
    expect(ids).toEqual(["clients", "shipments"]);
  });
});
