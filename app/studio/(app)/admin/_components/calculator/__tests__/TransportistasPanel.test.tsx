/**
 * SDD-0537 · Tarifario editable en Calculadora pública › Transportistas.
 *
 * Mide lo que hace la pantalla, no su texto: qué FormData recibe la acción al
 * editar, agregar y quitar; que el margen se recalcula al escribir; que un
 * error deja el panel abierto con lo escrito; que la confirmación de quitar
 * no llama a la acción si se cancela; y que un rol sin permiso no ve controles.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarrierTariff, FreightCarrier } from "@/lib/studio/freight-carriers/types";
import { TransportistasPanel } from "../TransportistasPanel";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  bulk: vi.fn(),
  setDefault: vi.fn(),
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
  toast: { success: vi.fn(), warning: vi.fn() },
}));
vi.mock("../../../carrier-actions", () => ({
  saveTariffAction: mocks.save,
  deleteTariffAction: mocks.remove,
  bulkUpdateTariffPricesAction: mocks.bulk,
  setDefaultCarrierAction: mocks.setDefault,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  usePathname: () => "/studio/admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => (key === "chrome.action.close" ? "Cerrar" : key) }));

const BENITO = "44444444-4444-4444-8444-444444444444";
const OTRO = "55555555-5555-4555-8555-555555555555";

const carrier = (id: string, name: string, isDefault: boolean): FreightCarrier => ({
  id, tenantId: "t", name, legalName: null, taxId: null, contact: null, notes: null,
  isDefault, active: true, createdAt: "2026-10-01", updatedAt: "2026-10-01",
});

const tarifa = (id: string, carrierId: string, citySlug: string, extra: Partial<CarrierTariff> = {}): CarrierTariff => ({
  id, tenantId: "t", carrierId, citySlug, costUsdCbm: 80, priceUsdCbm: 123.6,
  priceUsdFt3: 3.5, minChargeUsd: null, dispatchFrequencyDays: 7,
  departureFrequency: "1 vez por semana · lunes", transitDays: "24 a 72 horas",
  conditions: null, validFrom: null, validTo: null, createdAt: "2026-10-01", updatedAt: "2026-10-01",
  ...extra,
});

const CARRIERS = [carrier(BENITO, "Benito", true), carrier(OTRO, "Fletes Sur", false)];
const TARIFAS = [
  tarifa("t-valencia", BENITO, "valencia", { costUsdCbm: 70, priceUsdCbm: 105.94, priceUsdFt3: 3 }),
  tarifa("t-merida", BENITO, "merida", { dispatchFrequencyDays: 15, departureFrequency: "cada 15 días" }),
  tarifa("t-sur", OTRO, "maturin", { costUsdCbm: 90, priceUsdCbm: 140 }),
];
const CITIES = [
  { slug: "valencia", label: "Valencia" },
  { slug: "merida", label: "Mérida" },
  { slug: "coro", label: "Coro" },
  { slug: "maturin", label: "Maturín" },
];

function montar(props: Partial<Parameters<typeof TransportistasPanel>[0]> = {}) {
  return render(
    <TransportistasPanel carriers={CARRIERS} tariffs={TARIFAS} cities={CITIES} isAdmin {...props} />,
  );
}

const fila = (ciudad: string) => screen.getByRole("row", { name: new RegExp(ciudad) });
const dialogo = (nombre: string | RegExp) => screen.getByRole("dialog", { name: nombre });
const campo = (scope: HTMLElement, etiqueta: RegExp) => within(scope).getByLabelText(etiqueta);
const escribir = (input: HTMLElement, valor: string) => fireEvent.change(input, { target: { value: valor } });
const enviado = (): FormData => mocks.save.mock.calls.at(-1)![1] as FormData;

beforeEach(() => {
  for (const fn of [mocks.save, mocks.remove, mocks.bulk, mocks.setDefault, mocks.router.refresh, mocks.router.push, mocks.toast.success, mocks.toast.warning]) {
    fn.mockReset();
  }
});

describe("tarifario del transportista seleccionado", () => {
  it("muestra las ciudades del predeterminado con costo, venta, margen y su equivalente en ft³", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Tarifario de Benito" })).toBeVisible();
    const valencia = fila("Valencia");
    expect(within(valencia).getByText("$70,00")).toBeVisible();
    expect(within(valencia).getByText("$105,94")).toBeVisible();
    expect(within(valencia).getByText("$35,94")).toBeVisible();
    expect(within(valencia).getByText("$3,00")).toBeVisible();
    expect(within(fila("Mérida")).getByText("cada 15 días", { selector: "span" })).toBeVisible();
    expect(screen.queryByRole("row", { name: /Maturín/ })).toBeNull();
  });

  it("al escoger otro transportista muestra sólo sus rutas", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Fletes Sur/ }));
    expect(screen.getByRole("heading", { name: "Tarifario de Fletes Sur" })).toBeVisible();
    expect(fila("Maturín")).toBeVisible();
    expect(screen.queryByRole("row", { name: /Valencia/ })).toBeNull();
  });

  it("filtra por ciudad sin importar acentos ni mayúsculas", () => {
    montar();
    escribir(screen.getByRole("searchbox", { name: "Buscar ciudad en el tarifario" }), "MERIDA");
    expect(fila("Mérida")).toBeVisible();
    expect(screen.queryByRole("row", { name: /Valencia/ })).toBeNull();
    escribir(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/Ninguna ciudad de este tarifario coincide/)).toBeVisible();
  });

  it("sin permiso de admin no hay controles de edición", () => {
    montar({ isAdmin: false });
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Quitar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Agregar ciudad" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("editar una ciudad", () => {
  it("recalcula el margen al escribir y envía la fila exacta con los números nuevos", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(within(fila("Mérida")).getByRole("button", { name: "Editar Mérida" }));
    const panel = dialogo("Editar Mérida");
    const margen = within(panel).getByTestId("tariff-margin");
    expect(margen).toHaveTextContent("$43,60");

    escribir(campo(panel, /^Costo \/m³/), "130");
    expect(margen).toHaveTextContent("−$6,40");
    expect(within(panel).getByText(/DTD pone la diferencia/)).toBeVisible();
    escribir(campo(panel, /^Venta \/m³/), "150,25");
    expect(margen).toHaveTextContent("$20,25");
    escribir(campo(panel, /^Cada cuántos días sale/), "7");
    escribir(campo(panel, /^Días de salida/), "2 veces por semana · lunes y jueves");

    fireEvent.click(within(panel).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const data = enviado();
    expect(Object.fromEntries(data.entries())).toMatchObject({
      id: "t-merida",
      carrierId: BENITO,
      citySlug: "merida",
      costUsdCbm: "130",
      priceUsdCbm: "150.25",
      dispatchFrequencyDays: "7",
      departureFrequency: "2 veces por semana · lunes y jueves",
      transitDays: "24 a 72 horas",
    });
    expect(mocks.toast.success).toHaveBeenCalledWith("Tarifa de Mérida actualizada");
    expect(mocks.router.push).toHaveBeenCalledWith(
      "/studio/admin?section=calculadora&tab=transportistas&highlight=merida&hl-tone=success",
    );
  });

  it("ante un error conserva lo escrito, enfoca el aviso y permite reintentar", async () => {
    mocks.save.mockResolvedValueOnce({ error: "Esa ruta ya no está activa con este transportista." });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Valencia" }));
    const panel = dialogo("Editar Valencia");
    escribir(campo(panel, /^Venta \/m³/), "111");
    fireEvent.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    const alerta = await within(panel).findByRole("alert");
    expect(alerta).toHaveTextContent("Esa ruta ya no está activa");
    expect(alerta).toHaveFocus();
    expect(dialogo("Editar Valencia")).toBeVisible();
    expect(campo(panel, /^Venta \/m³/)).toHaveValue("111");
    expect(mocks.toast.success).not.toHaveBeenCalled();

    mocks.save.mockResolvedValueOnce({ ok: true });
    fireEvent.click(within(panel).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(enviado().get("priceUsdCbm")).toBe("111");
  });

  it("muestra los errores por campo del servidor", async () => {
    mocks.save.mockResolvedValueOnce({
      fieldErrors: { costUsdCbm: "No puede ser negativo.", dispatchFrequencyDays: "Días enteros, mayor que cero." },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Valencia" }));
    const panel = dialogo("Editar Valencia");
    fireEvent.click(within(panel).getByRole("button", { name: "Guardar cambios" }));
    expect(await within(panel).findByText("No puede ser negativo.")).toBeVisible();
    expect(within(panel).getByText("Días enteros, mayor que cero.")).toBeVisible();
    expect(dialogo("Editar Valencia")).toBeVisible();
  });

  it("avisa si la venta en ft³ de referencia quedó desfasada de la venta por m³", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Valencia" }));
    const panel = dialogo("Editar Valencia");
    expect(within(panel).queryByText(/Ya no coincide con la venta por m³/)).toBeNull();
    escribir(campo(panel, /^Venta \/m³/), "130");
    expect(within(panel).getByText(/Ya no coincide con la venta por m³/)).toBeVisible();
  });

  it("cancelar cierra sin llamar a la acción", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Valencia" }));
    escribir(campo(dialogo("Editar Valencia"), /^Costo \/m³/), "999");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(within(fila("Valencia")).getByText("$70,00")).toBeVisible();
  });
});

describe("agregar una ciudad", () => {
  it("sólo ofrece ciudades del catálogo que el transportista no tiene y envía la escogida", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar ciudad" }));
    const panel = dialogo("Agregar ciudad");
    const select = campo(panel, /^Ciudad/) as HTMLSelectElement;
    const opciones = Array.from(select.options).map((o) => o.textContent);
    expect(opciones).toEqual(["Escoge una ciudad…", "Coro", "Maturín"]);

    fireEvent.change(select, { target: { value: "coro" } });
    escribir(campo(panel, /^Costo \/m³/), "80");
    escribir(campo(panel, /^Venta \/m³/), "176,57");
    fireEvent.click(within(panel).getByRole("button", { name: "Agregar ciudad" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const data = enviado();
    expect(data.get("id")).toBeNull();
    expect(Object.fromEntries(data.entries())).toMatchObject({
      carrierId: BENITO,
      citySlug: "coro",
      costUsdCbm: "80",
      priceUsdCbm: "176.57",
    });
    expect(mocks.toast.success).toHaveBeenCalledWith("Coro agregada a Benito");
    expect(mocks.router.push).toHaveBeenCalledWith(
      "/studio/admin?section=calculadora&tab=transportistas&highlight=coro&hl-tone=warm",
    );
  });

  it("muestra el error de ciudad repetida que devuelve el servidor", async () => {
    mocks.save.mockResolvedValueOnce({
      fieldErrors: { citySlug: "Ya hay una tarifa viva para esa ciudad con este transportista." },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar ciudad" }));
    const panel = dialogo("Agregar ciudad");
    fireEvent.change(campo(panel, /^Ciudad/), { target: { value: "coro" } });
    escribir(campo(panel, /^Costo \/m³/), "80");
    escribir(campo(panel, /^Venta \/m³/), "120");
    fireEvent.click(within(panel).getByRole("button", { name: "Agregar ciudad" }));
    expect(await within(panel).findByText(/Ya hay una tarifa viva/)).toBeVisible();
  });

  it("con todas las ciudades cubiertas el botón queda deshabilitado", () => {
    montar({ cities: CITIES.filter((c) => c.slug !== "coro" && c.slug !== "maturin") });
    expect(screen.getByRole("button", { name: "+ Agregar ciudad" })).toBeDisabled();
  });
});

describe("quitar una ruta", () => {
  it("pide confirmación y cancelar no quita nada", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Mérida" }));
    const confirm = dialogo("Quitar la ruta a Mérida");
    expect(confirm).toHaveTextContent("La web no le dará precio a esa ciudad y derivará al asesor.");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("al confirmar quita la ruta exacta de ese transportista", async () => {
    mocks.remove.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Mérida" }));
    fireEvent.click(within(dialogo("Quitar la ruta a Mérida")).getByRole("button", { name: "Quitar ruta" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(mocks.remove).toHaveBeenCalledOnce();
    const data = mocks.remove.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data.entries())).toEqual({ id: "t-merida", carrierId: BENITO });
    expect(mocks.toast.success).toHaveBeenCalledWith("Ruta a Mérida quitada");
    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it("si falla, el error queda en el diálogo y se puede reintentar aunque el error se repita", async () => {
    // ConfirmDialog suelta su candado cuando CAMBIA `error`. Con el mismo texto
    // dos veces seguidas, sólo se suelta si el panel lo limpia antes de cada
    // intento: por eso son TRES intentos, el tercero es el que se trabaría.
    const msg = "Esa ruta ya no está activa con este transportista.";
    mocks.remove.mockResolvedValue({ error: msg });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Valencia" }));
    const confirm = dialogo("Quitar la ruta a Valencia");
    for (const intento of [1, 2, 3]) {
      await act(async () => {
        fireEvent.click(within(confirm).getByRole("button", { name: "Quitar ruta" }));
      });
      await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(intento));
      expect(await within(confirm).findByText(msg)).toBeVisible();
    }
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});

describe("cambio en lote", () => {
  const marcar = (ciudad: string) =>
    fireEvent.click(screen.getByRole("checkbox", { name: `Seleccionar ${ciudad}` }));
  const barra = () => screen.queryByRole("region", { name: "Selección para cambio en lote" });

  it("muestra el antes y el después con el margen, y envía sólo las elegidas", async () => {
    mocks.bulk.mockResolvedValue({ ok: true, updated: 2 });
    montar();
    expect(barra()).toBeNull();
    marcar("Valencia");
    marcar("Mérida");
    expect(barra()).toHaveTextContent("2 ciudades seleccionadas");
    fireEvent.click(within(barra()!).getByRole("button", { name: "Cambiar precios" }));

    const panel = dialogo("Cambiar precios en lote");
    const aplicar = within(panel).getByRole("button", { name: "Aplicar a 2 ciudades" });
    expect(aplicar).toBeDisabled();
    const previa = within(panel).getByRole("table", { name: "Antes y después" });
    expect(within(previa).getAllByRole("row")).toHaveLength(3);

    escribir(campo(panel, /^Costo nuevo/), "90");
    const valencia = within(previa).getByRole("row", { name: /Valencia/ });
    // Lo que lee un lector de pantalla: «$70,00 pasa a $90,00».
    expect(valencia).toHaveTextContent("$70,00 → pasa a $90,00");
    expect(valencia).toHaveTextContent("$35,94 → pasa a $15,94");
    // La venta no se tocó: sólo su valor, sin «pasa a».
    expect(valencia).toHaveTextContent("$90,00$105,94$35,94");
    expect(within(panel).queryByText(/quedaría/)).toBeNull();

    escribir(campo(panel, /^Venta nueva/), "85");
    expect(within(panel).getByText(/2 ciudades quedarían con la venta por debajo del costo/)).toBeVisible();
    expect(within(previa).getByRole("row", { name: /Mérida/ })).toHaveTextContent("$43,60 → pasa a −$5,00");

    fireEvent.click(aplicar);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const data = mocks.bulk.mock.calls[0][1] as FormData;
    expect(data.get("carrierId")).toBe(BENITO);
    // En el orden de la tabla (alfabético), no en el de los clics.
    expect(data.getAll("ids")).toEqual(["t-merida", "t-valencia"]);
    expect(data.get("costUsdCbm")).toBe("90");
    expect(data.get("priceUsdCbm")).toBe("85");
    expect(mocks.toast.success).toHaveBeenCalledOnce();
    expect(mocks.toast.success).toHaveBeenCalledWith("Precios actualizados en 2 ciudades de Benito");
    expect(barra()).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Seleccionar Valencia" })).not.toBeChecked();
  });

  it("si falla, el panel queda abierto con el error y la selección se conserva", async () => {
    mocks.bulk.mockResolvedValueOnce({
      error: "Alguna de las ciudades elegidas ya no está activa con este transportista. No se cambió ninguna.",
    });
    montar();
    marcar("Valencia");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar precios" }));
    const panel = dialogo("Cambiar precios en lote");
    escribir(campo(panel, /^Venta nueva/), "130");
    // Sólo la venta: el costo se muestra como estaba y el margen sale del costo vigente.
    const fila1 = within(within(panel).getByRole("table", { name: "Antes y después" })).getByRole("row", {
      name: /Valencia/,
    });
    expect(fila1).toHaveTextContent("Valencia$70,00$105,94 → pasa a $130,00$35,94 → pasa a $60,00");
    fireEvent.click(within(panel).getByRole("button", { name: "Aplicar a 1 ciudad" }));

    const alerta = await within(panel).findByRole("alert");
    expect(alerta).toHaveTextContent("No se cambió ninguna");
    expect(alerta).toHaveFocus();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Cancelar" }));
    expect(barra()).toHaveTextContent("1 ciudad seleccionada");
  });

  it("si el servidor cambió menos de las elegidas, el aviso dice cuántas", async () => {
    mocks.bulk.mockResolvedValue({ ok: true, updated: 1 });
    montar();
    marcar("Valencia");
    marcar("Mérida");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar precios" }));
    const panel = dialogo("Cambiar precios en lote");
    escribir(campo(panel, /^Costo nuevo/), "90");
    fireEvent.click(within(panel).getByRole("button", { name: "Aplicar a 2 ciudades" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.warning).toHaveBeenCalledWith(
      "Precios actualizados en 1 de 2 ciudades de Benito. Las demás ya no estaban activas.",
    );
  });

  it("la casilla del encabezado marca sólo las ciudades visibles por la búsqueda", () => {
    montar();
    escribir(screen.getByRole("searchbox"), "mer");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar todas las ciudades visibles" }));
    expect(barra()).toHaveTextContent("1 ciudad seleccionada");
    escribir(screen.getByRole("searchbox"), "");
    expect(screen.getByRole("checkbox", { name: "Seleccionar Mérida" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Seleccionar Valencia" })).not.toBeChecked();
  });

  it("cambiar de transportista limpia la selección", () => {
    montar();
    marcar("Valencia");
    fireEvent.click(screen.getByRole("button", { name: /Fletes Sur/ }));
    expect(barra()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Benito/ }));
    expect(screen.getByRole("checkbox", { name: "Seleccionar Valencia" })).not.toBeChecked();
  });
});
