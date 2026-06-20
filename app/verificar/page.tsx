import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/admin";
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
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("clients")
      .select("markbox")
      .eq("markbox", mark)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{ markbox: string }>();
    if (error) return null;
    return Boolean(data);
  } catch {
    return null;
  }
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

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const mark = normMark(c);
  const status = await markStatus(mark);

  const waUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
    mark
      ? `Hola DTD Cargo, quiero verificar mi carga con Shipping Mark ${mark}.`
      : "Hola DTD Cargo, quiero verificar mi carga.",
  )}`;

  // Estado del documento según el lookup.
  const verified = status === true;
  const unknown = status === false;
  const inconclusive = status === null && mark !== ""; // hay MARK pero DB no responde
  const empty = mark === ""; // sin ?c= (entrada manual)

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
            <span className="eyebrow">Verificación de carga</span>

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

            {/* ─── Tarjeta de confianza + CTAs (no en entrada manual) ─── */}
            {!empty && (
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
                  <Link href="/track" className="btn btn-ghost">
                    Rastrear un envío
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
