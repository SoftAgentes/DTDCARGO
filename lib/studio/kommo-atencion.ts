/**
 * SDD-0288 · "Sin atender" — la derivada que enciende el rojo del ERP.
 *
 * ── Qué significa, y por qué esta definición y no otra ──────────────────────
 *
 * En Kommo, el rojo de una tarjeta NO quiere decir "el cliente escribió":
 * quiere decir **tarea vencida**. Lo que las conecta es una acción configurada
 * en los 4 agentes de IA el 2026-08-11 (`Agregar tarea · Fecha límite: Ahora ·
 * "Responder al cliente"`), que crea la tarea ya vencida. De ahí sale la
 * equivalencia operativa: tarea abierta y vencida sobre un lead = ese cliente
 * escribió y nadie le contestó.
 *
 * Esta definición se **copia** de Kommo, no se inventa. Si el ERP aplicara su
 * propio umbral —"vencida hace más de X"— los dos semáforos divergirían y el
 * asesor tendría que decidir a cuál creerle. Una sola verdad.
 *
 * ⚠️ Es una función PURA y recibe `ahoraMs`. No llama a `Date.now()` adentro:
 * un predicado que lee el reloj global no se puede testear sin congelar el
 * tiempo, y "vencida" es exactamente la clase de cosa que hay que poder probar
 * en los dos lados del borde.
 */

/** Fila de `kommo_tasks` — sólo lo que la derivada necesita. */
export interface TareaEspejo {
  entity_id: number | null;
  entity_type: string | null;
  is_completed: boolean | null;
  complete_till: string | null;
}

export interface Atencion {
  /** Hace cuánto venció la MÁS VIEJA, en ms. Nunca negativo. */
  vencidaDesdeMs: number;
  /** Cuántas tareas abiertas y vencidas cuelgan del lead. */
  cuantas: number;
}

/**
 * Techo de cordura para `complete_till`: 100 años en el futuro.
 *
 * En la API de Kommo el vencimiento viaja en epoch de SEGUNDOS. Mandarlo en
 * milisegundos —el error que ya lleva su aviso en `buildTaskPayload`— lo
 * proyecta al año ~57.000. Esa tarea **nunca se ve vencida**, así que el fallo
 * es silencioso: no hay rojo y nadie sabe por qué.
 *
 * No se corrige adivinando (dividir entre 1000 sería inventar el dato). Se
 * DETECTA, para que `tareasAbsurdas()` lo pueda denunciar en vez de que se
 * pierda en la resta.
 */
const HORIZONTE_ABSURDO_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/** ¿Esta tarea cuelga de un lead y sigue abierta y vencida? */
function vencimientoVigente(t: TareaEspejo, ahoraMs: number): number | null {
  if (t.entity_type !== "leads") return null;
  if (t.is_completed === true) return null;

  const lead = Number(t.entity_id);
  if (!Number.isFinite(lead) || lead <= 0) return null;

  // Sin fecha límite no hay nada que vencer. No es lo mismo que "vencida":
  // tratarla como vencida pintaría de rojo cualquier tarea suelta.
  if (!t.complete_till) return null;
  const ms = Date.parse(t.complete_till);
  if (!Number.isFinite(ms)) return null;

  if (ms >= ahoraMs) return null; // todavía no vence
  return ahoraMs - ms;
}

/**
 * Leads sin atender → cuánto llevan esperando.
 *
 * Se queda con el vencimiento **más viejo** de cada lead: si un cliente escribió
 * tres veces, lo que importa es desde cuándo espera, no la última vez que
 * insistió.
 */
export function leadsSinAtender(
  tareas: readonly TareaEspejo[],
  ahoraMs: number,
): Map<number, Atencion> {
  const out = new Map<number, Atencion>();

  for (const t of tareas) {
    const desde = vencimientoVigente(t, ahoraMs);
    if (desde == null) continue;

    const lead = Number(t.entity_id);
    const previo = out.get(lead);
    if (previo) {
      previo.cuantas += 1;
      if (desde > previo.vencidaDesdeMs) previo.vencidaDesdeMs = desde;
    } else {
      out.set(lead, { vencidaDesdeMs: desde, cuantas: 1 });
    }
  }

  return out;
}

/**
 * Tareas cuyo vencimiento cae absurdamente lejos en el futuro — la firma del
 * epoch en milisegundos (§ `HORIZONTE_ABSURDO_MS`).
 *
 * Devuelve los `entity_id` afectados para que quien espeje pueda gritarlo. Un
 * espejo que se los traga deja leads sin rojo sin ninguna señal de que algo
 * anda mal, que es el peor de los dos errores posibles acá.
 */
export function tareasAbsurdas(
  tareas: readonly TareaEspejo[],
  ahoraMs: number,
): number[] {
  const out: number[] = [];
  for (const t of tareas) {
    if (!t.complete_till) continue;
    const ms = Date.parse(t.complete_till);
    if (!Number.isFinite(ms)) continue;
    if (ms - ahoraMs > HORIZONTE_ABSURDO_MS) {
      const lead = Number(t.entity_id);
      if (Number.isFinite(lead) && lead > 0) out.push(lead);
    }
  }
  return out;
}

/**
 * Rótulo para la pantalla: *"Sin atender · 3 h"*.
 *
 * Se redondea hacia ABAJO a propósito: decir "2 h" cuando van 2 h 50 min es
 * preferible a decir "3 h" cuando van 2 h 10 min. Un semáforo que exagera se
 * deja de mirar.
 */
export function etiquetaEspera(vencidaDesdeMs: number): string {
  const min = Math.floor(vencidaDesdeMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `${min} min`;

  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;

  const dias = Math.floor(horas / 24);
  return `${dias} d`;
}
