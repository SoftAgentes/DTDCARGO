/**
 * Confirmar la contraseña de quien está en sesión antes de una acción delicada
 * (SDD-0515: «Ver PIN» de un operario). SOLO servidor.
 *
 * Por qué una sesión aparte. La base exige, con `auth.jwt()`, que el JWT traiga
 * en `amr` el método `password` con una hora de hace 5 minutos o menos. Ese
 * `amr` lo emite Supabase Auth (GoTrue) al entrar con contraseña. En vez de
 * volver a iniciar la sesión del navegador —cambiaría sus cookies y, con MFA,
 * bajaría su nivel—, se abre una sesión nueva en un cliente que no guarda nada
 * (`persistSession: false`, sin cookies ni almacenamiento), se usa SOLO para la
 * llamada que la necesita y se cierra con `signOut({ scope: "local" })`, que
 * revoca únicamente esa sesión.
 *
 * La contraseña sólo viaja a Supabase Auth: no se guarda, no se registra en
 * consola y no vuelve en ningún resultado ni error. Si el usuario que entra no
 * es el de la sesión del navegador, no se usa el cliente.
 */

import "server-only";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export type PasswordConfirmationFailure =
  /** La contraseña no es la de esa cuenta. */
  | "invalid"
  /** Supabase Auth no respondió como se esperaba (red, límite de intentos, configuración). */
  | "unavailable"
  /** La sesión nueva es de otra cuenta: no se usa. */
  | "mismatch";

export type PasswordConfirmed<T> =
  | { ok: true; value: T }
  | { ok: false; reason: PasswordConfirmationFailure };

type AuthErrorLike = { code?: string; message?: string; status?: number };

function isInvalidCredentials(error: AuthErrorLike): boolean {
  return (
    error.code === "invalid_credentials" ||
    /invalid/i.test(error.message ?? "")
  );
}

/**
 * Entra con `email` + `password` en un cliente efímero, comprueba que sea el
 * usuario `userId`, corre `run` con ese cliente y cierra la sesión pase lo que
 * pase. `run` recibe un cliente cuyo JWT acaba de confirmar la contraseña.
 */
export async function withPasswordConfirmedClient<T>(
  expected: { userId: string; email: string },
  password: string,
  run: (client: SupabaseClient) => Promise<T>,
): Promise<PasswordConfirmed<T>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, reason: "unavailable" };

  const client = createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let signedIn = false;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: expected.email,
      password,
    });
    if (error) {
      return { ok: false, reason: isInvalidCredentials(error) ? "invalid" : "unavailable" };
    }
    if (!data.session) return { ok: false, reason: "unavailable" };
    signedIn = true;
    if (data.user?.id !== expected.userId) return { ok: false, reason: "mismatch" };
    return { ok: true, value: await run(client) };
  } finally {
    if (signedIn) {
      // Revoca sólo esta sesión; si falla, el token caduca solo en su hora.
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  }
}
