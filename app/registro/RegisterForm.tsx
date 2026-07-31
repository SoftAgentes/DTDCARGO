"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowIcon,
  CheckIcon,
  ChevronDownIcon,
  MailIcon,
  ShieldIcon,
  UserIcon,
  WarningIcon,
} from "@/components/Icon";
import {
  normalizeDocument,
  type ClientKind,
  type RegisterActionState,
} from "@/lib/portal/register-types";
import { trackLead } from "@/components/Analytics";
import { registerClientAction } from "./actions";

const initial: RegisterActionState = {};

type FormData0 = {
  kind: ClientKind;
  name: string;
  company: string;
  document: string;
  email: string;
  whatsapp: string;
  /** Teléfono de oficina / fijo (opcional · no WhatsApp). */
  officePhone: string;
  /** SDD-0082: opt-in explícito de marketing por email (default OFF). */
  emailOptin: boolean;
};

const EMPTY: FormData0 = {
  kind: "persona",
  name: "",
  company: "",
  document: "",
  email: "",
  whatsapp: "",
  officePhone: "",
  emailOptin: false,
};

/**
 * Registro de cliente — reskin al mockup Cloud Design "Registro · Rediseño":
 * wizard de 5 pasos (Identidad → Contacto → Preferencias → Confirmar → ¡Listo!)
 * con el rail navy a la izquierda y la celebración del Shipping Mark al final.
 *
 * Backend INTACTO (SDD-0061/0131): un solo <form> que postea los MISMOS campos
 * (kind · name · company · document · email · whatsapp · office_phone · est ·
 * ref · empresa_web · email_optin) a `registerClientAction`. Los pasos 1-3 son
 * navegación de cliente sobre el estado controlado; el paso 4 (Confirmar) es el
 * ÚNICO submit real. Se conserva la validación, el chequeo en vivo de duplicados,
 * el honeypot y el flujo de datos — solo cambia el layout/pasos visuales.
 *
 * NOTA (choque copy↔dato): el mockup incluía un paso "Dirección"; la dirección de
 * entrega y la foto de cédula se DIFIEREN al portal (/portal/perfil) por diseño
 * del backend — ese paso se reemplaza por "Preferencias" (opt-in + qué sigue).
 */
export function RegisterForm({
  est,
  refCode,
}: {
  est?: string;
  /** Código de referido del `?ref=` (invitación por correo o código compartido). */
  refCode?: string;
}) {
  const [state, action, pending] = useActionState(registerClientAction, initial);
  const [data, setData] = useState<FormData0>(EMPTY);
  const [step, setStep] = useState(0); // 0..3 (paso 5 = éxito, vía state.markbox)
  const [tried, setTried] = useState(false);

  const done = !!state.markbox;

  // GA4 `generate_lead`: el registro emitió MARKBOX — lead capturado (1 vez).
  useEffect(() => {
    if (done) trackLead("registro");
  }, [done]);

  function patch(p: Partial<FormData0>) {
    setData((d) => ({ ...d, ...p }));
  }

  const isCompany = data.kind === "empresa";
  const docNorm = data.document ? normalizeDocument(data.kind, data.document) : null;

  // ── Chequeo en vivo "¿este documento ya tiene cuenta?" (INTACTO) ──
  const [existsDoc, setExistsDoc] = useState<string | null>(null);
  useEffect(() => {
    if (!docNorm) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/registro/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: data.kind, document: docNorm }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const j = (await res.json()) as { exists?: boolean };
        setExistsDoc((cur) => (j.exists ? docNorm : cur === docNorm ? null : cur));
      } catch {
        // Abort de un tipeo nuevo o error de red → no cambiamos el estado.
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [docNorm, data.kind]);

  const alreadyExists = !!docNorm && existsDoc === docNorm;

  // Validez por campo (para los errores inline) y validez total (submit final).
  const errName = tried && !data.name.trim();
  const errCompany = tried && isCompany && !data.company.trim();
  const errDoc = tried && (!data.document.trim() || !docNorm);
  const errEmail = tried && !data.email.trim();
  const errPhone = tried && !data.whatsapp.trim();

  const step0Valid =
    !!data.name.trim() &&
    (!isCompany || !!data.company.trim()) &&
    !!docNorm &&
    !alreadyExists &&
    !!data.email.trim();
  const step1Valid = !!data.whatsapp.trim();
  const valid = step0Valid && step1Valid;

  const STEPS = [
    { t: "Identidad", d: "Quién eres" },
    { t: "Contacto", d: "Cómo te ubicamos" },
    { t: "Preferencias", d: "Últimos detalles" },
    { t: "Confirmar", d: "Revisa tus datos" },
    { t: "¡Listo!", d: "Tu Shipping Mark" },
  ];
  // Índice activo del rail: paso actual, o el 5º (éxito) cuando ya hay MARKBOX.
  const railActive = done ? 4 : step;

  function next() {
    if (step === 0 && !step0Valid) {
      setTried(true);
      return;
    }
    if (step === 1 && !step1Valid) {
      setTried(true);
      return;
    }
    setTried(false);
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    setTried(false);
    setStep((s) => Math.max(0, s - 1));
  }
  const firstName = data.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="px-5 py-8 lg:py-12">
      <div className="mx-auto max-w-[1080px] grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 lg:gap-6 items-stretch">
        {/* ── Hero navy · marca + rail de pasos ── */}
        <aside
          className="relative overflow-hidden rounded-[18px] p-7 sm:p-8 text-white flex flex-col"
          style={{
            background:
              "radial-gradient(135% 100% at 15% -10%, #1f3055 0%, #0f1e3d 46%, #0b1428 100%)",
          }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors mb-4 w-fit"
          >
            <ArrowIcon size={13} className="rotate-180" /> Volver a dtdcargo.com
          </Link>
          <span
            className="text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--color-wine-soft)" }}
          >
            Registro de cliente
          </span>
          <h1
            className="mt-2.5 text-[26px] leading-[1.08] text-white"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            De China a tu puerta, con confianza.
          </h1>
          <p className="mt-2 text-[13px] leading-[1.55] text-white/70 max-w-[34ch]">
            Crea tu cuenta y obtén tu Shipping Mark: el código que identifica tu
            carga de punta a punta.
          </p>

          <nav className="mt-auto pt-8 flex flex-col gap-0.5" aria-label="Pasos del registro">
            {STEPS.map((s, i) => {
              const isOn = i === railActive;
              const isDone = i < railActive;
              const canGo = !done && i <= step;
              return (
                <button
                  key={s.t}
                  type="button"
                  disabled={!canGo}
                  onClick={() => canGo && setStep(i)}
                  className={`flex items-center gap-3.5 px-2.5 py-2.5 rounded-[10px] text-left w-full transition-colors ${
                    canGo ? "hover:bg-white/[0.06] cursor-pointer" : "cursor-default"
                  } ${isOn ? "bg-white/10" : ""}`}
                >
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full grid place-items-center text-[12px] font-extrabold"
                    style={{
                      background: isDone
                        ? "var(--color-status-success)"
                        : isOn
                          ? "var(--color-wine)"
                          : "rgba(255,255,255,0.12)",
                      color: "#fff",
                      fontFamily: "var(--font-archivo-black)",
                    }}
                  >
                    {isDone ? <CheckIcon size={14} /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold leading-[1.1]">{s.t}</span>
                    <span
                      className="block text-[11px] leading-[1.3] mt-0.5"
                      style={{ color: isOn ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.5)" }}
                    >
                      {s.d}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 pt-5 border-t border-white/10 text-[11px] leading-[1.5] text-white/60">
            ¿Ya tienes cuenta?{" "}
            <Link href="/portal/login" className="font-bold text-white hover:underline">
              Entra al portal
            </Link>
          </div>
        </aside>

        {/* ── Panel · pasos ── */}
        <main className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 sm:p-9 flex flex-col">
          {!done && est && (
            <div
              className="mb-5 rounded-[10px] bg-paper border-l-[3px] px-4 py-2.5 text-[12.5px] text-grey-700 leading-[1.5]"
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

          <form
            action={(fd) => {
              if (!valid) {
                setTried(true);
                setStep(step0Valid ? 3 : 0);
                return;
              }
              action(fd);
            }}
            className="flex flex-col flex-1"
            noValidate
          >
            {/* Espejos ocultos de la data controlada — el submit final los envía todos. */}
            <input type="hidden" name="kind" value={data.kind} />
            <input type="hidden" name="name" value={data.name} />
            <input type="hidden" name="company" value={data.company} />
            <input type="hidden" name="document" value={data.document} />
            <input type="hidden" name="email" value={data.email} />
            <input type="hidden" name="whatsapp" value={data.whatsapp} />
            <input type="hidden" name="office_phone" value={data.officePhone} />
            <input type="hidden" name="est" value={est ?? ""} />
            <input type="hidden" name="ref" value={refCode ?? ""} />
            {/* email_optin se parsea por PRESENCIA (!= null) en el action → solo
                se incluye cuando el cliente marca el opt-in (semántica de checkbox). */}
            {data.emailOptin && <input type="hidden" name="email_optin" value="on" />}

            {/* Honeypot anti-bot (SDD-0042 §10) — off-screen, un humano no lo ve. */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
            >
              <label htmlFor="empresa_web">No completar este campo</label>
              <input id="empresa_web" type="text" name="empresa_web" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>

            {done ? (
              <StepDone
                markbox={state.markbox!}
                firstName={firstName}
                email={data.email}
                warning={state.warning}
              />
            ) : (
              <>
                <div className="flex-1">
                  {step === 0 && (
                    <StepIdentidad
                      data={data}
                      patch={patch}
                      isCompany={isCompany}
                      errName={errName}
                      errCompany={errCompany}
                      errDoc={errDoc}
                      errEmail={errEmail}
                      docFieldError={state.fieldErrors?.document}
                      emailFieldError={state.fieldErrors?.email}
                      alreadyExists={alreadyExists}
                    />
                  )}
                  {step === 1 && (
                    <StepContacto
                      firstName={firstName}
                      isCompany={isCompany}
                      companyName={data.company}
                      onWhatsapp={(v) => patch({ whatsapp: v })}
                      onOffice={(v) => patch({ officePhone: v })}
                      errPhone={errPhone}
                      phoneFieldError={state.fieldErrors?.whatsapp}
                    />
                  )}
                  {step === 2 && (
                    <StepPreferencias data={data} patch={patch} />
                  )}
                  {step === 3 && (
                    <StepConfirmar data={data} docNorm={docNorm} isCompany={isCompany} error={state.error} />
                  )}
                </div>

                {/* Navegación */}
                <div className="flex gap-2.5 mt-7 pt-1">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={back}
                      className="btn btn-ghost h-[52px] px-5 flex-shrink-0"
                    >
                      ‹ Volver
                    </button>
                  )}
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={next}
                      className="btn btn-primary h-[52px] flex-1 justify-center gap-2"
                    >
                      Continuar <ArrowIcon size={15} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={pending}
                      className="btn btn-primary h-[52px] flex-1 justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {pending ? "Creando tu cuenta…" : "Crear cuenta y generar tu Shipping Mark"}
                      {!pending && <CheckIcon size={16} />}
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}

// ── Encabezado de paso ───────────────────────────────────────────
function StepHead({ n, eyebrow, title, sub }: { n: number; eyebrow: string; title: string; sub: React.ReactNode }) {
  return (
    <>
      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-wine">
        Paso {n} de 5 · {eyebrow}
      </div>
      <h2
        className="mt-2 text-[22px] sm:text-[24px] leading-[1.1] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.55] max-w-[52ch]">{sub}</p>
    </>
  );
}

// ── Paso 1 · Identidad ───────────────────────────────────────────
function StepIdentidad({
  data,
  patch,
  isCompany,
  errName,
  errCompany,
  errDoc,
  errEmail,
  docFieldError,
  emailFieldError,
  alreadyExists,
}: {
  data: FormData0;
  patch: (p: Partial<FormData0>) => void;
  isCompany: boolean;
  errName: boolean;
  errCompany: boolean;
  errDoc: boolean;
  errEmail: boolean;
  docFieldError?: string;
  emailFieldError?: string;
  alreadyExists: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHead
        n={1}
        eyebrow="Identidad"
        title="Empecemos por ti"
        sub="Elige cómo importas y déjanos tus datos de acceso. Con esto creamos tu cuenta."
      />

      <div className="grid grid-cols-2 gap-2.5">
        <TypeCard
          active={!isCompany}
          label="Persona natural"
          desc="Importas a título personal"
          icon={<UserIcon size={20} />}
          onClick={() => patch({ kind: "persona", document: "" })}
        />
        <TypeCard
          active={isCompany}
          label="Empresa"
          desc="Importas para tu negocio"
          icon={<ShieldIcon size={20} />}
          onClick={() => patch({ kind: "empresa", document: "" })}
        />
      </div>

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

      {isCompany ? (
        <Field
          key="rif"
          label="RIF"
          value={data.document}
          onChange={(v) => patch({ document: v })}
          placeholder="J-12345678-9"
          mono
          hint="Lo usamos para identificarte y evitar cuentas duplicadas."
          error={docFieldError ?? (errDoc ? "RIF inválido. Formato: J-12345678-9." : undefined)}
        />
      ) : (
        <CedulaInput
          key="cedula"
          value={data.document}
          onChange={(v) => patch({ document: v })}
          hint="Lo usamos para identificarte y evitar cuentas duplicadas."
          error={
            docFieldError ??
            (errDoc ? "Cédula o pasaporte inválido. Formato: V-12345678 o P-A1234567." : undefined)
          }
        />
      )}

      {alreadyExists && <DupRecover isCompany={isCompany} />}

      <Field
        label="Email"
        type="email"
        value={data.email}
        onChange={(v) => patch({ email: v })}
        placeholder="cperez@empresa.com"
        hint="Sin contraseñas: te enviamos un enlace de acceso al portal a tu correo."
        error={emailFieldError ?? (errEmail ? "Campo obligatorio" : undefined)}
      />
    </div>
  );
}

// ── Paso 2 · Contacto ────────────────────────────────────────────
function StepContacto({
  firstName,
  isCompany,
  companyName,
  onWhatsapp,
  onOffice,
  errPhone,
  phoneFieldError,
}: {
  firstName: string;
  isCompany: boolean;
  companyName: string;
  onWhatsapp: (v: string) => void;
  onOffice: (v: string) => void;
  errPhone: boolean;
  phoneFieldError?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHead
        n={2}
        eyebrow="Contacto"
        title={firstName ? `Hola ${firstName}, ¿cómo te ubicamos?` : "¿Cómo te ubicamos?"}
        sub={
          <>
            {isCompany && companyName ? (
              <>
                Registras a <strong className="text-ink">{companyName}</strong>.{" "}
              </>
            ) : null}
            El WhatsApp es por donde te avisamos de tu carga: cuando llega a bodega en
            China, cuando zarpa y cuando está lista para entrega.
          </>
        }
      />
      <PhoneInput
        label="Teléfono WhatsApp"
        onChange={onWhatsapp}
        placeholder="412 1668021"
        hint="Es el número por el que te contactamos · siempre por WhatsApp."
        error={phoneFieldError ?? (errPhone ? "Campo obligatorio" : undefined)}
      />
      <PhoneInput
        label="Teléfono de oficina (opcional)"
        onChange={onOffice}
        placeholder="241 4147886"
        hint="Otro número donde podemos ubicarte (fijo u oficina) · no se usa para WhatsApp."
      />
    </div>
  );
}

// ── Paso 3 · Preferencias (reemplaza el "Dirección" del mockup) ───
// La dirección de entrega + la foto de cédula se DIFIEREN al portal por diseño
// del backend; acá quedan las preferencias (opt-in) + qué sigue.
function StepPreferencias({
  data,
  patch,
}: {
  data: FormData0;
  patch: (p: Partial<FormData0>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHead
        n={3}
        eyebrow="Preferencias"
        title="Antes de crear tu cuenta"
        sub="Un par de detalles y listo. Tu perfil completo (foto de cédula + dirección de entrega) lo terminas dentro del portal."
      />

      <div
        className="rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.55]"
        style={{ borderColor: "var(--color-wine)" }}
      >
        Generamos tu <strong className="text-ink">Shipping Mark</strong> al instante y tu
        cuenta queda <strong className="text-ink">activa</strong>. Antes de tu primera
        compra completas tu perfil (foto de cédula + dirección de entrega) desde el
        portal — un par de minutos.
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.emailOptin}
          onChange={(e) => patch({ emailOptin: e.target.checked })}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          style={{ accentColor: "var(--color-wine)" }}
        />
        <span className="text-[12.5px] text-grey-700 leading-[1.5]">
          Quiero recibir novedades, ofertas y guías de importación por email. Puedes
          darte de baja cuando quieras.
        </span>
      </label>

      <p className="text-[12.5px] leading-[1.5] text-grey-500 max-w-[54ch]">
        Solicitamos estos datos para identificar tu carga, evitar errores de entrega y
        cumplir con los procesos logísticos y documentales. No compartimos tu
        información salvo obligaciones operativas o legales.
      </p>
    </div>
  );
}

// ── Paso 4 · Confirmar ───────────────────────────────────────────
function StepConfirmar({
  data,
  docNorm,
  isCompany,
  error,
}: {
  data: FormData0;
  docNorm: string | null;
  isCompany: boolean;
  error?: string;
}) {
  const rows: { k: string; v: string; mono?: boolean }[] = [
    { k: isCompany ? "RIF" : "Cédula", v: docNorm ?? "—", mono: true },
    { k: "Correo", v: data.email || "—" },
    { k: "WhatsApp", v: data.whatsapp || "—", mono: true },
  ];
  return (
    <div className="flex flex-col gap-5">
      <StepHead
        n={4}
        eyebrow="Confirmar"
        title={data.name ? `Confirma tus datos, ${data.name.split(/\s+/)[0]}` : "Confirma tus datos"}
        sub="Revisa que todo esté correcto antes de generar tu Shipping Mark."
      />

      <div className="rounded-[14px] border border-grey-200 bg-paper p-5">
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-wine">
          {isCompany ? "Empresa" : "Persona natural"}
        </div>
        <div
          className="mt-1.5 text-[16px] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
        >
          {(isCompany ? data.company : data.name) || "—"}
        </div>
        {isCompany && data.name && (
          <div className="mt-0.5 text-[12px] text-grey-500">Contacto: {data.name}</div>
        )}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {rows.map((r) => (
            <div key={r.k}>
              <div className="text-[10px] font-medium tracking-[0.08em] uppercase text-grey-500">
                {r.k}
              </div>
              <div
                className="mt-1 text-[13px] font-bold text-ink break-words"
                style={r.mono ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } : undefined}
              >
                {r.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex gap-2.5 items-start rounded-[10px] px-4 py-3 text-[12px] leading-[1.55] text-grey-700"
        style={{
          background: "color-mix(in srgb, var(--color-status-warning) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)",
        }}
      >
        <span className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-status-warning)" }}>
          <WarningIcon size={16} />
        </span>
        <span>
          Al confirmar se genera tu <strong className="text-ink">Shipping Mark</strong>.
          Asegúrate de que tus datos estén correctos: algunos no podrás editarlos dentro
          del sistema sin autorización. Datos correctos hacen tu logística puntual.
        </span>
      </div>

      {error && <p className="text-[13.5px] text-wine leading-[1.45]">{error}</p>}
    </div>
  );
}

// ── "¿Ya tienes cuenta?" · recuperar acceso (chequeo en vivo) ─────
function DupRecover({ isCompany }: { isCompany: boolean }) {
  return (
    <div
      className="-mt-1 rounded-[12px] border px-4 py-3.5"
      style={{ borderColor: "var(--color-wine)", background: "var(--color-paper)" }}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex-shrink-0 text-wine">
          <WarningIcon size={16} />
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-wine leading-[1.3]">
            Este {isCompany ? "RIF" : "cédula"} ya tiene una cuenta en DTD Cargo
          </div>
          <p className="mt-1 text-[12.5px] text-grey-700 leading-[1.5]">
            Si eres tú, no hace falta crear otra. Entra al portal y pide tu enlace de
            acceso por correo.
          </p>
          <Link href="/portal/login" className="mt-3 inline-flex btn btn-ghost h-10 text-[13px]">
            Recuperar mi acceso <ArrowIcon size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Paso 5 · ¡Listo! (celebración del Shipping Mark) ─────────────
function StepDone({
  markbox,
  firstName,
  email,
  warning,
}: {
  markbox: string;
  firstName: string;
  email: string;
  warning?: string;
}) {
  const shown = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div
        className="w-[74px] h-[74px] rounded-full grid place-items-center"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
      >
        <CheckIcon size={36} />
      </div>
      <div>
        <div
          className="text-[22px] sm:text-[25px] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
        >
          Bienvenido a la familia DTD Cargo
        </div>
        <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55] max-w-[42ch]">
          Tu cuenta está activa{firstName ? `, ${firstName}` : ""}. Este es el código de
          tus cajas — lo usamos en bodega y con tu proveedor.
        </p>
      </div>

      {!warning && (
        <div
          className={`w-full max-w-[440px] rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.5] text-left flex items-start gap-2.5 transition-all duration-500 ${
            shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
          }`}
          style={{ borderColor: "var(--color-status-success)" }}
        >
          <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-status-success)" }}>
            <CheckIcon size={15} />
          </span>
          <span>
            <strong className="text-ink">Correo de bienvenida enviado</strong>
            {email ? ` a ${email}` : ""}. Ábrelo y haz clic en el enlace para entrar — sin
            contraseña. Si no lo ves, revisa spam.
          </span>
        </div>
      )}

      {/* Tarjeta Shipping Mark — hero */}
      <div
        className={`markbox-celebrate w-full max-w-[440px] rounded-[16px] px-6 py-7 text-left transition-all duration-500 ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        style={{ background: "var(--color-wine)", color: "#fff" }}
      >
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "var(--color-wine-soft)" }}>
          Tu Shipping Mark · 唛头 — la marca que va en tus cajas
        </div>
        <div
          className="mt-2 text-[44px] sm:text-[52px] leading-none"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", letterSpacing: "-0.01em" }}
        >
          {markbox}
        </div>
      </div>

      <MarkboxGuide markbox={markbox} />

      <div className="w-full max-w-[440px] rounded-[12px] bg-paper border border-grey-200 px-5 py-4 text-left">
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Cómo entrar al portal
        </div>
        <div className="mt-2 text-[12.5px] text-grey-700 leading-[1.55]">
          No te pedimos contraseña ni tienes que recordar tu Shipping Mark. Te enviamos
          un <strong className="text-ink">enlace de acceso a tu correo</strong> y entras
          con un clic. Solo tu correo.
        </div>
        {email && (
          <div className="mt-3 flex items-center gap-2.5 rounded-[10px] bg-white border border-grey-200 px-3.5 py-3">
            <span className="flex-shrink-0 text-wine">
              <MailIcon size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold tracking-[0.12em] uppercase text-grey-500">
                Tu correo registrado
              </div>
              <div className="text-[14px] font-bold text-ink" style={{ wordBreak: "break-all" }}>
                {email}
              </div>
            </div>
          </div>
        )}
      </div>

      {warning && (
        <p
          className="w-full max-w-[440px] rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.5] text-left"
          style={{ borderColor: "var(--color-status-warning)" }}
        >
          {warning}
        </p>
      )}

      <Link href="/portal/login" className="btn btn-primary w-full max-w-[440px]">
        Ir al portal <ArrowIcon />
      </Link>
    </div>
  );
}

// ── Guía de nomenclatura del Shipping Mark (expandible) ──────────
function MarkboxGuide({ markbox }: { markbox: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full max-w-[440px] text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-[12px] border px-4 py-3.5 flex items-center gap-3 transition-colors"
        style={{ borderColor: "var(--color-wine)", background: "var(--color-paper)" }}
        aria-expanded={open}
      >
        <span className="flex-1">
          <span className="block text-[13px] font-bold text-wine leading-[1.3]">
            Cómo se arma el código de cada compra
          </span>
          <span className="block text-[12px] text-grey-700 leading-[1.45] mt-0.5">
            Tu Shipping Mark más el proveedor y la compra. Toca para ver la guía (1 min).
          </span>
        </span>
        <span
          className="flex-shrink-0 text-wine transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {open && (
        <div className="mt-3 rounded-[12px] border border-grey-200 bg-white px-5 py-5">
          <div className="rounded-[10px] bg-paper border border-grey-200 px-4 py-4">
            <div className="flex items-start justify-center gap-2">
              <CodePart code={markbox} label="Tu Shipping Mark" tone="wine" />
              <span
                className="text-[18px] font-black text-grey-500 mt-0.5"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                -
              </span>
              <CodePart code="1" label="Proveedor" tone="ink" />
              <span
                className="text-[18px] font-black text-grey-500 mt-0.5"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                -
              </span>
              <CodePart code="2" label="Compra" tone="ink" />
            </div>
          </div>

          <GuideStep n="1" title="Tu Shipping Mark te identifica">
            <code
              className="text-[12px] font-bold text-wine px-1.5 py-0.5 rounded"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", background: "var(--color-paper)" }}
            >
              {markbox}
            </code>{" "}
            es tu identificador único como cliente. Es la base de todos tus códigos.
          </GuideStep>

          <GuideStep n="2" title="Cada proveedor lleva su número">
            Si le compras a varios proveedores en China, a cada uno le asignamos un
            número (1, 2, 3…). Así sabes de cuál proveedor te llega cada caja.
          </GuideStep>

          <GuideStep n="3" title="Cada compra suma" last>
            Cada vez que le vuelves a comprar al mismo proveedor, el número de compra
            avanza ({markbox}-1-1, {markbox}-1-2…). Todo queda separado y trazable desde
            tu portal, sin manejar sistemas externos.
          </GuideStep>

          <div
            className="mt-4 rounded-[10px] border-l-[3px] px-4 py-3 text-[12px] text-grey-700 leading-[1.55]"
            style={{ borderColor: "var(--color-wine)", background: "var(--color-paper)" }}
          >
            Cuando registres tu compra en el portal te asignamos el código y las{" "}
            <strong className="text-ink">etiquetas</strong> para que tu proveedor las
            pegue en cada caja. Sin la etiqueta correcta, la caja entra como “huérfana” y
            se retrasa.
          </div>
        </div>
      )}
    </div>
  );
}

function CodePart({ code, label, tone }: { code: string; label: string; tone: "wine" | "ink" }) {
  const color = tone === "wine" ? "var(--color-wine)" : "var(--color-ink)";
  return (
    <div className="flex flex-col items-center gap-1">
      <code
        className="text-[18px] font-black leading-none"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", color }}
      >
        {code}
      </code>
      <span
        className="text-[8.5px] font-bold uppercase tracking-[0.05em] text-center leading-[1.2]"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function GuideStep({
  n,
  title,
  children,
  last,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 pt-4 ${last ? "" : "pb-1"}`}>
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full grid place-items-center text-[12px] font-black"
        style={{ background: "var(--color-wine)", color: "#fff", fontFamily: "var(--font-archivo-black)" }}
      >
        {n}
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-ink leading-[1.25]">{title}</div>
        <div className="mt-1 text-[12.5px] text-grey-700 leading-[1.55]">{children}</div>
      </div>
    </div>
  );
}

// ── Primitivas de form ──────────────────────────────────────────
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
        style={mono ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } : undefined}
      />
      {hint && !error && <span className="text-[11.5px] text-grey-500 leading-[1.4]">{hint}</span>}
      {error && <span className="text-[12px] text-wine leading-[1.4]">{error}</span>}
    </label>
  );
}

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237F0F1A' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";

function CedulaInput({
  value,
  onChange,
  hint,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
}) {
  const m = /^([VEP])-?(.*)$/i.exec(value || "");
  const initialLetter: "V" | "E" | "P" =
    m && m[1].toUpperCase() === "E" ? "E" : m && m[1].toUpperCase() === "P" ? "P" : "V";
  const [letter, setLetter] = useState<"V" | "E" | "P">(initialLetter);
  const [digits, setDigits] = useState(
    m
      ? initialLetter === "P"
        ? m[2].replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        : m[2].replace(/\D/g, "")
      : "",
  );

  function emit(l: "V" | "E" | "P", d: string) {
    onChange(d ? `${l}-${d}` : "");
  }
  function onLetter(l: "V" | "E" | "P") {
    setLetter(l);
    emit(l, digits);
  }
  function onDigits(raw: string) {
    const d = letter === "P" ? raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : raw.replace(/\D/g, "");
    setDigits(d);
    emit(letter, d);
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        Cédula
      </span>
      <div className="flex items-stretch h-12 rounded-[10px] bg-grey-100 overflow-hidden focus-within:ring-2 focus-within:ring-wine focus-within:ring-offset-1">
        <select
          value={letter}
          onChange={(e) => onLetter(e.target.value as "V" | "E" | "P")}
          aria-label="Nacionalidad de la cédula"
          className="bg-grey-200 border-0 outline-none text-[14.5px] font-bold text-wine cursor-pointer"
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            appearance: "none",
            WebkitAppearance: "none",
            padding: "0 26px 0 12px",
            backgroundImage: SELECT_ARROW,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 9px center",
          }}
        >
          <option value="V">V</option>
          <option value="E">E</option>
          <option value="P">P</option>
        </select>
        <input
          value={digits}
          onChange={(e) => onDigits(e.target.value)}
          inputMode={letter === "P" ? "text" : "numeric"}
          placeholder={letter === "P" ? "A1234567" : "18456321"}
          className="flex-1 min-w-0 px-3.5 bg-transparent border-0 outline-none text-[14.5px] text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        />
      </div>
      {hint && !error && (
        <span className="text-[11.5px] text-grey-500 leading-[1.4]">
          V = venezolano · E = extranjero · P = pasaporte · escribe solo el número, sin puntos. {hint}
        </span>
      )}
      {error && <span className="text-[12px] text-wine leading-[1.4]">{error}</span>}
    </label>
  );
}

const COUNTRY_CODES: { c: string; dial: string }[] = [
  { c: "VE", dial: "+58" },
  { c: "US", dial: "+1" },
  { c: "CO", dial: "+57" },
  { c: "PA", dial: "+507" },
  { c: "PE", dial: "+51" },
  { c: "CL", dial: "+56" },
  { c: "EC", dial: "+593" },
  { c: "AR", dial: "+54" },
  { c: "BR", dial: "+55" },
  { c: "MX", dial: "+52" },
  { c: "ES", dial: "+34" },
  { c: "CN", dial: "+86" },
];

function PhoneInput({
  label,
  onChange,
  placeholder,
  hint,
  error,
}: {
  label: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  const [code, setCode] = useState("+58");
  const [digits, setDigits] = useState("");

  function emit(c: string, d: string) {
    onChange(d ? `${c} ${d}` : "");
  }
  function onCode(c: string) {
    setCode(c);
    emit(c, digits);
  }
  function onDigits(raw: string) {
    const s = raw.trim();
    if (s.startsWith("+")) {
      const cleaned = "+" + s.slice(1).replace(/\D/g, "");
      const match = COUNTRY_CODES.map((o) => o.dial)
        .filter((dial) => cleaned.startsWith(dial))
        .sort((a, b) => b.length - a.length)[0];
      if (match) {
        const rest = cleaned.slice(match.length);
        setCode(match);
        setDigits(rest);
        emit(match, rest);
        return;
      }
    }
    const d = s.replace(/\D/g, "");
    setDigits(d);
    emit(code, d);
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
      </span>
      <div className="flex items-stretch h-12 rounded-[10px] bg-grey-100 overflow-hidden focus-within:ring-2 focus-within:ring-wine focus-within:ring-offset-1">
        <select
          value={code}
          onChange={(e) => onCode(e.target.value)}
          aria-label="Código de país"
          className="bg-grey-200 border-0 outline-none text-[13px] font-bold text-wine cursor-pointer"
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            appearance: "none",
            WebkitAppearance: "none",
            padding: "0 24px 0 10px",
            backgroundImage: SELECT_ARROW,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 7px center",
          }}
        >
          {COUNTRY_CODES.map((o) => (
            <option key={o.c} value={o.dial}>
              {o.c} {o.dial}
            </option>
          ))}
        </select>
        <input
          value={digits}
          onChange={(e) => onDigits(e.target.value)}
          inputMode="tel"
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3.5 bg-transparent border-0 outline-none text-[14.5px] text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        />
      </div>
      {hint && !error && <span className="text-[11.5px] text-grey-500 leading-[1.4]">{hint}</span>}
      {error && <span className="text-[12px] text-wine leading-[1.4]">{error}</span>}
    </label>
  );
}

function TypeCard({
  active,
  label,
  desc,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  desc: string;
  icon: React.ReactNode;
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
      <div className="flex items-center gap-2">
        <span style={{ color: active ? "var(--color-wine)" : "var(--color-grey-500)" }}>{icon}</span>
        <div className="text-[14px] font-bold" style={{ color: active ? "var(--color-wine)" : "var(--color-ink)" }}>
          {label}
        </div>
      </div>
      <div className="mt-1 text-[12px] text-grey-500 leading-[1.4]">{desc}</div>
    </button>
  );
}
