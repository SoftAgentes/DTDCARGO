"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  lastMileEstimate,
  type ClientDeliveryAddress,
} from "@/lib/studio/client-address-types";
import {
  addAddressAction,
  setDefaultAddressAction,
  deleteAddressAction,
  type AddressActionState,
} from "./address-actions";
import { ArrowIcon, CheckIcon } from "@/components/Icon";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initial: AddressActionState = {};

/** Ciudad del catálogo del calculador (slug + label + datos del recargo). */
export type AddressCity = {
  id: string;
  label: string;
  km: number;
  casco: boolean;
  /**
   * USD por m³ de la entrega (SDD-0237). Lo alimenta `app/portal/(app)/perfil/
   * page.tsx` cruzando `calculator_cities` con `public_carrier_tariffs()` vía
   * `combinarDestinos` — el mismo cruce que hace la calculadora pública, para
   * que el cliente vea acá el precio que vería cotizando.
   *
   * `null` = sin tarifa confirmada → la fila dice que la cotiza el asesor.
   */
  ventaCbm?: number | null;
};

/**
 * Direcciones de entrega del cliente (SDD-0138 Slice B+C · Norte PortalProfile).
 * Lista + marcar predeterminada + agregar + eliminar. Read-write: el cliente
 * gestiona LAS SUYAS (la RLS y las server actions garantizan la propiedad). El
 * mismo esquema lo edita el asesor desde el Studio.
 *
 * Slice C: si la ciudad es del catálogo del calculador, muestra cómo se cobra
 * la entrega ahí (mismo tarifario que la calculadora pública). Ciudad fuera del
 * catálogo → texto libre y sin estimado (degrada honesto).
 */
export function PortalAddresses({
  addresses,
  cities = [],
  framed = true,
}: {
  addresses: ClientDeliveryAddress[];
  cities?: AddressCity[];
  /** true (default) = sección con divisor superior (embebida tras otro
      contenido); false = la card padre ya da el marco (SDD-0145, Mi perfil). */
  framed?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className={framed ? "mt-8 pt-6 border-t border-grey-200" : undefined}>
      <div className="flex items-center justify-between gap-3">
        {/* Eyebrow wine cuando la card padre da el marco (hermana de "Datos de
            cuenta"/"Identidad" en Mi perfil); gris cuando es sección embebida. */}
        <h2
          className={`text-[11px] font-bold tracking-[0.14em] uppercase ${
            framed ? "text-grey-500" : "text-wine"
          }`}
        >
          Direcciones de entrega
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[12.5px] font-bold text-wine hover:text-wine-deep inline-flex items-center gap-1"
          >
            + Agregar
          </button>
        )}
      </div>

      {addresses.length === 0 && !adding ? (
        <p className="mt-3 text-[13.5px] text-grey-700 leading-[1.55]">
          Todavía no tienes direcciones de entrega. Agrega una para que sepamos
          dónde llevar tu carga.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5 list-none p-0">
          {addresses.map((a) => (
            <AddressRow key={a.id} address={a} cities={cities} />
          ))}
        </ul>
      )}

      {adding && <AddForm onDone={() => setAdding(false)} cities={cities} />}
    </div>
  );
}

function AddressRow({
  address,
  cities,
}: {
  address: ClientDeliveryAddress;
  cities: AddressCity[];
}) {
  const parts = [address.city, address.state].filter(Boolean).join(", ");
  // Cómo se cobra la entrega, si la ciudad es del catálogo.
  //
  // Antes esto exigía además `lastMileParams` (el umbral de km + el $/km de
  // `calculator_settings`). Desde SDD-0237 `lastMileEstimate` ya no los mira
  // —cobra por m³— y ese requisito sobreviviente sólo servía para esconder el
  // precio cuando la RPC de config no respondía.
  const catalogCity = address.citySlug
    ? (cities.find((c) => c.id === address.citySlug) ?? null)
    : null;
  const estimate = catalogCity ? lastMileEstimate(catalogCity) : null;
  return (
    <li
      className="rounded-[12px] border border-grey-200 bg-paper p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      style={
        address.isDefault
          ? { borderLeftWidth: 3, borderLeftColor: "var(--color-wine)" }
          : undefined
      }
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {address.label ? (
            <span className="text-[13.5px] font-bold text-ink">{address.label}</span>
          ) : null}
          {address.isDefault ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-wine"
              style={{ background: "color-mix(in srgb, var(--color-wine) 12%, transparent)" }}
            >
              <CheckIcon size={11} /> Predeterminada
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-[14px] text-ink leading-[1.45]">{address.line}</div>
        {parts ? (
          <div className="text-[12.5px] text-grey-700">{parts}</div>
        ) : null}
        {address.reference ? (
          <div className="mt-0.5 text-[12px] text-grey-500 leading-[1.4]">
            Ref: {address.reference}
          </div>
        ) : null}
        {estimate ? (
          <div className="mt-1 text-[12px] leading-[1.4]">
            {estimate.included ? (
              <span style={{ color: "var(--color-status-success)" }}>
                Entrega incluida
              </span>
            ) : "sinTarifa" in estimate ? (
              <span className="text-grey-700">
                La entrega hasta aquí la cotiza tu asesor
              </span>
            ) : (
              <span className="text-grey-700">
                Entrega{" "}
                <b
                  className="text-ink"
                  style={{
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                  }}
                >
                  ${estimate.usdPorCbm.toFixed(2)}
                </b>{" "}
                por m³ · se suma según el volumen de tu carga
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {!address.isDefault && (
          <form action={setDefaultAddressAction}>
            <input type="hidden" name="addressId" value={address.id} />
            <PendingTextButton
              className="text-[12px] font-semibold text-wine hover:text-wine-deep whitespace-nowrap"
              idle="Predeterminar"
              pending="Guardando…"
            />
          </form>
        )}
        <form action={deleteAddressAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <PendingTextButton
            className="text-[12px] font-semibold text-grey-500 hover:text-ink"
            idle="Eliminar"
            pending="Eliminando…"
          />
        </form>
      </div>
    </li>
  );
}

function AddForm({
  onDone,
  cities,
}: {
  onDone: () => void;
  cities: AddressCity[];
}) {
  const [state, action, pending] = useActionState(addAddressAction, initial);
  const fe = state.fieldErrors;
  // Ciudad del catálogo del calculador; "otra" → texto libre sin estimado.
  const [citySel, setCitySel] = useState<string>(cities.length > 0 ? "" : "otra");
  const selected = cities.find((c) => c.id === citySel) ?? null;

  // Al confirmarse, cerramos el form (la lista ya se revalidó server-side).
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="mt-4 rounded-[12px] border border-grey-200 bg-white p-4 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input name="label" label="Etiqueta (opcional)" placeholder="Casa, Oficina…" error={fe?.label} />
        <Input name="line" label="Dirección" placeholder="Calle, edificio, nº" error={fe?.line} required />
        {cities.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Ciudad
            </span>
            <select
              value={citySel}
              onChange={(e) => setCitySel(e.target.value)}
              className="h-11 px-3 rounded-[10px] bg-white border-[1.5px] border-grey-200 outline-none text-[14px] text-ink transition-colors focus:border-wine"
            >
              <option value="">Selecciona tu ciudad…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value="otra">Otra ciudad…</option>
            </select>
            {/* La ciudad del catálogo viaja como label (display) + slug (estimado). */}
            {selected ? (
              <>
                <input type="hidden" name="city" value={selected.label} />
                <input type="hidden" name="citySlug" value={selected.id} />
              </>
            ) : null}
          </label>
        ) : (
          <Input name="city" label="Ciudad" placeholder="Valencia" error={fe?.city} />
        )}
        <Input name="state" label="Estado" placeholder="Carabobo" error={fe?.state} />
      </div>
      {cities.length > 0 && citySel === "otra" ? (
        <Input
          name="city"
          label="¿Cuál ciudad?"
          placeholder="Escribe tu ciudad"
          error={fe?.city}
        />
      ) : null}
      <Input name="reference" label="Punto de referencia (opcional)" placeholder="Frente a la plaza…" error={fe?.reference} />

      <label className="flex items-center gap-2 text-[13px] text-grey-700">
        <input type="checkbox" name="isDefault" className="accent-wine" /> Marcar como
        predeterminada
      </label>

      {state.error ? (
        <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar dirección"}
          {pending ? null : <ArrowIcon size={15} />}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-[13px] font-semibold text-grey-500 hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Botón de texto que se deshabilita mientras su <form> está en vuelo (evita el
 * doble-click en acciones destructivas). Debe vivir DENTRO del form (useFormStatus).
 */
function PendingTextButton({
  className,
  idle,
  pending,
}: {
  className: string;
  idle: string;
  pending: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={`${className} disabled:opacity-60`}>
      {busy ? pending : idle}
    </button>
  );
}

function Input({
  name,
  label,
  placeholder,
  error,
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        {label}
        {required ? <span className="text-wine"> *</span> : null}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="h-11 px-3 rounded-[10px] bg-white border-[1.5px] border-grey-200 outline-none text-[14px] text-ink transition-colors focus:border-wine"
      />
      {error ? <PortalFieldError>{error}</PortalFieldError> : null}
    </label>
  );
}
