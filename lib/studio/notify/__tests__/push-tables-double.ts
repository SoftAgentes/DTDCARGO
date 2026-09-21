/**
 * Doble de PostgREST para las dos tablas de suscripciones push (SDD-0499).
 *
 * Existe porque los dobles sueltos que ya había en el repo devuelven la fila
 * pase lo que pase y resuelven `.eq()` como identidad. Con uno así, una prueba
 * de "el borrado está acotado al dueño" sale verde **con el bug adentro**: el
 * filtro que se quiere verificar es justo el que el doble ignora.
 *
 * Así que este aplica los filtros de verdad sobre filas en memoria, y las filas
 * que sobreviven a un `delete` son la aserción.
 *
 * No intenta ser PostgREST: es deliberadamente ESTRECHO y tira ante cualquier
 * operación que no implemente. Un doble más permisivo que `supabase-js` mentiría
 * en la otra dirección —dejaría pasar cadenas que la biblioteca real rechaza— y
 * eso ya costó caro antes en este repo.
 */

export type Fila = Record<string, unknown>;

interface Filtro {
  col: string;
  valores: unknown[];
}

export interface PushDouble {
  /** Estado vivo: lo que quedó en cada tabla después de las operaciones. */
  tablas: Record<string, Fila[]>;
  /** Cliente con la forma mínima de `createAdminClient()`. */
  client: { from(table: string): unknown };
}

export function makePushDouble(inicial: Record<string, Fila[]>): PushDouble {
  const tablas: Record<string, Fila[]> = {};
  for (const [t, filas] of Object.entries(inicial)) {
    tablas[t] = filas.map((f) => ({ ...f }));
  }

  function filas(table: string): Fila[] {
    const t = tablas[table];
    if (!t) throw new Error(`doble: tabla no declarada "${table}"`);
    return t;
  }

  function from(table: string) {
    const filtros: Filtro[] = [];
    let modo: "select" | "delete" | null = null;

    const coincide = (fila: Fila) =>
      filtros.every((f) => f.valores.some((v) => fila[f.col] === v));

    const ejecutar = () => {
      if (modo === "delete") {
        const quedan = filas(table).filter((f) => !coincide(f));
        tablas[table] = quedan;
        return { data: null, error: null };
      }
      if (modo === "select") {
        return { data: filas(table).filter(coincide), error: null };
      }
      throw new Error("doble: cadena sin select/delete/insert/upsert");
    };

    const chain: Record<string, unknown> = {
      select(...args: unknown[]) {
        // `.insert(...).select()` devuelve lo insertado; acá sólo se usa la
        // forma de lectura, así que una llamada sin columnas es un error.
        if (args.length === 0) throw new Error("doble: select() sin columnas");
        modo = "select";
        return chain;
      },
      delete() {
        modo = "delete";
        return chain;
      },
      eq(col: string, valor: unknown) {
        filtros.push({ col, valores: [valor] });
        return chain;
      },
      in(col: string, valores: unknown[]) {
        filtros.push({ col, valores });
        return chain;
      },
      async insert(payload: Fila) {
        if (filas(table).some((f) => f.endpoint === payload.endpoint)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        filas(table).push({ ...payload });
        return { data: null, error: null };
      },
      async upsert(payload: Fila, opts?: { onConflict?: string }) {
        const col = opts?.onConflict;
        if (!col) throw new Error("doble: upsert sin onConflict");
        const i = filas(table).findIndex((f) => f[col] === payload[col]);
        if (i >= 0) filas(table)[i] = { ...payload };
        else filas(table).push({ ...payload });
        return { data: null, error: null };
      },
      async maybeSingle() {
        const { data, error } = ejecutar() as { data: Fila[] | null; error: unknown };
        if (error) return { data: null, error };
        if (data && data.length > 1) {
          return { data: null, error: { message: "más de una fila" } };
        }
        return { data: data?.[0] ?? null, error: null };
      },
      // Cadena terminada con `await` directo (el caso del delete).
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve(ejecutar()).then(resolve);
      },
    };
    return chain;
  }

  return { tablas, client: { from } };
}
