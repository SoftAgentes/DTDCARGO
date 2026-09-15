// Tipos de e2e/_helpers/supabase-publico.cjs (SDD-0470). tsconfig no admite JS.

type Entorno = Record<string, string | undefined>;

export type EstadoArchivoEnv = "ausente" | "archivo" | "no-es-archivo" | "ilegible";

export interface DeteccionSupabasePublico {
  configurado: boolean;
  faltan: string[];
  vacias: Record<string, string>;
  fuentes: Record<string, string>;
  ignorados: { nombre: string; estado: EstadoArchivoEnv }[];
  archivos: string[];
}

export declare const SUPABASE_PUBLIC_VARS: readonly string[];
export declare const ARCHIVOS_ENV_DEV: readonly string[];
export declare const ARCHIVOS_ENV_TEST: readonly string[];
export declare function archivosEnvNextDev(env?: Entorno): readonly string[];
export declare const MARCA_SIN_SUPABASE: string;
export declare const RAIZ_REPO: string;

export declare function parsearEnv(texto: string): Record<string, string>;
export declare function leerArchivoEnv(ruta: string): {
  estado: EstadoArchivoEnv;
  vars: Record<string, string>;
};
export declare function detectarSupabasePublico(opciones?: {
  env?: Entorno;
  raiz?: string;
}): DeteccionSupabasePublico;
export declare function motivoSinSupabase(deteccion: DeteccionSupabasePublico): string | null;
export declare function destinoEsLocal(baseURL: string | undefined): boolean;
export declare function omisionSinSupabase(opciones?: {
  env?: Entorno;
  raiz?: string;
  baseURL?: string;
}): string | null;
