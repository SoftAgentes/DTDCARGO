/**
 * SDD-0608 · Doble del cliente `service_role` para la consulta `/cliente`.
 *
 * Los filtros `eq`/`is`/`limit` se APLICAN de verdad sobre las filas en
 * memoria: un doble que los ignora no prueba que el código filtre (memoria
 * «doble de PostgREST que no filtra»). `ilike`, `like`, `or` y `textSearch`
 * lanzan: la búsqueda tiene que ir por la función de la base, que escapa los
 * comodines, nunca por un `.ilike()` de PostgREST (que convierte `*` en `%`).
 *
 * `discord_consulta_registrar` imita la regla de la migración 0516 (cuenta
 * todo lo del último minuto de ese usuario de Discord). Su semántica real se
 * prueba en PGlite (`consulta-clientes.migration.test.ts`).
 */

type Fila = Record<string, unknown>;

export interface TablasFalsas {
  user_profiles?: Fila[];
  user_tenants?: Fila[];
  studio_role_module_overrides?: Fila[];
}

export interface OpcionesFalsas {
  /** Tablas cuya lectura devuelve error (p. ej. la columna de 0514 ausente). */
  conError?: Array<keyof TablasFalsas>;
  /** Filas que devuelve la búsqueda (pueden traer claves de más a propósito). */
  busqueda?: Fila[];
  errorBusqueda?: boolean;
  errorRegistro?: boolean;
}

export interface Registro {
  discord_user_id: string;
  user_id: string | null;
  tenant_id: string | null;
  termino: string;
  resultado: string;
}

const PROHIBIDO = (metodo: string) => () => {
  throw new Error(`.${metodo}() prohibido en la consulta de clientes: los comodines se escapan en la base`);
};

class ConsultaFalsa implements PromiseLike<{ data: unknown; error: unknown }> {
  private filtros: Array<(f: Fila) => boolean> = [];
  private tope: number | null = null;
  private unico = false;

  constructor(
    private readonly filas: Fila[],
    private readonly conError: boolean,
    readonly tabla: string,
    private readonly log: string[],
  ) {}

  select(_columnas?: string) {
    return this;
  }
  eq(columna: string, valor: unknown) {
    this.log.push(`${this.tabla}.eq(${columna})`);
    this.filtros.push((f) => f[columna] === valor);
    return this;
  }
  is(columna: string, valor: unknown) {
    this.log.push(`${this.tabla}.is(${columna})`);
    this.filtros.push((f) => (f[columna] ?? null) === valor);
    return this;
  }
  limit(n: number) {
    this.tope = n;
    return this;
  }
  maybeSingle<T>() {
    this.unico = true;
    return this as unknown as PromiseLike<{ data: T | null; error: unknown }>;
  }
  ilike = PROHIBIDO("ilike");
  like = PROHIBIDO("like");
  or = PROHIBIDO("or");
  textSearch = PROHIBIDO("textSearch");

  private resolver() {
    if (this.conError) {
      return { data: null, error: { code: "42703", message: "column does not exist" } };
    }
    let filas = this.filas.filter((f) => this.filtros.every((p) => p(f)));
    if (this.tope !== null) filas = filas.slice(0, this.tope);
    const copia = filas.map((f) => ({ ...f }));
    return { data: this.unico ? (copia[0] ?? null) : copia, error: null };
  }

  then<A, B>(
    ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    mal?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.resolver()).then(ok, mal);
  }
}

export function adminFalso(tablas: TablasFalsas, opciones: OpcionesFalsas = {}) {
  const registros: Registro[] = [];
  const busquedas: Array<Record<string, unknown>> = [];
  const log: string[] = [];

  const admin = {
    from(tabla: keyof TablasFalsas | string) {
      log.push(`from(${tabla})`);
      if (!(tabla in { user_profiles: 1, user_tenants: 1, studio_role_module_overrides: 1 })) {
        throw new Error(`tabla inesperada en la consulta: ${tabla}`);
      }
      const t = tabla as keyof TablasFalsas;
      return new ConsultaFalsa(tablas[t] ?? [], opciones.conError?.includes(t) ?? false, t, log);
    },
    async rpc(nombre: string, args: Record<string, unknown>) {
      log.push(`rpc(${nombre})`);
      if (nombre === "discord_consulta_registrar") {
        if (opciones.errorRegistro) {
          return { data: null, error: { code: "42883", message: "function does not exist" } };
        }
        const recientes = registros.filter((r) => r.discord_user_id === args.p_discord_user_id).length;
        const permitida = recientes < Math.max(Number(args.p_tope ?? 1), 1);
        registros.push({
          discord_user_id: String(args.p_discord_user_id),
          user_id: (args.p_user_id as string | null) ?? null,
          tenant_id: (args.p_tenant_id as string | null) ?? null,
          termino: String(args.p_termino),
          resultado: permitida ? String(args.p_resultado) : "limite",
        });
        return { data: permitida, error: null };
      }
      if (nombre === "discord_buscar_clientes") {
        busquedas.push({ ...args });
        if (opciones.errorBusqueda) return { data: null, error: { code: "XX000", message: "x" } };
        const limite = Number(args.p_limite);
        return { data: (opciones.busqueda ?? []).slice(0, limite).map((f) => ({ ...f })), error: null };
      }
      throw new Error(`rpc inesperado: ${nombre}`);
    },
  };

  return { admin, registros, busquedas, log };
}
