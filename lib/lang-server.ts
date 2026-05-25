/**
 * Helpers de idioma del operario PWA (SDD-0027) · SERVER-ONLY.
 *
 * Usa `next/headers` para leer la cookie `dtd_op_lang`. NO importar
 * desde client components (rompe build).
 */

import { cookies } from "next/headers";
import { LANG_COOKIE_NAME, type Lang } from "./lang";

/** Lee la cookie y devuelve "es" como fallback seguro. */
export async function getOperarioLang(): Promise<Lang> {
  const store = await cookies();
  const raw = store.get(LANG_COOKIE_NAME)?.value;
  return raw === "cn" ? "cn" : "es";
}
