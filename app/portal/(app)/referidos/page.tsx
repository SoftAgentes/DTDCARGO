import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  getMyReferralProgram,
  type PortalReferralProgram,
  type PortalReferralRow,
} from "@/lib/portal/portal-referral-queries";
import { type ReferralStatus } from "@/lib/studio/fidelizacion/types";
import { ReferralShareActions } from "../../_components/ReferralShareActions";
import { ReferralInviteForm } from "../../_components/ReferralInviteForm";

export const metadata: Metadata = { title: "Referidos" };

/**
 * "Referidos" (cara cliente de SDD-0051 · Norte PortalReferidos, portal/app.jsx
 * L1121). Read-only: código para compartir + nivel (derivado de la facturación) +
 * créditos + a quién refirió. La identidad se resuelve por SESIÓN (getPortalClient)
 * y los datos se leen con admin client scopeado por markbox (patrón Mensajes; la
 * tabla `referrals` no tiene RLS de portal).
 *
 * Marca del PORTAL (paper/wine + clases del sitio público). El único fondo oscuro
 * es el hero del código (gradiente navy→ink permitido por el brand para el portal
 * hero). Créditos con copy HONESTO: en V1 son advisory (el asesor los aplica), no
 * se descuentan automático (SDD-0051).
 */
const fmtUsd = (n: number) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

export default async function PortalReferralsPage() {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const program = await getMyReferralProgram(
    createAdminClient(),
    client.markbox,
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1
        className="h-display mt-3"
        style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
      >
        Referidos.
      </h1>
      <p className="lead mt-3 max-w-[56ch]">
        Recomienda DTD Cargo y gana crédito. Cada importador que sumas fortalece la
        comunidad — contenedor a contenedor.
      </p>

      {/* ── Hero código + créditos ── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-stretch">
        <ShareHero program={program} />
        <CreditsCard />
      </div>

      {/* ── Invitar por correo ── */}
      <ReferralInviteForm />

      {/* ── Cómo funciona (el bono = primera compra del referido, no al invitar) ── */}
      <HowItWorks program={program} />

      {/* ── Nivel ── */}
      <TierCard program={program} />

      {/* ── Lista de referidos ── */}
      <ReferralsList rows={program.referrals} />
    </div>
  );
}

/**
 * Hero del código de referido. Gradiente navy (tokens `--hero-*`, navy en AMBOS
 * temas — NO sigue `--color-ink`, que en oscuro es el texto crema). Texto blanco
 * sobre el navy. Único gradiente permitido por el brand para el portal hero.
 */
function ShareHero({ program }: { program: PortalReferralProgram }) {
  return (
    <div
      className="rounded-[18px] overflow-hidden p-7 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, var(--hero-from) 0%, var(--hero-to) 100%)",
        color: "var(--hero-ink)",
        border: "1px solid color-mix(in srgb, var(--hero-ink) 12%, transparent)",
      }}
    >
      <div
        className="text-[11px] font-bold tracking-[0.14em] uppercase"
        style={{ color: "var(--hero-soft)" }}
      >
        Tu código de referido
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-4">
        <code
          className="text-[32px] sm:text-[36px] leading-none"
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            letterSpacing: "0.02em",
            color: "var(--hero-ink)",
          }}
        >
          {program.shareCode}
        </code>
        <ReferralShareActions
          code={program.shareCode}
          referredReward={program.referredReward}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div
          className="rounded-[10px] px-4 py-3"
          style={{ background: "color-mix(in srgb, var(--hero-ink) 10%, transparent)" }}
        >
          <div
            className="text-[20px] leading-none"
            style={{ fontFamily: "var(--font-archivo-black)", color: "var(--hero-ink)" }}
          >
            {fmtUsd(program.referredReward)}
          </div>
          <div
            className="mt-1.5 text-[11.5px] leading-[1.4]"
            style={{ color: "var(--hero-soft)" }}
          >
            para tu referido en su primer embarque
          </div>
        </div>
        <div
          className="rounded-[10px] px-4 py-3"
          style={{ background: "color-mix(in srgb, var(--hero-ink) 10%, transparent)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="text-[20px] leading-none"
              style={{ fontFamily: "var(--font-archivo-black)", color: "var(--hero-ink)" }}
            >
              {fmtUsd(program.referrerReward)}
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] uppercase"
              style={{
                background: "color-mix(in srgb, var(--hero-ink) 15%, transparent)",
                color: "var(--hero-ink)",
              }}
            >
              Próximamente
            </span>
          </div>
          <div
            className="mt-1.5 text-[11.5px] leading-[1.4]"
            style={{ color: "var(--hero-soft)" }}
          >
            de crédito para ti cuando tu referido haga su primera compra
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Créditos del cliente. Los pagos todavía NO se habilitan: el bono se gana con la
 * primera compra del referido y se acreditará automático (Próximamente). Copy
 * honesto — NO mostramos un saldo en dólares como si fuera dinero disponible.
 */
function CreditsCard() {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
          Tus créditos
        </div>
        <span className="rounded-full bg-grey-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] uppercase text-grey-500">
          Próximamente
        </span>
      </div>
      <div
        className="mt-3 text-[22px] leading-none text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        En construcción
      </div>
      <p className="mt-2.5 text-[12.5px] text-grey-700 leading-[1.55]">
        Cuando tu referido haga su primera compra con nosotros, tu bono se acredita{" "}
        <b className="text-ink">automático</b>. Estamos afinando esa parte — pronto
        verás acá lo que ganas.
      </p>
      <div className="mt-auto pt-4 text-[11.5px] text-grey-500 leading-[1.5]">
        Mientras tanto, invita a más importadores y suma tu red.
      </div>
    </div>
  );
}

/**
 * "Cómo funciona" — encode el modelo del negocio: el bono NO se gana al invitar,
 * sino cuando el referido hace su PRIMERA compra (mitiga la expectativa
 * "invito = cobro"). La acreditación automática es la parte "Próximamente".
 */
function HowItWorks({ program }: { program: PortalReferralProgram }) {
  const steps = [
    {
      n: "1",
      title: "Invitas",
      body: "Comparte tu código o manda una invitación por correo a un importador.",
    },
    {
      n: "2",
      title: "Hace su primera compra",
      body: `Tu referido importa con DTD y recibe ${fmtUsd(
        program.referredReward,
      )} de descuento en su primer embarque.`,
    },
    {
      n: "3",
      title: "Ganas tu crédito",
      body: `Se te acredita ${fmtUsd(
        program.referrerReward,
      )} — automático, apenas su compra se registra.`,
    },
  ];
  return (
    <div className="mt-5 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Cómo funciona
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
        {steps.map((s) => (
          <div key={s.n} className="flex flex-col gap-2">
            <span
              className="w-8 h-8 rounded-full grid place-items-center text-[13px] text-[color:var(--color-on-accent)]"
              style={{
                background: "var(--color-wine)",
                fontFamily: "var(--font-archivo-black)",
              }}
            >
              {s.n}
            </span>
            <div className="text-[14px] font-bold text-ink">{s.title}</div>
            <p className="text-[12.5px] text-grey-700 leading-[1.5]">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Nivel actual + barra de progreso al siguiente (derivado de la facturación). */
function TierCard({ program }: { program: PortalReferralProgram }) {
  const { tier, next, pct, toNext } = program.tier;
  return (
    <div className="mt-5 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
            Tu nivel
          </div>
          <div
            className="mt-1.5 text-[22px] leading-none text-ink"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            {tier.label}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end sm:max-w-[470px]">
          {tier.benefits.map((b) => (
            <span
              key={b}
              className="inline-flex items-center rounded-full bg-grey-100 px-3 py-1.5 text-[11.5px] font-semibold text-ink"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
      {next ? (
        <div className="mt-5">
          <div className="h-2 rounded-full bg-grey-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                background: "var(--color-wine)",
              }}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-grey-700">
            Te faltan{" "}
            <b
              className="text-ink"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              }}
            >
              {fmtUsd(toNext)}
            </b>{" "}
            de facturación para alcanzar <b className="text-ink">{next.label}</b>.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-grey-700">
          Estás en el nivel máximo. Gracias por tu confianza.
        </p>
      )}
    </div>
  );
}

/** Lista "Tus referidos" con estado y recompensa. */
function ReferralsList({ rows }: { rows: PortalReferralRow[] }) {
  return (
    <div className="mt-5 card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
          Tus referidos
        </div>
        <span className="text-[12px] text-grey-500">
          {rows.length === 1 ? "1 en total" : `${rows.length} en total`}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Todavía no has referido a nadie. Comparte tu código y empieza a ganar
            crédito por cada importador que se suma.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-grey-200">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-6 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink truncate">
                  {r.referredName}
                </div>
                <div className="mt-0.5 text-[12px] text-grey-500 truncate">
                  {[r.referredCompany, fmtDate(r.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <ReferralStatusBadge status={r.status} />
              <div
                className={`w-[84px] text-right text-[13px] font-bold ${
                  r.status === "acreditado" ? "" : "text-grey-500"
                }`}
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color:
                    r.status === "acreditado"
                      ? "var(--color-status-success)"
                      : undefined,
                }}
              >
                {r.status === "acreditado" ? "+" + fmtUsd(r.rewardUsd) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Badge de estado del referido. Tonos sólo con tokens del sistema + color-mix
 * para el fondo/borde (patrón del StatusBadge de envíos / AcceptanceForm). Navy
 * para los pasos en curso, dorado para "primer embarque", verde para "acreditado".
 */
const REFERRAL_BADGE: Record<ReferralStatus, { label: string; color: string }> = {
  invitado: { label: "Invitado", color: "var(--color-ink)" },
  registrado: { label: "Registrado", color: "var(--color-ink)" },
  "primer-embarque": {
    label: "Primer embarque",
    color: "var(--color-status-warning)",
  },
  acreditado: { label: "Acreditado", color: "var(--color-status-success)" },
};

function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const { label, color } = REFERRAL_BADGE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
