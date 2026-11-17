export type ResumenPasarCuentas = {
  pendientes: number;
  pasadas: number;
  yaEstaban: number;
  fallidas: number;
  aplicar: boolean;
};

/** Lógica de la corrida única (SDD-0646, D-1 opción C). Sin `aplicar`, sólo cuenta. */
export function pasarCuentas(
  admin: unknown,
  opts: { aplicar: boolean; log?: (mensaje: string) => void },
): Promise<ResumenPasarCuentas>;
