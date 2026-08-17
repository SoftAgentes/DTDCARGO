/**
 * ActionMenu · SDD-0263 — el contrato de teclado de BTN-01 §7, prueba por prueba.
 *
 * Cada `it` nombra la regla que ejecuta. Las reglas 9 (posicionamiento sin
 * clipping) y 13 (objetivo táctil de 44 px) NO se prueban acá: jsdom no hace
 * layout ni tiene viewport real. Van al navegador o se declaran no verificables
 * en la spec — no se dan por buenas por omisión.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const alDuplicar = vi.fn();
const alArchivar = vi.fn();
const alEliminar = vi.fn();

function items(over: Partial<ActionMenuItem>[] = []): ActionMenuItem[] {
  void over;
  return [
    { key: "duplicar", label: "Duplicar", onSelect: alDuplicar },
    { key: "archivar", label: "Archivar", onSelect: alArchivar },
    { key: "sep", separator: true },
    {
      key: "eliminar",
      label: "Eliminar",
      role: "destructive",
      onSelect: alEliminar,
    },
  ];
}

function montar(props: Partial<React.ComponentProps<typeof ActionMenu>> = {}) {
  return render(
    <ActionMenu ariaLabel="Más acciones" items={items()} {...props} />,
  );
}

const trigger = () => screen.getByRole("button", { name: /más acciones/i });
const opciones = () => screen.getAllByRole("menuitem");

describe("ActionMenu · BTN-01 §7", () => {
  it("regla 1 · el panel es role=menu y las opciones role=menuitem", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(opciones()).toHaveLength(3); // el separador no cuenta
  });

  it("regla 1 · roving focus: las opciones no son paradas de tabulación", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());

    for (const o of opciones()) expect(o.getAttribute("tabindex")).toBe("-1");
  });

  it("regla 2 · ArrowDown y ArrowUp recorren, y dan la vuelta", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(opciones()[0]));

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(opciones()[1]);

    await user.keyboard("{ArrowDown}{ArrowDown}"); // 2 → 0, da la vuelta
    expect(document.activeElement).toBe(opciones()[0]);

    await user.keyboard("{ArrowUp}"); // 0 → última
    expect(document.activeElement).toBe(opciones()[2]);
  });

  it("regla 3 · Home y End saltan a los extremos", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(opciones()[2]);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(opciones()[0]);
  });

  it("regla 4 · Enter activa la opción enfocada", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await user.keyboard("{ArrowDown}{Enter}");

    expect(alArchivar).toHaveBeenCalledTimes(1);
    expect(alDuplicar).not.toHaveBeenCalled();
  });

  it("regla 5 · Escape cierra Y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger());
  });

  it("regla 6 · ArrowDown en el trigger abre y enfoca la PRIMERA", async () => {
    const user = userEvent.setup();
    montar();
    trigger().focus();
    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(document.activeElement).toBe(opciones()[0]));
  });

  it("regla 6 · ArrowUp en el trigger abre y enfoca la ÚLTIMA", async () => {
    const user = userEvent.setup();
    montar();
    trigger().focus();
    await user.keyboard("{ArrowUp}");

    await waitFor(() => {
      const lista = opciones();
      expect(document.activeElement).toBe(lista[lista.length - 1]);
    });
  });

  it("regla 7 · Tab cierra el menú sin ejecutar nada", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await user.tab();

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(alDuplicar).not.toHaveBeenCalled();
  });

  it("regla 8 · clic afuera cierra SIN ejecutar ninguna opción", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ActionMenu ariaLabel="Más acciones" items={items()} />
        <button type="button">afuera</button>
      </div>,
    );
    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "afuera" }));

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(alDuplicar).not.toHaveBeenCalled();
    expect(alArchivar).not.toHaveBeenCalled();
    expect(alEliminar).not.toHaveBeenCalled();
  });

  it("regla 10 · pasar el ratón por encima NO ejecuta", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await user.hover(opciones()[0]);
    await user.hover(opciones()[2]);

    expect(alDuplicar).not.toHaveBeenCalled();
    expect(alEliminar).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy(); // sigue abierto
  });

  it("regla 11 · no memoriza: reabrir siempre enfoca la primera, no la última usada", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(trigger());
    await user.keyboard("{End}{Enter}"); // usa la destructiva
    expect(alEliminar).toHaveBeenCalledTimes(1);

    await user.click(trigger()); // reabrir
    await waitFor(() => expect(document.activeElement).toBe(opciones()[0]));
  });

  it("una opción deshabilitada no ejecuta y muestra su motivo (BTN-01 §6)", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu
        ariaLabel="Más acciones"
        items={[
          {
            key: "fusionar",
            label: "Fusionar",
            disabled: true,
            disabledReason: "Selecciona dos fichas primero",
            onSelect: alDuplicar,
          },
          { key: "archivar", label: "Archivar", onSelect: alArchivar },
        ]}
      />,
    );
    await user.click(trigger());

    expect(screen.getByText("Selecciona dos fichas primero")).toBeTruthy();
    await user.click(screen.getByText("Fusionar"));
    expect(alDuplicar).not.toHaveBeenCalled();
  });

  it("las deshabilitadas se saltan al recorrer con flechas", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu
        ariaLabel="Más acciones"
        items={[
          { key: "a", label: "Primera", onSelect: alDuplicar },
          { key: "b", label: "Bloqueada", disabled: true, onSelect: alArchivar },
          { key: "c", label: "Tercera", onSelect: alEliminar },
        ]}
      />,
    );
    await user.click(trigger());
    await user.keyboard("{ArrowDown}");

    expect((document.activeElement as HTMLElement).textContent).toContain(
      "Tercera",
    );
  });

  it("ejecutar una opción cierra el menú y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(trigger());
    await user.click(screen.getByText("Duplicar"));

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(alDuplicar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger());
  });

  it("icon-only sin ariaLabel avisa en desarrollo (regla 12)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ActionMenu items={items()} />);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("ariaLabel"),
    );
    spy.mockRestore();
  });

  it("con `label` el trigger tiene nombre propio y no exige ariaLabel", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ActionMenu label="Acciones" items={items()} />);

    expect(screen.getByRole("button", { name: /acciones/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("ActionMenu · opciones que NAVEGAN (SDD-0266)", () => {
  const navItems: ActionMenuItem[] = [
    { key: "dup", label: "Posibles duplicados", href: "/studio/clientes/duplicados" },
    { key: "leg", label: "Códigos del legado", href: "/studio/clientes/migrar-legado" },
  ];

  it("una opción con `href` renderiza <a>, no <button> (BTN-01 §2)", async () => {
    const user = userEvent.setup();
    render(<ActionMenu ariaLabel="Mantenimiento" items={navItems} />);
    await user.click(screen.getByRole("button", { name: /mantenimiento/i }));

    const opcion = screen.getByRole("menuitem", { name: /posibles duplicados/i });
    expect(opcion.tagName).toBe("A");
    expect(opcion.getAttribute("href")).toBe("/studio/clientes/duplicados");
  });

  it("navegar NO devuelve el foco al trigger: la página se va con él", async () => {
    const user = userEvent.setup();
    render(<ActionMenu ariaLabel="Mantenimiento" items={navItems} />);
    const trigger = screen.getByRole("button", { name: /mantenimiento/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /códigos del legado/i }));

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).not.toBe(trigger);
  });

  it("las de navegación también se recorren con flechas", async () => {
    const user = userEvent.setup();
    render(<ActionMenu ariaLabel="Mantenimiento" items={navItems} />);
    await user.click(screen.getByRole("button", { name: /mantenimiento/i }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[0]),
    );
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[1]);
  });

  it("un `href` deshabilitado no navega: vuelve a <button> y no ejecuta", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu
        ariaLabel="Mantenimiento"
        items={[
          {
            key: "dup",
            label: "Posibles duplicados",
            href: "/studio/clientes/duplicados",
            disabled: true,
            disabledReason: "No hay candidatos por ahora",
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /mantenimiento/i }));

    const opcion = screen.getByRole("menuitem");
    expect(opcion.tagName).toBe("BUTTON");
    expect(opcion.getAttribute("href")).toBeNull();
    expect(screen.getByText("No hay candidatos por ahora")).toBeTruthy();
  });
});
