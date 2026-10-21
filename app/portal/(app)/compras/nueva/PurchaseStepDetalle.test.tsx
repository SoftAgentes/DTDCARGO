/**
 * SDD-0313 · El paso 2 deja de perder trabajo y deja de ser un callejón.
 *
 * Dos defectos distintos, misma raíz (SGE-00.02 · no perder trabajo en silencio):
 *
 *  1. "Lo lleno después" era un `type="button"` que sólo cambiaba de fase: el
 *     form nunca se enviaba y TODO lo escrito y adjuntado se perdía sin avisar.
 *  2. El paso 2 sólo existía en el render del alta. Si el cliente recargaba, la
 *     compra quedaba con la descripción de relleno y no había forma de volver.
 *     Ahora tiene ruta propia (`modo="suelto"`), y esa pantalla DEBE precargar:
 *     la action cae a "Pendiente…" y `boxes = 1` con los campos vacíos, así que
 *     servirla en blanco pisaría lo que el cliente ya tenía.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrealertaActionState } from "@/lib/studio/prealertas/types";
import { PREALERTA_DESCRIPCION_PENDIENTE } from "@/lib/studio/prealertas/types";

const mocks = vi.hoisted(() => ({
  updatePrealertaDetalleAction: vi.fn(
    async (_prev: PrealertaActionState, _fd: FormData) =>
      ({}) as PrealertaActionState,
  ),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("../../proveedores/actions", () => ({
  updatePrealertaDetalleAction: mocks.updatePrealertaDetalleAction,
}));

const { PurchaseStepDetalle } = await import("./PurchaseStepDetalle");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const CODE = "DTD-1004-1-1";

const saltar = () =>
  screen.queryByRole("button", { name: /lo lleno después/i });
const descripcion = () => screen.getByLabelText(/descripción de la compra/i);

/**
 * SDD-0473 · Cablear la importación no puede cambiar esta pantalla.
 *
 * El panel de carga se monta arriba del formulario, pero mientras
 * `DOCUMENT_IMPORT_ENABLED` no esté encendido no debe existir para el cliente:
 * ni encabezado, ni zona de carga, ni un hueco donde antes no había nada.
 */
describe("PurchaseStepDetalle · SDD-0473 · la importación apagada no se nota", () => {
  it("con importación disponible ofrece una sola carga documental y conserva las fotos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ available: true, portal: true, formats: ["pdf"], maxBytes: 15728640 })));
    render(<PurchaseStepDetalle code={CODE} onDone={vi.fn()} />);
    await screen.findByRole("heading", { name: /carga tus documentos/i });
    expect(screen.queryByLabelText(/packing list/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/factura del proveedor/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/fotos del producto/i)).toBeInTheDocument();
    expect(screen.getByText(/carga la factura y el packing list una sola vez/i)).toBeInTheDocument();
  });

  it("conserva el adjunto manual elegido mientras se consultaba la disponibilidad", async () => {
    let responder!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>((resolve) => { responder = resolve; }));
    render(<PurchaseStepDetalle code={CODE} onDone={vi.fn()} />);
    const input = screen.getByLabelText(/packing list/i) as HTMLInputElement;
    const archivo = new File(["documento"], "packing.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [archivo] } });
    responder(new Response(JSON.stringify({ available: true, portal: true, formats: ["pdf"], maxBytes: 15728640 })));
    await screen.findByRole("heading", { name: /carga tus documentos/i });
    expect(input).toBeInTheDocument();
    expect(input.files?.[0]).toBe(archivo);
    expect(saltar()).not.toBeInTheDocument();
  });

  it("no muestra nada de la carga de documentos cuando la función no está disponible", async () => {
    // Sin servidor que responda `capabilities`, el envoltorio se calla.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sin servicio"));
    render(
      <PurchaseStepDetalle code={CODE} onDone={vi.fn()} onProgress={vi.fn()} />,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(
      screen.queryByRole("heading", { name: /carga tus documentos/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/elige tus archivos/i)).not.toBeInTheDocument();
    // Y el formulario manual sigue entero.
    expect(descripcion()).toBeInTheDocument();
    expect(saltar()).toBeInTheDocument();
  });
});

describe("PurchaseStepDetalle · SDD-0313 · asistente: no se pierde lo escrito", () => {
  it("sin nada escrito, el atajo para saltar existe", () => {
    render(
      <PurchaseStepDetalle code={CODE} onDone={vi.fn()} onProgress={vi.fn()} />,
    );
    expect(saltar()).toBeInTheDocument();
  });

  it("🔴 al escribir algo, el atajo que lo descartaba DESAPARECE", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseStepDetalle code={CODE} onDone={vi.fn()} onProgress={vi.fn()} />,
    );

    await user.type(descripcion(), "3 cajas de zapatos");

    // Lo que este test impide que vuelva: un botón que tira lo recién escrito.
    expect(saltar()).not.toBeInTheDocument();
    expect(screen.getByText(/se guarda al avanzar/i)).toBeInTheDocument();
  });

  it("saltar sin haber escrito nada NO envía el formulario", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <PurchaseStepDetalle code={CODE} onDone={onDone} onProgress={vi.fn()} />,
    );

    await user.click(saltar()!);

    expect(onDone).toHaveBeenCalled();
    expect(mocks.updatePrealertaDetalleAction).not.toHaveBeenCalled();
  });
});

describe("PurchaseStepDetalle · SDD-0313 · suelto: se puede completar después", () => {
  const guardado = {
    description: "6 cajas de lámparas LED",
    boxes: 6,
    estValueUsd: 820.5,
    trackingCn: "SF1234567890",
  };

  it("🔴 precarga lo ya guardado (si no, guardar lo pisaría)", () => {
    render(<PurchaseStepDetalle code={CODE} modo="suelto" guardado={guardado} />);

    expect(descripcion()).toHaveValue("6 cajas de lámparas LED");
    expect(screen.getByLabelText(/total de cajas/i)).toHaveValue(6);
    expect(screen.getByLabelText(/valor estimado/i)).toHaveValue(820.5);
    expect(screen.getByLabelText(/tracking china/i)).toHaveValue("SF1234567890");
  });

  it("la descripción de relleno del servidor NO se muestra como texto del cliente", () => {
    render(
      <PurchaseStepDetalle
        code={CODE}
        modo="suelto"
        guardado={{
          description: PREALERTA_DESCRIPCION_PENDIENTE,
          boxes: null,
          estValueUsd: null,
          trackingCn: null,
        }}
      />,
    );

    // "Pendiente — el cliente la completa" es relleno, no algo que él escribió.
    expect(descripcion()).toHaveValue("");
  });

  it("no muestra la barra de 3 pasos: acá no hay asistente", () => {
    render(<PurchaseStepDetalle code={CODE} modo="suelto" guardado={guardado} />);

    expect(
      screen.queryByRole("list", { name: /pasos para registrar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^guardar el detalle$/i }),
    ).toBeInTheDocument();
  });

  it("ofrece volver a la compra sin guardar", () => {
    render(<PurchaseStepDetalle code={CODE} modo="suelto" guardado={guardado} />);

    const volver = screen.getByRole("link", { name: /volver a la compra/i });
    expect(volver).toHaveAttribute(
      "href",
      `/portal/compras/${encodeURIComponent(CODE)}`,
    );
  });

  it("funciona sin `onDone` ni `onProgress` (el asistente ya no está)", () => {
    // Antes eran obligatorios y el componente reventaba fuera del asistente.
    expect(() =>
      render(<PurchaseStepDetalle code={CODE} modo="suelto" guardado={guardado} />),
    ).not.toThrow();
  });
});
