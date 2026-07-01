"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { requestMagicLink, type PortalLoginState } from "./actions";
import { signOutAction } from "../../actions";

const initialMagic: PortalLoginState = {};

/** Prueba social del hero (Norte · PortalLogin). */
const HERO_STATS = [
  { v: "99.4%", l: "On-time" },
  { v: "8.2K", l: "Cargas/año" },
  { v: "38d", l: "Tránsito" },
] as const;

/**
 * Login del portal — REDISEÑO NORTE (`_norte/portal/app.jsx` · PortalLogin).
 * Hero de dos paneles: izquierda branding sobre navy (el ÚNICO gradiente que el
 * brand permite, navy→ink para el portal hero), derecha la card blanca con el
 * form magic-link. La ruta `(auth)` NO está bajo `[data-portal-theme]`, así que el
 * navy es fijo y el texto blanco es estable (no aplica el gotcha del tema oscuro).
 * Método único: email + enlace de acceso (SDD-0094 · el Shipping Mark dejó de ser
 * credencial). En móvil los paneles se apilan (branding arriba, form abajo).
 */
export function LoginForm({
  notice,
  authedNotBound,
  prefillEmail = null,
}: {
  notice: string | null;
  authedNotBound: boolean;
  /** Email precargado desde el correo de invitación (`?email=…`). */
  prefillEmail?: string | null;
}) {
  const [magicState, magicAction, magicPending] = useActionState(
    requestMagicLink,
    initialMagic,
  );

  return (
    <div
      className="min-h-screen grid place-items-center px-4 py-8 sm:px-6 sm:py-12 relative overflow-hidden"
      style={{
        // Gradiente navy del login hero — sancionado por el brand (CLAUDE.md del
        // Norte: "único gradiente permitido: dark navy → ink en el login/portal hero").
        background:
          "linear-gradient(135deg, var(--color-ink) 0%, #1f3055 50%, #0b1428 100%)",
      }}
    >
      {/* Patrón decorativo (círculos concéntricos), muy sutil, arriba a la derecha. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute top-0 right-0"
        style={{ opacity: 0.06 }}
        width="500"
        height="500"
        viewBox="0 0 500 500"
      >
        <g fill="none" stroke="#ffffff" strokeWidth="1">
          {Array.from({ length: 20 }, (_, i) => (
            <circle key={i} cx="250" cy="250" r={20 + i * 22} />
          ))}
        </g>
      </svg>

      <div
        className="relative w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-[1fr_minmax(380px,420px)] rounded-[18px] overflow-hidden"
        style={{ boxShadow: "var(--shadow-pop, 0 30px 80px rgba(0,0,0,0.4))" }}
      >
        {/* ── Panel izquierdo · branding ── */}
        <div className="flex flex-col gap-5 p-8 sm:p-11 text-white">
          <BrandMark variant="reverse" size={34} />
          <div className="flex-1 flex flex-col justify-center">
            <div
              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3.5"
              style={{ color: "var(--color-wine-soft)" }}
            >
              Portal del cliente
            </div>
            <div
              className="text-[34px] sm:text-[38px] leading-none"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.025em" }}
            >
              Tus envíos
              <br />
              desde China,
              <br />
              <span style={{ color: "var(--color-wine-soft)" }}>en un click.</span>
            </div>
            <p className="mt-5 text-[14px] leading-[1.5] text-white/70 max-w-[36ch]">
              Estima, embarca y rastrea tus cargas DDP. Facturas, documentos y
              soporte directo con tu agente.
            </p>
            <div className="mt-7 flex gap-7">
              {HERO_STATS.map((s) => (
                <div key={s.l}>
                  <div
                    className="text-[22px] leading-none"
                    style={{
                      fontFamily: "var(--font-archivo-black)",
                      color: "var(--color-wine-soft)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.v}
                  </div>
                  <div className="mt-1 text-[10px] font-medium tracking-[0.12em] uppercase text-white/50">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-white/35">DTDCARGO.COM · v1.0 · 2026</div>
        </div>

        {/* ── Panel derecho · form ── */}
        <div className="bg-white p-7 sm:p-10 flex flex-col justify-center">
          <h1
            className="text-[24px] sm:text-[26px] leading-[1.1] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            Entra con tu correo.
          </h1>
          <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.5]">
            Te mandamos un enlace de acceso a tu correo — entras con un clic, sin
            contraseñas que recordar.
          </p>

          {notice && (
            <p
              className="mt-5 rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[13.5px] text-grey-700 leading-[1.5]"
              style={{ borderColor: "var(--color-wine)" }}
            >
              {notice}
            </p>
          )}

          {magicState.sent ? (
            <MagicSent
              email={magicState.email ?? ""}
              action={magicAction}
              pending={magicPending}
            />
          ) : (
            <form action={magicAction} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                  Tu email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoFocus
                  defaultValue={prefillEmail ?? undefined}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="tu@empresa.com"
                  disabled={magicPending}
                  className="h-12 px-3.5 rounded-[10px] bg-white border-[1.5px] border-grey-200 outline-none text-[14.5px] text-ink transition-colors disabled:opacity-60 focus:border-wine focus-visible:border-wine focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-wine)_30%,transparent)]"
                />
              </label>

              {magicState.error && (
                <p className="text-[13.5px] text-wine leading-[1.45]">
                  {magicState.error}
                </p>
              )}

              <button
                type="submit"
                disabled={magicPending}
                className="btn btn-primary w-full justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
              >
                {magicPending ? "Enviando…" : "Enviarme el enlace de acceso"}
                {magicPending ? null : <ArrowIcon size={15} />}
              </button>

              <p className="text-[12px] text-grey-500 leading-[1.5]">
                El enlace llega a tu correo, sirve por poco tiempo y es de un solo
                uso. Si se te vence, pides otro y listo.
              </p>
            </form>
          )}

          {/* CTA de registro — puerta única del Norte: quien no tiene cuenta se registra acá. */}
          <div
            className="mt-5 flex items-center justify-between gap-3 rounded-[10px] px-4 py-3"
            style={{
              background: "color-mix(in srgb, var(--color-wine) 7%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-wine) 22%, transparent)",
            }}
          >
            <span className="text-[12.5px] font-semibold text-ink">
              ¿No tienes cuenta?
            </span>
            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-wine hover:text-wine-deep underline underline-offset-[3px]"
            >
              Regístrate <ArrowIcon size={13} />
            </Link>
          </div>

          {authedNotBound && (
            <form
              action={signOutAction}
              className="mt-4 pt-4 border-t border-grey-200 text-center"
            >
              <button
                type="submit"
                className="text-[12.5px] text-grey-500 underline underline-offset-2 hover:text-ink"
              >
                Cerrar sesión y probar con otra cuenta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function MagicSent({
  email,
  action,
  pending,
}: {
  email: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="mt-6">
      <div
        className="w-11 h-11 rounded-full grid place-items-center mb-3"
        style={{
          background: "var(--color-status-success)",
          color: "var(--color-on-accent)",
        }}
      >
        <CheckIcon size={20} />
      </div>
      <div className="text-[16px] font-bold text-ink">Te enviamos el enlace</div>
      <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
        Abre el correo que mandamos a <strong className="text-ink">{email}</strong> y
        haz clic en el enlace para entrar. El enlace vence en poco tiempo y es de un
        solo uso — si no lo ves, revisa spam o pídelo de nuevo.
      </p>
      <form action={action} className="mt-4">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={pending}
          className="text-[13px] font-semibold text-wine hover:text-wine-deep disabled:opacity-60"
        >
          {pending ? "Reenviando…" : "Reenviar enlace"}
        </button>
      </form>
    </div>
  );
}
