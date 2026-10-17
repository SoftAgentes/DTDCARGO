import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { avisoDeMantenimiento } from "@/lib/runtime/maintenance-notice";
import { EntrarForm } from "./EntrarForm";

/**
 * SDD-0276 · `/entrar` — la ÚNICA puerta pública de cuenta.
 *
 * Antes vivía en `/portal/login` y el nav tenía dos disparadores ("Acceder" de
 * texto y "Regístrate" de color). Ahora el nav trae un solo botón y esta
 * pantalla ofrece las dos filas: *Ingresar a mi portal* y *Crear mi cuenta y
 * Shipping Mark*. `/portal/login` quedó como 301 hacia acá.
 *
 * 🔴 `robots` va EXPLÍCITO. Estando bajo `app/portal/`, esta página heredaba el
 * `noindex` de `app/portal/layout.tsx`. Fuera de ese árbol no lo hereda de
 * nadie: sin esta línea, la puerta de acceso se indexa.
 *
 * ⚠️ Y por lo mismo cambia la tipografía, a propósito: `app/portal/layout.tsx`
 * remapea `--font-archivo*` a Sora/Nunito con el wrapper `.portal-sys`. Acá
 * manda el layout raíz, o sea **Archivo** — igual que `/registro` y que
 * `/entrar/[code]`, que son las otras dos mitades de la misma puerta y ya
 * estaban en Archivo.
 */
export const metadata: Metadata = {
  title: "Entrar o crear cuenta",
  robots: { index: false, follow: false },
};

/**
 * SDD-0278 · un mensaje por causa, en vez del "el enlace venció" que se le
 * mostraba a todo el mundo.
 *
 * Medido el 2026-08-21 sobre `auth_logs` de producción: de los fallos de
 * `/verify` en 24 h, **cero** fueron por tiempo vencido. Eran enlaces ya usados
 * (un escáner de correo los abría primero) o abiertos en otro navegador. Decirle
 * "venció" a un cliente cuyo enlace estaba vivo lo manda a pedir otro y a chocar
 * con lo mismo.
 *
 * `expired` y `link` son los códigos VIEJOS: siguen mapeados porque hay correos
 * en bandejas que todavía apuntan al callback con ellos.
 */
const NOTICE_POR_ERROR: Record<string, string> = {
  enlace:
    "Ese enlace ya no sirve: se usó, o pediste uno más nuevo, o pasó más de una hora. Pide otro acá y entra con el último que te llegue.",
  dispositivo:
    "Abriste el enlace en un navegador distinto al que lo pidió. Pide uno nuevo: los que salen ahora funcionan desde cualquier lado.",
  incompleto:
    "Ese enlace llegó cortado. Vuelve a tu correo y toca el botón, o pide uno nuevo acá.",
  expired:
    "Ese enlace ya no sirve: se usó, o pediste uno más nuevo, o pasó más de una hora. Pide otro acá y entra con el último que te llegue.",
  link: "Ese enlace no es válido. Pide uno nuevo acá.",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  // Si ya hay sesión vinculada a un cliente → directo al portal.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const client = await getPortalClient(supabase);
    if (client) redirect("/portal");
  }

  // Mantenimiento programado (SDD-0505): mismo aviso que arriba del Portal, para
  // quien todavía no entró. Un aviso del propio login (error, sin portal) manda.
  const mantenimiento = avisoDeMantenimiento();
  const notice =
    sp.status === "nohabilitado"
      ? "Iniciaste sesión, pero ese email todavía no tiene el portal habilitado. Pídele a tu asesor que te invite."
      : sp.error
        ? (NOTICE_POR_ERROR[sp.error] ?? NOTICE_POR_ERROR.enlace)
        : mantenimiento
          ? `${mantenimiento.titulo}. ${mantenimiento.texto}`
          : null;

  // Email precargado desde el correo de invitación (`/entrar?email=…`). El 301
  // de `/portal/login` conserva el query string, así que los correos viejos
  // siguen llegando acá con su `?email=`.
  const prefillEmail =
    sp.email && sp.email.includes("@") ? sp.email.trim().toLowerCase() : null;

  return (
    <EntrarForm
      notice={notice}
      authedNotBound={!!user}
      prefillEmail={prefillEmail}
    />
  );
}
