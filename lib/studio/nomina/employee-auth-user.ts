/**
 * Cuenta de acceso del empleado al aprobar una solicitud (SDD-0652 §4 punto 6, D2).
 *
 * Antes, si el correo ya existía en Auth, la aprobación **reutilizaba** esa
 * cuenta: buscaba en la primera página de 200 usuarios y leía sus comprobaciones
 * sin mirar el error, así que un fallo se interpretaba como «no está tomada».
 * Un cliente del portal con ese correo quedaba enlazado a la ficha y abría sus
 * recibos en `/m/emp`.
 *
 * Ahora hay tres resultados y ninguno reutiliza:
 *
 *   - `created`: el correo no existía y se creó la cuenta. Es la única vía por
 *     la que una aprobación enlaza;
 *   - `exists`: el correo ya tiene una cuenta, de quien sea. No se toca ni se
 *     busca de quién es. La ficha se crea **sin acceso**. Si la cuenta es de un
 *     usuario del Studio, el admin la enlaza a mano desde la ficha (con motivo y
 *     registro). Si es solo de `/m/emp`, la RPC de enlace la rechaza: ese caso
 *     («reenlazar») todavía no existe y el aviso lo dice;
 *   - `error`: cualquier otra cosa. La aprobación se detiene: falla cerrado.
 *
 * No hay `listUsers` ni lecturas de otras tablas: lo que no se consulta no puede
 * fallar abierto ni depender de una página.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EmployeeAuthUserResult =
  | { kind: "created"; userId: string }
  | { kind: "exists" }
  | { kind: "error" };

type AuthLikeError = { code?: unknown; status?: unknown; message?: unknown };

/** GoTrue dice `email_exists` (422). El texto es el respaldo para versiones que no mandan el código. */
function esCorreoExistente(err: AuthLikeError): boolean {
  if (err.code === "email_exists") return true;
  return (
    err.code === undefined &&
    err.status === 422 &&
    typeof err.message === "string" &&
    /already (been )?registered/i.test(err.message)
  );
}

export async function ensureEmployeeAuthUser(
  admin: Pick<SupabaseClient, "auth">,
  email: string,
): Promise<EmployeeAuthUserResult> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return { kind: "error" };

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
      user_metadata: { role: "employee", app: "m-emp" },
    });
    if (!error) {
      const userId = data?.user?.id;
      return userId ? { kind: "created", userId } : { kind: "error" };
    }
    if (esCorreoExistente(error as AuthLikeError)) return { kind: "exists" };
    console.error("[ensureEmployeeAuthUser]", (error as AuthLikeError).code ?? "error");
    return { kind: "error" };
  } catch {
    console.error("[ensureEmployeeAuthUser]", "excepción");
    return { kind: "error" };
  }
}

/**
 * Deshace una cuenta **recién creada en esta misma aprobación** cuando la ficha
 * no se pudo crear, para que no quede una cuenta suelta que el siguiente
 * intento encuentre como «ya existe». Solo se llama con el id que devolvió
 * `created`. Si falla, se registra y sigue: el siguiente intento creará la
 * ficha sin acceso y el admin la enlaza a mano.
 */
export async function discardCreatedAuthUser(admin: Pick<SupabaseClient, "auth">, userId: string): Promise<void> {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error("[discardCreatedAuthUser]", (error as AuthLikeError).code ?? "error");
  } catch {
    console.error("[discardCreatedAuthUser]", "excepción");
  }
}
