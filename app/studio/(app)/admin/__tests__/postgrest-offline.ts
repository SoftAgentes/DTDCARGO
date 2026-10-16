/**
 * SDD-0539 · Un PostgREST en memoria detrás del cliente REAL de supabase-js.
 *
 * Los dobles a mano (`from().eq()…`) no pueden medir lo que esta tarea
 * corrige: el tamaño de la URL que arma supabase-js. Este doble sí. La acción
 * usa el `createClient` de `@supabase/supabase-js` con un `fetch` propio, así
 * que los filtros, las comillas y la codificación son los de la biblioteca. El
 * doble sólo hace de servidor:
 *
 * · mide cada petición (`ruta + query`) y responde 414 si pasa de
 *   `LIMITE_URL`, como un proxy nginx;
 * · aplica de verdad `eq`, `neq`, `is.null` e `in.(…)` en lecturas Y en
 *   escrituras, y se niega con un error ante cualquier otro operador (un doble
 *   no puede ser más permisivo que el servidor);
 * · simula la RLS de lectura/escritura con un predicado por tabla;
 * · devuelve copias, nunca las filas vivas del store;
 * · revierte una escritura que viola una restricción y responde 409/23505.
 */
import { createClient } from "@supabase/supabase-js";

export type Fila = Record<string, unknown>;

/**
 * Techo de la URL. supabase-js avisa desde 8.000 caracteres
 * (`urlLengthLimit`) y nginx, por defecto, corta la línea de petición en 8 KB.
 */
export const LIMITE_URL = 8000;

export interface Peticion {
  method: string;
  tabla: string;
  /** `pathname + search`: lo que viaja en la línea de petición. */
  largo: number;
  params: [string, string][];
  body: unknown;
}

export interface OpcionesDoble {
  usuario: string;
  /** USING/WITH CHECK simplificado: la fila es visible y escribible. */
  rls?: Record<string, (fila: Fila) => boolean>;
  /** Se evalúa después de cada escritura; un texto = violación (23505). */
  restricciones?: (store: Record<string, Fila[]>) => string | null;
  /** Corre una vez, justo después de la primera lectura de `tabla`. */
  trasLeer?: { tabla: string; hacer: (store: Record<string, Fila[]>) => void };
  /** Respuesta del INSERT con `return=representation`: `vacio` simula cero filas. */
  insertDevuelve?: "filas" | "vacio";
  /** La base responde con error a esa petición (500, que supabase-js no reintenta). */
  falla?: { tabla: string; method: "GET" | "PATCH" | "POST"; mensaje: string };
}

const ORIGEN = "https://pgrst-offline.invalid";

/** El contenido de `in.(…)`: valores separados por coma, con comillas dobles opcionales. */
function partirLista(raw: string): string[] {
  const valores: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (const c of raw) {
    if (entreComillas) {
      if (c === '"') entreComillas = false;
      else actual += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      valores.push(actual);
      actual = "";
    } else actual += c;
  }
  valores.push(actual);
  return valores;
}

const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));

function filtro(columna: string, expresion: string): (fila: Fila) => boolean {
  const m = expresion.match(/^(eq|neq|is|in)\.([\s\S]*)$/);
  if (!m) throw new Error(`Operador no soportado por el doble: ${columna}=${expresion}`);
  const [, op, valor] = m;
  if (op === "eq") return (f) => texto(f[columna]) === valor;
  // En SQL `null <> x` es null: la fila no pasa.
  if (op === "neq") return (f) => texto(f[columna]) !== null && texto(f[columna]) !== valor;
  if (op === "is") {
    if (valor !== "null") throw new Error(`is.${valor} no soportado por el doble`);
    return (f) => f[columna] == null;
  }
  const lista = valor.match(/^\(([\s\S]*)\)$/);
  if (!lista) throw new Error(`in mal formado: ${expresion}`);
  const permitidos = new Set(partirLista(lista[1]));
  return (f) => texto(f[columna]) !== null && permitidos.has(texto(f[columna]) as string);
}

const NO_FILTROS = new Set(["select", "limit", "order", "offset", "columns", "on_conflict"]);

function proyectar(fila: Fila, select: string | null): Fila {
  if (!select || select === "*") return { ...fila };
  return Object.fromEntries(select.split(",").map((c) => [c, fila[c] ?? null]));
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export function postgrestOffline(tablas: Record<string, Fila[]>, opciones: OpcionesDoble) {
  const store: Record<string, Fila[]> = Object.fromEntries(
    Object.entries(tablas).map(([t, filas]) => [t, filas.map((f) => ({ ...f }))]),
  );
  const peticiones: Peticion[] = [];
  let trasLeer = opciones.trasLeer;
  let secuencia = 0;

  // Lo que el doble no sabe hacer vuelve como 400 y no como excepción:
  // supabase-js reintenta un GET que lanza (1 s, 2 s, 4 s) y la prueba se
  // quedaría esperando. Un 400 no se reintenta y llega como `error`.
  const offlineFetch: typeof fetch = async (input, init) => {
    try {
      return await servir(input, init);
    } catch (e) {
      return json({ code: "DOBLE", message: e instanceof Error ? e.message : String(e) }, 400);
    }
  };

  const servir: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== ORIGEN) throw new Error(`Origen inesperado: ${url.origin}`);
    const ruta = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!ruta) throw new Error(`Ruta no soportada por el doble: ${url.pathname}`);
    const tabla = ruta[1];
    const method = (init?.method ?? "GET").toUpperCase();
    const largo = url.pathname.length + url.search.length;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const params = [...url.searchParams.entries()];
    peticiones.push({ method, tabla, largo, params, body });

    if (largo > LIMITE_URL) {
      return new Response("<html><head><title>414 Request-URI Too Large</title></head></html>", {
        status: 414,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (opciones.falla && opciones.falla.tabla === tabla && opciones.falla.method === method) {
      return json({ code: "XX000", message: opciones.falla.mensaje }, 500);
    }

    const filtros = params.filter(([k]) => !NO_FILTROS.has(k)).map(([k, v]) => filtro(k, v));
    const visible = opciones.rls?.[tabla] ?? (() => true);
    const cumple = (f: Fila) => visible(f) && filtros.every((p) => p(f));
    const select = url.searchParams.get("select");
    const representacion = new Headers(init?.headers).get("Prefer")?.includes("return=representation");
    const filas = (store[tabla] ??= []);

    if (method === "GET") {
      let leidas = filas.filter(cumple).map((f) => proyectar(f, select));
      const limite = url.searchParams.get("limit");
      if (limite) leidas = leidas.slice(0, Number(limite));
      if (trasLeer?.tabla === tabla) {
        const hook = trasLeer;
        trasLeer = undefined;
        hook.hacer(store);
      }
      return json(leidas);
    }

    const antes = JSON.stringify(store);
    let tocadas: Fila[];
    if (method === "PATCH") {
      tocadas = filas.filter(cumple);
      for (const f of tocadas) Object.assign(f, body as Fila);
      if (tocadas.some((f) => !visible(f))) {
        restaurar(antes);
        return json({ code: "42501", message: "new row violates row-level security policy" }, 403);
      }
    } else if (method === "POST") {
      const nuevas = (Array.isArray(body) ? body : [body]) as Fila[];
      tocadas = nuevas.map((n) => ({ id: `nueva-${++secuencia}`, deleted_at: null, ...n }));
      if (tocadas.some((f) => !visible(f))) {
        return json({ code: "42501", message: "new row violates row-level security policy" }, 403);
      }
      filas.push(...tocadas);
    } else {
      throw new Error(`Método no soportado por el doble: ${method}`);
    }

    const violacion = opciones.restricciones?.(store) ?? null;
    if (violacion) {
      restaurar(antes);
      return json({ code: "23505", message: violacion }, 409);
    }
    if (!representacion) return new Response(null, { status: 204 });
    if (method === "POST" && opciones.insertDevuelve === "vacio") return json([], 201);
    return json(
      tocadas.map((f) => proyectar(f, select)),
      method === "POST" ? 201 : 200,
    );
  };

  function restaurar(foto: string) {
    const previo = JSON.parse(foto) as Record<string, Fila[]>;
    for (const t of Object.keys(store)) delete store[t];
    Object.assign(store, previo);
  }

  const real = createClient(ORIGEN, "SINTETICA-NO-ES-UN-SECRETO", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: offlineFetch },
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: opciones.usuario } }, error: null }) },
    from: (tabla: string) => real.from(tabla),
  };
  const fila = (tabla: string, id: string) => store[tabla].find((f) => f.id === id);
  const escrituras = () => peticiones.filter((p) => p.method !== "GET");
  return { client, store, peticiones, escrituras, fila };
}
