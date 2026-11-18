export type ResumenPasarCuentas = {
  pendientes: number;
  pasadas: number;
  yaEstaban: number;
  fallidas: number;
  /** Filas que siguen pendientes al terminar (en el ensayo, todas). */
  quedan: number;
  aplicar: boolean;
};

/** 0 sólo si no queda nada pendiente y nada falló; 1 si algo falló; 3 si quedan pendientes. */
export function codigoDeSalida(resumen: ResumenPasarCuentas): number;

/** Lógica de la corrida única (SDD-0646, D-1 opción C). Sin `aplicar`, sólo cuenta. */
export function pasarCuentas(
  admin: unknown,
  opts: { aplicar: boolean; log?: (mensaje: string) => void },
): Promise<ResumenPasarCuentas>;
