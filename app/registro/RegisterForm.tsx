"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { VE_STATES } from "@/lib/data/venezuela-catalog";
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
  officePhone: string;
  state: string;
  municipio: string;
  city: string;
  postalCode: string;
  barrio: string;
  barrioCustom: string;
  address: string;
  reference: string;
};

const EMPTY: FormData0 = {
  kind: "persona",
  name: "",
  company: "",
  document: "",
  email: "",
  whatsapp: "",
  officePhone: "",
  state: "",
  municipio: "",
  city: "",
  postalCode: "",
  barrio: "",
  barrioCustom: "",
  address: "",
  reference: "",
};

const STEP_LABELS = ["Datos", "Dirección", "Confirmar", "Listo"];

export function RegisterForm({ est }: { est?: string }) {
  const [state, action, pending] = useActionState(registerClientAction, initial);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData0>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [tried, setTried] = useState(false);

  // El alta exitosa salta a "Listo" (paso 4) cuando la action devuelve markbox.
  const done = !!state.markbox;
  const currentStep = done ? 4 : step;

  function patch(p: Partial<FormData0>) {
    setData((d) => ({ ...d, ...p }));
  }

  return (
    <div className="grid place-items-center px-5 py-12">
      <div className="w-full max-w-[560px]">
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 sm:p-9">
          <span className="eyebrow">Portal del cliente</span>
          <h1
            className="mt-3 text-[26px] sm:text-[30px] leading-[1.08] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            {done ? "Bienvenido a DTD Cargo." : "Creá tu cuenta."}
          </h1>

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

          {!done && <StepBar current={currentStep} />}

          {currentStep === 1 && (
            <Step1
              data={data}
              patch={patch}
              photo={photo}
              setPhoto={setPhoto}
              tried={tried}
              onNext={() => {
                setTried(false);
                setStep(2);
              }}
              fieldError={state.fieldErrors?.document}
              onTried={() => setTried(true)}
            />
          )}

          {currentStep === 2 && (
            <Step2
              data={data}
              patch={patch}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {currentStep === 3 && (
            <Step3
              data={data}
              photo={photo}
              est={est}
              action={action}
              pending={pending}
              error={state.error}
              fieldErrors={state.fieldErrors}
              onBack={() => setStep(2)}
            />
          )}

          {currentStep === 4 && (
            <StepDone
              markbox={state.markbox!}
              document={normalizeDocument(data.kind, data.document) ?? data.document}
              kind={data.kind}
              firstName={data.name.split(" ")[0]}
              warning={state.warning}
            />
          )}
        </div>

        {!done && (
          <p className="text-center mt-6 text-[13.5px] text-grey-500">
            ¿Ya tenés cuenta?{" "}
            <Link href="/portal/login" className="font-semibold text-wine hover:text-wine-deep">
              Entrá acá
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function StepBar({ current }: { current: number }) {
  return (
    <div className="mt-6 grid grid-cols-4 gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const isDone = current > n;
        const isActive = current === n;
        return (
          <div
            key={label}
            className="px-2 py-2 rounded-[8px] text-center"
            style={{
              background: isDone
                ? "var(--color-status-success)"
                : isActive
                  ? "var(--color-wine)"
                  : "var(--color-grey-100)",
            }}
          >
            <span
              className="text-[10px] font-bold tracking-[0.06em] uppercase leading-none"
              style={{ color: isDone || isActive ? "#fff" : "var(--color-grey-500)" }}
            >
              {n}. {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Paso 1 · Datos ──────────────────────────────────────────────
function Step1({
  data,
  patch,
  photo,
  setPhoto,
  tried,
  onNext,
  onTried,
  fieldError,
}: {
  data: FormData0;
  patch: (p: Partial<FormData0>) => void;
  photo: File | null;
  setPhoto: (f: File | null) => void;
  tried: boolean;
  onNext: () => void;
  onTried: () => void;
  fieldError?: string;
}) {
  const isCompany = data.kind === "empresa";
  const docNorm = data.document ? normalizeDocument(data.kind, data.document) : null;

  const errName = tried && !data.name.trim();
  const errCompany = tried && isCompany && !data.company.trim();
  const errDoc = tried && (!data.document.trim() || !docNorm);
  const errPhoto = tried && !photo;
  const errEmail = tried && !data.email.trim();
  const errPhone = tried && !data.whatsapp.trim();

  const valid =
    data.name.trim() &&
    (!isCompany || data.company.trim()) &&
    !!docNorm &&
    photo &&
    data.email.trim() &&
    data.whatsapp.trim();

  function handleNext() {
    if (valid) onNext();
    else onTried();
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
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

      <SectionLabel>Identificación · todos los campos son obligatorios</SectionLabel>
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
        error={
          fieldError ??
          (errDoc
            ? isCompany
              ? "RIF inválido. Formato: J-12345678-9."
              : "Cédula inválida. Formato: V-12345678."
            : undefined)
        }
      />

      <div>
        <SectionLabel>Foto de la {isCompany ? "RIF" : "cédula"}</SectionLabel>
        <PhotoUpload value={photo} onChange={setPhoto} error={errPhoto} />
        {errPhoto && (
          <p className="mt-1.5 text-[12.5px] text-wine">Tenés que subir la foto.</p>
        )}
      </div>

      <SectionLabel>Contacto</SectionLabel>
      <Field
        label="Email"
        type="email"
        value={data.email}
        onChange={(v) => patch({ email: v })}
        placeholder="cperez@empresa.com"
        error={errEmail ? "Campo obligatorio" : undefined}
      />
      <Field
        label="Teléfono WhatsApp"
        value={data.whatsapp}
        onChange={(v) => patch({ whatsapp: v })}
        placeholder="+58 412 1668021"
        mono
        hint="Es el número por el que te contactamos · siempre por WhatsApp."
        error={errPhone ? "Campo obligatorio" : undefined}
      />
      <Field
        label="Teléfono de oficina (opcional)"
        value={data.officePhone}
        onChange={(v) => patch({ officePhone: v })}
        placeholder="+58 241 4147886"
        mono
      />

      <button type="button" onClick={handleNext} className="btn btn-primary mt-1">
        Siguiente · Dirección <ArrowIcon />
      </button>
    </div>
  );
}

// ── Paso 2 · Dirección VE ───────────────────────────────────────
function Step2({
  data,
  patch,
  onBack,
  onNext,
}: {
  data: FormData0;
  patch: (p: Partial<FormData0>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [tried, setTried] = useState(false);

  const states = useMemo(
    () =>
      VE_STATES.filter((s) => !s.virtual)
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b)),
    [],
  );
  const municipios = useMemo(() => {
    const st = VE_STATES.find((s) => s.name === data.state);
    return st ? st.municipios.map((m) => m.name) : [];
  }, [data.state]);
  const cities = useMemo(() => {
    const st = VE_STATES.find((s) => s.name === data.state);
    const mu = st?.municipios.find((m) => m.name === data.municipio);
    return mu ? mu.cities : [];
  }, [data.state, data.municipio]);
  const cityObj = cities.find((c) => c.name === data.city);
  const barrios = cityObj?.barrios ?? [];

  const barrioOk =
    !!data.barrio && (data.barrio !== "__other__" || !!data.barrioCustom.trim());
  const valid =
    data.state && data.municipio && data.city && data.postalCode && barrioOk && data.address.trim();

  function handleNext() {
    if (valid) onNext();
    else setTried(true);
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <SectionLabel>Dirección de entrega en Venezuela</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Estado"
          value={data.state}
          onChange={(v) => patch({ state: v, municipio: "", city: "", postalCode: "" })}
          options={states}
          error={tried && !data.state ? "Obligatorio" : undefined}
        />
        <SelectField
          label="Municipio"
          value={data.municipio}
          onChange={(v) => patch({ municipio: v, city: "", postalCode: "" })}
          options={municipios}
          disabled={!data.state}
          error={tried && !data.municipio ? "Obligatorio" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Ciudad"
          value={data.city}
          onChange={(v) => {
            const c = cities.find((x) => x.name === v);
            patch({ city: v, postalCode: c?.postalCode ?? "" });
          }}
          options={cities.map((c) => c.name)}
          disabled={!data.municipio}
          error={tried && !data.city ? "Obligatorio" : undefined}
        />
        <Field
          label="Código postal"
          value={data.postalCode}
          onChange={(v) => patch({ postalCode: v })}
          placeholder="2001"
          mono
          error={tried && !data.postalCode ? "Obligatorio" : undefined}
        />
      </div>

      <SelectField
        label="Barrio / urbanización"
        value={data.barrio}
        onChange={(v) => patch({ barrio: v })}
        options={[...barrios, "__other__"]}
        optionLabel={(v) => (v === "__other__" ? "Otro · escribir manualmente" : v)}
        disabled={!data.city}
        error={tried && !barrioOk && data.barrio !== "__other__" ? "Obligatorio" : undefined}
      />
      {data.barrio === "__other__" && (
        <Field
          label="Barrio (manual)"
          value={data.barrioCustom}
          onChange={(v) => patch({ barrioCustom: v })}
          placeholder="Ej. Urb. La Esmeralda"
          error={tried && !data.barrioCustom.trim() ? "Obligatorio" : undefined}
        />
      )}

      <Field
        label="Dirección detallada"
        value={data.address}
        onChange={(v) => patch({ address: v })}
        placeholder="Av. principal, edif. Tía Mary, piso 3, apto 4-B"
        hint="Calle, número, edificio, piso, apartamento"
        error={tried && !data.address.trim() ? "Campo obligatorio" : undefined}
      />
      <Field
        label="Punto de referencia (opcional)"
        value={data.reference}
        onChange={(v) => patch({ reference: v })}
        placeholder="Frente a la panadería La Espiga"
      />

      <div className="grid grid-cols-[auto_1fr] gap-2.5">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Volver
        </button>
        <button type="button" onClick={handleNext} className="btn btn-primary">
          Siguiente · Confirmar <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

// ── Paso 3 · Confirmar (el form real que postea) ────────────────
function Step3({
  data,
  photo,
  est,
  action,
  pending,
  error,
  fieldErrors,
  onBack,
}: {
  data: FormData0;
  photo: File | null;
  est?: string;
  action: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  fieldErrors?: RegisterActionState["fieldErrors"];
  onBack: () => void;
}) {
  // Re-inyectamos el File en el form al submit (el File no viaja por hidden inputs).
  const formRef = useRef<HTMLFormElement>(null);
  const isCompany = data.kind === "empresa";
  const barrio = data.barrio === "__other__" ? data.barrioCustom : data.barrio;

  return (
    <form
      ref={formRef}
      action={(fd) => {
        if (photo) fd.set("cedula_photo", photo);
        action(fd);
      }}
      className="mt-6 flex flex-col gap-5"
    >
      {/* Datos del form (hidden) */}
      <input type="hidden" name="kind" value={data.kind} />
      <input type="hidden" name="name" value={data.name} />
      <input type="hidden" name="company" value={data.company} />
      <input type="hidden" name="document" value={data.document} />
      <input type="hidden" name="email" value={data.email} />
      <input type="hidden" name="whatsapp" value={data.whatsapp} />
      <input type="hidden" name="office_phone" value={data.officePhone} />
      <input type="hidden" name="state" value={data.state} />
      <input type="hidden" name="municipio" value={data.municipio} />
      <input type="hidden" name="city" value={data.city} />
      <input type="hidden" name="postal_code" value={data.postalCode} />
      <input type="hidden" name="barrio" value={barrio} />
      <input type="hidden" name="address" value={data.address} />
      <input type="hidden" name="reference" value={data.reference} />
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

      <SectionLabel>Confirmá tus datos</SectionLabel>

      <SummaryCard eyebrow={isCompany ? "Empresa" : "Persona natural"}>
        <div className="text-[17px] font-bold text-ink leading-tight">
          {data.company || data.name}
        </div>
        {data.company && (
          <div className="mt-1 text-[12.5px] text-grey-500">Contacto: {data.name}</div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
          <Row label={isCompany ? "RIF" : "Cédula"} value={data.document} mono />
          <Row label="Email" value={data.email} />
          <Row label="WhatsApp" value={data.whatsapp} mono />
          <Row label="Tel. oficina" value={data.officePhone || "—"} mono />
          <Row label="Foto identidad" value={photo ? "Cargada" : "Falta"} />
        </dl>
      </SummaryCard>

      <SummaryCard eyebrow="Dirección de entrega">
        <div className="text-[14px] font-semibold text-ink">{data.address}</div>
        {barrio && <div className="mt-1 text-[12.5px] text-grey-500">{barrio}</div>}
        <div className="mt-1 text-[12.5px] text-grey-500">
          {data.city} · {data.municipio} · {data.state}
        </div>
        {data.postalCode && (
          <div
            className="mt-2 text-[12px] text-wine"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            CP {data.postalCode}
          </div>
        )}
        {data.reference && (
          <div className="mt-2 text-[12px] text-grey-700">Ref: {data.reference}</div>
        )}
      </SummaryCard>

      <div
        className="rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[13px] text-grey-700 leading-[1.5]"
        style={{ borderColor: "var(--color-wine)" }}
      >
        Al confirmar generamos tu <strong className="text-ink">MARKBOX</strong> al
        instante. Tu cuenta queda <strong className="text-ink">en revisión</strong> —
        un asesor la activa (o se activa sola con tu primera carga). Ya vas a poder
        usar tu MARKBOX con tus proveedores.
      </div>

      {(error || fieldErrors?.document) && (
        <p className="text-[13.5px] text-wine leading-[1.45]">
          {error ?? fieldErrors?.document}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2.5">
        <button type="button" onClick={onBack} disabled={pending} className="btn btn-ghost disabled:opacity-60">
          Volver
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Creando tu cuenta…" : "Confirmar y generar MARKBOX"}
          {!pending && <CheckIcon size={16} />}
        </button>
      </div>
    </form>
  );
}

// ── Paso 4 · Listo ──────────────────────────────────────────────
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
        <strong className="text-ink">Tu cuenta está en revisión.</strong> Vas a poder
        ver tu panel apenas un asesor la active o llegue tu primera carga. Mientras
        tanto, tu MARKBOX ya sirve para marcar tus cajas con tus proveedores.
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

function SelectField({
  label,
  value,
  onChange,
  options,
  optionLabel,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabel?: (v: string) => string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-12 px-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
      >
        <option value="">— Elegí —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel ? optionLabel(o) : o}
          </option>
        ))}
      </select>
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

function PhotoUpload({
  value,
  onChange,
  error,
}: {
  value: File | null;
  onChange: (f: File | null) => void;
  error?: boolean;
}) {
  return (
    <label
      className="mt-2 flex items-center gap-3 cursor-pointer rounded-[12px] border border-dashed px-4 py-4 transition-colors"
      style={{
        borderColor: error ? "var(--color-wine)" : value ? "var(--color-status-success)" : "var(--color-grey-200)",
        background: "var(--color-grey-100)",
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span
        className="w-10 h-10 rounded-full grid place-items-center flex-shrink-0"
        style={{
          background: value ? "var(--color-status-success)" : "var(--color-grey-200)",
          color: value ? "#fff" : "var(--color-grey-700)",
        }}
      >
        {value ? <CheckIcon size={18} /> : <ArrowIcon size={18} />}
      </span>
      <span className="text-[13px] text-grey-700 leading-[1.4]">
        {value ? (
          <>
            <strong className="text-ink">{value.name}</strong> — tocá para cambiar
          </>
        ) : (
          "Subí una foto legible · anverso y reverso si aplica (JPG/PNG, máx 8 MB)"
        )}
      </span>
    </label>
  );
}

function SummaryCard({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] bg-paper border border-grey-200 p-4 sm:p-5">
      <div className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-wine mb-2">
        {eyebrow}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className="text-[13.5px] font-semibold text-ink break-words"
        style={mono ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
