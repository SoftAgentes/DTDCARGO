/**
 * SDD-0515 · OperariosClient: cada fila dice por qué app entra el operario y
 * nombra su rol de verdad.
 *
 * El hallazgo del 2026-10-14: un operario de China intentaba entrar por la app
 * de Venezuela, donde su PIN no existe (verify_operario_pin compara dentro de
 * tenant + región), y la columna «Rol» mostraba «Operario» a un camionero y a
 * un bodeguero. Lo que se afirma:
 *  - la fila de un operario de China dice «Entra por dtdcargo.com/m/cn/login» y
 *    la de uno de Venezuela «…/m/ve/login», cada una sólo la suya;
 *  - la columna «Rol» muestra Operario, Supervisor, Bodeguero o Camionero.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";

vi.mock("../actions", () => ({
  createOperarioAction: vi.fn(),
  generateOperarioPinAction: vi.fn(),
  resetOperarioPinAction: vi.fn(),
  viewOperarioPinAction: vi.fn(),
  setOperarioActiveAction: vi.fn(),
  updateOperarioAction: vi.fn(),
}));

import { OPERARIOS_COLUMN_WIDTHS_KEY, OperariosClient } from "./OperariosClient";

function operario(over: Partial<OperarioRow> & Pick<OperarioRow, "id" | "display_name" | "region" | "role">): OperarioRow {
  return {
    tenant_id: "10000000-0000-4000-8000-000000000001",
    warehouse_id: over.region === "cn" ? "30000000-0000-4000-8000-000000000001" : null,
    display_name_cn: null,
    active: true,
    last_login_at: null,
    created_at: "2026-05-26T00:00:00Z",
    warehouse_code: over.region === "cn" ? "YIW-A1" : null,
    warehouse_name_es: over.region === "cn" ? "Yiwu" : null,
    ...over,
  };
}

const ROWS: OperarioRow[] = [
  operario({ id: "50000000-0000-4000-8000-000000000001", display_name: "Ana China", region: "cn", role: "operario" }),
  operario({ id: "50000000-0000-4000-8000-000000000002", display_name: "Bruno Supervisor", region: "cn", role: "supervisor" }),
  operario({ id: "50000000-0000-4000-8000-000000000003", display_name: "Carla Bodega", region: "ve", role: "bodeguero" }),
  operario({ id: "50000000-0000-4000-8000-000000000004", display_name: "Diego Ruta", region: "ve", role: "camionero" }),
];

/** La fila de un operario: el contenedor de la grilla que tiene su nombre. */
function rowOf(name: string): HTMLElement {
  const nameCell = screen.getByText(name);
  const row = nameCell.closest<HTMLElement>("div[style*='grid']");
  if (!row) throw new Error(`sin fila para ${name}`);
  return row;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("OperariosClient · por qué app entra cada operario", () => {
  it.each([
    ["Ana China", "dtdcargo.com/m/cn/login", "/m/ve/login"],
    ["Bruno Supervisor", "dtdcargo.com/m/cn/login", "/m/ve/login"],
    ["Carla Bodega", "dtdcargo.com/m/ve/login", "/m/cn/login"],
    ["Diego Ruta", "dtdcargo.com/m/ve/login", "/m/cn/login"],
  ])("%s: «Entra por %s» y no la otra", (name, label, other) => {
    render(<OperariosClient operarios={ROWS} warehouses={[]} rolesPorRegion={null} />);
    const row = rowOf(name);

    expect(within(row).getByText(label).parentElement).toHaveTextContent(`Entra por ${label}`);
    expect(row.textContent).not.toContain(other);
  });
});

describe("OperariosClient · columna «Rol»", () => {
  it.each([
    ["Ana China", "Operario"],
    ["Bruno Supervisor", "Supervisor"],
    ["Carla Bodega", "Bodeguero"],
    ["Diego Ruta", "Camionero"],
  ])("%s se muestra como %s", (name, label) => {
    render(<OperariosClient operarios={ROWS} warehouses={[]} rolesPorRegion={null} />);
    const row = rowOf(name);

    expect(within(row).getByText(label)).toBeInTheDocument();
    if (label !== "Operario") expect(within(row).queryByText("Operario")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// SDD-0520 · columnas ajustables y botones compactos
//
// El hallazgo (captura de Sam, 2026-10-14): con «1fr 130px 130px 160px 90px
// 290px» la única columna flexible era «Operario» y a anchos normales quedaba
// en casi 0: el nombre salía «L…», «W.», «Y…». Lo que se afirma:
//  - «Operario» sigue absorbiendo el espacio libre, pero con piso de 260 px; si
//    la suma no cabe, la tabla tiene un piso de ancho y hace scroll en vez de
//    aplastarla;
//  - el nombre completo y «Entra por …» están en el title;
//  - el asa de cada columna es un separator con valor, mínimo y máximo; las
//    flechas, Home y End cambian el ÚNICO template, que comparten encabezado y
//    filas; arrastrar también, y sólo se guarda al soltar;
//  - ajustar «Operario» la deja exacta y el espacio libre pasa a «Acciones»;
//    el ajuste arranca desde el ancho que se ve, no desde el piso;
//  - lo guardado se aplica; lo corrupto o fuera de rango se ignora; si el
//    almacenamiento lanza, la tabla sigue con los defaults y se puede ajustar;
//  - doble clic restablece esa columna y «Restablecer columnas» todas;
//  - el render del servidor no lee el almacenamiento;
//  - los botones son xs y conservan sus textos y nombres accesibles.
// ─────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = "minmax(260px, 1fr) 88px 104px 96px 64px 232px";
// 260+88+104+96+64+232 = 844 de columnas + 5 gaps de 12 + 2 × 20 de padding.
const DEFAULT_MIN_WIDTH = 944;

/** Template con «Operario» fijada en `op` px (el espacio libre pasa a Acciones). */
function fixed(op: number, rest = "88px 104px 96px 64px"): string {
  return `${op}px ${rest} minmax(232px, 1fr)`;
}

/** Render + vaciar el microtask en que el hook lee lo guardado. */
async function renderTable(rows: OperarioRow[] = ROWS) {
  const view = render(<OperariosClient operarios={rows} warehouses={[]} rolesPorRegion={null} />);
  await act(async () => {});
  return view;
}

function handle(label: string): HTMLElement {
  return screen.getByRole("separator", { name: `Ajustar ancho de ${label}` });
}

function headerTemplate(): string {
  const header = handle("Operario").closest<HTMLElement>("div[style*='grid']");
  if (!header) throw new Error("sin encabezado");
  return header.style.gridTemplateColumns;
}

/** Encabezado y cada fila usan el mismo template: devuelve ése, o falla. */
function sharedTemplate(): string {
  const template = headerTemplate();
  for (const r of ROWS) expect(rowOf(r.display_name).style.gridTemplateColumns).toBe(template);
  return template;
}

/** El contenedor del encabezado y las filas: su min-width es el piso de la tabla. */
function tableFloor(): HTMLElement {
  const header = handle("Operario").closest<HTMLElement>("div[style*='grid']");
  if (!header?.parentElement) throw new Error("sin piso de tabla");
  return header.parentElement;
}

function stored(): string | null {
  return localStorage.getItem(OPERARIOS_COLUMN_WIDTHS_KEY);
}

/** Simula el ancho que pinta el navegador para la celda del encabezado de un asa. */
function cellRendersAt(label: string, width: number) {
  const cell = handle(label).parentElement as HTMLElement;
  vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
    width,
    height: 29,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 29,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("OperariosClient · el nombre se ve (SDD-0520)", () => {
  afterEach(() => localStorage.clear());

  it("Operario absorbe el espacio libre con piso legible y la tabla tiene piso para hacer scroll", async () => {
    await renderTable();
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);

    const sep = handle("Operario");
    expect(sep).toHaveAttribute("aria-valuenow", "260");
    expect(sep).toHaveAttribute("aria-valuemin", "260");
    expect(sep).toHaveAttribute("aria-valuemax", "640");
    expect(sep.getAttribute("aria-valuetext")).toMatch(/^Automático/);

    const floor = tableFloor();
    expect(floor.style.minWidth).toBe(`${DEFAULT_MIN_WIDTH}px`);
    expect(floor.parentElement?.style.overflowX).toBe("auto");
  });

  it("el nombre completo (con el chino) y «Entra por …» quedan en el title", async () => {
    const conChino = operario({
      id: "50000000-0000-4000-8000-000000000009",
      display_name: "Wang Lei",
      display_name_cn: "王磊",
      region: "cn",
      role: "operario",
    });
    await renderTable([conChino]);

    expect(screen.getByTitle("Wang Lei · 王磊")).toHaveTextContent("Wang Lei· 王磊");
    expect(screen.getByTitle("Entra por dtdcargo.com/m/cn/login")).toHaveTextContent(
      "Entra por dtdcargo.com/m/cn/login",
    );
  });

  it("cada columna ajustable tiene su asa y «Acciones» no", async () => {
    await renderTable();
    for (const label of ["Operario", "Warehouse", "Rol", "Último login", "Activo"]) {
      const sep = handle(label);
      expect(sep).toHaveAttribute("aria-orientation", "vertical");
      expect(sep).toHaveAttribute("tabindex", "0");
    }
    expect(screen.queryByRole("separator", { name: "Ajustar ancho de Acciones" })).toBeNull();
    expect(screen.getAllByRole("separator")).toHaveLength(5);
  });
});

describe("OperariosClient · asas por teclado (SDD-0520)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("ArrowRight / ArrowLeft cambian el template compartido en 16 px y lo guardan", async () => {
    await renderTable();
    const sep = handle("Operario");

    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sep).toHaveAttribute("aria-valuenow", "276");
    expect(sep).toHaveAttribute("aria-valuetext", "276 px");
    expect(sharedTemplate()).toBe(fixed(276));
    expect(tableFloor().style.minWidth).toBe(`${DEFAULT_MIN_WIDTH + 16}px`);
    expect(stored()).toBe('{"operario":276}');

    fireEvent.keyDown(sep, { key: "ArrowRight" });
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sharedTemplate()).toBe(fixed(308));
    expect(stored()).toBe('{"operario":308}');
  });

  it("la primera flecha sobre Operario arranca desde el ancho que se ve, no desde el piso", async () => {
    await renderTable();
    cellRendersAt("Operario", 400);

    fireEvent.keyDown(handle("Operario"), { key: "ArrowLeft" });
    expect(sharedTemplate()).toBe(fixed(384));

    // Ya fijada, el siguiente paso sale de su valor, no de la medida.
    cellRendersAt("Operario", 999);
    fireEvent.keyDown(handle("Operario"), { key: "ArrowLeft" });
    expect(sharedTemplate()).toBe(fixed(368));
  });

  it("Home y End llevan al mínimo y al máximo, y las flechas no se pasan", async () => {
    await renderTable();
    const sep = handle("Rol");

    fireEvent.keyDown(sep, { key: "End" });
    expect(sep).toHaveAttribute("aria-valuenow", "200");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sep).toHaveAttribute("aria-valuenow", "200");

    fireEvent.keyDown(sep, { key: "Home" });
    expect(sep).toHaveAttribute("aria-valuenow", "88");
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(sep).toHaveAttribute("aria-valuenow", "88");
    // Ajustar otra columna no le quita a Operario el espacio libre.
    expect(sharedTemplate()).toBe("minmax(260px, 1fr) 88px 88px 96px 64px 232px");
  });

  it("Operario no baja de su piso legible", async () => {
    await renderTable();
    const sep = handle("Operario");
    fireEvent.keyDown(sep, { key: "Home" });
    expect(sharedTemplate()).toBe(fixed(260));
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(sharedTemplate()).toBe(fixed(260));
  });

  it("una tecla ajena no cambia nada", async () => {
    await renderTable();
    fireEvent.keyDown(handle("Operario"), { key: "Enter" });
    fireEvent.keyDown(handle("Operario"), { key: "ArrowUp" });
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(stored()).toBeNull();
  });
});

describe("OperariosClient · arrastre con puntero (SDD-0520)", () => {
  const capture = vi.fn();
  const release = vi.fn();
  beforeEach(() => {
    // jsdom no implementa la captura del puntero.
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: capture,
      releasePointerCapture: release,
      hasPointerCapture: () => true,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    capture.mockReset();
    release.mockReset();
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    delete proto.setPointerCapture;
    delete proto.releasePointerCapture;
    delete proto.hasPointerCapture;
  });

  it("arrastrar ensancha en vivo, captura el puntero y guarda sólo al soltar", async () => {
    await renderTable();
    const sep = handle("Operario");
    cellRendersAt("Operario", 300);

    fireEvent.pointerDown(sep, { pointerId: 7, button: 0, clientX: 100 });
    expect(capture).toHaveBeenCalledWith(7);
    expect(sep).toHaveAttribute("data-resizing", "true");

    fireEvent.pointerMove(sep, { pointerId: 7, clientX: 160 });
    fireEvent.pointerMove(sep, { pointerId: 7, clientX: 180 });
    expect(sharedTemplate()).toBe(fixed(380));
    expect(stored()).toBeNull();

    fireEvent.pointerUp(sep, { pointerId: 7, clientX: 180 });
    expect(release).toHaveBeenCalledWith(7);
    expect(sep).not.toHaveAttribute("data-resizing");
    expect(stored()).toBe('{"operario":380}');
  });

  it("arrastrar una columna fija parte de su ancho y no mueve a Operario", async () => {
    await renderTable();
    const sep = handle("Warehouse");

    fireEvent.pointerDown(sep, { pointerId: 3, button: 0, clientX: 50 });
    fireEvent.pointerMove(sep, { pointerId: 3, clientX: 90 });
    fireEvent.pointerUp(sep, { pointerId: 3 });
    expect(sharedTemplate()).toBe("minmax(260px, 1fr) 128px 104px 96px 64px 232px");
    expect(stored()).toBe('{"warehouse":128}');
  });

  it("el arrastre respeta el mínimo y el máximo", async () => {
    await renderTable();
    const sep = handle("Operario");

    fireEvent.pointerDown(sep, { pointerId: 1, button: 0, clientX: 500 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 0 });
    expect(sep).toHaveAttribute("aria-valuenow", "260");
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 5000 });
    expect(sep).toHaveAttribute("aria-valuenow", "640");
    fireEvent.pointerUp(sep, { pointerId: 1 });
    expect(stored()).toBe('{"operario":640}');
  });

  it("un movimiento de otro puntero o sin botón principal no ajusta", async () => {
    await renderTable();
    const sep = handle("Operario");

    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 400 });
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);

    fireEvent.pointerDown(sep, { pointerId: 1, button: 2, clientX: 100 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 300 });
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);

    fireEvent.pointerDown(sep, { pointerId: 1, button: 0, clientX: 100 });
    fireEvent.pointerMove(sep, { pointerId: 2, clientX: 300 });
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
    fireEvent.pointerCancel(sep, { pointerId: 1 });
    expect(sep).not.toHaveAttribute("data-resizing");
    expect(stored()).toBeNull();
  });
});

describe("OperariosClient · lo guardado (SDD-0520)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("se aplica al montar, en encabezado y filas", async () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"operario":400,"rol":160}');
    await renderTable();
    expect(sharedTemplate()).toBe(fixed(400, "88px 160px 96px 64px"));
    expect(handle("Operario")).toHaveAttribute("aria-valuenow", "400");
    expect(handle("Rol")).toHaveAttribute("aria-valuenow", "160");
  });

  it("JSON corrupto se ignora: defaults, y se limpia", async () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"operario":40');
    await renderTable();
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(stored()).toBeNull();
  });

  it("fuera de rango o desconocido se ignora; lo válido de al lado se conserva", async () => {
    localStorage.setItem(
      OPERARIOS_COLUMN_WIDTHS_KEY,
      '{"operario":5,"rol":160,"acciones":900,"fantasma":300,"activo":"64"}',
    );
    await renderTable();
    expect(sharedTemplate()).toBe("minmax(260px, 1fr) 88px 160px 96px 64px 232px");
    expect(stored()).toBe('{"rol":160}');
  });

  it("si el almacenamiento lanza, la tabla queda con los defaults y se puede ajustar igual", async () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"operario":400}');
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("lleno", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });

    await renderTable();
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);

    fireEvent.keyDown(handle("Operario"), { key: "ArrowRight" });
    expect(sharedTemplate()).toBe(fixed(276));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer columnas" }));
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
  });

  it("el render del servidor no lee el almacenamiento: sale con los defaults", () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"operario":400,"rol":160}');
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    const html = renderToString(<OperariosClient operarios={ROWS} warehouses={[]} rolesPorRegion={null} />);

    expect(getItem).not.toHaveBeenCalled();
    expect(html).toContain(`grid-template-columns:${DEFAULT_TEMPLATE}`);
    expect(html).not.toContain("400px");
    expect(html).toContain('aria-valuenow="260"');
  });
});

describe("OperariosClient · restablecer (SDD-0520)", () => {
  afterEach(() => localStorage.clear());

  it("doble clic en el asa restablece sólo esa columna, y Operario vuelve a crecer", async () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"operario":400,"rol":160}');
    await renderTable();

    fireEvent.doubleClick(handle("Operario"));
    expect(sharedTemplate()).toBe("minmax(260px, 1fr) 88px 160px 96px 64px 232px");
    expect(stored()).toBe('{"rol":160}');
  });

  it("«Restablecer columnas» aparece al ajustar, vuelve todo al default y borra lo guardado", async () => {
    await renderTable();
    const resetButton = () => screen.queryByRole("button", { name: "Restablecer columnas" });
    expect(resetButton()).toBeNull();

    fireEvent.keyDown(handle("Operario"), { key: "ArrowRight" });
    fireEvent.keyDown(handle("Último login"), { key: "End" });
    expect(resetButton()).toBeEnabled();
    expect(stored()).toBe('{"operario":276,"ultimo_login":200}');

    fireEvent.click(resetButton() as HTMLElement);
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(stored()).toBeNull();
    expect(resetButton()).toBeNull();
  });

  it("con anchos guardados, «Restablecer columnas» está desde el montaje", async () => {
    localStorage.setItem(OPERARIOS_COLUMN_WIDTHS_KEY, '{"activo":96}');
    await renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer columnas" }));
    expect(sharedTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(stored()).toBeNull();
  });

  it("sin operarios no hay tabla ni «Restablecer columnas»", async () => {
    await renderTable([]);
    expect(screen.queryByRole("button", { name: "Restablecer columnas" })).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();
  });
});

describe("OperariosClient · botones de la fila (SDD-0520)", () => {
  it.each(ROWS.map((r) => r.display_name))(
    "%s: «Ver PIN», «Restablecer PIN» y el lápiz son xs y conservan su nombre",
    async (name) => {
      await renderTable();
      const row = rowOf(name);

      const ver = within(row).getByRole("button", { name: `Ver PIN de ${name}` });
      const reset = within(row).getByRole("button", { name: `Restablecer PIN de ${name}` });
      const edit = within(row).getByRole("button", { name: "Editar" });

      expect(ver).toHaveTextContent(/^Ver PIN$/);
      expect(reset).toHaveTextContent(/^Restablecer PIN$/);
      for (const b of [ver, reset, edit]) {
        expect(b).toHaveClass("studio-btn", "studio-btn-ghost", "studio-btn-xs");
        expect(b).not.toHaveClass("studio-btn-sm");
        expect(b).toHaveAttribute("type", "button");
      }
      expect(edit).toHaveAttribute("title", "Editar");
    },
  );
});
