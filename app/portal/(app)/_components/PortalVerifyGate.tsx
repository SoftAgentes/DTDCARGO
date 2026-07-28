import Link from "next/link";
import { buildWhatsAppLink, CONTACT } from "@/lib/design-tokens";
import { ArrowIcon, CheckIcon, LockIcon } from "@/components/Icon";
import {
  MODULE_LABELS,
  MODULE_GATE_COPY,
  buildVerifySteps,
  otherModulesSentence,
  missingSentence,
  type LockedModule,
  type VerifyProfile,
} from "@/lib/portal/verify-gate";

/**
 * Pantalla del gate de verificación (SDD-0169) — espeja `PortalVerifyGate` de
 * `_norte/portal/app.jsx`. La renderiza cada módulo cerrado EN EL SERVIDOR, en
 * lugar de su contenido: el candado del nav es señalización, este componente es
 * el cierre real.
 *
 * No es un muro: dice qué se está perdiendo el cliente, exactamente qué le
 * falta, y deja siempre a la vista WhatsApp y el teléfono — un cliente con un
 * problema nunca queda sin canal aunque el módulo esté cerrado.
 *
 * Contraste (BRAND §♿): `--color-status-warning` es 3.14:1 → NO se usa como
 * texto. Vive en el ícono, el aro y el borde (no-texto, umbral 3:1); todo el
 * texto va en `--color-ink` / `text-grey-700`.
 */
export function PortalVerifyGate({
  module,
  profile,
}: {
  module: LockedModule;
  profile: VerifyProfile;
}) {
  const steps = buildVerifySteps(profile);
  const falta = missingSentence(profile);
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, soy cliente y quiero completar la verificación de mi cuenta para entrar a ${MODULE_LABELS[module]}.`,
  );

  return (
    <div className="mx-auto max-w-[620px] py-4 text-center">
      {/* Aro ámbar con candado — el ícono carga el color, no el texto. */}
      <div
        className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--color-status-warning) 14%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)",
          color: "var(--color-status-warning)",
        }}
      >
        <LockIcon size={30} />
      </div>

      <h1
        className="h-display mt-6"
        style={{ fontSize: "clamp(24px, 3.4vw, 34px)" }}
      >
        {MODULE_LABELS[module]} se activa al verificar tu identidad.
      </h1>

      <p className="lead mt-3 mx-auto max-w-[52ch]">
        {MODULE_GATE_COPY[module]}
      </p>

      {falta && (
        <p className="mt-4 mx-auto max-w-[52ch] text-[14px] text-grey-700 leading-[1.55]">
          Para abrirlo nos falta {falta}. Te toma un par de minutos y lo haces
          una sola vez.
        </p>
      )}

      {/* Los 3 pasos del registro (Norte): dónde está parado el cliente. */}
      <ol className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className="inline-flex items-center gap-2 rounded-[999px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={{
              background: step.done
                ? "color-mix(in srgb, var(--color-status-success) 12%, transparent)"
                : "var(--color-white)",
              border: `1px solid ${
                step.done
                  ? "color-mix(in srgb, var(--color-status-success) 38%, transparent)"
                  : "var(--color-grey-200)"
              }`,
              color: "var(--color-ink)",
            }}
          >
            {step.done ? (
              <span
                aria-hidden
                className="inline-flex"
                style={{ color: "var(--color-status-success)" }}
              >
                <CheckIcon size={14} />
              </span>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-status-warning) 18%, transparent)",
                  color: "var(--color-ink)",
                }}
              >
                {i + 1}
              </span>
            )}
            {step.label}
            <span className="sr-only">
              {step.done ? " · completado" : " · pendiente"}
            </span>
          </li>
        ))}
      </ol>

      <Link
        href="/portal/perfil"
        className="btn btn-primary mt-7 inline-flex items-center gap-2"
        style={{ height: 50, paddingInline: 26 }}
      >
        Completar verificación <ArrowIcon />
      </Link>

      <p className="mt-5 text-[12.5px] text-grey-700">
        Con el mismo paso también se activan {otherModulesSentence(module)}.
      </p>

      {/* Salida siempre disponible: el gate no puede dejar a nadie incomunicado. */}
      <div
        className="card-shadow mt-8 rounded-[16px] p-5 text-[13px]"
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-grey-200)",
        }}
      >
        <span className="text-grey-700">
          ¿Tienes una carga en curso y necesitas ayuda ya?{" "}
        </span>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-2"
          style={{ color: "var(--color-wine-text)" }}
        >
          Escríbenos por WhatsApp
        </a>
        <span className="text-grey-700"> o llama al </span>
        <a
          href={`tel:${CONTACT.ve.phoneRaw}`}
          className="font-bold underline underline-offset-2"
          style={{ color: "var(--color-wine-text)" }}
        >
          {CONTACT.ve.phone}
        </a>
        <span className="text-grey-700">.</span>
      </div>
    </div>
  );
}
