import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from "payload";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Tras guardar/borrar contenido en Payload, invalida las rutas afectadas
 * y el tag global para que la próxima request al sitio público regenere.
 *
 * Pasamos las rutas como argumento porque cada collection/global afecta
 * páginas distintas.
 *
 * Next.js 16: `revalidateTag(tag, profile)` requiere un segundo arg de
 * cache life profile. Usamos `"default"` para deferir a la política
 * default de la app (equivalente al comportamiento single-arg pre-Next 16).
 */

export const revalidateCollectionAfterChange =
  (paths: string[], tags?: string[]): CollectionAfterChangeHook =>
  ({ doc }) => {
    for (const p of paths) revalidatePath(p);
    if (tags) for (const t of tags) revalidateTag(t, "default");
    return doc;
  };

export const revalidateCollectionAfterDelete =
  (paths: string[], tags?: string[]): CollectionAfterDeleteHook =>
  ({ doc }) => {
    for (const p of paths) revalidatePath(p);
    if (tags) for (const t of tags) revalidateTag(t, "default");
    return doc;
  };

export const revalidateGlobalAfterChange =
  (paths: string[], tags?: string[]): GlobalAfterChangeHook =>
  ({ doc }) => {
    for (const p of paths) revalidatePath(p);
    if (tags) for (const t of tags) revalidateTag(t, "default");
    return doc;
  };
