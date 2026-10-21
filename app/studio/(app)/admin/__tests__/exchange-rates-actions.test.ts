/**
 * SDD-0569 · Admin › Tasas registra por la RPC `registrar_tasa_de_cambio` (0495).
 *
 * Solo los mensajes propios de la 0495 (hint `dtd-fx`) llegan a la pantalla; un
 * error cualquiera de la base se cambia por uno genérico (ERR-01).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
let denial: string | null = null;
const moduloPedido: string[] = [];
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: vi.fn(async (_s: unknown, modulo: string) => {
    moduloPedido.push(modulo);
    return denial;
  }),
}));

let llamadas: { rpc: string; args: Record<string, unknown> }[] = [];
let respuesta: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      llamadas.push({ rpc, args });
      return respuesta;
    },
    from: (table: string) => {
      throw new Error(`escritura directa inesperada en ${table}`);
    },
  }),
}));

const { recordExchangeRateAction } = await import("../exchange-rates-actions");

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

const TASA = { pair: "CNY/USD", rate: "7.18", valid_on: "2026-10-20", note: "cotización del banco" };

beforeEach(() => {
  llamadas = [];
  respuesta = { data: null, error: null };
  denial = null;
  moduloPedido.length = 0;
});

describe("recordExchangeRateAction", () => {
  it("registra por la RPC con la moneda, la tasa, la fecha y la nota", async () => {
    expect(await recordExchangeRateAction({}, form(TASA))).toEqual({ ok: true });
    expect(llamadas).toEqual([
      {
        rpc: "registrar_tasa_de_cambio",
        args: { p_currency: "CNY", p_rate: 7.18, p_valid_on: "2026-10-20", p_note: "cotización del banco" },
      },
    ]);
  });

  it("muestra el mensaje propio de la 0495 (hint dtd-fx)", async () => {
    respuesta = {
      data: null,
      error: { code: "22023", message: "La fecha de la tasa no puede ser posterior a hoy.", hint: "dtd-fx" },
    };
    expect(await recordExchangeRateAction({}, form(TASA))).toEqual({ error: "La fecha de la tasa no puede ser posterior a hoy." });
  });

  it("un error de la base sin el hint no se muestra tal cual", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    respuesta = { data: null, error: { code: "PGRST202", message: "Could not find the function", hint: null } };
    expect(await recordExchangeRateAction({}, form(TASA))).toEqual({
      error: "No se pudo guardar la tasa. Intenta de nuevo.",
    });
  });

  it("la contadora puede cargar tasas: la acción pide el módulo de Contabilidad (admin y accounting), como la RPC (revisión, NO VERIFICADO)", async () => {
    await recordExchangeRateAction({}, form(TASA));
    expect(moduloPedido).toEqual(["accounting"]);
  });

  it("sin permiso de edición, ni valida ni llama a la base", async () => {
    denial = "No tienes permiso para editar Admin.";
    expect(await recordExchangeRateAction({}, form(TASA))).toEqual({ error: "No tienes permiso para editar Admin." });
    expect(llamadas).toHaveLength(0);
  });

  it("sin fecha no llama a la base", async () => {
    expect(await recordExchangeRateAction({}, form({ pair: "VES/USD", rate: "36.5" }))).toEqual({
      error: "Indica la fecha de la tasa.",
    });
    expect(llamadas).toHaveLength(0);
  });
});
