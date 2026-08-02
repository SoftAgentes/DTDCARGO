"use client";

/**
 * Pantalla del código de acceso a `/marca` (SDD-0238).
 *
 * Es lo primero que ve el diseñador externo al abrir el link. Tiene que quedar
 * claro en 2 segundos qué es esto y qué se espera de él, sin explicar el sistema.
 *
 * Cuando el bloqueo se activa, se muestra un contador EN VIVO. Un "intenta más
 * tarde" seco hace que la gente recargue cada 10 segundos; ver cuánto falta hace
 * que se espere. El contador es cosmético — quien manda es la RPC.
 */

import { useActionState, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { unlockBrandAction, type GateState } from "../actions";

function remainingLabel(until: number, now: number): string {
  const secs = Math.max(0, Math.ceil((until - now) / 1000));
  if (secs >= 60) {
    const mins = Math.ceil(secs / 60);
    return mins === 1 ? "1 minuto" : `${mins} minutos`;
  }
  return secs === 1 ? "1 segundo" : `${secs} segundos`;
}

export function BrandGate() {
  const [state, formAction, isPending] = useActionState<GateState, FormData>(
    unlockBrandAction,
    {},
  );
  const [now, setNow] = useState(() => Date.now());

  const lockedUntil = state.lockedUntil ?? 0;
  const isLocked = lockedUntil > now;

  useEffect(() => {
    if (!state.lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.lockedUntil]);

  return (
    <main className="min-h-screen bg-paper grid place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center">
          <BrandMark variant="primary" size={56} />
        </div>

        <h1
          className="h-display mt-7 text-center"
          style={{ fontSize: "clamp(26px, 6vw, 34px)" }}
        >
          Centro de marca
        </h1>
        <p className="mt-3 text-center text-[14.5px] text-grey-700 leading-[1.55]">
          El brand book de DTD Cargo, con todo descargable. Escribe el código que
          te pasaron para entrar.
        </p>

        <form
          action={formAction}
          className="mt-8 bg-white border border-grey-200 rounded-[18px] p-6"
        >
          <label
            htmlFor="marca-code"
            className="block text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500"
          >
            Código de acceso
          </label>
          <input
            id="marca-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4,6}"
            maxLength={6}
            required
            autoFocus
            disabled={isLocked || isPending}
            placeholder="••••"
            aria-describedby={state.error || isLocked ? "marca-code-msg" : undefined}
            aria-invalid={state.error ? true : undefined}
            className="mt-3 w-full h-[54px] rounded-[12px] border border-grey-300 bg-paper px-4 text-center text-[24px] tracking-[0.4em] text-ink focus:outline-none focus:border-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          />

          {(state.error || isLocked) && (
            <p
              id="marca-code-msg"
              role="alert"
              className="mt-3 text-[13.5px] leading-[1.5]"
              style={{ color: "var(--color-status-danger)" }}
            >
              {isLocked
                ? `Demasiados intentos. Prueba de nuevo en ${remainingLabel(lockedUntil, now)}.`
                : state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLocked || isPending}
            className="btn btn-primary w-full mt-5 disabled:opacity-60"
          >
            {isPending ? "Verificando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-[12.5px] text-grey-500 leading-[1.55]">
          ¿Eres del equipo de DTD Cargo?{" "}
          <a
            href="/studio/login?next=/marca"
            className="font-semibold text-wine underline underline-offset-2"
          >
            Entra con tu cuenta
          </a>
          .
        </p>
      </div>
    </main>
  );
}
