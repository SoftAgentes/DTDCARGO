export type ResumenPasarCuentas = {
  pendientes: number;
  pasadas: number;
  yaEstaban: number;
  fallidas: number;
  /** Filas cuya cuenta de Auth ya no existe: no se tocan y no cuentan como pendientes. */
  huerfanas: number;
  /** Filas que siguen pendientes al terminar (en el ensayo, todas). */
  quedan: number;
  aplicar: boolean;
};

/** 0 sólo si no queda nada pendiente, nada falló y no hay huérfanas; 1 si algo falló; 3 si quedan pendientes; 4 si sólo quedan huérfanas. */
export function codigoDeSalida(resumen: ResumenPasarCuentas): number;

/** Lógica de la corrida única (SDD-0646, D-1 opción C). Sin `aplicar`, sólo cuenta. */
export function pasarCuentas(
  admin: unknown,
  opts: { aplicar: boolean; log?: (mensaje: string) => void },
): Promise<ResumenPasarCuentas>;
