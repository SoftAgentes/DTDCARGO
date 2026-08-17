import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { isVerifyThrottled, type ThrottleDb } from "@/lib/public/verify-throttle";
import { BrandMark } from "@/components/BrandMark";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CONTACT } from "@/lib/design-tokens";

/**
 * /verificar — destino del QR de las etiquetas de caja (SDD-0097 · Slice C).
 *
 * El QR de cada caja (ProviderShareClient · LabelCard) codifica
 * `${SITE_URL}/verificar?c=<MARKBOX>`. Al escanear, esta página confirma si ese
 * Shipping Mark (MARKBOX, DTD-NNNN) pertenece a un envío gestionado por DTD
 * Cargo, SIN exponer datos del cliente (el MARK ya viene impreso en la caja).
 *
 * Página pública DB-backed: `app/verificar` NO está en la allowlist de la
 * frontera ESLint (eslint.config.mjs), así que puede usar el admin client
 * (service_role) igual que /registro y /p/[token]. El visitante es anónimo.
 */

export const metadata: Metadata = {
  title: "Verificar carga · DTD Cargo",
  description:
    "Confirma que tu caja pertenece a un envío gestionado por DTD Cargo.",
  alternates: { canonical: "/verificar" },
  // Utilitaria (destino de QR): fuera del índice.
  robots: { index: false, follow: false },
};

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
// Un solo tamaño de display para los 4 estados (verificado/no reconocido/
// inconcluso/manual): el veredicto no cambia la jerarquía.
const H1_SIZE = "clamp(28px, 5vw, 44px)";

/**
 * El QR codifica el Shipping Mark crudo. Saneamos a `[A-Z0-9-]` (sin comodines
 * que puedan filtrarse a un ilike/like) y acotamos el largo antes de tocar la DB.
 */
function normMark(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

/**
 * `null` = no se pudo determinar (sin `?c=` o error transitorio de DB) → estado
 * neutro: no afirmamos ni negamos. `boolean` = existe / no existe ese MARK.
 * Solo lee `markbox` (existencia) — nunca nombre ni datos del cliente.
 */
async function markStatus(mark: string): Promise<boolean | null> {
  if (!mark) return null;
  try {
    // SDD-0258: la consulta directa buscaba `clients.markbox` por igualdad
    // exacta, y con eso NEGABA los 523 códigos jubilados que hay en producción
    // — códigos que están en las cajas del cliente, en sus correos y en manos de
    // su proveedor en Yiwu. La RPC reconoce las tres formas: el actual,
    // cualquiera de sus jubilados, y la forma IMPRESA de un cliente de
    // sub-aliado (`FA-1232` cuando lo guardado es `DC-FA-1232`).
    //
    // Sigue devolviendo SÓLO existencia: ni nombre ni datos del cliente.
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("markbox_existe_publico", {
      p_markbox: mark,
    });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

type DiplomaInfo = {
  folio: string;
  studentName: string;
  courseTitle: string;
  hours: number | null;
  place: string | null;
  issuedAt: string;
};

/**
 * Un folio de diploma de la Academia tiene forma DTD-AC-YYYY-NNNN (SDD-0093),
 * distinto del Shipping Mark de carga (DTD-NNNN). Así una misma /verificar
 * resuelve ambos QR (caja y diploma) sin chocar en el mismo `?c=`.
 */
function isDiplomaFolio(code: string): boolean {
  return /^DTD-AC-\d{4}-\d+$/.test(code);
}

/**
 * Lee un diploma por folio — SOLO campos seguros (nunca client_markbox ni IDs),
 * mismo criterio que la RPC pública `academy_verify_diploma`. `null` = no existe
 * o error transitorio. Admin client (mismo patrón que `markStatus`).
 */
async function diplomaLookup(folio: string): Promise<DiplomaInfo | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academy_diplomas")
      .select("folio, student_name, course_title, hours, place, issued_at")
      .eq("folio", folio)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{
        folio: string;
        student_name: string;
        course_title: string;
        hours: number | null;
        place: string | null;
        issued_at: string;
      }>();
    if (error || !data) return null;
    return {
      folio: data.folio,
      studentName: data.student_name,
      courseTitle: data.course_title,
      hours: data.hours,
      place: data.place,
      issuedAt: data.issued_at,
    };
  } catch {
    return null;
  }
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[(m - 1) % 12]} de ${y}`;
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="var(--color-white)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QueryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1-1.5 2.1M12 17.5h.01"
        stroke="var(--color-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt
        style={{
          font: "700 11px/1 var(--font-archivo)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-grey-700)",
        }}
      >
        {label}
      </dt>
      <dd
        className="m-0 mt-1.5"
        style={{ font: "400 15px/1.4 var(--font-archivo)", color: "var(--color-ink)" }}
      >
        {valor}
      </dd>
    </div>
  );
}

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const mark = normMark(c);
  // Un folio de diploma (DTD-AC-YYYY-NNNN) toma la rama de diploma; cualquier otro
  // código se trata como Shipping Mark de carga (flujo SDD-0097 original).
  const folioMode = isDiplomaFolio(mark);
  // Anti-enumeración (migr 0169): los códigos son secuenciales y el diploma
  // expone el nombre del alumno. Pasado el límite por IP, NO tocamos la DB ni
  // revelamos existencia/PII → estado neutro. Solo throttlea si hay algo que
  // verificar (con `?c=`); la entrada manual vacía no consume cupo.
  // Cast estructural: el SupabaseClient real satisface ThrottleDb, pero su tipo
  // recursivo dispara TS2589 (deep instantiation) si se matchea directo.
  const throttled =
    mark !== ""
      ? await isVerifyThrottled(
          createAdminClient() as unknown as ThrottleDb,
          await getRequestIp(),
        )
      : false;
  const diploma = !throttled && folioMode ? await diplomaLookup(mark) : null;
  const status = !throttled && !folioMode ? await markStatus(mark) : null;

  const waUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
    folioMode
      ? `Hola DTD Cargo, quiero verificar el diploma con folio ${mark}.`
      : mark
        ? `Hola DTD Cargo, quiero verificar mi carga con Shipping Mark ${mark}.`
        : "Hola DTD Cargo, quiero verificar mi carga.",
  )}`;

  // Estado del documento según el lookup. Todo lo que "afirma o niega" requiere
  // `!throttled`: si la IP superó el límite, solo mostramos el estado neutro.
  const verified = status === true;
  const unknown = status === false;
  const inconclusive = !throttled && status === null && mark !== "" && !folioMode; // MARK, DB no responde
  const empty = mark === ""; // sin ?c= (entrada manual)
  const diplomaMissing = !throttled && folioMode && diploma === null;

  return (
    <>
      <Nav />
      <main className="bg-paper">
        <section className="py-16 lg:py-24">
          <div className="wrap" style={{ maxWidth: 620 }}>
            {/* Foco visible (WCAG 2.4.7) para el input y el link de volver, que
                no son `.btn` y no caen bajo las reglas de foco de globals.css. */}
            <style>{`
              .verify-input:focus-visible {
                outline: none;
                border-color: var(--color-ink);
                box-shadow: 0 0 0 3px rgba(15, 30, 61, 0.18);
              }
              .verify-back:focus-visible {
                outline: 3px solid var(--color-ink);
                outline-offset: 3px;
                border-radius: 2px;
              }
            `}</style>
            <span className="eyebrow">
              {folioMode ? "Verificación de diploma" : "Verificación de carga"}
            </span>

            {/* ─── Throttle: demasiadas verificaciones desde la IP (migr 0169) ─── */}
            {throttled && (
              <div className="mt-6">
                <h1 className="h-display" style={{ fontSize: H1_SIZE }}>
                  Demasiadas
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>verificaciones.</span>
                </h1>
                <p className="lead mt-6">
                  Recibimos muchas consultas desde tu conexión en poco tiempo.
                  Espera unos minutos e intenta de nuevo, o escríbenos y lo
                  confirmamos al instante.
                </p>
              </div>
            )}

            {/* ─── Diploma verificado (folio DTD-AC-…) ─── */}
            {folioMode && diploma && (
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid place-items-center rounded-full"
                    style={{ width: 44, height: 44, background: "var(--color-wine)" }}
                  >
                    <CheckIcon />
                  </span>
                  <h1 className="h-display" style={{ fontSize: H1_SIZE, margin: 0 }}>
                    Diploma verificado
                  </h1>
                </div>
                <p className="lead mt-6">
                  Folio{" "}
                  <strong style={{ fontFamily: MONO, color: "var(--color-ink)" }}>
                    {diploma.folio}
                  </strong>{" "}
                  — emitido por la Academia DTD.
                </p>
                <div
                  className="mt-6 rounded-[14px] p-6"
                  style={{
                    background: "var(--color-white)",
                    border: "1px solid var(--color-grey-200)",
                  }}
                >
                  <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <Campo label="Alumno" valor={diploma.studentName} />
                    <Campo label="Curso" valor={diploma.courseTitle} />
                    <Campo label="Emitido" valor={fmtFecha(diploma.issuedAt)} />
                    {diploma.hours != null && (
                      <Campo label="Duración" valor={`${diploma.hours} horas`} />
                    )}
                    {diploma.place && <Campo label="Lugar" valor={diploma.place} />}
                  </dl>
                </div>
              </div>
            )}

            {/* ─── Folio con forma de diploma pero no encontrado ─── */}
            {diplomaMissing && (
              <div className="mt-6">
                <h1 className="h-display" style={{ fontSize: H1_SIZE }}>
                  No encontramos este
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>diploma.</span>
                </h1>
                <p className="lead mt-6">
                  El folio{" "}
                  <strong style={{ fontFamily: MONO, color: "var(--color-ink)" }}>
                    {mark}
                  </strong>{" "}
                  no figura en la Academia DTD. Revisa que esté escrito tal cual aparece en el
                  diploma (incluye los guiones) o escríbenos y lo confirmamos.
                </p>
              </div>
            )}

            {/* ─── Carga verificada ─── */}
            {verified && (
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid place-items-center rounded-full"
                    style={{
                      width: 44,
                      height: 44,
                      background: "var(--color-wine)",
                    }}
                  >
                    <CheckIcon />
                  </span>
                  <h1
                    className="h-display"
                    style={{ fontSize: H1_SIZE, margin: 0 }}
                  >
                    Carga verificada
                  </h1>
                </div>
                <p className="lead mt-6">
                  El Shipping Mark{" "}
                  <strong style={{ fontFamily: MONO, color: "var(--color-ink)" }}>
                    {mark}
                  </strong>{" "}
                  pertenece a un envío gestionado por DTD Cargo.
                </p>
              </div>
            )}

            {/* ─── No reconocido ─── */}
            {unknown && (
              <div className="mt-6">
                <h1
                  className="h-display"
                  style={{ fontSize: H1_SIZE }}
                >
                  No reconocemos este
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>
                    Shipping Mark.
                  </span>
                </h1>
                <p className="lead mt-6">
                  El código{" "}
                  <strong style={{ fontFamily: MONO, color: "var(--color-ink)" }}>
                    {mark}
                  </strong>{" "}
                  no figura en nuestros envíos. Revisa que lo hayas copiado bien
                  o escríbenos y lo confirmamos al instante.
                </p>
              </div>
            )}

            {/* ─── Inconcluso (MARK presente, DB no responde) ─── */}
            {inconclusive && (
              <div className="mt-6">
                <h1
                  className="h-display"
                  style={{ fontSize: H1_SIZE }}
                >
                  Esta caja viaja con DTD Cargo.
                </h1>
                <p className="lead mt-6">
                  Shipping Mark{" "}
                  <strong style={{ fontFamily: MONO, color: "var(--color-ink)" }}>
                    {mark}
                  </strong>
                  . No pudimos confirmarlo automáticamente en este momento —
                  escríbenos y un asesor lo verifica contigo.
                </p>
              </div>
            )}

            {/* ─── Entrada manual (sin ?c=) ─── */}
            {empty && (
              <div className="mt-6">
                <h1
                  className="h-display"
                  style={{ fontSize: H1_SIZE }}
                >
                  Verifica tu carga.
                </h1>
                <p className="lead mt-6">
                  Escanea el código QR de tu caja o ingresa el Shipping Mark que
                  ves impreso en la etiqueta.
                </p>
                <form
                  action="/verificar"
                  method="get"
                  className="mt-7 flex flex-col gap-3 sm:flex-row"
                >
                  <label htmlFor="c" className="sr-only">
                    Shipping Mark
                  </label>
                  <input
                    id="c"
                    name="c"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    placeholder="DTD-0000"
                    maxLength={32}
                    className="verify-input flex-1 rounded-[8px] px-4"
                    style={{
                      height: 48,
                      border: "1.5px solid var(--color-grey-300)",
                      background: "var(--color-white)",
                      fontFamily: MONO,
                      fontSize: 15,
                      letterSpacing: "0.04em",
                      color: "var(--color-ink)",
                    }}
                  />
                  <button type="submit" className="btn btn-primary">
                    Verificar
                  </button>
                </form>
              </div>
            )}

            {/* ─── Tarjeta de confianza + CTAs · carga (no en manual ni diploma) ─── */}
            {!empty && !folioMode && (
              <div
                className="mt-9 rounded-[14px] p-6"
                style={{
                  background: "var(--color-white)",
                  border: "1px solid var(--color-grey-200)",
                }}
              >
                <div className="flex items-center gap-3">
                  <BrandMark size={30} />
                  {!verified && (
                    <span aria-hidden style={{ marginLeft: "auto" }}>
                      <QueryIcon />
                    </span>
                  )}
                </div>
                <p
                  className="mt-4"
                  style={{
                    font: "400 13.5px/1.6 var(--font-archivo)",
                    color: "var(--color-grey-700)",
                  }}
                >
                  DTD Cargo es logística puerta a puerta entre China y Venezuela.
                  Si recibiste esta caja y tienes dudas, escríbenos: una persona
                  te responde.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Escríbenos por WhatsApp
                  </a>
                  <Link href="/portal/login" className="btn btn-ghost">
                    Rastrear un envío
                  </Link>
                </div>
              </div>
            )}

            {/* ─── Nota de confianza · diploma ─── */}
            {folioMode && (
              <div
                className="mt-9 rounded-[14px] p-6"
                style={{
                  background: "var(--color-white)",
                  border: "1px solid var(--color-grey-200)",
                }}
              >
                <BrandMark size={30} />
                <p
                  className="mt-4"
                  style={{
                    font: "400 13.5px/1.6 var(--font-archivo)",
                    color: "var(--color-grey-700)",
                  }}
                >
                  Los diplomas de la Academia DTD se emiten al completar un curso. Si tienes dudas
                  sobre este diploma, escríbenos: una persona te responde.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Escríbenos por WhatsApp
                  </a>
                  <Link href="/academia" className="btn btn-ghost">
                    Ver la Academia
                  </Link>
                </div>
              </div>
            )}

            {/* Volver al inicio */}
            <div className="mt-8">
              <Link
                href="/"
                className="verify-back"
                style={{
                  font: "600 13.5px var(--font-archivo)",
                  color: "var(--color-wine)",
                }}
              >
                ← Volver a dtdcargo.com
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
