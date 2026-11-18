/**
 * SDD-0654 fase 2 · Señales entre la barra superior y el inicio simple.
 *
 * El botón «Guía» vive en la barra (a mano desde cualquier pantalla), pero la
 * guía se recorre sobre los bloques del inicio simple. En el inicio, la barra
 * avisa con un evento del navegador; en otra pantalla, lleva al inicio con
 * `?guia=1` y el inicio la arranca al cargar.
 */

/** Evento que pide abrir la guía de las primeras veces. */
export const EVENTO_ABRIR_GUIA = "portal:abrir-guia";

/** Evento que pide abrir el tutorial del código (bloque 5). */
export const EVENTO_ABRIR_TUTORIAL = "portal:abrir-tutorial-codigo";

/** Parámetro de la URL del inicio que arranca la guía al cargar. */
export const PARAM_GUIA = "guia";

export const RUTA_INICIO = "/portal";
