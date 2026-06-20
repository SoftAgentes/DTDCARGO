"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowIcon,
  CheckIcon,
  ChevronDownIcon,
  ShieldIcon,
  UserIcon,
  WarningIcon,
} from "@/components/Icon";
import { ChinaSupplierClip } from "@/components/ChinaSupplierClip";
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
 * Registro EXPRESS (founder 2026-06-07). Un solo paso, lo mínimo para emitir el
 * MARKBOX y poder contactar al cliente: tipo · nombre · documento · email ·
 * WhatsApp. La foto de cédula y la dirección de entrega se DIFIEREN a "Completa tu
 * perfil" dentro del portal (`/portal/perfil`), donde se piden antes de la 1ª
 * compra. Baja la fricción del lead de WhatsApp sin perder el dedup ni la
 * identidad básica (el documento sigue obligatorio para dedup + identidad; NO es
 * la contraseña — la cuenta nace con clave aleatoria, login por magic-link/reset).
 *
 * Capa visual + UX llevada al Norte v4.3 (esta sesión): selector de tipo con
 * icono, cédula con prefijo V/E, teléfono con código de país, teléfono de oficina
 * opcional, chequeo en vivo "¿ya tienes cuenta?" (→ recuperar acceso) y la guía de
 * nomenclatura del MARKBOX en la pantalla de éxito. Se mantiene MARKBOX (término
 * público) y el acceso por enlace al correo (no "clave = cédula").
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
            {done ? "Bienvenido a DTD Cargo." : "Crea tu cuenta."}
          </h1>

          {!done && (
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
              En un minuto tienes tu MARKBOX (tu shipping mark) para empezar a marcar tus cajas en China.
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
              firstName={data.name.split(" ")[0]}
              email={data.email}
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
              Entra aquí
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

  // ── Chequeo en vivo "¿este documento ya tiene cuenta?" ──────────
  // Cuando el documento normaliza válido, con debounce, preguntamos al endpoint
  // (que responde SOLO un booleano — cero PII). Si ya existe, ofrecemos recuperar
  // el acceso en vez de crear un duplicado. Un error/throttle → 'free' (no
  // bloqueamos: el dedup real del alta protege igual en el submit).
  // Guardamos el ÚLTIMO documento confirmado como ya-existente; `alreadyExists` se
  // deriva comparándolo con el documento normalizado actual → al cambiar el
  // documento el aviso desaparece solo (sin un positivo viejo "pegado"), y NO hay
  // setState síncrono dentro del effect (solo dentro del callback con debounce).
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
        if (!res.ok) return; // throttle/error → no confirmamos (el alta valida igual)
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

  const errName = tried && !data.name.trim();
  const errCompany = tried && isCompany && !data.company.trim();
  const errDoc = tried && (!data.document.trim() || !docNorm);
  const errEmail = tried && !data.email.trim();
  const errPhone = tried && !data.whatsapp.trim();

  const valid =
    !!data.name.trim() &&
    (!isCompany || !!data.company.trim()) &&
    !!docNorm &&
    !alreadyExists &&
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
      <input type="hidden" name="office_phone" value={data.officePhone} />
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

      {/* Documento: cédula con prefijo V/E (persona) o RIF (empresa). El input se
          remonta al cambiar de tipo (key) → estado interno limpio. */}
      {isCompany ? (
        <Field
          key="rif"
          label="RIF"
          value={data.document}
          onChange={(v) => patch({ document: v })}
          placeholder="J-12345678-9"
          mono
          hint="Lo usamos para identificarte y evitar cuentas duplicadas."
          error={
            fieldErrors?.document ??
            (errDoc ? "RIF inválido. Formato: J-12345678-9." : undefined)
          }
        />
      ) : (
        <CedulaInput
          key="cedula"
          value={data.document}
          onChange={(v) => patch({ document: v })}
          hint="Lo usamos para identificarte y evitar cuentas duplicadas."
          error={
            fieldErrors?.document ??
            (errDoc ? "Cédula inválida. Formato: V-12345678." : undefined)
          }
        />
      )}

      {/* Aviso en vivo: la cuenta ya existe → recuperar acceso (no duplicar). */}
      {alreadyExists && <DupRecover isCompany={isCompany} />}

      <Field
        label="Email"
        type="email"
        value={data.email}
        onChange={(v) => patch({ email: v })}
        placeholder="cperez@empresa.com"
        hint="Lo usamos para enviarte tu enlace de acceso al portal."
        error={fieldErrors?.email ?? (errEmail ? "Campo obligatorio" : undefined)}
      />

      <PhoneInput
        label="Teléfono WhatsApp"
        onChange={(v) => patch({ whatsapp: v })}
        placeholder="412 1668021"
        hint="Es el número por el que te contactamos · siempre por WhatsApp."
        error={fieldErrors?.whatsapp ?? (errPhone ? "Campo obligatorio" : undefined)}
      />

      <PhoneInput
        label="Teléfono de oficina (opcional)"
        onChange={(v) => patch({ officePhone: v })}
        placeholder="241 4147886"
        hint="Otro número donde podemos ubicarte (fijo u oficina) · no se usa para WhatsApp."
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

      {/* SDD-0082: opt-in EXPLÍCITO de marketing por email (default OFF). Es
          consentimiento aparte — el email transaccional (bienvenida, factura,
          avisos de envío) llega igual sin marcarlo. */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          name="email_optin"
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

      {error && <p className="text-[13.5px] text-wine leading-[1.45]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
      >
        {pending ? "Creando tu cuenta…" : "Crear cuenta y generar MARKBOX"}
        {!pending && <CheckIcon size={16} />}
      </button>

      {/* Aviso de privacidad — confianza en el punto de captura de datos
          (SDD-0064 Fase 5). Sin enlaces a páginas legales aún inexistentes. */}
      <p className="mt-4 text-[12.5px] leading-[1.5] text-grey-500 max-w-[54ch]">
        Solicitamos estos datos para identificar tu carga, evitar errores de
        entrega y cumplir con los procesos logísticos y documentales. No
        compartimos tu información salvo obligaciones operativas o legales.
      </p>
    </form>
  );
}

// ── "¿Ya tienes cuenta?" · recuperar acceso (chequeo en vivo) ─────
// Se muestra cuando el documento ya tiene una cuenta. NO revela a quién pertenece
// (el endpoint solo devuelve un booleano): solo ofrece entrar / recuperar acceso.
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
            Si eres tú, no hace falta crear otra. Entra al portal y pide tu enlace
            de acceso por correo.
          </p>
          <Link href="/portal/login" className="mt-3 inline-flex btn btn-ghost h-10 text-[13px]">
            Recuperar mi acceso <ArrowIcon size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Listo ───────────────────────────────────────────────────────
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
  // Fade-in del aviso de "correo enviado" al montar (feedback interactivo).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(true);
  }, []);

  return (
    <div className="mt-6 flex flex-col items-center text-center gap-5">
      <div
        className="w-16 h-16 rounded-full grid place-items-center"
        style={{ background: "var(--color-status-success)", color: "#fff" }}
      >
        <CheckIcon size={32} />
      </div>
      <div>
        <div
          className="text-[20px] sm:text-[22px] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
        >
          ¡Felicitaciones{firstName ? `, ${firstName}` : ""}!
        </div>
        <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[42ch]">
          Tu cuenta quedó creada. Este es tu código MARKBOX — guárdalo, vas a usarlo
          mucho: es lo que tus proveedores escriben en cada caja.
        </p>
      </div>

      {/* Confirmación interactiva: correo de bienvenida enviado (fade-in al montar) */}
      {!warning && (
        <div
          className={`w-full rounded-[10px] bg-paper border-l-[3px] px-4 py-3 text-[12.5px] text-grey-700 leading-[1.5] text-left flex items-start gap-2.5 transition-all duration-500 ${
            shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
          }`}
          style={{ borderColor: "var(--color-status-success)" }}
        >
          <span
            className="mt-0.5 flex-shrink-0"
            style={{ color: "var(--color-status-success)" }}
          >
            <CheckIcon size={15} />
          </span>
          <span>
            <strong className="text-ink">Correo de bienvenida enviado</strong>
            {email ? ` a ${email}` : ""}. Si no lo ves en unos minutos, revisa la
            carpeta de spam / correo no deseado.
          </span>
        </div>
      )}

      {/* Tarjeta MARKBOX — hero: más grande + entrada con fade y glow "se abre y se apaga" */}
      <div
        className={`markbox-celebrate w-full rounded-[16px] px-6 py-7 transition-all duration-500 ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        style={{ background: "var(--color-wine)", color: "#fff" }}
      >
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "var(--color-wine-soft)" }}>
          Tu MARKBOX · 唛头 — tu shipping mark, la marca que va en tus cajas
        </div>
        <div
          className="mt-2 text-[44px] sm:text-[52px] leading-none"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", letterSpacing: "-0.01em" }}
        >
          {markbox}
        </div>
      </div>

      {/* Guía de nomenclatura del MARKBOX — cómo se arma el código de cada compra.
          Portada del Norte v4.3, adaptada a MARKBOX (público). Colapsada por
          defecto: educa sin abrumar en el momento de la celebración. */}
      <MarkboxGuide markbox={markbox} />

      {/* El MARKBOX es el código de las cajas, NO la credencial de acceso: al
          portal se entra siempre por email + enlace de acceso (SDD-0094). NO
          repetimos el código acá (ya está, grande, en el hero de arriba): este
          bloque explica el acceso, sin competir con el hero. */}
      <div className="w-full rounded-[12px] bg-paper border border-grey-200 px-5 py-4 text-left">
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Cómo entrar al portal
        </div>
        <div className="mt-2 text-[12.5px] text-grey-700 leading-[1.5]">
          Tu MARKBOX es el código de tus cajas — lo usamos en bodega y con el
          proveedor, no para entrar. Para{" "}
          <strong className="text-ink">entrar al portal</strong> no hace falta
          recordarlo: en el login pides tu{" "}
          <strong className="text-ink">enlace de acceso por correo</strong>
          {email ? ` (te llega a ${email})` : ""} y entras con un clic.
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
        <strong className="text-ink">Tu cuenta ya está activa.</strong> Entra al
        portal con tu <strong className="text-ink">email</strong>. Ahí registras cada{" "}
        <strong className="text-ink">compra</strong> que le haces a un proveedor
        chino — eso es tu <strong className="text-wine">prealerta</strong>: nos
        avisa que viene mercancía y la procesamos más rápido. Antes de tu primera
        compra te pediremos completar tu perfil (foto de cédula + dirección de
        entrega), un par de minutos desde el portal.
      </p>

      {/* SDD-0096: instructivo para el proveedor (dirección CN + Shipping Mark).
          Sin link de form (aún no hay orden); el link sale por-orden del portal. */}
      <ChinaSupplierClip markbox={markbox} />

      <Link href="/portal/login" className="btn btn-primary w-full">
        Ir al portal <ArrowIcon />
      </Link>
    </div>
  );
}

// ── Guía de nomenclatura del MARKBOX (expandible) ────────────────
// Explica cómo se arma el código de cada compra: MARKBOX-proveedor-compra.
// Portada del Norte v4.3 (`portal/registro.jsx` · Guide), adaptada al término
// público MARKBOX y a los tokens de la web.
function MarkboxGuide({ markbox }: { markbox: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full text-left">
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
            Tu MARKBOX más el proveedor y la compra. Toca para ver la guía (1 min).
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
          {/* Desglose visual del código MARKBOX-proveedor-compra. */}
          <div className="rounded-[10px] bg-paper border border-grey-200 px-4 py-4">
            <div className="flex items-start justify-center gap-2">
              <CodePart code={markbox} label="Tu MARKBOX" tone="wine" />
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

          <GuideStep n="1" title="Tu MARKBOX te identifica">
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
            avanza ({markbox}-1-1, {markbox}-1-2…). Todo queda separado y trazable
            desde tu portal, sin manejar sistemas externos.
          </GuideStep>

          <div
            className="mt-4 rounded-[10px] border-l-[3px] px-4 py-3 text-[12px] text-grey-700 leading-[1.55]"
            style={{ borderColor: "var(--color-wine)", background: "var(--color-paper)" }}
          >
            Cuando registres tu compra en el portal te asignamos el código y las{" "}
            <strong className="text-ink">etiquetas</strong> para que tu proveedor las
            pegue en cada caja. Sin la etiqueta correcta, la caja entra como
            “huérfana” y se retrasa.
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

// Flecha custom (chevron wine) para los <select> con `appearance: none` — clava
// el look del Norte v4.3 en vez de la flecha nativa del navegador. `%23` = `#`.
const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237F0F1A' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";

// ── Cédula con prefijo de nacionalidad (V / E) ───────────────────
// En Venezuela la cédula lleva V (venezolano) o E (extranjero). El usuario solo
// escribe el número; la letra se elige a la izquierda (V por defecto). Emite el
// canónico "V-12345678" hacia el padre (o "" si no hay dígitos). Portado del
// Norte v4.3 (`CedulaInput`) a tokens de la web.
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
  // Estado interno: deriva la letra del valor inicial (si lo hubiera) y el resto.
  const m = /^([VE])-?(.*)$/i.exec(value || "");
  const [letter, setLetter] = useState<"V" | "E">(
    m && m[1].toUpperCase() === "E" ? "E" : "V",
  );
  const [digits, setDigits] = useState(m ? m[2].replace(/\D/g, "") : "");

  function emit(l: "V" | "E", d: string) {
    onChange(d ? `${l}-${d}` : "");
  }
  function onLetter(l: "V" | "E") {
    setLetter(l);
    emit(l, digits);
  }
  function onDigits(raw: string) {
    const d = raw.replace(/\D/g, "");
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
          onChange={(e) => onLetter(e.target.value as "V" | "E")}
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
        </select>
        <input
          value={digits}
          onChange={(e) => onDigits(e.target.value)}
          inputMode="numeric"
          placeholder="18456321"
          className="flex-1 min-w-0 px-3.5 bg-transparent border-0 outline-none text-[14.5px] text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        />
      </div>
      {hint && !error && (
        <span className="text-[11.5px] text-grey-500 leading-[1.4]">
          V = venezolano · E = extranjero · escribe solo el número. {hint}
        </span>
      )}
      {error && <span className="text-[12px] text-wine leading-[1.4]">{error}</span>}
    </label>
  );
}

// ── Teléfono con selector de código de país ──────────────────────
// El cliente solo escribe el número; el código se elige a la izquierda (VE +58
// por defecto, orden por frecuencia de clientes DTD). Emite "+58 4121234567"
// hacia el padre (o "" si no hay dígitos). Portado del Norte v4.3 (`PhoneInput`).
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
    // Si pega un "+…", autodetecta el código (el más largo que matchee).
    const s = raw.trim();
    if (s.startsWith("+")) {
      const cleaned = "+" + s.slice(1).replace(/\D/g, "");
      const match = COUNTRY_CODES.map((o) => o.dial)
        .filter((d) => cleaned.startsWith(d))
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
        <span style={{ color: active ? "var(--color-wine)" : "var(--color-grey-500)" }}>
          {icon}
        </span>
        <div className="text-[14px] font-bold" style={{ color: active ? "var(--color-wine)" : "var(--color-ink)" }}>
          {label}
        </div>
      </div>
      <div className="mt-1 text-[12px] text-grey-500 leading-[1.4]">{desc}</div>
    </button>
  );
}
