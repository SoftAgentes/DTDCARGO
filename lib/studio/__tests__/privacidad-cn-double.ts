/**
 * Doble de PostgREST para SDD-0531 — APLICA los filtros y devuelve COPIAS.
 *
 * Lo que se prueba depende de QUÉ fila lee cada consulta: la membresía del
 * usuario de la sesión (y no la de un compañero, ni la desactivada), la
 * ubicación de ESTE envío y no la de otro, el nombre del embarque de ESTA pieza.
 * Un doble que devuelve la primera fila pase lo que pase bendice justo los
 * defectos que importan, así que este:
 *
 *  - aplica `eq/neq/is/in/not/gte/lte/ilike`, ordena con `order` y corta con
 *    `limit`/`range`, como PostgREST;
 *  - registra `or` sin filtrar (no es un motor de búsqueda);
 *  - devuelve COPIAS profundas: mutar lo leído no cambia el store, y un
 *    ocultamiento que mutara su entrada se notaría en la siguiente lectura;
 *  - LANZA si un filtro se llama antes de `select()`, como supabase-js;
 *  - registra las escrituras (`insert`/`update`) sin aplicarlas: la prueba
 *    afirma sobre lo que se INTENTÓ escribir.
 *
 * `fallar` hace que la lectura de esa tabla devuelva error, para probar que la
 * duda oculta en vez de mostrar.
 */

export type Fila = Record<string, unknown>;

export interface Escritura {
  table: string;
  op: "insert" | "update";
  row: Fila;
  filtros: [string, string, unknown][];
}

export interface OpcionesDoble {
  /** `null` o ausente = sin sesión. */
  userId?: string | null;
  tablas?: Record<string, Fila[]>;
  rpc?: Record<string, { data: unknown; error: unknown }>;
  /** Tablas cuya lectura responde con error. */
  fallar?: string[];
}

export interface Doble {
  client: unknown;
  escrituras: Escritura[];
  lecturas: string[];
  rpcLlamadas: { name: string; args: Fila }[];
}

const copiar = <T>(v: T): T => structuredClone(v);

function listaPostgrest(raw: unknown): string[] {
  return String(raw)
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function comparar(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
}

export function dobleSupabase(opciones: OpcionesDoble = {}): Doble {
  const escrituras: Escritura[] = [];
  const lecturas: string[] = [];
  const rpcLlamadas: { name: string; args: Fila }[] = [];
  const tablas = opciones.tablas ?? {};
  const fallar = new Set(opciones.fallar ?? []);

  function lectura(table: string, opts?: { count?: string; head?: boolean }) {
    lecturas.push(table);
    let visibles = copiar(tablas[table] ?? []);
    let tope = Infinity;
    const contar = opts?.count === "exact";
    const head = opts?.head === true;
    const error = fallar.has(table)
      ? { code: "XX000", message: `doble: ${table} falla a propósito` }
      : null;

    const resolver = (filas: Fila[], total: number) =>
      error
        ? { data: null, error, count: null }
        : {
            data: head ? null : copiar(filas),
            error: null,
            count: contar ? total : null,
          };

    const chain: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        visibles = visibles.filter((r) => r[col] === val);
        return chain;
      },
      neq(col: string, val: unknown) {
        visibles = visibles.filter((r) => r[col] !== val);
        return chain;
      },
      is(col: string, val: unknown) {
        visibles =
          val === null
            ? visibles.filter((r) => r[col] == null)
            : visibles.filter((r) => r[col] === val);
        return chain;
      },
      in(col: string, vals: unknown[]) {
        visibles = visibles.filter((r) => vals.includes(r[col]));
        return chain;
      },
      not(col: string, op: string, val: unknown) {
        if (op === "in") {
          const fuera = listaPostgrest(val);
          visibles = visibles.filter((r) => !fuera.includes(String(r[col])));
        } else if (op === "is" && val === null) {
          visibles = visibles.filter((r) => r[col] != null);
        } else {
          throw new Error(`doble: not(${col}, ${op}) sin modelar`);
        }
        return chain;
      },
      gte(col: string, val: string | number) {
        visibles = visibles.filter((r) => r[col] != null && (r[col] as string) >= val);
        return chain;
      },
      lte(col: string, val: string | number) {
        visibles = visibles.filter((r) => r[col] != null && (r[col] as string) <= val);
        return chain;
      },
      ilike(col: string, patron: string) {
        const aguja = patron.replace(/%/g, "").toLowerCase();
        visibles = visibles.filter((r) =>
          String(r[col] ?? "").toLowerCase().includes(aguja),
        );
        return chain;
      },
      or() {
        return chain;
      },
      returns() {
        return chain;
      },
      order(col: string, o?: { ascending?: boolean }) {
        const asc = o?.ascending !== false;
        visibles = [...visibles].sort((a, b) =>
          asc ? comparar(a[col], b[col]) : comparar(b[col], a[col]),
        );
        return chain;
      },
      limit(n: number) {
        tope = n;
        return chain;
      },
      range(desde: number, hasta: number) {
        return Promise.resolve(resolver(visibles.slice(desde, hasta + 1), visibles.length));
      },
      maybeSingle() {
        if (error) return Promise.resolve({ data: null, error });
        const filas = tope === Infinity ? visibles : visibles.slice(0, tope);
        return Promise.resolve({ data: filas[0] ? copiar(filas[0]) : null, error: null });
      },
      single() {
        return (chain.maybeSingle as () => Promise<unknown>)();
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        const filas = tope === Infinity ? visibles : visibles.slice(0, tope);
        return Promise.resolve(resolver(filas, visibles.length)).then(resolve, reject);
      },
    };
    return chain;
  }

  function escritura(table: string, op: "insert" | "update", row: Fila) {
    const registro: Escritura = { table, op, row: copiar(row), filtros: [] };
    escrituras.push(registro);
    // Lo que PostgREST devolvería con `.select()`: la fila insertada con su id, o
    // la fila existente que matchea los filtros con el UPDATE encima (no sólo el
    // parche — una ruta que devuelve «lo actualizado» devuelve la fila entera).
    const hecho = () => {
      if (op === "insert") {
        return { data: { id: `fila-${escrituras.length}`, ...copiar(row) }, error: null };
      }
      const existente = (tablas[table] ?? []).find((r) =>
        registro.filtros.every(([, col, val]) => r[col] === val),
      );
      return existente
        ? { data: { ...copiar(existente), ...copiar(row) }, error: null }
        : { data: null, error: { code: "PGRST116", message: "doble: sin fila" } };
    };
    const b: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        registro.filtros.push(["eq", col, val]);
        return b;
      },
      select: () => b,
      maybeSingle: async () => hecho(),
      single: async () => hecho(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(hecho()).then(resolve, reject),
    };
    return b;
  }

  function from(table: string) {
    const lanzar = (metodo: string) => () => {
      throw new Error(
        `doble: .${metodo}() antes de .select() sobre ${table} — supabase-js no lo permite`,
      );
    };
    return {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) =>
        lectura(table, opts),
      insert: (row: Fila) => escritura(table, "insert", row),
      update: (row: Fila) => escritura(table, "update", row),
      eq: lanzar("eq"),
      is: lanzar("is"),
      in: lanzar("in"),
      order: lanzar("order"),
      limit: lanzar("limit"),
      maybeSingle: lanzar("maybeSingle"),
    };
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: opciones.userId ? { id: opciones.userId } : null },
        error: null,
      }),
    },
    from,
    rpc: async (name: string, args: Fila = {}) => {
      rpcLlamadas.push({ name, args: copiar(args) });
      return opciones.rpc?.[name] ?? { data: null, error: null };
    },
  };

  return { client, escrituras, lecturas, rpcLlamadas };
}

/**
 * Todas las claves de datos del cliente que siguen con valor en `valor`, con su
 * ruta. Es la aserción de propiedad de SDD-0531: para un usuario de China tiene
 * que salir vacía, a cualquier profundidad.
 */
export function datosDelClienteConValor(
  valor: unknown,
  claves: ReadonlySet<string>,
  ruta = "$",
): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => datosDelClienteConValor(v, claves, `${ruta}[${i}]`));
  }
  if (valor === null || typeof valor !== "object") return [];
  return Object.entries(valor as Fila).flatMap(([k, v]) => {
    const aqui = `${ruta}.${k}`;
    if (claves.has(k) && v != null && v !== "") return [aqui];
    return datosDelClienteConValor(v, claves, aqui);
  });
}
