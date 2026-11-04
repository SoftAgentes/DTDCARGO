/**
 * `/entrar` no dice que salió un correo que no salió, y tampoco revela si el
 * correo existe.
 *
 * Los dobles están en el borde de red y NO en la acción: `sendEmail`,
 * `resendSend`, `magic-link.ts` y `resolveAppEnv` corren de verdad. Lo que se dobla
 * es lo que no se puede provocar en producción:
 *
 *  - **Resend**, con `fetch`: acepta o responde 500.
 *  - **GoTrue**, con la regla de `internal/api/mail.go` en v2.197.0, la que está en
 *    el compose: `adminGenerateLink` escribe `RecoverySentAt` y `sendMagicLink` lo
 *    valida contra `SMTP.MaxFrequency`. O sea: acuñar cuenta como envío, y el `/otp`
 *    de los 60 s siguientes da 429 sin mandar nada. Sin esa regla en el doble, el
 *    plan B parecería funcionar.
 *
 * `useActionState` se dobla porque `fireEvent.submit` no lo dispara en jsdom
 * (medido en este repo, ver `MagicRequested`). Con el doble, la pantalla se dibuja
 * con el estado que devolvió la acción real, y eso es lo que se afirma.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const VENTANA_SMTP_MS = 60_000;

const mocks = vi.hoisted(() => ({
  estado: {} as Record<string, unknown>,
  adminDisponible: true,
  /** Correos con `auth.users`. */
  authUsers: new Set<string>(),
  /** `RecoverySentAt` de cada correo. */
  recoverySentAt: new Map<string, number>(),
  /** Enlaces que Auth de verdad mandó por su SMTP. */
  buzonAuth: [] as string[],
  /** Respuesta (status) de cada `/otp` que llegó a Auth. */
  otpRespuestas: [] as number[],
  acunados: 0,
  tablas: {
    throttle: [] as Array<{ ip: string; created_at: string }>,
    clientUsers: [] as Array<{ id: string; tenant_id: string; email: string; status: string }>,
    clients: [] as Array<{ id: string; tenant_id: string; markbox: string; name: string; email: string }>,
    blacklist: [] as Array<{ tenant_id: string; email: string; reason: string }>,
    mailLogs: [] as Array<{ id: string; status: string; to_email: string }>,
  },
  fallaThrottle: false,
  fallaClientUsers: false,
  avisarClienteSinAcceso: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useActionState: () => [mocks.estado, vi.fn(), false],
  };
});

vi.mock("@/app/portal/actions", () => ({
  signOutAction: vi.fn(async () => {}),
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "203.0.113.7",
}));

vi.mock("@/lib/studio/portal/sin-acceso-aviso", () => ({
  avisarClienteSinAcceso: mocks.avisarClienteSinAcceso,
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOtp: async ({ email }: { email: string }) => {
        if (!mocks.authUsers.has(email)) {
          mocks.otpRespuestas.push(422);
          return { error: { status: 422, code: "otp_disabled" } };
        }
        const previo = mocks.recoverySentAt.get(email);
        if (previo !== undefined && Date.now() - previo < 60_000) {
          mocks.otpRespuestas.push(429);
          return { error: { status: 429, code: "over_email_send_rate_limit" } };
        }
        mocks.recoverySentAt.set(email, Date.now());
        mocks.buzonAuth.push(email);
        mocks.otpRespuestas.push(200);
        return { error: null };
      },
    },
  }),
}));

/**
 * `ILIKE` como lo ve PostgREST: `*` pasa a ser `%` antes de llegar a Postgres. Sin los
 * comodines de verdad, este doble no podría probar el escape.
 */
function coincideIlike(texto: string, patron: string): boolean {
  const literal = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p = patron.replaceAll("*", "%");
  let regex = "";
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === "\\") {
      i += 1;
      regex += literal(p[i] ?? "");
    } else if (p[i] === "%") {
      regex += "[\\s\\S]*";
    } else if (p[i] === "_") {
      regex += "[\\s\\S]";
    } else {
      regex += literal(p[i]);
    }
  }
  return new RegExp(`^${regex}$`, "i").test(texto);
}

/** Tabla en memoria que SÍ aplica `.eq`, `.ilike`, `.in`, `.gte` e `.is`. */
function tabla<T extends Record<string, unknown>>(
  filas: T[],
  opciones: { falla?: () => boolean } = {},
) {
  const filtros: Array<(fila: T) => boolean> = [];
  let cabecera = false;
  const respuesta = () => {
    if (opciones.falla?.()) return { data: null, count: null, error: { message: "boom" } };
    const data = filas.filter((fila) => filtros.every((f) => f(fila)));
    return { data, count: data.length, error: null };
  };
  const chain = {
    select: (_columnas?: string, conf?: { head?: boolean }) => {
      cabecera = conf?.head === true;
      return chain;
    },
    eq: (col: string, valor: unknown) => {
      filtros.push((fila) => fila[col] === valor);
      return chain;
    },
    ilike: (col: string, valor: string) => {
      filtros.push((fila) => coincideIlike(String(fila[col]), valor));
      return chain;
    },
    in: (col: string, valores: unknown[]) => {
      filtros.push((fila) => valores.includes(fila[col]));
      return chain;
    },
    is: (col: string, valor: unknown) => {
      filtros.push((fila) => (fila[col] ?? null) === valor);
      return chain;
    },
    gte: (col: string, valor: string) => {
      filtros.push((fila) => String(fila[col]) >= valor);
      return chain;
    },
    limit: () => chain,
    maybeSingle: async () => {
      const r = respuesta();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    then: (resolver: (valor: unknown) => unknown) => {
      const r = respuesta();
      return Promise.resolve(
        cabecera ? { count: r.count, error: r.error } : { data: r.data, error: r.error },
      ).then(resolver);
    },
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (!mocks.adminDisponible) throw new Error("admin no disponible");
    return {
      auth: {
        admin: {
          generateLink: async ({ email }: { email: string }) => {
            if (!mocks.authUsers.has(email)) {
              return { data: null, error: { status: 404, code: "user_not_found" } };
            }
            mocks.acunados += 1;
            mocks.recoverySentAt.set(email, Date.now());
            return {
              data: { properties: { hashed_token: `hash-${mocks.acunados}` } },
              error: null,
            };
          },
          createUser: async ({ email }: { email: string }) => {
            mocks.authUsers.add(email);
            return { data: {}, error: null };
          },
        },
      },
      from(nombre: string) {
        switch (nombre) {
          case "portal_registro_throttle":
            return {
              ...tabla(mocks.tablas.throttle, { falla: () => mocks.fallaThrottle }),
              insert: async (fila: { ip: string }) => {
                mocks.tablas.throttle.push({
                  ...fila,
                  created_at: new Date().toISOString(),
                });
                return { error: mocks.fallaThrottle ? { message: "boom" } : null };
              },
            };
          case "client_users":
            return tabla(mocks.tablas.clientUsers, {
              falla: () => mocks.fallaClientUsers,
            });
          case "clients":
            return tabla(mocks.tablas.clients);
          case "mail_config":
            return tabla([
              {
                tenant_id: "tenant-1",
                from_email: "no-responder@dtdcargo.com",
                from_name: "DTD Cargo",
                reply_to: null,
                test_mode: false,
                internal_test_email: null,
              },
            ]);
          case "mail_blacklist":
            return tabla(mocks.tablas.blacklist);
          case "mail_logs":
            return {
              insert: (fila: { to_email: string; status: string }) => {
                const id = `log-${mocks.tablas.mailLogs.length + 1}`;
                mocks.tablas.mailLogs.push({ ...fila, id });
                return {
                  select: () => ({
                    single: async () => ({ data: { id }, error: null }),
                  }),
                };
              },
              update: (cambios: { status?: string }) => ({
                eq: async (_col: string, id: string) => {
                  const fila = mocks.tablas.mailLogs.find((l) => l.id === id);
                  if (fila && cambios.status) fila.status = cambios.status;
                  return { error: null };
                },
              }),
            };
          default:
            throw new Error(`tabla sin doble: ${nombre}`);
        }
      },
    };
  },
}));

import { requestMagicLink } from "../actions";
import { EntrarForm, MagicRequested } from "../EntrarForm";

const CLIENTE = "cliente@example.com";
const NADIE = "nadie@example.com";
const INVITADO = "invitada@example.com";
const DEL_ERP = "del-erp@example.com";

let fetchResend: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

function resendAcepta() {
  fetchResend.mockImplementation(async () =>
    new Response(JSON.stringify({ id: "resend-1" }), { status: 200 }),
  );
}

function resendCaido() {
  fetchResend.mockImplementation(async () =>
    new Response(JSON.stringify({ message: "caído", name: "internal_server_error" }), {
      status: 500,
    }),
  );
}

/** Correos que Resend aceptó de verdad. */
const aceptadosPorResend = () =>
  mocks.tablas.mailLogs.filter((log) => log.status === "sent").length;

function pasarElTiempo(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

/** Pide el enlace con la acción real y dibuja la pantalla que le toca a la persona. */
async function pedir(email: string) {
  const data = new FormData();
  data.set("email", email);
  mocks.estado = (await requestMagicLink(mocks.estado, data)) as Record<string, unknown>;
  cleanup();
  const { container } = render(<EntrarForm notice={null} authedNotBound={false} />);
  return { estado: mocks.estado, pantalla: container.textContent ?? "", html: container.innerHTML };
}

/** Lo que nunca puede decir la pantalla: que el correo ya salió. */
const AFIRMA_ENVIO = /te enviamos|te mandamos|enviado|ya sali[oó]|te lleg[oó]/i;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-02T15:00:00Z") });
  vi.stubEnv("RESEND_API_KEY", "re_llave_de_prueba");
  vi.stubEnv("APP_ENV", "production");
  fetchResend = vi.fn();
  vi.stubGlobal("fetch", fetchResend);
  resendAcepta();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.estado = {};
  mocks.adminDisponible = true;
  mocks.authUsers = new Set([CLIENTE]);
  mocks.recoverySentAt = new Map();
  mocks.buzonAuth = [];
  mocks.otpRespuestas = [];
  mocks.acunados = 0;
  mocks.fallaThrottle = false;
  mocks.fallaClientUsers = false;
  mocks.tablas.throttle = [];
  mocks.tablas.clientUsers = [
    { id: "cu-1", tenant_id: "tenant-1", email: CLIENTE, status: "active" },
    { id: "cu-2", tenant_id: "tenant-1", email: INVITADO, status: "invited" },
  ];
  mocks.tablas.clients = [
    { id: "cli-1", tenant_id: "tenant-1", markbox: "DTD-1234", name: "Comercial Andina", email: DEL_ERP },
  ];
  mocks.tablas.blacklist = [];
  mocks.tablas.mailLogs = [];
  mocks.avisarClienteSinAcceso.mockReset();
  mocks.avisarClienteSinAcceso.mockResolvedValue({ avisadoCliente: true, avisadoEquipo: true });
});

afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/entrar · con Resend caído", () => {
  beforeEach(() => resendCaido());

  it("la pantalla no dice que salió un correo que no salió", async () => {
    const { pantalla } = await pedir(CLIENTE);

    expect(aceptadosPorResend()).toBe(0);
    expect(mocks.buzonAuth).toEqual([]);
    expect(pantalla).not.toMatch(AFIRMA_ENVIO);
  });

  it("deja volver a intentar, y el segundo intento tampoco promete nada", async () => {
    await pedir(CLIENTE);
    expect(screen.getByRole("button", { name: /pedir otro enlace/i })).toBeTruthy();

    pasarElTiempo(61_000);
    const { pantalla } = await pedir(CLIENTE);

    expect(aceptadosPorResend()).toBe(0);
    expect(mocks.buzonAuth).toEqual([]);
    expect(pantalla).not.toMatch(AFIRMA_ENVIO);
    expect(fetchResend).toHaveBeenCalledTimes(2);
  });

  it("cuando Resend vuelve, el siguiente intento sí sale", async () => {
    await pedir(CLIENTE);
    resendAcepta();

    pasarElTiempo(61_000);
    await pedir(CLIENTE);

    expect(aceptadosPorResend()).toBe(1);
  });

  it("no llama al /otp después de acuñar: sería un 429 seguro", async () => {
    await pedir(CLIENTE);

    expect(mocks.acunados).toBe(1);
    expect(mocks.otpRespuestas).toEqual([]);
  });

  it("deja rastro del fallo, sin el correo de la persona", async () => {
    await pedir(CLIENTE);

    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(CLIENTE);
    expect(mocks.tablas.mailLogs[0]?.status).toBe("failed");
  });
});

describe("/entrar · sin revelar si el correo existe", () => {
  /** Cada caso prepara el mundo y pide con su correo. */
  const CASOS: Array<[string, string, () => void]> = [
    ["cuenta activa, entregado", CLIENTE, () => {}],
    ["correo desconocido", NADIE, () => {}],
    ["cliente del ERP sin acceso", DEL_ERP, () => {}],
    ["cuenta activa, Resend caído", CLIENTE, resendCaido],
    [
      "cuenta activa, en blacklist",
      CLIENTE,
      () => {
        mocks.tablas.blacklist = [
          { tenant_id: "tenant-1", email: CLIENTE, reason: "rebote" },
        ];
      },
    ],
    ["cuenta activa, sin llave de Resend", CLIENTE, () => vi.stubEnv("RESEND_API_KEY", "")],
    ["cuenta activa, en el entorno de prueba", CLIENTE, () => vi.stubEnv("APP_ENV", "staging")],
    [
      "cuenta activa, sin cliente admin",
      CLIENTE,
      () => {
        mocks.adminDisponible = false;
      },
    ],
    [
      "invitada sin auth.users y sin llave",
      INVITADO,
      () => vi.stubEnv("RESEND_API_KEY", ""),
    ],
  ];

  /** La misma pantalla para todos: se quita sólo el correo que escribió la persona. */
  const sinElCorreo = (html: string, email: string) => html.replaceAll(email, "<correo>");

  it.each(CASOS)("%s → la misma pantalla", async (_nombre, email, preparar) => {
    const referencia = await pedir(CLIENTE);
    const referenciaHtml = sinElCorreo(referencia.html, CLIENTE);
    expect(referencia.pantalla).not.toMatch(AFIRMA_ENVIO);

    // Otro cliente de prueba: el mundo limpio, sólo lo que el caso prepara.
    mocks.estado = {};
    mocks.tablas.throttle = [];
    mocks.recoverySentAt = new Map();
    preparar();

    const { html, pantalla, estado } = await pedir(email);

    expect(estado.error).toBeUndefined();
    expect(pantalla).not.toMatch(AFIRMA_ENVIO);
    expect(sinElCorreo(html, email)).toBe(referenciaHtml);
  });

  it("un correo desconocido no le manda nada a nadie", async () => {
    await pedir(NADIE);

    expect(fetchResend).not.toHaveBeenCalled();
    expect(mocks.buzonAuth).toEqual([]);
    expect(mocks.acunados).toBe(0);
  });
});

describe("/entrar · entorno de prueba: Resend simulado y Auth en Mailpit", () => {
  beforeEach(() => vi.stubEnv("APP_ENV", "staging"));

  it("el enlace llega por Auth: no se acuña antes, porque eso gastaría la ventana", async () => {
    await pedir(CLIENTE);

    expect(mocks.acunados).toBe(0);
    expect(mocks.buzonAuth).toEqual([CLIENTE]);
    // Resend no se toca, y no queda un `mail_log` en `queued` para nadie.
    expect(fetchResend).not.toHaveBeenCalled();
    expect(mocks.tablas.mailLogs).toEqual([]);
  });

  it("dentro de la ventana de 60 s el segundo no sale y la pantalla no lo afirma", async () => {
    await pedir(CLIENTE);
    pasarElTiempo(10_000);
    const { pantalla } = await pedir(CLIENTE);

    expect(mocks.otpRespuestas).toEqual([200, 429]);
    expect(mocks.buzonAuth).toEqual([CLIENTE]);
    expect(pantalla).not.toMatch(AFIRMA_ENVIO);
    // El 429 no es invisible para quien opera, aunque la pantalla no cambie.
    expect(consoleError.mock.calls.flat().join(" ")).toContain("429");
  });

  it("pasada la ventana, el segundo sí sale", async () => {
    await pedir(CLIENTE);
    pasarElTiempo(VENTANA_SMTP_MS + 1_000);
    await pedir(CLIENTE);

    expect(mocks.buzonAuth).toEqual([CLIENTE, CLIENTE]);
  });
});

describe("/entrar · sin llave de Resend en un entorno normal", () => {
  it("va directo a Auth y entrega", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await pedir(CLIENTE);

    expect(mocks.acunados).toBe(0);
    expect(mocks.buzonAuth).toEqual([CLIENTE]);
  });
});

describe("/entrar · el freno anti-abuso", () => {
  /** Gasta el cupo de 5 pedidos por correo y por hora. */
  async function gastarCupoDelCorreo(email: string) {
    for (let i = 0; i < 5; i += 1) await pedir(email);
    mocks.estado = {};
  }

  it("corta el envío y lo dice, en vez de fingir que salió", async () => {
    await gastarCupoDelCorreo(CLIENTE);
    const enviosAntes = fetchResend.mock.calls.length;

    const { estado, pantalla } = await pedir(CLIENTE);

    expect(fetchResend.mock.calls.length).toBe(enviosAntes);
    expect(estado.error).toMatch(/varios pedidos/i);
    expect(pantalla).not.toMatch(AFIRMA_ENVIO);
  });

  it("un correo con cuenta y uno sin cuenta reciben la misma respuesta", async () => {
    await gastarCupoDelCorreo(CLIENTE);
    const conCuenta = await pedir(CLIENTE);

    mocks.tablas.throttle = [];
    mocks.estado = {};
    await gastarCupoDelCorreo(NADIE);
    const sinCuenta = await pedir(NADIE);

    expect(sinCuenta.estado).toEqual({ ...conCuenta.estado, email: NADIE });
  });

  it("el reintento no se salta el freno: al sexto pedido no sale nada", async () => {
    resendCaido();
    for (let i = 0; i < 5; i += 1) await pedir(CLIENTE);
    expect(fetchResend).toHaveBeenCalledTimes(5);

    await pedir(CLIENTE);

    expect(fetchResend).toHaveBeenCalledTimes(5);
  });

  it("corta por origen antes de mirar el correo", async () => {
    for (let i = 0; i < 8; i += 1) {
      mocks.tablas.throttle.push({
        ip: `portal-login:${await hashDelOrigen()}`,
        created_at: new Date().toISOString(),
      });
    }

    const { estado } = await pedir(CLIENTE);

    expect(estado.error).toMatch(/varios pedidos/i);
    expect(fetchResend).not.toHaveBeenCalled();
  });

  it("el formulario sigue a la vista con el correo que la persona escribió", async () => {
    await gastarCupoDelCorreo(CLIENTE);

    const { html } = await pedir(CLIENTE);

    expect(html).toContain(`value="${CLIENTE}"`);
    expect(screen.getByRole("button", { name: /envíame el enlace/i })).toBeTruthy();
    // Fondo sólido: sobre el glass este rojo no llega a AA (5,42:1 medido sobre blanco).
    expect(screen.getByRole("alert").className).toContain("bg-white");
  });

  it("si el cerrojo no puede leer la base, no culpa a la persona de pedir mucho", async () => {
    mocks.fallaThrottle = true;

    const { estado } = await pedir(CLIENTE);

    expect(estado.error).toMatch(/no pudimos atender/i);
    expect(estado.error).not.toMatch(/varios pedidos/i);
    expect(fetchResend).not.toHaveBeenCalled();
  });

  it("si no se puede consultar el acceso, lo dice, para cualquier correo", async () => {
    mocks.fallaClientUsers = true;

    const conCuenta = await pedir(CLIENTE);
    mocks.estado = {};
    const sinCuenta = await pedir(NADIE);

    expect(conCuenta.estado.error).toMatch(/no pudimos atender/i);
    expect(sinCuenta.estado).toEqual({ ...conCuenta.estado, email: NADIE });
  });
});

describe("/entrar · el correo se compara literal, no como patrón", () => {
  const CON_PUNTO = "juan.perez@example.com";
  const CON_GUION_BAJO = "juan_perez@example.com";

  /** Lo que nunca le puede pasar a quien escribió un parecido. */
  function nadaSalio() {
    expect(mocks.acunados).toBe(0);
    expect(fetchResend).not.toHaveBeenCalled();
    expect(mocks.otpRespuestas).toEqual([]);
    expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
  }

  describe("con un cliente que tiene acceso", () => {
    beforeEach(() => {
      mocks.authUsers.add(CON_PUNTO);
      mocks.tablas.clientUsers.push({
        id: "cu-3",
        tenant_id: "tenant-1",
        email: CON_PUNTO,
        status: "active",
      });
    });

    it.each([
      CON_GUION_BAJO,
      "juan%@example.com",
      "%@example.com",
      "*@example.com",
      "juan*@example.com",
      "j__n.perez@example.com",
    ])("%s no lo alcanza: ni enlace, ni cuenta de Auth, ni correo", async (parecido) => {
      const usuariosAntes = mocks.authUsers.size;

      const { estado } = await pedir(parecido);

      nadaSalio();
      expect(mocks.authUsers.size).toBe(usuariosAntes);
      // La misma respuesta que para cualquier correo desconocido.
      expect(estado).toEqual({ requested: true, requests: 1, email: parecido });
    });
  });

  it.each(["del_erp@example.com", "del%@example.com", "%@example.com", "*@example.com"])(
    "%s no dispara el aviso de un cliente del ERP que nadie nombró",
    async (parecido) => {
      await pedir(parecido);

      nadaSalio();
    },
  );

  describe("quien escribe su correo de verdad sigue entrando", () => {
    /** Da de alta un correo con acceso y con su cuenta de Auth. */
    function conAcceso(guardado: string) {
      mocks.authUsers.add(guardado.toLowerCase());
      mocks.tablas.clientUsers.push({
        id: `cu-${guardado}`,
        tenant_id: "tenant-1",
        email: guardado,
        status: "active",
      });
    }

    it.each([
      [CON_GUION_BAJO, CON_GUION_BAJO],
      ["juan+dtd@example.com", "juan+dtd@example.com"],
      ["Juan+DTD@Example.com", "juan+dtd@example.com"],
      ["a%b@example.com", "a%b@example.com"],
      ["a*b@example.com", "a*b@example.com"],
      ["Juan_Perez@Example.COM", "juan_perez@example.com"],
      ["juan_perez@example.com", "JUAN_PEREZ@Example.com"],
    ])("guardado %s, escrito %s", async (guardado, escrito) => {
      conAcceso(guardado);

      await pedir(escrito);

      expect(aceptadosPorResend()).toBe(1);
    });

    it("un parecido que aparece primero no le quita su fila", async () => {
      // `mail_config` sólo existe para `tenant-1`: si toma la fila de otro inquilino,
      // el envío falla y se ve.
      mocks.tablas.clientUsers.unshift({
        id: "cu-parecido",
        tenant_id: "tenant-otro",
        email: CON_PUNTO,
        status: "active",
      });
      conAcceso(CON_GUION_BAJO);

      await pedir(CON_GUION_BAJO);

      expect(aceptadosPorResend()).toBe(1);
    });

    it("en el ERP, un parecido que aparece primero tampoco le quita su fila", async () => {
      // `.limit(1)` se queda con la primera: sin el escape, esa es la del parecido,
      // `sameEmail` la descarta y el aviso del cliente real nunca sale.
      mocks.tablas.clients.unshift({
        id: "cli-parecido",
        tenant_id: "tenant-1",
        markbox: "DTD-0001",
        name: "Empresa Parecida",
        email: "otra.empresa@example.com",
      });
      mocks.tablas.clients.push({
        id: "cli-2",
        tenant_id: "tenant-1",
        markbox: "DTD-5678",
        name: "Otra Empresa",
        email: "otra_empresa@example.com",
      });

      await pedir("otra_empresa@example.com");

      expect(mocks.avisarClienteSinAcceso).toHaveBeenCalledOnce();
      expect(mocks.avisarClienteSinAcceso.mock.calls[0][1].markbox).toBe("DTD-5678");
    });

    it("el aviso del ERP sigue saliendo para el correo exacto", async () => {
      mocks.tablas.clients.push({
        id: "cli-2",
        tenant_id: "tenant-1",
        markbox: "DTD-5678",
        name: "Otra Empresa",
        email: "Otra_Empresa@Example.com",
      });

      await pedir("otra_empresa@example.com");

      expect(mocks.avisarClienteSinAcceso).toHaveBeenCalledOnce();
      expect(mocks.avisarClienteSinAcceso.mock.calls[0][1].markbox).toBe("DTD-5678");
    });
  });
});

describe("/entrar · la pantalla de pedido recibido", () => {
  it("conserva el camino de volver a pedir con el mismo correo", async () => {
    const { html } = await pedir(CLIENTE);

    expect(html).toContain(`name="email"`);
    expect(html).toContain(`value="${CLIENTE}"`);
    const boton = screen.getByRole("button", { name: /pedir otro enlace/i });
    // Objetivo táctil de A11Y-01: era un texto de 13 px sin alto propio.
    expect(boton.className).toContain("min-h-[44px]");
    // Un correo largo se corta contra el panel si no puede partirse (medido a 375 px).
    expect(screen.getByText(CLIENTE).className).toContain("[overflow-wrap:anywhere]");
  });

  it("un segundo pedido se nota en la pantalla, y avisa que vale el último enlace", async () => {
    const primero = await pedir(CLIENTE);
    expect(primero.pantalla).toMatch(/pedido recibido/i);

    pasarElTiempo(61_000);
    const segundo = await pedir(CLIENTE);

    expect(segundo.pantalla).not.toBe(primero.pantalla);
    expect(screen.getByRole("status").textContent).toMatch(/2 pedidos/i);
    expect(screen.getByRole("status").textContent).toMatch(/último/i);
  });

  it("le da una salida a quien ya es cliente, además de crear cuenta", async () => {
    await pedir(CLIENTE);

    const whatsapp = screen.getByRole("link", { name: /whatsapp/i });
    expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d+/);
    // El correo no viaja en la URL: quedaría en el historial y en la analítica.
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).not.toContain(CLIENTE);
    expect(screen.getByRole("link", { name: /crear mi cuenta/i })).toBeTruthy();
  });

  it("mientras se envía, el botón conserva el foco y no deja pedir dos veces", () => {
    render(<MagicRequested email={CLIENTE} action={vi.fn()} pending />);

    const boton = screen.getByRole("button", { name: /pidiendo/i });
    // `disabled` soltaría el foco a `body` en un navegador real; jsdom no lo reproduce,
    // así que se afirma el atributo.
    expect(boton.hasAttribute("disabled")).toBe(false);
    expect(boton.getAttribute("aria-disabled")).toBe("true");
    // `fireEvent` devuelve `false` si alguien llamó a `preventDefault`.
    expect(fireEvent.click(boton)).toBe(false);
  });

  it("le lleva el foco al título: el formulario de donde venía ya no existe", async () => {
    await pedir(CLIENTE);

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: /si tienes acceso, revisa tu correo/i }),
    );
  });
});

async function hashDelOrigen() {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update("203.0.113.7").digest("hex");
}
