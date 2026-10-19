/**
 * SDD-0560 · El asistente de borrado en pantalla.
 *
 * Lo que mide: el plan en orden con un solo paso habilitado; la confirmación
 * (con motivo si es R3) antes de ejecutar; que después de cada paso se pinta
 * el plan que devuelve el servidor; que si el plan cambió, el diálogo se cierra
 * y lo dice; y que un plan bloqueado no ofrece nada. Las acciones son dobles:
 * la regla la deciden el servidor y su plan (probados aparte).
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularPlan, type EntradaPlan, type PlanBorrado } from "@/lib/studio/borrado/asistente";

const m = vi.hoisted(() => ({ leer: vi.fn(), ejecutar: vi.fn() }));
vi.mock("../../actions", () => ({
  leerPlanDeBorradoAction: (...a: unknown[]) => m.leer(...a),
  ejecutarPasoDeBorradoAction: (...a: unknown[]) => m.ejecutar(...a),
}));

const { AsistenteBorrado } = await import("../AsistenteBorrado");

const S = "s-42";
const CODE = "S-2026-0042";

function plan(bloqueos: Record<string, number>, extra: Partial<EntradaPlan> = {}): PlanBorrado {
  return calcularPlan({
    embarque: { id: S, codigo: CODE },
    info: { bloqueos, avisos: {} },
    facturas: [],
    gastos: [],
    cxp: [],
    rutas: [],
    consolidaciones: [],
    recepciones: [],
    compras: [],
    ...extra,
  });
}
const FACTURA = { id: "f-7", codigo: "F-2026-0007", estado: "emitida", pagado: 0, asientoVivo: false };
const conFactura = () => plan({ invoices: 1 }, { facturas: [FACTURA] });
const soloEmbarque = () => plan({});

const onClose = vi.fn();
const onEliminado = vi.fn();

function abrir() {
  return render(<AsistenteBorrado shipmentId={S} shipmentCode={CODE} onClose={onClose} onEliminado={onEliminado} />);
}

/** El panel (drawer) es el primer diálogo; el de confirmación, el segundo. */
const panel = () => screen.getAllByRole("dialog")[0];
const pasos = () => within(panel()).getAllByRole("listitem").filter((li) => li.closest("ol"));

beforeEach(() => {
  vi.clearAllMocks();
  m.leer.mockResolvedValue({ ok: true, plan: conFactura() });
});
afterEach(cleanup);

describe("el plan en orden, un paso a la vez", () => {
  it("lee el plan al abrir y muestra los pasos numerados; sólo el primero tiene botón", async () => {
    abrir();
    expect(m.leer).toHaveBeenCalledWith(S);
    await waitFor(() => expect(pasos()).toHaveLength(2));

    const [primero, segundo] = pasos();
    expect(within(panel()).getByRole("heading", { name: "Faltan 2 pasos" })).toBeTruthy();
    expect(primero).toHaveAttribute("aria-current", "step");
    expect(primero.textContent).toContain("Paso 1");
    expect(primero.textContent).toContain("Anular la factura F-2026-0007");
    expect(primero.textContent).toContain("No se borra, porque es un documento fiscal");
    expect(within(primero).getByRole("button", { name: "Anular factura…" }).className).toContain("studio-btn-danger");

    expect(segundo).not.toHaveAttribute("aria-current");
    expect(segundo.textContent).toContain("Eliminar el embarque S-2026-0042");
    expect(within(segundo).queryByRole("button")).toBeNull();
    expect(segundo.textContent).toContain("Se habilita cuando termines el paso anterior.");
  });

  it("confirmar pide motivo (R3); sin motivo no ejecuta; foco inicial en Cancelar", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await within(panel()).findByRole("button", { name: "Anular factura…" }));
    const dialogo = screen.getAllByRole("dialog")[1];
    expect(within(dialogo).getByRole("heading").textContent).toBe("¿Anular la factura F-2026-0007?");
    expect(within(dialogo).getByLabelText("Motivo (obligatorio, sin datos personales)")).toBeRequired();
    await waitFor(() => expect(document.activeElement).toBe(within(dialogo).getByRole("button", { name: "Cancelar" })));

    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));
    expect(m.ejecutar).not.toHaveBeenCalled();
  });
});

describe("paso a paso hasta eliminar", () => {
  it("anula la factura, pinta el plan nuevo, y el último paso elimina el embarque", async () => {
    const user = userEvent.setup();
    m.ejecutar
      .mockResolvedValueOnce({ ok: true, hecho: "Factura F-2026-0007 anulada.", eliminado: false, plan: soloEmbarque() })
      .mockResolvedValueOnce({
        ok: true,
        hecho: "Embarque S-2026-0042 eliminado. Ya no aparece en Embarques, Tracking ni el Portal.",
        eliminado: true,
        plan: null,
      });
    abrir();

    // Paso 1: anular la factura.
    await user.click(await within(panel()).findByRole("button", { name: "Anular factura…" }));
    let dialogo = screen.getAllByRole("dialog")[1];
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));
    expect(m.ejecutar).toHaveBeenCalledWith(S, "anular_factura:f-7", "Embarque de prueba");

    // El plan se recalculó: ahora sólo falta el embarque, y queda el rastro.
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(within(panel()).getByRole("heading", { name: "Ya no queda nada que lo bloquee" })).toBeTruthy();
    expect(within(panel()).getByRole("status").textContent).toBe("Listo: Factura F-2026-0007 anulada.");
    expect(within(panel()).getByText("Ya hiciste")).toBeTruthy();

    // Paso 2: eliminar el embarque.
    await user.click(within(panel()).getByRole("button", { name: "Eliminar embarque…" }));
    dialogo = screen.getAllByRole("dialog")[1];
    expect(within(dialogo).getByRole("heading").textContent).toBe("¿Eliminar el embarque S-2026-0042?");
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar embarque" }));

    await waitFor(() =>
      expect(onEliminado).toHaveBeenCalledWith(
        "Embarque S-2026-0042 eliminado. Ya no aparece en Embarques, Tracking ni el Portal.",
      ),
    );
    expect(m.ejecutar).toHaveBeenLastCalledWith(S, `eliminar_embarque:${S}`, "Embarque de prueba");
  });

  it("el borrador de factura (R2) se confirma sin motivo", async () => {
    const user = userEvent.setup();
    m.leer.mockResolvedValue({ ok: true, plan: plan({ invoices: 1 }, { facturas: [{ ...FACTURA, estado: "borrador" }] }) });
    m.ejecutar.mockResolvedValue({ ok: true, hecho: "Factura en borrador F-2026-0007 eliminada.", eliminado: false, plan: soloEmbarque() });
    abrir();
    await user.click(await within(panel()).findByRole("button", { name: "Eliminar borrador…" }));
    const dialogo = screen.getAllByRole("dialog")[1];
    expect(within(dialogo).queryByLabelText(/Motivo/)).toBeNull();
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar borrador" }));
    expect(m.ejecutar).toHaveBeenCalledWith(S, "eliminar_borrador_factura:f-7", "");
  });
});

describe("recálculo: dos personas a la vez", () => {
  it("si el plan cambió, el diálogo se cierra, lo dice y muestra el plan nuevo", async () => {
    const user = userEvent.setup();
    const cambio =
      "El plan cambió mientras lo revisabas: alguien más resolvió o agregó algo. Revisa el paso siguiente antes de seguir.";
    m.ejecutar.mockResolvedValue({ ok: false, error: cambio, plan: soloEmbarque() });
    abrir();
    await user.click(await within(panel()).findByRole("button", { name: "Anular factura…" }));
    const dialogo = screen.getAllByRole("dialog")[1];
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));

    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(within(panel()).getByRole("alert").textContent).toBe(cambio);
    expect(pasos()).toHaveLength(1);
    expect(pasos()[0].textContent).toContain("Eliminar el embarque S-2026-0042");
    // Nada se dio por hecho.
    expect(within(panel()).queryByText("Ya hiciste")).toBeNull();
  });

  it("si el paso sigue siendo el siguiente, el error queda en el diálogo y se reintenta", async () => {
    const user = userEvent.setup();
    m.ejecutar
      .mockResolvedValueOnce({ ok: false, error: "No se pudo anular la factura.", plan: conFactura() })
      .mockResolvedValueOnce({ ok: true, hecho: "Factura F-2026-0007 anulada.", eliminado: false, plan: soloEmbarque() });
    abrir();
    await user.click(await within(panel()).findByRole("button", { name: "Anular factura…" }));
    const dialogo = screen.getAllByRole("dialog")[1];
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));
    await waitFor(() => expect(within(dialogo).getByRole("alert").textContent).toBe("No se pudo anular la factura."));
    expect(screen.getAllByRole("dialog")[1]).toBe(dialogo);

    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));
    await waitFor(() => expect(m.ejecutar).toHaveBeenCalledTimes(2));
  });

  it("si la acción no responde, no da nada por hecho", async () => {
    const user = userEvent.setup();
    m.ejecutar.mockRejectedValue(new Error("red caída"));
    abrir();
    await user.click(await within(panel()).findByRole("button", { name: "Anular factura…" }));
    const dialogo = screen.getAllByRole("dialog")[1];
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Anular factura" }));
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert").textContent).toBe(
        "No se pudo confirmar el paso. Vuelve a revisar el plan para ver cómo quedó.",
      ),
    );
    expect(onEliminado).not.toHaveBeenCalled();
  });
});

describe("lo que el asistente no resuelve", () => {
  it("bloqueado: explica qué lo impide y no ofrece ningún paso", async () => {
    m.leer.mockResolvedValue({ ok: true, plan: plan({ client_claims: 1, invoices: 1 }, { facturas: [FACTURA] }) });
    abrir();
    expect(await within(panel()).findByRole("heading", { name: "No se puede eliminar por ahora" })).toBeTruthy();
    expect(panel().textContent).toContain("Un reclamo es evidencia");
    expect(panel().textContent).toContain("no tendría sentido anular una factura");
    expect(within(panel()).queryByRole("button", { name: /Anular|Eliminar/ })).toBeNull();
    const enlace = within(panel()).getByRole("link", { name: /Ver en Reclamos/ });
    expect(enlace).toHaveAttribute("href", "/studio/reclamos");
  });

  it("asiento vivo (B1): bloqueado, con el porqué", async () => {
    m.leer.mockResolvedValue({ ok: true, plan: plan({ invoices: 1 }, { facturas: [{ ...FACTURA, asientoVivo: true }] }) });
    abrir();
    expect(await within(panel()).findByText("La factura F-2026-0007 tiene su asiento de venta vivo")).toBeTruthy();
    expect(within(panel()).queryByRole("button", { name: "Anular factura…" })).toBeNull();
  });

  it("un paso de otro módulo: abre el módulo en otra pestaña y revisa de nuevo al volver", async () => {
    const user = userEvent.setup();
    const enTms = plan({ tms_routes: 1, invoices: 1 }, { rutas: [{ id: "r-1", codigo: "R-2026-0001", estado: "planificado" }], facturas: [FACTURA] });
    m.leer.mockResolvedValueOnce({ ok: true, plan: enTms }).mockResolvedValueOnce({ ok: true, plan: conFactura() });
    abrir();
    const actual = await within(panel()).findByRole("link", { name: "Abrir TMS (se abre en otra pestaña)" });
    expect(actual).toHaveAttribute("href", "/studio/tms");
    expect(actual).toHaveAttribute("target", "_blank");
    expect(actual.getAttribute("rel")).toContain("noopener");
    // El paso del asistente espera: primero lo de TMS.
    expect(within(panel()).queryByRole("button", { name: "Anular factura…" })).toBeNull();

    await user.click(within(panel()).getByRole("button", { name: "Ya lo hice: revisar de nuevo" }));
    expect(await within(panel()).findByRole("button", { name: "Anular factura…" })).toBeTruthy();
    expect(m.leer).toHaveBeenCalledTimes(2);
    expect(m.ejecutar).not.toHaveBeenCalled();
  });

  it("si no se pudo leer el plan, lo dice y deja volver a intentar", async () => {
    m.leer.mockResolvedValueOnce({ ok: false, error: "No tienes permiso para realizar esta acción." });
    abrir();
    expect(await within(panel()).findByText("No tienes permiso para realizar esta acción.")).toBeTruthy();
    expect(within(panel()).getByRole("button", { name: "Volver a revisar" })).toBeTruthy();
  });
});

describe("los textos", () => {
  it("tuteo, sin voseo", async () => {
    abrir();
    await waitFor(() => expect(pasos()).toHaveLength(2));
    expect(panel().textContent ?? "").not.toMatch(
      /(?<!\p{L})(elegí|confirmá|escribí|podés|tenés|anulá|cancelá|revisá|volvé|eliminá|abrí)(?!\p{L})/u,
    );
  });

  it("Cerrar (la X del encabezado y el del pie) cierra el panel", async () => {
    const user = userEvent.setup();
    abrir();
    await waitFor(() => expect(pasos()).toHaveLength(2));
    const cerrar = within(panel()).getAllByRole("button", { name: "Cerrar" });
    expect(cerrar).toHaveLength(2);
    await user.click(cerrar[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
