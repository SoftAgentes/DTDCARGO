/**
 * Tests de las acciones del ID de Discord del perfil (SDD-0606).
 *
 * Por el lado negativo primero:
 *   1. un valor que no es un ID de Discord no llega a la base,
 *   2. sin sesión no se escribe nada,
 *   3. sólo se escribe sobre la fila del usuario de la sesión,
 *   4. un error de la base no se le muestra crudo a la persona,
 *   5. leer tolera que la columna todavía no exista (migración 0514 sin aplicar).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ACTOR = "user-actor";
const ID_OK = "123456789012345678";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn() }));
vi.mock("@/lib/studio/audit/external-effect-adapter", () => ({
  beginD5ExternalEffect: vi.fn(),
  finishD5ExternalEffect: vi.fn(),
}));
vi.mock("@/lib/studio/audit/d1-access-config-adapters", () => ({
  executeD1Operation: vi.fn(),
  d1Reason: (v: unknown, fallback: string) => (v as string) ?? fallback,
}));
vi.mock("@/lib/studio/audit/auth-lifecycle-adapter", () => ({
  executeAuthLifecycle: vi.fn(),
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));

let sessionUser: { id: string } | null = null;
let updateError: { code: string; message: string } | null = null;
let selectResult: { data: unknown; error: unknown } = { data: null, error: null };

const updateMock = vi.fn();
const updateEqMock = vi.fn();
const selectMock = vi.fn();
const selectEqMock = vi.fn();

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: (table: string) => {
      if (table !== "user_profiles") throw new Error(`tabla inesperada: ${table}`);
      return {
        update: (values: unknown) => {
          updateMock(values);
          return {
            eq: async (col: string, val: unknown) => {
              updateEqMock(col, val);
              return { error: updateError };
            },
          };
        },
        select: (cols: string) => {
          selectMock(cols);
          return {
            eq: (col: string, val: unknown) => {
              selectEqMock(col, val);
              return { maybeSingle: async () => selectResult };
            },
          };
        },
      };
    },
  }),
  createAdminClient: () => {
    throw new Error("estas acciones no usan el cliente admin");
  },
}));

import {
  getMyDiscordUserIdAction,
  saveMyDiscordUserIdAction,
} from "../actions";

function form(value: string) {
  const fd = new FormData();
  fd.set("discord_user_id", value);
  return fd;
}

beforeEach(() => {
  sessionUser = { id: ACTOR };
  updateError = null;
  selectResult = { data: null, error: null };
  updateMock.mockReset();
  updateEqMock.mockReset();
  selectMock.mockReset();
  selectEqMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveMyDiscordUserIdAction", () => {
  it.each(["sam", "everyone", "1234", "12345678901234567a", "<@123456789012345678>"])(
    "rechaza %s sin tocar la base",
    async (malo) => {
      const res = await saveMyDiscordUserIdAction(form(malo));
      expect(res.ok).toBeUndefined();
      expect(res.error).toMatch(/17 a 20 dígitos/);
      expect(updateMock).not.toHaveBeenCalled();
    },
  );

  it("sin sesión no escribe", async () => {
    sessionUser = null;
    const res = await saveMyDiscordUserIdAction(form(ID_OK));
    expect(res.error).toBe("Inicia sesión primero.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("guarda el ID sobre la fila del usuario de la sesión y sobre ninguna otra", async () => {
    const res = await saveMyDiscordUserIdAction(form(`  ${ID_OK}  `));
    expect(res).toEqual({ ok: true, discordUserId: ID_OK });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toMatchObject({ discord_user_id: ID_OK });
    expect(updateEqMock).toHaveBeenCalledWith("user_id", ACTOR);
  });

  it("vacío quita el ID: guarda NULL, no cadena vacía", async () => {
    const res = await saveMyDiscordUserIdAction(form(""));
    expect(res).toEqual({ ok: true, discordUserId: null });
    expect(updateMock.mock.calls[0][0]).toMatchObject({ discord_user_id: null });
  });

  it("un error de la base no se muestra crudo", async () => {
    updateError = {
      code: "42703",
      message: 'column "discord_user_id" of relation "user_profiles" does not exist',
    };
    const res = await saveMyDiscordUserIdAction(form(ID_OK));
    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(
      "No se pudo guardar tu ID de Discord. Intenta de nuevo más tarde.",
    );
    expect(res.error).not.toContain("column");
  });
});

describe("getMyDiscordUserIdAction", () => {
  it("devuelve el ID guardado de la fila propia", async () => {
    selectResult = { data: { discord_user_id: ID_OK }, error: null };
    expect(await getMyDiscordUserIdAction()).toEqual({
      discordUserId: ID_OK,
      disponible: true,
    });
    expect(selectMock).toHaveBeenCalledWith("discord_user_id");
    expect(selectEqMock).toHaveBeenCalledWith("user_id", ACTOR);
  });

  it("si la columna todavía no existe, dice que no está disponible y no lanza", async () => {
    selectResult = { data: null, error: { code: "42703" } };
    expect(await getMyDiscordUserIdAction()).toEqual({
      discordUserId: null,
      disponible: false,
    });
  });

  it("sin sesión no consulta", async () => {
    sessionUser = null;
    expect(await getMyDiscordUserIdAction()).toEqual({
      discordUserId: null,
      disponible: false,
    });
    expect(selectMock).not.toHaveBeenCalled();
  });
});
