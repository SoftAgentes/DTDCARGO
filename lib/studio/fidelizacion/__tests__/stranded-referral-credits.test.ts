// @vitest-environment node
/**
 * SDD-0495 · Créditos de referido varados sobre una factura ANULADA.
 *
 * El defecto que estas queries hacen visible: `voidInvoice` manda a revertir los
 * créditos aplicados a la factura que se anula y, si la reversión falla, sólo lo
 * escribía en el log. El crédito quedaba 'aplicado' apuntando a una factura
 * anulada y nadie en el Studio se enteraba.
 *
 * Los stubs APLICAN los filtros sobre las filas, como PostgREST — no son no-ops
 * que devuelven el fixture entero. Es la diferencia entre probar la query y
 * probar el `.map()` de abajo: si alguien borra el `.eq("status", "aplicado")`,
 * un stub permisivo sigue en verde porque el resultado se arma igual. Acá no:
 * el fixture trae, a propósito, filas que SÓLO quedan afuera si la query las
 * excluye.
 *
 * ## El stub admin NO filtra por tenant, y eso es el punto
 *
 * `strandedReferralCredits` lee `invoices` con el cliente admin porque
 * `invoices_accounting_select` (migr 0414) se lo niega a `commercial` y
 * `support`, que son justo los roles de la pantalla. El admin no tiene RLS, así
 * que el tenant tiene que ir escrito en la query. El stub admin se comporta como
 * el service role —ve todo el store— para que, si ese `.eq("tenant_id", …)`
 * desaparece, la fila de otro tenant se cuele y la prueba lo cace.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IDS_POR_LOTE, PAGE_SIZE } from "@/lib/db/paginate";

type Row = Record<string, unknown>;

const TENANT = "tenant-A";
const OTRO_TENANT = "tenant-B";

/** Tablas que ven los stubs. El admin ve TODO, como el service role. */
let store: { referrals: Row[]; invoices: Row[] };
/** Lo que pidió cada query: quién, qué tabla, qué columnas y con qué filtros. */
let queries: { cliente: string; table: string; cols: string; filtros: Row }[];
/** Cuántas veces se construyó el cliente admin. */
let adminClients = 0;
/** Qué devuelve `rpc("get_user_tenant_id")` con el cliente de sesión. */
let tenantDeLaSesion: string | null = TENANT;
/**
 * Simula que el acotado por tenant de `referrals` NO surte efecto —una RLS con
 * hueco, o el día que alguien borre el `.eq("tenant_id", …)` de esa query—. Es
 * la única forma de ejercitar la defensa en profundidad del bucle: mientras las
 * dos capas funcionen, la segunda no puede cambiar ningún resultado.
 */
let huecoEnElAcotadoDeReferrals = false;

/**
 * Stub chainable que FILTRA de verdad: eq, is(null), not(col,'is',null), in() y
 * range() se aplican sobre las filas. `range` respeta el corte para que
 * `fetchAllPaged` recorra páginas reales.
 */
function cliente(nombre: string): SupabaseClient {
  return {
    rpc(fn: string) {
      if (fn !== "get_user_tenant_id") throw new Error(`rpc inesperada: ${fn}`);
      return Promise.resolve({ data: tenantDeLaSesion, error: null });
    },
    from(table: "referrals" | "invoices") {
      let rows = [...(store[table] ?? [])];
      const registro = { cliente: nombre, table, cols: "", filtros: {} as Row };
      queries.push(registro);
      // En supabase-js los filtros viven en el builder que devuelve `.select()`;
      // `from()` sólo expone select/insert/update/delete. Un stub que acepte
      // `.eq()` antes del `.select()` deja pasar una cadena que en producción no
      // compila —pasó: lo cazó `tsc`, no esta suite—, así que el stub exige el
      // mismo orden y el error sale acá, que es más barato.
      let seleccionado = false;
      const exigeSelect = (metodo: string) => {
        if (!seleccionado) {
          throw new Error(
            `${metodo}() antes de select(): supabase-js no lo permite sobre ${table}`,
          );
        }
      };
      const chain: Row = {
        select(cols: string) {
          registro.cols = cols;
          seleccionado = true;
          return chain;
        },
        eq(col: string, val: unknown) {
          exigeSelect("eq");
          registro.filtros[col] = val;
          const inerte =
            huecoEnElAcotadoDeReferrals &&
            nombre === "sesión" &&
            table === "referrals" &&
            col === "tenant_id";
          if (!inerte) rows = rows.filter((r) => r[col] === val);
          return chain;
        },
        is(col: string, val: unknown) {
          exigeSelect("is");
          if (val === null) rows = rows.filter((r) => r[col] == null);
          return chain;
        },
        not(col: string, op: string, val: unknown) {
          exigeSelect("not");
          if (op === "is" && val === null) {
            rows = rows.filter((r) => r[col] != null);
          }
          return chain;
        },
        in(col: string, vals: unknown[]) {
          exigeSelect("in");
          rows = rows.filter((r) => vals.includes(r[col]));
          return chain;
        },
        order(col: string) {
          exigeSelect("order");
          rows = [...rows].sort((a, b) =>
            String(a[col] ?? "").localeCompare(String(b[col] ?? "")),
          );
          return chain;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return chain;
        },
        range(from: number, to: number) {
          exigeSelect("range");
          rows = rows.slice(from, to + 1);
          return chain;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({
            data: rows.map((r) => ({ ...r })),
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    adminClients += 1;
    return cliente("admin");
  },
}));

const { strandedCreditsForInvoice, strandedReferralCredits } = await import(
  "../referral-credit-queries"
);

/** La query que hizo el admin sobre `invoices` (o undefined si no la hizo). */
function queryAdminDeFacturas() {
  return queries.find((q) => q.cliente === "admin" && q.table === "invoices");
}

beforeEach(() => {
  queries = [];
  adminClients = 0;
  tenantDeLaSesion = TENANT;
  huecoEnElAcotadoDeReferrals = false;
  store = { referrals: [], invoices: [] };
});

/** Un referido 'aplicado' del tenant del principal, sobre `invoiceId`. */
function referral(id: string, invoiceId: string | null, extra: Row = {}): Row {
  return {
    id,
    tenant_id: TENANT,
    referral_code: `REF-2026-${id}`,
    referrer_markbox: "DTD-5452",
    referred_name: "Ana Pérez",
    reward_usd: 80,
    status: "aplicado",
    deleted_at: null,
    applied_invoice_id: invoiceId,
    ...extra,
  };
}

/** Una factura del tenant del principal. */
function factura(id: string, status: string, extra: Row = {}): Row {
  return { id, tenant_id: TENANT, status, ...extra };
}

describe("strandedReferralCredits · qué cuenta como varado", () => {
  it("un crédito aplicado sobre una factura anulada sale listado", async () => {
    store.referrals = [referral("0001", "inv-anulada")];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits, complete } = await strandedReferralCredits(cliente("sesión"));

    expect(complete).toBe(true);
    expect(credits).toEqual([
      {
        referralId: "0001",
        referralCode: "REF-2026-0001",
        referrerMarkbox: "DTD-5452",
        referredName: "Ana Pérez",
        rewardUsd: 80,
      },
    ]);
  });

  it("no lista nada mientras la factura sigue viva: ahí 'aplicado' es lo normal", async () => {
    store.referrals = [referral("0002", "inv-viva")];
    store.invoices = [factura("inv-viva", "emitida")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
  });

  it("un crédito ya liberado ('acreditado') sobre la MISMA factura anulada no cuenta", async () => {
    // El caso feliz de la reversión: el crédito volvió a 'acreditado'. Si la
    // query dejara de filtrar por estado, este aparecería como varado y el
    // aviso sonaría justo cuando todo salió bien.
    store.referrals = [
      referral("0003", "inv-anulada", { status: "acreditado" }),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
  });

  it("un crédito borrado no cuenta aunque su factura esté anulada", async () => {
    store.referrals = [
      referral("0004", "inv-anulada", { deleted_at: "2026-09-01T00:00:00Z" }),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
  });

  it("un 'aplicado' sin factura (rastro en null) no rompe ni se cuela", async () => {
    store.referrals = [referral("0005", null)];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
  });

  it("dos créditos sobre la MISMA factura anulada salen los dos", async () => {
    // Agrupar por factura para consultar los ids una sola vez no puede
    // colapsar las filas: son dos referidores distintos perdiendo su premio.
    store.referrals = [
      referral("0006", "inv-anulada"),
      referral("0007", "inv-anulada", {
        referrer_markbox: "DTD-9001",
        referred_name: "Luis Rojas",
      }),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits.map((c) => c.referralCode)).toEqual([
      "REF-2026-0006",
      "REF-2026-0007",
    ]);
    expect(credits.map((c) => c.referrerMarkbox)).toEqual([
      "DTD-5452",
      "DTD-9001",
    ]);
  });

  it("separa varados de sanos cuando conviven varias facturas", async () => {
    store.referrals = [
      referral("0008", "inv-anulada"),
      referral("0009", "inv-viva"),
      referral("0010", "inv-otra-anulada"),
    ];
    store.invoices = [
      factura("inv-anulada", "anulada"),
      factura("inv-viva", "parcial"),
      factura("inv-otra-anulada", "anulada"),
    ];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits.map((c) => c.referralCode)).toEqual([
      "REF-2026-0008",
      "REF-2026-0010",
    ]);
  });

  it("coacciona reward_usd cuando PostgREST lo manda como string", async () => {
    store.referrals = [referral("0011", "inv-anulada", { reward_usd: "80.00" })];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits[0].rewardUsd).toBe(80);
  });
});

describe("strandedReferralCredits · el alcance del cliente admin", () => {
  /**
   * La lectura de `invoices` va con admin porque `invoices_accounting_select`
   * (migr 0414) se la niega a los roles de esta pantalla. El admin no tiene RLS:
   * el tenant va escrito en la query, y estas pruebas son las que lo fijan.
   */

  it("una factura anulada de OTRO tenant no marca el crédito como varado", async () => {
    // `applied_invoice_id` tiene FK a invoices, pero la FK NO valida el tenant:
    // un rastro cruzado es representable. Sin el `.eq("tenant_id", …)` de la
    // query admin, esta factura ajena volvería y el crédito saldría listado.
    store.referrals = [referral("0012", "inv-de-otro-tenant")];
    store.invoices = [
      { id: "inv-de-otro-tenant", tenant_id: OTRO_TENANT, status: "anulada" },
    ];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
  });

  it("la query admin lleva el tenant escrito, no implícito", async () => {
    store.referrals = [referral("0013", "inv-anulada")];
    store.invoices = [factura("inv-anulada", "anulada")];

    await strandedReferralCredits(cliente("sesión"));

    expect(queryAdminDeFacturas()?.filtros).toMatchObject({
      tenant_id: TENANT,
      status: "anulada",
    });
  });

  it("los referidos de otro tenant no entran ni a la primera lectura", async () => {
    store.referrals = [
      referral("0014", "inv-anulada"),
      referral("0015", "inv-ajena", { tenant_id: OTRO_TENANT }),
    ];
    store.invoices = [
      factura("inv-anulada", "anulada"),
      { id: "inv-ajena", tenant_id: OTRO_TENANT, status: "anulada" },
    ];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits.map((c) => c.referralCode)).toEqual(["REF-2026-0014"]);
    // Y el id ajeno nunca llegó a la query admin.
    expect(queryAdminDeFacturas()?.filtros).toMatchObject({ tenant_id: TENANT });
  });

  it("si el acotado de referrals fallara, el bucle igual no deja pasar otro tenant", async () => {
    /**
     * Defensa en profundidad, y no es teórica: la segunda lectura corre SIN RLS.
     * El caso peor no es leer una factura ajena —el `.eq("tenant_id")` de la
     * query admin ya la excluye—, es el inverso: un referido de OTRO tenant
     * apuntando a una factura anulada del MÍO. Ese id pasa el filtro de la query
     * admin sin problema, así que lo único que evita pintar el nombre del
     * referidor y del referido ajenos en mi pantalla es el re-filtro del bucle.
     */
    huecoEnElAcotadoDeReferrals = true;
    store.referrals = [
      referral("0016", "inv-anulada"),
      referral("0017", "inv-anulada", {
        tenant_id: OTRO_TENANT,
        referrer_markbox: "DTD-0000",
        referred_name: "Cliente de otro tenant",
      }),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(credits.map((c) => c.referralCode)).toEqual(["REF-2026-0016"]);
    expect(JSON.stringify(credits)).not.toContain("Cliente de otro tenant");
  });

  it("sin tenant resuelto no se consulta nada ni se construye el admin", async () => {
    // Fail-closed: el tenant lo da la base con el cliente de sesión. Si no hay
    // sesión, no hay nada que autorice una lectura sin RLS.
    tenantDeLaSesion = null;
    store.referrals = [referral("0016", "inv-anulada")];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits, complete } = await strandedReferralCredits(cliente("sesión"));

    expect(credits).toEqual([]);
    expect(complete).toBe(true);
    expect(adminClients).toBe(0);
    expect(queries).toHaveLength(0);
  });

  it("sin créditos varados no se construye el cliente admin", async () => {
    store.referrals = [];
    store.invoices = [factura("inv-anulada", "anulada")];

    await strandedReferralCredits(cliente("sesión"));

    expect(adminClients).toBe(0);
  });
});

describe("strandedReferralCredits · lo que NO cruza al cliente", () => {
  it("no devuelve el código ni el id de la factura: el módulo lo ven roles sin dinero", async () => {
    // Fidelización es commercial/support (+admin) en la matriz de rbac; el
    // código de factura es del módulo `invoices` (accounting). La query lo
    // necesita para decidir, pero no puede entregarlo.
    store.referrals = [referral("0017", "inv-anulada")];
    store.invoices = [
      factura("inv-anulada", "anulada", { invoice_code: "F-2026-0007" }),
    ];

    const { credits } = await strandedReferralCredits(cliente("sesión"));

    expect(Object.keys(credits[0]).sort()).toEqual([
      "referralCode",
      "referralId",
      "referredName",
      "referrerMarkbox",
      "rewardUsd",
    ]);
    expect(JSON.stringify(credits)).not.toContain("F-2026-0007");
    expect(JSON.stringify(credits)).not.toContain("inv-anulada");
  });

  it("de invoices sólo pide el id, no la factura entera", async () => {
    store.referrals = [referral("0018", "inv-anulada")];
    store.invoices = [
      factura("inv-anulada", "anulada", { invoice_code: "F-2026-0007" }),
    ];

    await strandedReferralCredits(cliente("sesión"));

    expect(queryAdminDeFacturas()?.cols).toBe("id");
  });
});

describe("strandedReferralCredits · lectura truncada", () => {
  it("la segunda lectura no puede truncar: un lote de ids cabe en una página", () => {
    /**
     * `strandedReferralCredits` **no mira** el `complete` de `fetchAllByIds`, y
     * eso sólo es correcto mientras un lote no pueda llenar una página: como
     * mucho `IDS_POR_LOTE` ids ⇒ como mucho esa cantidad de filas, contra
     * `PAGE_SIZE` por página. Consumirlo sería una condición que ningún caso
     * puede hacer valer —código muerto disfrazado de guarda—; afirmarlo acá sí
     * puede fallar, y falla apuntando al sitio correcto.
     *
     * Las dos constantes viven en otro módulo (`lib/db/paginate.ts`), así que la
     * premisa no es de esta query: es prestada. Si alguien sube `IDS_POR_LOTE`
     * por encima de `PAGE_SIZE`, esta prueba se pone roja y hay que volver a
     * propagar el `complete` de la segunda lectura.
     */
    expect(IDS_POR_LOTE).toBeLessThanOrEqual(PAGE_SIZE);
  });

  it("avisa complete:false en vez de presentar un conteo parcial como total", async () => {
    // Con maxPages=1 y pageSize=1 la primera página nunca vuelve vacía:
    // `fetchAllPaged` se queda sin páginas y lo dice. Los que trae son reales,
    // pero el total no se conoce.
    store.referrals = [
      referral("0019", "inv-anulada"),
      referral("0020", "inv-anulada"),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits, complete } = await strandedReferralCredits(cliente("sesión"), {
      pageSize: 1,
      maxPages: 1,
    });

    expect(complete).toBe(false);
    expect(credits).toHaveLength(1);
  });

  it("con páginas suficientes recorre todo y vuelve complete:true", async () => {
    store.referrals = [
      referral("0021", "inv-anulada"),
      referral("0022", "inv-anulada"),
    ];
    store.invoices = [factura("inv-anulada", "anulada")];

    const { credits, complete } = await strandedReferralCredits(cliente("sesión"), {
      pageSize: 1,
      maxPages: 10,
    });

    expect(complete).toBe(true);
    expect(credits).toHaveLength(2);
  });
});

describe("strandedCreditsForInvoice · la mitad que ve facturación", () => {
  /**
   * Esta mitad NO usa admin: la ve `accounting`, que sí tiene
   * `invoices_accounting_select`, y además sólo lee `referrals`, cuya RLS es por
   * tenant sin condición de rol (migr 0098). Cliente de sesión y punto.
   */

  it("lista los créditos que siguen aplicados a esa factura, sin cliente admin", async () => {
    store.referrals = [
      referral("0023", "inv-anulada"),
      referral("0024", "otra-factura"),
    ];

    const out = await strandedCreditsForInvoice(cliente("sesión"), "inv-anulada");

    expect(out).toEqual([
      { referralId: "0023", referralCode: "REF-2026-0023", rewardUsd: 80 },
    ]);
    expect(adminClients).toBe(0);
  });

  it("no devuelve al referidor ni al referido: facturación no es el módulo del programa", async () => {
    store.referrals = [referral("0025", "inv-anulada")];

    const out = await strandedCreditsForInvoice(cliente("sesión"), "inv-anulada");

    expect(JSON.stringify(out)).not.toContain("DTD-5452");
    expect(JSON.stringify(out)).not.toContain("Ana Pérez");
    // Y NO llegan a leerse: la proyección explícita de arriba los dejaría
    // afuera igual, así que sin esta aserción el `select` podría ensancharse
    // sin que nada lo note. Lo que se pide es lo que se necesita.
    expect(queries).toEqual([
      expect.objectContaining({
        cliente: "sesión",
        table: "referrals",
        cols: "id, referral_code, reward_usd",
      }),
    ]);
  });

  it("ignora los ya liberados y los borrados", async () => {
    store.referrals = [
      referral("0026", "inv-anulada", { status: "acreditado" }),
      referral("0027", "inv-anulada", { deleted_at: "2026-09-01T00:00:00Z" }),
    ];

    const out = await strandedCreditsForInvoice(cliente("sesión"), "inv-anulada");

    expect(out).toEqual([]);
  });

  it("sin id de factura no consulta nada", async () => {
    store.referrals = [referral("0028", "inv-anulada")];

    const out = await strandedCreditsForInvoice(cliente("sesión"), "");

    expect(out).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});
