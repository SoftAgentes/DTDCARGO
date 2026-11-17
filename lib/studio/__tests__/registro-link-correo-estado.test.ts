// @vitest-environment node
/**
 * SDD-0646 (D-1, opción C) · «Registros por link» muestra el estado REAL del
 * correo (de `client_email_checks`), no una heurística; y la corrida única de
 * las cuentas ya creadas no escribe nada si no se le pide.
 */
import { describe, expect, it } from "vitest";
import { listRegistrosPorLink } from "../registro-link-queries";
import { pasarCuentas } from "../../../infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs";

type Fila = Record<string, unknown>;

function supabase(opts: {
  links: Fila[];
  checks: Fila[] | null;
  accesos: Fila[];
}) {
  const rpcs: string[] = [];
  return {
    rpcs,
    client: {
      rpc: async (name: string) => {
        rpcs.push(name);
        return { data: null, error: { code: "PGRST202", message: "no existe" } };
      },
      from(table: string) {
        const chain: Record<string, unknown> = {
          select: () => chain,
          not: () => chain,
          order: () => chain,
          is: () => chain,
          in: () => chain,
          limit: () => chain,
          then: (ok: (v: unknown) => unknown) => {
            if (table === "client_registration_links") return ok({ data: opts.links, error: null });
            if (table === "client_email_checks") {
              return ok(
                opts.checks === null
                  ? { data: null, error: { code: "42P01", message: "no existe" } }
                  : { data: opts.checks, error: null },
              );
            }
            if (table === "client_users") return ok({ data: opts.accesos, error: null });
            return ok({ data: [{ id: "c-1", markbox: "DTD-8001", name: "Ana" }], error: null });
          },
        };
        return chain;
      },
    } as never,
  };
}

const link = (id: string) => ({
  id,
  client_id: "c-1",
  used_at: "2026-11-17T12:00:00Z",
  prev_data: {},
  submitted_data: {},
  duplicate_client_id: null,
  duplicate_matched_by: null,
  rif_skipped: false,
  access_error: null,
  reviewed_at: null,
});
const check = (extra: Fila = {}) => ({
  link_id: "l-1",
  client_id: "c-1",
  auth_user_id: "auth-1",
  verified_at: null,
  conflict_at: null,
  sent_at: "2026-11-17T12:00:05Z",
  ...extra,
});
const acceso = (extra: Fila = {}) => ({ client_id: "c-1", auth_user_id: "auth-1", status: "active", ...extra });

async function estado(checks: Fila[] | null, accesos: Fila[] = [acceso()]) {
  const s = supabase({ links: [link("l-1")], checks, accesos });
  const rows = await listRegistrosPorLink(s.client, { soloPendientes: false });
  return { row: rows?.[0], rpcs: s.rpcs };
}

describe("estado del correo en «Registros por link»", () => {
  it("⭐ sin confirmar: «sin comprobar», con la fecha del último envío", async () => {
    const { row } = await estado([check()]);
    expect(row?.correoEstado).toBe("sin_comprobar");
    expect(row?.correoEnviadoAt).toBe("2026-11-17T12:00:05Z");
  });

  it("⭐ confirmado: «comprobado»", async () => {
    const { row } = await estado([check({ verified_at: "2026-11-17T13:00:00Z" })]);
    expect(row?.correoEstado).toBe("comprobado");
  });

  it("ese correo ya tenía otra cuenta: «choque»", async () => {
    const { row } = await estado([check({ conflict_at: "2026-11-17T13:00:00Z" })]);
    expect(row?.correoEstado).toBe("choque");
  });

  it("⭐ ya no usa la heurística de «volvió a entrar»: no llama a ninguna RPC", async () => {
    const { rpcs } = await estado([check()]);
    expect(rpcs).toEqual([]);
  });

  it("el registro no dejó cuenta, o la cuenta ya no es la del link: «no aplica»", async () => {
    expect((await estado([])).row?.correoEstado).toBe("no_aplica");
    expect((await estado([check()], [acceso({ auth_user_id: "otra" })])).row?.correoEstado).toBe("no_aplica");
    expect((await estado([check()], [acceso({ status: "revoked" })])).row?.correoEstado).toBe("no_aplica");
  });

  it("sin la migración 0559 dice «no se sabe» en vez de afirmar algo", async () => {
    expect((await estado(null)).row?.correoEstado).toBeNull();
  });
});

describe("corrida única de las cuentas ya creadas", () => {
  const INTERNA = `c-${"d".repeat(32)}@sin-comprobar.invalid`;

  function admin(filas: Fila[], opts: { correoActual?: string; authError?: unknown } = {}) {
    const escrituras: Array<[string, unknown]> = [];
    const lecturas: string[] = [];
    return {
      escrituras,
      lecturas,
      client: {
        from(table: string) {
          lecturas.push(table);
          const chain: Record<string, unknown> = {
            select: () => chain,
            is: () => chain,
            eq: () => chain,
            order: () => chain,
            limit: async () => ({ data: filas, error: null }),
          };
          return chain;
        },
        rpc: async (name: string, args: unknown) => {
          escrituras.push([name, args]);
          return { data: null, error: null };
        },
        auth: {
          admin: {
            getUserById: async () => ({
              data: { user: { email: opts.correoActual ?? "ana@example.test" } },
              error: null,
            }),
            updateUserById: async (id: string, attrs: unknown) => {
              escrituras.push(["updateUserById", { id, attrs }]);
              return { data: null, error: opts.authError ?? null };
            },
          },
        },
      },
    };
  }
  const fila = { id: "chk-1", auth_user_id: "auth-1", internal_email: INTERNA };

  it("⭐ por defecto es un ensayo: cuenta y no escribe nada", async () => {
    const a = admin([fila, { ...fila, id: "chk-2", auth_user_id: "auth-2" }]);
    const r = await pasarCuentas(a.client, { aplicar: false });
    expect(r).toMatchObject({ pendientes: 2, pasadas: 0, yaEstaban: 0, fallidas: 0, aplicar: false });
    expect(a.escrituras).toEqual([]);
  });

  it("con --aplicar pasa la cuenta a su dirección interna y lo anota", async () => {
    const a = admin([fila]);
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ pendientes: 1, pasadas: 1, fallidas: 0 });
    expect(a.escrituras).toEqual([
      ["updateUserById", { id: "auth-1", attrs: { email: INTERNA, email_confirm: true } }],
      ["portal_email_check_auth_interno", { p_check_id: "chk-1" }],
    ]);
  });

  it("es idempotente: si la cuenta ya la lleva, sólo lo anota", async () => {
    const a = admin([fila], { correoActual: INTERNA });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ pasadas: 0, yaEstaban: 1 });
    expect(a.escrituras.map(([n]) => n)).toEqual(["portal_email_check_auth_interno"]);
  });

  it("si Auth rechaza el cambio, no lo anota y lo cuenta como problema", async () => {
    const a = admin([fila], { authError: { status: 500, message: "boom" } });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ pasadas: 0, fallidas: 1 });
    expect(a.escrituras.map(([n]) => n)).toEqual(["updateUserById"]);
  });

  it("⭐ lo que anota en la salida no lleva correos", async () => {
    const mensajes: string[] = [];
    const a = admin([fila], { authError: { status: 500, message: "ana@example.test ya existe" } });
    await pasarCuentas(a.client, { aplicar: true, log: (m: string) => mensajes.push(m) });
    expect(mensajes.join(" ")).not.toMatch(/@/);
  });

  it("una dirección interna con forma rara no se toca", async () => {
    const a = admin([{ ...fila, internal_email: "ana@example.test" }]);
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ fallidas: 1, pasadas: 0 });
    expect(a.escrituras).toEqual([]);
  });
});
