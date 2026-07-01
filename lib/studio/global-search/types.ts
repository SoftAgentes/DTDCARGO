/**
 * Tipos del buscador global ⌘K del Studio (SDD-0135).
 *
 * DATA PURA (sin React, sin server-only) → importable desde el modal (client),
 * el server action y los tests. El `href` de cada hit es un deep-link a la
 * página de detalle del módulo dueño de la faceta.
 *
 * El corazón de seguridad (qué faceta corre / cuál queda con candado) NO vive
 * acá: vive en `facets.ts` (matriz de facetas derivada de la matriz RBAC). Este
 * archivo solo describe las formas.
 */

/** Facetas del buscador. Cada una pertenece a un módulo del ERP (ver facets.ts). */
export type GlobalSearchFacetId =
  | "clients"
  | "shipments"
  | "quotes"
  | "invoices"
  | "payments";

/** Grupo visual: operativo se muestra primero, dinero después, candado al final. */
export type FacetGroup = "operativo" | "dinero";

/**
 * Clasificación del término tecleado. Decide QUÉ facetas corren y CÓMO
 * (monto/fecha son búsquedas especiales; código rutea por prefijo).
 */
export type SearchTermKind = "amount" | "date" | "cedula" | "code" | "text";

/** Una coincidencia lista para render. Sin datos de dinero salvo en facetas de dinero. */
export interface GlobalSearchHit {
  facet: GlobalSearchFacetId;
  /** id crudo (para key de React); NO es el deep-link. */
  id: string;
  /** Código mono prominente (DTD-/S-/Q-/F-/R-…). */
  code: string;
  /** Línea principal (nombre del cliente / título). */
  title: string;
  /** Línea secundaria (ruta, estado, etc.). Opcional. */
  subtitle?: string;
  /** Deep-link a la página de detalle. */
  href: string;
}

/** Resultados de una faceta ejecutada. */
export interface GlobalSearchGroup {
  facet: GlobalSearchFacetId;
  group: FacetGroup;
  hits: GlobalSearchHit[];
}

/**
 * Faceta con candado: el rol NO puede correrla (derivado de la matriz, jamás de
 * consultar una tabla financiera). El copy es genérico → no revela nada.
 */
export interface LockedFacet {
  facet: GlobalSearchFacetId;
}

export interface GlobalSearchResult {
  /** Término normalizado que se buscó. */
  term: string;
  /** Cómo se clasificó el término. */
  kind: SearchTermKind;
  /** Facetas ejecutadas, en orden (operativo → dinero). */
  groups: GlobalSearchGroup[];
  /** Facetas de dinero bloqueadas por permiso (candado con nota). */
  locked: LockedFacet[];
  /** Mensaje de error es-VE si algo falló (sin filtrar datos). */
  error?: string;
}
