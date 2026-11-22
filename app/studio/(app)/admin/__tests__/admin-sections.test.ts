// @vitest-environment node
/**
 * SDD-0708 · Administración sin tarjeta puente, menú por tema (decisión de Sam del 2026-11-22: B + R1).
 *
 * Contrato del catálogo de secciones y de la página: un clic en el menú lleva a la pantalla real, los enlaces
 * viejos `?section=` siguen funcionando y el menú no le muestra al admin lo que su ruta le negaría.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_GROUP_ORDER,
  ADMIN_SECTIONS,
  activeAdminSectionId,
  adminSectionHref,
  findAdminSection,
  groupedAdminSections,
} from "../_components/admin-sections";

const ADMIN_DIR = join(process.cwd(), "app", "studio", "(app)", "admin");
const leer = (rel: string) => readFileSync(join(ADMIN_DIR, rel), "utf8");

/** Los `id` que existían antes de la 0708 y pueden estar en marcadores, avisos o historial. */
const IDS_VIGENTES = [
  "shipping-labels", "company", "features", "client-notifications", "telegram-alerts", "masterdata", "rates",
  "fiscal", "holidays", "appearance", "routes", "permissions", "audit", "recepcion-addons", "portal-invites",
  "numbering", "legal-docs", "acceptances", "api", "workflows", "import", "calculadora", "agents",
  "chatwoot-updates", "ia",
];

describe("catálogo de secciones (SDD-0708)", () => {
  it("conserva todos los id vigentes y no repite ninguno", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of IDS_VIGENTES) expect(ids, id).toContain(id);
  });

  it("ordena por tema en los seis grupos de R1, sin los marcadores de Marca", () => {
    expect(ADMIN_GROUP_ORDER).toEqual([
      "Empresa", "Operación", "Clientes y portal", "Equipo y seguridad", "Integraciones", "Inteligencia artificial",
    ]);
    for (const s of ADMIN_SECTIONS) expect(ADMIN_GROUP_ORDER).toContain(s.group);
    expect(ADMIN_SECTIONS.some((s) => s.id.startsWith("brand-"))).toBe(false);
  });

  it("el menú enlaza directo a la ruta real de cada sección con módulo propio", () => {
    for (const s of ADMIN_SECTIONS) {
      expect(adminSectionHref(s)).toBe(s.href ?? `/studio/admin?section=${s.id}`);
    }
    expect(adminSectionHref(findAdminSection("ia")!)).toBe("/studio/admin/ia");
    expect(adminSectionHref(findAdminSection("company")!)).toBe("/studio/admin?section=company");
  });

  it("marca como externo solo lo que vive fuera de /studio/admin", () => {
    for (const s of ADMIN_SECTIONS) {
      if (!s.href) continue;
      expect(Boolean(s.external), s.id).toBe(!s.href.startsWith("/studio/admin/"));
    }
  });

  it("IA y Oficina Virtual solo aparecen al superadministrador", () => {
    const ids = (sa: boolean) => groupedAdminSections(sa).flatMap((g) => g.items.map((s) => s.id));
    expect(ids(false)).not.toContain("ia");
    expect(ids(false)).not.toContain("oficina-virtual");
    expect(ids(false)).toContain("agents");
    expect(ids(true)).toEqual(expect.arrayContaining(["ia", "oficina-virtual", "agents"]));
  });
});

describe("ítem activo del menú", () => {
  it("en /studio/admin manda ?section= si la sección se pinta en línea", () => {
    expect(activeAdminSectionId("/studio/admin", "audit")).toBe("audit");
    expect(activeAdminSectionId("/studio/admin", null)).toBe("company");
    expect(activeAdminSectionId("/studio/admin", "brand-system")).toBe("company");
  });

  it("en una subruta marca la sección dueña, también en sus hijas", () => {
    expect(activeAdminSectionId("/studio/admin/ia", null)).toBe("ia");
    expect(activeAdminSectionId("/studio/admin/agentes/una-skill", null)).toBe("agents");
    expect(activeAdminSectionId("/studio/admin/notificaciones/estado", null)).toBe("client-notifications");
    expect(activeAdminSectionId("/studio/admin/oficina-virtual/vista", null)).toBe("oficina-virtual");
    expect(activeAdminSectionId("/studio/admin/no-existe", null)).toBeNull();
  });
});

describe("página y marco", () => {
  const page = leer("page.tsx");
  const layout = leer("layout.tsx");

  it("la tarjeta puente ya no existe", () => {
    expect(page).not.toContain("LinkedSectionCTA");
    expect(page).not.toContain("tiene su módulo dedicado");
    expect(page).not.toContain("PendingSectionPanel");
  });

  it("?section= con ruta propia redirige a esa ruta", () => {
    expect(page).toMatch(/if \(requested\?\.href\) redirect\(requested\.href\)/);
  });

  it("la página sigue exigiendo admin y el marco no agrega guardias", () => {
    expect(page).toContain('await requireModuleView("admin")');
    expect(layout).not.toContain("requireModuleView");
    expect(layout).not.toContain("redirect(");
    expect(layout).not.toContain("notFound(");
    // Quien no pasa admin (operations en /studio/admin/rutas) recibe la página sola.
    expect(layout).toMatch(/if \(!canAccessModule\(role, "admin", overrides, grants\)\) return <>\{children\}<\/>;/);
  });

  it("las subrutas conservan su propia guardia", () => {
    expect(leer("rutas/page.tsx")).toContain('requireModuleView("admin-rutas")');
    expect(leer("ia/layout.tsx")).toContain("isPlatformAdmin");
    expect(leer("oficina-virtual/layout.tsx")).toContain("requireModuleView");
  });

  it("las subpáginas ya no repiten un «Volver a Administración»", () => {
    for (const rel of [
      "feature-flags/page.tsx", "notificaciones/page.tsx", "ia/page.tsx", "oficina-virtual/page.tsx",
      "etiquetas/page.tsx",
    ]) {
      expect(leer(rel), rel).not.toMatch(/←\s*(Volver a )?Administración/);
    }
  });
});
