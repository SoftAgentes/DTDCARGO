/**
 * SDD-0529 · EditOperarioDrawer: editar a un operario de Venezuela o de China.
 *
 * El cajón corre con el DrawerShell y el ToastProvider REALES; la server action
 * es un doble que guarda el FormData (el servidor tiene su suite en
 * __tests__/update-operario-actions.test.ts y la base, la suya en PGlite).
 *
 * Lo que se afirma:
 *  - uno de Venezuela se edita sin almacén: no hay selector de almacén, el
 *    formulario no lo manda y, si tenía uno, el cajón avisa que se le quita;
 *  - uno de China lleva almacén obligatorio, y el que tiene hoy se conserva
 *    aunque ya no esté entre los activos;
 *  - los roles son los de SU región y salen de la prop (lo que dio la base): con
 *    otra lista el cajón ofrece esa otra; sin lista no deja guardar;
 *  - nada cambia en silencio: si su rol de hoy no es de su región, arranca sin
 *    rol y hay que elegir; si el rol cambia, el cajón lo dice; el nombre en
 *    chino de uno de Venezuela que lo tiene se ve (y viaja) para no borrarlo;
 *  - los rechazos de la base aparecen en su campo; al guardar, aviso y cierre.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import type { OperarioRolesPorRegion } from "@/lib/studio/operario-edicion";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const updateMock = vi.fn<(prev: State, fd: FormData) => Promise<State>>();

vi.mock("../actions", () => ({
  updateOperarioAction: (prev: State, fd: FormData) => updateMock(prev, fd),
}));

import { EditOperarioDrawer } from "./EditOperarioDrawer";

/** Lo que da operario_roles_por_region() (migr 0480). */
const ROLES: OperarioRolesPorRegion = {
  cn: ["operario", "supervisor"],
  ve: ["bodeguero", "camionero", "supervisor"],
};

const YIW = { id: "30000000-0000-4000-8000-000000000001", code: "YIW-A1", hub_name_es: "Yiwu", warehouse_name: null } as unknown as WarehouseCN;
const GZ = { id: "30000000-0000-4000-8000-000000000002", code: "GZ-B1", hub_name_es: "Guangzhou", warehouse_name: "Bodega B" } as unknown as WarehouseCN;

function operario(over: Partial<OperarioRow> = {}): OperarioRow {
  return {
    id: "50000000-0000-4000-8000-000000000529",
    tenant_id: "10000000-0000-4000-8000-000000000001",
    warehouse_id: null,
    region: "ve",
    display_name: "Luis Hernández",
    display_name_cn: null,
    role: "camionero",
    active: true,
    last_login_at: null,
    created_at: "2026-05-26T00:00:00Z",
    warehouse_code: null,
    warehouse_name_es: null,
    ...over,
  };
}

const ANA = operario({
  region: "cn", display_name: "Ana China", display_name_cn: "安娜", role: "operario",
  warehouse_id: YIW.id, warehouse_code: "YIW-A1", warehouse_name_es: "Yiwu",
});

function renderDrawer(op: OperarioRow, roles: OperarioRolesPorRegion | null = ROLES, warehouses = [YIW, GZ]) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <EditOperarioDrawer operario={op} warehouses={warehouses} rolesPorRegion={roles} onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose };
}

const rolSelect = () => screen.getByRole("combobox", { name: /^Rol/ });
const almacenSelect = () => screen.queryByRole("combobox", { name: /^Almacén de China/ });
const options = (select: HTMLElement) => within(select).getAllByRole("option").map((o) => o.textContent);
const guardar = () => screen.getByRole("button", { name: "Guardar cambios" });

function sent(call = 0): Record<string, string> {
  const fd = updateMock.mock.calls[call][1];
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}

beforeEach(() => {
  updateMock.mockReset();
  updateMock.mockResolvedValue({ ok: true });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("EditOperarioDrawer · un operario de Venezuela", () => {
  it("se edita sin almacén y con los roles de despacho; el formulario no manda almacén", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(operario());

    expect(screen.getByText("Venezuela · despacho")).toBeInTheDocument();
    expect(screen.getByText("dtdcargo.com/m/ve/login")).toBeInTheDocument();
    expect(almacenSelect()).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /中文/ })).not.toBeInTheDocument();
    expect(options(rolSelect())).toEqual(["Bodeguero", "Camionero", "Supervisor"]);
    expect(rolSelect()).toHaveValue("camionero");
    expect(guardar()).toBeEnabled();

    expect(screen.queryByText(/Vas a cambiar su rol/)).not.toBeInTheDocument();
    await user.selectOptions(rolSelect(), "Bodeguero");
    const aviso = screen.getByText(/Vas a cambiar su rol/);
    expect(aviso).toHaveTextContent("Vas a cambiar su rol de Camionero a Bodeguero.");
    expect(aviso).toHaveAttribute("role", "status");
    await user.click(guardar());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      operario_id: "50000000-0000-4000-8000-000000000529",
      display_name: "Luis Hernández",
      role: "bodeguero",
    });
    expect(await screen.findByText("Ficha de Luis Hernández guardada")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si tenía un almacén de China, avisa que al guardar se le quita y no lo manda", async () => {
    const user = userEvent.setup();
    renderDrawer(operario({ warehouse_id: YIW.id, warehouse_code: "YIW-A1" }));

    expect(almacenSelect()).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Tiene asignado el almacén YIW-A1. Al guardar se le quita: los operarios de Venezuela no llevan almacén.");
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent()).not.toHaveProperty("warehouse_id");
  });

  it("con el rol «operario» (que en Venezuela no sirve) arranca sin rol y no guarda hasta elegir uno", async () => {
    const user = userEvent.setup();
    renderDrawer(operario({ role: "operario" }));

    expect(rolSelect()).toHaveValue("");
    expect(options(rolSelect())).toEqual(["Elige un rol", "Bodeguero", "Camionero", "Supervisor"]);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Su rol de hoy, Operario, no es de un operario de Venezuela. Elige uno para guardar.");
    expect(guardar()).toBeDisabled();

    await user.selectOptions(rolSelect(), "Supervisor");
    expect(guardar()).toBeEnabled();
    expect(options(rolSelect())).toEqual(["Bodeguero", "Camionero", "Supervisor"]);
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent().role).toBe("supervisor");
  });

  it("si ya tiene nombre en chino, se ve y viaja: guardar no lo borra sin verlo", async () => {
    const user = userEvent.setup();
    renderDrawer(operario({ display_name_cn: "路易斯" }));

    expect(screen.getByRole("textbox", { name: /中文/ })).toHaveValue("路易斯");
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent().display_name_cn).toBe("路易斯");
  });

  it("guardar sin tocar nada manda el rol de hoy, no uno por defecto", async () => {
    const user = userEvent.setup();
    renderDrawer(operario());
    expect(screen.queryByText(/Vas a cambiar su rol/)).not.toBeInTheDocument();
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent().role).toBe("camionero");
  });
});

describe("EditOperarioDrawer · un operario de China", () => {
  it("lleva almacén obligatorio, nombre en chino y los roles de almacén", async () => {
    const user = userEvent.setup();
    renderDrawer(ANA);

    expect(screen.getByText("China · almacén")).toBeInTheDocument();
    expect(screen.getByText("dtdcargo.com/m/cn/login")).toBeInTheDocument();
    expect(almacenSelect()).toHaveValue(YIW.id);
    expect(almacenSelect()).toBeRequired();
    expect(options(almacenSelect()!)).toEqual(["YIW-A1 · Yiwu", "GZ-B1 · Guangzhou — Bodega B"]);
    expect(options(rolSelect())).toEqual(["Operario", "Supervisor"]);
    expect(screen.getByRole("textbox", { name: /中文/ })).toHaveValue("安娜");

    await user.selectOptions(almacenSelect()!, "GZ-B1 · Guangzhou — Bodega B");
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      operario_id: ANA.id,
      warehouse_id: GZ.id,
      display_name: "Ana China",
      display_name_cn: "安娜",
      role: "operario",
    });
  });

  it("conserva el almacén que tiene aunque ya no esté entre los activos", async () => {
    const user = userEvent.setup();
    const viejo = { ...ANA, warehouse_id: "30000000-0000-4000-8000-000000000099", warehouse_code: "SZ-C1", warehouse_name_es: "Shenzhen" };
    renderDrawer(viejo);

    expect(almacenSelect()).toHaveValue(viejo.warehouse_id);
    expect(options(almacenSelect()!)[0]).toBe("SZ-C1 · Shenzhen (inactivo)");
    await user.click(guardar());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(sent().warehouse_id).toBe(viejo.warehouse_id);
  });

  it("sin almacén no deja guardar hasta elegir uno", async () => {
    const user = userEvent.setup();
    renderDrawer({ ...ANA, warehouse_id: null, warehouse_code: null, warehouse_name_es: null });

    expect(almacenSelect()).toHaveValue("");
    expect(guardar()).toBeDisabled();
    await user.selectOptions(almacenSelect()!, "YIW-A1 · Yiwu");
    expect(guardar()).toBeEnabled();
  });

  it("un rol de despacho en China no se ofrece: hay que elegir uno de almacén", () => {
    renderDrawer({ ...ANA, role: "bodeguero" });
    expect(rolSelect()).toHaveValue("");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Su rol de hoy, Bodeguero, no es de un operario de China. Elige uno para guardar.");
    expect(guardar()).toBeDisabled();
  });
});

describe("EditOperarioDrawer · la lista de roles es la de la base", () => {
  it("con otra lista, el cajón ofrece esa otra: no tiene una propia", () => {
    renderDrawer(operario({ role: "camionero" }), { cn: ["supervisor"], ve: ["camionero"] });
    expect(options(rolSelect())).toEqual(["Camionero"]);
    cleanup();
    renderDrawer(ANA, { cn: ["supervisor"], ve: ["camionero"] });
    expect(options(rolSelect())).toEqual(["Elige un rol", "Supervisor"]);
  });

  it("sin la lista de la base no deja guardar y lo dice", () => {
    renderDrawer(operario(), null);
    expect(rolSelect()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los roles de cada región. Recarga la página para editar este operario.");
    expect(guardar()).toBeDisabled();
  });

  it("sin nombre no deja guardar", async () => {
    const user = userEvent.setup();
    renderDrawer(operario());
    await user.clear(screen.getByRole("textbox", { name: "Nombre *" }));
    expect(guardar()).toBeDisabled();
  });
});

describe("EditOperarioDrawer · los rechazos de la base", () => {
  it.each([
    ["role", "Ese rol no corresponde a la región del operario. Elige uno de la lista.", () => rolSelect()],
    ["display_name", "Ya hay un operario con ese nombre en ese almacén.", () => screen.getByRole("textbox", { name: "Nombre *" })],
    ["warehouse_id", "Elige el almacén de China del operario.", () => almacenSelect()!],
  ])("el de %s aparece en su campo y no cierra", async (field, message, input) => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue({ fieldErrors: { [field]: message } });
    const { onClose } = renderDrawer(field === "warehouse_id" ? ANA : operario());

    await user.click(guardar());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription(message);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("un error general va al aviso y no cierra", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue({ error: "No se pudo guardar: Operario no encontrado" });
    const { onClose } = renderDrawer(operario());

    await user.click(guardar());
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar: Operario no encontrado");
    expect(onClose).not.toHaveBeenCalled();
  });
});
