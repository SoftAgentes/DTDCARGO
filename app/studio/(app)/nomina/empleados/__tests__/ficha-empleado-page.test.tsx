/**
 * SDD-0652 F1 · la página de la ficha del empleado.
 *
 * Se monta la página real con las lecturas dobladas. El control de rol es el
 * real (`getFichaEmpleadoAccess`), con `getStudioAccess` doblado, y `accesoDe`
 * también es real, con un cliente admin falso. Lo que se mide:
 *   - sin rol admin/accounting en el tenant → 404 **sin leer la ficha**;
 *   - la ficha se busca en el tenant de la membresía;
 *   - no existe → 404; error de lectura → «No se pudo cargar», no 404;
 *   - Contabilidad no recibe correo de acceso, rol ni la pestaña Acceso;
 *   - la cuenta llega enmascarada;
 *   - un bloque con error lo dice, y uno vacío dice su causa.
 * Datos sintéticos.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin" as string | null,
  tenantId: "t1" as string | null,
  lookup: { kind: "found" } as { kind: "found" | "not_found" | "error" },
  authUserId: "22222222-2222-2222-2222-222222222222" as string | null,
  prestamosFalla: false,
  lookups: [] as { tenantId: string; code: string }[],
  refreshes: 0,
  refresh: () => {},
  // Fase 2
  eventos: [] as { id: string; entity_type: string; event_type: string; occurred_at: string; actor_id: string | null }[],
  eventosFallan: false,
  candidatos: [] as { userId: string; nombre: string; correoAcceso: string | null }[],
  candidatosFallan: false,
  pidioCandidatos: 0,
  rutaFoto: null as string | null,
  firmaFalla: false,
}));
const { nada } = vi.hoisted(() => ({ nada: () => null }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ refresh: state.refresh }),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { role: "support", disabled_at: null, last_login_at: null }, error: null }),
    };
    return {
      from: () => chain,
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: "acceso-sintetico@example.test", last_sign_in_at: "2026-11-10T10:00:00Z" } },
            error: null,
          }),
        },
      },
    };
  },
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: async () => state.role,
  getStudioAccess: async () => ({
    role: state.role,
    tenantId: state.tenantId,
    userId: "u-mira",
    warehouseScope: "all",
    overrides: {},
    grants: {},
  }),
}));
vi.mock("@/lib/studio/rbac", () => ({ canEditModule: () => false }));
vi.mock("@/lib/studio/nomina/position-queries", () => ({ listPositions: async () => [] }));
vi.mock("@/lib/studio/nomina/employee-queries", () => ({
  getEmployeeByCode: async (_s: unknown, tenantId: string, code: string) => {
    state.lookups.push({ tenantId, code });
    if (state.lookup.kind !== "found") return state.lookup;
    return {
      kind: "found",
      employee: {
        id: "e1",
        tenant_id: "t1",
        employee_code: "EMP-0007",
        full_name: "Persona Sintética",
        national_id: "V-00000000",
        position_label: "Analista",
        department: "Operaciones",
        position_id: null,
        phone: null,
        email: "contacto-sintetico@example.test",
        salary_usd: 321,
        hire_date: "2026-01-15",
        birth_date: null,
        bank_name: "Banco de prueba",
        bank_account_type: "corriente",
        bank_account: "0102 0000 00 0000004321",
        status: "activo",
        notes: null,
        created_by: null,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        deleted_at: null,
        auth_user_id: state.authUserId,
      },
    };
  },
}));
vi.mock("@/lib/studio/nomina/ficha-empleado-queries", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/studio/nomina/ficha-empleado-queries")>();
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  return {
    ...orig,
    prestamosDe: async () => (state.prestamosFalla ? { ok: false as const } : ok([])),
    asistenciaDelMes: async () => ok([]),
    amonestacionesDe: async () => ok([]),
    recibosDe: async () => ok([]),
    finiquitosDe: async () =>
      ok([{ id: "s1", settlement_code: "LIQ-0001", termination_date: "2026-06-30", status: "anulado", created_at: "2026-07-02T00:00:00Z" }]),
    comunicacionesDe: async () => ok([]),
    cambioBancoPendiente: async () => ok(false),
    eventosDe: async () => (state.eventosFallan ? { ok: false as const } : ok(state.eventos)),
    candidatosDeEnlace: async () => {
      state.pidioCandidatos += 1;
      return state.candidatosFallan ? { ok: false as const } : ok(state.candidatos);
    },
  };
});
vi.mock("@/lib/studio/nomina/employee-photo", () => ({
  rutasDeFoto: async () => new Map(state.rutaFoto ? [["e1", state.rutaFoto]] : []),
  firmarFotos: async (_admin: unknown, rutas: string[]) =>
    new Map(state.firmaFalla ? [] : rutas.map((r) => [r, `https://firmada.example.test/${encodeURIComponent(r)}`])),
}));
// Las acciones de la ficha son del servidor: aquí solo importa qué se dibuja.
vi.mock("../[codigo]/actions", () => ({
  linkEmployeeUserAction: async () => ({ ok: true }),
  unlinkEmployeeUserAction: async () => ({ ok: true }),
  uploadEmployeePhotoAction: async () => ({ ok: true }),
  removeEmployeePhotoAction: async () => ({ ok: true }),
  revealBankAccountAction: async () => ({ ok: true, cuenta: "0102 0000 00 0000004321" }),
}));
vi.mock("@/app/studio/(app)/usuarios/_components/acceso/ActividadAcceso", () => ({ ActividadAcceso: nada }));
vi.mock("@/app/studio/(app)/nomina/_components/EmpleadoDrawer", () => ({ EmpleadoDrawer: nada }));

import FichaEmpleadoPage from "../[codigo]/page";

beforeEach(() => {
  state.role = "admin";
  state.tenantId = "t1";
  state.lookup = { kind: "found" };
  state.authUserId = "22222222-2222-2222-2222-222222222222";
  state.prestamosFalla = false;
  state.lookups = [];
  state.refreshes = 0;
  state.refresh = () => {
    state.refreshes += 1;
  };
  state.eventos = [];
  state.eventosFallan = false;
  state.candidatos = [];
  state.candidatosFallan = false;
  state.pidioCandidatos = 0;
  state.rutaFoto = null;
  state.firmaFalla = false;
});
afterEach(cleanup);

async function montar(codigo = "EMP-0007") {
  const ui = await FichaEmpleadoPage({ params: Promise.resolve({ codigo }) });
  return render(ui);
}

describe("Ficha del empleado · quién entra (SDD-0652 F1)", () => {
  it.each([
    ["un acceso extra sin rol de Nómina", "commercial"],
    ["soporte (lectura propia de 0181)", "support"],
    ["sin membresía activa", null],
  ])("con %s responde 404 sin leer la ficha", async (_caso, role) => {
    state.role = role;
    await expect(montar()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.lookups).toEqual([]);
  });

  it("busca la ficha en el tenant de la membresía", async () => {
    await montar("emp-0007");
    expect(state.lookups).toEqual([{ tenantId: "t1", code: "emp-0007" }]);
  });

  it("si no existe, 404", async () => {
    state.lookup = { kind: "not_found" };
    await expect(montar()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("si la lectura falla, dice «No se pudo cargar» y no 404", async () => {
    state.lookup = { kind: "error" };
    await montar();
    expect(screen.getByText("No se pudo cargar la ficha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.refreshes).toBe(1);
  });
});

describe("Ficha del empleado · qué ve cada rol (SDD-0652 F1, D10)", () => {
  it("admin ve el correo de acceso, el rol y la pestaña Acceso", async () => {
    const { container } = await montar();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Persona Sintética");
    expect(container.textContent).toContain("acceso-sintetico@example.test");
    expect(container.textContent).toContain("contacto-sintetico@example.test");
    expect(screen.getByRole("tab", { name: "Acceso" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver ficha de usuario" }).getAttribute("href")).toBe(
      "/studio/usuarios?persona=22222222-2222-2222-2222-222222222222",
    );
  });

  it("Contabilidad no recibe correo de acceso, rol, último ingreso ni la pestaña Acceso", async () => {
    state.role = "accounting";
    const { container } = await montar();
    const html = container.innerHTML;
    expect(html).not.toContain("acceso-sintetico@example.test");
    expect(html).not.toContain("22222222-2222-2222-2222-222222222222");
    expect(html).not.toContain("Último ingreso");
    expect(screen.queryByRole("tab", { name: "Acceso" })).toBeNull();
    expect(container.textContent).toContain("Con acceso al Studio");
    expect(container.textContent).toContain("contacto-sintetico@example.test");
  });

  it("la cuenta bancaria llega enmascarada", async () => {
    const { container } = await montar();
    expect(container.innerHTML).not.toContain("0000004321");
    expect(container.textContent).toContain("•••• 4321");
  });

  it("sin cuenta enlazada dice «Sin cuenta» y no hay pestaña Acceso", async () => {
    state.authUserId = null;
    const { container } = await montar();
    expect(container.textContent).toContain("Sin cuenta");
    expect(screen.queryByRole("tab", { name: "Acceso" })).toBeNull();
  });
});

describe("Ficha del empleado · estados de los bloques (§5.3)", () => {
  it("un bloque vacío dice su causa y uno con error lo dice", async () => {
    let r = await montar();
    expect(r.container.textContent).toContain("No tiene préstamos.");
    cleanup();
    state.prestamosFalla = true;
    r = await montar();
    expect(r.container.textContent).toContain("No se pudo cargar este bloque.");
    expect(r.container.textContent).not.toContain("No tiene préstamos.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.refreshes).toBe(1);
  });

  it("la línea de tiempo muestra el finiquito anulado", async () => {
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    expect(screen.getByText("Finiquito LIQ-0001 (anulado)")).toBeTruthy();
  });

  it("las pestañas se mueven con las flechas", async () => {
    await montar();
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    fireEvent.keyDown(resumen, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Línea de tiempo" }).getAttribute("aria-selected")).toBe("true");
  });
});

// ── Fase 2 ──────────────────────────────────────────────────────────────────
const CANDIDATA = { userId: "33333333-3333-3333-3333-333333333333", nombre: "Usuaria Sintética", correoAcceso: "contacto-sintetico@example.test" };
const OTRO = { userId: "44444444-4444-4444-4444-444444444444", nombre: "Otro Sintético", correoAcceso: "otro-sintetico@example.test" };

describe("Ficha del empleado · enlace con un usuario (SDD-0652 fase 2, §4)", () => {
  it("admin, sin enlace: ve el selector con los candidatos y el motivo", async () => {
    state.authUserId = null;
    state.candidatos = [OTRO];
    await montar();
    const selector = screen.getByLabelText("Usuario del Studio") as HTMLSelectElement;
    expect([...selector.options].map((o) => o.value)).toEqual(["", OTRO.userId]);
    expect(screen.getByLabelText("Motivo")).toBeTruthy();
    // Sin persona ni motivo, el botón no se puede usar.
    expect((screen.getByRole("button", { name: "Enlazar con usuario" }) as HTMLButtonElement).disabled).toBe(true);
    // Otro correo: no hay sugerencia.
    expect(screen.queryByText("Puede ser la misma persona")).toBeNull();
  });

  it("la sugerencia por correo propone y no enlaza: deja elegida a la persona", async () => {
    state.authUserId = null;
    state.candidatos = [OTRO, CANDIDATA];
    await montar();
    expect(screen.getByText("Puede ser la misma persona")).toBeTruthy();
    const selector = screen.getByLabelText("Usuario del Studio") as HTMLSelectElement;
    expect(selector.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Elegir para enlazar" }));
    expect((screen.getByLabelText("Usuario del Studio") as HTMLSelectElement).value).toBe(CANDIDATA.userId);
    // Sigue sin enlazar: falta el motivo.
    expect((screen.getByRole("button", { name: "Enlazar con usuario" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Contabilidad no recibe candidatos ni sugerencia: ni se piden", async () => {
    state.role = "accounting";
    state.authUserId = null;
    state.candidatos = [CANDIDATA];
    const { container } = await montar();
    expect(state.pidioCandidatos).toBe(0);
    expect(container.innerHTML).not.toContain(CANDIDATA.userId);
    expect(container.innerHTML).not.toContain("Usuaria Sintética");
    expect(screen.queryByText("Puede ser la misma persona")).toBeNull();
    expect(screen.queryByLabelText("Usuario del Studio")).toBeNull();
  });

  it("con enlace no se piden candidatos y admin ve «Quitar enlace»", async () => {
    state.candidatos = [CANDIDATA];
    await montar();
    expect(state.pidioCandidatos).toBe(0);
    expect(screen.getByRole("button", { name: "Quitar enlace" })).toBeTruthy();
    expect(screen.queryByLabelText("Usuario del Studio")).toBeNull();
  });

  it("si la lista de candidatos falla, se dice y no se ofrece a nadie", async () => {
    state.authUserId = null;
    state.candidatosFallan = true;
    const { container } = await montar();
    expect(container.textContent).toContain("No se pudo cargar la lista de usuarios del Studio.");
    expect(screen.queryByLabelText("Usuario del Studio")).toBeNull();
  });
});

describe("Ficha del empleado · foto, cuenta y eventos (SDD-0652 fase 2)", () => {
  it("con foto muestra la URL firmada con texto alternativo; la ruta del bucket no viaja", async () => {
    state.rutaFoto = "t1/e1/aaaaaaaa-0000-4000-8000-000000000001.webp";
    const { container } = await montar();
    const img = screen.getByAltText("Foto de Persona Sintética") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("https://firmada.example.test/");
    expect(container.innerHTML).not.toContain('"t1/e1/');
  });

  it("sin foto, o si no se pudo firmar, se ven las iniciales", async () => {
    let r = await montar();
    expect(screen.queryByAltText("Foto de Persona Sintética")).toBeNull();
    expect(r.container.textContent).toContain("PS");
    cleanup();
    state.rutaFoto = "t1/e1/aaaaaaaa-0000-4000-8000-000000000001.webp";
    state.firmaFalla = true;
    r = await montar();
    expect(screen.queryByAltText("Foto de Persona Sintética")).toBeNull();
  });

  it("quien no edita Nómina no ve los controles de la foto", async () => {
    await montar();
    expect(screen.queryByRole("button", { name: "Subir foto" })).toBeNull();
  });

  it.each(["admin", "accounting"])("%s ve «Mostrar» junto a la cuenta enmascarada, y el número sigue sin viajar", async (role) => {
    state.role = role;
    const { container } = await montar();
    expect(screen.getByRole("button", { name: "Mostrar la cuenta bancaria completa" })).toBeTruthy();
    expect(container.textContent).toContain("•••• 4321");
    expect(container.innerHTML).not.toContain("0000004321");
  });

  it("la línea de tiempo suma los eventos de la ficha, con quién los hizo", async () => {
    state.eventos = [
      { id: "ev1", entity_type: "nomina_employee_sensitive_view", event_type: "bank_account_revealed", occurred_at: "2026-11-17T12:00:00Z", actor_id: null },
      { id: "ev2", entity_type: "nomina_employee_access", event_type: "user_linked", occurred_at: "2026-11-16T12:00:00Z", actor_id: null },
    ];
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    expect(screen.getByText("Se consultó la cuenta bancaria completa")).toBeTruthy();
    expect(screen.getByText("Se enlazó con un usuario del Studio")).toBeTruthy();
    expect(screen.getByText("Finiquito LIQ-0001 (anulado)")).toBeTruthy();
  });

  it("si los eventos no se pueden leer, la línea de tiempo lo dice", async () => {
    state.eventosFallan = true;
    const { container } = await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    expect(container.textContent).toContain("No se pudieron cargar: cambios registrados");
  });
});
