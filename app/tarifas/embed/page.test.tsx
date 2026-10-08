import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEnvioLCL, type CalcParams, type Ciudad } from "@/lib/calculadora";
import type { PublicCbmRate } from "@/lib/public/rates-queries";
import TarifasEmbedPage from "./page";

const mocks = vi.hoisted(() => ({ rate: vi.fn(), config: vi.fn(), cities: vi.fn(), tariffs: vi.fn(), destination: "acarigua" }));
vi.mock("@/lib/public/rates-queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/public/rates-queries")>(),
  getPublicCbmRate: mocks.rate, getPublicCalculatorConfig: mocks.config,
  getPublicCalculatorCities: mocks.cities, getPublicCarrierTariffs: mocks.tariffs,
}));
vi.mock("@/components/TarifasTabs", () => ({
  // La página RSC real entrega sus props al motor real; sólo se sustituye el form.
  TarifasTabs: ({ ciudades, serverRate, serverConfig }: { ciudades: Ciudad[]; serverRate: PublicCbmRate | null; serverConfig: CalcParams | null }) => {
    const quote = calcularEnvioLCL({
      cbmTotal: 1, pesoKg: 100, embalaje: "estandar", ciudadId: mocks.destination,
      tarifaCBMOverride: serverRate?.per_cbm, minChargeOverride: serverRate?.min_charge ?? undefined,
    }, serverConfig ?? undefined, ciudades);
    return <output aria-label="Resultado embebido">{JSON.stringify(quote)}</output>;
  },
}));

async function quote() {
  render(await TarifasEmbedPage({ searchParams: Promise.resolve({ theme: "dark" }) }));
  return JSON.parse(screen.getByLabelText("Resultado embebido").textContent!);
}

describe("TarifasEmbedPage · mismas fuentes públicas y motor de cálculo", () => {
  beforeEach(() => {
    mocks.destination = "acarigua";
    mocks.rate.mockReset(); mocks.rate.mockResolvedValue(null);
    mocks.config.mockReset(); mocks.config.mockResolvedValue(null);
    mocks.cities.mockReset(); mocks.cities.mockResolvedValue([{ id: "acarigua", label: "Acarigua", km: 175, casco: false }]);
    mocks.tariffs.mockReset(); mocks.tariffs.mockResolvedValue([]);
  });

  it("una ciudad excluida cobra tarifa vigente y piso terrestre recibidos por la página", async () => {
    mocks.rate.mockResolvedValue({ per_cbm: 900, min_charge: 50, valid_until: null });
    mocks.tariffs.mockResolvedValue([{ citySlug: "acarigua", priceUsdCbm: 150, minChargeUsd: 180, dispatchFrequencyDays: 3, transitDays: null }]);
    const result = await quote();
    expect(result.recargoCiudad).toBe(180);
    expect(result.total).toBe(1080);
    expect(mocks.tariffs).toHaveBeenCalledOnce();
  });

  it("sin tarifa persistida aplica el respaldo confirmado de Acarigua", async () => {
    const result = await quote();
    expect(result.recargoCiudad).toBe(123.6);
    expect(result.total).toBe(973.6);
  });

  it.each(["caracas", "valencia", "maracay", "barquisimeto", "guacara", "naguanagua", "san-diego"])("%s conserva recargo cero aunque viaje una tarifa de entrega", async (id) => {
    mocks.destination = id;
    mocks.cities.mockResolvedValue([{ id, label: id, km: 0, casco: true }]);
    mocks.tariffs.mockResolvedValue([{ citySlug: id, priceUsdCbm: 150, minChargeUsd: 180, dispatchFrequencyDays: 3, transitDays: null }]);
    const result = await quote();
    expect(result.recargoCiudad).toBe(0);
    expect(result.total).toBe(850);
  });

  it("sin catálogo persistido conserva el fallback completo y Acarigua con recargo", async () => {
    mocks.cities.mockResolvedValue([]);
    const result = await quote();
    expect(result.recargoCiudad).toBe(123.6);
    expect(result.total).toBe(973.6);
  });

  it("destino nuevo sin precio confirmado deriva al asesor", async () => {
    mocks.destination = "ciudad-nueva";
    mocks.cities.mockResolvedValue([{ id: "ciudad-nueva", label: "Ciudad nueva", km: 0, casco: false }]);
    const result = await quote();
    expect(result.total).toBe(0);
    expect(result.alerta?.tipo).toBe("ciudad_sin_tarifa");
  });

  it("conserva el tema oscuro de la página embebida", async () => {
    const { container } = render(await TarifasEmbedPage({ searchParams: Promise.resolve({ theme: "dark" }) }));
    expect(container.firstElementChild).toHaveAttribute("data-portal-theme", "dark");
  });
});
