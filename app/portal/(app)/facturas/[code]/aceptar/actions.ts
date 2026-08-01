"use server";

/**
 * Registro de la aceptación de T&C del cliente (SDD-0054 · Slice C +
 * SDD-0067 · evidencia v2).
 *
 * Flujo (decisión founder, Opción B — "factura borrador, monto exacto"): el
 * operador crea la factura DDP en BORRADOR → el cliente la ve acá como "pendiente
 * de aceptar T&C" → acepta el monto EXACTO (base_amount, pre-IVA) + la medida del
 * envío → el operador emite (el gate de Slice B la reconoce).
 *
 * INVARIANTES (auditadas):
 *  - Insert SOLO vía admin client (la RLS de insert de legal_acceptances exige
 *    tenant_id = get_user_tenant_id(), que da NULL para un cliente del portal → el
 *    cliente NO puede insertar por su RLS). La identidad se resuelve PRIMERO con el
 *    client de SESIÓN (getPortalClient); recién después el admin client escribe,
 *    scopeando TODO explícito por markbox/client_id/tenant (service_role bypassa
 *    RLS = defensa en profundidad).
 *  - La aceptación DEBE sellar la medida del SHIPMENT (cbm/weight) + base_amount +
 *    TODAS las docs vigentes cliente → si no, el gate de Slice B no la reconoce.
 *  - Idempotente: pre-check (si ya hay aceptación vigente → ok "ya aceptada" sin
 *    insertar) + unique(tenant,hash) en la DB. Reintento ante choque del
 *    correlativo unique(tenant, acceptance_code) (correlativo legal sin huecos).
 *  - v2 (SDD-0067): los DOS checkboxes del modal (§1 de COPY_LEGAL_UI.md) son
 *    obligatorios, con fieldError individual. `user_agent` se lee de `headers()`
 *    — NUNCA del body del form (el cliente no escribe su propia evidencia) — y
 *    entra al hash junto con `merchant_declaration`. `invoice_id` viaja como
 *    metadato forense (fuera del hash).
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { getPendingAcceptanceInvoice } from "@/lib/portal/portal-legal-queries";
import { currentClientDocs, hasValidAcceptanceForMarkbox } from "@/lib/studio/legal/queries";
import { sealAcceptance } from "@/lib/studio/legal/seal";
import { validateAcceptanceInput, type DocRef } from "@/lib/studio/legal/types";

/** Errores por checkbox del modal (ambos obligatorios · SDD-0067). */
export type AcceptanceCheckboxErrors = {
  /** Checkbox 1: "He leído y acepto …". */
  accept_docs?: string;
  /** Checkbox 2: declaración de comerciante. */
  accept_merchant?: string;
};

export type AcceptanceFormState = {
  ok?: boolean;
  /** AC-YYYY-NNNN del acuse (en éxito). */
  acceptanceCode?: string;
  /** True si ya estaba aceptada (idempotente: éxito sin insertar). */
  alreadyAccepted?: boolean;
  error?: string;
  fieldErrors?: AcceptanceCheckboxErrors;
};

/** Cuántas veces reintentar el correlativo ante choque del unique(tenant,code). */
const CODE_RETRIES = 5;

/**
 * Registra la aceptación de la orden DDP `invoiceCode`. Recibe el code por
 * `.bind()` desde el form (useActionState pasa _prev + formData).
 */
export async function registerAcceptanceAction(
  invoiceCode: string,
  _prev: AcceptanceFormState,
  formData: FormData,
): Promise<AcceptanceFormState> {
  // 1. Identidad por SESIÓN (no por admin client). Si no es cliente del portal → corte.
  const session = await createClient();
  const client = await getPortalClient(session);
  if (!client) {
    return { error: "Tu sesión expiró o no eres un cliente del portal. Vuelve a entrar." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No pudimos procesar la aceptación ahora. Prueba de nuevo en un rato." };
  }

  // 2. tenant_id del cliente + la factura borrador DDP + medida del shipment.
  const { data: clientRow } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = String(clientRow?.tenant_id ?? "").trim();
  if (!tenantId) {
    return { error: "No pudimos resolver tu cuenta. Contacta a tu asesor." };
  }

  const order = await getPendingAcceptanceInvoice(admin, {
    tenantId,
    markbox: client.markbox,
    code: invoiceCode,
  });
  if (!order) {
    // No es borrador / no DDP / no es de este cliente / ya aceptada.
    return {
      error:
        "Esta orden ya no está pendiente de aceptación (puede que ya la hayas aceptado o que cambió de estado).",
    };
  }

  const cbm = Number(order.cbm ?? 0);
  const weightKg = Number(order.weightKg ?? 0);
  const totalUsd = order.baseAmount;

  // Referencia de la ORDEN puntual (M-1) — se sella como quote_code más abajo y
  // ata la aceptación a ESTA orden (no a cualquier factura con la misma terna).
  const quoteRef = order.shipmentCode ?? order.code;

  // 3. Idempotencia (pre-check): ¿ya hay aceptación vigente de ESTA orden con esta
  //    medida + total? orderRef = quoteRef → no la confunde con otra factura del
  //    cliente que comparta la terna.
  //    LÍMITE conocido (m-3 · round-3): dos submits CONCURRENTES del mismo form que
  //    caigan en milisegundos distintos producen `accepted_at` distinto → hash
  //    distinto → ambos pasan el unique(tenant,hash) y este pre-check (TOCTOU) → 2
  //    filas válidas idénticas salvo ms/ip/code. Daño NULO: la factura se emite una
  //    sola vez (en Facturación) y ambas filas son evidencia consistente; el único
  //    efecto es un acuse de más + un salto en el correlativo AC-. El front-end ya
  //    mitiga con `disabled={pending}` (checkbox + botón). Aceptado como limitación.
  const already = await hasValidAcceptanceForMarkbox(admin, {
    tenantId,
    clientMarkbox: client.markbox,
    cbm,
    weight: weightKg,
    total: totalUsd,
    orderRef: quoteRef,
  });
  if (already) {
    return { ok: true, alreadyAccepted: true };
  }

  // 4. Los DOS checkboxes del modal, obligatorios con fieldError individual
  //    (SDD-0067 · COPY_LEGAL_UI.md §1). El estado de cada casilla viaja en el
  //    form; la declaración de comerciante queda sellada en la evidencia.
  const acceptDocs = String(formData.get("accept_docs") ?? "").trim();
  const acceptMerchant = String(formData.get("accept_merchant") ?? "").trim();
  const checkboxOn = (v: string) => v === "on" || v === "true";
  const fieldErrors: AcceptanceCheckboxErrors = {};
  if (!checkboxOn(acceptDocs)) {
    fieldErrors.accept_docs =
      "Tienes que marcar esta casilla para confirmar que leíste y aceptas los documentos.";
  }
  if (!checkboxOn(acceptMerchant)) {
    fieldErrors.accept_merchant =
      "Tienes que confirmar la declaración de comerciante para continuar.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // 4-bis. user_agent SERVER-SIDE (decisión #4 de la spec): se lee de los
  // headers del request — NUNCA del body del form. `sealAcceptance` lo sanea
  // (trim, máx 512, vacío → null) y lo mete al hash v2.
  let userAgent: string | null = null;
  try {
    userAgent = (await headers()).get("user-agent");
  } catch {
    userAgent = null; // fuera de request scope → evidencia degrada sin fallar
  }

  // 7. Docs vigentes de cara al cliente (DEBEN ser TODAS — si falta una, el gate
  //    no cuenta la aceptación). quote_code = ref de la orden (shipment_code, si
  //    no el invoice_code) — el gate-by-markbox no filtra por quote_code, pero el
  //    campo es obligatorio y queda como referencia trazable.
  const vigentes = await currentClientDocs(admin, tenantId);
  if (vigentes.length === 0) {
    return {
      error:
        "No hay términos vigentes para aceptar en este momento. Contacta a tu asesor.",
    };
  }
  // v3 (SDD-0191 Slice A): se sella el CUERPO del documento, no solo su
  // referencia. `body_sha256` viene de la DB (migr 0297) — el cliente no lo pone.
  const docs: DocRef[] = vigentes.map((d) => ({
    key: d.key,
    version: d.version,
    body_sha256: d.body_sha256,
  }));

  // idempotency_key determinístico: invoice_id + versiones de docs (metadato; la
  // idempotencia REAL es el unique(tenant,hash), que sale del sello).
  const idempotencyKey = `inv:${order.invoiceId}|docs:${docs
    .map((d) => `${d.key}@${d.version}`)
    .sort()
    .join(",")}`;

  const { input, fieldErrors: inputErrors } = validateAcceptanceInput(
    {
      client_id: client.id,
      client_markbox: client.markbox,
      quote_code: quoteRef,
      cbm,
      weight_kg: weightKg,
      total_usd: totalUsd,
      user_agent: userAgent,
      merchant_declaration: true, // checkbox 2 ya validado arriba (fieldError si no)
      invoice_id: order.invoiceId,
      idempotency_key: idempotencyKey,
    },
    docs,
  );
  if (inputErrors || !input) {
    return {
      error:
        "No pudimos registrar la aceptación (datos de la orden incompletos). Contacta a tu asesor.",
    };
  }

  // 5 + 8. IP del edge + sello server-side (accepted_at/ip/user_agent/hash los
  // pone el server; el user_agent sellado es el de headers(), no el del form).
  const ip = await getRequestIp();
  const seal = sealAcceptance(input, docs, ip, userAgent, new Date());

  // 9 + 10. acceptance_code con reintento ante choque del correlativo + insert.
  for (let attempt = 0; attempt < CODE_RETRIES; attempt++) {
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_acceptance_code",
      { p_tenant: tenantId },
    );
    if (codeErr || !codeData) {
      return { error: "No pudimos generar el acuse. Prueba de nuevo." };
    }
    const acceptanceCode = String(codeData);

    const { error: insErr } = await admin.from("legal_acceptances").insert({
      tenant_id: tenantId,
      acceptance_code: acceptanceCode,
      client_id: seal.client_id,
      client_markbox: seal.client_markbox,
      quote_code: seal.quote_code,
      docs: seal.docs,
      cbm: seal.cbm,
      weight_kg: seal.weight_kg,
      total_usd: seal.total_usd,
      accepted_at: seal.accepted_at,
      ip: seal.ip,
      // v2 (0120): lo que se persiste es EXACTAMENTE lo que el sello hasheó.
      user_agent: seal.user_agent,
      merchant_declaration: seal.merchant_declaration,
      invoice_id: seal.invoice_id,
      hash: seal.hash,
      idempotency_key: seal.idempotency_key,
    });

    if (!insErr) {
      revalidateAfterAcceptance(order.code);
      return { ok: true, acceptanceCode };
    }

    // 23505: choque de unique. Distinguir cuál.
    if (insErr.code === "23505") {
      const msg = `${insErr.message ?? ""} ${insErr.details ?? ""}`.toLowerCase();
      // unique(tenant, hash) → MISMA evidencia ya registrada → idempotente ok.
      if (msg.includes("hash")) {
        revalidateAfterAcceptance(order.code);
        return { ok: true, alreadyAccepted: true };
      }
      // unique(tenant, acceptance_code) → correlativo pisado por otra escritura →
      // re-leer el próximo código y reintentar (correlativo legal sin huecos).
      if (msg.includes("acceptance_code") || msg.includes("acceptances_tenant_id_acceptance_code")) {
        continue;
      }
      // 23505 ambiguo (la DB no detalló el constraint): asumimos el correlativo y
      // reintentamos; si era el hash, el pre-check de la próxima vuelta lo cubre.
      continue;
    }

    return { error: "No pudimos registrar la aceptación. Prueba de nuevo." };
  }

  // Agotados los reintentos del correlativo: probable carrera transitoria.
  return { error: "No pudimos registrar la aceptación ahora. Prueba de nuevo en un rato." };
}

/** Revalida las rutas del portal afectadas por una aceptación nueva. */
function revalidateAfterAcceptance(invoiceCode: string): void {
  revalidatePath("/portal");
  revalidatePath("/portal/facturas");
  revalidatePath(`/portal/facturas/${invoiceCode}`);
  revalidatePath(`/portal/facturas/${invoiceCode}/aceptar`);
}
