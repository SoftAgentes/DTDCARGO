"use client";

/**
 * Formulario del registro por link (SDD-0646).
 *
 * Pide los mismos datos que `/registro` con los mismos campos (los componentes
 * salen de `../../RegisterForm`), pero en una sola pantalla y con el Shipping
 * Mark CONGELADO: es el de la ficha, no se edita y no viaja en el formulario.
 * La validación del servidor es `validateRegisterInput`, la del registro normal.
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import { ShieldIcon, UserIcon } from "@/components/Icon";
import type { RegisterCity } from "@/lib/portal/register-cities";
import {
  registroLinkMensajeFinal,
  type RegistroLinkActionState,
} from "@/lib/portal/registro-link-types";
import {
  CedulaInput,
  CiudadEntrega,
  Field,
  LeyendaObligatorio,
  PhoneInput,
  TypeCard,
} from "../../RegisterForm";
import { registerByLinkAction } from "./actions";

const initial: RegistroLinkActionState = {};

export function RegistroLinkForm({
  token,
  markbox,
  saludo,
  cities,
}: {
  token: string;
  markbox: string;
  saludo: string | null;
  cities: RegisterCity[];
}) {
  const [state, formAction, pending] = useActionState(registerByLinkAction, initial);
  const [kind, setKind] = useState<"persona" | "empresa">("persona");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [office, setOffice] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [address, setAddress] = useState("");
  const [optin, setOptin] = useState(false);

  const isCompany = kind === "empresa";
  const fe = state.fieldErrors ?? {};

  if (state.ok && state.markbox) {
    return <Listo markbox={state.markbox} portalUrl={state.portalUrl ?? null} warning={state.warning} />;
  }

  return (
    <section className="mx-auto max-w-[620px] px-4 py-10 sm:py-16">
      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-wine">
        Ya eres cliente de DTD Cargo
      </div>
      <h1
        className="mt-2 text-[26px] sm:text-[30px] leading-[1.08] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        {saludo ? `Hola ${saludo}, completa tus datos` : "Completa tus datos"}
      </h1>
      <p className="mt-2 text-[14px] text-grey-700 leading-[1.6] max-w-[52ch]">
        Tu código de siempre ya está guardado. Llena tus datos y entras a tu portal para
        ver tus envíos.
      </p>

      {/* Congelado: sale de la ficha, no del formulario. */}
      <div
        className="mt-6 rounded-[12px] border border-grey-200 bg-white px-4 py-3.5"
        aria-label="Tu Shipping Mark"
      >
        <div className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
          Tu Shipping Mark
        </div>
        <div
          className="mt-1 text-[22px] text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {markbox}
        </div>
        <div className="mt-1 text-[12px] text-grey-500 leading-[1.4]">
          Es el mismo de siempre: no cambia y no hace falta escribirlo.
        </div>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-5" noValidate>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="company" value={company} />
        <input type="hidden" name="document" value={document} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="whatsapp" value={whatsapp} />
        <input type="hidden" name="office_phone" value={office} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="state" value={stateName} />
        <input type="hidden" name="address" value={address} />
        {/* Trampa para bots: un humano no la ve ni la llena. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", height: 0, overflow: "hidden" }}>
          <label>
            Empresa web
            <input type="text" name="empresa_web" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <LeyendaObligatorio />

        <div className="grid grid-cols-2 gap-2.5">
          <TypeCard
            active={!isCompany}
            label="Persona natural"
            desc="Importas a título personal"
            icon={<UserIcon size={20} />}
            onClick={() => {
              setKind("persona");
              setDocument("");
            }}
          />
          <TypeCard
            active={isCompany}
            label="Empresa"
            desc="Importas para tu negocio"
            icon={<ShieldIcon size={20} />}
            onClick={() => {
              setKind("empresa");
              setDocument("");
            }}
          />
        </div>

        <Field
          id="rl-name"
          label={isCompany ? "Nombre de contacto" : "Nombre completo"}
          value={name}
          onChange={setName}
          placeholder="Carlos Pérez"
          autoComplete="name"
          required
          error={fe.name}
        />
        {isCompany && (
          <Field
            id="rl-company"
            label="Razón social"
            value={company}
            onChange={setCompany}
            placeholder="Importadora Pérez C.A."
            autoComplete="organization"
            required
            error={fe.company}
          />
        )}
        {isCompany ? (
          <Field
            key="rif"
            id="rl-document"
            label="RIF"
            value={document}
            onChange={setDocument}
            placeholder="J-12345678-9"
            mono
            required
            error={fe.document}
          />
        ) : (
          <CedulaInput key="cedula" id="rl-document" value={document} onChange={setDocument} error={fe.document} />
        )}
        <Field
          id="rl-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="cperez@empresa.com"
          required
          hint="Con este correo entras a tu portal. Sin contraseñas: te mandamos un enlace."
          error={fe.email}
        />
        <PhoneInput
          id="rl-whatsapp"
          label="Teléfono WhatsApp"
          onChange={setWhatsapp}
          placeholder="412 1668021"
          required
          hint="Es el número por el que te contactamos."
          error={fe.whatsapp}
        />
        <PhoneInput
          id="rl-office"
          label="Teléfono de oficina (opcional)"
          onChange={setOffice}
          placeholder="241 4147886"
        />
        <CiudadEntrega
          cities={cities}
          city={city}
          state={stateName}
          onChange={(p) => {
            if (p.city !== undefined) setCity(p.city);
            if (p.state !== undefined) setStateName(p.state);
          }}
          errCity={false}
          errState={false}
          cityFieldError={fe.city}
          stateFieldError={fe.state}
        />
        <Field
          id="rl-address"
          label="Dirección de entrega (opcional)"
          value={address}
          onChange={setAddress}
          placeholder="Av. principal, edificio, piso"
          autoComplete="street-address"
          hint="Si no la tienes a mano, la completas después en tu portal."
          error={fe.address}
        />

        <label className="flex items-start gap-2.5 text-[13px] text-grey-700 leading-[1.5]">
          <input
            type="checkbox"
            name="email_optin"
            checked={optin}
            onChange={(e) => setOptin(e.target.checked)}
            className="mt-1"
          />
          Quiero recibir novedades, ofertas y guías de importación por email. Puedes
          darte de baja cuando quieras.
        </label>

        {/* Mismo texto de finalidad que /registro (RegisterForm, paso 3). */}
        <p className="text-[12.5px] leading-[1.5] text-grey-500 max-w-[54ch]">
          Solicitamos estos datos para identificar tu carga, evitar errores de entrega y
          cumplir con los procesos logísticos y documentales. No compartimos tu
          información salvo obligaciones operativas o legales.
        </p>

        {state.error && (
          <p role="alert" className="text-[13px] text-wine leading-[1.5]">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="h-12 rounded-[10px] bg-wine text-white text-[15px] font-bold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2"
        >
          {pending ? "Guardando tus datos…" : "Guardar y entrar a mi portal"}
        </button>
        <p className="text-[12px] text-grey-500 leading-[1.5]">
          Al guardar, tus datos quedan en tu ficha de cliente de DTD Cargo. Lee cómo los
          tratamos en nuestra{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>
      </form>
    </section>
  );
}

function Listo({
  markbox,
  portalUrl,
  warning,
}: {
  markbox: string;
  portalUrl: string | null;
  warning?: string;
}) {
  return (
    <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24" aria-live="polite">
      <h1
        className="text-[26px] sm:text-[30px] leading-[1.1] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        {registroLinkMensajeFinal(markbox)}
      </h1>
      {warning ? (
        <p role="status" className="mt-4 text-[14px] text-wine leading-[1.6]">
          {warning}
        </p>
      ) : portalUrl ? (
        <a
          href={portalUrl}
          className="mt-8 inline-flex h-12 items-center rounded-[10px] bg-wine px-6 text-white text-[15px] font-bold focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2"
        >
          Entrar a mi portal
        </a>
      ) : (
        <p className="mt-4 text-[14px] text-grey-700 leading-[1.6]">
          Entra desde{" "}
          <Link href="/entrar" className="text-wine font-semibold underline underline-offset-2">
            tu portal
          </Link>{" "}
          con el correo que acabas de registrar.
        </p>
      )}
    </section>
  );
}
