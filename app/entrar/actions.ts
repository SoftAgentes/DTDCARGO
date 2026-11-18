"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { esDominioInterno } from "@/lib/portal/correo-comprobacion";
import { emailIlikePattern, sameEmail } from "@/lib/shared/email-literal";
import { resendPuedeEnviar } from "@/lib/studio/mail/resend-api";
import { mintPortalMagicToken, portalOpenUrl } from "@/lib/studio/portal/magic-link";
import { sendPortalMagicLinkEmail } from "@/lib/studio/portal/magic-link-email";
import { correoSinComprobar } from "@/lib/studio/portal/correo-comprobacion";
import { buscarClienteSinAcceso } from "@/lib/studio/portal/sin-acceso";
import { avisarClienteSinAcceso } from "@/lib/studio/portal/sin-acceso-aviso";
import { emitirLinkAutoservicio } from "@/lib/studio/portal/autoservicio-link";
import type { EntrarResultado } from "@/lib/portal/entrar-resultado";
import { esperarTiempoMinimo } from "@/lib/portal/tiempo-minimo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const THROTTLE_TABLE = "portal_registro_throttle";
const THROTTLE_PREFIX = "portal-login:";
/** Segundo cerrojo, por EMAIL: el de IP no frena a quien rota de red. */
const THROTTLE_EMAIL_PREFIX = "portal-login-mail:";
const THROTTLE_LIMIT = 8;
const THROTTLE_EMAIL_LIMIT = 5;
const THROTTLE_WINDOW_MINUTES = 60;

const VARIOS_PEDIDOS =
  "Hubo varios pedidos seguidos y por seguridad no mandamos más enlaces por ahora. Si ya tienes uno en tu correo, úsalo. Si no, vuelve a pedirlo dentro de una hora.";
const NO_PUDIMOS_ATENDER =
  "No pudimos atender tu pedido y no salió ningún enlace. Vuelve a intentarlo en unos minutos.";
/**
 * SDD-0672 · el correo tiene acceso, pero el envío falló. Desde que la pantalla
 * dice qué pasó con cada correo, esto se puede decir: antes (SDD-0597) se
 * callaba porque distinguirlo de «sin cuenta» abría el oráculo.
 */
const NO_SALIO_EL_ENLACE =
  "No pudimos enviarte el enlace ahora. Vuelve a intentarlo en unos minutos; si sigue sin llegar, escríbenos por WhatsApp.";

export type PortalLoginState = {
  error?: string;
  /**
   * SDD-0672 · qué pasó con el correo, dicho en pantalla (decisión de Sam,
   * 2026-11-18: «Decirlo en pantalla»). Reemplaza la respuesta única de la
   * SDD-0597. `enlace` sí quiere decir que el correo salió: si el envío falla,
   * la acción devuelve `error`.
   */
  resultado?: EntrarResultado;
  /** Pedidos de enlace seguidos desde esta pantalla: es lo que hace notar un reintento. */
  requests?: number;
  /**
   * Sólo con `sin_portal`: al equipo le llegó el aviso (SDD-0279). La pantalla no
   * lo afirma si no salió.
   */
  equipoAvisado?: boolean;
  /** Email que escribió la persona, para mostrarlo y para volver a pedir. */
  email?: string;
};

function conResultado(
  prev: PortalLoginState,
  resultado: EntrarResultado,
  email: string,
): PortalLoginState {
  // El contador sólo cuenta reintentos del mismo pedido de enlace.
  const requests =
    resultado === "enlace" && prev.resultado === "enlace" && prev.email === email
      ? (Number(prev.requests) || 0) + 1
      : 1;
  return { resultado, requests, email };
}

/**
 * Camino VIEJO — Supabase Auth manda el correo y el enlace vuelve con `?code=`
 * (flujo PKCE).
 *
 * 🔴 Depende de una cookie `code_verifier` del navegador que pidió el enlace: si
 * el cliente abre el correo en otro navegador, falla y el portal le decía
 * "el enlace venció" (ver `lib/studio/portal/magic-link.ts`). Queda **sólo como
 * plan B**, y sólo donde todavía no se acuñó nada (ver `requestMagicLink`).
 *
 * SDD-0646 D-1 · sólo se llama DESPUÉS de preguntar `correoSinComprobar`: un
 * correo sin comprobar no llega aquí. Lo vigila la prueba de inventario.
 *
 * Sólo se llama para un correo CON acceso, así que su error ya no abre nada: se
 * dice que el enlace no salió (SDD-0672).
 */
async function sendMagicLinkLegacy(
  prev: PortalLoginState,
  email: string,
): Promise<PortalLoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/portal/callback`,
      shouldCreateUser: false,
    },
  });
  if (error) {
    console.error("[entrar] Auth no mandó el enlace:", error.status, error.code);
    return { error: NO_SALIO_EL_ENLACE, email };
  }
  return conResultado(prev, "enlace", email);
}

type ThrottleResult = "ok" | "limit" | "error";

/** Cuenta + registra un toque en la ventana del cerrojo. Falla cerrado. */
async function touchThrottle(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  limit: number,
): Promise<ThrottleResult> {
  const windowStart = new Date(
    Date.now() - THROTTLE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", key)
    .gte("created_at", windowStart);
  if (error) return "error";
  if ((count ?? 0) >= limit) return "limit";
  const { error: insertError } = await admin.from(THROTTLE_TABLE).insert({ ip: key });
  return insertError ? "error" : "ok";
}

function throttled(result: Exclude<ThrottleResult, "ok">, email: string): PortalLoginState {
  return { error: result === "limit" ? VARIOS_PEDIDOS : NO_PUDIMOS_ATENDER, email };
}

/**
 * Pide el enlace de acceso al portal. Método ÚNICO de entrada (SDD-0094): el
 * cliente entra con su email, no con su Shipping Mark.
 *
 * SDD-0672 · **mira el correo ANTES de mandar nada y dice en pantalla qué pasó**
 * (decisión de Sam, 2026-11-18). Cuatro resultados:
 *
 *  - `enlace` → tiene acceso; salió el enlace de entrada.
 *  - `crear_portal` → es cliente del ERP sin acceso al portal, y le salió a su
 *    correo el enlace de autoservicio para crearlo (entrega 2, migración 0562).
 *  - `sin_portal` → es cliente del ERP sin acceso al portal y el enlace de
 *    autoservicio no aplica (o no salió). Se avisa al equipo y al cliente
 *    (SDD-0279), como antes.
 *  - `sin_comprobar` → es el correo de una cuenta que nació del link de registro
 *    y su dueño todavía no lo comprobó (SDD-0646 D-1). No sale ningún enlace.
 *  - `sin_cuenta` → no lo encontramos. No sale ningún correo: es lo que impide
 *    que `/entrar` sirva para mandarle correo de DTD a un tercero cualquiera.
 *
 * 🔴 Esto deja averiguar si un correo es cliente de DTD Cargo; la SDD-0597 lo
 * evitaba. Sam lo aceptó a sabiendas: `/registro` ya lo decía («Este correo ya
 * tiene una cuenta…»). Lo que queda en pie son los dos cerrojos de abajo (8 por
 * hora por origen y 5 por correo), que corren ANTES de mirar nada.
 *
 * SDD-0278 · el enlace se acuña como `token_hash` y lo mandamos nosotros, no Auth:
 * así funciona aunque el correo se abra en otro navegador, y queda en `mail_logs`.
 * El camino viejo sigue vivo abajo como plan B.
 *
 * ⚠️ El login puede crear `auth.users`, pero **sólo** para un email que ya tiene
 * fila en `client_users` (`invited` o `active`): alguien a quien el equipo ya
 * habilitó.
 */
export async function requestMagicLink(
  prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Ingresa un email válido." };
  }
  // SDD-0672 · todas las respuestas, pase lo que pase con el correo, tardan al
  // menos lo mismo (ver `lib/portal/tiempo-minimo.ts` y su límite). `finally`:
  // una excepción (por ejemplo, un envío que tira) tampoco se salta el piso.
  const inicio = Date.now();
  try {
    return await resolverPedido(prev, email);
  } finally {
    await esperarTiempoMinimo(inicio);
  }
}

async function resolverPedido(
  prev: PortalLoginState,
  email: string,
): Promise<PortalLoginState> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // SDD-0646 D-1 · sin el cliente admin no se puede preguntar si el correo
    // está sin comprobar, así que no sale ningún enlace por ningún camino.
    return { error: NO_PUDIMOS_ATENDER, email };
  }

  const originHash = createHash("sha256")
    .update(await getRequestIp())
    .digest("hex");
  const origin = await touchThrottle(
    admin,
    `${THROTTLE_PREFIX}${originHash}`,
    THROTTLE_LIMIT,
  );
  if (origin !== "ok") return throttled(origin, email);

  const emailHash = createHash("sha256").update(email).digest("hex");
  const perEmail = await touchThrottle(
    admin,
    `${THROTTLE_EMAIL_PREFIX}${emailHash}`,
    THROTTLE_EMAIL_LIMIT,
  );
  if (perEmail !== "ok") return throttled(perEmail, email);

  // La dirección interna de una cuenta sin comprobar (`…@sin-comprobar.invalid`)
  // no es de nadie: no recibe correo ni sirve para entrar.
  if (esDominioInterno(email)) return conResultado(prev, "sin_cuenta", email);

  const { data: clientUser, error: clientUserError } = await admin
    .from("client_users")
    .select("id, tenant_id, email")
    .ilike("email", emailIlikePattern(email))
    .in("status", ["invited", "active"])
    .limit(1)
    .maybeSingle<{ id: string; tenant_id: string; email: string }>();
  // Una consulta caída no dice nada del correo: no se puede afirmar ningún caso.
  if (clientUserError) return { error: NO_PUDIMOS_ATENDER, email };

  // SDD-0646 D-1 · un correo que su dueño todavía no comprobó (cuenta que nació
  // del link de registro) no recibe enlace de entrada. Se pregunta SIEMPRE, antes
  // de bifurcar. Si la consulta falla, no sale nada por ningún camino.
  const sinComprobar = await correoSinComprobar(admin, email);
  if (sinComprobar.estado === "error") return { error: NO_PUDIMOS_ATENDER, email };
  const bloqueado = sinComprobar.estado === "ok" && sinComprobar.bloquea;
  const pendiente = sinComprobar.estado === "ok" && sinComprobar.pendiente;

  if (bloqueado) return conResultado(prev, "sin_comprobar", email);

  // `sameEmail` y no sólo la fila: `*` no se puede escapar (ver `email-literal.ts`).
  // Sin esto se le acuña un enlace y una cuenta de Auth al correo que escribió, sin
  // que el equipo lo haya habilitado.
  if (!clientUser || !sameEmail(clientUser.email, email)) {
    // Un correo por comprobar SÍ tiene acceso (entró por WhatsApp): no es «cliente
    // sin acceso», y no se le manda ningún correo desde aquí.
    if (pendiente) return conResultado(prev, "sin_comprobar", email);

    // SDD-0279 · sin fila de acceso NO quiere decir "desconocido". La mayoría de
    // los clientes vivos del ERP nunca fue invitada al portal. Si es cliente, se
    // le avisa a él y al equipo, y un humano le devuelve el acceso. NO se le
    // manda a `/registro`: con documento cargado choca contra el dedup, y sin
    // documento le emite un Shipping Mark nuevo que le parte el historial
    // (medido en `lib/studio/portal/sin-acceso.ts`).
    const busqueda = await buscarClienteSinAcceso(admin, email);
    // Sin poder preguntar, decir «no encontramos una cuenta» engañaría a un cliente.
    if (busqueda.estado === "error") return { error: NO_PUDIMOS_ATENDER, email };
    if (busqueda.cliente) {
      // SDD-0672 entrega 2 · si la base lo permite (migración 0562), le llega a su
      // correo un enlace para crear su portal, con la guarda de cédula o WhatsApp.
      // Si no aplica, falta la migración o el correo no sale, queda el aviso al
      // equipo de la SDD-0279, como en la entrega 1.
      const link = await emitirLinkAutoservicio(admin, busqueda.cliente, email);
      if (link.estado === "enviado") return conResultado(prev, "crear_portal", email);
      const aviso = await avisarClienteSinAcceso(admin, busqueda.cliente, email);
      return {
        ...conResultado(prev, "sin_portal", email),
        equipoAvisado: aviso?.avisadoEquipo === true,
      };
    }
    return conResultado(prev, "sin_cuenta", email);
  }

  // 🔴 Para Auth, acuñar cuenta como envío: `generateLink` escribe
  // `recovery_sent_at`, y el `/otp` de los 60 s siguientes
  // (`GOTRUE_SMTP_MAX_FREQUENCY`) da 429 sin mandar nada. El plan B sólo existe
  // ANTES de acuñar: sin Resend se va directo a Auth, que es como el entorno de
  // prueba entrega en Mailpit.
  if (!resendPuedeEnviar()) return sendMagicLinkLegacy(prev, email);

  // Camino nuevo: acuñar `token_hash` y mandarlo por nuestro pipeline.
  const tokenHash = await mintPortalMagicToken(admin, email);
  if (!tokenHash) return sendMagicLinkLegacy(prev, email);

  const sent = await sendPortalMagicLinkEmail(admin, clientUser.tenant_id, {
    email,
    url: portalOpenUrl(tokenHash),
  });
  // Ya se acuñó: Auth no puede cubrirlo. El detalle queda en `mail_logs`, y de ahí
  // lo levanta `/api/cron/mail-health`; acá va sin el correo ni el texto del
  // proveedor, que puede repetirlo. `queued` = registrado, NO enviado (nadie lo
  // reintenta): tampoco salió.
  if (!sent.ok || sent.queued) {
    console.error("[entrar] el enlace no salió:", sent.ok ? "queued" : "failed");
    return { error: NO_SALIO_EL_ENLACE, email };
  }
  return conResultado(prev, "enlace", email);
}
