"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import {
  normalizeDocument,
  type ClientKind,
  type RegisterActionState,
} from "@/lib/portal/register-types";
import { registerClientAction } from "./actions";

const initial: RegisterActionState = {};

type FormData0 = {
  kind: ClientKind;
  name: string;
  company: string;
  document: string;
  email: string;
  whatsapp: string;
};

const EMPTY: FormData0 = {
  kind: "persona",
  name: "",
  company: "",
  document: "",
  email: "",
  whatsapp: "",
};

/**
 * Registro EXPRESS (founder 2026-06-07). Un solo paso, lo mínimo para emitir el
 * MARKBOX y poder contactar al cliente: tipo · nombre · documento · email ·
 * WhatsApp. La foto de cédula y la dirección de entrega se DIFIEREN a "Completa tu
 * perfil" dentro del portal (`/portal/perfil`), donde se piden antes de la 1ª
 * compra. Baja la fricción del lead de WhatsApp sin perder el dedup ni la
 * identidad básica (el documento sigue obligatorio = contraseña inicial).
 */
export function RegisterForm({ est }: { est?: string }) {
  const [state, action, pending] = useActionState(registerClientAction, initial);
  const [data, setData] = useState<FormData0>(EMPTY);
  const [tried, setTried] = useState(false);

  const done = !!state.markbox;

  function patch(p: Partial<FormData0>) {
    setData((d) => ({ ...d, ...p }));
  }

  return (
    <div className="grid place-items-center px-5 py-12">
      <div className="w-full max-w-[520px]">
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 sm:p-9">
          <span className="eyebrow">Portal del cliente</span>
          <h1
            className="mt-3 text-[26px] sm:text-[30px] leading-[1.08] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            {done ? "Bienvenido a DTD Cargo." : "Creá tu cuenta."}
          </h1>

          {!done && (
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
              En un minuto tienes tu MARKBOX para empezar a marcar tus cajas en China.
            </p>
          )}

          {!done && est && (
            <div
              className="mt-4 rounded-[10px] bg-paper border-l-[3px] px-4 py-2.5 text-[12.5px] text-grey-700 leading-[1.5]"
              style={{ borderColor: "var(--color-wine)" }}
            >
              Vamos a vincular tu estimado{" "}
              <strong
                className="text-ink"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {est}
              </strong>{" "}
              a esta cuenta.
            </div>
          )}

          {done ? (
            <StepDone
              markbox={state.markbox!}
              document={normalizeDocument(data.kind, data.document) ?? data.document}
              kind={data.kind}
              firstName={data.name.split(" ")[0]}
              warning={state.warning}
            />
          ) : (
            <ExpressForm
              data={data}
              patch={patch}
              est={est}
              action={action}
              pending={pending}
              tried={tried}
              setTried={setTried}
              error={state.error}
              fieldErrors={state.fieldErrors}
            />
          )}
        </div>

        {!done && (
          <p className="text-center mt-6 text-[13.5px] text-grey-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/portal/login" className="font-semibold text-wine hover:text-wine-deep">
              Entrá acá
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Form express (un paso · el form real que postea) ────────────
function ExpressForm({
  data,
  patch,
  est,
  action,
  pending,
  tried,
  setTried,
  error,
  fieldErrors,
}: {
  data: FormData0;
  patch: (p: Partial<FormData0>) => void;
  est?: string;
  action: (formData: FormData) => void;
  pending: boolean;
  tried: boolean;
  setTried: (v: boolean) => void;
  error?: string;
  fieldErrors?: RegisterActionState["fieldErrors"];
}) {
  const isCompany = data.kind === "empresa";
  const docNorm = data.document ? normalizeDocument(data.kind, data.document) : null;

  const errName = tried && !data.name.trim();
  const errCompany = tried && isCompany && !data.company.trim();
  const errDoc = tried && (!data.document.trim() || !docNorm);
  const errEmail = tried && !data.email.trim();
  const errPhone = tried && !data.whatsapp.trim();

  const valid =
    !!data.name.trim() &&
    (!isCompany || !!data.company.trim()) &&
    !!docNorm &&
    !!data.email.trim() &&
    !!data.whatsapp.trim();

  return (
    <form
      action={(fd) => {
        if (!valid) {
          setTried(true);
          return;
        }
        action(fd);
      }}
      className="mt-6 flex flex-col gap-5"
      noValidate
    >
      {/* Datos del form (hidden mirrors de la data controlada). */}
      <input type="hidden" name="kind" value={data.kind} />
      <input type="hidden" name="name" value={data.name} />
      <input type="hidden" name="company" value={data.company} />
      <input type="hidden" name="document" value={data.document} />
      <input type="hidden" name="email" value={data.email} />
      <input type="hidden" name="whatsapp" value={data.whatsapp} />
      {/* SDD-0061: código del estimado web a vincular (vacío si no vino del CTA). */}
      <input type="hidden" name="est" value={est ?? ""} />

      {/*
        Honeypot anti-bot (SDD-0042 §10). Campo trampa con nombre inocuo: un
        humano nunca lo ve ni lo llena (off-screen, tabIndex -1, aria-hidden);
        un bot naive que rellena todos los inputs sí. Si llega no-vacío, la
        server action descarta el alta sin escribir nada. Off-screen a propósito
        (NO display:none, que algunos bots detectan y saltean).
      */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="empresa_web">No completar este campo</label>
        <input
          id="empresa_web"
          type="text"
          name="empresa_web"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <SectionLabel>Tipo de cliente</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <TypeCard
          active={!isCompany}
          label="Persona natural"
          desc="Importás a título personal"
          onClick={() => patch({ kind: "persona" })}
        />
        <TypeCard
          active={isCompany}
          label="Empresa"
          desc="Importás para tu negocio"
          onClick={() => patch({ kind: "empresa" })}
        />
      </div>

      <SectionLabel>Tus datos</SectionLabel>
      <Field
        label={isCompany ? "Nombre de contacto" : "Nombre completo"}
        value={data.name}
        onChange={(v) => patch({ name: v })}
        placeholder="Carlos Pérez"
        error={errName ? "Campo obligatorio" : undefined}
      />
      {isCompany && (
        <Field
          label="Razón social"
          value={data.company}
          onChange={(v) => patch({ company: v })}
          placeholder="Importadora Pérez C.A."
          error={errCompany ? "Campo obligatorio" : undefined}
        />
      )}
      <Field
        label={isCompany ? "RIF" : "Cédula"}
        value={data.document}
        onChange={(v) => patch({ document: v })}
        placeholder={isCompany ? "J-12345678-9" : "V-12345678"}
        mono
        hint="Es tu contraseña inicial para entrar al portal."
        error={
          fieldErrors?.document ??
          (errDoc
            ? isCompany
              ? "RIF inválido. Formato: J-12345678-9."
              : "Cédula inválida. Formato: V-12345678."
            : undefined)
        }
      />
      <Field
        label="Email"
        type="email"
        value={data.email}
        onChange={(v) => patch({ email: v })}
        placeholder="cperez@empresa.com"
        hint="Lo usamos para recuperar tu contraseña."
        error={fieldErrors?.email ?? (errEmail ? "Campo obligatorio" : undefined)}
      />
      <Field
        label="Teléfono WhatsApp"
        value={data.whatsapp}
        onChange={(v) => patch({ whatsapp: v })}
        placeholder="+58 412 1668021"
        mono
        hint="Es el número por el que te contactamos · siempre por WhatsApp."
        error={fieldErrors?.whatsapp ?? (errPhone ? "Campo obligatorio" : undefined)}
      />

      {/* Expectativa de lo diferido — sin foto ni dirección acá. */}
      <div
        className="rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.55]"
        style={{ borderColor: "var(--color-wine)" }}
      >
        Generamos tu <strong className="text-ink">MARKBOX</strong> al instante y tu
        cuenta queda <strong className="text-ink">activa</strong>. Antes de tu primera
        compra completas tu perfil (foto de cédula + dirección de entrega) desde el
        portal.
      </div>

      {error && (
        <p className="text-[13.5px] text-wine leading-[1.45]">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
      >
        {pending ? "Creando tu cuenta…" : "Crear cuenta y generar MARKBOX"}
        {!pending && <CheckIcon size={16} />}
      </button>
    </form>
  );
}

// ── Listo ───────────────────────────────────────────────────────
function StepDone({
  markbox,
  document,
  kind,
  firstName,
  warning,
}: {
  markbox: string;
  document: string;
  kind: ClientKind;
  firstName: string;
  warning?: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center text-center gap-5">
      <div
        className="w-16 h-16 rounded-full grid place-items-center"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
      >
        <CheckIcon size={32} />
      </div>
      <div>
        <div className="text-[18px] font-bold text-ink">
          Tu cuenta quedó creada{firstName ? `, ${firstName}` : ""}.
        </div>
        <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[42ch]">
          Este es tu código MARKBOX. Guardalo: vas a usarlo mucho, y es lo que tus
          proveedores escriben en cada caja.
        </p>
      </div>

      {/* Tarjeta MARKBOX */}
      <div
        className="w-full rounded-[14px] px-6 py-6"
        style={{ background: "var(--color-wine)", color: "#fff" }}
      >
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "var(--color-wine-soft)" }}>
          Tu MARKBOX
        </div>
        <div
          className="mt-2 text-[34px] leading-none"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", letterSpacing: "-0.01em" }}
        >
          {markbox}
        </div>
      </div>

      {/* Acceso al portal: usuario + clave */}
      <div className="w-full rounded-[12px] bg-paper border border-grey-200 px-5 py-4 text-left">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-grey-500">
              Usuario
            </div>
            <div
              className="mt-1 text-[15px] font-bold text-ink"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {markbox}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-grey-500">
              Contraseña
            </div>
            <div
              className="mt-1 text-[15px] font-bold text-ink"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {document}
            </div>
            <div className="mt-1 text-[11px] text-grey-500 leading-[1.4]">
              Es tu {kind === "empresa" ? "RIF" : "cédula"} · recomendado cambiarla
              al entrar.
            </div>
          </div>
        </div>
      </div>

      {warning && (
        <p
          className="w-full rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.5] text-left"
          style={{ borderColor: "var(--color-status-warning)" }}
        >
          {warning}
        </p>
      )}

      <p
        className="w-full rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.55] text-left"
        style={{ borderColor: "var(--color-wine)" }}
      >
        <strong className="text-ink">Tu cuenta ya está activa.</strong> Entrá al
        portal con tu MARKBOX. Antes de tu primera compra te vamos a pedir que
        completes tu perfil (foto de cédula + dirección de entrega) — lo hacés desde
        el portal en un par de minutos.
      </p>

      <Link href="/portal/login" className="btn btn-primary w-full">
        Ir al portal <ArrowIcon />
      </Link>
    </div>
  );
}

// ── Primitivas de form ──────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        style={
          mono
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      />
      {hint && !error && <span className="text-[11.5px] text-grey-500 leading-[1.4]">{hint}</span>}
      {error && <span className="text-[12px] text-wine leading-[1.4]">{error}</span>}
    </label>
  );
}

function TypeCard({
  active,
  label,
  desc,
  onClick,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3.5 rounded-[12px] border transition-colors"
      style={{
        borderColor: active ? "var(--color-wine)" : "var(--color-grey-200)",
        background: active ? "var(--color-paper)" : "#fff",
      }}
      aria-pressed={active}
    >
      <div className="text-[14px] font-bold" style={{ color: active ? "var(--color-wine)" : "var(--color-ink)" }}>
        {label}
      </div>
      <div className="mt-0.5 text-[12px] text-grey-500 leading-[1.4]">{desc}</div>
    </button>
  );
}
