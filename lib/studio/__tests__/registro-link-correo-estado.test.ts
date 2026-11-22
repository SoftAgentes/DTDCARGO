// @vitest-environment node
/**
 * SDD-0646 (D-1, opción C) · «Registros por link» muestra el estado REAL del
 * correo (de `client_email_checks`), no una heurística; y la corrida única de
 * las cuentas ya creadas no escribe nada si no se le pide.
 */
import { describe, expect, it } from "vitest";
import { listRegistrosPorLink } from "../registro-link-queries";
import {
  codigoDeSalida,
  pasarCuentas,
} from "../../../infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs";

type Fila = Record<string, unknown>;

function supabase(opts: { links: Fila[]; estados: Fila[] | null }) {
  const rpcs: Array<[string, unknown]> = [];
  const tablas: string[] = [];
  return {
    rpcs,
    tablas,
    client: {
      rpc: async (name: string, args: unknown) => {
        rpcs.push([name, args]);
        return opts.estados === null
          ? { data: null, error: { code: "PGRST202", message: "no existe" } }
          : { data: opts.estados, error: null };
      },
      from(table: string) {
        tablas.push(table);
        const chain: Record<string, unknown> = {
          select: () => chain,
          not: () => chain,
          order: () => chain,
          is: () => chain,
          in: () => chain,
          limit: () => chain,
          then: (ok: (v: unknown) => unknown) => {
            if (table === "client_registration_links") return ok({ data: opts.links, error: null });
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
const fila = (estado: string, extra: Fila = {}) => ({
  client_id: "c-1",
  link_id: "l-1",
  estado,
  sent_at: "2026-11-17T12:00:05Z",
  ...extra,
});

async function leer(estados: Fila[] | null, links: Fila[] = [link("l-1")]) {
  const s = supabase({ links, estados });
  const rows = await listRegistrosPorLink(s.client, { soloPendientes: false });
  return { rows: rows ?? [], rpcs: s.rpcs, tablas: s.tablas };
}

describe("estado del correo en «Registros por link»", () => {
  it.each(["comprobado", "sin_comprobar", "choque", "revisar", "nunca_comprobado"])(
    "⭐ muestra el estado real «%s», con la fecha del último envío",
    async (e) => {
      const { rows } = await leer([fila(e)]);
      expect(rows[0].correoEstado).toBe(e);
      expect(rows[0].correoEnviadoAt).toBe("2026-11-17T12:00:05Z");
    },
  );

  it("⭐ el equipo no lee la tabla (hash del token, correo por comprobar): pregunta por la función", async () => {
    const { rpcs, tablas } = await leer([fila("sin_comprobar")]);
    expect(rpcs).toEqual([["portal_email_check_estado", { p_client_ids: ["c-1"] }]]);
    expect(tablas).not.toContain("client_email_checks");
    expect(tablas).not.toContain("client_users");
  });

  it("ya no usa la heurística de «volvió a entrar»", async () => {
    const { rpcs } = await leer([fila("sin_comprobar")]);
    expect(rpcs.map(([n]) => n)).not.toContain("portal_registration_link_email_status");
  });

  it("el registro no dejó cuenta: «no aplica»", async () => {
    expect((await leer([])).rows[0].correoEstado).toBe("no_aplica");
  });

  it("un link más viejo del mismo cliente no hereda el estado del registro vigente", async () => {
    const { rows } = await leer([fila("comprobado", { link_id: "l-2" })], [link("l-1"), link("l-2")]);
    expect(rows.find((r) => r.id === "l-2")?.correoEstado).toBe("comprobado");
    expect(rows.find((r) => r.id === "l-1")?.correoEstado).toBe("no_aplica");
    expect(rows.find((r) => r.id === "l-1")?.correoEnviadoAt).toBeNull();
  });

  it("un estado que la app no conoce no se muestra como comprobado", async () => {
    expect((await leer([fila("otra_cosa")])).rows[0].correoEstado).toBe("no_aplica");
  });

  it("sin la migración 0559 dice «no se sabe» en vez de afirmar algo", async () => {
    expect((await leer(null)).rows[0].correoEstado).toBeNull();
  });

  describe("enlace de autoservicio (SDD-0672 entrega 2)", () => {
    const self = (extra: Fila = {}) => ({
      ...link("l-1"),
      link_origin: "autoservicio",
      issued_to_email: "ana@example.test",
      submitted_data: { email: "ana@example.test" },
      ...extra,
    });

    it("⭐ dejó el mismo correo al que llegó el enlace: «comprobado», sin fila de comprobación", async () => {
      const { rows } = await leer([], [self()]);
      expect(rows[0].correoEstado).toBe("comprobado");
      expect(rows[0].origen).toBe("autoservicio");
    });

    it("⭐ con acceso fallido no se afirma «comprobado»", async () => {
      const { rows } = await leer([], [self({ access_error: "createUser: boom" })]);
      expect(rows[0].correoEstado).toBe("no_aplica");
    });

    it("con otro correo manda el estado real de la comprobación (camino D-1)", async () => {
      const { rows } = await leer(
        [fila("sin_comprobar")],
        [self({ submitted_data: { email: "otro@example.test" } })],
      );
      expect(rows[0].correoEstado).toBe("sin_comprobar");
    });

    it("⭐ sin la migración 0562 (columna inexistente) la lista no se rompe", async () => {
      const pedidas: string[] = [];
      const client = {
        rpc: async () => ({ data: [], error: null }),
        from(table: string) {
          let columnas = "";
          const chain: Record<string, unknown> = {
            select: (c: string) => {
              columnas = c ?? "";
              if (table === "client_registration_links") pedidas.push(columnas);
              return chain;
            },
            not: () => chain,
            order: () => chain,
            is: () => chain,
            in: () => chain,
            limit: () => chain,
            then: (ok: (v: unknown) => unknown) => {
              if (table !== "client_registration_links") {
                return ok({ data: [{ id: "c-1", markbox: "DTD-8001", name: "Ana" }], error: null });
              }
              return columnas.includes("link_origin")
                ? ok({ data: null, error: { code: "42703", message: "no existe la columna" } })
                : ok({ data: [link("l-1")], error: null });
            },
          };
          return chain;
        },
      } as never;

      const rows = await listRegistrosPorLink(client, { soloPendientes: false });
      expect(rows).not.toBeNull();
      expect(rows?.[0].origen).toBe("equipo");
      expect(pedidas).toHaveLength(2);
      expect(pedidas[1]).not.toContain("link_origin");
    });

    it("un link del equipo sigue como siempre", async () => {
      const { rows } = await leer([], [link("l-1")]);
      expect(rows[0].correoEstado).toBe("no_aplica");
      expect(rows[0].origen).toBe("equipo");
    });
  });
});

describe("corrida única de las cuentas ya creadas", () => {
  const INTERNA = `c-${"d".repeat(32)}@sin-comprobar.invalid`;

  /**
   * Doble con estado: una fila deja de estar pendiente cuando la base la anota
   * (`portal_email_check_auth_interno`), y la lectura pagina por id como PostgREST.
   */
  function admin(
    filas: Fila[],
    opts: {
      correoActual?: string;
      authError?: unknown;
      anotarNoHaceNada?: boolean;
      /** auth_user_id de cuentas que ya no existen en Auth (404). */
      sinCuenta?: string[];
      leerError?: unknown;
    } = {},
  ) {
    const escrituras: Array<[string, unknown]> = [];
    const anotadas = new Set<string>();
    let lecturas = 0;
    const pendientes = () =>
      filas.filter((f) => !anotadas.has(String(f.id))).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return {
      escrituras,
      lecturas: () => lecturas,
      client: {
        from() {
          let despuesDe: string | null = null;
          let tope = Infinity;
          const chain: Record<string, unknown> = {
            select: () => chain,
            is: () => chain,
            eq: () => chain,
            order: () => chain,
            gt: (_c: string, v: string) => {
              despuesDe = v;
              return chain;
            },
            limit: (n: number) => {
              tope = n;
              return chain;
            },
            then: (ok: (v: unknown) => unknown) => {
              lecturas += 1;
              const data = pendientes()
                .filter((f) => despuesDe === null || String(f.id) > despuesDe)
                .slice(0, tope);
              return ok({ data, error: null });
            },
          };
          return chain;
        },
        rpc: async (name: string, args: { p_check_id: string }) => {
          escrituras.push([name, args]);
          if (!opts.anotarNoHaceNada) anotadas.add(args.p_check_id);
          return { data: null, error: null };
        },
        auth: {
          admin: {
            getUserById: async (id: string) => {
              if (opts.sinCuenta?.includes(id)) {
                return { data: { user: null }, error: { status: 404, message: "User not found" } };
              }
              if (opts.leerError) return { data: { user: null }, error: opts.leerError };
              return { data: { user: { email: opts.correoActual ?? "ana@example.test" } }, error: null };
            },
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
    expect(r).toMatchObject({ pendientes: 2, pasadas: 0, yaEstaban: 0, fallidas: 0, quedan: 2, aplicar: false });
    expect(a.escrituras).toEqual([]);
    expect(codigoDeSalida(r)).toBe(0);
  });

  it("⭐ recorre TODAS las filas por lotes, no sólo las primeras", async () => {
    const muchas = Array.from({ length: 450 }, (_, i) => ({
      id: `chk-${String(i).padStart(4, "0")}`,
      auth_user_id: `auth-${i}`,
      internal_email: INTERNA,
    }));
    const ensayo = admin(muchas);
    expect((await pasarCuentas(ensayo.client, { aplicar: false })).pendientes).toBe(450);
    expect(ensayo.lecturas()).toBeGreaterThan(1);

    const real = admin(muchas);
    const r = await pasarCuentas(real.client, { aplicar: true });
    expect(r).toMatchObject({ pendientes: 450, pasadas: 450, fallidas: 0, quedan: 0 });
    expect(codigoDeSalida(r)).toBe(0);
  });

  it("⭐ nunca termina en 0 si después de aplicar siguen quedando pendientes", async () => {
    // La base «anota» pero la fila sigue pendiente: la corrida lo vuelve a contar y no lo da por hecho.
    const a = admin([fila], { anotarNoHaceNada: true });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r.quedan).toBe(1);
    expect(codigoDeSalida(r)).not.toBe(0);
  });

  it("⭐ si alguna falla, el código de salida no es 0", async () => {
    const a = admin([fila], { authError: { status: 500, message: "boom" } });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(codigoDeSalida(r)).not.toBe(0);
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

  it("⭐ una fila cuya cuenta de Auth ya no existe: aparte, sin tocarla, y no cuenta como pendiente", async () => {
    const a = admin([fila], { sinCuenta: ["auth-1"] });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ pendientes: 0, pasadas: 0, fallidas: 0, huerfanas: 1, quedan: 0 });
    expect(a.escrituras).toEqual([]);
    expect(codigoDeSalida(r)).toBe(4);
  });

  it("⭐ la corrida llega a su fin con huérfanas mezcladas: pasa las demás y sale con 4, no con 3", async () => {
    const otra = { ...fila, id: "chk-2", auth_user_id: "auth-2" };
    const a = admin([fila, otra], { sinCuenta: ["auth-1"] });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ pendientes: 1, pasadas: 1, huerfanas: 1, fallidas: 0, quedan: 0 });
    expect(codigoDeSalida(r)).toBe(4);
    expect(a.escrituras.map(([n]) => n)).toEqual(["updateUserById", "portal_email_check_auth_interno"]);
  });

  it("el ensayo también las detecta, sin escribir nada", async () => {
    const a = admin([fila], { sinCuenta: ["auth-1"] });
    const r = await pasarCuentas(a.client, { aplicar: false });
    expect(r).toMatchObject({ pendientes: 0, huerfanas: 1, quedan: 0 });
    expect(a.escrituras).toEqual([]);
    expect(codigoDeSalida(r)).toBe(4);
  });

  it("⭐ un error al leer la cuenta que no es «no existe» es un problema, no una huérfana", async () => {
    const a = admin([fila], { leerError: { status: 500, message: "boom" } });
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ huerfanas: 0, fallidas: 1 });
    expect(a.escrituras).toEqual([]);
    expect(codigoDeSalida(r)).toBe(1);
  });

  it("una dirección interna con forma rara no se toca", async () => {
    const a = admin([{ ...fila, internal_email: "ana@example.test" }]);
    const r = await pasarCuentas(a.client, { aplicar: true });
    expect(r).toMatchObject({ fallidas: 1, pasadas: 0 });
    expect(a.escrituras).toEqual([]);
  });
});
