"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { requestMagicLink, type PortalLoginState } from "./actions";
import { signOutAction } from "../../actions";

const initial: PortalLoginState = {};

export function LoginForm({
  notice,
  authedNotBound,
}: {
  notice: string | null;
  authedNotBound: boolean;
}) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);

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
            Entrá a tu cuenta.
          </h1>

          {notice && (
            <p
              className="mt-5 rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[13.5px] text-grey-700 leading-[1.5]"
              style={{ borderColor: "var(--color-wine)" }}
            >
              {notice}
            </p>
          )}

          {state.sent ? (
            <div className="mt-6">
              <div
                className="w-11 h-11 rounded-full grid place-items-center mb-3"
                style={{ background: "var(--color-status-success)", color: "#fff" }}
              >
                <CheckIcon size={20} />
              </div>
              <div className="text-[16px] font-bold text-ink">Te enviamos el enlace</div>
              <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
                Abrí el correo que mandamos a{" "}
                <strong className="text-ink">{state.email}</strong> y clickeá el
                enlace para entrar. Puede tardar un par de minutos.
              </p>
              <form action={action} className="mt-5">
                <input type="hidden" name="email" value={state.email ?? ""} />
                <button
                  type="submit"
                  disabled={pending}
                  className="text-[13px] font-semibold text-wine hover:text-wine-deep disabled:opacity-60"
                >
                  {pending ? "Reenviando…" : "Reenviar enlace"}
                </button>
              </form>
            </div>
          ) : (
            <form action={action} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                  Tu email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="vos@empresa.com"
                  disabled={pending}
                  className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                />
              </label>

              {state.error && (
                <p className="text-[13.5px] text-wine leading-[1.45]">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
              >
                {pending ? "Enviando…" : "Enviarme el enlace"}{" "}
                {!pending && <ArrowIcon />}
              </button>

              <p className="text-[12.5px] text-grey-500 leading-[1.5]">
                Entrás con el email que registraste con tu asesor. Te mandamos un
                enlace mágico — sin contraseñas.
              </p>
            </form>
          )}

          {authedNotBound && (
            <form action={signOutAction} className="mt-4 pt-4 border-t border-grey-200 text-center">
              <button
                type="submit"
                className="text-[12.5px] text-grey-500 underline underline-offset-2 hover:text-ink"
              >
                Cerrar sesión y probar con otro email
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-[13.5px] text-grey-500">
          ¿Todavía no sos cliente?{" "}
          <Link href="/registro" className="font-semibold text-wine hover:text-wine-deep">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
