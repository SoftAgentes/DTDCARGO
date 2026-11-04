// @vitest-environment node
/**
 * SDD-0599 · Reintentar un envío del portal no lo duplica.
 *
 * El doble aplica los filtros, y aquí se le suma lo que hace la base con la 0512: el índice
 * único responde 23505 con su nombre. `sin0512` responde como una base sin la columna: el
 * código tiene que seguir funcionando, como hoy. Lo que el índice hace de verdad, incluso con
 * dos intentos, lo prueba el contrato `supabase/tests/0512_portal_intento_sin_duplicar.test.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_A,
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";
import { isMissingClientRequestColumn } from "@/lib/shared/client-request";

const h = vi.hoisted(() => ({
  db: null as unknown,
  subidas: [] as string[],
  avisoCotizacion: vi.fn(),
  avisoMensaje: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.db }));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({ fireWorkflowEvent: vi.fn() }));
vi.mock("@/lib/studio/cotizacion-request-notify", () => ({ notifyCotizacionRequestToAdmin: h.avisoCotizacion }));
vi.mock("@/lib/studio/conversation-inbound-notify", () => ({ notifyConversationInbound: h.avisoMensaje }));

import { createPrealertaAction, updatePrealertaDetalleAction } from "./(app)/proveedores/actions";
import { requestCotizacionAction } from "./(app)/cotizaciones/actions";
import { createPortalClaimAction } from "./(app)/reclamos/actions";
import { sendPortalMessageAction } from "./(app)/mensajes/actions";
import { addAddressAction } from "./(app)/perfil/address-actions";

const INTENTO = "11111111-2222-4333-8444-555555555555";
const OTRO_INTENTO = "11111111-2222-4333-8444-666666666666";
const CON_CANDADO = new Set(["prealertas", "quotes", "client_claims"]);

type Opciones = {
  /** La base todavía no tiene la 0512. */
  sin0512?: boolean;
  /** La primera búsqueda no ve la fila: otro intento la creó justo después. */
  carrera?: boolean;
  /** Códigos de compra ya tomados por otra compra. */
  codigosOcupados?: string[];
};

/** Lo que la 0512 hace en la base, sobre el doble que ya aplica los filtros. */
function conLa0512(double: PortalDouble, opciones: Opciones): SupabaseClient {
  const base = double.db as unknown as {
    from(table: string): Record<string, (...args: never[]) => never>;
    rpc(name: string, args: Row): Promise<unknown>;
    auth: unknown;
  };
  let carrera = opciones.carrera ?? false;

  const fallaInsert = (error: { code: string; message: string }) => ({
    select: () => ({
      single: async () => ({ data: null, error }),
      maybeSingle: async () => ({ data: null, error }),
    }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error }).then(resolve),
  });

  return {
    auth: base.auth,
    storage: {
      from: () => ({
        upload: async (path: string) => {
          h.subidas.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    rpc: async (name: string, args: Row) => {
      if (name === "portal_post_message" && opciones.sin0512 && "p_request_id" in args) {
        return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
      }
      return base.rpc(name, args);
    },
    from(table: string) {
      const real = base.from(table);
      if (!CON_CANDADO.has(table)) return real;
      return {
        ...real,
        insert(fila: Row) {
          if (fila.client_request_id && opciones.sin0512) {
            return fallaInsert({ code: "PGRST204", message: `Could not find the 'client_request_id' column of '${table}' in the schema cache` });
          }
          const yaEsta = fila.client_request_id && double.store[table]?.some((r) =>
            r.tenant_id === fila.tenant_id
            && r.client_markbox === fila.client_markbox
            && r.client_request_id === fila.client_request_id);
          if (yaEsta) {
            return fallaInsert({ code: "23505", message: `duplicate key value violates unique constraint "${table}_client_request_uidx"` });
          }
          if (table === "prealertas" && opciones.codigosOcupados?.includes(fila.code as string)) {
            return fallaInsert({ code: "23505", message: 'duplicate key value violates unique constraint "prealertas_tenant_id_code_key"' });
          }
          return (real.insert as unknown as (row: Row) => never)(fila);
        },
        select(...args: unknown[]) {
          const consulta = (real.select as unknown as (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown>)(...args);
          let porIntento = false;
          const envoltura: Record<string, unknown> = new Proxy(consulta, {
            get(objetivo, clave: string) {
              if (clave === "eq") {
                return (columna: string, valor: unknown) => {
                  if (columna === "client_request_id") porIntento = true;
                  objetivo.eq(columna, valor);
                  return envoltura;
                };
              }
              if (clave === "is") {
                return (columna: string, valor: unknown) => {
                  objetivo.is(columna, valor);
                  return envoltura;
                };
              }
              if (clave === "maybeSingle") {
                return async () => {
                  if (porIntento && opciones.sin0512) {
                    return { data: null, error: { code: "42703", message: `column ${table}.client_request_id does not exist` } };
                  }
                  if (porIntento && carrera) {
                    carrera = false;
                    return { data: null, error: null };
                  }
                  return objetivo.maybeSingle();
                };
              }
              const valor = objetivo[clave];
              return typeof valor === "function" ? valor.bind(objetivo) : valor;
            },
          });
          return envoltura;
        },
      };
    },
  } as unknown as SupabaseClient;
}

function montar(filas: Record<string, Row[]> = {}, opciones: Opciones = {}): PortalDouble {
  let compra = 0;
  let cotizacion = 0;
  let reclamo = 0;
  const double = portalDouble({
    tables: {
      client_users: [portalMembership()],
      suppliers_cn: [{
        id: "sup-a", tenant_id: TENANT_A, client_markbox: MARKBOX, supplier_seq: 1, name: "Proveedor A", deleted_at: null,
      }],
      ...filas,
    },
    rpc: {
      next_order_seq: () => ++compra,
      next_estimate_code: () => `EST-${++cotizacion}`,
      next_claim_code_service: () => `RC-${++reclamo}`,
    },
  });
  h.db = conLa0512(double, opciones);
  return double;
}

function form(campos: Record<string, string | File>): FormData {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor);
  return datos;
}

const pdf = (nombre: string) => new File(["contenido"], nombre, { type: "application/pdf" });
const compra = (extra: Record<string, string | File> = {}) =>
  form({ supplierId: "sup-a", description: "3 cajas de zapatos", boxes: "3", ...extra });
const cotizacion = (extra: Record<string, string> = {}) =>
  form({ service: "consolidado_lcl", description: "200 sillas", origin: "China", destination: "Caracas", ...extra });
const reclamo = (extra: Record<string, string | File> = {}) =>
  form({ claim_type: "otro", description: "Llegó una caja abierta", ...extra });
const rpcDe = (double: PortalDouble, nombre: string) => double.rpcCalls.filter((c) => c.name === nombre);
const BORRADA = "2026-11-01T00:00:00Z";
/** Más largo que los 200 caracteres que guarda la columna. */
const NOMBRE_LARGO = `${"a".repeat(250)}.pdf`;

beforeEach(() => {
  h.subidas.length = 0;
  h.avisoCotizacion.mockReset();
  h.avisoMensaje.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("compras", () => {
  it("el mismo intento deja una sola compra, con el mismo código y un solo correlativo", async () => {
    const double = montar();
    const primero = await createPrealertaAction({}, compra({ request_id: INTENTO }));
    const segundo = await createPrealertaAction({}, compra({ request_id: INTENTO }));

    expect(primero).toMatchObject({ ok: true, prealertaCode: expect.any(String) });
    expect(primero.replayed).toBeUndefined();
    expect(segundo).toMatchObject({ ok: true, prealertaCode: primero.prealertaCode, replayed: true });
    expect(double.store.prealertas).toHaveLength(1);
    expect(double.store.prealertas[0].client_request_id).toBe(INTENTO);
    expect(rpcDe(double, "next_order_seq")).toHaveLength(1);
  });

  it("otro intento es otra compra", async () => {
    const double = montar();
    await createPrealertaAction({}, compra({ request_id: INTENTO }));
    await createPrealertaAction({}, compra({ request_id: OTRO_INTENTO }));

    expect(double.store.prealertas).toHaveLength(2);
  });

  it("sin identificador, o con uno inválido, cada envío es una compra, como hoy", async () => {
    const double = montar();
    await createPrealertaAction({}, compra());
    await createPrealertaAction({}, compra({ request_id: "no-es-un-uuid" }));

    expect(double.store.prealertas).toHaveLength(2);
    expect(double.store.prealertas.every((p) => p.client_request_id === undefined)).toBe(true);
  });

  it("el mismo identificador en otro Shipping Mark u otro tenant no encuentra esa compra", async () => {
    const double = montar({
      prealertas: [
        { id: "ajena-1", tenant_id: TENANT_A, client_markbox: "DTD-9999", code: "AJENA-1", client_request_id: INTENTO, deleted_at: null },
        { id: "ajena-2", tenant_id: TENANT_B, client_markbox: MARKBOX, code: "AJENA-2", client_request_id: INTENTO, deleted_at: null },
      ],
    });
    const resultado = await createPrealertaAction({}, compra({ request_id: INTENTO }));

    expect(resultado.replayed).toBeUndefined();
    expect(resultado.prealertaCode).not.toMatch(/AJENA/);
    expect(double.store.prealertas).toHaveLength(3);
  });

  it("dos intentos a la vez: el que choca en el índice responde la compra del otro", async () => {
    const double = montar(
      { prealertas: [{ id: "gano", tenant_id: TENANT_A, client_markbox: MARKBOX, code: "GANO-1", share_token: "t", client_request_id: INTENTO, deleted_at: null }] },
      { carrera: true },
    );
    const resultado = await createPrealertaAction({}, compra({ request_id: INTENTO }));

    expect(resultado).toMatchObject({ ok: true, prealertaCode: "GANO-1", shareToken: "t", replayed: true });
    expect(double.store.prealertas).toHaveLength(1);
    expect(rpcDe(double, "next_order_seq")).toHaveLength(1);
  });

  it("el choque de un código sigue reintentando con otro correlativo", async () => {
    const primerCodigo = "DTD-0001-1-1";
    const double = montar({}, { codigosOcupados: [primerCodigo] });
    const resultado = await createPrealertaAction({}, compra({ request_id: INTENTO }));

    expect(resultado.ok).toBe(true);
    expect(resultado.replayed).toBeUndefined();
    expect(resultado.prealertaCode).not.toBe(primerCodigo);
    expect(rpcDe(double, "next_order_seq")).toHaveLength(2);
  });

  it("el reintento no sube otra vez un adjunto, y sube el que faltó", async () => {
    const double = montar();
    await createPrealertaAction({}, compra({ request_id: INTENTO, doc_packing: pdf("packing.pdf") }));
    expect(h.subidas).toHaveLength(1);

    const segundo = await createPrealertaAction({}, compra({
      request_id: INTENTO,
      doc_packing: pdf("packing.pdf"),
      doc_factura: pdf("factura.pdf"),
    }));

    expect(segundo.replayed).toBe(true);
    expect(h.subidas).toHaveLength(2);
    expect(double.store.prealerta_documents.map((d) => d.file_name)).toEqual(["packing.pdf", "factura.pdf"]);
  });

  it("un adjunto de nombre largo tampoco se repite, aunque se guarde recortado", async () => {
    montar();
    await createPrealertaAction({}, compra({ request_id: INTENTO, doc_packing: pdf(NOMBRE_LARGO) }));
    await createPrealertaAction({}, compra({ request_id: INTENTO, doc_packing: pdf(NOMBRE_LARGO) }));

    expect(h.subidas).toHaveLength(1);
  });

  it("un adjunto borrado se puede volver a subir", async () => {
    montar({
      prealertas: [{ id: "pre-1", tenant_id: TENANT_A, client_markbox: MARKBOX, code: "P-1", client_request_id: INTENTO, deleted_at: null }],
      prealerta_documents: [{
        id: "doc-1", tenant_id: TENANT_A, prealerta_id: "pre-1", doc_type: "packing", file_name: "packing.pdf", size_bytes: pdf("packing.pdf").size, deleted_at: BORRADA,
      }],
    });
    const resultado = await createPrealertaAction({}, compra({ request_id: INTENTO, doc_packing: pdf("packing.pdf") }));

    expect(resultado.replayed).toBe(true);
    expect(h.subidas).toHaveLength(1);
  });

  it("el reintento pide el servicio que el primer envío no alcanzó a pedir", async () => {
    const double = montar();
    await createPrealertaAction({}, compra({ request_id: INTENTO }));
    expect(double.store.prealerta_service_requests ?? []).toHaveLength(0);

    const segundo = await createPrealertaAction({}, compra({ request_id: INTENTO, consent: "on", addon: "cotizar_medir" }));

    expect(segundo.replayed).toBe(true);
    expect(double.store.prealerta_service_requests.map((s) => s.addon_code)).toEqual(["cotizar_medir"]);
  });

  // Describe un límite, no algo deseable: el índice no mira `deleted_at`, así que el intento sigue
  // tomado, y el identificador sólo cambia tras `ok`. No duplica ni pierde lo escrito; recargar lo resuelve.
  it("límite conocido: con la compra borrada, cada reintento gasta un correlativo y falla hasta recargar", async () => {
    const double = montar({
      prealertas: [{ id: "borrada", tenant_id: TENANT_A, client_markbox: MARKBOX, code: "BORRADA-1", client_request_id: INTENTO, deleted_at: BORRADA }],
    });
    const intentos = [
      await createPrealertaAction({}, compra({ request_id: INTENTO })),
      await createPrealertaAction({}, compra({ request_id: INTENTO })),
    ];

    for (const resultado of intentos) {
      expect(resultado.replayed).toBeUndefined();
      expect(resultado.prealertaCode).toBeUndefined();
      expect(resultado.error).toBeTruthy();
    }
    expect(double.store.prealertas).toHaveLength(1);
    expect(rpcDe(double, "next_order_seq")).toHaveLength(2);
  });

  it("completar el detalle dos veces tampoco repite el adjunto", async () => {
    const double = montar({
      prealertas: [{ id: "pre-1", tenant_id: TENANT_A, client_markbox: MARKBOX, code: "P-1", supplier_id: "sup-a", status: "anunciada", deleted_at: null }],
    });
    const detalle = () => form({ prealertaCode: "P-1", description: "Detalle", boxes: "2", doc_packing: pdf("packing.pdf") });
    await updatePrealertaDetalleAction({}, detalle());
    await updatePrealertaDetalleAction({}, detalle());

    expect(double.store.prealerta_documents).toHaveLength(1);
  });

  it("sin 0512 la compra entra sin candado, sin romper", async () => {
    const double = montar({}, { sin0512: true });
    const resultado = await createPrealertaAction({}, compra({ request_id: INTENTO }));

    expect(resultado.ok).toBe(true);
    expect(double.store.prealertas).toHaveLength(1);
    expect(double.store.prealertas[0].client_request_id).toBeUndefined();
  });
});

describe("cotizaciones", () => {
  it("el mismo intento deja una sola cotización, un correlativo y un aviso al asesor", async () => {
    const double = montar();
    const primero = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));
    const segundo = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(primero).toEqual({ ok: true, createdCode: "EST-1" });
    expect(segundo).toEqual({ ok: true, createdCode: "EST-1", replayed: true });
    expect(double.store.quotes).toHaveLength(1);
    expect(double.store.quotes[0].client_request_id).toBe(INTENTO);
    expect(rpcDe(double, "next_estimate_code")).toHaveLength(1);
    expect(h.avisoCotizacion).toHaveBeenCalledOnce();
  });

  it("dos intentos a la vez: el que choca responde la cotización del otro, sin avisar", async () => {
    const double = montar(
      { quotes: [{ id: "gano", tenant_id: TENANT_A, client_markbox: MARKBOX, quote_code: "EST-GANO", client_request_id: INTENTO, deleted_at: null }] },
      { carrera: true },
    );
    const resultado = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true, createdCode: "EST-GANO", replayed: true });
    expect(double.store.quotes).toHaveLength(1);
    expect(h.avisoCotizacion).not.toHaveBeenCalled();
  });

  it("el mismo identificador en otro Shipping Mark no encuentra esa cotización", async () => {
    const double = montar({
      quotes: [{ id: "ajena", tenant_id: TENANT_A, client_markbox: "DTD-9999", quote_code: "EST-AJENA", client_request_id: INTENTO, deleted_at: null }],
    });
    const resultado = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true, createdCode: "EST-1" });
    expect(double.store.quotes).toHaveLength(2);
  });

  it("el mismo identificador en otro tenant no encuentra esa cotización", async () => {
    const double = montar({
      quotes: [{ id: "ajena", tenant_id: TENANT_B, client_markbox: MARKBOX, quote_code: "EST-AJENA", client_request_id: INTENTO, deleted_at: null }],
    });
    const resultado = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true, createdCode: "EST-1" });
    expect(double.store.quotes).toHaveLength(2);
  });

  it("límite conocido: con la cotización borrada, el reintento gasta un correlativo y falla", async () => {
    const double = montar({
      quotes: [{ id: "borrada", tenant_id: TENANT_A, client_markbox: MARKBOX, quote_code: "EST-BORRADA", client_request_id: INTENTO, deleted_at: BORRADA }],
    });
    const resultado = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(resultado.replayed).toBeUndefined();
    expect(resultado.createdCode).toBeUndefined();
    expect(resultado.error).toBeTruthy();
    expect(double.store.quotes).toHaveLength(1);
    expect(rpcDe(double, "next_estimate_code")).toHaveLength(1);
  });

  it("sin 0512 la cotización entra sin candado, sin romper", async () => {
    const double = montar({}, { sin0512: true });
    const resultado = await requestCotizacionAction({}, cotizacion({ request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true, createdCode: "EST-1" });
    expect(double.store.quotes[0].client_request_id).toBeUndefined();
  });
});

describe("reclamos", () => {
  it("el mismo intento deja un solo reclamo, y la evidencia no se repite", async () => {
    const double = montar();
    const primero = await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf("foto.pdf") }));
    const segundo = await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf("foto.pdf") }));

    expect(primero).toMatchObject({ ok: true, createdCode: "RC-1", evidenceSkipped: false });
    expect(primero.replayed).toBeUndefined();
    expect(segundo).toMatchObject({ ok: true, createdCode: "RC-1", evidenceSkipped: false, replayed: true });
    expect(double.store.client_claims).toHaveLength(1);
    expect(rpcDe(double, "next_claim_code_service")).toHaveLength(1);
    expect(double.store.client_claim_evidence).toHaveLength(1);
  });

  it("el reintento sube la evidencia que el primero no alcanzó a dejar", async () => {
    const double = montar();
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf("foto.pdf") }));

    expect(double.store.client_claim_evidence).toHaveLength(1);
  });

  it("dos intentos a la vez: el que choca responde el reclamo del otro", async () => {
    const double = montar(
      { client_claims: [{ id: "gano", tenant_id: TENANT_A, client_markbox: MARKBOX, claim_code: "RC-GANO", client_request_id: INTENTO, deleted_at: null }] },
      { carrera: true },
    );
    const resultado = await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));

    expect(resultado).toMatchObject({ ok: true, createdCode: "RC-GANO", replayed: true });
    expect(double.store.client_claims).toHaveLength(1);
  });

  it("el mismo identificador en otro Shipping Mark no encuentra ese reclamo", async () => {
    const double = montar({
      client_claims: [{ id: "ajeno", tenant_id: TENANT_A, client_markbox: "DTD-9999", claim_code: "RC-AJENO", client_request_id: INTENTO, deleted_at: null }],
    });
    const resultado = await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));

    expect(resultado).toMatchObject({ ok: true, createdCode: "RC-1" });
    expect(double.store.client_claims).toHaveLength(2);
  });

  it("el mismo identificador en otro tenant no encuentra ese reclamo", async () => {
    const double = montar({
      client_claims: [{ id: "ajeno", tenant_id: TENANT_B, client_markbox: MARKBOX, claim_code: "RC-AJENO", client_request_id: INTENTO, deleted_at: null }],
    });
    const resultado = await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));

    expect(resultado).toMatchObject({ ok: true, createdCode: "RC-1" });
    expect(double.store.client_claims).toHaveLength(2);
  });

  it("límite conocido: con el reclamo borrado, el reintento gasta un correlativo y falla", async () => {
    const double = montar({
      client_claims: [{ id: "borrado", tenant_id: TENANT_A, client_markbox: MARKBOX, claim_code: "RC-BORRADO", client_request_id: INTENTO, deleted_at: BORRADA }],
    });
    const resultado = await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));

    expect(resultado.replayed).toBeUndefined();
    expect(resultado.createdCode).toBeUndefined();
    expect(resultado.error).toBeTruthy();
    expect(double.store.client_claims).toHaveLength(1);
    expect(rpcDe(double, "next_claim_code_service")).toHaveLength(1);
  });

  it("el reintento avisa si un archivo no se pudo tomar", async () => {
    montar();
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));
    const segundo = await createPortalClaimAction({}, reclamo({
      request_id: INTENTO,
      evidence: new File(["x"], "programa.exe", { type: "application/x-msdownload" }),
    }));

    expect(segundo).toMatchObject({ replayed: true, evidenceSkipped: true });
  });

  it("la evidencia de otro reclamo no cuenta como subida", async () => {
    const double = montar({
      client_claims: [{ id: "gano", tenant_id: TENANT_A, client_markbox: MARKBOX, claim_code: "RC-GANO", client_request_id: INTENTO, deleted_at: null }],
      client_claim_evidence: [{ id: "de-otro", tenant_id: TENANT_A, claim_id: "otro", file_name: "foto.pdf", size_bytes: pdf("foto.pdf").size }],
    });
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf("foto.pdf") }));

    expect(double.store.client_claim_evidence).toHaveLength(2);
  });

  it("la evidencia de nombre largo tampoco se repite, aunque se guarde recortada", async () => {
    const double = montar();
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf(NOMBRE_LARGO) }));
    await createPortalClaimAction({}, reclamo({ request_id: INTENTO, evidence: pdf(NOMBRE_LARGO) }));

    expect(double.store.client_claim_evidence).toHaveLength(1);
  });

  it("sin 0512 el reclamo entra sin candado, sin romper", async () => {
    const double = montar({}, { sin0512: true });
    const resultado = await createPortalClaimAction({}, reclamo({ request_id: INTENTO }));

    expect(resultado).toMatchObject({ ok: true, createdCode: "RC-1" });
    expect(double.store.client_claims[0].client_request_id).toBeUndefined();
  });
});

describe("mensajes", () => {
  const conRespuesta = (respuesta: unknown) => {
    const double = portalDouble({ tables: { client_users: [portalMembership()] }, rpc: { portal_post_message: respuesta } });
    h.db = conLa0512(double, {});
    return double;
  };

  it("envía el identificador a la firma nueva y avisa al equipo", async () => {
    const double = conRespuesta({ conversation_id: "conv-1", replayed: false });
    const resultado = await sendPortalMessageAction({}, form({ body: "Hola", request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true });
    expect(rpcDe(double, "portal_post_message")[0].args).toEqual({ p_body: "Hola", p_request_id: INTENTO });
    expect(h.avisoMensaje).toHaveBeenCalledOnce();
  });

  it("si ya había llegado, lo dice y no avisa otra vez", async () => {
    conRespuesta({ conversation_id: "conv-1", replayed: true });
    const resultado = await sendPortalMessageAction({}, form({ body: "Hola", request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true, replayed: true });
    expect(h.avisoMensaje).not.toHaveBeenCalled();
  });

  it("sin identificador usa la firma de siempre", async () => {
    const double = conRespuesta("conv-1");
    const resultado = await sendPortalMessageAction({}, form({ body: "Hola" }));

    expect(resultado).toEqual({ ok: true });
    expect(rpcDe(double, "portal_post_message")[0].args).toEqual({ p_body: "Hola" });
    expect(h.avisoMensaje).toHaveBeenCalledOnce();
  });

  it("sin 0512 cae a la firma de siempre, sin romper", async () => {
    const double = portalDouble({ tables: { client_users: [portalMembership()] }, rpc: { portal_post_message: "conv-1" } });
    h.db = conLa0512(double, { sin0512: true });
    const resultado = await sendPortalMessageAction({}, form({ body: "Hola", request_id: INTENTO }));

    expect(resultado).toEqual({ ok: true });
    expect(rpcDe(double, "portal_post_message").map((c) => c.args)).toEqual([{ p_body: "Hola" }]);
    expect(h.avisoMensaje).toHaveBeenCalledOnce();
  });

  it("si la firma nueva falla por otra razón, no reenvía sin candado", async () => {
    conRespuesta("conv-1");
    const llamadas: Row[] = [];
    h.db = {
      ...(h.db as object),
      rpc: async (_nombre: string, args: Row) => {
        llamadas.push(args);
        return { data: null, error: { code: "XX000", message: "falla de la base" } };
      },
    };
    const resultado = await sendPortalMessageAction({}, form({ body: "Hola", request_id: INTENTO }));

    expect(resultado.error).toBeTruthy();
    expect(llamadas).toEqual([{ p_body: "Hola", p_request_id: INTENTO }]);
    expect(h.avisoMensaje).not.toHaveBeenCalled();
  });
});

describe("direcciones", () => {
  const direccion = (extra: Record<string, string> = {}) =>
    form({ label: "Casa", line: "Calle 1", city: "Caracas", state: "Distrito Capital", reference: "Frente a la plaza", ...extra });
  const vivas = (double: PortalDouble) => double.store.client_delivery_addresses ?? [];

  it("la misma dirección otra vez no crea otra fila", async () => {
    const double = montar();
    await addAddressAction({}, direccion());
    const segundo = await addAddressAction({}, direccion());

    expect(segundo).toEqual({ ok: true });
    expect(vivas(double)).toHaveLength(1);
    expect(vivas(double)[0].client_id).toBe(CLIENT_A);
  });

  it("otra dirección sí entra", async () => {
    const double = montar();
    await addAddressAction({}, direccion());
    await addAddressAction({}, direccion({ line: "Calle 2" }));

    expect(vivas(double)).toHaveLength(2);
  });

  it.each([
    ["el nombre", { label: "Oficina" }],
    ["la ciudad", { city: "Valencia" }],
    ["la ciudad del catálogo", { citySlug: "valencia" }],
    ["el estado", { state: "Carabobo" }],
    ["la referencia", { reference: "Al lado del banco" }],
  ])("si cambia %s, es otra dirección", async (_campo, cambio) => {
    const double = montar();
    await addAddressAction({}, direccion());
    await addAddressAction({}, direccion(cambio));

    expect(vivas(double)).toHaveLength(2);
  });

  it("si la repetida se pide como predeterminada, queda predeterminada, sin otra fila", async () => {
    const double = montar();
    await addAddressAction({}, direccion());
    await addAddressAction({}, direccion({ isDefault: "on" }));

    expect(vivas(double)).toHaveLength(1);
    expect(vivas(double)[0].is_default).toBe(true);
  });
});

describe("qué error es cuál", () => {
  it("la columna faltante es la del candado, no otra", () => {
    expect(isMissingClientRequestColumn({ code: "PGRST204", message: "Could not find the 'client_request_id' column" })).toBe(true);
    expect(isMissingClientRequestColumn({ code: "42703", message: "column quotes.client_request_id does not exist" })).toBe(true);
    expect(isMissingClientRequestColumn({ code: "PGRST204", message: "Could not find the 'otra_columna' column" })).toBe(false);
    expect(isMissingClientRequestColumn(null)).toBe(false);
  });
});
