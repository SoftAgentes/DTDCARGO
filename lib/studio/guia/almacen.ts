/**
 * lib/studio/guia/almacen.ts · Progreso de la guía en el navegador (SDD-0589).
 *
 * 9.2 guarda solo en este navegador: `localStorage` si se puede y, si no
 * (modo privado, cuota, almacenamiento bloqueado), en memoria. Nunca lanza.
 *
 * 9.3 suma `crearAlmacenServidor`: el estado por usuario vive en
 * `user_guide_prefs` (migración 0517) y el navegador queda como copia. El
 * motor solo conoce la interfaz `GuiaAlmacen`.
 *
 * Lo guardado son ids de recorrido y de paso, booleanos y una fecha: sin
 * datos de personas.
 */

import type { EstadoGuia } from "./estado-types";

export interface GuiaProgreso {
  /** Último paso mostrado. */
  pasoId: string | null;
  /** El recorrido llegó al final con «Terminar». */
  terminado: boolean;
  /** «No volver a mostrar»: apaga el arranque automático, no el botón (9.3). */
  noMostrar?: boolean;
  /** Cuándo arrancó sola por primera vez, en ISO (9.3). */
  vistoEn?: string;
}

export interface GuiaAlmacen {
  leer(recorridoId: string): GuiaProgreso | null;
  /**
   * Guarda sobre lo que ya había: un campo que no viene se conserva. Sin nada
   * previo, `pasoId` vale `null` y `terminado`, `false`.
   */
  guardar(recorridoId: string, cambios: Partial<GuiaProgreso>): void;
}

const BASE: GuiaProgreso = { pasoId: null, terminado: false };

const PREFIJO = "dtd.guia.v1.";

function esProgreso(valor: unknown): valor is GuiaProgreso {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  return (
    (v.pasoId === null || typeof v.pasoId === "string") &&
    typeof v.terminado === "boolean" &&
    (v.noMostrar === undefined || typeof v.noMostrar === "boolean") &&
    (v.vistoEn === undefined || typeof v.vistoEn === "string")
  );
}

export function crearAlmacenMemoria(): GuiaAlmacen {
  const datos = new Map<string, GuiaProgreso>();
  return {
    leer: (id) => datos.get(id) ?? null,
    guardar: (id, cambios) => {
      datos.set(id, { ...BASE, ...datos.get(id), ...cambios });
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

  const leer = (id: string): GuiaProgreso | null => {
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
  };

  return {
    leer,
    guardar(id, cambios) {
      const completo: GuiaProgreso = { ...BASE, ...leer(id), ...cambios };
      memoria.guardar(id, completo);
      try {
        destino?.setItem(PREFIJO + id, JSON.stringify(completo));
      } catch {
        // Cuota llena o bloqueado: queda en memoria hasta recargar.
      }
    },
  };
}

/** Espera antes de mandar a la base, como el autoguardado del Dashboard. */
export const ESPERA_GUARDADO_MS = 650;

export interface AlmacenServidor extends GuiaAlmacen {
  /** Hay estado de la base: se puede decidir «primera vez» por usuario. */
  readonly conServidor: boolean;
  /**
   * Va en un efecto, después de hidratar. Con estado de la base, lo copia al
   * navegador; sin él, toma el navegador como respaldo. Ningún render lee
   * `localStorage`.
   */
  sincronizarAlMontar(ids: readonly string[]): void;
  /** Manda ya lo pendiente (pruebas y cierre de página). */
  vaciar(): void;
}

/**
 * Estado por usuario (9.3). La memoria se siembra con lo que leyó el servidor, cada
 * `guardar` copia al navegador y agenda `guardarRemoto` con el estado completo.
 * Si `inicial` es `null` (la base no respondió o la 0517 no está aplicada), funciona
 * como el almacén del navegador y no llama al servidor.
 */
export function crearAlmacenServidor(opciones: {
  inicial: EstadoGuia | null;
  guardarRemoto: (estado: EstadoGuia) => Promise<unknown>;
  storage?: Storage | null;
  esperaMs?: number;
}): AlmacenServidor {
  const { inicial, guardarRemoto, esperaMs = ESPERA_GUARDADO_MS } = opciones;
  const memoria = crearAlmacenMemoria();
  for (const [id, progreso] of Object.entries(inicial?.recorridos ?? {})) memoria.guardar(id, progreso);
  const conocidos = new Set(Object.keys(inicial?.recorridos ?? {}));
  const local = crearAlmacenLocal(opciones.storage);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const enviar = () => {
    timer = null;
    const recorridos: Record<string, GuiaProgreso> = {};
    for (const id of conocidos) {
      const p = memoria.leer(id);
      if (p) recorridos[id] = p;
    }
    guardarRemoto({ v: 1, recorridos }).catch(() => {
      // Best-effort: si la base no responde, queda en el navegador.
    });
  };

  return {
    conServidor: inicial !== null,
    leer: (id) => memoria.leer(id),
    guardar(id, cambios) {
      memoria.guardar(id, cambios);
      conocidos.add(id);
      const completo = memoria.leer(id);
      if (completo) local.guardar(id, completo);
      if (inicial === null) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(enviar, esperaMs);
    },
    sincronizarAlMontar(ids) {
      if (inicial !== null) {
        for (const id of conocidos) {
          const p = memoria.leer(id);
          if (p) local.guardar(id, p);
        }
        return;
      }
      for (const id of ids) {
        const p = local.leer(id);
        if (p) {
          memoria.guardar(id, p);
          conocidos.add(id);
        }
      }
    },
    vaciar() {
      if (!timer) return;
      clearTimeout(timer);
      enviar();
    },
  };
}
