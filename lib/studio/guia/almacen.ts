/**
 * lib/studio/guia/almacen.ts · Progreso de la guía en el navegador (SDD-0589).
 *
 * 9.2 guarda solo en este navegador: `localStorage` si se puede y, si no
 * (modo privado, cuota, almacenamiento bloqueado), en memoria. Nunca lanza.
 *
 * Lugar preparado para 9.3: el estado por usuario vivirá en una tabla
 * (patrón de la migración 0233) y llegará como otra implementación de
 * `GuiaAlmacen`. El motor solo conoce esta interfaz.
 *
 * Lo guardado son ids de recorrido y de paso: sin datos de personas.
 */

export interface GuiaProgreso {
  /** Último paso mostrado. */
  pasoId: string | null;
  /** El recorrido llegó al final con «Terminar». */
  terminado: boolean;
}

export interface GuiaAlmacen {
  leer(recorridoId: string): GuiaProgreso | null;
  guardar(recorridoId: string, progreso: GuiaProgreso): void;
}

const PREFIJO = "dtd.guia.v1.";

function esProgreso(valor: unknown): valor is GuiaProgreso {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  return (
    (v.pasoId === null || typeof v.pasoId === "string") &&
    typeof v.terminado === "boolean"
  );
}

export function crearAlmacenMemoria(): GuiaAlmacen {
  const datos = new Map<string, GuiaProgreso>();
  return {
    leer: (id) => datos.get(id) ?? null,
    guardar: (id, progreso) => {
      datos.set(id, { ...progreso });
    },
  };
}

/**
 * `localStorage` con respaldo en memoria. `storage` se inyecta en pruebas;
 * por defecto toma `window.localStorage` (si leerlo lanza, usa memoria).
 */
export function crearAlmacenLocal(storage?: Storage | null): GuiaAlmacen {
  const memoria = crearAlmacenMemoria();
  let destino: Storage | null = null;
  try {
    destino =
      storage !== undefined
        ? storage
        : typeof window !== "undefined"
          ? window.localStorage
          : null;
  } catch {
    destino = null;
  }

  return {
    leer(id) {
      try {
        const crudo = destino?.getItem(PREFIJO + id);
        if (crudo) {
          const valor: unknown = JSON.parse(crudo);
          if (esProgreso(valor)) return valor;
        }
      } catch {
        // JSON roto o almacenamiento bloqueado: se usa lo que haya en memoria.
      }
      return memoria.leer(id);
    },
    guardar(id, progreso) {
      memoria.guardar(id, progreso);
      try {
        destino?.setItem(PREFIJO + id, JSON.stringify(progreso));
      } catch {
        // Cuota llena o bloqueado: queda en memoria hasta recargar.
      }
    },
  };
}
