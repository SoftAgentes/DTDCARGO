import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient, getPortalAdvisor } from "@/lib/portal/portal-queries";
import { listMyShipments } from "@/lib/portal/portal-queries";
import { listMyClaims } from "@/lib/portal/portal-claims";
import {
  buildAdvisorCardModel,
  type PortalAdvisor,
  type PortalClient,
} from "@/lib/portal/portal-types";
import {
  getPortalThread,
  getPortalConversationId,
  listPortalConversationDigests,
  type PortalThreadMessage,
  type PortalConversationDigest,
} from "@/lib/portal/portal-conversation-queries";
import {
  listClaimEvidence,
  type ClaimEvidenceItem,
} from "@/lib/studio/reclamos/claim-evidence";
import { CONTACT } from "@/lib/design-tokens";
import { WhatsAppIcon, MailIcon, PhoneIcon } from "@/components/Icon";
import { PortalClaims } from "../reclamos/_components/PortalClaims";
import { PortalMessageForm } from "../mensajes/PortalMessageForm";
import { PortalChatLive } from "../../_components/PortalChatLive";
import { PortalPushOptIn } from "../../_components/PortalPushOptIn";
import { getProfileCompleteness } from "@/lib/portal/portal-queries";
import { isModuleLocked } from "@/lib/portal/verify-gate";
import { PortalVerifyGate } from "../_components/PortalVerifyGate";

export const metadata: Metadata = { title: "Soporte" };

/**
 * Soporte del portal — pantalla ÚNICA del Norte (SDD-0147). Funde lo que antes
 * eran dos pestañas (Mensajes · Reclamos):
 *   · Izquierda — "Tus casos": los reclamos (SDD-0101/0102) con número, estado y
 *     seguimiento + "Nuevo caso" (PortalClaims en modo embedded).
 *   · Derecha — "Chat con tu asesor": el hilo de Conversaciones (SDD-0056) + caja
 *     de envío, con la identidad del asesor asignado y un indicador HONESTO de
 *     horario/SLA (V1 no promete presencia en tiempo real). Debajo, "Otros
 *     canales" (WhatsApp/email/teléfono) — WhatsApp deja de ser el CTA hero.
 *
 * Reutiliza los dos backends existentes SIN migración. `/portal/mensajes` y
 * `/portal/reclamos` redirigen acá (permanentRedirect).
 */
export default async function PortalSoportePage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;
  const prefill =
    tema === "datos"
      ? "Hola, quiero actualizar unos datos de mi cuenta: "
      : undefined;

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  // Gate de verificación (SDD-0169). Soporte se cierra por fidelidad al Norte,
  // pero la pantalla del gate deja WhatsApp y teléfono a la vista: nadie con
  // una carga en curso queda sin canal por no haber subido la cédula todavía.
  const profile = await getProfileCompleteness(supabase).catch(() => null);
  if (profile && isModuleLocked("soporte", profile)) {
    return <PortalVerifyGate module="soporte" profile={profile} />;
  }

  const admin = createAdminClient();

  const [claims, shipments] = await Promise.all([
    listMyClaims(supabase),
    listMyShipments(supabase),
  ]);

  // Evidencia firmada (RLS portal filtra por markbox; firma con admin).
  const evidenceMap = await listClaimEvidence(
    supabase,
    admin,
    claims.map((c) => c.id),
  );
  const evidence: Record<string, ClaimEvidenceItem[]> = {};
  for (const [k, v] of evidenceMap) evidence[k] = v;

  // Hilo del asesor + asesor asignado (el cliente no tiene RLS sobre esas tablas
  // → admin client scopeado por client.id, igual que en Mensajes/Conversaciones).
  let thread: PortalThreadMessage[] = [];
  try {
    thread = await getPortalThread(admin, client.id);
  } catch {
    thread = [];
  }
  // Id del hilo para el subscribe de realtime del chat (SDD-0148 #3).
  const conversationId = await getPortalConversationId(admin, client.id).catch(
    () => null,
  );
  let advisor: PortalAdvisor | null = null;
  try {
    advisor = await getPortalAdvisor(admin, client.id);
  } catch {
    advisor = null;
  }
  // Resúmenes mensuales visibles para el cliente (SDD-0149 F3). Solo los que tienen
  // client_summary; vacío hasta que el cron mensual genere el primero.
  const digests = await listPortalConversationDigests(admin, client.id).catch(
    () => [] as PortalConversationDigest[],
  );

  return (
    <div>
      {/* Realtime + fallback: refresca el hilo cuando entra una respuesta (SDD-0148 #3). */}
      <PortalChatLive conversationId={conversationId} />
      <span className="eyebrow eyebrow-wine">Atención al cliente</span>
      <h1
        className="mt-2 h-display"
        style={{ fontSize: "clamp(28px, 4.2vw, 44px)" }}
      >
        Soporte
      </h1>
      <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[62ch]">
        Habla con tu asesor o abre un caso con seguimiento. Cada caso tiene
        número, estado y respuesta — todo en un solo lugar.
      </p>

      <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
        {/* ── Izquierda · Tus casos (Reclamos) ── */}
        <div>
          <PortalClaims
            claims={claims}
            shipments={shipments.map((s) => ({ id: s.id, code: s.code }))}
            evidence={evidence}
            embedded
          />
        </div>

        {/* ── Derecha · Chat del asesor + otros canales ── */}
        {/* El aviso de notificaciones va ARRIBA del chat: es lo primero que ve el
            cliente para activarlas y enterarse apenas le escribamos (PORT-3). */}
        <div className="flex flex-col gap-6">
          <PortalPushOptIn />
          <AsesorChatCard advisor={advisor} thread={thread} prefill={prefill} />
          {digests.length > 0 && <ResumenMensualCard digests={digests} />}
          <OtrosCanalesCard client={client} advisor={advisor} />
        </div>
      </div>
    </div>
  );
}

/** Iniciales (máx 2) del nombre del asesor para el avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Chat con el asesor: header con identidad + horario/SLA HONESTO (V1 no muestra
 * "En línea" — no trackeamos presencia real), hilo de Conversaciones y caja de
 * envío. Si no hay asesor asignado, degrada a "Tu equipo DTD Cargo".
 */
function AsesorChatCard({
  advisor,
  thread,
  prefill,
}: {
  advisor: PortalAdvisor | null;
  thread: PortalThreadMessage[];
  prefill?: string;
}) {
  const model = buildAdvisorCardModel(advisor, CONTACT.ve.whatsappRaw);
  const name = model.isReal && model.name ? model.name : "Tu equipo DTD Cargo";
  const role = model.isReal
    ? (model.positionLabel ?? "Tu asesor en DTD Cargo")
    : "Atención al cliente";

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden flex flex-col">
      {/* Header · identidad + horario honesto */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-grey-200">
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-wine text-[color:var(--color-on-accent)]"
          style={{
            width: 40,
            height: 40,
            fontFamily: "var(--font-archivo-black)",
            fontSize: 14,
          }}
          aria-hidden
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink leading-tight truncate">
            {name}
          </div>
          <div className="text-[11.5px] text-grey-500 leading-tight mt-0.5">
            {role} · Te responde en el día
          </div>
        </div>
      </div>

      {/* Hilo */}
      <div className="px-5 py-4 flex flex-col gap-3 max-h-[380px] overflow-y-auto">
        {thread.length > 0 && (
          <p className="text-[11px] text-grey-500 text-center pb-1 leading-[1.4]">
            Ves los últimos 90 días de tu conversación.
          </p>
        )}
        {thread.length === 0 ? (
          <p className="text-[13px] text-grey-500 leading-[1.5] py-4 text-center">
            Todavía no hay mensajes. Escríbenos abajo y tu asesor te responde.
          </p>
        ) : (
          thread.map((m) => {
            const out = m.direction === "out"; // out = DTD hacia el cliente
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${out ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-[1.5] whitespace-pre-wrap break-words ${
                    out
                      ? "bg-grey-100 text-ink"
                      : "bg-wine text-[color:var(--color-on-accent)]"
                  }`}
                >
                  {m.body}
                </div>
                <span className="text-[11px] text-grey-500 px-1">
                  {out ? `${m.authorName ?? "DTD Cargo"} · ` : "Tú · "}
                  {fmtDate(m.sentAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Caja de envío */}
      <div className="px-5 pb-5 pt-1 border-t border-grey-200 mt-auto">
        <PortalMessageForm prefill={prefill} />
      </div>
    </div>
  );
}

/**
 * "Tu conversación, mes a mes" (SDD-0149 F3): el histórico condensado que el cliente
 * SÍ puede ver — el resumen client-facing (nunca el interno del asesor). Solo lectura,
 * reciente primero. Solo se renderiza si hay ≥1 digest con client_summary.
 */
function ResumenMensualCard({
  digests,
}: {
  digests: PortalConversationDigest[];
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Tu conversación, mes a mes
      </div>
      <p className="mt-2 text-[12px] text-grey-700 leading-[1.5]">
        Un resumen de lo que conversamos cada mes, para que no tengas que releer todo
        el hilo.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {digests.map((d) => (
          <div
            key={d.id}
            className="rounded-[12px] bg-grey-100 px-4 py-3"
          >
            <div className="text-[11.5px] font-bold text-wine capitalize">
              {fmtPeriod(d.period)}
            </div>
            <p className="mt-1.5 text-[13px] text-ink leading-[1.55] whitespace-pre-wrap break-words">
              {d.clientSummary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Período (primer día del mes, YYYY-MM-DD) → "julio 2026". */
function fmtPeriod(period: string): string {
  try {
    return new Date(`${period}T00:00:00Z`).toLocaleDateString("es-VE", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return period;
  }
}

/**
 * "Otros canales" (Norte): WhatsApp (baja de CTA hero a canal alterno · SDD-0147)
 * + email + teléfono. El WhatsApp del asesor asignado si existe, si no el público.
 */
function OtrosCanalesCard({
  client,
  advisor,
}: {
  client: PortalClient;
  advisor: PortalAdvisor | null;
}) {
  const model = buildAdvisorCardModel(advisor, CONTACT.ve.whatsappRaw);
  const greeting = model.isReal
    ? `Hola ${model.name}, soy ${client.name} (${client.markbox}) y tengo una consulta.`
    : `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y tengo una consulta.`;
  const waLink = `https://wa.me/${model.whatsappRaw}?text=${encodeURIComponent(greeting)}`;
  const mono = {
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  } as const;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Otros canales
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200"
        >
          <span className="text-wine shrink-0">
            <WhatsAppIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">WhatsApp</span>
            <span className="block text-[11.5px] text-grey-700 truncate">
              {model.isReal ? `Escríbele a ${model.name}` : CONTACT.ve.whatsapp}
            </span>
          </span>
        </a>
        <a
          href={`mailto:${CONTACT.ve.email}`}
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200"
        >
          <span className="text-wine shrink-0">
            <MailIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">Email</span>
            <span className="block text-[11.5px] text-grey-700 truncate" style={mono}>
              {CONTACT.ve.email}
            </span>
          </span>
        </a>
        <a
          href={`tel:${CONTACT.ve.phoneRaw}`}
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200"
        >
          <span className="text-wine shrink-0">
            <PhoneIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">Teléfono</span>
            <span className="block text-[11.5px] text-grey-700 truncate" style={mono}>
              {CONTACT.ve.phone}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
