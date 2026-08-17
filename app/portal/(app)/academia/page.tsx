/**
 * Portal · Academia (SDD-0093, Slice D) — área del alumno.
 *
 * Server component: resuelve el cliente del portal (scope por client_markbox) y
 * muestra el gate de miembro o su inicio (mis cursos + mis diplomas). Port del
 * diseño Cloud Design (`_norte/portal/academia.jsx`). Cada tarjeta enlaza al
 * detalle del curso (Slice D.2: detalle + reproductor + progreso por lección).
 * El catálogo público y la celular llegan en slices siguientes. Requiere las
 * migraciones 0145 (lectura del catálogo) y 0149 (progreso por lección).
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getPortalAcademy, tierLabel } from "@/lib/portal/portal-academy-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { getProfileCompleteness } from "@/lib/portal/portal-queries";
import { isModuleLocked } from "@/lib/portal/verify-gate";
import { PortalVerifyGate } from "../_components/PortalVerifyGate";

export const metadata = { title: "Academia · DTD Cargo" };

export default async function PortalAcademiaPage() {
  const supabase = await createClient();

  // Gate de verificación (SDD-0169): la Academia emite diplomas verificables a
  // nombre del cliente — sin identidad confirmada no se emiten.
  const profile = await getProfileCompleteness(supabase).catch(() => null);
  if (profile && isModuleLocked("academia", profile)) {
    return <PortalVerifyGate module="academia" profile={profile} />;
  }

  const { isMember, courses, diplomas } = await getPortalAcademy(supabase);

  // Mismo armazón que el resto del portal (eyebrow + h-display sobre el `wrap`
  // del layout). Antes esta pantalla traía su propio contenedor `max-w-3xl` y un
  // <h1> de 24px: se leía como otro producto.
  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="eyebrow eyebrow-wine">Academia DTD</span>
        <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
          Tu Academia.
        </h1>
      </header>

      {!isMember ? (
        <GateNoMiembro />
      ) : (
        <>
          <MisCursos courses={courses} />
          <MisDiplomas diplomas={diplomas} />
        </>
      )}
    </div>
  );
}

function GateNoMiembro() {
  return (
    <section className="rounded-xl border border-grey-200 bg-white p-6 sm:p-8 text-center flex flex-col items-center gap-4">
      <h2 className="text-xl font-extrabold text-ink">Aún no eres miembro de la Academia DTD</h2>
      <p className="text-sm text-grey-500 max-w-md">
        Aprende a importar de China paso a paso, con la operación real de DTD detrás. Cuando te inscribas a un
        curso, aquí verás tu progreso y tus diplomas.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <Link href="/registro" className="btn btn-primary text-sm">
          Inscribirme
        </Link>
        <a
          href={buildWhatsAppLink("Hola, quiero información sobre la Academia DTD.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost text-sm"
        >
          Hablar con un asesor
        </a>
      </div>
    </section>
  );
}

function MisCursos({ courses }: { courses: { courseId: string; title: string; tier: string; progressPct: number; completed: boolean }[] }) {
  if (courses.length === 0) {
    return (
      <section className="rounded-xl border border-grey-200 bg-white p-6 text-center">
        <p className="text-sm text-grey-500">Todavía no tienes cursos activos. Explora los próximos cursos.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">Mis cursos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {courses.map((c) => {
          const pct = Math.min(100, Math.max(0, c.progressPct));
          return (
            <Link
              key={c.courseId}
              href={`/portal/academia/${c.courseId}`}
              className="rounded-xl border border-grey-200 bg-white p-4 flex flex-col gap-3 hover:border-wine transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-wine-text">{tierLabel(c.tier)}</span>
                {c.completed && (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-status-success">Completado</span>
                )}
              </div>
              <h3 className="text-base font-bold text-ink leading-snug">{c.title}</h3>
              <div className="flex flex-col gap-1 mt-auto">
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso: ${pct}%`}
                  className="h-2 w-full rounded-full bg-grey-100 overflow-hidden"
                >
                  <div className="h-full rounded-full bg-wine" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-grey-500">{pct}% completado</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MisDiplomas({ diplomas }: { diplomas: { id: string; folio: string; courseTitle: string; issuedAt: string }[] }) {
  if (diplomas.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">Mis diplomas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {diplomas.map((d) => (
          <article key={d.id} className="rounded-xl border border-grey-200 bg-white p-4 flex flex-col gap-2">
            <h3 className="text-base font-bold text-ink leading-snug">{d.courseTitle}</h3>
            <span className="font-mono text-xs text-grey-500">{d.folio}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-grey-500">{d.issuedAt}</span>
              <Link
                href={`/verificar?c=${encodeURIComponent(d.folio)}`}
                className="text-[12px] font-semibold text-wine-text hover:underline"
              >
                Verificar
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
