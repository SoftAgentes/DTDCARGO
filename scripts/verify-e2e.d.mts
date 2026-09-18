// Tipos de scripts/verify-e2e.mjs para las pruebas en TypeScript (SDD-0479).
import type { DeteccionSupabasePublico } from "../e2e/_helpers/supabase-publico.cjs";

export {
  MARCA_SIN_SUPABASE,
  deteccionEfectiva,
  detectarSupabasePublico,
  motivoSinSupabase,
  planSupabaseE2E,
} from "../e2e/_helpers/supabase-publico.cjs";

export declare const PUERTO_BASE: number;
export declare const PUERTO_RANGO: number;
export declare function candidatosDePuerto(cwd: string, cuantos?: number): number[];
export declare function primerPuertoLibre(candidatos: number[]): number | null;
export declare function absuelveCorrida(
  stats: { expected?: number; unexpected?: number } | null | undefined,
): boolean;
export declare function envParaSalidaCanalizada(
  stdout: { isTTY?: boolean; columns?: number; rows?: number } | undefined,
  env?: Record<string, string | undefined>,
): Record<string, string>;

export interface OmisionSinSupabase {
  archivo: string;
  linea: number;
  titulo: string;
  proyecto: string;
}
export declare function omisionesSinSupabase(reporte: unknown): OmisionSinSupabase[];
export declare function coberturaParcialE2E(opciones: {
  deteccion: DeteccionSupabasePublico;
  reporte: unknown;
}): { reason: string; casos: string[] } | null;

export declare function destinoE2E(
  env: Record<string, string | undefined>,
  puerto: number | string,
): { baseURL: string; levantaServidor: boolean; puertoApp: number };
export declare function candidatosSupabaseSintetico(
  puertoApp: number,
  cwd: string,
  cuantos?: number,
): number[];
