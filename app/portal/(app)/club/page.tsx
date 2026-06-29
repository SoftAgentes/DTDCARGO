/**
 * Portal · Club DTD (SDD-0116, Slice E — read-only V1) — área del miembro.
 *
 * Server component: resuelve el Club del miembro del portal (scope por RLS de
 * portal, migr 0187) y muestra el gate de no-miembro o su estado: membresía +
 * compras grupales abiertas (con su participación). V1 es SOLO LECTURA — sumarse a
 * una ronda se hace por el asesor (WhatsApp); el auto-sumarse llega después.
 * Eventos (Slice C) y Proveedor del mes (Slice D) van como "próximamente".
 * Port del sketch del Norte (`_norte/portal/academia.jsx`, ClubScreen).
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  getPortalClub,
  planLabel,
  type PortalClubGroupBuy,
  type PortalClubMembership,
} from "@/lib/portal/portal-club-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";

export const metadata = { title: "Club DTD · DTD Cargo" };

const DATE_FMT = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_FMT.format(d);
}

export default async function PortalClubPage() {
  const supabase = await createClient();
  const { isMember, membership, openGroupBuys } = await getPortalClub(supabase);

  return (
    <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-wine">Club DTD</span>
        <h1 className="text-2xl font-extrabold text-ink">La comunidad de importadores DTD</h1>
        <p className="text-sm text-grey-500">Donde aprender se vuelve hacer, en grupo.</p>
      </header>

      {!isMember || !membership ? (
        <GateNoMiembro />
      ) : (
        <>
          <MembershipCard membership={membership} />
          <ComprasGrupales groupBuys={openGroupBuys} />
          <ProximamenteCard />
        </>
      )}
    </div>
  );
}

function GateNoMiembro() {
  return (
    <section className="rounded-xl border border-grey-200 bg-white p-6 sm:p-8 text-center flex flex-col items-center gap-4">
      <h2 className="text-xl font-extrabold text-ink">Todavía no eres miembro del Club DTD</h2>
      <p className="text-sm text-grey-500 max-w-md">
        El Club es la comunidad de importadores que compran con DTD: compras grupales para bajar el costo por
        m³, eventos y proveedores recomendados. Habla con tu asesor para sumarte.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <a
          href={buildWhatsAppLink("Hola, quiero entrar al Club DTD.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary text-sm"
        >
          Quiero entrar al Club
        </a>
        <Link href="/portal/academia" className="btn btn-ghost text-sm">
          Ver mi Academia
        </Link>
      </div>
    </section>
  );
}

function MembershipCard({ membership }: { membership: PortalClubMembership }) {
  const joined = fmtDate(membership.joinedAt);
  const paused = membership.status !== "activa";
  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5 sm:p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-grey-500">Tu membresía</span>
          <h2 className="text-lg font-extrabold text-ink">Plan {planLabel(membership.plan)}</h2>
        </div>
        <span
          className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 ${
            paused ? "bg-grey-100 text-grey-500" : "bg-status-success/10 text-status-success"
          }`}
        >
          {paused ? "Pausada" : "Activa"}
        </span>
      </div>
      {joined && <p className="text-xs text-grey-500">Miembro desde el {joined}.</p>}
      {paused && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
          <p className="text-xs text-grey-500">Tu membresía está pausada.</p>
          <a
            href={buildWhatsAppLink("Hola, quiero reactivar mi membresía del Club DTD.")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-sm self-start"
          >
            Reactivar con mi asesor
          </a>
        </div>
      )}
    </section>
  );
}

function ComprasGrupales({ groupBuys }: { groupBuys: PortalClubGroupBuy[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">Compras grupales abiertas</h2>
      {groupBuys.length === 0 ? (
        <div className="rounded-xl border border-grey-200 bg-white p-6 text-center">
          <p className="text-sm text-grey-500">
            No hay compras grupales abiertas ahora mismo. Cuando abramos una ronda, la verás aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groupBuys.map((g) => (
            <GroupBuyCard key={g.id} gb={g} />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupBuyCard({ gb }: { gb: PortalClubGroupBuy }) {
  const closes = fmtDate(gb.closesAt);
  const route = [gb.origin, gb.destination].filter(Boolean).join(" → ");
  return (
    <article className="rounded-xl border border-grey-200 bg-white p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-base font-bold text-ink leading-snug">{gb.title}</h3>
          {route && <span className="text-xs font-semibold text-grey-500">{route}</span>}
        </div>
        {gb.myParticipation && (
          <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 bg-wine/10 text-wine">
            {gb.myParticipation.statusLabel}
          </span>
        )}
      </div>

      {gb.summary && <p className="text-sm text-grey-500">{gb.summary}</p>}

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-grey-500">
        {gb.targetCbm != null && (
          <span>
            Meta: <strong className="text-ink">{gb.targetCbm} m³</strong>
          </span>
        )}
        {closes && (
          <span>
            Cierra: <strong className="text-ink">{closes}</strong>
          </span>
        )}
        {gb.myParticipation?.estimatedCbm != null && (
          <span>
            Tu volumen: <strong className="text-ink">{gb.myParticipation.estimatedCbm} m³</strong>
          </span>
        )}
      </div>

      {!gb.myParticipation && (
        <a
          href={buildWhatsAppLink(`Hola, me interesa sumarme a la compra grupal "${gb.title}".`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost text-sm self-start"
        >
          Me interesa sumarme
        </a>
      )}
    </article>
  );
}

function ProximamenteCard() {
  return (
    <section className="rounded-xl border border-dashed border-grey-200 bg-grey-100 p-5 text-center">
      <span className="text-[11px] font-bold uppercase tracking-wide text-grey-500">Próximamente</span>
      <p className="text-sm text-grey-500 mt-1">
        Eventos del Club y el Proveedor del mes llegan pronto a esta sección.
      </p>
    </section>
  );
}
