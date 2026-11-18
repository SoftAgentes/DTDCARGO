import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAvailable: true,
  /** Toques ya registrados por clave de cerrojo (prefijo + hash). */
  throttleCounts: {} as Record<string, number>,
  throttleError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  clientUser: { id: "client-user-1", tenant_id: "tenant-1", email: "cliente@example.com" } as {
    id: string;
    tenant_id: string;
    email: string;
  } | null,
  clientUserError: null as { message: string } | null,
  inserted: [] as Array<{ ip: string }>,
  signInWithOtp: vi.fn(),
  mintPortalMagicToken: vi.fn(),
  sendPortalMagicLinkEmail: vi.fn(),
  /** SDD-0279 · la fila de `clients` que devuelve la búsqueda del sin-acceso. */
  cliente: null as {
    id: string;
    tenant_id: string;
    markbox: string;
    name: string;
    email: string;
  } | null,
  clienteError: null as { message: string } | null,
  /** Filtros que el código aplicó sobre `clients`, para poder afirmarlos. */
  clientsFilters: [] as Array<[string, unknown]>,
  avisarClienteSinAcceso: vi.fn(),
  /** SDD-0646 D-1 · lo que responde `portal_email_sin_comprobar`. */
  sinComprobar: { data: [{ bloquea: false, pendiente: false }], error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
  rpcCalls: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "203.0.113.7",
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { signInWithOtp: mocks.signInWithOtp },
  }),
}));

// `portalOpenUrl` queda REAL a propósito: así el test mide la URL que de verdad
// viaja en el correo, no una que el propio test inventó.
vi.mock("@/lib/studio/portal/magic-link", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/portal/magic-link")>();
  return { ...real, mintPortalMagicToken: mocks.mintPortalMagicToken };
});

vi.mock("@/lib/studio/portal/magic-link-email", () => ({
  sendPortalMagicLinkEmail: mocks.sendPortalMagicLinkEmail,
}));

// `sin-acceso.ts` queda REAL: así el test mide la consulta que de verdad corre
// —incluido el filtro de soft-delete— y no una que el propio test inventó. Sólo
// se dobla el aviso, que es el efecto observable.
vi.mock("@/lib/studio/portal/sin-acceso-aviso", () => ({
  avisarClienteSinAcceso: mocks.avisarClienteSinAcceso,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (!mocks.adminAvailable) throw new Error("admin unavailable");
    return {
      rpc: async (name: string, args: unknown) => {
        mocks.rpcCalls.push([name, args]);
        return mocks.sinComprobar;
      },
      from(table: string) {
        if (table === "portal_registro_throttle") {
          let key = "";
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: (_col: string, value: string) => {
              key = value;
              return chain;
            },
            gte: async () => ({
              count: mocks.throttleCounts[key.split(":")[0]] ?? 0,
              error: mocks.throttleError,
            }),
            insert: async (payload: { ip: string }) => {
              mocks.inserted.push(payload);
              return { error: mocks.insertError };
            },
          };
          return chain;
        }
        if (table === "clients") {
          const chain: Record<string, unknown> = {
            select: () => chain,
            ilike: (col: string, value: unknown) => {
              mocks.clientsFilters.push([`ilike:${col}`, value]);
              return chain;
            },
            is: (col: string, value: unknown) => {
              mocks.clientsFilters.push([`is:${col}`, value]);
              return chain;
            },
            limit: () => chain,
            maybeSingle: async () => ({
              data: mocks.cliente,
              error: mocks.clienteError,
            }),
          };
          return chain;
        }
        const chain: Record<string, unknown> = {
          select: () => chain,
          ilike: () => chain,
          in: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({
            data: mocks.clientUser,
            error: mocks.clientUserError,
          }),
        };
        return chain;
      },
    };
  },
}));

import { requestMagicLink } from "../actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

const OK = { requested: true, requests: 1, email: "cliente@example.com" };
const VARIOS_PEDIDOS = expect.stringMatching(/varios pedidos/i);

describe("enlace de acceso al portal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // `resend-api.ts` queda REAL: con llave y fuera de prueba, Resend puede enviar.
    vi.stubEnv("RESEND_API_KEY", "re_llave_de_prueba");
    vi.stubEnv("APP_ENV", "production");
    mocks.adminAvailable = true;
    mocks.throttleCounts = {};
    mocks.throttleError = null;
    mocks.insertError = null;
    mocks.clientUser = {
      id: "client-user-1",
      tenant_id: "tenant-1",
      email: "cliente@example.com",
    };
    mocks.clientUserError = null;
    mocks.inserted.length = 0;
    mocks.cliente = null;
    mocks.clienteError = null;
    mocks.clientsFilters.length = 0;
    mocks.sinComprobar = { data: [{ bloquea: false, pendiente: false }], error: null };
    mocks.rpcCalls.length = 0;
    mocks.avisarClienteSinAcceso.mockReset();
    mocks.avisarClienteSinAcceso.mockResolvedValue({
      avisadoCliente: true,
      avisadoEquipo: true,
    });
    mocks.signInWithOtp.mockReset();
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    mocks.mintPortalMagicToken.mockReset();
    mocks.mintPortalMagicToken.mockResolvedValue("hash-abc");
    mocks.sendPortalMagicLinkEmail.mockReset();
    mocks.sendPortalMagicLinkEmail.mockResolvedValue({
      ok: true,
      log_id: "log-1",
      queued: false,
    });
  });

  describe("camino nuevo · token_hash (SDD-0278)", () => {
    it("manda el enlace por nuestro pipeline y NO por Auth", async () => {
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledOnce();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("el enlace apunta al intersticial, NO al callback", async () => {
      await requestMagicLink({}, form("cliente@example.com"));
      const [, tenantId, input] = mocks.sendPortalMagicLinkEmail.mock.calls[0];
      expect(tenantId).toBe("tenant-1");
      expect(input.url).toBe(
        "https://dtdcargo.com/abrir?token_hash=hash-abc&type=magiclink",
      );
      // Si esto vuelve a apuntar al callback, el escáner de correo quema el token
      // en GET y el cliente recibe un enlace muerto (SDD-0253, mismo bug).
      expect(input.url).not.toContain("/portal/callback");
    });
  });

  describe("plan B · el camino viejo sigue cubriendo", () => {
    it("cae a Auth si no se pudo acuñar el token", async () => {
      mocks.mintPortalMagicToken.mockResolvedValue(null);
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });

    it("cae a Auth SIN acuñar si Resend no puede enviar: acuñar gastaría la ventana", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.mintPortalMagicToken).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
    });

    it("con el enlace acuñado NO llama a Auth si el envío falla: sería un 429 seguro", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.sendPortalMagicLinkEmail.mockResolvedValue({
        ok: false,
        error: "email en blacklist",
      });
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith("[entrar] el enlace no salió:", "failed");
    });

    it("registra un `queued` como no enviado — un log NO es una entrega", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.sendPortalMagicLinkEmail.mockResolvedValue({
        ok: true,
        log_id: "log-1",
        queued: true,
      });
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(
        OK,
      );
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith("[entrar] el enlace no salió:", "queued");
    });

    it("un envío entregado no registra ningún fallo", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      await requestMagicLink({}, form("cliente@example.com"));
      expect(consoleError).not.toHaveBeenCalled();
    });

    // SDD-0646 D-1 · cambió a propósito: antes caía a Auth. Sin el cliente admin
    // no se puede saber si el correo está sin comprobar, así que no sale nada.
    it("⭐ si falta el cliente admin no envía nada por ningún camino, y falla igual para cualquier correo", async () => {
      mocks.adminAvailable = false;
      const res = await requestMagicLink({}, form("cliente@example.com"));
      expect(res.requested).toBeUndefined();
      expect(res.error).toBeTruthy();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
      expect(mocks.mintPortalMagicToken).not.toHaveBeenCalled();
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      const otro = await requestMagicLink({}, form("nadie@example.com"));
      expect(otro.error).toBe(res.error);
    });
  });

  describe("anti-enumeración y cerrojos", () => {
    it("responde igual para una cuenta inexistente y no manda nada", async () => {
      mocks.clientUser = null;
      await expect(requestMagicLink({}, form("nadie@example.com"))).resolves.toEqual({
        ...OK,
        email: "nadie@example.com",
      });
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("corta y lo dice cuando el origen está limitado", async () => {
      mocks.throttleCounts["portal-login"] = 8;
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
        error: VARIOS_PEDIDOS,
        email: "cliente@example.com",
      });
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("frena por EMAIL aunque el origen cambie de red", async () => {
      mocks.throttleCounts["portal-login-mail"] = 5;
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
        error: VARIOS_PEDIDOS,
        email: "cliente@example.com",
      });
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("los dos cerrojos guardan hash, nunca el dato crudo", async () => {
      await requestMagicLink({}, form("cliente@example.com"));
      expect(mocks.inserted[0]?.ip).toMatch(/^portal-login:[a-f0-9]{64}$/);
      expect(mocks.inserted[1]?.ip).toMatch(/^portal-login-mail:[a-f0-9]{64}$/);
      const crudo = mocks.inserted.map((r) => r.ip).join(" ");
      expect(crudo).not.toContain("203.0.113.7");
      expect(crudo).not.toContain("cliente@example.com");
    });

    it("conserva el error local para un formato inválido", async () => {
      await expect(requestMagicLink({}, form("no-es-email"))).resolves.toEqual({
        error: "Ingresa un email válido.",
      });
    });
  });
  describe("cliente sin acceso al portal (SDD-0279)", () => {
    /** Sin fila en `client_users` es la puerta de entrada a todo este carril. */
    function sinFilaDeAcceso() {
      mocks.clientUser = null;
    }

    it("es cliente del ERP → le avisa a él y al equipo", async () => {
      sinFilaDeAcceso();
      mocks.cliente = {
        id: "cli-1",
        tenant_id: "tenant-1",
        markbox: "DTD-1234",
        name: "Comercial Andina",
        email: "cliente@example.com",
      };

      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);

      expect(mocks.avisarClienteSinAcceso).toHaveBeenCalledTimes(1);
      const [, cliente, email] = mocks.avisarClienteSinAcceso.mock.calls[0];
      expect(cliente.markbox).toBe("DTD-1234");
      expect(email).toBe("cliente@example.com");
      // Y NO se le acuñó ningún enlace: no tiene acceso que abrir.
      expect(mocks.mintPortalMagicToken).not.toHaveBeenCalled();
    });

    it("email desconocido → NO sale ningún correo", async () => {
      sinFilaDeAcceso();
      mocks.cliente = null;

      await expect(
        requestMagicLink({}, form("desconocido@example.com")),
      ).resolves.toEqual({ ...OK, email: "desconocido@example.com" });

      // El candado contra usar /entrar para mandarle correo de DTD a un tercero.
      expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
    });

    it("excluye al cliente soft-deleted: la fila fusionada es un alias, no un titular", async () => {
      sinFilaDeAcceso();
      mocks.cliente = null;

      await requestMagicLink({}, form("fusionado@example.com"));

      // El filtro corre de verdad — `sin-acceso.ts` no está doblado.
      expect(mocks.clientsFilters).toContainEqual(["is:deleted_at", null]);
    });

    it("un fallo al buscar el cliente no rompe la puerta", async () => {
      sinFilaDeAcceso();
      mocks.clienteError = { message: "boom" };

      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);
      expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
    });

    it("con acceso vigente NO entra a este carril — recibe su enlace", async () => {
      mocks.mintPortalMagicToken.mockResolvedValue("hash-1");
      mocks.sendPortalMagicLinkEmail.mockResolvedValue({
        ok: true,
        log_id: "log-1",
        queued: false,
      });

      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);

      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledTimes(1);
      expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
    });

    it("el cerrojo por email también frena el aviso", async () => {
      sinFilaDeAcceso();
      mocks.cliente = {
        id: "cli-1",
        tenant_id: "tenant-1",
        markbox: "DTD-1234",
        name: "Comercial Andina",
        email: "cliente@example.com",
      };
      // 5 toques ya gastados en la ventana → el segundo cerrojo corta antes.
      mocks.throttleCounts["portal-login-mail"] = 5;

      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual({
        error: VARIOS_PEDIDOS,
        email: "cliente@example.com",
      });

      // Si no, repetir el pedido spamearía al cliente y al equipo.
      expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
    });
  });

  describe("correo sin comprobar de una cuenta por link (SDD-0646 D-1)", () => {
    /** Lo que ve y lo que dispara un correo que no existe: el patrón a igualar. */
    async function inexistente() {
      mocks.clientUser = null;
      mocks.cliente = null;
      const res = await requestMagicLink({}, form("cliente@example.com"));
      return { res, filtros: [...mocks.clientsFilters], rpc: mocks.rpcCalls.map(([n]) => n) };
    }

    function nadaSalio() {
      expect(mocks.mintPortalMagicToken).not.toHaveBeenCalled();
      expect(mocks.sendPortalMagicLinkEmail).not.toHaveBeenCalled();
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
      expect(mocks.avisarClienteSinAcceso).not.toHaveBeenCalled();
    }

    it("pregunta SIEMPRE si el correo está sin comprobar, exista o no la cuenta", async () => {
      await requestMagicLink({}, form("cliente@example.com"));
      expect(mocks.rpcCalls).toEqual([
        ["portal_email_sin_comprobar", { p_email: "cliente@example.com" }],
      ]);
      mocks.rpcCalls.length = 0;
      mocks.clientUser = null;
      await requestMagicLink({}, form("nadie@example.com"));
      expect(mocks.rpcCalls).toEqual([
        ["portal_email_sin_comprobar", { p_email: "nadie@example.com" }],
      ]);
    });

    it("⭐ el correo del acceso de una cuenta sin comprobar: nada sale y responde igual que uno inexistente", async () => {
      const patron = await inexistente();
      nadaSalio();

      // Cuenta por link de antes del cambio.
      mocks.clientsFilters.length = 0;
      mocks.rpcCalls.length = 0;
      mocks.clientUser = { id: "client-user-1", tenant_id: "tenant-1", email: "cliente@example.com" };
      mocks.sinComprobar = { data: [{ bloquea: true, pendiente: true }], error: null };
      // La ficha existe con ese correo: sin el corte, «cliente sin acceso» le escribiría.
      mocks.cliente = {
        id: "cli-1",
        tenant_id: "tenant-1",
        markbox: "DTD-8001",
        name: "Cliente Legado",
        email: "cliente@example.com",
      };

      const res = await requestMagicLink({}, form("cliente@example.com"));
      expect(res).toEqual(patron.res);
      nadaSalio();
      // Mismas consultas, en el mismo orden, que para un correo que no existe.
      expect(mocks.clientsFilters).toEqual(patron.filtros);
      expect(mocks.rpcCalls.map(([n]) => n)).toEqual(patron.rpc);
    });

    it("⭐ el correo por comprobar de una cuenta que ya lleva su dirección interna: nada sale", async () => {
      const patron = await inexistente();
      mocks.clientsFilters.length = 0;
      // La fila de acceso lleva la dirección interna: por el correo real no aparece.
      mocks.clientUser = null;
      mocks.sinComprobar = { data: [{ bloquea: false, pendiente: true }], error: null };
      mocks.cliente = {
        id: "cli-1",
        tenant_id: "tenant-1",
        markbox: "DTD-8001",
        name: "Cliente Legado",
        email: "cliente@example.com",
      };
      const res = await requestMagicLink({}, form("cliente@example.com"));
      expect(res).toEqual(patron.res);
      nadaSalio();
      expect(mocks.clientsFilters).toEqual(patron.filtros);
    });

    it("⭐ la dirección interna escrita a mano tampoco recibe nada", async () => {
      const interna = `c-${"a".repeat(32)}@sin-comprobar.invalid`;
      mocks.clientUser = { id: "client-user-1", tenant_id: "tenant-1", email: interna };
      const res = await requestMagicLink({}, form(interna));
      expect(res).toEqual({ requested: true, requests: 1, email: interna });
      nadaSalio();
    });

    it("⭐ sin Resend tampoco cae a Auth con un correo sin comprobar", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      mocks.sinComprobar = { data: [{ bloquea: true, pendiente: true }], error: null };
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);
      nadaSalio();
    });

    it("⭐ si no se puede saber si está comprobado, no sale ningún enlace (falla cerrado)", async () => {
      mocks.sinComprobar = { data: null, error: { code: "XX000", message: "boom" } };
      const res = await requestMagicLink({}, form("cliente@example.com"));
      expect(res.requested).toBeUndefined();
      expect(res.error).toBeTruthy();
      nadaSalio();
      // Y es el mismo fallo para un correo que no existe: no revela nada.
      mocks.clientUser = null;
      const otro = await requestMagicLink({}, form("cliente@example.com"));
      expect(otro).toEqual(res);
    });

    it("un correo ya comprobado recibe su enlace como siempre", async () => {
      mocks.sinComprobar = { data: [{ bloquea: false, pendiente: false }], error: null };
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);
      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledOnce();
    });

    it("«por comprobar» en una cuenta ajena no bloquea al cliente invitado por correo", async () => {
      mocks.sinComprobar = { data: [{ bloquea: false, pendiente: true }], error: null };
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);
      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledOnce();
    });

    it("sin la migración 0559 la entrada de siempre no cambia", async () => {
      mocks.sinComprobar = { data: null, error: { code: "PGRST202", message: "no existe" } };
      await expect(requestMagicLink({}, form("cliente@example.com"))).resolves.toEqual(OK);
      expect(mocks.sendPortalMagicLinkEmail).toHaveBeenCalledOnce();
    });
  });
});
