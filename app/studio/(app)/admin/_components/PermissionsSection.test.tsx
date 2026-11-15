/**
 * SDD-0635 §3.8 · matriz «Roles y permisos».
 *
 * Lo que defiende (aceptación 14 a 18):
 *   - sin siglas: cada celda dice «Ver y editar», «Solo ver», «Sin acceso» o «Todo»;
 *   - una celda abre un panel que nombra a las personas del rol y avisa de sus
 *     extras; nada se guarda hasta «Aplicar a las N»;
 *   - lo cambiado dice «Cambiado» y su panel explica lo de fábrica, con
 *     «Volver a lo de fábrica» (sin «×» suelta);
 *   - celdas fijas y columna admin no abren panel; soporte no edita;
 *   - encabezado, columna, grupo y leyenda con `position: sticky` y las sombras
 *     del token de borde fijo (contrato sobre `studio.css`; el desplazamiento
 *     real se mira en navegador).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";

const setMock = vi.fn();
const resetMock = vi.fn();
const toastOk = vi.fn();
vi.mock("../actions", () => ({
  setRoleModuleAccessAction: (...a: unknown[]) => setMock(...a),
  resetRoleModuleAccessAction: (...a: unknown[]) => resetMock(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: toastOk, error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const { PermissionsSection } = await import("./PermissionsSection");

function persona(id: string, role: UserMembershipWithProfile["role"]): UserMembershipWithProfile {
  return {
    user_id: id,
    tenant_id: "t-1",
    role,
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-03T00:00:00Z",
    email: `${id}@ejemplo.test`,
    profile: null,
  } as UserMembershipWithProfile;
}

const MIEMBROS = [persona("ca", "accounting"), persona("cb", "accounting"), persona("s1", "support")];
const NOMBRES = { ca: "Contable A", cb: "Contable B", s1: "Soporte A" };
const EXTRA_CB: UserModuleGrantView = {
  userId: "cb",
  moduleId: "kommo",
  canView: true,
  canEdit: true,
  reason: "Atiende el CRM",
  expiresAt: null,
  grantedBy: null,
  sensitive: false,
  updatedAt: "2026-11-11T12:00:00Z",
  expired: false,
  expiringSoon: false,
};

const celda = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

beforeEach(() => {
  vi.clearAllMocks();
  setMock.mockResolvedValue({ ok: true });
  resetMock.mockResolvedValue({ ok: true });
});

describe("PermissionsSection · palabras y alcance", () => {
  it("ninguna celda usa siglas; los nombres dicen el nivel en palabras", () => {
    const { container } = render(<PermissionsSection members={MIEMBROS} nombres={NOMBRES} />);
    const texto = container.querySelector("table")?.textContent ?? "";
    expect(texto).not.toMatch(/V·E|TOTAL/);
    expect(celda(/^Contabilidad, CRM: Sin acceso\. Cambiar para todo el rol$/)).toBeTruthy();
    expect(celda(/^Contabilidad, Tarifas: Ver y editar\./)).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Admin, CRM: Todo/ })).toBeTruthy();
    expect(screen.getByRole("note", { name: "Leyenda" }).textContent).toMatch(/Fijo: dinero y administración no se cambian aquí/);
    expect(screen.getAllByText("2 personas").length).toBeGreaterThan(0);
  });

  it("una celda abre un panel que nombra a quiénes cambia y no guarda hasta «Aplicar a las 2»", async () => {
    const u = userEvent.setup();
    render(<PermissionsSection members={MIEMBROS} grants={[EXTRA_CB]} nombres={NOMBRES} />);
    await u.click(celda(/^Contabilidad, CRM: Sin acceso/));
    const panel = screen.getByRole("dialog", { name: "CRM · todo el rol Contabilidad" });
    expect(within(panel).getByText(/Cambia para/).textContent).toMatch(/2 personas.*Contable A, Contable B/);
    expect(within(panel).getByText(/Contable B ya lo tiene como acceso extra/)).toBeTruthy();
    const aplicar = within(panel).getByRole("button", { name: "Aplicar a las 2" });
    expect(aplicar).toHaveProperty("disabled", true);
    await u.click(within(panel).getByRole("radio", { name: /^Solo ver/ }));
    expect(setMock).not.toHaveBeenCalled();
    expect(within(panel).getByText(/quedará marcado «sobra»/)).toBeTruthy();
    await u.click(aplicar);
    expect(setMock).toHaveBeenCalledWith("accounting", "kommo", true, false);
    expect(toastOk).toHaveBeenCalledWith("Contabilidad: CRM ahora en «Solo ver» para 2 personas.");
  });

  it("Esc cierra el panel y devuelve el foco a la celda", async () => {
    const u = userEvent.setup();
    render(<PermissionsSection members={MIEMBROS} nombres={NOMBRES} />);
    await u.click(celda(/^Contabilidad, CRM: Sin acceso/));
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(celda(/^Contabilidad, CRM: Sin acceso/));
  });

  it("soporte no ofrece «Ver y editar»", async () => {
    const u = userEvent.setup();
    render(<PermissionsSection members={MIEMBROS} nombres={NOMBRES} />);
    await u.click(celda(/^Soporte, CRM:/));
    expect(screen.getByRole("radio", { name: /^Ver y editar/ })).toHaveProperty("disabled", true);
    expect(screen.getByText("Soporte nunca edita.")).toBeTruthy();
  });

  it("celdas fijas y la columna admin no son botones", () => {
    render(<PermissionsSection members={MIEMBROS} nombres={NOMBRES} />);
    expect(screen.queryByRole("button", { name: /^Contabilidad, Tesorería:/ })).toBeNull();
    expect(screen.getByRole("img", { name: /^Contabilidad, Tesorería: Ver y editar, fijo$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Admin, / })).toBeNull();
  });
});

describe("PermissionsSection · de fábrica", () => {
  const OV = { "commercial:reclamos": { view: true, edit: false } };

  it("lo cambiado dice «Cambiado», su panel explica lo de fábrica y vuelve con un enlace", async () => {
    const u = userEvent.setup();
    const { container } = render(<PermissionsSection initialOverrides={OV} members={MIEMBROS} nombres={NOMBRES} />);
    expect(container.textContent).not.toMatch(/×|desvío/);
    expect(celda(/^Comercial, Reclamos: Solo ver, cambiado respecto a lo de fábrica/)).toBeTruthy();
    expect(screen.getByText("Cambiado")).toBeTruthy();
    await u.click(celda(/^Comercial, Reclamos:/));
    const panel = screen.getByRole("dialog");
    expect(panel.textContent).toMatch(/De fábrica, Comercial tiene ver y editar en Reclamos\. Hoy está cambiado a solo ver\./);
    expect(within(panel).getByRole("radio", { name: /^Ver y editar · de fábrica/ })).toBeTruthy();
    await u.click(within(panel).getByRole("button", { name: "Volver a lo de fábrica" }));
    expect(resetMock).toHaveBeenCalledWith("commercial", "reclamos");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("elegir lo de fábrica y aplicar limpia el desvío en vez de guardar uno igual", async () => {
    const u = userEvent.setup();
    render(<PermissionsSection initialOverrides={OV} members={MIEMBROS} nombres={NOMBRES} />);
    await u.click(celda(/^Comercial, Reclamos:/));
    await u.click(screen.getByRole("radio", { name: /^Ver y editar/ }));
    await u.click(screen.getByRole("button", { name: "Aplicar al rol" }));
    expect(resetMock).toHaveBeenCalledWith("commercial", "reclamos");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("«Solo los cambiados» deja solo los módulos con algo cambiado", async () => {
    const u = userEvent.setup();
    render(<PermissionsSection initialOverrides={OV} members={MIEMBROS} nombres={NOMBRES} />);
    await u.click(screen.getByRole("button", { name: /Solo los cambiados/ }));
    const filas = screen.getAllByRole("rowheader").map((th) => th.textContent);
    expect(filas).toEqual(["Reclamos"]);
  });
});

describe("PermissionsSection · contrato de bordes fijos (studio.css)", () => {
  const css = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8");
  const regla = (sel: string) => {
    const i = css.indexOf(`${sel} {`);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };

  it("encabezado, columna, grupo y leyenda son sticky dentro de un contenedor con desplazamiento propio", () => {
    expect(regla(".studio-mx-wrap")).toMatch(/overflow:\s*auto/);
    expect(regla(".studio-mx thead th")).toMatch(/position:\s*sticky;\s*top:\s*0/);
    expect(css).toMatch(/\.studio-mx th\[scope="row"\], \.studio-mx thead th:first-child \{[^}]*position:\s*sticky;\s*left:\s*0/);
    expect(regla(".studio-mx-grp th")).toMatch(/position:\s*sticky;\s*top:\s*60px/);
    expect(regla(".studio-mx-legend")).toMatch(/position:\s*sticky;\s*bottom:\s*0/);
  });

  it("las sombras usan el token de borde fijo (BD-070), no rgba sueltos", () => {
    expect(css).toMatch(/\[data-y="true"\][^{]*\{\s*box-shadow:\s*var\(--shadow-sticky-top\)/);
    expect(css).toMatch(/\[data-x="true"\][^{]*\{\s*box-shadow:\s*var\(--shadow-sticky-left\)/);
    const bloque = css.slice(css.indexOf("Matriz «Roles y permisos» legible"));
    expect(bloque).not.toMatch(/rgba\(/);
  });
});
