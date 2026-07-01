"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CheckIcon } from "@/components/Icon";
import { requestMagicLink, type PortalLoginState } from "./actions";
import { signOutAction } from "../../actions";

const initialMagic: PortalLoginState = {};

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
  // Método único: email + enlace de acceso (magic-link). El Shipping Mark dejó
  // de ser credencial (SDD-0094) — es solo el identificador interno de las cajas.
  const [magicState, magicAction, magicPending] = useActionState(
    requestMagicLink,
    initialMagic,
  );

  return (
    <div className="min-h-screen bg-paper grid place-items-center px-5 py-12">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8">
          <BrandMark variant="primary" size={46} />
        </div>

        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
          <span className="eyebrow">Portal del cliente</span>
          <h1
            className="mt-4 text-[28px] lg:text-[32px] leading-[1.08] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            Entra a tu cuenta.
          </h1>

          <p className="mt-3 text-[14px] text-grey-700 leading-[1.55]">
            Aquí no usamos contraseñas. Te enviamos un enlace seguro a tu correo y
            entras con un solo clic.
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
            <MagicSent email={magicState.email ?? ""} action={magicAction} pending={magicPending} />
          ) : (
            <form action={magicAction} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
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
                  className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                />
              </label>

              {magicState.error && (
                <p className="text-[13.5px] text-wine leading-[1.45]">{magicState.error}</p>
              )}

              <button
                type="submit"
                disabled={magicPending}
                className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
              >
                {magicPending ? "Enviando…" : "Enviarme el enlace de acceso"}
              </button>

              <p className="text-[12px] text-grey-500 leading-[1.5]">
                El enlace llega a tu correo, sirve por poco tiempo y es de un solo uso.
                Si se te vence, pides otro y listo.
              </p>
            </form>
          )}

          {authedNotBound && (
            <form action={signOutAction} className="mt-4 pt-4 border-t border-grey-200 text-center">
              <button
                type="submit"
                className="text-[12.5px] text-grey-500 underline underline-offset-2 hover:text-ink"
              >
                Cerrar sesión y probar con otra cuenta
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-[14px] text-grey-500">
          ¿Todavía no eres cliente?{" "}
          <Link
            href="/registro"
            className="text-[17px] font-bold text-wine hover:text-wine-deep underline underline-offset-2"
          >
            Crea tu cuenta
          </Link>
        </p>
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
        style={{ background: "var(--color-status-success)", color: "var(--color-white)" }}
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
