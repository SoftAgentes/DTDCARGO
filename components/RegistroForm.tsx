"use client";

import { useState, type FormEvent } from "react";
import { ArrowIcon, WhatsAppIcon } from "./Icon";
import { CONTACT, DESTINATIONS } from "@/lib/design-tokens";

type Status = "idle" | "submitting" | "success" | "error";

type RegData = {
  nombre: string;
  email: string;
  whatsapp: string;
  ciudad: string;
  rubro: string;
};

/**
 * Formulario de registro / alta de cliente.
 *
 * Modelo DTD: el alta es MEDIADA — el cliente deja sus datos acá y un asesor
 * le **asigna el MARKBOX** (`DTD-XXXX`) desde el Studio. No hay auto-asignación
 * ni cuenta con login en el sitio público.
 *
 * Backend: MOCK, igual que ContactoForm/CotizarForm. El `onSubmit` captura los
 * datos y arma un WhatsApp estructurado para que el asesor cree el cliente con
 * toda la info. Cuando el ERP exponga `POST {ERP}/api/public/leads`, reemplazar
 * el setTimeout por un `fetch(...)` (TODO: reemplazar por fetch real).
 *
 * Terminología: de cara al CLIENTE siempre **MARKBOX**; al proveedor en China
 * se lo nombra **Shipping Mark (唛头)** — por eso el copy lo aclara una vez.
 */
export function RegistroForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [regId, setRegId] = useState<string | null>(null);
  const [data, setData] = useState<RegData | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const fd = new FormData(e.currentTarget);
    const captured: RegData = {
      nombre: String(fd.get("nombre") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      whatsapp: String(fd.get("whatsapp") ?? "").trim(),
      ciudad: String(fd.get("ciudad") ?? "").trim(),
      rubro: String(fd.get("rubro") ?? "").trim(),
    };

    try {
      // MOCK — sustituir por fetch(`${NEXT_PUBLIC_HAILUWAY_API}/api/public/leads`, …)
      // cuando el ERP exponga el endpoint real de leads.
      await new Promise((r) => setTimeout(r, 700));
      setData(captured);
      setRegId(`DTD-REG-${Date.now().toString(36).toUpperCase().slice(-6)}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success" && data) {
    const lines = [
      "Hola DTD Cargo, quiero darme de alta como cliente.",
      "",
      `• Código: ${regId}`,
      `• Nombre/empresa: ${data.nombre}`,
      `• Email: ${data.email}`,
      `• WhatsApp: ${data.whatsapp}`,
      `• Ciudad (VE): ${data.ciudad}`,
    ];
    if (data.rubro) lines.push(`• Importo: ${data.rubro}`);
    lines.push("", "¿Me pueden asignar mi MARKBOX?");
    const whatsappUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
      lines.join("\n"),
    )}`;

    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10 self-start">
        <div className="eyebrow" style={{ color: "var(--color-wine)" }}>
          ✓ Registro recibido
        </div>
        <h3
          className="mt-4 text-[30px] lg:text-[34px] leading-[1.05] tracking-[-0.02em] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Te asignamos
          <br />
          tu MARKBOX.
        </h3>
        <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.55]">
          Tu registro quedó con el código{" "}
          <strong className="text-ink">{regId}</strong>. Un asesor te asigna tu{" "}
          <strong className="text-ink">MARKBOX</strong> (tu código de cliente{" "}
          <span style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
            DTD-XXXX
          </span>
          ) y te contacta por WhatsApp en menos de 24&nbsp;hs.
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn mt-6 inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          style={{ background: "#25D366", color: "white" }}
        >
          <WhatsAppIcon size={20} />
          Acelerar mi alta por WhatsApp
        </a>
        <p className="text-[12px] text-grey-500 mt-3 leading-[1.5]">
          Al clickear, abrís WhatsApp con tus datos pre-cargados. Llega directo a
          un asesor que te da de alta y te pasa tu MARKBOX.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-5 self-start"
    >
      <h2
        className="text-[26px] leading-[1.05] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Date de alta
      </h2>

      <Field label="Nombre o empresa">
        <input
          name="nombre"
          required
          autoComplete="name"
          placeholder="Nombre y apellido o razón social"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            name="whatsapp"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+58 412 ..."
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Field>
      </div>

      <Field label="Ciudad de entrega en Venezuela">
        <input
          name="ciudad"
          required
          list="ve-ciudades"
          autoComplete="address-level2"
          placeholder="Valencia, Caracas, Maracaibo…"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
        />
        <datalist id="ve-ciudades">
          {DESTINATIONS.map((d) => (
            <option key={d.code} value={d.label.replace(", VE", "")} />
          ))}
        </datalist>
      </Field>

      <Field label="¿Qué importás? (opcional)">
        <textarea
          name="rubro"
          rows={3}
          placeholder="Rubro o tipo de mercancía. Ej: repuestos, ropa, electrónica…"
          className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none"
        />
      </Field>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-primary h-14 mt-2 disabled:opacity-60 disabled:cursor-wait"
      >
        {status === "submitting" ? "Enviando…" : "Crear mi registro"}{" "}
        {status !== "submitting" && <ArrowIcon />}
      </button>

      {status === "error" && (
        <p className="text-[13.5px] text-wine">
          Falló el envío. Intentá de nuevo o escribinos por WhatsApp.
        </p>
      )}

      <p className="text-[12.5px] text-grey-500 leading-[1.5]">
        Sin costo de alta. Al registrarte aceptás que un asesor te contacte por
        WhatsApp o email para asignarte tu MARKBOX. No compartimos tus datos con
        terceros.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      {children}
    </label>
  );
}
