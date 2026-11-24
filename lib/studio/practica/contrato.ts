export const RUTA_PRACTICA = "/studio/practica";
export const API_PRACTICA = "/api/practica/";
export const COOKIE_PRACTICA = "__Host-dtd-practica";

export const MODULOS_PRACTICA = [
  { id: "invoices", nombre: "Facturación" },
  { id: "cn", nombre: "Almacén China" },
  { id: "naviera", nombre: "Consolidado" },
  { id: "shipments", nombre: "Embarque" },
  { id: "ve", nombre: "Recepción Venezuela" },
] as const;

export type ModuloPractica = (typeof MODULOS_PRACTICA)[number]["id"];
export type PermisoPractica = { id: ModuloPractica; edicion: boolean; ejercicioCn?: boolean; incidenciaDestino?: boolean };
export type VistaPractica = { espacio: string; permisos: PermisoPractica[] };

export const AVISO_LISTO = "dtd-practica-lista";
export const AVISO_PASE = "dtd-practica-pase";
export const AVISO_ABIERTA = "dtd-practica-abierta";

export function esToken(valor: unknown): valor is string {
  return typeof valor === "string" && /^[a-f0-9]{64}$/.test(valor);
}

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(valor);
}

export function sonPermisosPractica(valor: unknown): valor is PermisoPractica[] {
  return Array.isArray(valor) && valor.every(p => p && MODULOS_PRACTICA.some(m => m.id === p.id) && typeof p.edicion === "boolean" && (p.ejercicioCn === undefined || typeof p.ejercicioCn === "boolean") && (p.incidenciaDestino === undefined || typeof p.incidenciaDestino === "boolean"))
    && new Set(valor.map(p => p.id)).size === valor.length;
}

export function esVistaPractica(valor: unknown): valor is VistaPractica {
  return !!valor && typeof valor === "object" && "espacio" in valor && esUuid(valor.espacio)
    && "permisos" in valor && sonPermisosPractica(valor.permisos);
}
