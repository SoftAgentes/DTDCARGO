// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0478 · el contrato que deja desplegar el Studio antes que la migr 0459:
 * sin la marca `publica_programada_control` (el drawer sólo la manda cuando la
 * ranura existe), createRate/updateRate NO nombran la columna. Si la nombraran,
 * PostgREST rechazaría el guardado entero de cualquier tarifa.
 */

const insert = vi.fn();
const update = vi.fn();
let rateError: { code?: string; message?: string } | null = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));
vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "user_tenants") {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { tenant_id: "t1" }, error: null }),
          }),
        };
      }
      return {
        insert: (payload: unknown) => {
          insert(payload);
          return {
            select: () => ({
              single: async () =>
                rateError ? { data: null, error: rateError } : { data: { id: "nueva" }, error: null },
            }),
          };
        },
        update: (payload: unknown) => {
          update(payload);
          return { eq: async () => ({ error: rateError }) };
        },
      };
    },
  })),
}));

import { createRate, updateRate } from "./actions";

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    service: "puerta_a_puerta_DDP",
    origin: "China",
    destination: "Venezuela",
    per_cbm: "900",
    min_charge: "50",
    valid_from: "2099-11-30",
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  insert.mockReset();
  update.mockReset();
  rateError = null;
});

describe("createRate / updateRate · la columna de la ranura", () => {
  it("SIN la marca de control no nombra publica_programada (migr 0459 sin aplicar)", async () => {
    expect(await createRate({}, form())).toEqual({ ok: true, createdId: "nueva" });
    expect(insert.mock.calls[0][0]).not.toHaveProperty("publica_programada");
    await updateRate("r1", {}, form({ is_public: "on" }));
    expect(update.mock.calls[0][0]).not.toHaveProperty("publica_programada");
  });

  it("con la marca y la casilla marcada, programa", async () => {
    await createRate({}, form({ publica_programada_control: "1", publica_programada: "on" }));
    expect(insert.mock.calls[0][0]).toMatchObject({ publica_programada: true, is_public: false });
  });

  it("con la marca y la casilla desmarcada viaja en false: así se suelta la programación", async () => {
    await updateRate("r1", {}, form({ publica_programada_control: "1" }));
    expect(update.mock.calls[0][0]).toMatchObject({ publica_programada: false });
  });

  it("una programada para hoy o antes no llega a la base", async () => {
    const r = await createRate(
      {},
      form({ publica_programada_control: "1", publica_programada: "on", valid_from: "2020-01-01" }),
    );
    expect(r.fieldErrors?.valid_from).toMatch(/fecha futura/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("el choque con otra programada se explica, no se muestra crudo", async () => {
    rateError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "rates_one_programada_per_tenant_modo"',
    };
    const r = await createRate({}, form({ publica_programada_control: "1", publica_programada: "on" }));
    expect(r.error).toMatch(/Ya hay otra tarifa programada/);
  });

  it("el aviso de segunda pública sigue vivo, y con la ranura propone programar", async () => {
    rateError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "rates_one_public_cbm_per_tenant_modo"',
    };
    const sin = await createRate({}, form({ is_public: "on" }));
    expect(sin.error).toMatch(/Desmárcala primero/);
    const con = await createRate({}, form({ is_public: "on", publica_programada_control: "1" }));
    expect(con.error).toMatch(/márcala como «Programada»/);
  });
});
