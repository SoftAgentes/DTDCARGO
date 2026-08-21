"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowIcon,
  CheckIcon,
  MailIcon,
  StampIcon,
  UserIcon,
} from "@/components/Icon";
import { requestMagicLink, type PortalLoginState } from "./actions";
import { signOutAction } from "@/app/portal/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initialMagic: PortalLoginState = {};

/** Beneficios del panel lateral (mockup Acceso · Transición). */
const SIDE_BULLETS = [
  "Seguimiento por compra y contenedor",
  "Cotización puerta a puerta",
  "Documentos y facturas al día",
] as const;

/** Lo que gana quien todavía NO tiene cuenta. Fila 2. */
const NUEVO_BULLETS = [
  "El código que identifica tus cajas",
  "La dirección de nuestra bodega en China",
  "Seguimiento hasta tu puerta",
] as const;

/**
 * `/entrar` — la puerta única (SDD-0276). Enlace mágico, SIN contraseña.
 *
 * **Dos filas, no un formulario con un apéndice.** El título de cada fila nombra
 * la intención ("Ingresar a mi portal" · "Crear mi cuenta y Shipping Mark") y el
 * botón nombra lo que de verdad pasa ("Envíame el enlace" · "Crear mi cuenta").
 * Esa separación es deliberada: BTN-01 §3 pide que el verbo del botón coincida
 * con el resultado, y un botón que dijera "Ingresar a mi portal" prometería
 * entrar cuando lo que ocurre es que llega un correo.
 *
 * 🔴 **Por qué `CrearCuentaBoton` es un componente y no JSX suelto.** Tiene que
 * aparecer en DOS sitios: la fila 2 y el estado "Revisa tu correo". Antes de
 * SDD-0276 sólo estaba en el primero —y como un enlace de 12,5 px— así que
 * quien no tenía cuenta escribía su correo, veía "Revisa tu correo", no le
 * llegaba nada (el login **no** crea usuarios: `shouldCreateUser: false`) y se
 * quedaba sin ninguna salida. Un solo componente para los dos sitios es lo que
 * impide que vuelvan a divergir.
 *
 * Backend INTACTO (SDD-0094): Server Action `requestMagicLink`, callback
 * `/portal/callback`, TTL del enlace. El input conserva `name="email"` y NO hay
 * password (contrato del e2e "Portal: magic link").
 */
export function EntrarForm({
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
      className="min-h-screen flex flex-col items-center px-4 py-6 sm:px-6 sm:py-8 relative overflow-hidden"
      style={{
        // Navy radial de marca (mockup) — el único gradiente permitido en el hero
        // de acceso/portal (navy → ink). Fijo, no depende del tema.
        background:
          "radial-gradient(135% 105% at 50% -14%, #1f3055 0%, #0f1e3d 44%, #0b1428 100%)",
      }}
    >
      {/* Topline: wordmark + sello "enlace mágico" */}
      <div className="w-full max-w-[940px] flex items-center justify-between gap-4 flex-wrap mb-6">
        <BrandMark asLink variant="reverse" size={30} />
        <span
          className="inline-flex items-center text-[10px] font-bold tracking-[0.12em] uppercase px-3.5 py-2 rounded-full"
          style={{
            color: "rgba(255,255,255,0.55)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          Enlace mágico · sin contraseña
        </span>
      </div>

      <div className="w-full max-w-[920px] flex-1 grid place-items-center">
        <div
          className="w-full grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] rounded-[16px] overflow-hidden"
          style={{
            boxShadow: "var(--glass-shadow, 0 30px 80px rgba(0,0,0,0.4))",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* ── Panel del formulario · GLASS ── */}
          <div
            className="p-7 sm:p-11 flex flex-col"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              WebkitBackdropFilter: "var(--glass-blur)",
            }}
          >
            {magicState.sent ? (
              <MagicSent
                email={magicState.email ?? ""}
                action={magicAction}
                pending={magicPending}
              />
            ) : (
              <>
                <span
                  className="text-[10px] font-bold tracking-[0.18em] uppercase"
                  style={{ color: "var(--color-wine)" }}
                >
                  Acceso de cliente
                </span>
                <h1
                  className="mt-3 text-[26px] sm:text-[28px] leading-[1.08] text-ink"
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Entra o crea tu cuenta
                </h1>

                {notice && (
                  <p
                    className="mt-5 rounded-[10px] bg-white/70 border-l-[3px] px-4 py-3 text-[13px] text-grey-700 leading-[1.5]"
                    style={{ borderColor: "var(--color-wine)" }}
                  >
                    {notice}
                  </p>
                )}

                {/* ── FILA 1 · ya soy cliente ── */}
                <section className="mt-6 rounded-[10px] border border-grey-300 bg-white/60 p-4 sm:p-5">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink leading-[1.25]">
                    <UserIcon size={18} className="text-wine flex-shrink-0" />
                    Ingresar a mi portal
                  </h2>
                  <p className="mt-1 text-[12.5px] text-grey-500 leading-[1.45]">
                    Ya soy cliente de DTD Cargo.
                  </p>

                  <form action={magicAction} className="mt-4 flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-grey-700">
                        Correo
                      </span>
                      <input
                        type="email"
                        name="email"
                        required
                        autoFocus
                        defaultValue={prefillEmail ?? undefined}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="tucorreo@ejemplo.com"
                        disabled={magicPending}
                        className="h-[46px] px-3.5 rounded-[8px] border border-grey-200 bg-white outline-none text-[14px] text-ink transition-colors disabled:opacity-60 focus:border-wine focus-visible:border-wine focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--color-wine)_28%,transparent)]"
                      />
                    </label>

                    {magicState.error && (
                      <PortalFieldError nivel="formulario">
                        {magicState.error}
                      </PortalFieldError>
                    )}

                    <button
                      type="submit"
                      disabled={magicPending}
                      className="btn btn-primary w-full justify-center gap-2 mt-1 disabled:opacity-60 disabled:cursor-wait"
                    >
                      <MailIcon size={16} />
                      {magicPending ? "Enviando…" : "Envíame el enlace"}
                    </button>
                  </form>

                  <p className="mt-3 text-[12px] text-grey-500 leading-[1.5]">
                    Sin contraseña. El enlace sirve por poco tiempo y es de un solo
                    uso; si se te vence, pides otro y listo.
                  </p>
                </section>

                {/* ── FILA 2 · primera vez ── */}
                <section className="mt-3 rounded-[10px] border border-grey-300 bg-white/60 p-4 sm:p-5">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink leading-[1.25]">
                    <StampIcon size={18} className="text-wine flex-shrink-0" />
                    Crear mi cuenta y Shipping Mark
                  </h2>
                  <p className="mt-1 text-[12.5px] text-grey-500 leading-[1.45]">
                    Es mi primera vez. Gratis, dos minutos.
                  </p>

                  <ul className="mt-4 flex flex-col gap-2 list-none p-0">
                    {NUEVO_BULLETS.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-[12.5px] text-grey-700 leading-[1.45]"
                      >
                        <CheckIcon
                          size={14}
                          className="text-wine flex-shrink-0 mt-[3px]"
                        />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <CrearCuentaBoton className="mt-4" />
                </section>
              </>
            )}

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

          {/* ── Panel lateral · navy sólido con marca ── */}
          <div
            className="relative p-9 sm:p-11 flex flex-col justify-center text-white overflow-hidden"
            style={{
              background:
                "linear-gradient(150deg, #16264a 0%, #0f1e3d 52%, #0b1428 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-[70px] -bottom-[90px] w-[320px] h-[320px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--color-wine) 42%, transparent), transparent 68%)",
                opacity: 0.5,
              }}
            />
            <span
              className="relative text-[10px] font-bold tracking-[0.18em] uppercase"
              style={{ color: "var(--color-wine-soft)" }}
            >
              De China a tu puerta
            </span>
            <h2
              className="relative mt-3.5 text-[28px] leading-[1.08] text-white"
              style={{
                fontFamily: "var(--font-archivo-black)",
                letterSpacing: "-0.02em",
              }}
            >
              Con confianza, en cada contenedor.
            </h2>
            <p className="relative mt-2.5 text-[13.5px] leading-[1.6] text-white/75 max-w-[32ch]">
              Tu Shipping Mark identifica tu carga de punta a punta. Cotiza, sigue
              tus envíos y paga, todo en un lugar.
            </p>
            <ul className="relative mt-6 flex flex-col gap-3 list-none p-0">
              {SIDE_BULLETS.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-[12.5px] text-white/85">
                  <span
                    className="w-[22px] h-[22px] flex-shrink-0 rounded-full grid place-items-center"
                    style={{
                      background: "rgba(255,255,255,0.10)",
                      color: "var(--color-wine-soft)",
                    }}
                  >
                    <CheckIcon size={13} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="w-full max-w-[940px] text-center text-[11px] leading-[1.5] mt-6" style={{ color: "rgba(255,255,255,0.45)" }}>
        DTDCARGO.COM · Portal del cliente
      </p>
    </div>
  );
}

/**
 * El botón de crear cuenta — el MISMO en la fila 2 y en "Revisa tu correo".
 *
 * `.btn` mide 48 px y va a ancho completo: es la diferencia con el enlace de
 * 12,5 px que había antes. Se queda en `btn-ghost` (relleno blanco para que
 * levante sobre el glass) y NO en `btn-primary`, porque BTN-01 §2 admite una
 * sola acción primaria por pantalla y ésa es "Envíame el enlace". La
 * prominencia sale del tamaño, del ancho y de tener fila propia, no de un
 * segundo relleno vino.
 */
function CrearCuentaBoton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/registro"
      // `btn-ghost-solid` es del sistema y existe justo para esto: un ghost que
      // flota sobre contenido que no controlamos —acá el panel glass— donde
      // `transparent` deja el texto sobre lo que haya debajo. Medido: con el
      // ghost transparente el texto ink sobre la parte baja del glass daba
      // **4,22:1**, por debajo de AA; con relleno sólido, 16,5:1.
      //
      // 🔴 Y NO se resuelve con `bg-white` de Tailwind: `globals.css` va sin
      // `@layer`, así que `.btn-ghost { background: transparent }` le gana a
      // cualquier utilidad. Tampoco con `var(--color-white)` inline: ese token
      // se remapea a navy bajo `[data-portal-theme="dark"]`. `btn-ghost-solid`
      // usa `--color-on-accent`, que no se remapea nunca.
      className={`btn btn-ghost btn-ghost-solid w-full justify-center gap-2 ${className}`}
    >
      Crear mi cuenta <ArrowIcon size={14} />
    </Link>
  );
}

/**
 * Estado "Revisa tu correo" tras enviar el enlace.
 *
 * 🔴 El bloque de abajo NO es decorativo: es la salida del callejón. El login no
 * distingue —a propósito, por anti-enumeración— entre un correo con cuenta y uno
 * sin ella, así que esta pantalla se le muestra igual a los dos. Sin esta salida,
 * quien no tiene cuenta se queda mirando un "te enviamos un enlace" que nunca va
 * a llegar. Y como se muestra SIEMPRE, no revela si el correo existe.
 *
 * Se EXPORTA sólo para poder probarlo suelto: `fireEvent.submit` no dispara el
 * `useActionState` de React 19 en jsdom (medido en este repo), así que llegar
 * acá desde el formulario dentro de un test es imposible. Mismo recurso que
 * `StepDone` en `app/registro/RegisterForm.tsx`.
 */
export function MagicSent({
  email,
  action,
  pending,
}: {
  email: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col justify-center flex-1 gap-3">
      <span
        className="w-14 h-14 rounded-[12px] grid place-items-center"
        style={{ background: "var(--color-wine-soft)", color: "#fff" }}
      >
        <MailIcon size={26} />
      </span>
      <h1
        className="text-[24px] sm:text-[26px] leading-[1.1] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        Revisa tu correo
      </h1>
      <p className="text-[13.5px] text-grey-700 leading-[1.6] max-w-[34ch]">
        Te enviamos un enlace de acceso
        {email ? (
          <>
            {" "}a <strong className="text-ink">{email}</strong>
          </>
        ) : null}
        . Ábrelo y entrarás automáticamente — sin contraseña. El enlace vence en
        poco tiempo y es de un solo uso; si no lo ves, revisa spam o pídelo de nuevo.
      </p>
      <form action={action} className="mt-1 flex items-center gap-4">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="text-[13px] font-semibold text-wine-text hover:text-wine-deep disabled:opacity-60"
        >
          {pending ? "Reenviando…" : "Reenviar enlace"}
        </button>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-grey-500">
          <CheckIcon size={13} /> Enviado
        </span>
      </form>

      <div className="mt-4 rounded-[10px] border border-grey-300 bg-white/60 p-4">
        <p className="text-[12.5px] text-grey-700 leading-[1.5]">
          ¿No te llega nada? Puede que todavía no tengas cuenta con nosotros.
        </p>
        <CrearCuentaBoton className="mt-3" />
      </div>
    </div>
  );
}
