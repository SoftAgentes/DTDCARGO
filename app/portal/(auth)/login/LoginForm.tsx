"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import {
  requestMagicLink,
  loginWithMarkbox,
  resetPasswordByMarkbox,
  type PortalLoginState,
  type PortalPasswordLoginState,
} from "./actions";
import { signOutAction } from "../../actions";

const initialMagic: PortalLoginState = {};
const initialPwd: PortalPasswordLoginState = {};

const MONO = { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" };

export function LoginForm({
  notice,
  authedNotBound,
}: {
  notice: string | null;
  authedNotBound: boolean;
}) {
  // Método primario: MARKBOX + contraseña. Magic-link queda como alternativa.
  const [showMagic, setShowMagic] = useState(false);

  const [pwdState, pwdAction, pwdPending] = useActionState(loginWithMarkbox, initialPwd);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordByMarkbox,
    initialPwd,
  );
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

          {resetState.resetSent ? (
            <ResetSent />
          ) : (
            <>
              {/* ── Método primario: MARKBOX + contraseña ── */}
              <form action={pwdAction} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                    Tu MARKBOX
                  </span>
                  <input
                    type="text"
                    name="markbox"
                    required
                    autoComplete="username"
                    placeholder="DTD-1234"
                    disabled={pwdPending}
                    style={MONO}
                    className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink uppercase disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                    Contraseña
                  </span>
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="Tu cédula o RIF"
                    disabled={pwdPending}
                    className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
                  />
                </label>

                {pwdState.error && (
                  <p className="text-[13.5px] text-wine leading-[1.45]">{pwdState.error}</p>
                )}

                <button
                  type="submit"
                  disabled={pwdPending}
                  className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
                >
                  {pwdPending ? "Entrando…" : "Entrar"} {!pwdPending && <ArrowIcon />}
                </button>

                <p className="text-[12px] text-grey-500 leading-[1.5]">
                  Tu usuario es tu MARKBOX. La contraseña inicial es tu cédula (o RIF
                  si sos empresa).
                </p>
              </form>

              {/* ¿Olvidaste tu contraseña? · pide el MARKBOX y manda el reset */}
              <form action={resetAction} className="mt-3">
                <ForgotPassword pending={resetPending} error={resetState.error} />
              </form>

              {/* ── Alternativa: magic-link por email ── */}
              <div className="mt-6 pt-5 border-t border-grey-200">
                {!showMagic ? (
                  <button
                    type="button"
                    onClick={() => setShowMagic(true)}
                    className="text-[13px] font-semibold text-grey-700 hover:text-ink"
                  >
                    Entrar con un enlace por email
                  </button>
                ) : magicState.sent ? (
                  <MagicSent email={magicState.email ?? ""} action={magicAction} pending={magicPending} />
                ) : (
                  <form action={magicAction} className="flex flex-col gap-3">
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
                      className="btn btn-ghost disabled:opacity-60 disabled:cursor-wait"
                    >
                      {magicPending ? "Enviando…" : "Enviarme el enlace"}
                    </button>
                  </form>
                )}
              </div>
            </>
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

        <p className="text-center mt-6 text-[13.5px] text-grey-500">
          ¿Todavía no sos cliente?{" "}
          <Link
            href="/registro"
            className="font-semibold text-wine hover:text-wine-deep"
          >
            Creá tu cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * "¿Olvidaste tu contraseña?" — toma el MARKBOX que el cliente tipea acá y manda
 * un email de recuperación. Mantiene su propio input para no acoplar al form de
 * login (el botón es secundario; la mayoría usa cédula/RIF como clave inicial).
 */
function ForgotPassword({ pending, error }: { pending: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] font-semibold text-wine hover:text-wine-deep"
      >
        ¿Olvidaste tu contraseña?
      </button>
    );
  }
  return (
    <div className="rounded-[10px] bg-paper border border-grey-200 p-3.5 flex flex-col gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
          Tu MARKBOX
        </span>
        <input
          type="text"
          name="markbox"
          required
          placeholder="DTD-1234"
          disabled={pending}
          style={MONO}
          className="h-11 px-3 rounded-[9px] bg-white border border-grey-200 outline-none text-[14px] text-ink uppercase focus-visible:ring-2 focus-visible:ring-wine"
        />
      </label>
      {error && <p className="text-[12.5px] text-wine leading-[1.4]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="text-[12.5px] font-semibold text-wine hover:text-wine-deep disabled:opacity-60 text-left"
      >
        {pending ? "Enviando…" : "Mandame el enlace de recuperación"}
      </button>
    </div>
  );
}

function ResetSent() {
  return (
    <div className="mt-6">
      <div
        className="w-11 h-11 rounded-full grid place-items-center mb-3"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
      >
        <CheckIcon size={20} />
      </div>
      <div className="text-[16px] font-bold text-ink">Revisá tu correo</div>
      <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
        Si ese MARKBOX tiene una cuenta, te mandamos un enlace para cambiar la
        contraseña. Puede tardar un par de minutos.
      </p>
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
    <div>
      <div
        className="w-11 h-11 rounded-full grid place-items-center mb-3"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
      >
        <CheckIcon size={20} />
      </div>
      <div className="text-[16px] font-bold text-ink">Te enviamos el enlace</div>
      <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
        Abrí el correo que mandamos a <strong className="text-ink">{email}</strong> y
        clickeá el enlace para entrar.
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
