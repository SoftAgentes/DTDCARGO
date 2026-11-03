"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { buildWhatsAppLink } from "@/lib/design-tokens";
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
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";

const initialMagic: PortalLoginState = {};

/*
 * SDD-0528 · mientras el seguimiento del Portal esté en construcción
 * (`TRACKING_EN_CONSTRUCCION`, SDD-0514), la puerta de acceso no promete
 * seguimiento: dice lo que el Portal ya ofrece. Apagado el interruptor, vuelven
 * los textos de siempre. Sólo cambia el texto; el acceso no se toca.
 */

/** Beneficios del panel lateral (mockup Acceso · Transición). */
const SIDE_BULLETS = [
  TRACKING_EN_CONSTRUCCION
    ? "Tus compras y pre-alertas en un solo lugar"
    : "Seguimiento por compra y contenedor",
  "Cotización puerta a puerta",
  "Documentos y facturas al día",
] as const;

/** Lo que gana quien todavía NO tiene cuenta. Fila 2. */
const NUEVO_BULLETS = [
  "El código que identifica tus cajas",
  "La dirección de nuestra bodega en China",
  TRACKING_EN_CONSTRUCCION
    ? "Acompañamiento hasta tu puerta"
    : "Seguimiento hasta tu puerta",
] as const;

/** Lo que el Portal deja hacer, en el párrafo del panel lateral. */
const SIDE_RESUMEN = TRACKING_EN_CONSTRUCCION
  ? "Cotiza y paga, todo en un lugar."
  : "Cotiza, sigue tus envíos y paga, todo en un lugar.";

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
 * aparecer en DOS sitios: la fila 2 y el estado de pedido recibido. Antes de
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
            {magicState.requested ? (
              <MagicRequested
                email={magicState.email ?? ""}
                requests={magicState.requests}
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

                  <form action={magicAction} onSubmit={submitKeepingDraft(magicAction, magicPending)} className="mt-4 flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-grey-700">
                        Correo
                      </span>
                      <input
                        type="email"
                        name="email"
                        required
                        autoFocus
                        defaultValue={magicState.email ?? prefillEmail ?? undefined}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="tucorreo@ejemplo.com"
                        disabled={magicPending}
                        className="h-[46px] px-3.5 rounded-[8px] border border-grey-200 bg-white outline-none text-[14px] text-ink transition-colors disabled:opacity-60 focus:border-wine focus-visible:border-wine focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--color-wine)_28%,transparent)]"
                      />
                    </label>

                    {magicState.error && (
                      // Fondo sólido: sobre el glass este rojo da 3,9:1, por debajo de AA,
                      // y es el texto que dice que no salió ningún enlace.
                      <PortalFieldError
                        nivel="formulario"
                        className="rounded-[8px] bg-white px-2.5 py-2"
                      >
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
                    Sin contraseña. El enlace vale por una hora, es de un solo uso y
                    lo puedes abrir en el teléfono o en la computadora.
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
              Tu Shipping Mark identifica tu carga de punta a punta. {SIDE_RESUMEN}
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
 * Estado de pedido recibido.
 *
 * 🔴 Esta pantalla no puede afirmar que el correo salió (SDD-0597). El login no
 * distingue —a propósito, por anti-enumeración— entre un correo con cuenta, uno
 * sin ella y un envío que falló, así que se les muestra igual a los tres. Por eso
 * va en condicional, y por eso dice "pedido recibido", que es lo único que se sabe.
 *
 * 🔴 El bloque de abajo NO es decorativo: es la salida del callejón. Quien no tiene
 * cuenta puede crearla, y quien ya es cliente tiene a quién escribirle en vez de
 * crear una segunda cuenta. Y como se muestra SIEMPRE, no revela si el correo existe.
 *
 * Se EXPORTA sólo para poder probarlo suelto: `fireEvent.submit` no dispara el
 * `useActionState` de React 19 en jsdom (medido en este repo), así que llegar
 * acá desde el formulario dentro de un test es imposible. Mismo recurso que
 * `StepDone` en `app/registro/RegisterForm.tsx`.
 */
export function MagicRequested({
  email,
  requests = 1,
  action,
  pending,
}: {
  email: string;
  /** Pedidos seguidos: es lo que hace notar en pantalla que un reintento se recibió. */
  requests?: number;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  // El formulario de donde venía el foco ya no existe. Sin esto, el foco cae en
  // `body` y un lector de pantalla no se entera del cambio.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="flex flex-col justify-center flex-1 gap-3">
      <span
        className="w-14 h-14 rounded-[12px] grid place-items-center"
        style={{ background: "var(--color-wine-soft)", color: "#fff" }}
      >
        <MailIcon size={26} />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[24px] sm:text-[26px] leading-[1.1] text-ink outline-none"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        Si tienes acceso, revisa tu correo
      </h1>
      <p className="text-[13.5px] text-grey-700 leading-[1.6] max-w-[46ch]">
        Recibimos tu pedido
        {email ? (
          <>
            {" "}para <strong className="text-ink [overflow-wrap:anywhere]">{email}</strong>
          </>
        ) : null}
        . Si ese correo tiene acceso al portal, debería llegarte un enlace en un par
        de minutos. Ábrelo y entrarás automáticamente — sin contraseña. Vale por una
        hora, es de un solo uso y da igual dónde lo abras. Si no lo ves, revisa spam
        o pide otro.
      </p>
      <form action={action} className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          // `aria-disabled` y no `disabled`: un botón deshabilitado suelta el foco a
          // `body` (medido en navegador; jsdom no lo ve), y el teclado perdería el
          // sitio justo al reintentar. El doble envío se frena en el clic.
          aria-disabled={pending}
          aria-busy={pending}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          // A11Y-01: es el camino de reintento, y se usa sobre todo desde el teléfono.
          className="inline-flex items-center min-h-[44px] sm:min-h-[32px] text-[13px] font-semibold text-wine-text hover:text-wine-deep aria-disabled:opacity-60"
        >
          {pending ? "Pidiendo…" : "Pedir otro enlace"}
        </button>
        <span
          role="status"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-grey-700"
        >
          <CheckIcon size={13} className="flex-shrink-0" />
          {requests > 1
            ? `Recibimos ${requests} pedidos. Usa el último enlace que te llegue.`
            : "Pedido recibido"}
        </span>
      </form>

      <div className="mt-4 rounded-[10px] border border-grey-300 bg-white/60 p-4">
        <p className="text-[12.5px] text-grey-700 leading-[1.5]">
          ¿No te llega nada? Puede que ese correo no tenga cuenta con nosotros, o que
          el envío haya fallado.
        </p>
        <p className="mt-2 text-[12.5px] text-grey-700 leading-[1.5]">
          Si ya eres cliente,{" "}
          <a
            href={buildWhatsAppLink("Hola DTD Cargo, soy cliente y no me llega el enlace para entrar a mi portal.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-wine-text underline underline-offset-2 hover:text-wine-deep"
          >
            escríbenos por WhatsApp
          </a>
          . Si es tu primera vez, crea tu cuenta.
        </p>
        <CrearCuentaBoton className="mt-3" />
      </div>
    </div>
  );
}
