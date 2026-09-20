// @vitest-environment node
/**
 * CONTRATO — Frontera de autorización de la importación documental (SDD-0473).
 *
 * Este módulo decide quién ve y quién toca el documento de quién: un agujero acá
 * no es un bug de UI, es una fuga entre clientes. Lo que queda fijado:
 *
 * 1. La autorización NUNCA se deriva de lo que manda el cliente. El tenant, el
 *    client y el markbox salen del principal VIVO de la sesión, o de re-resolver
 *    el share token contra la prealerta VIVA. Nunca de headers ni del cuerpo.
 * 2. La capability anónima se comprueba por HASH: conocer el valor guardado en
 *    `anonymous_hash` (una fuga de lectura de la DB) no abre el workspace.
 * 3. Un token de OTRA compra —u otro tenant— no da acceso, y un workspace sin
 *    prealerta no lo abre ningún token.
 * 4. Fail-closed en todos los bordes: error de DB, cuota no verificable o
 *    secreto ausente NIEGAN. Ningún fallo se degrada a "permitido".
 * 5. Negar siempre se ve igual (404 opaco), para no volver el endpoint un
 *    oráculo de existencia de workspaces ajenos.
 * 6. La IP cruda nunca llega a lo que se persiste: la cuota por request se
 *    indexa con un HMAC con secreto propio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalClientPrincipal } from "@/lib/portal/portal-queries";

const mocks = vi.hoisted(() => ({ principal: vi.fn(), idsByToken: vi.fn() }));
vi.mock("@/lib/portal/portal-queries", () => ({ getPortalClientPrincipal: mocks.principal }));
vi.mock("@/lib/studio/prealertas/queries", () => ({ getPrealertaIdsByToken: mocks.idsByToken }));

import {
  ImportHttpError,
  UUID,
  authorizeWorkspace,
  enabled,
  hashToken,
  portalEnabled,
  purchaseForClient,
  requirePortal,
  reserveLimit,
  reserveRequest,
  type WorkspaceRow,
} from "./access";

// ── Fixtures sintéticos (nada de datos reales) ──────────────────────────────
const TENANT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const OTRO_TENANT = "99999999-9999-4999-8999-999999999999";
const OTRO_CLIENT = "88888888-8888-4888-8888-888888888888";
const COMPRA = "33333333-3333-4333-8333-333333333333";
const OTRA_COMPRA = "44444444-4444-4444-8444-444444444444";
const TOKEN_PROVEEDOR = "55555555-5555-4555-8555-555555555555";
const MARKBOX = "DTD-777";
const SECRETO = "s3creto-sintetico-de-al-menos-32-caracteres";

const principal = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: TENANT,
  client: { id: CLIENT, markbox: MARKBOX },
} as unknown as PortalClientPrincipal;

const workspace = (over: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: "66666666-6666-4666-8666-666666666666",
  tenant_id: TENANT,
  client_id: CLIENT,
  prealerta_id: null,
  anonymous_hash: null,
  expires_at: null,
  draft: {},
  revision: 1,
  confirmed_revision: null,
  confirmed_submission_id: null,
  ...over,
});

/** Headers que un atacante controla de punta a punta. */
const hostiles = (extra: Record<string, string> = {}) =>
  new Headers({
    "x-tenant-id": OTRO_TENANT,
    "x-client-id": OTRO_CLIENT,
    "x-markbox": "DTD-VICTIMA",
    "x-forwarded-for": "203.0.113.77, 10.0.0.1",
    ...extra,
  });

type Result = { data: unknown; error: unknown };
type QueryCall = { table: string; columns: string; filters: string[] };
type Builder = {
  select: (columns: string) => Builder;
  eq: (column: string, value: unknown) => Builder;
  neq: (column: string, value: unknown) => Builder;
  is: (column: string, value: unknown) => Builder;
  maybeSingle: () => Promise<Result>;
};

/** SupabaseClient falso: registra tabla, columnas y filtros de cada query. */
function makeDb(rows: Record<string, Result> = {}) {
  const queries: QueryCall[] = [];
  const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<Result>>(async () => ({
    data: true,
    error: null,
  }));
  const from = vi.fn((table: string): Builder => {
    const call: QueryCall = { table, columns: "", filters: [] };
    queries.push(call);
    const b: Builder = {
      select: (columns) => {
        call.columns = columns;
        return b;
      },
      eq: (column, value) => {
        call.filters.push(`eq:${column}=${String(value)}`);
        return b;
      },
      neq: (column, value) => {
        call.filters.push(`neq:${column}=${String(value)}`);
        return b;
      },
      is: (column, value) => {
        call.filters.push(`is:${column}=${String(value)}`);
        return b;
      },
      maybeSingle: async () => rows[table] ?? { data: null, error: null },
    };
    return b;
  });
  return { client: { from, rpc } as unknown as SupabaseClient, queries, rpc, from };
}

const NEGADO = { status: 404, code: "not_found" };

function sincronoQueLanza(fn: () => void): ImportHttpError {
  try {
    fn();
  } catch (e) {
    return e as ImportHttpError;
  }
  throw new Error("se esperaba que negara y no lanzó");
}

/** Captura la negación para poder mirar status, code y mensaje. */
async function negado(promesa: Promise<unknown>): Promise<ImportHttpError> {
  try {
    await promesa;
  } catch (e) {
    return e as ImportHttpError;
  }
  throw new Error("se esperaba que negara y resolvió");
}

// Las pruebas de cliente y proveedor describen el portal ENCENDIDO: las dos
// llaves en "true". Lo que pasa con sólo la primera se fija en su propio bloque.
beforeEach(() => {
  vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
  vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  mocks.principal.mockReset();
  mocks.idsByToken.mockReset();
});

describe("alcance: el cotizador sin el portal", () => {
  const TOKEN_ANONIMO = "ab".repeat(32);

  it("las dos llaves, y exactamente \"true\" las dos", () => {
    expect(portalEnabled()).toBe(true);
    for (const [maestra, portal] of [["true", ""], ["true", "false"], ["true", "1"], ["true", "TRUE"], ["", "true"], ["false", "true"]]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", maestra);
      vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", portal);
      expect(portalEnabled(), `maestra=${maestra} portal=${portal}`).toBe(false);
    }
  });

  it("sin el portal, el documento de una compra se niega antes de mirar sesión o base", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    mocks.principal.mockResolvedValue(principal);
    const { client, queries } = makeDb({ prealertas: { data: { id: COMPRA }, error: null } });
    const e = await negado(authorizeWorkspace(client, client, workspace({ prealerta_id: COMPRA }), new Headers()));
    expect(e).toMatchObject({ status: 503, code: "portal_not_enabled" });
    expect(mocks.principal).not.toHaveBeenCalled();
    expect(queries).toEqual([]);
  });

  it("sin el portal, el enlace del proveedor tampoco abre el documento compartido", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "");
    mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: TENANT, markbox: MARKBOX });
    const { client, queries } = makeDb({ clients: { data: { id: CLIENT }, error: null } });
    const e = await negado(
      authorizeWorkspace(client, client, workspace({ prealerta_id: COMPRA }), new Headers({ "x-supplier-token": TOKEN_PROVEEDOR })),
    );
    expect(e).toMatchObject({ status: 503, code: "portal_not_enabled" });
    expect(mocks.idsByToken).not.toHaveBeenCalled();
    expect(queries).toEqual([]);
  });

  it("sin el portal, el cotizador anónimo sigue abriendo con su token", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    const { client } = makeDb();
    const anonimo = workspace({ tenant_id: null, client_id: null, anonymous_hash: hashToken(TOKEN_ANONIMO), expires_at: new Date(Date.now() + 3600_000).toISOString() });
    await expect(authorizeWorkspace(client, client, anonimo, new Headers({ "x-document-token": TOKEN_ANONIMO }))).resolves.toMatchObject({ kind: "anonymous" });
    // Y sin su token no abre: apagar el portal no afloja la capability anónima.
    expect(await negado(authorizeWorkspace(client, client, anonimo, new Headers()))).toMatchObject(NEGADO);
  });
});

describe("capability anónima del workspace", () => {
  it("no abre el documento a quien conoce el hash guardado, sólo a quien tiene el token", async () => {
    // Una fuga de lectura de `document_workspaces` entrega el hash, no el token.
    // Si el código comparara el valor crudo, ese hash filtrado sería la llave.
    const token = "a".repeat(64);
    const hash = hashToken(token);
    const admin = makeDb();
    const session = makeDb();
    const w = workspace({ anonymous_hash: hash, client_id: null, tenant_id: null });

    await expect(
      authorizeWorkspace(admin.client, session.client, w, hostiles({ "x-document-token": hash })),
    ).rejects.toMatchObject(NEGADO);

    const actor = await authorizeWorkspace(
      admin.client,
      session.client,
      w,
      hostiles({ "x-document-token": token }),
    );
    expect(actor).toEqual({ kind: "anonymous", id: w.id });
    // El actor identifica al workspace, nunca transporta el secreto del visitante.
    expect(JSON.stringify(actor)).not.toContain(token);
    expect(mocks.principal).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rechaza tokens mal formados sin caer al camino del portal ni consultar la base", async () => {
    const token = "b".repeat(64);
    const w = workspace({ anonymous_hash: hashToken(token) });
    mocks.principal.mockResolvedValue(principal); // aunque haya sesión válida, no aplica
    // `B`.repeat(64) importa: el hash guardado es hex en minúscula y la
    // comparación es sensible a mayúsculas, así que el mismo valor "en otro
    // formato" no es el mismo token.
    const conEspacio = `${token.slice(0, 32)} ${token.slice(33)}`;
    for (const malo of ["", "b".repeat(63), "b".repeat(63) + "z", "B".repeat(64), conEspacio]) {
      const admin = makeDb();
      const session = makeDb();
      await expect(
        authorizeWorkspace(admin.client, session.client, w, new Headers({ "x-document-token": malo })),
      ).rejects.toMatchObject(NEGADO);
      expect(admin.from).not.toHaveBeenCalled();
      expect(session.from).not.toHaveBeenCalled();
    }
    expect(mocks.principal).not.toHaveBeenCalled();
  });

  it("no deja que un share token de proveedor sustituya a la capability anónima", async () => {
    // Escalada por confusión de ramas: el workspace anónimo se abre SÓLO con su
    // token; presentar un token de proveedor válido no debe cambiar la rama.
    const admin = makeDb();
    const session = makeDb();
    mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: TENANT, markbox: MARKBOX, code: "P-1" });
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ anonymous_hash: hashToken("c".repeat(64)), prealerta_id: COMPRA }),
        hostiles({ "x-supplier-token": TOKEN_PROVEEDOR }),
      ),
    ).rejects.toMatchObject(NEGADO);
    expect(mocks.idsByToken).not.toHaveBeenCalled();
  });

  it("la expiración vence a cualquier credencial válida", async () => {
    const token = "d".repeat(64);
    const admin = makeDb();
    const session = makeDb();
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ anonymous_hash: hashToken(token), expires_at: new Date(Date.now() - 1000).toISOString() }),
        new Headers({ "x-document-token": token }),
      ),
    ).rejects.toMatchObject(NEGADO);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("el documento vence EN su expires_at, no un milisegundo después", async () => {
    // El borde es cerrado: `expires_at` es el instante en que ya no se puede
    // abrir, no el último en que todavía sí. Si el límite se aflojara a `<`,
    // el workspace seguiría abierto exactamente en su fecha de vencimiento —
    // una ventana real para el que reintenta contra el reloj del servidor.
    const token = "f".repeat(64);
    const vencimiento = "2026-09-16T14:00:00.000Z";
    const w = workspace({ anonymous_hash: hashToken(token), expires_at: vencimiento });
    vi.useFakeTimers();

    vi.setSystemTime(new Date(vencimiento));
    const justo = makeDb();
    await expect(
      authorizeWorkspace(justo.client, makeDb().client, w, new Headers({ "x-document-token": token })),
    ).rejects.toMatchObject(NEGADO);
    expect(justo.from).not.toHaveBeenCalled();

    // Un milisegundo antes todavía es válido: la prueba fija el límite exacto,
    // no lo corre hacia adelante "por las dudas".
    vi.setSystemTime(new Date(Date.parse(vencimiento) - 1));
    const antes = makeDb();
    await expect(
      authorizeWorkspace(antes.client, makeDb().client, w, new Headers({ "x-document-token": token })),
    ).resolves.toEqual({ kind: "anonymous", id: w.id });
  });

  it("un vencimiento que no se puede leer niega: lo ilegible no acredita vigencia", async () => {
    // `Date.parse("el-mes-que-viene")` es NaN y `NaN <= Date.now()` es false: si
    // se compara sin comprobar, la fecha que no se entiende NO vence nunca y el
    // visitante anónimo queda dentro para siempre. Regla del módulo: si algo
    // falta o no se entiende, se niega.
    const token = "e".repeat(64);
    const ilegibles: Array<string | number | undefined> = [
      "2024-13-45T99:99:99Z", // forma de fecha, valor imposible
      "el mes que viene",
      "",
      "null",
      undefined, // la fila ni siquiera trajo la columna: no acredita nada
      1893456000000, // un epoch en número no es el timestamptz que se acordó
    ];
    for (const valor of ilegibles) {
      const admin = makeDb();
      const session = makeDb();
      await expect(
        authorizeWorkspace(
          admin.client,
          session.client,
          workspace({ anonymous_hash: hashToken(token), expires_at: valor as WorkspaceRow["expires_at"] }),
          new Headers({ "x-document-token": token }),
        ),
        String(valor),
      ).rejects.toMatchObject(NEGADO);
      expect(admin.from).not.toHaveBeenCalled();
    }
    // Y `null` sigue siendo «no vence»: negar de más rompería el camino legítimo
    // del cliente, que es justo el que no lleva vencimiento.
    await expect(
      authorizeWorkspace(
        makeDb().client,
        makeDb().client,
        workspace({ anonymous_hash: hashToken(token), expires_at: null }),
        new Headers({ "x-document-token": token }),
      ),
    ).resolves.toMatchObject({ kind: "anonymous" });
  });
});

describe("share token de proveedor re-resuelto contra la prealerta viva", () => {
  const conProveedor = (rows: Record<string, Result> = {}) => {
    const admin = makeDb(rows);
    const session = makeDb();
    return { admin, session };
  };

  it("un token de OTRA compra no abre este workspace", async () => {
    const { admin, session } = conProveedor({ clients: { data: { id: CLIENT }, error: null } });
    mocks.idsByToken.mockResolvedValue({ prealertaId: OTRA_COMPRA, tenantId: TENANT, markbox: MARKBOX, code: "P-2" });
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ prealerta_id: COMPRA }),
        hostiles({ "x-supplier-token": TOKEN_PROVEEDOR }),
      ),
    ).rejects.toMatchObject(NEGADO);
    // Ni siquiera llega a preguntar por el dueño: el vínculo ya no cuadra.
    expect(admin.queries).toHaveLength(0);
  });

  it("un token cuya prealerta vive en otro tenant no cruza la frontera", async () => {
    const { admin, session } = conProveedor({ clients: { data: { id: CLIENT }, error: null } });
    mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: OTRO_TENANT, markbox: MARKBOX, code: "P-3" });
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ prealerta_id: COMPRA }),
        new Headers({ "x-supplier-token": TOKEN_PROVEEDOR }),
      ),
    ).rejects.toMatchObject(NEGADO);
    expect(admin.queries).toHaveLength(0);
  });

  it("un workspace sin compra asociada no lo abre ningún token", async () => {
    const { admin, session } = conProveedor();
    mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: TENANT, markbox: MARKBOX, code: "P-4" });
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ prealerta_id: null }),
        new Headers({ "x-supplier-token": TOKEN_PROVEEDOR }),
      ),
    ).rejects.toMatchObject(NEGADO);
  });

  it("un token que no es UUID no llega siquiera a resolverse", async () => {
    const { admin, session } = conProveedor();
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ prealerta_id: COMPRA }),
        new Headers({ "x-supplier-token": "' or true --" }),
      ),
    ).rejects.toMatchObject(NEGADO);
    expect(mocks.idsByToken).not.toHaveBeenCalled();
  });

  it("comprueba la titularidad con el tenant y el markbox re-resueltos, no con los que manda el proveedor", async () => {
    const { admin, session } = conProveedor({ clients: { data: { id: CLIENT }, error: null } });
    mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: TENANT, markbox: MARKBOX, code: "P-5" });
    const actor = await authorizeWorkspace(
      admin.client,
      session.client,
      workspace({ prealerta_id: COMPRA }),
      hostiles({ "x-supplier-token": TOKEN_PROVEEDOR }),
    );
    expect(mocks.idsByToken).toHaveBeenCalledWith(admin.client, TOKEN_PROVEEDOR);
    expect(admin.queries[0]).toMatchObject({ table: "clients" });
    expect(admin.queries[0].filters).toEqual([
      `eq:id=${CLIENT}`,
      `eq:tenant_id=${TENANT}`,
      `eq:markbox=${MARKBOX}`,
      "is:deleted_at=null",
    ]);
    // Nada de lo que viajó en la petición se usó como filtro.
    expect(JSON.stringify(admin.queries)).not.toContain("DTD-VICTIMA");
    expect(JSON.stringify(admin.queries)).not.toContain(OTRO_TENANT);
    // El proveedor no es un principal: nunca se resuelve una sesión por él.
    expect(mocks.principal).not.toHaveBeenCalled();
    // La identidad del actor es un seudónimo: el token crudo no viaja al log.
    expect(actor.kind).toBe("supplier");
    expect(actor.id).toBe(`supplier:${createHash("sha256").update(TOKEN_PROVEEDOR).digest("hex").slice(0, 24)}`);
    expect(actor.id).not.toContain(TOKEN_PROVEEDOR);
  });

  it("si la titularidad no se puede comprobar, niega en vez de asumir", async () => {
    for (const fallo of [
      { data: null, error: null },
      { data: null, error: { message: "timeout" } },
      { data: { id: OTRO_CLIENT }, error: { message: "degradado" } },
    ]) {
      const { admin, session } = conProveedor({ clients: fallo });
      mocks.idsByToken.mockResolvedValue({ prealertaId: COMPRA, tenantId: TENANT, markbox: MARKBOX, code: "P-6" });
      await expect(
        authorizeWorkspace(
          admin.client,
          session.client,
          workspace({ prealerta_id: COMPRA }),
          new Headers({ "x-supplier-token": TOKEN_PROVEEDOR }),
        ),
      ).rejects.toMatchObject(NEGADO);
    }
  });

  it("un token desconocido o desactivado no degrada al camino del portal", async () => {
    const { admin, session } = conProveedor();
    mocks.idsByToken.mockResolvedValue(null);
    mocks.principal.mockResolvedValue(principal);
    await expect(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ prealerta_id: COMPRA }),
        new Headers({ "x-supplier-token": TOKEN_PROVEEDOR }),
      ),
    ).rejects.toMatchObject(NEGADO);
    expect(mocks.principal).not.toHaveBeenCalled();
  });
});

describe("principal del portal", () => {
  it("resuelve la identidad con el cliente de SESIÓN, nunca con el admin que salta RLS", async () => {
    const admin = makeDb();
    const session = makeDb();
    mocks.principal.mockResolvedValue(principal);
    const actor = await authorizeWorkspace(admin.client, session.client, workspace(), hostiles());
    expect(mocks.principal).toHaveBeenCalledTimes(1);
    expect(mocks.principal).toHaveBeenCalledWith(session.client);
    expect(mocks.principal).not.toHaveBeenCalledWith(admin.client);
    expect(actor).toMatchObject({ kind: "client", id: principal.userId });
  });

  it("estar logueado no alcanza: el workspace de otro cliente del mismo tenant se niega", async () => {
    const admin = makeDb();
    const session = makeDb();
    mocks.principal.mockResolvedValue(principal);
    await expect(
      authorizeWorkspace(admin.client, session.client, workspace({ client_id: OTRO_CLIENT }), hostiles()),
    ).rejects.toMatchObject(NEGADO);
    await expect(
      authorizeWorkspace(admin.client, session.client, workspace({ tenant_id: OTRO_TENANT }), hostiles()),
    ).rejects.toMatchObject(NEGADO);
    // Un workspace huérfano (tenant/client nulos) tampoco es de nadie logueado.
    await expect(
      authorizeWorkspace(admin.client, session.client, workspace({ tenant_id: null, client_id: null }), hostiles()),
    ).rejects.toMatchObject(NEGADO);
    expect(admin.from).not.toHaveBeenCalled();
    expect(session.from).not.toHaveBeenCalled();
  });

  it("sin sesión pide login y no filtra si el documento existe", async () => {
    const admin = makeDb();
    const session = makeDb();
    mocks.principal.mockResolvedValue(null);
    await expect(
      authorizeWorkspace(admin.client, session.client, workspace(), new Headers()),
    ).rejects.toMatchObject({ status: 401, code: "login_required" });
    await expect(requirePortal(session.client)).rejects.toMatchObject({ status: 401, code: "login_required" });
  });

  it("revalida la compra viva con el markbox del principal y no con lo que trae la petición", async () => {
    const admin = makeDb();
    const session = makeDb({ prealertas: { data: { id: COMPRA }, error: null } });
    mocks.principal.mockResolvedValue(principal);
    await authorizeWorkspace(admin.client, session.client, workspace({ prealerta_id: COMPRA }), hostiles());
    expect(session.queries[0].table).toBe("prealertas");
    expect(session.queries[0].filters).toEqual([
      `eq:id=${COMPRA}`,
      `eq:tenant_id=${TENANT}`,
      `eq:client_markbox=${MARKBOX}`,
      "is:deleted_at=null",
      "neq:status=cancelada",
    ]);
    expect(JSON.stringify(session.queries)).not.toContain("DTD-VICTIMA");
    // La revalidación va por la sesión (RLS puesta), no por el admin.
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("si la compra ya no está viva, el workspace deja de abrirse aunque el vínculo siga en la fila", async () => {
    for (const fallo of [
      { data: null, error: null }, // borrada, cancelada o de otro markbox
      { data: null, error: { message: "rls" } },
    ]) {
      const admin = makeDb();
      const session = makeDb({ prealertas: fallo });
      mocks.principal.mockResolvedValue(principal);
      await expect(
        authorizeWorkspace(admin.client, session.client, workspace({ prealerta_id: COMPRA }), new Headers()),
      ).rejects.toMatchObject(NEGADO);
    }
  });

  it("negar siempre se ve igual: el endpoint no es un oráculo de existencia", async () => {
    const admin = makeDb();
    const session = makeDb();
    mocks.principal.mockResolvedValue(principal);
    const ajeno = await negado(
      authorizeWorkspace(admin.client, session.client, workspace({ client_id: OTRO_CLIENT }), new Headers()),
    );
    const vencido = await negado(
      authorizeWorkspace(
        admin.client,
        session.client,
        workspace({ expires_at: "2000-01-01T00:00:00.000Z" }),
        new Headers(),
      ),
    );
    expect([ajeno.status, ajeno.code, ajeno.message]).toEqual([vencido.status, vencido.code, vencido.message]);
    expect(ajeno.message).not.toContain(CLIENT);
    expect(ajeno.message).not.toContain(TENANT);
  });
});

describe("compra del cliente (purchaseForClient)", () => {
  it("un identificador que no es UUID nunca llega a la consulta", async () => {
    const session = makeDb({ prealertas: { data: { id: COMPRA }, error: null } });
    for (const malo of ["", "..", `${COMPRA}' or '1'='1`, "00000000-0000-0000-0000-000000000000"]) {
      await expect(purchaseForClient(session.client, principal, malo)).rejects.toMatchObject(NEGADO);
    }
    expect(session.from).not.toHaveBeenCalled();
  });

  it("un error de base de datos niega el acceso y no expone el motivo", async () => {
    const session = makeDb({ prealertas: { data: null, error: { message: "permission denied for table prealertas" } } });
    const error = await negado(purchaseForClient(session.client, principal, COMPRA));
    expect(error).toMatchObject(NEGADO);
    expect(error.message).not.toContain("permission denied");
  });
});

describe("cuotas persistidas (reserveLimit)", () => {
  it("si la cuota no se puede verificar NIEGA con 503, jamás degrada a permitido", async () => {
    const db = makeDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "rpc caída" } });
    const error = await negado(reserveLimit(db.client, "http:x", 1, 120));
    expect(error).toMatchObject({ status: 503, code: "quota_unavailable" });
    expect(error.message).not.toContain("rpc caída");
  });

  it("sólo un true explícito de la RPC autoriza; cualquier otra respuesta es límite alcanzado", async () => {
    for (const data of [false, null, undefined, "true", 1, {}, []]) {
      const db = makeDb();
      db.rpc.mockResolvedValue({ data, error: null });
      await expect(reserveLimit(db.client, "http:x", 1, 120)).rejects.toMatchObject({
        status: 429,
        code: "quota_exceeded",
      });
    }
    const ok = makeDb();
    ok.rpc.mockResolvedValue({ data: true, error: null });
    await expect(reserveLimit(ok.client, "http:x", 1, 120)).resolves.toBeUndefined();
  });

  it("reserva las unidades pedidas en la ventana alineada, para que el cupo no se reinicie por request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T14:37:12.345Z"));
    const db = makeDb();
    db.rpc.mockResolvedValue({ data: true, error: null });
    await reserveLimit(db.client, "ai-token-budget", 200000, 2000000);
    expect(db.rpc).toHaveBeenCalledWith("reserve_document_import_limit", {
      p_scope: "ai-token-budget",
      p_window: "2026-09-16T14:00:00.000Z",
      p_units: 200000,
      p_limit: 2000000,
    });
    // Un minuto después sigue siendo la MISMA ventana: el consumo se acumula.
    vi.setSystemTime(new Date("2026-09-16T14:59:59.999Z"));
    await reserveLimit(db.client, "ai-token-budget", 1, 10);
    expect(db.rpc.mock.calls[1][1].p_window).toBe("2026-09-16T14:00:00.000Z");
    // Y la ventana diaria se alinea al día, no a la hora de la primera llamada.
    await reserveLimit(db.client, "processing-global", 1, 100, 86400000);
    expect(db.rpc.mock.calls[2][1].p_window).toBe("2026-09-16T00:00:00.000Z");
  });
});

describe("cuota por request (reserveRequest)", () => {
  it("sin secreto de anonimización no se atiende la petición: no hay cuota sin seudónimo", async () => {
    for (const secreto of [undefined, "", "corto", "a".repeat(31)]) {
      const db = makeDb();
      vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", secreto);
      await expect(reserveRequest(db.client, hostiles())).rejects.toMatchObject({
        status: 503,
        code: "not_configured",
      });
      expect(db.rpc).not.toHaveBeenCalled();
    }
  });

  it("guarda un HMAC de la IP, nunca la IP cruda", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", SECRETO);
    const db = makeDb();
    db.rpc.mockResolvedValue({ data: true, error: null });
    await reserveRequest(db.client, hostiles());
    const args = db.rpc.mock.calls[0][1];
    expect(args.p_scope).toBe(`http:${createHmac("sha256", SECRETO).update("203.0.113.77").digest("hex")}`);
    expect(JSON.stringify(args)).not.toContain("203.0.113.77");
    expect(args).toMatchObject({ p_units: 1, p_limit: 120 });
  });

  it("el seudónimo es estable por IP, distinto entre IPs y se rota al rotar el secreto", async () => {
    const scope = async (ip: string, secreto: string) => {
      vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", secreto);
      const db = makeDb();
      db.rpc.mockResolvedValue({ data: true, error: null });
      await reserveRequest(db.client, new Headers({ "x-forwarded-for": ip }));
      return String(db.rpc.mock.calls[0][1].p_scope);
    };
    const a1 = await scope("198.51.100.4", SECRETO);
    const a2 = await scope("198.51.100.4", SECRETO);
    const b = await scope("198.51.100.5", SECRETO);
    const rotado = await scope("198.51.100.4", `${SECRETO}-rotado`);
    expect(a1).toBe(a2); // si cambiara por request, el límite no limitaría nada
    expect(a1).not.toBe(b); // y si no cambiara por IP, limitaría a todo el mundo junto
    expect(a1).not.toBe(rotado);
  });

  /** Las reservas que una petición manda a la RPC, en orden. */
  const reservas = async (headers: Headers, secreto = SECRETO) => {
    vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", secreto);
    const db = makeDb();
    db.rpc.mockResolvedValue({ data: true, error: null });
    await reserveRequest(db.client, headers);
    return db.rpc.mock.calls.map((c) => c[1]);
  };
  /**
   * Cadena de reenvío anómala (más saltos de los que el resolutor tolera) y sin
   * `x-real-ip`: el borde no deja IP confiable, así que la petición es de un
   * visitante IRRESOLUBLE. Es la forma barata de volverse irresoluble a propósito.
   */
  const irresoluble = (visitante: string) =>
    new Headers({
      "x-forwarded-for": [visitante, ...Array.from({ length: 9 }, (_, i) => `10.0.0.${i}`)].join(", "),
    });

  it("dos visitantes irresolubles distintos dejan de pisarse el cupo", async () => {
    // Con un solo cupo para todos los irresolubles, el que está detrás de un
    // proxy raro —o el que se vuelve irresoluble a propósito— agota el cupo de
    // TODOS los demás irresolubles. El cupo propio tiene que separarlos.
    const uno = await reservas(irresoluble("203.0.113.10"));
    const otro = await reservas(irresoluble("203.0.113.11"));
    expect(uno[0].p_scope).not.toBe(otro[0].p_scope);
    // Y el cupo propio es ESTABLE: si cambiara por petición no limitaría nada.
    const mismo = await reservas(irresoluble("203.0.113.10"));
    expect(mismo[0].p_scope).toBe(uno[0].p_scope);
    // La cadena viaja seudonimizada, igual que la IP: nunca en crudo.
    expect(JSON.stringify(uno)).not.toContain("203.0.113.10");
    expect(JSON.stringify(uno)).not.toContain("10.0.0.1");
  });

  it("una cadena nueva por petición no regala cuota infinita: el pozo sin IP tiene techo", async () => {
    // El visitante escribe su propia cadena, así que separarlos por cadena y
    // nada más sería darle un cupo virgen cada vez. Encima del cupo propio hay
    // un techo común a toda la clase sin IP, y ese techo es el tope del daño.
    const uno = await reservas(irresoluble("203.0.113.12"));
    const otro = await reservas(irresoluble("203.0.113.13"));
    const comunes = uno.filter((r) => otro.some((o) => o.p_scope === r.p_scope));
    const propios = uno.filter((r) => !comunes.includes(r));
    // Cada uno reserva su cupo propio Y el techo común: exactamente uno de cada.
    expect([propios.length, comunes.length]).toEqual([1, 1]);
    // El pozo es de muchos, no el cupo de una persona: su techo es más alto.
    expect(Number(comunes[0].p_limit)).toBeGreaterThan(Number(propios[0].p_limit));
  });

  it("sin ninguna pista de red la petición cae en el pozo compartido, no en el cupo de una IP", async () => {
    // Sin XFF ni `x-real-ip` no hay NADA por lo que separar: inventar un cupo
    // por petición sería cuota infinita. Entonces cae en el pozo, que por ser
    // de todos tiene un techo mayor que el de un visitante identificable.
    const sinPistas = await reservas(new Headers());
    const conIp = await reservas(new Headers({ "x-forwarded-for": "198.51.100.9" }));
    expect(sinPistas.every((r) => r.p_scope !== conIp[0].p_scope)).toBe(true);
    expect(Number(sinPistas.at(-1)!.p_limit)).toBeGreaterThan(Number(conIp[0].p_limit));
  });

  it("una cuota que no se puede verificar corta la petición completa", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", SECRETO);
    const db = makeDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "sin conexión" } });
    await expect(reserveRequest(db.client, hostiles())).rejects.toMatchObject({
      status: 503,
      code: "quota_unavailable",
    });
  });
});

describe("interruptor de disponibilidad y forma de los identificadores", () => {
  it("la lectura de documentos está apagada salvo que la bandera diga exactamente true", () => {
    for (const valor of [undefined, "", "false", "TRUE", "True", "1", "true ", "yes"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      const error = sincronoQueLanza(enabled);
      expect(error).toMatchObject({ status: 503, code: "not_configured" });
      // 503: apagado es recuperable y el mensaje ofrece la salida manual.
      expect(error.message).toContain("manualmente");
    }
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    expect(() => enabled()).not.toThrow();
  });

  it("la forma de UUID rechaza todo lo que no sea un identificador legítimo", () => {
    expect(UUID.test(COMPRA)).toBe(true);
    expect(UUID.test(COMPRA.toUpperCase())).toBe(true);
    for (const malo of [
      "",
      "00000000-0000-0000-0000-000000000000", // versión 0
      "33333333-3333-9333-8333-333333333333", // versión fuera de rango
      "33333333-3333-4333-c333-333333333333", // variante inválida
      "33333333-3333-4333-8333-33333333333", // corto
      "33333333-3333-4333-8333-3333333333333", // largo
      "33333333333343338333333333333333", // sin guiones
      `${COMPRA}\n${COMPRA}`, // salto de línea: sin bandera multilínea no pasa
      ` ${COMPRA}`,
      `${COMPRA} or 1=1`,
      "../../etc/passwd",
    ]) {
      expect(UUID.test(malo), malo).toBe(false);
    }
  });
});
