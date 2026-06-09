"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { VE_STATES } from "@/lib/data/venezuela-catalog";
import type { ProfileActionState } from "@/lib/portal/register-types";
import { completeProfileAction } from "./actions";

const initial: ProfileActionState = {};

type AddressForm = {
  state: string;
  municipio: string;
  city: string;
  postalCode: string;
  barrio: string;
  barrioCustom: string;
  address: string;
  reference: string;
};

const EMPTY: AddressForm = {
  state: "",
  municipio: "",
  city: "",
  postalCode: "",
  barrio: "",
  barrioCustom: "",
  address: "",
  reference: "",
};

/**
 * Form de "Completa tu perfil" (REGISTRO EXPRESS · founder 2026-06-07): la foto de
 * cédula/RIF + la dirección de entrega VE que el alta express difirió. La foto es
 * obligatoria solo si todavía no hay una (prop `hasPhoto`). Cascada estado →
 * municipio → ciudad → barrio del catálogo VE.
 */
export function ProfileForm({
  hasPhoto,
  markbox,
}: {
  hasPhoto: boolean;
  markbox: string;
}) {
  const [state, action, pending] = useActionState(completeProfileAction, initial);
  const [data, setData] = useState<AddressForm>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [tried, setTried] = useState(false);

  const done = !!state.ok;

  function patch(p: Partial<AddressForm>) {
    setData((d) => ({ ...d, ...p }));
  }

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
  const photoOk = hasPhoto || !!photo;
  const addressOk =
    !!data.state &&
    !!data.municipio &&
    !!data.city &&
    !!data.postalCode &&
    barrioOk &&
    !!data.address.trim();
  const valid = photoOk && addressOk;

  if (done) {
    return (
      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-7 sm:p-9 max-w-[640px]"
        style={{ borderLeftColor: "var(--color-status-success)" }}
      >
        <div
          className="w-14 h-14 rounded-full grid place-items-center"
          style={{ background: "var(--color-status-success)", color: "#fff" }}
        >
          <CheckIcon size={28} />
        </div>
        <h2 className="mt-5 text-[22px] font-bold text-ink" style={{ fontFamily: "var(--font-archivo-black)" }}>
          Perfil completo.
        </h2>
        <p className="mt-2 text-[14.5px] text-grey-700 leading-[1.6] max-w-[48ch]">
          Ya tenemos tu foto de identidad y tu dirección de entrega. Tu asesor revisa
          la foto antes de tu primera carga. ¡Listo para operar!
        </p>
        <Link href="/portal" className="btn btn-primary mt-6 inline-flex items-center gap-2">
          Ir a mi panel <ArrowIcon />
        </Link>
      </div>
    );
  }

  const resolvedBarrio = data.barrio === "__other__" ? data.barrioCustom : data.barrio;

  return (
    <form
      action={(fd) => {
        if (!valid) {
          setTried(true);
          return;
        }
        if (photo) fd.set("cedula_photo", photo);
        action(fd);
      }}
      className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 lg:gap-8 items-start"
      noValidate
    >
      {/* Hidden mirrors de la dirección (la cascada vive en estado). */}
      <input type="hidden" name="state" value={data.state} />
      <input type="hidden" name="municipio" value={data.municipio} />
      <input type="hidden" name="city" value={data.city} />
      <input type="hidden" name="postal_code" value={data.postalCode} />
      <input type="hidden" name="barrio" value={resolvedBarrio} />
      <input type="hidden" name="address" value={data.address} />
      <input type="hidden" name="reference" value={data.reference} />

      {/* ── Foto de identidad ── */}
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
          Foto de identidad
        </div>
        <h2 className="mt-2 text-[18px] font-bold text-ink leading-tight">
          Tu cédula o RIF
        </h2>
        <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55]">
          Sube una foto legible. La revisa tu asesor para verificar tu identidad
          antes de tu primera carga — queda privada, solo la ve el equipo de DTD.
        </p>

        {hasPhoto && !photo && (
          <div
            className="mt-4 rounded-[10px] bg-paper border-l-[3px] px-4 py-2.5 text-[12.5px] text-grey-700 leading-[1.5]"
            style={{ borderColor: "var(--color-status-success)" }}
          >
            Ya tienes una foto cargada. Sube una nueva solo si quieres reemplazarla.
          </div>
        )}

        <PhotoUpload value={photo} onChange={setPhoto} error={tried && !photoOk} />
        {tried && !photoOk && (
          <p className="mt-1.5 text-[12.5px] text-wine">{state.fieldErrors?.photo ?? "Tienes que subir la foto."}</p>
        )}
        {!tried && state.fieldErrors?.photo && (
          <p className="mt-1.5 text-[12.5px] text-wine">{state.fieldErrors.photo}</p>
        )}
      </div>

      {/* ── Dirección de entrega VE ── */}
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
            Dirección de entrega
          </div>
          <h2 className="mt-2 text-[18px] font-bold text-ink leading-tight">
            ¿Dónde te entregamos en Venezuela?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Estado"
            value={data.state}
            onChange={(v) => patch({ state: v, municipio: "", city: "", postalCode: "" })}
            options={states}
            error={tried && !data.state ? "Obligatorio" : state.fieldErrors?.state}
          />
          <SelectField
            label="Municipio"
            value={data.municipio}
            onChange={(v) => patch({ municipio: v, city: "", postalCode: "" })}
            options={municipios}
            disabled={!data.state}
            error={tried && !data.municipio ? "Obligatorio" : state.fieldErrors?.municipio}
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
            error={tried && !data.city ? "Obligatorio" : state.fieldErrors?.city}
          />
          <Field
            label="Código postal"
            value={data.postalCode}
            onChange={(v) => patch({ postalCode: v })}
            placeholder="2001"
            mono
            error={tried && !data.postalCode ? "Obligatorio" : state.fieldErrors?.postalCode}
          />
        </div>

        <SelectField
          label="Barrio / urbanización"
          value={data.barrio}
          onChange={(v) => patch({ barrio: v })}
          options={[...barrios, "__other__"]}
          optionLabel={(v) => (v === "__other__" ? "Otro · escribir manualmente" : v)}
          disabled={!data.city}
          error={tried && !barrioOk && data.barrio !== "__other__" ? "Obligatorio" : state.fieldErrors?.barrio}
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
          error={tried && !data.address.trim() ? "Campo obligatorio" : state.fieldErrors?.address}
        />
        <Field
          label="Punto de referencia (opcional)"
          value={data.reference}
          onChange={(v) => patch({ reference: v })}
          placeholder="Frente a la panadería La Espiga"
        />
      </div>

      {/* Footer full-width: error general + submit */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {state.error && (
          <p className="text-[13.5px] text-wine leading-[1.45]">{state.error}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "Guardando…" : "Guardar mi perfil"}
            {!pending && <CheckIcon size={16} />}
          </button>
          <Link href="/portal" className="btn btn-ghost">
            Lo hago después
          </Link>
          <span className="text-[12px] text-grey-500" style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
            {markbox}
          </span>
        </div>
      </div>
    </form>
  );
}

// ── Primitivas ──────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        type="text"
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
        className="h-12 px-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
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
      className="mt-4 flex items-center gap-3 cursor-pointer rounded-[12px] border border-dashed px-4 py-4 transition-colors"
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
            <strong className="text-ink">{value.name}</strong> — toca para cambiar
          </>
        ) : (
          "Sube una foto legible · anverso y reverso si aplica (JPG/PNG, máx 8 MB)"
        )}
      </span>
    </label>
  );
}
