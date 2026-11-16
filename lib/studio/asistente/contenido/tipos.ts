/**
 * lib/studio/asistente/contenido/tipos.ts · Formas del minicerebro de Faro
 * (SDD-0637 §5, fase 1).
 *
 * El minicerebro es la ÚNICA fuente de conocimiento del asistente: lo que no
 * está aquí, Faro no lo sabe. Son datos puros (sin React, sin server-only, sin
 * acceso a base de datos) para que el recorte por permisos de la fase 3 los
 * filtre en el servidor antes de llamar a ningún modelo.
 *
 * Este repositorio es público: en estos archivos no van datos de clientes,
 * montos reales, nombres de personas ni capturas.
 */

import type { StudioUserRole } from "@/lib/studio/user-types";

/**
 * Cómo trata Faro a un módulo cuando alguien SIN acceso pregunta por él
 * (SDD-0637 §6.1; decisión D-3, aprobada por Sam el 2026-11-16).
 *
 * - `normal`: puede decir que la pantalla existe y que la persona no tiene
 *   acceso; nunca explica cómo se usa.
 * - `reservada`: existe, pero ni su descripción sale del servidor para quien
 *   no tiene acceso. Preguntar por ella genera alerta inmediata (§6.3).
 * - `oculta`: para quien no tiene acceso, no existe: Faro no la menciona.
 */
export type Visibilidad = "normal" | "reservada" | "oculta";

/** Procedencia de una entrada: quién la revisó, cuándo y contra qué. */
export interface Procedencia {
  /** Fecha ISO (AAAA-MM-DD) de la última revisión contra la pantalla real. */
  readonly revisado: string;
  /** Quién responde por el texto. Rol o sesión, nunca un dato personal. */
  readonly responsable: string;
  /** Archivos del repositorio de donde se leyó. Rutas, sin número de línea. */
  readonly fuentes: readonly string[];
}

/** Estante 1 · una entrada por módulo de `MODULES`. */
export interface EntradaCatalogo {
  /** `id` del módulo en `lib/studio/modules.ts`. */
  readonly id: string;
  /** Para qué sirve la pantalla, en una línea. */
  readonly descripcion: string;
  readonly visibilidad: Visibilidad;
  /** `true` si ya tiene guía en `guias/`. Lo verifica la prueba. */
  readonly conGuia: boolean;
}

/** Un paso de una tarea. Los textos entre «» son los que se ven en pantalla. */
export interface PasoGuia {
  readonly texto: string;
  /**
   * Ancla `data-guia` del elemento, si existe, para «Muéstrame dónde»
   * (motor de guía SDD-0589). Sin ancla, el paso solo se lee.
   */
  readonly ancla?: string;
}

export interface TareaGuia {
  /** Identificador estable dentro de la guía (kebab-case). */
  readonly id: string;
  /** Como lo preguntaría una persona: «Registrar un pago de un cliente». */
  readonly titulo: string;
  /** Ruta de Studio donde empieza la tarea («Llévame ahí»). */
  readonly ruta: `/studio/${string}`;
  readonly pasos: readonly PasoGuia[];
  /** Roles que pueden hacerla, si es más estrecho que el acceso a la pantalla. */
  readonly soloRoles?: readonly StudioUserRole[];
  /** Aclaraciones cortas: qué pasa después, qué no se puede deshacer. */
  readonly notas?: readonly string[];
}

export interface ErrorFrecuente {
  /** Lo que la persona ve o le pasa. */
  readonly sintoma: string;
  /** Por qué pasa y qué hacer. */
  readonly salida: string;
}

/** Estante 2 · guía de un módulo. */
export interface GuiaModulo {
  /** `id` del módulo en `MODULES`. Una guía pertenece a un solo módulo. */
  readonly modulo: string;
  readonly paraQueSirve: string;
  readonly queSeVe: readonly string[];
  readonly tareas: readonly TareaGuia[];
  readonly erroresFrecuentes: readonly ErrorFrecuente[];
  /** Quién entra y qué acciones tienen permiso aparte, en palabras. */
  readonly quienPuede: string;
  readonly procedencia: Procedencia;
  /**
   * Estado de aprobación (SDD-0637 §5: «las aprueba una persona»). Una guía
   * `borrador` NO se entrega al modelo; la fase 3 lo hace cumplir.
   */
  readonly estado: "borrador" | "aprobada";
}
