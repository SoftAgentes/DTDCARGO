"use server";

/**
 * Registro self-service del Portal del Cliente (SDD-0042 Fase 6 · slice 10.1).
 *
 * REGISTRO EXPRESS (founder 2026-06-07): el alta pide SOLO lo mínimo para emitir el
 * MARKBOX y poder contactar al cliente — tipo · nombre · documento · email ·
 * WhatsApp → MARKBOX al instante. La FOTO de cédula y la DIRECCIÓN de entrega se
 * DIFIEREN a "Completa tu perfil" dentro del portal (`/portal/perfil`), donde se
 * piden antes de la 1ª compra; el asesor revisa la foto antes de operar de verdad.
 * Esto baja la fricción del lead de WhatsApp SIN perder la validación: el número de
 * documento sigue obligatorio (dedup + identidad básica + contraseña inicial).
 *
 * El cliente se da de alta SOLO (sin invitación admin): MARKBOX al instante +
 * cuenta de auth (login = MARKBOX + contraseña, contraseña inicial = cédula/RIF).
 * La cuenta nace ACTIVA (`portal_approved_at = now`, founder 2026-06-07 · SDD-0059):
 * el cliente entra directo al portal con su MARKBOX, sin pantalla de espera. La
 * verificación de identidad (foto + revisión manual del asesor, SDD-0046) corre
 * aparte y NO bloquea el acceso.
 *
 * Anti-abuso (SDD-0042 §10): el endpoint es público (registrante anónimo), así
 * que ANTES del trabajo pesado hay dos capas gratis (sin keys):
 *   0.  honeypot — campo trampa oculto del form; si llega no-vacío → bot →
 *       respuesta genérica sin escribir nada (ni throttle).
 *   2b. throttle por IP — se cuentan los intentos recientes de la IP en
 *       portal_registro_throttle; si llegó al límite → rechazo sin crear nada;
 *       si no, se registra el intento y se sigue.
 *
 * Flujo (los pasos finales son best-effort: un fallo en email NO rompe el alta):
 *   1. validar (validateRegisterInput, sin Zod)
 *   2. dedup por documento (clients del tenant con lower(rif)=doc)
 *   3. resolver el tenant operativo de DTD
 *   4. rpc next_markbox_service → MARKBOX atómico
 *   5. insert clients ACTIVO (portal_approved_at = now, tier 'regular'; SIN foto
 *      ni dirección — se completan en el perfil)
 *   6. vincular el estimado web (best-effort)
 *   7. auth.admin.createUser({ email, password: <documento>, email_confirm: true })
 *   8. insert client_users (auth_user_id, status 'active', email)
 *   9. welcome email SIN la clave (reusa sendWelcomeEmail · template welcome_markbox)
 *  10. aviso interno al equipo (best-effort)
 *
 * Todo el alta corre con el admin client (service_role): el registrante es
 * anónimo y necesita bypassear RLS para insertar clients/client_users. Sin
 * SUPABASE_SERVICE_ROLE_KEY el alta no puede completarse (error claro).
 */

import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { sendWelcomeEmail } from "@/lib/studio/welcome-email";
import { notifyNewClientToAdmin } from "@/lib/studio/new-client-notify";
import { validateMarkboxFormat } from "@/lib/studio/markbox-utils";
import {
  linkEstimateByCode,
  linkEstimatesByContact,
} from "@/lib/studio/quote-queries";
import {
  validateRegisterInput,
  type RegisterActionState,
  type RegisterInput,
} from "@/lib/portal/register-types";

// ── Anti-abuso (SDD-0042 §10): honeypot + throttle por IP en DB ──────────────
// Honeypot: campo trampa oculto del form (RegisterForm.tsx). Un humano nunca lo
// llena; un bot naive sí → si llega no-vacío, descartamos el alta sin escribir
// nada (ni clients, ni auth, ni throttle).
const HONEYPOT_FIELD = "empresa_web";
// Throttle: máximo de altas por IP dentro de la ventana. Tuneables.
const REGISTRO_IP_LIMIT = 5;
const REGISTRO_WINDOW_MINUTES = 60;
const THROTTLE_TABLE = "portal_registro_throttle";

function parseForm(formData: FormData): Partial<RegisterInput> {
  const kindRaw = String(formData.get("kind") ?? "persona");
  return {
    kind: kindRaw === "empresa" ? "empresa" : "persona",
    name: (formData.get("name") as string | null) ?? undefined,
    company: (formData.get("company") as string | null) ?? undefined,
    document: (formData.get("document") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    whatsapp: (formData.get("whatsapp") as string | null) ?? undefined,
    officePhone: (formData.get("office_phone") as string | null) ?? undefined,
  };
}

export async function registerClientAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  // 0. Honeypot anti-bot (SDD-0042 §10) — ANTES de cualquier trabajo o write.
  //    Si el campo trampa llega no-vacío, es un bot: respondemos algo genérico
  //    que no revela la trampa y NO escribimos nada (ni throttle).
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? "").trim();
  if (honeypot) {
    return { error: "No pudimos procesar tu registro. Prueba de nuevo." };
  }

  // 1. Validar (express: tipo/nombre/documento/email/WhatsApp).
  const { input, fieldErrors } = validateRegisterInput(parseForm(formData));
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "El registro no está disponible ahora. Prueba de nuevo en un rato.",
    };
  }

  // 2b. Throttle por IP (SDD-0042 §10) — DESPUÉS de validar input + honeypot,
  //     ANTES del trabajo pesado (next_markbox consume correlativo; los inserts
  //     escriben). Contamos los intentos recientes de esta IP; si llegó al
  //     límite, rechazamos sin crear nada. Si está por debajo, registramos este
  //     intento y seguimos. service_role bypassa RLS de la tabla.
  const ip = await getRequestIp();
  const windowStart = new Date(
    Date.now() - REGISTRO_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count: recentCount, error: throttleErr } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  // Fail-open ante un error de lectura del throttle: no bloqueamos un alta
  // legítima por un fallo de infraestructura del propio anti-abuso.
  if (!throttleErr && (recentCount ?? 0) >= REGISTRO_IP_LIMIT) {
    return {
      error: "Demasiados registros desde tu conexión. Prueba de nuevo en un rato.",
    };
  }
  // Registrar el intento (best-effort: si falla el insert, el alta sigue).
  await admin.from(THROTTLE_TABLE).insert({ ip });

  // 3. Resolver el tenant operativo de DTD (hoy uno solo; multi-tenant signup = futuro).
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantErr || !tenantRow?.id) {
    return { error: "No pudimos resolver tu cuenta. Contactá a tu asesor." };
  }
  const tenantId = tenantRow.id;

  // 2. Dedup por documento (RIF en empresa; cédula guardada en rif para persona —
  //    el módulo Clientes guarda el documento en `clients.rif`). Comparamos en
  //    minúsculas contra el documento canónico.
  const docLower = input.document.toLowerCase();
  const { data: dup } = await admin
    .from("clients")
    .select("id, markbox")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .ilike("rif", docLower)
    .limit(1)
    .maybeSingle<{ id: string; markbox: string }>();
  if (dup) {
    return {
      fieldErrors: {
        document: `Este ${input.kind === "empresa" ? "RIF" : "cédula"} ya tiene una cuenta en DTD Cargo. Si eres tú, entra con tu MARKBOX o pide recuperar tu contraseña.`,
      },
    };
  }

  // 4. MARKBOX atómico. Usamos la variante *_service (migr 0109): el registro
  //    self-service es anónimo → admin client (service_role) SIN tenant
  //    autenticado, y `next_markbox()` exige uno vía assert_tenant_match()
  //    (42501). next_markbox_service() tiene la misma lógica sin ese guard y
  //    EXECUTE restringido a service_role (no es forjable desde el navegador).
  const { data: markboxData, error: markboxErr } = await admin.rpc("next_markbox_service", {
    p_tenant_id: tenantId,
  });
  if (markboxErr || !markboxData) {
    return { error: "No pudimos generar tu código. Prueba de nuevo." };
  }
  const markbox = String(markboxData);
  if (!validateMarkboxFormat(markbox)) {
    return { error: "No pudimos generar tu código. Prueba de nuevo." };
  }

  // 5. Insert del cliente ACTIVO (portal_approved_at = now → sin pantalla de
  //    espera; tier regular). SIN foto ni dirección: el REGISTRO EXPRESS las
  //    DIFIERE a "Completa tu perfil" (/portal/perfil), donde se piden antes de la
  //    1ª compra y el asesor revisa la foto. Por eso cedula_photo_path/address
  //    nacen null (ambas columnas son nullable).
  const { data: clientRow, error: clientErr } = await admin
    .from("clients")
    .insert({
      tenant_id: tenantId,
      markbox,
      name: input.company ?? input.name,
      email: input.email,
      phone: input.whatsapp,
      // Dirección DIFERIDA al perfil → null al alta.
      address: null,
      rif: input.document,
      // El enum client_tier es regular|vip|premium (sin 'standard'): el alta
      // self-service entra como 'regular', que es además el default de la tabla.
      tier: "regular",
      // Foto DIFERIDA al perfil → null al alta.
      cedula_photo_path: null,
      // SDD-0046: origen + tipo de documento (para la verificación de identidad).
      // El self-registro siempre es canal 'portal'; doc_kind viene del form.
      registration_channel: "portal",
      doc_kind: input.kind,
      // Cuenta ACTIVA al registrar (founder 2026-06-07 · SDD-0059): el cliente
      // entra directo al portal, sin pantalla de espera. getPortalActivation() ve
      // portal_approved_at != null → activada. La revisión de identidad (foto +
      // asesor, SDD-0046) corre aparte y NO bloquea el acceso.
      portal_approved_at: new Date().toISOString(),
      notes:
        input.kind === "empresa"
          ? `Contacto: ${input.name}${input.officePhone ? ` · Tel. oficina: ${input.officePhone}` : ""}`
          : input.officePhone
            ? `Tel. oficina: ${input.officePhone}`
            : null,
    })
    .select("id")
    .single<{ id: string }>();
  if (clientErr || !clientRow) {
    // Backstop del race: el dedup `ilike` exact de arriba no atrapa variantes de
    // formato (V-12.345.678 vs V12345678) ni inserts concurrentes; el índice
    // clients_tenant_doc_unique (normalizado, por tenant) sí → unique_violation
    // de Postgres (23505). Mismo mensaje que el dedup explícito de arriba.
    if (clientErr?.code === "23505") {
      return {
        fieldErrors: {
          document:
            "Este documento ya tiene una cuenta en DTD Cargo. Entrá con tu MARKBOX o pide recuperar tu contraseña.",
        },
      };
    }
    console.error("[registerClientAction] insert clients error:", clientErr);
    return { error: `No pudimos crear tu cuenta: ${clientErr?.message ?? "error"}` };
  }

  // 6. SDD-0061 Fase B2 — vincular el estimado web a este cliente recién creado.
  //    Best-effort (un fallo NO rompe el alta): primero por código EST- (camino
  //    feliz, llega como ?est= en el CTA → hidden), si no por datos exactos
  //    (teléfono + email del registro). client_name se snapshotea al nombre real.
  const clientDisplayName = input.company ?? input.name;
  try {
    const estCode = String(formData.get("est") ?? "").trim();
    const linkedByCode = estCode
      ? await linkEstimateByCode(admin, tenantId, estCode, markbox, clientDisplayName)
      : false;
    if (!linkedByCode) {
      await linkEstimatesByContact(
        admin,
        tenantId,
        { email: input.email, phone: input.whatsapp },
        markbox,
        clientDisplayName,
      );
    }
  } catch (linkErr) {
    console.error("[registerClientAction] vínculo de estimado web falló:", linkErr);
  }

  // 7. Crear la cuenta de auth · contraseña inicial = documento (cédula/RIF).
  const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.document,
    email_confirm: true,
    user_metadata: { portal_markbox: markbox, tenant: "dtd-cargo" },
  });
  if (authErr || !authResp?.user) {
    const msg = (authErr?.message ?? "").toLowerCase();
    // El cliente ya existe en clients (markbox emitido). Si el email ya tiene
    // cuenta de auth, no podemos crear la contraseña-cédula → guía a recuperar.
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        markbox,
        warning:
          "Tu cuenta quedó creada, pero ese email ya tenía acceso. Entrá con tu MARKBOX o pide recuperar tu contraseña.",
      };
    }
    console.error("[registerClientAction] createUser error:", authErr);
    return {
      markbox,
      warning:
        "Tu cuenta quedó creada con tu MARKBOX, pero no pudimos activar el login automático. Pedí recuperar tu contraseña desde el login.",
    };
  }

  // 8. Vincular el auth.user con el cliente (client_users active). Best-effort:
  //    si falla, el cliente igual tiene MARKBOX; un admin puede re-vincular.
  const { error: linkErr } = await admin.from("client_users").insert({
    tenant_id: tenantId,
    client_id: clientRow.id,
    email: input.email,
    auth_user_id: authResp.user.id,
    status: "active",
    bound_at: new Date().toISOString(),
  });
  if (linkErr) {
    console.error("[registerClientAction] insert client_users error:", linkErr);
  }

  // 9. Email de bienvenida al CLIENTE con su MARKBOX (SIN la clave; template
  //    welcome_markbox). Envío real vía Resend (SDD-0059). Best-effort.
  //    Saluda con la razón social si es empresa (= el nombre con el que queda el
  //    cliente en el sistema), si no con el nombre de la persona.
  let warning: string | undefined;
  const welcome = await sendWelcomeEmail(admin, tenantId, {
    markbox,
    name: input.company ?? input.name,
    email: input.email,
  });
  if (!welcome.ok) {
    warning = "Cuenta creada. El email de bienvenida no se pudo enviar.";
    console.warn("[registerClientAction] welcome email failed:", welcome.error);
  }

  // 10. Aviso interno al EQUIPO: entró un cliente nuevo (SDD-0059). Best-effort —
  //     no rompe el alta ni depende del welcome. Solo en el alta self-service:
  //     el alta admin la inicia un humano que ya conoce al cliente.
  await notifyNewClientToAdmin(admin, tenantId, {
    markbox,
    name: input.company ?? input.name,
    contactName: input.kind === "empresa" ? input.name : null,
    document: input.document,
    email: input.email,
    whatsapp: input.whatsapp,
    city: null,
    state: null,
    channel: "portal",
  });

  return { ok: true, markbox, warning };
}
