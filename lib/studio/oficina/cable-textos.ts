/**
 * SDD-0626 §3.1 · La regla de escritura de los textos libres del cable (R5 · AUD-01 §5).
 *
 * El Paso 2 (webhook, filtro y despachador) escribe `office_tasks.titulo`,
 * `office_tasks.meta_datos`, `office_tasks.asignado_a`, `task_events.actor` y
 * `task_events.resumen` SOLO después de `exigirTextosDelCable`. Ningún texto lleva
 * el mensaje del cliente ni sus datos de contacto: a la persona y al envío se los
 * nombra por referencia (`entidad_ref`, `payload_ref`).
 *
 * - Datos personales: la lista de la Oficina_Virtual (`datos-personales.ts`, SDD-0700):
 *   nació como copia de la regla de noticias (`tieneDatosPersonales`) más el teléfono
 *   internacional agrupado, y suma cédulas con puntos, RIF, fijos y más direcciones
 *   (`detectorDelCable`). Es la misma lista con la que se tapa la entrada del agente.
 *   Un uuid es un identificador, no un dato personal: se quita antes de mirar, para
 *   que sus dígitos no parezcan un teléfono.
 * - `meta_datos`: se miran sus claves y sus textos, a cualquier profundidad. Los
 *   números no, porque son conteos e indicadores (un teléfono llega como texto).
 * - `actor` y `asignado_a`: identificadores, con el mismo patrón que los CHECK de la
 *   0541 (`agente:<perfil>`, `sistema:<componente>` o `persona:<uuid>`).
 *
 * La base tiene la red: los CHECK de identificador y el vaciado del resumen a los
 * 90 días (`office_vaciar_resumenes_viejos()`), por si esta regla deja pasar algo.
 * Revisión de datos personales: docs/specs/0626-oficina-runtime/privacidad.md.
 */
import { hayDatosPersonales } from "./datos-personales";

/** El patrón de los CHECK `task_events_actor_es_identificador` y `office_tasks_asignado_a_es_identificador`. */
export const IDENTIFICADOR_RE =
  /^(agente:[a-z0-9][a-z0-9_.-]{0,63}|sistema:[a-z0-9][a-z0-9_.-]{0,63}|persona:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export type CodigoTextoCable =
  | "titulo_con_datos_personales"
  | "resumen_con_datos_personales"
  | "meta_datos_con_datos_personales"
  | "actor_no_es_identificador"
  | "asignado_a_no_es_identificador";

export interface TextosDelCable {
  titulo?: string | null;
  resumen?: string | null;
  metaDatos?: unknown;
  actor?: string | null;
  asignadoA?: string | null;
}

export class TextoDelCableRechazado extends Error {
  readonly codigos: CodigoTextoCable[];
  constructor(codigos: CodigoTextoCable[]) {
    super(`El cable no escribe este texto: ${codigos.join(", ")} (SDD-0626 §3.1, R5)`);
    this.name = "TextoDelCableRechazado";
    this.codigos = codigos;
  }
}

/** Claves y textos de un valor JSON, a cualquier profundidad. */
function textosDe(valor: unknown, salida: string[], vistos: WeakSet<object>): string[] {
  if (typeof valor === "string") {
    salida.push(valor);
  } else if (valor !== null && typeof valor === "object") {
    if (vistos.has(valor)) return salida;
    vistos.add(valor);
    if (Array.isArray(valor)) {
      for (const v of valor) textosDe(v, salida, vistos);
    } else {
      for (const [clave, v] of Object.entries(valor)) {
        salida.push(clave);
        textosDe(v, salida, vistos);
      }
    }
  }
  return salida;
}

/**
 * El revisor con un detector de datos personales dado. Exportado para la prueba:
 * con un detector que no detecta nada (el mutante), los casos de rechazo tienen que caer.
 */
export function crearRevisorDeTextos(detector: (texto: string) => boolean) {
  const pareceDatoPersonal = (texto: string) => detector(texto.replace(UUID, " "));

  return function revisar(t: TextosDelCable): CodigoTextoCable[] {
    const codigos: CodigoTextoCable[] = [];
    if (t.titulo && pareceDatoPersonal(t.titulo)) codigos.push("titulo_con_datos_personales");
    if (t.resumen && pareceDatoPersonal(t.resumen)) codigos.push("resumen_con_datos_personales");
    if (t.metaDatos !== undefined && t.metaDatos !== null
        && textosDe(t.metaDatos, [], new WeakSet()).some(pareceDatoPersonal)) {
      codigos.push("meta_datos_con_datos_personales");
    }
    if (t.actor !== undefined && t.actor !== null && !IDENTIFICADOR_RE.test(t.actor)) {
      codigos.push("actor_no_es_identificador");
    }
    if (t.asignadoA !== undefined && t.asignadoA !== null && !IDENTIFICADOR_RE.test(t.asignadoA)) {
      codigos.push("asignado_a_no_es_identificador");
    }
    return codigos;
  };
}

/**
 * El detector del cable: la lista de la Oficina_Virtual (`datos-personales.ts`). Trae lo
 * que la regla de noticias no ve, como el teléfono internacional agrupado de los móviles
 * de China (+86 138 1234 5678): la oficina habla con proveedores de China. La regla de
 * noticias no cambia.
 */
export const detectorDelCable = (texto: string): boolean => hayDatosPersonales(texto);

/** Los códigos de lo que el cable no puede escribir. Vacío = se puede escribir. */
export const revisarTextosDelCable = crearRevisorDeTextos(detectorDelCable);

/** Lanza `TextoDelCableRechazado` si algún texto no se puede escribir. */
export function exigirTextosDelCable(t: TextosDelCable): void {
  const codigos = revisarTextosDelCable(t);
  if (codigos.length > 0) throw new TextoDelCableRechazado(codigos);
}
