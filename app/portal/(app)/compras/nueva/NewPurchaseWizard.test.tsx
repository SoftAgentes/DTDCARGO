/**
 * SDD-0313 · El paso 1 de "Nueva compra" tiene que decir qué falta — y el alta
 * de proveedor tiene que poder correr.
 *
 * Este flujo llegó a producción **sin un solo test que montara un componente**,
 * y en ese hueco vivió el bug que generó el reclamo del 2026-08-27: la ficha de
 * proveedor nuevo era un `<form>` DENTRO del `<form>` del paso 1, React no
 * despachaba nunca su acción, y "Guardar proveedor" no hacía absolutamente nada.
 * El test `no anida formularios` es el que lo habría cazado.
 *
 * ⚠️ VALIDADO CON MUTACIÓN, y con un límite medido que conviene saber: al
 * reintroducir el `<form>` anidado, el que se pone rojo es SÓLO el test de
 * anidación. El de "Guardar proveedor SÍ ejecuta la acción" **sigue verde con
 * el bug puesto**, porque jsdom no reproduce el fallo real del navegador (React
 * dejando que el navegador navegue a su URL centinela, que la CSP bloquea).
 * O sea: el guardián de esa regresión es la aserción estructural, no la de
 * comportamiento. Si alguien borra el test de anidación por "redundante", el
 * bug vuelve a pasar sin que nada se ponga rojo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  SupplierView,
  PrealertaActionState,
  SupplierActionState,
} from "@/lib/studio/prealertas/types";
import { PREALERTA_ADDON_DEFAULTS } from "@/lib/studio/prealertas/addons";

// Las firmas van explícitas: sin ellas el mock infiere CERO parámetros y
// `mock.calls[0][1]` (el FormData) no existe para TypeScript.
const mocks = vi.hoisted(() => ({
  createPrealertaAction: vi.fn(
    async (_prev: PrealertaActionState, _fd: FormData) =>
      ({}) as PrealertaActionState,
  ),
  createSupplierAction: vi.fn(
    async (_prev: SupplierActionState, _fd: FormData) =>
      ({}) as SupplierActionState,
  ),
}));

vi.mock("../../proveedores/actions", () => ({
  createPrealertaAction: mocks.createPrealertaAction,
  createSupplierAction: mocks.createSupplierAction,
}));

const { NewPurchaseWizard } = await import("./NewPurchaseWizard");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PROVEEDOR: SupplierView = {
  id: "sup-1",
  supplierSeq: 1,
  name: "Yiwu Rainbow Trading",
  wechat: "rainbow_yw",
  city: "Yiwu",
  contact: "Lucy",
  notes: null,
  orderCount: 3,
  nextCode: "DTD-1004-1-4",
};

function montar(suppliers: SupplierView[] = [PROVEEDOR]) {
  return render(
    <NewPurchaseWizard
      suppliers={suppliers}
      addons={[...PREALERTA_ADDON_DEFAULTS]}
      preselected={null}
    />,
  );
}

const botonRegistrar = () =>
  screen.getByRole("button", { name: /registrar compra/i });
// `combobox`, no `textbox`: el rol explícito del patrón APG reemplaza al
// implícito. Que este selector tenga que nombrarlo así ES la prueba de que el
// combobox se anuncia como tal (A11Y-01).
const buscador = () =>
  screen.getByRole("combobox", { name: /^Proveedor$/i });
const opcionCrear = () => screen.getByRole("option", { name: /\+ Crear/i });

describe("NewPurchaseWizard · SDD-0313 · el paso 1 dice qué falta", () => {
  it("sin proveedor, el botón está apagado y la ayuda nombra el paso que falta", () => {
    montar();

    expect(botonRegistrar()).toBeDisabled();
    // BTN-01 §6: la explicación tiene que estar ASOCIADA al botón, no suelta.
    const ayudaId = botonRegistrar().getAttribute("aria-describedby");
    expect(ayudaId).toBeTruthy();
    expect(document.getElementById(ayudaId!)).toHaveTextContent(
      /elige tu proveedor de la lista/i,
    );
  });

  it("escribir el nombre EXACTO ya elige y habilita el botón (Norte `existingSel`)", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), PROVEEDOR.name);

    expect(botonRegistrar()).toBeEnabled();
  });

  it("escribir sin elegir avisa JUNTO AL CAMPO que todavía falta elegirlo", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), "Yiwu Rain");

    expect(botonRegistrar()).toBeDisabled();
    expect(screen.getByText(/todavía no lo eliges/i)).toBeInTheDocument();
  });

  it("con la ficha del proveedor nuevo abierta, la ayuda pide GUARDARLO", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), "Fabrica Nueva Shenzhen");
    await user.click(opcionCrear());

    const ayudaId = botonRegistrar().getAttribute("aria-describedby");
    const ayuda = document.getElementById(ayudaId!);
    // Lo que produjo el reclamo: le decía "Escribe…" a quien ya había escrito.
    expect(ayuda).not.toHaveTextContent(/escribe o elige/i);
    expect(ayuda).toHaveTextContent(/guardar proveedor/i);
    expect(ayuda).toHaveTextContent(/Fabrica Nueva Shenzhen/);
  });

  it("mientras el botón esté apagado hay UNA sola instrucción visible", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), "Fabrica Nueva Shenzhen");
    await user.click(opcionCrear());

    // Con la ficha abierta, el aviso de "escribiste pero no eliges" se retira:
    // dos instrucciones simultáneas compiten y el cliente no sabe cuál seguir.
    expect(screen.queryByText(/todavía no lo eliges/i)).not.toBeInTheDocument();
  });

  it("🔴 el asistente NO anida formularios (el bug que rompía el alta)", async () => {
    const user = userEvent.setup();
    const { container } = montar();

    await user.type(buscador(), "Fabrica Nueva Shenzhen");
    await user.click(opcionCrear());

    // Anidar <form> es HTML inválido Y hace que React nunca despache la acción
    // del formulario interno: "Guardar proveedor" quedaba muerto.
    const anidados = [...container.querySelectorAll("form")].filter((f) =>
      f.parentElement?.closest("form"),
    );
    expect(anidados).toHaveLength(0);
  });

  it("🔴 'Guardar proveedor' SÍ ejecuta la acción estando dentro del asistente", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), "Fabrica Nueva Shenzhen");
    await user.click(opcionCrear());
    await user.click(screen.getByRole("button", { name: /guardar proveedor/i }));

    expect(mocks.createSupplierAction).toHaveBeenCalled();
    // Y con el nombre escrito, no con un FormData vacío — el recolector manual
    // es justo lo que se rompería en silencio si alguien renombra un campo.
    const fd = mocks.createSupplierAction.mock.calls[0][1];
    expect(fd.get("name")).toBe("Fabrica Nueva Shenzhen");
  });

  // ── A11Y-01 · el combobox tiene que servir SIN ratón ──────────────────
  // Antes las opciones se activaban con `onMouseDown`, que el teclado no
  // despacha, y sólo se manejaba Enter: quien navega con teclado o lector de
  // pantalla NO podía elegir proveedor, así que el botón no se le habilitaba
  // nunca. Es la misma queja del reclamo por otra puerta.

  it("🔴 con SOLO el teclado se elige un proveedor y el botón se habilita", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(buscador());
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(botonRegistrar()).toBeEnabled();
    expect(buscador()).toHaveValue(PROVEEDOR.name);
  });

  it("🔴 con SOLO el teclado se llega a «+ Crear» y se abre la ficha", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(buscador(), "Fabrica Nueva Shenzhen");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("button", { name: /guardar proveedor/i }),
    ).toBeInTheDocument();
  });

  it("anuncia el estado del combobox: expandido y opción activa", async () => {
    const user = userEvent.setup();
    montar();

    expect(buscador()).toHaveAttribute("aria-expanded", "false");
    expect(buscador()).not.toHaveAttribute("aria-activedescendant");

    await user.click(buscador());
    expect(buscador()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");
    // La opción activa se comunica por id, que es lo que lee el lector.
    const activo = buscador().getAttribute("aria-activedescendant");
    expect(activo).toBeTruthy();
    expect(document.getElementById(activo!)).toHaveAttribute("role", "option");
  });

  it("Escape cierra la lista sin elegir nada", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(buscador());
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Escape}");

    expect(buscador()).toHaveAttribute("aria-expanded", "false");
    expect(botonRegistrar()).toBeDisabled();
  });

  it("el campo y su etiqueta están asociados (label ↔ input)", () => {
    montar();
    // Antes `FieldLabel` no tenía `htmlFor` y el input no tenía `id`: tocar la
    // etiqueta no enfocaba el campo y el lector no la anunciaba con él.
    expect(screen.getByLabelText(/^Proveedor$/i)).toBe(buscador());
  });

  it("el panel 'en vivo' NO afirma una orden que no existe (Norte `provOk`)", async () => {
    const user = userEvent.setup();
    montar();

    // Sin proveedor no debe haber panel: mostraba "de mi proveedor mi proveedor"
    // junto a un botón apagado — estado falso (SGE-00.07).
    expect(screen.queryByText(/así queda tu orden/i)).not.toBeInTheDocument();

    await user.type(buscador(), PROVEEDOR.name);

    expect(screen.getByText(/así queda tu orden/i)).toBeInTheDocument();
  });
});
